/**
 * radio/config.js -- numeros e textos do SISTEMA VISUAL DO RÁDIO.
 *
 * O radio funciona SEM arquivos de audio: tudo aqui e apresentacao (texto,
 * ondas, estatica). Quando o sistema de audio real existir, ele se pluga em
 * RadioController.onBandChanged / onTransmissionStart (ver hooks abaixo) --
 * nada precisa ser refeito.
 */

export const RADIO_CONFIG = Object.freeze({
  /** Frequencia da historia. */
  frequency: 17,

  texts: Object.freeze({
    detected: "RADIO SIGNAL DETECTED",
    frequency: "FREQUENCY 17",
    lost: "SIGNAL LOST",
    searching: "...", // placeholder enquanto o texto ainda "sintoniza"
  }),

  timings: Object.freeze({
    staticLeadIn: 0.9, // estatica antes do texto comecar a aparecer
    letterInterval: 0.045, // texto aparecendo gradualmente (char/seg ~ 22/s)
    lineGap: 0.35, // pausa entre as linhas de texto
    holdAfterText: 2.6, // transmite por um tempo apos completar o texto
    signalLostDuration: 1.4, // duracao do estado SIGNAL LOST
    waveSpeed: 2.4, // velocidade das senoides (rad/s na fase)
    flickerChance: 0.18, // probabilidade/seg de um glitch no texto
  }),

  waves: Object.freeze({
    count: 3, // camadas de onda empilhadas
    baseAmplitude: 6, // px de amplitude da onda principal
    noiseAmount: 0.35, // peso da estatica sobre a onda
  }),

  /**
   * Hooks de AUDIO para uso futuro (o sistema de audio os implementa; o
   * visual nunca depende deles para funcionar).
   *   onTransmissionStart(ctx) -> comecar static/broadcast audio
   *   onBandChanged(freq, ctx) -> trocar faixa sintonizada
   *   onSignalLost(ctx)        -> cortar audio com fade curto
   */
  audioHooks: Object.freeze({
    onTransmissionStart: null,
    onBandChanged: null,
    onSignalLost: null,
  }),
});
