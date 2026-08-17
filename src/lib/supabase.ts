import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  throw new Error("Missing Supabase environment variables. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.");
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;

export type Tier = "Worthless" | "Average" | "Decent" | "Good" | "Fabulous" | "Excellent";

export interface Player {
  id: string;
  username: string;
  atto_address: string;
  created_at: string;
  last_login: string;
}

export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  tier: Tier;
  appearance: string;
  personality: string;
  description: string;
  passive_name: string;
  passive_description: string;
  passive_effect: { type: string; value: number };
  attack: number;
  defense: number;
  max_health: number;
  crit_chance: number;
  multi_attack_chance: number;
  tradeable: boolean;
  is_clone: boolean;
  in_battle: boolean;
  battle_locked_until: string | null;
  sprite_seed: number;
  created_at: string;
}

export interface MarketplaceListing {
  id: string;
  seller_id: string;
  pet_id: string;
  price: number;
  status: "active" | "sold" | "cancelled";
  buyer_id: string | null;
  created_at: string;
  sold_at: string | null;
  pet?: Pet;
  seller?: { username: string; atto_address: string };
}

export interface Battle {
  id: string;
  creator_id: string;
  joiner_id: string | null;
  creator_pet_id: string;
  joiner_pet_id: string | null;
  creator_current_hp: number | null;
  joiner_current_hp: number | null;
  current_turn_player_id: string | null;
  round_number: number;
  status: "waiting" | "active" | "finished" | "cancelled";
  winner_id: string | null;
  winner_name: string | null;
  created_at: string;
  updated_at: string;
  creator_pet?: Pet;
  joiner_pet?: Pet;
  creator?: { username: string };
  joiner?: { username: string };
}

export interface CombatLog {
  id: string;
  battle_id: string;
  round_number: number;
  actor_player_id: string | null;
  message: string;
  created_at: string;
}

export const TIER_ORDER: Tier[] = ["Worthless", "Average", "Decent", "Good", "Fabulous", "Excellent"];

export const TIER_COLORS: Record<Tier, { text: string; bg: string; border: string; ring: string; label: string }> = {
  Worthless: { text: "text-stone-600", bg: "bg-stone-100", border: "border-stone-300", ring: "ring-stone-400", label: "Worthless" },
  Average: { text: "text-slate-600", bg: "bg-slate-100", border: "border-slate-300", ring: "ring-slate-400", label: "Average" },
  Decent: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300", ring: "ring-emerald-400", label: "Decent" },
  Good: { text: "text-sky-700", bg: "bg-sky-50", border: "border-sky-300", ring: "ring-sky-400", label: "Good" },
  Fabulous: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300", ring: "ring-amber-400", label: "Fabulous" },
  Excellent: { text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-300", ring: "ring-rose-400", label: "Excellent" },
};

export interface EggType {
  id: string;
  name: string;
  price: number;
  tier: Tier;
  description: string;
  icon: string;
}

export const EGGS: EggType[] = [
  { id: "worthless", name: "Worthless Egg", price: 1, tier: "Worthless", description: "The cheapest egg. Hatches a Worthless-tier pet — humble, but everyone starts somewhere.", icon: "worthless" },
  { id: "decent", name: "Decent Egg", price: 5, tier: "Decent", description: "Hatches a Decent-tier pet with solid stats for early battles.", icon: "decent" },
  { id: "average", name: "Average Egg", price: 10, tier: "Average", description: "Hatches an Average-tier pet. A balanced companion for any trainer.", icon: "average" },
  { id: "good", name: "Good Egg", price: 25, tier: "Good", description: "Hatches a Good-tier pet with strong stats and a useful passive.", icon: "good" },
  { id: "fabulous", name: "Fabulous Egg", price: 50, tier: "Fabulous", description: "Hatches a Fabulous-tier pet. Powerful and rare — a serious contender.", icon: "fabulous" },
  { id: "excellent", name: "Excellent Egg", price: 100, tier: "Excellent", description: "The finest egg. Hatches an Excellent-tier pet with the highest possible stats.", icon: "excellent" },
];
