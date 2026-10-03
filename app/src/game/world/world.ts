import type { Rect } from "../core/rect";

export type TriggerKind = "stairs-up" | "stairs-down" | "door";

export interface TriggerZone {
  rect: Rect;
  to: string;
  spawn: { x: number; y: number };
  kind: TriggerKind;
}

export interface StairsRegion {
  region: Rect;
  /** chevrons point while climbing this floor's stairs */
  direction: "up" | "down";
}

export interface Floor {
  id: string;
  name: string;
  kind: "exterior" | "interior";
  width: number;
  height: number;
  solids: Rect[];
  /** subset of solids drawn as tree canopies */
  trees: Rect[];
  windows: Rect[];
  stairs?: StairsRegion;
  triggers: TriggerZone[];
  start: { x: number; y: number };
  /** exterior only: world y of the horizon */
  horizonY?: number;
  /** exterior only: decorative dirt path (no collision) */
  path?: Rect;
}

export interface World {
  floors: Record<string, Floor>;
  startFloor: string;
}

const W = 1600;
const H = 1200;

function entradaFloor(): Floor {
  const solids: Rect[] = [
    // outer walls (west wall has the door gap y560..660)
    { x: 0, y: 0, w: W, h: 32 },
    { x: 0, y: H - 32, w: W, h: 32 },
    { x: 0, y: 32, w: 32, h: 528 },
    { x: 0, y: 660, w: 32, h: 508 },
    { x: W - 32, y: 32, w: 32, h: H - 64 },
    // stairwell (open at the south, stairs continue north through the cap)
    { x: 676, y: 100, w: 24, h: 500 },
    { x: 900, y: 100, w: 24, h: 500 },
    { x: 676, y: 100, w: 248, h: 24 },
    // maintenance room (NE) with doorway gap x1240..1360
    { x: 1100, y: 150, w: 400, h: 24 },
    { x: 1100, y: 150, w: 24, h: 350 },
    { x: 1476, y: 150, w: 24, h: 350 },
    { x: 1100, y: 476, w: 140, h: 24 },
    { x: 1360, y: 476, w: 140, h: 24 },
    // crates inside maintenance
    { x: 1150, y: 230, w: 70, h: 70 },
    { x: 1330, y: 300, w: 90, h: 50 },
    { x: 1200, y: 380, w: 60, h: 40 },
  ];

  return {
    id: "entrada",
    name: "TORRE — ENTRADA",
    kind: "interior",
    width: W,
    height: H,
    solids,
    trees: [],
    windows: [],
    stairs: { region: { x: 700, y: 124, w: 200, h: 476 }, direction: "up" },
    triggers: [
      { rect: { x: 740, y: 130, w: 120, h: 70 }, to: "radio", spawn: { x: 789, y: 135 }, kind: "stairs-up" },
      { rect: { x: 0, y: 560, w: 72, h: 100 }, to: "exterior", spawn: { x: 610, y: 690 }, kind: "door" },
    ],
    start: { x: 789, y: 540 },
  };
}

function radioFloor(): Floor {
  const windowRect: Rect = { x: 1230, y: 180, w: 160, h: 24 };
  const solids: Rect[] = [
    // outer walls
    { x: 0, y: 0, w: W, h: 32 },
    { x: 0, y: H - 32, w: W, h: 32 },
    { x: 0, y: 32, w: 32, h: H - 64 },
    { x: W - 32, y: 32, w: 32, h: H - 64 },
    // stairwell (stairs descend south; north cap behind the top landing)
    { x: 676, y: 100, w: 24, h: 500 },
    { x: 900, y: 100, w: 24, h: 500 },
    { x: 676, y: 100, w: 248, h: 24 },
    // radio room (E) with doorway gap y330..450 on the west wall
    { x: 1050, y: 180, w: 180, h: 24 },
    { x: 1390, y: 180, w: 130, h: 24 },
    windowRect,
    { x: 1050, y: 180, w: 24, h: 150 },
    { x: 1050, y: 450, w: 24, h: 170 },
    { x: 1496, y: 180, w: 24, h: 440 },
    { x: 1050, y: 596, w: 470, h: 24 },
    // desk (radio sits on top of it)
    { x: 1170, y: 380, w: 160, h: 60 },
  ];

  return {
    id: "radio",
    name: "TORRE — SALA DO RÁDIO",
    kind: "interior",
    width: W,
    height: H,
    solids,
    trees: [],
    windows: [windowRect],
    stairs: { region: { x: 700, y: 124, w: 200, h: 476 }, direction: "down" },
    triggers: [
      { rect: { x: 740, y: 530, w: 120, h: 70 }, to: "entrada", spawn: { x: 789, y: 210 }, kind: "stairs-down" },
    ],
    start: { x: 789, y: 135 },
  };
}

function exteriorFloor(): Floor {
  const tower: Rect[] = [
    { x: 80, y: 400, w: 24, h: 500 },
    { x: 80, y: 400, w: 500, h: 24 },
    { x: 80, y: 876, w: 500, h: 24 },
    { x: 556, y: 400, w: 24, h: 250 },
    { x: 556, y: 760, w: 24, h: 140 },
  ];
  const trees: Rect[] = [
    { x: 700, y: 480, w: 70, h: 70 },
    { x: 860, y: 640, w: 60, h: 60 },
    { x: 1080, y: 420, w: 90, h: 90 },
    { x: 1260, y: 700, w: 80, h: 80 },
    { x: 640, y: 980, w: 70, h: 70 },
    { x: 1420, y: 940, w: 90, h: 90 },
    { x: 980, y: 1060, w: 60, h: 60 },
    { x: 1180, y: 1000, w: 70, h: 70 },
  ];
  const solids: Rect[] = [
    // boundaries: north sits just above the horizon (world y300)
    { x: 0, y: 268, w: W, h: 32 },
    { x: 0, y: H - 32, w: W, h: 32 },
    { x: 0, y: 268, w: 32, h: H - 300 },
    { x: W - 32, y: 268, w: 32, h: H - 300 },
    ...tower,
    ...trees,
  ];

  return {
    id: "exterior",
    name: "ÁREA EXTERNA",
    kind: "exterior",
    width: W,
    height: H,
    solids,
    trees,
    windows: [],
    triggers: [
      { rect: { x: 530, y: 640, w: 80, h: 130 }, to: "entrada", spawn: { x: 80, y: 590 }, kind: "door" },
    ],
    start: { x: 610, y: 690 },
    horizonY: 300,
    path: { x: 580, y: 655, w: 660, h: 90 },
  };
}

export function createWorld(): World {
  const entrada = entradaFloor();
  const radio = radioFloor();
  const exterior = exteriorFloor();
  return {
    floors: { entrada, radio, exterior },
    startFloor: "entrada",
  };
}
