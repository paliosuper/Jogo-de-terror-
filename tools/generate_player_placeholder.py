#!/usr/bin/env python3
"""Gera a spritesheet placeholder do jogador (4 direcoes x 6 frames, 64x64).

Arte provisoria desenhada por codigo -- substitua por arte real mantendo o
mesmo layout (linhas = DOWN, LEFT, RIGHT, UP; colunas = frames) e atualize
`src/player/config.js` se as dimensoes mudarem.

Uso:
    python3 tools/generate_player_placeholder.py [saida.png]
Tambem escreve o JSON de metadados ao lado (<saida>.json), usado pelo
AnimationLibrary para montar as animacoes sem "atlas" externo.
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw

# ---------------------------------------------------------------- config -----
FRAME = 64
COLS = 6                      # frames por linha (animacao)
ROWS = 4                      # direcoes
W, H = FRAME * COLS, FRAME * ROWS

ROW_DOWN, ROW_LEFT, ROW_RIGHT, ROW_UP = 0, 1, 2, 3

SKIN = (232, 190, 154)
SKIN_SHADE = (208, 164, 128)
HAIR = (60, 42, 30)
SHIRT = (70, 110, 165)
SHIRT_DARK = (52, 86, 132)
PANTS = (48, 52, 60)
SHOE = (28, 28, 32)
EYE = (28, 28, 32)
OUTLINE = (22, 24, 30)

DOWN_FRAMES = [(0, 0), (1, 0), (0, 0), (-1, 0), (0, 0), (0, 1)]
UP_FRAMES = [(0, 0), (1, 0), (0, 0), (-1, 0), (0, 0), (0, -1)]


# ------------------------------------------------------------- primitives ----
def ellipse(d, box, fill, outline=None):
    d.ellipse(box, fill=fill, outline=outline)


def limb(d, x, y_top, length, width, color):
    """Braco/perna vertical com sombra interna."""
    d.rounded_rectangle([x, y_top, x + width, y_top + length], radius=width // 2,
                        fill=color, outline=OUTLINE)


def shoe(d, cx, y, dx, color=SHOE):
    d.rounded_rectangle([cx - 6 + dx, y, cx + 6 + dx, y + 7], radius=3,
                        fill=color, outline=OUTLINE)


def head(d, cx, cy, facing, bob=0):
    cy += bob
    # cabeca
    ellipse(d, [cx - 12, cy - 12, cx + 12, cy + 12], SKIN, OUTLINE)
    # cabelo (coroa)
    d.pieslice([cx - 12, cy - 13, cx + 12, cy + 11], 180, 360, fill=HAIR, outline=OUTLINE)
    if facing == "down":
        ellipse(d, [cx - 12, cy - 13, cx + 12, cy - 1], HAIR, OUTLINE)   # franja
        for ex in (-5, 5):                                               # olhos
            ellipse(d, [cx + ex - 2, cy + 1, cx + ex + 2, cy + 5], EYE)
    elif facing == "up":
        ellipse(d, [cx - 12, cy - 12, cx + 12, cy + 6], HAIR, OUTLINE)   # nuca
    else:
        side = 1 if facing == "right" else -1
        ellipse(d, [cx - 12, cy - 13, cx + 12, cy - 1], HAIR, OUTLINE)
        ellipse(d, [cx - 12, cy - 6, cx + 12, cy + 8], HAIR, OUTLINE)
        ellipse(d, [cx + side * 5 - 2, cy + 1, cx + side * 5 + 2, cy + 5], EYE)
        ellipse(d, [cx + side * 10 - 2, cy + 0, cx + side * 10 + 3, cy + 6], SKIN_SHADE)  # nariz


def torso(d, cx, top, bottom, width, color):
    d.rounded_rectangle([cx - width, top, cx + width, bottom], radius=4,
                        fill=color, outline=OUTLINE)


# ---------------------------------------------------------------- frames -----
def draw_idle(d, ox, oy, facing):
    cx = ox + 32
    body_bob = 0
    head(d, cx, oy + 18, facing, body_bob)
    torso(d, cx, oy + 28, oy + 44, 11, SHIRT)
    if facing in ("down", "up"):
        limb(d, cx - 16, oy + 29, 14, 5, SHIRT_DARK)
        limb(d, cx + 11, oy + 29, 14, 5, SHIRT_DARK)
        limb(d, cx - 8, oy + 44, 12, 6, PANTS)
        limb(d, cx + 2, oy + 44, 12, 6, PANTS)
        shoe(d, cx - 5, oy + 55, 0)
        shoe(d, cx + 5, oy + 55, 0)
    else:
        limb(d, cx - 3, oy + 29, 14, 5, SHIRT_DARK)
        limb(d, cx - 4, oy + 44, 12, 8, PANTS)
        shoe(d, cx, oy + 55, 0)
        # braco visivel a frente
        limb(d, cx + (3 if facing == "right" else -8), oy + 29, 14, 5, SHIRT_DARK)


def draw_walk(d, ox, oy, facing, phase):
    """phase: -1 | 0 | 1 (balanco das pernas) */"""
    cx = ox + 32
    swing = phase * 4
    head(d, cx, oy + 18, facing, -abs(phase))
    torso(d, cx, oy + 28, oy + 44, 11, SHIRT)
    if facing in ("down", "up"):
        limb(d, cx - 16, oy + 29, 13, 5, SHIRT_DARK)
        limb(d, cx + 11, oy + 29, 13, 5, SHIRT_DARK)
        limb(d, cx - 8 - swing, oy + 44, 12, 6, PANTS)
        limb(d, cx + 2 + swing, oy + 44, 12, 6, PANTS)
        shoe(d, cx - 5 - swing, oy + 55, 0)
        shoe(d, cx + 5 + swing, oy + 55, 0)
    else:
        limb(d, cx - 3, oy + 29, 13, 5, SHIRT_DARK)
        limb(d, cx - 4 - swing, oy + 44, 12, 8, PANTS)
        shoe(d, cx - swing, oy + 55, 0)
        limb(d, cx + 3, oy + 29, 13, 5, SHIRT_DARK)


def draw_run(d, ox, oy, facing, phase):
    cx = ox + 32
    swing = phase * 6
    lean = 2 if facing in ("down", "up") else (2 if facing == "right" else -2)
    head(d, cx + lean, oy + 18, facing, -abs(phase) - 1)
    torso(d, cx + lean, oy + 28, oy + 44, 11, SHIRT)
    if facing in ("down", "up"):
        limb(d, cx - 16 + lean, oy + 28, 12, 5, SHIRT_DARK)
        limb(d, cx + 11 + lean, oy + 28, 12, 5, SHIRT_DARK)
        limb(d, cx - 8 - swing, oy + 44, 12, 6, PANTS)
        limb(d, cx + 2 + swing, oy + 44, 12, 6, PANTS)
        shoe(d, cx - 5 - swing, oy + 55, 0)
        shoe(d, cx + 5 + swing, oy + 55, 0)
    else:
        limb(d, cx + lean - 3, oy + 28, 12, 5, SHIRT_DARK)
        limb(d, cx - 4 - swing, oy + 44, 12, 8, PANTS)
        shoe(d, cx - swing, oy + 55, 0)
        limb(d, cx + lean + 3, oy + 28, 12, 5, SHIRT_DARK)


def draw_interact(d, ox, oy, facing, t):
    """t em 0..1 -- braco levanta e acena."""
    cx = ox + 32
    arm = int(round(math.sin(t * math.pi) * 10))
    head(d, cx, oy + 18 - (2 if t > 0.5 else 0), facing)
    torso(d, cx, oy + 28, oy + 44, 11, SHIRT)
    limb(d, cx - 16, oy + 29, 14, 5, SHIRT_DARK)
    # braco levantado
    d.rounded_rectangle([cx + 11, oy + 29 - arm, cx + 16, oy + 43 - arm],
                        radius=2, fill=SHIRT_DARK, outline=OUTLINE)
    ellipse(d, [cx + 10, oy + 25 - arm, cx + 17, oy + 32 - arm], SKIN, OUTLINE)
    limb(d, cx - 8, oy + 44, 12, 6, PANTS)
    limb(d, cx + 2, oy + 44, 12, 6, PANTS)
    shoe(d, cx - 5, oy + 55, 0)
    shoe(d, cx + 5, oy + 55, 0)


def draw_scared(d, ox, oy, facing, t):
    """Trema lateral + bracos na cabeca + boca aberta."""
    cx = ox + 32 + int(round(math.sin(t * math.pi * 4) * 2))
    head(d, cx, oy + 17, facing)
    ellipse(d, [cx - 4, oy + 20, cx + 4, oy + 26], (90, 30, 30))  # boca aberta
    torso(d, cx, oy + 28, oy + 44, 11, SHIRT)
    limb(d, cx - 8, oy + 44, 12, 6, PANTS)
    limb(d, cx + 2, oy + 44, 12, 6, PANTS)
    shoe(d, cx - 5, oy + 55, 0)
    shoe(d, cx + 5, oy + 55, 0)
    # bracos erguidos
    for sx in (cx - 17, cx + 11):
        d.rounded_rectangle([sx, oy + 14, sx + 5, oy + 30], radius=2,
                            fill=SHIRT_DARK, outline=OUTLINE)


def draw_stunned(d, ox, oy, t):
    """De joelhos, olhos em X, estrelas girando."""
    cx = ox + 32
    droop = int(round(2 + t * 2))
    ellipse(d, [cx - 12, oy + 20 + droop, cx + 12, oy + 44 + droop], SHIRT, OUTLINE)  # corpo caido
    ellipse(d, [cx - 12, oy + 8 + droop, cx + 12, oy + 32 + droop], SKIN, OUTLINE)    # cabeca
    d.pieslice([cx - 12, oy + 7 + droop, cx + 12, oy + 29 + droop], 180, 360, fill=HAIR, outline=OUTLINE)
    for ex in (-5, 5):  # olhos em X
        x = cx + ex
        y = oy + 20 + droop
        d.line([x - 2, y - 2, x + 2, y + 2], fill=EYE, width=2)
        d.line([x - 2, y + 2, x + 2, y - 2], fill=EYE, width=2)
    # pernas dobradas
    d.rounded_rectangle([cx - 10, oy + 44 + droop, cx + 10, oy + 52 + droop], radius=4,
                        fill=PANTS, outline=OUTLINE)
    # estrelas
    ang = t * math.pi * 2
    for i in range(3):
        a = ang + i * 2 * math.pi / 3
        sx = cx + int(round(16 * math.cos(a)))
        sy = oy + 10 + int(round(5 * math.sin(a)))
        r = 3
        d.polygon([(sx, sy - r), (sx + r, sy), (sx, sy + r), (sx - r, sy)],
                  fill=(250, 215, 90), outline=OUTLINE)


# ---------------------------------------------------------------- render -----
def build():
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    anims = {
        "idle_down": lambda dd, ox, oy, t: draw_idle(dd, ox, oy, "down"),
        "idle_left": lambda dd, ox, oy, t: draw_idle(dd, ox, oy, "left"),
        "idle_right": lambda dd, ox, oy, t: draw_idle(dd, ox, oy, "right"),
        "idle_up": lambda dd, ox, oy, t: draw_idle(dd, ox, oy, "up"),
        "walk_down": lambda dd, ox, oy, t: draw_walk(dd, ox, oy, "down", DOWN_FRAMES[t][0]),
        "walk_left": lambda dd, ox, oy, t: draw_walk(dd, ox, oy, "left", t % 2 and 1 or -1),
        "walk_right": lambda dd, ox, oy, t: draw_walk(dd, ox, oy, "right", t % 2 and 1 or -1),
        "walk_up": lambda dd, ox, oy, t: draw_walk(dd, ox, oy, "up", UP_FRAMES[t][0]),
        "run_down": lambda dd, ox, oy, t: draw_run(dd, ox, oy, "down", DOWN_FRAMES[t][0]),
        "run_left": lambda dd, ox, oy, t: draw_run(dd, ox, oy, "left", t % 2 and 1 or -1),
        "run_right": lambda dd, ox, oy, t: draw_run(dd, ox, oy, "right", t % 2 and 1 or -1),
        "run_up": lambda dd, ox, oy, t: draw_run(dd, ox, oy, "up", UP_FRAMES[t][0]),
        "interact": lambda dd, ox, oy, t: draw_interact(dd, ox, oy, "down", t / (COLS - 1)),
        "scared": lambda dd, ox, oy, t: draw_scared(dd, ox, oy, "down", t / (COLS - 1)),
        "stunned": lambda dd, ox, oy, t: draw_stunned(dd, ox, oy, t / (COLS - 1)),
    }
    row_of = {"down": ROW_DOWN, "left": ROW_LEFT, "right": ROW_RIGHT, "up": ROW_UP}
    placed = {}
    for name, fn in anims.items():
        parts = name.split("_")
        if len(parts) == 2:
            row, base = row_of[parts[1]], parts[0]
        else:
            row, base = ROW_DOWN, parts[0]
        for f in range(COLS):
            ox, oy = f * FRAME, row * FRAME
            # fundo transparente + borda guia sutil do frame (placeholder)
            fn(d, ox, oy, f)
        placed[name] = {"row": row, "frames": COLS}
    return img, placed


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "assets/player/player_placeholder.png"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img, placed = build()
    img.save(out)
    meta = {
        "image": os.path.basename(out),
        "frameWidth": FRAME,
        "frameHeight": FRAME,
        "columns": COLS,
        "rows": ROWS,
        "directionRowOrder": ["down", "left", "right", "up"],
        "animations": {k: v["frames"] for k, v in placed.items()},
    }
    with open(os.path.splitext(out)[0] + ".json", "w", encoding="utf-8") as fp:
        json.dump(meta, fp, indent=2)
    print(f"[placeholder] {out} ({W}x{H}) + {os.path.splitext(out)[0]}.json")


if __name__ == "__main__":
    main()
