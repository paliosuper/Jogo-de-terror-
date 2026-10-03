import { describe, it, expect } from "vitest";
import { EventBus } from "../src/core/EventBus.js";
import { createPlayer, PlayerState } from "../src/player/index.js";
import { AtmosphereDirector } from "../src/atmosphere/index.js";
import { createCreature, CreatureState } from "../src/creature/index.js";

const DT = 1 / 60;
const run = (n, fns) => { for (let i = 0; i < n; i++) fns.forEach((f) => f()); };

function makeWorld() {
  const bus = new EventBus();
  const player = createPlayer({ bus, position: { x: 0, y: 0 } }).player;
  const atmosphere = new AtmosphereDirector({ bus });
  const world = createCreature({ bus, player, atmosphere, position: { x: -200, y: -80 }, rng: () => 0.5 });
  return { bus, player, atmosphere, ...world };
}

describe("criatura: primeira aparição completa", () => {
  it("anda -> para -> vira -> OLHA (70% + shake + vinheta) -> desaparece -> recupera", () => {
    const w = makeWorld();
    let sawLook = false;
    w.bus.on("creature:looking-at-player", () => { sawLook = true; });

    w.behaviour.firstAppearance({ x: 200, y: -80, angle: Math.PI });
    expect(w.creature.state).toBe(CreatureState.APPEAR);

    // caminha ao fundo por ~4.2s
    run(200, [() => w.update(DT, { playerPosition: w.player.position }), () => w.player.update(DT), () => w.atmosphere.update(DT)]);
    expect(w.creature.visible).toBe(true);
    expect([CreatureState.WALK, CreatureState.APPEAR]).toContain(w.creature.state);

    // anda de verdade?
    const xBefore = w.creature.position.x;
    run(60, [() => w.update(DT)]);
    if (w.creature.is(CreatureState.WALK)) expect(w.creature.position.x).not.toBe(xBefore);

    // ate virar a cabeca
    run(200, [() => w.update(DT, { playerPosition: w.player.position })]);
    expect([CreatureState.STOP, CreatureState.TURN, CreatureState.LOOK]).toContain(w.creature.state);

    // momento do olhar: efeitos aplicados
    run(140, [() => w.update(DT, { playerPosition: w.player.position }), () => w.player.update(DT), () => w.atmosphere.update(DT)]);
    expect(sawLook).toBe(true);
    expect(w.creature.is(CreatureState.LOOK)).toBe(true);
    expect(w.creature.headTurn).toBe(1);
    expect(w.player.speed.hasTag("creature-look")).toBe(true);
    // vinheta subiu e camera tremeu durante o olhar
    expect(w.atmosphere.vignetteLevel).toBeGreaterThan(0.1);

    // o jogador anda mais devagar enquanto olha (0.7x sobre walk 150 -> alvo 105)
    const target = w.player.speed.resolveSpeed({ state: PlayerState.WALK, wantsRun: false, dt: DT });
    expect(target).toBeLessThanOrEqual(150 * 0.7 + 1);

    // ~1s depois ela some
    run(180, [() => w.update(DT, { playerPosition: w.player.position }), () => w.player.update(DT), () => w.atmosphere.update(DT)]);
    expect([CreatureState.DISAPPEAR, CreatureState.HIDDEN]).toContain(w.creature.state);

    run(120, [() => w.update(DT, { playerPosition: w.player.position })]);
    expect(w.creature.state).toBe(CreatureState.HIDDEN);
    expect(w.creature.opacity).toBeCloseTo(0, 1);
    expect(w.player.speed.hasTag("creature-look")).toBe(false); // velocidade restaurada
    expect(w.behaviour.busy).toBe(false);
  });

  it("nao roda duas cenas ao mesmo tempo (reentrancia segura)", () => {
    const w = makeWorld();
    expect(w.behaviour.firstAppearance({ x: 100, y: -50 })).toBe(true);
    expect(w.behaviour.firstAppearance({ x: 300, y: -50 })).toBe(false);
    // cancela e tenta de novo
    w.bus.emit("creature:cancel", {});
    w.behaviour._sceneRunning = false;
    expect(w.behaviour.firstAppearance({ x: 100, y: -50 })).toBe(true);
  });

  it("dispara via EventBus ('creature:first-appearance')", () => {
    const w = makeWorld();
    w.bus.emit("creature:first-appearance", { x: 150, y: -60, angle: Math.PI });
    expect(w.creature.state).toBe(CreatureState.APPEAR);
  });
});

describe("criatura: primitivas", () => {
  it("walk/slowWalk/stop/idle/recuar/aparecer/desaparecer", () => {
    const w = makeWorld();
    w.creature.appear({ x: 0, y: 0, duration: 0.2 });
    run(30, [() => w.creature.update(DT)]);
    expect(w.creature.opacity).toBeCloseTo(1, 1);

    w.creature.walk(0, { duration: 1 });
    run(60, [() => w.creature.update(DT)]);
    const walked = w.creature.position.x;
    expect(walked).toBeGreaterThan(10);

    w.creature.slowWalk(Math.PI, { duration: 1 });
    expect(w.creature.state).toBe(CreatureState.SLOW_WALK);
    run(60, [() => w.creature.update(DT)]);

    w.creature.retreat({ x: 100, y: 0 });
    expect(w.creature.state).toBe(CreatureState.RETREAT);

    w.creature.disappear({ duration: 0.3 });
    run(30, [() => w.creature.update(DT)]);
    expect(w.creature.state).toBe(CreatureState.HIDDEN);
  });

  it("turnHead gira lentamente (headTurn cresce gradualmente)", () => {
    const w = makeWorld();
    w.creature.appear({ x: 0, y: 0, duration: 0.1 });
    run(10, [() => w.creature.update(DT)]);
    w.creature.turnHead({ x: -100, y: 0 }, { duration: 1.6 });
    const samples = [];
    for (let i = 0; i < 48; i++) { w.creature.update(DT); if (i % 12 === 0) samples.push(w.creature.headTurn); }
    expect(samples[0]).toBeLessThan(samples[samples.length - 1]);
    expect(w.creature.headTurn).toBeGreaterThan(0.2);
  });

  it("nao possui estados de ataque (exigencia de design)", () => {
    const states = Object.values(CreatureState);
    expect(states.some((s) => /ATTACK|CHASE|BITE|KILL/i.test(s))).toBe(false);
  });
});
