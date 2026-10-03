#!/usr/bin/env python3
"""
Gera a spritesheet PLACEHOLDER da criatura (FREQUENCY 17).

Layout: 6 colunas x 5 linhas, frames de 48x64 (288x320 no total).
  linha 0 : idle            (respiracao sutil; cabeca voltada para o jogador)
  linha 1 : walk             (passo normal, perna esquerda na frente -> direitas)
  linha 2 : slow_walk        (mesma base, pose "arrastada"/pes mais baixo)
  linha 3 : turn / look      (giro LENTO da cabeca: olhando p/ tras -> p/ frente)
  linha 4 : retreat          (recua: corpo levemente inclinado p/ tras, passo curto)

Figura: silhueta humanoide ESCURA (quase preta), magra e alta, olhos fracos.
Sem arquivos externos alem do Pillow -- arte provisoria ate a definitiva existir.
"""

from PIL import Image, ImageDraw

FW, FH = 48, 64
COLS, ROWS = 6, 5
W, H = FW * COLS, FH * ROWS

BODY = (14, 15, 20, 255)
BODY_DIM = (22, 24, 32, 255)
EYE = (196, 206, 214, 210)
BG = (0, 0, 0, 0)


def draw_figure(d, ox, oy, *, head_dx=0.0, head_dy=0.0, lean=0.0,
                leg_a=0.0, leg_b=0.0, arm_swing=0.0, breathe=0.0,
                dim=False, eyes=True):
    """Desenha a silhueta dentro do frame (ox,oy = canto do frame).

    head_dx/head_dy : deslocamento da cabeca (turn/look)
    lean            : inclinacao do tronco (+ p/ tras ao recuar)
    leg_a/leg_b     : fase das pernas (-1..1)
    arm_swing       : balanco dos bracos (-1..1)
    breathe         : expansao vertical sutil do torso (idle)
    """
    c = BODY_DIM if dim else BODY
    cx = ox + FW / 2 + lean * 3.0
    hip_y = oy + 44
    shoulder_y = oy + 22 - breathe * 1.5

    # pernas (linhas grossas escuras)
    for phase in (leg_a, leg_b):
        foot_x = cx + phase * 7.0
        foot_y = oy + 62 - abs(phase) * 1.5
        d.line([(cx - 2.5, hip_y), ((cx + foot_x) / 2, (hip_y + foot_y) / 2 + 2)], fill=c, width=5)
        d.line([((cx + foot_x) / 2, (hip_y + foot_y) / 2 + 2), (foot_x, foot_y)], fill=c, width=4)

    # torso alongado
    top_w, bot_w = 10.0, 7.0
    pts = [
        (cx - top_w / 2 + lean * 2, shoulder_y),
        (cx + top_w / 2 + lean * 2, shoulder_y),
        (cx + bot_w / 2, hip_y),
        (cx - bot_w / 2, hip_y),
    ]
    d.polygon(pts, fill=c)

    # bracos longos e finos (balanco oposto)
    for s in (-1, 1):
        ax = cx + s * (top_w / 2)
        hx = ax + s * 2 + arm_swing * s * 6
        hy = shoulder_y + 20
        d.line([(ax, shoulder_y + 2), (hx, hy)], fill=c, width=3)

    # cabeca oval, pequena, pescoco fino
    hxc = cx + head_dx * 6.0 + lean * 2.5
    hyc = oy + 13 + head_dy * 3.0
    d.line([(cx + lean * 2, shoulder_y), (hxc, hyc + 5)], fill=c, width=3)
    d.ellipse([hxc - 6, hyc - 7, hxc + 6, hyc + 7], fill=c)
    if eyes:
        ex = hxc + head_dx * 2.0
        d.ellipse([ex - 3.2, hyc - 1.5, ex - 1.2, hyc + 0.5], fill=EYE)
        d.ellipse([ex + 1.2, hyc - 1.5, ex + 3.2, hyc + 0.5], fill=EYE)


def main():
    img = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(img)

    import math

    # linha 0: idle -- respiracao sutil
    for i in range(COLS):
        breathe = 0.5 + 0.5 * math.sin(i / COLS * 2 * math.pi)
        draw_figure(d, i * FW, 0 * FH, breathe=breathe * 0.6, leg_a=0.12, leg_b=-0.12)

    # linha 1: walk -- ciclo de 6 frames (pernas em fases alternadas)
    for i in range(COLS):
        ph = math.cos(i / COLS * 2 * math.pi)
        sw = math.sin(i / COLS * 2 * math.pi)
        draw_figure(d, i * FW, 1 * FH, leg_a=ph, leg_b=-ph, arm_swing=sw * 0.7,
                    breathe=(i % 2) * 0.25)

    # linha 2: slow_walk -- mesmo ciclo, mas passos curtos e corpo "pesado"
    for i in range(COLS):
        ph = math.cos(i / COLS * 2 * math.pi) * 0.55
        draw_figure(d, i * FW, 2 * FH, leg_a=ph, leg_b=-ph, lean=-0.25,
                    head_dy=0.5, breathe=(i % 2) * 0.15, dim=True)

    # linha 3: turn/look -- cabeca gira lentamente de tras (-1) ate frente (+1)
    for i in range(COLS):
        t = -1 + 2 * (i / (COLS - 1))
        draw_figure(d, i * FW, 3 * FH, head_dx=t, leg_a=0.12, leg_b=-0.12,
                    eyes=(t > -0.4))

    # linha 4: retreat -- recua: tronco inclinado p/ tras, passos curtos
    for i in range(COLS):
        ph = math.cos(i / COLS * 2 * math.pi) * 0.5
        draw_figure(d, i * FW, 4 * FH, leg_a=ph, leg_b=-ph, lean=0.8,
                    head_dx=-0.3, arm_swing=-0.4, dim=True)

    out = "assets/creature/creature_placeholder.png"
    img.save(out)
    print(f"gerado: {out} ({W}x{H})")


if __name__ == "__main__":
    main()
