/**
 * creature/index.js -- ponto de entrada unico do SISTEMA DA CRIATURA.
 *
 * Outros sistemas devem importar apenas daqui:
 *   import { createCreature, CreatureState } from "../creature/index.js";
 */

export { createCreature } from "./createCreature.js";
export { Creature } from "./Creature.js";
export { CreatureStateMachine, CreatureState, ALL_CREATURE_STATES, VISIBLE_STATES } from "./CreatureStateMachine.js";
export { CreatureAnimator } from "./CreatureAnimator.js";
export { CreatureBehaviour } from "./CreatureBehaviour.js";
export { CREATURE_CONFIG } from "./config.js";
// camada de apresentacao (Pixi) -- opcional, so para quem renderiza
export { CreatureRenderer } from "./CreatureRenderer.js";
