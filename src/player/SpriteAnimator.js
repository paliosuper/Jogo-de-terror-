/**
 * SpriteAnimator -- relogio de animacao puro (sem dependencia de renderizador).
 *
 * Avanca `frame` conforme `fps` e informa o indice local do frame. A camada de
 * apresentacao (SpriteRenderer) traduz esse indice para a spritesheet real.
 *
 * Suporta multiplos "tracks" (faixas de frames) na mesma folha:
 *   track = { row, frames }  ->  frame local i fica em (col=i, row=track.row)
 */
export class SpriteAnimator {
  /**
   * @param {{fps?: number, startFrame?: number}} [options]
   */
  constructor(options = {}) {
    this.fps = options.fps ?? 8;
    this._frame = options.startFrame ?? 0;
    this._accumulator = 0;
    this._paused = false;
    /** ultimo numero de frames usado (para clamp quando o track muda) */
    this._frameCount = 1;
  }

  get frame() {
    return this._frame;
  }

  set paused(v) {
    this._paused = !!v;
  }

  get paused() {
    return this._paused;
  }

  /** Reinicia o ciclo (chamado ao entrar em um novo estado/track). */
  restart(frameCount = this._frameCount) {
    this._frameCount = Math.max(1, frameCount);
    this._frame = 0;
    this._accumulator = 0;
  }

  /** Permite que o renderer informe quantos frames o track atual tem. */
  setFrameCount(n) {
    this._frameCount = Math.max(1, n | 0);
    if (this._frame >= this._frameCount) this._frame = 0;
  }

  /**
   * @param {number} dt segundos
   * @returns {number} frame atual apos avancar
   */
  update(dt) {
    if (this._paused || this.fps <= 0) return this._frame;
    this._accumulator += dt * this.fps;
    while (this._accumulator >= 1) {
      this._accumulator -= 1;
      this._frame = (this._frame + 1) % this._frameCount;
    }
    return this._frame;
  }

  /** Normalizado 0..1 dentro do ciclo atual (util p/ efeitos). */
  progress() {
    return this._frameCount > 1 ? this._frame / (this._frameCount - 1) : 0;
  }
}
