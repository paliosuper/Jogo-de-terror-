/* ============================================================
   controlroom.js — CENA 3: Sala de Controle.
   O coração da transmissão. Poucas artes (mesmo pillar/terminal/
   antenna reutilizados); o clima muda via estado: luz vermelha,
   estática alta, console central pulsante.
   ============================================================ */
Scenes.register('controlroom', () => {

  const W = 1400, H = 760;
  const s = new Scene('controlroom');
  s.bounds = { w: W, h: H };
  s.ambient = 0.9;
  s.ambientColor = '16, 6, 8';       // noite avermelhada — mudança por código
  s.droneFreq = 33;                  // drone mais grave e opressivo

  /* ---- Parallax: painel de monitores ao fundo (tile procedural) ---- */
  s.parallaxLayers.push(Parallax.layer({
    depth: 0.2,
    draw: (ctx, vw, vh, offX, offY, time) => {
      ctx.fillStyle = '#0a0709';
      ctx.fillRect(0, 0, vw, vh);
      const T = 220;
      let x0 = -(offX % T); if (x0 > 0) x0 -= T;
      for (let tx = x0; tx < vw + T; tx += T) {
        for (let row = 0; row < 3; row++) {
          const my = 60 + row * 120 - offY * 0.5;
          ctx.fillStyle = '#120c10';
          ctx.fillRect(tx + 10, my, 190, 100);
          // "estática" na tela: linhas claras animadas
          ctx.fillStyle = 'rgba(216,79,79,0.10)';
          for (let i = 0; i < 6; i++) {
            const ly = my + ((time * 40 + i * 33 + tx) % 100);
            ctx.fillRect(tx + 14, ly, 182, 2);
          }
        }
      }
    }
  }));

  /* ---- Estrutura da sala ---- */
  s.solids.push({ x: 0, y: 0, w: W, h: 70 });           // parede norte
  s.solids.push({ x: 0, y: H - 60, w: W, h: 60 });      // sul
  s.solids.push({ x: 0, y: 0, w: 40, h: H });
  s.solids.push({ x: W - 40, y: 0, w: 40, h: H });
  // consoles em ilha (retângulos sólidos simples)
  s.solids.push({ x: 300, y: 300, w: 180, h: 70 });
  s.solids.push({ x: 900, y: 300, w: 180, h: 70 });
  s.solids.push({ x: 560, y: 480, w: 280, h: 90 });     // CONSOLE CENTRAL

  /* ---- Decoração: colunas (mesma arte das ruínas, simetria) ---- */
  [[200, 120], [1180, 120], [200, 560], [1180, 560]].forEach(([px, py]) => {
    s.solids.push({ x: px - 12, y: py, w: 24, h: 120 });
  });

  /* ---- Antena visível através da janela do norte (desenhada à mão) ---- */
  // usa sprite antenna real se existir; senão placeholder já cobre

  /* ---- Luzes: vermelhas e instáveis ---- */
  s.lamps.push({ x: 250, y: 76, flicker: 0.7, radius: 130 });
  s.lamps.push({ x: 700, y: 76, flicker: 0.9, radius: 150 });
  s.lamps.push({ x: 1150, y: 76, flicker: 0.6, radius: 130 });

  /* ---- Fragmento final ---- */
  s.shards.push(new SignalShard(700, 250, { bump: 12 }));

  /* ---- Terminal principal: a TRANSMISSÃO ---- */
  s.terminals.push(new TerminalPoint(640, 444, {
    name: 'CONSOLE FREQ-17',
    lines: [
      '[TRANSMITIR] ... a voz para. Por um segundo, tudo para.',
      '[RECEBER] “você chegou até aqui. eu sabia que um dos dois chegaria.”',
      '[STATUS] frequência estável em 17.0. origem: INDETERMINADA.',
      '[AVISO] não desligue. ela acorda pior quando desliga.'
    ]
  }));

  /* ---- NPC final: A Voz (silhueta diante da antena) ---- */
  s.npcs.push(new NPC({
    x: 1050, y: 150, name: 'A VOZ', tint: '#d84f4f', scale: 1.15,
    lines: [
      'Você sintonizou 17. Agora 17 sintonizou você.',
      'Eu não sou assustadora. Eu estou sozinha há muito tempo.',
      'Fique um pouco. Depois você decide o que fazer com a frequência.'
    ]
  }));

  /* ---- Estética extra: faíscas caindo do teto perto do console ---- */
  const baseUpdate = s.update.bind(s);
  s.update = (dt) => {
    baseUpdate(dt);
    if (Math.random() < 0.06) {
      Particles.emit({
        x: U.rand(600, 800), y: 74, vx: U.rand(-15, 15), vy: U.rand(20, 60),
        life: 1.4, size: 1.5, color: 'rgba(216,79,79,0.6)', gravity: 60, glow: true
      });
    }
  };

  /* ---- Desenho customizado: console central + antena ---- */
  const baseDrawSolids = s.drawSolids.bind(s);
  s.drawSolids = (ctx, time) => {
    baseDrawSolids(ctx, time);

    // antena vista pela janela (sprite reutilizado, escala grande)
    const ant = Assets.get('antenna');
    if (ant && Camera.isVisible(660, 60, 120, 420)) {
      ctx.save();
      ctx.globalAlpha = 0.5;   // "atrás do vidro" -> transparência, sem nova arte
      ctx.drawImage(ant, 660, -20, 120, 420);
      ctx.restore();
    }

    // pulso do console central ligado à sintonia do jogador
    const tune = Game.tuning / 100;
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(time * (1 + tune * 3)));
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.5 * pulse * tune;
    ctx.fillStyle = tune >= 1 ? '#3fd8c2' : '#d84f4f';
    ctx.fillRect(560, 480, 280, 4);
    ctx.restore();
  };

  /* ---- Evento: completar sintonia ---- */
  s.events.fullTune = {
    zone: { x: 560, y: 380, w: 280, h: 200 },
    once: false,
    fn: () => {
      if (Game.tuning >= 100) {
        Game.say('CONSOLE FREQ-17',
          'SINTONIA COMPLETA. A transmissão agora reconhece sua voz.', 5);
        AudioSys.sfxCollect();
        Camera.shake(4, 0.6);
      }
    }
  };

  /* ---- Saída de volta para as ruínas ---- */
  s.exits.push({
    x: 0, y: H / 2 - 100, w: 24, h: 200,
    to: 'ruins', spawnX: 1900, spawnY: 420, label: '← RUÍNAS'
  });

  return s;
});
