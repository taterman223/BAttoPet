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

// 1 ATTO = 10^9 raw units.
const RAW_PER_ATTO = 1_000_000_000n;

// This is the live Gatekeeper endpoint used by the Atto Explorer.
const ATTO_GATEKEEPER =
  "https://gatekeeper.live.application.atto.cash";

const EGGS: Record<string, { price: number; tier: string }> = {
  worthless: { price: 1, tier: "Worthless" },
  decent: { price: 5, tier: "Decent" },
  average: { price: 10, tier: "Average" },
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
    const token = (req.headers.get("Authorization") ?? "")
      .replace("Bearer ", "");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authenticate player.
    const { data: userData } =
      await admin.auth.getUser(token);

    const user = userData?.user;

    if (!user) {
      return json({
        error: "You must be signed in.",
      }, 401);
    }

    const body = await req.json();

    const eggType = String(body?.egg_type ?? "");

    const txHash = String(body?.tx_hash ?? "")
      .trim()
      .toUpperCase();

    const egg = EGGS[eggType];

    if (!egg) {
      return json({
        error: "Unknown egg type.",
      }, 400);
    }

    if (!/^[0-9A-F]{64}$/.test(txHash)) {
      return json({
        error:
          "Enter a valid 64-character transaction hash.",
      }, 400);
    }

    // Treasury is stored as a Supabase secret.
    const treasury =
      Deno.env.get("ATTO_TREASURY_ADDRESS")?.trim();

    if (!treasury) {
      return json({
        error:
          "ATTO treasury address is not configured.",
        needs_config: true,
      }, 503);
    }

    // Get player wallet.
    const { data: player } = await admin
      .from("players")
      .select("id, atto_address")
      .eq("id", user.id)
      .maybeSingle();

    if (!player) {
      return json({
        error: "Player profile not found.",
      }, 404);
    }

    if (!player.atto_address) {
      return json({
        error:
          "Your ATTO wallet address is not configured.",
      }, 400);
    }

    // ---------------------------------------------------------
    // 1. Get transaction from the Gatekeeper endpoint.
    // ---------------------------------------------------------

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

      return json({
        error:
          "Could not reach the ATTO network to verify your payment.",
      }, 502);
    }

    if (!response.ok) {
      if (response.status === 404) {
        return json({
          error:
            "That transaction was not found on the ATTO network yet. Wait for it to confirm and try again.",
        }, 404);
      }

      return json({
        error:
          `The ATTO network returned an error (${response.status}) while verifying your payment.`,
      }, 502);
    }

    const text = await readFirstJson(response);

    if (!text) {
      return json({
        error:
          "The ATTO transaction response was empty.",
      }, 502);
    }

    let tx: any;

    try {
      tx = JSON.parse(text);
    } catch {
      console.error(
        "Could not parse ATTO transaction:",
        text,
      );

      return json({
        error:
          "The ATTO transaction response could not be read.",
      }, 502);
    }

    // ---------------------------------------------------------
    // 2. Verify transaction hash.
    // ---------------------------------------------------------

    if (
      String(tx?.hash ?? "").toUpperCase() !==
      txHash
    ) {
      return json({
        error:
          "The returned transaction does not match the submitted hash.",
      }, 400);
    }

    // Must be SEND.
    if (tx?.blockType !== "SEND") {
      return json({
        error:
          "That transaction is not a payment (SEND) transaction.",
      }, 400);
    }

    // ---------------------------------------------------------
    // 3. Get public keys.
    // ---------------------------------------------------------

    const senderPublicKey =
      String(tx?.publicKey ?? "").toUpperCase();

    const receiverPublicKey =
      String(tx?.subjectPublicKey ?? "").toUpperCase();

    if (!/^[0-9A-F]{64}$/.test(senderPublicKey)) {
      return json({
        error:
          "The transaction sender public key is invalid.",
      }, 502);
    }

    if (!/^[0-9A-F]{64}$/.test(receiverPublicKey)) {
      return json({
        error:
          "The transaction receiver public key is invalid.",
      }, 502);
    }

    // ---------------------------------------------------------
    // 4. Derive the actual Atto addresses.
    // ---------------------------------------------------------

    const senderAddress =
      publicKeyToAttoAddress(senderPublicKey);

    const receiverAddress =
      publicKeyToAttoAddress(receiverPublicKey);

    console.log("ATTO payment verification:");
    console.log("Sender:", senderAddress);
    console.log("Receiver:", receiverAddress);
    console.log("Expected player:", player.atto_address);
    console.log("Expected treasury:", treasury);

    // ---------------------------------------------------------
    // 5. Verify sender.
    // ---------------------------------------------------------

    if (
      senderAddress.toLowerCase() !==
      String(player.atto_address).trim().toLowerCase()
    ) {
      return json({
        error:
          "The payment was not sent from the ATTO address registered to your account.",
      }, 400);
    }

    // ---------------------------------------------------------
    // 6. Verify treasury recipient.
    // ---------------------------------------------------------

    if (
      receiverAddress.toLowerCase() !==
      treasury.toLowerCase()
    ) {
      return json({
        error:
          "The payment was not sent to the official ATTO Pets address.",
      }, 400);
    }

    // ---------------------------------------------------------
    // 7. Calculate payment amount.
    //
    // SEND:
    // previousBalance - balance = amount sent
    // ---------------------------------------------------------

    let previousBalance: bigint;
    let balance: bigint;

    try {
      previousBalance = BigInt(tx.previousBalance);
      balance = BigInt(tx.balance);
    } catch {
      return json({
        error:
          "The transaction balance could not be read.",
      }, 502);
    }

    if (previousBalance < balance) {
      return json({
        error:
          "The transaction balance data is invalid.",
      }, 502);
    }

    const amountRaw =
      previousBalance - balance;

    const requiredRaw =
      BigInt(egg.price) * RAW_PER_ATTO;

    console.log("Payment amount raw:", amountRaw.toString());
    console.log("Required amount raw:", requiredRaw.toString());
    console.log("Payment amount ATTO:", formatAtto(amountRaw));

    if (amountRaw < requiredRaw) {
      return json({
        error:
          `The payment (${formatAtto(amountRaw)} ATTO) is less than the ${egg.price} ATTO price for this egg.`,
      }, 400);
    }

    // ---------------------------------------------------------
    // 8. Replay protection.
    // ---------------------------------------------------------

    const { error: claimErr } =
      await admin
        .from("used_transaction_hashes")
        .insert({
          hash: txHash,
          player_id: player.id,
          egg_type: eggType,
          amount: egg.price,
        });

    if (claimErr) {
      console.error(
        "Transaction claim error:",
        claimErr,
      );

      // Duplicate transaction.
      if (
        claimErr.code === "23505"
      ) {
        return json({
          error:
            "This transaction has already been redeemed.",
        }, 409);
      }

      // Return the real Supabase error so we can identify
      // exactly what is wrong with the database table.
      return json({
        error:
          "Database error recording payment.",
        details: claimErr.message,
        code: claimErr.code,
        hint: claimErr.hint ?? null,
        database_details: claimErr.details ?? null,
      }, 500);
    }

    // ---------------------------------------------------------
    // 9. Generate pet.
    // ---------------------------------------------------------

    const {
      data: pet,
      error: petErr,
    } = await admin.rpc(
      "generate_pet",
      {
        p_owner: player.id,
        p_tier: egg.tier,
      },
    );

    if (petErr || !pet) {
      console.error(
        "Pet generation error:",
        petErr,
      );

      return json({
        error:
          "Payment verified but the pet could not be created. Please contact support.",
        details: petErr?.message ?? null,
      }, 500);
    }

    // ---------------------------------------------------------
    // 10. Record purchase.
    // ---------------------------------------------------------

    const { error: purchaseErr } =
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
        "Purchase record error:",
        purchaseErr,
      );
    }

    return json({
      ok: true,
      pet,
    });

  } catch (err) {
    console.error(
      "Hatch egg error:",
      err,
    );

    return json({
      error:
        err instanceof Error
          ? err.message
          : String(err),
    }, 500);
  }
});

