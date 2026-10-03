/**
 * creature/config.js -- unica fonte de numeros do SISTEMA DA CRIATURA.
 *
 * A criatura NAO tem combate: apenas comportamento de presenca (andar, parar,
 * virar a cabeca, olhar, desaparecer, recuar). Os tempos abaixo definem a
 * "linguagem corporal" do terror -- timing e ritmo importam mais que velocidade.
 */

export const CREATURE_CONFIG = Object.freeze({
  // ------------------------------------------------------------- movimento --
  speed: Object.freeze({
    walk: 46, // px/s -- "anda normalmente" (ritmo humano calmo ao fundo)
    slowWalk: 18, // px/s -- "andar lentamente" (pausada, pesada)
    retreat: 30, // px/s -- recua na direcao oposta, sem quebrar o contato visual
  }),

  // ---------------------------------------------------------- aparencia ------
  sheet: Object.freeze({
    url: "assets/creature/creature_placeholder.png",
    frameWidth: 48,
    frameHeight: 64,
    columns: 6,
    rows: 5,
    animations: Object.freeze({
      idle: Object.freeze({ row: 0, frames: 6, fps: 2.5, loop: true }),
      walk: Object.freeze({ row: 1, frames: 6, fps: 8, loop: true }),
      slowWalk: Object.freeze({ row: 2, frames: 6, fps: 4, loop: true }),
      turn: Object.freeze({ row: 3, frames: 6, fps: 2.2, loop: false }),
      look: Object.freeze({ row: 3, frames: 6, fps: 0.8, startFrame: 5, loop: false }),
      retreat: Object.freeze({ row: 4, frames: 6, fps: 5, loop: true }),
    }),
  }),

  fade: Object.freeze({
    appearDuration: 1.4, // aparece devagar ("no cenario", nao em jumpscare)
    disappearDuration: 0.7, // desaparece logo apos o olhar (~1s de olhar + fade)
    idleOpacity: 0.9, // ao fundo ela nunca esta 100% nitida
  }),

  // ------------------------------------------------- primeira aparição ------
  // Parametros defaults usados por CreatureBehaviour.firstAppearance().
  firstAppearance: Object.freeze({
    walkDuration: 4.2, // caminha ao fundo por ~4s
    pauseSettle: 0.35, // desacelera ate parar
    turnDuration: 1.6, // vira a cabeca LENTAMENTE (track "turn")
    lookDuration: 1.0, // olha diretamente para o jogador (~1s)
    vanishDelay: 0.0, // extra antes de sumir (alem do fade)
    // efeitos pedidos sobre o jogador/camera durante o "olhar":
    playerSpeedMultiplier: 0.7, // reduz a velocidade do jogador p/ ~70%
    shakeAmplitude: 2.2, // px -- tremor PEQUENO
    shakeFrequency: 11, // Hz
    vignetteStrength: 0.45, // escurece levemente as bordas
  }),

  // ------------------------------------------------------------------ IA ----
  awareness: Object.freeze({
    /** Se o jogador chegar perto demais enquanto ela anda, ela recua. */
    personalSpaceRadius: 120,
    /** Fora dessa distancia ela perde o interesse (some sozinha no idle longo). */
    interestRadius: 640,
    /** Pausa aleatoria entre comportamentos ociosos (segundos). */
    idlePauseRange: [3.5, 9],
  }),
});
