/**
 * Keyboard input. DOM listeners are attached by attach() (game only);
 * press()/release() are public so headless verification can drive input.
 */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();

  attach(): () => void {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "ArrowUp" ||
        e.code === "ArrowDown" ||
        e.code === "ArrowLeft" ||
        e.code === "ArrowRight" ||
        e.code === "Space"
      ) {
        e.preventDefault();
      }
      this.press(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => this.release(e.code);
    const onBlur = () => this.reset();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }

  press(code: string): void {
    if (!this.down.has(code)) this.pressed.add(code);
    this.down.add(code);
  }

  release(code: string): void {
    this.down.delete(code);
  }

  reset(): void {
    this.down.clear();
    this.pressed.clear();
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  /** Edge-triggered: true only on the frame the key went down. */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** Clear edge presses; call once at the end of each frame. */
  endFrame(): void {
    this.pressed.clear();
  }
}
