import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RAW_PER_ATTO = 1_000_000_000_000_000_000n;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const token = (req.headers.get("Authorization") ?? "")
      .replace("Bearer ", "")
      .trim();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: authError } =
      await admin.auth.getUser(token);

    if (authError) {
      console.error("AUTH ERROR:", authError);
      return json(
        {
          error: "Authentication failed.",
          details: authError.message,
        },
        401,
      );
    }

    const user = userData?.user;

    if (!user) {
      return json(
        {
          error: "You must be signed in.",
        },
        401,
      );
    }

    const body = await req.json();
    const action = String(body?.action ?? "");

    // =========================================================
    // LIST PET
    // =========================================================
    if (action === "list") {
      const petId = String(body?.pet_id ?? "").trim();
      const price = Number(body?.price);

      if (!petId) {
        return json(
          {
            error: "No pet ID was provided.",
          },
          400,
        );
      }

      if (!Number.isFinite(price) || price <= 0) {
        return json(
          {
            error: "Enter a valid price.",
          },
          400,
        );
      }

      console.log("Looking for pet:", petId);
      console.log("User:", user.id);

      // Find the pet and return the REAL database error if something fails.
      const {
        data: pet,
        error: petError,
      } = await admin
        .from("pets")
        .select("*")
        .eq("id", petId)
        .maybeSingle();

      if (petError) {
        console.error("PET DATABASE ERROR:", petError);

        return json(
          {
            error: "Database error while finding the pet.",
            details: petError.message,
            code: petError.code,
            hint: petError.hint,
            pet_id_received: petId,
          },
          500,
        );
      }

      if (!pet) {
        console.error("PET NOT FOUND:", petId);

        return json(
          {
            error: "Pet not found.",
            pet_id_received: petId,
          },
          404,
        );
      }

      console.log("Pet found:", pet);

      // Check ownership
      if (pet.owner_id !== user.id) {
        return json(
          {
            error: "You do not own this pet.",
          },
          403,
        );
      }

      // Check tradeable
      if (pet.tradeable === false) {
        return json(
          {
            error: "This pet cannot be traded.",
          },
          400,
        );
      }

      // Check battle status
      if (pet.in_battle === true) {
        return json(
          {
            error: "This pet is currently in a battle.",
          },
          400,
        );
      }

      // Check battle lock
      if (
        pet.battle_locked_until &&
        new Date(pet.battle_locked_until) > new Date()
      ) {
        return json(
          {
            error:
              "This pet is battle-locked and cannot be listed right now.",
          },
          400,
        );
      }

      // Check if already listed
      const {
        data: existing,
        error: existingError,
      } = await admin
        .from("marketplace_listings")
        .select("id")
        .eq("pet_id", petId)
        .eq("status", "active")
        .maybeSingle();

      if (existingError) {
        console.error("EXISTING LISTING ERROR:", existingError);

        return json(
          {
            error: "Database error while checking existing listings.",
            details: existingError.message,
            code: existingError.code,
            hint: existingError.hint,
          },
          500,
        );
      }

      if (existing) {
        return json(
          {
            error: "This pet is already listed.",
          },
          409,
        );
      }

      // Create listing
      const {
        data: listing,
        error: listingError,
      } = await admin
        .from("marketplace_listings")
        .insert({
          seller_id: user.id,
          pet_id: petId,
          price,
        })
        .select()
        .maybeSingle();

      if (listingError) {
        console.error("LISTING INSERT ERROR:", listingError);

        return json(
          {
            error: "Could not create the listing.",
            details: listingError.message,
            code: listingError.code,
            hint: listingError.hint,
          },
          500,
        );
      }

      return json({
        ok: true,
        listing,
      });
    }

    // =========================================================
    // CANCEL LISTING
    // =========================================================
    if (action === "cancel") {
      const listingId = String(body?.listing_id ?? "").trim();

      if (!listingId) {
        return json(
          {
            error: "No listing ID was provided.",
          },
          400,
        );
      }

      const {
        data: listing,
        error: listingError,
      } = await admin
        .from("marketplace_listings")
        .select("*")
        .eq("id", listingId)
        .maybeSingle();

      if (listingError) {
        console.error("LISTING LOOKUP ERROR:", listingError);

        return json(
          {
            error: "Database error while finding the listing.",
            details: listingError.message,
            code: listingError.code,
            hint: listingError.hint,
          },
          500,
        );
      }

      if (!listing) {
        return json(
          {
            error: "Listing not found.",
          },
          404,
        );
      }

      if (listing.seller_id !== user.id) {
        return json(
          {
            error: "This is not your listing.",
          },
          403,
        );
      }

      if (listing.status !== "active") {
        return json(
          {
            error: "This listing is no longer active.",
          },
          400,
        );
      }

      const { error } = await admin
        .from("marketplace_listings")
        .update({
          status: "cancelled",
        })
        .eq("id", listingId)
        .eq("status", "active");

      if (error) {
        console.error("CANCEL ERROR:", error);

        return json(
          {
            error: "Could not cancel the listing.",
            details: error.message,
            code: error.code,
            hint: error.hint,
          },
          500,
        );
      }

      return json({
        ok: true,
      });
    }

    // =========================================================
    // BUY
    // =========================================================
    if (action === "buy") {
      const listingId = String(body?.listing_id ?? "").trim();
      const txHash = String(body?.tx_hash ?? "")
        .trim()
        .toUpperCase();

      if (!listingId) {
        return json(
          {
            error: "No listing ID was provided.",
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

      let nodeUrl = Deno.env.get("ATTO_NODE_URL");

      if (!nodeUrl) {
        const {
          data: cfg,
          error: cfgError,
        } = await admin
          .from("game_config")
          .select("key, value")
          .eq("key", "atto_node_url")
          .maybeSingle();

        if (cfgError) {
          console.error("CONFIG ERROR:", cfgError);
        }

        nodeUrl = cfg?.value ?? undefined;
      }

      if (!nodeUrl) {
        return json(
          {
            error:
              "Marketplace purchases are not available yet: the game operator has not configured the ATTO node endpoint (ATTO_NODE_URL).",
            needs_config: true,
          },
          503,
        );
      }

      const base = nodeUrl.replace(/\/$/, "");

      const {
        data: listing,
        error: listingError,
      } = await admin
        .from("marketplace_listings")
        .select("*")
        .eq("id", listingId)
        .maybeSingle();

      if (listingError) {
        console.error("BUY LISTING ERROR:", listingError);

        return json(
          {
            error: "Database error while finding the listing.",
            details: listingError.message,
            code: listingError.code,
            hint: listingError.hint,
          },
          500,
        );
      }

      if (!listing) {
        return json(
          {
            error: "Listing not found.",
          },
          404,
        );
      }

      if (listing.status !== "active") {
        return json(
          {
            error:
              "This pet has already been sold or the listing was cancelled.",
          },
          409,
        );
      }

      if (listing.seller_id === user.id) {
        return json(
          {
            error: "You cannot buy your own listing.",
          },
          400,
        );
      }

      const {
        data: buyer,
        error: buyerError,
      } = await admin
        .from("players")
        .select("atto_address")
        .eq("id", user.id)
        .maybeSingle();

      if (buyerError) {
        console.error("BUYER LOOKUP ERROR:", buyerError);

        return json(
          {
            error: "Database error while finding the buyer.",
            details: buyerError.message,
            code: buyerError.code,
            hint: buyerError.hint,
          },
          500,
        );
      }

      const {
        data: seller,
        error: sellerError,
      } = await admin
        .from("players")
        .select("atto_address")
        .eq("id", listing.seller_id)
        .maybeSingle();

      if (sellerError) {
        console.error("SELLER LOOKUP ERROR:", sellerError);

        return json(
          {
            error: "Database error while finding the seller.",
            details: sellerError.message,
            code: sellerError.code,
            hint: sellerError.hint,
          },
          500,
        );
      }

      if (!buyer || !seller) {
        return json(
          {
            error: "Player records not found.",
          },
          404,
        );
      }

      // Verify payment on the ATTO network
      let txRes: Response;

      try {
        txRes = await fetch(
          `${base}/transactions/${txHash}`,
          {
            headers: {
              Accept: "application/json",
            },
          },
        );
      } catch {
        return json(
          {
            error:
              "Could not reach the ATTO network to verify your payment.",
          },
          502,
        );
      }

      if (txRes.status === 404) {
        return json(
          {
            error:
              "Transaction not found on the ATTO network yet. Wait for it to confirm.",
          },
          404,
        );
      }

      if (!txRes.ok) {
        return json(
          {
            error:
              `The ATTO network returned an error (${txRes.status}).`,
          },
          502,
        );
      }

      const tx = await txRes.json();
      const block = tx?.block;

      if (!block || block.type !== "SEND") {
        return json(
          {
            error: "That transaction is not a payment.",
          },
          400,
        );
      }

      if (block.network !== "LIVE") {
        return json(
          {
            error:
              "That transaction is not on the ATTO live network.",
          },
          400,
        );
      }

      if (block.address !== buyer.atto_address) {
        return json(
          {
            error:
              "Payment was not sent from your registered ATTO address.",
          },
          400,
        );
      }

      if (block.receiverAddress !== seller.atto_address) {
        return json(
          {
            error:
              "Payment was not sent to the seller's ATTO address.",
          },
          400,
        );
      }

      let amountRaw: bigint;

      try {
        amountRaw = BigInt(block.amount);
      } catch {
        return json(
          {
            error: "Amount could not be read.",
          },
          502,
        );
      }

      if (
        amountRaw <
        BigInt(Math.ceil(Number(listing.price))) *
          RAW_PER_ATTO
      ) {
        return json(
          {
            error:
              "The payment is less than the listing price.",
          },
          400,
        );
      }

      // Prevent transaction replay
      const {
        error: claimErr,
      } = await admin
        .from("used_transaction_hashes")
        .insert({
          hash: txHash,
          player_id: user.id,
          egg_type: "marketplace",
          amount: listing.price,
        });

      if (claimErr) {
        if (
          (claimErr as { code?: string }).code ===
          "23505"
        ) {
          return json(
            {
              error:
                "This transaction has already been used.",
            },
            409,
          );
        }

        console.error(
          "TRANSACTION CLAIM ERROR:",
          claimErr,
        );

        return json(
          {
            error: "Could not record the payment.",
            details: claimErr.message,
            code: claimErr.code,
            hint: claimErr.hint,
          },
          500,
        );
      }

      // Atomically mark listing as sold
      const {
        data: sold,
        error: soldErr,
      } = await admin
        .from("marketplace_listings")
        .update({
          status: "sold",
          buyer_id: user.id,
          sold_at: new Date().toISOString(),
        })
        .eq("id", listingId)
        .eq("status", "active")
        .select()
        .maybeSingle();

      if (soldErr) {
        console.error("MARK SOLD ERROR:", soldErr);

        return json(
          {
            error: "Could not complete the purchase.",
            details: soldErr.message,
            code: soldErr.code,
            hint: soldErr.hint,
          },
          500,
        );
      }

      if (!sold) {
        return json(
          {
            error:
              "This pet was just purchased by someone else.",
          },
          409,
        );
      }

      const {
        error: transferError,
      } = await admin
        .from("pets")
        .update({
          owner_id: user.id,
          in_battle: false,
        })
        .eq("id", listing.pet_id);

      if (transferError) {
        console.error(
          "PET TRANSFER ERROR:",
          transferError,
        );

        return json(
          {
            error:
              "Payment succeeded but pet ownership could not be transferred.",
            details: transferError.message,
            code: transferError.code,
            hint: transferError.hint,
          },
          500,
        );
      }

      return json({
        ok: true,
      });
    }

    return json(
      {
        error: "Unknown action.",
      },
      400,
    );
  } catch (err) {
    console.error("MARKETPLACE FUNCTION ERROR:", err);

    return json(
      {
        error: (err as Error).message,
      },
      500,
    );
  }
});

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
