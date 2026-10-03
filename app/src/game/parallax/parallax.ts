import type { Camera } from "../core/camera";

/**
 * 7-layer parallax (placeholders: shapes + colors only).
 * Layers are drawn in screen space, anchored to the horizon with a
 * per-layer weight (vertical depth) and a per-layer factor (horizontal
 * speed). The same module is reused for the exterior background and for
 * views through the tower windows (pass a `clip` rect).
 */
export interface ParallaxLayer {
  id: string;
  name: string;
  /** horizontal scroll speed relative to the camera (0 = screen-fixed) */
  factor: number;
  /** how strongly the layer follows the horizon vertically (0..1) */
  weight: number;
}

export const LAYERS: readonly ParallaxLayer[] = [
  { id: "sky", name: "céu", factor: 0.0, weight: 0.1 },
  { id: "stars", name: "lua e estrelas", factor: 0.03, weight: 0.15 },
  { id: "mountains", name: "montanhas distantes", factor: 0.08, weight: 0.35 },
  { id: "forestFar", name: "floresta distante", factor: 0.16, weight: 0.52 },
  { id: "forestMid", name: "floresta intermediária", factor: 0.28, weight: 0.68 },
  { id: "treesNear", name: "árvores próximas", factor: 0.45, weight: 0.85 },
  { id: "foreground", name: "foreground", factor: 0.8, weight: 1.0 },
];

const COLORS = {
  skyTop: "#05070d",
  skyMid: "#0c1826",
  skyLow: "#153238",
  belowHorizon: "#0a1416",
  stars: "#cfe3ee",
  moon: "#e8eef2",
  moonGlow: "rgba(207, 227, 238, 0.12)",
  mountains: "#182636",
  forestFar: "#132a31",
  forestMid: "#0f2427",
  treesNear: "#0a1a1b",
  foreground: "#04060a",
} as const;

