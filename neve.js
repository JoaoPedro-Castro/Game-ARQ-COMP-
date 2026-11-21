(() => {
  "use strict";

  const canvas = document.getElementById("neve-canvas");
  const btnToggleNeve = document.getElementById("toggle-neve");
  if (!canvas || !btnToggleNeve) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = window.matchMedia("(max-width: 700px)").matches;

  let ligada = !reduzMovimento;
  let rafID = 0;
  let largura = 0;
  let altura = 0;
  let dpr = 1;
  let tempoAnterior = 0;
  let tempoVento = 0;

  // Partículas principais + partículas curtas da "rajada".
  const flocos = [];
  const particulasRajada = [];

  function lerPreferenciaNeve() {
    try {
      const valor = localStorage.getItem("cruzadinha.neve");
      if (valor === "on") ligada = true;
      if (valor === "off") ligada = false;
    } catch {
      // Ignora falha de localStorage em ambientes restritos.
    }
  }

  function salvarPreferenciaNeve() {
    try {
      localStorage.setItem("cruzadinha.neve", ligada ? "on" : "off");
    } catch {
      // Ignora falha de localStorage em ambientes restritos.
    }
  }

  function atualizarRotuloBotaoNeve() {
    btnToggleNeve.textContent = ligada ? "❄ Neve: ligada" : "❄ Neve: desligada";
    btnToggleNeve.setAttribute("aria-pressed", String(ligada));
  }

  function configurarCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    largura = window.innerWidth;
    altura = window.innerHeight;
    canvas.width = Math.floor(largura * dpr);
    canvas.height = Math.floor(altura * dpr);
    canvas.style.width = `${largura}px`;
    canvas.style.height = `${altura}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function criarFloco(aleatorioY = true, camadaForcada = null) {
    const camada = camadaForcada ?? (Math.random() < 0.5 ? 0 : Math.random() < 0.8 ? 1 : 2);
    const escala = camada === 0 ? 0.55 : camada === 1 ? 0.85 : 1.2;

    return {
      x: Math.random() * largura,
      y: aleatorioY ? Math.random() * altura : -10,
      tamanho: (1.4 + Math.random() * 3.2) * escala,
      opacidade: (camada === 0 ? 0.28 : camada === 1 ? 0.45 : 0.7) * (0.65 + Math.random() * 0.35),
      velocidadeY: (18 + Math.random() * 24) * escala,
      sway: 0.7 + Math.random() * 1.4,
      fase: Math.random() * Math.PI * 2,
      giro: (Math.random() - 0.5) * 0.8,
      angulo: Math.random() * Math.PI * 2,
      camada
    };
  }

  function quantidadeFlocosBase() {
    if (reduzMovimento) return 0;
    if (isMobile) return 82;
    return 108;
  }

  function popularFlocos() {
    flocos.length = 0;
    const total = quantidadeFlocosBase();
    for (let i = 0; i < total; i++) {
      flocos.push(criarFloco(true));
    }
  }

  function atualizarFloco(f, dt, vento) {
    f.y += f.velocidadeY * dt;
    f.x += Math.sin((performance.now() * 0.0012) * f.sway + f.fase) * 14 * dt;
    f.x += vento * dt;
    f.angulo += f.giro * dt;

    if (f.y > altura + 14) {
      Object.assign(f, criarFloco(false, f.camada));
      f.y = -10;
    }

    if (f.x < -20) f.x = largura + 20;
    if (f.x > largura + 20) f.x = -20;
  }

  function desenharFloco(f) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.angulo);
    ctx.fillStyle = `rgba(255,255,255,${f.opacidade.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(0, 0, f.tamanho, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function atualizarRajada(dt) {
    for (let i = particulasRajada.length - 1; i >= 0; i--) {
      const p = particulasRajada[i];
      p.vida -= dt;
      if (p.vida <= 0) {
        particulasRajada.splice(i, 1);
        continue;
      }

      p.vy += 80 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.giro * dt;

      const alpha = Math.max(0, p.vida / p.vidaMax);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.cor.replace("ALFA", alpha.toFixed(3));
      ctx.fillRect(-p.tam * 0.5, -p.tam * 0.5, p.tam, p.tam);
      ctx.restore();
    }
  }

  function loop(ts) {
    const dt = Math.min(0.034, (ts - (tempoAnterior || ts)) / 1000);
    tempoAnterior = ts;

    ctx.clearRect(0, 0, largura, altura);
    if (!ligada || reduzMovimento || document.hidden) {
      rafID = requestAnimationFrame(loop);
      return;
    }

    tempoVento += dt;
    const vento = Math.sin(tempoVento * 0.35) * 10 + Math.sin(tempoVento * 0.08) * 16;

    for (let i = 0; i < flocos.length; i++) {
      atualizarFloco(flocos[i], dt, vento);
      desenharFloco(flocos[i]);
    }

    atualizarRajada(dt);
    rafID = requestAnimationFrame(loop);
  }

  // Função global pedida na atividade para uso futuro em vitórias/fases.
  window.rajadaDeNeve = function rajadaDeNeve() {
    if (reduzMovimento) return;
    const cores = [
      "rgba(255,255,255,ALFA)",
      "rgba(46,196,182,ALFA)",
      "rgba(191,243,234,ALFA)",
      "rgba(30,77,216,ALFA)"
    ];

    const origemX = largura * (0.2 + Math.random() * 0.6);
    const origemY = altura * 0.22;
    const qtd = isMobile ? 50 : 84;

    for (let i = 0; i < qtd; i++) {
      const ang = (-Math.PI * 0.9) + Math.random() * Math.PI * 0.8;
      const vel = 120 + Math.random() * 220;
      particulasRajada.push({
        x: origemX,
        y: origemY,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel,
        tam: 3 + Math.random() * 5,
        vida: 0.8 + Math.random() * 0.7,
        vidaMax: 1,
        rot: Math.random() * Math.PI,
        giro: (Math.random() - 0.5) * 12,
        cor: cores[Math.floor(Math.random() * cores.length)]
      });
      particulasRajada[particulasRajada.length - 1].vidaMax = particulasRajada[particulasRajada.length - 1].vida;
    }
  };

  function alternarNeve() {
    if (reduzMovimento) return;
    ligada = !ligada;
    atualizarRotuloBotaoNeve();
    salvarPreferenciaNeve();
  }

  lerPreferenciaNeve();
  if (reduzMovimento) {
    ligada = false;
    btnToggleNeve.disabled = true;
    btnToggleNeve.title = "Neve desativada por preferência de movimento reduzido";
  }
  configurarCanvas();
  popularFlocos();
  atualizarRotuloBotaoNeve();

  btnToggleNeve.addEventListener("click", alternarNeve);
  window.addEventListener("resize", () => {
    configurarCanvas();
    popularFlocos();
  });

  // Pausa natural quando a aba está oculta para economizar recurso.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      tempoAnterior = performance.now();
    }
  });

  cancelAnimationFrame(rafID);
  rafID = requestAnimationFrame(loop);
})();
