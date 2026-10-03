/**
 * SpeedSystem -- "sistema de velocidade" do jogador.
 *
 * Mantem UMA base de velocidade por estado (IDLE/WALK/RUN/INTERACT/SCARED/
 * STUNNED) e empilha multiplicadores externos, para que outros sistemas possam
 * dizer `player.setMovementMultiplier(0.7)` sem tocar em variaveis internas.
 *
 * API publica:
 *   setBaseSpeed(state, pxPerSec)
 *   getBaseSpeed(state)
 *   setMovementMultiplier(value, {tag})  -> substitui o valor anterior
 *   pushMultiplier(value, {tag, duration}) -> empilha um modificador temporario
 *   removeMultiplier(tag)
 *   clearMultipliers()
 *   resolveSpeed({state, wantsRun, dt}) -> px/s ja com suavizacao aplicada
 *   resetSmoothing()
 *
 * Suavizacao: interpolacao exponencial independente de framerate entre a
 * velocidade alvo e a atual (evita "trancos" ao entrar/sair de RUN ou SCARED).
 */

import { PlayerState } from "./PlayerStateMachine.js";
import { PLAYER_CONFIG } from "./config.js";

const BASE_DEFAULTS = Object.freeze({
  [PlayerState.IDLE]: 0,
  [PlayerState.WALK]: PLAYER_CONFIG.speed.walk,
  [PlayerState.RUN]: PLAYER_CONFIG.speed.run,
  // nos estados travados a base eh 0; multiplicadores ainda se aplicam p/ efeitos
  [PlayerState.INTERACT]: 0,
  [PlayerState.SCARED]: 0,
  [PlayerState.STUNNED]: 0,
});

export class SpeedSystem {
  /** @param {{acceleration?: number}} [options] taxa de suavizacao (1/s) */
  constructor(options = {}) {
    this._base = { ...BASE_DEFAULTS };
    /** @type {Map<string, {value:number, remaining:number}>} */
    this._multipliers = new Map();
    this._externalTag = "__external__"; // slot do setMovementMultiplier()
    this._current = 0;
    this._target = 0;
    this._smoothingRate = options.acceleration ?? 12;
  }

  // ------------------------------------------------------------- bases ------
  setBaseSpeed(state, value) {
    if (!(state in this._base)) throw new Error(`SpeedSystem: estado desconhecido "${state}"`);
    this._base[state] = Math.max(0, Number(value) || 0);
  }

  getBaseSpeed(state) {
    return this._base[state] ?? 0;
  }

  resetBases() {
    this._base = { ...BASE_DEFAULTS };
  }

  // -------------------------------------------------------- multiplicadores -
  /**
   * Multiplicador "oficial" pedido por outro sistema (ex.: medo -> 0.7).
   * Substitui o ultimo valor externo definido.
   * @param {number} value
   * @param {{duration?: number}} [opts] duracao em segundos (opcional)
   */
  setMovementMultiplier(value, opts = {}) {
    const v = clampMult(value);
    this._multipliers.set(this._externalTag, {
      value: v,
      remaining: opts.duration && opts.duration > 0 ? opts.duration : Infinity,
    });
    return v;
  }

  getMovementMultiplier() {
    return this._multipliers.get(this._externalTag)?.value ?? 1;
  }

  /** Empilha um modificador temporario adicional (ex.: terreno escorregadio). */
  pushMultiplier(value, opts = {}) {
    const tag = opts.tag ?? `mult-${this._multipliers.size}`;
    this._multipliers.set(tag, {
      value: clampMult(value),
      remaining: opts.duration && opts.duration > 0 ? opts.duration : Infinity,
    });
    return tag;
  }

  hasTag(tag) {
    return this._multipliers.has(tag);
  }

  removeMultiplier(tag) {
    return this._multipliers.delete(tag);
  }

  clearMultipliers() {
    this._multipliers.clear();
  }

  /** Produto de todos os multiplicadores ativos (externo + empilhados). */
  totalMultiplier(dt = 0) {
    let product = 1;
    for (const [tag, m] of this._multipliers) {
      if (Number.isFinite(m.remaining)) {
        m.remaining -= dt;
        if (m.remaining <= 0) {
          this._multipliers.delete(tag);
          continue;
        }
      }
      product *= m.value;
    }
    return product;
  }

  // ------------------------------------------------------------ resolucao ---
  /**
   * Calcula a velocidade efetiva do frame.
   * @param {{state: string, wantsRun?: boolean, dt: number}} ctx
   * @returns {number} px/s suavizados
   */
  resolveSpeed(ctx) {
    const dt = Math.max(0, ctx.dt ?? 0);
    const state = ctx.state;
    let base = this._base[state] ?? 0;
    if (ctx.wantsRun && state === PlayerState.WALK) base = this._base[PlayerState.RUN];
    this._target = base * this.totalMultiplier(dt);
    // interpolacao exponencial independente de framerate
    const t = 1 - Math.exp(-this._smoothingRate * dt);
    this._current += (this._target - this._current) * t;
    if (Math.abs(this._target - this._current) < 0.5) this._current = this._target;
    return this._current;
  }

  get currentSpeed() {
    return this._current;
  }

  get targetSpeed() {
    return this._target;
  }

  resetSmoothing() {
    this._current = 0;
    this._target = 0;
  }
}

function clampMult(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(4, Math.max(0, n));
}
