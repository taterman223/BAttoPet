import { useEffect, useState, useRef } from "react";
import { supabase, type Battle, type Pet, type CombatLog, TIER_COLORS, TIER_ORDER, type Tier } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PetAvatar, TierBadge, EmptyState, Spinner, HpBar, Modal } from "@/lib/ui";
import { Swords, Plus, LogIn, X, Zap, Trophy, RefreshCw, Clock } from "lucide-react";

export default function BattleArena() {
  const { user, session } = useAuth();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [logs, setLogs] = useState<Record<string, CombatLog[]>>({});
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

  async function loadBattles() {
    const { data } = await supabase
      .from("battles")
      .select("*, creator_pet:pets!battles_creator_pet_id_fkey(*), joiner_pet:pets!battles_joiner_pet_id_fkey(*), creator:players!battles_creator_id_fkey(username), joiner:players!battles_joiner_id_fkey(username)")
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: false });
    setBattles((data ?? []) as unknown as Battle[]);
    setLoading(false);
  }

  async function loadMyPets() {
    if (!user) return;
    const { data } = await supabase.from("pets").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
    setMyPets((data ?? []) as Pet[]);
  }

  useEffect(() => {
    loadBattles();
    loadMyPets();
    const channel = supabase.channel("battles")
      .on("postgres_changes", { event: "*", schema: "public", table: "battles" }, loadBattles)
      .on("postgres_changes", { event: "*", schema: "public", table: "pets" }, loadMyPets)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Active battle view with realtime logs
  useEffect(() => {
    if (!activeBattle) return;
    const battleId = activeBattle.id;

    async function loadActive() {
      const { data: b } = await supabase
        .from("battles")
        .select("*, creator_pet:pets!battles_creator_pet_id_fkey(*), joiner_pet:pets!battles_joiner_pet_id_fkey(*), creator:players!battles_creator_id_fkey(username), joiner:players!battles_joiner_id_fkey(username)")
        .eq("id", battleId)
        .maybeSingle();
      if (b) setActiveBattle(b as unknown as Battle);

      const { data: l } = await supabase.from("battle_combat_logs").select("*").eq("battle_id", battleId).order("created_at", { ascending: true });
      setActiveLogs((l ?? []) as CombatLog[]);
    }

    loadActive();
    const ch = supabase.channel(`battle-${battleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "battles", filter: `id=eq.${battleId}` }, loadActive)
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_combat_logs", filter: `battle_id=eq.${battleId}` }, loadActive)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [activeBattle?.id]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeLogs]);

  const eligiblePets = myPets.filter((p) =>
    !p.in_battle &&
    !(p.battle_locked_until && new Date(p.battle_locked_until) > new Date())
  );

  async function callBattle(action: string, extra: Record<string, unknown> = {}) {
    if (!session) return null;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/battle`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return null; }
    return data;
  }

  async function handleCreate() {
    if (!selectedPet) return;
    setBusy(true); setError(null);
    const data = await callBattle("create", { pet_id: selectedPet.id });
    setBusy(false);
    if (data?.battle_id) {
      setCreateOpen(false);
      setSelectedPet(null);
      loadBattles();
    }
  }

  async function handleJoin() {
    if (!joinBattle || !selectedPet) return;
    setBusy(true); setError(null);
    const data = await callBattle("join", { battle_id: joinBattle.id, pet_id: selectedPet.id });
    setBusy(false);
    if (data?.ok) {
      setJoinBattle(null);
      setSelectedPet(null);
      loadBattles();
    }
  }

  async function handleCancel(battleId: string) {
    await callBattle("cancel", { battle_id: battleId });
    loadBattles();
  }

  async function handleAttack() {
    if (!activeBattle) return;
    setBusy(true); setError(null);
    await callBattle("attack", { battle_id: activeBattle.id });
    setBusy(false);
  }

  if (activeBattle) {
    return <ActiveBattleView battle={activeBattle} logs={activeLogs} userId={user!.id} onAttack={handleAttack} onLeave={() => setActiveBattle(null)} busy={busy} error={error} logEndRef={logEndRef} />;
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  const waitingBattles = battles.filter((b) => b.status === "waiting" && b.creator_id !== user?.id);
  const myActiveBattles = battles.filter((b) => (b.creator_id === user?.id || b.joiner_id === user?.id) && b.status === "active");
  const myWaitingBattles = battles.filter((b) => b.creator_id === user?.id && b.status === "waiting");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Battle Arena</h1>
          <p className="text-slate-400 text-sm mt-0.5">Real-time turn-based multiplayer battles</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadBattles} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setCreateOpen(true); setError(null); }}
            disabled={eligiblePets.length === 0}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Create Battle
          </button>
        </div>
      </div>

      {error && <div className="bg-rose-900/40 border border-rose-700 text-rose-200 text-sm rounded-lg px-4 py-3">{error}</div>}

      {myActiveBattles.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Your Active Battles</h2>
          <div className="space-y-3">
            {myActiveBattles.map((b) => (
              <BattleRow key={b.id} battle={b} highlight onClick={() => setActiveBattle(b)} actionLabel="Enter Battle" actionIcon={<LogIn className="w-4 h-4" />} />
            ))}
          </div>
        </div>
      )}

      {myWaitingBattles.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Waiting for Opponent</h2>
          <div className="space-y-3">
            {myWaitingBattles.map((b) => (
              <BattleRow key={b.id} battle={b} onClick={() => handleCancel(b.id)} actionLabel="Cancel" actionIcon={<X className="w-4 h-4" />} cancel />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Open Battles</h2>
        {waitingBattles.length === 0 ? (
          <EmptyState icon={<Swords className="w-12 h-12" />} title="No open battles" subtitle="Create a battle and wait for another player to join." />
        ) : (
          <div className="space-y-3">
            {waitingBattles.map((b) => (
              <BattleRow key={b.id} battle={b} onClick={() => { setJoinBattle(b); setError(null); setSelectedPet(null); }} actionLabel="Join Battle" actionIcon={<LogIn className="w-4 h-4" />} />
            ))}
          </div>
        )}
      </div>

      <PetSelectModal open={createOpen} onClose={() => setCreateOpen(false)} pets={eligiblePets} selectedPet={selectedPet} onSelect={setSelectedPet} onConfirm={handleCreate} busy={busy} title="Create Battle" confirmLabel="Create Battle" tierLimit={null} />

      <PetSelectModal
        open={!!joinBattle}
        onClose={() => setJoinBattle(null)}
        pets={eligiblePets.filter((p) => TIER_ORDER.indexOf(p.tier as Tier) <= TIER_ORDER.indexOf(joinBattle?.creator_pet?.tier as Tier))}
        selectedPet={selectedPet}
        onSelect={setSelectedPet}
        onConfirm={handleJoin}
        busy={busy}
        title={`Join Battle (max tier: ${joinBattle?.creator_pet?.tier})`}
        confirmLabel="Join Battle"
        tierLimit={joinBattle?.creator_pet?.tier ?? null}
      />
    </div>
  );
}

function BattleRow({ battle, onClick, actionLabel, actionIcon, highlight, cancel }:
  { battle: Battle; onClick: () => void; actionLabel: string; actionIcon: React.ReactNode; highlight?: boolean; cancel?: boolean; }) {
  const cPet = battle.creator_pet;
  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border transition ${highlight ? "border-rose-600/40 bg-rose-900/10" : "border-slate-700 bg-slate-900/60"} hover:border-slate-500`}>
      {cPet && <PetAvatar tier={cPet.tier} species={cPet.species} size={48} />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">{battle.creator?.username}'s {cPet?.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {cPet && <TierBadge tier={cPet.tier} size="sm" />}
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {new Date(battle.created_at).toLocaleTimeString()}
          </span>
        </div>
      </div>
      <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-semibold rounded-lg transition flex items-center gap-1.5 ${cancel ? "bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 border border-slate-600" : "bg-rose-600 hover:bg-rose-500 text-white"}`}
      >
        {actionIcon} {actionLabel}
      </button>
    </div>
  );
}

