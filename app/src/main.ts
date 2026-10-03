import "./style.css";
import { Camera } from "./game/core/camera";
import { Input } from "./game/core/input";
import { rectsOverlap, type Rect } from "./game/core/rect";
import { InteractionSystem, type Interactable } from "./game/interact/interaction";
import { OpeningSequence } from "./game/opening/opening";
import { Transmission } from "./game/narrative/transmission";
import { drawParallax, drawParallaxForeground } from "./game/parallax/parallax";
import { Player } from "./game/player/player";
import {
  drawFallingBox,
  drawFloor,
  drawInteractables,
  drawPlayer,
  drawWindowFrame,
} from "./game/render/worldRenderer";
import { createWorld, type Floor } from "./game/world/world";

type GamePhase = "opening" | "control" | "transmission";

interface GameStatus {
  floorId: string;
  phase: GamePhase;
  openingPhase: string;
  radioOn: boolean;
  transmissionActive: boolean;
  transcript: string[];
  box: { x: number; y: number } | null;
}

declare global {
  interface Window {
    /** Programmatic access for debugging and automated checks. */
    __frequency17?: {
      player: Player;
      camera: Camera;
      input: Input;
      interactions: InteractionSystem;
      setMovementMultiplier: (value: number) => void;
      getMovementMultiplier: () => number;
      getCurrentSpeed: () => number;
      getGameStatus: () => GameStatus;
    };
  }
}

function requireCtx2d(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = target.getContext("2d");
  if (!context) throw new Error("2D canvas context unavailable");
  return context;
}

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = requireCtx2d(canvas);

// ---------------------------------------------------------------------------
// World / actors
// ---------------------------------------------------------------------------
const world = createWorld();
let floorId = world.startFloor;
const currentFloor = (): Floor => world.floors[floorId];

const input = new Input();
const start = currentFloor().start;
const player = new Player({ x: start.x, y: start.y });
const camera = new Camera(1, 1, currentFloor().width, currentFloor().height);
const interactions = new InteractionSystem();
const opening = new OpeningSequence();
const transmission = new Transmission();

let radioOn = false;
let phase: GamePhase = "opening";
let boxRegistered = false;

const RADIO_RECT: Rect = { x: 1200, y: 392, w: 80, h: 40 };
const radioItem: Interactable = {
  id: "tower-radio",
  label: "TOWER RADIO",
  rect: RADIO_RECT,
  visualState: () => (radioOn ? "on" : "off"),
  onInteract: () => ({
    message: radioOn ? "FREQUENCY 17 · SIGNAL ACTIVE" : "SILENT",
  }),
};
interactions.register(radioItem);

function registerBox(): void {
  const item: Interactable = {
    id: "fallen-box",
    label: "PICK UP BOX",
    rect: opening.boxRect(),
    onInteract: () => {
      interactions.remove("fallen-box");
      boxRegistered = false;
      opening.boxVisible = false;
      radioOn = true;
      transmission.start();
      phase = "transmission";
      return { message: "ETIQUETA: FREQUENCY 17" };
    },
  };
  interactions.register(item);
  boxRegistered = true;
}

// ---------------------------------------------------------------------------
// Floor transitions (fade)
// ---------------------------------------------------------------------------
const fade = {
  active: false,
  t: 0,
  dur: 0.4,
  swapped: false,
  pending: null as (() => void) | null,
};

function switchFloor(to: string, spawn: { x: number; y: number }): void {
  floorId = to;
  player.x = spawn.x;
  player.y = spawn.y;
  const floor = currentFloor();
  camera.worldWidth = floor.width;
  camera.worldHeight = floor.height;
  camera.follow(player.centerX, player.centerY);
}

function startTransition(to: string, spawn: { x: number; y: number }): void {
  if (fade.active) return;
  fade.active = true;
  fade.t = 0;
  fade.swapped = false;
  fade.pending = () => switchFloor(to, spawn);
}

function updateFade(dt: number): void {
  if (!fade.active) return;
  fade.t += dt;
  const half = fade.dur / 2;
  if (!fade.swapped && fade.t >= half) {
    fade.pending?.();
    fade.swapped = true;
    fade.pending = null;
  }
  if (fade.t >= fade.dur) {
    fade.active = false;
    fade.t = 0;
  }
}

