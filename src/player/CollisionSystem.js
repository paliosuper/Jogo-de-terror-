/**
 * CollisionSystem -- colision AABB com resolucao eixo-a-eixo (slide em paredes).
 *
 * Fontes de obstaculo:
 *   - registradas via addRect()/removeRect() (moveis ou dinamicos);
 *   - funcoes consultadas via addProvider(fn) -> fn devolve array de rects.
 *     O mapa/nivel alimenta o jogador por aqui (ou pelo evento
 *     "environment:obstacles" no EventBus), sem o jogador conhecer mapa algum.
 *
 * Nao ha gravidade: visao top-down, entao a resolucao eh feita em X e depois
 * em Y contra os AABBs do ambiente.
 */

export class CollisionSystem {
  constructor() {
    /** @type {Array<{x:number,y:number,w:number,h:number}>} retangulos proprios */
    this._rects = [];
    /** @type {Set<string>} ids de provider removidos por recarga */
    this._providers = new Set();
    /** @type {Array<Function>} */
    this._providerFns = [];
    /** ultimo conjunto de colisoes do frame (debug/HUD) */
    this.lastHits = [];
  }

  // ------------------------------------------------------- registro --------
  /** Adiciona um obstaculo estatico/movel; retorna id para remocao. */
  addRect(rect) {
    const r = normalize(rect);
    this._rects.push(r);
    return r.id;
  }

  removeRect(id) {
    const i = this._rects.findIndex((r) => r.id === id);
    if (i >= 0) {
      this._rects.splice(i, 1);
      return true;
    }
    return false;
  }

  clearRects() {
    this._rects.length = 0;
  }

  /**
   * Registra uma funcao que devolve rects quando consultada
   * (ex.: () => level.getSolidTiles()). Use replaceGroup para substituir
   * todos os rects de um grupo anterior (recarga de mapa).
   */
  addProvider(fn, opts = {}) {
    if (typeof fn !== "function") throw new Error("CollisionSystem.addProvider espera funcao");
    this._providers.add(fn);
    this._providerFns.push({ fn, group: opts.group ?? null });
    return fn;
  }

  removeProvider(fn) {
    this._providers.delete(fn);
    const i = this._providerFns.findIndex((p) => p.fn === fn);
    if (i >= 0) this._providerFns.splice(i, 1);
  }

  clearProviders(group = null) {
    this._providerFns = this._providerFns.filter((p) => {
      if (group == null || p.group !== group) return true;
      this._providers.delete(p.fn);
      return false;
    });
  }

  // ------------------------------------------------------------ testes -----
  /** Todos os rects ativos agora (propriose + providers). */
  collectRects() {
    const out = [...this._rects];
    for (const { fn } of this._providerFns) {
      try {
        const rects = fn();
        if (Array.isArray(rects)) for (const r of rects) out.push(normalize(r));
      } catch (err) {
        console.error("[CollisionSystem] provider falhou:", err);
      }
    }
    return out;
  }

  /** true se `box` ({x,y,w,h} centro) sobrepoe qualquer obstaculo. */
  isBlocked(box) {
    const b = normalize(box);
    for (const r of this.collectRects()) {
      if (overlap(b, r)) return true;
    }
    return false;
  }

  overlap(a, b) {
    return overlap(normalize(a), normalize(b));
  }

  // --------------------------------------------------------- resolucao ------
  /**
   * Move o corpo pela velocidade com resolucao separada por eixo:
   *   tenta X, desfaz se colidiu; tenta Y, desfaz se colidiu.
   * Isso da "slide" natural em paredes e cantos.
   *
   * @param {{x:number,y:number}} position centro do corpo
   * @param {{vx:number,vy:number}} velocity px/s
   * @param {{w:number,h:number}} size dimensoes do AABB
   * @param {number} dt segundos
   * @returns {{x:number, y:number, vx:number, vy:number, collided:boolean, hits:Array}}
   */
  moveAndSlide(position, velocity, size, dt) {
    const box = { x: position.x, y: position.y, w: size.w, h: size.h };
    const obstacles = this.collectRects();
    const hits = [];

    let nx = position.x + velocity.vx * dt;
    box.x = nx;
    let blockedX = false;
    for (const r of obstacles) {
      if (overlap(box, r)) {
        blockedX = true;
        hits.push(r);
      }
    }
    if (blockedX) nx = position.x;

    let ny = position.y + velocity.vy * dt;
    box.x = nx;
    box.y = ny;
    let blockedY = false;
    for (const r of obstacles) {
      if (overlap(box, r)) {
        blockedY = true;
        if (!hits.includes(r)) hits.push(r);
      }
    }
    if (blockedY) ny = position.y;

    this.lastHits = hits;
    return {
      x: nx,
      y: ny,
      vx: blockedX ? 0 : velocity.vx,
      vy: blockedY ? 0 : velocity.vy,
      collided: blockedX || blockedY,
      hits,
    };
  }
}

let _uid = 0;
function normalize(rect) {
  const w = Math.max(1, rect.w ?? rect.width ?? 1);
  const h = Math.max(1, rect.h ?? rect.height ?? 1);
  return {
    id: rect.id ?? `obs-${++_uid}`,
    x: rect.x ?? 0,
    y: rect.y ?? 0,
    w,
    h,
    label: rect.label,
  };
}

function overlap(a, b) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2
  );
}
