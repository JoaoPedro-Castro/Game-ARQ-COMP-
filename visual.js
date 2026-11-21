(() => {
  "use strict";

  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const contadorTexto = document.getElementById("contador-palavras");
  const contadorDisplay = document.getElementById("contador-display");
  const hero = document.querySelector(".hero");
  const spray = document.querySelector(".spray-watermark");
  const camadasMontanha = Array.from(document.querySelectorAll(".hero-montanhas [data-depth]"));

  // Mantém o selo visual sincronizado com o contador real (sem mexer na lógica principal).
  function atualizarSeloContador() {
    if (!contadorTexto || !contadorDisplay) return;

    const texto = contadorTexto.textContent || "0 de 14 palavras";
    const match = texto.match(/(\d+)\s+de\s+(\d+)/i);
    if (!match) return;

    const atual = Number(match[1]);
    const total = Number(match[2]);
    const formatado = `${String(atual).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

    if (contadorDisplay.textContent !== formatado) {
      contadorDisplay.textContent = formatado;

      // Micro feedback de atualização do contador.
      if (!reduzMovimento) {
        contadorDisplay.animate(
          [
            { transform: "scale(1)", opacity: 0.85 },
            { transform: "scale(1.08)", opacity: 1 },
            { transform: "scale(1)", opacity: 1 }
          ],
          { duration: 280, easing: "ease-out" }
        );
      }
    }
  }

  function configurarObserverContador() {
    if (!contadorTexto) return;

    const obs = new MutationObserver(() => {
      atualizarSeloContador();
    });

    obs.observe(contadorTexto, {
      characterData: true,
      childList: true,
      subtree: true
    });

    atualizarSeloContador();
  }

  // Entrada escalonada dos cards conforme chegam no viewport.
  function configurarRevelacaoScroll() {
    const elementos = Array.from(document.querySelectorAll(".reveal-on-scroll"));
    if (!elementos.length) return;

    if (reduzMovimento || !("IntersectionObserver" in window)) {
      elementos.forEach((el) => el.classList.add("visivel"));
      return;
    }

    const io = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visivel");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14 });

    elementos.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i * 38, 220)}ms`;
      io.observe(el);
    });
  }

  // Parallax suave no herói (spray + montanhas), desativado em reduced motion.
  function configurarParallaxHero() {
    if (reduzMovimento || !hero) return;

    let xAlvo = 0;
    let yAlvo = 0;
    let xAtual = 0;
    let yAtual = 0;

    hero.addEventListener("pointermove", (e) => {
      const rect = hero.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      xAlvo = (px - 0.5) * 2;
      yAlvo = (py - 0.5) * 2;
    });

    hero.addEventListener("pointerleave", () => {
      xAlvo = 0;
      yAlvo = 0;
    });

    const animar = () => {
      xAtual += (xAlvo - xAtual) * 0.08;
      yAtual += (yAlvo - yAtual) * 0.08;

      if (spray) {
        spray.style.transform = `translate(${xAtual * 9}px, ${yAtual * 5}px)`;
      }

      camadasMontanha.forEach((camada) => {
        const depth = Number(camada.getAttribute("data-depth") || 0.1);
        camada.style.transform = `translate(${xAtual * 26 * depth}px, ${yAtual * 14 * depth}px)`;
      });

      requestAnimationFrame(animar);
    };

    requestAnimationFrame(animar);
  }

  configurarObserverContador();
  configurarRevelacaoScroll();
  configurarParallaxHero();
})();
