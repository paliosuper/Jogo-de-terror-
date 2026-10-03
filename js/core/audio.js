/* ============================================================
   audio.js — áudio 100% procedural via WebAudio (sem arquivos)
   ------------------------------------------------------------
   - Drone ambiente com LFO
   - Ruído de estática de rádio (volume ligado à "sintonia")
   - SFX sintetizados: passo, coleta, interação, glitch
   Quando o jogo tiver arquivos reais (assets/audio/*.ogg), basta
   adicionar fontes a elas — a API pública já está pronta.
   ============================================================ */
const AudioSys = (() => {

  let ctxA = null;       // AudioContext (criado no primeiro gesto do usuário)
  let masterGain = null;
  let droneOsc = null, droneGain = null, lfo = null;
  let noiseSrc = null, noiseGain = null;
  let started = false;

  /* ---- Inicialização (chamar num clique/tecla por política de autoplay) ---- */
  function start() {
    if (started) return;
    try {
      ctxA = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[Audio] WebAudio indisponível:', e);
      return;
    }
    started = true;

    masterGain = ctxA.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctxA.destination);

    // --- Drone grave ambiente ---
    droneGain = ctxA.createGain();
    droneGain.gain.value = 0.06;
    droneGain.connect(masterGain);

    droneOsc = ctxA.createOscillator();
    droneOsc.type = 'sine';
    droneOsc.frequency.value = 55; // A1 — som de "transmissor"
    droneOsc.connect(droneGain);

    // segundo oscilador levemente desafinado = batimento fantasma
    const osc2 = ctxA.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 55.7;
    const g2 = ctxA.createGain();
    g2.gain.value = 0.04;
    osc2.connect(g2).connect(masterGain);

    // LFO modula o volume do drone (respiração lenta)
    lfo = ctxA.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctxA.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(droneGain.gain);

    droneOsc.start(); osc2.start(); lfo.start();

    // --- Estática de rádio (ruído branco filtrado) ---
    const bufSize = ctxA.sampleRate * 2;
    const buffer = ctxA.createBuffer(1, bufSize, ctxA.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    noiseSrc = ctxA.createBufferSource();
    noiseSrc.buffer = buffer;
    noiseSrc.loop = true;

    const bp = ctxA.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.6;

    noiseGain = ctxA.createGain();
    noiseGain.gain.value = 0; // controlado pela sintonia
    noiseSrc.connect(bp).connect(noiseGain).connect(masterGain);
    noiseSrc.start();
  }

  /** Volume da estática: mais alto quando longe da frequência certa */
  function setStatic(level) {
    if (!noiseGain) return;
    noiseGain.gain.setTargetAtTime(U.clamp(level, 0, 0.15), ctxA.currentTime, 0.3);
  }

  /** Muda o tom do drone conforme a cena (estados emocionais) */
  function setDroneFreq(hz) {
    if (!droneOsc) return;
    droneOsc.frequency.setTargetAtTime(hz, ctxA.currentTime, 1.2);
  }

  /* ---- SFX sintetizados (curtos, um-shot) ---- */
  function blip(freq = 880, dur = 0.08, type = 'square', vol = 0.12) {
    if (!ctxA) return;
    const o = ctxA.createOscillator();
    const g = ctxA.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctxA.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctxA.currentTime + dur);
    o.connect(g).connect(masterGain);
    o.start();
    o.stop(ctxA.currentTime + dur + 0.02);
  }

  function sfxStep()        { blip(U.rand(90, 120), 0.05, 'triangle', 0.05); }
  function sfxInteract()    { blip(660, 0.1, 'sine', 0.1); }
  function sfxCollect() {
    // arpejo curto de "sinal recebido"
    blip(523, 0.09, 'sine', 0.12);
    setTimeout(() => blip(784, 0.09, 'sine', 0.12), 90);
    setTimeout(() => blip(1046, 0.16, 'sine', 0.12), 180);
  }
  function sfxGlitch() {
    if (!ctxA) return;
    blip(U.rand(120, 300), 0.06, 'sawtooth', 0.08);
    setTimeout(() => blip(U.rand(60, 140), 0.09, 'square', 0.06), 60);
  }

  function suspend() { if (ctxA && ctxA.state === 'running') ctxA.suspend(); }
  function resume()  { if (ctxA && ctxA.state === 'suspended') ctxA.resume(); }

  return { start, setStatic, setDroneFreq, sfxStep, sfxInteract,
           sfxCollect, sfxGlitch, suspend, resume };
})();
