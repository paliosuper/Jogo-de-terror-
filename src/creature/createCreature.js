/**
 * createCreature -- composicao/fabrica do SISTEMA DA CRIATURA.
 *
 * Monta Creature + maquina de estados + animator e conecta ao EventBus:
 *
 *   ESCUTA (orquestradores/narrativa -> criatura):
 *     "creature:first-appearance" { x, y, angle?, onEndTag? }  -> roteiro completo
 *     "creature:appear"           { x, y, angle?, duration? }
 *     "creature:disappear"        { duration? }
 *     "creature:walk"             { angle, duration?, slow?: boolean }
 *     "creature:stop"             {}
 *     "creature:idle"             { duration? }
 *     "creature:retreat"          { fromX?, fromY? }
 *     "creature:set-position"     { x, y }
 *     "creature:cancel"           {}  -> limpa timers pendentes de cena
 *
 *   EMITE:
 *     "creature:state-changed"    { from, to, reason }
 *     "creature:scene-started"/"creature:scene-ended" { scene }
 *     "creature:looking-at-player"{ strength }
 *     "creature:released-player"  {}
 *
 * @param {{bus?, player?, atmosphere?, position?, config?, rng?}} [options]
 *        `player`/`atmosphere` sao opcionais: sem eles a criatura ainda anda
 *        e some sozinha; os efeitos de medo simplesmente nao acontecem.
 */

import { EventBus } from "../core/EventBus.js";
import { Creature } from "./Creature.js";
import { CreatureStateMachine, CreatureState } from "./CreatureStateMachine.js";
import { CreatureAnimator } from "./CreatureAnimator.js";
import { CreatureBehaviour } from "./CreatureBehaviour.js";
import { CREATURE_CONFIG } from "./config.js";

export function createCreature(options = {}) {
  const bus = options.bus ?? new EventBus();
  const config = options.config ?? CREATURE_CONFIG;

  const stateMachine = new CreatureStateMachine({ initialState: CreatureState.HIDDEN });
  const animator = new CreatureAnimator({ sheet: config.sheet });
  const creature = new Creature({
    stateMachine,
    animator,
    bus,
    position: options.position,
    config,
  });

  let behaviour = null;
  if (options.player) {
    behaviour = new CreatureBehaviour({
      creature,
      player: options.player,
      atmosphere: options.atmosphere ?? null,
      bus,
      config,
      rng: options.rng,
    });
  }

  // ------------------------------------------------- ponte EventBus <-> sistema
  const subs = [
    bus.on("creature:first-appearance", (p) => {
      if (!behaviour || !p) return false;
      const ok = behaviour.firstAppearance(
        { x: p.x, y: p.y, angle: p.angle },
        {
          onEnd: () => bus.emit("creature:scene-ended", { scene: "first-appearance" }),
        }
      );
      return ok;
    }),
    bus.on("creature:appear", (p) => {
      if (!p) return;
      creature.appear({ x: p.x, y: p.y, angle: p.angle, duration: p.duration });
    }),
    bus.on("creature:disappear", (p) => creature.disappear(p ?? {})),
    bus.on("creature:walk", (p) => {
      if (!p || typeof p.angle !== "number") return;
      if (p.slow) creature.slowWalk(p.angle, { duration: p.duration });
      else creature.walk(p.angle, { duration: p.duration });
    }),
    bus.on("creature:stop", () => creature.stop()),
    bus.on("creature:idle", (p) => creature.idle({ duration: p?.duration })),
    bus.on("creature:retreat", (p) =>
      creature.retreat({ x: p?.fromX ?? options.player?.position?.x ?? 0, y: p?.fromY ?? options.player?.position?.y ?? 0 })
    ),
    bus.on("creature:set-position", (p) => {
      if (p) creature.setPosition(p.x, p.y);
    }),
    bus.on("creature:cancel", () => behaviour?.cancelPending()),
  ];

  /**
   * Um passo de simulacao por frame. `ctx.playerPosition` alimenta o LOOK.
   * O updateAmbient() roda aqui para que orquestradores nao precisem chamar
   * duas funcoes separadas.
   */
  const update = (dt, ctx = {}) => {
    creature.update(dt, ctx);
    behaviour?.updateAmbient(dt);
  };

  const dispose = () => {
    for (const off of subs) off();
    behaviour?.cancelPending();
  };

  return {
    creature,
    behaviour,
    stateMachine,
    animator,
    update,
    dispose,
    bus,
  };
}

export { Creature, CreatureStateMachine, CreatureState, CreatureAnimator, CreatureBehaviour, CREATURE_CONFIG };
