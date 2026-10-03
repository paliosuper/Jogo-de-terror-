/* ============================================================
   title.js — cena "título" no canvas (fundo animado atrás do HTML).
   O overlay HTML fica por cima; esta cena só dá vida ao fundo:
   estática, feixe de rádio e silhuetas em parallax.
   ============================================================ */
Scenes.register('title', () => {

  const s = new Scene('title');
  s.bounds = { w: 960, h: 540 };
  s.ambient = 0.55;
  s.droneFreq = 41;

  // Estática procedural: pequenos retângulos piscando (sem imagem)
  s.parallaxLayers.push(Parallax.layer({
    depth: 0,
    draw: (ctx, vw, vh, offX, offY, time) => {
      ctx.fillStyle = '#04070b';
      ctx.fillRect(0, 0, vw, vh);
      // horizonte distante de torres (silhueta simples, tileada)
      ctx.fillStyle = '#0a1118';
      const rng = U.seededRandom(17);
      for (let i = 0; i < 14; i++) {
        const bx = (i * 90 + rng() * 40 - offX * 0.2) % (vw + 100) - 50;
        const bh = 60 + rng() * 120;
        ctx.fillRect(bx, vh - bh, 30 + rng() * 40, bh);
      }
      // antena central com luz vermelha pulsando
      const ax = vw / 2 - offX * 0.4;
      ctx.strokeStyle = '#101820';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ax, vh - 120); ctx.lineTo(ax, vh - 320);
      ctx.moveTo(ax - 25, vh - 120); ctx.lineTo(ax, vh - 220);
      ctx.moveTo(ax + 25, vh - 120); ctx.lineTo(ax, vh - 220);
      ctx.stroke();
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.7));
      ctx.fillStyle = `rgba(216,79,79,${pulse})`;
      ctx.beginPath(); ctx.arc(ax, vh - 322, 4, 0, Math.PI * 2); ctx.fill();
      // anéis de transmissão subindo da antena
      ctx.strokeStyle = 'rgba(216,79,79,0.15)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const ph = (time * 0.5 + k / 3) % 1;
        ctx.globalAlpha = 1 - ph;
        ctx.beginPath();
        ctx.arc(ax, vh - 322, 10 + ph * 90, -Math.PI * 0.85, -Math.PI * 0.15);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // poeira flutuando na frente
      ctx.fillStyle = 'rgba(201,214,221,0.06)';
      for (let i = 0; i < 40; i++) {
        const px = (rng() * vw + time * (10 + i % 7)) % vw;
        const py = (rng() * vh + Math.sin(time + i) * 20 + vh) % vh;
        ctx.fillRect(px, py, 2, 2);
      }
    }
  }));

  s.update = () => {};       // cena decorativa
  return s;
});
