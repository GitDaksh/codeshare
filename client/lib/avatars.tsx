import type { ReactNode } from "react";

// ============================================================================
// Shared deterministic RNG
// ============================================================================

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

export type AvatarDefinition = {
  bg: [string, string];
  bgKind: "linear" | "radial";
  bgAngle?: number;
  render: (uid: string) => ReactNode;
};

export const DEFAULT_AVATAR_ID = "codeshare";

// ============================================================================
// v1 generator (legacy)
// Kept exactly as it was, so every avatar chosen before v2 still renders
// identically. Any seed that doesn't start with "v2-" uses this.
// ============================================================================

const V1_PALETTES: { bg: [string, string]; fg: string; fg2: string }[] = [
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

const V1_LAYER_POOL: LayerFn[] = [
  layerFragments,
  layerOrbits,
  layerFlowLines,
  layerArcBand,
  layerHalftone,
  layerBar,
  layerHalo,
];

function generateV1(seed: string): AvatarDefinition {
  const rng = createRng(seed || DEFAULT_AVATAR_ID);
  const palette = V1_PALETTES[rng.int(0, V1_PALETTES.length - 1)];
  const layerCount = rng.int(2, 3);
  const chosen = shuffle(V1_LAYER_POOL, rng).slice(0, layerCount);
  const pattern = <>{chosen.map((layerFn, i) => layerFn(rng, palette.fg, palette.fg2, `layer-${i}`))}</>;

  return { bg: palette.bg, bgKind: "linear", render: () => pattern };
}

// ============================================================================
// v2 generator: five distinct styles, seeds look like "v2-<style>-<random>"
// ============================================================================

export type AvatarStyle = "pixel" | "orbit" | "wave" | "bauhaus" | "ripple";
export type AvatarStyleFilter = AvatarStyle | "all";

export const AVATAR_STYLES: { id: AvatarStyleFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pixel", label: "Pixel" },
  { id: "orbit", label: "Orbit" },
  { id: "wave", label: "Wave" },
  { id: "bauhaus", label: "Bauhaus" },
  { id: "ripple", label: "Ripple" },
];

type V2Palette = { bg: [string, string]; fg: string; fg2: string };

const V2_PALETTES: V2Palette[] = [
  { bg: ["#050505", "#2a2a2a"], fg: "#f5f5f5", fg2: "#8a8a8a" },
  { bg: ["#f5f5f5", "#bdbdbd"], fg: "#0a0a0a", fg2: "#5a5a5a" },
  { bg: ["#1a1a1a", "#555555"], fg: "#ffffff", fg2: "#b0b0b0" },
  { bg: ["#0d0d0d", "#141414"], fg: "#e6e6e6", fg2: "#4d4d4d" },
  { bg: ["#d9d9d9", "#8c8c8c"], fg: "#111111", fg2: "#f5f5f5" },
  { bg: ["#333333", "#0a0a0a"], fg: "#f0f0f0", fg2: "#777777" },
  { bg: ["#8c8c8c", "#2b2b2b"], fg: "#fafafa", fg2: "#1a1a1a" },
  { bg: ["#ffffff", "#e0e0e0"], fg: "#262626", fg2: "#a3a3a3" },
];

type StyleOutput = { bgKind: "linear" | "radial"; render: (uid: string) => ReactNode };
type StyleFn = (rng: Rng, p: V2Palette) => StyleOutput;

// Symmetric 5x5 identicon.
const pixelStyle: StyleFn = (rng, p) => {
  const size = 5;
  const cell = 4.6;
  const gap = 0.7;
  const offset = (40 - size * cell) / 2;
  const cells: { x: number; y: number; color: string }[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < 3; x++) {
      if (rng.bool(0.5)) {
        const color = rng.bool(0.78) ? p.fg : p.fg2;
        cells.push({ x, y, color });
        if (x !== 2) cells.push({ x: size - 1 - x, y, color });
      }
    }
  }

  if (cells.length < 4) {
    for (let y = 1; y < 4; y++) cells.push({ x: 2, y, color: p.fg });
  }

  return {
    bgKind: "linear",
    render: () => (
      <g>
        {cells.map((c, i) => (
          <rect
            key={i}
            x={offset + c.x * cell + gap / 2}
            y={offset + c.y * cell + gap / 2}
            width={cell - gap}
            height={cell - gap}
            rx={0.9}
            fill={c.color}
          />
        ))}
      </g>
    ),
  };
};

