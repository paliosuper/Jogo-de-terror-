# FREQUENCY 17

Jogo 2D para navegador — atmosfera, exploração, iluminação, parallax e narrativa ambiental.
Sem dependências externas: HTML + CSS + JavaScript puro (Canvas 2D + WebAudio).

## ▶ Como rodar

Por segurança do navegador (carregamento de módulos/sprites locais), sirva via HTTP:

```bash
python3 -m http.server 8099
# abra http://localhost:8099
```

## 🎮 Controles

| Tecla | Ação |
|---|---|
| Setas / WASD | Mover |
| Shift | Correr |
| Espaço / E / Enter | Interagir / avançar diálogo |
| F3 | Debug (FPS, posição, sintonia) |

## 🗺 Estrutura

```
index.html          # layout, HUD, overlays (título, fade, diálogo, CRT)
css/style.css       # estética global (glitch de título, scanlines, vinheta)
assets/sprites/     # ← coloque aqui as ARTES REAIS (<nome>.png); placeholders cobrem ausências
assets/audio/       # reserved para áudio real futuro
js/core/            # utils, assets, input, camera, lighting, particles, parallax, audio, game
js/entities/        # player, npc, signal (fragmentos + terminais)
js/scenes/          # scene (classe base), title, tunnel, ruins, controlroom
```

## 🖼 Sistema de arte / placeholders

- `Assets.loadAll()` tenta carregar `assets/sprites/<nome>.png`.
- Se o arquivo não existir, um **placeholder procedural** é gerado em runtime no mesmo tamanho.
- Trocar por arte real = apenas soltar o `.png` na pasta. Nada mais muda.
- Variações visuais (tint, escala, rotação, alpha, flicker, flip) são feitas **por código**, não por arquivos novos.

## 🏗 Próximas etapas (aguardando prompts)

Sistema preparado para: mecânicas de sintonia expandidas, mais cenas/estados, save, puzzles de frequência, eventos narrativos (`scene.events`), áudio real.
