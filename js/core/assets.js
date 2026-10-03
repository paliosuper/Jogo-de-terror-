/* ============================================================
   assets.js — gerenciador de assets com PLACEHOLDERS procedurais
   ------------------------------------------------------------
   Filosofia:
   - Se um arquivo real existir em assets/sprites/<nome>.png, ele é carregado.
   - Caso contrário, um placeholder desenhado por código é gerado no mesmo
     tamanho, mantendo a estética (silhuetas escuras + acentos ciano).
   - Qualquer sprite futuro substitui o placeholder SEM mudar o resto do jogo,
     pois o acesso é sempre via Assets.get('nome').
   ============================================================ */
const Assets = (() => {

  const loaded = {};        // nome -> Image | canvas (placeholder)
  const pending = {};       // nome -> Promise
  let ready = false;

  /* Definição central: cada asset tem tamanho e função de desenho fallback.
     Para adicionar um sprite real futuro: basta colocar <nome>.png em
     assets/sprites/ — nada mais muda. */
  const DEFS = {

    /* ---- Jogador ---- */
    player_idle: {
      w: 24, h: 40,
      draw: (ctx, w, h) => drawHumanoid(ctx, w, h, '#c9d6dd', true)
    },
    player_walk: {
      w: 24, h: 40,
      draw: (ctx, w, h) => drawHumanoid(ctx, w, h, '#c9d6dd', false)
    },

    /* ---- NPC genérico (silhueta com capuz, variação por tint) ---- */
    npc_hooded: {
      w: 24, h: 40,
      draw: (ctx, w, h) => drawHooded(ctx, w, h, '#8fa3ad')
    },

    /* ---- Fragmento de sinal colecionável ---- */
    signal_shard: {
      w: 16, h: 16,
      draw: (ctx, w, h) => {
        ctx.fillStyle = 'rgba(63,216,194,0.15)';
        ctx.beginPath(); ctx.arc(w/2, h/2, 7, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3fd8c2';
        ctx.beginPath(); ctx.arc(w/2, h/2, 3, 0, Math.PI*2); ctx.fill();
      }
    },

    /* ---- Lâmpada / fonte de luz cenográfica ---- */
    lamp: {
      w: 12, h: 28,
      draw: (ctx, w, h) => {
        ctx.fillStyle = '#1a2228';
        ctx.fillRect(w/2 - 1, 4, 2, h - 4);          // poste
        ctx.fillStyle = '#2b3842';
        ctx.fillRect(w/2 - 5, 0, 10, 6);             // cúpula
        ctx.fillStyle = '#ffd98a';
        ctx.fillRect(w/2 - 2, 5, 4, 3);              // bulbo
      }
    },

    /* ---- Placa / terminal interativo ---- */
    terminal: {
      w: 28, h: 36,
      draw: (ctx, w, h) => {
        ctx.fillStyle = '#141c22';
        ctx.fillRect(2, 6, w-4, h-8);                // corpo
        ctx.fillStyle = '#0a0f13';
        ctx.fillRect(5, 9, w-10, 12);                // tela
        ctx.fillStyle = 'rgba(63,216,194,0.7)';
        ctx.fillRect(7, 12, 8, 2);                   // "texto" da tela
        ctx.fillRect(7, 16, 12, 2);
        ctx.fillStyle = '#2b3842';
        ctx.fillRect(4, h-6, w-8, 3);                // base
      }
    },

    /* ---- Pedra / destroço (ruínas) ---- */
    rubble: {
      w: 48, h: 32,
      draw: (ctx, w, h) => {
        ctx.fillStyle = '#1b242b';
        ctx.beginPath();
        ctx.moveTo(4, h); ctx.lineTo(10, 10); ctx.lineTo(22, 4);
        ctx.lineTo(38, 12); ctx.lineTo(44, h);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#232e36';
        ctx.fillRect(14, 14, 12, 8);                 // bloco quebrado
      }
    },

    /* ---- Coluna quebrada (ruínas / sala de controle) ---- */
    pillar: {
      w: 24, h: 120,
      draw: (ctx, w, h) => {
        ctx.fillStyle = '#182028';
        ctx.fillRect(2, 8, w-4, h-8);
        ctx.fillStyle = '#222c35';
        ctx.fillRect(0, 0, w, 10);                   // capitel irregular
        ctx.fillRect(0, h-8, w, 8);
        // trincas por código (não precisa de arte separada)
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.moveTo(6, 30); ctx.lineTo(14, 52); ctx.lineTo(8, 78);
        ctx.stroke();
      }
    },

    /* ---- Antena / torre (sala de controle) ---- */
    antenna: {
      w: 40, h: 140,
      draw: (ctx, w, h) => {
        ctx.strokeStyle = '#2b3842';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h);           // mastro
        ctx.moveTo(w/2 - 12, h); ctx.lineTo(w/2, h - 40); // pernas
        ctx.moveTo(w/2 + 12, h); ctx.lineTo(w/2, h - 40);
        ctx.moveTo(w/2 - 8, h - 60); ctx.lineTo(w/2 + 8, h - 60);
        ctx.moveTo(w/2 - 6, h - 85); ctx.lineTo(w/2 + 6, h - 85);
        ctx.stroke();
        ctx.fillStyle = '#d84f4f';
        ctx.beginPath(); ctx.arc(w/2, 2, 3, 0, Math.PI*2); ctx.fill(); // luz vermelha no topo
      }
    },

    /* ================= CENA DA TORRE (abertura) ================= */

    /* ---- Caixa perdida com a etiqueta FREQUENCY 17 ---- */
    freq_box: {
      w: 26, h: 18,
      draw: (ctx, w, h) => {
        // caixa marrom-escura com fita e etiqueta clara
        ctx.fillStyle = '#3a2e22';
        ctx.fillRect(1, 3, w-2, h-4);
        ctx.fillStyle = '#4a3b2c';
        ctx.fillRect(1, 3, w-2, 4);                 // tampa
        ctx.fillStyle = '#241b12';
        ctx.fillRect(w/2 - 1, 3, 2, h-4);           // fita vertical
        // etiqueta "FREQUENCY 17" legível mesmo em miniatura
        ctx.fillStyle = '#d8dde0';
        ctx.fillRect(3, 8, w-6, 7);
        ctx.fillStyle = '#12181d';
        ctx.font = 'bold 5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FREQ', w/2, 12.5);
        ctx.fillText('17', w/2, 14.6);
      }
    },

    /* ---- Trecho da torre de rádio (treliça modular — repete em X/Y) ---- */
    tower_truss: {
      w: 96, h: 120,
      draw: (ctx, w, h) => {
        ctx.strokeStyle = '#242e36';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(8, 0);  ctx.lineTo(8, h);        // longarinas
        ctx.moveTo(w-8, 0); ctx.lineTo(w-8, h);
        ctx.moveTo(0, 6);  ctx.lineTo(w, 6);        // travessas
        ctx.moveTo(0, h-6); ctx.lineTo(w, h-6);
        ctx.lineWidth = 2;
        ctx.moveTo(8, 6);   ctx.lineTo(w-8, h/2);   // diagonais em X
        ctx.lineTo(8, h-6);
        ctx.moveTo(w-8, 6); ctx.lineTo(8, h/2);
        ctx.lineTo(w-8, h-6);
        ctx.stroke();
        // rebites
        ctx.fillStyle = '#31404a';
        ctx.fillRect(6, 4, 4, 4); ctx.fillRect(w-10, 4, 4, 4);
        ctx.fillRect(6, h-8, 4, 4); ctx.fillRect(w-10, h-8, 4, 4);
      }
    },

    /* ---- Cabana do operador (base da torre) ---- */
    shack: {
      w: 160, h: 110,
      draw: (ctx, w, h) => {
        // corpo
        ctx.fillStyle = '#181f16';
        ctx.fillRect(10, 40, w-20, h-40);
        // tábuas (variação por código, sem arte extra)
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        for (let y = 48; y < h - 6; y += 9) {
          ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(w-12, y); ctx.stroke();
        }
        // telhado
        ctx.fillStyle = '#10151a';
        ctx.beginPath();
        ctx.moveTo(2, 42); ctx.lineTo(w/2, 16); ctx.lineTo(w-2, 42);
        ctx.closePath(); ctx.fill();
        // porta entreaberta (interior escuro + batente claro)
        ctx.fillStyle = '#2b3842';
        ctx.fillRect(w/2 - 16, 56, 32, h-56);
        ctx.fillStyle = '#05080b';
        ctx.fillRect(w/2 - 13, 59, 26, h-59);
        // janela com reflexo azulado
        ctx.fillStyle = '#0d1319';
        ctx.fillRect(24, 56, 26, 18);
        ctx.fillStyle = 'rgba(63,216,194,0.12)';
        ctx.fillRect(26, 58, 10, 6);
        ctx.fillStyle = '#0d1319';
        ctx.fillRect(w-50, 56, 26, 18);
      }
    },

    /* ---- Pinheiro silhueta (florestas do parallax E árvores próximas —
           mesma arte escalada/tintada em camadas diferentes) ---- */
    pine_silhouette: {
      w: 64, h: 128,
      draw: (ctx, w, h) => {
        ctx.fillStyle = '#000000';   // preto -> camada aplica tint via globalAlpha sobre fundo
        // tronco
        ctx.fillRect(w/2 - 3, h - 22, 6, 22);
        // copa em 3 camadas de triângulos
        const tier = (cx, cy, sw, sh) => {
          ctx.beginPath();
          ctx.moveTo(cx, cy - sh);
          ctx.lineTo(cx - sw, cy);
          ctx.lineTo(cx + sw, cy);
          ctx.closePath(); ctx.fill();
        };
        tier(w/2, h - 18, 26, 40);
        tier(w/2, h - 46, 20, 38);
        tier(w/2, h - 74, 13, 34);
      }
    }
  };

  /* ---------- Funções de desenho dos humanoides placeholder ---------- */
  function drawHumanoid(ctx, w, h, tint, armsDown) {
    ctx.clearRect(0, 0, w, h);
    // sombra sutil
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(w/2, h-2, 8, 2.5, 0, 0, Math.PI*2); ctx.fill();
    // corpo (silhueta)
    ctx.fillStyle = '#141b21';
    ctx.fillRect(w/2 - 5, 14, 10, 14);               // torso
    ctx.fillRect(w/2 - 5, 28, 4, 10);                // pernas
    ctx.fillRect(w/2 + 1, 28, 4, 10);
    // cabeça
    ctx.fillStyle = tint;
    ctx.beginPath(); ctx.arc(w/2, 9, 5.5, 0, Math.PI*2); ctx.fill();
    // braços
    ctx.fillStyle = '#141b21';
    if (armsDown) {
      ctx.fillRect(w/2 - 8, 15, 3, 11);
      ctx.fillRect(w/2 + 5, 15, 3, 11);
    } else {
      ctx.fillRect(w/2 - 8, 15, 3, 9);
      ctx.fillRect(w/2 + 5, 17, 3, 9);
    }
    // detalhe "fone de ouvido" — identidade visual do protagonista
    ctx.fillStyle = '#3fd8c2';
    ctx.fillRect(w/2 - 6, 7, 2, 4);
    ctx.fillRect(w/2 + 4, 7, 2, 4);
  }

  function drawHooded(ctx, w, h, tint) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(w/2, h-2, 8, 2.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#10161b';
    ctx.fillRect(w/2 - 6, 12, 12, 26);               // manto
    // capuz
    ctx.beginPath();
    ctx.moveTo(w/2 - 7, 14);
    ctx.quadraticCurveTo(w/2, -2, w/2 + 7, 14);
    ctx.closePath();
    ctx.fill();
    // olhos brilhantes
    ctx.fillStyle = tint;
    ctx.fillRect(w/2 - 3, 10, 2, 2);
    ctx.fillRect(w/2 + 1, 10, 2, 2);
  }

  /* ---------- Carregamento ---------- */
  const realMissing = new Set();   // nomes sem arte real (cache p/ evitar spam de rede/console)

  function tryLoadReal(name) {
    if (realMissing.has(name)) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { realMissing.add(name); resolve(null); };   // sem arte real -> placeholder
      img.src = `assets/sprites/${name}.png`;
    });
  }

  function makePlaceholder(def) {
    const c = document.createElement('canvas');
    c.width = def.w; c.height = def.h;
    def.draw(c.getContext('2d'), def.w, def.h);
    return c;
  }

  /** Pré-carrega todos os assets definidos em DEFS */
  function loadAll() {
    const promises = Object.keys(DEFS).map((name) => {
      pending[name] = tryLoadReal(name).then((img) => {
        loaded[name] = img || makePlaceholder(DEFS[name]);
        delete pending[name];
        return loaded[name];
      });
    });
    return Promise.all(promises).then(() => { ready = true; });
  }

  /** Acesso síncrono (só chame após loadAll resolver) */
  function get(name) {
    if (!loaded[name]) {
      console.warn(`[Assets] "${name}" acessado antes do loadAll ou inexistente.`);
      // gera placeholder sob demanda para nunca quebrar o jogo
      const def = DEFS[name];
      loaded[name] = def ? makePlaceholder(def) : null;
    }
    return loaded[name];
  }

  function isReady() { return ready; }

  /** Permite registrar novos sprites futuramente sem editar este arquivo todo */
  function define(name, def) { DEFS[name] = def; }

  return { loadAll, get, isReady, define, DEFS };
})();
