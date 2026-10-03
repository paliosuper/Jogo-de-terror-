/**
 * Acceptance checks for FREQUENCY 17.
 *
 * Phase 1  — Etapa 1 pure logic: movement, collision, camera, states,
 *            setMovementMultiplier, interaction registry.
 * Phase 1b — Etapa 2 data: world floors/triggers/spawns, 7-layer parallax,
 *            parallax drawing headless (incl. window clip).
 * Phase 2  — integration: runs the real src/main.ts headless with DOM/canvas
 *            stubs and drives the full opening → box → radio transmission →
 *            floor transitions through requestAnimationFrame frames.
 *
 * Run: bun scripts/verifyEtapa1.ts   (exit 0 = all checks pass)
 */
import { Camera } from "../src/game/core/camera";
import { Input } from "../src/game/core/input";
import { InteractionSystem, type Interactable } from "../src/game/interact/interaction";
import { drawParallax, drawParallaxForeground, LAYERS } from "../src/game/parallax/parallax";
import { Player } from "../src/game/player/player";
import { createArena } from "../src/game/world/arena";
import { createWorld, type Floor } from "../src/game/world/world";

let passed = 0;
let failed = 0;

function check(condition: boolean, name: string, detail = ""): void {
  if (condition) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function tryRun(name: string, fn: () => void): void {
  try {
    fn();
    check(true, name);
  } catch (error) {
    check(false, name, String(error));
  }
}

const DT = 1 / 60;
const arena = createArena();

function simulate(player: Player, input: Input, seconds: number): void {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) {
    player.update(DT, input, arena.solids);
  }
}

// ===========================================================================
console.log("ETAPA 1 — fase 1: lógica pura");
// ===========================================================================
{
  const p = new Player({ x: 500, y: 500 });
  const input = new Input();
  simulate(p, input, 0.5);
  check(p.state === "IDLE", "sem teclas → IDLE", `obtido ${p.state}`);
  check(p.x === 500 && p.y === 500, "sem teclas → posição imutável", `(${p.x}, ${p.y})`);
}

{
  const p = new Player({ x: 500, y: 500 });
  const input = new Input();
  input.press("KeyW");
  simulate(p, input, 0.5);
  input.release("KeyW");
  const dy = 500 - p.y;
  check(p.state === "WALK", "W → WALK", `obtido ${p.state}`);
  check(
    Math.abs(dy - p.baseSpeed * 0.5) < 0.5,
    "W percorre baseSpeed × tempo para cima",
    `dy=${dy.toFixed(3)}, esperado ${(p.baseSpeed * 0.5).toFixed(3)}`,
  );
}

{
  const p = new Player({ x: 500, y: 500 });
  const input = new Input();
  input.press("ArrowDown");
  simulate(p, input, 0.25);
  input.release("ArrowDown");
  check(p.y > 500, "ArrowDown move para baixo", `y=${p.y}`);
  const x0 = p.x;
  input.press("ArrowRight");
  simulate(p, input, 0.25);
  input.release("ArrowRight");
  check(p.x > x0, "ArrowRight move para a direita", `x=${p.x}`);
  check(p.facing === "right", "direção atualiza para right", `facing=${p.facing}`);
}

{
  const walk = new Player({ x: 500, y: 500 });
  const wInput = new Input();
  wInput.press("KeyW");
  simulate(walk, wInput, 0.5);
  const walkDist = 500 - walk.y;

  const run = new Player({ x: 500, y: 500 });
  const rInput = new Input();
  rInput.press("ShiftLeft");
  rInput.press("KeyW");
  simulate(run, rInput, 0.5);
  const runDist = 500 - run.y;

  check(run.state === "RUN", "Shift+W → RUN", `obtido ${run.state}`);
  check(
    Math.abs(runDist - walkDist * run.runMultiplier) < 0.5,
    "corrida cobre runMultiplier × caminhada",
    `walk=${walkDist.toFixed(2)}, run=${runDist.toFixed(2)}`,
  );
}

