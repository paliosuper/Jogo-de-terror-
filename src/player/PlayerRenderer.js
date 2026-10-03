/**
 * PlayerRenderer -- camada de apresentacao do jogador (Pixi v8).
 *
 * Mantem UMA TextureSource para a spritesheet e um Sprite recortado; troca o
 * recorte conforme AnimationLibrary + SpriteAnimator. Se a imagem nao existir
 * (arte ainda nao produzida), cai automaticamente em um placeholder desenhado
 * por codigo (retangulo com "olhos" indicando a direcao) -- o jogo nunca quebra
 * por falta de arte.
 *
 * Este modulo e a UNICA parte do sistema do jogador que importa pixi.js.
 */

import { PLAYER_CONFIG } from "./config.js";

let _pixiCache = null;
async function loadPixi() {
  if (!_pixiCache) _pixiCache = await import("pixi.js");
  return _pixiCache;
}

export class PlayerRenderer {
  /** @param {{player: import("./Player.js").Player, animations: AnimationLibrary}} deps */
  constructor(deps) {
    this.player = deps.player;
    this.animations = deps.animations;
    this.container = null; // ancorado na camera
    this._pixi = null;
    this._texture = null;
    this._sprite = null;
    this._fallbackGfx = null;
    this._debugGfx = null;
    this._failed = false;
  }

  /** Carrega a folha; retorna false se estiver usando placeholder. */
  async init(app) {
    const PIXI = await loadPixi();
    this._pixi = PIXI;
    this.container = new PIXI.Container();
    app.stage.addChild(this.container);

    const url = PLAYER_CONFIG.sheet.url;
    try {
      const source = new PIXI.TextureSource({
        resource: { url },
        scaleMode: "nearest", // pixel-art sem borrado
      });
      await source.load();
      this._texture = new PIXI.Texture({ source });
      this._sprite = new PIXI.Sprite({
        texture: this._texture,
        anchor: 0.5,
        width: PLAYER_CONFIG.sheet.frameWidth,
        height: PLAYER_CONFIG.sheet.frameHeight,
      });
      this.container.addChild(this._sprite);
      console.info(`[PlayerRenderer] spritesheet carregada: ${url}`);
    } catch (err) {
      console.warn(
        `[PlayerRenderer] "${url}" indisponivel -> usando placeholder vetorial.`,
        err?.message ?? err
      );
      this._failed = true;
      this._fallbackGfx = new PIXI.Graphics();
      this.container.addChild(this._fallbackGfx);
    }

    if (PLAYER_CONFIG.dev.showCollider || PLAYER_CONFIG.dev.showFacingVector) {
      this._debugGfx = new PIXI.Graphics();
      this.container.addChild(this._debugGfx);
    }
    return !this._failed;
  }

  /** Chame a cada frame apos player.update(dt). */
  render(dt) {
    if (!this._pixi || !this.container) return; // init() ainda nao rodou / ambiente sem WebGL
    const p = this.player;
    // posicao do container no espaco da tela (camera aplicada aqui)
    const cam = p.camera;
    const off = cam ? cam.offset : { x: 0, y: 0 };
    this.container.position.set(p.position.x + off.x, p.position.y + off.y);

    const rect = p.advanceAnimation(dt); // {x,y,w,h} dentro da folha
    if (this._sprite && this._texture) {
      // recorte real na spritesheet (linhas = direcao, colunas = frames)
      this._sprite.texture.frame.copyTo
        ? this._sprite.texture.frame.set(rect.x, rect.y, rect.w, rect.h)
        : null;
      this._sprite.texture.source?.onTextureUpdate?.();
    } else if (this._fallbackGfx) {
      this._drawFallback();
    }

    if (this._debugGfx) this._drawDebug();
  }

  _drawFallback() {
    const g = this._fallbackGfx;
    const size = PLAYER_CONFIG.sheet.frameHeight;
    g.clear();
    // corpo
    g.rect(-size / 2, -size / 2, size, size).fill({ color: 0x466ea5 });
    g.rect(-size / 2, -size / 2, size, size).stroke({ color: 0x16181e, width: 3 });
    // "visor" indicando a direcao atual
    const dir = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[this.player.facing];
    g.circle(dir[0] * size * 0.28, dir[1] * size * 0.28, size * 0.14).fill({ color: 0xf0e6d2 });
  }

  _drawDebug() {
    const g = this._debugGfx;
    const p = this.player;
    const cam = p.camera;
    const off = cam ? cam.offset : { x: 0, y: 0 };
    // debug desenha em coordenadas de mundo (compensando a camera)
    g.clear();
    if (PLAYER_CONFIG.dev.showCollider) {
      const b = p.colliderBox;
      g.rect(b.x - b.w / 2 + off.x, b.y - b.h / 2 + off.y, b.w, b.h).stroke({
        color: 0xff3860,
        width: 1,
      });
    }
    if (PLAYER_CONFIG.dev.showFacingVector) {
      g.moveTo(p.position.x + off.x, p.position.y + off.y);
      const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[p.facing];
      g.lineTo(p.position.x + d[0] * 40 + off.x, p.position.y + d[1] * 40 + off.y).stroke({
        color: 0x38ff9a,
        width: 2,
      });
    }
  }

  destroy() {
    this.container?.destroy({ children: true });
    this.container = null;
    this._sprite = null;
    this._texture = null;
    this._fallbackGfx = null;
    this._debugGfx = null;
  }
}
