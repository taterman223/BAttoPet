import { useEffect, useState } from "react";
import { supabase, type MarketplaceListing, type Pet } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PetAvatar, TierBadge, StatBar, EmptyState, Spinner, Modal } from "@/lib/ui";
import { Store, RefreshCw, Tag, Wallet, ShoppingCart, X } from "lucide-react";

export default function Marketplace() {
  const { user, player, session } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [myPets, setMyPets] = useState<Pet[]>([]);
  const [sellPet, setSellPet] = useState<Pet | null>(null);
  const [sellPrice, setSellPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyListing, setBuyListing] = useState<MarketplaceListing | null>(null);
  const [buyTxHash, setBuyTxHash] = useState("");
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadListings() {
    const { data } = await supabase
      .from("marketplace_listings")
      .select("*, pet:pets(*), seller:players(username, atto_address)")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    setListings((data ?? []) as unknown as MarketplaceListing[]);
    setLoading(false);
  }

  async function loadMyPets() {
    if (!user) return;
    const { data } = await supabase
      .from("pets")
      .select("*")
      .eq("owner_id", user.id)
      .eq("in_battle", false)
      .order("created_at", { ascending: false });
    setMyPets((data ?? []) as Pet[]);
  }

  useEffect(() => {
    loadListings();
    loadMyPets();

    const channel = supabase.channel("marketplace")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketplace_listings" }, loadListings)
      .on("postgres_changes", { event: "*", schema: "public", table: "pets" }, () => { loadListings(); loadMyPets(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function handleSell() {
    if (!sellPet || !sellPrice || !session) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketplace`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "list", pet_id: sellPet.id, price: Number(sellPrice) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSellPet(null);
      setSellPrice("");
      setSuccess("Pet listed on the marketplace.");
      setTimeout(() => setSuccess(null), 3000);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(listingId: string) {
    if (!session) return;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketplace`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "cancel", listing_id: listingId }),
    });
    if (res.ok) setSuccess("Listing cancelled.");
    setTimeout(() => setSuccess(null), 3000);
  }

  async function handleBuy() {
    if (!buyListing || !buyTxHash || !session) return;
    setBuyBusy(true);
    setBuyError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketplace`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "buy", listing_id: buyListing.id, tx_hash: buyTxHash.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setBuyError(data.error); return; }
      setBuyListing(null);
      setBuyTxHash("");
      setSuccess("Purchase complete! The pet is now yours.");
      setTimeout(() => setSuccess(null), 4000);
    } finally {
      setBuyBusy(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Marketplace</h1>
          <p className="text-slate-500 text-sm mt-0.5">{listings.length} active listing{listings.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { loadListings(); loadMyPets(); }} className="p-2 rounded-lg bg-white border border-slate-300 text-slate-400 hover:text-slate-700 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setSellPet(null); document.getElementById("sell-modal")?.click(); }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition flex items-center gap-2"
          >
            <Tag className="w-4 h-4" /> List a Pet
          </button>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">{success}</div>
      )}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {listings.length === 0 ? (
        <EmptyState icon={<Store className="w-12 h-12" />} title="No listings yet" subtitle="Be the first to list a pet for sale." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((l) => {
            const pet = l.pet;
            if (!pet) return null;
            const isOwn = l.seller_id === user?.id;
            return (
              <div key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-400 hover:shadow-lg">
                <div className="flex items-start gap-3">
                  <PetAvatar tier={pet.tier} species={pet.species} size={64} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 truncate">{pet.name}</h3>
                    <p className="text-xs text-slate-400 truncate">{pet.species}</p>
                    <div className="mt-1.5"><TierBadge tier={pet.tier} size="sm" /></div>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <StatBar label="HP" value={pet.max_health} max={250} color="bg-rose-500" />
                  <StatBar label="ATK" value={pet.attack} max={50} color="bg-amber-500" />
                  <StatBar label="DEF" value={pet.defense} max={35} color="bg-sky-500" />
                </div>
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="text-xs text-amber-600 uppercase tracking-wider">Price</p>
                  <p className="text-lg font-bold text-amber-700">{l.price} ATTO</p>
                </div>
                <div className="mt-2 text-xs text-slate-400">Sold by {l.seller?.username ?? "Unknown"}</div>
                <div className="mt-3">
                  {isOwn ? (
                    <button onClick={() => handleCancel(l.id)} className="w-full py-2 bg-slate-100 hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-slate-600 hover:text-rose-600 text-sm font-medium rounded-lg transition flex items-center justify-center gap-1.5">
                      <X className="w-4 h-4" /> Cancel Listing
                    </button>
                  ) : (
                    <button onClick={() => { setBuyListing(l); setBuyTxHash(""); setBuyError(null); }} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-1.5">
                      <ShoppingCart className="w-4 h-4" /> Buy for {l.price} ATTO
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button id="sell-modal" className="hidden" onClick={() => setSellPet(myPets[0] ?? null)} />

      <SellModal
        pets={myPets}
        selectedPet={sellPet}
        onSelect={setSellPet}
        price={sellPrice}
        onPriceChange={setSellPrice}
        onConfirm={handleSell}
        onClose={() => setSellPet(null)}
        busy={busy}
        error={error}
      />

      <BuyModal
        listing={buyListing}
        txHash={buyTxHash}
        onTxHashChange={setBuyTxHash}
        onConfirm={handleBuy}
        onClose={() => setBuyListing(null)}
        busy={buyBusy}
        error={buyError}
        buyerAddress={player?.atto_address ?? ""}
      />
    </div>
  );
}

function SellModal({ pets, selectedPet, onSelect, price, onPriceChange, onConfirm, onClose, busy, error }:
  { pets: Pet[]; selectedPet: Pet | null; onSelect: (p: Pet) => void; price: string; onPriceChange: (v: string) => void; onConfirm: () => void; onClose: () => void; busy: boolean; error: string | null; }) {
  const open = selectedPet !== null || pets.length > 0;
  const eligible = pets.filter((p) => p.tradeable && !p.in_battle && !(p.battle_locked_until && new Date(p.battle_locked_until) > new Date()));
  return (
    <Modal open={open} onClose={onClose} title="List a Pet for Sale">
      {eligible.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">You have no eligible pets to sell. Only tradeable pets that are not in battle can be listed.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-2 font-medium">Select a pet</label>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {eligible.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg border transition text-left ${selectedPet?.id === p.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-slate-400"}`}
                >
                  <PetAvatar tier={p.tier} species={p.species} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.species}</p>
                  </div>
                  <TierBadge tier={p.tier} size="sm" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-medium">Price (ATTO)</label>
            <input type="number" min="1" step="1" value={price} onChange={(e) => onPriceChange(e.target.value)} placeholder="e.g. 5" className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">{error}</div>}
          <button onClick={onConfirm} disabled={busy || !selectedPet || !price} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Spinner size={16} /> : <Tag className="w-4 h-4" />}
            List for Sale
          </button>
        </div>
      )}
    </Modal>
  );
}

