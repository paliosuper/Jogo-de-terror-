/**
 * PlayerModule -- ponto de entrada unico do SISTEMA DO JOGADOR.
 *
 * Reexporta a fabrica e todas as pecas publicas para que outros sistemas
 * importem apenas daqui:
 *
 *   import { createPlayer, PlayerState } from "../player/index.js";
 *
 * Outros sistemas NAO devem importar arquivos internos (SpeedSystem etc.)
 * para mexer no jogador -- usem a API publica do Player ou o EventBus.
 */

export { createPlayer } from "./createPlayer.js";
export { Player, normalizeDir, facingFromVector, computeRun } from "./Player.js";
export { PlayerStateMachine, PlayerState, ALL_STATES } from "./PlayerStateMachine.js";
export { SpeedSystem } from "./SpeedSystem.js";
export { CollisionSystem } from "./CollisionSystem.js";
export { InteractionSystem } from "./InteractionSystem.js";
export { InputManager, DEFAULT_KEY_MAP } from "./InputManager.js";
export { SpriteAnimator } from "./SpriteAnimator.js";
export { AnimationLibrary } from "./AnimationLibrary.js";
export { CameraFollow } from "./CameraFollow.js";
export { PLAYER_CONFIG, DIRECTIONS, animationForState } from "./config.js";
// camada de apresentacao (Pixi) -- opcional, so para quem renderiza
export { PlayerRenderer } from "./PlayerRenderer.js";
