import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TIER_INDEX: Record<string, number> = {
  Worthless: 1,
  Average: 2,
  Decent: 3,
  Good: 4,
  Fabulous: 5,
  Excellent: 6,
};

type PassiveEffect = {
  type?: string;
  value?: number;
} | null;

type Pet = {
  id: string;
  owner_id: string;
  name: string;
  species: string | null;
  tier: string;
  appearance: string | null;
  personality: string | null;
  description: string | null;
  passive_name: string | null;
  passive_description: string | null;
  passive_effect: PassiveEffect;
  attack: number;
  defense: number;
  speed: number;
  max_health: number;
  crit_chance: number;
  multi_attack_chance: number;
  tradeable: boolean;
  is_clone: boolean;
  in_battle: boolean;
  battle_locked_until: string | null;
  sprite_seed: number | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function eligible(pet: Pet): string | null {
  if (pet.in_battle) {
    return "This pet is already in a battle.";
  }

  if (
    pet.battle_locked_until &&
    new Date(pet.battle_locked_until) > new Date()
  ) {
    return "This pet is battle-locked for 24 hours after a loss.";
  }

  return null;
}

function passiveVal(pet: Pet, type: string): number {
  if (!pet.passive_effect) return 0;

  if (pet.passive_effect.type !== type) return 0;

  return Number(pet.passive_effect.value ?? 0);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // ============================================================
    // AUTH
    // ============================================================

    const authorization =
      req.headers.get("Authorization") ?? "";

    const token = authorization
      .replace(/^Bearer\s+/i, "")
      .trim();

    if (!token) {
      return json(
        {
          error: "Missing authorization token.",
        },
        401,
      );
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json(
        {
          error:
            "Supabase environment variables are missing.",
          has_url: !!supabaseUrl,
          has_service_role_key:
            !!serviceRoleKey,
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

    const {
      data: userData,
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !userData?.user) {
      return json(
        {
          error: "You must be signed in.",
          auth_error:
            authError?.message ?? null,
        },
        401,
      );
    }

    const user = userData.user;

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

    const action =
      String(body?.action ?? "").trim();

    if (!action) {
      return json(
        {
          error: "No battle action supplied.",
        },
        400,
      );
    }

    console.log("BATTLE REQUEST", {
      action,
      userId: user.id,
    });

    // ============================================================
    // CREATE
    // ============================================================

    if (action === "create") {
      const petId =
        String(body?.pet_id ?? "").trim();

      if (!petId) {
        return json(
          {
            error: "No pet_id was supplied.",
            user_id: user.id,
          },
          400,
        );
      }

      console.log(
        "BATTLE CREATE PET LOOKUP",
        {
          petId,
          userId: user.id,
        },
      );

      const {
        data: pet,
        error: petError,
      } = await admin
        .from("pets")
        .select("*")
        .eq("id", petId)
        .maybeSingle();

      if (petError) {
        console.error(
          "PET LOOKUP DATABASE ERROR",
          {
            message: petError.message,
            code: petError.code,
            details: petError.details,
            hint: petError.hint,
            petId,
            userId: user.id,
          },
        );

        return json(
          {
            error:
              "Database error while finding pet.",
            details: petError.message,
            code: petError.code,
            hint: petError.hint,
            database_details:
              petError.details,
            pet_id: petId,
            user_id: user.id,
          },
          500,
        );
      }

      if (!pet) {
        return json(
          {
            error: "Pet not found.",
            pet_id: petId,
            user_id: user.id,
          },
          404,
        );
      }

      const typedPet = pet as Pet;

      if (typedPet.owner_id !== user.id) {
        return json(
          {
            error:
              "You do not own this pet.",
          },
          403,
        );
      }

      const eligibilityError =
        eligible(typedPet);

      if (eligibilityError) {
        return json(
          {
            error: eligibilityError,
          },
          400,
        );
      }

      const {
        data: battle,
        error: battleError,
      } = await admin
        .from("battles")
        .insert({
          creator_id: user.id,
          creator_pet_id: typedPet.id,
          creator_current_hp:
            typedPet.max_health,
          status: "waiting",
        })
        .select()
        .single();

      if (battleError) {
        console.error(
          "BATTLE CREATE ERROR",
          battleError,
        );

        return json(
          {
            error:
              "Could not create the battle.",
            details:
              battleError.message,
            code: battleError.code,
            hint: battleError.hint,
          },
          500,
        );
      }

      const {
        error: lockError,
      } = await admin
        .from("pets")
        .update({
          in_battle: true,
        })
        .eq("id", typedPet.id);

      if (lockError) {
        console.error(
          "PET LOCK ERROR",
          lockError,
        );

        await admin
          .from("battles")
          .delete()
          .eq("id", battle.id);

        return json(
          {
            error:
              "Could not lock pet for battle.",
            details:
              lockError.message,
          },
          500,
        );
      }

      return json({
        ok: true,
        battle_id: battle.id,
      });
    }

    // ============================================================
    // CANCEL
    // ============================================================

    if (action === "cancel") {
      const battleId =
        String(body?.battle_id ?? "").trim();

      if (!battleId) {
        return json(
          {
            error:
              "No battle_id was supplied.",
          },
          400,
        );
      }

      const {
        data: battle,
        error: battleError,
      } = await admin
        .from("battles")
        .select("*")
        .eq("id", battleId)
        .maybeSingle();

      if (battleError) {
        return json(
          {
            error:
              "Could not find battle.",
            details:
              battleError.message,
            code:
              battleError.code,
            hint:
              battleError.hint,
          },
          500,
        );
      }

      if (!battle) {
        return json(
          {
            error: "Battle not found.",
          },
          404,
        );
      }

      if (battle.creator_id !== user.id) {
        return json(
          {
            error:
              "Only the creator can cancel.",
          },
          403,
        );
      }

      if (battle.status !== "waiting") {
        return json(
          {
            error:
              "This battle can no longer be cancelled.",
          },
          400,
        );
      }

      const {
        error: cancelError,
      } = await admin
        .from("battles")
        .update({
          status: "cancelled",
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", battleId)
        .eq("status", "waiting");

      if (cancelError) {
        return json(
          {
            error:
              "Could not cancel battle.",
            details:
              cancelError.message,
          },
          500,
        );
      }

      await admin
        .from("pets")
        .update({
          in_battle: false,
        })
        .eq("id", battle.creator_pet_id);

      return json({
        ok: true,
      });
    }

    // ============================================================
    // JOIN
    // ============================================================

    if (action === "join") {
      const battleId =
        String(body?.battle_id ?? "").trim();

      const petId =
        String(body?.pet_id ?? "").trim();

      if (!battleId || !petId) {
        return json(
          {
            error:
              "battle_id and pet_id are required.",
          },
          400,
        );
      }

      const {
        data: battle,
        error: battleError,
      } = await admin
        .from("battles")
        .select("*")
        .eq("id", battleId)
        .maybeSingle();

      if (battleError) {
        return json(
          {
            error:
              "Could not find battle.",
            details:
              battleError.message,
            code:
              battleError.code,
            hint:
              battleError.hint,
          },
          500,
        );
      }

      if (!battle) {
        return json(
          {
            error: "Battle not found.",
          },
          404,
        );
      }

      if (battle.status !== "waiting") {
        return json(
          {
            error:
              "This battle is no longer open.",
          },
          409,
        );
      }

      if (battle.creator_id === user.id) {
        return json(
          {
            error:
              "You cannot join your own battle.",
          },
          400,
        );
      }

      // ----------------------------------------------------------
      // Load joining pet
      // ----------------------------------------------------------

      const {
        data: joinerPet,
        error: joinerPetError,
      } = await admin
        .from("pets")
        .select("*")
        .eq("id", petId)
        .maybeSingle();

      if (joinerPetError) {
        console.error(
          "JOINER PET ERROR",
          joinerPetError,
        );

        return json(
          {
            error:
              "Database error while finding your pet.",
            details:
              joinerPetError.message,
            code:
              joinerPetErrorError?.code ??
              joinerPetError.code,
            hint:
              joinerPetError.hint,
            database_details:
              joinerPetError.details,
            pet_id: petId,
          },
          500,
        );
      }

      // ----------------------------------------------------------
      // Load creator pet
      // ----------------------------------------------------------

      const {
        data: creatorPet,
        error: creatorPetError,
      } = await admin
        .from("pets")
        .select("*")
        .eq("id", battle.creator_pet_id)
        .maybeSingle();

      if (creatorPetError) {
        console.error(
          "CREATOR PET ERROR",
          creatorPetError,
        );

        return json(
          {
            error:
              "Database error while finding battle pet.",
            details:
              creatorPetError.message,
            code:
              creatorPetError.code,
            hint:
              creatorPetError.hint,
            database_details:
              creatorPetError.details,
            pet_id:
              battle.creator_pet_id,
          },
          500,
        );
      }

      if (!joinerPet) {
        return json(
          {
            error:
              "Your selected pet was not found.",
            pet_id: petId,
          },
          404,
        );
      }

      if (!creatorPet) {
        return json(
          {
            error:
              "The battle creator's pet was not found.",
            pet_id:
              battle.creator_pet_id,
          },
          404,
        );
      }

      const typedJoiner =
        joinerPet as Pet;

      const typedCreator =
        creatorPet as Pet;

      if (typedJoiner.owner_id !== user.id) {
        return json(
          {
            error:
              "You do not own this pet.",
          },
          403,
        );
      }

      const joinerEligibility =
        eligible(typedJoiner);

      if (joinerEligibility) {
        return json(
          {
            error:
              joinerEligibility,
          },
          400,
        );
      }

      const creatorTier =
        TIER_INDEX[typedCreator.tier] ?? 0;

      const joinerTier =
        TIER_INDEX[typedJoiner.tier] ?? 0;

      if (creatorTier === 0) {
        return json(
          {
            error:
              `Invalid creator pet tier: ${typedCreator.tier}`,
          },
          500,
        );
      }

      if (joinerTier === 0) {
        return json(
          {
            error:
              `Invalid joining pet tier: ${typedJoiner.tier}`,
          },
          400,
        );
      }

      if (joinerTier > creatorTier) {
        return json(
          {
            error:
              `Your pet's tier is too high. It must be ${typedCreator.tier} or lower to join this battle.`,
          },
          400,
        );
      }

      const creatorFirst =
        passiveVal(
          typedCreator,
          "first_strike",
        ) > 0;

      const joinerFirst =
        passiveVal(
          typedJoiner,
          "first_strike",
        ) > 0;

      let firstPlayer: string;

      if (joinerFirst && !creatorFirst) {
        firstPlayer = user.id;
      } else {
        firstPlayer =
          battle.creator_id;
      }

      const {
        data: started,
        error: startError,
      } = await admin
        .from("battles")
        .update({
          joiner_id: user.id,
          joiner_pet_id:
            typedJoiner.id,
          creator_current_hp:
            typedCreator.max_health,
          joiner_current_hp:
            typedJoiner.max_health,
          current_turn_player_id:
            firstPlayer,
          round_number: 1,
          status: "active",
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", battleId)
        .eq("status", "waiting")
        .select()
        .maybeSingle();

      if (startError) {
        return json(
          {
            error:
              "Could not start battle.",
            details:
              startError.message,
            code:
              startError.code,
            hint:
              startError.hint,
          },
          500,
        );
      }

      if (!started) {
        return json(
          {
            error:
              "This battle was just joined by someone else.",
          },
          409,
        );
      }

      // Lock joiner's pet
      const {
        error: joinerLockError,
      } = await admin
        .from("pets")
        .update({
          in_battle: true,
        })
        .eq("id", typedJoiner.id);

      if (joinerLockError) {
        console.error(
          "JOINER PET LOCK ERROR",
          joinerLockError,
        );

        return json(
          {
            error:
              "Battle started, but the joining pet could not be locked.",
            details:
              joinerLockError.message,
          },
          500,
        );
      }

      // Initial combat log
      const {
        error: logError,
      } = await admin
        .from("battle_combat_logs")
        .insert({
          battle_id: battleId,
          round_number: 1,
          actor_player_id: null,
          message:
            `${typedCreator.name} faces off against ${typedJoiner.name}! ` +
            `${
              firstPlayer ===
              battle.creator_id
                ? typedCreator.name
                : typedJoiner.name
            } strikes first.`,
        });

      if (logError) {
        console.error(
          "INITIAL COMBAT LOG ERROR",
          logError,
        );
      }

      return json({
        ok: true,
      });
    }

    // ============================================================
    // ATTACK
    // ============================================================

    if (action === "attack") {
      const battleId =
        String(body?.battle_id ?? "").trim();

      if (!battleId) {
        return json(
          {
            error:
              "No battle_id was supplied.",
          },
          400,
        );
      }

      const {
        data: battle,
        error: battleError,
      } = await admin
        .from("battles")
        .select("*")
        .eq("id", battleId)
        .maybeSingle();

      if (battleError) {
        return json(
          {
            error:
              "Could not load battle.",
            details:
              battleError.message,
            code:
              battleError.code,
            hint:
              battleError.hint,
          },
          500,
        );
      }

      if (!battle) {
        return json(
          {
            error: "Battle not found.",
          },
          404,
        );
      }

      if (battle.status !== "active") {
        return json(
          {
            error:
              "This battle is not active.",
          },
          400,
        );
      }

      if (
        battle.creator_id !== user.id &&
        battle.joiner_id !== user.id
      ) {
        return json(
          {
            error:
              "You are not in this battle.",
          },
          403,
        );
      }

      if (
        battle.current_turn_player_id !==
        user.id
      ) {
        return json(
          {
            error:
              "It is not your turn.",
          },
          400,
        );
      }

      const {
        data: cPet,
        error: cPetError,
      } = await admin
        .from("pets")
        .select("*")
        .eq("id", battle.creator_pet_id)
        .maybeSingle();

      const {
        data: jPet,
        error: jPetError,
      } = await admin
        .from("pets")
        .select("*")
        .eq("id", battle.joiner_pet_id)
        .maybeSingle();

      if (cPetError || jPetError) {
        return json(
          {
            error:
              "Database error while loading battle pets.",
            creator_error:
              cPetError
                ? {
                    message:
                      cPetError.message,
                    code:
                      cPetError.code,
                    details:
                      cPetError.details,
                    hint:
                      cPetError.hint,
                  }
                : null,
            joiner_error:
              jPetError
                ? {
                    message:
                      jPetError.message,
                    code:
                      jPetError.code,
                    details:
                      jPetError.details,
                    hint:
                      jPetError.hint,
                  }
                : null,
          },
          500,
        );
      }

      if (!cPet || !jPet) {
        return json(
          {
            error:
              "Battle pets are missing.",
            creator_pet_id:
              battle.creator_pet_id,
            joiner_pet_id:
              battle.joiner_pet_id,
          },
          500,
        );
      }

      const creatorPet =
        cPet as Pet;

      const joinerPet =
        jPet as Pet;

      const attackerIsCreator =
        user.id === battle.creator_id;

      const attacker =
        attackerIsCreator
          ? creatorPet
          : joinerPet;

      const defender =
        attackerIsCreator
          ? joinerPet
          : creatorPet;

      let attackerHp = Number(
        attackerIsCreator
          ? battle.creator_current_hp
          : battle.joiner_current_hp,
      );

      let defenderHp = Number(
        attackerIsCreator
          ? battle.joiner_current_hp
          : battle.creator_current_hp,
      );

      const logs: string[] = [];

      // ==========================================================
      // PASSIVES
      // ==========================================================

      // REGEN
      const regen =
        passiveVal(
          attacker,
          "regen",
        );

      if (regen > 0) {
        const heal = Math.round(
          attacker.max_health *
            regen,
        );

        attackerHp = Math.min(
          attacker.max_health,
          attackerHp + heal,
        );

        logs.push(
          `${attacker.name} regenerates ${heal} HP.`,
        );
      }

      // CRITICAL
      const critChance =
        Math.min(
          0.95,
          Number(
            attacker.crit_chance ?? 0,
          ) +
            passiveVal(
              attacker,
              "crit_up",
            ),
        );

      // MULTI ATTACK
      const multiChance =
        Math.min(
          0.9,
          Number(
            attacker.multi_attack_chance ??
              0,
          ) +
            passiveVal(
              attacker,
              "multi_up",
            ),
        );

      // LIFE STEAL
      const lifesteal =
        passiveVal(
          attacker,
          "lifesteal",
        );

      // EXECUTE
      const execute =
        passiveVal(
          attacker,
          "execute",
        );

      // DAMAGE REDUCTION
      const reduction =
        Math.min(
          0.9,
          passiveVal(
            defender,
            "damage_reduction",
          ),
        );

      // THORNS
      const thorns =
        passiveVal(
          defender,
          "thorns",
        );

      const hits =
        1 +
        (Math.random() <
        multiChance
          ? 1
          : 0);

      // ==========================================================
      // DAMAGE
      // ==========================================================

      for (
        let h = 0;
        h < hits &&
        defenderHp > 0;
        h++
      ) {
        const variance =
          0.85 +
          Math.random() *
            0.3;

        let damage =
          (
            Number(
              attacker.attack,
            ) -
            Number(
              defender.defense,
            ) *
              0.4
          ) * variance;

        damage = Math.max(
          1,
          damage,
        );

        const isCrit =
          Math.random() <
          critChance;

        if (isCrit) {
          damage *= 1.75;
        }

        if (
          execute > 0 &&
          defenderHp <
            defender.max_health *
              0.3
        ) {
          damage *=
            1 + execute;
        }

        if (reduction > 0) {
          damage *=
            1 - reduction;
        }

        damage = Math.max(
          1,
          Math.round(damage),
        );

        defenderHp = Math.max(
          0,
          defenderHp - damage,
        );

        logs.push(
          `${attacker.name} hits ${defender.name} for ${damage}` +
            `${
              isCrit
                ? " (CRITICAL!)"
                : ""
            }` +
            `${
              hits > 1
                ? ` [hit ${h + 1}]`
                : ""
            }.`,
        );

        // LIFE STEAL
        if (lifesteal > 0) {
          const heal =
            Math.round(
              damage *
                lifesteal,
            );

          attackerHp =
            Math.min(
              attacker.max_health,
              attackerHp +
                heal,
            );

          if (heal > 0) {
            logs.push(
              `${attacker.name} drains ${heal} HP.`,
            );
          }
        }

        // THORNS
        if (
          thorns > 0 &&
          attackerHp > 0
        ) {
          const reflect =
            Math.max(
              1,
              Math.round(
                damage *
                  thorns,
              ),
            );

          attackerHp =
            Math.max(
              0,
              attackerHp -
                reflect,
            );

          logs.push(
            `${defender.name}'s barbs reflect ${reflect} damage.`,
          );
        }
      }

      // ==========================================================
      // NEW HP
      // ==========================================================

      const newCreatorHp =
        attackerIsCreator
          ? attackerHp
          : defenderHp;

      const newJoinerHp =
        attackerIsCreator
          ? defenderHp
          : attackerHp;

      // ==========================================================
      // DETERMINE WINNER
      // ==========================================================

      let winnerId:
        | string
        | null = null;

      let winnerPet:
        | Pet
        | null = null;

      let loserPet:
        | Pet
        | null = null;

      if (
        defenderHp <= 0 &&
        attackerHp <= 0
      ) {
        // Attacker wins ties.
        winnerId =
          attacker.owner_id;

        winnerPet =
          attacker;

        loserPet =
          defender;
      } else if (
        defenderHp <= 0
      ) {
        winnerId =
          attacker.owner_id;

        winnerPet =
          attacker;

        loserPet =
          defender;
      } else if (
        attackerHp <= 0
      ) {
        winnerId =
          defender.owner_id;

        winnerPet =
          defender;

        loserPet =
          attacker;
      }

      // ==========================================================
      // BATTLE FINISHED
      // ==========================================================

      if (
        winnerId &&
        winnerPet &&
        loserPet
      ) {
        const winnerName =
          winnerPet.name;

        // First update the battle itself.
        const {
          error: finishError,
        } = await admin
          .from("battles")
          .update({
            creator_current_hp:
              newCreatorHp,

            joiner_current_hp:
              newJoinerHp,

            status:
              "finished",

            winner_id:
              winnerId,

            winner_name:
              winnerName,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            battleId,
          );

        if (finishError) {
          return json(
            {
              error:
                "Could not finish battle.",
              details:
                finishError.message,
              code:
                finishError.code,
              hint:
                finishError.hint,
            },
            500,
          );
        }

        // --------------------------------------------------------
        // Save attack logs
        // --------------------------------------------------------

        for (const message of logs) {
          const {
            error: logError,
          } = await admin
            .from(
              "battle_combat_logs",
            )
            .insert({
              battle_id:
                battleId,

              round_number:
                battle.round_number,

              actor_player_id:
                user.id,

              message,
            });

          if (logError) {
            console.error(
              "COMBAT LOG ERROR",
              logError,
            );
          }
        }

        // --------------------------------------------------------
        // TRANSFER ACTUAL LOSING PET
        // --------------------------------------------------------

        const lockUntil =
          new Date(
            Date.now() +
              24 *
                60 *
                60 *
                1000,
          ).toISOString();

        /*
         * IMPORTANT:
         *
         * We are NOT creating a clone.
         *
         * The actual losing pet row is transferred
         * to the winner by changing owner_id.
         */
        const {
          error: transferError,
        } = await admin
          .from("pets")
          .update({
            owner_id:
              winnerId,

            in_battle:
              false,

            battle_locked_until:
              lockUntil,
          })
          .eq(
            "id",
            loserPet.id,
          );

        if (transferError) {
          console.error(
            "LOSER PET TRANSFER ERROR",
            transferError,
          );

          return json(
            {
              error:
                "Battle finished, but the losing pet could not be transferred.",
              details:
                transferError.message,
              code:
                transferError.code,
              hint:
                transferError.hint,
              pet_id:
                loserPet.id,
            },
            500,
          );
        }

        // --------------------------------------------------------
        // RELEASE WINNER'S PET
        // --------------------------------------------------------

        const {
          error:
            winnerReleaseError,
        } = await admin
          .from("pets")
          .update({
            in_battle:
              false,
          })
          .eq(
            "id",
            winnerPet.id,
          );

        if (winnerReleaseError) {
          console.error(
            "WINNER PET RELEASE ERROR",
            winnerReleaseError,
          );
        }

        // --------------------------------------------------------
        // FINAL LOG
        // --------------------------------------------------------

        const {
          error: finalLogError,
        } = await admin
          .from(
            "battle_combat_logs",
          )
          .insert({
            battle_id:
              battleId,

            round_number:
              battle.round_number,

            actor_player_id:
              null,

            message:
              `${winnerName} wins the battle! ` +
              `${loserPet.name} now belongs to the winner ` +
              `and is battle-locked for 24 hours.`,
          });

        if (finalLogError) {
          console.error(
            "FINAL COMBAT LOG ERROR",
            finalLogError,
          );
        }

        return json({
          ok: true,
          finished: true,
          winner_id:
            winnerId,
          winner_pet_id:
            winnerPet.id,
          transferred_pet_id:
            loserPet.id,
        });
      }

      // ==========================================================
      // NEXT TURN
      // ==========================================================

      const nextTurn =
        attackerIsCreator
          ? battle.joiner_id
          : battle.creator_id;

      if (!nextTurn) {
        return json(
          {
            error:
              "Could not determine next player.",
          },
          500,
        );
      }

      const nextRound =
        nextTurn ===
        battle.creator_id
          ? Number(
              battle.round_number,
            ) + 1
          : Number(
              battle.round_number,
            );

      const {
        error: turnError,
      } = await admin
        .from("battles")
        .update({
          creator_current_hp:
            newCreatorHp,

          joiner_current_hp:
            newJoinerHp,

          current_turn_player_id:
            nextTurn,

          round_number:
            nextRound,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          battleId,
        )
        .eq(
          "status",
          "active",
        );

      if (turnError) {
        return json(
          {
            error:
              "Could not update battle turn.",
            details:
              turnError.message,
            code:
              turnError.code,
            hint:
              turnError.hint,
          },
          500,
        );
      }

      // ----------------------------------------------------------
      // COMBAT LOGS
      // ----------------------------------------------------------

      for (const message of logs) {
        const {
          error: logError,
        } = await admin
          .from(
            "battle_combat_logs",
          )
          .insert({
            battle_id:
              battleId,

            round_number:
              battle.round_number,

            actor_player_id:
              user.id,

            message,
          });

        if (logError) {
          console.error(
            "COMBAT LOG ERROR",
            logError,
          );
        }
      }

      return json({
        ok: true,
        finished: false,
      });
    }

    // ============================================================
    // UNKNOWN ACTION
    // ============================================================

    return json(
      {
        error:
          `Unknown battle action: ${action}`,
      },
      400,
    );
  } catch (err) {
    console.error(
      "BATTLE FUNCTION CRASH",
      err,
    );

    return json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unknown server error.",
      },
      500,
    );
  }
});
