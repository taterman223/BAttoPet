import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { blake2b } from "jsr:@noble/hashes/blake2.js";
import { encodeBase32 } from "jsr:@std/encoding/base32";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RAW_PER_ATTO = 1_000_000_000n;

const ATTO_GATEKEEPER =
  "https://gatekeeper.live.application.atto.cash";

const SPRITE_BUCKET = "pet-sprites";

// Current Gemini image-generation model.
const GEMINI_MODEL = "gemini-3.1-flash-image";

const EGGS: Record<string, { price: number; tier: string }> = {
  worthless: { price: 1, tier: "Worthless" },
  average: { price: 10, tier: "Average" },
  decent: { price: 5, tier: "Decent" },
  good: { price: 25, tier: "Good" },
  fabulous: { price: 50, tier: "Fabulous" },
  excellent: { price: 100, tier: "Excellent" },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // ============================================================
    // ENVIRONMENT
    // ============================================================

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const googleApiKey =
      Deno.env.get("GOOGLE_AI_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json(
        {
          error:
            "Supabase environment variables are missing.",
        },
        500,
      );
    }

    if (!googleApiKey) {
      return json(
        {
          error:
            "GOOGLE_AI_API_KEY is not configured.",
        },
        500,
      );
    }

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // ============================================================
    // AUTH
    // ============================================================

    const token =
      (req.headers.get("Authorization") ?? "")
        .replace(/^Bearer\s+/i, "")
        .trim();

    if (!token) {
      return json(
        {
          error: "You must be signed in.",
        },
        401,
      );
    }

    const {
      data: userData,
      error: authError,
    } = await admin.auth.getUser(token);

    const user = userData?.user;

    if (authError || !user) {
      return json(
        {
          error: "You must be signed in.",
          details:
            authError?.message ?? null,
        },
        401,
      );
    }

    // ============================================================
    // REQUEST
    // ============================================================

    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return json(
        {
          error: "Invalid JSON request.",
        },
        400,
      );
    }

    const eggType =
      String(body?.egg_type ?? "").trim();

    const txHash =
      String(body?.tx_hash ?? "")
        .trim()
        .toUpperCase();

    const egg = EGGS[eggType];

    if (!egg) {
      return json(
        {
          error: "Unknown egg type.",
        },
        400,
      );
    }

    if (!/^[0-9A-F]{64}$/.test(txHash)) {
      return json(
        {
          error:
            "Enter a valid 64-character transaction hash.",
        },
        400,
      );
    }

    // ============================================================
    // TREASURY
    // ============================================================

    const treasury =
      Deno.env
        .get("ATTO_TREASURY_ADDRESS")
        ?.trim();

    if (!treasury) {
      return json(
        {
          error:
            "ATTO treasury address is not configured.",
          needs_config: true,
        },
        503,
      );
    }

    // ============================================================
    // PLAYER
    // ============================================================

    const {
      data: player,
      error: playerError,
    } =
      await admin
        .from("players")
        .select("id, atto_address")
        .eq("id", user.id)
        .maybeSingle();

    if (playerError) {
      return json(
        {
          error:
            "Could not load player profile.",
          details:
            playerError.message,
        },
        500,
      );
    }

    if (!player) {
      return json(
        {
          error:
            "Player profile not found.",
        },
        404,
      );
    }

    if (!player.atto_address) {
      return json(
        {
          error:
            "Your ATTO wallet address is not configured.",
        },
        400,
      );
    }

    // ============================================================
    // VERIFY ATTO TRANSACTION
    // ============================================================

    const url =
      `${ATTO_GATEKEEPER}/accounts/entries/${txHash}/stream`;

    let response: Response;

    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept:
            "application/x-ndjson, application/json",
        },
      });
    } catch (err) {
      console.error(
        "ATTO Gatekeeper request failed:",
        err,
      );

      return json(
        {
          error:
            "Could not reach the ATTO network to verify your payment.",
        },
        502,
      );
    }

    if (!response.ok) {
      if (response.status === 404) {
        return json(
          {
            error:
              "That transaction was not found on the ATTO network yet. Wait for it to confirm and try again.",
          },
          404,
        );
      }

      return json(
        {
          error:
            `The ATTO network returned an error (${response.status}) while verifying your payment.`,
        },
        502,
      );
    }

    const text =
      await readFirstJson(response);

    if (!text) {
      return json(
        {
          error:
            "The ATTO transaction response was empty.",
        },
        502,
      );
    }

    let tx: any;

    try {
      tx = JSON.parse(text);
    } catch {
      return json(
        {
          error:
            "The ATTO transaction response could not be read.",
        },
        502,
      );
    }

    // ============================================================
    // VERIFY HASH
    // ============================================================

    if (
      String(tx?.hash ?? "").toUpperCase() !==
      txHash
    ) {
      return json(
        {
          error:
            "The returned transaction does not match the submitted hash.",
        },
        400,
      );
    }

    // ============================================================
    // VERIFY SEND
    // ============================================================

    if (tx?.blockType !== "SEND") {
      return json(
        {
          error:
            "That transaction is not a payment (SEND) transaction.",
        },
        400,
      );
    }

    // ============================================================
    // PUBLIC KEYS
    // ============================================================

    const senderPublicKey =
      String(tx?.publicKey ?? "").toUpperCase();

    const receiverPublicKey =
      String(tx?.subjectPublicKey ?? "").toUpperCase();

    if (!/^[0-9A-F]{64}$/.test(senderPublicKey)) {
      return json(
        {
          error:
            "The transaction sender public key is invalid.",
        },
        502,
      );
    }

    if (!/^[0-9A-F]{64}$/.test(receiverPublicKey)) {
      return json(
        {
          error:
            "The transaction receiver public key is invalid.",
        },
        502,
      );
    }

    // ============================================================
    // DERIVE ATTO ADDRESSES
    // ============================================================

    const senderAddress =
      publicKeyToAttoAddress(
        senderPublicKey,
      );

    const receiverAddress =
      publicKeyToAttoAddress(
        receiverPublicKey,
      );

    // ============================================================
    // VERIFY SENDER
    // ============================================================

    if (
      senderAddress.toLowerCase() !==
      String(player.atto_address)
        .trim()
        .toLowerCase()
    ) {
      return json(
        {
          error:
            "The payment was not sent from the ATTO address registered to your account.",
        },
        400,
      );
    }

    // ============================================================
    // VERIFY TREASURY
    // ============================================================

    if (
      receiverAddress.toLowerCase() !==
      treasury.toLowerCase()
    ) {
      return json(
        {
          error:
            "The payment was not sent to the official ATTO Pets address.",
        },
        400,
      );
    }

    // ============================================================
    // PAYMENT AMOUNT
    // ============================================================

    let previousBalance: bigint;
    let balance: bigint;

    try {
      previousBalance =
        BigInt(tx.previousBalance);

      balance =
        BigInt(tx.balance);
    } catch {
      return json(
        {
          error:
            "The transaction balance could not be read.",
        },
        502,
      );
    }

    if (previousBalance < balance) {
      return json(
        {
          error:
            "The transaction balance data is invalid.",
        },
        502,
      );
    }

    const amountRaw =
      previousBalance - balance;

    const requiredRaw =
      BigInt(egg.price) *
      RAW_PER_ATTO;

    if (amountRaw < requiredRaw) {
      return json(
        {
          error:
            `The payment (${formatAtto(amountRaw)} ATTO) is less than the ${egg.price} ATTO price for this egg.`,
        },
        400,
      );
    }

    // ============================================================
    // REPLAY PROTECTION
    // ============================================================

    const {
      error: claimErr,
    } =
      await admin
        .from("used_transaction_hashes")
        .insert({
          hash: txHash,
          player_id: player.id,
          egg_type: eggType,
          amount: egg.price,
        });

    if (claimErr) {
      if (claimErr.code === "23505") {
        return json(
          {
            error:
              "This transaction has already been redeemed.",
          },
          409,
        );
      }

      return json(
        {
          error:
            "Database error recording payment.",
          details:
            claimErr.message,
          code:
            claimErr.code,
          hint:
            claimErr.hint ?? null,
        },
        500,
      );
    }

    // ============================================================
    // GENERATE PET
    // ============================================================

    const {
      data: pet,
      error: petErr,
    } =
      await admin.rpc(
        "generate_pet",
        {
          p_owner: player.id,
          p_tier: egg.tier,
        },
      );

    if (petErr || !pet) {
      console.error(
        "PET GENERATION ERROR:",
        petErr,
      );

      await admin
        .from("used_transaction_hashes")
        .delete()
        .eq("hash", txHash);

      return json(
        {
          error:
            "Payment verified but the pet could not be created.",
          details:
            petErr?.message ?? null,
        },
        500,
      );
    }

    console.log(
      "PET CREATED:",
      {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        tier: pet.tier,
      },
    );

    // ============================================================
    // GENERATE AI SPRITE
    // ============================================================

    let spriteUrl: string;

    try {
      spriteUrl =
        await generateAndUploadSprite(
          admin,
          googleApiKey,
          pet,
        );
    } catch (spriteError) {
      console.error(
        "SPRITE GENERATION ERROR:",
        spriteError,
      );

      // Remove the pet.
      await admin
        .from("pets")
        .delete()
        .eq("id", pet.id);

      // Release transaction.
      await admin
        .from("used_transaction_hashes")
        .delete()
        .eq("hash", txHash);

      return json(
        {
          error:
            "The pet was generated, but its AI sprite could not be created. Your transaction was released so you can try again.",
          details:
            spriteError instanceof Error
              ? spriteError.message
              : String(spriteError),
        },
        502,
      );
    }

    // ============================================================
    // PURCHASE RECORD
    // ============================================================

    const {
      error: purchaseErr,
    } =
      await admin
        .from("purchases")
        .insert({
          player_id: player.id,
          tx_hash: txHash,
          egg_type: eggType,
          pet_id: pet.id,
        });

    if (purchaseErr) {
      console.error(
        "PURCHASE RECORD ERROR:",
        purchaseErr,
      );
    }

    // ============================================================
    // RETURN
    // ============================================================

    return json({
      ok: true,
      pet: {
        ...pet,
        sprite_url: spriteUrl,
      },
    });
  } catch (err) {
    console.error(
      "HATCH EGG ERROR:",
      err,
    );

    return json(
      {
        error:
          err instanceof Error
            ? err.message
            : String(err),
      },
      500,
    );
  }
});

