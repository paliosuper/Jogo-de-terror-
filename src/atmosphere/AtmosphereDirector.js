/**
 * AtmosphereDirector -- fachada dos efeitos REUTILIZAVEIS de terror:
 *   - tremor pequeno de camera (CameraShake);
 *   - fade / escurecimento / aparecimento-desaparecimento (FadeController);
 *   - vinheta nas bordas (VignetteController);
 *   - interferencia/estatica visual (InterferenceModel).
 *
 * Nenhum modulo de jogo precisa conhecer as pecas internas: o director expoe
 * verbos ("shake", "vignette", "darken", "flicker", "interfere") e um unico
 * update(dt) por frame. Renderers leem os getters (cameraOffset, vignetteLevel,
 * fadeAlpha, interference).
 *
 * Tambem escuta o EventBus para que QUALQUER sistema dispare efeitos sem
 * importar este modulo:
 *   "atmosphere:shake"       { amplitude?, frequency?, duration? }
 *   "atmosphere:vignette"    { target?, fadeIn?, hold?, fadeOut? }
 *   "atmosphere:darken"      { amount?, duration? } | { out:true, duration? }
 *   "atmosphere:fade"        { label?, from?, to?, duration? }
 *   "atmosphere:interfere"   { level?, spike?: boolean }
 */

import { CameraShake } from "./CameraShake.js";
import { VignetteController } from "./VignetteController.js";
import { FadeController } from "./FadeController.js";
import { InterferenceModel } from "./InterferenceModel.js";

export class AtmosphereDirector {
  /** @param {{bus?: import("../core/EventBus.js").EventBus, vignetteBase?: number}} [options] */
  constructor(options = {}) {
    this.bus = options.bus ?? null;

    this.cameraShake = new CameraShake();
    this.vignette = new VignetteController({ base: options.vignetteBase ?? 0 });
    this.fade = new FadeController();
    this.interference = new InterferenceModel({ level: 0 });

    this._time = 0;
    this._subs = [];
    if (this.bus) this._wireBus(this.bus);
  }

  _wireBus(bus) {
    this._subs.push(
      bus.on("atmosphere:shake", (p) => this.shake(p ?? {})),
      bus.on("atmosphere:vignette", (p) => this.vignette.pulse(p ?? {})),
      bus.on("atmosphere:darken", (p) => {
        if (p?.out) this.lighten({ duration: p.duration ?? 1 });
        else this.darken(p ?? {});
      }),
      bus.on("atmosphere:fade", (p) => this.fade.play(p?.label ?? "default", p ?? {})),
      bus.on("atmosphere:interfere", (p) => this.interfere(p ?? {}))
    );
  }

  // -------------------------------------------------------------- verbos ----
  /** Tremor pequeno (default) ou customizado. */
  shake(opts = {}) {
    return this.cameraShake.play({
      amplitude: opts.amplitude ?? 2.2,
      frequency: opts.frequency ?? 11,
      duration: opts.duration ?? 0.9,
      reason: opts.reason ?? "manual",
    });
  }

  /** Escurece levemente as bordas (pulso) -- ex.: olhar da criatura. */
  vignettePulse(opts = {}) {
    return this.vignette.pulse(opts);
  }

  /** Escurecimento global (transicoes/escuridao). */
  darken(opts = {}) {
    return this.vignette.darken(opts);
  }

  /** Reverte o escurecimento global. */
  lighten(opts = {}) {
    return this.vignette.undarken(opts);
  }

  /** Camada de fade rotulada (aparecimento/desaparecimento). */
  fadeLayer(label, opts = {}) {
    return this.fade.play(label, opts);
  }

  /** Liga/ajusta a estatica visual; `spike` dispara uma rajada. */
  interfere(opts = {}) {
    if (typeof opts.level === "number") this.interference.setLevel(opts.level);
    if (opts.spike) this.interference.spike(opts.strength ?? 0.8, opts.duration ?? 0.35);
    return this.interference;
  }

  /** Flicker curto de escuridao total (luz falhando) -- reusa fade + vinheta. */
  flicker({ count = 3, speed = 0.12 } = {}) {
    let t = 0;
    const seq = [];
    for (let i = 0; i < count; i++) {
      seq.push({ at: t, dark: true });
      t += speed * (0.4 + Math.random() * 0.6);
      seq.push({ at: t, dark: false });
      t += speed * (0.3 + Math.random() * 0.5);
    }
    this._flickerSeq = seq;
    this._flickerTime = 0;
    this._flickerDone = false;
    return this;
  }

  // ---------------------------------------------------------------- update --
  /** Chamar 1x por frame ANTES do render. Atualiza todas as camadas. */
  update(dt) {
    this._time += dt;
    this.cameraShake.update(dt);
    this.vignette.update(dt);
    this.fade.update(dt);
    this.interference.update(dt);

    // flicker em sequencia (escurecer/clarear rapido)
    if (this._flickerSeq && !this._flickerDone) {
      this._flickerTime += dt;
      while (this._flickerSeq.length && this._flickerTime >= this._flickerSeq[0].at) {
        const step = this._flickerSeq.shift();
        if (step.dark) this.vignette.darken({ amount: 0.85, duration: 0.02 });
        else this.vignette.undarken({ duration: 0.05 });
      }
      if (!this._flickerSeq.length) this._flickerDone = true;
    }
    return this;
  }

  // ------------------------------------------------------------- leituras ---
  /** Deslocamento extra de camera deste frame (soma shake + jitter leve). */
  get cameraOffset() {
    return { x: this.cameraShake.x, y: this.cameraShake.y };
  }

  get vignetteLevel() {
    return this.vignette.level;
  }

  /** Maior alpha de fade ativo no momento (para overlay preto global). */
  get fadeAlpha() {
    let best = 0;
    for (const label of this.fade._layers.keys()) {
      best = Math.max(best, this.fade.alpha(label));
    }
    return best;
  }

  get interferenceSnapshot() {
    return this.interference.getSnapshot();
  }

  dispose() {
    for (const off of this._subs) off();
    this._subs.length = 0;
  }
}
