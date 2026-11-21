(() => {
  "use strict";

  const painelArrastar = document.getElementById("painel-arrastar");
  const arrastarRoot = document.getElementById("arrastar-root");
  if (!painelArrastar || !arrastarRoot) return;

  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const FASE_NOMES = [
    "Dentro da CPU",
    "Memórias",
    "Guardar e copiar",
    "Fios e chips",
    "Desafio final"
  ];

  const FLAG_PERCENT = [0.2, 0.4, 0.6, 0.8, 1];

  const estado = {
    desbloqueadas: [true, false, false, false, false],
    estrelas: [0, 0, 0, 0, 0],
    melhor: [0, 0, 0, 0, 0],
    concluidas: 0,
    faseAtual: 1,
    acertosNaFase: 0,
    totalNaFase: 0,
    currentFraction: 0,
    targetFraction: 0,
    rafMovimento: 0,
    ultimoPassoIndex: -1
  };

  const refs = {
    card: null,
    status: null,
    badge: null,
    svg: null,
    caminho: null,
    progresso: null,
    flagsLayer: null,
    explorerWrap: null,
    explorerShadow: null,
    speech: null,
    speechText: null
  };

  let comprimentoTrilha = 0;
  let flags = [];
  let timeoutFala = 0;

  function tocar(nome) {
    if (typeof window.tocarSom === "function") {
      window.tocarSom(nome);
    }
  }

  function trilhaFractionCalculada() {
    const conclu = estado.concluidas;
    const parcial = estado.faseAtual === conclu + 1 && estado.totalNaFase > 0
      ? estado.acertosNaFase / estado.totalNaFase
      : 0;

    return Math.max(0, Math.min(1, (conclu + parcial) / 5));
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function construirCard() {
    if (document.getElementById("trilha-card")) return;

    const card = document.createElement("section");
    card.id = "trilha-card";
    card.className = "trilha-card reveal-on-scroll";
    card.innerHTML = `
      <div class="trilha-topo">
        <p id="trilha-status" class="trilha-status">Sua jornada: Fase 1 de 5 · 0 de 0 respostas certas</p>
        <span class="trilha-badge">Trilha na neve</span>
      </div>

      <svg
        id="trilha-svg"
        class="trilha-svg"
        viewBox="0 0 800 320"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Trilha com 5 fases. O explorador está na fase 1."
      >
        <defs>
          <linearGradient id="ceu-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#204561" />
            <stop offset="100%" stop-color="#3e617d" />
          </linearGradient>
          <linearGradient id="neve-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#f5fbff" />
            <stop offset="100%" stop-color="#dceaf7" />
          </linearGradient>
          <filter id="brilho-bandeira" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width="800" height="320" fill="url(#ceu-grad)" />

        <path d="M0 240L120 170L250 240L420 140L610 240L800 170V320H0Z" fill="#6f8fa84e" />
        <path d="M0 268L110 220L240 268L390 190L560 268L760 205L800 218V320H0Z" fill="#1e4dd84f" />
        <path d="M0 290L90 256L230 290L360 236L520 290L700 246L800 262V320H0Z" fill="url(#neve-grad)" />

        <g id="pinheiros" opacity="0.92">
          <path d="M98 250l8-16 8 16h-5l4 8h-14l4-8z" fill="#eaf4fb" />
          <path d="M238 264l9-18 9 18h-6l5 9h-16l5-9z" fill="#eaf4fb" />
          <path d="M520 246l10-20 10 20h-7l6 10h-18l6-10z" fill="#eaf4fb" />
          <path d="M692 228l8-16 8 16h-5l4 8h-14l4-8z" fill="#eaf4fb" />
        </g>

        <g id="acampamento" transform="translate(52 270)">
          <circle cx="0" cy="0" r="6" fill="#ffde7a" opacity="0.9" />
          <path d="M-18 10l18-24 18 24z" fill="#1e4dd8" />
          <path d="M-7 10l7-9 7 9z" fill="#bff3ea" />
        </g>

        <g id="bandeira-final" transform="translate(744 36)">
          <line x1="0" y1="0" x2="0" y2="-40" stroke="#f2f8ff" stroke-width="4" />
          <path d="M2 -38h30v16h-30z" fill="#1e4dd8" />
          <path d="M6 -34h11v8H6z" fill="#bff3ea" />
        </g>

        <path
          id="caminho-trilha"
          class="trilha-caminho-base"
          d="M58 272 C130 226 188 248 252 204 C316 162 368 183 430 140 C498 94 548 118 614 78 C666 48 710 58 744 36"
        />

        <path
          id="caminho-progresso"
          class="trilha-caminho-progresso"
          d="M58 272 C130 226 188 248 252 204 C316 162 368 183 430 140 C498 94 548 118 614 78 C666 48 710 58 744 36"
        />

        <g id="flags-layer"></g>

        <g id="explorer-wrap" class="explorer-wrap parado" transform="translate(58 272)">
          <ellipse id="explorer-shadow" cx="0" cy="9" rx="12" ry="4" fill="#00122638" />
          <g class="explorer-body" transform="translate(0 -20)">
            <g class="perna-esq" transform="translate(-6 18)">
              <rect x="-3" y="0" width="6" height="13" rx="3" fill="#18324a" />
              <rect x="-5" y="10" width="10" height="4" rx="2" fill="#0b1b28" />
            </g>
            <g class="perna-dir" transform="translate(6 18)">
              <rect x="-3" y="0" width="6" height="13" rx="3" fill="#18324a" />
              <rect x="-5" y="10" width="10" height="4" rx="2" fill="#0b1b28" />
            </g>

            <g class="corpo" transform="translate(0 0)">
              <rect x="-11" y="-2" width="22" height="20" rx="8" fill="#eef6ff" stroke="#1e4dd8" stroke-width="1.5" />
              <rect x="-8" y="2" width="16" height="4" rx="2" fill="#1e4dd8" opacity="0.55" />
            </g>

            <g class="braco-esq" transform="translate(-12 5)">
              <rect x="-2" y="0" width="6" height="12" rx="3" fill="#eef6ff" stroke="#1e4dd8" stroke-width="1" />
            </g>
            <g class="braco-dir" transform="translate(9 5)">
              <rect x="-2" y="0" width="6" height="12" rx="3" fill="#eef6ff" stroke="#1e4dd8" stroke-width="1" />
            </g>

            <g class="cachecol" transform="translate(0 1)">
              <rect x="-9" y="-2" width="18" height="5" rx="2.5" fill="#2ec4b6" />
              <rect x="6" y="0" width="8" height="4" rx="2" fill="#2ec4b6" />
            </g>

            <circle cx="0" cy="-8" r="8" fill="#ffefe2" stroke="#d8b6a2" stroke-width="1" />
            <g class="olhos" fill="#10264f">
              <circle cx="-3" cy="-9" r="1.1" />
              <circle cx="3" cy="-9" r="1.1" />
            </g>
            <path d="M-2 -5 q2 2 4 0" stroke="#b36a6f" stroke-width="1" fill="none" />

            <g class="gorro" transform="translate(0 -18)">
              <path d="M-9 10 q9-12 18 0z" fill="#1e4dd8" />
              <circle cx="0" cy="0" r="3" fill="#fff" />
              <rect x="-9" y="9" width="18" height="3" rx="1.5" fill="#dbe9fb" />
            </g>
          </g>
        </g>

        <g id="trilha-fala" class="fala-bolha" aria-hidden="true">
          <rect x="0" y="0" width="74" height="24" rx="10" fill="#ffffffe8" />
          <text id="trilha-fala-texto" x="37" y="16" text-anchor="middle" font-size="10" fill="#10264f" font-family="Barlow, sans-serif">Vamos!</text>
        </g>
      </svg>
    `;

    painelArrastar.insertBefore(card, arrastarRoot);

    refs.card = card;
    refs.status = card.querySelector("#trilha-status");
    refs.badge = card.querySelector(".trilha-badge");
    refs.svg = card.querySelector("#trilha-svg");
    refs.caminho = card.querySelector("#caminho-trilha");
    refs.progresso = card.querySelector("#caminho-progresso");
    refs.flagsLayer = card.querySelector("#flags-layer");
    refs.explorerWrap = card.querySelector("#explorer-wrap");
    refs.explorerShadow = card.querySelector("#explorer-shadow");
    refs.speech = card.querySelector("#trilha-fala");
    refs.speechText = card.querySelector("#trilha-fala-texto");
  }

  function criarBandeira(index, x, y) {
    const fase = index + 1;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "fase-flag");
    g.setAttribute("data-fase", String(fase));
    g.setAttribute("role", "button");
    g.setAttribute("tabindex", "0");
    g.setAttribute("transform", `translate(${x} ${y})`);

    g.innerHTML = `
      <circle class="fase-hit" r="52"></circle>
      <circle class="fase-anel" r="18"></circle>
      <g class="fase-bandeira">
        <line class="fase-mastro" x1="0" y1="0" x2="0" y2="-34"></line>
        <rect class="fase-pano fase-pulso" x="2" y="-32" width="24" height="14" rx="3"></rect>
        <text x="14" y="-22" text-anchor="middle" font-size="8" fill="#ffffff" font-family="Space Mono, monospace">${fase}</text>
        <text class="fase-estrelas" x="14" y="-38" text-anchor="middle"></text>
        <text class="fase-lock" x="14" y="-21" text-anchor="middle">🔒</text>
      </g>
      <g class="fase-label" transform="translate(-42 10)">
        <rect width="112" height="24" rx="12" fill="#0b1b28cc"></rect>
        <text x="56" y="16" text-anchor="middle" fill="#eaf4fb" font-size="10" font-family="Barlow, sans-serif">${FASE_NOMES[index]}</text>
      </g>
    `;

    g.addEventListener("click", () => onEscolherFase(g, fase));
    g.addEventListener("keydown", (e) => {
      if (["Enter", " ", "Spacebar"].includes(e.key)) {
        e.preventDefault();
        onEscolherFase(g, fase);
      }
    });

    refs.flagsLayer.appendChild(g);
    return g;
  }

  function montarBandeiras() {
    flags = [];
    refs.flagsLayer.innerHTML = "";
    FLAG_PERCENT.forEach((pct, i) => {
      const ponto = refs.caminho.getPointAtLength(comprimentoTrilha * pct);
      flags.push(criarBandeira(i, ponto.x, ponto.y));
    });
  }

  function atualizarAriaSvg() {
    refs.svg.setAttribute("aria-label", `Trilha com 5 fases. O explorador está na fase ${estado.faseAtual}.`);
  }

  function atualizarTextoStatus() {
    const total = estado.totalNaFase || 0;
    const acertos = Math.min(estado.acertosNaFase, total);
    refs.status.textContent = `Sua jornada: Fase ${estado.faseAtual} de 5 · ${acertos} de ${total} respostas certas`;
    atualizarAriaSvg();
  }

  function falar(texto) {
    if (!texto) return;
    clearTimeout(timeoutFala);
    refs.speechText.textContent = texto;
    refs.speech.classList.add("visivel");
    timeoutFala = window.setTimeout(() => {
      refs.speech.classList.remove("visivel");
    }, 1500);
  }

  function atualizarVisualBandeiras() {
    flags.forEach((flag, i) => {
      const fase = i + 1;
      const desbloq = Boolean(estado.desbloqueadas[i]);
      const concl = estado.estrelas[i] > 0;
      const atual = fase === estado.faseAtual;

      flag.classList.toggle("bloqueada", !desbloq);
      flag.classList.toggle("liberada", desbloq && !concl);
      flag.classList.toggle("concluida", concl);
      flag.classList.toggle("atual", atual);

      const estrelasEl = flag.querySelector(".fase-estrelas");
      estrelasEl.textContent = concl ? "★".repeat(Math.max(1, estado.estrelas[i])) : "";

      const lock = flag.querySelector(".fase-lock");
      lock.style.display = desbloq ? "none" : "block";

      const estadoTexto = !desbloq
        ? "bloqueada"
        : concl
          ? `concluída com ${estado.estrelas[i]} estrela${estado.estrelas[i] > 1 ? "s" : ""}`
          : "liberada";

      flag.setAttribute("aria-label", `Fase ${fase}: ${FASE_NOMES[i]}, ${estadoTexto}`);
      flag.setAttribute("aria-disabled", String(!desbloq));
    });
  }

  function atualizarCaminhoProgresso() {
    const dashOffset = comprimentoTrilha * (1 - estado.currentFraction);
    refs.progresso.style.strokeDasharray = `${comprimentoTrilha}`;
    refs.progresso.style.strokeDashoffset = `${dashOffset}`;
  }

  function aplicarClasseExplorador(nome, ms = 0) {
    refs.explorerWrap.classList.remove("andando", "parado", "pulinho", "tropeco", "aceno");
    refs.explorerWrap.classList.add(nome);

    if (ms > 0) {
      window.setTimeout(() => {
        refs.explorerWrap.classList.remove(nome);
        refs.explorerWrap.classList.add("parado");
      }, ms);
    }
  }

  function atualizarPosicaoExplorador() {
    const ponto = refs.caminho.getPointAtLength(comprimentoTrilha * estado.currentFraction);
    const proximo = refs.caminho.getPointAtLength(clamp(comprimentoTrilha * estado.currentFraction + 1.5, 0, comprimentoTrilha));
    const virado = proximo.x < ponto.x ? -1 : 1;

    refs.explorerWrap.setAttribute(
      "transform",
      `translate(${ponto.x.toFixed(2)} ${ponto.y.toFixed(2)}) scale(${virado} 1)`
    );

    refs.speech.setAttribute("transform", `translate(${(ponto.x - 30).toFixed(2)} ${(ponto.y - 56).toFixed(2)})`);
    atualizarCaminhoProgresso();
  }

  function tocarPassos(progressLocal) {
    const indice = Math.floor(progressLocal * 3);
    if (indice !== estado.ultimoPassoIndex && indice >= 0 && indice <= 2) {
      estado.ultimoPassoIndex = indice;
      tocar("passo");
    }
  }

  function moverPara(fracao, animar = true) {
    const destino = clamp(fracao, 0, 1);
    estado.targetFraction = Math.max(estado.targetFraction, destino);

    if (!animar || reduzMovimento) {
      cancelAnimationFrame(estado.rafMovimento);
      estado.rafMovimento = 0;
      estado.currentFraction = Math.max(estado.currentFraction, estado.targetFraction);
      estado.targetFraction = estado.currentFraction;
      aplicarClasseExplorador("parado");
      atualizarPosicaoExplorador();
      return;
    }

    const inicio = estado.currentFraction;
    const fim = Math.max(inicio, estado.targetFraction);
    if (Math.abs(fim - inicio) < 0.0001) return;

    cancelAnimationFrame(estado.rafMovimento);
    const distancia = Math.abs(fim - inicio);
    const duracao = clamp(700 + distancia * 1300, 700, 1000);
    const t0 = performance.now();
    estado.ultimoPassoIndex = -1;
    aplicarClasseExplorador("andando");

    const tick = (agora) => {
      const p = clamp((agora - t0) / duracao, 0, 1);
      const eased = easeInOutCubic(p);
      estado.currentFraction = inicio + (fim - inicio) * eased;
      atualizarPosicaoExplorador();
      tocarPassos(p);

      if (p < 1) {
        estado.rafMovimento = requestAnimationFrame(tick);
      } else {
        estado.currentFraction = fim;
        estado.targetFraction = fim;
        atualizarPosicaoExplorador();
        aplicarClasseExplorador("parado");
        estado.rafMovimento = 0;
      }
    };

    estado.rafMovimento = requestAnimationFrame(tick);
  }

  function onEscolherFase(flag, fase) {
    const bloqueada = !estado.desbloqueadas[fase - 1];
    if (bloqueada) {
      flag.classList.remove("tremor");
      void flag.getBoundingClientRect();
      flag.classList.add("tremor");
    }

    document.dispatchEvent(new CustomEvent("trilha:escolher-fase", {
      detail: { fase }
    }));
  }

  function sincronizarComProgresso(prog) {
    if (!prog) return;

    if (Array.isArray(prog.desbloqueadas) && prog.desbloqueadas.length === 5) {
      estado.desbloqueadas = [...prog.desbloqueadas];
    }
    if (Array.isArray(prog.estrelas) && prog.estrelas.length === 5) {
      estado.estrelas = prog.estrelas.map((v) => clamp(Number(v) || 0, 0, 3));
    }
    if (Array.isArray(prog.melhor) && prog.melhor.length === 5) {
      estado.melhor = [...prog.melhor];
    }

    const concluidas = Number.isFinite(prog.concluidas)
      ? clamp(Math.floor(prog.concluidas), 0, 5)
      : estado.estrelas.filter((s) => s > 0).length;

    estado.concluidas = concluidas;
    estado.faseAtual = clamp(concluidas + 1, 1, 5);
    estado.acertosNaFase = 0;
    estado.totalNaFase = 0;

    estado.currentFraction = concluidas / 5;
    estado.targetFraction = estado.currentFraction;
    atualizarVisualBandeiras();
    atualizarPosicaoExplorador();
    atualizarTextoStatus();
  }

  function efeitoConclusaoFase(fase, estrelas) {
    const flag = flags[fase - 1];
    if (!flag) return;

    flag.querySelector(".fase-bandeira")?.animate(
      [
        { transform: "rotate(0deg)" },
        { transform: "rotate(-10deg)" },
        { transform: "rotate(7deg)" },
        { transform: "rotate(0deg)" }
      ],
      { duration: 620, easing: "ease-out" }
    );

    flag.querySelector(".fase-estrelas").textContent = "★".repeat(Math.max(1, estrelas));

    if (typeof window.rajadaDeNeve === "function") {
      window.rajadaDeNeve();
    }

    const proxima = flags[fase];
    if (proxima) {
      proxima.classList.add("liberada");
      proxima.querySelector(".fase-pulso")?.classList.add("fase-pulso");
    }
  }

  function tratarProgressoCarregado(detail) {
    sincronizarComProgresso(detail);
    moverPara(estado.concluidas / 5, false);
  }

  function tratarFaseIniciada(detail) {
    estado.faseAtual = clamp(Number(detail.fase) || 1, 1, 5);
    estado.totalNaFase = Math.max(0, Number(detail.total) || 0);
    estado.acertosNaFase = 0;
    atualizarVisualBandeiras();
    atualizarTextoStatus();
    aplicarClasseExplorador("aceno", 900);
    falar("Vamos lá!");
  }

  function tratarAcerto(detail) {
    estado.faseAtual = clamp(Number(detail.fase) || estado.faseAtual, 1, 5);
    estado.acertosNaFase = Math.max(0, Number(detail.acertosNaFase) || 0);
    estado.totalNaFase = Math.max(1, Number(detail.totalNaFase) || estado.totalNaFase || 1);

    const alvo = trilhaFractionCalculada();
    moverPara(alvo, true);
    atualizarTextoStatus();
  }

  function tratarErro(detail) {
    estado.faseAtual = clamp(Number(detail.fase) || estado.faseAtual, 1, 5);
    aplicarClasseExplorador("tropeco", 350);
    falar("Ops!");
  }

  function tratarFaseConcluida(detail) {
    const fase = clamp(Number(detail.fase) || estado.faseAtual, 1, 5);
    const estrelas = clamp(Number(detail.estrelas) || 1, 1, 3);

    // Prioriza fonte oficial de progresso salva.
    if (typeof window.obterProgresso === "function") {
      sincronizarComProgresso(window.obterProgresso());
    } else {
      estado.estrelas[fase - 1] = Math.max(estado.estrelas[fase - 1], estrelas);
      estado.concluidas = Math.max(estado.concluidas, fase);
      if (fase < 5) estado.desbloqueadas[fase] = true;
    }

    const destino = Math.max(estado.currentFraction, estado.concluidas / 5);
    moverPara(destino, true);

    efeitoConclusaoFase(fase, estrelas);
    aplicarClasseExplorador("pulinho", 520);

    if (fase === 5) {
      refs.badge.textContent = "Cume alcançado!";
      aplicarClasseExplorador("pulinho", 900);
      if (typeof window.rajadaDeNeve === "function") {
        window.rajadaDeNeve();
      }
    }

    atualizarVisualBandeiras();
    atualizarTextoStatus();
  }

  function tratarProgressoApagado() {
    estado.desbloqueadas = [true, false, false, false, false];
    estado.estrelas = [0, 0, 0, 0, 0];
    estado.melhor = [0, 0, 0, 0, 0];
    estado.concluidas = 0;
    estado.faseAtual = 1;
    estado.acertosNaFase = 0;
    estado.totalNaFase = 0;

    cancelAnimationFrame(estado.rafMovimento);
    estado.rafMovimento = 0;

    if (reduzMovimento) {
      estado.currentFraction = 0;
      estado.targetFraction = 0;
      atualizarVisualBandeiras();
      atualizarPosicaoExplorador();
      atualizarTextoStatus();
      return;
    }

    refs.explorerWrap.animate(
      [
        { opacity: 1 },
        { opacity: 0.1 },
        { opacity: 1 }
      ],
      { duration: 560, easing: "ease-out" }
    );

    setTimeout(() => {
      estado.currentFraction = 0;
      estado.targetFraction = 0;
      atualizarVisualBandeiras();
      atualizarPosicaoExplorador();
      atualizarTextoStatus();
    }, 260);
  }

  function configurarEventos() {
    document.addEventListener("arrastar:progresso-carregado", (e) => {
      tratarProgressoCarregado(e.detail || {});
    });

    document.addEventListener("arrastar:fase-iniciada", (e) => {
      tratarFaseIniciada(e.detail || {});
    });

    document.addEventListener("arrastar:acerto", (e) => {
      tratarAcerto(e.detail || {});
    });

    document.addEventListener("arrastar:erro", (e) => {
      tratarErro(e.detail || {});
    });

    document.addEventListener("arrastar:fase-concluida", (e) => {
      tratarFaseConcluida(e.detail || {});
    });

    document.addEventListener("arrastar:progresso-apagado", () => {
      tratarProgressoApagado();
    });

    document.addEventListener("visibilitychange", () => {
      refs.card.classList.toggle("trilha-pausada", document.hidden);
      if (document.hidden && estado.rafMovimento) {
        cancelAnimationFrame(estado.rafMovimento);
        estado.rafMovimento = 0;
      } else if (!document.hidden && estado.currentFraction < estado.targetFraction) {
        moverPara(estado.targetFraction, true);
      }
    });
  }

  function initFromGlobal() {
    if (typeof window.obterProgresso === "function") {
      sincronizarComProgresso(window.obterProgresso());
      moverPara(estado.concluidas / 5, false);
    }
  }

  function init() {
    construirCard();
    comprimentoTrilha = refs.caminho.getTotalLength();
    refs.progresso.style.strokeDasharray = `${comprimentoTrilha}`;

    montarBandeiras();
    atualizarVisualBandeiras();
    atualizarPosicaoExplorador();
    atualizarTextoStatus();

    configurarEventos();
    initFromGlobal();

    // Segurança: se obterProgresso for registrada alguns ms depois.
    setTimeout(initFromGlobal, 120);
  }

  init();
})();
