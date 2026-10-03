# FREQUENCY 17 — Plano de Desenvolvimento

Documento de contexto e organização. O Qwen é o responsável principal pelo código.
Este documento serve apenas para manter consistência e servir de checklist.

Regra absoluta: **MECÂNICAS FUNCIONANDO > ARTE.**
Toda arte nesta fase é placeholder (quadrados, retângulos, cores, formas geradas por código).
A arquitetura deve permitir trocar placeholders por spritesheets depois, sem reescrever mecânicas.

---

## Papéis

- **Qwen**: implementa o código. Não interromper, não cancelar tarefas em andamento, não pedir reescrita do projeto.
- **Buffy (assista)**: fornecer contexto, organização, verificar se o sistema entregue funciona, corrigir bugs pequenos, preparar a próxima etapa.
- Antes de qualquer modificação: analisar o código existente e preservar funcionalidades.
- Bug pequeno → corrigir. Sistema funcionando e fora do escopo da tarefa → não tocar.

---

## Stack e convenções

- Jogo 2D para navegador (Vite + TypeScript do template Freebuff; canvas é suficiente para a fase 1).
- Nenhuma dependência nova sem necessidade.
- Sem áudio nesta fase — o sistema de rádio deve ser **modular e pronto para áudio futuro**.
- Nenhum asset final de arte agora.

### Arquitetura mínima sugerida (ajustar ao que o Qwen já criar)

```
src/game/
  core/       loop, entrada (WASD/setas/E), util
  player/     movimento, colisão, estados, camera
  world/      torre (blocos reutilizáveis), escadas, área externa
  parallax/   camadas (céu, lua/estrelas, montanhas, florestas, árvores, foreground)
  radio/      sistema visual de transmissão (preparado para áudio)
  creature/   comportamento da criatura (sem combate)
  interact/   sistema genérico de interação (registry de objetos)
  narrative/  mensagens, pistas, fotografias, finais, créditos
  fx/         tremor de câmera, fade, vinheta, escurecimento de bordas
```

### Convenções de jogador

- Estados: `IDLE`, `WALK`, `RUN`, `INTERACT`, `SCARED`, `STUNNED`.
- `player.setMovementMultiplier(0.7)` para reduções temporárias de velocidade (nunca bloquear controles por completo).
- Câmera: segue jogador, tremor pequeno (só quando necessário), suporte a zoom/fade futuros.
- Sprites: desenho por cima de uma interface de render trocável, para aceitar spritesheets depois.

### Convenções de interação

- Sistema **genérico**: um registro/interface de "interagíveis" com `canInteract()` / `onInteract()`.
- Nunca código separado por objeto. Caixa, rádio, porta, chave, foto, mensagem usam o mesmo fluxo (tecla E).

---

## Etapas e critérios de "pronto"

### ETAPA 1 — Jogador
- [x] Movimento WASD/setas + colisão
- [x] Direção, idle, caminhada, corrida
- [x] Interação básica (E)
- [x] Câmera acompanhando
- [x] Estados + `setMovementMultiplier`
- **Verificação**: entrar no jogo, andar, colidir com paredes, câmera segue, E detecta um objeto de teste.

### ETAPA 2 — Mundo e abertura
- [x] Torre com blocos reutilizáveis (escadas, portas, janelas, corredores, sala de manutenção, sala do rádio)
- [x] Área externa + parallax (7 camadas com velocidades diferentes; reutilizáveis pelas janelas)
- [x] Abertura: sobe escadas → tropeça → caixa cai e para alguns degraus abaixo → controle volta
- [x] Pegar caixa → etiqueta FREQUENCY 17 → rádio liga sozinho
- [x] Mensagens visuais: `RADIO SIGNAL DETECTED` / `FREQUENCY 17` / "Você demorou."
- **Verificação**: fluxo completo da abertura jogável de ponta a ponta.
- Nota: o "topo" da torre (área do final) fica para a Etapa 5; a sala do rádio é o andar alto atual.

