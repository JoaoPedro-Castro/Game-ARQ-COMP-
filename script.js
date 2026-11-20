// ÚNICA fonte de dados da cruzadinha.
const PALAVRAS = [
  {n:1,  resposta:"ADDRESSBUS",       linha:0,  coluna:4,  dir:"H", pista:"Fios que só saem da CPU e indicam qual posição será lida ou escrita."},
  {n:2,  resposta:"ULA",              linha:0,  coluna:12, dir:"V", pista:"Parte da CPU que faz as contas e as operações lógicas."},
  {n:3,  resposta:"DMA",              linha:1,  coluna:0,  dir:"V", pista:"Circuito que copia dados do dispositivo para a memória, deixando a CPU livre."},
  {n:4,  resposta:"UC",               linha:1,  coluna:2,  dir:"V", pista:"Lê cada instrução, descobre o que ela pede e manda ordens às outras partes."},
  {n:5,  resposta:"MICROCONTROLADOR", linha:2,  coluna:0,  dir:"H", pista:"Chip que reúne CPU, memória e entrada e saída, feito para uma tarefa específica."},
  {n:6,  resposta:"CPU",              linha:2,  coluna:5,  dir:"V", pista:"Bloco do computador que busca e executa as instruções do programa."},
  {n:7,  resposta:"ROM",              linha:2,  coluna:9,  dir:"V", pista:"Memória não volátil de firmware de inicialização, cujo nome ficou antigo."},
  {n:8,  resposta:"DATABUS",          linha:2,  coluna:13, dir:"V", pista:"Fios de mão dupla que levam o valor lido ou escrito e as instruções."},
  {n:9,  resposta:"RAM",              linha:2,  coluna:15, dir:"V", pista:"Memória volátil de trabalho que guarda programas em execução e seus dados."},
  {n:10, resposta:"CACHE",            linha:4,  coluna:2,  dir:"V", pista:"Veloz e dentro do processador, guarda cópia do que a CPU usou há pouco."},
  {n:11, resposta:"FLASH",            linha:5,  coluna:0,  dir:"H", pista:"Não volátil e regravável como a do pendrive; no Uno guarda o programa."},
  {n:12, resposta:"EEPROM",           linha:5,  coluna:11, dir:"V", pista:"Memória do Uno onde o próprio programa guarda dados que devem sobreviver ao desligamento."},
  {n:13, resposta:"REGISTRADORES",    linha:8,  coluna:1,  dir:"H", pista:"Pequenas memórias dentro da CPU, as mais rápidas, guardando o dado em uso agora."},
  {n:14, resposta:"MEMORIADEMASSA",   linha:10, coluna:2,  dir:"H", pista:"Nível não volátil da hierarquia, como SSD ou HD, que guarda arquivos e programas instalados."}
];

const TOTAL_LINHAS = 11;
const TOTAL_COLUNAS = 16;

// Mapa das casas que realmente existem no tabuleiro.
// Chave: "linha-coluna" | Valor: informações da casa.
const mapaCasas = new Map();

// Mapa com os números de início de palavra por casa.
// Se duas palavras começarem no mesmo ponto, guardamos as duas.
const mapaNumerosInicio = new Map();

// Para cada casa, guarda qual palavra horizontal e/ou vertical passa por ela.
// Exemplo de valor: { H: palavraObj, V: palavraObj }
const mapaCasaPalavras = new Map();

// Guarda cada palavra já com a sequência de casas que ela ocupa.
const palavrasComCasas = [];

// Referências das listas de pistas.
const listaHorizontais = document.getElementById("lista-horizontais");
const listaVerticais = document.getElementById("lista-verticais");

// Referências do painel de conferência.
const contadorPalavras = document.getElementById("contador-palavras");
const btnConferir = document.getElementById("btn-conferir");
const btnReiniciar = document.getElementById("btn-reiniciar");
const mensagemFinal = document.getElementById("mensagem-final");

// Estado da navegação de digitação.
let direcaoAtual = "H";
let ultimaCasaClicada = null;

