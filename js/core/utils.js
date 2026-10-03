/* ============================================================
   utils.js — utilitários globais (namespace U)
   Sem dependências externas. Reutilizados por todos os módulos.
   ============================================================ */
const U = (() => {

  /** Clamp numérico */
  function clamp(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  /** Interpolação linear */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /** Movimento suave independente de framerate */
  function damp(a, b, lambda, dt) {
    return lerp(a, b, 1 - Math.exp(-lambda * dt));
  }

  /** Distância euclidiana */
  function dist(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Colisão AABB */
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /** Número aleatório em faixa */
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  /** Inteiro aleatório em faixa [min,max] */
  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }

  /** Escolhe um item aleatório de um array */
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** RNG com semente (mulberry32) — para layouts procedurais estáveis */
  function seededRandom(seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Offset de ruído simples e determinístico (para flicker/parallax orgânico) */
  function noise1D(x) {
    const s = Math.sin(x * 12.9898) * 43758.5453;
    return s - Math.floor(s); // 0..1
  }

  /** Converte tempo em fase senoidal 0..1 */
  function phase(t, period) {
    return (t % period) / period;
  }

  /** Desenha retângulo arredondado (compat path) */
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Texto com "typewriter" — retorna a fatia visível */
  function typewrite(fullText, elapsed, charsPerSec) {
    const n = Math.floor(elapsed * charsPerSec);
    return fullText.slice(0, Math.max(0, Math.min(n, fullText.length)));
  }

  return { clamp, lerp, damp, dist, aabb, rand, randInt, pick,
           seededRandom, noise1D, phase, roundRect, typewrite };
})();