// =============================================================
// GENERATE + UPLOAD SPRITE
// =============================================================

async function generateAndUploadSprite(
  admin: ReturnType<typeof createClient>,
  googleApiKey: string,
  pet: any,
): Promise<string> {
  const species =
    String(
      pet.species ??
        "fantasy creature",
    );

  const appearance =
    String(
      pet.appearance ??
        "",
    );

  const personality =
    String(
      pet.personality ??
        "",
    );

  const element =
    extractElement(appearance);

  const anatomy =
    speciesAnatomy(species);

  const prompt = `
Create ONE original collectible fantasy creature game sprite.

The creature species is: ${species}

THIS SPECIES MUST REMAIN UNMISTAKABLE.

Required anatomy:
${anatomy}

Appearance:
${appearance}

Personality:
${personality}

Element:
${element}

IMPORTANT:
The species determines the creature's anatomy.
Do not replace or reinterpret the species.

If the species is a BOAR:
- make it unmistakably a wild pig/boar
- stocky compact body
- four sturdy legs
- cloven hooves
- broad pig snout
- visible tusks
- triangular ears
- short tail
- mammal body
- absolutely NO wings
- absolutely NO antennae
- absolutely NO insect body
- absolutely NO moth anatomy

If the species is a MOTH:
- make it unmistakably a moth
- insect body
- six legs
- two large wings
- antennae

If the species is a WOLF:
- make it unmistakably a wolf
- canine body
- four legs
- wolf ears
- long muzzle
- bushy tail

If the species is a FROG:
- make it unmistakably a frog
- amphibian body
- four legs
- large eyes
- wide mouth

If the species is a DRAGON:
- make it unmistakably a fantasy dragon
- reptilian body
- four legs
- tail
- horns
- wings

The creature can have fantasy colors, magical markings,
elemental effects, crystals, accessories, and unusual features,
but its underlying anatomy MUST stay faithful to the species.

STYLE:
- polished collectible game sprite
- cute but detailed
- fantasy creature
- full body
- centered
- 3/4 view
- strong readable silhouette
- clean edges
- vibrant but coherent colors
- unique design
- isolated creature
- simple plain background
- square image

DO NOT INCLUDE:
- text
- letters
- numbers
- logos
- watermark
- humans
- multiple creatures
- scenery
- environment
- another animal
- hybrid anatomy

Generate ONLY the finished creature sprite.
`;

  console.log(
    "GEMINI SPRITE REQUEST:",
    {
      model: GEMINI_MODEL,
      species,
      element,
    },
  );

  // ============================================================
  // CURRENT GEMINI INTERACTIONS API
  // ============================================================

  const geminiResponse =
    await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-goog-api-key":
            googleApiKey,
        },

        body: JSON.stringify({
          model: GEMINI_MODEL,

          input: [
            {
              type: "text",
              text: prompt,
            },
          ],

          response_format: {
            type: "image",
            mime_type: "image/png",
            aspect_ratio: "1:1",
            image_size: "1K",
          },
        }),
      },
    );

  const geminiText =
    await geminiResponse.text();

  console.log(
    "GEMINI STATUS:",
    geminiResponse.status,
  );

  if (!geminiResponse.ok) {
    console.error(
      "GEMINI RESPONSE:",
      geminiText,
    );

    throw new Error(
      `Gemini image generation failed (${geminiResponse.status}): ${geminiText.slice(0, 1000)}`,
    );
  }

  let geminiData: any;

  try {
    geminiData =
      JSON.parse(geminiText);
  } catch {
    console.error(
      "INVALID GEMINI JSON:",
      geminiText.slice(0, 2000),
    );

    throw new Error(
      "Gemini returned invalid JSON.",
    );
  }

  // ============================================================
  // GET GENERATED IMAGE
  // ============================================================

  const imageBase64 =
    geminiData?.output_image?.data ??
    findImageInSteps(
      geminiData?.steps,
    );

  const mimeType =
    geminiData?.output_image?.mime_type ??
    findMimeTypeInSteps(
      geminiData?.steps,
    ) ??
    "image/png";

  if (!imageBase64) {
    console.error(
      "GEMINI DID NOT RETURN IMAGE:",
      JSON.stringify(
        geminiData,
      ).slice(0, 5000),
    );

    throw new Error(
      "Gemini completed but did not return an image.",
    );
  }

  console.log(
    "GEMINI IMAGE RECEIVED:",
    {
      mimeType,
      base64Length:
        imageBase64.length,
    },
  );

  // ============================================================
  // BASE64 → BYTES
  // ============================================================

  let imageBytes: Uint8Array;

  try {
    imageBytes =
      Uint8Array.from(
        atob(imageBase64),
        (char) =>
          char.charCodeAt(0),
      );
  } catch {
    throw new Error(
      "Gemini returned invalid image data.",
    );
  }

  if (imageBytes.length === 0) {
    throw new Error(
      "Gemini returned an empty image.",
    );
  }

  // ============================================================
  // STORAGE PATH
  // ============================================================

  const safePetId =
    String(pet.id)
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "",
      );

  const extension =
    mimeType.includes("jpeg")
      ? "jpg"
      : "png";

  const filePath =
    `pets/${safePetId}.${extension}`;

  // ============================================================
  // UPLOAD
  // ============================================================

  const {
    error: uploadError,
  } =
    await admin.storage
      .from(SPRITE_BUCKET)
      .upload(
        filePath,
        imageBytes,
        {
          contentType: mimeType,
          cacheControl:
            "31536000",
          upsert: true,
        },
      );

  if (uploadError) {
    console.error(
      "STORAGE UPLOAD ERROR:",
      uploadError,
    );

    throw new Error(
      `Could not upload sprite: ${uploadError.message}`,
    );
  }

  // ============================================================
  // PUBLIC URL
  // ============================================================

  const {
    data: publicData,
  } =
    admin.storage
      .from(SPRITE_BUCKET)
      .getPublicUrl(filePath);

  const publicUrl =
    publicData?.publicUrl;

  if (!publicUrl) {
    await admin.storage
      .from(SPRITE_BUCKET)
      .remove([filePath]);

    throw new Error(
      "Could not create sprite public URL.",
    );
  }

  // ============================================================
  // SAVE URL TO PET
  // ============================================================

  const {
    error: updateError,
  } =
    await admin
      .from("pets")
      .update({
        sprite_url: publicUrl,
      })
      .eq("id", pet.id);

  if (updateError) {
    console.error(
      "PET SPRITE URL UPDATE ERROR:",
      updateError,
    );

    await admin.storage
      .from(SPRITE_BUCKET)
      .remove([filePath]);

    throw new Error(
      `Could not save sprite URL: ${updateError.message}`,
    );
  }

  console.log(
    "SPRITE SAVED:",
    publicUrl,
  );

  return publicUrl;
}

