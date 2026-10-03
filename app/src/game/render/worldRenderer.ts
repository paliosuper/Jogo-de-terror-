import type { Rect } from "../core/rect";
import type { Player, PlayerState } from "../player/player";
import type { Interactable } from "../interact/interaction";
import type { Floor } from "../world/world";

const COLORS = {
  interiorFloor: "#10141a",
  interiorGrid: "rgba(159, 176, 192, 0.05)",
  roomTint: "#0d1117",
  stairTint: "#151a22",
  stairStep: "rgba(159, 176, 192, 0.16)",
  stairChevron: "rgba(231, 192, 121, 0.35)",
  wallFill: "#141a22",
  wallStroke: "#2b3442",
  stoneFill: "#171a1f",
  stoneStroke: "#3a4149",
  ground: "#0e1a16",
  groundGrid: "rgba(120, 160, 130, 0.045)",
  path: "#22302a",
  treeCanopy: "#0a1a17",
  treeTrunk: "#141210",
  boundary: "#08110f",
  doorThreshold: "#3a3126",
  doorFrame: "#e7c079",
  windowFrame: "#5a6478",
  windowGlow: "rgba(90, 100, 120, 0.25)",
  antenna: "#39414f",
  antennaLight: "#d9534f",
  relayOff: "#39414f",
  relayOffStroke: "#5a6478",
  relayOn: "#4fd1a0",
  text: "#9fb0c0",
  accent: "#e7c079",
} as const;

export const PLAYER_COLORS: Record<PlayerState, string> = {
  IDLE: "#8fa7b8",
  WALK: "#bcd4e2",
  RUN: "#e7c079",
};

function drawGrid(ctx: CanvasRenderingContext2D, floor: Floor): void {
  ctx.strokeStyle = floor.kind === "exterior" ? COLORS.groundGrid : COLORS.interiorGrid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= floor.width; x += 64) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, floor.height);
  }
  for (let y = 0; y <= floor.height; y += 64) {
    ctx.moveTo(0, y);
    ctx.lineTo(floor.width, y);
  }
  ctx.stroke();
}

function drawStairs(ctx: CanvasRenderingContext2D, floor: Floor): void {
  if (!floor.stairs) return;
  const { region, direction } = floor.stairs;

  ctx.fillStyle = COLORS.stairTint;
  ctx.fillRect(region.x, region.y, region.w, region.h);

  // steps
  ctx.strokeStyle = COLORS.stairStep;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = region.y + 8; y < region.y + region.h; y += 28) {
    ctx.moveTo(region.x + 6, y);
    ctx.lineTo(region.x + region.w - 6, y);
  }
  ctx.stroke();

  // chevrons pointing toward the destination
  ctx.strokeStyle = COLORS.stairChevron;
  ctx.lineWidth = 3;
  for (let y = region.y + 60; y < region.y + region.h - 40; y += 120) {
    const dir = direction === "up" ? -1 : 1;
    const cx = region.x + region.w / 2;
    ctx.beginPath();
    ctx.moveTo(cx - 16, y);
    ctx.lineTo(cx, y + dir * 14);
    ctx.lineTo(cx + 16, y);
    ctx.stroke();
  }
}

function drawDoors(ctx: CanvasRenderingContext2D, floor: Floor): void {
  for (const trigger of floor.triggers) {
    if (trigger.kind !== "door") continue;
    const r = trigger.rect;
    ctx.fillStyle = COLORS.doorThreshold;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = COLORS.doorFrame;
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  }
}

