# Aba Livros — estudo para implementar (#234)

Estudo de 2026-11-26, com as decisões tomadas com o Lucas na mesma data. Este
documento é a especificação: quem implementa não precisa decidir nada de
produto, só seguir as fatias do fim. O que ainda está em aberto está marcado
como **(aberto)** e fica fora do MVP.

O protótipo aprovado é a referência visual e de comportamento:
`docs/design/carbon-r2/livros.html` (abra no navegador; a barra de baixo
troca os estados). A decisão de arquitetura está no
[ADR 0010](../adr/0010-livro-sobre-o-pdf.md).

## 1. O que é

Uma aba para **ler um livro técnico inteiro** com o tutor ao lado: a página
se revela um parágrafo por vez, o aluno pergunta sobre o trecho exato onde
está, responde uma pergunta curta no fim de cada seção e resolve os
exercícios do livro com dicas. O que ele errou ou pulou vai para o Caderno.

É uma função separada, **não um modo do PDF da matéria**: o PDF da matéria o
aluno já viu na aula; o livro ele lê sozinho, do começo ao fim, em semanas.
A ideia vem do ChapterPal ("conversational reader"), feita do jeito da Mesa.

Três regras guiam tudo:

1. **O PDF fica intacto.** Nada de converter o livro para outro formato. A
   Mesa monta um índice de blocos ao lado do PDF e desenha a cortina por cima
   da página de verdade (ADR 0010).
2. **O tutor não estraga o livro.** Ele só lê até onde o aluno leu, e a
   resposta de um exercício só aparece depois da primeira tentativa. Essas
   regras ficam no núcleo Bend, não no prompt.
