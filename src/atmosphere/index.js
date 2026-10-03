/**
 * atmosphere/index.js -- ponto de entrada dos EFEITOS DE ATMOSFERA.
 *
 * Outros sistemas devem importar apenas daqui:
 *   import { AtmosphereDirector } from "../atmosphere/index.js";
 */

export { AtmosphereDirector } from "./AtmosphereDirector.js";
export { CameraShake } from "./CameraShake.js";
export { VignetteController } from "./VignetteController.js";
export { FadeController } from "./FadeController.js";
export { InterferenceModel } from "./InterferenceModel.js";
export { Tween, Easings } from "./Tween.js";
export { ATMOSPHERE_CONFIG } from "./config.js";
