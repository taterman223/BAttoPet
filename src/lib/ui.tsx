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
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

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
   PET SPRITE SYSTEM
   ========================================================= */

const GRID = 24;

const TIER_BASE_COLORS: Record<Tier, string[]> = {
  Worthless: ["#fff7ed", "#fed7aa", "#fb923c", "#f97316", "#c2410c", "#431407"],
  Average: ["#f5f3ff", "#ddd6fe", "#a78bfa", "#8b5cf6", "#6d28d9", "#2e1065"],
  Decent: ["#f0fdf4", "#bbf7d0", "#4ade80", "#22c55e", "#15803d", "#14532d"],
  Good: ["#eff6ff", "#bfdbfe", "#60a5fa", "#3b82f6", "#1d4ed8", "#172554"],
  Fabulous: ["#fffbeb", "#fde68a", "#fbbf24", "#f59e0b", "#d97706", "#78350f"],
  Excellent: ["#fff1f2", "#fecdd3", "#fb7185", "#f43f5e", "#be123c", "#4c0519"],
};

const SECONDARY_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#84cc16",
  "#f43f5e",
];

function rng(seed: number) {
  let s = seed >>> 0;

  return () => {
    s += 0x6d2b79f5;

    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string) {
  let h = 2166136261;

  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return h >>> 0;
}

type BodyType =
  | "dragon"
  | "quadruped"
  | "serpent"
  | "avian"
  | "insect"
  | "blob"
  | "aquatic"
  | "spider"
  | "biped";

const SPECIES_BODY: Record<string, BodyType> = {
  "Flame Drake": "dragon",
  "Shadowwing": "dragon",
  "Storm Serpent": "serpent",
  "Static Eel": "aquatic",
  "Wraith Koi": "aquatic",
  "Aether Moth": "insect",
  "Dune Beetle": "insect",
  "Hex Scorpion": "spider",
  "Glass Mantis": "insect",
  "Shard Crab": "spider",
  "Void Owl": "avian",
  "Cinder Bat": "avian",
  "Ash Raven": "avian",
  "Dusk Falcon": "avian",
  "Plume Heron": "avian",
  "Gale Sparrow": "avian",
  "Spark Finch": "avian",
  "Crystal Fox": "quadruped",
  "Shadow Lynx": "quadruped",
  "Frost Hound": "quadruped",
  "Thorn Boar": "quadruped",
  "Cloud Ram": "quadruped",
  "Rust Hound": "quadruped",
  "Bolt Weasel": "quadruped",
  "Ember Lynx": "quadruped",
  "Frost Stag": "quadruped",
  "Quartz Badger": "quadruped",
  "Smog Rat": "quadruped",
  "Coral Newt": "aquatic",
  "Tide Kraken": "aquatic",
  "Tide Urchin": "aquatic",
  "Magma Toad": "quadruped",
  "Moss Golem": "biped",
  "Ember Sprite": "blob",
  "Glimmer Slime": "blob",
  "Lumen Jelly": "blob",
  "Frost Wisp": "blob",
  "Gloom Fern": "blob",
  "Marsh Imp": "biped",
  "Bramble Stag": "quadruped",
  "Vine Python": "serpent",
};

function getBodyType(species: string, random: () => number): BodyType {
  if (SPECIES_BODY[species]) {
    return SPECIES_BODY[species];
  }

  const types: BodyType[] = [
    "quadruped",
    "dragon",
    "serpent",
    "avian",
    "insect",
    "blob",
    "aquatic",
    "spider",
    "biped",
  ];

  return types[Math.floor(random() * types.length)];
}

function createGrid() {
  return new Array(GRID * GRID).fill(0) as number[];
}

function draw(
  grid: number[],
  x: number,
  y: number,
  value: number
) {
  if (
    x >= 0 &&
    x < GRID &&
    y >= 0 &&
    y < GRID
  ) {
    grid[y * GRID + x] = value;
  }
}

function rect(
  grid: number[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  value: number
) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      draw(grid, x, y, value);
    }
  }
}

