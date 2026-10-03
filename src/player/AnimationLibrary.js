/**
 * AnimationLibrary -- mapeia "estado + direcao" para tracks da spritesheet.
 *
 * Layout padrao assumido (placeholder):
 *   linhas = direcoes na ordem config.directionRowOrder (down,left,right,up)
 *   colunas = frames de cada animacao
 * Animacoes sem direcao (interact/scared/stunned) usam linha explicita.
 *
 * A biblioteca NAO conhece renderizador: devolve apenas {row, colStart, frames}
 * e o nome da animacao; SpriteRenderer/Pixi traduz para recortes reais.
 */

import { PLAYER_CONFIG, animationForState } from "./config.js";

export class AnimationLibrary {
  /** @param {{sheet?: object}} [options] sobrescreve config.sheet p/ testes */
  constructor(options = {}) {
    this.sheet = options.sheet ?? PLAYER_CONFIG.sheet;
    /** @type {Map<string, object>} overrides por nome de animacao */
    this._overrides = new Map();
  }

  /** Permite a outros sistemas registrarem tracks extras (ex.: "hurt"). */
  define(name, def) {
    this._overrides.set(name, { ...def });
  }

  has(name) {
    return this._overrides.has(name) || Boolean(this.sheet.animations[name]);
  }

  /** Definizao bruta de uma animacao (com override aplicado). */
  get(name) {
    return this._overrides.get(name) ?? this.sheet.animations[name] ?? null;
  }

  /** Nome da animacao associada a um estado. */
  forState(state) {
    const name = animationForState(state);
    return this.has(name) ? name : "idle";
  }

  /**
   * Track efetivo de uma animacao para uma direcao.
   * @returns {{row:number, frames:number, fps:number, name:string}}
   */
  track(animName, direction = "down") {
    const def = this.get(animName) ?? this.get("idle");
    const rowOrder = this.sheet.directionRowOrder ?? ["down", "left", "right", "up"];
    let row;
    if (def.row === "direction") {
      row = Math.max(0, rowOrder.indexOf(direction));
    } else {
      row = def.row ?? 0;
    }
    return {
      name: animName,
      row,
      frames: clampFrames(def.frames ?? this.sheet.columns, this.sheet.columns),
      fps: def.fps ?? 8,
    };
  }

  /** Rect do frame dentro da folha (para recorte no renderer). */
  frameRect(track, localFrame) {
    const col = ((localFrame % track.frames) + track.frames) % track.frames;
    return {
      x: col * this.sheet.frameWidth,
      y: track.row * this.sheet.frameHeight,
      w: this.sheet.frameWidth,
      h: this.sheet.frameHeight,
    };
  }

  /** Lista completa de tracks (debug/devtools). */
  list() {
    const names = new Set([...Object.keys(this.sheet.animations), ...this._overrides.keys()]);
    return [...names].map((name) => ({ name, def: this.get(name) }));
  }
}

function clampFrames(n, columns) {
  const v = Number(n) || 1;
  return Math.min(Math.max(1, Math.round(v)), columns);
}

/** Estado -> direcao da animacao nao-direcional (conveniencia). */
export function isDirectional(animName) {
  const def = PLAYER_CONFIG.sheet.animations[animName];
  return def?.row === "direction";
}