// Shaded planet with tilted rings, moons, and a few stars.
const orbitStyle: StyleFn = (rng, p) => {
  const cx = 20 + rng.float(-2, 2);
  const cy = 20 + rng.float(-2, 2);
  const r = rng.float(6.5, 9.5);
  const rings = Array.from({ length: rng.int(1, 2) }, () => ({
    rx: rng.float(13, 17),
    ry: rng.float(3.5, 6.5),
    angle: rng.float(-40, 40),
    width: rng.float(0.8, 1.4),
    moonT: rng.float(0, Math.PI * 2),
    moonR: rng.float(1.2, 2.2),
  }));
  const stars = Array.from({ length: rng.int(3, 7) }, () => ({
    x: rng.float(3, 37),
    y: rng.float(3, 37),
    r: rng.float(0.3, 0.8),
    o: rng.float(0.3, 0.8),
  }));

  return {
    bgKind: "radial",
    render: (uid) => {
      const sphereId = `${uid}-sphere`;
      return (
        <>
          <defs>
            <radialGradient id={sphereId} cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor={p.fg} />
              <stop offset="100%" stopColor={p.fg2} />
            </radialGradient>
          </defs>
          {stars.map((s, i) => (
            <circle key={`star-${i}`} cx={s.x} cy={s.y} r={s.r} fill={p.fg} opacity={s.o} />
          ))}
          <circle cx={cx} cy={cy} r={r} fill={`url(#${sphereId})`} />
          {rings.map((ring, i) => (
            <g key={`ring-${i}`} transform={`rotate(${ring.angle} ${cx} ${cy})`}>
              <ellipse
                cx={cx}
                cy={cy}
                rx={ring.rx}
                ry={ring.ry}
                fill="none"
                stroke={p.fg}
                strokeWidth={ring.width}
                opacity={0.75}
              />
              <circle
                cx={cx + ring.rx * Math.cos(ring.moonT)}
                cy={cy + ring.ry * Math.sin(ring.moonT)}
                r={ring.moonR}
                fill={p.fg}
              />
            </g>
          ))}
        </>
      );
    },
  };
};

// Layered hills with an optional sun.
const waveStyle: StyleFn = (rng, p) => {
  const count = rng.int(3, 5);
  const hasSun = rng.bool(0.6);
  const sun = { x: rng.float(10, 30), y: rng.float(9, 15), r: rng.float(3.5, 6) };
  const bands = Array.from({ length: count }, (_, i) => ({
    baseY: 16 + (i * 22) / count + rng.float(-1.5, 1.5),
    amp: rng.float(1.5, 4.5),
    shift: rng.float(-6, 6),
  }));

  return {
    bgKind: "linear",
    render: () => (
      <>
        {hasSun && <circle cx={sun.x} cy={sun.y} r={sun.r} fill={p.fg2} opacity={0.9} />}
        {bands.map((b, i) => {
          const y = b.baseY;
          const a = b.amp;
          const s = b.shift;
          const d = `M -4 ${y} C ${6 + s} ${y - a}, ${14 + s} ${y + a}, ${20 + s} ${y} S ${34 + s} ${y - a}, 44 ${y} L 44 44 L -4 44 Z`;
          return <path key={i} d={d} fill={p.fg} opacity={0.25 + (0.75 * (i + 1)) / count} />;
        })}
      </>
    ),
  };
};

// Four geometric tiles: quarter circles, half circles, dots, diamonds, triangles.
type BauhausTile = {
  x: number;
  y: number;
  kind: number;
  rotation: number;
  color: string;
  tinted: boolean;
  diamond: boolean;
};

