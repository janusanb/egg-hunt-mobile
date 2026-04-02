import { drawEgg, traceEggPath, mulberry32, type EggStyle, type PatternKind } from "./eggDraw";

const PATTERNS: PatternKind[] = ["stripesH", "stripesV", "dots", "bands", "speckle"];

export interface EggInstance {
  cx: number;
  cy: number;
  scale: number;
  rotation: number;
  style: EggStyle;
  isTarget: boolean;
  z: number;
}

function randomPastelStyle(seed: number): EggStyle {
  const r = mulberry32(seed);
  const pattern = PATTERNS[Math.floor(r() * PATTERNS.length)]!;
  const baseHue = r() * 360;
  return {
    baseHue,
    baseSat: 42 + r() * 28,
    baseLight: 78 + r() * 12,
    accentHue: baseHue + (r() - 0.5) * 80,
    pattern,
    seed: (Math.floor(r() * 0xffffffff) >>> 0) ^ 0x9e3779b9,
  };
}

/** Fixed gold / yolk palette; pattern still varies by seed. Target keeps normal pastel style. */
function goldYolkStyle(seed: number): EggStyle {
  const r = mulberry32(seed);
  const pattern = PATTERNS[Math.floor(r() * PATTERNS.length)]!;
  return {
    baseHue: 47 + (r() - 0.5) * 6,
    baseSat: 62 + r() * 12,
    baseLight: 68 + r() * 8,
    accentHue: 39 + (r() - 0.5) * 10,
    pattern,
    seed: (Math.floor(r() * 0xffffffff) >>> 0) ^ 0x9e3779b9,
  };
}

function applyGoldYolkToNonTargets(eggs: EggInstance[]): void {
  for (const e of eggs) {
    if (!e.isTarget) e.style = goldYolkStyle(e.style.seed);
  }
}

/** Bounding radius (world px) that contains the rotated unit egg silhouette. */
function eggBoundRadius(scale: number): number {
  return scale * 1.68;
}

/** True when the whole egg (conservative circle) fits inside the canvas. */
function targetFullyInsideCanvas(cx: number, cy: number, scale: number, w: number, h: number): boolean {
  const r = eggBoundRadius(scale);
  return cx >= r && cx <= w - r && cy >= r && cy <= h - r;
}

/**
 * Tiles overlapping eggs across and past the canvas.
 * Fewer eggs than before (wider grid steps). Target is always chosen so it stays fully on-screen.
 */
function generateDenseLayout(width: number, height: number, seed: number): EggInstance[] {
  const rng = mulberry32(seed);
  let minScale = 20;
  const maxScale = 28;
  let overlapFactor = 1.0;
  const margin = maxScale * 2.4;
  let eggs: EggInstance[] = [];

  const build = (): void => {
    eggs = [];
    const stepX = minScale * overlapFactor;
    const stepY = minScale * 1.16;
    let idx = 0;
    for (let gy = -margin; gy < height + margin; gy += stepY) {
      const row = Math.round((gy + margin) / stepY);
      const ox = (row % 2) * (stepX * 0.5);
      for (let gx = -margin + ox; gx < width + margin + stepX * 0.5; gx += stepX) {
        const cx = gx + (rng() - 0.5) * stepX * 0.55;
        const cy = gy + (rng() - 0.5) * stepY * 0.55;
        const scale = minScale + rng() * (maxScale - minScale);
        const rotation = (rng() - 0.5) * 0.62;
        const z = rng();
        const styleSeed = (Math.floor(rng() * 0xffffffff) >>> 0) ^ (idx * 0x85ebca6b);
        eggs.push({
          cx,
          cy,
          scale,
          rotation,
          style: randomPastelStyle(styleSeed),
          isTarget: false,
          z,
        });
        idx++;
      }
    }
  };

  build();
  for (let relax = 0; relax < 10 && eggs.length > 350; relax++) {
    minScale += 2;
    overlapFactor += 0.05;
    build();
  }

  if (eggs.length === 0) {
    const r = mulberry32(seed ^ 0xdeadbeef);
    const fit = Math.min(width, height) / (2 * 1.68) * 0.9;
    const scale = Math.max(20, Math.min(40, fit));
    eggs.push({
      cx: width * 0.5,
      cy: height * 0.5,
      scale,
      rotation: (r() - 0.5) * 0.4,
      style: randomPastelStyle((Math.floor(r() * 0xffffffff) >>> 0) ^ 1),
      isTarget: true,
      z: 0.5,
    });
    return eggs;
  }

  const eligible = eggs.filter((e) => targetFullyInsideCanvas(e.cx, e.cy, e.scale, width, height));
  let target: EggInstance;

  if (eligible.length > 0) {
    target = eligible[Math.floor(rng() * eligible.length)]!;
  } else {
    const fit = Math.min(width, height) / (2 * 1.68) * 0.88;
    const scale = Math.max(20, Math.min(42, fit));
    target = {
      cx: width * 0.5,
      cy: height * 0.5,
      scale,
      rotation: (rng() - 0.5) * 0.45,
      style: randomPastelStyle((Math.floor(rng() * 0xffffffff) >>> 0) ^ 0xcafebabe),
      isTarget: false,
      z: rng(),
    };
    eggs.push(target);
  }

  for (const e of eggs) {
    e.isTarget = e === target;
  }

  return eggs;
}

