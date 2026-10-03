/* ============================================================
   parallax.js — camadas de fundo com deslocamento por profundidade
   ------------------------------------------------------------
   Cada camada é um "draw function" procedural OU uma imagem.
   Profundidade (0..1): 0 = infinito (quase parado), 1 = plano do jogador.
   A repetição horizontal usa tile modular para cenários largos.
   ============================================================ */
const Parallax = (() => {

  /* Cria uma camada.
     opts = { depth, draw(ctx, viewW, viewH, offsetX, time) }
     offsetX já vem compensado pela profundidade. */
  function layer(opts) {
    return {
      depth: opts.depth ?? 0.5,
      draw: opts.draw,
      image: opts.image || null,   // se tiver imagem real, substitui o procedural
      tileW: opts.tileW || 0
    };
  }

  /** Desenha todas as camadas ordenadas por profundidade */
  function render(ctx, layers, camX, camY, viewW, viewH, time) {
    const sorted = [...layers].sort((a, b) => a.depth - b.depth);
    for (const L of sorted) {
      const offX = camX * L.depth;
      const offY = camY * L.depth * 0.35; // vertical menos intenso
      ctx.save();
      if (L.image && L.tileW > 0) {
        // versão com imagem real: tile modular
        let x = -((offX) % L.tileW);
        if (x > 0) x -= L.tileW;
        for (; x < viewW; x += L.tileW) {
          ctx.drawImage(L.image, Math.round(x), Math.round(-offY));
        }
      } else if (L.image) {
        ctx.drawImage(L.image, Math.round(-offX), Math.round(-offY));
      } else if (L.draw) {
        L.draw(ctx, viewW, viewH, offX, offY, time);
      }
      ctx.restore();
    }
  }

  return { layer, render };
})();
