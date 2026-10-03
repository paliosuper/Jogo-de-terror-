/* ============================================================
   tower.js — CENA 1 (ABERTURA): Torre de rádio abandonada.
   O jogador começa SUBINDO as escadas metálicas da torre durante a
   própria gameplay (sem cutscene separada); tropeça e derruba uma
   pequena caixa etiquetada "FREQUENCY 17", que quica degrau a degrau
   até parar alguns degraus abaixo. Ele recupera o controle, desce
   até a caixa e, ao pegá-la, o rádio da torre liga sozinho —
   comunicado VISUALMENTE (overlay no canvas, sem depender de áudio):
     RADIO SIGNAL DETECTED / FREQUENCY 17  ->  "Você demorou."
   Depois o controle fica totalmente livre e a trilha p/ as ruínas abre.

   PREPARADO PARA ETAPAS FUTURAS: criatura, rádio real, objetos e
   eventos de história (ver marcações PREPARE-SE no fim do arquivo).

   Reutilização de assets: pine_silhouette vira floresta distante,
   intermediária, árvores próximas E foreground (só escala/alpha);
   tower_truss modular repete em X/Y; shack/antenna/lamp reusados.
   ============================================================ */
Scenes.register('tower', () => {

  /* ---------- Layout do mundo ---------- */
  const W = 2400, H = 1600;          // mundo alto: subida + área externa
  const GROUND_Y = 1380;             // linha do chão (base da torre)
  const STAIR_TOP_Y = 320;           // patamar do topo
  const LAND_X = 1000, LAND_W = 400; // vão central das escadas
  const RUNTS = [                    // montantes laterais (treliça)
    { x: 950, y: 320, w: 14, h: 1060 },
    { x: 1436, y: 320, w: 14, h: 1060 }
  ];

  const s = new Scene('tower');
  s.bounds = { w: W, h: H };
  s.ambient = 0.74;                  // exterior noturno: a lua ilumina um pouco
  s.ambientColor = '6, 11, 20';
  s.droneFreq = 58;

  /* ---------- Sólidos ---------- */
  // bordas do mundo
  s.solids.push({ x: -60, y: 0, w: 60, h: H });
  s.solids.push({ x: W, y: 0, w: 60, h: H });
  s.solids.push({ x: 0, y: H, w: W, h: 60 });
  s.solids.push({ x: 0, y: -60, w: W, h: 60 });
  // chão da área externa, com vão central por onde as escadas descem
  s.solids.push({ x: 0, y: GROUND_Y, w: LAND_X, h: 220 });
  s.solids.push({ x: LAND_X + LAND_W, y: GROUND_Y, w: W - LAND_X - LAND_W, h: 220 });
  // patamar do topo
  s.solids.push({ x: LAND_X, y: STAIR_TOP_Y, w: LAND_W, h: 40 });
  // montantes
  for (const r of RUNTS) s.solids.push(r);

  // degraus nas bordas do vão: NÃO são solids (no mundo top-down eles
  // bloqueariam a passagem vertical). Servem de colisão para a CAIXA e
  // de pintura metálica — leitura visual de escada sem impedir o jogador.
  const STEP_H = 10, STEP_GAP = 26;
  const steps = [];
  for (let sy = GROUND_Y - STEP_GAP; sy > STAIR_TOP_Y + 20; sy -= STEP_GAP) {
    steps.push({ x: LAND_X, y: sy, w: 30, h: STEP_H, kind: 'stepL' });
    steps.push({ x: LAND_X + LAND_W - 30, y: sy, w: 30, h: STEP_H, kind: 'stepR' });
  }

  // cabana do operador (base da torre)
  const SHACK = { x: 1560, y: GROUND_Y - 110, w: 160, h: 110 };
  s.solids.push({ x: SHACK.x, y: SHACK.y, w: SHACK.w, h: SHACK.h });

  // rochas/morros baixos para quebrar a planície externa
  s.solids.push({ x: 250, y: GROUND_Y - 34, w: 90, h: 34 });
  s.solids.push({ x: 560, y: GROUND_Y - 26, w: 70, h: 26 });
  s.solids.push({ x: 1980, y: GROUND_Y - 40, w: 110, h: 40 });

  /* ---------- Luzes fixas ---------- */
  s.lamps.push({ x: 1200, y: STAIR_TOP_Y, flicker: 0.4, radius: 130 }); // hall do topo
  s.lamps.push({ x: SHACK.x + 20, y: GROUND_Y, flicker: 0.15, radius: 100 });

  /* ============================================================
     ABERTURA SCRIPTED (dentro da gameplay)
     climb -> stumble -> fall -> recover -> pickup -> signal -> done
     ============================================================ */
  const intro = {
    active: false,
    phase: 'idle',
    t: 0,
    box: null,
    radioOn: false,
    demeanorShown: false,
    startedOnce: false
  };
  s.intro = intro;                   // exposto p/ debug e etapas futuras

  s.enter = function () {
    if (!intro.startedOnce) {        // primeira visita: roda a abertura
      intro.startedOnce = true;
      intro.active = true;
      intro.phase = 'climb';
      intro.t = 0;
      s.exitsLocked = true;
      Player.setControlLocked(true);
      intro.box = { x: 1200, y: 250, vx: 0, vy: 0, resting: true, taken: false, spin: 0 };
    } else {                         // revisitas: estado pós-abertura
      intro.active = false;
      intro.phase = 'done';
      s.exitsLocked = false;
      intro.radioOn = true;
      if (intro.box && !intro.box.taken) intro.box.resting = true;
    }
  };

  /* ---------- Caixa: gravidade fake + quique nos degraus ---------- */
  function updateBox(dt) {
    const b = intro.box;
    if (!b || b.taken || b.resting) return;

    b.vy += 520 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.spin += (Math.abs(b.vx) + Math.abs(b.vy)) * dt * 0.05;

    for (const st of steps) {
      if (b.x > st.x - 8 && b.x < st.x + st.w + 8 &&
          b.y > st.y - 4 && b.y < st.y + 16 && b.vy > 0) {
        b.y = st.y - 4;
        b.vy *= -0.38;                              // quique fraco
        b.vx = (st.kind === 'stepL' ? 1 : -1) * U.rand(25, 55); // escorrega p/ dentro
        Particles.burst(b.x, b.y + 6, 4, {
          color: 'rgba(150,140,120,0.5)', speedMax: 40, life: 0.5
        });
        if (Math.abs(b.vy) < 40) { b.resting = true; b.vx = b.vy = 0; } // parou alguns degraus abaixo
        break;
      }
    }
    if (b.x < LAND_X + 18) { b.x = LAND_X + 18; b.vx = Math.abs(b.vx) * 0.5; }
    if (b.x > LAND_X + LAND_W - 18) { b.x = LAND_X + LAND_W - 18; b.vx = -Math.abs(b.vx) * 0.5; }
    if (b.y > GROUND_Y - 14) { b.y = GROUND_Y - 14; b.resting = true; }
  }

  /* ---------- Overlays visuais do sinal (não dependem de áudio) ---------- */
  function showSignalOverlay() {
    Game.setOverlay({
      t0: Game.time, dur: 3.2, blink: true,
      lines: [
        { text: 'RADIO SIGNAL DETECTED', color: '#3fd8c2', size: 26 },
        { text: 'FREQUENCY 17', color: '#e8f4f0', size: 34 }
      ]
    });
  }
  function showDemeanorLine() {
    Game.setOverlay({
      t0: Game.time, dur: 3.4, blink: false,
      lines: [{ text: '“Você demorou.”', color: '#d8dde0', size: 30 }]
    });
    Game.addTuning(20);                // HUD reage junto: sintonia sobe
    Camera.shake(2, 0.35);
  }

  /* ---------- Máquina da abertura ---------- */
  function updateIntro(dt) {
    intro.t += dt;
    updateBox(dt);

    switch (intro.phase) {

      case 'climb': {
        // auto-subida: o personagem anda sozinho escada acima
        Player.addNudge(0, -46, 0.12);            // reaplicado a cada frame
        if (intro.t > 4.5) {                      // "depois de alguns segundos"
          intro.phase = 'stumble'; intro.t = 0;
          intro.stumbleFired = false;
        }
        break;
      }

      case 'stumble': {
        if (!intro.stumbleFired) {                // dispara uma única vez
          intro.stumbleFired = true;
          Player.addNudge(U.rand(-25, 25), 140, 0.45);   // tropeço
          Camera.shake(4, 0.4);
          AudioSys.sfxGlitch();                          // opcional; o foco é visual
          const b = intro.box;                           // a caixa cai pela escada
          if (b) { b.resting = false; b.vy = -40; b.vx = U.rand(35, 75) * (Math.random() < 0.5 ? -1 : 1); }
          Game.say('', '…!', 0.9);
        }
        if (intro.t > 0.9) { intro.phase = 'fall'; intro.t = 0; }
        break;
      }

      case 'fall': {
        if (intro.box && intro.box.resting) {
          intro.phase = 'recover'; intro.t = 0;
        } else if (intro.t > 4) {                        // trava de segurança
          if (intro.box) { intro.box.resting = true; }
          intro.phase = 'recover'; intro.t = 0;
        }
        break;
      }

      case 'recover': {
        if (intro.t > 1.2) {
          Player.setControlLocked(false);        // devolve o controle
          intro.phase = 'pickup';
          Game.say('TORRE', 'a caixa escapou… desça e pegue-a.', 4);
        }
        break;
      }

      case 'pickup': {
        const b = intro.box;
        if (b && !b.taken) {
          const pp = Player.getPos();
          if (U.dist(pp.x, pp.y, b.x, b.y) < 30) {
            b.taken = true;
            b.resting = true;
            intro.phase = 'signal'; intro.t = 0;
            intro.radioOn = true;                // o rádio liga sozinho
            Particles.burst(b.x, b.y, 22, {
              color: 'rgba(63,216,194,0.9)', speedMax: 110, life: 0.9, glow: true
            });
            AudioSys.sfxCollect();
            showSignalOverlay();                 // RADIO SIGNAL DETECTED / FREQUENCY 17
          }
        }
        break;
      }

      case 'signal': {
        if (intro.t > 3.4 && !intro.demeanorShown) {
          intro.demeanorShown = true;
          showDemeanorLine();                    // "Você demorou."
        }
        if (intro.t > 7.4) {
          intro.phase = 'done';
          intro.active = false;
          s.exitsLocked = false;                 // trilha liberada
          Game.addTuning(10);
          Game.say('RÁDIO', '…hzzt… frequência alvo: 17.0. siga a trilha para leste.', 6);
        }
        break;
      }
    }
  }

  /* ---------- Update geral ---------- */
  const baseUpdate = s.update.bind(s);
  s.update = (dt) => {
    if (intro.active) updateIntro(dt);
    baseUpdate(dt);

    // poeira ambiente deriva com o vento frio do morro
    if (Math.random() < 0.25) {
      const cam = Camera.getPos();
      Particles.emit({
        x: cam.x + U.rand(0, 960), y: cam.y + U.rand(100, 500),
        vx: U.rand(12, 30), vy: U.rand(-4, 4),
        life: 2.2, size: 1, color: 'rgba(160,180,190,0.10)'
      });
    }
  };

  /* ============================================================
     PARALLAX — 7 camadas pedidas, velocidades diferentes
     depth = fator de deslocamento horizontal (menor = mais longe)
     yAnchor = deslocamento vertical relativo à câmera
     ============================================================ */

  /* 1) CÉU — gradiente noturno quase estático */
  s.parallaxLayers.push(Parallax.layer({
    depth: 0.02, yAnchor: 0.05,
    draw: (ctx, vw, vh) => {
      const g = ctx.createLinearGradient(0, 0, 0, vh);
      g.addColorStop(0, '#050810');
      g.addColorStop(0.55, '#081019');
      g.addColorStop(1, '#0b141d');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
    }
  }));

  /* 2) LUA + ESTRELAS — movimento mínimo (infinito) */
  s.parallaxLayers.push(Parallax.layer({
    depth: 0.06, yAnchor: 0.1,
    draw: (ctx, vw, vh, offX, offY, time) => {
      const rng = U.seededRandom(1702);
      for (let i = 0; i < 90; i++) {
        const sx = ((rng() * vw * 3 - offX) % (vw + 4) + vw + 4) % (vw + 4) - 2;
        const sy = rng() * vh * 0.55 - offY;
        const tw = 0.2 + 0.8 * Math.abs(Math.sin(time * (0.4 + rng()) + i));
        ctx.fillStyle = `rgba(201,214,221,${0.18 * tw})`;
        ctx.fillRect(sx, sy, rng() > 0.9 ? 2 : 1, rng() > 0.9 ? 2 : 1);
      }
      // lua pálida com halo (gradiente por código — sem asset)
      const mx = vw * 0.72 - offX, my = 110 - offY * 0.4;
      const g = ctx.createRadialGradient(mx, my, 10, mx, my, 90);
      g.addColorStop(0, 'rgba(201,214,221,0.45)');
      g.addColorStop(0.35, 'rgba(150,180,190,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(mx, my, 90, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(214,224,228,0.5)';
      ctx.beginPath(); ctx.arc(mx, my, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(120,140,150,0.25)';       // crateras: só alpha
      ctx.beginPath(); ctx.arc(mx - 8, my - 4, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(mx + 9, my + 8, 4, 0, Math.PI * 2); ctx.fill();
    }
  }));

  /* 3) MONTANHAS — silhueta tileada (período modular de 1200px) */
  s.parallaxLayers.push(Parallax.layer({
    depth: 0.14, yAnchor: 0.25,
    draw: (ctx, vw, vh, offX, offY) => {
      const T = 1200;
      let x0 = -(offX % T); if (x0 > 0) x0 -= T;
      ctx.fillStyle = '#0a121b';
      for (let tx = x0; tx < vw + T; tx += T) {
        ctx.beginPath();
        ctx.moveTo(tx, vh * 0.62 - offY);
        const rng = U.seededRandom(555);
        let px = tx;
        while (px < tx + T) {
          const wPeak = 120 + rng() * 160;
          const hPeak = 90 + rng() * 130;
          ctx.lineTo(px + wPeak / 2, vh * 0.62 - hPeak - offY);
          ctx.lineTo(px + wPeak, vh * 0.62 - 20 - rng() * 40 - offY);
          px += wPeak;
        }
        ctx.lineTo(tx + T, vh); ctx.lineTo(tx, vh);
        ctx.closePath(); ctx.fill();
      }
    }
  }));

  /* helper: fileira de pinheiros — MESMA arte, escala/alpha variáveis */
  function pineRow(scale, alpha, gap, seed, horizonFrac) {
    return (ctx, vw, vh, offX, offY) => {
      const img = Assets.get('pine_silhouette');
      if (!img) return;
      const rng = U.seededRandom(seed);
      const pw = 64 * scale, ph = 128 * scale;
      const count = Math.ceil(vw / gap) + 14;      // folga p/ tilear
      const T = gap * 14;
      let x0 = -(offX % T); if (x0 > 0) x0 -= T;
      ctx.save();
      ctx.globalAlpha = alpha;
      for (let tx = x0; tx < vw + T; tx += T) {
        for (let i = 0; i < 14; i++) {
          const bx = tx + i * gap + rng() * gap * 0.6;
          const bh = ph * (0.7 + rng() * 0.6);
          ctx.drawImage(img, bx, vh * horizonFrac - bh - offY, pw * (0.8 + rng() * 0.4), bh);
        }
      }
      ctx.restore();
    };
  }

  /* 4) FLORESTA DISTANTE — pinheiros pequenos e apagados */
  s.parallaxLayers.push(Parallax.layer({
    depth: 0.26, yAnchor: 0.3, draw: pineRow(0.45, 0.45, 26, 811, 0.72)
  }));

  /* 5) FLORESTA INTERMEDIÁRIA — mesma arte, maior e mais escura */
  s.parallaxLayers.push(Parallax.layer({
    depth: 0.45, yAnchor: 0.35, draw: pineRow(0.85, 0.75, 46, 812, 0.86)
  }));

  /* 6) ÁRVORES PRÓXIMAS — mundo real, atrás do plano do jogador
        (desenhadas em drawSolids; mesma arte pine_silhouette escalada) */
  s.nearTrees = [
    { x: 180,  y: GROUND_Y, s: 2.2 }, { x: 700,  y: GROUND_Y, s: 1.9 },
    { x: 880,  y: GROUND_Y, s: 2.5 }, { x: 1780, y: GROUND_Y, s: 2.1 },
    { x: 2150, y: GROUND_Y, s: 2.6 }, { x: 2320, y: GROUND_Y, s: 1.8 },
    { x: 1000, y: STAIR_TOP_Y - 6, s: 1.6 }, { x: 1420, y: STAIR_TOP_Y - 6, s: 1.5 }
  ];

  /* 7) FOREGROUND — galhos ancorados à tela (yAnchor negativo => parado) */
  s.parallaxLayers.push(Parallax.layer({
    depth: 1.25, yAnchor: -0.8,
    draw: (ctx, vw, vh, offX, offY, time) => {
      const img = Assets.get('pine_silhouette');
      if (!img) return;
      ctx.save();
      ctx.globalAlpha = 0.9;
      const sway = Math.sin(time * 0.7) * 4;       // balanço por código
      ctx.drawImage(img, -60 + sway, -30, 220, 420);
      ctx.drawImage(img, vw - 150 - sway, -50, 240, 460);
      ctx.restore();
    }
  }));

  /* ============================================================
     DESENHO CUSTOMIZADO (reuso máximo de placeholders)
     ============================================================ */
  const baseDrawSolids = s.drawSolids.bind(s);
  s.drawSolids = (ctx, time) => {
    baseDrawSolids(ctx, time);

    const cam = Camera.getPos();

    // treliça da torre: MESMO tile repetido nos montantes e no mastro
    const truss = Assets.get('tower_truss');
    if (truss) {
      for (const r of RUNTS) {
        for (let ty = r.y; ty < r.y + r.h; ty += truss.height) {
          if (ty + truss.height < cam.y - 64 || ty > cam.y + 604) continue;
          ctx.drawImage(truss, r.x - 41, ty, 96, Math.min(truss.height, r.y + r.h - ty));
        }
      }
      // mastro acima do patamar + beacon (estado futuro do rádio)
      ctx.drawImage(truss, 1152, 80, 96, 120);
      ctx.drawImage(truss, 1152, 200, 96, 120);
      const beaconOn = intro.radioOn;               // apaga-se qdo a caixa é perdida? não: liga ao pegar
      const pulse = beaconOn ? 0.5 + 0.5 * Math.sin(time * 3) : 0.12;
      ctx.fillStyle = `rgba(216,79,79,${pulse})`;
      ctx.beginPath(); ctx.arc(1200, 76, 5, 0, Math.PI * 2); ctx.fill();
    }

    // degraus: pintura metálica sobre os solids já desenhados
    for (const st of steps) {
      if (!Camera.isVisible(st.x, st.y, st.w, st.h)) continue;
      ctx.fillStyle = '#1d2730';
      ctx.fillRect(st.x, st.y, st.w, st.h);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(st.x, st.y, st.w, 2);
    }

    // cabana + antena ao lado (assets existentes)
    const shack = Assets.get('shack');
    if (shack) ctx.drawImage(shack, SHACK.x, SHACK.y);
    const ant = Assets.get('antenna');
    if (ant) ctx.drawImage(ant, SHACK.x + SHACK.w + 30, GROUND_Y - 140);

    // árvores próximas (reuso do pinheiro, escala grande + leve sway)
    const pine = Assets.get('pine_silhouette');
    if (pine) {
      for (const t of s.nearTrees) {
        const w = 64 * t.s, h = 128 * t.s;
        if (!Camera.isVisible(t.x - w, t.y - h, w, h)) continue;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.translate(t.x, t.y);
        ctx.rotate(Math.sin(time * 0.5 + t.x) * 0.008);
        ctx.drawImage(pine, -w / 2, -h, w, h);
        ctx.restore();
      }
    }

    // caixa FREQUENCY 17 (placeholder pronto p/ sprite real futuro)
    const b = intro.box;
    if (b && !b.taken) {
      const boxImg = Assets.get('freq_box');
      if (boxImg) {
        ctx.save();
        ctx.translate(b.x, b.y);
        if (!b.resting) ctx.rotate(Math.sin(b.spin) * 0.5);
        // halo claro p/ a etiqueta ser notada na queda e no repouso
        ctx.shadowColor = 'rgba(216,221,224,0.7)';
        ctx.shadowBlur = b.resting ? 10 : 4;
        ctx.drawImage(boxImg, -13, -9, 26, 18);
        ctx.restore();
      }
    }
  };

  /* Prompt de coleta quando a caixa está em repouso (pós-recuperação) */
  const baseDrawEntities = s.drawEntitiesFront.bind(s);
  s.drawEntitiesFront = (ctx, time) => {
    baseDrawEntities(ctx, time);
    const b = intro.box;
    if (b && !b.taken && b.resting && intro.phase === 'pickup') {
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(time * 3);
      ctx.fillStyle = '#d8dde0';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('pegar caixa', b.x, b.y - 18);
      ctx.restore();
    }
  };

  /* Luz extra: guia visual da caixa caída + beacon do rádio ligado */
  const baseAddLights = s.addLights.bind(s);
  s.addLights = (ctx, time) => {
    baseAddLights(ctx, time);
    const b = intro.box;
    if (b && !b.taken) {
      const p = Lighting.worldToScreen(b.x, b.y);
      Lighting.addLight(p.x, p.y, 70, 0.55, 0.2);
    }
    if (intro.radioOn) {
      const p = Lighting.worldToScreen(1200, 76);
      Lighting.addLight(p.x, p.y, 90, 0.5, 0.5);
    }
  };

  /* ============================================================
     PREPARE-SE PARA ETAPAS FUTURAS (não implementadas agora):
     - rádio real interativo da torre substitui este terminal
     - s.events.zonaCriatura: primeira aparição na descida
     - s.shards: fragmentos podem ser espalhados nos degraus
     ============================================================ */
  s.terminals.push(new TerminalPoint(SHACK.x + 24, GROUND_Y - 36, {
    name: 'RÁDIO EXTERNO',
    lines: [
      'O velho rádio da cabana só chia. Mas agora… chia em 17.',
      'Etiqueta descascada: “TX-17 — NÃO DESLIGAR.”'
    ]
  }));

  /* Hook reservado p/ a criatura (etapa futura ativa via s.events.creature) */
  s.events.creatureGlimpse = {
    zone: { x: 600, y: GROUND_Y - 200, w: 200, h: 200 },
    once: true,
    fn: () => { /* etapa futura: primeira aparição */ }
  };

  /* Saída: trilha para as RUÍNAS (só libera após a abertura) */
  s.exits.push({
    x: W - 40, y: GROUND_Y - 160, w: 40, h: 160,
    to: 'ruins', spawnX: 80, spawnY: 420, label: '→ TRILHA DAS RUÍNAS'
  });

  return s;
});
