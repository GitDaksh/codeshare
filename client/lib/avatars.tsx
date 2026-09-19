import type { ReactNode } from "react";

type Rng = {
  float: (min?: number, max?: number) => number;
  int: (min: number, max: number) => number;
  bool: (p?: number) => boolean;
};

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed: string): Rng {
  const rand = mulberry32(hashSeed(seed));
  return {
    float: (min = 0, max = 1) => min + rand() * (max - min),
    int: (min: number, max: number) => Math.floor(min + rand() * (max - min + 1)),
    bool: (p = 0.5) => rand() < p,
  };
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const PALETTES: { bg: [string, string]; fg: string; fg2: string }[] = [
  { bg: ["#000000", "#262626"], fg: "#f5f5f5", fg2: "#999999" },
  { bg: ["#0d0d0d", "#404040"], fg: "#f5f5f5", fg2: "#cccccc" },
  { bg: ["#f5f5f5", "#cccccc"], fg: "#0d0d0d", fg2: "#404040" },
  { bg: ["#1a1a1a", "#666666"], fg: "#f5f5f5", fg2: "#999999" },
  { bg: ["#262626", "#0d0d0d"], fg: "#cccccc", fg2: "#666666" },
  { bg: ["#404040", "#1a1a1a"], fg: "#f5f5f5", fg2: "#cccccc" },
  { bg: ["#666666", "#262626"], fg: "#f5f5f5", fg2: "#cccccc" },
];

type LayerFn = (rng: Rng, fg: string, fg2: string, key: string) => ReactNode;

const layerFragments: LayerFn = (rng, fg, fg2, key) => {
  const count = rng.int(3, 5);
  return (
    <g key={key}>
      {Array.from({ length: count }).map((_, i) => {
        const cx = rng.float(4, 36);
        const cy = rng.float(4, 36);
        const size = rng.float(6, 16);
        const rotation = rng.float(0, 360);
        return (
          <polygon
            key={i}
            points={`${cx},${cy - size} ${cx + size * 0.86},${cy + size * 0.5} ${cx - size * 0.86},${cy + size * 0.5}`}
            fill={rng.bool(0.7) ? fg : fg2}
            opacity={rng.float(0.35, 0.95)}
            transform={`rotate(${rotation} ${cx} ${cy})`}
          />
        );
      })}
    </g>
  );
};

const layerOrbits: LayerFn = (rng, fg, fg2, key) => {
  const count = rng.int(3, 6);
  return (
    <g key={key}>
      {Array.from({ length: count }).map((_, i) => {
        const cx = rng.float(6, 34);
        const cy = rng.float(6, 34);
        const r = rng.float(2, 9);
        const color = rng.bool(0.7) ? fg : fg2;
        return rng.bool(0.6) ? (
          <circle key={i} cx={cx} cy={cy} r={r} fill={color} opacity={rng.float(0.4, 1)} />
        ) : (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={rng.float(1, 2.2)}
            opacity={rng.float(0.5, 1)}
          />
        );
      })}
    </g>
  );
};

const layerFlowLines: LayerFn = (rng, fg, fg2, key) => {
  const count = rng.int(2, 4);
  return (
    <g key={key}>
      {Array.from({ length: count }).map((_, i) => {
        const x1 = rng.float(-4, 20);
        const y1 = rng.float(2, 38);
        const x2 = rng.float(20, 44);
        const y2 = rng.float(2, 38);
        const cx1 = rng.float(10, 30);
        const cy1 = rng.float(-4, 44);
        return (
          <path
            key={i}
            d={`M ${x1} ${y1} Q ${cx1} ${cy1} ${x2} ${y2}`}
            fill="none"
            stroke={rng.bool(0.7) ? fg : fg2}
            strokeWidth={rng.float(1.5, 4)}
            strokeLinecap="round"
            opacity={rng.float(0.5, 1)}
          />
        );
      })}
    </g>
  );
};

const layerArcBand: LayerFn = (rng, fg, fg2, key) => {
  const cx = 20;
  const cy = 20;
  const r = rng.float(10, 16);
  const startAngle = rng.float(0, 360);
  const sweep = rng.float(80, 220);
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(startAngle + sweep));
  const y2 = cy + r * Math.sin(toRad(startAngle + sweep));
  const largeArc = sweep > 180 ? 1 : 0;
  return (
    <path
      key={key}
      d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
      fill="none"
      stroke={rng.bool(0.7) ? fg : fg2}
      strokeWidth={rng.float(3, 7)}
      strokeLinecap="round"
      opacity={rng.float(0.7, 1)}
    />
  );
};

const layerHalftone: LayerFn = (rng, fg, _fg2, key) => {
  const focusX = rng.float(8, 32);
  const focusY = rng.float(8, 32);
  const dots: ReactNode[] = [];
  for (let ix = 0; ix < 6; ix++) {
    for (let iy = 0; iy < 6; iy++) {
      const x = 3 + ix * 6.2;
      const y = 3 + iy * 6.2;
      const dist = Math.hypot(x - focusX, y - focusY);
      const r = Math.max(0.4, 3.2 - dist * 0.28);
      if (r > 0.5) {
        dots.push(<circle key={`${ix}-${iy}`} cx={x} cy={y} r={r} fill={fg} opacity={0.85} />);
      }
    }
  }
  return <g key={key}>{dots}</g>;
};

const layerBar: LayerFn = (rng, fg, fg2, key) => {
  const cx = rng.float(10, 30);
  const cy = rng.float(10, 30);
  const w = rng.float(14, 30);
  const h = rng.float(3, 7);
  return (
    <rect
      key={key}
      x={cx - w / 2}
      y={cy - h / 2}
      width={w}
      height={h}
      rx={h / 2}
      fill={rng.bool(0.7) ? fg : fg2}
      opacity={rng.float(0.6, 0.95)}
      transform={`rotate(${rng.float(0, 360)} ${cx} ${cy})`}
    />
  );
};

const layerHalo: LayerFn = (rng, fg, fg2, key) => {
  const cx = rng.float(10, 30);
  const cy = rng.float(10, 30);
  return (
    <circle
      key={key}
      cx={cx}
      cy={cy}
      r={rng.float(8, 17)}
      fill="none"
      stroke={rng.bool(0.6) ? fg : fg2}
      strokeWidth={rng.float(0.8, 1.8)}
      opacity={rng.float(0.35, 0.7)}
    />
  );
};

const LAYER_POOL: LayerFn[] = [
  layerFragments,
  layerOrbits,
  layerFlowLines,
  layerArcBand,
  layerHalftone,
  layerBar,
  layerHalo,
];

export const DEFAULT_AVATAR_ID = "codeshare";

export function generateSeedBatch(count: number): string[] {
  return Array.from({ length: count }, () => Math.random().toString(36).slice(2, 10));
}

export function getAvatarDefinition(seed: string) {
  const rng = createRng(seed || DEFAULT_AVATAR_ID);
  const palette = PALETTES[rng.int(0, PALETTES.length - 1)];
  const layerCount = rng.int(2, 3);
  const chosen = shuffle(LAYER_POOL, rng).slice(0, layerCount);

  return {
    bg: palette.bg,
    pattern: <>{chosen.map((layerFn, i) => layerFn(rng, palette.fg, palette.fg2, `layer-${i}`))}</>,
  };
}