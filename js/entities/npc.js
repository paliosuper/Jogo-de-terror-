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

    /* ---- Extensões p/ criatura/scripted (opcionais, reutilizam o NPC) ---- */
    this.script = opts.script || null;   // fn(dt, npc) — movimento encenado
    this.moving = false;                 // anima o bob (sem frames extras)
    this.faceDir = 0;                    // -1|1 força orientação do desenho
    this.stareTimer = 0;                 // "olhando para você" ativo
    this.alpha = opts.alpha !== undefined ? opts.alpha : 1;  // fade in/out por código
    this.fadeRate = opts.fadeRate || 0;  // unidades de alpha por segundo (via targetAlpha)
    this.targetAlpha = this.alpha;
    this.silent = !!opts.silent;         // true -> sem marcador "…" de conversa
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(dt) {
    if (this.patrol) {
      this.x += this.dir * this.patrol.speed * dt;
      if (this.x > this.patrol.toX) this.dir = -1;
      if (this.x < this.patrol.fromX) this.dir = 1;
      this.moving = true;
    }
    // script de movimento próprio (ex.: criatura que caminha e encara)
    if (this.script && !this.consumed) this.script(dt, this);

    // fade suave de presença (usado pela aparição/desaparição da criatura)
    if (this.fadeRate > 0 && this.alpha !== this.targetAlpha) {
      const d = Math.sign(this.targetAlpha - this.alpha);
      this.alpha = U.clamp(this.alpha + d * this.fadeRate * dt, 0, 1);
    }
    if (this.stareTimer > 0) this.stareTimer -= dt;

    this.bobPhase += dt * (this.moving ? 6 : 1.8);
  }

  /** "olhar para o jogador": vira a silhueta na hora, sem nova arte */
  facePlayer() {
    const p = Player.getPos();
    this.faceDir = p.x < this.cx ? -1 : 1;
    this.stareTimer = 2.2;
  }

  draw(ctx) {
    const img = Assets.get('npc_hooded');
    if (!img || this.alpha <= 0) return;
    const bob = Math.sin(this.bobPhase) * 1.2;
    const w = this.w * this.scale, h = this.h * this.scale;

    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.cx, this.y + this.h);
    // orientação: patrulha usa dir; scripts usam faceDir quando definido
    const facing = this.faceDir !== 0 ? this.faceDir : (this.patrol ? this.dir : 1);
    if (facing < 0) ctx.scale(-1, 1);

    ctx.drawImage(img, -w / 2, -h + bob, w, h);

    // tint por código (sem segunda arte): glow dos olhos na cor do personagem
    if (this.tint) {
      ctx.fillStyle = this.tint;
      ctx.globalAlpha = this.alpha * (0.5 + 0.5 * Math.sin(Game.time * 2 + this.x));
      ctx.fillRect(-3 * this.scale, -h + 10 * this.scale + bob, 2 * this.scale, 2 * this.scale);
      ctx.fillRect(1 * this.scale, -h + 10 * this.scale + bob, 2 * this.scale, 2 * this.scale);
    }
    ctx.restore();

    // marcador sutil de "fale comigo" quando o jogador está perto
    // (a criatura NÃO convida a conversa: não ataca, não fala ainda)
    const d = U.dist(this.cx, this.cy, Player.getPos().x, Player.getPos().y);
    if (d < 70 && !this.silent) {
      ctx.save();
      ctx.globalAlpha = this.alpha * (0.5 + 0.5 * Math.sin(Game.time * 3));
      ctx.fillStyle = '#3fd8c2';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('…', this.cx, this.y - 8);
      ctx.restore();
    }
    // indicador de "está olhando para você" (usado pela criatura)
    if (this.stareTimer > 0) {
      ctx.save();
      ctx.globalAlpha = U.clamp(this.stareTimer / 2.2, 0, 1) * 0.8;
      ctx.fillStyle = '#d84f4f';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('te observa', this.cx, this.y - 20);
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