{
  const p = new Player({ x: 500, y: 500 });
  const input = new Input();
  p.setMovementMultiplier(0.7);
  check(p.getMovementMultiplier() === 0.7, "setMovementMultiplier(0.7) aplicado");

  input.press("KeyW");
  simulate(p, input, 0.5);
  input.release("KeyW");
  const slow = 500 - p.y;
  check(
    Math.abs(slow - 0.7 * p.baseSpeed * 0.5) < 0.5,
    "velocidade reduzida em 30% (0.7 × baseSpeed × t)",
    `dist=${slow.toFixed(3)}, esperado ${(0.7 * p.baseSpeed * 0.5).toFixed(3)}`,
  );

  p.setMovementMultiplier(1);
  const y0 = p.y;
  input.press("KeyW");
  simulate(p, input, 0.5);
  input.release("KeyW");
  const normal = y0 - p.y;
  check(
    Math.abs(normal - p.baseSpeed * 0.5) < 0.5,
    "multiplicador 1 restaura velocidade normal",
    `dist=${normal.toFixed(3)}`,
  );

  p.setMovementMultiplier(Number.NaN);
  check(p.getMovementMultiplier() === 1, "valor inválido é ignorado (continua 1)");
}

{
  const p = new Player({ x: 140, y: 500 });
  const input = new Input();
  input.press("KeyA");
  simulate(p, input, 3);
  check(p.x === 32, "colisão com parede esquerda (x trava em 32)", `x=${p.x}`);
  const overlaps = arena.solids.some(
    (s) => p.x < s.x + s.w && p.x + p.w > s.x && p.y < s.y + s.h && p.y + p.h > s.y,
  );
  check(!overlaps, "jogador nunca penetra um sólido");

  input.release("KeyA");
  const y0 = p.y;
  input.press("KeyW");
  simulate(p, input, 0.3);
  check(p.y < y0 && p.x === 32, "desliza ao longo da parede após colidir", `x=${p.x}, y=${p.y}`);
}

{
  const p = new Player({ x: 500, y: 500 });
  const input = new Input();
  input.press("KeyW");
  simulate(p, input, 5);
  // moving up: player top edge stops exactly at block bottom edge (220 + 24 = 244)
  check(p.y === 244, "colisão com bloco interno (y trava em 244)", `y=${p.y}`);
}

{
  const cam = new Camera(800, 600, arena.width, arena.height);
  // spawn is near the bottom-left: x clamps to 0, y clamps to max (1200-600)
  cam.follow(151, 1053);
  check(cam.x === 0 && cam.y === 600, "câmera presa na borda inferior-esquerda", `(${cam.x}, ${cam.y})`);
  cam.follow(811, 613);
  check(cam.x === 411 && cam.y === 313, "câmera centraliza no jogador", `(${cam.x}, ${cam.y})`);
  cam.follow(1590, 1190);
  check(cam.x === 800 && cam.y === 600, "câmera presa na borda oposta", `(${cam.x}, ${cam.y})`);
}

{
  const input = new Input();
  input.press("KeyE");
  check(input.wasPressed("KeyE"), "E gera pressionamento edge-triggered");
  input.endFrame();
  check(!input.wasPressed("KeyE"), "E é consumido após endFrame()");
  input.release("KeyE");

  const system = new InteractionSystem();
  let toggled = 0;
  const item: Interactable = {
    id: "teste",
    label: "OBJETO DE TESTE",
    rect: { x: 700, y: 480, w: 44, h: 44 },
    onInteract: () => {
      toggled++;
      return { message: "OK ATIVADO" };
    },
  };
  system.register(item);

  const far = { x: 100, y: 100, w: 22, h: 26 };
  check(system.interact(far) === null, "longe do objeto → nenhuma interação");
  check(toggled === 0, "objeto não é ativado à distância");

  const near = { x: 680, y: 470, w: 22, h: 26 };
  check(system.nearest(near) === item, "objeto detectado dentro do alcance");
  const event = system.interact(near);
  check(event !== null && event.message === "OK ATIVADO", "E perto do objeto → mensagem do efeito");
  check(toggled === 1, "efeito do objeto aplicado (toggle)", `toggled=${toggled}`);
}

