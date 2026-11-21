(() => {
  "use strict";

  const btnToggleSom = document.getElementById("toggle-som");
  if (!btnToggleSom) return;

  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;

  let somLigado = true;
  let audioCtx = null;
  let masterGain = null;

  function lerPreferenciaSom() {
    try {
      const valor = localStorage.getItem("cruzadinha.som");
      if (valor === "off") somLigado = false;
      if (valor === "on") somLigado = true;
    } catch {
      // Ignora ambientes sem acesso ao localStorage.
    }
  }

  function salvarPreferenciaSom() {
    try {
      localStorage.setItem("cruzadinha.som", somLigado ? "on" : "off");
    } catch {
      // Ignora ambientes sem acesso ao localStorage.
    }
  }

  function atualizarRotuloSom() {
    btnToggleSom.textContent = somLigado ? "🔊 SOM: ON" : "🔇 SOM: OFF";
    btnToggleSom.setAttribute("aria-pressed", String(somLigado));
  }

  async function garantirAudio() {
    if (!AudioCtx) return null;

    if (!audioCtx) {
      audioCtx = new AudioCtx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.16;
      masterGain.connect(audioCtx.destination);
    }

    if (audioCtx.state === "suspended") {
      try {
        await audioCtx.resume();
      } catch {
        // Pode falhar se o navegador bloquear. Tentaremos depois.
      }
    }

    return audioCtx;
  }

  function tocarNota({ freq = 440, inicio = 0, duracao = 0.1, tipo = "sine", ganho = 0.5 }) {
    if (!audioCtx || !masterGain) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    const t0 = audioCtx.currentTime + inicio;
    const attack = 0.01;
    const release = Math.max(0.02, duracao - attack);

    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, t0);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(ganho, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(t0);
    osc.stop(t0 + duracao + 0.03);
  }

  // Função global pedida na atividade.
  window.tocarSom = async function tocarSom(nome) {
    if (!somLigado) return;
    const ctx = await garantirAudio();
    if (!ctx || ctx.state !== "running") return;

    switch (nome) {
      case "clique":
        tocarNota({ freq: 680, duracao: 0.045, tipo: "triangle", ganho: 0.2 });
        break;
      case "acerto":
        tocarNota({ freq: 560, duracao: 0.11, inicio: 0, tipo: "sine", ganho: 0.17 });
        tocarNota({ freq: 760, duracao: 0.12, inicio: 0.1, tipo: "sine", ganho: 0.19 });
        break;
      case "erro":
        tocarNota({ freq: 180, duracao: 0.16, tipo: "sawtooth", ganho: 0.15 });
        if ("vibrate" in navigator && !reduzMovimento) {
          navigator.vibrate(24);
        }
        break;
      case "fase":
        [392, 494, 587, 784].forEach((f, i) => {
          tocarNota({ freq: f, duracao: 0.11, inicio: i * 0.07, tipo: "triangle", ganho: 0.14 });
        });
        break;
      case "vitoria":
        [523, 659, 784, 1046].forEach((f, i) => {
          tocarNota({ freq: f, duracao: 0.16, inicio: i * 0.08, tipo: "sine", ganho: 0.17 });
        });
        tocarNota({ freq: 1318, duracao: 0.23, inicio: 0.34, tipo: "triangle", ganho: 0.12 });
        break;
      case "passo":
        tocarNota({ freq: 240, duracao: 0.04, tipo: "square", ganho: 0.06 });
        break;
      default:
        break;
    }
  };

  function alternarSom() {
    somLigado = !somLigado;
    atualizarRotuloSom();
    salvarPreferenciaSom();

    if (somLigado) {
      window.tocarSom("clique");
    }
  }

  // Inicializa contexto de áudio após a primeira interação real do usuário.
  const iniciarAudioNaInteracao = () => {
    garantirAudio();
    window.removeEventListener("pointerdown", iniciarAudioNaInteracao);
    window.removeEventListener("keydown", iniciarAudioNaInteracao);
  };

  // Clique em qualquer botão/aba toca o som padrão de interface.
  document.addEventListener("click", (e) => {
    const alvoInterativo = e.target instanceof Element ? e.target.closest("button, [role='tab']") : null;
    if (!alvoInterativo) return;

    // Evita som duplo no botão de toggle antes de atualizar o estado.
    if (alvoInterativo.id === "toggle-som") return;
    window.tocarSom("clique");
  });

  // Pop visual nas casas quando o usuário digita, sem mexer na lógica do jogo.
  document.addEventListener("input", (e) => {
    const casa = e.target instanceof HTMLInputElement ? e.target.closest(".casa") : null;
    if (!casa) return;
    if (!casa.value) return;

    casa.classList.remove("casa-pop");
    void casa.offsetWidth; // Reinicia animação rapidamente.
    casa.classList.add("casa-pop");
  });

  // Também toca um som muito curto ao pisar nos campos de texto.
  document.addEventListener("focusin", (e) => {
    if (!(e.target instanceof HTMLInputElement)) return;
    if (!e.target.classList.contains("casa")) return;
    window.tocarSom("passo");
  });

  lerPreferenciaSom();
  atualizarRotuloSom();

  window.addEventListener("pointerdown", iniciarAudioNaInteracao, { once: true });
  window.addEventListener("keydown", iniciarAudioNaInteracao, { once: true });
  btnToggleSom.addEventListener("click", alternarSom);
})();