// =============================================================
// Convert an Atto public key to an Atto address.
// =============================================================

function publicKeyToAttoAddress(
  publicKeyHex: string,
): string {
  const publicKey = hexToBytes(
    publicKeyHex,
  );

  if (publicKey.length !== 32) {
    throw new Error(
      "ATTO public key must be exactly 32 bytes.",
    );
  }

  // V1 = algorithm byte 0.
  const algorithm = new Uint8Array([0]);

  // Checksum input = algorithm + public key.
  const checksumInput = new Uint8Array(33);

  checksumInput.set(algorithm, 0);
  checksumInput.set(publicKey, 1);

  // Atto uses BLAKE2b-40 = 5 bytes.
  const checksum = blake2b(
    checksumInput,
    { dkLen: 5 },
  );

  // 1 + 32 + 5 = 38 bytes.
  const addressBytes = new Uint8Array(38);

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

  // Standard Base32 encoder produces uppercase and padding.
  // Atto uses lowercase with no padding.
  const encoded =
    encodeBase32(addressBytes)
      .replace(/=+$/, "")
      .toLowerCase();

  return `atto://${encoded}`;
}

// =============================================================
// Convert hexadecimal string to bytes.
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
    new Uint8Array(hex.length / 2);

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
// Read first JSON object from NDJSON stream.
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
      } = await reader.read();

      if (done) {
        break;
      }

      buffer +=
        decoder.decode(
          value,
          { stream: true },
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
          // Continue reading.
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
      // Ignore cleanup errors.
    }
  }
}

// =============================================================
// Format raw ATTO amount for error messages.
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
// JSON response helper.
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
