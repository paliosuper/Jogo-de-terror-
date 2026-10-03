/**
 * CreatureBehaviour -- orquestra os TIMINGS de terror da criatura.
 *
 * Este modulo e o unico que "conta a historia corporal" da criatura:
 *   firstAppearance(): caminha ao fundo -> para -> vira a cabeca lentamente ->
 *   olha diretamente para o jogador (ai, SÓ entao, disparam os efeitos:
 *   velocidade 70%, tremor pequeno de camera, vinheta) -> ~1s depois desaparece
 *   e o jogador volta à velocidade normal.
 *
 * A criatura NAO ataca; nao ha chase/combate. O behaviour so usa a API publica
 * do Player (setMovementMultiplier / scare) e do Atmosphere (shake/vinheta) --
 * nada de mexer em variaveis internas alheias.
 *
 * AmbientIdle(): enquanto nao ha cena dirigida, ela anda de um lado para o
 * outro ao fundo, as vezes devagar, recua se o jogador chegar perto demais,
 * e some se o jogador se afastar muito.
 */

import { CreatureState } from "./CreatureStateMachine.js";
import { CREATURE_CONFIG } from "./config.js";

const FEAR_TAG = "creature-look"; // tag no SpeedSystem do jogador

export class CreatureBehaviour {
  /**
   * @param {{
   *   creature: import("./Creature.js").Creature,
   *   player: import("../player/Player.js").Player,
   *   atmosphere?: import("../atmosphere/AtmosphereDirector.js").AtmosphereDirector,
   *   bus?: import("../core/EventBus.js").EventBus,
   *   config?: object,
   *   rng?: () => number,
   * }} deps
   */
  constructor(deps) {
    this.creature = deps.creature;
    this.player = deps.player;
    this.atmosphere = deps.atmosphere ?? null;
    this.bus = deps.bus ?? null;
    this.config = deps.config ?? CREATURE_CONFIG;
    this.rng = deps.rng ?? Math.random;

    this._sceneRunning = false; // uma cena dirigida esta em andamento
    this._idleTimer = 0;
    /** @type {Array<(dt:number)=>void>} timers de "delay" das cenas */
    this._ticks = [];
    this._cancellable = []; // canceladores de timers/listeners pendentes

    // quando um roteiro termina (onStateEnd), devolve o controle ao idle
    const sm = this.creature.stateMachine;
    sm.onChange = wrapChain(sm.onChange, (from, to) => {
      if (to === CreatureState.IDLE && !this._sceneRunning && this._idleTimer <= 0) {
        const [lo, hi] = this.config.awareness.idlePauseRange;
        this._idleTimer = lo + this.rng() * (hi - lo);
      }
    });
  }

  get busy() {
    return this._sceneRunning;
  }

  cancelPending() {
    for (const off of this._cancellable) off();
    this._cancellable = [];
    this._ticks.length = 0;
  }

  _delay(seconds, fn) {
    let remaining = seconds;
    const tick = (dt) => {
      remaining -= dt;
      if (remaining <= 0) {
        this._removeTick(tick);
        fn();
      }
    };
    this._ticks.push(tick);
    this._cancellable.push(() => this._removeTick(tick));
  }

  _removeTick(tick) {
    const i = this._ticks.indexOf(tick);
    if (i >= 0) this._ticks.splice(i, 1);
  }

  // ===================================================== PRIMEIRA APARIÇÃO ==
  /**
   * Roteiro completo da primeira aparição (independente de arte final).
   * @param {{x:number,y:number, angle?:number}} spawn ponto AO FUNDO do cenario
   * @param {{onEnd?: Function}} [opts]
   */
  firstAppearance(spawn, opts = {}) {
    if (this._sceneRunning) return false;
    this._sceneRunning = true;
    const cfg = this.config.firstAppearance;
    const c = this.creature;
    const p = this.player;

    const finish = () => {
      this._sceneRunning = false;
      this._releaseFear();
      opts.onEnd?.();
    };

    // 1) aparece lentamente NO CENARIO (nao e imagem de jumpscare) -----------
    c.appear({ x: spawn.x, y: spawn.y, angle: spawn.angle ?? 0, track: "walk" });

    // A APARICAO NAO BLOQUEIA a cena: enquanto ela ancora em silencio, os
    // timers abaixo continuam correndo. Cada passo confere se ela ainda esta
    // visivel -- se nao estiver, espera ate virar (nunca "perde" o roteiro).
    const gateVisible = (fn) => {
      let waited = 0;
      const tick = (dt) => {
        if (c.visible || !this._sceneRunning) {
          this._removeTick(tick);
          fn();
        } else {
          waited += dt;
          if (waited > 8) {
            this._removeTick(tick);
            fn(); // rede de seguranca: nunca travar a cena por causa de fade
          }
        }
      };
      this._ticks.push(tick);
      this._cancellable.push(() => this._removeTick(tick));
    };

    // 1) aparece lentamente NO CENARIO ---------------------------------------
    gateVisible(() => {
      // 2) caminha ao fundo ----------------------------------------------------
      c.walk(c.bodyAngle, { duration: cfg.walkDuration });

      // 3) ela PARA ------------------------------------------------------------
      this._delay(cfg.walkDuration, () =>
        gateVisible(() => {
          c.stop({
            onEnd: () => {
              // 4) VIRA LENTAMENTE a cabeca para o jogador ---------------------
              c.turnHead(p.position, {
                duration: cfg.turnDuration,
                onEnd: () => {
                  // 5) OLHA diretamente para o jogador -------------------------
                  c.lookAt(p.position, {
                    duration: cfg.lookDuration + cfg.vanishDelay,
                    onEnd: () => {
                      // 7) desaparece e libera o jogador -----------------------
                      c.disappear({ duration: this.config.fade.disappearDuration });
                      this._delay(this.config.fade.disappearDuration + 0.1, finish);
                    },
                  });

                  // 6) NESSE momento (e somente nesse): efeitos de medo --------
                  this._applyFear(cfg);
                },
              });
            },
          });
        })
      );
    });

    this.bus?.emit("creature:scene-started", { scene: "first-appearance" });
    return true;
  }

