import { clamp } from "./rect";

/**
 * Camera that follows a target (player center) and stays inside world bounds.
 * Screen-space hooks (shake, fade, zoom) are added in later etapas.
 */
export class Camera {
  x = 0;
  y = 0;

  private shakeMag = 0;
  private shakeTime = 0;
  private shakeDur = 1;

  constructor(
    public viewWidth: number,
    public viewHeight: number,
    public worldWidth: number,
    public worldHeight: number,
  ) {}

  follow(targetX: number, targetY: number): void {
    this.x = clamp(targetX - this.viewWidth / 2, 0, Math.max(0, this.worldWidth - this.viewWidth));
    this.y = clamp(targetY - this.viewHeight / 2, 0, Math.max(0, this.worldHeight - this.viewHeight));
  }

  resize(viewWidth: number, viewHeight: number): void {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
  }

  /** Small damped shake; strongest request wins. */
  addShake(magnitude: number, seconds: number): void {
    if (!(magnitude > 0) || !(seconds > 0)) return;
    if (seconds > this.shakeTime) {
      this.shakeTime = seconds;
      this.shakeDur = seconds;
    }
    if (magnitude > this.shakeMag) this.shakeMag = magnitude;
  }

  update(dt: number): void {
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) this.shakeMag = 0;
    }
  }

  get shakeX(): number {
    if (this.shakeTime <= 0) return 0;
    return (Math.random() * 2 - 1) * this.shakeMag * (this.shakeTime / this.shakeDur);
  }

  get shakeY(): number {
    if (this.shakeTime <= 0) return 0;
    return (Math.random() * 2 - 1) * this.shakeMag * (this.shakeTime / this.shakeDur);
  }
}
