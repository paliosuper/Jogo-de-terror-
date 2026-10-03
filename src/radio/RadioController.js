/**
 * RadioController -- maquina de apresentacao do RÁDIO (100% visual).
 *
 * NAO importa engine grafica nem audio: e um gerador de ESTADO por frame.
 * Um renderer (Pixi/CSS) le `getState()` e desenha; um futuro sistema de
 * audio se pluga pelos HOOKS abaixo sem nada ser refeito:
 *
 *   onTransmissionStart(ctx)  -> quando uma transmissao comeca
 *   onBandChanged(freq, ctx)  -> quando a frequencia "sintoniza"
 *   onMessageRevealed(text)   -> quando o texto de uma mensagem aparece
 *   onSignalLost(ctx)         -> quando o sinal cai
 *   onEnded(ctx)              -> sequencia completa terminou
 *
 * Sequencia padrao de uma transmissao (exatamente a coreografia pedida):
 *
 *   IDLE -> SEARCHING (estatica/ondas) -> DETECTED ("RADIO SIGNAL DETECTED",
 *   letra a letra) -> FREQUENCY ("FREQUENCY 17") -> MESSAGE (texto gradual,
 *   ex.: "Você demorou.") -> HOLD -> LOST ("SIGNAL LOST") -> IDLE
 *
 * Uso:
 *   const radio = new RadioController();
 *   radio.transmit({ frequency: 17, lines: ["RADIO SIGNAL DETECTED", "FREQUENCY 17"], message: "Você demorou." });
 *   ...radio.update(dt) por frame; renderer le radio.getState()
 *
 * E reentrante: uma nova transmissao pode interromper a anterior com fade
 * curto (substituicao limpa, sem listeners/timers pendurados).
 */

import { RADIO_CONFIG } from "./config.js";

export const RadioPhase = Object.freeze({
  IDLE: "IDLE",
  SEARCHING: "SEARCHING", // sintonizando: ondas + estatica, sem texto
  REVEAL: "REVEAL", // linhas de status aparecendo letra a letra
  MESSAGE: "MESSAGE", // mensagem principal, texto gradual
  HOLD: "HOLD", // transmisssão completa, mantem no ar
  LOST: "LOST", // SIGNAL LOST
});

export class RadioController {
  /** @param {{config?: object, rng?: () => number}} [options] */
  constructor(options = {}) {
    this.config = options.config ?? RADIO_CONFIG;
    this.rng = options.rng ?? Math.random;

    this.phase = RadioPhase.IDLE;
    this.active = false;

    // conteudo da transmissao atual
    this._lines = []; // ex.: ["RADIO SIGNAL DETECTED", "FREQUENCY 17"]
    this._message = ""; // ex.: "Você demorou."
    this._frequency = this.config.frequency;

    // progresso de texto gradual
    this._lineIndex = 0; // linha de status atual
    this._charCount = 0; // caracteres revelados da linha atual
    this._typedText = ""; // string pronta para o renderer (cache)
    this._messageChars = 0;
    this._revealGap = 0; // pausa entre linhas

    // temporizadores
    this._phaseTimer = 0;
    this._flickerTimer = 0;
    this._flickerUntil = 0;
    this._time = 0;

    // hooks futuros de audio/narrativa (todos opcionais)
    this.onTransmissionStart = options.onTransmissionStart ?? null;
    this.onBandChanged = options.onBandChanged ?? null;
    this.onMessageRevealed = options.onMessageRevealed ?? null;
    this.onSignalLost = options.onSignalLost ?? null;
    this.onEnded = options.onEnded ?? null;
  }