// Remove acentos, força maiúscula e mantém apenas A-Z.
function normalizarTextoParaLetras(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

// Retorna a chave usada nos mapas: "linha-coluna".
function chaveCasa(linha, coluna) {
  return `${linha}-${coluna}`;
}

// Busca o input de uma casa pela coordenada.
function buscarInputCasa(linha, coluna) {
  return document.querySelector(`.casa[data-linha="${linha}"][data-coluna="${coluna}"]`);
}

// Foca uma casa específica e opcionalmente define a direção atual.
function focarCasa(linha, coluna, direcao) {
  if (direcao) {
    direcaoAtual = direcao;
  }

  const input = buscarInputCasa(linha, coluna);
  if (input) {
    input.focus();
  }
}

// Conta quantas palavras estão corretas no tabuleiro neste momento.
function contarPalavrasCorretas() {
  let corretas = 0;

  palavrasComCasas.forEach((palavra) => {
    const respostaEsperada = normalizarTextoParaLetras(palavra.resposta);
    let respostaDigitada = "";

    palavra.casas.forEach((chave) => {
      const [linha, coluna] = chave.split("-").map(Number);
      const input = buscarInputCasa(linha, coluna);
      respostaDigitada += normalizarTextoParaLetras(input ? input.value : "");
    });

    if (respostaDigitada === respostaEsperada) {
      corretas += 1;
    }
  });

  return corretas;
}

// Função única de verificação do jogo: atualiza contador e mensagem final.
function verificarCruzadinha() {
  const total = PALAVRAS.length;
  const corretas = contarPalavrasCorretas();

  contadorPalavras.textContent = `${corretas} de ${total} palavras`;

  if (corretas === total) {
    mensagemFinal.textContent = "Parabéns! Você completou a cruzadinha.";
    mensagemFinal.classList.remove("oculta");
  } else {
    mensagemFinal.textContent = "";
    mensagemFinal.classList.add("oculta");
  }
}

// Remove classes de acerto/erro e símbolos visuais das pistas.
function limparMarcacoesVisuais() {
  // Limpa marcações nas casas (se existirem).
  document.querySelectorAll(".casa").forEach((input) => {
    input.classList.remove("casa-correta", "casa-incorreta");
  });

  // Limpa marcações nas pistas (se existirem) e restaura o texto original.
  document.querySelectorAll(".btn-pista").forEach((botao) => {
    botao.classList.remove("pista-correta", "pista-incorreta");

    // Remove símbolos/elementos de status adicionados ao botão.
    botao.querySelectorAll(".status-pista").forEach((el) => el.remove());

    // Restaura o texto base da pista (n. pista).
    if (botao.dataset.textoOriginal) {
      botao.textContent = botao.dataset.textoOriginal;
    }
  });
}

// Coloca o foco na primeira casa disponível do tabuleiro.
function focarPrimeiraCasa() {
  const primeiraCasa = document.querySelector(".casa");
  if (primeiraCasa) {
    primeiraCasa.focus();
  }
}

// Reinicia o estado visual e de preenchimento da cruzadinha.
function reiniciarCruzadinha() {
  // Limpa todas as letras digitadas.
  document.querySelectorAll(".casa").forEach((input) => {
    input.value = "";
  });

  // Remove marcações visuais de conferência.
  limparMarcacoesVisuais();

  // Volta contador e mensagem para o estado inicial.
  contadorPalavras.textContent = `0 de ${PALAVRAS.length} palavras`;
  mensagemFinal.textContent = "";
  mensagemFinal.classList.add("oculta");

  // Direção inicial padrão e foco na primeira casa do tabuleiro.
  direcaoAtual = "H";
  ultimaCasaClicada = null;
  focarPrimeiraCasa();
}

// Retorna a palavra atual da casa, de acordo com a direção atual.
function obterPalavraAtualDaCasa(chave) {
  const info = mapaCasaPalavras.get(chave);
  if (!info) return null;

  // Tenta manter a direção atual, mas cai para a disponível quando necessário.
  if (direcaoAtual === "H" && info.H) return info.H;
  if (direcaoAtual === "V" && info.V) return info.V;

  if (info.H) {
    direcaoAtual = "H";
    return info.H;
  }

  if (info.V) {
    direcaoAtual = "V";
    return info.V;
  }

  return null;
}

// Move para a próxima/anterior casa dentro da palavra atual.
function moverNaPalavra(inputAtual, passo) {
  const linha = Number(inputAtual.dataset.linha);
  const coluna = Number(inputAtual.dataset.coluna);
  const chave = chaveCasa(linha, coluna);
  const palavraAtual = obterPalavraAtualDaCasa(chave);

  if (!palavraAtual) return;

  const indice = palavraAtual.indiceCasa.get(chave);
  if (indice === undefined) return;

  const novoIndice = indice + passo;
  const proximaChave = palavraAtual.casas[novoIndice];
  if (!proximaChave) return;

  const [novaLinha, novaColuna] = proximaChave.split("-").map(Number);
  focarCasa(novaLinha, novaColuna, palavraAtual.dir);
}

// Move para a casa vizinha (setas) somente se essa vizinha existir no tabuleiro.
function moverPorSeta(inputAtual, tecla) {
  const linha = Number(inputAtual.dataset.linha);
  const coluna = Number(inputAtual.dataset.coluna);

  const deslocamentos = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1]
  };

  const [dl, dc] = deslocamentos[tecla];
  const novaLinha = linha + dl;
  const novaColuna = coluna + dc;
  const novaChave = chaveCasa(novaLinha, novaColuna);

  if (mapaCasas.has(novaChave)) {
    focarCasa(novaLinha, novaColuna);
  }
}

