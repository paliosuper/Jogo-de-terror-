/**
 * radio/index.js -- ponto de entrada do SISTEMA VISUAL DO RÁDIO.
 *
 * Outros sistemas devem importar apenas daqui:
 *   import { createRadio, RadioPhase } from "../radio/index.js";
 *
 * A fabrica `createRadio` ja conecta o controller ao EventBus para que
 * QUALQUER sistema (narrativa, objetos, telas) dispare transmissões sem
 * importar este modulo:
 *
 *   ESCUTA:
 *     "radio:transmit"      { message?, lines?, frequency?, holdDuration?, leadIn? }
 *     "radio:signal-lost"   {}                 -> corta para SIGNAL LOST
 *     "radio:stop"          {}                 -> desliga imediatamente
 *   EMITE:
 *     "radio:phase-changed" { phase, frequency }
 *     "radio:message-revealed" { text }
 *     "radio:ended"         { frequency }
 */

import { EventBus } from "../core/EventBus.js";
import { RadioController, RadioPhase } from "./RadioController.js";
import { RADIO_CONFIG } from "./config.js";

export function createRadio(options = {}) {
  const bus = options.bus ?? new EventBus();
  const controller = new RadioController({
    config: options.config ?? RADIO_CONFIG,
    rng: options.rng,
  });

  // fase -> evento no bus (sem duplicar listeners: um unico watcher por frame)
  let lastPhase = controller.phase;
  const origUpdate = controller.update.bind(controller);
  controller.update = (dt) => {
    origUpdate(dt);
    if (controller.phase !== lastPhase) {
      lastPhase = controller.phase;
      bus.emit("radio:phase-changed", { phase: controller.phase, frequency: controller._frequency ?? controller.getContext().frequency });
    }
  };
  controller.onMessageRevealed = (text) => {
    options.onMessageRevealed?.(text);
    bus.emit("radio:message-revealed", { text });
  };
  controller.onEnded = (ctx) => {
    options.onEnded?.(ctx);
    bus.emit("radio:ended", { frequency: ctx.frequency });
  };

  const subs = [
    bus.on("radio:transmit", (p) => controller.transmit(p ?? {})),
    bus.on("radio:signal-lost", () => controller.forceSignalLost()),
    bus.on("radio:stop", () => controller.stop()),
  ];

  const dispose = () => {
    for (const off of subs) off();
    controller.stop();
  };

  return { radio: controller, controller, bus, dispose };
}

export { RadioController, RadioPhase, RADIO_CONFIG };
