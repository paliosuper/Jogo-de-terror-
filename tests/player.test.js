import { describe, it, expect } from "vitest";
import { createPlayer, PlayerState } from "../src/player/index.js";
import { InputManager } from "../src/player/InputManager.js";

const DT = 1 / 60;

function makeSim() {
  const target = new EventTarget();
  const input = new InputManager({ target });
  const world = createPlayer({ input, position: { x: 300, y: 300 } });
  const press = (code) => target.dispatchEvent(new KeyboardEvent("keydown", { code }));
  const release = (code) => target.dispatchEvent(new KeyboardEvent("keyup", { code }));
  const step = (n = 1, fn = null) => {
    for (let i = 0; i < n; i++) {
      if (fn) fn(i);
      world.player.update(DT);
    }
  };
  return { ...world, input, press, release, step };
}

describe("movimentacao WASD + setas", () => {
  it("KeyW move para cima e ArrowUp tambem (mesmo eixo)", () => {
    const s = makeSim();
    s.press("KeyW");
    s.step(30);
    expect(s.player.position.y).toBeLessThan(300);
    s.release("KeyW");
    const y0 = s.player.position.y;
    s.press("ArrowUp");
    s.step(30);
    expect(s.player.position.y).toBeLessThan(y0);
  });

  it("setas left/right/left movem horizontalmente", () => {
    const s = makeSim();
    s.press("ArrowRight");
    s.step(30);
    expect(s.player.position.x).toBeGreaterThan(300);
    expect(s.player.facing).toBe("right");
    s.release("ArrowRight");
    s.press("KeyA");
    s.step(80);
    expect(s.player.position.x).toBeLessThan(320);
    expect(s.player.facing).toBe("left");
  });

  it("Shift transforma WALK em RUN", () => {
    const s = makeSim();
    s.press("KeyD");
    s.step(40);
    expect(s.player.state).toBe(PlayerState.WALK);
    s.press("ShiftLeft");
    s.step(40);
    expect(s.player.state).toBe(PlayerState.RUN);
    const runSpeed = s.player.speedValue;
    s.release("ShiftLeft");
    s.step(40);
    expect(s.player.state).toBe(PlayerState.WALK);
    expect(runSpeed).toBeGreaterThan(s.player.speedValue);
  });

  it("sem teclas -> IDLE", () => {
    const s = makeSim();
    s.press("KeyS");
    s.step(20);
    s.release("KeyS");
    s.step(20);
    expect(s.player.state).toBe(PlayerState.IDLE);
  });
});

describe("colisao", () => {
  it("impede atravessar obstaculo e desliza no outro eixo", () => {
    const s = makeSim();
    s.collision.addRect({ x: 380, y: 300, w: 40, h: 200 }); // parede vertical
    // anda para a direita E para baixo na diagonal -> deve parar em X, deslizar em Y
    s.press("KeyD");
    s.press("KeyS");
    s.step(120);
    expect(s.player.position.x).toBeLessThan(380);
    expect(s.player.position.y).toBeGreaterThan(305); // deslizou
  });

  it("teleport para area bloqueada e ignorado", () => {
    const s = makeSim();
    s.collision.addRect({ x: 500, y: 500, w: 60, h: 60 });
    expect(s.player.teleport(500, 500)).toBe(false);
    expect(s.player.position).toEqual({ x: 300, y: 300 });
    expect(s.player.teleport(100, 100)).toBe(true);
  });
});

describe("API publica para outros sistemas", () => {
  it("setMovementMultiplier(0.7) reduz velocidade sem tocar em internals", () => {
    const s = makeSim();
    s.player.setMovementMultiplier(0.7);
    s.press("KeyD");
    s.step(60);
    const walk = s.player.getMovementMultiplier();
    expect(walk).toBeCloseTo(0.7);
    const speedWithFear = s.player.speedValue;
    s.player.setMovementMultiplier(1);
    s.step(60);
    expect(s.player.speedValue).toBeGreaterThan(speedWithFear);
  });

  it("lockMovement(true) congela; lockMovement(false) libera", () => {
    const s = makeSim();
    s.press("KeyD");
    s.step(30);
    s.player.lockMovement(true);
    const x0 = s.player.position.x;
    s.step(60);
    expect(s.player.position.x).toBe(x0);
    expect(s.player.state).toBe(PlayerState.IDLE);
    s.player.lockMovement(false);
    s.step(30);
    expect(s.player.position.x).toBeGreaterThan(x0);
  });

  it("eventos do bus controlam o jogador de fora", () => {
    const s = makeSim();
    s.bus.emit("player:set-speed-multiplier", { value: 0.5 });
    expect(s.player.getMovementMultiplier()).toBeCloseTo(0.5);
    s.bus.emit("player:lock-movement", { locked: true });
    expect(s.player.movementLocked).toBe(true);
    s.bus.emit("player:lock-movement", { locked: false });
    expect(s.player.movementLocked).toBe(false);
  });
});

describe("estados temporarios nunca prendem o jogador", () => {
  it("scare() expira sozinho e restaura a velocidade", () => {
    const s = makeSim();
    s.player.scare({ duration: 0.5 });
    expect(s.player.state).toBe(PlayerState.SCARED);
    s.step(90); // 1.5s
    expect(s.player.state).toBe(PlayerState.IDLE);
    s.press("KeyD");
    s.step(60);
    expect(s.player.state).toBe(PlayerState.WALK);
    expect(s.player.speedValue).toBeCloseTo(150, 0);
  });

  it("stun() expira e retorna a IDLE (bug antigo: preso em SCARED)", () => {
    const s = makeSim();
    s.player.stun({ duration: 0.4 });
    expect(s.player.state).toBe(PlayerState.STUNNED);
    s.step(90);
    expect(s.player.state).toBe(PlayerState.IDLE);
    s.press("KeyW");
    s.step(30);
    expect(s.player.state).toBe(PlayerState.WALK);
  });

  it("multiplicador com duracao se auto-remove", () => {
    const s = makeSim();
    s.player.setMovementMultiplier(0.7, { duration: 0.5 });
    s.step(90);
    expect(s.player.getMovementMultiplier()).toBe(1);
  });
});

describe("interacao com E", () => {
  it("apertar E perto de um alvo dispara onInteract e o evento player:interact", () => {
    const s = makeSim();
    let fired = 0;
    s.interactions.register({ id: "box", x: 310, y: 305, onInteract: () => fired++ });
    const events = [];
    s.bus.on("player:interact", (p) => events.push(p));
    s.press("KeyE");
    s.step(10);
    expect(fired).toBe(1);
    expect(s.player.state).toBe(PlayerState.INTERACT);
    expect(events[0].targetId).toBe("box");
    s.step(60); // INTERACT termina
    expect(s.player.state).toBe(PlayerState.IDLE);
  });

  it("longe de qualquer alvo falha sem travar estados", () => {
    const s = makeSim();
    s.press("KeyE");
    s.step(60);
    expect(s.player.state).toBe(PlayerState.IDLE);
  });
});

describe("camera segue o jogador", () => {
  it("acompanha apos movimento e da snap em teleport", () => {
    const s = makeSim();
    s.press("KeyD");
    s.step(120);
    expect(Math.abs(s.camera.x - s.player.position.x)).toBeLessThan(30);
    s.player.teleport(800, 800);
    expect(s.camera.x).toBe(800);
  });
});
