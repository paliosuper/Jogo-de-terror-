/* ============================================================
   scene.js — classe base de cena + registry.
   Uma cena possui: mundo (bounds), sólidos, entidades, camadas de
   parallax, pontos de saída e ambiente de luz/áudio próprios.
   ============================================================ */
class Scene {
  constructor(name) {
    this.name = name;
    this.bounds = { w: 960, h: 540 };
    this.solids = [];        // [{x,y,w,h}] paredes/obstáculos
    this.npcs = [];
    this.shards = [];
    this.terminals = [];
    this.lamps = [];         // [{x,y,flicker,radius}] decoração luminosa
    this.exits = [];         // [{x,y,w,h,to,spawnX,spawnY,label}]
    this.parallaxLayers = [];
    this.ambient = 0.85;     // escuridão base
    this.ambientColor = '5, 10, 16';
    this.droneFreq = 55;
    this.exitsLocked = false; // true -> saídas desativadas (aberturas/scripted)
    this.events = {};        // narrativa ambiental por gatilho: id -> {once, fn}
    this._firedEvents = new Set();
  }

  enter() {}                 // chamado ao trocar para esta cena
  exit() {}                  // chamado ao sair

  update(dt) {
    for (const n of this.npcs) n.update(dt);
    for (const s of this.shards) s.update(dt);

    // coleta automática por proximidade
    const pp = Player.getPos();
    for (const s of this.shards) {
      if (s.tryCollect(pp)) Game.addTuning(s.bump);
    }

    // saídas (respeitando flag de bloqueio da cena — usada na abertura)
    if (!Game.dialogue.active && !this.exitsLocked) {
      const hb = Player.hitbox();
      for (const e of this.exits) {
        if (U.aabb(hb, e)) {
          Game.changeScene(e.to, { x: e.spawnX, y: e.spawnY });
          return;
        }
      }
    }

    // interação (espaço/E): terminal > npc
    if (Input.justPressed('interact') && !Game.dialogue.active && !Player.isControlLocked()) {
      let target = null;
      for (const t of this.terminals) if (t.near(pp)) { target = t; break; }
      if (!target) {
        for (const n of this.npcs) {
          if (U.dist(n.cx, n.cy, pp.x, pp.y) < 70) { target = n; break; }
        }
      }
      if (target) {
        const line = target.use ? target.use() : target.speak();
        Game.dialogue.show(line.speaker, line.text);
        Particles.emit({ x: pp.x, y: pp.y - 30, vx: 0, vy: -20,
                         life: 0.6, size: 2, color: 'rgba(63,216,194,0.9)', glow: true });
      }
    }

    // eventos de área (narrativa ambiental ao entrar em zonas)
    for (const [id, ev] of Object.entries(this.events)) {
      if (this._firedEvents.has(id) && ev.once !== false) continue;
      const zone = ev.zone; // {x,y,w,h}
      const hb = Player.hitbox();
      if (U.aabb(hb, zone)) {
        this._firedEvents.add(id);
        ev.fn();
      }
    }
  }

  /** Camada do chão padrão — reutilizada por todas as cenas */
  drawFloor(ctx, time) {
    const c = Camera.getPos();
    ctx.fillStyle = '#0c1117';
    ctx.fillRect(c.x - 10, c.y - 10,
                 Camera.getView().w + 20, Camera.getView().h + 20);
    // textura sutil: grid de "tiles" escuros desenhado por código
    ctx.strokeStyle = 'rgba(255,255,255,0.018)';
    ctx.lineWidth = 1;
    const T = 48;
    const x0 = Math.floor(c.x / T) * T, y0 = Math.floor(c.y / T) * T;
    ctx.beginPath();
    for (let x = x0; x < c.x + Camera.getView().w + T; x += T) {
      ctx.moveTo(x, c.y); ctx.lineTo(x, c.y + Camera.getView().h);
    }
    for (let y = y0; y < c.y + Camera.getView().h + T; y += T) {
      ctx.moveTo(c.x, y); ctx.lineTo(c.x + Camera.getView().w, y);
    }
    ctx.stroke();
  }

  drawSolids(ctx, time) {
    for (const s of this.solids) {
      if (!Camera.isVisible(s.x, s.y, s.w, s.h)) continue;
      ctx.fillStyle = '#161d24';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      // aresta iluminada por cima (volume sem arte extra)
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(s.x, s.y, s.w, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(s.x, s.y + s.h - 3, s.w, 3);
    }
  }

  drawLamps(ctx, time) {
    const img = Assets.get('lamp');
    for (const L of this.lamps) {
      if (!Camera.isVisible(L.x - 12, L.y - 28, 12, 28)) continue;
      ctx.drawImage(img, L.x - 6, L.y - 28);
      // brilho do bulbo animado por código
      const f = 0.7 + 0.3 * Math.sin(time * 2 + L.x) +
                (L.flicker ? 0.15 * (U.noise1D(time * 13 + L.x) - 0.5) : 0);
      ctx.save();
      ctx.globalAlpha = U.clamp(f, 0.3, 1);
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(L.x, L.y - 22, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  addLights(ctx, time) {
    for (const L of this.lamps) {
      const p = Lighting.worldToScreen(L.x, L.y - 22);
      Lighting.addLight(p.x, p.y, L.radius || 110, 0.9, L.flicker || 0.1);
    }
    for (const s of this.shards) s.addLights();
    for (const t of this.terminals) t.addLights();
  }

  drawEntitiesFront(ctx, time) {
    // ordenação Y simples (pintor) para profundidade falsa convincente
    const drawables = [];
    for (const n of this.npcs) drawables.push({ y: n.y + n.h, d: () => n.draw(ctx) });
    for (const s of this.shards) drawables.push({ y: s.y, d: () => s.draw(ctx) });
    for (const t of this.terminals) drawables.push({ y: t.y + t.h, d: () => t.draw(ctx, time) });
    drawables.push({ y: Player.footY(), d: () => Player.draw(ctx) });
    drawables.sort((a, b) => a.y - b.y);
    for (const it of drawables) it.d();
    Particles.draw(ctx);
  }

  drawExitsHint(ctx, time) {
    for (const e of this.exits) {
      if (!e.label) continue;
      const hb = Player.hitbox();
      if (!U.aabb(hb, { x: e.x - 40, y: e.y - 40, w: e.w + 80, h: e.h + 80 })) continue;
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(time * 2.5);
      ctx.fillStyle = '#c9d6dd';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(e.label, e.x + e.w / 2, e.y + 20);
      ctx.restore();
    }
  }
}

/** Registry global de cenas — Game.setScene usa este map */
const Scenes = {
  map: {},
  register(name, factory) { this.map[name] = factory; },
  create(name) {
    const f = this.map[name];
    if (!f) throw new Error(`Cena "${name}" não registrada.`);
    return f();
  }
};
