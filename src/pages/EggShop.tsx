import { useState } from "react";
import { supabase, EGGS, type Pet, type EggType } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { EggVisual, Spinner, TierBadge, PetAvatar } from "@/lib/ui";
import { Egg, Wallet, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

type Phase = "browsing" | "purchase" | "hatching" | "revealed" | "error";

export default function EggShop() {
  const { player, session } = useAuth();
  const [selectedEgg, setSelectedEgg] = useState<EggType | null>(null);
  const [phase, setPhase] = useState<Phase>("browsing");
  const [txHash, setTxHash] = useState("");
  const [resultPet, setResultPet] = useState<Pet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hatchProgress, setHatchProgress] = useState(0);
  const [verifying, setVerifying] = useState(false);

  const treasury = "atto://adq4kjkufzjp6z3axtg2wut7dbgtwfrn5hsdj2lhxgiy2glpcifn47lmb7nki";

  async function verifyAndHatch() {
    if (!selectedEgg || !txHash || !session) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hatch-egg`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ egg_type: selectedEgg.id, tx_hash: txHash.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification failed.");
        setPhase("error");
        setVerifying(false);
        return;
      }
      setVerifying(false);
      setPhase("hatching");
      for (let i = 0; i <= 100; i += 4) {
        setHatchProgress(i);
        await new Promise((r) => setTimeout(r, 40));
      }
      setResultPet(data.pet as Pet);
      setPhase("revealed");
    } catch {
      setError("Could not reach the server. Try again.");
      setPhase("error");
      setVerifying(false);
    }
  }

  function reset() {
    setPhase("browsing");
    setSelectedEgg(null);
    setTxHash("");
    setResultPet(null);
    setError(null);
    setHatchProgress(0);
    setVerifying(false);
  }

  if (phase === "hatching") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative">
          <EggVisual type={selectedEgg?.id ?? "worthless"} size={180} />
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ animation: "shake 0.3s infinite" }}
          />
        </div>
        <p className="text-slate-800 text-lg font-bold mt-6 animate-pulse">Hatching...</p>
        <div className="w-48 h-2 bg-slate-200 rounded-full mt-4 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all" style={{ width: `${hatchProgress}%` }} />
        </div>
        <p className="text-slate-400 text-xs mt-2">Generating your unique pet...</p>
      </div>
    );
  }

  if (phase === "revealed" && resultPet) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center mb-6">
          <Sparkles className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h1 className="text-3xl font-bold text-slate-800">A new pet has emerged!</h1>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
          <PetAvatar tier={resultPet.tier} species={resultPet.species} spriteSeed={resultPet.sprite_seed} size={120} />
          <h2 className="text-2xl font-bold text-slate-800 mt-4">{resultPet.name}</h2>
          <p className="text-slate-500">{resultPet.species}</p>
          <div className="mt-3 flex justify-center">
            <TierBadge tier={resultPet.tier} />
          </div>
          <p className="text-sm text-slate-600 mt-4">{resultPet.description}</p>
          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3 text-left">
            <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">{resultPet.passive_name}</p>
            <p className="text-sm text-slate-600 mt-0.5">{resultPet.passive_description}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Stat label="HP" value={resultPet.max_health} />
            <Stat label="ATK" value={resultPet.attack} />
            <Stat label="DEF" value={resultPet.defense} />
          </div>
        </div>
        <button onClick={reset} className="mt-6 px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg transition">
          Back to Egg Shop
        </button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Something went wrong</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-md text-center">{error}</p>
        <button onClick={reset} className="mt-6 px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition">
          Try Again
        </button>
      </div>
    );
  }

  if (phase === "purchase" && selectedEgg) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={reset} className="text-slate-400 hover:text-slate-700 text-sm">&larr; Back to eggs</button>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-4">
            <EggVisual type={selectedEgg.id} size={100} />
            <div>
              <h2 className="text-xl font-bold text-slate-800">{selectedEgg.name}</h2>
              <p className="text-2xl font-bold text-amber-600 mt-1">{selectedEgg.price} ATTO</p>
              <div className="mt-1"><TierBadge tier={selectedEgg.tier} size="sm" /></div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-sm">
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">How to pay</h3>
            <Step n={1} text="Send the exact ATTO amount from your external wallet to the treasury address below." />
            <Step n={2} text="Copy the transaction hash from your wallet or the Atto explorer." />
            <Step n={3} text="Paste it below and click Verify & Hatch. We confirm it on the real ATTO network." />
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider mb-1">Send {selectedEgg.price} ATTO to</p>
            <p className="font-mono text-xs text-amber-700 break-all select-all">{treasury}</p>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">From your address</p>
            <p className="font-mono text-xs text-slate-600 break-all">{player?.atto_address}</p>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-medium">Transaction Hash</label>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="64-character hex transaction hash"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <button
            onClick={verifyAndHatch}
            disabled={verifying || !txHash.trim()}
            className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-lg transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {verifying ? (
              <><Spinner size={18} /> Verifying on ATTO network...</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> Verify & Hatch</>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Egg Shop</h1>
        <p className="text-slate-500 text-sm mt-0.5">Buy eggs with real ATTO. Each one hatches a unique AI-generated pet.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {EGGS.map((egg) => (
          <div key={egg.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-slate-400 hover:shadow-lg">
            <div className="flex justify-center mb-4">
              <EggVisual type={egg.id} size={130} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 text-center">{egg.name}</h3>
            <div className="flex items-center justify-center gap-2 mt-1">
              <p className="text-2xl font-bold text-amber-600">{egg.price} ATTO</p>
            </div>
            <div className="flex justify-center mt-2"><TierBadge tier={egg.tier} size="sm" /></div>
            <p className="text-sm text-slate-500 text-center mt-2 min-h-[40px]">{egg.description}</p>
            <button
              onClick={() => { setSelectedEgg(egg); setPhase("purchase"); }}
              className="w-full mt-4 py-2.5 bg-slate-100 hover:bg-amber-500 border border-slate-300 hover:border-amber-400 text-slate-700 hover:text-white font-semibold rounded-lg transition"
            >
              Buy & Hatch
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-white border border-slate-200 p-4">
        <Wallet className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-500">
          <p className="font-medium text-slate-700">Non-custodial payments</p>
          <p className="mt-1">ATTO Pets never holds your ATTO. You send payment directly from your external wallet, and we verify the transaction independently on the ATTO network before awarding your egg.</p>
        </div>
      </div>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 w-5 h-5 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center">{n}</span>
      <p className="text-slate-600 text-sm">{text}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
      <p className="text-[10px] text-slate-400 uppercase">{label}</p>
      <p className="text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
