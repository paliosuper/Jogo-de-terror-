/**
 * VignetteController -- escurecimento das bordas da tela (0..1), REUTILIZAVEL.
 *
 * Mantem um nivel "base" (ambience) e camadas temporarias com prioridade:
 *   set(0.2)                      -> vinheta ambiente fraca
 *   pulse({target: 0.45, ...})    -> sobe durante o olhar da criatura e cai
 *   darken({amount: 1, duration}) -> escurecer total (fade de cena) reusa o
 *                                    mesmo pipeline via camada forte
 *
 * O renderer (Pixi ou CSS) le apenas `level` por frame -- nada aqui importa
 * engine grafica.
 */

import { Tween } from "./Tween.js";

export class VignetteController {
  constructor(options = {}) {
    this.base = options.base ?? 0; // vinheta ambiente permanente (0 = off)
    /** @type {Tween|null} */
    this._pulse = null;
    /** @type {Tween|null} */
    this._darken = null;
    /** valor atual do pulso em andamento (0 quando nao ha) */
    this._pulseValue = 0;
    this._level = this.base;
  }

  /** Define a vinheta ambiente instantaneamente. */
  set(value) {
    this.base = clamp01(value);
    return this;
  }

  /**
   * Pulso temporario: sobe ate `target`, segura `hold`, desce em `fadeOut`.
   * @param {{target?: number, fadeIn?: number, hold?: number, fadeOut?: number, reason?: string}} opts
   */
  pulse(opts = {}) {
    const target = clamp01(opts.target ?? 0.4);
    const fadeIn = Math.max(0.01, opts.fadeIn ?? 0.3);
    const hold = Math.max(0, opts.hold ?? 0.8);
    const fadeOut = Math.max(0.01, opts.fadeOut ?? 0.7);
    // fase 1: subir; onComplete encadeia a fase 2 (segurar+descer)
    const up = new Tween({ from: this._pulseValue, to: target, duration: fadeIn, easing: "quadOut" });
    up.onComplete = () => {
      const down = new Tween({
        from: target,
        to: 0,
        duration: hold + fadeOut,
        delay: hold,
        easing: "quadInOut",
      });
      down.reason = opts.reason ?? null;
      this._pulse = down;
    };
    up.reason = opts.reason ?? null;
    this._pulse = up;
    return this;
  }

  /**
   * Escurecimento (escuridao sobre TODA a tela, util p/ transicoes).
   * Retorna o tween para quem quiser cancelar/reverter.
   */
  darken({ amount = 1, duration = 1, easing = "quadInOut" } = {}) {
    this._darken = new Tween({ from: 0, to: clamp01(amount), duration, easing });
    return this._darken;
  }

  /** Reverte o ultimo darken a partir do nivel atual (fade-out suave). */
  undarken({ duration = 1, easing = "quadInOut" } = {}) {
    if (!this._darken) return null;
    this._darken = this._darken.retarget(0);
    this._darken.duration = duration;
    this._darken.easing = resolveEasing(easing);
    return this._darken;
  }

  clearPulse() {
    this._pulse = null;
  }

  update(dt) {
    let add = 0;
    if (this._pulse) {
      add = this._pulse.update(dt);
      this._pulseValue = add;
      if (this._pulse.finished) {
        // so limpa se o proximo tween ja nao foi encadeado no onComplete
        if (this._pulse.value === 0) {
          this._pulse = null;
          this._pulseValue = 0;
        }
      }
    }
    if (this._darken) {
      // darken domina: quando ativo, ignora pulso (sao momentos diferentes)
      const d = this._darken.update(dt);
      this._level = Math.max(this.base + add * (1 - d), d);
      if (this._darken.finished && d <= 0.0001) this._darken = null;
    } else {
      this._level = clamp01(this.base + add);
    }
    return this._level;
  }

  get level() {
    return this._level;
  }
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}
function resolveEasing(e) {
  if (typeof e === "function") return e;
  return new Tween({ easing: e }).easing;
}
