(() => {
  "use strict";

  const root = document.getElementById("arrastar-root");
  const painelArrastar = document.getElementById("painel-arrastar");
  if (!root || !painelArrastar) return;

  // Fonte única: tenta usar PALAVRAS já carregada no escopo global.
  const fontePalavras = typeof PALAVRAS !== "undefined" ? PALAVRAS : globalThis.PALAVRAS;
  if (!Array.isArray(fontePalavras)) {
    console.error("[ARRASTAR] PALAVRAS não encontrada. Verifique a ordem de scripts.");
    root.innerHTML = "<p class='arrastar-live'>Erro ao iniciar o modo arrastar.</p>";
    return;
  }

  // Dados pedidos da atividade.
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

  // Grupos que costumam confundir o jogador.
  // Na fase 5, evitamos distratores do mesmo grupo das respostas para manter justiça.
  const GRUPOS_CONFUNDIVEIS = [
    ["ROM", "FLASH", "EEPROM"],
    ["ADDRESSBUS", "DATABUS"],
    ["RAM", "CACHE"],
    ["CPU", "MICROCONTROLADOR", "UC", "ULA"]
  ];

  const prefereReduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mapaPalavras = new Map(fontePalavras.map((p) => [p.resposta, p]));

  const estado = {
    faseIndex: 0,
    faseDados: null,
    slots: [],
    chips: [],
    colocadas: new Set(),
    acertos: 0,
    erros: 0,
    chipSelecionado: null,
    drag: null,
    bloquearCliqueAte: 0,
    primeiraInteracaoArrastar: false
  };

  const refs = {
    faseNome: null,
    faseIndice: null,
    fases: null,
    acertos: null,
    erros: null,
    pistas: null,
    chips: null,
    fim: null,
    live: null
  };

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
    if (prefereReduzirMovimento) return;
    try {
      if ("vibrate" in navigator) {
        navigator.vibrate(ms);
      }
    } catch {
      // Alguns ambientes podem bloquear vibração.
    }
  }

  function anunciar(texto) {
    if (!refs.live) return;
    refs.live.textContent = "";
    requestAnimationFrame(() => {
      refs.live.textContent = texto;
    });
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

  function pertenceGrupoConfundivel(resposta, respostasDaFase) {
    return GRUPOS_CONFUNDIVEIS.some((grupo) => grupo.includes(resposta) && respostasDaFase.some((item) => grupo.includes(item)));
  }

  function gerarFaseCinco(cfg) {
    const todas = fontePalavras.map((p) => p.resposta);
    const respostas = embaralhar(todas).slice(0, cfg.sorteio);
    const restantes = todas.filter((r) => !respostas.includes(r));

    // Justiça: removemos distratores "primos" das respostas da rodada,
    // para evitar pegadinha de família de termos muito parecidos.
    const candidatosJustos = restantes.filter((r) => !pertenceGrupoConfundivel(r, respostas));

    let extras = embaralhar(candidatosJustos).slice(0, cfg.quantidadeExtras);

    // Fallback: se faltar candidato justo (caso raro), completa com os restantes.
    if (extras.length < cfg.quantidadeExtras) {
      const faltam = cfg.quantidadeExtras - extras.length;
      const reserva = embaralhar(restantes.filter((r) => !extras.includes(r))).slice(0, faltam);
      extras = [...extras, ...reserva];
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
        <button class="arrastar-reiniciar" id="arrastar-reiniciar" type="button">Reiniciar fase</button>
      </section>

      <section class="arrastar-jogo reveal-on-scroll">
        <div class="arrastar-placar">
          <p class="arrastar-selo" id="arrastar-acertos">Acertos 0 / 0</p>
          <p class="arrastar-selo" id="arrastar-erros">Erros 0</p>
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

      <section class="arrastar-fim" id="arrastar-fim" hidden></section>

      <p class="arrastar-live" id="arrastar-live" aria-live="polite"></p>
    `;

    refs.faseNome = document.getElementById("arrastar-fase-info");
    refs.fases = document.getElementById("arrastar-fases");
    refs.acertos = document.getElementById("arrastar-acertos");
    refs.erros = document.getElementById("arrastar-erros");
    refs.pistas = document.getElementById("arrastar-grade-pistas");
    refs.chips = document.getElementById("arrastar-chips");
    refs.fim = document.getElementById("arrastar-fim");
    refs.live = document.getElementById("arrastar-live");

    refs.fases.innerHTML = FASES.map((_, i) => `
      <button class="arrastar-fase-btn" data-phase-index="${i}" type="button">${String(i + 1).padStart(2, "0")}</button>
    `).join("");
  }

  function atualizarPlacar() {
    refs.acertos.textContent = `Acertos ${estado.acertos} / ${estado.slots.length}`;
    refs.erros.textContent = `Erros ${estado.erros}`;
  }

  function atualizarCabecalhoFase() {
    const faseNumero = estado.faseIndex + 1;
    refs.faseNome.textContent = `Fase ${faseNumero} de 5 · ${estado.faseDados.nome}`;

    refs.fases.querySelectorAll(".arrastar-fase-btn").forEach((btn) => {
      const ativa = Number(btn.dataset.phaseIndex) === estado.faseIndex;
      btn.classList.toggle("ativa", ativa);
      btn.setAttribute("aria-current", ativa ? "true" : "false");
    });
  }

  function criarSlotsDaFase() {
    estado.slots = estado.faseDados.respostas
      .map((resposta, indice) => {
        const palavra = mapaPalavras.get(resposta);
        if (!palavra) {
          console.error(`[ARRASTAR] Resposta "${resposta}" não encontrada para montar slot.`);
          return null;
        }

        return {
          id: `slot-${indice}`,
          resposta,
          n: palavra.n,
          pista: palavra.pista
        };
      })
      .filter(Boolean);
  }

  function criarChipsDaFase() {
    const chips = [
      ...estado.faseDados.respostas.map((resposta) => ({ resposta, extra: false })),
      ...estado.faseDados.extras.map((resposta) => ({ resposta, extra: true }))
    ];

    estado.chips = embaralhar(chips).map((chip, i) => ({
      id: `chip-${estado.faseIndex}-${i}`,
      resposta: chip.resposta,
      extra: chip.extra,
      rotulo: nomeChip(chip.resposta)
    }));
  }

  function renderizarPistas() {
    refs.pistas.innerHTML = estado.slots.map((slot) => `
      <article class="arrastar-pista-card" data-slot-wrap="${slot.id}">
        <p class="arrastar-pista-num">${slot.n}.</p>
        <p class="arrastar-pista-texto">${slot.pista}</p>
        <button class="arrastar-dropzone" data-slot-id="${slot.id}" type="button" aria-label="Área para a pista ${slot.n}">
          SOLTE AQUI
        </button>
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

  function limparFimDeFase() {
    refs.fim.hidden = true;
    refs.fim.innerHTML = "";
  }

  function montarFase(indice) {
    cancelarArraste(true);

    estado.faseIndex = indice;
    estado.faseDados = dadosDaFase(indice);
    estado.colocadas = new Set();
    estado.acertos = 0;
    estado.erros = 0;
    estado.chipSelecionado = null;

    criarSlotsDaFase();
    criarChipsDaFase();
    atualizarCabecalhoFase();
    atualizarPlacar();
    renderizarPistas();
    renderizarChips();
    limparFimDeFase();

    const ajuda = document.getElementById("arrastar-banco-ajuda");
    if (ajuda && !estado.primeiraInteracaoArrastar) {
      ajuda.classList.add("pulsando");
    }

    const primeiraZona = refs.pistas.querySelector(".arrastar-dropzone");
    if (primeiraZona && !estado.primeiraInteracaoArrastar && !prefereReduzirMovimento) {
      primeiraZona.classList.add("ativa");
      setTimeout(() => primeiraZona.classList.remove("ativa"), 900);
    }
  }

  function pegarChipPorId(chipId) {
    return refs.chips.querySelector(`.arr-chip[data-chip-id="${chipId}"]`);
  }

  function limparSelecaoChip() {
    estado.chipSelecionado = null;
    refs.chips.querySelectorAll(".arr-chip.selecionado").forEach((chip) => chip.classList.remove("selecionado"));
  }

  function selecionarChip(chipId) {
    limparSelecaoChip();
    const chip = pegarChipPorId(chipId);
    if (!chip || chip.dataset.usado === "1") return;

    estado.chipSelecionado = chipId;
    chip.classList.add("selecionado");
  }

  function slotLivre(dropzone) {
    return dropzone && dropzone.classList.contains("arrastar-dropzone") && !dropzone.classList.contains("preenchida");
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
    if (prefereReduzirMovimento) return;
    const rect = alvo.getBoundingClientRect();
    const burst = document.createElement("div");
    burst.className = "arr-burst";
    burst.style.left = `${rect.left + rect.width / 2}px`;
    burst.style.top = `${rect.top + rect.height / 2}px`;

    for (let i = 0; i < 10; i++) {
      const p = document.createElement("span");
      const ang = (Math.PI * 2 * i) / 10;
      const dist = 18 + Math.random() * 26;
      p.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
      p.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
      burst.appendChild(p);
    }

    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 460);
  }

  function marcarErroVisual(chip) {
    chip.classList.remove("erro");
    void chip.offsetWidth;
    chip.classList.add("erro");

    const antigo = chip.querySelector(".icone-status");
    if (antigo) antigo.remove();

    const erro = document.createElement("span");
    erro.className = "icone-status erro";
    erro.textContent = "✘";
    chip.appendChild(erro);

    setTimeout(() => {
      erro.remove();
      chip.classList.remove("erro");
    }, 450);
  }

  function verificarFimDeFase() {
    if (estado.acertos !== estado.slots.length) return;

    tocar("fase");
    if (typeof window.rajadaDeNeve === "function") {
      window.rajadaDeNeve();
    }

    const ultimaFase = estado.faseIndex === FASES.length - 1;
    refs.fim.hidden = false;
    refs.fim.innerHTML = `
      <h4>FASE CONCLUÍDA</h4>
      <p>${estado.acertos} acertos · ${estado.erros} erros</p>
      <div class="arrastar-fim-acoes">
        <button type="button" data-acao="next">${ultimaFase ? "Jogar de novo" : "Próxima fase"}</button>
        <button type="button" data-acao="repeat">Repetir fase</button>
      </div>
    `;

    anunciar(`Fase concluída com ${estado.acertos} acertos e ${estado.erros} erros.`);
  }

  function posicionarChip(chip, dropzone) {
    if (!chip || !dropzone || !slotLivre(dropzone)) return false;

    const slotId = dropzone.dataset.slotId;
    const slot = estado.slots.find((item) => item.id === slotId);
    if (!slot) return false;

    const respostaChip = chip.dataset.resposta;
    if (respostaChip !== slot.resposta) {
      estado.erros += 1;
      atualizarPlacar();
      marcarErroVisual(chip);
      tocar("erro");
      vibrar(14);
      anunciar("Quase! Tente outra pista.");
      return false;
    }

    estado.acertos += 1;
    estado.colocadas.add(slotId);
    atualizarPlacar();

    dropzone.classList.add("preenchida", "preenchida-correta");
    dropzone.disabled = true;
    dropzone.innerHTML = "";
    dropzone.appendChild(criarChipFixado(nomeChip(respostaChip)));

    chip.dataset.usado = "1";
    chip.classList.add("travado");
    chip.hidden = true;

    efeitoParticulas(dropzone);
    tocar("acerto");
    vibrar(30);
    anunciar("Boa! Essa resposta combina com a pista.");

    verificarFimDeFase();
    return true;
  }

  function obterDropzoneSobPonteiro(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const zona = el.closest(".arrastar-dropzone");
    if (!zona || !root.contains(zona)) return null;
    return zona;
  }

  function destacarDropzone(dropzone) {
    root.querySelectorAll(".arrastar-dropzone.ativa").forEach((z) => z.classList.remove("ativa"));
    if (dropzone && slotLivre(dropzone)) {
      dropzone.classList.add("ativa");
    }
  }

  function criarFantasma(texto) {
    const ghost = document.createElement("div");
    ghost.className = "arr-ghost";
    ghost.textContent = texto;
    document.body.appendChild(ghost);
    return ghost;
  }

  function posicionarFantasma(ghost, x, y, rot = 0) {
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    ghost.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
  }

  function animarRetornoFantasma(dragState) {
    const { ghost, chipEl } = dragState;
    const rect = chipEl.getBoundingClientRect();

    const anim = ghost.animate(
      [
        { left: ghost.style.left, top: ghost.style.top, opacity: 1, transform: ghost.style.transform },
        {
          left: `${rect.left + rect.width / 2}px`,
          top: `${rect.top + rect.height / 2}px`,
          opacity: 0.2,
          transform: "translate(-50%, -50%) scale(0.84) rotate(0deg)"
        }
      ],
      { duration: 220, easing: "ease-out" }
    );

    anim.onfinish = () => {
      ghost.remove();
      chipEl.classList.remove("arrastando-origem");
    };
  }

  function encerrarArraste({ manterChipApagado = false, retorno = true } = {}) {
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

  function autoScrollNaBorda(clientY) {
    const margem = 60;
    const passo = 14;
    if (clientY < margem) {
      window.scrollBy(0, -passo);
    } else if (clientY > window.innerHeight - margem) {
      window.scrollBy(0, passo);
    }
  }

  function iniciarArraste(chip, e) {
    if (chip.dataset.usado === "1") return;
    cancelarArraste(true);

    chip.setPointerCapture(e.pointerId);
    const ghost = criarFantasma(chip.textContent || "");
    const rot = (Math.random() - 0.5) * 6;
    posicionarFantasma(ghost, e.clientX, e.clientY, rot);

    chip.classList.add("arrastando-origem");
    estado.drag = {
      pointerId: e.pointerId,
      chipId: chip.dataset.chipId,
      resposta: chip.dataset.resposta,
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

    // Apenas botão principal do mouse/toque.
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
      const certo = posicionarChip(drag.chipEl, zona);

      if (certo) {
        estado.bloquearCliqueAte = performance.now() + 160;
        encerrarArraste({ manterChipApagado: true, retorno: false });
        return;
      }
    }

    // Fora da área ou erro: volta ao banco suavemente.
    encerrarArraste({ retorno: true, manterChipApagado: false });
    if (drag.moveu) {
      estado.bloquearCliqueAte = performance.now() + 180;
    }
  }

  function aoClique(e) {
    if (performance.now() < estado.bloquearCliqueAte) return;

    const botaoFase = e.target.closest(".arrastar-fase-btn");
    if (botaoFase) {
      const indice = Number(botaoFase.dataset.phaseIndex);
      montarFase(indice);
      return;
    }

    if (e.target.closest("#arrastar-reiniciar")) {
      montarFase(estado.faseIndex);
      return;
    }

    const acaoFim = e.target.closest("[data-acao]");
    if (acaoFim) {
      const acao = acaoFim.dataset.acao;
      if (acao === "repeat") {
        montarFase(estado.faseIndex);
      } else if (acao === "next") {
        if (estado.faseIndex === FASES.length - 1) {
          montarFase(FASES.length - 1);
        } else {
          montarFase(estado.faseIndex + 1);
        }
      }
      return;
    }

    const chip = e.target.closest(".arr-chip");
    if (chip && refs.chips.contains(chip) && chip.dataset.usado !== "1") {
      marcarPrimeiraInteracao();
      const jaSelecionado = estado.chipSelecionado === chip.dataset.chipId;
      if (jaSelecionado) {
        limparSelecaoChip();
      } else {
        selecionarChip(chip.dataset.chipId);
      }
      return;
    }

    const dropzone = e.target.closest(".arrastar-dropzone");
    if (dropzone && slotLivre(dropzone) && estado.chipSelecionado) {
      marcarPrimeiraInteracao();
      const chipSel = pegarChipPorId(estado.chipSelecionado);
      if (!chipSel) return;
      posicionarChip(chipSel, dropzone);
      limparSelecaoChip();
    }
  }

  function aoKeydown(e) {
    const alvo = e.target;
    if (!(alvo instanceof HTMLElement)) return;

    if (!["Enter", " ", "Spacebar"].includes(e.key)) return;

    const chip = alvo.closest(".arr-chip");
    if (chip && refs.chips.contains(chip) && chip.dataset.usado !== "1") {
      e.preventDefault();
      marcarPrimeiraInteracao();
      selecionarChip(chip.dataset.chipId);
      return;
    }

    const dropzone = alvo.closest(".arrastar-dropzone");
    if (dropzone && slotLivre(dropzone) && estado.chipSelecionado) {
      e.preventDefault();
      marcarPrimeiraInteracao();
      const chipSel = pegarChipPorId(estado.chipSelecionado);
      if (!chipSel) return;
      posicionarChip(chipSel, dropzone);
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

    // Se o usuário trocar de aba no meio do arraste, limpa o fantasma.
    const observer = new MutationObserver(() => {
      if (painelArrastar.hidden) {
        cancelarArraste(true);
      }
    });

    observer.observe(painelArrastar, {
      attributes: true,
      attributeFilter: ["hidden"]
    });
  }

  function marcarPrimeiraInteracao() {
    if (estado.primeiraInteracaoArrastar) return;
    estado.primeiraInteracaoArrastar = true;

    const ajuda = document.getElementById("arrastar-banco-ajuda");
    ajuda?.classList.remove("pulsando");
    refs.pistas.querySelectorAll(".arrastar-dropzone.ativa").forEach((z) => z.classList.remove("ativa"));

    try {
      localStorage.setItem("cruzadinha.arrastar.interagiu", "1");
    } catch {
      // localStorage pode falhar em contexto restrito.
    }
  }

  validarFases();
  try {
    estado.primeiraInteracaoArrastar = localStorage.getItem("cruzadinha.arrastar.interagiu") === "1";
  } catch {
    estado.primeiraInteracaoArrastar = false;
  }
  construirLayoutBase();
  ligarEventos();
  montarFase(0);
})();
