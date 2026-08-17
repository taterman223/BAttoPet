import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// 1 ATTO = 10^18 raw units.
const RAW_PER_ATTO = 1_000_000_000_000_000_000n;

// Authoritative egg catalog. Each egg guarantees a specific tier at a fixed ATTO price.
// Clients cannot change these — the server is the source of truth.
const EGGS: Record<string, { price: number; tier: string }> = {
  worthless:  { price: 1,   tier: "Worthless" },
  decent:     { price: 5,   tier: "Decent" },
  average:    { price: 10,  tier: "Average" },
  good:       { price: 25,  tier: "Good" },
  fabulous:   { price: 50,  tier: "Fabulous" },
  excellent:  { price: 100, tier: "Excellent" },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "You must be signed in." }, 401);

    const body = await req.json();
    const eggType = String(body?.egg_type ?? "");
    const txHash = String(body?.tx_hash ?? "").trim().toUpperCase();

    const egg = EGGS[eggType];
    if (!egg) return json({ error: "Unknown egg type." }, 400);
    if (!/^[0-9A-F]{64}$/.test(txHash)) {
      return json({ error: "Enter a valid 64-character transaction hash." }, 400);
    }

    // Read config: prefer env secrets, fall back to game_config table.
    let treasury = Deno.env.get("ATTO_TREASURY_ADDRESS");
    let nodeUrl = Deno.env.get("ATTO_NODE_URL");
    if (!treasury || !nodeUrl) {
      const { data: cfg } = await admin.from("game_config").select("key, value").in("key", ["atto_treasury_address", "atto_node_url"]);
      for (const row of cfg ?? []) {
        if (row.key === "atto_treasury_address") treasury = treasury ?? row.value;
        if (row.key === "atto_node_url") nodeUrl = nodeUrl ?? row.value;
      }
    }
    if (!treasury) {
      return json({
        error: "Egg purchases are not available yet: the game operator has not configured the ATTO treasury address (ATTO_TREASURY_ADDRESS).",
        needs_config: true,
      }, 503);
    }
    if (!nodeUrl) {
      return json({
        error: "Egg purchases are not available yet: the game operator has not configured the ATTO node endpoint (ATTO_NODE_URL).",
        needs_config: true,
      }, 503);
    }

    const { data: player } = await admin
      .from("players")
      .select("id, atto_address")
      .eq("id", user.id)
      .maybeSingle();
    if (!player) return json({ error: "Player profile not found." }, 404);

    // --- Independently query the real ATTO network for this transaction ---
    let txRes: Response;
    try {
      txRes = await fetch(`${nodeUrl.replace(/\/$/, "")}/transactions/${txHash}`, {
        headers: { Accept: "application/json" },
      });
    } catch {
      return json({ error: "Could not reach the ATTO network to verify your payment. Try again shortly." }, 502);
    }
    if (txRes.status === 404) {
      return json({ error: "That transaction was not found on the ATTO network yet. Wait for it to confirm and try again." }, 404);
    }
    if (!txRes.ok) {
      return json({ error: `The ATTO network returned an error (${txRes.status}) while verifying your payment.` }, 502);
    }

    const tx = await txRes.json();
    const block = tx?.block;
    if (!block) return json({ error: "The transaction could not be read from the ATTO network." }, 502);

    // Must be a confirmed SEND on the LIVE network.
    if (block.type !== "SEND") {
      return json({ error: "That transaction is not a payment (send) transaction." }, 400);
    }
    if (block.network !== "LIVE") {
      return json({ error: "That transaction is not on the ATTO live network." }, 400);
    }
    // Sender must be the player's registered address.
    if (block.address !== player.atto_address) {
      return json({ error: "The payment was not sent from the ATTO address registered to your account." }, 400);
    }
    // Recipient must be the official treasury.
    if (block.receiverAddress !== treasury) {
      return json({ error: "The payment was not sent to the official ATTO Pets address." }, 400);
    }
    // Amount must cover the egg price.
    let amountRaw: bigint;
    try {
      amountRaw = BigInt(block.amount);
    } catch {
      return json({ error: "The transaction amount could not be read." }, 502);
    }
    const requiredRaw = BigInt(egg.price) * RAW_PER_ATTO;
    if (amountRaw < requiredRaw) {
      return json({ error: `The payment (${Number(amountRaw) / 1e18} ATTO) is less than the ${egg.price} ATTO price for this egg.` }, 400);
    }

    // --- Replay protection: claim the hash atomically before awarding anything ---
    const { error: claimErr } = await admin.from("used_transaction_hashes").insert({
      hash: txHash,
      player_id: player.id,
      egg_type: eggType,
      amount: egg.price,
    });
    if (claimErr) {
      if ((claimErr as { code?: string }).code === "23505") {
        return json({ error: "This transaction has already been redeemed." }, 409);
      }
      return json({ error: "Could not record your payment. Try again." }, 500);
    }

    // --- Award the egg: generate + save the pet server-side ---
    const { data: pet, error: petErr } = await admin.rpc("generate_pet", {
      p_owner: player.id,
      p_tier: egg.tier,
    });
    if (petErr || !pet) {
      return json({ error: "Payment verified but the pet could not be created. Please contact support." }, 500);
    }

    await admin.from("purchases").insert({
      player_id: player.id,
      tx_hash: txHash,
      egg_type: eggType,
      pet_id: pet.id,
    });

    return json({ ok: true, pet });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
