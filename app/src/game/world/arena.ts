import type { Rect } from "../core/rect";

export interface Arena {
  width: number;
  height: number;
  solids: Rect[];
  spawn: { x: number; y: number };
}

const WALL = 32;

/**
 * Etapa 1 test arena: outer walls + a few interior blocks to prove
 * collision and camera follow. Replaced/extended by the tower in Etapa 2
 * using the same reusable-block approach.
 */
export function createArena(): Arena {
  const width = 1600;
  const height = 1200;

  const solids: Rect[] = [
    // outer walls
    { x: 0, y: 0, w: width, h: WALL },
    { x: 0, y: height - WALL, w: width, h: WALL },
    { x: 0, y: 0, w: WALL, h: height },
    { x: width - WALL, y: 0, w: WALL, h: height },
    // interior blocks (placeholders for tower walls/corridors)
    { x: 300, y: 220, w: 360, h: 24 },
    { x: 300, y: 220, w: 24, h: 300 },
    { x: 820, y: 96, w: 24, h: 360 },
    { x: 620, y: 640, w: 420, h: 24 },
    { x: 1140, y: 300, w: 300, h: 24 },
    { x: 1140, y: 300, w: 24, h: 420 },
    { x: 470, y: 900, w: 24, h: 220 },
    { x: 900, y: 980, w: 320, h: 24 },
  ];

  return {
    width,
    height,
    solids,
    spawn: { x: 140, y: 1040 },
  };
}
