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
    onDone: null,            // callback opcional: dispara quando a fala termina
    doneFired: false,        // (permite sequências narrativas sem reescrever nada)
    el: null, spkEl: null, txtEl: null, contEl: null,

    init() {
      this.el = document.getElementById('dialogue-box');
      this.spkEl = document.getElementById('dialogue-speaker');
      this.txtEl = document.getElementById('dialogue-text');
      this.contEl = document.getElementById('dialogue-continue');
    },

    show(speaker, text, onDone) {
      this.active = true;
      this.speaker = speaker;
      this.fullText = text;
      this.shown = 0;
      this.timer = 0;
      this.autoHide = 0;
      this.onDone = onDone || null;
      this.doneFired = false;
      this.spkEl.textContent = speaker;
      this.txtEl.textContent = '';
      this.el.classList.remove('hidden');
      this.contEl.classList.add('hidden');
    },

    /** Texto temporário automático (usado por Game.say) */
    timed(speaker, text, secs, onDone) {
      this.show(speaker, text, onDone);
      this.autoHide = secs;
    },

    update(dt) {
      if (!this.active) return;
      this.timer += dt;
      const visible = U.typewrite(this.fullText, this.timer, 32);
      this.txtEl.textContent = visible;
      if (visible.length >= this.fullText.length) {
        this.contEl.classList.remove('hidden');
        if (!this.doneFired) {
          this.doneFired = true;
          if (this.onDone) {
            const cb = this.onDone;
            this.hide();          // encerra aqui — o callback decide o próximo passo
            cb();
            return;
          }
        }
      }
      if (this.autoHide > 0) {
        this.autoHide -= dt;
        if (this.autoHide <= 0) this.hide();
      } else if (Input.justPressed('interact') &&
                 visible.length >= this.fullText.length) {
        this.hide();
      }
    },

    /** Fecha a caixa apenas se o texto já foi digitado por completo
        (fecha com E/Espaço — tratado pela cena; autoHide continua sozinho) */
    tryClose() {
      const visible = U.typewrite(this.fullText, this.timer, 32);
      if (visible.length >= this.fullText.length) this.hide();
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
    // trava anti-reentrância: impede duas transições simultâneas
    // (ex.: jogador encostado numa saída no exato frame da abertura do fade)
    if (current) current.exitsLocked = true;
    fadeBusy = true;
    fadeEl.classList.add('active');
    setTimeout(() => {
      const targetName = name;
      const scene = Scenes.create(targetName);
      // validação ANTES de destruir a cena atual: se o spawn cair dentro
      // de um sólido, reposiciona para fora — evita "grudar" em paredes.
      let sx = spawnAt ? spawnAt.x : Player.getPos().x;
      let sy = spawnAt ? spawnAt.y : Player.getPos().y;
      if (spawnAt) sx -= Player.state.w / 2;
      if (collidesIn(scene.solids, sx, sy)) {
        const fix = resolveSpawn(scene.solids, sx, sy);
        sx = fix.x; sy = fix.y;
      }
      if (current && current.exit) current.exit();
      Particles.clear();
      dialogue.hide();
      overlay = null;                  // overlays não vazam entre cenas
      current = scene;
      Camera.setBounds(current.bounds);
      Lighting.setAmbient(current.ambient, current.ambientColor);
      AudioSys.setDroneFreq(current.droneFreq);
      Player.spawn(sx, sy);
      Camera.teleportTo(Player.getPos().x, Player.getPos().y);
      if (current.enter) current.enter();
      updateHud();
      fadeEl.classList.remove('active');
      fadeBusy = false;
    }, 600);
  }

  /** Colisão do hitbox do jogador na posição proposta */
  function collidesIn(solids, px, py) {
    const hb = { x: px + 5, y: py + 22, w: Player.state.w - 10, h: 16 };
    for (const s of solids) if (U.aabb(hb, s)) return true;
    return false;
  }

  /** Empurra o spawn para a direção livre mais próxima (varredura simples) */
  function resolveSpawn(solids, px, py) {
    const dirs = [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
    for (let r = 16; r <= 320; r += 16) {
      for (const [dx, dy] of dirs) {
        const nx = px + dx * r, ny = py + dy * r;
        if (!collidesIn(solids, nx, ny)) return { x: nx, y: ny };
      }
    }
    return { x: px, y: py };   // último recurso: mantém e deixa a colisão agir
  }

  /** Permite às cenas pausarem o input do jogador sem reescrever o Player
      (usado durante créditos/eventos finais). Default sempre liberado. */
  let inputPaused = false;
  function setInputPaused(v) { inputPaused = !!v; }

  /* ============================================================
     OVERLAYS DE HUD EM CANVAS (game.setOverlay / drawOverlay)
     Usados pela abertura da torre: "RADIO SIGNAL DETECTED" etc.
     Overlay = { lines:[{text,color,size,weight}], t0, dur, blink,
                 fadeIn?, onDone? }
     Desenhado SEM afetar o Lighting (sempre visível).
     ============================================================ */
  let overlay = null;
  function setOverlay(o) { overlay = o; }

  function drawOverlay(ctx, vw, vh, time) {
    if (!overlay) return;
    const elapsed = time - overlay.t0;
    const fadeIn = overlay.fadeIn || 0.35;
    // fim de vida: fade-out nos últimos 0.6s
    const lifeOut = U.clamp(1 - (elapsed - (overlay.dur - 0.6)) / 0.6, 0, 1);
    if (elapsed >= overlay.dur) {
      const cb = overlay.onDone;
      overlay = null;
      if (cb) cb();                     // permite sequências (final/créditos)
      return;
    }
    const alpha = U.clamp(elapsed / fadeIn, 0, 1) * lifeOut;
    ctx.save();
    ctx.globalAlpha = alpha * (overlay.blink ? (0.75 + 0.25 * Math.sin(time * 14)) : 1);
    ctx.textAlign = 'center';
    let y = overlay.yStart !== undefined ? overlay.yStart : vh * 0.3;
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
      Player.update(dt, current.solids, inputPaused);
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

  /** Atalho para falas ambientais automáticas (callback opcional p/ sequências) */
  function say(speaker, text, secs = 4, onDone = null) {
    dialogue.timed(speaker, text, secs, onDone);
  }

  /** Exposto às cenas: estado global simples da run (narrativa/pistas).
      Persiste entre trocas de cena; resetado apenas ao recarregar a página. */
  const story = {
    boxTaken: false,        // caixa FREQUENCY 17 recuperada na torre
    radioSpoke: false,      // "Você demorou." exibido
    metCreature: false,     // criatura já apareceu (não ataca)
    knowsClock: false,      // viu o relógio em 03:17
    knowsMark17: false,     // viu as marcas "17" na torre
    photoFound: false,      // fotografia dele mesmo encontrada
    ended: false            // sequência final concluída
  };

  return {
    boot, changeScene, addTuning, say, updateHud, setOverlay, setInputPaused,
    dialogue, story,
    get time() { return time; },
    get tuning() { return tuning; }
  };
})();
