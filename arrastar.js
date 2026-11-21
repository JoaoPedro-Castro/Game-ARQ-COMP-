(() => {
  "use strict";

  const root = document.getElementById("arrastar-root");
  const painelArrastar = document.getElementById("painel-arrastar");
  if (!root || !painelArrastar) return;

  const fontePalavras = typeof PALAVRAS !== "undefined" ? PALAVRAS : globalThis.PALAVRAS;
  if (!Array.isArray(fontePalavras)) {
    console.error("[ARRASTAR] PALAVRAS não encontrada.");
    root.innerHTML = "<p class='arrastar-live'>Erro ao iniciar o modo arrastar.</p>";
    return;
  }

  // -------------------- Regras de pontuação --------------------
  // Acerto base por pista correta.
  const PONTOS_ACERTO = 100;
  // Erro apenas quando solta chip em pista errada.
  const PONTOS_ERRO = -20;
  // Custo por usar dica.
  const PONTOS_DICA = -30;
  // Bônus por estrela no final da fase.
  const BONUS_POR_ESTRELA = 50;
  // Máximo de dicas por fase.
  const MAX_DICAS_FASE = 2;
  // Chave de persistência do progresso.
  const CHAVE_STORAGE = "arqcomp-cruzadinha-v1";

  const FASES = [
    { id: 1, nome: "Dentro da CPU", respostas: ["CPU", "ULA", "UC", "REGISTRADORES"], extras: [] },
    { id: 2, nome: "Memórias", respostas: ["RAM", "CACHE", "ROM", "FLASH"], extras: [] },
    { id: 3, nome: "Guardar e copiar", respostas: ["EEPROM", "MEMORIADEMASSA", "DMA"], extras: ["UC"] },
    { id: 4, nome: "Fios e chips", respostas: ["ADDRESSBUS", "DATABUS", "MICROCONTROLADOR"], extras: ["RAM"] },
    { id: 5, nome: "Desafio final", sorteio: 6, quantidadeExtras: 2 }
  ];

  const ROTULOS = {
    ADDRESSBUS: "ADDRESS BUS",
    DATABUS: "DATA BUS",
    MEMORIADEMASSA: "MEMÓRIA DE MASSA"
  };

  const GRUPOS_CONFUNDIVEIS = [
    ["ROM", "FLASH", "EEPROM"],
    ["ADDRESSBUS", "DATABUS"],
    ["RAM", "CACHE"],
    ["CPU", "MICROCONTROLADOR", "UC", "ULA"]
  ];

  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mapaPalavras = new Map(fontePalavras.map((p) => [p.resposta, p]));

  const refs = {
    faseInfo: null,
    fases: null,
    pontosFase: null,
    sequencia: null,
    total: null,
    chama: null,
    dicasRestantes: null,
    grade: null,
    chips: null,
    live: null,
    modalFim: null,
    modalConfirmar: null
  };

  const estado = {
    faseIndex: 0,
    faseDados: null,
    slots: [],
    chips: [],
    chipSelecionado: null,
    drag: null,
    bloquearCliqueAte: 0,
    acertos: 0,
    erros: 0,
    sequencia: 0,
    pontosFase: 0,
    bonusSequenciaTotal: 0,
    penalidadeDicasTotal: 0,
    dicasUsadas: 0,
    concluida: false,
    pontuadosSlots: new Set(),
    primeiraInteracaoArrastar: false,
    modalAberto: null,
    ultimoFocoModal: null,
    avisoSemStorageMostrado: false
  };

  let progresso = null;
  let storageDisponivel = true;

  function emitir(nome, detail) {
    document.dispatchEvent(new CustomEvent(nome, { detail }));
  }

  function contarConcluidas(obj) {
    return obj.estrelas.filter((v) => v > 0).length;
  }

  function copiaProgresso(obj) {
    return {
      desbloqueadas: [...obj.desbloqueadas],
      estrelas: [...obj.estrelas],
      melhor: [...obj.melhor],
      concluidas: contarConcluidas(obj)
    };
  }

  window.obterProgresso = function obterProgresso() {
    return copiaProgresso(progresso);
  };

  function progressoPadrao() {
    return {
      desbloqueadas: FASES.map((_, i) => i === 0),
      estrelas: FASES.map(() => 0),
      melhor: FASES.map(() => 0)
    };
  }

  function validarArrayNumerico(arr, tamanho, min, max) {
    if (!Array.isArray(arr) || arr.length !== tamanho) return null;
    if (!arr.every((v) => Number.isFinite(v) && v >= min && v <= max)) return null;
    return arr.map((v) => Math.floor(v));
  }

  function validarArrayBooleano(arr, tamanho) {
    if (!Array.isArray(arr) || arr.length !== tamanho) return null;
    if (!arr.every((v) => typeof v === "boolean")) return null;
    return [...arr];
  }

  function avisoSemStorage() {
    if (estado.avisoSemStorageMostrado) return;
    estado.avisoSemStorageMostrado = true;
    anunciar("Seu progresso não poderá ser salvo neste navegador.");
  }

  function salvarProgresso() {
    try {
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(progresso));
      storageDisponivel = true;
    } catch {
      storageDisponivel = false;
      avisoSemStorage();
    }
  }

  function carregarProgresso() {
    const base = progressoPadrao();
    try {
      const bruto = localStorage.getItem(CHAVE_STORAGE);
      if (!bruto) {
        return base;
      }

      const json = JSON.parse(bruto);
      const desbloqueadas = validarArrayBooleano(json.desbloqueadas, FASES.length);
      const estrelas = validarArrayNumerico(json.estrelas, FASES.length, 0, 3);
      const melhor = validarArrayNumerico(json.melhor, FASES.length, 0, 9999999);

      if (!desbloqueadas || !estrelas || !melhor) {
        return base;
      }

      // Garante fase 1 sempre liberada.
      desbloqueadas[0] = true;
      return { desbloqueadas, estrelas, melhor };
    } catch {
      storageDisponivel = false;
      avisoSemStorage();
      return base;
    }
  }

  function nomeChip(resposta) {
    return ROTULOS[resposta] || resposta;
  }

  function embaralhar(lista) {
    const arr = [...lista];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function tocar(nome) {
    if (typeof window.tocarSom === "function") {
      window.tocarSom(nome);
    }
  }

  function vibrar(ms) {
    if (reduzMovimento) return;
    try {
      if ("vibrate" in navigator) navigator.vibrate(ms);
    } catch {
      // Ignora ambiente sem vibração.
    }
  }

  function anunciar(texto) {
    if (!refs.live) return;
    refs.live.textContent = "";
    requestAnimationFrame(() => {
      refs.live.textContent = texto;
    });
  }

  function buscarToastArea() {
    return document.getElementById("toast-area");
  }

  function toast(texto) {
    const area = buscarToastArea();
    if (!area || !texto) return;

    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = texto;
    area.appendChild(el);

    const duracao = 2200;
    if (!reduzMovimento) {
      el.animate(
        [
          { opacity: 0, transform: "translateY(10px)" },
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 0, transform: "translateY(8px)" }
        ],
        { duration: duracao, easing: "ease" }
      );
    }

    setTimeout(() => el.remove(), duracao);
  }

  function bonusSequencia(valorSequencia) {
    if (valorSequencia <= 1) return 0;
    if (valorSequencia >= 6) return 50;
    return (valorSequencia - 1) * 10;
  }

  function estrelasPorErros(erros) {
    if (erros === 0) return 3;
    if (erros <= 2) return 2;
    return 1;
  }

  function totalSalvo() {
    return progresso.melhor.reduce((acc, v) => acc + v, 0);
  }

  function atualizarNumeroAnimado(el, valorFinal, formatar) {
    const atual = Number(el.dataset.valor || 0);
    el.dataset.valor = String(valorFinal);

    if (reduzMovimento || atual === valorFinal) {
      el.textContent = formatar(valorFinal);
      return;
    }

    const inicio = performance.now();
    const duracao = 260;

    const animar = (agora) => {
      const p = Math.min(1, (agora - inicio) / duracao);
      const val = Math.round(atual + (valorFinal - atual) * p);
      el.textContent = formatar(val);
      if (p < 1) requestAnimationFrame(animar);
    };

    requestAnimationFrame(animar);
  }

  function mostrarDeltaPontos(valor, x, y) {
    if (!Number.isFinite(valor) || valor === 0 || !root) return;

    const bolha = document.createElement("span");
    bolha.className = `arr-delta ${valor >= 0 ? "positivo" : "negativo"}`;
    bolha.textContent = `${valor > 0 ? "+" : ""}${valor}`;
    bolha.style.left = `${x}px`;
    bolha.style.top = `${y}px`;

    document.body.appendChild(bolha);
    if (!reduzMovimento) {
      bolha.animate(
        [
          { opacity: 0, transform: "translate(-50%, 0) scale(0.95)" },
          { opacity: 1, transform: "translate(-50%, -10px) scale(1)" },
          { opacity: 0, transform: "translate(-50%, -28px) scale(0.95)" }
        ],
        { duration: 900, easing: "ease-out" }
      );
    }

    setTimeout(() => bolha.remove(), 940);
  }

  function atualizarPlacar() {
    atualizarNumeroAnimado(refs.pontosFase, estado.pontosFase, (v) => `Pontos da fase ${v}`);
    atualizarNumeroAnimado(refs.sequencia, estado.sequencia, (v) => `Sequência ${v}`);
    atualizarNumeroAnimado(refs.total, totalSalvo(), (v) => `Total ${v}`);

    const glow = estado.sequencia >= 3;
    refs.chama.classList.toggle("ativa", glow);
  }

  function ajustarPontos(delta, origem) {
    const antes = estado.pontosFase;
    estado.pontosFase = Math.max(0, estado.pontosFase + delta);
    const real = estado.pontosFase - antes;
    atualizarPlacar();

    if (origem && real !== 0) {
      mostrarDeltaPontos(real, origem.x, origem.y);
    }
  }

  function posCentro(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function validarFases() {
    FASES.forEach((fase) => {
      if (fase.sorteio) return;
      [...fase.respostas, ...fase.extras].forEach((resp) => {
        if (!mapaPalavras.has(resp)) {
          console.error(`[ARRASTAR] "${resp}" da fase ${fase.id} não existe em PALAVRAS.`);
        }
      });
    });
  }

  function conflitaGrupo(resposta, respostasDaFase) {
    return GRUPOS_CONFUNDIVEIS.some((grupo) => grupo.includes(resposta) && respostasDaFase.some((item) => grupo.includes(item)));
  }

  function gerarFaseCinco(cfg) {
    const todas = fontePalavras.map((p) => p.resposta);
    const respostas = embaralhar(todas).slice(0, cfg.sorteio);
    const restantes = todas.filter((r) => !respostas.includes(r));

    // Regra de justiça: não sorteamos distrator de grupo confundível
    // quando existe resposta da mesma família na fase.
    const candidatosJustos = restantes.filter((r) => !conflitaGrupo(r, respostas));
    let extras = embaralhar(candidatosJustos).slice(0, cfg.quantidadeExtras);

    if (extras.length < cfg.quantidadeExtras) {
      const faltam = cfg.quantidadeExtras - extras.length;
      extras = [...extras, ...embaralhar(restantes.filter((r) => !extras.includes(r))).slice(0, faltam)];
    }

    return {
      id: cfg.id,
      nome: cfg.nome,
      respostas,
      extras
    };
  }

  function dadosDaFase(indice) {
    const cfg = FASES[indice];
    if (cfg.sorteio) return gerarFaseCinco(cfg);

    return {
      id: cfg.id,
      nome: cfg.nome,
      respostas: [...cfg.respostas],
      extras: [...cfg.extras]
    };
  }

  function estrelasHtml(qtd) {
    let out = "";
    for (let i = 1; i <= 3; i++) {
      out += `<span class="estrela ${i <= qtd ? "cheia" : "vazia"}">★</span>`;
    }
    return out;
  }

  function construirLayoutBase() {
    root.innerHTML = `
      <section class="arrastar-cabecalho reveal-on-scroll">
        <div>
          <h2 class="arrastar-titulo">MODO ARRASTAR</h2>
          <p class="arrastar-subtitulo">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3l-4 4v-4H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 4h6v2H9Zm0 4h4v2H9Z"/></svg>
            Arraste cada resposta até a pista certa.
          </p>
        </div>
        <p class="arrastar-fase-info" id="arrastar-fase-info">Fase 1 de 5 · Iniciando</p>
      </section>

      <section class="arrastar-seletor reveal-on-scroll">
        <div class="arrastar-fases" id="arrastar-fases"></div>
        <div class="arrastar-seletor-acoes">
          <button class="arrastar-dica" id="arrastar-dica" type="button">Dica (-30)</button>
          <p class="arrastar-dicas-restantes" id="arrastar-dicas-restantes">Dicas restantes: 2</p>
          <button class="arrastar-reiniciar" id="arrastar-reiniciar" type="button">Reiniciar fase</button>
        </div>
      </section>

      <section class="arrastar-jogo reveal-on-scroll">
        <div class="arrastar-placar">
          <p class="arrastar-selo" id="arrastar-pontos-fase" data-valor="0">Pontos da fase 0</p>
          <p class="arrastar-selo" id="arrastar-sequencia" data-valor="0">Sequência 0 <span id="arrastar-chama" class="arrastar-chama" aria-hidden="true">🔥</span></p>
          <p class="arrastar-selo" id="arrastar-total" data-valor="0">Total 0</p>
        </div>

        <div class="legenda-cores arrastar-legenda" aria-label="Legenda de cores do modo arrastar">
          <span><i class="bolinha certo"></i> Certo</span>
          <span><i class="bolinha errado"></i> Errado ✘</span>
          <span><i class="bolinha selecionada"></i> Selecionado</span>
        </div>

        <div class="arrastar-grade-pistas" id="arrastar-grade-pistas"></div>
      </section>

      <section class="arrastar-banco reveal-on-scroll">
        <h3 class="arrastar-banco-titulo">Banco de respostas</h3>
        <p class="arrastar-banco-ajuda" id="arrastar-banco-ajuda">Arraste uma resposta para cá.</p>
        <div class="arrastar-chips" id="arrastar-chips"></div>
      </section>

      <section class="arrastar-rodape-acoes reveal-on-scroll">
        <button class="arrastar-apagar" id="arrastar-apagar-progresso" type="button">Apagar progresso</button>
      </section>

      <p class="arrastar-live" id="arrastar-live" aria-live="polite"></p>

      <div id="arrastar-modal-fim" class="arr-modal" hidden>
        <div class="arr-modal-fundo" data-close-fim="1"></div>
        <section class="arr-modal-painel" role="dialog" aria-modal="true" aria-labelledby="arr-fim-titulo">
          <button class="arr-modal-fechar" type="button" data-close-fim="1" aria-label="Fechar">×</button>
          <h3 id="arr-fim-titulo"></h3>
          <div class="arr-fim-estrelas" id="arr-fim-estrelas"></div>
          <div class="arr-fim-resumo" id="arr-fim-resumo"></div>
          <div class="arr-fim-acoes" id="arr-fim-acoes"></div>
        </section>
      </div>

      <div id="arrastar-modal-confirmar" class="arr-modal" hidden>
        <div class="arr-modal-fundo" data-close-confirmar="1"></div>
        <section class="arr-modal-painel" role="dialog" aria-modal="true" aria-labelledby="arr-confirmar-titulo">
          <button class="arr-modal-fechar" type="button" data-close-confirmar="1" aria-label="Fechar">×</button>
          <h3 id="arr-confirmar-titulo">Apagar progresso?</h3>
          <p>Tem certeza? Isso apaga pontos, estrelas e fases desbloqueadas.</p>
          <div class="arr-fim-acoes">
            <button type="button" data-confirmar-apagar="1">Apagar</button>
            <button type="button" data-close-confirmar="1">Cancelar</button>
          </div>
        </section>
      </div>
    `;

    refs.faseInfo = document.getElementById("arrastar-fase-info");
    refs.fases = document.getElementById("arrastar-fases");
    refs.pontosFase = document.getElementById("arrastar-pontos-fase");
    refs.sequencia = document.getElementById("arrastar-sequencia");
    refs.total = document.getElementById("arrastar-total");
    refs.chama = document.getElementById("arrastar-chama");
    refs.dicasRestantes = document.getElementById("arrastar-dicas-restantes");
    refs.grade = document.getElementById("arrastar-grade-pistas");
    refs.chips = document.getElementById("arrastar-chips");
    refs.live = document.getElementById("arrastar-live");
    refs.modalFim = document.getElementById("arrastar-modal-fim");
    refs.modalConfirmar = document.getElementById("arrastar-modal-confirmar");
  }

  function renderizarCardsFase(unlockAnim = -1) {
    refs.fases.innerHTML = FASES.map((fase, i) => {
      const desbloqueada = progresso.desbloqueadas[i];
      const concluida = progresso.estrelas[i] > 0;
      const atual = i === estado.faseIndex;

      const classes = ["arrastar-fase-card"];
      if (desbloqueada) classes.push("liberada");
      if (concluida) classes.push("concluida");
      if (atual) classes.push("atual");
      if (!desbloqueada) classes.push("bloqueada");
      if (unlockAnim === i) classes.push("destravando");

      return `
        <button
          class="${classes.join(" ")}"
          data-phase-index="${i}"
          type="button"
          ${desbloqueada ? "" : "aria-disabled='true'"}
          title="${desbloqueada ? fase.nome : "Complete a fase anterior"}"
        >
          <span class="numero">Fase ${i + 1}</span>
          <strong>${fase.nome}</strong>
          <span class="estrelas">${estrelasHtml(progresso.estrelas[i])}</span>
          <span class="pontos">Melhor: ${progresso.melhor[i]}</span>
          ${desbloqueada ? "" : "<span class='bloqueio'>🔒 Complete a fase anterior</span>"}
        </button>
      `;
    }).join("");
  }

  function resetarTentativa() {
    estado.chipSelecionado = null;
    estado.drag = null;
    estado.bloquearCliqueAte = 0;
    estado.acertos = 0;
    estado.erros = 0;
    estado.sequencia = 0;
    estado.pontosFase = 0;
    estado.bonusSequenciaTotal = 0;
    estado.penalidadeDicasTotal = 0;
    estado.dicasUsadas = 0;
    estado.concluida = false;
    estado.pontuadosSlots = new Set();
  }

  function criarSlotsDaFase() {
    estado.slots = estado.faseDados.respostas.map((resposta, indice) => {
      const palavra = mapaPalavras.get(resposta);
      return {
        id: `slot-${indice}`,
        resposta,
        n: palavra?.n || indice + 1,
        pista: palavra?.pista || "Pista indisponível",
        resolvida: false
      };
    });
  }

  function criarChipsDaFase() {
    const lista = [
      ...estado.faseDados.respostas.map((resposta) => ({ resposta, extra: false })),
      ...estado.faseDados.extras.map((resposta) => ({ resposta, extra: true }))
    ];

    estado.chips = embaralhar(lista).map((item, i) => ({
      id: `chip-${estado.faseIndex}-${i}`,
      resposta: item.resposta,
      extra: item.extra,
      rotulo: nomeChip(item.resposta)
    }));
  }

  function renderizarPistas() {
    refs.grade.innerHTML = estado.slots.map((slot) => `
      <article class="arrastar-pista-card" data-slot-wrap="${slot.id}">
        <p class="arrastar-pista-num">${slot.n}.</p>
        <p class="arrastar-pista-texto">${slot.pista}</p>
        <button class="arrastar-dropzone" data-slot-id="${slot.id}" type="button" aria-label="Área para pista ${slot.n}">SOLTE AQUI</button>
      </article>
    `).join("");
  }

  function renderizarChips() {
    refs.chips.innerHTML = estado.chips.map((chip) => `
      <button
        class="arr-chip"
        data-chip-id="${chip.id}"
        data-resposta="${chip.resposta}"
        type="button"
        aria-label="Chip ${chip.rotulo}"
      >${chip.rotulo}</button>
    `).join("");
  }

  function atualizarTextoFase() {
    refs.faseInfo.textContent = `Fase ${estado.faseIndex + 1} de ${FASES.length} · ${estado.faseDados.nome}`;
  }

  function atualizarDicasTexto() {
    const restantes = Math.max(0, MAX_DICAS_FASE - estado.dicasUsadas);
    refs.dicasRestantes.textContent = `Dicas restantes: ${restantes}`;
  }

  function montarFase(indice) {
    cancelarArraste(true);
    fecharModal(refs.modalFim);
    fecharModal(refs.modalConfirmar);

    estado.faseIndex = indice;
    estado.faseDados = dadosDaFase(indice);
    resetarTentativa();

    criarSlotsDaFase();
    criarChipsDaFase();

    atualizarTextoFase();
    atualizarDicasTexto();
    atualizarPlacar();
    renderizarCardsFase();
    renderizarPistas();
    renderizarChips();

    const ajuda = document.getElementById("arrastar-banco-ajuda");
    if (ajuda && !estado.primeiraInteracaoArrastar) {
      ajuda.classList.add("pulsando");
    }

    emitir("arrastar:fase-iniciada", {
      fase: estado.faseIndex + 1,
      total: estado.slots.length
    });
  }

  function marcarPrimeiraInteracao() {
    if (estado.primeiraInteracaoArrastar) return;
    estado.primeiraInteracaoArrastar = true;
    document.getElementById("arrastar-banco-ajuda")?.classList.remove("pulsando");

    try {
      localStorage.setItem("cruzadinha.arrastar.interagiu", "1");
    } catch {
      // Sem storage: segue normal.
    }
  }

  function pegarChipPorId(id) {
    return refs.chips.querySelector(`.arr-chip[data-chip-id="${id}"]`);
  }

  function limparSelecaoChip() {
    estado.chipSelecionado = null;
    refs.chips.querySelectorAll(".arr-chip.selecionado").forEach((c) => c.classList.remove("selecionado"));
  }

  function selecionarChip(id) {
    limparSelecaoChip();
    const chip = pegarChipPorId(id);
    if (!chip || chip.dataset.usado === "1") return;
    estado.chipSelecionado = id;
    chip.classList.add("selecionado");
  }

  function slotLivre(dropzone) {
    return dropzone && dropzone.classList.contains("arrastar-dropzone") && !dropzone.classList.contains("preenchida");
  }

  function obterDropzoneSobPonteiro(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const zona = el.closest(".arrastar-dropzone");
    if (!zona || !root.contains(zona)) return null;
    return zona;
  }

  function destacarDropzone(zona) {
    refs.grade.querySelectorAll(".arrastar-dropzone.ativa").forEach((z) => z.classList.remove("ativa"));
    if (zona && slotLivre(zona)) zona.classList.add("ativa");
  }

  function criarChipFixado(rotulo) {
    const el = document.createElement("span");
    el.className = "arr-chip chip-fixado acerto travado";
    el.textContent = rotulo;
    const ok = document.createElement("span");
    ok.className = "icone-status";
    ok.textContent = "✔";
    el.appendChild(ok);
    return el;
  }

  function efeitoParticulas(alvo) {
    if (reduzMovimento) return;
    const rect = alvo.getBoundingClientRect();
    const burst = document.createElement("div");
    burst.className = "arr-burst";
    burst.style.left = `${rect.left + rect.width / 2}px`;
    burst.style.top = `${rect.top + rect.height / 2}px`;

    for (let i = 0; i < 10; i++) {
      const p = document.createElement("span");
      const ang = (Math.PI * 2 * i) / 10;
      const dist = 16 + Math.random() * 24;
      p.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
      p.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
      burst.appendChild(p);
    }

    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 450);
  }

  function marcarErroVisual(chip) {
    chip.classList.remove("erro");
    void chip.offsetWidth;
    chip.classList.add("erro");

    const ant = chip.querySelector(".icone-status");
    if (ant) ant.remove();

    const x = document.createElement("span");
    x.className = "icone-status erro";
    x.textContent = "✘";
    chip.appendChild(x);

    setTimeout(() => {
      x.remove();
      chip.classList.remove("erro");
    }, 420);
  }

  function autoScrollNaBorda(clientY) {
    const margem = 60;
    const passo = 14;
    if (clientY < margem) window.scrollBy(0, -passo);
    else if (clientY > window.innerHeight - margem) window.scrollBy(0, passo);
  }

  function criarFantasma(texto) {
    const ghost = document.createElement("div");
    ghost.className = "arr-ghost";
    ghost.textContent = texto;
    document.body.appendChild(ghost);
    return ghost;
  }

  function posicionarFantasma(ghost, x, y, rot) {
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    ghost.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
  }

  function animarRetornoFantasma(drag) {
    const { ghost, chipEl } = drag;
    const rect = chipEl.getBoundingClientRect();

    const anim = ghost.animate(
      [
        { left: ghost.style.left, top: ghost.style.top, opacity: 1, transform: ghost.style.transform },
        {
          left: `${rect.left + rect.width / 2}px`,
          top: `${rect.top + rect.height / 2}px`,
          opacity: 0.2,
          transform: "translate(-50%, -50%) scale(0.85)"
        }
      ],
      { duration: 220, easing: "ease-out" }
    );

    anim.onfinish = () => {
      ghost.remove();
      chipEl.classList.remove("arrastando-origem");
    };
  }

  function encerrarArraste({ retorno = true, manterChipApagado = false } = {}) {
    if (!estado.drag) return;
    const drag = estado.drag;
    destacarDropzone(null);

    if (retorno && drag.ghost && !manterChipApagado) {
      animarRetornoFantasma(drag);
    } else {
      drag.ghost?.remove();
      drag.chipEl.classList.remove("arrastando-origem");
    }

    estado.drag = null;
  }

  function cancelarArraste(removerSemAnimacao = false) {
    if (!estado.drag) return;
    encerrarArraste({ retorno: !removerSemAnimacao, manterChipApagado: false });
  }

  function abrirModal(modal, focoInicial) {
    if (!modal) return;
    estado.ultimoFocoModal = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    estado.modalAberto = modal;
    modal.hidden = false;

    const foco = focoInicial || modal.querySelector("button, [href], input, [tabindex]:not([tabindex='-1'])");
    foco?.focus();
  }

  function fecharModal(modal) {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (estado.modalAberto === modal) {
      estado.modalAberto = null;
      estado.ultimoFocoModal?.focus();
    }
  }

  function prenderFocoModal(e) {
    if (!estado.modalAberto || e.key !== "Tab") return;

    const focaveis = Array.from(estado.modalAberto.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"));
    if (!focaveis.length) return;

    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];

    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  function abrirModalConfirmarApagar() {
    abrirModal(refs.modalConfirmar, refs.modalConfirmar.querySelector("[data-confirmar-apagar='1']"));
  }

  function apagarProgresso() {
    progresso = progressoPadrao();
    salvarProgresso();
    emitir("arrastar:progresso-apagado", {});
    fecharModal(refs.modalConfirmar);
    montarFase(0);
    toast("Progresso apagado. Você recomeçou do início.");
  }

  function atualizarProgressoNoFim(estrelas, pontosFase) {
    const i = estado.faseIndex;
    const melhorAntigo = progresso.melhor[i];
    const estrelasAntigas = progresso.estrelas[i];

    let recorde = false;
    if (pontosFase > melhorAntigo) {
      progresso.melhor[i] = pontosFase;
      recorde = true;
    }

    if (estrelas > estrelasAntigas) {
      progresso.estrelas[i] = estrelas;
      recorde = true;
    }

    let faseDestravada = -1;
    if (i < FASES.length - 1 && !progresso.desbloqueadas[i + 1]) {
      progresso.desbloqueadas[i + 1] = true;
      faseDestravada = i + 1;
      tocar("fase");
    }

    salvarProgresso();
    renderizarCardsFase(faseDestravada);
    atualizarPlacar();

    return { recorde, faseDestravada };
  }

  function abrirModalFimFase(estrelas, bonusEstrelas, detalhes, recorde) {
    const ultima = estado.faseIndex === FASES.length - 1;
    const titulo = ultima ? "Parabéns! Você venceu todas as fases!" : `Fase ${estado.faseIndex + 1} concluída!`;

    const modal = refs.modalFim;
    modal.querySelector("#arr-fim-titulo").textContent = titulo;
    modal.querySelector("#arr-fim-estrelas").innerHTML = estrelasHtml(estrelas);

    const resumo = modal.querySelector("#arr-fim-resumo");
    const resumoFinal = ultima
      ? `
        <div class="arr-final-estrelas-fases">
          ${FASES.map((_, i) => `<p>Fase ${i + 1}: ${estrelasHtml(progresso.estrelas[i])}</p>`).join("")}
        </div>
      `
      : "";

    resumo.innerHTML = `
      <p>Acertos: +${detalhes.pontosAcertos}</p>
      <p>Bônus de sequência: +${detalhes.bonusSequencia}</p>
      <p>Erros: -${detalhes.perdaErros}</p>
      <p>Dicas: -${detalhes.perdaDicas}</p>
      <p>Bônus de estrelas: +${bonusEstrelas}</p>
      <p><strong>Total da fase: ${estado.pontosFase}</strong></p>
      ${recorde ? "<p class='novo-recorde'>Novo recorde!</p>" : ""}
      ${ultima ? `<p><strong>Pontuação total: ${totalSalvo()}</strong></p>` : ""}
      ${resumoFinal}
    `;

    const acoes = modal.querySelector("#arr-fim-acoes");
    acoes.innerHTML = `
      <button type="button" data-fim-acao="next">${ultima ? "Jogar de novo" : "Próxima fase"}</button>
      <button type="button" data-fim-acao="repeat">Repetir fase</button>
      <button type="button" data-fim-acao="close">Fechar</button>
    `;

    if (!reduzMovimento) {
      const estrelasEls = Array.from(modal.querySelectorAll(".estrela"));
      estrelasEls.forEach((el, i) => {
        el.style.opacity = "0";
        setTimeout(() => {
          el.style.opacity = "1";
          el.animate(
            [
              { transform: "scale(0.4)", opacity: 0 },
              { transform: "scale(1.18)", opacity: 1 },
              { transform: "scale(1)", opacity: 1 }
            ],
            { duration: 420, easing: "ease-out" }
          );
          tocar("clique");
        }, i * 120);
      });
    }

    abrirModal(modal, acoes.querySelector("button"));
  }

  function concluirFase() {
    if (estado.concluida) return;
    estado.concluida = true;

    const estrelas = estrelasPorErros(estado.erros);
    const bonusEstrelas = estrelas * BONUS_POR_ESTRELA;
    const detalhes = {
      pontosAcertos: estado.acertos * PONTOS_ACERTO,
      bonusSequencia: estado.bonusSequenciaTotal,
      perdaErros: estado.erros * Math.abs(PONTOS_ERRO),
      perdaDicas: estado.penalidadeDicasTotal
    };

    // Bônus final de estrelas.
    ajustarPontos(bonusEstrelas, posCentro(refs.pontosFase));

    const { recorde } = atualizarProgressoNoFim(estrelas, estado.pontosFase);

    if (typeof window.rajadaDeNeve === "function") {
      window.rajadaDeNeve();
    }

    tocar(estado.faseIndex === FASES.length - 1 ? "vitoria" : "fase");

    emitir("arrastar:fase-concluida", {
      fase: estado.faseIndex + 1,
      estrelas,
      pontosFase: estado.pontosFase,
      recorde
    });

    abrirModalFimFase(estrelas, bonusEstrelas, detalhes, recorde);
    anunciar(`Fase concluída com ${estrelas} estrela${estrelas > 1 ? "s" : ""}.`);
  }

  function posicionarChip(chip, dropzone, pontoEvento = null) {
    if (!chip || !dropzone || !slotLivre(dropzone) || estado.concluida) return false;

    const slot = estado.slots.find((s) => s.id === dropzone.dataset.slotId);
    if (!slot || slot.resolvida) return false;

    const respostaChip = chip.dataset.resposta;
    const origemDelta = pontoEvento || posCentro(dropzone);

    if (respostaChip !== slot.resposta) {
      estado.erros += 1;
      estado.sequencia = 0;
      ajustarPontos(PONTOS_ERRO, origemDelta);
      atualizarPlacar();
      marcarErroVisual(chip);
      tocar("erro");
      vibrar(16);
      anunciar("Quase! Tente outra pista.");
      emitir("arrastar:erro", {
        fase: estado.faseIndex + 1,
        errosNaFase: estado.erros,
        pontosFase: estado.pontosFase
      });
      return false;
    }

    // Robustez: impede pontuação dupla do mesmo slot.
    if (estado.pontuadosSlots.has(slot.id)) return false;
    estado.pontuadosSlots.add(slot.id);

    slot.resolvida = true;
    estado.acertos += 1;
    estado.sequencia += 1;

    const bonus = bonusSequencia(estado.sequencia);
    estado.bonusSequenciaTotal += bonus;
    ajustarPontos(PONTOS_ACERTO + bonus, origemDelta);

    dropzone.classList.add("preenchida", "preenchida-correta");
    dropzone.disabled = true;
    dropzone.innerHTML = "";
    dropzone.appendChild(criarChipFixado(nomeChip(respostaChip)));

    chip.dataset.usado = "1";
    chip.hidden = true;
    chip.classList.add("travado");

    efeitoParticulas(dropzone);
    tocar("acerto");
    vibrar(30);
    anunciar("Boa! Essa resposta combina com a pista.");

    atualizarPlacar();

    emitir("arrastar:acerto", {
      fase: estado.faseIndex + 1,
      acertosNaFase: estado.acertos,
      totalNaFase: estado.slots.length,
      pontosFase: estado.pontosFase,
      sequencia: estado.sequencia
    });

    if (estado.acertos === estado.slots.length) {
      concluirFase();
    }

    return true;
  }

  function usarDica() {
    if (estado.concluida) return;
    if (estado.dicasUsadas >= MAX_DICAS_FASE) {
      toast("Você já usou as 2 dicas desta fase.");
      return;
    }

    const pendentes = estado.slots.filter((s) => !s.resolvida);
    if (!pendentes.length) return;

    const escolhida = pendentes[Math.floor(Math.random() * pendentes.length)];
    const chip = refs.chips.querySelector(`.arr-chip[data-resposta="${escolhida.resposta}"]:not([data-usado='1'])`);
    if (!chip) {
      toast("Nenhum chip disponível para dica no momento.");
      return;
    }

    estado.dicasUsadas += 1;
    estado.penalidadeDicasTotal += Math.abs(PONTOS_DICA);
    estado.sequencia = 0;
    ajustarPontos(PONTOS_DICA, posCentro(chip));
    atualizarDicasTexto();
    atualizarPlacar();

    chip.classList.add("dica");
    if (!reduzMovimento) {
      chip.animate(
        [
          { boxShadow: "0 0 0 0 #2ec4b600" },
          { boxShadow: "0 0 0 10px #2ec4b622" },
          { boxShadow: "0 0 0 0 #2ec4b600" }
        ],
        { duration: 800, iterations: 4 }
      );
    }

    setTimeout(() => chip.classList.remove("dica"), 3000);
    anunciar("Dica ativada! Observe o chip em destaque.");
  }

  function iniciarArraste(chip, e) {
    if (chip.dataset.usado === "1" || estado.concluida) return;
    cancelarArraste(true);

    chip.setPointerCapture(e.pointerId);
    const ghost = criarFantasma(chip.textContent || "");
    const rot = (Math.random() - 0.5) * 6;
    posicionarFantasma(ghost, e.clientX, e.clientY, rot);

    chip.classList.add("arrastando-origem");
    estado.drag = {
      pointerId: e.pointerId,
      chipId: chip.dataset.chipId,
      chipEl: chip,
      ghost,
      rot,
      moveu: false
    };
  }

  function aoPointerDown(e) {
    const chip = e.target.closest(".arr-chip");
    if (!chip || !root.contains(chip)) return;
    if (chip.dataset.usado === "1") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    e.preventDefault();
    marcarPrimeiraInteracao();
    iniciarArraste(chip, e);
  }

  function aoPointerMove(e) {
    if (!estado.drag || e.pointerId !== estado.drag.pointerId) return;

    estado.drag.moveu = true;
    posicionarFantasma(estado.drag.ghost, e.clientX, e.clientY, estado.drag.rot);
    const zona = obterDropzoneSobPonteiro(e.clientX, e.clientY);
    destacarDropzone(zona);
    autoScrollNaBorda(e.clientY);
  }

  function aoPointerUpOuCancel(e) {
    if (!estado.drag || e.pointerId !== estado.drag.pointerId) return;

    const drag = estado.drag;
    const zona = obterDropzoneSobPonteiro(e.clientX, e.clientY);
    const livre = slotLivre(zona);

    if (livre) {
      const certo = posicionarChip(drag.chipEl, zona, { x: e.clientX, y: e.clientY });
      if (certo) {
        estado.bloquearCliqueAte = performance.now() + 160;
        encerrarArraste({ retorno: false, manterChipApagado: true });
        return;
      }
    }

    encerrarArraste({ retorno: true, manterChipApagado: false });
    if (drag.moveu) estado.bloquearCliqueAte = performance.now() + 160;
  }

  // Caminho único para abrir fase, usado pelo card e pela trilha.
  function tentarAbrirFase(indice, origemEl = null) {
    if (!Number.isInteger(indice) || indice < 0 || indice >= FASES.length) return;

    if (!progresso.desbloqueadas[indice]) {
      if (origemEl) {
        origemEl.classList.remove("travar-shake");
        void origemEl.offsetWidth;
        origemEl.classList.add("travar-shake");
      }
      toast("Essa fase ainda está bloqueada. Complete a anterior primeiro.");
      return;
    }

    montarFase(indice);
  }

  function aoClique(e) {
    if (performance.now() < estado.bloquearCliqueAte) return;

    const faseCard = e.target.closest(".arrastar-fase-card");
    if (faseCard) {
      const idx = Number(faseCard.dataset.phaseIndex);
      tentarAbrirFase(idx, faseCard);
      return;
    }

    if (e.target.closest("#arrastar-reiniciar")) {
      montarFase(estado.faseIndex);
      return;
    }

    if (e.target.closest("#arrastar-dica")) {
      usarDica();
      return;
    }

    if (e.target.closest("#arrastar-apagar-progresso")) {
      abrirModalConfirmarApagar();
      return;
    }

    if (e.target.closest("[data-confirmar-apagar='1']")) {
      apagarProgresso();
      return;
    }

    if (e.target.closest("[data-close-confirmar='1']")) {
      fecharModal(refs.modalConfirmar);
      return;
    }

    if (e.target.closest("[data-close-fim='1']")) {
      fecharModal(refs.modalFim);
      return;
    }

    const fimAcao = e.target.closest("[data-fim-acao]");
    if (fimAcao) {
      const acao = fimAcao.dataset.fimAcao;
      if (acao === "close") {
        fecharModal(refs.modalFim);
      } else if (acao === "repeat") {
        fecharModal(refs.modalFim);
        montarFase(estado.faseIndex);
      } else if (acao === "next") {
        fecharModal(refs.modalFim);
        if (estado.faseIndex === FASES.length - 1) {
          montarFase(0);
        } else {
          montarFase(estado.faseIndex + 1);
        }
      }
      return;
    }

    const chip = e.target.closest(".arr-chip");
    if (chip && refs.chips.contains(chip) && chip.dataset.usado !== "1") {
      marcarPrimeiraInteracao();
      const ja = estado.chipSelecionado === chip.dataset.chipId;
      if (ja) limparSelecaoChip();
      else selecionarChip(chip.dataset.chipId);
      return;
    }

    const zona = e.target.closest(".arrastar-dropzone");
    if (zona && slotLivre(zona) && estado.chipSelecionado) {
      marcarPrimeiraInteracao();
      const chipSel = pegarChipPorId(estado.chipSelecionado);
      if (!chipSel) return;
      posicionarChip(chipSel, zona, posCentro(zona));
      limparSelecaoChip();
    }
  }

  function aoKeydown(e) {
    if (e.key === "Escape") {
      if (estado.modalAberto) {
        e.preventDefault();
        fecharModal(estado.modalAberto);
      }
      return;
    }

    prenderFocoModal(e);

    if (!["Enter", " ", "Spacebar"].includes(e.key)) return;
    const alvo = e.target;
    if (!(alvo instanceof HTMLElement)) return;

    const chip = alvo.closest(".arr-chip");
    if (chip && refs.chips.contains(chip) && chip.dataset.usado !== "1") {
      e.preventDefault();
      marcarPrimeiraInteracao();
      selecionarChip(chip.dataset.chipId);
      return;
    }

    const zona = alvo.closest(".arrastar-dropzone");
    if (zona && slotLivre(zona) && estado.chipSelecionado) {
      e.preventDefault();
      marcarPrimeiraInteracao();
      const chipSel = pegarChipPorId(estado.chipSelecionado);
      if (!chipSel) return;
      posicionarChip(chipSel, zona, posCentro(zona));
      limparSelecaoChip();
    }
  }

  function ligarEventos() {
    root.addEventListener("pointerdown", aoPointerDown);
    root.addEventListener("click", aoClique);
    root.addEventListener("keydown", aoKeydown);

    window.addEventListener("pointermove", aoPointerMove, { passive: true });
    window.addEventListener("pointerup", aoPointerUpOuCancel);
    window.addEventListener("pointercancel", aoPointerUpOuCancel);
    window.addEventListener("blur", () => cancelarArraste(true));

    const observer = new MutationObserver(() => {
      if (painelArrastar.hidden) {
        cancelarArraste(true);
      }
    });

    observer.observe(painelArrastar, {
      attributes: true,
      attributeFilter: ["hidden"]
    });

    // Listener único para a trilha pedir troca de fase.
    document.addEventListener("trilha:escolher-fase", (e) => {
      const fase = Number(e.detail?.fase);
      if (!Number.isFinite(fase)) return;
      tentarAbrirFase(fase - 1);
    });
  }

  function carregarInteracaoArrastar() {
    try {
      estado.primeiraInteracaoArrastar = localStorage.getItem("cruzadinha.arrastar.interagiu") === "1";
    } catch {
      estado.primeiraInteracaoArrastar = false;
    }
  }

  function iniciar() {
    validarFases();
    construirLayoutBase();
    carregarInteracaoArrastar();

    progresso = carregarProgresso();
    emitir("arrastar:progresso-carregado", copiaProgresso(progresso));

    renderizarCardsFase();
    ligarEventos();
    montarFase(0);
  }

  iniciar();
})();
