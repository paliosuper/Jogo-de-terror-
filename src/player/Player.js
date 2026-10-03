/**
 * Player -- fachada publica do SISTEMA DO JOGADOR.
 *
 * Responsabilidades:
 *   - ler InputManager (WASD + setas + Shift + E);
 *   - decidir estado via PlayerStateMachine (IDLE/WALK/RUN/INTERACT/SCARED/STUNNED);
 *   - calcular velocidade via SpeedSystem (multiplicadores externos, medo);
 *   - mover com colisao via CollisionSystem (slide eixo-a-eixo);
 *   - manter direcao (facing) e animacao via AnimationLibrary + SpriteAnimator;
 *   - alimentar CameraFollow;
 *   - expor API para OUTROS sistemas sem acesso a variaveis internas:
 *       player.setMovementMultiplier(0.7)
 *       player.lockMovement(true / false)
 *       player.scare() / player.stun()
 *
 * NAO conhece criatura, radio, mapas ou narrativa -- so emite eventos no bus.
 */

import { PlayerState } from "./PlayerStateMachine.js";
import { PLAYER_CONFIG, DIRECTIONS } from "./config.js";
import { DEFAULT_KEY_MAP, readAxis, anyDown, anyPressed } from "./InputManager.js";
import { animationForState } from "./config.js";

export class Player {
  /**
   * @param {{
   *   position?: {x:number,y:number},
   *   input: import("./InputManager.js").InputManager,
   *   stateMachine: import("./PlayerStateMachine.js").PlayerStateMachine,
   *   speedSystem: import("./SpeedSystem.js").SpeedSystem,
   *   collision: import("./CollisionSystem.js").CollisionSystem,
   *   interactions: import("./InteractionSystem.js").InteractionSystem,
   *   animator: import("./SpriteAnimator.js").SpriteAnimator,
   *   animations: import("./AnimationLibrary.js").AnimationLibrary,
   *   camera: import("./CameraFollow.js").CameraFollow,
   *   bus?: import("../core/EventBus.js").EventBus,
   *   keyMap?: object,
   * }} deps
   */
  constructor(deps) {
    this.input = deps.input;
    this.stateMachine = deps.stateMachine;
    this.speed = deps.speedSystem;
    this.collision = deps.collision;
    this.interactions = deps.interactions;
    this.animator = deps.animator;
    this.animations = deps.animations;
    this.camera = deps.camera ?? null;
    this.bus = deps.bus ?? null;
    this.keyMap = deps.keyMap ?? DEFAULT_KEY_MAP;

    this.position = { x: deps.position?.x ?? 0, y: deps.position?.y ?? 0 };
    this.velocity = { x: 0, y: 0 };
    /** @type {"down"|"left"|"right"|"up"} */
    this.facing = "down";
    /** ultimo vetor de movimento normalizado (para efeitos/rastro) */
    this.moveVector = { x: 0, y: 0 };

    // flags controladas por outros sistemas via lockMovement()
    this._movementLocked = false;
    this._interactLocked = false;

    // timers internos dos estados
    this._scareTimer = 0;
    this._stunTimer = 0;
    this._interactTimer = 0;
    this._interactCooldown = 0;

    // estado atual da animacao (nome + track), sincronizado na maquina
    this._animName = "idle";
    this._track = this.animations.track("idle", this.facing);
    this.animator.fps = this._track.fps;
    this.animator.restart(this._track.frames);

    this._wireStateMachine();
    this.camera?.snapTo(this.position);
  }

  // ================================================================ getters ==
  get state() {
    return this.stateMachine.state;
  }

  is(state) {
    return this.state === state;
  }

  get movementLocked() {
    return this._movementLocked;
  }

  /** Velocidade efetiva atual (px/s, apos suavizacao e multiplicadores). */
  get speedValue() {
    return this.speed.currentSpeed;
  }

  get colliderBox() {
    const c = PLAYER_CONFIG.collider;
    return {
      x: this.position.x,
      y: this.position.y + c.offsetY,
      w: c.width,
      h: c.height,
    };
  }

  // ====================================================== API p/ outros sistemas ==
  /**
   * Reduz/aumenta a velocidade do jogador sem tocar em variaveis internas.
   * Ex.: susto -> player.setMovementMultiplier(0.7); recuperar -> (1).
   * @param {number} value
   * @param {{duration?: number}} [opts] duracao opcional em segundos
   */
  setMovementMultiplier(value, opts = {}) {
    const v = this.speed.setMovementMultiplier(value, opts);
    this.bus?.emit("player:movement-multiplier-changed", { value: v, duration: opts.duration });
    return v;
  }

  getMovementMultiplier() {
    return this.speed.getMovementMultiplier();
  }

  /**
   * Trava/destrava o controle de movimento (cenas, portas, cutscenes).
   * @param {boolean} locked
   * @param {{allowInteract?: boolean}} [opts]
   */
  lockMovement(locked, opts = {}) {
    this._movementLocked = !!locked;
    if (this._movementLocked && !opts.allowInteract) this._interactLocked = true;
    else this._interactLocked = false;
    this.bus?.emit("player:movement-lock-changed", {
      locked: this._movementLocked,
      allowInteract: opts.allowInteract === true,
    });
    return this._movementLocked;
  }

