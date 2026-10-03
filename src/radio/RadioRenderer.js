/**
 * RadioRenderer -- camada VISUAL do rádio (Pixi v8, opcional).
 *
 * Desenha a partir de RadioController.getState():
 *   - painel retangular escuro (placeholder, trocavel por sprite depois);
 *   - ondas senoidais em camadas (quantidade/amp/niose via RADIO_CONFIG.waves);
 *   - estatica/interferencia (usa InterferenceModel da Atmosfera);
 *   - texto aparecendo gradualmente (statusLine + messageText);
 *   - indicador de transmissão (LED piscando) e barra de intensidade de sinal;
 *   - "SIGNAL LOST" com glitch.
 *
 * Se pixi.js nao estiver disponivel (testes/node), o construtor funciona
 * igualmente -- init() apenas retorna false. O modelo (RadioController) nunca
 * depende desta camada.
 */

import { RADIO_CONFIG } from "./config.js";
import { InterferenceModel } from "../atmosphere/InterferenceModel.js";

let _pixiCache = null;
async function loadPixi() {
  if (!_pixiCache) _pixiCache = await import("pixi.js");
  return _pixiCache;
}

export class RadioRenderer {
  /**
   * @param {{controller: import("./RadioController.js").RadioController,
   *          config?: object, size?: {width:number,height:number}}} deps
   */
  constructor(deps) {
    this.controller = deps.controller;
    this.config = deps.config ?? RADIO_CONFIG;
    this.size = deps.size ?? { width: 320, height: 140 };
    this.interference = new InterferenceModel({ level: 0, bursts: false });

    this._pixi = null;
    this.container = null;
    this._gfx = null; // painel + ondas + estatica (Graphics redesenhado)
    this._textStatus = null;
    this._textMessage = null;
    this._led = null;
    this._time = 0;
  }

  /** Anexa o painel visual a um container Pixi ja existente. */
  attach(container) {
    this.container = container;
    return this;
  }

  /** Cria os objetos Pixi dentro de `app` (ou de um container pai). */
  async init(parent) {
    const PIXI = await loadPixi();
    this._pixi = PIXI;
    this.container = new PIXI.Container();
    if (typeof parent.addChild === "function") parent.addChild(this.container);

    this._gfx = new PIXI.Graphics();
    this.container.addChild(this._gfx);

    this._textStatus = new PIXI.Text({
      text: "",
      style: { fontFamily: "monospace", fontSize: 16, fill: 0x9fe6a0, letterSpacing: 2 },
    });
    this._textStatus.position.set(14, 10);
    this.container.addChild(this._textStatus);

    this._textMessage = new PIXI.Text({
      text: "",
      style: { fontFamily: "monospace", fontSize: 20, fill: 0xe8f7e9 },
    });
    this._textMessage.position.set(14, this.size.height - 44);
    this.container.addChild(this._textMessage);

    this._led = new PIXI.Graphics();
    this.container.addChild(this._led);
    return true;
  }

  setPosition(x, y) {
    this.container?.position.set(x, y);
    return this;
  }

  /** Chamar 1x por frame apos controller.update(dt). */
  render(dt) {
    if (!this._pixi || !this.container) return;
    this._time += dt;
    const state = this.controller.getState();

    // interferencia acompanha a fase ---------------------------------------
    const targetNoise = state.active ? 0.15 + state.waveIntensity * 0.5 : 0.02;
    this.interference.setLevel(targetNoise);
    this.interference.update(dt);
    const noise = this.interference.noise;

    this._drawPanel(state, noise);
    this._drawWaves(state, noise);
    this._drawLed(state);

    this._textStatus.text = state.statusLine ?? "";
    this._textMessage.text = state.messageText ?? "";
    // jitter de texto quando ha glitch (texto "tremendo", nao piscando off)
    const jx = state.glitch ? (Math.random() - 0.5) * 4 : 0;
    this._textStatus.position.x = 14 + jx;
    this._textMessage.position.x = 14 + jx * 1.4;
  }

  _drawPanel(state, noise) {
    const g = this._gfx;
    const { width: w, height: h } = this.size;
    g.clear();
    // corpo do painel
    g.roundRect(0, 0, w, h, 6).fill({ color: 0x0b0f12, alpha: 0.92 });
    g.roundRect(0, 0, w, h, 6).stroke({ color: 0x2c3a3d, width: 2 });

    // estatica: pontos aleatorios proporcionais ao ruido
    const dots = Math.floor(noise * 90);
    for (let i = 0; i < dots; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const a = 0.05 + Math.random() * 0.18;
      g.rect(x, y, 2, 1).fill({ color: 0xbfd8c2, alpha: a });
    }

    // barra de intensidade de sinal (indicador de transmissão)
    const barW = w - 28;
    const bx = 14;
    const by = h - 14;
    g.rect(bx, by, barW, 4).fill({ color: 0x1a2426 });
    g.rect(bx, by, barW * (state.active ? state.waveIntensity : 0.02), 4).fill({
      color: state.signalLost ? 0xa04444 : 0x67c96c,
    });
  }

  _drawWaves(state, noise) {
    const g = this._gfx;
    const { width: w, height: h } = this.size;
    const cfg = this.config.waves;
    const midY = h * 0.42;
    const t = this._time * this.config.timings.waveSpeed;
    const ampBase = cfg.baseAmplitude * (0.4 + state.waveIntensity);

    for (let layer = 0; layer < cfg.count; layer++) {
      const phase = layer * 1.9;
      const amp = ampBase * (1 - layer * 0.28);
      const alpha = (0.55 - layer * 0.15) * (state.active ? 1 : 0.25);
      const color = state.signalLost ? 0x8a4b4b : 0x59b365;
      let first = true;
      for (let x = 8; x <= w - 8; x += 4) {
        const k = x / w;
        const y =
          midY +
          Math.sin(k * 10 + t * (1 + layer * 0.35) + phase) * amp +
          (Math.random() - 0.5) * cfg.noiseAmount * 10 * noise;
        if (first) {
          g.moveTo(x, y);
          first = false;
        } else {
          g.lineTo(x, y);
        }
      }
      g.stroke({ color, width: 2, alpha });
    }
  }

  _drawLed(state) {
    const led = this._led;
    led.clear();
    const x = this.size.width - 16;
    const y = 14;
    let on = false;
    let color = 0x333a3a;
    if (state.active) {
      if (state.signalLost) {
        on = Math.sin(this._time * 30) > 0.6;
        color = 0xd06060;
      } else {
        on = Math.sin(this._time * 9) > -0.2; // pulso de transmissão
        color = 0x6fe07a;
      }
    }
    led.circle(x, y, 5).fill({ color: on ? color : 0x22282a });
    if (on) led.circle(x, y, 8).stroke({ color, width: 1, alpha: 0.5 });
  }

  destroy() {
    this.container?.destroy({ children: true });
    this.container = null;
    this._gfx = null;
    this._textStatus = null;
    this._textMessage = null;
    this._led = null;
  }
}
