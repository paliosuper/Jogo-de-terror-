/* ============================================================
   camera.js — câmera com suavização, limites e tremor
   ============================================================ */
const Camera = (() => {
  let x = 0, y = 0;                 // canto superior esquerdo em coords de mundo
  let viewW = 960, viewH = 540;
  let bounds = { w: 960, h: 540 };  // tamanho do mundo da cena atual
  let shakeTime = 0, shakeMag = 0;
  let ox = 0, oy = 0;               // offset de tremor aplicado

  function setViewport(w, h) { viewW = w; viewH = h; }

  function setBounds(b) {
    bounds = b;
    clampTo();
  }

  /** Segue um alvo (x,y) com amortecimento suave */
  function follow(tx, ty, dt) {
    const targetX = tx - viewW / 2;
    const targetY = ty - viewH / 2;
    x = U.damp(x, targetX, 5, dt);
    y = U.damp(y, targetY, 5, dt);
    clampTo();
  }

  function clampTo() {
    x = U.clamp(x, 0, Math.max(0, bounds.w - viewW));
    y = U.clamp(y, 0, Math.max(0, bounds.h - viewH));
  }

  /** Dispara tremor (usar com moderação — atmosfera, não exagero) */
  function shake(magnitude, duration) {
    shakeMag = Math.max(shakeMag, magnitude);
    shakeTime = Math.max(shakeTime, duration);
  }

  function update(dt) {
    if (shakeTime > 0) {
      shakeTime -= dt;
      const m = shakeMag * U.clamp(shakeTime, 0, 1);
      ox = U.rand(-m, m);
      oy = U.rand(-m, m);
      if (shakeTime <= 0) { shakeMag = 0; ox = oy = 0; }
    }
  }

  /** Aplica a transformação da câmera no ctx (desenhar em coords de mundo) */
  function apply(ctx) {
    ctx.translate(-Math.round(x + ox), -Math.round(y + oy));
  }

  /** Converte coord de tela -> mundo */
  function screenToWorld(sx, sy) {
    return { x: sx + x, y: sy + y };
  }

  function isVisible(rx, ry, rw, rh, margin = 64) {
    return rx + rw > x - margin && rx < x + viewW + margin &&
           ry + rh > y - margin && ry < y + viewH + margin;
  }

  function teleportTo(tx, ty) {
    x = tx - viewW / 2;
    y = ty - viewH / 2;
    clampTo();
  }

  function getPos() { return { x: x + ox, y: y + oy }; }
  function getView() { return { w: viewW, h: viewH }; }

  return { setViewport, setBounds, follow, update, shake, apply,
           screenToWorld, isVisible, teleportTo, getPos, getView };
})();
