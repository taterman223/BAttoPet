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
  Worthless: ["#f5f5f4", "#d6d3d1", "#a8a29e", "#78716c", "#57534e", "#292524"],
  Average: ["#f8fafc", "#e2e8f0", "#94a3b8", "#64748b", "#475569", "#1e293b"],
  Decent: ["#f0fdf4", "#bbf7d0", "#4ade80", "#16a34a", "#15803d", "#14532d"],
  Good: ["#f0f9ff", "#bae6fd", "#38bdf8", "#0284c7", "#0369a1", "#0c4a6e"],
  Fabulous: ["#fffbeb", "#fde68a", "#fbbf24", "#f59e0b", "#d97706", "#78350f"],
  Excellent: ["#fff1f2", "#fecdd3", "#fb7185", "#e11d48", "#be123c", "#881337"],
};

const GRID = 16;

// Seeded PRNG (mulberry32)
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type BodyType = "quadruped" | "biped" | "serpent" | "blob" | "avian" | "insect";

// Map species name to a body type so the silhouette matches the species concept
const SPECIES_BODY: Record<string, BodyType> = {
  "Flame Drake": "biped", "Crystal Fox": "quadruped", "Shadow Lynx": "quadruped",
  "Storm Serpent": "serpent", "Moss Golem": "biped", "Aether Moth": "insect",
  "Frost Hound": "quadruped", "Ember Sprite": "blob", "Tide Kraken": "blob",
  "Dune Beetle": "insect", "Void Owl": "avian", "Glimmer Slime": "blob",
  "Thorn Boar": "quadruped", "Static Eel": "serpent", "Cloud Ram": "quadruped",
  "Cinder Bat": "avian", "Coral Newt": "quadruped", "Bramble Stag": "quadruped",
  "Ash Raven": "avian", "Lumen Jelly": "blob",
  "Frost Wisp": "blob", "Magma Toad": "quadruped", "Hex Scorpion": "insect",
  "Vine Python": "serpent", "Dusk Falcon": "avian", "Glass Mantis": "insect",
  "Rust Hound": "quadruped", "Plume Heron": "avian", "Shard Crab": "insect",
  "Wraith Koi": "serpent", "Bolt Weasel": "quadruped", "Gale Sparrow": "avian",
  "Marsh Imp": "biped", "Ember Lynx": "quadruped", "Frost Stag": "quadruped",
  "Quartz Badger": "quadruped", "Smog Rat": "quadruped", "Tide Urchin": "blob",
  "Gloom Fern": "blob", "Spark Finch": "avian",
};

function getBodyType(species: string, rng: () => number): BodyType {
  if (SPECIES_BODY[species]) return SPECIES_BODY[species];
  const types: BodyType[] = ["quadruped", "biped", "serpent", "blob", "avian", "insect"];
  return types[Math.floor(rng() * types.length)];
}

function pixelGrid(pattern: number[], palette: string[], px: number): React.ReactNode {
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const val = pattern[i];
    if (val === 0) continue;
    const col = i % GRID;
    const row = Math.floor(i / GRID);
    const color = palette[val] ?? palette[1];
    cells.push(
      <div key={i} style={{ position: "absolute", left: col * px, top: row * px, width: px, height: px, background: color }} />
    );
  }
  return cells;
}

// --- Procedural creature generation ---
// Palette indices: 0=transparent, 1=highlight, 2=light, 3=body, 4=dark, 5=eyes/darkest