function drawTree(ctx: CanvasRenderingContext2D, t: Rect): void {
  const cx = t.x + t.w / 2;
  const cy = t.y + t.h / 2;
  ctx.fillStyle = COLORS.treeTrunk;
  ctx.fillRect(cx - 4, cy - 4, 8, t.h / 2 + 6);
  ctx.fillStyle = COLORS.treeCanopy;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(t.w, t.h) / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(120, 160, 140, 0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawExteriorExtras(ctx: CanvasRenderingContext2D, floor: Floor, time: number): void {
  // dirt path from the tower door
  if (floor.path) {
    ctx.fillStyle = COLORS.path;
    ctx.fillRect(floor.path.x, floor.path.y, floor.path.w, floor.path.h);
  }

  // antenna on top of the tower with a blinking light
  const poleX = 330;
  ctx.strokeStyle = COLORS.antenna;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(poleX, 402);
  ctx.lineTo(poleX, 320);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(poleX - 18, 350);
  ctx.lineTo(poleX + 18, 350);
  ctx.stroke();
  const blink = Math.floor(time * 1.6) % 2 === 0;
  ctx.fillStyle = blink ? COLORS.antennaLight : "#3a1f1f";
  ctx.beginPath();
  ctx.arc(poleX, 316, 6, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw the floor's ground, walls and decor. Call inside the world transform. */
export function drawFloor(
  ctx: CanvasRenderingContext2D,
  floor: Floor,
  time: number,
): void {
  // ground
  if (floor.kind === "exterior") {
    const horizon = floor.horizonY ?? 300;
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, horizon, floor.width, floor.height - horizon);
  } else {
    ctx.fillStyle = COLORS.interiorFloor;
    ctx.fillRect(0, 0, floor.width, floor.height);
    // room tints (maintenance on entrada, radio room on radio)
    if (floor.id === "entrada") {
      ctx.fillStyle = COLORS.roomTint;
      ctx.fillRect(1124, 174, 352, 326);
    } else if (floor.id === "radio") {
      ctx.fillStyle = COLORS.roomTint;
      ctx.fillRect(1074, 204, 422, 392);
    }
    // stairwell tint
    if (floor.stairs) {
      ctx.fillStyle = COLORS.stairTint;
      ctx.fillRect(
        floor.stairs.region.x - 24,
        floor.stairs.region.y - 24,
        floor.stairs.region.w + 48,
        floor.stairs.region.h + 48,
      );
    }
  }
  drawGrid(ctx, floor);

  if (floor.kind === "exterior") drawExteriorExtras(ctx, floor, time);
  drawStairs(ctx, floor);
  drawDoors(ctx, floor);

  // walls (trees are drawn as canopies instead of blocks)
  const treeSet = new Set(floor.trees);
  const isExterior = floor.kind === "exterior";
  for (const s of floor.solids) {
    if (treeSet.has(s)) continue;
    ctx.fillStyle = isExterior ? COLORS.stoneFill : COLORS.wallFill;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = isExterior ? COLORS.stoneStroke : COLORS.wallStroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
  }
  if (isExterior) for (const t of floor.trees) drawTree(ctx, t);
}

/** Interactable placeholder: colored square + label + highlight when in reach. */
export function drawInteractables(
  ctx: CanvasRenderingContext2D,
  items: readonly Interactable[],
  near: Interactable | null,
): void {
  for (const item of items) {
    const on = item.visualState?.() === "on";
    const r = item.rect;
    ctx.fillStyle = on ? COLORS.relayOn : COLORS.relayOff;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = near === item ? COLORS.accent : on ? COLORS.relayOn : COLORS.relayOffStroke;
    ctx.lineWidth = near === item ? 2 : 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

    if (on) {
      // signal waves for active devices (radio)
      ctx.strokeStyle = "rgba(79, 209, 160, 0.5)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(r.x + r.w, r.y + r.h / 2, 10 + i * 9, -0.9, 0.9);
        ctx.stroke();
      }
    }

    ctx.fillStyle = near === item ? COLORS.accent : COLORS.text;
    ctx.font = "12px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(item.label, r.x + r.w / 2, r.y - 8);
    ctx.textAlign = "left";
  }
}

/** Placeholder player: colored rectangle + facing marker. */
export function drawPlayer(ctx: CanvasRenderingContext2D, player: Player): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.fillRect(player.x + 3, player.y + player.h - 2, player.w, 5);

  ctx.fillStyle = PLAYER_COLORS[player.state];
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.strokeStyle = "rgba(230, 237, 243, 0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(player.x + 0.5, player.y + 0.5, player.w - 1, player.h - 1);

  ctx.fillStyle = "#0b0d10";
  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;
  switch (player.facing) {
    case "up":
      ctx.fillRect(cx - 5, player.y + 3, 10, 4);
      break;
    case "down":
      ctx.fillRect(cx - 5, player.y + player.h - 7, 10, 4);
      break;
    case "left":
      ctx.fillRect(player.x + 3, cy - 5, 4, 10);
      break;
    case "right":
      ctx.fillRect(player.x + player.w - 7, cy - 5, 4, 10);
      break;
  }
}

/** Falling box (before it becomes an interactable). */
export function drawFallingBox(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number; angle: number },
): void {
  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
  ctx.rotate(box.angle);
  ctx.fillStyle = "#6b5842";
  ctx.fillRect(-box.w / 2, -box.h / 2, box.w, box.h);
  ctx.strokeStyle = "#8a7458";
  ctx.lineWidth = 1;
  ctx.strokeRect(-box.w / 2 + 0.5, -box.h / 2 + 0.5, box.w - 1, box.h - 1);
  ctx.fillStyle = "#d9cfbc";
  ctx.fillRect(-box.w / 2 + 4, -3, box.w - 8, 6);
  ctx.fillStyle = "#2a2118";
  ctx.font = "bold 6px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText("17", 0, 2);
  ctx.textAlign = "left";
  ctx.restore();
}

/** Window frame drawn over the parallax view (screen space). */
export function drawWindowFrame(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  w: number,
  h: number,
): void {
  ctx.strokeStyle = COLORS.windowFrame;
  ctx.lineWidth = 2;
  ctx.strokeRect(sx + 1, sy + 1, w - 2, h - 2);
  ctx.strokeStyle = COLORS.windowGlow;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx + w / 2, sy + 2);
  ctx.lineTo(sx + w / 2, sy + h - 2);
  ctx.moveTo(sx + 2, sy + h / 2);
  ctx.lineTo(sx + w - 2, sy + h / 2);
  ctx.stroke();
}
