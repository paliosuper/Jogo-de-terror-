import { describe, it, expect } from "vitest";
import { EventBus } from "../src/core/EventBus.js";
import { createRadio, RadioPhase } from "../src/radio/index.js";

const DT = 1 / 60;
const runFor = (radio, seconds, until) => {
  let t = 0;
  const seen = [];
  while (t < seconds) {
    radio.update(DT);
    seen.push(radio.phase);
    t += DT;
    if (until && until(radio)) break;
  }
  return seen;
};

describe("rádio: transmissão canônica (sem áudio)", () => {
  it("SEARCHING -> RADIO SIGNAL DETECTED -> FREQUENCY 17 -> mensagem -> SIGNAL LOST", () => {
    const bus = new EventBus();
    const { radio } = createRadio({ bus, rng: () => 0.99 }); // sem flickers aleatórios
    const phases = new Set();
    const texts = [];
    bus.on("radio:phase-changed", (p) => phases.add(p.phase));
    bus.on("radio:message-revealed", (p) => texts.push(p.text));

    radio.transmit({ message: "Você demorou." });
    expect(radio.active).toBe(true);
    expect(radio.phase).toBe(RadioPhase.SEARCHING);

    // lead-in de estática
    runFor(radio, 0.5);
    expect(radio.phase).toBe(RadioPhase.SEARCHING);
    runFor(radio, 30, (r) => r.phase === RadioPhase.LOST);

    // ordem observada (IDLE final vem de stop(), nao do watcher de fases)
    expect([...phases]).toEqual([
      RadioPhase.SEARCHING,
      RadioPhase.REVEAL,
      RadioPhase.MESSAGE,
      RadioPhase.HOLD,
      RadioPhase.LOST,
    ]);
    expect(texts).toEqual(["Você demorou."]);
    expect(radio.active).toBe(false);
  });

  it("texto aparece GRADUALMENTE (nunca inteiro de uma vez)", () => {
    const { radio } = createRadio({ rng: () => 0.99 });
    radio.transmit(); // linhas padrão: RADIO SIGNAL DETECTED / FREQUENCY 17
    runFor(radio, 1.0); // passa o lead-in e entra em REVEAL
    expect(radio.phase).toBe(RadioPhase.REVEAL);
    const lengths = [];
    for (let i = 0; i < 40; i++) {
      radio.update(DT);
      lengths.push((radio.getState().statusLine ?? "").length);
    }
    const first = lengths[0];
    const last = lengths[lengths.length - 1];
    expect(first).toBeLessThan("RADIO SIGNAL DETECTED".length);
    expect(last).toBeGreaterThan(first);
    // nenhum salto para a linha inteira no primeiro frame do reveal
    expect(lengths.some((l) => l > 0 && l < 8)).toBe(true);
  });

  it("getState() expõe ondas, indicador e sinal perdido p/ o renderer", () => {
    const { radio } = createRadio({ rng: () => 0.99 });
    radio.transmit({ message: "Você demorou." });
    runFor(radio, 0.2);
    let s = radio.getState();
    expect(s.waveIntensity).toBeGreaterThan(0.5); // procurando = muita onda
    runFor(radio, 30, (r) => r.phase === RadioPhase.LOST);
    s = radio.getState();
    if (s.signalLost) expect(s.statusLine).toBe("SIGNAL LOST");
  });

  it("reentrante: nova transmissão substitui a anterior sem pendurar timers", () => {
    const { radio } = createRadio({ rng: () => 0.99 });
    radio.transmit({ message: "primeira" });
    runFor(radio, 1.2);
    radio.transmit({ message: "segunda" });
    expect(radio.phase).toBe(RadioPhase.SEARCHING);
    runFor(radio, 30, (r) => !r.active);
    expect(radio.active).toBe(false);
    expect(radio.phase).toBe(RadioPhase.IDLE);
  });

  it("forceSignalLost corta imediatamente; stop desliga", () => {
    const { radio } = createRadio({});
    radio.transmit({ message: "oi" });
    radio.forceSignalLost();
    expect(radio.phase).toBe(RadioPhase.LOST);
    radio.stop();
    expect(radio.phase).toBe(RadioPhase.IDLE);
    expect(radio.active).toBe(false);
  });

  it("EventBus dispara transmissões de fora ('radio:transmit')", () => {
    const bus = new EventBus();
    const { radio } = createRadio({ bus, rng: () => 0.99 });
    bus.emit("radio:transmit", { message: "Você demorou." });
    expect(radio.active).toBe(true);
    bus.emit("radio:stop");
    expect(radio.active).toBe(false);
  });

  it("hooks de áudio futuro são chamados sem quebrar nada", () => {
    const calls = [];
    const { radio } = createRadio({ rng: () => 0.99 });
    radio.onTransmissionStart = () => calls.push("start");
    radio.onBandChanged = (f) => calls.push(`band:${f}`);
    radio.onSignalLost = () => calls.push("lost");
    radio.transmit({ message: "x" });
    runFor(radio, 30, (r) => r.phase === RadioPhase.LOST);
    expect(calls).toContain("start");
    expect(calls).toContain("band:17");
    expect(calls).toContain("lost");
  });
});