// Define/alterna direção quando o usuário clica em uma casa.
function atualizarDirecaoPorClique(input) {
  const linha = Number(input.dataset.linha);
  const coluna = Number(input.dataset.coluna);
  const chave = chaveCasa(linha, coluna);
  const info = mapaCasaPalavras.get(chave);

  if (!info) return;

  const temHorizontal = Boolean(info.H);
  const temVertical = Boolean(info.V);

  // Em cruzamento: clique repetido na mesma casa alterna direção.
  if (temHorizontal && temVertical) {
    if (ultimaCasaClicada === chave) {
      direcaoAtual = direcaoAtual === "H" ? "V" : "H";
    } else if (!info[direcaoAtual]) {
      direcaoAtual = "H";
    }
  } else {
    // Casa com apenas uma direção disponível.
    direcaoAtual = temHorizontal ? "H" : "V";
  }

  ultimaCasaClicada = chave;
}

// 1) Percorre cada palavra para descobrir quais casas terão letras.
PALAVRAS.forEach((palavra) => {
  const { n, resposta, linha, coluna, dir } = palavra;
  const casasDaPalavra = [];

  // Guarda o número de início da palavra na casa inicial.
  const chaveInicio = chaveCasa(linha, coluna);
  if (!mapaNumerosInicio.has(chaveInicio)) {
    mapaNumerosInicio.set(chaveInicio, []);
  }
  mapaNumerosInicio.get(chaveInicio).push(n);

  // Marca cada posição ocupada pela palavra.
  for (let i = 0; i < resposta.length; i++) {
    const l = dir === "H" ? linha : linha + i;
    const c = dir === "H" ? coluna + i : coluna;
    const chave = chaveCasa(l, c);
    casasDaPalavra.push(chave);

    // Se a casa já existir (cruzamento), não cria outra.
    if (!mapaCasas.has(chave)) {
      mapaCasas.set(chave, { linha: l, coluna: c });
    }

    // Guarda qual palavra passa por essa casa em cada direção.
    if (!mapaCasaPalavras.has(chave)) {
      mapaCasaPalavras.set(chave, { H: null, V: null });
    }
    mapaCasaPalavras.get(chave)[dir] = palavra;
  }

  // Salva a palavra com a ordem das casas para navegação por digitação.
  palavrasComCasas.push({
    ...palavra,
    casas: casasDaPalavra,
    indiceCasa: new Map(casasDaPalavra.map((chave, indice) => [chave, indice]))
  });
});

// Atualiza o mapa para apontar para os objetos completos (com casas e índices).
palavrasComCasas.forEach((palavra) => {
  palavra.casas.forEach((chave) => {
    const info = mapaCasaPalavras.get(chave);
    if (info && info[palavra.dir] && info[palavra.dir].n === palavra.n) {
      info[palavra.dir] = palavra;
    }
  });
});