  // ================================================================ comandos ==
  /**
   * Dispara uma transmissao completa.
   * @param {{message?: string, lines?: string[], frequency?: number|string,
   *          holdDuration?: number, leadIn?: number}} [opts]
   *        Sem opts: usa os textos canonicos da historia (FREQ 17).
   */
  transmit(opts = {}) {
    const cfg = this.config;
    this._frequency = opts.frequency ?? cfg.frequency;
    this._lines =
      opts.lines ?? [cfg.texts.detected, typeof cfg.texts.frequency === "function" ? cfg.texts.frequency(this._frequency) : String(cfg.texts.frequency ?? `FREQUENCY ${this._frequency}`)];
    this._message = opts.message ?? "";

    this.active = true;
    this._lineIndex = 0;
    this._charCount = 0;
    this._typedText = "";
    this._messageChars = 0;
    this._revealGap = 0;
    this._flickerTimer = 0;
    this._flickerUntil = 0;

    this._enterPhase(RadioPhase.SEARCHING, opts.leadIn ?? cfg.timings.staticLeadIn);

    this.onTransmissionStart?.(this.getContext());
    this.onBandChanged?.(this._frequency, this.getContext());
    return this;
  }

  /** Encurta a transmissao ate o estado final (cenas que precisam "cortar"). */
  forceSignalLost() {
    if (!this.active) return this;
    this._enterPhase(RadioPhase.LOST, this.config.timings.signalLostDuration);
    this.onSignalLost?.(this.getContext());
    return this;
  }

  /** Interrompe tudo e volta ao IDLE imediatamente (fim de cena/reset). */
  stop() {
    this.active = false;
    this._setPhase(RadioPhase.IDLE);
    this._typedText = "";
    this._charCount = 0;
    this._messageChars = 0;
    this._lineIndex = 0;
    return this;
  }

  // ================================================================== update ==
  /** Avanca a apresentacao. Chamar 1x por frame com dt em segundos. */
  update(dt) {
    this._time += dt;
    if (!this.active) return this;

    const t = this.config.timings;

    // glitch ocasional de texto (terror analógico) --------------------------
    if (this._time < this._flickerUntil) {
      /* flicker visivel apenas no getState().glitch */
    } else if (this.phase === RadioPhase.REVEAL || this.phase === RadioPhase.MESSAGE) {
      this._flickerTimer -= dt;
      if (this._flickerTimer <= 0) {
        this._flickerTimer = 1 / Math.max(0.01, t.flickerChance);
        if (this.rng() < 0.5) this._flickerUntil = this._time + 0.06 + this.rng() * 0.08;
      }
    }

    switch (this.phase) {
      case RadioPhase.SEARCHING:
        this._countdown(dt, () => this._enterPhase(RadioPhase.REVEAL, Infinity));
        break;

      case RadioPhase.REVEAL:
        this._updateReveal(dt);
        break;

      case RadioPhase.MESSAGE:
        this._updateMessage(dt);
        break;

      case RadioPhase.HOLD:
        this._countdown(dt, () => {
          this._enterPhase(RadioPhase.LOST, t.signalLostDuration);
          this.onSignalLost?.(this.getContext());
        });
        break;

      case RadioPhase.LOST:
        this._countdown(dt, () => {
          this.stop();
          this.onEnded?.(this.getContext());
        });
        break;
    }
    return this;
  }

  _updateReveal(dt) {
    const line = this._lines[this._lineIndex];
    if (line == null) {
      // linhas de status acabaram -> mensagem ou hold
      if (this._message) this._enterPhase(RadioPhase.MESSAGE, Infinity);
      else this._enterPhase(RadioPhase.HOLD, this.config.timings.holdAfterText);
      return;
    }

    if (this._revealGap > 0) {
      this._revealGap -= dt;
      return;
    }

    if (this._charCount < line.length) {
      this._charCount = Math.min(line.length, this._charCount + dt / Math.max(0.001, this.config.timings.letterInterval));
      this._typedText = line.slice(0, Math.floor(this._charCount));
      if (Math.floor(this._charCount) >= line.length) {
        this._lineIndex += 1;
        this._charCount = 0;
        this._typedText = "";
        this._revealGap = this.config.timings.lineGap;
        // quando a linha "FREQUENCY ..." fecha, avisa quem quiser sincronizar som
        if (this._lineIndex === 1 && this.onBandChanged) {
          this.onBandChanged(this._frequency, this.getContext());
        }
      }
    } else {
      this._lineIndex += 1;
      this._charCount = 0;
      this._revealGap = this.config.timings.lineGap;
    }
  }

