/* ============================================================
   story.js — BASE NARRATIVA de FREQUENCY 17 (dados + registro simples).

   NÃO é um engine de cutscenes: apenas uma estrutura organizada e
   reutilizável onde o gameplay (cenas, terminais, zona da criatura,
   abertura da torre) pode buscar conteúdo narrativo depois.

   Conceitos:
   - TRANSMISSIONS : mensagens do rádio (id, ordem, texto, condição, once)
   - CLUES         : pistas narrativas (número 17, 03:17, marcas, fotos…)
   - PHOTOS        : fotografias futuras (placeholder; imagem+texto+evento)
   - Story.run(id) : executa um evento narrativo UMA única vez por run
                     (fire-and-forget; usa Game.say / Game.setOverlay)

   Adicionar conteúdo novo = adicionar um item nos arrays abaixo.
   Nada mais precisa mudar.

   Compatibilidade: se algum sistema estiver sendo ajustado em paralelo
   (player/câmera/input), este módulo não depende dele — só dos pontos
   públicos já existentes: Game.say, Game.setOverlay, Game.addTuning,
   Game.story (flags) e AudioSys.sfxInteract (com guarda de segurança).
   ============================================================ */
const Story = (() => {

  /* ---------- Estado de execução (por página/run) ---------- */
  const executed = new Set();          // ids de eventos já rodados
  const clueState = {};                // id -> 'found' | 'seen'

  /* ============================================================
     TRANSMISSÕES DO RÁDIO
     Cada entrada:
       id      : identificador único
       order   : posição na sequência narrativa
       text    : corpo da fala
       speaker : rótulo exibido na caixa de diálogo
       when    : () => boolean — condição para liberar (opcional)
       onDone  : callback executado após a fala terminar (opcional)
                 (recebe o objeto da transmissão)
     ============================================================ */
  const transmissions = [
    {
      id: 'tx-first-contact', order: 1, speaker: 'RÁDIO',
      text: '“Você demorou.”',
      // quando: logo após pegar a caixa na torre (overlay visual primeiro)
      when: () => Game.story.boxTaken
    },
    {
      id: 'tx-knows-name', order: 2, speaker: 'RÁDIO',
      text: 'hzzt… eu conheço a sua voz. sempre conheci.',
      when: () => Game.story.radioSpoke
    },
    {
      id: 'tx-warning-clock', order: 3, speaker: 'RÁDIO',
      text: 'não confie no relógio. ele para às 03:17. eu sei porque parei junto.',
      when: () => Game.story.knowsClock
    },
    {
      id: 'tx-warning-creature', order: 4, speaker: 'RÁDIO',
      text: 'se vir alguém no corredor… não corra. ele só observa. sempre observou.',
      when: () => Game.story.metCreature
    },
    {
      id: 'tx-photo', order: 5, speaker: 'RÁDIO',
      text: 'a fotografia está onde você a deixou. no lugar de sempre.',
      when: () => Game.story.photoFound === false && Game.story.knowsMark17
    },
    {
      id: 'tx-reveal', order: 6, speaker: 'RÁDIO',
      text: 'todas as mensagens foram deixadas por você. todos os avisos. todas as trilhas.',
      when: () => Game.story.photoFound
    },
    {
      id: 'tx-final', order: 7, speaker: 'FREQUENCY 17',
      text: '“Obrigado por chegar até aqui.”',
      when: () => Game.story.ended
    }
  ];

  /* Sequência de abertura da torre (exibida como overlay visual, sem áudio):
     RADIO SIGNAL DETECTED / FREQUENCY 17  ->  "Você demorou."
     Mantida aqui p/ o gameplay buscar quando for exibir — hoje tower.js
     desenha o mesmo texto via Game.setOverlay diretamente. */
  const openingSequence = [
    { kind: 'signal', lines: ['RADIO SIGNAL DETECTED', 'FREQUENCY 17'] },
    { kind: 'speech', speaker: 'RÁDIO', text: '“Você demorou.”' }
  ];

  /* ============================================================
     PISTAS NARRATIVAS
     Cada pista tem metadados suficientes p/ o jogo identificá-la
     depois (id, tipo, valor-chave, cena prevista, texto curto).
     NÃO é inventário: apenas registro de "existiu / foi notada".
     ============================================================ */
  const clues = [
    { id: 'clue-number-17', type: 'number', value: '17',
      sceneHint: 'tower', label: 'número pintado na torre',
      note: 'pichação descascada perto do patamar do topo.' },

    { id: 'clue-clock-0317', type: 'time', value: '03:17',
      sceneHint: 'controlroom', label: 'relógio parado em 03:17',
      note: 'o ponteiro dos minutos treme, mas nunca passa das 17.' },

    { id: 'clue-tower-marks', type: 'mark', value: '17 riscos verticais',
      sceneHint: 'tower', label: 'marcas na parede da escada',
      note: 'alguém contou os dias. ou os ciclos.' },

    { id: 'clue-note-loop', type: 'message', value: '“não suba. desça comigo.”',
      sceneHint: 'ruins', label: 'bilhete enfiado numa rachadura',
      note: 'letra tremida. tinta corrida pela chuva velha.' },

    { id: 'clue-note-already-was', type: 'message',
      value: '“você já esteve aqui. eu estive.”',
      sceneHint: 'ruins', label: 'mensagem na parede das ruínas',
      note: 'escrita com o mesmo giz de cera desbotado.' },

    { id: 'clue-photo-himself', type: 'photo', value: 'photo-himself',
      sceneHint: 'controlroom', label: 'fotografia dele mesmo na torre',
      note: 'verso datado: 03:17. ninguém mais vivia aqui.' },

    { id: 'clue-radio-label', type: 'object', value: 'TX-17 — NÃO DESLIGAR',
      sceneHint: 'tower', label: 'etiqueta do transmissor',
      note: 'cola amarelada. a mesma caligrafia do bilhete.' }
  ];

  /* ============================================================
     FOTOGRAFIAS (estrutura p/ arte futura; placeholder por código)
     image: null -> usar Assets.get('terminal') cortado + moldura clara
            (já existente em NoteObject.photo); trocar por sprite real depois.
     ============================================================ */
  const photos = [
    {
      id: 'photo-himself',
      title: 'FOTOGRAFIA',
      image: null,                    // placeholder: ver NoteObject(photo:true)
      description: 'ele mesmo, na torre, olhando para a câmera. a roupa é a que está vestindo agora.',
      revealEvent: 'ev-revelation',   // evento narrativo disparado ao ver
      caption: 'verso: “03:17”'
    }
  ];

  /* ============================================================
     EVENTOS NARRATIVOS (execução única por run)
     fn recebe nada; usa APIs públicas já existentes.
     ============================================================ */
  const events = {
    'ev-opening-signal': {
      once: true,
      fn: () => {
        Game.setOverlay({
          t0: Game.time, dur: 3.2, blink: true,
          lines: [
            { text: 'RADIO SIGNAL DETECTED', color: '#3fd8c2', size: 26 },
            { text: 'FREQUENCY 17', color: '#e8f4f0', size: 34 }
          ]
        });
      }
    },
    'ev-first-message': {
      once: true,
      fn: () => {
        Game.story.radioSpoke = true;
        Game.say('RÁDIO', '“Você demorou.”', 3.4, () => {
          Game.say('RÁDIO', 'hzzt… frequência alvo: 17.0. siga a trilha para leste.', 5);
        });
      }
    },
    'ev-revelation': {
      once: true,
      fn: () => {
        Game.setOverlay({
          t0: Game.time, dur: 4.0, blink: false, yStart: 200,
          lines: [{ text: 'ALL MESSAGES WERE LEFT BY YOU.', color: '#e8f4f0', size: 26 }]
        });
      }
    },
    'ev-final-sequence': {
      once: true,
      fn: () => {
        Game.story.ended = true;
        Game.setOverlay({
          t0: Game.time, dur: 6.0, blink: false, yStart: 180,
          lines: [
            { text: 'EVERY WARNING.',           color: '#d8dde0', size: 22 },
            { text: 'EVERY CLUE.',              color: '#d8dde0', size: 22 },
            { text: 'EVERY PATH.',              color: '#d8dde0', size: 22 },
            { text: 'YOU LEFT THEM FOR YOURSELF.', color: '#3fd8c2', size: 26 }
          ]
        });
      }
    },
    'ev-credits-start': {
      once: true,
      fn: () => {
        Game.setOverlay({
          t0: Game.time, dur: 5.0, blink: false, yStart: 120,
          lines: [
            { text: 'INCOMING TRANSMISSION', color: '#3fd8c2', size: 24 },
            { text: 'FREQUENCY 17',          color: '#e8f4f0', size: 30 }
          ]
        });
      }
    }
  };

  /* ============================================================
     API PÚBLICA
     ============================================================ */

  /** Executa um evento narrativo uma única vez. Retorna true se rodou agora. */
  function run(id) {
    if (executed.has(id)) return false;
    const ev = events[id];
    if (!ev || typeof ev.fn !== 'function') return false;
    executed.add(id);
    try { ev.fn(); } catch (e) { console.warn('[Story] evento falhou:', id, e); }
    return true;
  }

  /** Marca uma pista como encontrada/notada. */
  function markClue(id) {
    if (clueState[id]) return false;
    clueState[id] = 'found';
    if (typeof AudioSys !== 'undefined' && AudioSys.sfxInteract) AudioSys.sfxInteract();
    return true;
  }

  function hasClue(id) { return !!clueState[id]; }

  /** Busca transmissões cuja condição `when()` está satisfeita e ainda não rodam. */
  function pendingTransmissions() {
    return transmissions
      .filter(t => !executed.has(t.id))
      .filter(t => { try { return !t.when || t.when(); } catch (_) { return false; } })
      .sort((a, b) => a.order - b.order);
  }

  /** Roda a próxima transmissão elegível (se houver). */
  function playNextTransmission() {
    const list = pendingTransmissions();
    if (!list.length) return false;
    const t = list[0];
    executed.add(t.id);
    Game.say(t.speaker, t.text, 4.5, () => { if (t.onDone) t.onDone(t); });
    return true;
  }

  function byId(collection, id) { return collection.find(x => x.id === id) || null; }

  return {
    transmissions, openingSequence, clues, photos, events,
    run, markClue, hasClue,
    pendingTransmissions, playNextTransmission,
    transmissionById: (id) => byId(transmissions, id),
    clueById:         (id) => byId(clues, id),
    photoById:        (id) => byId(photos, id),
    isExecuted:       (id) => executed.has(id),
    reset() { executed.clear(); for (const k in clueState) delete clueState[k]; }
  };
})();
