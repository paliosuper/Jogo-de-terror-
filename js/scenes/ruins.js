/* ============================================================
   ruins.js — CENA 2: Ruínas da cidade.
   Área aberta vertical+horizontal com colunas quebradas e destroços.
   A MESMA arte base do túnel é reutilizada; o que muda é estado:
   céu aberto (parallax de horizonte), vento, luz mais fria.
   ============================================================ */
Scenes.register('ruins', () => {

  const W = 2000, H = 900;
  const s = new Scene('ruins');
  s.bounds = { w: W, h: H };
  s.ambient = 0.8;
  s.ambientColor = '6, 10, 18';
  s.droneFreq = 62;

  /* ---- Parallax 1: céu profundo + lua "de sinal" ---- */
  s.parallaxLayers.push(Parallax.layer({
    depth: 0.12,
    draw: (ctx, vw, vh, offX, offY, time) => {
      ctx.fillStyle = '#050a12';
      ctx.fillRect(0, 0, vw, vh);
      // estrelas determinísticas cintilando por código
      const rng = U.seededRandom(4242);
      for (let i = 0; i < 70; i++) {
        const sx = (rng() * vw * 2 - offX * 0.3) % vw;
        const sy = rng() * vh * 0.6;
        const tw = 0.25 + 0.75 * Math.abs(Math.sin(time * (0.5 + rng()) + i));
        ctx.fillStyle = `rgba(201,214,221,${0.12 * tw})`;
        ctx.fillRect(((sx % vw) + vw) % vw, sy, 2, 2);
      }
      // "lua" — na verdade um disco de transmissão pálido
      const mx = vw * 0.75 - offX * 0.15, my = 90 - offY * 0.2;
      const g = ctx.createRadialGradient(mx, my, 8, mx, my, 70);
      g.addColorStop(0, 'rgba(201,214,221,0.5)');
      g.addColorStop(0.4, 'rgba(140,170,180,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(mx, my, 70, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(201,214,221,0.35)';
      ctx.beginPath(); ctx.arc(mx, my, 22, 0, Math.PI * 2); ctx.fill();
    }
  }));

  /* ---- Parallax 2: skyline distante (silhuetas tileadas) ---- */
  s.parallaxLayers.push(Parallax.layer({
    depth: 0.35,
    draw: (ctx, vw, vh, offX, offY, time) => {
      const rng = U.seededRandom(909);
      ctx.fillStyle = '#0a1017';
      const T = 900;
      let x0 = -(offX % T); if (x0 > 0) x0 -= T;
      for (let tx = x0; tx < vw + T; tx += T) {
        for (let i = 0; i < 12; i++) {
          const bx = tx + i * 78 + rng() * 30;
          const bh = 90 + rng() * 180;
          ctx.fillRect(bx, vh * 0.55 - bh - offY * 0.4, 40 + rng() * 30, bh + 300);
        }
      }
      // janelas acesas aqui e ali — variação só por alpha/tempo
      ctx.fillStyle = 'rgba(255,217,138,0.05)';
      const r2 = U.seededRandom(77);
      for (let i = 0; i < 24; i++) {
        const wx = (r2() * vw * 1.5 - offX * 0.35) % vw;
        const wy = vh * 0.4 + r2() * 120 - offY * 0.4;
        const on = Math.sin(time * 0.3 + i * 3.7) > 0.6 ? 1 : 0.15;
        ctx.globalAlpha = on;
        ctx.fillRect(((wx % vw) + vw) % vw, wy, 3, 4);
      }
      ctx.globalAlpha = 1;
    }
  }));

  /* ---- Chão/bordas do mundo ---- */
  s.solids.push({ x: 0, y: H - 60, w: W, h: 60 });     // chão
  s.solids.push({ x: 0, y: 0, w: 40, h: H });
  s.solids.push({ x: W - 40, y: 0, w: 40, h: H });
  s.solids.push({ x: 0, y: 0, w: W, h: 40 });          // limite superior

  /* ---- Colunas quebradas (sprite pillar reutilizado em escalas) ---- */
  const props = [];
  const prng = U.seededRandom(3117);
  for (let i = 0; i < 9; i++) {
    const px = 200 + i * 200 + prng() * 80;
    const py = 200 + prng() * (H - 420);
    const sc = 0.7 + prng() * 0.9;
    props.push({ x: px, y: py, scale: sc, type: 'pillar' });
    s.solids.push({ x: px - 12 * sc, y: py, w: 24 * sc, h: 120 * sc });
  }
  for (let i = 0; i < 7; i++) {
    props.push({
      x: 150 + prng() * (W - 300),
      y: H - 100 - prng() * 60,
      scale: 0.8 + prng() * 0.8,
      type: 'rubble'
    });
  }

  /* ---- Decoração luminosa: fogueira de sobrevivente ---- */
  s.lamps.push({ x: 1000, y: 480, flicker: 0.45, radius: 160 });

  /* ---- Fragmentos de sinal ---- */
  s.shards.push(new SignalShard(480, 300, { bump: 8 }));
  s.shards.push(new SignalShard(1620, 560, { bump: 8 }));

  /* ---- NPCs: sobreviventes ---- */
  s.npcs.push(new NPC({
    x: 960, y: 430, name: 'SOBREVIVENTE',
    lines: [
      'Aqui era uma praça. Agora é só… eco.',
      'As ruínas cantam quando o vento passa nas torres. Juro que cantam.',
      'Se chegar na Sala de Controle, desligue tudo pelo amor de Deus.'
    ]
  }));
  s.npcs.push(new NPC({
    x: 1400, y: 260, name: 'A OUVINTE', tint: '#d84f4f', scale: 0.9,
    patrol: { fromX: 1350, toX: 1520, speed: 14 },
    lines: [
      'Eu sintonizo 17 toda noite. Às vezes 17 me sintoniza de volta.',
      'Não é medo. É reconhecimento. Já ouvi essa voz antes...'
    ]
  }));

  /* ---- Terminal ---- */
  s.terminals.push(new TerminalPoint(300, H - 100, {
    name: 'CAIXA-PRETA #17',
    lines: [
      'DIÁRIO: “dia 41. a transmissão não para. dia 42. parei de contar.”',
      'DIÁRIO: “descobri: ela não vem da torre. Ela vem de DENTRO dela.”',
      '[ÚLTIMA ENTRADA] “se alguém lê isso: a sala de controle ainda responde.”'
    ]
  }));

  /* ---- Vento: partículas horizontais contínuas ---- */
  let windTimer = 0;
  const baseUpdate = s.update.bind(s);
  s.update = (dt) => {
    baseUpdate(dt);
    windTimer -= dt;
    if (windTimer <= 0) {
      windTimer = 0.12;
      const cam = Camera.getPos();
      Particles.emit({
        x: cam.x - 20, y: cam.y + U.rand(60, 500),
        vx: U.rand(90, 160), vy: U.rand(-8, 8),
        life: 3, size: 1, color: 'rgba(160,180,190,0.12)'
      });
    }
  };

  /* ---- Eventos ambientais ---- */
  s.events.towerHum = {
    zone: { x: 1700, y: 0, w: 200, h: H },
    once: false,
    fn: () => { AudioSys.setDroneFreq(78); }
  };

  /* ---- Saídas ---- */
  s.exits.push({
    x: 0, y: H / 2 - 120, w: 24, h: 200,
    to: 'tunnel', spawnX: W_TUNNEL_EXIT_X(), spawnY: 330, label: '← TÚNEL'
  });
  function W_TUNNEL_EXIT_X() { return 2330; } // coerente com tunnel.js
  s.exits.push({
    x: W - 60, y: H / 2 - 120, w: 24, h: 200,
    to: 'controlroom', spawnX: 120, spawnY: 300, label: '→ SALA DE CONTROLE'
  });

  /* ---- Desenho customizado: props escaladas/rotacionadas ---- */
  const baseDrawSolids = s.drawSolids.bind(s);
  s.drawSolids = (ctx, time) => {
    baseDrawSolids(ctx, time);
    for (const p of props) {
      const img = Assets.get(p.type);
      if (!img) continue;
      const w = img.width * p.scale, h = img.height * p.scale;
      if (!Camera.isVisible(p.x - w / 2, p.y - h / 2, w, h)) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.type === 'rubble') {
        ctx.rotate((U.noise1D(p.x) - 0.5) * 0.3); // espalhamento sem nova arte
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else {
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      }
      ctx.restore();
    }
    // fogueira: faíscas subindo do lampião central
    if (Math.random() < 0.25) {
      Particles.emit({
        x: 1000 + U.rand(-6, 6), y: 470,
        vx: U.rand(-10, 10), vy: U.rand(-50, -25),
        life: 1.2, size: 2, color: 'rgba(255,180,90,0.7)', glow: true
      });
    }
  };

  return s;
});
