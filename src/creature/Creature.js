/**
 * Creature -- fachada publica do SISTEMA DA CRIATURA.
 *
 * Responsabilidades:
 *   - posicao no mundo (a criatura anda "ao fundo"; quem define o plano de
 *     profundidade e o mapa/camada de render, nao ela);
 *   - maquina de estados + animacao sincronizadas;
 *   - movimento simples em velocidade angular/direcional com easing
 *     (nao usa a CollisionSystem do jogador: ela e uma presenca eterea ao
 *     fundo das arvores -- colisao aqui seria falsa precisao);
 *   - opacidade controlada por fade interno (aparecer/desaparecer);
 *   - exposicao de estado para CameraShake/vinheta via getSnapshot().
 *
 * NAO tem ataque, perseguição ou combate. NAO conhece radio/narrativa:
 * interacoes acontecem via CreatureBehaviour (orquestra) e EventBus.
 */

import { CreatureState } from "./CreatureStateMachine.js";
import { CREATURE_CONFIG } from "./config.js";

export class Creature {
  /**
   * @param {{
   *   stateMachine: import("./CreatureStateMachine.js").CreatureStateMachine,
   *   animator: import("./CreatureAnimator.js").CreatureAnimator,
   *   bus?: import("../core/EventBus.js").EventBus,
   *   position?: {x:number,y:number},
   *   config?: object,
   * }} deps
   */
  constructor(deps) {
    this.stateMachine = deps.stateMachine;
    this.animator = deps.animator;
    this.bus = deps.bus ?? null;
    this.config = deps.config ?? CREATURE_CONFIG;

    this.position = { x: deps.position?.x ?? 0, y: deps.position?.y ?? 0 };
    /** direcao do corpo em radianos (0 = direita, PI/2 = baixo no mundo 2D) */
    this.bodyAngle = 0;
    /** 0..1 -- quanto a cabeca ja girou na direcao do alvo (efeito TURN) */
    this.headTurn = 0;
    /** velocidade escalar atual (px/s), suavizada */
    this.speedValue = 0;
    /** opacidade efetiva (fade interno) */
    this.opacity = 0;

    // timers internos usados pelo update()
    this._stateTimer = 0;
    this._targetSpeed = 0;
    this._moveDir = { x: 1, y: 0 };
    this._fadeTarget = 0;
    this._fadeRate = 0;
    /** @type {{x:number,y:number}|null} alvo atual do olhar (jogador) */
    this._lookTarget = null;
    this._onStateEnd = null; // callback disparado quando um timer de estado acaba

    this._wireHooks();
  }

  // ================================================================ getters ==
  get state() {
    return this.stateMachine.state;
  }

  is(state) {
    return this.stateMachine.is(state);
  }

  get visible() {
    return this.stateMachine.visible && this.opacity > 0.001;
  }

  // ==================================================== primitivas de cena ==
  /**
   * Entra em cena lentamente no ponto dado (no jumpscare).
   * @param {{x:number,y:number, angle?:number, duration?:number}} opts
   */
  appear(opts) {
    this.position.x = opts.x;
    this.position.y = opts.y;
    if (typeof opts.angle === "number") this.bodyAngle = opts.angle;
    const dur = opts.duration ?? this.config.fade.appearDuration;
    this._startState(CreatureState.APPEAR, dur, () => {
      this._gotoIdleAfterAppear();
    });
    this._beginFade(1, dur);
    this.animator.play(this._locomotionTrackFor(opts.track ?? "walk"));
    return this;
  }

  /** Sai de cena desvanecendo (depois some -> HIDDEN). */
  disappear(opts = {}) {
    const dur = opts.duration ?? this.config.fade.disappearDuration;
    this._startState(CreatureState.DISAPPEAR, dur, () => {
      this.stateMachine.force(CreatureState.HIDDEN, { reason: "vanished" });
      this.animator.play("idle");
      this.headTurn = 0;
    });
    this._beginFade(0, dur);
    return this;
  }

  /** Anda normalmente em `angle` (rad) por `duration` s (ou ate mudar de ideia). */
  walk(angle, { duration = Infinity, track = "walk" } = {}) {
    this.bodyAngle = angle;
    this._moveDir = { x: Math.cos(angle), y: Math.sin(angle) };
    this._targetSpeed = this.config.speed.walk;
    this.animator.play(track, { keepProgress: true });
    this._startState(CreatureState.WALK, duration, () => this.stop());
    return this;
  }

  /** Andar lentamente. */
  slowWalk(angle, { duration = Infinity } = {}) {
    this.bodyAngle = angle;
    this._moveDir = { x: Math.cos(angle), y: Math.sin(angle) };
    this._targetSpeed = this.config.speed.slowWalk;
    this.animator.play("slowWalk", { keepProgress: true });
    this._startState(CreatureState.SLOW_WALK, duration, () => this.stop());
    return this;
  }

  /** Para (desacelerando ate zero) e depois roda `onEnd`. */
  stop({ onEnd = null } = {}) {
    this._targetSpeed = 0;
    this._startState(CreatureState.STOP, 0.6, () => {
      if (onEnd) onEnd(this);
      else this.idle();
    });
    return this;
  }

  /** Fica parada respirando. */
  idle({ duration = Infinity, onEnd = null } = {}) {
    this._targetSpeed = 0;
    this.animator.play("idle", { keepProgress: true });
    this._startState(CreatureState.IDLE, duration, () => onEnd?.(this));
    return this;
  }

