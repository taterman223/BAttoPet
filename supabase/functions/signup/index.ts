import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ATTO_ADDR = /^atto:\/\/[a-z2-7]{61}$/;
const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;

// Weighted starter tier roll (biased to lower tiers).
function rollStarterTier(): string {
  const table: [string, number][] = [
    ["Worthless", 40],
    ["Average", 32],
    ["Decent", 18],
    ["Good", 7],
    ["Fabulous", 2.5],
    ["Excellent", 0.5],
  ];
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [tier, w] of table) {
    if (r < w) return tier;
    r -= w;
  }
  return "Average";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { username, password, atto_address } = await req.json();

    if (!USERNAME.test(username ?? "")) {
      return json({ error: "Username must be 3-20 letters, numbers or underscores." }, 400);
    }
    if (typeof password !== "string" || password.length < 6) {
      return json({ error: "Password must be at least 6 characters." }, 400);
    }
    if (!ATTO_ADDR.test(atto_address ?? "")) {
      return json({ error: "Enter a valid ATTO address (atto:// followed by 61 characters)." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await admin
      .from("players")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing) {
      return json({ error: "That username is already taken." }, 409);
    }

    const email = `${username.toLowerCase()}@atto-pets.local`;
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });
    if (authErr || !created?.user) {
      return json({ error: authErr?.message ?? "Could not create account." }, 400);
    }

    const userId = created.user.id;

    const { error: playerErr } = await admin.from("players").insert({
      id: userId,
      username,
      atto_address,
    });
    if (playerErr) {
      await admin.auth.admin.deleteUser(userId);
      return json({ error: "Could not create your player profile." }, 400);
    }

    const { error: petErr } = await admin.rpc("generate_pet", {
      p_owner: userId,
      p_tier: rollStarterTier(),
    });
    if (petErr) {
      return json({ error: "Account created but starter pet failed. Please contact support." }, 500);
    }

    return json({ ok: true, username, email });
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
