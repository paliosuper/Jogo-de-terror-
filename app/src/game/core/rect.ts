export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function rectCenter(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Move an AABB by (dx, dy), resolving collisions axis by axis so the
 * entity slides along walls instead of tunneling through them.
 */
export function moveWithCollision(
  pos: { x: number; y: number },
  w: number,
  h: number,
  dx: number,
  dy: number,
  solids: readonly Rect[],
): { x: number; y: number } {
  let x = pos.x + dx;
  if (dx !== 0) {
    for (const s of solids) {
      if (rectsOverlap({ x, y: pos.y, w, h }, s)) {
        x = dx > 0 ? s.x - w : s.x + s.w;
      }
    }
  }

  let y = pos.y + dy;
  if (dy !== 0) {
    for (const s of solids) {
      if (rectsOverlap({ x, y, w, h }, s)) {
        y = dy > 0 ? s.y - h : s.y + s.h;
      }
    }
  }

  return { x, y };
}