function pixelGrid(
  pattern: number[],
  palette: string[],
  px: number
): React.ReactNode {
  const cells: React.ReactNode[] = [];

  for (let i = 0; i < pattern.length; i++) {
    const value = pattern[i];

    if (!value) continue;

    const x = i % GRID;
    const y = Math.floor(i / GRID);

    cells.push(
      <div
        key={i}
        className="absolute"
        style={{
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
   SPECIES SPRITES
   ========================================================= */

function drawDragon(grid: number[], random: () => number) {
  rect(grid, 7, 10, 16, 16, 3);
  rect(grid, 8, 8, 14, 12, 3);

  rect(grid, 11, 5, 14, 10, 3);

  rect(grid, 9, 3, 15, 7, 3);
  rect(grid, 8, 5, 11, 7, 3);

  draw(grid, 10, 2, 4);
  draw(grid, 10, 1, 4);
  draw(grid, 14, 2, 4);
  draw(grid, 14, 1, 4);

  draw(grid, 10, 4, 5);
  draw(grid, 14, 4, 5);

  rect(grid, 3, 7, 7, 13, 2);
  rect(grid, 16, 7, 20, 13, 2);

  draw(grid, 3, 7, 0);
  draw(grid, 20, 7, 0);

  draw(grid, 4, 8, 4);
  draw(grid, 5, 10, 4);
  draw(grid, 6, 12, 4);

  draw(grid, 19, 8, 4);
  draw(grid, 18, 10, 4);
  draw(grid, 17, 12, 4);

  rect(grid, 8, 16, 10, 21, 4);
  rect(grid, 14, 16, 16, 21, 4);

  const tailLength = 3 + Math.floor(random() * 4);

  for (let i = 0; i < tailLength; i++) {
    draw(grid, 17 + i, 14 + i, 3);
    draw(grid, 18 + i, 14 + i, 3);
  }

  rect(grid, 10, 10, 13, 15, 2);
}

function drawQuadruped(grid: number[], random: () => number) {
  rect(grid, 4, 9, 16, 16, 3);
  rect(grid, 5, 7, 15, 17, 3);

  rect(grid, 13, 4, 19, 10, 3);
  rect(grid, 18, 7, 21, 10, 3);

  const ears = Math.floor(random() * 3);

  if (ears === 0) {
    rect(grid, 14, 2, 16, 5, 4);
    rect(grid, 17, 2, 19, 5, 4);
  } else if (ears === 1) {
    draw(grid, 14, 3, 4);
    draw(grid, 15, 2, 4);
    draw(grid, 18, 3, 4);
    draw(grid, 19, 2, 4);
  } else {
    draw(grid, 15, 2, 4);
    draw(grid, 18, 2, 4);
  }

  draw(grid, 15, 6, 5);
  draw(grid, 18, 6, 5);

  rect(grid, 5, 16, 7, 22, 4);
  rect(grid, 9, 16, 11, 22, 4);
  rect(grid, 14, 16, 16, 22, 4);
  rect(grid, 17, 16, 19, 22, 4);

  const tail = Math.floor(random() * 3);

  if (tail === 0) {
    rect(grid, 2, 11, 5, 13, 3);
    draw(grid, 1, 10, 4);
  } else if (tail === 1) {
    draw(grid, 3, 12, 3);
    draw(grid, 2, 11, 3);
    draw(grid, 1, 10, 3);
  } else {
    rect(grid, 2, 13, 5, 15, 3);
  }

  rect(grid, 13, 10, 15, 14, 2);

  // Extra individual markings
  for (let i = 0; i < 5; i++) {
    draw(
      grid,
      9 + Math.floor(random() * 6),
      10 + Math.floor(random() * 5),
      2
    );
  }
}

function drawSerpent(grid: number[], random: () => number) {
  const points = [
    [17, 4],
    [16, 6],
    [14, 8],
    [12, 10],
    [10, 12],
    [8, 14],
    [6, 16],
    [5, 18],
  ];

  for (const [x, y] of points) {
    rect(grid, x - 1, y - 1, x + 1, y + 1, 3);
  }

  rect(grid, 15, 2, 20, 6, 3);

  draw(grid, 16, 3, 5);
  draw(grid, 19, 3, 5);

  draw(grid, 21, 5, 4);
  draw(grid, 22, 5, 4);

  for (let i = 0; i < 4; i++) {
    const x = 8 + i * 2;
    const y = 14 - i * 2;
    draw(grid, x, y, random() > 0.5 ? 2 : 4);
  }

  draw(grid, 4, 19, 4);
  draw(grid, 3, 20, 4);
  draw(grid, 2, 20, 4);
}

function drawAquatic(grid: number[], random: () => number) {
  rect(grid, 5, 8, 18, 15, 3);
  rect(grid, 7, 6, 16, 17, 3);

  rect(grid, 15, 7, 20, 14, 3);

  draw(grid, 18, 9, 5);
  draw(grid, 20, 12, 4);

  draw(grid, 3, 9, 4);
  draw(grid, 2, 8, 4);
  draw(grid, 2, 10, 4);
  draw(grid, 1, 7, 4);
  draw(grid, 1, 11, 4);

  rect(grid, 9, 5, 13, 7, 2);
  rect(grid, 10, 15, 14, 18, 2);

  for (let i = 0; i < 5; i++) {
    const x = 6 + Math.floor(random() * 10);
    const y = 10 + Math.floor(random() * 5);

    draw(grid, x, y, 2);
  }
}

function drawAvian(grid: number[], random: () => number) {
  rect(grid, 8, 8, 15, 17, 3);
  rect(grid, 9, 6, 14, 18, 3);

  rect(grid, 10, 3, 15, 8, 3);

  draw(grid, 16, 5, 4);
  draw(grid, 17, 6, 4);

  draw(grid, 11, 5, 5);
  draw(grid, 14, 5, 5);

  rect(grid, 3, 8, 8, 15, 2);
  draw(grid, 2, 9, 2);
  draw(grid, 1, 10, 2);
  draw(grid, 2, 13, 4);

  rect(grid, 15, 8, 20, 15, 2);
  draw(grid, 21, 9, 2);
  draw(grid, 22, 10, 2);
  draw(grid, 21, 13, 4);

  draw(grid, 8, 15, 4);
  draw(grid, 7, 17, 4);
  draw(grid, 6, 19, 4);

  rect(grid, 9, 17, 10, 21, 4);
  rect(grid, 13, 17, 14, 21, 4);

  for (let i = 0; i < 4; i++) {
    draw(
      grid,
      9 + Math.floor(random() * 6),
      10 + Math.floor(random() * 6),
      2
    );
  }
}

function drawInsect(grid: number[], random: () => number) {
  rect(grid, 9, 4, 14, 8, 3);

  draw(grid, 10, 5, 5);
  draw(grid, 13, 5, 5);

  rect(grid, 8, 7, 15, 12, 3);

  rect(grid, 8, 11, 15, 18, 4);
  rect(grid, 9, 18, 14, 20, 4);

  draw(grid, 9, 3, 4);
  draw(grid, 8, 2, 4);
  draw(grid, 14, 3, 4);
  draw(grid, 15, 2, 4);

  rect(grid, 3, 7, 8, 14, 2);
  rect(grid, 15, 7, 20, 14, 2);

  draw(grid, 2, 8, 2);
  draw(grid, 1, 9, 2);
  draw(grid, 2, 13, 4);

  draw(grid, 21, 8, 2);
  draw(grid, 22, 9, 2);
  draw(grid, 21, 13, 4);

  for (let y = 9; y <= 15; y += 2) {
    draw(grid, 6, y, 4);
    draw(grid, 5, y + 1, 4);
    draw(grid, 17, y, 4);
    draw(grid, 18, y + 1, 4);
  }

  for (let y = 13; y <= 18; y += 2) {
    draw(grid, 8, y, 5);
    draw(grid, 15, y, 5);
  }

  for (let i = 0; i < 5; i++) {
    draw(
      grid,
      3 + Math.floor(random() * 5),
      8 + Math.floor(random() * 5),
      1
    );
  }
}

function drawSpider(grid: number[], random: () => number) {
  rect(grid, 8, 8, 15, 16, 3);
  rect(grid, 9, 6, 14, 10, 4);

  draw(grid, 10, 8, 5);
  draw(grid, 13, 8, 5);
  draw(grid, 11, 7, 5);
  draw(grid, 12, 7, 5);

  const legs = [
    [-1, -1],
    [-2, 0],
    [-3, 2],
    [-2, 4],
    [1, -1],
    [2, 0],
    [3, 2],
    [2, 4],
  ];

  for (const [dx, dy] of legs) {
    draw(grid, 8 + dx * 2, 10 + dy * 2, 4);
    draw(grid, 8 + dx * 3, 11 + dy * 2, 4);

    draw(grid, 15 + dx * 2, 10 + dy * 2, 4);
    draw(grid, 15 + dx * 3, 11 + dy * 2, 4);
  }

  for (let i = 0; i < 5; i++) {
    draw(
      grid,
      10 + Math.floor(random() * 4),
      11 + Math.floor(random() * 4),
      2
    );
  }
}

function drawBlob(grid: number[], random: () => number) {
  const wobble = Math.floor(random() * 3);

  for (let y = 5; y <= 18; y++) {
    for (let x = 4; x <= 19; x++) {
      const dx = x - 11;
      const dy = y - 12;

      const distance =
        (dx * dx) / 55 +
        (dy * dy) / (60 + wobble * 10);

      if (distance < 1) {
        draw(grid, x, y, 3);
      }
    }
  }

  draw(grid, 8, 10, 5);
  draw(grid, 14, 10, 5);

  draw(grid, 7, 7, 1);
  draw(grid, 8, 7, 1);
  draw(grid, 7, 8, 1);

  draw(grid, 6, 18, 4);
  draw(grid, 6, 19, 4);
  draw(grid, 11, 18, 4);
  draw(grid, 15, 18, 4);
  draw(grid, 15, 19, 4);

  for (let i = 0; i < 5; i++) {
    draw(
      grid,
      7 + Math.floor(random() * 8),
      12 + Math.floor(random() * 5),
      2
    );
  }
}

function drawBiped(grid: number[], random: () => number) {
  rect(grid, 8, 9, 15, 17, 3);

  rect(grid, 8, 3, 15, 9, 3);

  draw(grid, 10, 6, 5);
  draw(grid, 13, 6, 5);

  if (random() > 0.5) {
    draw(grid, 8, 3, 4);
    draw(grid, 7, 2, 4);
    draw(grid, 15, 3, 4);
    draw(grid, 16, 2, 4);
  }

  rect(grid, 5, 10, 8, 14, 4);
  rect(grid, 15, 10, 18, 14, 4);

  rect(grid, 9, 17, 11, 22, 4);
  rect(grid, 13, 17, 15, 22, 4);

  for (let i = 0; i < 5; i++) {
    draw(
      grid,
      9 + Math.floor(random() * 6),
      11 + Math.floor(random() * 5),
      2
    );
  }
}

/* =========================================================
   MAIN GENERATOR
   ========================================================= */

function generateCreature(
  seed: number,
  species: string,
  tier: Tier
) {
  const combinedSeed =
    (seed ^ hashString(species)) >>> 0;

  const random = rng(combinedSeed);

  const body = getBodyType(species, random);
  const grid = createGrid();

  switch (body) {
    case "dragon":
      drawDragon(grid, random);
      break;

    case "quadruped":
      drawQuadruped(grid, random);
      break;

    case "serpent":
      drawSerpent(grid, random);
      break;

    case "aquatic":
      drawAquatic(grid, random);
      break;

    case "avian":
      drawAvian(grid, random);
      break;

    case "insect":
      drawInsect(grid, random);
      break;

    case "spider":
      drawSpider(grid, random);
      break;

    case "blob":
      drawBlob(grid, random);
      break;

    case "biped":
      drawBiped(grid, random);
      break;
  }

  const tierColors = TIER_BASE_COLORS[tier];

  const accent =
    SECONDARY_COLORS[
      Math.floor(random() * SECONDARY_COLORS.length)
    ];

  /*
   * IMPORTANT:
   * Return BOTH the sprite grid AND palette.
   * The old code only returned the palette,
   * which caused PetAvatar to have no actual sprite pattern.
   */
  const palette = [
    "transparent",
    tierColors[1],
    accent,
    tierColors[3],
    tierColors[4],
    "#111827",
  ];

  return {
    grid,
    palette,
  };
}

/* =========================================================
   PET AVATAR
   ========================================================= */

export function PetAvatar({
  tier,
  species,
  spriteSeed,
  size = 100,
}: {
  tier: Tier;
  species: string;
  spriteSeed: number;
  size?: number;
}) {
  const colors = TIER_COLORS[tier];

  const safeSeed =
    Number.isFinite(spriteSeed)
      ? spriteSeed
      : hashString(species);

  const sprite = generateCreature(
    safeSeed,
    species,
    tier
  );

  /*
   * Keep the sprite comfortably inside the box.
   */
  const px = Math.max(
    1,
    Math.floor((size * 0.72) / GRID)
  );

  const spriteSize = px * GRID;

  return (
    <div
      className={`relative rounded-xl border-2 ${colors.border} ${colors.bg} shrink-0 overflow-hidden`}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
      }}
    >
      {/* Glow */}
      <div
        className="absolute rounded-full blur-xl opacity-20"
        style={{
          width: size * 0.65,
          height: size * 0.65,
          left: size * 0.175,
          top: size * 0.175,
          background: sprite.palette[2],
        }}
      />

      {/* ACTUAL SPRITE */}
      <div
        className="absolute"
        style={{
          width: spriteSize,
          height: spriteSize,
          left: (size - spriteSize) / 2,
          top: (size - spriteSize) / 2,
        }}
      >
        {pixelGrid(
          sprite.grid,
          sprite.palette,
          px
        )}
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
    EGG_PALETTES[type.toLowerCase()] ??
    EGG_PALETTES.worthless;

  const px = Math.floor(size / 16);

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
          width: px * 16,
          height: px * 16,
        }}
      >
        {pixelGridEgg(EGG_SPRITE, palette, px)}
        {pixelGridEgg(EGG_HIGHLIGHT, palette, px)}
      </div>
    </div>
  );
}

function pixelGridEgg(
  pattern: number[],
  palette: string[],
  px: number
): React.ReactNode {
  return pattern.map((value, i) => {
    if (!value) return null;

    const x = i % 16;
    const y = Math.floor(i / 16);

    return (
      <div
        key={i}
        className="absolute"
        style={{
          left: x * px,
          top: y * px,
          width: px,
          height: px,
          background: palette[value] ?? palette[1],
        }}
      />
    );
  });
}

/* =========================================================
   OTHER UI
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
          style={{
            width: `${pct}%`,
          }}
        />
      </div>
    </div>
  );
}