  /**
   * Vira a cabeca LENTAMENTE na direcao do alvo (jogador).
   * @param {{x:number,y:number}} targetPos
   * @param {{duration?:number, onEnd?:Function}} [opts]
   */
  turnHead(targetPos, opts = {}) {
    const dur = opts.duration ?? this.config.firstAppearance.turnDuration;
    this._lookTarget = { ...targetPos };
    this._targetSpeed = 0;
    this.animator.play("turn");
    this._startState(CreatureState.TURN, dur, () => {
      this.headTurn = 1;
      opts.onEnd?.(this);
    });
    return this;
  }

  /** Contato visual direto (trava olhando para o alvo). */
  lookAt(targetPos, opts = {}) {
    const dur = opts.duration ?? this.config.firstAppearance.lookDuration;
    this._lookTarget = { ...targetPos };
    this.headTurn = 1;
    this._targetSpeed = 0;
    this.animator.play("look");
    this._startState(CreatureState.LOOK, dur, () => opts.onEnd?.(this));
    return this;
  }

  /** Recua mantendo os olhos no jogador. */
  retreat(fromPos, opts = {}) {
    const dur = opts.duration ?? 1.8;
    const dx = this.position.x - fromPos.x;
    const dy = this.position.y - fromPos.y;
    const len = Math.hypot(dx, dy) || 1;
    this._moveDir = { x: dx / len, y: dy / len };
    this.bodyAngle = Math.atan2(dy, dx);
    this._targetSpeed = this.config.speed.retreat;
    this.headTurn = 1; // continua olhando enquanto recua
    this._lookTarget = { ...fromPos };
    this.animator.play("retreat", { keepProgress: true });
    this._startState(CreatureState.RETREAT, dur, () => opts.onEnd?.(this));
    return this;
  }

  /** Reposiciona instantaneamente (uso: reset de cena). */
  setPosition(x, y) {
    this.position.x = x;
    this.position.y = y;
    return this;
  }

  // ================================================================= update ==
  /**
   * Avanca simulacao + animacao. Chamar 1x por frame com dt em segundos.
   * @param {number} dt
   * @param {{playerPosition?: {x:number,y:number}}} [ctx]
   */
  update(dt, ctx = {}) {
    dt = Math.min(dt, 0.1);

    // ---- fade de aparencia/desaparecimento -------------------------------
    if (this._fadeRate !== 0) {
      this.opacity = clamp(this.opacity + this._fadeRate * dt, 0, 1);
      if ((this._fadeRate > 0 && this.opacity >= this._fadeTarget) ||
          (this._fadeRate < 0 && this.opacity <= this._fadeTarget)) {
        this.opacity = this._fadeTarget;
        this._fadeRate = 0;
      }
    }

    // ---- suavizacao de velocidade (easing proprio) ------------------------
    const rate = 6; // 1/s -- desaceleracao constante e previsivel
    this.speedValue = approach(this.speedValue, this._targetSpeed, rate * dt);

    // ---- integracao do movimento ------------------------------------------
    if (this.speedValue > 1 && this.visible) {
      this.position.x += this._moveDir.x * this.speedValue * dt;
      this.position.y += this._moveDir.y * this.speedValue * dt;
    }

    // ---- progresso do giro de cabeca (TURN) --------------------------------
    if (this.is(CreatureState.TURN)) {
      const dur = Math.max(0.0001, this.config.firstAppearance.turnDuration);
      this.headTurn = clamp01(1 - this._stateTimer / dur);
    }

    // ---- LOOK: cabeca sempre apontada para o jogador -------------------------
    if (this.is(CreatureState.LOOK) && ctx.playerPosition) {
      this._lookTarget = { ...ctx.playerPosition };
    }

    // ---- timer de fim de estado ---------------------------------------------
    if (Number.isFinite(this._stateTimer)) {
      this._stateTimer -= dt;
      if (this._stateTimer <= 0) {
        const cb = this._onStateEnd;
        this._stateTimer = 0;
        this._onStateEnd = null;
        cb?.();
      }
    }

    // ---- animacao --------------------------------------------------------------
    this.animator.update(dt);
    return this;
  }

  /** Snapshot barato p/ HUD/debug/renderers. */
  getSnapshot() {
    return {
      state: this.state,
      position: { ...this.position },
      bodyAngle: this.bodyAngle,
      headTurn: this.headTurn,
      speed: this.speedValue,
      opacity: this.opacity,
      animation: { name: this.animator.name, frame: this.animator.frame },
      lookingAtPlayer: this.is(CreatureState.LOOK),
    };
  }

  // ================================================================ helpers ==
  _wireHooks() {
    this.stateMachine.onChange = (from, to, payload) => {
      this.bus?.emit("creature:state-changed", { from, to, reason: payload?.reason });
    };
  }

  _startState(next, duration, onEnd) {
    this._stateTimer = duration;
    this._onStateEnd = onEnd ?? null;
    this.stateMachine.force(next, { duration });
  }

  _beginFade(target, duration) {
    this._fadeTarget = target;
    this._fadeRate = (target - this.opacity) / Math.max(0.0001, duration);
  }

  _gotoIdleAfterAppear() {
    // depois de aparecer ela comeca a caminhar; quem orquestra (Behaviour)
    // decide a rota -- aqui apenas assume IDLE visivel como padrao neutro.
    this.idle();
  }

  _locomotionTrackFor(name) {
    return this.animator.has(name) ? name : "idle";
  }
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
const clamp01 = (v) => clamp(v, 0, 1);

function approach(current, target, delta) {
  if (current < target) return Math.min(target, current + delta);
  if (current > target) return Math.max(target, current - delta);
  return current;
}
