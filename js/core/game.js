/* ============================================================
   game.js — orquestrador: loop, troca de cenas com fade, HUD,
   medidor de sintonia (FREQ), diálogos e debug.
   ============================================================ */
const Game = (() => {

  let canvas, ctx;
  let current = null;             // cena ativa
  let time = 0;                   // tempo global (s)
  let lastTs = 0;
  let tuning = 34;                // medidor 0..100 -> mostra como 8.5..17.0
  let started = false;            // saiu da tela de título?
  let fadeEl, fadeBusy = false;

  /* ---------- Diálogo ---------- */
  const dialogue = {
    active: false,
    fullText: '',
    shown: 0,
    speaker: '',
    timer: 0,
    autoHide: 0,
    el: null, spkEl: null, txtEl: null, contEl: null,

    init() {
      this.el = document.getElementById('dialogue-box');
      this.spkEl = document.getElementById('dialogue-speaker');
      this.txtEl = document.getElementById('dialogue-text');
      this.contEl = document.getElementById('dialogue-continue');
    },

    show(speaker, text) {
      this.active = true;
      this.speaker = speaker;
      this.fullText = text;
      this.shown = 0;
      this.timer = 0;
      this.autoHide = 0;
      this.spkEl.textContent = speaker;
      this.txtEl.textContent = '';
      this.el.classList.remove('hidden');
      this.contEl.classList.add('hidden');
    },

    /** Texto temporário automático (usado por Game.say) */
    timed(speaker, text, secs) {
      this.show(speaker, text);
      this.autoHide = secs;
    },

    update(dt) {
      if (!this.active) return;
      this.timer += dt;
      const visible = U.typewrite(this.fullText, this.timer, 32);
      this.txtEl.textContent = visible;
      if (visible.length >= this.fullText.length) {
        this.contEl.classList.remove('hidden');
      }
      if (this.autoHide > 0) {
        this.autoHide -= dt;
        if (this.autoHide <= 0) this.hide();
      } else if (Input.justPressed('interact') &&
                 visible.length >= this.fullText.length) {
        this.hide();
      }
    },

    hide() {
      this.active = false;
      this.el.classList.add('hidden');
    }
  };

  /* ---------- Sintonia (mecânica central do HUD) ---------- */
  function addTuning(v) {
    tuning = U.clamp(tuning + v, 0, 100);
    updateHud();
  }

  function freqDisplay() {
    // 0% -> 8.5 MHz ... 100% -> 17.0 MHz
    return (8.5 + (tuning / 100) * 8.5).toFixed(1);
  }

  function updateHud() {
    document.getElementById('freq-fill').style.width = tuning + '%';
    document.getElementById('freq-value').textContent = freqDisplay();
    const sn = document.getElementById('scene-name');
    if (sn && current) sn.textContent = current.name.toUpperCase();
  }

  /* ---------- Troca de cena com fade ---------- */
  function changeScene(name, spawnAt) {
    if (fadeBusy) return;
    fadeBusy = true;
    fadeEl.classList.add('active');
    setTimeout(() => {
      if (current && current.exit) current.exit();
      Particles.clear();
      dialogue.hide();
      current = Scenes.create(name);
      Camera.setBounds(current.bounds);
      Lighting.setAmbient(current.ambient, current.ambientColor);
      AudioSys.setDroneFreq(current.droneFreq);
      if (spawnAt) Player.spawn(spawnAt.x - Player.state.w / 2, spawnAt.y);
      Camera.teleportTo(Player.getPos().x, Player.getPos().y);
      if (current.enter) current.enter();
      updateHud();
      fadeEl.classList.remove('active');
      fadeBusy = false;
    }, 600);
  }

  /* ============================================================
     OVERLAYS DE HUD EM CANVAS (game.setOverlay / drawOverlay)
     Usados pela abertura da torre: "RADIO SIGNAL DETECTED" etc.
     Overlay = { lines:[{text,color,size,weight}], t, dur, blink }
     Desenhado SEM afetar o Lighting (sempre visível).
     ============================================================ */
  let overlay = null;
  function setOverlay(o) { overlay = o; }

  function drawOverlay(ctx, vw, vh, time) {
    if (!overlay) return;
    const elapsed = time - overlay.t0;
    const life = U.clamp(1 - (elapsed - (overlay.dur - 0.6)) / 0.6, 0, 1);
    if (life <= 0) { overlay = null; return; }
    ctx.save();
    ctx.globalAlpha = life * (overlay.blink ? (0.75 + 0.25 * Math.sin(time * 14)) : 1);
    ctx.textAlign = 'center';
    let y = vh * 0.3;
    for (const ln of overlay.lines) {
      // sombra/glow por código — sem asset extra
      ctx.shadowColor = ln.glow || 'rgba(63,216,194,0.8)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = ln.color;
      ctx.font = `${ln.weight || 'bold'} ${ln.size || 22}px monospace`;
      ctx.fillText(ln.text, vw / 2, y);
      y += (ln.size || 22) + 10;
    }
    ctx.restore();
  }

  /* ---------- Loop principal ---------- */
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min((ts - lastTs) / 1000 || 0, 0.05); // clamp p/ abas em background
    lastTs = ts;
    time += dt;

    // ---- UPDATE ----
    if (started && current && !fadeBusy) {
      Player.update(dt, current.solids);
      current.update(dt);
    }
    dialogue.update(dt);
    Camera.update(dt);
    Particles.update(dt);

    // estática do rádio acompanha a distância da sintonia perfeita
    AudioSys.setStatic((1 - tuning / 100) * 0.09);

    // ---- DRAW ----
    const vw = canvas.width, vh = canvas.height;
    ctx.clearRect(0, 0, vw, vh);

    if (current) {
      if (started) Camera.follow(Player.getPos().x, Player.getPos().y, dt);

      // parallax (coords de tela, compensados internamente)
      const cam = Camera.getPos();
      Parallax.render(ctx, current.parallaxLayers, cam.x, cam.y, vw, vh, time);

      // mundo
      ctx.save();
      Camera.apply(ctx);
      current.drawFloor(ctx, time);
      current.drawSolids(ctx, time);
      current.drawLamps(ctx, time);
      current.drawEntitiesFront(ctx, time);
      current.drawExitsHint(ctx, time);
      ctx.restore();

      // luz (usa coords de tela)
      if (started) Player.addLights();
      current.addLights(ctx, time);
      Lighting.render(ctx, time);

      // overlay scripted por cima da escuridão (abertura da torre)
      drawOverlay(ctx, vw, vh, time);
    }

    // debug (F3)
    if (Input.justPressed('debug')) {
      document.getElementById('debug-info').classList.toggle('hidden');
    }
    const dbg = document.getElementById('debug-info');
    if (!dbg.classList.contains('hidden')) {
      dbg.textContent =
        `FPS ~${Math.round(1 / (dt || 0.016))} | t=${time.toFixed(1)}s\n` +
        `cena=${current ? current.name : '-'} pos=${Player.getPos().x.toFixed(0)},${Player.getPos().y.toFixed(0)}\n` +
        `tuning=${tuning}% (${freqDisplay()} MHz) particulas=${Particles.countAlive()}`;
    }

    Input.endFrame();
  }

  /* ---------- Boot ---------- */
  function boot(cv) {
    canvas = cv;
    ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;   // estética pixel

    fadeEl = document.getElementById('fade-overlay');
    dialogue.init();

    Camera.setViewport(canvas.width, canvas.height);
    Lighting.init(canvas.width, canvas.height);

    fitCanvas();
    window.addEventListener('resize', fitCanvas);

    Assets.loadAll().then(() => {
      // cena decorativa de fundo atrás do overlay HTML
      current = Scenes.create('title');
      Camera.setBounds(current.bounds);
      Lighting.setAmbient(current.ambient, current.ambientColor);
      updateHud();
      requestAnimationFrame((ts) => { lastTs = ts; frame(ts); });
    });

    document.getElementById('btn-start').addEventListener('click', () => {
      AudioSys.start();               // precisa de gesto do usuário
      const title = document.getElementById('title-screen');
      title.classList.add('gone');
      document.getElementById('hud').classList.remove('hidden');
      started = true;
      changeScene('tower', { x: 470, y: 180 });   // abertura: subida da torre
    });
  }

  /** Escala o canvas via CSS mantendo resolução interna fixa */
  function fitCanvas() {
    const scale = Math.min(
      window.innerWidth / canvas.width,
      window.innerHeight / canvas.height
    );
    canvas.style.width = Math.floor(canvas.width * scale) + 'px';
    canvas.style.height = Math.floor(canvas.height * scale) + 'px';
  }

  /** Atalho para falas ambientais automáticas */
  function say(speaker, text, secs = 4) {
    dialogue.timed(speaker, text, secs);
  }

  return {
    boot, changeScene, addTuning, say, updateHud, setOverlay,
    dialogue,
    get time() { return time; },
    get tuning() { return tuning; }
  };
})();
