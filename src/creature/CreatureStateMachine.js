/**
 * CreatureStateMachine -- maquina de estados da CRIATURA.
 *
 * Estados (todos "de presenca", nenhum de combate):
 *   HIDDEN     -- fora de cena (alpha 0, nao atualizada alem do fade)
 *   APPEAR     -- materializando-se devagar no cenario (no jumpscare)
 *   IDLE       -- parada, respirando, olhando a frente
 *   WALK       -- anda normalmente
 *   SLOW_WALK  -- andar lentamente (pausado, pesado)
 *   STOP       -- desacelerando ate parar (transicao WALK -> IDLE/TURN)
 *   TURN       -- vira a cabeca lentamente na direcao de um alvo
 *   LOOK       -- contato visual direto com o jogador (momento do terror)
 *   RETREAT    -- recua mantendo os olhos no jogador
 *   DISAPPEAR  -- desvanece e volta a HIDDEN
 *
 * Nao ha ATTACK / CHASE: a criatura nunca ataca (exigencia de design).
 */

export const CreatureState = Object.freeze({
  HIDDEN: "HIDDEN",
  APPEAR: "APPEAR",
  IDLE: "IDLE",
  WALK: "WALK",
  SLOW_WALK: "SLOW_WALK",
  STOP: "STOP",
  TURN: "TURN",
  LOOK: "LOOK",
  RETREAT: "RETREAT",
  DISAPPEAR: "DISAPPEAR",
});

export const ALL_CREATURE_STATES = Object.freeze(Object.values(CreatureState));

/** Estados em que a criatura esta visivel em cena. */
export const VISIBLE_STATES = new Set([
  CreatureState.APPEAR,
  CreatureState.IDLE,
  CreatureState.WALK,
  CreatureState.SLOW_WALK,
  CreatureState.STOP,
  CreatureState.TURN,
  CreatureState.LOOK,
  CreatureState.RETREAT,
  CreatureState.DISAPPEAR,
]);

export class CreatureStateMachine {
  /** @param {{initialState?: string}} [options] */
  constructor(options = {}) {
    this._state = options.initialState ?? CreatureState.HIDDEN;
    /** @type {Map<string, {enter?:Function, exit?:Function}>} */
    this._hooks = new Map();
    /** chamado em toda transicao: (from, to, payload) */
    this.onChange = null;
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

  get visible() {
    return VISIBLE_STATES.has(this._state);
  }

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

  /**
   * Forca uma transicao (usado pela IA e por scripts de cena).
   * @returns {boolean} true se houve mudanca
   */
  force(next, payload = undefined) {
    if (next === this._state || !ALL_CREATURE_STATES.includes(next)) return false;
    const prev = this._state;
    this._hooks.get(prev)?.exit?.(prev, next, payload);
    this._state = next;
    this._hooks.get(next)?.enter?.(next, prev, payload);
    this.onChange?.(prev, next, payload);
    return true;
  }
}
