/**
 * InteractionSystem -- deteccao de alvos e disparo da interacao basica (E).
 *
 * Outros sistemas (mapas/objetos) registram alvos com um id, posicao e um
 * handler onInteract(player). O Player apenas pede "o que esta ao alcance?"
 * e notifica o estado INTERACT; a acao em si fica no alvo registrado.
 *
 * Nenhuma regra de historia/radio/criatura mora aqui -- so mecanica de
 * "apertar E perto de algo".
 */

import { PLAYER_CONFIG } from "./config.js";

export class InteractionSystem {
  /** @param {{bus?: import("../core/EventBus.js").EventBus}} [options] */
  constructor(options = {}) {
    this._bus = options.bus ?? null;
    /** @type {Map<string, object>} */
    this._targets = new Map();
    this._lastTargetId = null;
  }

  /**
   * @param {{id: string, x:number, y:number, radius?: number, enabled?: boolean,
   *          label?: string, onInteract?: (player)=>any}} target
   */
  register(target) {
    if (!target?.id) throw new Error("InteractionSystem: alvo precisa de id");
    this._targets.set(target.id, {
      radius: PLAYER_CONFIG.interact.range,
      enabled: true,
      ...target,
    });
    return () => this.unregister(target.id);
  }

  unregister(id) {
    return this._targets.delete(id);
  }

  clear() {
    this._targets.clear();
  }

  list() {
    return [...this._targets.values()];
  }

  /** Alvo mais proximo dentro do alcance do jogador (ou null). */
  findNearest(playerPos, opts = {}) {
    const maxRange = opts.maxRange ?? Infinity;
    let best = null;
    let bestDist = Infinity;
    for (const t of this._targets.values()) {
      if (t.enabled === false) continue;
      const dx = playerPos.x - t.x;
      const dy = playerPos.y - t.y;
      const dist = Math.hypot(dx, dy);
      const reach = Math.min(t.radius ?? PLAYER_CONFIG.interact.range, maxRange);
      if (dist <= reach && dist < bestDist) {
        best = t;
        bestDist = dist;
      }
    }
    return best;
  }

  /**
   * Invocado pelo Player quando o estado INTERACT comeca.
   * @returns {{ok:boolean, targetId?:string, result?:any, reason?:string}}
   */
  tryInteract(player, playerPos) {
    const target = this.findNearest(playerPos);
    if (!target) {
      this._bus?.emit("player:interact-failed", { reason: "no-target" });
      return { ok: false, reason: "no-target" };
    }
    let result;
    try {
      result = target.onInteract?.(player);
    } catch (err) {
      console.error(`[InteractionSystem] alvo "${target.id}" falhou:`, err);
      return { ok: false, targetId: target.id, reason: "error" };
    }
    this._lastTargetId = target.id;
    const payload = { targetId: target.id, label: target.label, result };
    this._bus?.emit("player:interact", payload);
    return { ok: true, targetId: target.id, result };
  }

  get lastTargetId() {
    return this._lastTargetId;
  }
}
