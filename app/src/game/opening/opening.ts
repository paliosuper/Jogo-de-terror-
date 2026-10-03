import type { Camera } from "../core/camera";
import type { Rect } from "../core/rect";
import type { Player } from "../player/player";

export type OpeningPhase = "beat" | "climb" | "trip" | "control";

const BEAT_DURATION = 0.45;
const CLIMB_SPEED = 170;
const CLIMB_TARGET_Y = 340;
const TRIP_DURATION = 1.4;
const BOX_FALL_DISTANCE = 130;
const GRAVITY = 2600;
const RESTITUTION = 0.35;

/**
 * Opening sequence (Etapa 2), plays out during gameplay:
 *   beat → auto-climb the stairs → trip → the box tumbles down a few
 *   steps → control returns to the player, who can go down and pick it up.
 * All placeholders — no art, no audio required.
 */
export class OpeningSequence {
  phase: OpeningPhase = "beat";

  /** visible while the box is falling (drawn before it becomes interactive) */
  boxVisible = false;
  box = { x: 0, y: 0, w: 30, h: 24, angle: 0 };

  private beatT = 0;
  private climbT = 0;
  private tripT = 0;
  private jolted = false;
  private boxVy = 0;
  private boxGroundY = 0;
  private boxLanded = false;

  get hasControl(): boolean {
    return this.phase === "control";
  }

  boxRect(): Rect {
    return { x: this.box.x, y: this.box.y, w: this.box.w, h: this.box.h };
  }

  update(dt: number, player: Player, camera: Camera): void {
    switch (this.phase) {
      case "beat": {
        this.beatT += dt;
        player.state = "IDLE";
        if (this.beatT >= BEAT_DURATION) this.phase = "climb";
        break;
      }
      case "climb": {
        this.climbT += dt;
        player.state = "WALK";
        player.facing = "up";
        player.y -= CLIMB_SPEED * dt;
        if (player.y <= CLIMB_TARGET_Y || this.climbT > 3) {
          this.phase = "trip";
          this.tripT = 0;
          this.jolted = false;
        }
        break;
      }
      case "trip": {
        this.tripT += dt;
        player.state = "IDLE";
        if (!this.jolted) {
          this.jolted = true;
          player.y -= 14; // stumble forward
          camera.addShake(4, 0.45);
          // the box slips out of the player's hands
          this.box.x = player.x + 3;
          this.box.y = player.y;
          this.box.angle = 0.3;
          this.boxVy = 0;
          this.boxGroundY = player.y + BOX_FALL_DISTANCE;
          this.boxLanded = false;
          this.boxVisible = true;
        }
        if (this.boxVisible && !this.boxLanded) {
          this.boxVy += GRAVITY * dt;
          this.box.y += this.boxVy * dt;
          this.box.angle += 6 * dt;
          if (this.box.y >= this.boxGroundY) {
            this.box.y = this.boxGroundY;
            if (this.boxVy > 240) {
              this.boxVy = -this.boxVy * RESTITUTION;
            } else {
              this.boxVy = 0;
              this.boxLanded = true;
              this.box.angle = 0.08;
            }
          }
        }
        if (this.tripT >= TRIP_DURATION) {
          this.box.y = this.boxGroundY;
          this.boxLanded = true;
          this.box.angle = 0.08;
          this.phase = "control";
        }
        break;
      }
      case "control":
        break;
    }
  }
}
