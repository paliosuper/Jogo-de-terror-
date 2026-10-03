import type { Input } from "../core/input";
import { moveWithCollision, type Rect } from "../core/rect";

export type PlayerState = "IDLE" | "WALK" | "RUN";

export interface PlayerOptions {
  x: number;
  y: number;
  w?: number;
  h?: number;
  baseSpeed?: number;
  runMultiplier?: number;
}

/**
 * Placeholder player: a colored rectangle with a facing marker.
 * Rendering is done externally so a spritesheet can replace it later
 * without touching movement/collision logic.
 */
export class Player {
  x: number;
  y: number;
  readonly w: number;
  readonly h: number;

  /** Configurable base speed in px/s (walk). */
  baseSpeed: number;
  /** Extra multiplier applied while running. */
  runMultiplier: number;

  state: PlayerState = "IDLE";
  facing: "up" | "down" | "left" | "right" = "down";

  private movementMultiplier = 1;

  constructor(options: PlayerOptions) {
    this.x = options.x;
    this.y = options.y;
    this.w = options.w ?? 22;
    this.h = options.h ?? 26;
    this.baseSpeed = options.baseSpeed ?? 170;
    this.runMultiplier = options.runMultiplier ?? 1.6;
  }

  /** Temporarily slows down (or speeds up) the player. Never locks controls. */
  setMovementMultiplier(value: number): void {
    if (!Number.isFinite(value) || value < 0) {
      console.warn(`[player] invalid movement multiplier ignored: ${value}`);
      return;
    }
    this.movementMultiplier = value;
  }

  getMovementMultiplier(): number {
    return this.movementMultiplier;
  }

  /** Effective px/s for the current state. */
  get currentSpeed(): number {
    const run = this.state === "RUN" ? this.runMultiplier : 1;
    return this.baseSpeed * run * this.movementMultiplier;
  }

  get rect(): Rect {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  get centerX(): number {
    return this.x + this.w / 2;
  }

  get centerY(): number {
    return this.y + this.h / 2;
  }

  update(dt: number, input: Input, solids: readonly Rect[]): void {
    let dx = 0;
    let dy = 0;
    if (input.isDown("KeyW", "ArrowUp")) dy -= 1;
    if (input.isDown("KeyS", "ArrowDown")) dy += 1;
    if (input.isDown("KeyA", "ArrowLeft")) dx -= 1;
    if (input.isDown("KeyD", "ArrowRight")) dx += 1;

    const moving = dx !== 0 || dy !== 0;
    if (!moving) {
      this.state = "IDLE";
      return;
    }

    const running = input.isDown("ShiftLeft", "ShiftRight");
    this.state = running ? "RUN" : "WALK";

    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }

    if (dx > 0) this.facing = "right";
    else if (dx < 0) this.facing = "left";
    else if (dy > 0) this.facing = "down";
    else if (dy < 0) this.facing = "up";

    const step = this.currentSpeed * dt;
    const next = moveWithCollision({ x: this.x, y: this.y }, this.w, this.h, dx * step, dy * step, solids);
    this.x = next.x;
    this.y = next.y;
  }
}