// =============================================================
// FIND IMAGE IN INTERACTION STEPS
// =============================================================

function findImageInSteps(
  steps: any,
): string | null {
  if (!Array.isArray(steps)) {
    return null;
  }

  for (const step of steps) {
    if (step?.type !== "model_output") {
      continue;
    }

    const content =
      step?.content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const block of content) {
      if (
        block?.type === "image" &&
        typeof block?.data === "string"
      ) {
        return block.data;
      }
    }
  }

  return null;
}

// =============================================================
// FIND IMAGE MIME TYPE
// =============================================================

function findMimeTypeInSteps(
  steps: any,
): string | null {
  if (!Array.isArray(steps)) {
    return null;
  }

  for (const step of steps) {
    if (step?.type !== "model_output") {
      continue;
    }

    const content =
      step?.content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const block of content) {
      if (
        block?.type === "image" &&
        typeof block?.mime_type === "string"
      ) {
        return block.mime_type;
      }
    }
  }

  return null;
}

// =============================================================
// SPECIES ANATOMY
// =============================================================

function speciesAnatomy(
  species: string,
): string {
  const key =
    species
      .toLowerCase()
      .trim();

  const anatomy: Record<
    string,
    string
  > = {
    fox:
      "quadruped mammal, pointed fox ears, long fox muzzle, four legs, paws, large bushy tail",

    cat:
      "feline quadruped, cat ears, feline face, four legs, paws, long tail",

    wolf:
      "large canine quadruped, wolf ears, long muzzle, four legs, paws, bushy tail",

    dragon:
      "fantasy reptilian dragon, four legs, long tail, horns, wings, claws",

    slime:
      "amorphous gelatinous creature with a rounded slime body and no normal animal anatomy",

    owl:
      "bird anatomy, round owl body, large forward-facing eyes, beak, two wings, feathers, talons",

    rabbit:
      "small mammal quadruped, very long upright ears, rabbit face, four legs, paws, fluffy tail",

    bear:
      "large stocky mammal, bear head, rounded ears, four thick legs, paws, short tail",

    serpent:
      "long snake-like reptile body, scales, elongated body, no legs",

    moth:
      "insect anatomy, six legs, two large wings, antennae, segmented body",

    frog:
      "amphibian frog anatomy, squat body, four legs, large eyes, wide mouth",

    bat:
      "small mammal bat anatomy, two membrane wings, large ears, four limbs, furry body",

    stag:
      "deer-like quadruped mammal, hooves, long legs, antlers, deer head, short tail",

    boar:
      "stocky wild pig mammal, compact body, four short sturdy legs, cloven hooves, broad pig snout, tusks, triangular ears, short tail",

    kraken:
      "fantasy cephalopod, central body with multiple tentacles, squid/octopus-like anatomy",

    golem:
      "large magical construct made from stone or crystal, heavy blocky limbs and humanoid shape",

    raven:
      "black corvid bird anatomy, feathers, beak, two wings, two legs, talons",

    eel:
      "long slender aquatic fish-like body, fins, smooth elongated silhouette, no legs",

    ram:
      "stocky sheep-like quadruped mammal, woolly body, curled horns, four legs, hooves",

    beetle:
      "insect anatomy, six legs, hard wing covers, antennae, segmented body",
  };

  return (
    anatomy[key] ??
    `distinctive ${species} anatomy that is immediately recognizable and does not resemble another species`
  );
}

