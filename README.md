# Cruzadinha de Arquitetura Computacional

Jogo educacional feito em **HTML, CSS e JavaScript puros** para treinar os termos da aula de **Tópicos de Arquitetura Computacional**.

## História

Na **Operação Nevasca**, você acompanha uma missão em ambiente glacial com briefing inicial e objetivos por etapas.
Depois da introdução, o desafio passa pela cruzadinha e pelo modo de fases com trilha na neve.
**Personagem e história são fictícios.**

## Como jogar

### Cruzadinha

- Abra a aba **Cruzadinha**.
- Clique em uma casa numerada e digite as respostas com base nas pistas.
- Use o botão **Conferir** para validar o progresso.
- Complete as **14 palavras** para finalizar.

### Modo Arrastar

- Abra a aba **Modo arrastar** e escolha uma fase liberada.
- Arraste os chips de resposta para os alvos corretos.
- O modo possui **pontuação**, **sequência de acertos** e **dicas**.
- Ao concluir uma fase, você recebe **1 a 3 estrelas**.
- Novas fases são **desbloqueadas progressivamente**.
- A **trilha com o explorador** acompanha o progresso das fases concluídas.

## Palavras da cruzadinha (array `PALAVRAS`)

| Nº | Direção | Palavra | Pista |
|---:|---|---|---|
| 1 | Horizontal | ADDRESSBUS | Fios que só saem da CPU e indicam qual posição será lida ou escrita. |
| 2 | Vertical | ULA | Parte da CPU que faz as contas e as operações lógicas. |
| 3 | Vertical | DMA | Circuito que copia dados do dispositivo para a memória, deixando a CPU livre. |
| 4 | Vertical | UC | Lê cada instrução, descobre o que ela pede e manda ordens às outras partes. |
| 5 | Horizontal | MICROCONTROLADOR | Chip que reúne CPU, memória e entrada e saída, feito para uma tarefa específica. |
| 6 | Vertical | CPU | Bloco do computador que busca e executa as instruções do programa. |
| 7 | Vertical | ROM | Memória não volátil de firmware de inicialização, cujo nome ficou antigo. |
| 8 | Vertical | DATABUS | Fios de mão dupla que levam o valor lido ou escrito e as instruções. |
| 9 | Vertical | RAM | Memória volátil de trabalho que guarda programas em execução e seus dados. |
| 10 | Vertical | CACHE | Veloz e dentro do processador, guarda cópia do que a CPU usou há pouco. |
| 11 | Horizontal | FLASH | Não volátil e regravável como a do pendrive; no Uno guarda o programa. |
| 12 | Vertical | EEPROM | Memória do Uno onde o próprio programa guarda dados que devem sobreviver ao desligamento. |
| 13 | Horizontal | REGISTRADORES | Pequenas memórias dentro da CPU, as mais rápidas, guardando o dado em uso agora. |
| 14 | Horizontal | MEMORIADEMASSA | Nível não volátil da hierarquia, como SSD ou HD, que guarda arquivos e programas instalados. |

## Site publicado

https://joaopedro-castro.github.io/Game-ARQ-COMP-/

## Estrutura de arquivos

```text
.
├─ index.html
├─ style.css
├─ script.js
├─ arrastar.css
├─ arrastar.js
├─ trilha.css
├─ trilha.js
├─ intro.css
├─ intro.js
├─ neve.js
├─ sons.js
├─ ux.js
├─ visual.js
├─ assets/
│  ├─ Agentecia.jpg
│  └─ Agentecia.png
└─ README.md
```
