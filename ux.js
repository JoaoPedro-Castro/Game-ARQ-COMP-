(() => {
  "use strict";

  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const toastArea = document.getElementById("toast-area");
  const contador = document.getElementById("contador-palavras");
  const mensagemAjuda = document.getElementById("mensagem-ajuda-cruzadinha");
  const tabuleiro = document.getElementById("tabuleiro");

  const btnAjuda = document.getElementById("btn-como-jogar");
  const modal = document.getElementById("modal-ajuda");
  const btnFecharModal = document.getElementById("fechar-modal-ajuda");

  const fontePalavras = typeof PALAVRAS !== "undefined" ? PALAVRAS : globalThis.PALAVRAS;

  let ultimoFocoAntesModal = null;
  let ultimaCasaClicada = null;
  let direcaoAtual = "H";
  let vitoriaJaAnimada = false;

  function mostrarToast(texto) {
    if (!toastArea || !texto) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = texto;
    toastArea.appendChild(toast);

    const duracao = 2600;
    if (!reduzMovimento) {
      toast.animate(
        [
          { opacity: 0, transform: "translateY(12px)" },
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 0, transform: "translateY(8px)" }
        ],
        { duration: duracao, easing: "ease" }
      );
    }

    setTimeout(() => toast.remove(), duracao);
  }

  function abrirModalAjuda() {
    if (!modal) return;
    ultimoFocoAntesModal = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.hidden = false;
    const primeiro = modal.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    primeiro?.focus();
  }

  function fecharModalAjuda() {
    if (!modal) return;
    modal.hidden = true;
    if (ultimoFocoAntesModal) {
      ultimoFocoAntesModal.focus();
    }
  }

  function alternarAbaModal(tab) {
    const tabs = Array.from(modal.querySelectorAll(".modal-aba"));
    tabs.forEach((item) => {
      const ativa = item === tab;
      item.classList.toggle("ativa", ativa);
      item.setAttribute("aria-selected", String(ativa));
    });

    const alvo = tab.getAttribute("aria-controls");
    modal.querySelectorAll(".modal-conteudo").forEach((painel) => {
      painel.hidden = painel.id !== alvo;
    });
  }

  function configurarModalAjuda() {
    if (!modal || !btnAjuda || !btnFecharModal) return;

    btnAjuda.addEventListener("click", abrirModalAjuda);
    btnFecharModal.addEventListener("click", fecharModalAjuda);

    modal.addEventListener("click", (e) => {
      const alvo = e.target instanceof Element ? e.target : null;
      if (!alvo) return;

      if (alvo.closest("[data-fechar-modal='true']")) {
        fecharModalAjuda();
        return;
      }

      const tab = alvo.closest(".modal-aba");
      if (tab) {
        alternarAbaModal(tab);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (modal.hidden) return;

      if (e.key === "Escape") {
        e.preventDefault();
        fecharModalAjuda();
        return;
      }

      // Trava foco dentro do modal.
      if (e.key === "Tab") {
        const focaveis = Array.from(modal.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"));
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
    });

    // Abre na primeira visita.
    let jaViu = false;
    try {
      jaViu = localStorage.getItem("cruzadinha.ajuda.vista") === "1";
    } catch {
      jaViu = false;
    }

    if (!jaViu) {
      abrirModalAjuda();
      try {
        localStorage.setItem("cruzadinha.ajuda.vista", "1");
      } catch {
        // Ambiente sem localStorage.
      }
    }
  }

  function parseContador() {
    if (!contador) return null;
    const match = (contador.textContent || "").match(/(\d+)\s+de\s+(\d+)/i);
    if (!match) return null;
    return { atual: Number(match[1]), total: Number(match[2]) };
  }

  function atualizarMensagemCruzadinha() {
    if (!mensagemAjuda) return;
    const dados = parseContador();
    if (!dados) return;

    const certas = document.querySelectorAll(".casa-correta").length;
    const erradas = document.querySelectorAll(".casa-incorreta").length;

    if (dados.atual === 0) {
      vitoriaJaAnimada = false;
      mensagemAjuda.textContent = "Comece clicando numa casa numerada.";
      return;
    }

    if (dados.atual >= dados.total) {
      mensagemAjuda.textContent = "Parabéns, você completou a cruzadinha!";
      if (!vitoriaJaAnimada && typeof window.rajadaDeNeve === "function") {
        vitoriaJaAnimada = true;
        window.rajadaDeNeve();
      }
      mostrarToast("Parabéns! Cruzadinha completa.");
      return;
    }

    const extra = certas || erradas
      ? ` Verde: ${certas || 0}, vermelho: ${erradas || 0}.`
      : " Verde está certo, vermelho está errado.";

    mensagemAjuda.textContent = `Você acertou ${dados.atual} de ${dados.total}.${extra} Continue tentando!`;
    mostrarToast(`Você acertou ${dados.atual} de ${dados.total}.`);
  }

  function construirMapaCasasPalavras() {
    const mapa = new Map();
    if (!Array.isArray(fontePalavras)) return mapa;

    fontePalavras.forEach((palavra) => {
      for (let i = 0; i < palavra.resposta.length; i++) {
        const linha = palavra.dir === "H" ? palavra.linha : palavra.linha + i;
        const coluna = palavra.dir === "H" ? palavra.coluna + i : palavra.coluna;
        const chave = `${linha}-${coluna}`;
        if (!mapa.has(chave)) {
          mapa.set(chave, []);
        }
        mapa.get(chave).push(palavra);
      }
    });

    return mapa;
  }

  const mapaCasaPalavras = construirMapaCasasPalavras();

  function limparDestaquesPistasECasas() {
    document.querySelectorAll(".btn-pista.ativa, .btn-pista.ativa-secundaria").forEach((btn) => {
      btn.classList.remove("ativa", "ativa-secundaria");
    });

    document.querySelectorAll(".casa-destaque, .casa-foco-palavra").forEach((casa) => {
      casa.classList.remove("casa-destaque", "casa-foco-palavra");
    });
  }

  function destacarPalavraNoTabuleiro(palavra, focoPrincipal) {
    for (let i = 0; i < palavra.resposta.length; i++) {
      const linha = palavra.dir === "H" ? palavra.linha : palavra.linha + i;
      const coluna = palavra.dir === "H" ? palavra.coluna + i : palavra.coluna;
      const casa = document.querySelector(`.casa[data-linha="${linha}"][data-coluna="${coluna}"]`);
      if (!casa) continue;
      casa.classList.add("casa-destaque");
      if (focoPrincipal) casa.classList.add("casa-foco-palavra");
    }
  }

  function destacarPistasDaCasa(casa) {
    const linha = Number(casa.dataset.linha);
    const coluna = Number(casa.dataset.coluna);
    const chave = `${linha}-${coluna}`;
    const palavras = mapaCasaPalavras.get(chave) || [];
    if (!palavras.length) return;

    let principal = palavras.find((p) => p.dir === direcaoAtual) || palavras[0];
    let secundarias = palavras.filter((p) => p !== principal);

    destacarPalavraNoTabuleiro(principal, true);
    secundarias.forEach((p) => destacarPalavraNoTabuleiro(p, false));

    const btnPrincipal = document.querySelector(`.btn-pista[data-resposta="${principal.resposta}"]`);
    if (btnPrincipal) {
      btnPrincipal.classList.add("ativa");
      btnPrincipal.scrollIntoView({ behavior: reduzMovimento ? "auto" : "smooth", block: "nearest" });
    }

    secundarias.forEach((p) => {
      const btn = document.querySelector(`.btn-pista[data-resposta="${p.resposta}"]`);
      btn?.classList.add("ativa-secundaria");
    });
  }

  function atualizarDirecaoPorClique(casa) {
    const linha = Number(casa.dataset.linha);
    const coluna = Number(casa.dataset.coluna);
    const chave = `${linha}-${coluna}`;
    const palavras = mapaCasaPalavras.get(chave) || [];

    const temH = palavras.some((p) => p.dir === "H");
    const temV = palavras.some((p) => p.dir === "V");

    if (temH && temV && ultimaCasaClicada === chave) {
      direcaoAtual = direcaoAtual === "H" ? "V" : "H";
    } else if (temH) {
      direcaoAtual = "H";
    } else if (temV) {
      direcaoAtual = "V";
    }

    ultimaCasaClicada = chave;
  }

  function configurarDestaquePistas() {
    if (!tabuleiro) return;

    tabuleiro.addEventListener("focusin", (e) => {
      const casa = e.target instanceof HTMLInputElement ? e.target.closest(".casa") : null;
      if (!casa) return;

      limparDestaquesPistasECasas();
      destacarPistasDaCasa(casa);
    });

    tabuleiro.addEventListener("click", (e) => {
      const casa = e.target instanceof HTMLInputElement ? e.target.closest(".casa") : null;
      if (!casa) return;

      atualizarDirecaoPorClique(casa);
      limparDestaquesPistasECasas();
      destacarPistasDaCasa(casa);
    });
  }

  function configurarObservadores() {
    if (contador) {
      const obsContador = new MutationObserver(() => {
        atualizarMensagemCruzadinha();
      });

      obsContador.observe(contador, {
        characterData: true,
        childList: true,
        subtree: true
      });

      atualizarMensagemCruzadinha();
    }

    const liveArrastar = document.getElementById("arrastar-live");
    if (liveArrastar) {
      const obsArrastar = new MutationObserver(() => {
        const texto = (liveArrastar.textContent || "").trim();
        if (texto) mostrarToast(texto);
      });

      obsArrastar.observe(liveArrastar, {
        characterData: true,
        childList: true,
        subtree: true
      });
    }
  }

  configurarModalAjuda();
  configurarDestaquePistas();
  configurarObservadores();
})();