// =============================================================
// ELEMENT
// =============================================================

function extractElement(
  appearance: string,
): string {
  const elements = [
    "fire",
    "ice",
    "water",
    "nature",
    "lightning",
    "shadow",
    "light",
    "wind",
    "earth",
    "arcane",
  ];

  const lower =
    appearance.toLowerCase();

  for (const element of elements) {
    if (lower.includes(element)) {
      return element;
    }
  }

  return "arcane";
}

// =============================================================
// ATTO ADDRESS
// =============================================================

function publicKeyToAttoAddress(
  publicKeyHex: string,
): string {
  const publicKey =
    hexToBytes(publicKeyHex);

  if (publicKey.length !== 32) {
    throw new Error(
      "ATTO public key must be exactly 32 bytes.",
    );
  }

  const algorithm =
    new Uint8Array([0]);

  const checksumInput =
    new Uint8Array(33);

  checksumInput.set(
    algorithm,
    0,
  );

  checksumInput.set(
    publicKey,
    1,
  );

  const checksum =
    blake2b(
      checksumInput,
      {
        dkLen: 5,
      },
    );

  const addressBytes =
    new Uint8Array(38);

  addressBytes.set(
    algorithm,
    0,
  );

  addressBytes.set(
    publicKey,
    1,
  );

  addressBytes.set(
    checksum,
    33,
  );

  const encoded =
    encodeBase32(addressBytes)
      .replace(/=+$/, "")
      .toLowerCase();

  return `atto://${encoded}`;
}

