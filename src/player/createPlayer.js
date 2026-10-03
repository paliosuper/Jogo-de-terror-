/**
 * createPlayer -- composicao/fabrica do SISTEMA DO JOGADOR.
 *
 * Monta Player + maquina de estados + velocidade + colisao + interacao +
 * animacao + camera e conecta ao EventBus:
 *
 *   ESCUTA (outros sistemas -> jogador):
 *     "player:set-speed-multiplier" { value, duration? }
 *     "player:lock-movement"        { locked, allowInteract? }
 *     "player:scare"                { duration?, reason? }
 *     "player:stun"                 { duration?, reason? }
 *     "environment:obstacles"       [ {x,y,w,h,...} ] | {rects:[...]}  (recarrega o mapa)
 *     "interactables:register"      { id, x, y, label?, onInteract? } | [ ... ]
 *     "interactables:unregister"    { id }
 *
 *   EMITE (jogador -> outros sistemas):
 *     "player:state-changed"         { from, to, reason, targetId }
 *     "player:facing-changed"        { facing }
 *     "player:interact"              { targetId, label, result }
 *     "player:interact-attempt"      { ok, targetId?, reason? }
 *     "player:interact-failed"       { reason }
 *     "player:collision"             { hits }
 *     "player:scared" / "player:stunned" / "player:teleported"
 *     "player:movement-lock-changed" / "player:movement-multiplier-changed"
 *
 * @param {{bus?: import("../core/EventBus.js").EventBus, input?: InputManager,
 *          position?: {x:number,y:number}, viewport?: {width:number,height:number}}} [options]
 */

import { EventBus } from "../core/EventBus.js";
import { InputManager } from "./InputManager.js";
import { PlayerStateMachine, PlayerState } from "./PlayerStateMachine.js";
import { SpeedSystem } from "./SpeedSystem.js";
import { CollisionSystem } from "./CollisionSystem.js";
import { InteractionSystem } from "./InteractionSystem.js";
import { SpriteAnimator } from "./SpriteAnimator.js";
import { AnimationLibrary } from "./AnimationLibrary.js";
import { CameraFollow } from "./CameraFollow.js";
import { Player } from "./Player.js";

export function createPlayer(options = {}) {
  const bus = options.bus ?? new EventBus();
  const input = options.input ?? new InputManager();
  const animations = new AnimationLibrary();
  const animator = new SpriteAnimator();
  const speedSystem = new SpeedSystem();
  const collision = new CollisionSystem();
  const interactions = new InteractionSystem({ bus });
  const camera = new CameraFollow({ viewport: options.viewport });

  // A maquina recebe uma referencia tardia ao Player (evita ciclo no construtor).
  let playerRef = null;
  const stateMachine = new PlayerStateMachine(() => playerRef, {
    initialState: PlayerState.IDLE,
  });

  const player = new Player({
    position: options.position,
    input,
    stateMachine,
    speedSystem,
    collision,
    interactions,
    animator,
    animations,
    camera,
    bus,
  });
  playerRef = player;

  // ------------------------------------------------- ponte EventBus <-> Player
  const subs = [
    bus.on("player:set-speed-multiplier", (p) =>
      player.setMovementMultiplier(p?.value ?? 1, { duration: p?.duration })
    ),
    bus.on("player:lock-movement", (p) =>
      player.lockMovement(Boolean(p?.locked), { allowInteract: Boolean(p?.allowInteract) })
    ),
    bus.on("player:scare", (p) => player.scare(p ?? {})),
    bus.on("player:stun", (p) => player.stun(p ?? {})),
    bus.on("environment:obstacles", (payload) => {
      const rects = Array.isArray(payload) ? payload : payload?.rects;
      if (!Array.isArray(rects)) return;
      collision.clearProviders("level");
      collision.addProvider(() => rects, { group: "level" });
    }),
    bus.on("interactables:register", (payload) => {
      const list = Array.isArray(payload) ? payload : [payload];
      for (const t of list) if (t?.id) interactions.register(t);
    }),
    bus.on("interactables:unregister", (payload) => {
      const ids = Array.isArray(payload) ? payload : [payload?.id];
      for (const id of ids) if (id) interactions.unregister(id);
    }),
  ];

  player.dispose = () => {
    for (const off of subs) off();
    input.dispose?.();
  };

  return { player, bus, input, camera, collision, interactions, speedSystem, animations, animator };
}

export { PlayerState };