// ===========================================================================
console.log("ETAPA 2 — fase 1b: dados do mundo + parallax");
// ===========================================================================
{
  const world = createWorld();
  const entrada = world.floors["entrada"];
  const radio = world.floors["radio"];
  const ext = world.floors["exterior"];
  check(!!entrada && !!radio && !!ext, "mundo possui entrada, sala do rádio e área externa");

  if (entrada && radio && ext) {
    check(!!entrada.stairs && !!radio.stairs, "escadas nas duas etagens");
    check(
      entrada.triggers.some((t) => t.kind === "stairs-up" && t.to === "radio"),
      "escada sobe para a sala do rádio",
    );
    check(
      radio.triggers.some((t) => t.kind === "stairs-down" && t.to === "entrada"),
      "escada desce para a entrada",
    );
    check(
      entrada.triggers.some((t) => t.kind === "door" && t.to === "exterior"),
      "porta leva à área externa",
    );
    check(
      ext.triggers.some((t) => t.kind === "door" && t.to === "entrada"),
      "porta externa volta à torre",
    );
    check(
      radio.windows.length === 1 && radio.solids.includes(radio.windows[0]),
      "janela na sala do rádio existe e é sólida",
    );
    check(ext.trees.length >= 5, "árvores colidíveis na área externa", `n=${ext.trees.length}`);
    check(ext.horizonY === 300, "horizonte da área externa em y=300");
    check(!!ext.path, "caminho decorativo na área externa");

    // every spawn must be free of solids and of destination triggers
    const hits = (
      a: { x: number; y: number; w: number; h: number },
      b: { x: number; y: number; w: number; h: number },
    ) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    const cases: { label: string; spawn: { x: number; y: number }; dest: Floor }[] = [];
    for (const floor of Object.values(world.floors)) {
      cases.push({ label: `${floor.id}:start`, spawn: floor.start, dest: floor });
      for (const t of floor.triggers) {
        cases.push({ label: `${floor.id}→${t.to}`, spawn: t.spawn, dest: world.floors[t.to] });
      }
    }
    const unsafe: string[] = [];
    for (const c of cases) {
      const box = { x: c.spawn.x, y: c.spawn.y, w: 22, h: 26 };
      if (c.dest.solids.some((s) => hits(box, s))) unsafe.push(`${c.label} (sólido)`);
      if (c.dest.triggers.some((t) => hits(box, t.rect))) unsafe.push(`${c.label} (trigger)`);
    }
    check(unsafe.length === 0, "todos os spawns nascem livres (sem loop de transição)", unsafe.join(", "));
  }
}

{
  check(LAYERS.length === 7, "parallax tem exatamente 7 camadas", `${LAYERS.length}`);
  const factors = LAYERS.map((l) => l.factor);
  check(new Set(factors).size === 7, "cada camada tem velocidade diferente");
  check(
    LAYERS.every((l, i) => i === 0 || l.factor > LAYERS[i - 1].factor),
    "fatores em ordem crescente (mais perto = mais rápido)",
  );
}

