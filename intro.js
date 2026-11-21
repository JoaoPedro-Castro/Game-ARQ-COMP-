(() => {
  "use strict";

  const intro = document.getElementById("intro");
  const main = document.querySelector("main.app");
  const footer = document.querySelector("footer.rodape");
  const btnRever = document.getElementById("btn-rever-intro");
  const btnPular = document.getElementById("intro-pular");
  const btnIniciar = document.getElementById("intro-iniciar");
  const btnVoltar = document.getElementById("intro-voltar");
  const btnContinuar = document.getElementById("intro-continuar");
  const flash = document.getElementById("intro-flash");
  const capa = intro?.querySelector('[data-intro-stage="capa"]');
  const briefing = intro?.querySelector('[data-intro-stage="briefing"]');
  const relogio = document.getElementById("intro-relogio");
  const cardTitulo = document.getElementById("intro-card-titulo");
  const cardTexto = document.getElementById("intro-card-texto");
  const cardCursor = document.getElementById("intro-card-cursor");
  const cardProgresso = document.getElementById("intro-progresso");
  const canvasNeve = document.getElementById("intro-neve");
  const fotoCapa = document.getElementById("intro-bg-foto");

  if (!intro || !main || !footer) return;

  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CARTOES = [
    {
      titulo: "CHEGADA",
      texto: "Cordilheira Gélida, 03h41. Menos 32 graus. O helicóptero some na tempestade e o agente Jhon Lennon pisa na neve sozinho. A poucos quilômetros, uma base de pesquisa isolada esconde um sistema de defesa que precisa ser desativado antes do amanhecer."
    },
    {
      titulo: "O PROBLEMA",
      texto: "Dentro da base, tudo é controlado por computador. Cada porta só abre quando alguém prova que entende como a máquina pensa: quem calcula, quem manda, onde os dados ficam guardados e por onde viajam. Sem isso, o sistema de defesa dispara."
    },
    {
      titulo: "O CÓDIGO",
      texto: "A CPU decide. A ULA calcula. As memórias guardam. Os barramentos levam cada dado ao lugar certo. Jhon abre o tablet, respira fundo e sussurra: 'Se o computador pensa em camadas, eu invado em camadas.'"
    },
    {
      titulo: "SUA MISSÃO",
      texto: "Agora é com você. Primeiro, decifre o painel de acesso, que é a CRUZADINHA. Depois, aceite o desafio de ARRASTAR as respostas ao lugar certo, destravar as fases e guiar o agente pela trilha até o topo da montanha. O relógio está correndo."
    }
  ];

  const estado = {
    aberta: !document.documentElement.classList.contains("intro-ja-vista"),
    stage: "capa",
    indiceCartao: 0,
    digitando: false,
    typingRAF: 0,
    typingTimeout: 0,
    ultimoFoco: null,
    relogioInterval: 0,
    // Neve da intro
    neveRAF: 0,
    neveAtiva: false,
    flakes: [],
    w: 0,
    h: 0,
    dpr: 1,
    vento: 0,
    ventoT: 0,
    neveResizeHandler: null,
    // Parallax
    parallaxAtivo: false,
    px: 0,
    py: 0,
    ptx: 0,
    pty: 0,
    parallaxRAF: 0,
    // Áudio ambiente
    audioCtx: null,
    ventoGain: null,
    ventoNode: null,
    ambienteIniciado: false
  };

  function somLigadoNoSite() {
    const btnSom = document.getElementById("toggle-som");
    if (!btnSom) return true;
    return btnSom.getAttribute("aria-pressed") !== "false";
  }

  function tocarSomSeguro(nome) {
    if (typeof window.tocarSom === "function") {
      window.tocarSom(nome);
    }
  }

  function iniciarAmbienteSePossivel() {
    if (estado.ambienteIniciado || reduzMovimento) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      estado.audioCtx = new AudioCtx();
      const ganho = estado.audioCtx.createGain();
      ganho.gain.value = 0;
      ganho.connect(estado.audioCtx.destination);
      estado.ventoGain = ganho;

      // Ruído de vento por buffer em loop.
      const dur = 2;
      const sr = estado.audioCtx.sampleRate;
      const buffer = estado.audioCtx.createBuffer(1, sr * dur, sr);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.34;
      }

      const src = estado.audioCtx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const filtro = estado.audioCtx.createBiquadFilter();
      filtro.type = "bandpass";
      filtro.frequency.value = 380;
      filtro.Q.value = 0.7;

      src.connect(filtro);
      filtro.connect(ganho);
      src.start();

      estado.ventoNode = src;
      estado.ambienteIniciado = true;
      atualizarVolumeAmbiente();
    } catch {
      // Falha silenciosa de áudio não deve quebrar a intro.
    }
  }

  function atualizarVolumeAmbiente() {
    if (!estado.ventoGain || !estado.audioCtx) return;
    const ligado = estado.aberta && somLigadoNoSite();
    const alvo = ligado ? 0.045 : 0;
    const agora = estado.audioCtx.currentTime;
    estado.ventoGain.gain.cancelScheduledValues(agora);
    estado.ventoGain.gain.linearRampToValueAtTime(alvo, agora + 0.22);
  }

  function setupInert(ativo) {
    if (ativo) {
      main.setAttribute("inert", "");
      footer.setAttribute("inert", "");
      main.setAttribute("aria-hidden", "true");
      footer.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "hidden";
    } else {
      main.removeAttribute("inert");
      footer.removeAttribute("inert");
      main.removeAttribute("aria-hidden");
      footer.removeAttribute("aria-hidden");
      document.body.style.overflow = "";
    }
  }

  function focaveisIntro() {
    return Array.from(intro.querySelectorAll("button, [href], [tabindex]:not([tabindex='-1'])")).filter((el) => !el.hasAttribute("disabled") && !el.closest("[hidden]"));
  }

  function trapFocusIntro(e) {
    if (!estado.aberta || e.key !== "Tab") return;
    const itens = focaveisIntro();
    if (!itens.length) return;

    const primeiro = itens[0];
    const ultimo = itens[itens.length - 1];

    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  function salvarFlagSessao() {
    try {
      sessionStorage.setItem("arqcomp-intro-vista", "1");
      document.documentElement.classList.add("intro-ja-vista");
    } catch {
      // Sem storage, segue normalmente.
    }
  }

  function abrirIntro() {
    clearTimeout(estado.typingTimeout);
    estado.digitando = false;
    estado.aberta = true;
    estado.stage = "capa";
    intro.classList.remove("intro-hidden", "intro-abrindo-jogo");
    intro.removeAttribute("hidden");
    capa.hidden = false;
    briefing.hidden = true;
    setupInert(true);
    iniciarNevascaIntro();
    iniciarParallax();
    atualizarVolumeAmbiente();
    setTimeout(() => btnIniciar?.focus(), 20);
  }

  function fecharIntro() {
    clearTimeout(estado.typingTimeout);
    estado.digitando = false;
    estado.aberta = false;
    setupInert(false);
    pararNevascaIntro();
    pararParallax();
    atualizarVolumeAmbiente();
    intro.classList.add("intro-hidden");

    const alvo = document.getElementById("tab-cruzadinha") || btnRever;
    alvo?.focus();

    if (typeof window.rajadaDeNeve === "function") {
      window.rajadaDeNeve();
    }
  }

  function transicaoParaBriefing() {
    tocarSomSeguro("clique");
    flash.animate(
      [
        { opacity: 0 },
        { opacity: 0.9, offset: 0.35 },
        { opacity: 0 }
      ],
      { duration: 620, easing: "ease-out" }
    );

    capa.classList.add("saindo");
    setTimeout(() => {
      capa.hidden = true;
      capa.classList.remove("saindo");
      briefing.hidden = false;
      estado.stage = "briefing";
      estado.indiceCartao = 0;
      renderCartao();
      btnContinuar?.focus();
    }, reduzMovimento ? 20 : 620);
  }

  function transicaoEntrarJogo() {
    tocarSomSeguro("fase");
    salvarFlagSessao();

    flash.animate(
      [
        { opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { opacity: 0 }
      ],
      { duration: 700, easing: "ease-out" }
    );

    intro.classList.add("intro-abrindo-jogo");
    setTimeout(() => {
      intro.classList.remove("intro-abrindo-jogo");
      fecharIntro();
    }, reduzMovimento ? 20 : 700);
  }

  function pularIntro() {
    salvarFlagSessao();
    fecharIntro();
  }

  function atualizarRelogioMissao() {
    if (!relogio) return;
    let s = 7;
    let m = 41;
    let h = 3;

    clearInterval(estado.relogioInterval);
    estado.relogioInterval = window.setInterval(() => {
      if (!estado.aberta || estado.stage !== "capa") return;
      s += 1;
      if (s >= 60) {
        s = 0;
        m += 1;
      }
      if (m >= 60) {
        m = 0;
        h += 1;
      }
      relogio.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }, 1000);
  }

  function renderCartaoInstantaneo() {
    const c = CARTOES[estado.indiceCartao];
    cardTitulo.textContent = c.titulo;
    cardTexto.textContent = c.texto;
    cardCursor.style.visibility = "hidden";
    estado.digitando = false;
    btnVoltar.style.visibility = estado.indiceCartao === 0 ? "hidden" : "visible";
    cardProgresso.textContent = `${estado.indiceCartao + 1}/4`;
    btnContinuar.textContent = estado.indiceCartao === 3 ? "ENTRAR NA BASE" : "Continuar";
  }

  function completarDigitacaoAgora() {
    clearTimeout(estado.typingTimeout);
    cancelAnimationFrame(estado.typingRAF);
    renderCartaoInstantaneo();
  }

  function digitarTexto(texto, i = 0) {
    if (!estado.aberta || estado.stage !== "briefing") return;
    if (!estado.digitando) return;

    cardTexto.textContent = texto.slice(0, i);
    if (i >= texto.length) {
      estado.digitando = false;
      cardCursor.style.visibility = "hidden";
      return;
    }

    estado.typingTimeout = window.setTimeout(() => {
      digitarTexto(texto, i + 1);
    }, 25);
  }

  function renderCartao() {
    const c = CARTOES[estado.indiceCartao];
    cardTitulo.textContent = c.titulo;
    cardTexto.textContent = "";
    cardProgresso.textContent = `${estado.indiceCartao + 1}/4`;
    btnVoltar.style.visibility = estado.indiceCartao === 0 ? "hidden" : "visible";
    btnContinuar.textContent = estado.indiceCartao === 3 ? "ENTRAR NA BASE" : "Continuar";

    if (reduzMovimento) {
      renderCartaoInstantaneo();
      return;
    }

    estado.digitando = true;
    cardCursor.style.visibility = "visible";
    digitarTexto(c.texto, 0);
  }

  function avancarCartao() {
    if (estado.digitando) {
      completarDigitacaoAgora();
      return;
    }

    if (estado.indiceCartao >= CARTOES.length - 1) {
      transicaoEntrarJogo();
      return;
    }

    estado.indiceCartao += 1;
    renderCartao();
  }

  function voltarCartao() {
    if (estado.digitando) {
      completarDigitacaoAgora();
      return;
    }

    if (estado.indiceCartao === 0) return;
    estado.indiceCartao -= 1;
    renderCartao();
  }

  function iniciarNevascaIntro() {
    if (!canvasNeve || estado.neveAtiva) return;
    const ctx = canvasNeve.getContext("2d", { alpha: true });
    if (!ctx) return;

    function resize() {
      estado.dpr = Math.min(window.devicePixelRatio || 1, 2);
      estado.w = window.innerWidth;
      estado.h = window.innerHeight;
      canvasNeve.width = Math.floor(estado.w * estado.dpr);
      canvasNeve.height = Math.floor(estado.h * estado.dpr);
      canvasNeve.style.width = `${estado.w}px`;
      canvasNeve.style.height = `${estado.h}px`;
      ctx.setTransform(estado.dpr, 0, 0, estado.dpr, 0, 0);
    }

    function createFlake(yRandom = true) {
      const camada = Math.random() < 0.5 ? 0 : Math.random() < 0.82 ? 1 : 2;
      const scale = camada === 0 ? 0.6 : camada === 1 ? 0.95 : 1.35;
      return {
        x: Math.random() * estado.w,
        y: yRandom ? Math.random() * estado.h : -14,
        r: (1.5 + Math.random() * 3.8) * scale,
        vy: (36 + Math.random() * 66) * scale,
        vx: (Math.random() - 0.5) * 18,
        alpha: (camada === 0 ? 0.24 : camada === 1 ? 0.45 : 0.7),
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.9,
        sway: 0.8 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        camada
      };
    }

    function resetFlakes() {
      estado.flakes = [];
      const quantidade = window.innerWidth < 700 ? 90 : 140;
      for (let i = 0; i < quantidade; i++) {
        estado.flakes.push(createFlake(true));
      }
    }

    let last = 0;
    function loop(t) {
      if (!estado.aberta) {
        estado.neveAtiva = false;
        cancelAnimationFrame(estado.neveRAF);
        estado.neveRAF = 0;
        return;
      }

      const dt = Math.min(0.034, (t - (last || t)) / 1000);
      last = t;

      ctx.clearRect(0, 0, estado.w, estado.h);
      estado.ventoT += dt;
      estado.vento = Math.sin(estado.ventoT * 0.8) * 28 + Math.sin(estado.ventoT * 0.17) * 45;

      for (let i = 0; i < estado.flakes.length; i++) {
        const f = estado.flakes[i];
        f.y += f.vy * dt;
        f.x += (f.vx + estado.vento + Math.sin(estado.ventoT * f.sway + f.phase) * 20) * dt;
        f.angle += f.spin * dt;

        if (f.y > estado.h + 18) {
          Object.assign(f, createFlake(false));
        }
        if (f.x < -22) f.x = estado.w + 22;
        if (f.x > estado.w + 22) f.x = -22;

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.angle);
        ctx.fillStyle = `rgba(240,248,255,${f.alpha})`;
        ctx.beginPath();
        ctx.arc(0, 0, f.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      estado.neveRAF = requestAnimationFrame(loop);
    }

    resize();
    resetFlakes();
    if (!estado.neveResizeHandler) {
      estado.neveResizeHandler = () => {
        if (!estado.aberta) return;
        resize();
        resetFlakes();
      };
      window.addEventListener("resize", estado.neveResizeHandler, { passive: true });
    }

    estado.neveAtiva = true;
    estado.neveRAF = requestAnimationFrame(loop);
  }

  function pararNevascaIntro() {
    if (!estado.neveAtiva) return;
    cancelAnimationFrame(estado.neveRAF);
    estado.neveRAF = 0;
    estado.neveAtiva = false;
    const ctx = canvasNeve.getContext("2d");
    ctx?.clearRect(0, 0, canvasNeve.width, canvasNeve.height);
  }

  function iniciarParallax() {
    if (reduzMovimento || estado.parallaxAtivo) return;
    estado.parallaxAtivo = true;

    const layers = Array.from(intro.querySelectorAll("[data-intro-depth]"));
    const agent = intro.querySelector(".intro-agent");
    const agentBaseX = Number(agent?.getAttribute("data-intro-base-x") || 0);
    const agentBaseY = Number(agent?.getAttribute("data-intro-base-y") || 0);
    const foto = document.getElementById("intro-bg-foto");

    function tick() {
      if (!estado.parallaxAtivo || !estado.aberta) return;

      estado.px += (estado.ptx - estado.px) * 0.08;
      estado.py += (estado.pty - estado.py) * 0.08;

      layers.forEach((el) => {
        const d = Number(el.getAttribute("data-intro-depth") || 0.1);
        el.style.transform = `translate(${estado.px * 36 * d}px, ${estado.py * 16 * d}px)`;
      });

      if (agent) {
        agent.setAttribute("transform", `translate(${(agentBaseX + estado.px * 8).toFixed(2)} ${(agentBaseY + estado.py * 4).toFixed(2)})`);
      }

      if (foto) {
        foto.style.transform = `translate(${(estado.px * 10).toFixed(2)}px, ${(estado.py * 6).toFixed(2)}px) scale(1.06)`;
      }

      estado.parallaxRAF = requestAnimationFrame(tick);
    }

    intro.addEventListener("pointermove", onPointerMove);
    intro.addEventListener("pointerleave", onPointerLeave);
    estado.parallaxRAF = requestAnimationFrame(tick);
  }

  function onPointerMove(e) {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    estado.ptx = x;
    estado.pty = y;
  }

  function onPointerLeave() {
    estado.ptx = 0;
    estado.pty = 0;
  }

  function pararParallax() {
    estado.parallaxAtivo = false;
    cancelAnimationFrame(estado.parallaxRAF);
    estado.parallaxRAF = 0;
    intro.removeEventListener("pointermove", onPointerMove);
    intro.removeEventListener("pointerleave", onPointerLeave);

    const layers = Array.from(intro.querySelectorAll("[data-intro-depth]"));
    layers.forEach((el) => {
      el.style.transform = "";
    });

    const agent = intro.querySelector(".intro-agent");
    if (agent) {
      const x = Number(agent.getAttribute("data-intro-base-x") || 0);
      const y = Number(agent.getAttribute("data-intro-base-y") || 0);
      agent.setAttribute("transform", `translate(${x} ${y})`);
    }

    const foto = document.getElementById("intro-bg-foto");
    if (foto) {
      foto.style.transform = "scale(1.06)";
    }
  }

  function configurarFotoCapa() {
    if (!fotoCapa) return;

    // Fallback: se a imagem falhar, remove o elemento e mantém a cena SVG.
    fotoCapa.addEventListener("error", () => {
      intro.classList.remove("intro-foto-carregada");
      fotoCapa.remove();
    });

    fotoCapa.addEventListener("load", () => {
      intro.classList.add("intro-foto-carregada");
      fotoCapa.classList.add("carregada");
    });

    if (fotoCapa.complete && fotoCapa.naturalWidth > 0) {
      intro.classList.add("intro-foto-carregada");
      fotoCapa.classList.add("carregada");
    }
  }

  function bindEvents() {
    btnPular?.addEventListener("click", pularIntro);
    btnIniciar?.addEventListener("click", () => {
      iniciarAmbienteSePossivel();
      transicaoParaBriefing();
    });

    btnVoltar?.addEventListener("click", voltarCartao);
    btnContinuar?.addEventListener("click", () => {
      iniciarAmbienteSePossivel();
      avancarCartao();
    });

    btnRever?.addEventListener("click", () => {
      estado.ultimoFoco = btnRever;
      document.documentElement.classList.remove("intro-ja-vista");
      abrirIntro();
      atualizarVolumeAmbiente();
    });

    document.addEventListener("keydown", (e) => {
      if (!estado.aberta) return;

      if (e.key === "Escape") {
        e.preventDefault();
        pularIntro();
        return;
      }

      trapFocusIntro(e);

      if (estado.stage === "briefing" && ["Enter", " ", "Spacebar"].includes(e.key)) {
        const alvo = e.target;
        if (alvo === btnVoltar || alvo === btnContinuar) return;
        e.preventDefault();
        avancarCartao();
      }
    });

    intro.addEventListener("click", (e) => {
      iniciarAmbienteSePossivel();
      if (!estado.aberta) return;

      if (estado.stage === "briefing" && estado.digitando) {
        const alvo = e.target;
        if (alvo === btnContinuar || alvo === btnVoltar) return;
        completarDigitacaoAgora();
      }
    });

    const btnSom = document.getElementById("toggle-som");
    btnSom?.addEventListener("click", () => {
      setTimeout(atualizarVolumeAmbiente, 0);
    });

    document.addEventListener("visibilitychange", () => {
      if (!estado.aberta) return;

      if (document.hidden) {
        pararNevascaIntro();
      } else {
        iniciarNevascaIntro();
      }
    });
  }

  function init() {
    configurarFotoCapa();
    bindEvents();
    atualizarRelogioMissao();

    if (estado.aberta) {
      setupInert(true);
      iniciarNevascaIntro();
      iniciarParallax();
      setTimeout(() => btnIniciar?.focus(), 20);
    } else {
      intro.classList.add("intro-hidden");
      setupInert(false);
    }
  }

  init();
})();