function BuyModal({ listing, txHash, onTxHashChange, onConfirm, onClose, busy, error, buyerAddress }:
  { listing: MarketplaceListing | null; txHash: string; onTxHashChange: (v: string) => void; onConfirm: () => void; onClose: () => void; busy: boolean; error: string | null; buyerAddress: string; }) {
  return (
    <Modal open={!!listing} onClose={onClose} title="Buy Pet">
      {listing && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <PetAvatar tier={listing.pet!.tier} species={listing.pet!.species} size={56} />
            <div>
              <p className="font-bold text-slate-800">{listing.pet!.name}</p>
              <p className="text-xs text-slate-400">{listing.pet!.species}</p>
              <p className="text-lg font-bold text-amber-600 mt-0.5">{listing.price} ATTO</p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-sm">
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">How to buy</h3>
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center">1</span>
              <p className="text-slate-600">Send {listing.price} ATTO from your wallet to the seller's address.</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2">
              <p className="text-[10px] text-amber-600 uppercase">Seller's address</p>
              <p className="font-mono text-xs text-amber-700 break-all select-all">
                {listing.seller?.atto_address ?? "Address unavailable"}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center">2</span>
              <p className="text-slate-600">Paste the transaction hash below. We verify it on the ATTO network.</p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Your address (sender)</p>
            <p className="font-mono text-xs text-slate-600 break-all">{buyerAddress}</p>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 font-medium">Transaction Hash</label>
            <input type="text" value={txHash} onChange={(e) => onTxHashChange(e.target.value)} placeholder="64-character hex hash" className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>

          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">{error}</div>}

          <button onClick={onConfirm} disabled={busy || !txHash.trim()} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Spinner size={16} /> : <ShoppingCart className="w-4 h-4" />}
            Verify & Buy
          </button>
        </div>
      )}
    </Modal>
  );
}
