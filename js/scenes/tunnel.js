/* ============================================================
   tunnel.js — CENA 1: Túnel de transmissão.
   Corredor escuro com lâmpadas piscando, gotejamento e um
   primeiro fragmento de sinal. Introduz a mecânica de sintonia.
   ============================================================ */
Scenes.register('tunnel', () => {

  const W = 2400, H = 540;
  const s = new Scene('tunnel');
  s.bounds = { w: W, h: H };
  s.ambient = 0.92;
  s.ambientColor = '4, 8, 14';
  s.droneFreq = 49;

  /* ---- Parallax: tubulações distantes atrás das paredes ---- */
  s.parallaxLayers.push(Parallax.layer({
    depth: 0.25,
    draw: (ctx, vw, vh, offX, offY, time) => {
      ctx.fillStyle = '#070c12';
      ctx.fillRect(0, 0, vw, vh);
      // tubos horizontais no "teto" profundo
      ctx.strokeStyle = '#0e161e';
      ctx.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        const y = 30 + i * 22 - offY * 0.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(vw, y); ctx.stroke();
      }
      // juntas dos tubos deslizando em parallax
      ctx.fillStyle = '#121b25';
      const T = 160;
      let x = -(offX % T); if (x > 0) x -= T;
      for (; x < vw; x += T) ctx.fillRect(x, 26, 10, 96);
    }
  }));

  /* ---- Paredes do corredor ---- */
  const WALL_T = 90, WALL_B = 110;
  s.solids.push({ x: 0, y: 0, w: W, h: WALL_T });            // teto
  s.solids.push({ x: 0, y: H - WALL_B, w: W, h: WALL_B });   // chão/base
  s.solids.push({ x: 0, y: 0, w: 40, h: H });                // borda esquerda
  s.solids.push({ x: W - 40, y: 0, w: 40, h: H });           // borda direita

  // pilares intermediários (obstáculos que quebram a linha reta)
  const rng = U.seededRandom(1701);
  for (let i = 0; i < 6; i++) {
    const px = 350 + i * 340 + rng() * 60;
    const py = rng() > 0.5 ? WALL_T : H - WALL_B - 120;
    s.solids.push({ x: px, y: py, w: 46, h: 120 });
  }

  /* ---- Lâmpadas com flicker alternado (atmosfera) ---- */
  for (let i = 0; i < 10; i++) {
    s.lamps.push({
      x: 180 + i * 230, y: WALL_T + 6,
      flicker: i % 3 === 0 ? 0.5 : 0.12,
      radius: 120
    });
  }

  /* ---- Fragmento de sinal ---- */
  s.shards.push(new SignalShard(1500, 300, { bump: 10 }));

  /* ---- Terminal narrativo ---- */
  s.terminals.push(new TerminalPoint(620, H - WALL_B - 36, {
    name: 'PLACA DE MANUTENÇÃO',
    lines: [
      '“NÃO AJUSTE A FREQUÊNCIA ACIMA DE 17.”',
      '“Se ouvir sua própria voz na estática, NÃO responda.”',
      'Alguém rabiscou por baixo: “já é tarde pra isso.”'
    ]
  }));

  /* ---- NPC: o Vigilante do túnel ---- */
  s.npcs.push(new NPC({
    x: 1050, y: H - WALL_B - 44,
    name: 'VIGILANTE',
    tint: '#8fa3ad',
    patrol: { fromX: 980, toX: 1140, speed: 22 },
    lines: [
      'Você também ouviu? A torre voltou a transmitir às 3:17 da manhã.',
      'Não sou eu quem fala nela. Só... escuto junto.',
      'Siga os pontos azuis. Eles lembram o caminho melhor que a gente.'
    ]
  }));

  /* ---- Gotejamento ambiente contínuo (partículas reutilizadas) ---- */
  let dripTimer = 0;
  const baseUpdate = s.update.bind(s);
  s.update = (dt) => {
    baseUpdate(dt);
    dripTimer -= dt;
    if (dripTimer <= 0) {
      dripTimer = U.rand(0.4, 1.3);
      const dx = U.rand(60, W - 60);
      Particles.emit({
        x: dx, y: WALL_T + 8, vx: 0, vy: 60,
        life: 1.6, size: 1.5, color: 'rgba(120,160,180,0.35)'
      });
    }
  };

  /* ---- Eventos de narrativa ambiental ---- */
  s.events.glitchIntro = {
    zone: { x: 1350, y: 0, w: 60, h: H },
    fn: () => {
      Game.say('???', '…hzzzt… …você consegue me ouvir? …hzzt…', 4);
      AudioSys.sfxGlitch();
      Camera.shake(3, 0.4);
    }
  };

  /* ---- Saída para as ruínas (direita) ---- */
  s.exits.push({
    x: W - 60, y: H - WALL_B - 140, w: 20, h: 140,
    to: 'ruins', spawnX: 80, spawnY: 300, label: '→ RUÍNAS'
  });

  return s;
});
