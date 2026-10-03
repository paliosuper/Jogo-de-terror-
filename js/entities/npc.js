/* ============================================================
   npc.js — NPCs estáticos ou patrulhando, com diálogo em fila.
   Um único sprite (npc_hooded) reutilizado com tint/escala por código.
   ============================================================ */
class NPC {
  constructor(opts) {
    this.x = opts.x;
    this.y = opts.y;
    this.w = 24; this.h = 40;
    this.name = opts.name || '???';
    this.lines = opts.lines || ['...'];
    this.lineIndex = 0;
    this.tint = opts.tint || null;       // css color para variar sem nova arte
    this.scale = opts.scale || 1;
    this.patrol = opts.patrol || null;   // { toX, speed } -> vai-e-vem simples
    this.dir = 1;
    this.bobPhase = U.rand(0, Math.PI * 2);
    this.consumed = false;               // diálogos já vistos? (narrativa)
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(dt) {
    if (this.patrol) {
      this.x += this.dir * this.patrol.speed * dt;
      if (this.x > this.patrol.toX) this.dir = -1;
      if (this.x < this.patrol.fromX) this.dir = 1;
    }
    this.bobPhase += dt * 1.8;
  }

  draw(ctx) {
    const img = Assets.get('npc_hooded');
    if (!img) return;
    const bob = Math.sin(this.bobPhase) * 1.2;
    const w = this.w * this.scale, h = this.h * this.scale;

    ctx.save();
    ctx.translate(this.cx, this.y + this.h);
    if (this.patrol && this.dir < 0) ctx.scale(-1, 1);

    if (this.tint) {
      // tint sem segunda arte: desenha e sobrepõe cor via composite
      ctx.drawImage(img, -w / 2, -h + bob, w, h);
      ctx.globalCompositeOperation = 'source-atop';
    } else {
      ctx.drawImage(img, -w / 2, -h + bob, w, h);
    }
    ctx.restore();

    // marcador sutil de "fale comigo" quando o jogador está perto
    const d = U.dist(this.cx, this.cy, Player.getPos().x, Player.getPos().y);
    if (d < 70) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Game.time * 3);
      ctx.fillStyle = '#3fd8c2';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('…', this.cx, this.y - 8);
      ctx.restore();
    }
  }

  /** Retorna a próxima fala (ou null se terminou) */
  speak() {
    const line = { speaker: this.name, text: this.lines[this.lineIndex] };
    this.lineIndex++;
    if (this.lineIndex >= this.lines.length) {
      this.lineIndex = 0;      // loops de conversa são ok
      this.consumed = true;
    }
    return line;
  }
}
