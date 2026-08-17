import { useAuth } from "@/lib/auth";
import { PawPrint, Swords, Store, Egg, Trophy, Wallet } from "lucide-react";
import type { Page } from "@/App";

export default function Home({ navigate }: { navigate: (p: Page) => void }) {
  const { player } = useAuth();

  const features = [
    { icon: Egg, title: "Egg Shop", desc: "Buy eggs with real ATTO and hatch unique AI-generated pets", page: "shop" as Page, color: "from-amber-50 to-orange-100 border-amber-300" },
    { icon: PawPrint, title: "My Pets", desc: "View your collection of AI-generated companions", page: "pets" as Page, color: "from-sky-50 to-cyan-100 border-sky-300" },
    { icon: Store, title: "Marketplace", desc: "Buy and sell pets with other players for ATTO", page: "market" as Page, color: "from-emerald-50 to-teal-100 border-emerald-300" },
    { icon: Swords, title: "Battle Arena", desc: "Turn-based multiplayer battles with real opponents", page: "arena" as Page, color: "from-rose-50 to-red-100 border-rose-300" },
  ];

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-slate-100 p-8 md:p-12">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-200/30 rounded-full blur-3xl" />
        <div className="relative">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 tracking-tight">
            Welcome back, {player?.username}
          </h1>
          <p className="text-slate-500 mt-3 max-w-2xl">
            Every pet in ATTO Pets is uniquely AI-generated with its own stats, personality, and passive ability.
            Collect them, trade them on the open marketplace, and battle other players in real-time turn-based combat.
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Wallet className="w-4 h-4" />
            <span className="font-mono text-slate-600">{player?.atto_address}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((f) => (
          <button
            key={f.title}
            onClick={() => navigate(f.page)}
            className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${f.color} p-6 text-left transition-all hover:scale-[1.02] hover:shadow-lg`}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-white/70 border border-slate-200">
                <f.icon className="w-6 h-6 text-slate-700" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">{f.title}</h3>
                <p className="text-sm text-slate-600 mt-1">{f.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <Trophy className="w-5 h-5 text-amber-500 mb-2" />
          <h3 className="text-sm font-bold text-slate-800">6 Tiers</h3>
          <p className="text-xs text-slate-500 mt-1">From Worthless to Excellent. Higher tiers mean stronger stats.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <Swords className="w-5 h-5 text-rose-500 mb-2" />
          <h3 className="text-sm font-bold text-slate-800">Win Clones</h3>
          <p className="text-xs text-slate-500 mt-1">Victors receive a non-tradeable clone of the defeated pet.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <Wallet className="w-5 h-5 text-sky-500 mb-2" />
          <h3 className="text-sm font-bold text-slate-800">Non-Custodial</h3>
          <p className="text-xs text-slate-500 mt-1">Your ATTO stays in your wallet. We verify transactions on-chain.</p>
        </div>
      </div>
    </div>
  );
}