3. **Nada novo onde já existe.** Conversa, composer, chip, cartões de quiz
   (#92), Caderno e peças do Quadro (#221) são reusados.

## 2. Decisões

| Decisão | Escolha | Por quê |
| --- | --- | --- |
| Nome e lugar | Aba **Livros** na barra, depois do Caderno e do GeoGebra | Uma aba por função, como o Caderno. |
| GeoGebra | **Fica** (revisto em 2026-11-26; a #235 fechou como `wontfix`) | O GeoGebra calcula o que o modelo só descreve (região por desigualdade, objeto que depende de controle deslizante, área), os modelos conhecem os comandos dele, e o aluno mexe na construção. SVG e peça do Quadro não substituem isso. |
| Caderno | Fica; os livros o alimentam | Mesmo store e mesma revisão espaçada. |
| PDF da matéria | Não ganha leitura ativa | Já foi visto na aula. |
| Conversão do PDF | **Nenhuma**; índice de blocos ao lado | Teste com o PDF real (§4.3). |
| Passo da cortina | Um bloco (parágrafo); figura é passo próprio | ↓ ou espaço revela um; Page Down revela uma tela. |
| Forma da cortina | Recortada por bloco, não uma faixa | Figura na margem e texto que contorna figura. |
| Fim da seção | **Antes de seguir**: uma pergunta, portão macio | Responder ou Pular; errar ou pular manda ao Caderno. |
| Idioma do quiz e das dicas | O da interface (português), mesmo com livro em inglês | O aluno pensa na língua dele. |
| Conversa | Uma por livro, contínua, com divisor por capítulo | O tutor lembra das dúvidas anteriores. |
| Spoiler | O tutor só lê até o ponto lido | Lei no Bend (§9). |
| Exercícios | Cartão no tutor; até 3 dicas, uma por vez; resposta do apêndice só depois da 1ª tentativa | Lei no Bend (§9). |
| Bloco errado | **Ver os blocos**: juntar, separar, "Não é bloco" | O conserto fica no índice, não no PDF. |
| Tema escuro | Página branca por padrão; **Inverter página** no menu ☰ do livro | O PDF é branco; inverter estraga figura colorida. Recomendação aceita na revisão do protótipo. |
| Capa | Tirada da página 1 do PDF | Aparece no cartão da estante. |
| Livro de teste | Grokking Algorithms, do próprio Lucas | O PDF **nunca** entra no repositório (§11). |

## 3. Telas (protótipo)

O protótipo tem um estado por botão da barra de baixo:

| Estado | O que mostra |
| --- | --- |
| Estante | Cartões com capa, título, "Cap. 1 · seção", %, barra, **Continuar** e "N no Caderno"; o ladrilho **Adicionar livro** |
| Importar | O cartão do livro novo montando o índice, com o que foi achado (páginas, capítulos, blocos, figuras, apêndice de respostas) |
| Leitura | A página com a cortina; a barra de leitura (Revelar, trilha de seções, "N / M", **Perguntar aqui**); o tutor ao lado |
| Perguntar aqui | O chip "p. 6 · passo 7" no composer e o painel "Vai com a mensagem" |
| Resposta | O tutor responde sem passar do ponto lido e cria uma peça (`criar_peca`, do Quadro) tocável no chat |
| Fim da seção | O cartão **Antes de seguir** sobre a parte ainda coberta |
| Sumário | Os capítulos do livro, com o ponto lido |
| Ver os blocos | As caixas dos blocos com o número do passo; as ações na faixa de cima |
| Exercício | **Resolver** ao lado do exercício; o cartão com dica, tentativa e "Ver a resposta do livro" |

O texto da página do protótipo foi escrito para o protótipo; ele imita o
formato do livro sem copiar nada dele.

## 4. O livro sem conversão

### 4.1 Importar

**Adicionar livro** pede um PDF. A Mesa:

1. copia o PDF para `runtime/livros/<id>/livro.pdf` (o original não é tocado;
   o `id` sai do SHA-256 do arquivo, então importar o mesmo livro de novo cai
   no mesmo lugar);
2. lê os marcadores (outline) e a camada de texto com o pdf.js;
3. rasteriza cada página em baixa resolução para achar figuras (§4.2);
4. grava `runtime/livros/<id>/indice.json` e `capa.png`.

O cartão da estante mostra o progresso enquanto monta. O livro todo leva por
volta de 15 s (medido com o pdftoppm no teste; com o pdf.js, conferir na
fatia 2). Nada sai da máquina nessa etapa: o índice é local e não usa modelo.

### 4.2 Blocos

Regras do teste, que funcionaram no livro real:

- **Linhas:** os itens de texto se juntam por linha de base.
- **Parágrafo:** quebra quando a distância entre linhas de base passa de
  1,4 × o corpo da letra (no Grokking: 13 pt dentro do parágrafo, 17,5 pt
  entre parágrafos).
- **Tipo:** fonte monoespaçada vira `codigo`; corpo ≥ 13 pt vira `titulo`;
  corpo < 10 e largura < 130 pt vira `nota`.
- **Fora:** cabeçalho corrido e número da página (menos de 7% ou mais de 94%
  da altura da página).
- **Figuras:** tinta da página rasterizada (54 dpi, tons de cinza) que fica
  fora das caixas de texto, juntada em componentes conexos numa grade de 8 px.
- **Passos:** cada bloco é um passo. O título se junta ao bloco seguinte. Uma
  nota de margem se junta à figura que ela toca.
- **Exercícios:** um título "Exercises" (ou o marcador equivalente) seguido de
  itens numerados `1.1`, `1.2`… vira bloco `exercicio` com o número.
- **Respostas:** o marcador do apêndice de respostas ("Answers to exercises")
  dá as páginas; cada resposta é ligada ao exercício pelo número.

Formato de um bloco no índice:

```js
{pagina: 6, passo: 4, tipo: 'texto', caixa: [x, y, w, h],  // pontos do PDF
 texto: '…', exercicio: null}
```

O texto do bloco serve ao tutor. A caixa serve à cortina e ao recorte.

### 4.3 O que o teste mostrou (2026-11-26, Grokking Algorithms)

- 258 páginas, 247 com texto, 166 marcadores em três níveis.
- 9,4 passos por página em média.
- **Código anotado** se parte em vários blocos (código, nota, código). É o
  caso que o **Ver os blocos** conserta (§8).
- **Ligaduras perdidas:** fi, fl, ff e Th somem em todos os extratores
  (pdf.js, pdftotext, mutool); "irst" aparece 133 vezes. Conserto por
  dicionário errou palavras e foi abandonado. Por isso o "Perguntar aqui"
  sempre leva o **recorte em imagem** junto com o texto.
- 11 páginas sem texto (capa, ilustrações): cada uma vira um passo só, de
  imagem.

### 4.4 Quando o PDF não ajuda

| Caso | O que a Mesa faz |
| --- | --- |
| Texto + marcadores | Blocos e seções, como acima |
| Texto sem marcadores | Seções pelo corpo dos títulos; o aluno confirma a lista na importação |
| Escaneado (sem texto) | Cortina por faixas da altura da página; o "Perguntar aqui" leva só o recorte **(aberto: OCR)** |

## 5. Leitura

- **Cortina:** cada bloco ainda não revelado fica borrado no lugar dele
  (blur de 5 px, opacidade 0,45). No app, é uma caixa com `backdrop-filter`
  por bloco sobre o canvas da página. Não use `clip-path` com recorte
  `evenodd`: com `backdrop-filter` o Chromium não abre os furos (visto no
  protótipo).
- **O bloco nasce coberto.** Desenhar a página sem o borrão e cobrir depois
  faz a transição mostrar o texto inteiro por um instante (bug achado no
  protótipo). Revelar só troca a classe do bloco revelado.
- **Teclas:** ↓ ou espaço revela um passo; Page Down revela até encher a tela;
  clicar num bloco coberto revela até ele.
- **Marcador:** o passo atual ganha a barra de acento à esquerda.
- **Leitura ativa:** o interruptor no cabeçalho do livro tira a cortina (ler
  normal). O ponto lido continua sendo gravado.
- **Barra de leitura:** Revelar, a trilha de seções do capítulo (largura pelo
  número de passos), "N / M" da seção e **Perguntar aqui**.
- **Ponto lido ("Leu até"):** `(página, passo)` mais adiante já revelado. Só
  avança; voltar páginas não o recua. Fica em `runtime/livros/<id>/leitura.json`
  com a página aberta.
- **Sumário:** o botão com o capítulo abre a lista dos marcadores; capítulo
  além do ponto lido abre com a cortina inteira.
- **Inverter página:** no menu ☰ do livro, só com o tema escuro; inverte
  luminância (`invert(1) hue-rotate(180deg)`), guardado por livro.

## 6. Perguntar aqui e o tutor do livro

- **A conversa** é uma por livro, contínua, com um divisor
  "Hoje · Cap. N" quando o capítulo muda. Por baixo, é uma sessão como as da
  Livre, ligada ao livro (`livro:<id>`), com os dois motores.
- **Perguntar aqui** põe um chip no composer e nunca envia (o contrato do
  "Levar ao tutor" do #42 e do Quadro). O chip abre "Vai com a mensagem":

| Linha | Exemplo |
| --- | --- |
| Livro | `Grokking Algorithms` |
| Onde | `Cap. 1 › Binary search · p. 6 · passo 7` |
| Trecho | o texto do bloco atual |
| Recorte | imagem do bloco (por causa das ligaduras) |
| Leu até | `p. 6 · passo 7` |

- **Ferramenta `ler_livro`** no MCP `mesa`: devolve texto de páginas do livro
  da conversa. Página além do ponto lido volta recusada, com o motivo; os
  títulos do sumário vêm sempre. A recusa mora no núcleo (§9, lei 1), não no
  prompt.
- **Peças:** o tutor pode usar `criar_peca` do Quadro (#225) e as figuras como
  em qualquer conversa; a peça é tocável no chat e tem **Abrir no quadro**.

## 7. Antes de seguir e o Caderno

- Ao entrar numa seção, o tutor gera em segundo plano **uma** pergunta sobre
  ela (cartão de quiz do #92, em português). Assim não há espera no fim.
- Ao revelar o último passo da seção, o próximo passo não revela: aparece o
  cartão **Antes de seguir** sobre a parte coberta. Responder ou **Pular**
  libera.
- Errar ou pular manda o item ao Caderno, com a pergunta, a resposta certa e
  a referência `livro:<id> · p. N`.
- **Caderno:** os itens do livro usam o mesmo `review.cjs`, com a chave
  `livro:<id>` no lugar do id da matéria. O cartão do livro na estante mostra
  "N no Caderno". Conferir na fatia 5 como o Caderno soma as chaves hoje e
  incluir as de livro na contagem da barra.

## 8. Ver os blocos

Pelo menu ☰ do livro. A página mostra uma caixa por bloco, colorida pelo
tipo, com o número do passo. A faixa de cima ganha as ações da escolha (numa
barra flutuante, ela tampava o bloco vizinho):

- clique escolhe um bloco; ⇧ escolhe vários;
- **Juntar num passo** (vários): os passos escolhidos viram um só;
- **Separar aqui** (um): parte o bloco na linha clicada;
- **Não é bloco**: tira do índice (cabeçalho, marca d'água);
- **Desfazer** e **Pronto**.

O conserto grava em `indice.json` (uma lista de operações sobre o índice
gerado, para sobreviver a uma remontagem). O PDF não muda.

## 9. Regras no núcleo Bend

Pelo ADR 0003, entra no Bend o que custaria algo ao aluno se quebrasse. O
núcleo novo é `core/livros.bend`, com leis em `core/laws/` e provas em
`core/proofs/`:

1. **Sem spoiler.** `podeLer(pagina, leuAte)`: a `ler_livro` só devolve
   páginas até o ponto lido; o resto é recusado. A página de resposta de um
   exercício só entra depois da primeira tentativa dele (lei 3). Quebrar isso
   entrega ao aluno o que ele ia descobrir lendo.
2. **O ponto lido só avança.** `avancar(leuAte, passo)` devolve o maior dos
   dois; abrir página anterior ou tirar a leitura ativa não o recua. Recuar
   liberaria menos ao tutor e esconderia o que o aluno já leu.
3. **Resposta depois da tentativa.** `respostaVisivel(tentativas)` é falso com
   zero tentativas, no padrão de `revealAllowed` do `quizcard.bend`.
4. **Dicas.** No máximo 3, uma por pedido, e uma dica que contém a resposta
   do livro (texto normalizado) é recusada e pedida de novo. Usar a 3ª dica,
   errar ou ver a resposta manda o exercício ao Caderno.
5. **Portão da seção.** Com a pergunta da seção pendente, revelar além do fim
   da seção não avança; responder ou pular libera, e errar ou pular gera o
   item do Caderno.
6. **O chip é o passo exibido.** O "Onde" do Perguntar aqui é o passo atual
   quando o botão foi apertado, como a lei 3 do Quadro.

Fica em JS com teste: detecção de blocos (§4.2), layout, cores, classes,
textos e durações.

## 10. Onde mora cada coisa (para o mapa)

| Camada | Arquivo |
| --- | --- |
| Núcleo | `core/livros.bend` + leis e provas |
| Artefato | `desk/src/generated/livros.core.js` |
| Índice | `desk/livros/indice-*.mjs`: linhas, parágrafos, tipos, figuras por tinta, passos, exercícios e respostas, um módulo por etapa |
| Estante e disco | `desk/livros-host.cjs` (importar, copiar, `indice.json`, `leitura.json`, `capa.png`) e os handlers `ipcMain` |
| Leitor | `desk/src/livros/*.mjs` (estante, página com cortina, barra, sumário, Ver os blocos, cartão de exercício) |
| Tutor | sessão `livro:<id>` sobre a infraestrutura da Livre; `ler_livro` no MCP `mesa` (Claude e OpenCode, guia único em `desk/src/extensions/mesa-livro/guide.mjs`) |
| Caderno | `desk/review.cjs` com a chave `livro:<id>` |
| Barra | `core/tabsview.bend` ganha a aba Livros depois da GeoGebra |
| Textos | catálogos `pt-BR` e `en` (#41) |
| Testes | `desk/tests/livros-*.test.mjs`, `livros-ui.mjs`; fixtures em PDF **gerados pelo teste**, nunca de um livro de verdade |

Cada arquivo novo fica abaixo de 500 linhas. O protótipo (`livros.js`,
`livros-pagina.js`, `livros-exercicio.js`) mistura dados de exemplo e casca;
ao portar, separe nas camadas da tabela.

## 11. Fora do escopo

- Converter o PDF (EPUB, HTML, Markdown) ou alterar o arquivo.
- Pôr no repositório o PDF de um livro, capturas dele ou trechos copiados.
  O livro de teste é do Lucas e fica só na máquina dele.
- Leitura ativa no PDF da matéria.
- Resumo em áudio, GeoGebra dentro do leitor do livro e execução de código
  no leitor (do ChapterPal). O GeoGebra da Mesa continua na aba dele.
- Canvas de tinta na Mesa (regra do AGENTS.md).
- Mudar defaults de `desk/config.cjs`.
- **(aberto)** OCR para livro escaneado; termos-chave borrados na releitura;
  cofre de notas por livro.

## 12. Fatias (issues `ready-for-agent`)

A primeira versão deste plano tirava o GeoGebra (#235). Isso foi revisto no
mesmo dia: o GeoGebra fica e a #235 fechou como `wontfix` (§2). As fatias
começam na #236; ela vem antes das outras, e as #238 a #241 podem andar em
paralelo depois da #237 (a #241 usa a conversa da #238).

1. **Estante e importação** (#236). Aba Livros depois da GeoGebra, estante,
   Adicionar livro, índice (§4), capa, fixtures gerados.
2. **Leitor com a cortina** (#237). §5, leis 2 e 6 do núcleo, Inverter página.
3. **Perguntar aqui e o tutor do livro** (#238). §6, `ler_livro`, lei 1.
4. **Antes de seguir e o Caderno** (#239). §7, lei 5.
5. **Ver os blocos** (#240). §8.
6. **Exercícios** (#241). Detecção, ligação com o apêndice, cartão, leis 3 e 4.

Depois, **(aberto)**: o GeoGebra virar um tipo de aba do Quadro (#221), como o
PDF, para aparecer onde o tutor o abre sem ocupar a barra.
