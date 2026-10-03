/* ============================================================
   signal.js — Fragmentos de Sinal (colecionáveis) e Terminais
   (interativos). Ambos compartilham a ideia de "fonte de luz +
   interação", mas com papéis narrativos diferentes.
   ============================================================ */

/** Fragmento flutuante que aumenta a sintonia ao ser coletado */
class SignalShard {
  constructor(x, y, opts = {}) {
    this.x = x; this.y = y;
    this.size = 16;
    this.collected = false;
    this.phase = U.rand(0, Math.PI * 2);
    this.bump = opts.bump || 8;          // quanto soma no medidor de frequência
  }

  update(dt) { this.phase += dt * 2.4; }

  draw(ctx) {
    if (this.collected) return;
    const img = Assets.get('signal_shard');
    if (!img) return;
    const floatY = Math.sin(this.phase) * 5;
    const pulse = 0.75 + 0.25 * Math.sin(this.phase * 1.3);

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.translate(this.x, this.y + floatY);
    ctx.rotate(Math.sin(this.phase * 0.5) * 0.2); // micro-rotação por código
    ctx.drawImage(img, -this.size / 2, -this.size / 2);
    ctx.restore();
  }

  addLights() {
    if (this.collected) return;
    const p = Lighting.worldToScreen(this.x, this.y);
    Lighting.addLight(p.x, p.y, 60, 0.7, 0.25);
  }

  /** @returns true se coletou agora */
  tryCollect(playerPos) {
    if (this.collected) return false;
    if (U.dist(this.x, this.y, playerPos.x, playerPos.y) < 26) {
      this.collected = true;
      Particles.burst(this.x, this.y, 18, {
        color: 'rgba(63,216,194,0.9)', speedMin: 20, speedMax: 90,
        life: 0.8, glow: true
      });
      AudioSys.sfxCollect();
      return true;
    }
    return false;
  }
}

/** Terminal interativo: mostra texto ao pressionar E/Espaço perto dele */
class TerminalPoint {
  constructor(x, y, opts = {}) {
    this.x = x; this.y = y;
    this.w = 28; this.h = 36;
    this.name = opts.name || 'TERMINAL';
    this.lines = opts.lines || ['SILÊNCIO.'];
    this.lineIndex = 0;
    this.useCount = 0;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  near(playerPos, r = 60) {
    return U.dist(this.cx, this.cy, playerPos.x, playerPos.y) < r;
  }

  draw(ctx, time) {
    const img = Assets.get('terminal');
    if (!img) return;
    ctx.drawImage(img, this.x, this.y);

    // "texto" animado na tela do terminal — variação por código
    if (this.near(Player.getPos())) {
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 4);
      ctx.fillStyle = '#3fd8c2';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[E]', this.cx, this.y - 8);
      ctx.restore();
    }
  }

  addLights() {
    const p = Lighting.worldToScreen(this.cx, this.y + 14);
    Lighting.addLight(p.x, p.y, 70, 0.6, 0.35); // tela piscando
  }

  /** Terminal com "soltar item": ao usar, injeta um objeto no mundo
      (ex.: chave pendurada na porta) e para de responder — reutiliza o
      mesmo sprite/interação, sem mecânica nova. */
  use() {
    if (this.spawns && !this.spawned) {
      this.spawned = true;
      for (const obj of this.spawns) obj.place();
    }
    const line = { speaker: this.name, text: this.lines[this.lineIndex] };
    this.lineIndex = (this.lineIndex + 1) % this.lines.length;
    this.useCount++;
    AudioSys.sfxInteract();
    return line;
  }
}

/** Chave interativa: destrava uma DoorTag próxima ao ser pega com E.
    Reusa signal_shard em escala menor — a forma "chave" vem do código. */
class KeyItem {
  constructor(x, y, opts = {}) {
    this.x = x; this.y = y;
    this.id = opts.id || 'key';
    this.taken = false;
    this.phase = U.rand(0, Math.PI * 2);
  }

  get cx() { return this.x; }
  get cy() { return this.y; }

  near(playerPos, r = 46) {
    return !this.taken && U.dist(this.cx, this.cy, playerPos.x, playerPos.y) < r;
  }

  update(dt) { this.phase += dt * 2.2; }

