import type { Tier } from "./supabase";
import { TIER_COLORS } from "./supabase";

/* =========================================================
   TIER BADGE
   ========================================================= */

export function TierBadge({
  tier,
  size = "md",
}: {
  tier: Tier;
  size?: "sm" | "md";
}) {
  const c = TIER_COLORS[tier];

  const pad =
    size === "sm"
      ? "px-2 py-0.5 text-[10px]"
      : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full border ${c.border} ${c.bg} ${c.text} ${pad} font-semibold uppercase tracking-wider`}
    >
      {c.label}
    </span>
  );
}

/* =========================================================
   STAT BAR
   ========================================================= */

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
  const pct = Math.min(
    100,
    Math.max(0, (value / max) * 100)
  );

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
   PIXEL SPRITE SYSTEM
   ========================================================= */

const GRID = 24;

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

/*
 * Species -> body.
 *
 * This is intentionally based on species instead of rarity.
 * Rarity should change special details, not completely change
 * what the animal is.
 */
const SPECIES_BODY: Record<string, BodyType> = {
  "Flame Drake": "dragon",
  "Shadowwing": "dragon",
  "Storm Serpent": "serpent",

  "Static Eel": "aquatic",
  "Wraith Koi": "aquatic",
  "Coral Newt": "aquatic",
  "Tide Kraken": "aquatic",
  "Tide Urchin": "aquatic",

  "Aether Moth": "insect",
  "Dune Beetle": "insect",
  "Glass Mantis": "insect",

  "Hex Scorpion": "spider",
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
  "Magma Toad": "quadruped",
  "Bramble Stag": "quadruped",

  "Vine Python": "serpent",

  "Ember Sprite": "blob",
  "Glimmer Slime": "blob",
  "Lumen Jelly": "blob",
  "Frost Wisp": "blob",
  "Gloom Fern": "blob",

  "Moss Golem": "biped",
  "Marsh Imp": "biped",
};

const BODY_TYPES: BodyType[] = [
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

/* =========================================================
   RANDOM
   ========================================================= */

function rng(seed: number) {
  let s = seed >>> 0;

  return () => {
    s += 0x6d2b79f5;

    let t = s;

    t = Math.imul(
      t ^ (t >>> 15),
      t | 1
    );

    t ^= t + Math.imul(
      t ^ (t >>> 7),
      t | 61
    );

    return (
      (t ^ (t >>> 14)) >>> 0
    ) / 4294967296;
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

/* =========================================================
   GRID HELPERS
   ========================================================= */

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
          background:
            palette[value] ?? palette[1],
        }}
      />
    );
  }

  return cells;
}

/* =========================================================
   COLOR SYSTEM
   ========================================================= */

/*
 * These palettes are species-friendly instead of simply
 * using the tier color as the entire creature.
 */

const SPECIES_PALETTES: Record<
  string,
  {
    main: string;
    light: string;
    dark: string;
    accent: string;
  }
> = {
  "Flame Drake": {
    main: "#e25822",
    light: "#ffb347",
    dark: "#7f1d1d",
    accent: "#ffd166",
  },

  "Shadowwing": {
    main: "#475569",
    light: "#94a3b8",
    dark: "#171717",
    accent: "#a78bfa",
  },

  "Storm Serpent": {
    main: "#2563eb",
    light: "#93c5fd",
    dark: "#172554",
    accent: "#67e8f9",
  },

  "Static Eel": {
    main: "#0ea5a4",
    light: "#5eead4",
    dark: "#134e4a",
    accent: "#facc15",
  },

  "Wraith Koi": {
    main: "#64748b",
    light: "#e2e8f0",
    dark: "#1e293b",
    accent: "#c084fc",
  },

  "Aether Moth": {
    main: "#8b5cf6",
    light: "#c4b5fd",
    dark: "#4c1d95",
    accent: "#67e8f9",
  },

  "Dune Beetle": {
    main: "#a16207",
    light: "#fde68a",
    dark: "#422006",
    accent: "#f59e0b",
  },

  "Glass Mantis": {
    main: "#14b8a6",
    light: "#99f6e4",
    dark: "#134e4a",
    accent: "#e0f2fe",
  },

  "Hex Scorpion": {
    main: "#7c3aed",
    light: "#c4b5fd",
    dark: "#2e1065",
    accent: "#f43f5e",
  },

  "Shard Crab": {
    main: "#ef4444",
    light: "#fca5a5",
    dark: "#7f1d1d",
    accent: "#facc15",
  },

  "Void Owl": {
    main: "#334155",
    light: "#94a3b8",
    dark: "#020617",
    accent: "#c084fc",
  },

  "Cinder Bat": {
    main: "#7c2d12",
    light: "#fb923c",
    dark: "#431407",
    accent: "#fde047",
  },

  "Ash Raven": {
    main: "#52525b",
    light: "#a1a1aa",
    dark: "#18181b",
    accent: "#60a5fa",
  },

  "Dusk Falcon": {
    main: "#6366f1",
    light: "#a5b4fc",
    dark: "#312e81",
    accent: "#f472b6",
  },

  "Plume Heron": {
    main: "#0891b2",
    light: "#a5f3fc",
    dark: "#164e63",
    accent: "#f8fafc",
  },

  "Gale Sparrow": {
    main: "#64748b",
    light: "#cbd5e1",
    dark: "#334155",
    accent: "#38bdf8",
  },

  "Spark Finch": {
    main: "#eab308",
    light: "#fef08a",
    dark: "#713f12",
    accent: "#f97316",
  },

  "Crystal Fox": {
    main: "#f97316",
    light: "#fed7aa",
    dark: "#7c2d12",
    accent: "#67e8f9",
  },

  "Shadow Lynx": {
    main: "#52525b",
    light: "#a1a1aa",
    dark: "#18181b",
    accent: "#8b5cf6",
  },

  "Frost Hound": {
    main: "#60a5fa",
    light: "#dbeafe",
    dark: "#1e3a8a",
    accent: "#e0f2fe",
  },

  "Thorn Boar": {
    main: "#65a30d",
    light: "#bef264",
    dark: "#365314",
    accent: "#92400e",
  },

  "Cloud Ram": {
    main: "#cbd5e1",
    light: "#ffffff",
    dark: "#64748b",
    accent: "#93c5fd",
  },

  "Rust Hound": {
    main: "#b45309",
    light: "#fdba74",
    dark: "#451a03",
    accent: "#eab308",
  },

  "Bolt Weasel": {
    main: "#0891b2",
    light: "#67e8f9",
    dark: "#164e63",
    accent: "#facc15",
  },

  "Ember Lynx": {
    main: "#dc2626",
    light: "#fca5a5",
    dark: "#7f1d1d",
    accent: "#fbbf24",
  },

  "Frost Stag": {
    main: "#38bdf8",
    light: "#e0f2fe",
    dark: "#075985",
    accent: "#c4b5fd",
  },

  "Quartz Badger": {
    main: "#78716c",
    light: "#d6d3d1",
    dark: "#292524",
    accent: "#a78bfa",
  },

  "Smog Rat": {
    main: "#4b5563",
    light: "#9ca3af",
    dark: "#1f2937",
    accent: "#84cc16",
  },

  "Coral Newt": {
    main: "#f97316",
    light: "#fdba74",
    dark: "#9a3412",
    accent: "#22d3ee",
  },

  "Tide Kraken": {
    main: "#2563eb",
    light: "#93c5fd",
    dark: "#172554",
    accent: "#a78bfa",
  },

  "Tide Urchin": {
    main: "#db2777",
    light: "#f9a8d4",
    dark: "#831843",
    accent: "#22d3ee",
  },

  "Magma Toad": {
    main: "#dc2626",
    light: "#fb923c",
    dark: "#450a0a",
    accent: "#fde047",
  },

  "Moss Golem": {
    main: "#65a30d",
    light: "#bef264",
    dark: "#365314",
    accent: "#a16207",
  },

  "Ember Sprite": {
    main: "#f97316",
    light: "#fed7aa",
    dark: "#9a3412",
    accent: "#fde047",
  },

  "Glimmer Slime": {
    main: "#22c55e",
    light: "#bbf7d0",
    dark: "#166534",
    accent: "#67e8f9",
  },

  "Lumen Jelly": {
    main: "#06b6d4",
    light: "#a5f3fc",
    dark: "#155e75",
    accent: "#f0abfc",
  },

  "Frost Wisp": {
    main: "#38bdf8",
    light: "#e0f2fe",
    dark: "#075985",
    accent: "#c4b5fd",
  },

  "Gloom Fern": {
    main: "#166534",
    light: "#86efac",
    dark: "#052e16",
    accent: "#a78bfa",
  },

  "Marsh Imp": {
    main: "#84cc16",
    light: "#d9f99d",
    dark: "#365314",
    accent: "#f97316",
  },

  "Bramble Stag": {
    main: "#15803d",
    light: "#86efac",
    dark: "#14532d",
    accent: "#a16207",
  },

  "Vine Python": {
    main: "#16a34a",
    light: "#86efac",
    dark: "#14532d",
    accent: "#facc15",
  },
};

function getPalette(
  species: string,
  tier: Tier,
  random: () => number
) {
  const base =
    SPECIES_PALETTES[species] ?? {
      main: "#64748b",
      light: "#cbd5e1",
      dark: "#334155",
      accent: "#38bdf8",
    };

  /*
   * Only a small chance of a variant.
   * This prevents every pet of the same species from looking
   * completely identical while keeping the species recognizable.
   */
  const variant = random();

  if (variant < 0.12) {
    return {
      ...base,
      accent: "#f472b6",
    };
  }

  if (variant < 0.24) {
    return {
      ...base,
      accent: "#facc15",
    };
  }

  if (variant < 0.32) {
    return {
      ...base,
      accent: "#67e8f9",
    };
  }

  return base;
}

/* =========================================================
   SPECIES DRAWINGS
   ========================================================= */

function drawDragon(
  grid: number[],
  random: () => number
) {
  /* body */
  rect(grid, 7, 9, 17, 17, 3);
  rect(grid, 9, 7, 15, 18, 3);

  /* neck */
  rect(grid, 12, 5, 15, 10, 3);

  /* head */
  rect(grid, 9, 2, 16, 7, 3);
  rect(grid, 8, 4, 17, 8, 3);

  /* horns */
  draw(grid, 10, 1, 4);
  draw(grid, 10, 0, 4);
  draw(grid, 15, 1, 4);
  draw(grid, 15, 0, 4);

  /* eyes */
  draw(grid, 11, 4, 5);
  draw(grid, 15, 4, 5);

  /* wings */
  rect(grid, 3, 7, 7, 14, 2);
  rect(grid, 17, 7, 21, 14, 2);

  draw(grid, 2, 8, 2);
  draw(grid, 1, 9, 2);
  draw(grid, 2, 13, 2);

  draw(grid, 22, 8, 2);
  draw(grid, 23, 9, 2);
  draw(grid, 22, 13, 2);

  /* legs */
  rect(grid, 8, 16, 10, 21, 4);
  rect(grid, 14, 16, 16, 21, 4);

  /* tail */
  let tx = 17;
  let ty = 14;

  const length = 3 + Math.floor(random() * 3);

  for (let i = 0; i < length; i++) {
    draw(grid, tx + i, ty + i, 3);
    draw(grid, tx + i + 1, ty + i, 3);
  }

  /* belly */
  rect(grid, 10, 10, 13, 15, 2);
}

function drawQuadruped(
  grid: number[],
  random: () => number
) {
  /* torso */
  rect(grid, 4, 9, 16, 16, 3);
  rect(grid, 5, 7, 15, 17, 3);

  /* head */
  rect(grid, 13, 4, 19, 10, 3);
  rect(grid, 17, 7, 21, 10, 3);

  /* ears */
  const earStyle = Math.floor(random() * 3);

  if (earStyle === 0) {
    rect(grid, 14, 2, 16, 5, 4);
    rect(grid, 17, 2, 19, 5, 4);
  } else if (earStyle === 1) {
    draw(grid, 14, 3, 4);
    draw(grid, 15, 2, 4);
    draw(grid, 18, 3, 4);
    draw(grid, 19, 2, 4);
  } else {
    draw(grid, 15, 1, 4);
    draw(grid, 18, 1, 4);
  }

  /* eyes */
  draw(grid, 15, 6, 5);
  draw(grid, 18, 6, 5);

  /* legs */
  rect(grid, 5, 16, 7, 22, 4);
  rect(grid, 9, 16, 11, 22, 4);
  rect(grid, 14, 16, 16, 22, 4);
  rect(grid, 17, 16, 19, 22, 4);

  /* tail variations */
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
    draw(grid, 1, 14, 4);
  }

  /* chest */
  rect(grid, 13, 10, 15, 14, 2);

  /* markings */
  const marks = 2 + Math.floor(random() * 5);

  for (let i = 0; i < marks; i++) {
    draw(
      grid,
      8 + Math.floor(random() * 5),
      10 + Math.floor(random() * 5),
      2
    );
  }
}

function drawSerpent(
  grid: number[],
  random: () => number
) {
  const points = [
    [18, 4],
    [17, 6],
    [15, 8],
    [13, 10],
    [11, 12],
    [9, 14],
    [7, 16],
    [6, 18],
  ];

  for (const [x, y] of points) {
    rect(
      grid,
      x - 2,
      y - 2,
      x + 2,
      y + 2,
      3
    );
  }

  /* head */
  rect(grid, 15, 2, 20, 7, 3);

  /* eyes */
  draw(grid, 16, 3, 5);
  draw(grid, 19, 3, 5);

  /* horns */
  draw(grid, 16, 1, 4);
  draw(grid, 19, 1, 4);

  /* scales */
  for (let i = 0; i < 7; i++) {
    const x = 7 + Math.floor(random() * 9);
    const y = 10 + Math.floor(random() * 7);

    draw(grid, x, y, 2);
  }

  /* tail */
  draw(grid, 5, 19, 4);
  draw(grid, 4, 20, 4);
  draw(grid, 3, 20, 4);
}

function drawAquatic(
  grid: number[],
  random: () => number
) {
  /* body */
  rect(grid, 5, 8, 18, 15, 3);
  rect(grid, 7, 6, 16, 17, 3);

  /* head */
  rect(grid, 15, 7, 20, 14, 3);

  /* eyes */
  draw(grid, 18, 9, 5);
  draw(grid, 20, 12, 4);

  /* fins */
  draw(grid, 4, 8, 4);
  draw(grid, 3, 7, 4);
  draw(grid, 2, 8, 4);

  draw(grid, 4, 14, 4);
  draw(grid, 3, 15, 4);

  /* top fin */
  rect(grid, 9, 4, 13, 7, 2);

  /* bottom fin */
  rect(grid, 10, 15, 14, 19, 2);

  /* scales */
  for (let i = 0; i < 7; i++) {
    draw(
      grid,
      7 + Math.floor(random() * 9),
      9 + Math.floor(random() * 5),
      2
    );
  }
}

function drawAvian(
  grid: number[],
  random: () => number
) {
  /* body */
  rect(grid, 8, 8, 15, 17, 3);
  rect(grid, 9, 6, 14, 18, 3);

  /* head */
  rect(grid, 10, 3, 15, 8, 3);

  /* beak */
  draw(grid, 16, 5, 4);
  draw(grid, 17, 6, 4);

  /* eyes */
  draw(grid, 11, 5, 5);
  draw(grid, 14, 5, 5);

  /* left wing */
  rect(grid, 3, 8, 8, 15, 2);
  draw(grid, 2, 9, 2);
  draw(grid, 1, 10, 2);
  draw(grid, 2, 13, 4);

  /* right wing */
  rect(grid, 15, 8, 20, 15, 2);
  draw(grid, 21, 9, 2);
  draw(grid, 22, 10, 2);
  draw(grid, 21, 13, 4);

  /* tail */
  draw(grid, 8, 15, 4);
  draw(grid, 7, 17, 4);
  draw(grid, 6, 19, 4);

  /* legs */
  rect(grid, 9, 17, 10, 21, 4);
  rect(grid, 13, 17, 14, 21, 4);

  /* feathers */
  for (let i = 0; i < 5; i++) {
    draw(
      grid,
      9 + Math.floor(random() * 6),
      10 + Math.floor(random() * 6),
      2
    );
  }
}

function drawInsect(
  grid: number[],
  random: () => number
) {
  /* head */
  rect(grid, 9, 4, 14, 8, 3);

  /* eyes */
  draw(grid, 10, 5, 5);
  draw(grid, 13, 5, 5);

  /* body */
  rect(grid, 8, 7, 15, 18, 3);
  rect(grid, 9, 18, 14, 20, 4);

  /* antenna */
  draw(grid, 9, 3, 4);
  draw(grid, 8, 2, 4);

  draw(grid, 14, 3, 4);
  draw(grid, 15, 2, 4);

  /* wings */
  rect(grid, 3, 7, 8, 14, 2);
  rect(grid, 15, 7, 20, 14, 2);

  draw(grid, 2, 8, 2);
  draw(grid, 1, 9, 2);

  draw(grid, 21, 8, 2);
  draw(grid, 22, 9, 2);

  /* legs */
  for (let y = 9; y <= 15; y += 2) {
    draw(grid, 6, y, 4);
    draw(grid, 5, y + 1, 4);

    draw(grid, 17, y, 4);
    draw(grid, 18, y + 1, 4);
  }

  /* body markings */
  for (let i = 0; i < 5; i++) {
    draw(
      grid,
      10 + Math.floor(random() * 4),
      9 + Math.floor(random() * 7),
      2
    );
  }
}

function drawSpider(
  grid: number[],
  random: () => number
) {
  /* body */
  rect(grid, 8, 8, 15, 16, 3);

  /* head */
  rect(grid, 9, 6, 14, 10, 4);

  /* eyes */
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
    draw(
      grid,
      8 + dx * 2,
      10 + dy * 2,
      4
    );

    draw(
      grid,
      8 + dx * 3,
      11 + dy * 2,
      4
    );

    draw(
      grid,
      15 + dx * 2,
      10 + dy * 2,
      4
    );

    draw(
      grid,
      15 + dx * 3,
      11 + dy * 2,
      4
    );
  }

  /* markings */
  for (let i = 0; i < 5; i++) {
    draw(
      grid,
      10 + Math.floor(random() * 4),
      11 + Math.floor(random() * 4),
      2
    );
  }
}

function drawBlob(
  grid: number[],
  random: () => number
) {
  const wobble = random();

  for (let y = 5; y <= 19; y++) {
    for (let x = 4; x <= 19; x++) {
      const dx = x - 11.5;
      const dy = y - 12;

      const distance =
        (dx * dx) / (58 + wobble * 15) +
        (dy * dy) / (70 + wobble * 15);

      if (distance < 1) {
        draw(grid, x, y, 3);
      }
    }
  }

  /* eyes */
  draw(grid, 8, 10, 5);
  draw(grid, 14, 10, 5);

  /* highlights */
  draw(grid, 7, 7, 1);
  draw(grid, 8, 7, 1);
  draw(grid, 7, 8, 1);

  /* feet */
  draw(grid, 6, 18, 4);
  draw(grid, 6, 19, 4);

  draw(grid, 11, 18, 4);

  draw(grid, 15, 18, 4);
  draw(grid, 15, 19, 4);

  /* spots */
  for (let i = 0; i < 6; i++) {
    draw(
      grid,
      7 + Math.floor(random() * 9),
      12 + Math.floor(random() * 5),
      2
    );
  }
}

function drawBiped(
  grid: number[],
  random: () => number
) {
  /* body */
  rect(grid, 8, 9, 15, 17, 3);

  /* head */
  rect(grid, 8, 3, 15, 9, 3);

  /* eyes */
  draw(grid, 10, 6, 5);
  draw(grid, 13, 6, 5);

  /* horns / ears */
  if (random() > 0.5) {
    draw(grid, 8, 3, 4);
    draw(grid, 7, 2, 4);

    draw(grid, 15, 3, 4);
    draw(grid, 16, 2, 4);
  } else {
    draw(grid, 9, 2, 4);
    draw(grid, 14, 2, 4);
  }

  /* arms */
  rect(grid, 5, 10, 8, 14, 4);
  rect(grid, 15, 10, 18, 14, 4);

  /* legs */
  rect(grid, 9, 17, 11, 22, 4);
  rect(grid, 13, 17, 15, 22, 4);

  /* body markings */
  for (let i = 0; i < 6; i++) {
    draw(
      grid,
      9 + Math.floor(random() * 6),
      11 + Math.floor(random() * 5),
      2
    );
  }
}

/* =========================================================
   SPECIAL RARITY DETAILS
   ========================================================= */

function addRarityDetails(
  grid: number[],
  tier: Tier,
  random: () => number
) {
  /*
   * Rarity adds details instead of replacing the species.
   */

  if (tier === "Worthless") {
    return;
  }

  if (
    tier === "Average" ||
    tier === "Decent"
  ) {
    /* small marking */
    draw(
      grid,
      11 + Math.floor(random() * 3),
      13 + Math.floor(random() * 3),
      2
    );

    return;
  }

  if (tier === "Good") {
    /* extra horns / jewel */
    draw(grid, 11, 2, 4);
    draw(grid, 12, 2, 4);

    return;
  }

  if (tier === "Fabulous") {
    /* crystals */
    draw(grid, 9, 1, 4);
    draw(grid, 10, 1, 4);
    draw(grid, 15, 1, 4);
    draw(grid, 16, 1, 4);

    draw(grid, 11, 19, 2);
    draw(grid, 12, 19, 2);

    return;
  }

  if (tier === "Excellent") {
    /* large crown-like crystal structure */
    draw(grid, 9, 1, 4);
    draw(grid, 10, 0, 4);
    draw(grid, 11, 1, 4);

    draw(grid, 14, 1, 4);
    draw(grid, 15, 0, 4);
    draw(grid, 16, 1, 4);

    /* magical markings */
    draw(grid, 8, 12, 2);
    draw(grid, 17, 12, 2);
    draw(grid, 10, 15, 2);
    draw(grid, 15, 15, 2);

    /* sparkle */
    if (random() > 0.5) {
      draw(grid, 4, 5, 2);
      draw(grid, 20, 5, 2);
      draw(grid, 5, 18, 2);
    }
  }
}

/* =========================================================
   CREATURE GENERATOR
   ========================================================= */

function generateCreature(
  seed: number,
  species: string,
  tier: Tier
) {
  const combinedSeed =
    (seed ^ hashString(species)) >>> 0;

  const random = rng(combinedSeed);

  const body =
    SPECIES_BODY[species] ??
    BODY_TYPES[
      Math.floor(
        random() * BODY_TYPES.length
      )
    ];

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

  addRarityDetails(
    grid,
    tier,
    random
  );

  const palette = getPalette(
    species,
    tier,
    random
  );

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
   * Larger than the previous version.
   *
   * 0.86 means the 24x24 sprite occupies around 86%
   * of the avatar instead of being tiny in the middle.
   */
  const px = Math.max(
    1,
    Math.floor(
      (size * 0.86) / GRID
    )
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
      {/* subtle glow */}
      <div
        className="absolute rounded-full blur-xl opacity-20 pointer-events-none"
        style={{
          width: size * 0.7,
          height: size * 0.7,
          left: size * 0.15,
          top: size * 0.15,
          background: sprite.palette.accent,
        }}
      />

      {/* sprite */}
      <div
        className="absolute"
        style={{
          width: spriteSize,
          height: spriteSize,
          left:
            (size - spriteSize) / 2,
          top:
            (size - spriteSize) / 2,
        }}
      >
        {pixelGrid(
          sprite.grid,
          [
            "transparent",
            sprite.palette.light,
            sprite.palette.accent,
            sprite.palette.main,
            sprite.palette.dark,
            "#111827",
          ],
          px
        )}
      </div>
    </div>
  );
}

/* =========================================================
   EGGS
   ========================================================= */

const EGG_PALETTES: Record<
  string,
  string[]
> = {
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
    EGG_PALETTES[
      type.toLowerCase()
    ] ?? EGG_PALETTES.worthless;

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
        {pixelGridEgg(
          EGG_SPRITE,
          palette,
          px
        )}

        {pixelGridEgg(
          EGG_HIGHLIGHT,
          palette,
          px
        )}
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
          background:
            palette[value] ?? palette[1],
        }}
      />
    );
  });
}

/* =========================================================
   SPINNER
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

/* =========================================================
   EMPTY STATE
   ========================================================= */

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

/* =========================================================
   MODAL
   ========================================================= */

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
        onClick={(e) =>
          e.stopPropagation()
        }
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

/* =========================================================
   HP BAR
   ========================================================= */

export function HpBar({
  current,
  max,
}: {
  current: number;
  max: number;
}) {
  const pct = Math.max(
    0,
    Math.min(
      100,
      (current / max) * 100
    )
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