/**
 * When the hint line stopped far from the egg center, the arrowhead sat *outside* the real
 * silhouette (especially toward the narrow tip). The bullseye marks a click target that matches
 * the relaxed hit test when the hint is on.
 */
function drawHintArrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  eggCx: number,
  eggCy: number,
  scale: number,
): void {
  const dx = eggCx - x0;
  const dy = eggCy - y0;
  const len = Math.hypot(dx, dy);
  if (len < 8) return;
  const ux = dx / len;
  const uy = dy / len;
  const bullseyeR = Math.max(5, scale * 0.14);
  const stopShort = Math.max(bullseyeR + 6, scale * 0.18);
  const endX = eggCx - ux * stopShort;
  const endY = eggCy - uy * stopShort;
  const angle = Math.atan2(eggCy - y0, eggCx - x0);
  const head = 12;

  ctx.strokeStyle = "rgba(107, 79, 154, 0.92)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([9, 7]);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(107, 79, 154, 0.92)";
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - head * Math.cos(angle - 0.5), endY - head * Math.sin(angle - 0.5));
  ctx.lineTo(endX - head * Math.cos(angle + 0.5), endY - head * Math.sin(angle + 0.5));
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(107, 79, 154, 0.95)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(eggCx, eggCy, bullseyeR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(107, 79, 154, 0.38)";
  ctx.beginPath();
  ctx.arc(eggCx, eggCy, bullseyeR * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

/** Loose ellipse in unit egg space — backup when strict isPointInPath misses (any browser / edge pixels). */
function pointInTargetShapeLoose(cssX: number, cssY: number, egg: EggInstance): boolean {
  const dx = cssX - egg.cx;
  const dy = cssY - egg.cy;
  const c = Math.cos(-egg.rotation);
  const s = Math.sin(-egg.rotation);
  const lx = (dx * c - dy * s) / egg.scale;
  const ly = (dx * s + dy * c) / egg.scale;
  const rx = 1.02;
  const ry = 1.18;
  return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1;
}

export class Game {
  private eggs: EggInstance[] = [];
  private layoutSeed = 0xfeedface;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private won = false;
  private hintVisible = false;
  /** True during a Golden Yolk round (non-target eggs use gold palette; target preview hidden in UI). */
  private goldenYolkActive = false;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  get hasWon(): boolean {
    return this.won;
  }

  get isGoldenYolkRound(): boolean {
    return this.goldenYolkActive;
  }

  getTargetEgg(): EggInstance | undefined {
    return this.eggs.find((e) => e.isTarget);
  }

  get hintShown(): boolean {
    return this.hintVisible;
  }

  /** Logical (CSS) size used for drawing — matches canvas coordinate space after setTransform(dpr). */
  get viewWidth(): number {
    return this.width;
  }

  get viewHeight(): number {
    return this.height;
  }

  showHint(): void {
    if (this.won || this.hintVisible || this.goldenYolkActive) return;
    if (!this.getTargetEgg()) return;
    this.hintVisible = true;
    this.draw();
  }

  /** Force-shows the hint arrow regardless of game state — used on timer expiry. */
  forceShowHint(): void {
    if (!this.getTargetEgg()) return;
    this.hintVisible = true;
    this.draw();
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.width = cssWidth;
    this.height = cssHeight;
    this.dpr = dpr;
    this.layoutSeed = (Math.floor(Math.random() * 0xffffffff) >>> 0) ^ Date.now();
    this.eggs = generateDenseLayout(cssWidth, cssHeight, this.layoutSeed);
    if (this.goldenYolkActive) applyGoldYolkToNonTargets(this.eggs);
    this.won = false;
    this.hintVisible = false;
    this.draw();
  }

  newRound(goldenYolkRound = false): void {
    this.goldenYolkActive = goldenYolkRound;
    this.layoutSeed = (this.layoutSeed * 1664525 + 1013904223) >>> 0;
    this.eggs = generateDenseLayout(this.width, this.height, this.layoutSeed);
    if (goldenYolkRound) applyGoldYolkToNonTargets(this.eggs);
    this.won = false;
    this.hintVisible = false;
    this.draw();
  }

  draw(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx || this.width <= 0 || this.height <= 0) return;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#f3e8f7";
    ctx.fillRect(0, 0, this.width, this.height);
    const bg = ctx.createLinearGradient(0, 0, this.width, this.height);
    bg.addColorStop(0, "rgba(255,255,255,0.35)");
    bg.addColorStop(0.5, "rgba(252,248,255,0.28)");
    bg.addColorStop(1, "rgba(255,252,245,0.32)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.width, this.height);

    const sorted = [...this.eggs].sort((a, b) => a.z - b.z);
    for (const egg of sorted) {
      ctx.save();
      ctx.translate(egg.cx, egg.cy);
      drawEgg(ctx, egg.style, egg.scale, egg.rotation);
      ctx.restore();
    }

    if (this.hintVisible) {
      const t = this.getTargetEgg();
      if (t) {
        const cx = this.width * 0.5;
        const cy = this.height * 0.5;
        drawHintArrow(ctx, cx, cy, t.cx, t.cy, t.scale);
      }
    }
  }

  private isPointOnEgg(cssX: number, cssY: number, egg: EggInstance, ctx: CanvasRenderingContext2D): boolean {
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(egg.cx, egg.cy);
    ctx.rotate(egg.rotation);
    ctx.scale(egg.scale, egg.scale);
    traceEggPath(ctx);
    let hit = ctx.isPointInPath(cssX, cssY);
    ctx.restore();
    if (!hit && egg.isTarget) {
      hit = pointInTargetShapeLoose(cssX, cssY, egg);
    }
    return hit;
  }

  /**
   * Logical coordinates in the same space as egg.cx / egg.cy (CSS px, 0..viewWidth/Height).
   * Must check every egg: the target is often under other eggs; the topmost hit alone would miss it.
   */
  handlePointer(cssX: number, cssY: number, onWin: () => void, onWrongEgg?: () => void): void {
    if (this.won) return;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    let targetHit = false;
    let wrongHit = false;
    for (const egg of this.eggs) {
      const hit = this.isPointOnEgg(cssX, cssY, egg, ctx);
      if (!hit) continue;
      if (egg.isTarget) targetHit = true;
      else wrongHit = true;
    }

    if (targetHit) {
      this.won = true;
      onWin();
      return;
    }
    if (wrongHit) onWrongEgg?.();
  }
}
