import type { Tier } from "./supabase";
import { TIER_COLORS } from "./supabase";

export function TierBadge({
  tier,
  size = "md",
}: {
  tier: Tier;
  size?: "sm" | "md";
}) {
  const c = TIER_COLORS[tier];
  const pad =
    size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full border ${c.border} ${c.bg} ${c.text} ${pad} font-semibold uppercase tracking-wider`}
    >
      {c.label}
    </span>
  );
}

export function StatBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min(100, (value / max) * 100);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-500 w-16 shrink-0">
        {label}
      </span>

      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <span className="text-[11px] text-slate-600 font-mono w-8 text-right">
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   PET PALETTES
   ========================================================= */

const PIXEL_PALETTES: Record<string, string[]> = {
  Worthless: [
    "#fff7ed",
    "#fed7aa",
    "#fb923c",
    "#f97316",
    "#c2410c",
    "#431407",
  ],

  Average: [
    "#eef2ff",
    "#c7d2fe",
    "#818cf8",
    "#6366f1",
    "#4338ca",
    "#312e81",
  ],

  Decent: [
    "#f0fdf4",
    "#bbf7d0",
    "#4ade80",
    "#16a34a",
    "#15803d",
    "#14532d",
  ],

  Good: [
    "#f0f9ff",
    "#bae6fd",
    "#38bdf8",
    "#0284c7",
    "#0369a1",
    "#0c4a6e",
  ],

  Fabulous: [
    "#fffbeb",
    "#fde68a",
    "#fbbf24",
    "#f59e0b",
    "#d97706",
    "#78350f",
  ],

  Excellent: [
    "#fff1f2",
    "#fecdd3",
    "#fb7185",
    "#e11d48",
    "#be123c",
    "#881337",
  ],
};

const GRID = 16;

/* =========================================================
   SEEDED RANDOM
   ========================================================= */

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

/* =========================================================
   SPECIES TYPES
   ========================================================= */

type AnimalType =
  | "dragon"
  | "fox"
  | "lynx"
  | "snake"
  | "golem"
  | "moth"
  | "hound"
  | "sprite"
  | "kraken"
  | "beetle"
  | "owl"
  | "slime"
  | "boar"
  | "eel"
  | "ram"
  | "bat"
  | "newt"
  | "stag"
  | "raven"
  | "jelly"
  | "wisp"
  | "toad"
  | "scorpion"
  | "python"
  | "falcon"
  | "mantis"
  | "rat"
  | "heron"
  | "crab"
  | "koi"
  | "weasel"
  | "sparrow"
  | "imp";

const SPECIES_TYPE: Record<string, AnimalType> = {
  "Flame Drake": "dragon",
  "Crystal Fox": "fox",
  "Shadow Lynx": "lynx",
  "Storm Serpent": "snake",
  "Moss Golem": "golem",
  "Aether Moth": "moth",
  "Frost Hound": "hound",
  "Ember Sprite": "sprite",
  "Tide Kraken": "kraken",
  "Dune Beetle": "beetle",
  "Void Owl": "owl",
  "Glimmer Slime": "slime",
  "Thorn Boar": "boar",
  "Static Eel": "eel",
  "Cloud Ram": "ram",
  "Cinder Bat": "bat",
  "Coral Newt": "newt",
  "Bramble Stag": "stag",
  "Ash Raven": "raven",
  "Lumen Jelly": "jelly",
  "Frost Wisp": "wisp",
  "Magma Toad": "toad",
  "Hex Scorpion": "scorpion",
  "Vine Python": "python",
  "Dusk Falcon": "falcon",
  "Glass Mantis": "mantis",
  "Rust Hound": "hound",
  "Plume Heron": "heron",
  "Shard Crab": "crab",
  "Wraith Koi": "koi",
  "Bolt Weasel": "weasel",
  "Gale Sparrow": "sparrow",
  "Marsh Imp": "imp",
};

function getAnimalType(
  species: string,
  rng: () => number
): AnimalType {
  if (SPECIES_TYPE[species]) {
    return SPECIES_TYPE[species];
  }

  const types: AnimalType[] = [
    "fox",
    "dragon",
    "snake",
    "bird",
    "beetle",
    "slime",
  ] as AnimalType[];

  return types[Math.floor(rng() * types.length)];
}

/* =========================================================
   PIXEL RENDERING
   ========================================================= */

function pixelGrid(
  pattern: number[],
  palette: string[],
  px: number
): React.ReactNode {
  const cells: React.ReactNode[] = [];

  for (let i = 0; i < pattern.length; i++) {
    const value = pattern[i];

    if (value === 0) continue;

    const x = i % GRID;
    const y = Math.floor(i / GRID);

    cells.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x * px,
          top: y * px,
          width: px,
          height: px,
          background: palette[value] ?? palette[1],
        }}
      />
    );
  }

  return cells;
}

/* =========================================================
   CREATURE GENERATOR
   ========================================================= */

function generateCreature(
  seed: number,
  species: string
): number[] {
  const rng = makeRng(seed);

  const type = getAnimalType(species, rng);

  const grid = new Array(GRID * GRID).fill(0);

  const set = (x: number, y: number, value: number) => {
    if (
      x >= 0 &&
      x < GRID &&
      y >= 0 &&
      y < GRID
    ) {
      grid[y * GRID + x] = value;
    }
  };

  const fill = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    value: number
  ) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        set(x, y, value);
      }
    }
  };

  const eyeStyle = Math.floor(rng() * 3);
  const pattern = Math.floor(rng() * 5);
  const variation = Math.floor(rng() * 4);

  const eyes = (
    x1: number,
    x2: number,
    y: number
  ) => {
    if (eyeStyle === 0) {
      set(x1, y, 5);
      set(x2, y, 5);
    } else if (eyeStyle === 1) {
      set(x1, y, 5);
      set(x1, y + 1, 5);
      set(x2, y, 5);
      set(x2, y + 1, 5);
    } else {
      set(x1, y, 5);
      set(x2, y, 5);
      set(x1 - 1, y - 1, 4);
      set(x2 + 1, y - 1, 4);
    }
  };

  /* =======================================================
     DRAGON
     ======================================================= */

  if (type === "dragon") {
    fill(4, 7, 11, 12, 3);

    // Head
    fill(8, 3, 13, 7, 3);

    // Snout
    fill(12, 5, 14, 7, 4);

    // Horns
    set(9, 2, 4);
    set(9, 1, 4);
    set(12, 2, 4);
    set(13, 1, 4);

    eyes(10, 12, 4);

    // Wings
    fill(2, 4, 4, 9, 2);
    set(1, 5, 4);
    set(1, 6, 4);
    set(1, 7, 4);

    // Wing spikes
    set(2, 3, 4);
    set(1, 4, 4);

    // Legs
    fill(5, 12, 6, 15, 4);
    fill(9, 12, 10, 15, 4);

    // Tail
    set(3, 10, 3);
    set(2, 11, 3);
    set(1, 12, 3);
    set(0, 13, 4);

    // Fire
    if (variation === 0) {
      set(14, 6, 1);
      set(15, 6, 4);
      set(15, 5, 2);
      set(15, 7, 2);
    }

    if (pattern === 1) {
      set(5, 9, 4);
      set(7, 10, 4);
      set(9, 9, 4);
    }

    return grid;
  }

  /* =======================================================
     FOX / LYNX / HOUND / BOAR / WEASEL / RAT
     ======================================================= */

  if (
    type === "fox" ||
    type === "lynx" ||
    type === "hound" ||
    type === "boar" ||
    type === "weasel" ||
    type === "rat"
  ) {
    const narrow = type === "weasel" || type === "rat";

    // Body
    fill(
      narrow ? 4 : 3,
      7,
      narrow ? 11 : 12,
      12,
      3
    );

    // Head
    fill(8, 4, 13, 8, 3);

    // Ears
    if (type === "fox" || type === "lynx") {
      set(8, 3, 4);
      set(8, 2, 4);
      set(13, 3, 4);
      set(13, 2, 4);

      if (type === "lynx") {
        set(8, 1, 4);
        set(13, 1, 4);
      }
    } else {
      fill(9, 3, 10, 4, 4);
      fill(12, 3, 13, 4, 4);
    }

    // Snout
    fill(12, 6, 14, 8, 4);

    eyes(10, 12, 5);

    // Nose
    set(14, 7, 5);

    // Legs
    fill(4, 12, 5, 15, 4);
    fill(7, 12, 8, 15, 4);
    fill(10, 12, 11, 15, 4);

    // Tail
    if (type === "fox" || type === "lynx") {
      set(2, 8, 3);
      set(1, 7, 3);
      set(1, 6, 4);
      set(0, 6, 3);
    } else if (type === "rat") {
      set(3, 10, 4);
      set(2, 11, 4);
      set(1, 12, 4);
      set(0, 13, 4);
    } else {
      set(2, 10, 3);
      set(1, 9, 3);
      set(0, 8, 4);
    }

    // Spots
    if (pattern === 1) {
      set(5, 8, 2);
      set(7, 10, 2);
      set(10, 9, 2);
    }

    if (pattern === 2) {
      set(5, 8, 4);
      set(9, 10, 4);
    }

    // Chest
    if (pattern === 3) {
      fill(9, 9, 11, 11, 2);
    }

    return grid;
  }

  /* =======================================================
     SNAKE / PYTHON / EEL / KOI
     ======================================================= */

  if (
    type === "snake" ||
    type === "python" ||
    type === "eel" ||
    type === "koi"
  ) {
    // Head
    fill(9, 3, 13, 6, 3);

    set(9, 3, 0);
    set(13, 3, 0);

    eyes(10, 12, 4);

    // Long winding body
    const path = [
      [11, 6],
      [10, 7],
      [9, 8],
      [8, 9],
      [7, 10],
      [6, 11],
      [5, 12],
      [4, 13],
      [3, 14],
    ];

    for (const [x, y] of path) {
      set(x, y, 3);
      set(x + 1, y, 3);
      set(x, y + 1, 4);
    }

    // Tongue
    if (type === "snake" || type === "python") {
      set(14, 5, 4);
      set(15, 4, 4);
      set(15, 6, 4);
    }

    // Eel fin
    if (type === "eel") {
      fill(6, 9, 7, 11, 2);
      set(5, 8, 2);
    }

    // Koi fins
    if (type === "koi") {
      fill(8, 7, 9, 9, 2);
      fill(5, 11, 6, 13, 2);
    }

    // Pattern
    if (pattern === 1) {
      set(9, 8, 4);
      set(7, 10, 4);
      set(5, 12, 4);
    }

    if (pattern === 2) {
      set(10, 7, 2);
      set(8, 9, 2);
      set(6, 11, 2);
    }

    return grid;
  }

  /* =======================================================
     BIRD TYPES
     ======================================================= */

  if (
    type === "owl" ||
    type === "raven" ||
    type === "falcon" ||
    type === "heron" ||
    type === "sparrow" ||
    type === "bat"
  ) {
    const birdY = type === "heron" ? 4 : 5;

    // Body
    fill(5, birdY + 2, 10, 11, 3);

    // Head
    fill(6, 2, 10, 6, 3);

    // Beak
    if (type === "owl") {
      set(8, 6, 4);
      set(9, 6, 4);
    } else {
      set(10, 5, 4);
      set(11, 5, 4);
      set(11, 6, 4);
    }

    eyes(7, 9, 4);

    // Wings
    if (type === "bat") {
      fill(1, 5, 4, 9, 2);
      fill(11, 5, 14, 9, 2);

      set(0, 6, 4);
      set(0, 8, 4);
      set(15, 6, 4);
      set(15, 8, 4);
    } else {
      fill(1, 6, 4, 10, 2);
      fill(11, 6, 14, 10, 2);

      set(1, 5, 4);
      set(14, 5, 4);
    }

    // Legs
    fill(6, 12, 6, 14, 4);
    fill(9, 12, 9, 14, 4);

    // Tail
    set(6, 11, 3);
    set(7, 12, 3);
    set(8, 13, 3);

    // Owl face
    if (type === "owl") {
      set(6, 3, 2);
      set(7, 3, 2);
      set(9, 3, 2);
      set(10, 3, 2);
    }

    // Bird markings
    if (pattern === 1) {
      fill(6, 8, 9, 10, 2);
    }

    return grid;
  }

  /* =======================================================
     INSECTS
     ======================================================= */

  if (
    type === "moth" ||
    type === "beetle" ||
    type === "mantis" ||
    type === "scorpion"
  ) {
    // Head
    fill(7, 3, 9, 6, 3);

    // Body
    fill(6, 6, 10, 12, 3);

    eyes(7, 9, 4);

    // Antennae
    set(6, 2, 4);
    set(6, 1, 4);
    set(9, 2, 4);
    set(9, 1, 4);

    // Wings
    if (type === "moth") {
      fill(2, 4, 5, 9, 2);
      fill(10, 4, 13, 9, 2);

      set(1, 5, 4);
      set(14, 5, 4);
    }

    if (type === "beetle") {
      fill(5, 8, 11, 13, 4);
      set(8, 8, 2);
    }

    if (type === "mantis") {
      // long arms
      set(5, 6, 4);
      set(4, 7, 4);
      set(3, 8, 4);
      set(10, 6, 4);
      set(11, 7, 4);
      set(12, 8, 4);
    }

    if (type === "scorpion") {
      // pincers
      set(4, 7, 4);
      set(3, 6, 4);
      set(11, 7, 4);
      set(12, 6, 4);

      // curved tail
      set(11, 10, 4);
      set(12, 9, 4);
      set(13, 8, 4);
      set(14, 7, 4);
      set(14, 6, 4);
    }

    // Legs
    for (let y = 7; y <= 10; y++) {
      set(4, y, 4);
      set(3, y, 4);
      set(11, y, 4);
      set(12, y, 4);
    }

    // Patterns
    if (pattern === 1) {
      set(7, 8, 2);
      set(9, 8, 2);
      set(7, 10, 2);
      set(9, 10, 2);
    }

    return grid;
  }

  /* =======================================================
     SLIME / JELLY / SPRITE / WISP
     ======================================================= */

  if (
    type === "slime" ||
    type === "jelly" ||
    type === "sprite" ||
    type === "wisp"
  ) {
    const top = type === "wisp" ? 5 : 6;
    const bottom = type === "jelly" ? 13 : 12;

    for (let y = top; y <= bottom; y++) {
      const width =
        y === top
          ? 3
          : y === top + 1
            ? 5
            : 6;

      for (let x = 8 - width / 2; x <= 8 + width / 2; x++) {
        set(Math.floor(x), y, 3);
      }
    }

    // Face
    eyes(6, 10, 8);

    // Highlights
    set(6, 7, 1);
    set(7, 6, 1);

    // Wisp tail
    if (type === "wisp") {
      set(6, 11, 2);
      set(7, 12, 2);
      set(8, 13, 2);
      set(9, 12, 2);
      set(10, 13, 2);
    }

    // Sprite wings
    if (type === "sprite") {
      fill(2, 7, 4, 10, 2);
      fill(12, 7, 14, 10, 2);
    }

    // Jelly tentacles
    if (type === "jelly") {
      set(4, 12, 4);
      set(5, 13, 4);
      set(7, 13, 4);
      set(9, 13, 4);
      set(11, 13, 4);
    }

    return grid;
  }

  /* =======================================================
     RAM / STAG / GOLEM
     ======================================================= */

  if (
    type === "ram" ||
    type === "stag" ||
    type === "golem"
  ) {
    // Body
    fill(4, 7, 11, 12, 3);

    // Head
    fill(8, 3, 13, 8, 3);

    eyes(10, 12, 5);

    // Ears
    set(9, 3, 4);
    set(13, 3, 4);

    // Horns
    if (type === "ram") {
      set(8, 4, 4);
      set(7, 4, 4);
      set(7, 3, 4);

      set(13, 4, 4);
      set(14, 4, 4);
      set(14, 3, 4);
    }

    // Stag antlers
    if (type === "stag") {
      set(9, 2, 4);
      set(8, 1, 4);
      set(7, 1, 4);
      set(10, 2, 4);

      set(12, 2, 4);
      set(13, 1, 4);
      set(14, 1, 4);
    }

    // Golem arms
    if (type === "golem") {
      fill(1, 8, 3, 11, 4);
      fill(12, 8, 14, 11, 4);

      set(2, 7, 2);
      set(13, 7, 2);
    }

    // Legs
    fill(5, 12, 6, 15, 4);
    fill(9, 12, 10, 15, 4);

    // Tail
    if (type === "ram" || type === "stag") {
      set(3, 9, 3);
      set(2, 8, 3);
      set(1, 9, 4);
    }

    // Stone cracks
    if (type === "golem") {
      set(5, 8, 4);
      set(8, 9, 4);
      set(10, 7, 4);
      set(7, 11, 2);
    }

    return grid;
  }

  /* =======================================================
     CRAB / KRAKEN / NEWT / TOAD
     ======================================================= */

  if (
    type === "crab" ||
    type === "kraken" ||
    type === "newt" ||
    type === "toad"
  ) {
    // Main body
    fill(4, 7, 11, 11, 3);

    // Head
    fill(6, 4, 10, 8, 3);

    eyes(6, 9, 5);

    if (type === "crab") {
      // claws
      fill(1, 7, 3, 9, 4);
      fill(12, 7, 14, 9, 4);

      // legs
      set(3, 10, 4);
      set(2, 11, 4);
      set(3, 12, 4);

      set(12, 10, 4);
      set(13, 11, 4);
      set(12, 12, 4);
    }

    if (type === "kraken") {
      // tentacles
      set(4, 11, 4);
      set(3, 12, 4);
      set(2, 13, 4);
      set(1, 14, 4);

      set(6, 11, 4);
      set(6, 12, 4);
      set(5, 13, 4);

      set(9, 11, 4);
      set(9, 12, 4);
      set(10, 13, 4);

      set(11, 11, 4);
      set(12, 12, 4);
      set(13, 13, 4);
    }

    if (type === "newt" || type === "toad") {
      // legs
      fill(3, 10, 5, 12, 4);
      fill(10, 10, 12, 12, 4);

      // tail
      set(2, 9, 3);
      set(1, 10, 3);
    }

    return grid;
  }

  /* =======================================================
     IMP
     ======================================================= */

  if (type === "imp") {
    // body
    fill(5, 7, 10, 12, 3);

    // head
    fill(5, 3, 10, 7, 3);

    // horns
    set(5, 2, 4);
    set(5, 1, 4);
    set(10, 2, 4);
    set(10, 1, 4);

    eyes(6, 9, 4);

    // arms
    set(4, 8, 4);
    set(3, 9, 4);
    set(11, 8, 4);
    set(12, 9, 4);

    // legs
    fill(5, 12, 6, 15, 4);
    fill(9, 12, 10, 15, 4);

    // devil tail
    set(11, 11, 3);
    set(12, 12, 3);
    set(13, 11, 4);
    set(14, 10, 4);

    return grid;
  }

  return grid;
}

/* =========================================================
   PET AVATAR
   ========================================================= */

export function PetAvatar({
  tier,
  species,
  spriteSeed,
  size = 80,
}: {
  tier: Tier;
  species: string;
  spriteSeed: number;
  size?: number;
}) {
  const c = TIER_COLORS[tier];

  const palette =
    PIXEL_PALETTES[tier] ??
    PIXEL_PALETTES.Worthless;

  const sprite = generateCreature(
    spriteSeed,
    species
  );

  const px = Math.floor(size / GRID);

  return (
    <div
      className={`relative rounded-lg border-2 ${c.border} ${c.bg} shrink-0 overflow-hidden`}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
      }}
    >
      <div
        className="absolute"
        style={{
          width: px * GRID,
          height: px * GRID,
          left: (size - px * GRID) / 2,
          top: (size - px * GRID) / 2,
        }}
      >
        {pixelGrid(sprite, palette, px)}
      </div>
    </div>
  );
}

/* =========================================================
   EGGS
   ========================================================= */

const EGG_PALETTES: Record<string, string[]> = {
  worthless: [
    "#fff7ed",
    "#ffedd5",
    "#fed7aa",
    "#fdba74",
    "#fb923c",
    "#ea580c",
  ],

  decent: [
    "#f0fdf4",
    "#dcfce7",
    "#bbf7d0",
    "#86efac",
    "#4ade80",
    "#16a34a",
  ],

  average: [
    "#eef2ff",
    "#e0e7ff",
    "#c7d2fe",
    "#a5b4fc",
    "#818cf8",
    "#6366f1",
  ],

  good: [
    "#f0f9ff",
    "#e0f2fe",
    "#bae6fd",
    "#7dd3fc",
    "#38bdf8",
    "#0284c7",
  ],

  fabulous: [
    "#fffbeb",
    "#fef3c7",
    "#fde68a",
    "#fcd34d",
    "#fbbf24",
    "#f59e0b",
  ],

  excellent: [
    "#fff1f2",
    "#ffe4e6",
    "#fecdd3",
    "#fda4af",
    "#fb7185",
    "#f43f5e",
  ],
};

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

export function EggVisual({
  type,
  size = 120,
}: {
  type: string;
  size?: number;
}) {
  const palette =
    EGG_PALETTES[type] ??
    EGG_PALETTES.worthless;

  const px = Math.floor(size / GRID);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
      }}
    >
      <div
        className="absolute rounded-full blur-xl opacity-30 animate-pulse"
        style={{
          width: size * 0.7,
          height: size * 0.7,
          background: palette[4],
        }}
      />

      <div
        className="relative"
        style={{
          width: px * GRID,
          height: px * GRID,
        }}
      >
        {pixelGrid(EGG_SPRITE, palette, px)}
        {pixelGrid(EGG_HIGHLIGHT, palette, px)}
      </div>
    </div>
  );
}

/* =========================================================
   UI
   ========================================================= */

export function Spinner({
  size = 20,
}: {
  size?: number;
}) {
  return (
    <div
      className="border-2 border-slate-300 border-t-sky-500 rounded-full animate-spin"
      style={{
        width: size,
        height: size,
      }}
    />
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-slate-300 mb-3">
        {icon}
      </div>

      <p className="text-slate-600 font-medium">
        {title}
      </p>

      <p className="text-slate-400 text-sm mt-1">
        {subtitle}
      </p>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800">
              {title}
            </h2>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            >
              &times;
            </button>
          </div>
        )}

        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export function HpBar({
  current,
  max,
}: {
  current: number;
  max: number;
}) {
  const pct = Math.max(
    0,
    Math.min(100, (current / max) * 100)
  );

  const color =
    pct > 50
      ? "bg-emerald-500"
      : pct > 25
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <div className="w-full">
      <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
        <span>HP</span>

        <span className="font-mono text-slate-600">
          {current} / {max}
        </span>
      </div>

      <div className="h-3 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
