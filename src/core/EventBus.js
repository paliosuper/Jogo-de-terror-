/**
 * EventBus -- onibus de eventos minimo e sem dependencias.
 *
 * O SISTEMA DO JOGADOR emite por aqui ("player:state-changed", "player:interact",
 * "player:footstep", "player:facing-changed") e escuta pedidos vindos de outros
 * sistemas ("player:set-speed-multiplier", "player:lock-movement",
 * "environment:obstacles", "interactables:register").
 *
 * Outros sistemas NAO devem mexer em variaveis internas do jogador: usem os
 * metodos publicos (player.setMovementMultiplier / player.lockMovement /
 * player.scare / player.stun) ou publiquem neste onibus.
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._handlers = new Map();
  }

  /**
   * @param {string} type
   * @param {(payload: any) => void} handler
   * @returns {() => void} funcao para cancelar a inscricao
   */
  on(type, handler) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }

  /** Inscreve um handler que roda uma unica vez. */
  once(type, handler) {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(type, handler) {
    const set = this._handlers.get(type);
    if (set) {
      set.delete(handler);
      if (set.size === 0) this._handlers.delete(type);
    }
  }

  emit(type, payload = undefined) {
    const set = this._handlers.get(type);
    if (!set) return false;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] handler de "${type}" falhou:`, err);
      }
    }
    return true;
  }

  listenerCount(type) {
    return this._handlers.get(type)?.size ?? 0;
  }

  clear() {
    this._handlers.clear();
  }
}