  /** Coloca o jogador em SCARED com reducao temporaria de velocidade. */
  scare(opts = {}) {
    const duration = opts.duration ?? PLAYER_CONFIG.fear.scareDuration;
    const mult = opts.speedMultiplier ?? PLAYER_CONFIG.fear.speedMultiplierWhileScared;
    this._scareTimer = Math.max(this._scareTimer, duration);
    this.speed.pushMultiplier(mult, { tag: "fear-scared", duration });
    this.stateMachine.force(PlayerState.SCARED, { reason: opts.reason ?? "scare" });
    this.bus?.emit("player:scared", { duration, reason: opts.reason });
  }

  /** Atordoa o jogador (sem movimento nem interacao) por `duration` segundos. */
  stun(opts = {}) {
    const duration = opts.duration ?? PLAYER_CONFIG.fear.stunDuration;
    this._stunTimer = Math.max(this._stunTimer, duration);
    this._scareTimer = Math.max(this._scareTimer, duration); // atordoado >= assustado
    this.stateMachine.force(PlayerState.STUNNED, { reason: opts.reason ?? "stun" });
    this.bus?.emit("player:stunned", { duration, reason: opts.reason });
  }

  /** Teleporte seguro (usado por mapas/checkpoints). Respeita colisao. */
  teleport(x, y) {
    const box = { ...this.colliderBox, x, y: y + PLAYER_CONFIG.collider.offsetY };
    if (this.collision.isBlocked(box)) {
      console.warn("[Player] teleport para area bloqueada ignorado:", x, y);
      return false;
    }
    this.position.x = x;
    this.position.y = y;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.speed.resetSmoothing();
    this.camera?.snapTo(this.position);
    this.bus?.emit("player:teleported", { x, y });
    return true;
  }

  // ================================================================= update ==
  /**
   * Um passo de simulacao. Chame uma vez por frame com dt em segundos.
   * @param {number} dt
   */
  update(dt) {
    dt = Math.min(dt, 0.1); // clamp anti-spiral (abas em background)

    // ---- timers -----------------------------------------------------------
    this._scareTimer = Math.max(0, this._scareTimer - dt);
    this._stunTimer = Math.max(0, this._stunTimer - dt);
    this._interactTimer = Math.max(0, this._interactTimer - dt);
    this._interactCooldown = Math.max(0, this._interactCooldown - dt);

    // STUNNED sai sozinho quando o timer expira
    if (this.stateMachine.is(PlayerState.STUNNED) && this._stunTimer <= 0) {
      this.stateMachine.force(PlayerState.SCARED, { reason: "stun-end" });
    }

    // ---- leitura de input -------------------------------------------------
    const rawX = readAxis(this.input, this.keyMap.right) - readAxis(this.input, this.keyMap.left);
    const rawY = readAxis(this.input, this.keyMap.down) - readAxis(this.input, this.keyMap.up);
    const dir = normalizeDir(rawX, rawY);
    const wantsRunKey = anyDown(this.input, this.keyMap.run);
    const runIntent = computeRun(dir, wantsRunKey);

    const interactPressed =
      anyPressed(this.input, this.keyMap.interact) &&
      this._interactCooldown <= 0 &&
      !this._interactLocked &&
      !this.stateMachine.any([PlayerState.SCARED, PlayerState.STUNNED]);

    const canMove = !this._movementLocked;
    const context = {
      dt,
      inputDir: dir,
      wantsRun: runIntent,
      canMove,
      scareTimer: this._scareTimer,
      stunTimer: this._stunTimer,
      interactTimer: this._interactTimer,
      interactIntent: interactPressed,
      interactTargetId: interactPressed ? this.interactions.findNearest(this.position)?.id ?? null : null,
    };

    // ---- transicoes --------------------------------------------------------
    if (interactPressed) this._interactCooldown = PLAYER_CONFIG.interact.keyRepeatDelay;
    this.stateMachine.update(context);

    // ---- resolucao de movimento --------------------------------------------
    const state = this.stateMachine.state;
    const moving =
      canMove &&
      !dir.isZero &&
      (state === PlayerState.WALK || state === PlayerState.RUN);

    const pxSpeed = this.speed.resolveSpeed({
      state,
      wantsRun: runIntent && canMove && !dir.isZero,
      dt,
    });

    let vx = 0;
    let vy = 0;
    if (moving) {
      vx = dir.x * pxSpeed;
      vy = dir.y * pxSpeed;
      this.moveVector = { x: dir.x, y: dir.y };
      this._updateFacing(dir);
    } else {
      this.moveVector = { x: 0, y: 0 };
    }
    this.velocity = { x: vx, y: vy };

    // ---- colisao + integracao ----------------------------------------------
    if (vx !== 0 || vy !== 0) {
      const size = { w: PLAYER_CONFIG.collider.width, h: PLAYER_CONFIG.collider.height };
      const foot = { x: this.position.x, y: this.position.y + PLAYER_CONFIG.collider.offsetY };
      const result = this.collision.moveAndSlide(foot, { vx, vy }, size, dt);
      const blocked = result.collided;
      this.position.x = result.x;
      this.position.y = result.y - PLAYER_CONFIG.collider.offsetY;
      if (blocked) {
        this.bus?.emit("player:collision", { hits: result.hits.length });
      }
    }

    // ---- animacao ------------------------------------------------------------
    this._syncAnimation(state);

    // ---- camera ---------------------------------------------------------------
    this.camera?.follow(this.position, dt);

    // ---- fim de frame ----------------------------------------------------------
    this.input.endFrame?.();
    return this;
  }

