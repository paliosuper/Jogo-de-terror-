import { describe, it, expect } from "vitest";
import { EventBus } from "../src/core/EventBus.js";
import { AtmosphereDirector, CameraShake, VignetteController, FadeController, InterferenceModel, Tween } from "../src/atmosphere/index.js";

const DT = 1 / 60;

describe("efeitos reutilizáveis", () => {
  it("camera shake pequeno: desloca e MORRA sozinho (sem timer eterno)", () => {
    const shake = new CameraShake();
    shake.play({ amplitude: 2.2, frequency: 11, duration: 0.9 });
    let moved = false;
    for (let i = 0; i < 30; i++) { const p = shake.update(DT); if (Math.abs(p.x) > 0.1) moved = true; }
    expect(moved).toBe(true);
    for (let i = 0; i < 80; i++) shake.update(DT);
    expect(shake.active).toBe(false);
    expect(shake.x).toBe(0);
  });

  it("vários shakes somam sem cancelar um ao outro", () => {
    const shake = new CameraShake();
    shake.small("a");
    shake.small("b");
    shake.update(DT);
    expect(shake._active.length).toBe(2);
  });

  it("vinheta: pulso sobe, segura e volta a zero", () => {
    const v = new VignetteController({ base: 0 });
    v.pulse({ target: 0.45, fadeIn: 0.3, hold: 1.0, fadeOut: 0.8 });
    let peak = 0;
    for (let i = 0; i < 240; i++) peak = Math.max(peak, v.update(DT));
    expect(peak).toBeGreaterThanOrEqual(0.4);
    expect(v.level).toBeLessThan(0.05);
  });

  it("fade rotulado: aparecimento e desaparecimento coexistem", () => {
    const f = new FadeController();
    f.play("opening", { from: 1, to: 0, duration: 1 });
    f.play("creature", { from: 0, to: 1, duration: 0.5 });
    for (let i = 0; i < 60; i++) f.update(DT);
    expect(f.alpha("opening")).toBeCloseTo(0.5, 1);
    expect(f.alpha("creature")).toBeCloseTo(1, 1);
    for (let i = 0; i < 120; i++) f.update(DT);
    expect(f.get("creature").finished).toBe(true);
  });

  it("interferência gera ruído 0..1 e rajadas controláveis", () => {
    const m = new InterferenceModel({ level: 0.3, seed: 7 });
    let min = 1, max = 0;
    for (let i = 0; i < 120; i++) { m.update(DT); min = Math.min(min, m.noise); max = Math.max(max, m.noise); }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
    expect(max).toBeGreaterThan(min); // varia de verdade
    m.spike(1, 0.3);
    m.update(DT);
    expect(m.noise).toBeGreaterThan(0.3);
  });

  it("Tween com easing termina e dispara onComplete", () => {
    let done = false;
    const t = new Tween({ from: 0, to: 10, duration: 0.5, easing: "quadOut" });
    t.onComplete = () => (done = true);
    for (let i = 0; i < 40; i++) t.update(DT);
    expect(done).toBe(true);
    expect(t.value).toBeCloseTo(10, 5);
  });

  it("AtmosphereDirector responde a eventos do bus (qualquer sistema dispara efeitos)", () => {
    const bus = new EventBus();
    const d = new AtmosphereDirector({ bus });
    bus.emit("atmosphere:shake", { amplitude: 2, duration: 0.5 });
    bus.emit("atmosphere:vignette", { target: 0.4, fadeIn: 0.1, hold: 0.5, fadeOut: 0.2 });
    let peakOffset = 0, peakVig = 0;
    for (let i = 0; i < 60; i++) {
      d.update(DT);
      peakOffset = Math.max(peakOffset, Math.abs(d.cameraOffset.x));
      peakVig = Math.max(peakVig, d.vignetteLevel);
    }
    expect(peakOffset).toBeGreaterThan(0.2);
    expect(peakVig).toBeGreaterThan(0.2);
    for (let i = 0; i < 180; i++) d.update(DT);
    expect(Math.abs(d.cameraOffset.x)).toBe(0);
    d.dispose();
    bus.emit("atmosphere:shake", {}); // pós-dispose nao reativa listeners
    expect(d.cameraShake.active).toBe(false);
  });
});
