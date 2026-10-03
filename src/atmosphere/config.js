/**
 * atmosphere/config.js -- numeros da ATMOSFERA (efeitos reutilizaveis).
 */

export const ATMOSPHERE_CONFIG = Object.freeze({
  shake: Object.freeze({
    smallAmplitude: 2.2, // px -- "pequena vibracao" pedida no olhar da criatura
    smallFrequency: 11, // Hz
    smallDuration: 0.9, // s
  }),
  vignette: Object.freeze({
    ambientBase: 0.12, // vinheta leve permanente (clima)
    lookPulse: 0.45, // nivel durante o contato visual
  }),
  fade: Object.freeze({
    openingDuration: 2.5, // abertura preta -> cena (reservado p/ telas usarem)
    blackoutDuration: 1.2,
  }),
});
