/**
 * FadeController -- fades reutilizaveis de aparecimento/desaparecimento.
 *
 * Mantem camadas rotuladas (ex.: "blackout", "scene-open") para que varios
 * fades coexistam sem se sobrescreverem. Cada camada expoe `alpha` 0..1 e um
 * `onDone`. A tela preta inicial do jogo ("abertura") pode usar:
 *   fade.play("opening", { from: 1, to: 0, duration: 2.5 })
 *
 * Nenhum renderer aqui: quem desenha le fade.get("opening").alpha por frame.
 */

import { Tween } from "./Tween.js";

export class FadeController {
  constructor() {
    /** @type {Map<string, {tween: Tween, onDone?: Function}>} */
    this._layers = new Map();
  }

  /**
   * @param {string} label id da camada ("blackout", "creature"...). Reuso
   *        substitui a camada anterior com o mesmo label.
   * @param {{from?: number, to?: number, duration?: number, delay?: number,
   *          easing?: string|Function, yoyo?: boolean, onDone?: Function}} [opts]
   */
  play(label, opts = {}) {
    const tween = new Tween({
      from: opts.from ?? 0,
      to: opts.to ?? 1,
      duration: opts.duration ?? 1,
      delay: opts.delay ?? 0,
      easing: opts.easing ?? "quadInOut",
      yoyo: !!opts.yoyo,
    });
    if (opts.onDone) tween.onComplete = () => opts.onDone?.(label);
    this._layers.set(label, { tween, onDone: opts.onDone });
    return tween;
  }

  /** Inverte a camada atual suavemente (fade-in vira fade-out do valor atual). */
  reverse(label, { duration = 1, onDone } = {}) {
    const layer = this._layers.get(label);
    if (!layer) return null;
    layer.tween.retarget(layer.tween.from); // volta ao ponto de origem
    layer.tween.duration = duration;
    if (onDone) layer.tween.onComplete = () => onDone(label);
    return layer.tween;
  }

  get(label) {
    const layer = this._layers.get(label);
    if (!layer) return null;
    return { alpha: layer.tween.value, finished: layer.tween.finished };
  }

  /** Alpha efetivo de uma camada (0 se nao existe). */
  alpha(label) {
    return this._layers.get(label)?.tween.value ?? 0;
  }

  update(dt) {
    for (const [label, layer] of [...this._layers]) {
      layer.tween.update(dt);
      if (layer.tween.finished && layer.tween.value <= 0.0001) {
        this._layers.delete(label); // camadas mortas em alpha 0 saem de cena
      }
    }
    return this;
  }

  remove(label) {
    return this._layers.delete(label);
  }
}