### ETAPA 3 — Criatura, rádio e terror
- [ ] Criatura humanoide simples: idle, andar, andar devagar, virar, olhar para o jogador, inclinar cabeça, aparecer/desaparecer, recuar, atravessar o fundo
- [ ] Primeiro encontro: caminha atrás das árvores → para → vira → olha → (~30% mais lento + tremor de câmera + bordas mais escuras + tensão) → ~1s → desaparece → velocidade normal
- [ ] Sistema visual do rádio: interferência, ondas, distorções, texto gradual, indicador de transmissão, `SIGNAL LOST` (modular p/ áudio)
- [ ] Efeitos de medo (vinheta, tremor, redução de velocidade)
- **Verificação**: primeiro encontro acontece sem travar o jogador; rádio mostra sinais corretos.

### ETAPA 4 — Interações e narrativa
- [ ] Portas, chaves, mensagens, fotografias, objetos
- [ ] Eventos narrativos disparados pelo sistema genérico de interação
- [ ] Fotografia do próprio protagonista na torre
- **Verificação**: cada novo objeto entra pelo mesmo sistema de interação.

### ETAPA 5 — História completa
- [ ] Pistas `17` e `03:17` espalhadas (relógio parado, marcas, mensagens)
- [ ] Mensagens: "Não confie no rádio." / "Você já esteve aqui." / "Se você encontrou esta mensagem, continue."
- [ ] Revelação: mensagens deixadas por ele mesmo; criatura = versão anterior
- [ ] Final: `ALL MESSAGES WERE LEFT BY YOU.` / `EVERY WARNING. EVERY CLUE. EVERY PATH. YOU LEFT THEM FOR YOURSELF.`
- [ ] Créditos → `INCOMING TRANSMISSION` / `FREQUENCY 17` / "Obrigado por chegar até aqui."
- [ ] Reflexão final (uma das frases, sem exagerar na explicação)
- **Verificação**: jogabilidade completa do início ao final com apenas placeholders.

### ETAPA 6 — Polimento
- [ ] Animações (mesmo em placeholder), efeitos, ajustes finos de atmosfera

### ETAPA 7 — Arte final
- [ ] Substituir placeholders por spritesheets/artes **sem tocar nas mecânicas**

---

## Estilo

Sombrio, misterioso, silencioso, atmosférico, minimalista.
Terror vindo de: comportamento + ambiente + rádio + descoberta.
Sem gore, sem jumpscares constantes, sem combate.

## Status atual

- **ETAPA 1 concluída** (sistemas preservados): jogador (WASD/setas, colisão AABB,
  IDLE/WALK/RUN, Shift, `setMovementMultiplier()`), câmera com follow + clamp +
  shake, sistema genérico de interação (registro `Interactable` + tecla E),
  API `window.__frequency17`.
- **ETAPA 2 concluída e verificada**: mundo com 3 pisos (`entrada`, `radio`,
  `exterior`) ligados por portas/escadas com fade; parallax de 7 camadas
  (`app/src/game/parallax/parallax.ts`) reutilizado na janela da sala do rádio;
  abertura jogável (beat → subida automática → tropeço → caixa cai e para
  ~130px abaixo → controle volta); caixa interagível com E → etiqueta
  FREQUENCY 17 → rádio liga sozinho → transmissão datilografada com
  `RADIO SIGNAL DETECTED` / `FREQUENCY 17` / "Você demorou." → controle volta.
- Verificação: `bun tsc -b --noEmit` (passa) e `bun scripts/verifyEtapa1.ts`
  (**75/75** checagens: Etapa 1 lógica + dados do mundo/parallax + execução real
  do loop com stubs de DOM, cobrindo abertura, caixa, rádio e transições).
- Próxima etapa: **ETAPA 3** (criatura, comportamento, sistema visual do rádio,
  efeitos de terror).
