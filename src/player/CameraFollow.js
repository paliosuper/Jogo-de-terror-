/**
 * CameraFollow -- camera que segue o jogador (mundo -> tela).
 *
 * Modos: "instant" | "smooth" | "lag". Suporta deadzone, limites de mapa e
 * zoom. Nao conhece o jogador alem da posicao: Player.updateCamera chama
 * camera.follow(player.position, dt).
 */

import { PLAYER_CONFIG } from "./config.js";

export class CameraFollow {
  /** @param {{viewport?: {width:number,height:number}, config?: object}} [options] */
  constructor(options = {}) {
    this.config = { ...PLAYER_CONFIG.camera, ...(options.config ?? {}) };
    this.viewport = options.viewport ?? { width: 800, height: 600 };
    this.x = 0; // centro da camera no mundo
    this.y = 0;
    this.zoom = 1;
    this.bounds = null; // {x,y,w,h} do mundo (opcional)
  }

  setViewport(width, height) {
    this.viewport.width = width;
    this.viewport.height = height;
  }

  setBounds(bounds) {
    this.bounds = bounds;
  }

  /** Centraliza imediatamente no alvo. */
  snapTo(target) {
    this.x = target.x;
    this.y = target.y;
    this._clamp();
  }

  follow(target, dt) {
    const cfg = this.config;
    const tx = target.x;
    const ty = target.y;

    if (cfg.mode === "instant") {
      this.x = tx;
      this.y = ty;
    } else if (cfg.mode === "lag") {
      // persegue mantendo distancia minima (estilo "camera elastica")
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      const minDist = cfg.lag * this.viewport.width * 0.25;
      if (dist > minDist) {
        const k = 1 - Math.exp(-8 * dt);
        this.x += dx * k;
        this.y += dy * k;
      }
    } else {
      // smooth: interpolacao exponencial independente de framerate + deadzone
      const k = 1 - Math.exp(-(1 / Math.max(0.0001, cfg.smoothing)) * dt);
      const dzX = cfg.deadzoneX ?? 0;
      const dzY = cfg.deadzoneY ?? 0;
      const ex = clamp(Math.abs(tx - this.x) - dzX, 0, Infinity) * Math.sign(tx - this.x);
      const ey = clamp(Math.abs(ty - this.y) - dzY, 0, Infinity) * Math.sign(ty - this.y);
      this.x += ex * k;
      this.y += ey * k;
    }

    this._clamp();
  }

  _clamp() {
    if (!this.bounds) return;
    const halfW = this.viewport.width / 2 / this.zoom;
    const halfH = this.viewport.height / 2 / this.zoom;
    const b = this.bounds;
    // se o mapa for menor que a viewport, centraliza no eixo correspondente
    this.x = b.w <= halfW * 2 ? b.x + b.w / 2 : clamp(this.x, b.x + halfW, b.x + b.w - halfW);
    this.y = b.h <= halfH * 2 ? b.y + b.h / 2 : clamp(this.y, b.y + halfH, b.y + b.h - halfH);
  }

  /** Deslocamento aplicado ao container do mundo: worldPos -> screenPos. */
  get offset() {
    const hw = this.viewport.width / 2;
    const hh = this.viewport.height / 2;
    return { x: hw - this.x * this.zoom, y: hh - this.y * this.zoom };
  }

  /** Converte coordenada de tela para mundo (raycast simples p/ debug). */
  screenToWorld(px, py) {
    return {
      x: (px - this.viewport.width / 2) / this.zoom + this.x,
      y: (py - this.viewport.height / 2) / this.zoom + this.y,
    };
  }
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
