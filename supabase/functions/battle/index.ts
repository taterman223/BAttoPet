import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TIER_INDEX: Record<string, number> = {
  Worthless: 1,
  Average: 2,
  Decent: 3,
  Good: 4,
  Fabulous: 5,
  Excellent: 6,
};

type Pet = {
  id: string;
  owner_id: string;
  name: string;
  tier: string;
  attack: number;
  defense: number;
  max_health: number;
  crit_chance: number;
  multi_attack_chance: number;
  passive_effect: { type: string; value: number };
  tradeable: boolean;
  in_battle: boolean;
  battle_locked_until: string | null;
};

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
  return pet.passive_effect?.type === type
    ? Number(pet.passive_effect.value)
    : 0;
}

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

    if (!token) {
      return json({ error: "Missing authorization token." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({
        error: "Supabase environment variables are missing.",
        has_url: !!supabaseUrl,
        has_service_role_key: !!serviceRoleKey,
      }, 500);
    }

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    const { data: userData, error: authError } =
      await admin.auth.getUser(token);

    if (authError || !userData?.user) {
      return json({
        error: "You must be signed in.",
        auth_error: authError?.message ?? null,
      }, 401);
    }

    const user = userData.user;

    const body = await req.json();
    const action = String(body?.action ?? "");

    // ============================================================
    // CREATE
    // ============================================================

    if (action === "create") {
      const petId = String(body?.pet_id ?? "").trim();

      console.log("BATTLE CREATE DEBUG:", {
        petId,
        userId: user.id,
        supabaseUrl,
      });

      if (!petId) {
        return json({
          error: "No pet_id was supplied.",
          received_pet_id: petId,
          user_id: user.id,
        }, 400);
      }

      const {
        data: pet,
        error: petError,
      } = await admin
        .from("pets")
        .select("*")
        .eq("id", petId)
        .maybeSingle();

      console.log("PET QUERY RESULT:", {
        pet,
        petError,
      });

      if (petError) {
        return json({
          error: "Database error while finding pet.",
          details: petError.message,
          code: petError.code,
          received_pet_id: petId,
          user_id: user.id,
        }, 500);
      }

      if (!pet) {
        return json({
          error: "Pet not found.",
          received_pet_id: petId,
          user_id: user.id,
          database_url: supabaseUrl,
        }, 404);
      }

      if (pet.owner_id !== user.id) {
        return json({
          error: "You do not own this pet.",
          pet_owner_id: pet.owner_id,
          logged_in_user_id: user.id,
        }, 403);
      }

      const e = eligible(pet as Pet);

      if (e) {
        return json({ error: e }, 400);
      }

      const {
        data: battle,
        error: battleError,
      } = await admin
        .from("battles")
        .insert({
          creator_id: user.id,
          creator_pet_id: petId,
          creator_current_hp: pet.max_health,
          status: "waiting",
        })
        .select()
        .maybeSingle();

      if (battleError) {
        return json({
          error: "Could not create the battle.",
          details: battleError.message,
          code: battleError.code,
        }, 500);
      }

      if (!battle) {
        return json({
          error: "Could not create the battle.",
        }, 500);
      }

      const {
        error: petUpdateError,
      } = await admin
        .from("pets")
        .update({
          in_battle: true,
        })
        .eq("id", petId);

      if (petUpdateError) {
        console.error(
          "Could not mark pet as in battle:",
          petUpdateError,
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
      const battleId = String(body?.battle_id ?? "").trim();

      const {
        data: battle,
        error,
      } = await admin
        .from("battles")
        .select("*")
        .eq("id", battleId)
        .maybeSingle();

      if (error) {
        return json({
          error: "Could not find battle.",
          details: error.message,
        }, 500);
      }

      if (!battle) {
        return json({
          error: "Battle not found.",
        }, 404);
      }

      if (battle.creator_id !== user.id) {
        return json({
          error: "Only the creator can cancel.",
        }, 403);
      }

      if (battle.status !== "waiting") {
        return json({
          error: "This battle can no longer be cancelled.",
        }, 400);
      }

      await admin
        .from("battles")
        .update({
          status: "cancelled",
        })
        .eq("id", battleId)
        .eq("status", "waiting");

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
      const battleId = String(body?.battle_id ?? "").trim();
      const petId = String(body?.pet_id ?? "").trim();

      const {
        data: battle,
        error: battleError,
      } = await admin
        .from("battles")
        .select("*")
        .eq("id", battleId)
        .maybeSingle();

      if (battleError) {
        return json({
          error: "Could not find battle.",
          details: battleError.message,
        }, 500);
      }

      if (!battle) {
        return json({
          error: "Battle not found.",
        }, 404);
      }

      if (battle.status !== "waiting") {
        return json({
          error: "This battle is no longer open.",
        }, 409);
      }

      if (battle.creator_id === user.id) {
        return json({
          error: "You cannot join your own battle.",
        }, 400);
      }

      const {
        data: joinerPet,
        error: joinerPetError,
      } = await admin
        .from("pets")
        .select("*")
        .eq("id", petId)
        .maybeSingle();

      const {
        data: creatorPet,
        error: creatorPetError,
      } = await admin
        .from("pets")
        .select("*")
        .eq("id", battle.creator_pet_id)
        .maybeSingle();

      if (joinerPetError || creatorPetError) {
        return json({
          error: "Database error while finding battle pets.",
          joiner_error: joinerPetError?.message ?? null,
          creator_error: creatorPetError?.message ?? null,
        }, 500);
      }

      if (!joinerPet || !creatorPet) {
        return json({
          error: "Pet not found.",
          joiner_pet_id: petId,
          creator_pet_id: battle.creator_pet_id,
        }, 404);
      }

      if (joinerPet.owner_id !== user.id) {
        return json({
          error: "You do not own this pet.",
        }, 403);
      }

      const e = eligible(joinerPet as Pet);

      if (e) {
        return json({
          error: e,
        }, 400);
      }

      if (
        TIER_INDEX[joinerPet.tier] >
        TIER_INDEX[creatorPet.tier]
      ) {
        return json({
          error:
            `Your pet's tier is too high. It must be ${creatorPet.tier} or lower to join this battle.`,
        }, 400);
      }

      const cFirst =
        passiveVal(creatorPet as Pet, "first_strike") > 0 ||
        (creatorPet as Pet).passive_effect?.type === "first_strike";

      const jFirst =
        (joinerPet as Pet).passive_effect?.type === "first_strike";

      let firstPlayer: string;

      if (jFirst && !cFirst) {
        firstPlayer = user.id;
      } else {
        firstPlayer = battle.creator_id;
      }

      const {
        data: started,
        error: startError,
      } = await admin
        .from("battles")
        .update({
          joiner_id: user.id,
          joiner_pet_id: petId,
          creator_current_hp: creatorPet.max_health,
          joiner_current_hp: joinerPet.max_health,
          current_turn_player_id: firstPlayer,
          round_number: 1,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", battleId)
        .eq("status", "waiting")
        .select()
        .maybeSingle();

      if (startError) {
        return json({
          error: "Could not start battle.",
          details: startError.message,
        }, 500);
      }

      if (!started) {
        return json({
          error: "This battle was just joined by someone else.",
        }, 409);
      }

      await admin
        .from("pets")
        .update({
          in_battle: true,
        })
        .eq("id", petId);

      await admin
        .from("battle_combat_logs")
        .insert({
          battle_id: battleId,
          round_number: 1,
          actor_player_id: null,
          message:
            `${creatorPet.name} faces off against ${joinerPet.name}! ` +
            `${firstPlayer === battle.creator_id ? creatorPet.name : joinerPet.name} strikes first.`,
        });

      return json({
        ok: true,
      });
    }

    // ============================================================
    // ATTACK
    // ============================================================

    if (action === "attack") {
      const battleId = String(body?.battle_id ?? "").trim();

      const {
        data: battle,
        error: battleError,
      } = await admin
        .from("battles")
        .select("*")
        .eq("id", battleId)
        .maybeSingle();

      if (battleError) {
        return json({
          error: "Could not load battle.",
          details: battleError.message,
        }, 500);
      }

      if (!battle) {
        return json({
          error: "Battle not found.",
        }, 404);
      }

      if (battle.status !== "active") {
        return json({
          error: "This battle is not active.",
        }, 400);
      }

      if (
        battle.creator_id !== user.id &&
        battle.joiner_id !== user.id
      ) {
        return json({
          error: "You are not in this battle.",
        }, 403);
      }

      if (battle.current_turn_player_id !== user.id) {
        return json({
          error: "It is not your turn.",
        }, 400);
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
        return json({
          error: "Could not load battle pets.",
          creator_error: cPetError?.message ?? null,
          joiner_error: jPetError?.message ?? null,
        }, 500);
      }

      if (!cPet || !jPet) {
        return json({
          error: "Battle pets missing.",
          creator_pet_id: battle.creator_pet_id,
          joiner_pet_id: battle.joiner_pet_id,
        }, 500);
      }

      const attackerIsCreator = user.id === battle.creator_id;

      const attacker = (
        attackerIsCreator ? cPet : jPet
      ) as Pet;

      const defender = (
        attackerIsCreator ? jPet : cPet
      ) as Pet;

      let attackerHp = attackerIsCreator
        ? battle.creator_current_hp
        : battle.joiner_current_hp;

      let defenderHp = attackerIsCreator
        ? battle.joiner_current_hp
        : battle.creator_current_hp;

      const logs: string[] = [];

      // Regen
      const regen = passiveVal(attacker, "regen");

      if (regen > 0) {
        const heal = Math.round(
          attacker.max_health * regen,
        );

        attackerHp = Math.min(
          attacker.max_health,
          attackerHp + heal,
        );

        logs.push(
          `${attacker.name} regenerates ${heal} HP.`,
        );
      }

      const critChance = Math.min(
        0.95,
        attacker.crit_chance +
          passiveVal(attacker, "crit_up"),
      );

      const multiChance = Math.min(
        0.9,
        attacker.multi_attack_chance +
          passiveVal(attacker, "multi_up"),
      );

      const lifesteal = passiveVal(
        attacker,
        "lifesteal",
      );

      const execute = passiveVal(
        attacker,
        "execute",
      );

      const reduction = passiveVal(
        defender,
        "damage_reduction",
      );

      const thorns = passiveVal(
        defender,
        "thorns",
      );

      const hits =
        1 +
        (Math.random() < multiChance ? 1 : 0);

      for (
        let h = 0;
        h < hits && defenderHp > 0;
        h++
      ) {
        const variance =
          0.85 + Math.random() * 0.3;

        let dmg = Math.max(
          1,
          (attacker.attack -
            defender.defense * 0.4) *
            variance,
        );

        const isCrit =
          Math.random() < critChance;

        if (isCrit) {
          dmg *= 1.75;
        }

        if (
          execute > 0 &&
          defenderHp <
            defender.max_health * 0.3
        ) {
          dmg *= 1 + execute;
        }

        if (reduction > 0) {
          dmg *= 1 - reduction;
        }

        dmg = Math.max(
          1,
          Math.round(dmg),
        );

        defenderHp = Math.max(
          0,
          defenderHp - dmg,
        );

        logs.push(
          `${attacker.name} hits ${defender.name} for ${dmg}` +
          `${isCrit ? " (CRITICAL!)" : ""}` +
          `${hits > 1 ? ` [hit ${h + 1}]` : ""}.`,
        );

        if (lifesteal > 0) {
          const heal = Math.round(
            dmg * lifesteal,
          );

          attackerHp = Math.min(
            attacker.max_health,
            attackerHp + heal,
          );

          if (heal > 0) {
            logs.push(
              `${attacker.name} drains ${heal} HP.`,
            );
          }
        }

        if (thorns > 0 && attackerHp > 0) {
          const reflect = Math.max(
            1,
            Math.round(dmg * thorns),
          );

          attackerHp = Math.max(
            0,
            attackerHp - reflect,
          );

          logs.push(
            `${defender.name}'s barbs reflect ${reflect} damage.`,
          );
        }
      }

      const newCreatorHp =
        attackerIsCreator
          ? attackerHp
          : defenderHp;

      const newJoinerHp =
        attackerIsCreator
          ? defenderHp
          : attackerHp;

      let winnerId: string | null = null;
      let loserPet: Pet | null = null;
      let winnerPet: Pet | null = null;

      if (
        defenderHp <= 0 &&
        attackerHp <= 0
      ) {
        winnerId = attacker.owner_id;
        winnerPet = attacker;
        loserPet = defender;
      } else if (defenderHp <= 0) {
        winnerId = attacker.owner_id;
        winnerPet = attacker;
        loserPet = defender;
      } else if (attackerHp <= 0) {
        winnerId = defender.owner_id;
        winnerPet = defender;
        loserPet = attacker;
      }

      // ========================================================
      // FINISH
      // ========================================================

      if (
        winnerId &&
        winnerPet &&
        loserPet
      ) {
        const winnerName = winnerPet.name;

        const {
          error: finishError,
        } = await admin
          .from("battles")
          .update({
            creator_current_hp: newCreatorHp,
            joiner_current_hp: newJoinerHp,
            status: "finished",
            winner_id: winnerId,
            winner_name: winnerName,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", battleId);

        if (finishError) {
          return json({
            error: "Could not finish battle.",
            details: finishError.message,
          }, 500);
        }

        for (const m of logs) {
          await admin
            .from("battle_combat_logs")
            .insert({
              battle_id: battleId,
              round_number: battle.round_number,
              actor_player_id: user.id,
              message: m,
            });
        }

        await admin
          .from("battle_combat_logs")
          .insert({
            battle_id: battleId,
            round_number: battle.round_number,
            actor_player_id: null,
            message:
              `${winnerName} wins the battle! ` +
              `${loserPet.name} is battle-locked for 24 hours.`,
          });

        // Winner receives a non-tradeable clone
        const {
          error: cloneError,
        } = await admin
          .from("pets")
          .insert({
            owner_id: winnerId,
            name: `${loserPet.name} (Clone)`,
            species:
              (loserPet as unknown as {
                species: string;
              }).species ??
              "Cloned Beast",

            tier: loserPet.tier,

            appearance:
              (loserPet as unknown as {
                appearance: string;
              }).appearance ??
              "A battle-forged clone",

            personality:
              (loserPet as unknown as {
                personality: string;
              }).personality ??
              "forged in defeat",

            description:
              `A non-tradeable clone of ${loserPet.name}, won in battle.`,

            passive_name:
              (loserPet as unknown as {
                passive_name: string;
              }).passive_name,

            passive_description:
              (loserPet as unknown as {
                passive_description: string;
              }).passive_description,

            passive_effect:
              loserPet.passive_effect,

            attack: loserPet.attack,
            defense: loserPet.defense,
            speed: 0,
            max_health: loserPet.max_health,
            crit_chance: loserPet.crit_chance,
            multi_attack_chance:
              loserPet.multi_attack_chance,

            tradeable: false,
            is_clone: true,
            in_battle: false,
          });

        if (cloneError) {
          console.error(
            "Clone creation failed:",
            cloneError,
          );
        }

        const lockUntil =
          new Date(
            Date.now() +
              24 * 60 * 60 * 1000,
          ).toISOString();

        await admin
          .from("pets")
          .update({
            in_battle: false,
            battle_locked_until: lockUntil,
          })
          .eq("id", loserPet.id);

        await admin
          .from("pets")
          .update({
            in_battle: false,
          })
          .eq("id", winnerPet.id);

        return json({
          ok: true,
          finished: true,
        });
      }

      // ========================================================
      // NEXT TURN
      // ========================================================

      const nextTurn = attackerIsCreator
        ? battle.joiner_id
        : battle.creator_id;

      const nextRound =
        nextTurn === battle.creator_id
          ? battle.round_number + 1
          : battle.round_number;

      const {
        error: turnError,
      } = await admin
        .from("battles")
        .update({
          creator_current_hp: newCreatorHp,
          joiner_current_hp: newJoinerHp,
          current_turn_player_id: nextTurn,
          round_number: nextRound,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", battleId);

      if (turnError) {
        return json({
          error: "Could not update battle turn.",
          details: turnError.message,
        }, 500);
      }

      for (const m of logs) {
        await admin
          .from("battle_combat_logs")
          .insert({
            battle_id: battleId,
            round_number: battle.round_number,
            actor_player_id: user.id,
            message: m,
          });
      }

      return json({
        ok: true,
        finished: false,
      });
    }

    return json({
      error: "Unknown action.",
    }, 400);

  } catch (err) {
    console.error("Battle function error:", err);

    return json({
      error: (err as Error)?.message ?? "Unknown error",
    }, 500);
  }
});

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
