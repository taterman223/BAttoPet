import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// 1 ATTO = 10^18 raw units.
const RAW_PER_ATTO = 1_000_000_000_000_000_000n;

// The public Gatekeeper endpoint used by the Atto Explorer.
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

    // Authenticate the player.
    const { data: userData } = await admin.auth.getUser(token);
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
        error: "Enter a valid 64-character transaction hash.",
      }, 400);
    }

    // Treasury is still kept as a Supabase secret.
    const treasury = Deno.env.get("ATTO_TREASURY_ADDRESS");

    if (!treasury) {
      return json({
        error: "ATTO treasury address is not configured.",
        needs_config: true,
      }, 503);
    }

    // Get the player.
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

    // ---------------------------------------------------------
    // 1. Find the transaction through the same Gatekeeper
    //    endpoint used by the Atto Explorer.
    // ---------------------------------------------------------

    const entryUrl =
      `${ATTO_GATEKEEPER}/accounts/entries/${txHash}/stream`;

    let entryRes: Response;

    try {
      entryRes = await fetch(entryUrl, {
        method: "GET",
        headers: {
          Accept: "application/x-ndjson, application/json",
        },
      });
    } catch (err) {
      console.error("Gatekeeper request failed:", err);

      return json({
        error: "Could not reach the ATTO Explorer network. Try again shortly.",
      }, 502);
    }

    if (!entryRes.ok) {
      if (entryRes.status === 404) {
        return json({
          error: "That transaction was not found on the ATTO network yet. Wait for it to confirm and try again.",
        }, 404);
      }

      return json({
        error: `The ATTO Explorer network returned an error (${entryRes.status}).`,
      }, 502);
    }

    // The endpoint is NDJSON, so read the first JSON object.
    const entryText = await readFirstJsonObject(entryRes);

    if (!entryText) {
      return json({
        error: "The ATTO transaction response was empty.",
      }, 502);
    }

    let entry: any;

    try {
      entry = JSON.parse(entryText);
    } catch (err) {
      console.error("Could not parse Gatekeeper response:", entryText);

      return json({
        error: "The ATTO transaction response could not be read.",
      }, 502);
    }

    // Make sure the returned hash is the hash the player submitted.
    if (String(entry?.hash ?? "").toUpperCase() !== txHash) {
      return json({
        error: "The returned transaction does not match the submitted hash.",
      }, 400);
    }

    // Must be a SEND.
    if (entry?.blockType !== "SEND") {
      return json({
        error: "That transaction is not a payment (send) transaction.",
      }, 400);
    }

    // The Gatekeeper hostname is the LIVE network endpoint.
    // The Explorer response itself does not need a separate network field.

    // ---------------------------------------------------------
    // 2. Get sender and receiver addresses from their public keys.
    // ---------------------------------------------------------

    const senderPublicKey = String(entry?.publicKey ?? "").toUpperCase();
    const receiverPublicKey =
      String(entry?.subjectPublicKey ?? "").toUpperCase();

    if (!/^[0-9A-F]{64}$/.test(senderPublicKey)) {
      return json({
        error: "The transaction sender public key is invalid.",
      }, 502);
    }

    if (!/^[0-9A-F]{64}$/.test(receiverPublicKey)) {
      return json({
        error: "The transaction receiver public key is invalid.",
      }, 502);
    }

    const [senderAccount, receiverAccount] = await Promise.all([
      getAccountFromPublicKey(senderPublicKey),
      getAccountFromPublicKey(receiverPublicKey),
    ]);

    if (!senderAccount?.address) {
      return json({
        error: "Could not determine the sender ATTO address.",
      }, 502);
    }

    if (!receiverAccount?.address) {
      return json({
        error: "Could not determine the receiver ATTO address.",
      }, 502);
    }

    const senderAddress = String(senderAccount.address);
    const receiverAddress = String(receiverAccount.address);

    // ---------------------------------------------------------
    // 3. Verify sender.
    // ---------------------------------------------------------

    if (senderAddress !== player.atto_address) {
      return json({
        error:
          "The payment was not sent from the ATTO address registered to your account.",
      }, 400);
    }

    // ---------------------------------------------------------
    // 4. Verify treasury recipient.
    // ---------------------------------------------------------

    if (receiverAddress !== treasury) {
      return json({
        error:
          "The payment was not sent to the official ATTO Pets address.",
      }, 400);
    }

    // ---------------------------------------------------------
    // 5. Calculate payment amount.
    //
    // For a SEND account entry:
    // amount = previousBalance - balance
    // ---------------------------------------------------------

    let previousBalance: bigint;
    let balance: bigint;

    try {
      previousBalance = BigInt(entry.previousBalance);
      balance = BigInt(entry.balance);
    } catch {
      return json({
        error: "The transaction balance could not be read.",
      }, 502);
    }

    if (previousBalance < balance) {
      return json({
        error: "The transaction balance data is invalid.",
      }, 502);
    }

    const amountRaw = previousBalance - balance;
    const requiredRaw = BigInt(egg.price) * RAW_PER_ATTO;

    if (amountRaw < requiredRaw) {
      return json({
        error:
          `The payment (${formatAtto(amountRaw)} ATTO) is less than the ${egg.price} ATTO price for this egg.`,
      }, 400);
    }

    // ---------------------------------------------------------
    // 6. Replay protection.
    // ---------------------------------------------------------

    const { error: claimErr } = await admin
      .from("used_transaction_hashes")
      .insert({
        hash: txHash,
        player_id: player.id,
        egg_type: eggType,
        amount: egg.price,
      });

    if (claimErr) {
      if ((claimErr as { code?: string }).code === "23505") {
        return json({
          error: "This transaction has already been redeemed.",
        }, 409);
      }

      console.error("Transaction claim error:", claimErr);

      return json({
        error: "Could not record your payment. Try again.",
      }, 500);
    }

    // ---------------------------------------------------------
    // 7. Generate the pet.
    // ---------------------------------------------------------

    const { data: pet, error: petErr } = await admin.rpc(
      "generate_pet",
      {
        p_owner: player.id,
        p_tier: egg.tier,
      },
    );

    if (petErr || !pet) {
      console.error("Pet generation error:", petErr);

      return json({
        error:
          "Payment verified but the pet could not be created. Please contact support.",
      }, 500);
    }

    // ---------------------------------------------------------
    // 8. Record purchase.
    // ---------------------------------------------------------

    const { error: purchaseErr } = await admin
      .from("purchases")
      .insert({
        player_id: player.id,
        tx_hash: txHash,
        egg_type: eggType,
        pet_id: pet.id,
      });

    if (purchaseErr) {
      console.error("Purchase record error:", purchaseErr);

      // The pet has already been awarded, so don't tell the
      // player payment verification failed.
      console.error(
        "WARNING: pet was created but purchase record failed:",
        txHash,
      );
    }

    return json({
      ok: true,
      pet,
    });

  } catch (err) {
    console.error("Hatch egg error:", err);

    return json({
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});

// -------------------------------------------------------------
// Read the first JSON object from an NDJSON response.
// -------------------------------------------------------------

async function readFirstJsonObject(
  response: Response,
): Promise<string | null> {
  if (!response.body) {
    return null;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split("\n");

      // Keep the unfinished line.
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed) {
          try {
            JSON.parse(trimmed);
            await reader.cancel();
            return trimmed;
          } catch {
            // Keep reading if this wasn't a complete JSON object.
          }
        }
      }
    }

    const finalLine = buffer.trim();

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
      // Ignore reader cleanup errors.
    }
  }
}

// -------------------------------------------------------------
// Query the Gatekeeper account endpoint for an address.
// -------------------------------------------------------------

async function getAccountFromPublicKey(
  publicKey: string,
): Promise<any> {
  const url =
    `${ATTO_GATEKEEPER}/accounts/${publicKey}/stream`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/x-ndjson, application/json",
      },
    });
  } catch (err) {
    console.error(
      "Account lookup failed:",
      publicKey,
      err,
    );

    throw new Error(
      "Could not reach the ATTO network while resolving an account address.",
    );
  }

  if (!response.ok) {
    throw new Error(
      `Could not resolve ATTO account (${response.status}).`,
    );
  }

  const text = await readFirstJsonObject(response);

  if (!text) {
    throw new Error(
      "The ATTO account response was empty.",
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "The ATTO account response could not be parsed.",
    );
  }
}

function formatAtto(raw: bigint): string {
  const whole = raw / RAW_PER_ATTO;
  const fraction = raw % RAW_PER_ATTO;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionText = fraction
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");

  return `${whole}.${fractionText}`;
}

function json(body: unknown, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}