function generateCreature(seed: number, species: string): number[] {
  const rng = makeRng(seed);
  const body = getBodyType(species, rng);
  const grid = new Array(GRID * GRID).fill(0);

  const set = (x: number, y: number, v: number) => {
    if (x >= 0 && x < GRID && y >= 0 && y < GRID) grid[y * GRID + x] = v;
  };
  const fill = (x0: number, y0: number, x1: number, y1: number, v: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v);
  };

  // Feature toggles from seed
  const hasHorns = rng() > 0.4;
  const hasWings = rng() > 0.5;
  const hasTail = rng() > 0.2;
  const earStyle = Math.floor(rng() * 3); // 0=pointy, 1=round, 2=none
  const eyeStyle = Math.floor(rng() * 3); // 0=round, 1=oval, 2=angry
  const bodyPattern = Math.floor(rng() * 4); // 0=solid, 1=stripes, 2=spots, 3=belly
  const hasArms = body === "biped";

  if (body === "quadruped") {
    // Body: oval shape, 4 legs, head with ears/eyes, tail
    const bodyTop = 6, bodyBot = 11, bodyL = 3, bodyR = 12;
    fill(bodyL, bodyTop, bodyR, bodyBot, 3);
    // Round the body edges
    set(bodyL, bodyTop, 0); set(bodyR, bodyTop, 0);
    set(bodyL, bodyTop + 1, 3); set(bodyR, bodyTop + 1, 3);
    set(bodyL, bodyBot, 0); set(bodyR, bodyBot, 0);
    // Head
    fill(9, 4, 13, 7, 3);
    set(9, 4, 0); set(13, 4, 0);
    // Ears
    if (earStyle === 0) {
      fill(9, 2, 10, 4, 4); fill(12, 2, 13, 4, 4);
    } else if (earStyle === 1) {
      set(10, 3, 4); set(10, 4, 4); set(12, 3, 4); set(12, 4, 4);
    }
    // Horns
    if (hasHorns) {
      set(9, 2, 4); set(9, 1, 4); set(13, 2, 4); set(13, 1, 4);
    }
    // Eyes — always present
    if (eyeStyle === 0) {
      set(11, 5, 5); set(12, 5, 5);
    } else if (eyeStyle === 1) {
      set(11, 5, 5); set(11, 6, 5); set(12, 5, 5); set(12, 6, 5);
    } else {
      set(11, 5, 5); set(12, 5, 5); set(10, 4, 4); set(13, 4, 4);
    }
    // Highlight on head
    set(10, 4, 1);
    // Legs
    fill(3, 12, 4, 14, 4); fill(5, 12, 6, 14, 4);
    fill(10, 12, 11, 14, 4); fill(12, 12, 13, 14, 4);
    // Tail
    if (hasTail) {
      const tailLen = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < tailLen; i++) {
        set(2 - i, bodyTop + i, 3);
        if (2 - i >= 0) set(2 - i, bodyTop + i, 3);
      }
      // Tail can curl up
      if (rng() > 0.5) set(1, 5, 3);
    }
    // Belly highlight
    if (bodyPattern === 3) fill(5, 9, 10, 10, 2);
    // Stripes
    if (bodyPattern === 1) { set(5, 7, 4); set(8, 7, 4); set(11, 7, 4); set(5, 10, 4); set(8, 10, 4); }
    // Spots
    if (bodyPattern === 2) { set(5, 8, 2); set(9, 9, 2); set(7, 7, 2); }
  } else if (body === "biped") {
    // Upright body, head on top, arms, legs, horns/wings
    const bodyTop = 7, bodyBot = 12, bodyL = 4, bodyR = 11;
    fill(bodyL, bodyTop, bodyR, bodyBot, 3);
    set(bodyL, bodyTop, 0); set(bodyR, bodyTop, 0);
    // Head
    fill(5, 2, 10, 6, 3);
    set(5, 2, 0); set(10, 2, 0); set(5, 6, 0); set(10, 6, 0);
    // Eyes
    if (eyeStyle === 0) { set(6, 4, 5); set(9, 4, 5); }
    else if (eyeStyle === 1) { set(6, 3, 5); set(6, 4, 5); set(9, 3, 5); set(9, 4, 5); }
    else { set(6, 4, 5); set(9, 4, 5); set(5, 3, 4); set(10, 3, 4); }
    // Horns
    if (hasHorns) { fill(5, 0, 6, 2, 4); fill(9, 0, 10, 2, 4); }
    // Arms
    if (hasArms) { fill(2, 7, 4, 10, 3); fill(11, 7, 13, 10, 3); set(2, 10, 4); set(13, 10, 4); }
    // Legs
    fill(5, 12, 6, 15, 4); fill(9, 12, 10, 15, 4);
    // Wings
    if (hasWings) {
      fill(0, 5, 3, 10, 2); set(0, 5, 0); set(0, 10, 0);
      fill(12, 5, 15, 10, 2); set(15, 5, 0); set(15, 10, 0);
    }
    // Body highlight
    set(5, 7, 1); set(6, 7, 1);
    if (bodyPattern === 3) fill(5, 10, 10, 11, 2);
  } else if (body === "serpent") {
    // Coiled/wavy body with head at one end
    const points = [
      [12, 3], [12, 4], [11, 5], [10, 6], [9, 7], [8, 8], [7, 9],
      [6, 10], [5, 11], [4, 12], [3, 13], [3, 14],
    ];
    for (const [x, y] of points) { set(x, y, 3); set(x + 1, y, 3); }
    // Thicker body
    for (let i = 0; i < points.length - 1; i++) {
      const [x, y] = points[i];
      set(x, y - 1, 2); set(x + 1, y - 1, 2);
    }
    // Head
    fill(11, 2, 14, 5, 3);
    set(11, 2, 0); set(14, 2, 0); set(11, 5, 0); set(14, 5, 0);
    // Eyes
    if (eyeStyle === 0) { set(12, 3, 5); set(13, 3, 5); }
    else if (eyeStyle === 1) { set(12, 3, 5); set(12, 4, 5); set(13, 3, 5); set(13, 4, 5); }
    else { set(12, 3, 5); set(13, 3, 5); set(11, 2, 4); }
    // Highlight
    set(12, 2, 1);
    // Tail tip
    set(2, 14, 4); set(1, 14, 4);
    // Pattern
    if (bodyPattern === 1) { set(9, 6, 4); set(6, 9, 4); set(4, 12, 4); }
    if (bodyPattern === 2) { set(10, 5, 2); set(7, 8, 2); set(5, 11, 2); }
  } else if (body === "blob") {
    // Roundish blob with eyes, maybe dripping bottom
    const cx = 8, cy = 8, r = 5;
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const dx = x - cx, dy = (y - cy) * 1.1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < r) {
          set(x, y, 3);
          if (dist < r - 2) set(x, y, 2);
          if (dist < 1) set(x, y, 1);
        }
      }
    }
    // Drippy bottom
    if (rng() > 0.5) {
      set(5, 14, 3); set(8, 14, 3); set(11, 14, 3);
      set(5, 15, 4); set(11, 15, 4);
    }
    // Eyes — always present
    if (eyeStyle === 0) { set(6, 7, 5); set(10, 7, 5); }
    else if (eyeStyle === 1) { set(6, 6, 5); set(6, 7, 5); set(10, 6, 5); set(10, 7, 5); }
    else { set(6, 7, 5); set(10, 7, 5); set(5, 6, 4); set(11, 6, 4); }
    // Highlights on top
    set(6, 5, 1); set(7, 4, 1);
    // Optional little appendages on top
    if (hasHorns) { set(5, 2, 4); set(11, 2, 4); }
  } else if (body === "avian") {
    // Bird/bat body with wings, beak, eyes
    fill(5, 5, 10, 11, 3);
    set(5, 5, 0); set(10, 5, 0); set(5, 11, 0); set(10, 11, 0);
    // Head
    fill(6, 3, 9, 6, 3);
    set(6, 3, 0); set(9, 3, 0);
    // Beak
    set(10, 5, 4); set(11, 5, 4); set(11, 6, 4);
    // Eyes
    if (eyeStyle === 0) { set(7, 4, 5); set(8, 4, 5); }
    else if (eyeStyle === 1) { set(7, 4, 5); set(7, 5, 5); set(8, 4, 5); }
    else { set(7, 4, 5); set(8, 4, 5); set(6, 3, 4); set(9, 3, 4); }
    // Wings — spread to sides
    fill(0, 5, 4, 9, 2); set(0, 5, 0); set(0, 9, 0);
    fill(11, 5, 15, 9, 2); set(15, 5, 0); set(15, 9, 0);
    // Wing detail
    set(1, 6, 4); set(1, 8, 4); set(14, 6, 4); set(14, 8, 4);
    // Legs
    fill(6, 12, 6, 14, 4); fill(9, 12, 9, 14, 4);
    set(5, 14, 4); set(7, 14, 4); set(8, 14, 4); set(10, 14, 4);
    // Tail feathers
    if (hasTail) { set(4, 10, 3); set(3, 11, 3); set(2, 12, 3); }
    // Ear tufts
    if (earStyle === 0) { set(6, 2, 4); set(9, 2, 4); }
    // Body highlight
    set(6, 6, 1);
    if (bodyPattern === 3) fill(6, 9, 9, 10, 2);
  } else if (body === "insect") {
    // Insect: segmented body, legs on sides, antennae, eyes
    // Thorax
    fill(6, 6, 9, 9, 3);
    // Head
    fill(6, 3, 9, 6, 3);
    set(6, 3, 0); set(9, 3, 0);
    // Abdomen
    fill(5, 9, 10, 13, 4);
    set(5, 9, 0); set(10, 9, 0); set(5, 13, 0); set(10, 13, 0);
    // Eyes
    if (eyeStyle === 0) { set(7, 4, 5); set(8, 4, 5); }
    else if (eyeStyle === 1) { set(7, 4, 5); set(7, 5, 5); set(8, 4, 5); set(8, 5, 5); }
    else { set(7, 4, 5); set(8, 4, 5); }
    // Antennae
    set(6, 2, 4); set(6, 1, 4); set(9, 2, 4); set(9, 1, 4);
    // Legs
    set(4, 6, 4); set(3, 6, 4); set(4, 7, 4); set(3, 7, 4);
    set(4, 8, 4); set(3, 8, 4);
    set(11, 6, 4); set(12, 6, 4); set(11, 7, 4); set(12, 7, 4);
    set(11, 8, 4); set(12, 8, 4);
    // Wings
    if (hasWings) {
      fill(2, 4, 5, 8, 2); set(2, 4, 0); set(2, 8, 0);
      fill(10, 4, 13, 8, 2); set(13, 4, 0); set(13, 8, 0);
    }
    // Segment lines
    set(6, 10, 5); set(9, 10, 5); set(6, 12, 5); set(9, 12, 5);
    // Highlight
    set(7, 6, 1); set(8, 6, 1);
  }

  return grid;
}

