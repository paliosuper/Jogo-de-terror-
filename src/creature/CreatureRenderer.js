/**
 * CreatureRenderer -- camada de apresentacao da criatura (Pixi v8).
 *
 * Igual ao PlayerRenderer: recorta a spritesheet via CreatureAnimator e,
 * se a arte nao existir, desenha um placeholder humanoide ESCURO por codigo
 * (silhueta cabeca+corpo), com opacidade controlada pela criatura.
 *
 * A posicao Y do mundo e tratada como profundidade: quem renderiza deve
 * inserir este container ATRAS da camada de arvores proximas -- o renderer
 * nao conhece o mapa.
 */

import { CREATURE_CONFIG } from "./config.js";

let _pixiCache = null;
async function loadPixi() {
  if (!_pixiCache) _pixiCache = await import("pixi.js");
  return _pixiCache;
}

export class CreatureRenderer {
  /** @param {{creature: import("./Creature.js").Creature, animator: import("./CreatureAnimator.js").CreatureAnimator}} deps */
  constructor(deps) {
    this.creature = deps.creature;
    this.animator = deps.animator;
    this.container = null;
    this._pixi = null;
    this._sprite = null;
    this._fallbackGfx = null;
    this._failed = false;
  }

  async init(app) {
    const PIXI = await loadPixi();
    this._pixi = PIXI;
    this.container = new PIXI.Container();
    app.stage.addChild(this.container);

    const sheet = CREATURE_CONFIG.sheet;
    try {
      const source = new PIXI.TextureSource({
        resource: { url: sheet.url },
        scaleMode: "nearest",
      });
      await source.load();
      const texture = new PIXI.Texture({ source });
      this._sprite = new PIXI.Sprite({
        texture,
        anchor: 0.5,
        width: sheet.frameWidth,
        height: sheet.frameHeight,
      });
      this.container.addChild(this._sprite);
    } catch (err) {
      console.warn(`[CreatureRenderer] "${sheet.url}" indisponivel -> placeholder vetorial.`, err?.message ?? err);
      this._failed = true;
      this._fallbackGfx = new PIXI.Graphics();
      this.container.addChild(this._fallbackGfx);
    }
    return !this._failed;
  }

  /** Chame 1x por frame apos creature.update(dt). */
  render() {
    if (!this._pixi || !this.container) return;
    const c = this.creature;

    // fora de cena: some sem depender do estado HIDDEN (fade interno manda)
    this.container.visible = c.opacity > 0.001;
    if (!this.container.visible) return;

    this.container.position.set(c.position.x, c.position.y);
    this.container.alpha = c.opacity * CREATURE_CONFIG.fade.idleOpacity;

    // espelha conforme para onde o CORPO aponta (virar simples, sem flipY)
    const facingLeft = Math.cos(c.bodyAngle) < 0;
    if (this._sprite) {
      this._sprite.scale.x = facingLeft ? -Math.abs(this._sprite.scale.x) || -1 : Math.abs(this._sprite.scale.x) || 1;
      const rect = this.animator.currentRect();
      this._sprite.texture.frame.set?.(rect.x, rect.y, rect.w, rect.h);
    } else if (this._fallbackGfx) {
      this._drawFallback(facingLeft);
    }
  }

  _drawFallback(facingLeft) {
    const g = this._fallbackGfx;
    const fw = CREATURE_CONFIG.sheet.frameWidth;
    const fh = CREATURE_CONFIG.sheet.frameHeight;
    g.clear();
    const dirX = facingLeft ? -1 : 1;
    // corpo (silhueta escura alongada)
    g.roundRect(-fw * 0.28, -fh * 0.72, fw * 0.56, fh * 0.72, 6).fill({ color: 0x0a0d10 });
    // cabeca; o "olhar" acompanha headTurn (giro lento da cabeca)
    const turn = this.creature.headTurn; // 0..1
    const headX = dirX * fw * (0.02 + 0.1 * turn);
    g.circle(headX, -fh * 0.8, fw * 0.16).fill({ color: 0x0a0d10 });
    // olhos apenas quando ela esta OLHANDO (terror sutil, nao jumpscare)
    if (turn > 0.9 && this.creature.is("LOOK")) {
      g.circle(headX + dirX * 3, -fh * 0.82, 1.4).fill({ color: 0xcfd6cf, alpha: 0.85 });
      g.circle(headX - dirX * 3, -fh * 0.82, 1.4).fill({ color: 0xcfd6cf, alpha: 0.85 });
    }
  }

  destroy() {
    this.container?.destroy({ children: true });
    this.container = null;
    this._sprite = null;
    this._fallbackGfx = null;
  }
}