// 2) Monta a grade inteira (11 x 16) no HTML.
const tabuleiro = document.getElementById("tabuleiro");

for (let linha = 0; linha < TOTAL_LINHAS; linha++) {
  for (let coluna = 0; coluna < TOTAL_COLUNAS; coluna++) {
    const chave = chaveCasa(linha, coluna);

    // Se a posição pertence a alguma palavra, cria input.
    if (mapaCasas.has(chave)) {
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 1;
      input.className = "casa";
      input.dataset.linha = String(linha);
      input.dataset.coluna = String(coluna);
      input.setAttribute("aria-label", `Linha ${linha}, coluna ${coluna}`);
      input.setAttribute("autocomplete", "off");
      input.setAttribute("autocorrect", "off");
      input.setAttribute("autocapitalize", "characters");
      input.setAttribute("spellcheck", "false");
      input.setAttribute("inputmode", "text");

      // Ao focar, seleciona a letra atual para facilitar substituição.
      input.addEventListener("focus", () => {
        input.select();
      });

      // Clique na casa define direção atual (e alterna em cruzamentos).
      input.addEventListener("click", () => {
        atualizarDirecaoPorClique(input);
      });

      // Campo aceita apenas A-Z (sem acentos) e avança automaticamente.
      input.addEventListener("input", (e) => {
        const letra = normalizarTextoParaLetras(e.target.value).slice(0, 1);
        e.target.value = letra;

        // Se digitou letra válida, avança para a próxima casa da palavra atual.
        if (letra) {
          moverNaPalavra(input, 1);
        }
      });

      // Trata backspace e setas para navegação entre casas.
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && input.value === "") {
          e.preventDefault();
          moverNaPalavra(input, -1);
          return;
        }

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          moverPorSeta(input, e.key);
        }
      });

      // Se essa casa é início de palavra, desenha o(s) número(s).
      if (mapaNumerosInicio.has(chave)) {
        const numeros = mapaNumerosInicio.get(chave).join(",");
        const numero = document.createElement("span");
        numero.className = "numero";
        numero.textContent = numeros;

        // Envolve input + número para manter o número no canto da mesma casa.
        const wrapper = document.createElement("div");
        wrapper.className = "casa-wrapper";
        wrapper.appendChild(input);
        wrapper.appendChild(numero);
        tabuleiro.appendChild(wrapper);
      } else {
        tabuleiro.appendChild(input);
      }
    } else {
      // Casa vazia: fica invisível, mas mantém o espaço da grade.
      const vazio = document.createElement("div");
      vazio.className = "casa-vazia";
      tabuleiro.appendChild(vazio);
    }
  }
}

// 3) Gera as listas de pistas (Horizontais e Verticais) a partir do array.
const horizontais = PALAVRAS
  .filter((palavra) => palavra.dir === "H")
  .sort((a, b) => a.n - b.n);

const verticais = PALAVRAS
  .filter((palavra) => palavra.dir === "V")
  .sort((a, b) => a.n - b.n);

// Recebe a lista (<ul>) e um conjunto de palavras para montar os itens.
function montarListaPistas(elementoLista, palavras) {
  palavras.forEach((palavra) => {
    const item = document.createElement("li");
    const botao = document.createElement("button");

    botao.type = "button";
    botao.className = "btn-pista";
    botao.textContent = `${palavra.n}. ${palavra.pista}`;
    botao.dataset.textoOriginal = botao.textContent;

    // Ao clicar na pista, o foco vai para a primeira casa da palavra.
    botao.addEventListener("click", () => {
      focarCasa(palavra.linha, palavra.coluna, palavra.dir);
    });

    item.appendChild(botao);
    elementoLista.appendChild(item);
  });
}

montarListaPistas(listaHorizontais, horizontais);
montarListaPistas(listaVerticais, verticais);

// Estado inicial do contador e ação do botão Conferir.
contadorPalavras.textContent = `0 de ${PALAVRAS.length} palavras`;
btnConferir.addEventListener("click", verificarCruzadinha);
btnReiniciar.addEventListener("click", reiniciarCruzadinha);
