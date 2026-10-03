/**
 * InputManager -- teclado (WASD + setas + Shift + E) com presses "de borda".
 *
 * Nao conhece o jogador: apenas expoe o estado bruto do teclado. O Player
 * interpreta (eixos compostos, corrida por dominancia, intencao de interagir).
 *
 * `enabled=false` e util para telas/menus pausarem o input do jogador sem
 * perder as listeners.
 */
export class InputManager {
  /**
   * @param {{target?: EventTarget, keyMap?: object}} [options]
   */
  constructor(options = {}) {
    this._target = options.target ?? globalThis.window ?? null;
    /** @type {Set<string>} codigos pressionados no momento */
    this._down = new Set();
    /** @type {Set<string>} codigos pressionados desde o ultimo consumeEdges() */
    this._pressed = new Set();
    this.enabled = true;

    this._onKeyDown = (ev) => {
      if (!this.enabled) return;
      if (!this._down.has(ev.code)) this._pressed.add(ev.code);
      this._down.add(ev.code);
    };
    this._onKeyUp = (ev) => {
      this._down.delete(ev.code);
    };
    this._onBlur = () => {
      this._down.clear(); // janela perdeu o foco -> solta tudo
    };

    if (this._target?.addEventListener) {
      this._target.addEventListener("keydown", this._onKeyDown);
      this._target.addEventListener("keyup", this._onKeyUp);
      this._target.addEventListener("blur", this._onBlur);
    }
  }

  isDown(code) {
    return this.enabled && this._down.has(code);
  }

  /** true uma unica vez por pressao (consume nos edges do ciclo). */
  wasPressed(code) {
    if (!this.enabled) return false;
    return this._pressed.has(code);
  }

  /** Chame no FIM de cada frame para limpar os presses de borda. */
  endFrame() {
    this._pressed.clear();
  }

  dispose() {
    if (this._target?.removeEventListener) {
      this._target.removeEventListener("keydown", this._onKeyDown);
      this._target.removeEventListener("keyup", this._onKeyUp);
      this._target.removeEventListener("blur", this._onBlur);
    }
    this._down.clear();
    this._pressed.clear();
  }
}

/** Mapas de teclas aceitos (code -> acao). Exponiveis para reconfiguracao. */
export const DEFAULT_KEY_MAP = Object.freeze({
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  run: ["ShiftLeft", "ShiftRight"],
  interact: ["KeyE"],
});

/**
 * Helper: soma os eixos do mapa de teclas em um vetor -1..1 por eixo.
 * WASD e setas alimentam o mesmo eixo, entao o personagem responde igual
 * para ambos.
 */
export function readAxis(input, codes) {
  let v = 0;
  for (const code of codes) if (input.isDown(code)) v += 1;
  return v;
}

export function anyPressed(input, codes) {
  for (const code of codes) if (input.wasPressed(code)) return true;
  return false;
}

export function anyDown(input, codes) {
  for (const code of codes) if (input.isDown(code)) return true;
  return false;
}
