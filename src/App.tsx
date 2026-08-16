import { AuthProvider, useAuth } from "@/lib/auth";
import { Spinner } from "@/lib/ui";
import Auth from "@/pages/Auth";
import Home from "@/pages/Home";
import MyPets from "@/pages/MyPets";
import EggShop from "@/pages/EggShop";
import Marketplace from "@/pages/Marketplace";
import BattleArena from "@/pages/BattleArena";
import Account from "@/pages/Account";
import { PawPrint, Home as HomeIcon, Egg, Store, Swords, User, LogOut } from "lucide-react";
import { useState, useEffect } from "react";

export type Page = "home" | "pets" | "shop" | "market" | "arena" | "account";

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${active ? "bg-sky-600 text-white" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Shell() {
  const { user, player, loading, signOut } = useAuth();
  const [page, setPage] = useState<Page>("home");

  useEffect(() => {
    if (!user && !loading) setPage("home");
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size={32} />
      </div>
    );
  }

  if (!user || !player) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-600 flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-800 text-lg hidden sm:block">ATTO Pets</span>
          </div>

          <nav className="flex items-center gap-1">
            <NavItem active={page === "home"} onClick={() => setPage("home")} icon={<HomeIcon className="w-4 h-4" />} label="Home" />
            <NavItem active={page === "pets"} onClick={() => setPage("pets")} icon={<PawPrint className="w-4 h-4" />} label="Pets" />
            <NavItem active={page === "shop"} onClick={() => setPage("shop")} icon={<Egg className="w-4 h-4" />} label="Shop" />
            <NavItem active={page === "market"} onClick={() => setPage("market")} icon={<Store className="w-4 h-4" />} label="Market" />
            <NavItem active={page === "arena"} onClick={() => setPage("arena")} icon={<Swords className="w-4 h-4" />} label="Arena" />
            <NavItem active={page === "account"} onClick={() => setPage("account")} icon={<User className="w-4 h-4" />} label="Account" />
          </nav>

          <button
            onClick={() => signOut()}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {page === "home" && <Home navigate={setPage} />}
        {page === "pets" && <MyPets />}
        {page === "shop" && <EggShop />}
        {page === "market" && <Marketplace />}
        {page === "arena" && <BattleArena />}
        {page === "account" && <Account />}
      </main>

      <footer className="border-t border-slate-200 mt-12 py-6 text-center text-slate-400 text-xs">
        ATTO Pets · Real ATTO payments · AI-generated pets · Non-custodial
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
