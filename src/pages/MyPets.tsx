import { useEffect, useState } from "react";
import { supabase, type Pet, TIER_COLORS } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PetAvatar, TierBadge, StatBar, EmptyState, Spinner } from "@/lib/ui";
import { PawPrint, Swords, Lock, RefreshCw, Zap, Shield, Heart, Crosshair, Repeat } from "lucide-react";

export default function MyPets() {
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Pet | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase.from("pets").select("*").eq("owner_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        setPets((data ?? []) as Pet[]);
        setLoading(false);
      });

    const channel = supabase.channel("my-pets")
      .on("postgres_changes", { event: "*", schema: "public", table: "pets", filter: `owner_id=eq.${user.id}` },
        () => {
          supabase.from("pets").select("*").eq("owner_id", user.id).order("created_at", { ascending: false })
            .then(({ data }) => setPets((data ?? []) as Pet[]));
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  }

  if (pets.length === 0) {
    return (
      <EmptyState
        icon={<PawPrint className="w-12 h-12" />}
        title="No pets yet"
        subtitle="Visit the Egg Shop to buy and hatch your first pet."
      />
    );
  }

  const isLocked = (p: Pet) => p.battle_locked_until && new Date(p.battle_locked_until) > new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Pets</h1>
          <p className="text-slate-500 text-sm mt-0.5">{pets.length} pet{pets.length !== 1 ? "s" : ""} in your collection</p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            supabase.from("pets").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false })
              .then(({ data }) => { setPets((data ?? []) as Pet[]); setLoading(false); });
          }}
          className="p-2 rounded-lg bg-white border border-slate-300 text-slate-400 hover:text-slate-700 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {pets.map((pet) => {
          const c = TIER_COLORS[pet.tier];
          const locked = isLocked(pet);
          return (
            <button
              key={pet.id}
              onClick={() => setSelected(pet)}
              className={`group relative text-left rounded-2xl border ${c.border} bg-white p-4 transition-all hover:scale-[1.03] hover:shadow-lg`}
            >
              <div className="flex items-start gap-3">
                <PetAvatar tier={pet.tier} species={pet.species} spriteSeed={pet.sprite_seed} size={64} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 truncate">{pet.name}</h3>
                  <p className="text-xs text-slate-400 truncate">{pet.species}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <TierBadge tier={pet.tier} size="sm" />
                    {pet.is_clone && <span className="px-2 py-0.5 text-[10px] rounded-full bg-violet-100 border border-violet-300 text-violet-700 uppercase font-semibold">Clone</span>}
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <StatBar label="HP" value={pet.max_health} max={250} color="bg-rose-500" />
                <StatBar label="ATK" value={pet.attack} max={50} color="bg-amber-500" />
                <StatBar label="DEF" value={pet.defense} max={35} color="bg-sky-500" />
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px]">
                {pet.in_battle ? (
                  <span className="inline-flex items-center gap-1 text-rose-600"><Swords className="w-3 h-3" /> In Battle</span>
                ) : locked ? (
                  <span className="inline-flex items-center gap-1 text-amber-600"><Lock className="w-3 h-3" /> Locked {new Date(pet.battle_locked_until!).toLocaleDateString()}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-600"><Zap className="w-3 h-3" /> Ready</span>
                )}
                <span className="text-slate-300">·</span>
                {pet.tradeable ? (
                  <span className="text-slate-500">Tradeable</span>
                ) : (
                  <span className="text-slate-400">Non-tradeable</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected && <PetDetailModal pet={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PetDetailModal({ pet, onClose }: { pet: Pet; onClose: () => void }) {
  const c = TIER_COLORS[pet.tier];
  const locked = pet.battle_locked_until && new Date(pet.battle_locked_until) > new Date();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className={`relative ${c.bg} p-6 border-b ${c.border}`}>
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-xl">&times;</button>
          <div className="flex items-center gap-4">
            <PetAvatar tier={pet.tier} species={pet.species} spriteSeed={pet.sprite_seed} size={88} />
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{pet.name}</h2>
              <p className="text-slate-600 text-sm">{pet.species}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <TierBadge tier={pet.tier} />
                {pet.is_clone && <span className="px-2.5 py-1 text-xs rounded-full bg-violet-100 border border-violet-300 text-violet-700 uppercase font-semibold">Clone</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Appearance</h3>
            <p className="text-sm text-slate-600">{pet.appearance}</p>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Personality</h3>
            <p className="text-sm text-slate-600 capitalize">{pet.personality}</p>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Description</h3>
            <p className="text-sm text-slate-600">{pet.description}</p>
          </div>

          <div className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Zap className={`w-4 h-4 ${c.text}`} />
              <h3 className={`font-bold ${c.text}`}>{pet.passive_name}</h3>
            </div>
            <p className="text-sm text-slate-600">{pet.passive_description}</p>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Combat Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatBox icon={<Heart className="w-4 h-4 text-rose-500" />} label="Health" value={pet.max_health} />
              <StatBox icon={<Crosshair className="w-4 h-4 text-amber-500" />} label="Attack" value={pet.attack} />
              <StatBox icon={<Shield className="w-4 h-4 text-sky-500" />} label="Defense" value={pet.defense} />
              <StatBox icon={<Zap className="w-4 h-4 text-orange-500" />} label="Crit Chance" value={`${(pet.crit_chance * 100).toFixed(1)}%`} />
              <StatBox icon={<Repeat className="w-4 h-4 text-violet-500" />} label="Multi-Attack" value={`${(pet.multi_attack_chance * 100).toFixed(1)}%`} />
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm pt-2 border-t border-slate-200">
            {pet.in_battle ? (
              <span className="inline-flex items-center gap-1.5 text-rose-600"><Swords className="w-4 h-4" /> Currently in a battle</span>
            ) : locked ? (
              <span className="inline-flex items-center gap-1.5 text-amber-600"><Lock className="w-4 h-4" /> Battle-locked until {new Date(pet.battle_locked_until!).toLocaleString()}</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-emerald-600"><Zap className="w-4 h-4" /> Ready for battle</span>
            )}
            <span className="text-slate-400 ml-auto">{pet.tradeable ? "Tradeable" : "Non-tradeable"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {icon}
        {label}
      </div>
      <p className="text-lg font-bold text-slate-800 mt-1">{value}</p>
    </div>
  );
}
