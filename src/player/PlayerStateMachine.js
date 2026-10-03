/**
 * PlayerStateMachine -- maquina de estados do jogador.
 *
 * Estados publicos reutilizaveis: IDLE, WALK, RUN, INTERACT, SCARED, STUNNED.
 * Cada estado declara como calcular a velocidade e qual animacao tocar; a
 * transicao em si eh centralizada aqui (guardas + callbacks onEnter/onExit).
 *
 * Regras de prioridade (de cima para baixo):
 *   STUNNED  > SCARED > INTERACT > (movimento) > IDLE
 *
 * - STUNNED/SCARED sao impostos por outros sistemas (susto da historia, etc.)
 *   e bloqueiam entrada/interacao enquanto ativos.
 * - INTERACT tem duracao fixa e nao interrompe STUNNED/SCARED.
 * - WALK/RUN dependem do input, desde que o movimento esteja liberado.
 */

export const PlayerState = Object.freeze({
  IDLE: "IDLE",
  WALK: "WALK",
  RUN: "RUN",
  INTERACT: "INTERACT",
  SCARED: "SCARED",
  STUNNED: "STUNNED",
});

export const ALL_STATES = Object.freeze(Object.values(PlayerState));

/** Estados que ignoram completamente o input de direcao. */
const BLOCKING_STATES = new Set([PlayerState.SCARED, PlayerState.STUNNED]);

export class PlayerStateMachine {
  /**
   * @param {object} player instancia do Player (le facing/speed/movement flags)
   * @param {{initialState?: string, onChange?: (from:string,to:string)=>void}} [options]
   */
  constructor(player, options = {}) {
    this._player = player;
    this._state = options.initialState ?? PlayerState.IDLE;
    this._onChange = options.onChange ?? null;
    /** @type {Map<string, {enter?:Function, exit?:Function}>} */
    this._hooks = new Map();
  }

  get state() {
    return this._state;
  }

  is(state) {
    return this._state === state;
  }

  any(states) {
    return states.includes(this._state);
  }

  /** Registra callbacks de entrada/saida para um estado (uso interno/extensao). */
  onEnter(state, fn) {
    this._hookFor(state).enter = fn;
    return this;
  }

  onExit(state, fn) {
    this._hookFor(state).exit = fn;
    return this;
  }

  _hookFor(state) {
    if (!this._hooks.has(state)) this._hooks.set(state, {});
    return this._hooks.get(state);
  }

  /** Player efetivo (desembrulha referencia tardia usada pela fabrica). */
  _p() {
    return typeof this._player === "function" ? this._player() : this._player;
  }

  /**
   * Forca uma transicao imediata (usado pelos hooks internos e por API publica).
   * @returns {boolean} true se houve mudanca
   */
  force(next, payload) {
    if (next === this._state || !ALL_STATES.includes(next)) return false;
    const prev = this._state;
    const p = this._p();
    this._hooks.get(prev)?.exit?.(p, next);
    this._state = next;
    this._hooks.get(next)?.enter?.(p, prev, payload);
    this._onChange?.(prev, next, payload);
    return true;
  }

  /**
   * Atualiza as regras de transicao "livres" (input -> IDLE/WALK/RUN/INTERACT).
   * STUNNED/SCARED nunca saem daqui -- so pela duracao ou por clearScare().
   */
  update(context) {
    switch (this._state) {
      case PlayerState.STUNNED:
        // sai sozinho quando o timer do Player expira (ver Player.update)
        return;

      case PlayerState.SCARED:
        if (context.scareTimer <= 0) this.force(PlayerState.IDLE, { reason: "recovered" });
        return;

      case PlayerState.INTERACT:
        // animacao de interacao eh curta; ao terminar, retoma o movimento/input
        if (context.interactTimer <= 0) {
          this.force(this._movementState(context), { reason: "finished" });
        }
        return;

      default: {
        // IDLE / WALK / RUN
        if (BLOCKING_STATES.has(this._state)) return; // defensivo
        if (context.interactIntent) {
          this.force(PlayerState.INTERACT, { targetId: context.interactTargetId });
          return;
        }
        const next = this._movementState(context);
        if (next !== this._state) this.force(next, { reason: "input" });
      }
    }
  }

  /** Estado de movimento correspondente ao input atual. */
  _movementState(context) {
    if (!context.canMove || context.inputDir.isZero) return PlayerState.IDLE;
    return context.wantsRun ? PlayerState.RUN : PlayerState.WALK;
  }
}
