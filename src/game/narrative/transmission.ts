export interface TransmissionLine {
  text: string;
  color: string;
  size: number;
}

const CPS = 42; // typewriter speed: characters per second
const HOLD_AFTER_LINE = 0.5;
const FINAL_HOLD = 1.1;
const FADE_OUT = 0.5;

type Mode = "typing" | "finalHold" | "fade";

/**
 * Visual radio transmission (Etapa 2): typewriter text + interference.
 * Audio slots in later without rebuilding this — just add a play hook
 * where lines start/end.
 */
export class Transmission {
  active = false;
  /** lines fully typed so far (for verification and future subtitles) */
  completed: string[] = [];

  private lines: TransmissionLine[] = [];
  private mode: Mode = "typing";
  private lineIndex = 0;
  private chars = 0;
  private charT = 0;
  private holdT = 0;
  private fadeT = 0;
  private shake = 0;

  start(lines?: TransmissionLine[]): void {
    this.lines = lines ?? [
      { text: "RADIO SIGNAL DETECTED", color: "#e7c079", size: 24 },
      { text: "FREQUENCY 17", color: "#f2e8d0", size: 46 },
      { text: "Você demorou.", color: "#cfd8e3", size: 24 },
    ];
    this.active = true;
    this.completed = [];
    this.mode = "typing";
    this.lineIndex = 0;
    this.chars = 0;
    this.charT = 0;
    this.holdT = 0;
    this.fadeT = 0;
    this.shake = 0.35;
  }

  /** True on the frame the sequence finishes. */
  update(dt: number): boolean {
    if (!this.active) return false;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);

    if (this.mode === "fade") {
      this.fadeT += dt;
      if (this.fadeT >= FADE_OUT) {
        this.active = false;
        return true;
      }
      return false;
    }

    if (this.mode === "finalHold") {
      this.holdT += dt;
      if (this.holdT >= FINAL_HOLD) {
        this.mode = "fade";
        this.fadeT = 0;
      }
      return false;
    }

    const line = this.lines[this.lineIndex];
    if (!line) {
      this.mode = "finalHold";
      this.holdT = 0;
      return false;
    }

    if (this.chars < line.text.length) {
      this.charT += dt;
      const add = Math.floor(this.charT * CPS);
      if (add > 0) {
        this.charT = 0;
        this.chars = Math.min(line.text.length, this.chars + add);
      }
      return false;
    }

    if (!this.completed.includes(line.text)) this.completed.push(line.text);
    this.holdT += dt;
    if (this.holdT >= HOLD_AFTER_LINE) {
      this.holdT = 0;
      this.chars = 0;
      this.charT = 0;
      this.lineIndex++;
      if (this.lineIndex >= this.lines.length) {
        this.mode = "finalHold";
        this.holdT = 0;
      }
    }
    return false;
  }

  /** Screen-space overlay. Called after HUD, before the fade. */
  draw(ctx: CanvasRenderingContext2D, viewW: number, viewH: number, time: number): void {
    if (!this.active) return;

    const fade = this.mode === "fade" ? Math.max(0, 1 - this.fadeT / FADE_OUT) : 1;
    const jolt = this.shake > 0 ? (Math.random() * 2 - 1) * 4 * this.shake : 0;

    ctx.save();

    // dim backdrop + interference lines
    ctx.globalAlpha = 0.78 * fade;
    ctx.fillStyle = "#03060a";
    ctx.fillRect(0, 0, viewW, viewH);
    for (let i = 0; i < 14; i++) {
      const y = Math.floor(Math.random() * viewH);
      ctx.globalAlpha = (0.05 + Math.random() * 0.09) * fade;
      ctx.fillStyle = "#cfe3ee";
      ctx.fillRect(0, y, viewW, 1 + Math.floor(Math.random() * 2));
    }

    // typewriter lines
    ctx.globalAlpha = fade;
    const lineHeight = 64;
    const blockH = this.lines.length * lineHeight;
    const startY = (viewH - blockH) / 2 + 30 + jolt;
    ctx.textAlign = "center";
    const visibleUpTo = this.mode === "typing" ? this.lineIndex : this.lines.length - 1;
    for (let i = 0; i <= Math.min(visibleUpTo, this.lines.length - 1); i++) {
      const line = this.lines[i];
      const shown = i < this.lineIndex || this.mode !== "typing" ? line.text : line.text.slice(0, this.chars);
      if (!shown) continue;
      ctx.fillStyle = line.color;
      ctx.font = `bold ${line.size}px 'Courier New', monospace`;
      const glitch = this.mode === "typing" && Math.random() < 0.12 ? Math.random() * 4 - 2 : 0;
      ctx.fillText(shown, viewW / 2 + glitch, startY + i * lineHeight);
    }

    // blinking cursor on the active line
    if (this.mode === "typing" && this.lineIndex < this.lines.length && Math.floor(time * 3) % 2 === 0) {
      const line = this.lines[this.lineIndex];
      ctx.fillStyle = line.color;
      ctx.font = `bold ${line.size}px 'Courier New', monospace`;
      const w = ctx.measureText(line.text.slice(0, this.chars)).width;
      ctx.fillRect(viewW / 2 + w / 2 + 8, startY + this.lineIndex * lineHeight - line.size + 4, 4, line.size);
    }

    // frame accents
    ctx.fillStyle = "#e7c079";
    ctx.fillRect(viewW / 2 - 120, startY - 58, 240, 2);
    ctx.fillRect(viewW / 2 - 120, startY + blockH - 34, 240, 2);

    ctx.restore();
  }
}