  // ================================================================ helpers ==
  _wireStateMachine() {
    const sm = this.stateMachine;
    sm.onEnter(PlayerState.INTERACT, () => {
      this._interactTimer = PLAYER_CONFIG.interact.animationDuration;
      const res = this.interactions.tryInteract(this, this.position);
      this.bus?.emit("player:interact-attempt", res);
    });
    sm.onEnter(PlayerState.SCARED, () => {
      // ao entrar em SCARED garantimos o multiplicador temporario de medo
      if (!this.speed.hasTag("fear-scared")) {
        this.speed.pushMultiplier(PLAYER_CONFIG.fear.speedMultiplierWhileScared, {
          tag: "fear-scared",
          duration: Math.max(0.2, this._scareTimer),
        });
      }
    });
    sm.onEnter(PlayerState.STUNNED, () => {
      this.velocity = { x: 0, y: 0 };
    });
    sm.onExit(PlayerState.SCARED, () => {
      this.speed.removeMultiplier("fear-scared");
    });
    sm.onChange = (from, to, payload) => {
      this.bus?.emit("player:state-changed", { from, to, reason: payload?.reason, targetId: payload?.targetId });
    };
  }

  _updateFacing(dir) {
    const next = facingFromVector(dir);
    if (next !== this.facing) {
      this.facing = next;
      this.bus?.emit("player:facing-changed", { facing: next });
    }
  }

  _syncAnimation(state) {
    const name = animationForState(state);
    const track = this.animations.track(name, this.facing);
    if (name !== this._animName || track.row !== this._track.row || track.frames !== this._track.frames) {
      this._animName = name;
      this._track = track;
      this.animator.fps = track.fps;
      this.animator.restart(track.frames);
    } else {
      this.animator.setFrameCount(track.frames);
    }
    // IMPORTANTE: nao avancamos o relogio aqui. player.update(dt) roda mais de
    // uma vez por frame quando ha "catch-up" de tempo; o avanco acontece
    // exatamente uma vez por frame em advanceAnimation() (loop de render).
  }

  /** Avanca o relogio de animacao e devolve o rect do frame na folha. */
  advanceAnimation(dt) {
    this.animator.update(dt);
    return this.animations.frameRect(this._track, this.animator.frame);
  }

  /** Snapshot barato para HUD/debug/outros sistemas (sem referencias internas). */
  getSnapshot() {
    return {
      state: this.state,
      facing: this.facing,
      position: { ...this.position },
      velocity: { ...this.velocity },
      speed: this.speedValue,
      movementMultiplier: this.getMovementMultiplier(),
      movementLocked: this._movementLocked,
      animation: { name: this._animName, frame: this.animator.frame, track: { ...this._track } },
      scared: this._scareTimer > 0,
      stunned: this._stunTimer > 0,
    };
  }

  /** Lista de direcoes canonicas (util p/ renderers fora do modulo). */
  static get directions() {
    return DIRECTIONS;
  }
}

// ------------------------------------------------------------------ utils ---
export function normalizeDir(rawX, rawY) {
  const x = clamp1(rawX);
  const y = clamp1(rawY);
  const len = Math.hypot(x, y);
  const isZero = len === 0;
  return { x: isZero ? 0 : x / len, y: isZero ? 0 : y / len, isZero, rawX: x, rawY: y };
}

/**
 * Corrida: tecla de corrida pressionada + direcional "limpo".
 * Diagonal so corre se um eixo dominar o outro
 * (config.speed.runAxisDominance) ou se allowDiagonalRun for true.
 */
export function computeRun(dir, wantsRunKey) {
  if (!wantsRunKey || dir.isZero) return false;
  const ax = Math.abs(dir.rawX);
  const ay = Math.abs(dir.rawY);
  if (ax === 0 || ay === 0) return true; // eixo puro sempre corre
  if (PLAYER_CONFIG.speed.allowDiagonalRun) return true;
  const dominance = PLAYER_CONFIG.speed.runAxisDominance;
  return Math.max(ax, ay) / Math.min(ax, ay) >= dominance;
}

export function facingFromVector(dir) {
  if (dir.isZero) return null;
  if (Math.abs(dir.x) >= Math.abs(dir.y)) return dir.x > 0 ? "right" : "left";
  return dir.y > 0 ? "down" : "up";
}

function clamp1(v) {
  return Math.max(-1, Math.min(1, v));
}
