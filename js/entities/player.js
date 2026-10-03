/* ============================================================
   player.js — jogador: movimento top-down, animação por código,
   colisão com sólidos da cena e lanterna pessoal.
   ============================================================ */
const Player = (() => {

  const state = {
    x: 0, y: 0,
    w: 24, h: 40,
    speed: 130,
    sprintMul: 1.6,
    facing: 'down',      // left|right|down|up (para flip/offset visual)
    flipped: false,
    moving: false,
    animTime: 0,
    stepTimer: 0,
    bobPhase: 0
  };

  /** Posição do "pé" do personagem (referência de chão/ordem Y) */
  function footY() { return state.y + state.h; }
  function centerX() { return state.x + state.w / 2; }
  function centerY() { return state.y + state.h / 2; }

  /* ---- Controle externo (aberturas/scripted): congela o input sem
         reescrever o jogador. Default: sempre liberado. ---- */
  let controlLocked = false;
  function setControlLocked(v) { controlLocked = !!v; }
  function isControlLocked() { return controlLocked; }

  /* ---- Modificador de velocidade por script (ex.: "presença" da criatura
         deixa o jogador temporariamente mais lento). Reutiliza o jogador,
         sem nova mecânica: é só um multiplicador com decaimento. ---- */
  let speedMul = 1;
  let speedMulTimer = 0;
  function slow(duration, mul = 0.55) {
    // aplica o efeito mais forte vigente
    const m = U.clamp(mul, 0.2, 1);
    if (m < speedMul || speedMulTimer <= 0) { speedMul = m; }
    speedMulTimer = Math.max(speedMulTimer, duration);
  }

  /* ---- Empurrão momentâneo (tropeço da abertura) ---- */
  let nudge = null;   // {vx, vy, t}
  function addNudge(vx, vy, dur = 0.4) { nudge = { vx, vy, t: dur }; }

  function spawn(x, y) {
    state.x = x; state.y = y;
    state.moving = false;
    state.animTime = 0;
    nudge = null;
    controlLocked = false;
    speedMul = 1; speedMulTimer = 0;   // modificadores não vazam entre cenas
  }

  /** AABB atual para colisão */
  function hitbox() {
    // hitbox menor que o sprite (pés), sensação melhor
    return { x: state.x + 5, y: state.y + 22, w: state.w - 10, h: 16 };
  }

  function update(dt, solids, paused = false) {
    // decaimento do modificador de velocidade (scripted)
    if (speedMulTimer > 0) {
      speedMulTimer -= dt;
      if (speedMulTimer <= 0) speedMul = 1;
    }

    // empurrão de scripted event (tropeço) — sempre aplicado
    if (nudge) {
      nudge.t -= dt;
      const k = U.clamp(nudge.t / 0.4, 0, 1);
      moveWithCollision(nudge.vx * k * dt, nudge.vy * k * dt, solids);
      if (nudge.t <= 0) nudge = null;
    }

    const blocked = controlLocked || paused;
    const mv = blocked ? { x: 0, y: 0 } : Input.moveVector();
    const sprint = !blocked && Input.isDown('sprint');
    const spd = state.speed * (sprint ? state.sprintMul : 1) * speedMul;

    state.moving = (mv.x !== 0 || mv.y !== 0);

    if (state.moving) {
      // direção dominante para flip
      if (Math.abs(mv.x) > Math.abs(mv.y)) {
        state.facing = mv.x < 0 ? 'left' : 'right';
        state.flipped = mv.x < 0;
      } else {
        state.facing = mv.y < 0 ? 'up' : 'down';
      }

      // movimento em dois passes (X depois Y) -> deslize em paredes
      moveWithCollision(mv.x * spd * dt, mv.y * spd * dt, solids);

      // animação de passos + sfx
      state.animTime += dt * (sprint ? 1.5 : 1);
      state.stepTimer -= dt * (sprint ? 1.4 : 1);
      if (state.stepTimer <= 0) {
        state.stepTimer = 0.38;
        AudioSys.sfxStep();
        // poeira sutil ao andar
        Particles.emit({
          x: centerX() + U.rand(-4, 4), y: footY() - 2,
          vx: U.rand(-6, 6), vy: U.rand(-14, -4),
          life: 0.5, size: 1.5, color: 'rgba(140,150,160,0.25)'
        });
      }
    } else {
      state.animTime = 0;
    }

    // respiração idle (bob senoidal por código — sem frames extras)
    state.bobPhase += dt * (state.moving ? 9 : 2.2);
  }

  /** Movimento com colisão em dois passes (X depois Y) -> deslize em paredes */
  function moveWithCollision(dx, dy, solids) {
    if (dx !== 0) {
      const nx = state.x + dx;
      if (!collidesAt(nx, state.y, solids)) state.x = nx;
    }
    if (dy !== 0) {
      const ny = state.y + dy;
      if (!collidesAt(state.x, ny, solids)) state.y = ny;
    }
  }

  function collidesAt(px, py, solids) {
    const hb = { x: px + 5, y: py + 22, w: state.w - 10, h: 16 };
    for (const s of solids) {
      if (U.aabb(hb, s)) return true;
    }
    return false;
  }

  function draw(ctx) {
    const name = state.moving
      ? (Math.floor(state.animTime * 6) % 2 === 0 ? 'player_walk' : 'player_idle')
      : 'player_idle';
    const img = Assets.get(name);
    if (!img) return;

    let bob = Math.sin(state.bobPhase) * (state.moving ? 1.4 : 0.7);
    let lean = state.moving ? Math.sin(state.bobPhase) * 0.02 : 0;
    let tilt = 0;

    // tropeço (nudge ativo): inclina para frente e "escorrega" visualmente
    if (nudge) {
      const k = U.clamp(nudge.t / 0.4, 0, 1);
      tilt = 0.35 * k;
      bob -= 4 * k;
    }

    ctx.save();
    ctx.translate(centerX(), footY());
    if (state.flipped) ctx.scale(-1, 1);
    ctx.rotate(tilt + lean);
    ctx.drawImage(img, -state.w / 2, -state.h + bob, state.w, state.h);
    ctx.restore();
  }

  /** Luz própria do jogador (lanterna/fone brilhando) */
  function addLights() {
    const p = Lighting.worldToScreen(centerX(), centerY() - 6);
    Lighting.addLight(p.x, p.y, 150, 0.85, 0.08);
  }

  function getPos() { return { x: centerX(), y: centerY() }; }

  return {
    state, spawn, update, draw, addLights, getPos, hitbox, footY,
    setControlLocked, isControlLocked, addNudge, slow,
    get speedMul() { return speedMul; }
  };
})();
