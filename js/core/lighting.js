/* ============================================================
   lighting.js — sistema de iluminação 2D por máscara de escuridão
   ------------------------------------------------------------
   Técnica: desenha um canvas-offscreen preenchido com a "noite"
   e recorta círculos de luz com gradientes radiais (composite
   'destination-out'). O resultado é composto sobre a cena.
   Reutiliza UM único canvas offscreen para todos as luzes.
   ============================================================ */
const Lighting = (() => {

  let maskCanvas = null;
  let maskCtx = null;
  let ambient = 0.85;            // 0 = claro, 1 = escuridão total
  let ambientColor = '5, 10, 16'; // azul-escuro da noite

  // Lista de luzes do frame atual (reconstruída a cada draw)
  const lights = [];

  function init(w, h) {
    maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    maskCtx = maskCanvas.getContext('2d');
  }

  function setAmbient(value, colorRGB) {
    ambient = U.clamp(value, 0, 1);
    if (colorRGB) ambientColor = colorRGB;
  }

  /** Adiciona uma luz em coords de TELA (o chamador converte mundo->tela)
      radius: alcance; intensity: 0..1 quanto de escuridão remove;
      flicker: 0..1 amplitude de oscilação orgânica */
  function addLight(sx, sy, radius, intensity = 1, flicker = 0, t = 0) {
    lights.push({ sx, sy, radius, intensity, flicker, seed: sx * 7 + sy * 13 });
  }

  /** Conclui e desenha a máscara sobre o ctx principal */
  function render(ctx, time) {
    if (!maskCanvas) return;
    const w = maskCanvas.width, h = maskCanvas.height;

    // fundo escuro
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.clearRect(0, 0, w, h);
    maskCtx.fillStyle = `rgba(${ambientColor}, ${ambient})`;
    maskCtx.fillRect(0, 0, w, h);

    // recorta as luzes
    maskCtx.globalCompositeOperation = 'destination-out';
    for (const L of lights) {
      let r = L.radius;
      if (L.flicker > 0) {
        // flicker suave determinístico + micro-ruído
        const f = 0.5 + 0.5 * Math.sin(time * 3.1 + L.seed) +
                  0.15 * (U.noise1D(time * 9 + L.seed) - 0.5);
        r *= 1 - L.flicker * (1 - U.clamp(f, 0, 1.2));
      }
      const g = maskCtx.createRadialGradient(L.sx, L.sy, r * 0.12, L.sx, L.sy, r);
      g.addColorStop(0, `rgba(0,0,0,${0.95 * L.intensity})`);
      g.addColorStop(0.55, `rgba(0,0,0,${0.55 * L.intensity})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      maskCtx.fillStyle = g;
      maskCtx.beginPath();
      maskCtx.arc(L.sx, L.sy, r, 0, Math.PI * 2);
      maskCtx.fill();
    }

    // compõe sobre a cena
    ctx.drawImage(maskCanvas, 0, 0);
    lights.length = 0; // limpa para o próximo frame
  }

  /** Helper: converte posição de mundo para tela usando a Camera */
  function worldToScreen(wx, wy) {
    const c = Camera.getPos();
    return { x: wx - c.x, y: wy - c.y };
  }

  return { init, setAmbient, addLight, render, worldToScreen };
})();
