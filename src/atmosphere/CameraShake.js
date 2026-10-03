/**
 * CameraShake -- tremor de camera REUTILIZAVEL e aditivo.
 *
 * Nao substitui nem copia a CameraFollow do jogador: ele e um "deslocamento
 * extra" que o renderer aplica DEPOIS do offset da camera. Varios efeitos
 * podem pedir shake ao mesmo tempo; as amplitudes se somam com decaimento
 * individual (nada cancela nada).
 *
 * Uso:
 *   shake.play({ amplitude: 2.2, frequency: 11, duration: 1.4, reason: "..." })
 *   const { x, y } = shake.update(dt)  -> soma dos deslocamentos atuais
 *   shake.stopAll() / shake.enabled = false (cutscenes/pausa)
 *
 * Curva de intensidade: ataque rapido (attackRatio do total) + decaimento
 * suave; para tremores pequenos isso soa como "arrepio", nao como terremoto.
 */

export class CameraShake {
  /** @param {{maxAmplitude?: number}} [options] teto p/ soma das amplitudes */
  constructor(options = {}) {
    this.maxAmplitude = options.maxAmplitude ?? 8;
    this.enabled = true;
    /** @type {Array<{amp:number,freq:number,dur:number,elapsed:number,phase:number,decay:number}>} */
    this._active = [];
    this.x = 0;
    this.y = 0;
  }

  /**
   * @param {{amplitude?: number, frequency?: number, duration?: number,
   *          attack?: number, decay?: "smooth"|"linear"|"sharp", reason?: string}} opts
   */
  play(opts = {}) {
    if (!this.enabled) return null;
    const amp = clampPositive(opts.amplitude ?? 2, 0, this.maxAmplitude);
    const entry = {
      amp,
      freq: Math.max(0.5, opts.frequency ?? 10),
      dur: Math.max(0.05, opts.duration ?? 0.5),
      elapsed: 0,
      phase: Math.random() * Math.PI * 2,
      attack: opts.attack ?? 0.06,
      decay: opts.decay ?? "smooth",
      reason: opts.reason ?? null,
    };
    this._active.push(entry);
    return entry;
  }

  /** Tremor pequeno padrao (o pedido da primeira aparição da criatura). */
  small(reason = "small") {
    return this.play({ amplitude: 2.2, frequency: 11, duration: 0.9, reason });
  }

  stopAll() {
    this._active.length = 0;
    this.x = 0;
    this.y = 0;
  }

  get active() {
    return this._active.length > 0;
  }

  /** Intensidade agregada 0..1 (para vinheta/interferência reagirem junto). */
  get intensity() {
    let sum = 0;
    for (const s of this._active) sum += s.amp * envelope(s);
    return clamp01(sum / this.maxAmplitude);
  }

  /**
   * Avanca todos os tremores e recalcula o deslocamento agregado.
   * @param {number} dt segundos
   * @returns {{x:number,y:number}}
   */
  update(dt) {
    this.x = 0;
    this.y = 0;
    if (!this.enabled) return { x: 0, y: 0 };

    for (let i = this._active.length - 1; i >= 0; i--) {
      const s = this._active[i];
      s.elapsed += dt;
      if (s.elapsed >= s.dur) {
        this._active.splice(i, 1);
        continue;
      }
      const env = envelope(s);
      const t = s.elapsed;
      // dois senoides dessincronizados evitam movimento circular obvio
      this.x += Math.sin(t * s.freq * 2 * Math.PI + s.phase) * s.amp * env;
      this.y += Math.sin(t * s.freq * 1.63 * Math.PI + s.phase * 1.7) * s.amp * env * 0.7;
    }
    return { x: this.x, y: this.y };
  }
}

function envelope(s) {
  const p = s.elapsed / s.dur;
  const attack = Math.min(1, s.elapsed / Math.max(0.0001, s.attack));
  let tail;
  switch (s.decay) {
    case "linear":
      tail = 1 - p;
      break;
    case "sharp":
      tail = Math.pow(1 - p, 3);
      break;
    default: // smooth
      tail = Math.pow(1 - p, 1.6);
  }
  return attack * tail;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
const clamp01 = (v) => clamp(v, 0, 1);
const clampPositive = (v, lo, hi) => clamp(Math.abs(v), lo, hi);