  _updateMessage(dt) {
    const msg = this._message;
    if (!msg) {
      this._enterPhase(RadioPhase.HOLD, this.config.timings.holdAfterText);
      return;
    }
    if (this._messageChars < msg.length) {
      this._messageChars = Math.min(msg.length, this._messageChars + dt / Math.max(0.001, this.config.timings.letterInterval * 2.2));
      this._typedText = msg.slice(0, Math.floor(this._messageChars));
    } else {
      this._typedText = msg;
      if (!this._messageDone) {
        this._messageDone = true;
        this.onMessageRevealed?.(msg);
      }
      this._enterPhase(RadioPhase.HOLD, this.config.timings.holdAfterText);
    }
  }

  // ================================================================= helpers ==
  _enterPhase(next, duration) {
    if (next === RadioPhase.MESSAGE) this._messageDone = false;
    if (next !== RadioPhase.MESSAGE && next !== RadioPhase.REVEAL) this._typedText = "";
    this._setPhase(next);
    this._phaseTimer = duration;
  }

  _setPhase(p) {
    if (this.phase === p) return;
    const from = this.phase;
    this.phase = p;
    this._lastPhaseChangeAt = this._time;
    this._fromPhase = from;
  }

  _countdown(dt, onEnd) {
    this._phaseTimer -= dt;
    if (this._phaseTimer <= 0) onEnd();
  }

  /** Contexto barato p/ audio/render decidirem intensidade etc. */
  getContext() {
    return {
      phase: this.phase,
      frequency: this._frequency,
      active: this.active,
      time: this._time,
    };
  }

  /**
   * Estado de leitura do renderer (objeto novo por chamada, sem referencias).
   * @returns {{phase:string, active:boolean, frequency:number|string,
   *            statusLine: string|null, messageText: string, progress:number,
   *            glitch:boolean, signalLost:boolean, waveIntensity:number}}
   */
  getState() {
    const glitch = this._time < this._flickerUntil;
    let statusLine = null;
    let messageText = "";
    let progress = 0;

    if (this.phase === RadioPhase.REVEAL) {
      statusLine = this._typedText || this._lines[this._lineIndex]?.slice(0, 1) || "";
      const total = this._lines.join("").length || 1;
      const done = this._lines.slice(0, this._lineIndex).join("").length + Math.floor(this._charCount);
      progress = done / total;
    } else if (this.phase === RadioPhase.MESSAGE) {
      statusLine = this._lines[this._lines.length - 1] ?? null;
      messageText = this._typedText;
      progress = this._message.length ? Math.floor(this._messageChars) / this._message.length : 1;
    } else if (this.phase === RadioPhase.HOLD) {
      statusLine = this._lines[this._lines.length - 1] ?? null;
      messageText = this._message;
      progress = 1;
    } else if (this.phase === RadioPhase.LOST) {
      statusLine = this.config.texts.lost;
      progress = 1;
    }

    // intensidade das ondas: estatica alta procurando, média transmitindo,
    // caindo em SIGNAL LOST
    let waveIntensity = 0;
    switch (this.phase) {
      case RadioPhase.SEARCHING:
        waveIntensity = 0.85;
        break;
      case RadioPhase.REVEAL:
      case RadioPhase.MESSAGE:
        waveIntensity = 0.45 + 0.25 * Math.sin(this._time * 3.1);
        break;
      case RadioPhase.HOLD:
        waveIntensity = 0.5;
        break;
      case RadioPhase.LOST:
        waveIntensity = 0.15;
        break;
    }
    if (glitch) waveIntensity = Math.min(1, waveIntensity + 0.35);

    return {
      phase: this.phase,
      active: this.active,
      frequency: this._frequency,
      statusLine,
      messageText,
      progress,
      glitch,
      signalLost: this.phase === RadioPhase.LOST,
      waveIntensity: Math.max(0, Math.min(1, waveIntensity)),
    };
  }
}