// --- headless ctx stub (also used by phase 2) ---
function makeCtxStub(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const base: Record<string | symbol, unknown> = {
    measureText: (text: string) => ({ width: text.length * 8 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({}),
  };
  const proxy = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === "string") return () => undefined;
      return undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
  return proxy as unknown as CanvasRenderingContext2D;
}

const ctxStub = makeCtxStub();

{
  const cam = new Camera(1280, 720, 1600, 1200);
  cam.follow(400, 400);
  tryRun("drawParallax completo não lança (horizonte na tela)", () => {
    drawParallax(ctxStub, cam, 1280, 720, { horizonY: 300 });
  });
  tryRun("drawParallax não lança com horizonte acima da tela", () => {
    drawParallax(ctxStub, cam, 1280, 720, { horizonY: -180 });
  });
  tryRun("drawParallax com clip de janela não lança", () => {
    drawParallax(ctxStub, cam, 1280, 720, {
      clip: { x: 100, y: 80, w: 160, h: 24 },
      horizonY: 92,
      refY: 92,
    });
  });
  tryRun("drawParallaxForeground não lança", () => {
    drawParallaxForeground(ctxStub, cam, 1280, 720);
  });
  cam.x = 987.65; // non-integer camera offsets exercise the tile math
  tryRun("drawParallax não lança com offset fracionário", () => {
    drawParallax(ctxStub, cam, 1280, 720, { horizonY: 100 });
  });
}

// ===========================================================================
console.log("ETAPA 2 — fase 2: loop real (abertura, caixa, rádio, transições)");
// ===========================================================================
type RafCallback = (time: number) => void;

const rafQueue: RafCallback[] = [];
let simTime = 0;

const canvasStub = {
  width: 0,
  height: 0,
  getContext: () => ctxStub,
};

const windowStub = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

const documentStub = {
  getElementById: (id: string) => (id === "game" ? canvasStub : null),
};

Object.assign(globalThis, {
  window: windowStub,
  document: documentStub,
  requestAnimationFrame: (cb: RafCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  },
});

function pump(frames: number, dtMs = 1000 / 60): void {
  for (let i = 0; i < frames; i++) {
    simTime += dtMs;
    const callbacks = rafQueue.splice(0, rafQueue.length);
    if (callbacks.length === 0) throw new Error("fila de requestAnimationFrame vazia — o loop parou");
    for (const cb of callbacks) cb(simTime);
  }
}

function pumpUntil(cond: () => boolean, maxFrames: number): boolean {
  for (let i = 0; i < maxFrames; i++) {
    if (cond()) return true;
    pump(1);
  }
  return cond();
}

interface GameStatus {
  floorId: string;
  phase: string;
  openingPhase: string;
  radioOn: boolean;
  transmissionActive: boolean;
  transcript: string[];
  box: { x: number; y: number } | null;
}

interface GameApi {
  player: Player;
  camera: Camera;
  input: Input;
  interactions: InteractionSystem;
  setMovementMultiplier: (value: number) => void;
  getMovementMultiplier: () => number;
  getCurrentSpeed: () => number;
  getGameStatus: () => GameStatus;
}

try {
  await import("../src/main");
  const api = (globalThis as unknown as { window: { __frequency17?: GameApi } }).window
    .__frequency17;

  check(!!api, "main.ts inicializa e expõe window.__frequency17");
  if (api) {
    const status = (): GameStatus => api.getGameStatus();

    pump(3);
    check(status().floorId === "entrada", "jogo inicia dentro da torre (entrada)", status().floorId);
    check(status().phase === "opening", "sequência de abertura em andamento", status().phase);
    check(status().openingPhase === "beat", "abertura começa com um instante parado (beat)", status().openingPhase);
    check(api.player.state === "IDLE", "loop real inicia em IDLE", api.player.state);

    // 1) full opening: climb → trip → box falls → control returns
    const gotControl = pumpUntil(() => status().phase === "control", 500);
    check(gotControl, "abertura completa → controle volta ao jogador", `phase=${status().phase}`);
    check(api.player.y < 400, "jogador subiu as escadas antes do tropeço", `y=${api.player.y.toFixed(0)}`);
    const box = status().box;
    check(box !== null, "caixa registrada após o tropeço (interagível)");
    if (box) {
      check(
        box.y > api.player.y + 60,
        "caixa parou alguns degraus ABAIXO do jogador",
        `caixa.y=${box.y.toFixed(0)}, jogador.y=${api.player.y.toFixed(0)}`,
      );
    }
    check(api.interactions.get("fallen-box") !== null, "caixa está no sistema de interação (E)");

    // 2) movement / camera / multiplier inside the real loop
    api.player.x = 600;
    api.player.y = 900;
    pump(2);
    const camY0 = api.camera.y;
    const y0 = api.player.y;
    api.input.press("KeyW");
    pump(90);
    api.input.release("KeyW");
    pump(1);
    check(api.player.y < y0, "W move o jogador no loop real", `y: ${y0} → ${api.player.y}`);
    check(api.camera.y < camY0, "câmera acompanha o jogador", `cam.y: ${camY0} → ${api.camera.y}`);

    api.setMovementMultiplier(0.7);
    check(api.getMovementMultiplier() === 0.7, "setMovementMultiplier chamado no jogo em execução");
    const slow0 = api.player.y;
    api.input.press("KeyW");
    pump(30);
    api.input.release("KeyW");
    pump(1);
    const slow = slow0 - api.player.y;
    check(slow > 0, "jogador ainda anda com multiplicador 0.7 (controles nunca bloqueiam)");

    api.setMovementMultiplier(1);
    const fast0 = api.player.y;
    api.input.press("KeyW");
    pump(30);
    api.input.release("KeyW");
    pump(1);
    const fast = fast0 - api.player.y;
    check(
      Math.abs(fast - slow / 0.7) < 1.5,
      "multiplicador 1 restaura a velocidade no jogo real",
      `lento=${slow.toFixed(1)}, normal=${fast.toFixed(1)}, esperado ~${(slow / 0.7).toFixed(1)}`,
    );

    // 3) pick the box with E → radio event with the required texts
    if (box) {
      api.player.x = box.x - 30;
      api.player.y = box.y;
      pump(2);
      api.input.press("KeyE");
      pump(1);
      api.input.release("KeyE");
      pump(1);
      check(status().phase === "transmission", "E na caixa inicia o evento do rádio", status().phase);
      check(status().radioOn, "rádio ligou sozinho ao pegar a caixa");
      check(api.interactions.get("fallen-box") === null, "caixa removida após ser pegue");

      const finished = pumpUntil(() => status().phase === "control", 900);
      check(finished, "transmissão termina e o controle volta ao jogador", `phase=${status().phase}`);
      const transcript = status().transcript;
      check(transmissionHas(transcript, "RADIO SIGNAL DETECTED"), "texto RADIO SIGNAL DETECTED exibido");
      check(transmissionHas(transcript, "FREQUENCY 17"), "texto FREQUENCY 17 exibido");
      check(transmissionHas(transcript, "Você demorou."), "mensagem 'Você demorou.' exibida");
    } else {
      check(false, "caixa disponível para o teste de E");
    }

    // 4) door → exterior (parallax rendered there)
    api.player.x = 10;
    api.player.y = 580;
    check(
      pumpUntil(() => status().floorId === "exterior", 120),
      "porta leva à área externa (fade + troca de piso)",
      status().floorId,
    );
    pump(30); // frames rendering the 7-layer parallax
    check(status().floorId === "exterior", "permanece na área externa", status().floorId);

    // 5) back in, climb to the radio floor (window parallax renders there)
    api.player.x = 560;
    api.player.y = 690;
    check(
      pumpUntil(() => status().floorId === "entrada", 120),
      "porta externa volta à torre",
      status().floorId,
    );
    api.player.x = 750;
    api.player.y = 150;
    check(
      pumpUntil(() => status().floorId === "radio", 120),
      "escada sobe para a sala do rádio",
      status().floorId,
    );

    // 6) the radio is on and answers
    api.player.x = 1210;
    api.player.y = 460;
    pump(2);
    const event = api.interactions.interact(api.player.rect);
    check(
      event !== null && event.message.includes("FREQUENCY 17"),
      "rádio ligado responde com FREQUENCY 17",
      event ? event.message : "sem evento",
    );
    check(
      api.interactions.get("tower-radio")?.visualState?.() === "on",
      "LED/ondas do rádio ativo",
    );
    pump(20); // radio floor renders (window parallax included)
    check(true, "loop de render executou sem erros em todas as áreas");
  }
} catch (error) {
  check(false, "execução headless de src/main.ts sem exceções", String(error));
}

function transmissionHas(transcript: string[], text: string): boolean {
  return transcript.some((line) => line.includes(text));
}

// ---------------------------------------------------------------------------
console.log(`\nResultado: ${passed} ok, ${failed} falha(s)`);
if (failed > 0) process.exit(1);