/** Stable pseudo-random in [0,1) — deterministic across frames. */
function hash(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const STARS = Array.from({ length: 72 }, (_, i) => ({
  x: hash(i) * 2400,
  y: hash(i + 101),
  size: hash(i + 7) > 0.85 ? 3 : 2,
  alpha: 0.35 + hash(i + 13) * 0.65,
}));

export interface ParallaxClip {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ParallaxOptions {
  /** screen-space rect to clip into (window views) */
  clip?: ParallaxClip;
  /** screen-space y of the horizon (default: 42% of view height) */
  horizonY?: number;
  /** reference horizon for weight math (default: horizonY) */
  refY?: number;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function layerAnchorY(layer: ParallaxLayer, horizonY: number, refY: number): number {
  return refY + (horizonY - refY) * layer.weight;
}

interface BandArgs {
  cam: Camera;
  bounds: { x: number; y: number; w: number; h: number };
  horizonY: number;
  refY: number;
  layer: ParallaxLayer;
  bottomOffset: number;
  tileW: number;
  drawTile: (ctx: CanvasRenderingContext2D, x: number, bottom: number, index: number) => void;
}

function drawBand(ctx: CanvasRenderingContext2D, args: BandArgs): void {
  const { cam, bounds, horizonY, refY, layer, bottomOffset, tileW, drawTile } = args;
  const bottom = layerAnchorY(layer, horizonY, refY) + bottomOffset;
  const offset = cam.x * layer.factor;
  const firstTile = Math.floor((offset + bounds.x) / tileW) - 1;
  const lastTile = Math.floor((offset + bounds.x + bounds.w) / tileW) + 1;
  for (let i = firstTile; i <= lastTile; i++) {
    const x = bounds.x + i * tileW - offset;
    drawTile(ctx, x, bottom, i);
  }
}

/** Layers 0..5: sky, stars/moon, mountains, forests, near trees. */
export function drawParallax(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  viewW: number,
  viewH: number,
  options: ParallaxOptions = {},
): void {
  const horizonY = options.horizonY ?? viewH * 0.42;
  const refY = options.refY ?? horizonY;
  const clip = options.clip;
  const bounds = clip ?? { x: 0, y: 0, w: viewW, h: viewH };

  ctx.save();
  if (clip) {
    ctx.beginPath();
    ctx.rect(clip.x, clip.y, clip.w, clip.h);
    ctx.clip();
  }

  // 1. sky
  const skyBottom = Math.max(bounds.y, horizonY);
  const grad = ctx.createLinearGradient(0, bounds.y, 0, skyBottom + 8);
  grad.addColorStop(0, COLORS.skyTop);
  grad.addColorStop(0.6, COLORS.skyMid);
  grad.addColorStop(1, COLORS.skyLow);
  ctx.fillStyle = grad;
  ctx.fillRect(bounds.x, bounds.y, bounds.w, skyBottom - bounds.y + 8);

  // below the horizon: distant ground
  ctx.fillStyle = COLORS.belowHorizon;
  const belowTop = Math.max(bounds.y, horizonY);
  ctx.fillRect(bounds.x, belowTop, bounds.w, bounds.y + bounds.h - belowTop);

  // 2. stars + moon
  const starLayer = LAYERS[1];
  const starField = bounds.w + 600;
  const starOffset = cam.x * starLayer.factor;
  const starSpan = Math.max(40, skyBottom - bounds.y - 10);
  ctx.save();
  for (const star of STARS) {
    const sx = bounds.x + mod(star.x - starOffset, starField) - 300;
    if (sx < bounds.x - 4 || sx > bounds.x + bounds.w + 4) continue;
    const sy = bounds.y + star.y * starSpan;
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = COLORS.stars;
    ctx.fillRect(sx, sy, star.size, star.size);
  }
  ctx.globalAlpha = 1;
  // moon
  const moonX = bounds.x + bounds.w * 0.72 - mod(cam.x * 0.015, starField);
  const moonY = bounds.y + starSpan * 0.28;
  if (moonX > bounds.x - 60 && moonX < bounds.x + bounds.w + 60) {
    ctx.fillStyle = COLORS.moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.moon;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.skyMid;
    ctx.beginPath();
    ctx.arc(moonX + 9, moonY - 6, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3. distant mountains
  drawBand(ctx, {
    cam,
    bounds,
    horizonY,
    refY,
    layer: LAYERS[2],
    bottomOffset: 0,
    tileW: 420,
    drawTile: (c, x, bottom, idx) => {
      c.fillStyle = COLORS.mountains;
      c.beginPath();
      c.moveTo(x, bottom);
      c.lineTo(x + 90 + hash(idx) * 60, bottom - (90 + hash(idx + 5) * 90));
      c.lineTo(x + 200, bottom - (50 + hash(idx + 9) * 50));
      c.lineTo(x + 300 + hash(idx + 3) * 50, bottom - (110 + hash(idx + 11) * 80));
      c.lineTo(x + 420, bottom - 30);
      c.lineTo(x + 420, bottom);
      c.closePath();
      c.fill();
    },
  });

  // 4. far forest
  drawBand(ctx, {
    cam,
    bounds,
    horizonY,
    refY,
    layer: LAYERS[3],
    bottomOffset: 6,
    tileW: 240,
    drawTile: (c, x, bottom, idx) => {
      c.fillStyle = COLORS.forestFar;
      for (let s = 0; s < 240; s += 22) {
        const h = 34 + hash(idx * 17 + s) * 26;
        c.beginPath();
        c.moveTo(x + s, bottom);
        c.lineTo(x + s + 9, bottom - h);
        c.lineTo(x + s + 18, bottom);
        c.closePath();
        c.fill();
      }
    },
  });

  // 5. mid forest
  drawBand(ctx, {
    cam,
    bounds,
    horizonY,
    refY,
    layer: LAYERS[4],
    bottomOffset: 18,
    tileW: 300,
    drawTile: (c, x, bottom, idx) => {
      c.fillStyle = COLORS.forestMid;
      for (let s = 0; s < 300; s += 32) {
        const h = 66 + hash(idx * 23 + s) * 44;
        c.beginPath();
        c.moveTo(x + s, bottom);
        c.lineTo(x + s + 13, bottom - h);
        c.lineTo(x + s + 26, bottom);
        c.closePath();
        c.fill();
      }
    },
  });

  // 6. near trees
  drawBand(ctx, {
    cam,
    bounds,
    horizonY,
    refY,
    layer: LAYERS[5],
    bottomOffset: 44,
    tileW: 380,
    drawTile: (c, x, bottom, idx) => {
      c.fillStyle = COLORS.treesNear;
      for (let s = 0; s < 380; s += 64) {
        const h = 110 + hash(idx * 31 + s) * 70;
        c.beginPath();
        c.moveTo(x + s, bottom);
        c.lineTo(x + s + 24, bottom - h);
        c.lineTo(x + s + 48, bottom);
        c.closePath();
        c.fill();
        c.fillRect(x + s + 20, bottom - 14, 8, 16);
      }
    },
  });

  ctx.restore();
}

/** Layer 7: foreground silhouettes, drawn after the world (screen space). */
export function drawParallaxForeground(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  viewW: number,
  viewH: number,
  options: ParallaxOptions = {},
): void {
  const clip = options.clip;
  const bounds = clip ?? { x: 0, y: 0, w: viewW, h: viewH };
  const layer = LAYERS[6];

  ctx.save();
  if (clip) {
    ctx.beginPath();
    ctx.rect(clip.x, clip.y, clip.w, clip.h);
    ctx.clip();
  }

  const bandH = Math.min(140, bounds.h * 0.2);
  const top = bounds.y + bounds.h - bandH;
  const grad = ctx.createLinearGradient(0, top, 0, bounds.y + bounds.h);
  grad.addColorStop(0, "rgba(4, 6, 10, 0)");
  grad.addColorStop(1, "rgba(4, 6, 10, 0.92)");
  ctx.fillStyle = grad;
  ctx.fillRect(bounds.x, top, bounds.w, bandH);

  // grass/branch silhouettes scrolling fast
  const offset = cam.x * layer.factor;
  const tileW = 96;
  const firstTile = Math.floor((offset + bounds.x) / tileW) - 1;
  const lastTile = Math.floor((offset + bounds.x + bounds.w) / tileW) + 1;
  ctx.fillStyle = COLORS.foreground;
  for (let i = firstTile; i <= lastTile; i++) {
    const x = bounds.x + i * tileW - offset;
    const blades = 2 + Math.floor(hash(i) * 3);
    for (let b = 0; b < blades; b++) {
      const bx = x + hash(i * 7 + b) * tileW;
      const bh = 18 + hash(i * 13 + b) * 34;
      const bw = 6 + hash(i * 19 + b) * 8;
      ctx.beginPath();
      ctx.moveTo(bx, bounds.y + bounds.h);
      ctx.lineTo(bx + bw / 2, bounds.y + bounds.h - bh);
      ctx.lineTo(bx + bw, bounds.y + bounds.h);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}
