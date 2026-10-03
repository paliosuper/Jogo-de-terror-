/**
 * config.js -- unica fonte de numeros do SISTEMA DO JOGADOR.
 *
 * Tudo que outros sistemas podem querer calibrar (velocidades, multiplicador
 * de medo, coliders, layout da spritesheet) mora aqui. Nenhuma outra regra do
 * jogador deve carregar "magic numbers" hardcoded.
 */

import { PlayerState } from "./PlayerStateMachine.js";

/** Direcoes canonicas (ordem = linhas padrao da spritesheet). */
export const DIRECTIONS = Object.freeze(["down", "left", "right", "up"]);

export const PLAYER_CONFIG = Object.freeze({
  // ---------------------------------------------------------- movimento -----
  speed: Object.freeze({
    walk: 150, // px/s
    run: 260, // px/s
    scaredMultiplier: 0.7, // velocidade reduzida durante o medo
    stunnedMultiplier: 0, // sem controle enquanto atordoado
    /**
     * Corrida por dominancia de eixo: com WASD+setas misturados, a diagonal
     * vira corrida apenas quando um eixo domina claramente o outro.
     */
    runAxisDominance: 1.4,
    /** Se true, qualquer direcional + Shift corre em qualquer direcao. */
    allowDiagonalRun: false,
  }),

  // --------------------------------------------------------------- medo -----
  fear: Object.freeze({
    scareDuration: 0.9, // s em SCARED ao levar susto
    stunDuration: 1.6, // s em STUNNED
    speedMultiplierWhileScared: 0.7, // aplicado como multiplicador externo
  }),

  // --------------------------------------------------------- interacao ------
  interact: Object.freeze({
    keyRepeatDelay: 0.35, // s de cooldown entre apertos de E
    animationDuration: 0.45, // duracao do estado INTERACT
    range: 48, // px ate o alvo (checagem feita pelo InteractionSystem)
  }),

  // ------------------------------------------------------------ colisao -----
  collider: Object.freeze({
    width: 24, // largura do AABB de colisao
    height: 14, // altura do AABB (pe do personagem)
    offsetY: 20, // deslocamento do centro do sprite ate o centro do AABB
  }),

  // ------------------------------------------------- camera follow ----------
  camera: Object.freeze({
    mode: "smooth", // "instant" | "smooth" | "lag"
    smoothing: 0.12, // suavizacao (menor = mais atrasada) p/ modo smooth
    lag: 0.18, // metros-ish de atraso p/ modo lag
    deadzoneX: 0, // px de folga horizontal (0 = sempre centralizado)
    deadzoneY: 0,
    boundsPadding: 0, // margem p/ nao mostrar alem do mapa
  }),

  // -------------------------------------------------------- spritesheet -----
  sheet: Object.freeze({
    url: "assets/player/player_placeholder.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 6,
    rows: 4,
    /** Ordem das linhas na folha; troque se a arte real usar outra ordem. */
    directionRowOrder: ["down", "left", "right", "up"],
    /**
     * Animacoes por track. `row` pode ser numero (linha explicita) ou
     * "direction" (usa a linha da direcao atual). `frames` limita quantos
     * frames do inicio da linha essa animacao usa (placeholder = 6).
     */
    animations: Object.freeze({
      idle: Object.freeze({ row: "direction", frames: 1, fps: 1.5 }),
      walk: Object.freeze({ row: "direction", frames: 6, fps: 10 }),
      // alias de walk na folha placeholder (mesma linha, mais rapido);
      // troque `row` quando a arte real tiver uma fileira de corrida propria
      run: Object.freeze({ row: "direction", frames: 6, fps: 16 }),
      interact: Object.freeze({ row: 0, frames: 6, fps: 12 }),
      scared: Object.freeze({ row: 0, frames: 6, fps: 14 }),
      stunned: Object.freeze({ row: 0, frames: 6, fps: 8 }),
    }),
    /** Estado -> nome de animacao (troque para reaproveitar tracks existentes). */
    stateAnimation: Object.freeze({
      [PlayerState.IDLE]: "idle",
      [PlayerState.WALK]: "walk",
      [PlayerState.RUN]: "run",
      [PlayerState.INTERACT]: "interact",
      [PlayerState.SCARED]: "scared",
      [PlayerState.STUNNED]: "stunned",
    }),
  }),

  // -------------------------------------------------------------- debug -----
  dev: Object.freeze({
    showCollider: false,
    showFacingVector: false,
  }),
});

/** Nome da constante de estado -> animacao (exposto p/ UI/outros sistemas). */
export function animationForState(state) {
  return PLAYER_CONFIG.sheet.stateAnimation[state] ?? "idle";
}