  draw(ctx) {
    if (this.taken) return;
    const img = Assets.get('signal_shard');
    if (!img) return;
    ctx.save();
    ctx.translate(this.cx, this.cy + Math.sin(this.phase) * 3);
    ctx.rotate(Math.sin(this.phase * 0.6) * 0.3);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(img, -6, -6, 12, 12);
    // "haste" da chave desenhada por código (sem arte nova)
    ctx.strokeStyle = '#d8dde0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(9, 0);
    ctx.moveTo(7, 0); ctx.lineTo(7, 3);
    ctx.stroke();
    ctx.restore();

    if (this.near(Player.getPos())) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(Game.time * 4);
      ctx.fillStyle = '#3fd8c2';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[E] chave', this.cx, this.cy - 16);
      ctx.restore();
    }
  }

  addLights() {
    if (this.taken) return;
    const p = Lighting.worldToScreen(this.cx, this.cy);
    Lighting.addLight(p.x, p.y, 46, 0.5, 0.3);
  }

  take() {
    this.taken = true;
    Particles.burst(this.cx, this.cy, 12, {
      color: 'rgba(255,217,138,0.85)', speedMax: 70, life: 0.7, glow: true
    });
    AudioSys.sfxCollect();
  }
}

/** Porta trancada: sólido que some quando a chave correspondente é pega.
    Desenhada com o tile "wall/pillar" já existente + estado por código. */
class DoorTag {
  constructor(rect, opts = {}) {
    this.rect = rect;                 // {x,y,w,h} também adicionado a solids
    this.needsKey = opts.needsKey || null;
    this.open = false;
    this.label = opts.label || 'PORTA';
    this.onOpen = opts.onOpen || null;
  }

  near(playerPos, r = 70) {
    if (this.open) return false;
    const cx = this.rect.x + this.rect.w / 2, cy = this.rect.y + this.rect.h / 2;
    return U.dist(cx, cy, playerPos.x, playerPos.y) < r;
  }

  tryOpen(keyIds) {
    if (this.open) return false;
    if (this.needsKey && keyIds.includes(this.needsKey)) {
      this.open = true;
      AudioSys.sfxInteract();
      Camera.shake(2, 0.25);
      Particles.burst(this.rect.x + this.rect.w / 2, this.rect.y + this.rect.h / 2,
        14, { color: 'rgba(201,214,221,0.5)', speedMax: 60, life: 0.6 });
      if (this.onOpen) this.onOpen();
      return true;
    }
    return false;
  }

  draw(ctx, time) {
    if (this.open) return;   // aberta: o vão some do mundo (solid removido)
    const r = this.rect;
    ctx.save();
    ctx.fillStyle = '#241b12';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(216,221,224,0.25)';
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    // fechadura destacada
    ctx.fillStyle = '#d8dde0';
    ctx.beginPath();
    ctx.arc(r.x + r.w - 8, r.y + r.h / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    if (this.near(Player.getPos())) {
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(time * 4);
      ctx.fillStyle = '#d8dde0';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`[E] ${this.label}`, r.x + r.w / 2, r.y - 8);
    }
    ctx.restore();
  }
}

/** Fotografia/mensagem enfiada na parede: só outro uso do sprite terminal
    cortado em escala + texto via diálogo (reutilização máxima). */
class NoteObject extends TerminalPoint {
  constructor(x, y, opts = {}) {
    super(x, y, opts);
    this.photo = !!opts.photo;       // desenha moldura clara por código
    this.seen = false;               // pista narrativa: já foi lida?
  }

  draw(ctx, time) {
    const img = Assets.get('terminal');
    if (!img) return;
    if (this.photo) {
      // "fotografia": mesma arte, recorte pequeno + borda clara desenhada
      ctx.save();
      ctx.fillStyle = '#d8dde0';
      ctx.fillRect(this.x - 2, this.y - 2, this.w + 4, this.h + 4);
      ctx.drawImage(img, this.x, this.y, this.w, this.h);
      ctx.restore();
    } else {
      ctx.drawImage(img, this.x, this.y);
    }
    if (this.near(Player.getPos(), 52)) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(time * 4);
      ctx.fillStyle = '#3fd8c2';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.photo ? '[E] fotografia' : '[E] ler', this.cx, this.y - 8);
      ctx.restore();
    }
  }

  use() {
    this.seen = true;
    const line = { speaker: this.name, text: this.lines[this.lineIndex] };
    this.lineIndex = (this.lineIndex + 1) % this.lines.length;
    this.useCount++;
    AudioSys.sfxInteract();
    return line;
  }
}