function ActiveBattleView({ battle, logs, userId, onAttack, onLeave, busy, error, logEndRef }:
  { battle: Battle; logs: CombatLog[]; userId: string; onAttack: () => void; onLeave: () => void; busy: boolean; error: string | null; logEndRef: React.RefObject<HTMLDivElement>; }) {
  const cPet = battle.creator_pet;
  const jPet = battle.joiner_pet;
  const isCreator = battle.creator_id === userId;
  const myPet = isCreator ? cPet : jPet;
  const oppPet = isCreator ? jPet : cPet;
  const myHp = isCreator ? battle.creator_current_hp : battle.joiner_current_hp;
  const oppHp = isCreator ? battle.joiner_current_hp : battle.creator_current_hp;
  const myTurn = battle.current_turn_player_id === userId;
  const finished = battle.status === "finished";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onLeave} className="text-slate-400 hover:text-white text-sm flex items-center gap-1">
          <X className="w-4 h-4" /> Leave Battle
        </button>
        {finished && (
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <Trophy className="w-5 h-5" /> {battle.winner_name} wins!
          </div>
        )}
      </div>

      {error && <div className="bg-rose-900/40 border border-rose-700 text-rose-200 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        {/* Opponent */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Opponent</p>
          {oppPet ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <PetAvatar tier={oppPet.tier} species={oppPet.species} size={56} />
                <div>
                  <p className="font-bold text-white">{oppPet.name}</p>
                  <TierBadge tier={oppPet.tier} size="sm" />
                </div>
              </div>
              <HpBar current={oppHp ?? 0} max={oppPet.max_health} />
            </>
          ) : <p className="text-slate-500 text-sm">Waiting...</p>}
        </div>

        {/* You */}
        <div className="rounded-2xl border border-sky-600/40 bg-sky-900/10 p-4">
          <p className="text-xs text-sky-500 uppercase tracking-wider mb-2">You</p>
          {myPet ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <PetAvatar tier={myPet.tier} species={myPet.species} size={56} />
                <div>
                  <p className="font-bold text-white">{myPet.name}</p>
                  <TierBadge tier={myPet.tier} size="sm" />
                </div>
              </div>
              <HpBar current={myHp ?? 0} max={myPet.max_health} />
            </>
          ) : <p className="text-slate-500 text-sm">No pet</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Combat Log</h3>
          <span className="text-xs text-slate-500">Round {battle.round_number}</span>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-2">
          {logs.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">Battle has not started yet.</p>
          ) : (
            logs.map((l) => (
              <p key={l.id} className={`text-sm px-3 py-1.5 rounded-lg ${l.actor_player_id === userId ? "bg-sky-900/30 text-sky-200" : l.actor_player_id === null ? "bg-amber-900/30 text-amber-200 font-medium" : "bg-slate-800/40 text-slate-300"}`}>
                {l.message}
              </p>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {!finished && (
        <button
          onClick={onAttack}
          disabled={busy || !myTurn}
          className="w-full py-3 bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {busy ? <Spinner size={18} /> : <Zap className="w-5 h-5" />}
          {myTurn ? "Attack!" : "Waiting for opponent..."}
        </button>
      )}

      {finished && (
        <div className="text-center">
          <button onClick={onLeave} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition">
            Back to Arena
          </button>
        </div>
      )}
    </div>
  );
}

function PetSelectModal({ open, onClose, pets, selectedPet, onSelect, onConfirm, busy, title, confirmLabel, tierLimit }:
  { open: boolean; onClose: () => void; pets: Pet[]; selectedPet: Pet | null; onSelect: (p: Pet) => void; onConfirm: () => void; busy: boolean; title: string; confirmLabel: string; tierLimit: Tier | null; }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {pets.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-6">
          {tierLimit ? `You have no eligible pets at or below ${tierLimit} tier.` : "You have no eligible pets for battle."}
        </p>
      ) : (
        <div className="space-y-4">
          {tierLimit && (
            <p className="text-xs text-slate-400 bg-slate-800/60 rounded-lg p-2 border border-slate-700">
              This battle is limited to pets of <span className="text-white font-semibold">{tierLimit}</span> tier or lower.
            </p>
          )}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {pets.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg border transition text-left ${selectedPet?.id === p.id ? "border-rose-500 bg-rose-900/30" : "border-slate-700 bg-slate-800/40 hover:border-slate-500"}`}
              >
                <PetAvatar tier={p.tier} species={p.species} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">HP {p.max_health} · ATK {p.attack} · SPD {p.speed}</p>
                </div>
                <TierBadge tier={p.tier} size="sm" />
              </button>
            ))}
          </div>
          <button onClick={onConfirm} disabled={busy || !selectedPet} className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Spinner size={16} /> : <Swords className="w-4 h-4" />}
            {confirmLabel}
          </button>
        </div>
      )}
    </Modal>
  );
}
