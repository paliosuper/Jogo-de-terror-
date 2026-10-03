/**
 * Tween -- interpolacao pura (sem engine) usada por TODOS os efeitos de
 * atmosfera: fade, vinheta, escurecimento, aparecimento/desaparecimento.
 *
 * Um Tween e um relogio 0..1 com easing; quem consome decide O QUE fazer com
 * `value` (alpha, brilho, offset...). Assim os efeitos ficam reutilizaveis e
 * testaveis sem Pixi.
 */

export const Easings = Object.freeze({
  linear: (t) => t,
  quadIn: (t) => t * t,
  quadOut: (t) => 1 - (1 - t) * (1 - t),
  quadInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  expoOut: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
});

export class Tween {
  /**
   * @param {{from?: number, to?: number, duration?: number, easing?: keyof typeof Easings|Function,
   *          delay?: number, yoyo?: boolean, repeat?: number, autoStart?: boolean}} [options]
   */
  constructor(options = {}) {
    this.from = options.from ?? 0;
    this.to = options.to ?? 1;
    this.duration = Math.max(0.0001, options.duration ?? 1);
    this.easing = resolveEasing(options.easing ?? "quadInOut");
    this.delay = options.delay ?? 0;
    this.yoyo = !!options.yoyo;
    this.repeat = options.repeat ?? 0; // 0 = uma vez; Infinity = loop
    this._elapsed = -this.delay;
    this._cycles = 0;
    this._reversed = false;
    this.playing = options.autoStart ?? true;
    this.onComplete = null;
    this.value = this.playing && this.delay <= 0 ? this.from : this.from;
  }

  restart() {
    this._elapsed = -this.delay;
    this._cycles = 0;
    this._reversed = false;
    this.playing = true;
    return this;
  }

  /** Redireciona o tween mantendo progresso (fade-in vira fade-out suave). */
  retarget(to) {
    this.from = this.value;
    this.to = to;
    this._elapsed = 0;
    this.playing = true;
    return this;
  }

  update(dt) {
    if (!this.playing) return this.value;
    this._elapsed += dt;
    if (this._elapsed < 0) return this.value; // ainda em delay

    let t = Math.min(1, this._elapsed / this.duration);
    if (this._reversed) t = 1 - t;
    this.value = this.from + (this.to - this.from) * this.easing(t);

    if (this._elapsed >= this.duration) {
      if (this.repeat > this._cycles + 1 || this.repeat === Infinity) {
        this._cycles += 1;
        this._elapsed = 0;
        if (this.yoyo) this._reversed = !this._reversed;
      } else {
        this.playing = false;
        this.onComplete?.();
      }
    }
    return this.value;
  }

  get finished() {
    return !this.playing;
  }
}

function resolveEasing(e) {
  if (typeof e === "function") return e;
  return Easings[e] ?? Easings.linear;
}
