/**
 * CreatureAnimator -- relogio de animacao da criatura (suporta multiplos tracks).
 *
 * Diferenca para o SpriteAnimator do jogador: suporta animacoes NAO-LOOP
 * (turn/look) com "startFrame" e notifica quando um one-shot termina
 * (onComplete), porque a IA depende disso para encadear TURN -> LOOK.
 *
 * Tracks valem { row, frames, fps, loop?, startFrame? } (ver creature/config.js).
 */

export class CreatureAnimator {
  /** @param {{sheet?: object}} [options] sheet = CREATURE_CONFIG.sheet */
  constructor(options = {}) {
    this.sheet = options.sheet;
    /** @type {Map<string, object>} overrides p/ arte futura */
    this._overrides = new Map();
    this._trackName = "idle";
    this._frame = 0;
    this._accumulator = 0;
    this._finished = false; // true quando um one-shot chega ao ultimo frame
    /** callback(name) quando um track nao-loop termina */
    this.onComplete = null;
  }

  define(name, def) {
    this._overrides.set(name, { ...def });
    return this;
  }

  has(name) {
    return this._overrides.has(name) || Boolean(this.sheet?.animations?.[name]);
  }

  get(name) {
    return this._overrides.get(name) ?? this.sheet?.animations?.[name] ?? null;
  }

  /** Nome do track atual. */
  get name() {
    return this._trackName;
  }

  get frame() {
    return this._frame;
  }

  /** True se o track atual terminou (one-shots) -- util p/ guards da IA. */
  get finished() {
    return this._finished;
  }

  /**
   * Troca de track. Se ja estiver no mesmo nome e keepProgress=true, nao reinicia.
   * @returns {object} def do track
   */
  play(name, { restart = true, keepProgress = false } = {}) {
    const def = this.get(name);
    if (!def) throw new Error(`CreatureAnimator: animacao desconhecida "${name}"`);
    if (keepProgress && name === this._trackName) return def;
    this._trackName = name;
    this._frame = restart ? def.startFrame ?? 0 : this._frame;
    this._accumulator = 0;
    this._finished = false;
    return def;
  }

  /** Avanca o relogio; retorna o frame atual. */
  update(dt) {
    const def = this.get(this._trackName);
    if (!def) return this._frame;
    const count = Math.max(1, def.frames ?? this.sheet.columns);
    const fps = def.fps ?? 6;
    if (fps <= 0) return this._frame;

    this._accumulator += dt * fps;
    while (this._accumulator >= 1) {
      this._accumulator -= 1;
      if (def.loop === false) {
        if (this._frame < count - 1) {
          this._frame += 1;
        } else if (!this._finished) {
          this._finished = true;
          this.onComplete?.(this._trackName);
        }
      } else {
        this._frame = (this._frame + 1) % count;
      }
    }
    return this._frame;
  }

  /** Rect do frame atual na folha ({x,y,w,h}) -- recorte para o renderer. */
  currentRect() {
    const def = this.get(this._trackName);
    const fw = this.sheet.frameWidth;
    const fh = this.sheet.frameHeight;
    const row = def?.row ?? 0;
    return { x: this._frame * fw, y: row * fh, w: fw, h: fh };
  }
}
