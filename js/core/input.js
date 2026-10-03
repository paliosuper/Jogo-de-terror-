/* ============================================================
   input.js — teclado (estado contínuo + bordas de subida)
   Uso: Input.isDown('left'), Input.justPressed('interact')
   ============================================================ */
const Input = (() => {

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'interact', Enter: 'interact', KeyE: 'interact',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    F3: 'debug'
  };

  const held = {};         // ação -> booleano (está pressionada)
  const pressedQueue = {}; // ação -> true apenas no frame da subida

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    e.preventDefault();
    if (!held[action]) pressedQueue[action] = true;
    held[action] = true;
  });

  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    held[action] = false;
  });

  // Se a janela perder o foco, solta tudo (evita "andar sozinho")
  window.addEventListener('blur', () => {
    Object.keys(held).forEach((k) => (held[k] = false));
  });

  function isDown(action) { return !!held[action]; }

  /** true apenas UMA vez por pressionamento — chame uma vez por frame */
  function justPressed(action) {
    if (pressedQueue[action]) {
      delete pressedQueue[action];
      return true;
    }
    return false;
  }

  /** Chamar no FINAL de cada frame para limpar bordas não consumidas */
  function endFrame() {
    for (const k in pressedQueue) delete pressedQueue[k];
  }

  /** Vetor normalizado de movimento horizontal/vertical */
  function moveVector() {
    let x = 0, y = 0;
    if (held.left) x -= 1;
    if (held.right) x += 1;
    if (held.up) y -= 1;
    if (held.down) y += 1;
    const len = Math.hypot(x, y);
    if (len > 0) { x /= len; y /= len; }
    return { x, y };
  }

  return { isDown, justPressed, endFrame, moveVector };
})();