  _applyFear(cfg) {
    const p = this.player;
    // velocidade reduzida p/ ~70% via API publica (tag p/ restaurar depois)
    p.speed.pushMultiplier(cfg.playerSpeedMultiplier, { tag: FEAR_TAG });
    // pequena vibracao de camera + bordas levemente escuras (via Atmosphere)
    this.atmosphere?.cameraShake?.play({
      amplitude: cfg.shakeAmplitude,
      frequency: cfg.shakeFrequency,
      duration: cfg.lookDuration + 0.4,
      reason: "creature-look",
    });
    this.atmosphere?.vignette?.pulse({
      target: cfg.vignetteStrength,
      fadeIn: 0.35,
      hold: cfg.lookDuration,
      fadeOut: 0.8,
      reason: "creature-look",
    });
    this.bus?.emit("creature:looking-at-player", { strength: cfg.vignetteStrength });
  }

  _releaseFear() {
    this.player?.speed.removeMultiplier(FEAR_TAG);
    this.bus?.emit("creature:released-player", {});
  }

  // ============================================================ IDLE AMBIENT ==
  /**
   * Comportamento ocioso usado quando nenhuma cena dirigida esta rodando:
   * anda de la para ca ao fundo, alterna normal/lento, recua se o jogador
   * aproxima demais, some se o jogador se afasta demais.
   */
  updateAmbient(dt) {
    // Os timers/delays/gates da cena SEMPRE rodam (inclusive durante uma
    // cena dirigida) -- antes eles congelavam atras do early-return e a
    // coreografia podia nunca terminar.
    for (const tick of [...this._ticks]) tick(dt);

    if (this._sceneRunning) return;
    const c = this.creature;

    if (!c.visible) return;

    const dist = Math.hypot(c.position.x - this.player.position.x, c.position.y - this.player.position.y);
    const aw = this.config.awareness;

    // jogador chegou perto demais -> recua mantendo o olhar
    if (dist < aw.personalSpaceRadius && !c.is(CreatureState.RETREAT)) {
      c.retreat(this.player.position, {
        duration: 1.4,
        onEnd: () => this._pickAmbientAction(),
      });
      return;
    }

    // jogador foi embora -> perde interesse e desaparece
    if (dist > aw.interestRadius && !c.is(CreatureState.DISAPPEAR)) {
      c.disappear();
      return;
    }

    // estados "ocupados" deixam o roteiro seguir sozinho
    if (
      c.any([
        CreatureState.APPEAR,
        CreatureState.STOP,
        CreatureState.TURN,
        CreatureState.LOOK,
        CreatureState.RETREAT,
        CreatureState.DISAPPEAR,
      ])
    ) {
      return;
    }

    // WALK/SLOW_WALK/IDLE: duracoes Infinity sao mantidas por este timer;
    // quando ele expira, trocamos de acao (andar <-> pausar).
    this._idleTimer -= dt;
    if (this._idleTimer <= 0) {
      this._pickAmbientAction();
    }
  }

  _pickAmbientAction() {
    const c = this.creature;
    const r = this.rng();
    const [lo, hi] = this.config.awareness.idlePauseRange;
    const moveAngle = c.bodyAngle + (r < 0.5 ? Math.PI : 0) + (r - 0.5) * 0.6;

    if (c.is(CreatureState.IDLE)) {
      // saiu da pausa: volta a andar (80% normal, 20% lento) -- sem duracao
      // fixa; o proprio _idleTimer decide quando ela para de novo.
      if (this.rng() < 0.8) c.walk(moveAngle);
      else c.slowWalk(moveAngle);
      this._idleTimer = 4 + this.rng() * 5;
    } else {
      // estava andando: pausa e observa
      c.idle();
      this._idleTimer = lo + this.rng() * (hi - lo);
    }
  }
}

/** Encadeia callbacks preservando um handler anterior (sem sobrescrever). */
function wrapChain(prev, next) {
  if (!prev) return next;
  return (...args) => {
    prev(...args);
    next(...args);
  };
}
