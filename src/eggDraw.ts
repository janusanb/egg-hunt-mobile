/** Deterministic PRNG for pattern variation (0..1) */
export function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type PatternKind = "stripesH" | "stripesV" | "dots" | "bands" | "speckle";

export interface EggStyle {
  baseHue: number;
  baseSat: number;
  baseLight: number;
  accentHue: number;
  pattern: PatternKind;
  seed: number;
}

/**
 * Unit egg silhouette at origin (same as former Path2D).
 * Uses explicit curves only — `CanvasRenderingContext2D.addPath` is missing in Safari pre-17
 * and throws, which prevented any eggs from drawing.
 */
export function traceEggPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, -1.15);
  ctx.bezierCurveTo(0.62, -1.15, 1.05, -0.35, 1.05, 0.38);
  ctx.bezierCurveTo(1.05, 0.92, 0.58, 1.25, 0, 1.25);
  ctx.bezierCurveTo(-0.58, 1.25, -1.05, 0.92, -1.05, 0.38);
  ctx.bezierCurveTo(-1.05, -0.35, -0.62, -1.15, 0, -1.15);
  ctx.closePath();
}

function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h % 360},${s}%,${l}%,${a})`;
}

function drawStripesH(ctx: CanvasRenderingContext2D, rng: () => number, baseHue: number): void {
  const count = 6 + Math.floor(rng() * 5);
  const c1 = hsl(baseHue + (rng() - 0.5) * 25, 52 + rng() * 20, 68 + rng() * 12, 0.9);
  const c2 = hsl(baseHue + 40 + (rng() - 0.5) * 30, 48 + rng() * 25, 74 + rng() * 10, 0.88);
  const top = -1.32;
  const h = 2.64;
  const step = h / count;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = i % 2 === 0 ? c1 : c2;
    ctx.fillRect(-1.2, top + i * step, 2.4, step + 0.015);
  }
}

function drawStripesV(ctx: CanvasRenderingContext2D, rng: () => number, baseHue: number): void {
  const count = 5 + Math.floor(rng() * 4);
  const c1 = hsl(baseHue + (rng() - 0.5) * 35, 45 + rng() * 25, 72 + rng() * 10, 0.88);
  const c2 = hsl(baseHue + 55 + (rng() - 0.5) * 25, 55 + rng() * 20, 65 + rng() * 12, 0.85);
  const left = -1.12;
  const w = 2.24;
  const step = w / count;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = i % 2 === 0 ? c1 : c2;
    ctx.fillRect(left + i * step, -1.35, step + 0.015, 2.7);
  }
}

function drawDots(ctx: CanvasRenderingContext2D, rng: () => number, accentHue: number): void {
  const rows = 7 + Math.floor(rng() * 4);
  const cols = 5 + Math.floor(rng() * 3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = (rng() - 0.5) * 0.08;
      const oy = (rng() - 0.5) * 0.08;
      const x = -0.95 + (c / Math.max(1, cols - 1)) * 1.9 + ox;
      const y = -1.1 + (r / Math.max(1, rows - 1)) * 2.2 + oy;
      const rad = 0.06 + rng() * 0.07;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fillStyle = hsl(accentHue + (rng() - 0.5) * 40, 60, 55 + rng() * 20, 0.9);
      ctx.fill();
    }
  }
}

function drawBands(ctx: CanvasRenderingContext2D, rng: () => number, baseHue: number): void {
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const y0 = -1.0 + (i / Math.max(1, n - 1)) * 1.85 + (rng() - 0.5) * 0.12;
    const bh = 0.22 + rng() * 0.38;
    ctx.fillStyle = hsl(baseHue + (rng() - 0.5) * 50, 50 + rng() * 25, 65 + rng() * 15, 0.78);
    ctx.fillRect(-1.15, y0, 2.3, bh);
  }
}

function drawSpeckle(ctx: CanvasRenderingContext2D, rng: () => number): void {
  const n = 80 + Math.floor(rng() * 80);
  for (let i = 0; i < n; i++) {
    const x = (rng() - 0.5) * 1.85;
    const y = (rng() - 0.5) * 2.35;
    const rad = 0.015 + rng() * 0.045;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = hsl(rng() * 360, 40 + rng() * 40, 45 + rng() * 35, 0.5 + rng() * 0.35);
    ctx.fill();
  }
}

function paintPattern(ctx: CanvasRenderingContext2D, style: EggStyle): void {
  const rngFn = mulberry32(style.seed);
  switch (style.pattern) {
    case "stripesH":
      drawStripesH(ctx, rngFn, style.baseHue);
      break;
    case "stripesV":
      drawStripesV(ctx, rngFn, style.baseHue);
      break;
    case "dots":
      drawDots(ctx, rngFn, style.accentHue);
      break;
    case "bands":
      drawBands(ctx, rngFn, style.baseHue);
      break;
    case "speckle":
      drawSpeckle(ctx, rngFn);
      break;
    default:
      drawSpeckle(ctx, rngFn);
  }
}

export function drawEgg(ctx: CanvasRenderingContext2D, style: EggStyle, scale: number, rotation: number): void {
  ctx.save();
  ctx.rotate(rotation);
  ctx.scale(scale, scale);

  traceEggPath(ctx);
  ctx.fillStyle = hsl(style.baseHue, style.baseSat, style.baseLight);
  ctx.fill();

  ctx.save();
  traceEggPath(ctx);
  ctx.clip();
  paintPattern(ctx, style);
  ctx.restore();

  ctx.strokeStyle = hsl(style.baseHue, style.baseSat * 0.6, style.baseLight - 12, 0.35);
  ctx.lineWidth = 0.035;
  traceEggPath(ctx);
  ctx.stroke();

  ctx.restore();
}