function fadeAlpha(): number {
  if (!fade.active) return 0;
  const half = fade.dur / 2;
  return fade.t < half ? fade.t / half : Math.max(0, 1 - (fade.t - half) / half);
}

// ---------------------------------------------------------------------------
// Viewport / input
// ---------------------------------------------------------------------------
let viewW = 1;
let viewH = 1;
let dpr = 1;

function resize(): void {
  dpr = window.devicePixelRatio || 1;
  viewW = Math.max(1, window.innerWidth);
  viewH = Math.max(1, window.innerHeight);
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  camera.resize(viewW, viewH);
}
window.addEventListener("resize", resize);
resize();
input.attach();

// ---------------------------------------------------------------------------
// HUD toast
// ---------------------------------------------------------------------------
const toast = { text: "", time: 0, max: 1 };

function showToast(text: string, seconds: number): void {
  toast.text = text;
  toast.time = seconds;
  toast.max = seconds;
}

const COLORS = {
  bg: "#0b0d10",
  sky: "#05070d",
  text: "#9fb0c0",
  textBright: "#e6edf3",
  accent: "#e7c079",
} as const;

function hudLine(text: string, x: number, y: number, color: string, size = 13): void {
  ctx.fillStyle = color;
  ctx.font = `${size}px 'Courier New', monospace`;
  ctx.textAlign = "left";
  ctx.fillText(text, x, y);
}

