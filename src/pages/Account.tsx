import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { Wallet, Calendar, PawPrint, LogOut, Copy, Check, Package } from "lucide-react";

export default function Account() {
  const { user, player, signOut, refreshPlayer } = useAuth();
  const [petCount, setPetCount] = useState(0);
  const [battleCount, setBattleCount] = useState(0);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("pets").select("id", { count: "exact", head: true }).eq("owner_id", user.id)
      .then(({ count }) => setPetCount(count ?? 0));
    supabase.from("purchases").select("id", { count: "exact", head: true }).eq("player_id", user.id)
      .then(({ count }) => setPurchaseCount(count ?? 0));
    supabase.from("battles").select("id", { count: "exact", head: true }).or(`creator_id.eq.${user.id},joiner_id.eq.${user.id}`)
      .then(({ count }) => setBattleCount(count ?? 0));
  }, [user]);

  function copyAddress() {
    if (!player) return;
    navigator.clipboard.writeText(player.atto_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!player) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800">Account</h1>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-600 flex items-center justify-center text-2xl font-bold text-white">
            {player.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{player.username}</h2>
            <p className="text-sm text-slate-500">Player ID: {player.id.slice(0, 8)}...</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-sky-500" />
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">ATTO Wallet Address</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs text-slate-600 break-all flex-1">{player.atto_address}</p>
              <button onClick={copyAddress} className="shrink-0 p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 transition">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoCard icon={<Calendar className="w-4 h-4 text-amber-500" />} label="Joined" value={new Date(player.created_at).toLocaleDateString()} />
            <InfoCard icon={<Calendar className="w-4 h-4 text-emerald-500" />} label="Last Login" value={new Date(player.last_login).toLocaleDateString()} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<PawPrint className="w-4 h-4 text-sky-500" />} label="Pets" value={petCount} />
            <StatCard icon={<Package className="w-4 h-4 text-amber-500" />} label="Purchases" value={purchaseCount} />
            <StatCard icon={<PawPrint className="w-4 h-4 text-rose-500" />} label="Battles" value={battleCount} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Security</h3>
        <div className="space-y-2 text-sm text-slate-500">
          <p className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Passwords are securely hashed by Supabase Auth</p>
          <p className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> We never ask for your private key or seed phrase</p>
          <p className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> All payments are verified independently on the ATTO network</p>
          <p className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Your account, pets, and history persist across devices</p>
        </div>
      </div>

      <button
        onClick={async () => { await signOut(); refreshPlayer(); }}
        className="w-full py-2.5 bg-slate-100 hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-slate-600 hover:text-rose-600 font-semibold rounded-lg transition flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">{icon} {label}</div>
      <p className="text-sm text-slate-800 font-medium">{value}</p>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
    </div>
  );
}
