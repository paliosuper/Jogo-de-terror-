/**
 * InterferenceModel -- gerador REUTILIZAVEL de ruido/interferencia (0..1).
 *
 * Usado pelo radio (estatica visivel) e pela atmosfera (glitch de tela).
 * Nao desenha nada: devolve por frame os parametros que o renderer aplica
 * (alpha de estatica, jitter horizontal, linhas de scan deslocadas...).
 *
 * Modelo: soma de senoides + ruído deterministico (hash barato), com
 * "rajadas" (bursts) probabilisticas para picos de estatica.
 */

export class InterferenceModel {
  /** @param {{level?: number, bursts?: boolean, seed?: number}} [options] */
  constructor(options = {}) {
    this.baseLevel = options.level ?? 0.15; // 0..1 intensidade sustentada
    this.bursts = options.bursts ?? true;
    this._seed = options.seed ?? 1337;
    this._time = 0;
    this._burstRemaining = 0;
    this._burstCooldown = rand(this._seed) * 2 + 1;
    /** ultimo estado calculado (leitura barata p/ renderers) */
    this.noise = 0;
    this.jitterX = 0;
    this.scanOffset = 0;
    this.active = false;
  }

  setLevel(v) {
    this.baseLevel = Math.min(1, Math.max(0, v));
    return this;
  }

  /** Forca uma rajada imediata (ex.: ao detectar sinal no radio). */
  spike(strength = 0.8, duration = 0.35) {
    this._burstRemaining = duration;
    this._lastSpike = strength;
    return this;
  }

  update(dt) {
    this._time += dt;

    // rajadas periodicas --------------------------------------------------
    if (this._burstRemaining > 0) {
      this._burstRemaining -= dt;
    } else if (this.bursts) {
      this._burstCooldown -= dt;
      if (this._burstCooldown <= 0) {
        this._burstRemaining = 0.1 + hash(this._seed + this._time) * 0.4;
        this._burstCooldown = 1.2 + hash(this._seed * 3 + this._time) * 3.5;
        this._lastSpike = 0.5 + hash(this._seed + this._time * 7) * 0.5;
      }
    }

    const burstEnv = this._burstRemaining > 0 ? this._lastSpike ?? 0.7 : 0;
    const wobble =
      0.5 +
      0.25 * Math.sin(this._time * 6.3) +
      0.25 * Math.sin(this._time * 2.1 + 1.7);
    const grain = hash(Math.floor(this._time * 30) + this._seed); // muda ~30x/s

    this.noise = clamp01(this.baseLevel * wobble + burstEnv * (0.4 + grain * 0.6) + grain * 0.08 * this.baseLevel);
    this.jitterX = (grain - 0.5) * 6 * (this.baseLevel + burstEnv);
    this.scanOffset = Math.floor(hash(this._seed + Math.floor(this._time * 12)) * 8);
    this.active = this.noise > 0.02;
    return this;
  }

  getSnapshot() {
    return { noise: this.noise, jitterX: this.jitterX, scanOffset: this.scanOffset, active: this.active };
  }
}

// ------------------------------------------------------------- utils -------
function hash(n) {
  // deterministic float 0..1 (mulberry-ish)
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function rand(seed) {
  return hash(seed);
}
function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}
