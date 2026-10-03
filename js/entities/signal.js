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
      ctx.fillText('[ESPAÇO]', this.cx, this.y - 8);
      ctx.restore();
    }
  }

  addLights() {
    const p = Lighting.worldToScreen(this.cx, this.y + 14);
    Lighting.addLight(p.x, p.y, 70, 0.6, 0.35); // tela piscando
  }

  use() {
    const line = { speaker: this.name, text: this.lines[this.lineIndex] };
    this.lineIndex = (this.lineIndex + 1) % this.lines.length;
    this.useCount++;
    AudioSys.sfxInteract();
    return line;
  }
}