const bauhausStyle: StyleFn = (rng, p) => {
  const tiles: BauhausTile[] = [];
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      tiles.push({
        x: tx * 20,
        y: ty * 20,
        kind: rng.int(0, 4),
        rotation: rng.int(0, 3) * 90,
        color: rng.bool(0.7) ? p.fg : p.fg2,
        tinted: rng.bool(0.4),
        diamond: rng.bool(0.5),
      });
    }
  }

  function shape(kind: number, color: string, diamond: boolean) {
    switch (kind) {
      case 0:
        return <path d="M 0 0 L 20 0 A 20 20 0 0 1 0 20 Z" fill={color} />;
      case 1:
        return <path d="M 0 20 A 10 10 0 0 1 20 20 Z" fill={color} />;
      case 2:
        return <circle cx={10} cy={10} r={7} fill={color} />;
      case 3:
        return (
          <rect
            x={4}
            y={4}
            width={12}
            height={12}
            fill={color}
            transform={diamond ? "rotate(45 10 10)" : undefined}
          />
        );
      default:
        return <path d="M 0 20 L 20 20 L 20 0 Z" fill={color} />;
    }
  }

  return {
    bgKind: "linear",
    render: () => (
      <>
        {tiles.map((t, i) => (
          <g key={i} transform={`translate(${t.x} ${t.y}) rotate(${t.rotation} 10 10)`}>
            {t.tinted && <rect x={0} y={0} width={20} height={20} fill={p.fg2} opacity={0.35} />}
            {shape(t.kind, t.color, t.diamond)}
          </g>
        ))}
      </>
    ),
  };
};

// Off-center concentric rings (op-art).
const rippleStyle: StyleFn = (rng, p) => {
  const ox = rng.float(8, 32);
  const oy = rng.float(8, 32);
  const step = rng.float(3, 4.5);
  const ringCount = Math.ceil(56 / step);
  const thickness = rng.float(0.35, 0.55);

  return {
    bgKind: "linear",
    render: () => (
      <g>
        <circle cx={ox} cy={oy} r={step * 0.6} fill={p.fg} />
        {Array.from({ length: ringCount }, (_, i) => (
          <circle
            key={i}
            cx={ox}
            cy={oy}
            r={step * (i + 1)}
            fill="none"
            stroke={i % 2 === 0 ? p.fg : p.fg2}
            strokeWidth={step * thickness}
            opacity={Math.max(0.25, 1 - i * 0.06)}
          />
        ))}
      </g>
    ),
  };
};

const V2_STYLES: Record<AvatarStyle, StyleFn> = {
  pixel: pixelStyle,
  orbit: orbitStyle,
  wave: waveStyle,
  bauhaus: bauhausStyle,
  ripple: rippleStyle,
};

const V2_STYLE_IDS = Object.keys(V2_STYLES) as AvatarStyle[];

function generateV2(seed: string): AvatarDefinition {
  const styleId = seed.split("-")[1] ?? "";
  const styleFn = (V2_STYLES as Record<string, StyleFn>)[styleId] ?? pixelStyle;
  const rng = createRng(seed);
  const palette = V2_PALETTES[rng.int(0, V2_PALETTES.length - 1)];
  const bgAngle = rng.int(0, 7) * 45;
  const { bgKind, render } = styleFn(rng, palette);

  return { bg: palette.bg, bgKind, bgAngle, render };
}

// ============================================================================
// Public API
// ============================================================================

export function getAvatarDefinition(seed: string): AvatarDefinition {
  return seed.startsWith("v2-") ? generateV2(seed) : generateV1(seed);
}

export function generateSeedBatch(count: number, style: AvatarStyleFilter = "all"): string[] {
  const randomPart = () => Math.random().toString(36).slice(2, 10);
  const seeds = Array.from({ length: count }, (_, i) => {
    const s = style === "all" ? V2_STYLE_IDS[i % V2_STYLE_IDS.length] : style;
    return `v2-${s}-${randomPart()}`;
  });

  for (let i = seeds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
  }
  return seeds;
}