// =============================================================
// HEX → BYTES
// =============================================================

function hexToBytes(
  hex: string,
): Uint8Array {
  if (
    hex.length % 2 !== 0 ||
    !/^[0-9A-Fa-f]+$/.test(hex)
  ) {
    throw new Error(
      "Invalid hexadecimal public key.",
    );
  }

  const bytes =
    new Uint8Array(
      hex.length / 2,
    );

  for (
    let i = 0;
    i < hex.length;
    i += 2
  ) {
    bytes[i / 2] =
      parseInt(
        hex.slice(i, i + 2),
        16,
      );
  }

  return bytes;
}

// =============================================================
// READ FIRST JSON FROM ATTO NDJSON
// =============================================================

async function readFirstJson(
  response: Response,
): Promise<string | null> {
  if (!response.body) {
    return null;
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let buffer = "";

  try {
    while (true) {
      const {
        value,
        done,
      } =
        await reader.read();

      if (done) {
        break;
      }

      buffer +=
        decoder.decode(
          value,
          {
            stream: true,
          },
        );

      const lines =
        buffer.split("\n");

      buffer =
        lines.pop() ?? "";

      for (const line of lines) {
        const trimmed =
          line.trim();

        if (!trimmed) {
          continue;
        }

        try {
          JSON.parse(trimmed);

          await reader.cancel();

          return trimmed;
        } catch {
          // Continue.
        }
      }
    }

    const finalLine =
      buffer.trim();

    if (finalLine) {
      try {
        JSON.parse(finalLine);
        return finalLine;
      } catch {
        return null;
      }
    }

    return null;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore cleanup.
    }
  }
}

// =============================================================
// FORMAT ATTO
// =============================================================

function formatAtto(
  raw: bigint,
): string {
  const whole =
    raw / RAW_PER_ATTO;

  const fraction =
    raw % RAW_PER_ATTO;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionText =
    fraction
      .toString()
      .padStart(9, "0")
      .replace(/0+$/, "");

  return `${whole}.${fractionText}`;
}

// =============================================================
// JSON RESPONSE
// =============================================================

function json(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    },
  );
}
