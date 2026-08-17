import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RAW_PER_ATTO = 1_000_000_000_000_000_000n;

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

    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;

    if (!user) {
      return json({ error: "You must be signed in." }, 401);
    }

    const body = await req.json();

    const eggType = String(body?.egg_type ?? "");
    const txHash = String(body?.tx_hash ?? "")
      .trim()
      .toUpperCase();

    const egg = EGGS[eggType];

    if (!egg) {
      return json({ error: "Unknown egg type." }, 400);
    }

    if (!/^[0-9A-F]{64}$/.test(txHash)) {
      return json({
        error: "Enter a valid 64-character transaction hash.",
      }, 400);
    }

    const treasury = Deno.env.get("ATTO_TREASURY_ADDRESS");

    if (!treasury) {
      return json({
        error: "ATTO treasury address is not configured.",
        needs_config: true,
      }, 503);
    }

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
    // Get the transaction from the same Gatekeeper endpoint
    // used by the Atto Explorer.
    // ---------------------------------------------------------

    const url =
      `${ATTO_GATEKEEPER}/accounts/entries/${txHash}/stream`;

    let response: Response;

    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/x-ndjson, application/json",
        },
      });
    } catch (err) {
      console.error("Gatekeeper request failed:", err);

      return json({
        error: "Could not reach the ATTO network to verify your payment.",
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
        error: "The ATTO transaction response was empty.",
      }, 502);
    }

    let entry: any;

    try {
      entry = JSON.parse(text);
    } catch {
      console.error("Invalid Gatekeeper response:", text);

      return json({
        error: "The ATTO transaction response could not be read.",
      }, 502);
    }

    // Make sure this is the requested transaction.
    if (
      String(entry?.hash ?? "").toUpperCase() !== txHash
    ) {
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

    // ---------------------------------------------------------
    // The Explorer response can provide the addresses directly.
    //
    // address = sender
    // subjectAddress = receiver
    //
    // If the Gatekeeper doesn't include them, use the public
    // keys to query the account endpoint.
    // ---------------------------------------------------------

    let senderAddress = entry?.address;
    let receiverAddress = entry?.subjectAddress;

    if (!senderAddress || !receiverAddress) {
      const senderPublicKey =
        String(entry?.publicKey ?? "").toUpperCase();

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

      const [senderAccount, receiverAccount] =
        await Promise.all([
          getAccount(senderPublicKey),
          getAccount(receiverPublicKey),
        ]);

      senderAddress =
        senderAccount?.address ?? senderAccount?.representativeAddress;

      receiverAddress =
        receiverAccount?.address ?? receiverAccount?.representativeAddress;
    }

    if (!senderAddress) {
      return json({
        error: "Could not determine the sender ATTO address.",
      }, 502);
    }

    if (!receiverAddress) {
      return json({
        error: "Could not determine the receiver ATTO address.",
      }, 502);
    }

    // ---------------------------------------------------------
    // Verify sender.
    // ---------------------------------------------------------

    if (senderAddress !== player.atto_address) {
      return json({
        error:
          "The payment was not sent from the ATTO address registered to your account.",
      }, 400);
    }

    // ---------------------------------------------------------
    // Verify treasury.
    // ---------------------------------------------------------

    if (receiverAddress !== treasury) {
      return json({
        error:
          "The payment was not sent to the official ATTO Pets address.",
      }, 400);
    }

    // ---------------------------------------------------------
    // Calculate amount.
    // For a SEND:
    //
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
    const requiredRaw =
      BigInt(egg.price) * RAW_PER_ATTO;

    if (amountRaw < requiredRaw) {
      return json({
        error:
          `The payment (${formatAtto(amountRaw)} ATTO) is less than the ${egg.price} ATTO price for this egg.`,
      }, 400);
    }

    // ---------------------------------------------------------
    // Prevent transaction from being redeemed twice.
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
      if (
        (claimErr as { code?: string }).code === "23505"
      ) {
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
    // Generate pet.
    // ---------------------------------------------------------

    const { data: pet, error: petErr } =
      await admin.rpc("generate_pet", {
        p_owner: player.id,
        p_tier: egg.tier,
      });

    if (petErr || !pet) {
      console.error("Pet generation error:", petErr);

      return json({
        error:
          "Payment verified but the pet could not be created. Please contact support.",
      }, 500);
    }

    // ---------------------------------------------------------
    // Record purchase.
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
    console.error("Hatch egg error:", err);

    return json({
      error:
        err instanceof Error
          ? err.message
          : String(err),
    }, 500);
  }
});

// -------------------------------------------------------------
// Read first JSON object from NDJSON.
// -------------------------------------------------------------

async function readFirstJson(
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
      const { value, done } =
        await reader.read();

      if (done) break;

      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split("\n");

      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) continue;

        try {
          JSON.parse(trimmed);

          await reader.cancel();

          return trimmed;
        } catch {
          // Continue reading.
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
      // Ignore cleanup errors.
    }
  }
}

// -------------------------------------------------------------
// Get an account from its public key.
// -------------------------------------------------------------

async function getAccount(
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
      err,
    );

    throw new Error(
      "Could not reach the ATTO network while resolving an account.",
    );
  }

  if (!response.ok) {
    throw new Error(
      `Could not resolve ATTO account (${response.status}).`,
    );
  }

  const text = await readFirstJson(response);

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
        "Content-Type": "application/json",
      },
    },
  );
}
