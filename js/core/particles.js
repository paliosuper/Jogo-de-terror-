/* ============================================================
   particles.js — pool de partículas (poeira, faíscas, sinal)
   Pool fixa: nunca aloca em plena renderização.
   ============================================================ */
const Particles = (() => {

  const MAX = 300;
  const pool = [];
  let cursor = 0;

  // Pré-aloca
  for (let i = 0; i < MAX; i++) {
    pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
                size: 2, color: '#fff', alpha: 1, gravity: 0, glow: false });
  }

  /** Emite uma partição reutilizando slot morto mais antigo */
  function emit(opts) {
    const p = pool[cursor];
    cursor = (cursor + 1) % MAX;
    p.alive = true;
    p.x = opts.x;
    p.y = opts.y;
    p.vx = opts.vx || 0;
    p.vy = opts.vy || 0;
    p.maxLife = opts.life || 1;
    p.life = p.maxLife;
    p.size = opts.size || 2;
    p.color = opts.color || 'rgba(200,220,230,0.8)';
    p.gravity = opts.gravity || 0;
    p.glow = !!opts.glow;
    return p;
  }

  /** Jato de N partículas com spread angular */
  function burst(x, y, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      const ang = (opts.angle !== undefined ? opts.angle : Math.random() * Math.PI * 2)
                  + U.rand(-(opts.spread || Math.PI), (opts.spread || Math.PI));
      const spd = U.rand(opts.speedMin || 10, opts.speedMax || 60);
      emit({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: U.rand((opts.life || 1) * 0.5, (opts.life || 1) * 1.4),
        size: U.rand(opts.sizeMin || 1, opts.sizeMax || 3),
        color: opts.color || 'rgba(63,216,194,0.8)',
        gravity: opts.gravity || 0,
        glow: opts.glow
      });
    }
  }

  function update(dt) {
    for (const p of pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = U.clamp(p.life / p.maxLife, 0, 1);
    }
  }

  /** Desenha em coords de mundo (chamar dentro do transform da Camera) */
  function draw(ctx) {
    for (const p of pool) {
      if (!p.alive) continue;
      ctx.globalAlpha = p.alpha;
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      if (p.glow) ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function clear() {
    for (const p of pool) p.alive = false;
  }

  function countAlive() {
    let n = 0;
    for (const p of pool) if (p.alive) n++;
    return n;
  }

  return { emit, burst, update, draw, clear, countAlive };
})();