function drawHud(floor: Floor, near: Interactable | null): void {
  // top-left status panel
  ctx.fillStyle = "rgba(5, 7, 10, 0.72)";
  ctx.fillRect(12, 12, 364, 136);
  hudLine("FREQUENCY 17  ·  ETAPA 2", 24, 34, COLORS.accent, 14);
  hudLine(`ÁREA    ${floor.name}`, 24, 58, COLORS.textBright);
  hudLine(`STATE   ${player.state}`, 24, 82, COLORS.textBright);
  hudLine(
    `SPEED   ${player.currentSpeed.toFixed(0)} px/s   mult ${player.getMovementMultiplier().toFixed(2)}`,
    24,
    106,
    COLORS.text,
  );
  hudLine(`POS     ${player.x.toFixed(0)}, ${player.y.toFixed(0)}`, 24, 130, COLORS.text);

  // top-right controls
  ctx.fillStyle = "rgba(5, 7, 10, 0.72)";
  ctx.fillRect(viewW - 232, 12, 220, 76);
  hudLine("WASD / ARROWS   MOVE", viewW - 220, 34, COLORS.text);
  hudLine("SHIFT           RUN", viewW - 220, 56, COLORS.text);
  hudLine("E               INTERACT", viewW - 220, 78, COLORS.text);

  // radio indicator (after the first transmission)
  if (radioOn) {
    ctx.fillStyle = "rgba(5, 7, 10, 0.72)";
    ctx.fillRect(12, viewH - 52, 250, 34);
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    ctx.fillStyle = blink ? "#4fd1a0" : "#2f6f5e";
    ctx.beginPath();
    ctx.arc(30, viewH - 35, 5, 0, Math.PI * 2);
    ctx.fill();
    hudLine("RADIO: FREQUENCY 17", 44, viewH - 30, "#4fd1a0", 14);
  }

  // interaction prompt
  if (near && phase !== "transmission") {
    const prompt = `[E]  ${near.label}`;
    ctx.font = "14px 'Courier New', monospace";
    const w = ctx.measureText(prompt).width + 32;
    const x = (viewW - w) / 2;
    const y = viewH - 64;
    ctx.fillStyle = "rgba(5, 7, 10, 0.85)";
    ctx.fillRect(x, y, w, 30);
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 29);
    hudLine(prompt, x + 16, y + 20, COLORS.accent, 14);
  }

  // toast message (fades out)
  if (toast.time > 0) {
    const alpha = Math.min(1, toast.time / Math.min(0.6, toast.max));
    ctx.globalAlpha = alpha;
    ctx.font = "15px 'Courier New', monospace";
    const w = ctx.measureText(toast.text).width + 32;
    ctx.fillStyle = "rgba(5, 7, 10, 0.85)";
    ctx.fillRect((viewW - w) / 2, viewH - 110, w, 30);
    hudLine(toast.text, (viewW - w) / 2 + 16, viewH - 90, COLORS.textBright, 15);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
let gameTime = 0;

function render(): void {
  const floor = currentFloor();
  const camOffX = Math.round(camera.x) + camera.shakeX;
  const camOffY = Math.round(camera.y) + camera.shakeY;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = floor.kind === "exterior" ? COLORS.sky : COLORS.bg;
  ctx.fillRect(0, 0, viewW, viewH);

  // back parallax layers (sky, moon/stars, mountains, forests, near trees)
  if (floor.kind === "exterior") {
    const horizonY = (floor.horizonY ?? 300) - camOffY;
    drawParallax(ctx, camera, viewW, viewH, { horizonY });
  }

  const near = interactions.nearest(player.rect);

  ctx.save();
  ctx.translate(-camOffX, -camOffY);
  drawFloor(ctx, floor, gameTime);
  drawInteractables(ctx, interactions.all, near);
  if (phase === "opening" && opening.boxVisible) drawFallingBox(ctx, opening.box);
  drawPlayer(ctx, player);
  ctx.restore();

  // window views reuse the same parallax layers (clipped)
  for (const w of floor.windows) {
    const sx = w.x - camOffX;
    const sy = w.y - camOffY;
    if (sx > viewW || sy > viewH || sx + w.w < 0 || sy + w.h < 0) continue;
    const horizon = sy + w.h * 0.62;
    drawParallax(ctx, camera, viewW, viewH, {
      clip: { x: sx, y: sy, w: w.w, h: w.h },
      horizonY: horizon,
      refY: horizon,
    });
    drawWindowFrame(ctx, sx, sy, w.w, w.h);
  }

  // foreground layer (7th) after the world
  if (floor.kind === "exterior") {
    drawParallaxForeground(ctx, camera, viewW, viewH);
  }

  drawHud(floor, near);
  transmission.draw(ctx, viewW, viewH, gameTime);

  const alpha = fadeAlpha();
  if (alpha > 0) {
    ctx.fillStyle = `rgba(3, 5, 8, ${alpha.toFixed(3)})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }
}

// ---------------------------------------------------------------------------
// Programmatic access
// ---------------------------------------------------------------------------
window.__frequency17 = {
  player,
  camera,
  input,
  interactions,
  setMovementMultiplier: (value: number) => player.setMovementMultiplier(value),
  getMovementMultiplier: () => player.getMovementMultiplier(),
  getCurrentSpeed: () => player.currentSpeed,
  getGameStatus: () => {
    const boxItem = interactions.get("fallen-box");
    return {
      floorId,
      phase,
      openingPhase: opening.phase,
      radioOn,
      transmissionActive: transmission.active,
      transcript: [...transmission.completed],
      box: boxItem ? { x: boxItem.rect.x, y: boxItem.rect.y } : null,
    };
  },
};

// ---------------------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------------------
let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  gameTime += dt;

  camera.update(dt);

  if (phase === "opening") {
    opening.update(dt, player, camera);
    if (opening.phase === "control") {
      if (opening.boxVisible && !boxRegistered) registerBox();
      phase = "control";
    }
  } else if (phase === "transmission") {
    if (transmission.update(dt)) phase = "control";
  }

  const locked = phase !== "control" || fade.active;

  if (!locked) {
    player.update(dt, input, currentFloor().solids);

    if (input.wasPressed("KeyE")) {
      const event = interactions.interact(player.rect);
      if (event) showToast(`${event.item.label}  →  ${event.message}`, 2.5);
      else showToast("NOTHING TO INTERACT", 1.0);
    }

    if (!fade.active) {
      for (const trigger of currentFloor().triggers) {
        if (rectsOverlap(player.rect, trigger.rect)) {
          startTransition(trigger.to, trigger.spawn);
          break;
        }
      }
    }
  }
  input.endFrame();
  updateFade(dt);

  camera.follow(player.centerX, player.centerY);
  if (toast.time > 0) toast.time = Math.max(0, toast.time - dt);

  render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