export function PetAvatar({ tier, species, spriteSeed, size = 80 }: { tier: Tier; species: string; spriteSeed: number; size?: number }) {
  const c = TIER_COLORS[tier];
  const palette = PIXEL_PALETTES[tier] ?? PIXEL_PALETTES.Worthless;
  const sprite = generateCreature(spriteSeed, species);
  const px = Math.floor(size / GRID);

  return (
    <div
      className={`relative rounded-lg border-2 ${c.border} ${c.bg} shrink-0 overflow-hidden`}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    >
      <div className="absolute inset-0" style={{ width: px * GRID, height: px * GRID, left: (size - px * GRID) / 2, top: (size - px * GRID) / 2 }}>
        {pixelGrid(sprite, palette, px)}
      </div>
    </div>
  );
}

const EGG_PALETTES: Record<string, string[]> = {
  worthless: ["#f5f5f4", "#e7e5e4", "#d6d3d1", "#a8a29e", "#78716c", "#57534e"],
  decent: ["#f0fdf4", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#16a34a"],
  average: ["#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b"],
  good: ["#f0f9ff", "#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8", "#0284c7"],
  fabulous: ["#fffbeb", "#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b"],
  excellent: ["#fff1f2", "#ffe4e6", "#fecdd3", "#fda4af", "#fb7185", "#f43f5e"],
};

// Proper egg shape: rounded top, wider middle, flat-ish bottom
const EGG_SPRITE: number[] = [
  0,0,0,0,0,3,3,3,3,3,3,0,0,0,0,0,
  0,0,0,0,3,3,3,3,3,3,3,3,0,0,0,0,
  0,0,0,3,3,3,3,3,3,3,3,3,3,0,0,0,
  0,0,3,3,3,3,3,3,3,3,3,3,3,3,0,0,
  0,0,3,3,3,3,3,3,3,3,3,3,3,3,0,0,
  0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,
  0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,
  0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,
  0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,
  0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,
  0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,
  0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,
  0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,
  0,0,3,3,3,3,3,3,3,3,3,3,3,3,0,0,
  0,0,3,3,3,3,3,3,3,3,3,3,3,3,0,0,
  0,0,0,3,3,3,3,3,3,3,3,3,3,0,0,0,
];

const EGG_HIGHLIGHT: number[] = [
  0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,
  0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,
  0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,
  0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
];

export function EggVisual({ type, size = 120 }: { type: string; size?: number }) {
  const palette = EGG_PALETTES[type] ?? EGG_PALETTES.worthless;
  const px = Math.floor(size / GRID);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size, imageRendering: "pixelated" }}>
      <div
        className="absolute rounded-full blur-xl opacity-30 animate-pulse"
        style={{ width: size * 0.7, height: size * 0.7, background: palette[4] }}
      />
      <div className="relative" style={{ width: px * GRID, height: px * GRID }}>
        {pixelGrid(EGG_SPRITE, palette, px)}
        {pixelGrid(EGG_HIGHLIGHT, palette, px)}
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
