import { useEffect, useState, useRef } from "react";
import {
  supabase,
  type Battle,
  type Pet,
  type CombatLog,
  TIER_ORDER,
  type Tier,
} from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  PetAvatar,
  TierBadge,
  EmptyState,
  Spinner,
  HpBar,
  Modal,
} from "@/lib/ui";
import {
  Swords,
  Plus,
  LogIn,
  X,
  Zap,
  Trophy,
  RefreshCw,
  Clock,
} from "lucide-react";

export default function BattleArena() {
  const { user, session } = useAuth();

  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [myPets, setMyPets] = useState<Pet[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [joinBattle, setJoinBattle] = useState<Battle | null>(null);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeBattle, setActiveBattle] = useState<Battle | null>(null);
  const [activeLogs, setActiveLogs] = useState<CombatLog[]>([]);

  const logEndRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // LOAD BATTLES
  // ============================================================

  async function loadBattles() {
    setLoading(true);

    try {
      /*
       * IMPORTANT:
       * Do NOT use the giant nested relationship query here.
       *
       * We first load the battles themselves.
       * That means a problem with pets/players RLS cannot make
       * the entire battle disappear from the UI.
       */

      const { data: battleData, error: battleError } = await supabase
        .from("battles")
        .select("*")
        .in("status", ["waiting", "active"])
        .order("created_at", { ascending: false });

      if (battleError) {
        console.error("BATTLE LOAD ERROR:", battleError);
        setError(`Could not load battles: ${battleError.message}`);
        setBattles([]);
        setLoading(false);
        return;
      }

      const rawBattles = battleData ?? [];

      console.log("BATTLES FOUND:", rawBattles);

      if (rawBattles.length === 0) {
        setBattles([]);
        setLoading(false);
        return;
      }

      // ------------------------------------------------------------
      // Load creator/joiner pets separately
      // ------------------------------------------------------------

      const petIds = Array.from(
        new Set(
          rawBattles.flatMap((b: any) =>
            [b.creator_pet_id, b.joiner_pet_id].filter(Boolean),
          ),
        ),
      );

      let pets: any[] = [];

      if (petIds.length > 0) {
        const { data: petData, error: petError } = await supabase
          .from("pets")
          .select("*")
          .in("id", petIds);

        if (petError) {
          console.error("PET LOAD ERROR:", petError);

          // Don't hide battles just because pet lookup failed.
          pets = [];
        } else {
          pets = petData ?? [];
        }
      }

      // ------------------------------------------------------------
      // Load player usernames separately
      // ------------------------------------------------------------

      const playerIds = Array.from(
        new Set(
          rawBattles.flatMap((b: any) =>
            [b.creator_id, b.joiner_id].filter(Boolean),
          ),
        ),
      );

      let players: any[] = [];

      if (playerIds.length > 0) {
        const { data: playerData, error: playerError } = await supabase
          .from("players")
          .select("id, username")
          .in("id", playerIds);

        if (playerError) {
          console.error("PLAYER LOAD ERROR:", playerError);
          players = [];
        } else {
          players = playerData ?? [];
        }
      }

      // ------------------------------------------------------------
      // Attach pets and players to each battle
      // ------------------------------------------------------------

      const finalBattles = rawBattles.map((battle: any) => {
        const creatorPet =
          pets.find((p) => p.id === battle.creator_pet_id) ?? null;

        const joinerPet =
          pets.find((p) => p.id === battle.joiner_pet_id) ?? null;

        const creator =
          players.find((p) => p.id === battle.creator_id) ?? null;

        const joiner =
          players.find((p) => p.id === battle.joiner_id) ?? null;

        return {
          ...battle,
          creator_pet: creatorPet,
          joiner_pet: joinerPet,
          creator,
          joiner,
        };
      });

      console.log("FINAL BATTLES:", finalBattles);

      setBattles(finalBattles as unknown as Battle[]);
    } catch (err) {
      console.error("UNEXPECTED BATTLE ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error loading battles.",
      );
    }

    setLoading(false);
  }

  // ============================================================
  // LOAD MY PETS
  // ============================================================

  async function loadMyPets() {
    if (!user) {
      setMyPets([]);
      return;
    }

    const { data, error } = await supabase
      .from("pets")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("MY PETS ERROR:", error);
      return;
    }

    setMyPets((data ?? []) as Pet[]);
  }

  // ============================================================
  // INITIAL LOAD + REALTIME
  // ============================================================

  useEffect(() => {
    loadBattles();
    loadMyPets();

    const channel = supabase
      .channel("battle-arena-live")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "battles",
        },
        () => {
          console.log("Battle table changed — reloading");
          loadBattles();
        },
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pets",
        },
        () => {
          loadMyPets();
          loadBattles();
        },
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // ============================================================
  // ACTIVE BATTLE
  // ============================================================

  useEffect(() => {
    if (!activeBattle) return;

    const battleId = activeBattle.id;

    async function loadActiveBattle() {
      const { data: battleData, error: battleError } = await supabase
        .from("battles")
        .select("*")
        .eq("id", battleId)
        .maybeSingle();

      if (battleError) {
        console.error("ACTIVE BATTLE ERROR:", battleError);
        return;
      }

      if (battleData) {
        // Load pets separately
        const petIds = [
          battleData.creator_pet_id,
          battleData.joiner_pet_id,
        ].filter(Boolean);

        let pets: any[] = [];

        if (petIds.length > 0) {
          const { data: petData } = await supabase
            .from("pets")
            .select("*")
            .in("id", petIds);

          pets = petData ?? [];
        }

        const creatorPet =
          pets.find((p) => p.id === battleData.creator_pet_id) ?? null;

        const joinerPet =
          pets.find((p) => p.id === battleData.joiner_pet_id) ?? null;

        setActiveBattle({
          ...(battleData as any),
          creator_pet: creatorPet,
          joiner_pet: joinerPet,
        } as Battle);
      }

      const { data: logData, error: logError } = await supabase
        .from("battle_combat_logs")
        .select("*")
        .eq("battle_id", battleId)
        .order("created_at", { ascending: true });

      if (logError) {
        console.error("COMBAT LOG ERROR:", logError);
        return;
      }

      setActiveLogs((logData ?? []) as CombatLog[]);
    }

    loadActiveBattle();

    const channel = supabase
      .channel(`active-battle-${battleId}`)

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "battles",
          filter: `id=eq.${battleId}`,
        },
        () => {
          loadActiveBattle();
        },
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "battle_combat_logs",
          filter: `battle_id=eq.${battleId}`,
        },
        () => {
          loadActiveBattle();
        },
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBattle?.id]);

  // Scroll combat log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [activeLogs]);

  // ============================================================
  // ELIGIBLE PETS
  // ============================================================

  const eligiblePets = myPets.filter(
    (pet) =>
      !pet.in_battle &&
      !(
        pet.battle_locked_until &&
        new Date(pet.battle_locked_until) > new Date()
      ),
  );

  // ============================================================
  // CALL EDGE FUNCTION
  // ============================================================

  async function callBattle(
    action: string,
    extra: Record<string, unknown> = {},
  ) {
    if (!session) {
      setError("You are not logged in.");
      return null;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/battle`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action,
            ...extra,
          }),
        },
      );

      const data = await response.json();

      console.log("BATTLE FUNCTION:", action, data);

      if (!response.ok) {
        setError(
          data?.error ??
            data?.message ??
            "Battle request failed.",
        );

        return null;
      }

      return data;
    } catch (err) {
      console.error("BATTLE FUNCTION ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Battle request failed.",
      );

      return null;
    }
  }

  // ============================================================
  // CREATE
  // ============================================================

  async function handleCreate() {
    if (!selectedPet) {
      setError("Select a pet first.");
      return;
    }

    setBusy(true);
    setError(null);

    const data = await callBattle("create", {
      pet_id: selectedPet.id,
    });

    setBusy(false);

    if (data?.battle_id) {
      setCreateOpen(false);
      setSelectedPet(null);

      // Immediately reload instead of waiting for realtime
      await loadBattles();
    }
  }

  // ============================================================
  // JOIN
  // ============================================================

  async function handleJoin() {
    if (!joinBattle) {
      setError("No battle selected.");
      return;
    }

    if (!selectedPet) {
      setError("Select a pet first.");
      return;
    }

    setBusy(true);
    setError(null);

    const data = await callBattle("join", {
      battle_id: joinBattle.id,
      pet_id: selectedPet.id,
    });

    setBusy(false);

    if (data?.ok) {
      setJoinBattle(null);
      setSelectedPet(null);

      await loadBattles();

      // If the join operation made the battle active,
      // automatically open it.
      const { data: updatedBattle } = await supabase
        .from("battles")
        .select("*")
        .eq("id", joinBattle.id)
        .maybeSingle();

      if (updatedBattle?.status === "active") {
        setActiveBattle(updatedBattle as Battle);
      }
    }
  }

  // ============================================================
  // CANCEL
  // ============================================================

  async function handleCancel(battleId: string) {
    setBusy(true);
    setError(null);

    await callBattle("cancel", {
      battle_id: battleId,
    });

    setBusy(false);

    await loadBattles();
  }

  // ============================================================
  // ATTACK
  // ============================================================

  async function handleAttack() {
    if (!activeBattle) return;

    setBusy(true);
    setError(null);

    await callBattle("attack", {
      battle_id: activeBattle.id,
    });

    setBusy(false);
  }

  // ============================================================
  // ACTIVE BATTLE SCREEN
  // ============================================================

  if (activeBattle) {
    return (
      <ActiveBattleView
        battle={activeBattle}
        logs={activeLogs}
        userId={user!.id}
        onAttack={handleAttack}
        onLeave={() => {
          setActiveBattle(null);
          loadBattles();
        }}
        busy={busy}
        error={error}
        logEndRef={logEndRef}
      />
    );
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  // ============================================================
  // BATTLE FILTERS
  // ============================================================

  const waitingBattles = battles.filter(
    (battle) =>
      battle.status === "waiting" &&
      battle.creator_id !== user?.id,
  );

  const myActiveBattles = battles.filter(
    (battle) =>
      (battle.creator_id === user?.id ||
        battle.joiner_id === user?.id) &&
      battle.status === "active",
  );

  const myWaitingBattles = battles.filter(
    (battle) =>
      battle.creator_id === user?.id &&
      battle.status === "waiting",
  );

  // ============================================================
  // MAIN ARENA
  // ============================================================

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Battle Arena
          </h1>

          <p className="text-slate-500 text-sm mt-0.5">
            Real-time turn-based multiplayer battles
          </p>
        </div>

        <div className="flex gap-2">

          <button
            onClick={() => {
              setError(null);
              loadBattles();
            }}
            className="p-2 rounded-lg bg-white border border-slate-300 text-slate-400 hover:text-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setCreateOpen(true);
              setError(null);
              setSelectedPet(null);
            }}
            disabled={eligiblePets.length === 0}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Create Battle
          </button>

        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* ========================================================
          YOUR ACTIVE BATTLES
      ======================================================== */}

      {myActiveBattles.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">
            Your Active Battles
          </h2>

          <div className="space-y-3">
            {myActiveBattles.map((battle) => (
              <BattleRow
                key={battle.id}
                battle={battle}
                highlight
                onClick={() => setActiveBattle(battle)}
                actionLabel="Enter Battle"
                actionIcon={
                  <LogIn className="w-4 h-4" />
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          YOUR WAITING BATTLES
      ======================================================== */}

      {myWaitingBattles.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">
            Waiting for Opponent
          </h2>

          <div className="space-y-3">
            {myWaitingBattles.map((battle) => (
              <BattleRow
                key={battle.id}
                battle={battle}
                onClick={() => handleCancel(battle.id)}
                actionLabel="Cancel"
                actionIcon={
                  <X className="w-4 h-4" />
                }
                cancel
              />
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          OPEN BATTLES
      ======================================================== */}

      <div>
        <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">
          Open Battles
        </h2>

        {waitingBattles.length === 0 ? (
          <EmptyState
            icon={<Swords className="w-12 h-12" />}
            title="No open battles"
            subtitle="Create a battle and wait for another player to join."
          />
        ) : (
          <div className="space-y-3">
            {waitingBattles.map((battle) => (
              <BattleRow
                key={battle.id}
                battle={battle}
                onClick={() => {
                  setJoinBattle(battle);
                  setError(null);
                  setSelectedPet(null);
                }}
                actionLabel="Join Battle"
                actionIcon={
                  <LogIn className="w-4 h-4" />
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* CREATE MODAL */}

      <PetSelectModal
        open={createOpen}
        onClose={() => {
          if (!busy) {
            setCreateOpen(false);
            setSelectedPet(null);
          }
        }}
        pets={eligiblePets}
        selectedPet={selectedPet}
        onSelect={setSelectedPet}
        onConfirm={handleCreate}
        busy={busy}
        title="Create Battle"
        confirmLabel="Create Battle"
        tierLimit={null}
      />

      {/* JOIN MODAL */}

      <PetSelectModal
        open={!!joinBattle}
        onClose={() => {
          if (!busy) {
            setJoinBattle(null);
            setSelectedPet(null);
          }
        }}
        pets={eligiblePets.filter((pet) => {
          if (!joinBattle?.creator_pet?.tier) {
            return true;
          }

          return (
            TIER_ORDER.indexOf(
              pet.tier as Tier,
            ) <=
            TIER_ORDER.indexOf(
              joinBattle.creator_pet.tier as Tier,
            )
          );
        })}
        selectedPet={selectedPet}
        onSelect={setSelectedPet}
        onConfirm={handleJoin}
        busy={busy}
        title={
          joinBattle?.creator_pet?.tier
            ? `Join Battle (max tier: ${joinBattle.creator_pet.tier})`
            : "Join Battle"
        }
        confirmLabel="Join Battle"
        tierLimit={
          joinBattle?.creator_pet?.tier ?? null
        }
      />
    </div>
  );
}

// ================================================================
// BATTLE ROW
// ================================================================

function BattleRow({
  battle,
  onClick,
  actionLabel,
  actionIcon,
  highlight,
  cancel,
}: {
  battle: Battle;
  onClick: () => void;
  actionLabel: string;
  actionIcon: React.ReactNode;
  highlight?: boolean;
  cancel?: boolean;
}) {
  const pet = battle.creator_pet;

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-2xl border transition ${
        highlight
          ? "border-rose-300 bg-rose-50"
          : "border-slate-200 bg-white"
      } hover:border-slate-400`}
    >

      {/* PET */}
      {pet ? (
        <PetAvatar
          tier={pet.tier}
          species={pet.species}
          spriteSeed={pet.sprite_seed}
          size={48}
        />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
          <Swords className="w-5 h-5 text-slate-400" />
        </div>
      )}

      {/* INFO */}
      <div className="flex-1 min-w-0">

        <p className="text-sm font-bold text-slate-800">
          {battle.creator?.username
            ? `${battle.creator.username}'s `
            : "Player's "}
          {pet?.name ?? "Battle Pet"}
        </p>

        <div className="flex items-center gap-2 mt-0.5">

          {pet ? (
            <TierBadge
              tier={pet.tier}
              size="sm"
            />
          ) : (
            <span className="text-xs text-slate-400">
              Pet lookup unavailable
            </span>
          )}

          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />

            {new Date(
              battle.created_at,
            ).toLocaleTimeString()}
          </span>

        </div>

        {/* Useful debug info if pet isn't available */}
        {!pet && (
          <p className="text-[10px] text-slate-400 mt-1">
            Battle ID: {battle.id}
          </p>
        )}

      </div>

      {/* BUTTON */}
      <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-semibold rounded-lg transition flex items-center gap-1.5 ${
          cancel
            ? "bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-300"
            : "bg-rose-600 hover:bg-rose-500 text-white"
        }`}
      >
        {actionIcon}
        {actionLabel}
      </button>

    </div>
  );
}

// ================================================================
// ACTIVE BATTLE
// ================================================================

function ActiveBattleView({
  battle,
  logs,
  userId,
  onAttack,
  onLeave,
  busy,
  error,
  logEndRef,
}: {
  battle: Battle;
  logs: CombatLog[];
  userId: string;
  onAttack: () => void;
  onLeave: () => void;
  busy: boolean;
  error: string | null;
  logEndRef: React.RefObject<HTMLDivElement>;
}) {
  const creatorPet = battle.creator_pet;
  const joinerPet = battle.joiner_pet;

  const isCreator =
    battle.creator_id === userId;

  const myPet =
    isCreator ? creatorPet : joinerPet;

  const opponentPet =
    isCreator ? joinerPet : creatorPet;

  const myHp =
    isCreator
      ? battle.creator_current_hp
      : battle.joiner_current_hp;

  const opponentHp =
    isCreator
      ? battle.joiner_current_hp
      : battle.creator_current_hp;

  const myTurn =
    battle.current_turn_player_id === userId;

  const finished =
    battle.status === "finished";

  return (
    <div className="space-y-5">

      {/* HEADER */}

      <div className="flex items-center justify-between">

        <button
          onClick={onLeave}
          className="text-slate-400 hover:text-slate-700 text-sm flex items-center gap-1"
        >
          <X className="w-4 h-4" />
          Leave Battle
        </button>

        {finished && (
          <div className="flex items-center gap-2 text-amber-600 font-bold">
            <Trophy className="w-5 h-5" />
            {battle.winner_name} wins!
          </div>
        )}

      </div>

      {/* ERROR */}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* PETS */}

      <div className="grid grid-cols-2 gap-4">

        {/* OPPONENT */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4">

          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
            Opponent
          </p>

          {opponentPet ? (
            <>
              <div className="flex items-center gap-3 mb-3">

                <PetAvatar
                  tier={opponentPet.tier}
                  species={opponentPet.species}
                  spriteSeed={opponentPet.sprite_seed}
                  size={56}
                />

                <div>

                  <p className="font-bold text-slate-800">
                    {opponentPet.name}
                  </p>

                  <TierBadge
                    tier={opponentPet.tier}
                    size="sm"
                  />

                </div>

              </div>

              <HpBar
                current={opponentHp ?? 0}
                max={opponentPet.max_health}
              />
            </>
          ) : (
            <p className="text-slate-400 text-sm">
              Waiting for opponent...
            </p>
          )}

        </div>

        {/* YOU */}

        <div className="rounded-2xl border border-sky-300 bg-sky-50 p-4">

          <p className="text-xs text-sky-500 uppercase tracking-wider mb-2">
            You
          </p>

          {myPet ? (
            <>
              <div className="flex items-center gap-3 mb-3">

                <PetAvatar
                  tier={myPet.tier}
                  species={myPet.species}
                  spriteSeed={myPet.sprite_seed}
                  size={56}
                />

                <div>

                  <p className="font-bold text-slate-800">
                    {myPet.name}
                  </p>

                  <TierBadge
                    tier={myPet.tier}
                    size="sm"
                  />

                </div>

              </div>

              <HpBar
                current={myHp ?? 0}
                max={myPet.max_health}
              />
            </>
          ) : (
            <p className="text-slate-400 text-sm">
              Your pet could not be loaded.
            </p>
          )}

        </div>

      </div>

      {/* COMBAT LOG */}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">

        <div className="flex items-center justify-between mb-3">

          <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
            Combat Log
          </h3>

          <span className="text-xs text-slate-400">
            Round {battle.round_number}
          </span>

        </div>

        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-2">

          {logs.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">
              Battle has not started yet.
            </p>
          ) : (
            logs.map((log) => (
              <p
                key={log.id}
                className={`text-sm px-3 py-1.5 rounded-lg ${
                  log.actor_player_id === userId
                    ? "bg-sky-50 text-sky-700"
                    : log.actor_player_id === null
                      ? "bg-amber-50 text-amber-700 font-medium"
                      : "bg-slate-50 text-slate-600"
                }`}
              >
                {log.message}
              </p>
            ))
          )}

          <div ref={logEndRef} />

        </div>

      </div>

      {/* ATTACK */}

      {!finished && (
        <button
          onClick={onAttack}
          disabled={busy || !myTurn}
          className="w-full py-3 bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >

          {busy ? (
            <Spinner size={18} />
          ) : (
            <Zap className="w-5 h-5" />
          )}

          {myTurn
            ? "Attack!"
            : "Waiting for opponent..."}

        </button>
      )}

      {/* FINISHED */}

      {finished && (
        <div className="text-center">

          <button
            onClick={onLeave}
            className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition"
          >
            Back to Arena
          </button>

        </div>
      )}

    </div>
  );
}

// ================================================================
// PET SELECT MODAL
// ================================================================

function PetSelectModal({
  open,
  onClose,
  pets,
  selectedPet,
  onSelect,
  onConfirm,
  busy,
  title,
  confirmLabel,
  tierLimit,
}: {
  open: boolean;
  onClose: () => void;
  pets: Pet[];
  selectedPet: Pet | null;
  onSelect: (pet: Pet) => void;
  onConfirm: () => void;
  busy: boolean;
  title: string;
  confirmLabel: string;
  tierLimit: Tier | null;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
    >

      {pets.length === 0 ? (

        <p className="text-slate-500 text-sm text-center py-6">
          {tierLimit
            ? `You have no eligible pets at or below ${tierLimit} tier.`
            : "You have no eligible pets for battle."}
        </p>

      ) : (

        <div className="space-y-4">

          {tierLimit && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 border border-slate-200">
              This battle is limited to pets of{" "}
              <span className="text-slate-800 font-semibold">
                {tierLimit}
              </span>{" "}
              tier or lower.
            </p>
          )}

          <div className="max-h-64 overflow-y-auto space-y-2">

            {pets.map((pet) => (

              <button
                key={pet.id}
                onClick={() => onSelect(pet)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg border transition text-left ${
                  selectedPet?.id === pet.id
                    ? "border-rose-400 bg-rose-50"
                    : "border-slate-200 bg-slate-50 hover:border-slate-400"
                }`}
              >

                <PetAvatar
                  tier={pet.tier}
                  species={pet.species}
                  spriteSeed={pet.sprite_seed}
                  size={44}
                />

                <div className="flex-1 min-w-0">

                  <p className="text-sm font-bold text-slate-800 truncate">
                    {pet.name}
                  </p>

                  <p className="text-xs text-slate-400">
                    HP {pet.max_health} · ATK {pet.attack} · DEF{" "}
                    {pet.defense}
                  </p>

                </div>

                <TierBadge
                  tier={pet.tier}
                  size="sm"
                />

              </button>

            ))}

          </div>

          <button
            onClick={onConfirm}
            disabled={busy || !selectedPet}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
          >

            {busy ? (
              <Spinner size={16} />
            ) : (
              <Swords className="w-4 h-4" />
            )}

            {confirmLabel}

          </button>

        </div>

      )}

    </Modal>
  );
}
