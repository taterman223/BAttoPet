import type { Tier } from "./supabase";
import { TIER_COLORS } from "./supabase";

export function TierBadge({ tier, size = "md" }: { tier: Tier; size?: "sm" | "md" }) {
  const c = TIER_COLORS[tier];
  const pad = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex items-center rounded-full border ${c.border} ${c.bg} ${c.text} ${pad} font-semibold uppercase tracking-wider`}>
      {c.label}
    </span>
  );
}

export function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-slate-600 font-mono w-8 text-right">{value}</span>
    </div>
  );
}

const PIXEL_PALETTES: Record<string, string[]> = {
  Worthless: ["#d6d3d1", "#a8a29e", "#78716c", "#57534e", "#292524"],
  Average: ["#e2e8f0", "#94a3b8", "#64748b", "#475569", "#1e293b"],
  Decent: ["#d1fae5", "#6ee7b7", "#10b981", "#047857", "#064e3b"],
  Good: ["#e0f2fe", "#7dd3fc", "#0ea5e9", "#0369a1", "#0c4a6e"],
  Fabulous: ["#fef3c7", "#fcd34d", "#f59e0b", "#d97706", "#78350f"],
  Excellent: ["#fecdd3", "#fda4af", "#e11d48", "#be123c", "#881337"],
};

const SPECIES_SPRITES: Record<string, number> = {
  "Flame Drake": 0, "Crystal Fox": 1, "Shadow Lynx": 2, "Storm Serpent": 3, "Moss Golem": 4,
  "Aether Moth": 5, "Frost Hound": 6, "Ember Sprite": 7, "Tide Kraken": 8, "Dune Beetle": 9,
  "Void Owl": 10, "Glimmer Slime": 11, "Thorn Boar": 12, "Static Eel": 13, "Cloud Ram": 14,
  "Cinder Bat": 15, "Coral Newt": 16, "Bramble Stag": 17, "Ash Raven": 18, "Lumen Jelly": 19,
};

function pixelGrid(pattern: number[], palette: string[], px: number): React.ReactNode {
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const val = pattern[i];
    if (val === 0) continue;
    const col = i % 10;
    const row = Math.floor(i / 10);
    const color = palette[val] ?? palette[1];
    cells.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: col * px,
          top: row * px,
          width: px,
          height: px,
          background: color,
        }}
      />
    );
  }
  return cells;
}

const SPRITES: number[][] = [
  // Flame Drake - dragon-like
  [0,0,0,0,0,3,3,0,0,0, 0,0,0,0,3,2,2,3,0,0, 0,0,0,3,2,1,1,2,3,0, 0,0,3,2,1,1,1,1,2,3, 0,3,2,1,4,4,1,1,2,0, 3,2,1,1,4,4,1,1,2,3, 0,3,2,1,1,1,1,2,3,0, 0,0,3,2,1,1,2,3,0,0, 0,0,0,3,2,2,3,0,0,0, 0,0,0,0,3,3,0,0,0,0],
  // Crystal Fox - fox-like
  [0,0,4,0,0,0,0,4,0,0, 0,4,2,4,0,0,4,2,4,0, 0,4,2,2,4,4,2,2,4,0, 0,4,2,1,1,1,1,2,4,0, 0,0,4,1,3,3,1,4,0,0, 0,0,4,1,1,1,1,4,0,0, 0,0,0,4,1,1,4,0,0,0, 0,0,0,4,2,2,4,0,0,0, 0,0,4,2,0,0,2,4,0,0, 0,0,4,0,0,0,0,4,0,0],
  // Shadow Lynx - cat-like
  [0,4,0,0,0,0,0,0,4,0, 4,3,4,0,0,0,0,4,3,4, 4,3,3,4,0,0,4,3,3,4, 0,4,3,1,1,1,1,3,4,0, 0,4,1,4,1,1,4,1,4,0, 0,0,4,1,1,1,1,4,0,0, 0,0,0,4,3,3,4,0,0,0, 0,0,4,3,0,0,3,4,0,0, 0,0,4,0,0,0,0,4,0,0, 0,0,0,0,0,0,0,0,0,0],
  // Storm Serpent - snake-like
  [0,0,0,0,0,0,3,3,3,0, 0,0,0,0,0,3,2,1,2,3, 0,0,0,0,3,2,1,1,2,3, 0,0,0,3,2,1,4,1,2,0, 0,0,3,2,1,1,1,1,2,0, 0,3,2,1,1,2,2,1,0,0, 3,2,1,1,2,0,0,3,3,0, 2,1,1,2,0,0,0,0,0,0, 3,2,2,3,0,0,0,0,0,0, 0,3,3,0,0,0,0,0,0,0],
  // Moss Golem - big creature
  [0,0,2,2,2,2,2,2,0,0, 0,2,1,1,3,3,1,1,2,0, 2,1,1,3,3,3,3,1,1,2, 2,1,3,4,4,4,4,3,1,2, 2,1,3,4,2,2,4,3,1,2, 0,2,1,3,4,4,3,1,2,0, 0,0,2,1,3,3,1,2,0,0, 0,2,1,1,0,0,1,1,2,0, 2,1,0,0,0,0,0,0,1,2, 2,0,0,0,0,0,0,0,0,2],
  // Aether Moth - butterfly-like
  [0,0,0,0,3,3,3,0,0,0, 0,2,2,2,3,1,1,3,2,0, 2,1,1,2,3,1,1,3,2,2, 2,1,4,2,1,1,1,1,2,2, 0,2,2,1,1,1,1,2,2,0, 0,0,2,1,1,1,1,2,0,0, 0,0,0,2,1,1,2,0,0,0, 0,0,0,0,2,2,0,0,0,0, 0,0,0,0,2,2,0,0,0,0, 0,0,0,0,0,0,0,0,0,0],
  // Frost Hound - wolf-like
  [0,0,0,0,0,0,0,0,0,0, 0,4,0,0,0,0,0,0,4,0, 4,3,4,0,0,0,0,4,3,4, 4,3,1,4,0,0,4,1,3,4, 4,3,1,1,4,4,1,1,3,4, 0,4,1,1,1,1,1,1,4,0, 0,0,4,1,1,1,1,4,0,0, 0,0,0,4,2,2,4,0,0,0, 0,0,4,2,0,0,2,4,0,0, 0,0,4,0,0,0,0,4,0,0],
  // Ember Sprite - small fire creature
  [0,0,0,0,1,1,0,0,0,0, 0,0,0,1,2,2,1,0,0,0, 0,0,1,2,3,3,2,1,0,0, 0,1,2,3,4,4,3,2,1,0, 1,2,3,4,1,1,4,3,2,1, 0,1,2,3,4,4,3,2,1,0, 0,0,1,2,3,3,2,1,0,0, 0,0,0,1,2,2,1,0,0,0, 0,0,0,0,1,1,0,0,0,0, 0,0,0,0,0,0,0,0,0,0],
  // Tide Kraken - tentacle creature
  [0,0,0,2,2,2,2,2,0,0, 0,0,2,1,1,3,1,1,2,0, 0,2,1,1,3,3,3,1,1,2, 0,2,1,3,4,4,4,3,1,2, 2,1,3,4,2,2,2,4,3,1, 2,1,3,4,2,0,2,4,3,1, 0,2,1,3,2,0,2,3,1,2, 0,0,2,1,0,0,0,1,2,0, 0,2,0,2,0,0,0,2,0,2, 2,0,0,0,0,0,0,0,0,2],
  // Dune Beetle - round beetle
  [0,0,0,0,3,3,0,0,0,0, 0,0,0,3,1,1,3,0,0,0, 0,0,3,1,2,2,1,3,0,0, 0,3,1,2,4,4,2,1,3,0, 3,1,2,4,1,1,4,2,1,3, 3,1,2,4,1,1,4,2,1,3, 0,3,1,2,4,4,2,1,3,0, 0,0,3,1,2,2,1,3,0,0, 0,3,0,3,0,0,3,0,3,0, 3,0,0,0,0,0,0,0,0,3],
  // Void Owl - owl
  [0,0,0,2,2,2,2,0,0,0, 0,0,2,1,1,1,1,2,0,0, 0,2,1,4,1,1,4,1,2,0, 2,1,4,4,1,1,4,4,1,2, 2,1,1,1,2,2,1,1,1,2, 0,2,1,1,1,1,1,1,2,0, 0,0,2,3,3,3,3,2,0,0, 0,0,0,3,0,0,3,0,0,0, 0,0,3,0,0,0,0,3,0,0, 0,0,3,0,0,0,0,3,0,0],
  // Glimmer Slime - blob
  [0,0,0,0,1,1,0,0,0,0, 0,0,1,1,2,2,1,1,0,0, 0,1,2,2,1,1,2,2,1,0, 1,2,1,1,3,3,1,1,2,1, 1,2,1,3,2,2,3,1,2,1, 1,2,1,3,2,2,3,1,2,1, 0,1,2,1,1,1,1,2,1,0, 0,0,1,2,1,1,2,1,0,0, 0,0,0,1,2,2,1,0,0,0, 0,0,0,0,1,1,0,0,0,0],
  // Thorn Boar - pig-like with tusks
  [0,0,0,0,0,0,0,0,0,0, 0,0,3,0,0,0,0,3,0,0, 0,3,2,3,0,0,3,2,3,0, 3,2,1,1,4,4,1,1,2,3, 3,2,1,4,1,1,4,1,2,3, 0,3,2,1,1,1,1,2,3,0, 0,0,3,1,1,1,1,3,0,0, 0,0,0,3,2,2,3,0,0,0, 0,0,3,2,0,0,2,3,0,0, 0,0,3,0,0,0,0,3,0,0],
  // Static Eel - elongated
  [0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,2,2,2,0, 0,0,0,0,0,2,1,1,1,2, 0,0,0,0,2,1,3,3,1,2, 0,0,0,2,1,3,4,3,1,0, 0,0,2,1,3,4,4,3,1,0, 0,2,1,3,4,2,2,3,1,0, 2,1,3,2,0,0,0,2,3,0, 2,2,0,0,0,0,0,0,2,2, 0,0,0,0,0,0,0,0,0,0],
  // Cloud Ram - fluffy ram
  [0,0,0,2,2,2,2,2,0,0, 0,0,2,1,1,1,1,1,2,0, 0,2,1,4,4,4,4,4,1,2, 2,1,4,4,2,2,2,4,4,1, 2,1,4,2,2,1,1,2,2,1, 0,2,1,1,1,1,1,1,2,0, 0,0,2,1,1,1,1,2,0,0, 0,2,0,2,0,0,2,0,2,0, 2,2,0,0,0,0,0,0,2,2, 2,0,0,0,0,0,0,0,0,2],
  // Cinder Bat - bat
  [0,0,0,0,1,1,0,0,0,0, 0,0,0,1,2,2,1,0,0,0, 0,0,1,2,1,1,2,1,0,0, 4,1,2,1,4,4,1,2,1,4, 4,4,1,1,1,1,1,1,4,4, 0,4,4,1,1,1,1,4,4,0, 0,0,4,4,1,1,4,4,0,0, 0,0,0,4,2,2,4,0,0,0, 0,0,4,2,0,0,2,4,0,0, 0,4,2,0,0,0,0,2,4,0],
  // Coral Newt - salamander
  [0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,2,2,2,0,0, 0,0,0,0,2,1,1,1,2,0, 0,0,0,2,1,3,3,1,2,0, 0,0,2,1,3,4,4,3,1,0, 0,2,1,3,4,2,2,4,3,0, 2,1,3,4,2,0,0,2,3,2, 2,1,3,0,0,0,0,0,3,2, 0,2,2,0,0,0,0,0,2,2, 0,0,0,0,0,0,0,0,0,0],
  // Bramble Stag - deer with antlers
  [3,0,0,0,0,0,0,0,0,3, 3,3,0,0,0,0,0,0,3,3, 0,3,3,0,0,0,0,3,3,0, 0,0,2,2,2,2,2,2,0,0, 0,0,2,1,3,3,1,2,0,0, 0,2,1,4,1,1,4,1,2,0, 0,2,1,1,1,1,1,1,2,0, 0,0,2,1,1,1,1,2,0,0, 0,0,0,2,2,2,2,0,0,0, 0,0,2,0,0,0,0,2,0,0],
  // Ash Raven - bird
  [0,0,0,0,0,0,0,0,0,0, 0,0,0,0,2,2,0,0,0,0, 0,0,0,2,1,1,2,0,0,0, 0,0,2,1,4,4,1,2,0,0, 0,2,1,4,1,1,4,1,2,0, 2,1,1,1,3,3,1,1,1,2, 2,1,1,3,3,3,3,1,1,2, 0,2,3,3,0,0,3,3,2,0, 0,0,3,0,0,0,0,3,0,0, 0,0,3,0,0,0,0,3,0,0],
  // Lumen Jelly - jellyfish
  [0,0,0,1,1,1,1,1,0,0, 0,0,1,2,2,2,2,1,0,0, 0,1,2,1,1,1,1,2,1,0, 1,2,1,3,3,3,3,1,2,1, 1,2,1,3,4,4,3,1,2,1, 0,1,2,1,3,3,1,2,1,0, 0,0,1,2,1,1,2,1,0,0, 0,0,0,1,0,0,1,0,0,0, 0,0,1,0,0,0,0,1,0,0, 0,1,0,0,0,0,0,0,1,0],
];

export function PetAvatar({ tier, species, size = 80 }: { tier: Tier; species: string; size?: number }) {
  const c = TIER_COLORS[tier];
  const palette = PIXEL_PALETTES[tier] ?? PIXEL_PALETTES.Worthless;
  const spriteIdx = SPECIES_SPRITES[species] ?? (species.charCodeAt(0) + species.length) % SPRITES.length;
  const sprite = SPRITES[spriteIdx] ?? SPRITES[0];
  const px = Math.floor(size / 10);

  return (
    <div
      className={`relative rounded-lg border-2 ${c.border} ${c.bg} shrink-0`}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    >
      <div className="absolute inset-0" style={{ width: px * 10, height: px * 10, left: (size - px * 10) / 2, top: (size - px * 10) / 2 }}>
        {pixelGrid(sprite, palette, px)}
      </div>
    </div>
  );
}

const EGG_PALETTES: Record<string, string[]> = {
  worthless: ["#e7e5e4", "#d6d3d1", "#a8a29e", "#78716c", "#44403c"],
  decent: ["#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#059669"],
  average: ["#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#334155"],
  good: ["#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8", "#0284c7"],
  fabulous: ["#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#d97706"],
  excellent: ["#fecdd3", "#fda4af", "#fb7185", "#f43f5e", "#e11d48"],
};

const EGG_SPRITE: number[] = [
  0,0,0,0,1,1,1,0,0,0,
  0,0,0,1,2,2,2,1,0,0,
  0,0,1,2,3,2,2,3,1,0,
  0,1,2,3,2,1,1,2,3,1,
  1,2,3,2,1,4,4,1,2,3,
  1,2,2,1,4,4,4,4,1,2,
  1,2,2,1,4,3,3,4,1,2,
  0,1,2,1,1,1,1,1,2,1,
  0,0,1,2,2,2,2,2,1,0,
  0,0,0,1,1,1,1,1,0,0,
];

export function EggVisual({ type, size = 120 }: { type: string; size?: number }) {
  const palette = EGG_PALETTES[type] ?? EGG_PALETTES.worthless;
  const px = Math.floor(size / 10);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size, imageRendering: "pixelated" }}>
      <div
        className="absolute rounded-full blur-xl opacity-30 animate-pulse"
        style={{ width: size * 0.7, height: size * 0.7, background: palette[3] }}
      />
      <div className="relative" style={{ width: px * 10, height: px * 10 }}>
        {pixelGrid(EGG_SPRITE, palette, px)}
      </div>
    </div>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      className="border-2 border-slate-300 border-t-sky-500 rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-slate-300 mb-3">{icon}</div>
      <p className="text-slate-600 font-medium">{title}</p>
      <p className="text-slate-400 text-sm mt-1">{subtitle}</p>
    </div>
  );
}

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800">{title}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function HpBar({ current, max }: { current: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const color = pct > 50 ? "bg-emerald-500" : pct > 25 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="w-full">
      <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
        <span>HP</span>
        <span className="font-mono text-slate-600">{current} / {max}</span>
      </div>
      <div className="h-3 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
