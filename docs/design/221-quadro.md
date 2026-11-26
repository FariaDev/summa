# Quadro da aba Livre — estudo para implementar (#221)

Estudo de 2026-11-25, com as decisões tomadas com o Lucas na mesma data. Este
documento é a especificação: quem implementa não precisa decidir nada de
produto, só seguir as fatias do fim. O que ainda está em aberto está marcado
como **(aberto)** e fica fora do MVP.

O protótipo aprovado é a referência visual e de comportamento:
`docs/design/carbon-r2/quadro-livre.html` (abra no navegador; a barra de baixo
troca os estados). A decisão de arquitetura está no
[ADR 0009](../adr/0009-quadro-kits.md).

## 1. O que é

O Quadro ocupa a área do leitor da aba Livre. Ele mostra **peças**: conteúdo
interativo que o tutor cria (roteiro de código, desenho narrado, cena) e os
PDFs da sessão. O aluno toca, pausa em qualquer ponto e pergunta; o tutor
recebe o ponto exato onde ele parou.

Três regras guiam tudo:

1. **O host é dono da forma; o modelo manda só o conteúdo.** Tempo, ritmo,
   cores, fontes, tamanhos, layout, transições, transporte, "Perguntar aqui",
   acessibilidade e limites são do kit. O modelo escreve um roteiro curto que
   chama o kit. É o mesmo princípio das figuras (#60): a cor literal vira token,
   o desenho segue o tema.
2. **Consistência entre modelos vem de ferramenta, não de prompt.** Um guia
   único para os dois motores, um esquema validado na criação, a `ver_peca`
   com avisos objetivos e um banco de teste com modelos diferentes.
3. **Nada novo onde já existe.** A peça é uma atividade do #42 por baixo: o
   mesmo store por conversa, versões, revisão no lugar, sandbox offline,
   `mesa.state`, janela escondida da prévia e ponte MCP Apps.

## 2. Decisões

| Decisão | Escolha | Por quê |
| --- | --- | --- |
| Nome | **Quadro** | Aprovado. |
| Onde | Substitui a área do leitor da Livre | Um lugar só para PDF e peça; o PDF vira um tipo de peça. |
| Quantas peças à vista | Uma por vez, em abas, na ordem em que nasceram | O quadro inteiro para a peça; abas como as das matérias. |
| Sessões | Cada sessão da Livre guarda as peças e o estado delas | Voltar a uma conversa antiga traz o quadro dela, parado onde ficou. |
| Conversas ligadas | Várias; o tutor recebe resumo, questão ativa e PDFs sob demanda | Nada muda nas conversas ligadas. |
| Peça criada numa matéria | Tocável no chat (quadro do #42) + **Abrir no quadro** | Leva para a Livre com a conversa da matéria ligada. |
| Ferramentas | **`criar_peca` + `ver_peca`**, novas | Esquema e guia próprios por kit; por baixo reusam o store, a sandbox e a prévia das atividades. `criar_atividade` continua para HTML livre. |
| Primeiro kit | **Roteiro + estruturas** (vetor, árvore, pilha) | Gravação determinística, fácil de testar, cobre Algoritmos II. Depois desenho narrado, depois cena. |
| Voz | Não | Narração em texto que acende com o progresso. |
| Vídeo | Não; desenho narrado no lugar | Leve, segue o tema, dá para perguntar em qualquer ponto. |
| psychoscript | Fora por ora | Só suspende em chamada ao host; não dá passo por linha. A gravação determinística cobre o caso. |
| "E se…" | Reexecuta com outra entrada | O roteiro é determinístico; a execução do aluno não muda. |
| Exercício por template | Reusa os cartões de quiz do #92 | Não há tipo de peça novo para isso. |

## 3. O que a Livre já tem e onde fica

A Livre continua sendo o lugar de estudar **sem matéria**: a sessão avulsa
guarda conversa e PDFs como rascunho, e o que der certo vira matéria depois.
O Quadro troca só a área do leitor; a barra e os fluxos de hoje ficam.

| Hoje (`desk/index.html`, `free-study*.mjs`) | No Quadro |
| --- | --- |
| Seletor **Materiais** da sessão | Some: cada PDF da sessão é uma aba |
| **Abrir PDF** | Igual; o PDF abre como aba nova |
| **PDF pelo tutor** (botão cheio) e o `criar_pdf` | Igual; o PDF salvo vira aba nova |
| Mais opções: **Montar PDF**, **Adicionar à matéria…**, **Criar matéria** | Iguais. Adicionar à matéria continua só para PDF |
| Vazio "O que você quer estudar?" com Abrir PDF, PDF pelo tutor e Criar matéria | Igual, quando a sessão não tem aba |
| Criar matéria leva a sessão e os PDFs | Leva também as peças: elas são atividades da conversa, e o store segue a conversa pela identidade portátil. Conferir com teste na fatia 1 |

O PDF personalizado **não é só da Livre**: nas matérias, o `criar_pdf` do
tutor já salva na matéria (`course-save-material`), o modelo é lembrado por
matéria e o menu Estudar tem **PDF pelo tutor**. Nada disso muda aqui.

## 4. Níveis de liberdade

1. **Template de dados** (futuro): o modelo só preenche campos
   (por exemplo, um vetor e um alvo). Nada de código.
2. **Roteiro de kit** (MVP): o modelo escreve JavaScript curto que chama o kit.
   É o nível de `busca-binaria.roteiro.js` e `pitagoras.desenho.js`.
3. **HTML livre**: `criar_atividade` como hoje, para o que nenhum kit cobre.

O guia manda subir de nível só quando o de baixo não serve.

## 5. A peça por dentro

### 5.1 Especificação que o modelo manda (`criar_peca`)

```js
{
  kit: 'roteiro',                 // 'roteiro' no MVP; depois 'desenho', 'cena'
  titulo: 'Árvore de busca: inserir',
  arquivo: 'arvore-busca.roteiro.js',   // só rótulo, aparece na ferramenta
  linguagem: 'JavaScript',        // rótulo do código mostrado
  codigo: ['function inserir(no, v) {', ...],   // as linhas que o aluno lê
  entradas: {valores: {valor: '50 30 70 20 40 60 45', rotulo: 'valores'}},
  roteiro: 'function (k, {valores}) { ... }',   // corpo do roteiro, texto
  alternativeMarkdown: '...',     // descrição completa, como no #42
  pecaId: '...'                   // opcional: revisa a peça no lugar
}
```

O roteiro chega como texto e entra no documento da peça como script, do mesmo
jeito que o campo `js` do #42 entra hoje. A sandbox continua sem `eval` e sem
`new Function`.

O roteiro é o algoritmo de verdade com pontos de parada. Exemplos completos:
`docs/design/carbon-r2/busca-binaria.roteiro.js` e `arvore-busca.roteiro.js`.

### 5.2 API do kit de roteiro

Tudo em português, como no protótipo. Os nomes são parte do contrato do guia.

| Chamada | Faz |
| --- | --- |
| `k.linha(n, nota, vars)` | Grava um passo: linha `n` do código, a nota (uma frase), as variáveis daquele instante e um instantâneo de todas as estruturas. É o único ponto de parada. |
| `k.marco(rotulo)` | Abre um trecho com nome na linha do tempo (vira segmento do scrub e quadro-chave da `ver_peca`). |
| `k.vetor(nome, valores)` | Vetor. Devolve `faixa(lo, hi)`, `ponteiros({nome: i, ...})`, `marcar(i, 'atual' \| 'achado')`, `definir(i, v)`, `limpar()`. |
| `k.arvore(nome)` | Árvore binária. Devolve `raiz(v)` e `filho(paiId, 'esq' \| 'dir', v)`, que retornam ids, `marcar(id, 'atual' \| 'novo' \| 'caminho')` e `limpar()`. Marcar um nó como `atual` rebaixa o anterior para `caminho`. |
| `k.pilha(nome)` | Pilha de chamadas (uma por roteiro). Devolve `empilhar(texto)` e `desempilhar()`. |

Erro de uso lança mensagem com o valor recebido e o formato esperado
(`lado deve ser 'esq' ou 'dir'; recebi "left"`), como pede o AGENTS.md.

### 5.3 Gravação

`gravar(def, entradas)` roda o roteiro uma vez e devolve
`{frames, marcos, topo, layout, W, H, maxPilha}`. Cada frame é
`{linha, nota, vars, est: [instantâneos], pilha: {nome, itens} | null}`.

- Teto de 400 passos; passar disso lança erro.
- Sem `k.linha` nenhum é erro.
- Sem marco no passo 0, o kit cria um com o título.
- Durante a gravação o kit troca `Math.random` por um gerador com semente fixa
  e `Date.now`/`new Date()` por um instante fixo. A `ver_peca` ainda grava duas
  vezes e compara.
- O tocador **não executa** o roteiro passo a passo: ele toca os frames
  gravados. Pausar, voltar e pular são só índices.

### 5.4 Palco e desenho

Referência: `quadro-kit-roteiro.js`, seções "medidas" e "desenho".

- **Tamanho fixo pela gravação.** Largura mínima de 480 e altura do maior
  passo; o palco não pula entre passos. A pilha reserva a altura da maior pilha.
- **Layout da árvore fixo pela gravação.** As posições saem da união dos nós de
  todos os passos (em ordem simétrica, `dx` 44, `dy` 54, raio 16). Inserir um nó
  não empurra os outros. Na rodada 3 o layout por passo fazia a árvore inteira
  escorregar a cada inserção, e o Lucas achou "cru".
- **Itens com chave e reconciliação.** Cada passo vira uma lista de itens
  `{k, camada, tag, cls, a, s, de, t}`; `syncStage` reaproveita o elemento de
  mesma chave, então a transição CSS anda. Três camadas fixas: arestas, formas,
  textos e marcas.
- **Movimento que explica:**
  - o ponteiro do vetor desliza entre células;
  - um anel único (`est-cursor`) percorre a descida na árvore;
  - o nó novo nasce na posição do pai e desce até o lugar dele, com a aresta
    crescendo junto (`de` é o estilo inicial, só na criação);
  - as arestas do caminho acendem.
- **Durações:** 320 ms para posição e 200 ms para cor; o passo do "Rodar" é de
  600 ms. Com `prefers-reduced-motion` não há transição.
- **Cores só por classe e token** (`est-cel`, `est-no.atual`, ...). A única cor
  inline é a do ponteiro, e ainda assim `var(--plot-n)`, na ordem em que o
  ponteiro aparece pela primeira vez: `--plot-1`, `--plot-2`, `--plot-5`,
  `--plot-3`.
- **Fontes por papel:** Plex Mono para valores, índices e código.

### 5.5 Transporte e lado do aluno

- **Barra:**
  - Rodar/Pausar;
  - passo anterior e próximo;
  - o scrub, segmentado por marco: `role=slider` com setas ←/→;
  - "passo N / M";
  - **Perguntar aqui**, escondido enquanto toca.
- **Abaixo do palco:**
  - a pilha (o topo em destaque) e as variáveis, com a que mudou marcada;
  - a nota do passo, em `aria-live=polite`;
  - os campos de entrada e o botão **E se…**.
- **Mudar uma entrada** grava de novo e volta ao passo 1. Entrada que quebra o
  roteiro mostra o erro na nota e mantém a gravação anterior.
- **O estado** vai para `mesa.state`: `{passo, entradas}`. Ao revisar a peça,
  o estado da versão anterior é levado se o kit for o mesmo, com o passo
  limitado ao novo total; ver §7.

### 5.6 Perguntar aqui

O botão anexa um **chip** ao composer do tutor e nunca envia; é o mesmo
contrato do "Levar ao tutor" do #42. O chip abre o painel "Vai com a mensagem"
com as linhas:

| Linha | Exemplo |
| --- | --- |
| Linha | `2: if (no === null) return novoNo(v);` |
| Variáveis | `v = 45 · no.v = —` |
| Pilha | `inserir(null, 45) · inserir(40, 45) · … (topo primeiro)` |
| Árvore / Vetor | `50(30(20, 40(·, 45)), 70(60, ·)) · atual 40` |
| Entrada | `valores = 50 30 70 20 40 60 45` |
| Passo | `26 de 29: Lugar vazio à direita de 40: 45 entra aqui.` |
| Ramo | só no "E se…" |

O tutor recebe essas linhas como texto, junto com o id da peça. Na matéria é
igual: a peça tocável no chat põe o chip no composer da matéria. A peça manda
isso ao host por uma notificação nova da ponte: `mesa/notifications/ask`,
`{rotulo, linhas, passo}`. O host monta o chip; a peça não fala com o
composer.

Na resposta, o tutor pode linkar um instante com
`[passo 27](mesa-peca:<pecaId>?passo=27)`. O chat transforma esse link num
botão (`.tlink`) que abre a aba da peça e vai ao passo. Esse formato entra no
guia.

### 5.7 E se…

O botão põe um chip de ramo e começa a mensagem com "E se ". O tutor responde
chamando a `ver_peca` com as entradas novas, o que grava de novo sem tocar na
peça do aluno, e conta o resultado. A peça do aluno continua onde estava. Não
há edição de estado no meio da execução.

## 6. Ferramentas do modelo

### 6.1 `criar_peca`

- Valida o esquema (§5.1) e roda a `ver_peca` antes de publicar. Se houver
  aviso **bloqueante**, não publica e devolve os avisos.
- **Bloqueantes:** roteiro que lança erro, mais de 400 passos, gravação não
  determinística e linha fora do código.
- O resto é aviso que não bloqueia.
- Publica como atividade na conversa atual:
  - na Livre, abre como aba nova do Quadro;
  - numa matéria, aparece tocável no chat, com **Abrir no quadro**.
- `pecaId` revisa no lugar, como o `activityId` do #42.
- O texto de volta segue o do `publishedText` do #42: o aluno já vê, não
  anuncie nem repita.

### 6.2 `ver_peca`

Equivalente à `ver_figura` (#60) e ao `previsualizar_atividade` (#42) para
peças. Roda na janela escondida do `activity-preview.cjs` e devolve três
coisas:

- **passos:** o total gravado;
- **avisos:** cada um com o valor encontrado, o limite e os passos onde ocorre;
- **folha de quadros-chave:** um PNG com até 6 quadros. Pega o fim de cada
  marco; com menos de 3 marcos, pega 4 instantes espalhados.

Também aceita `entradas` diferentes das da peça, que é o que serve ao "E se…".

| Aviso | Limite |
| --- | --- |
| Gravações diferentes com a mesma entrada | bloqueia |
| Passo sem nota | — |
| Nota longa | 110 caracteres |
| Linha fora do código | bloqueia |
| Passo igual ao anterior | — |
| Vetor | 11 células |
| Árvore: níveis | 6 |
| Árvore: nós lado a lado | 10 |
| Pilha | 7 chamadas |
| Item da pilha | 24 caracteres |
| Passos | 120 (aviso), 400 (bloqueia) |

O aviso diz o que achou e o limite, por exemplo
`árvore com 7 níveis; o quadro lê bem até 6 · passo 43 a 49 (7)`. No chat ele
aparece recolhido, como as outras ferramentas, com o ícone de alerta em
`--danger-text`.

### 6.3 Guia único

O guia fica em `desk/src/extensions/mesa-peca/guide.mjs`, uma fonte só para
Claude e OpenCode, como o `mesa-activity/guide.mjs`. Ele traz:

- quando usar peça, figura ou atividade (os níveis do §4);
- a API do kit (§5.2), com os dois exemplos do protótipo;
- o fluxo esperado: `criar_peca`, depois `ver_peca` se houve aviso, e então
  corrigir;
- os limites da tabela acima;
- o link `mesa-peca:`;
- "não anuncie a peça, ela já está na tela".

## 7. Regras no núcleo Bend

Pelo ADR 0003, entra no Bend o que custaria algo ao aluno se quebrasse. O
novo núcleo é `core/quadroview.bend`, com leis em `core/laws/` e provas em
`core/proofs/`:

1. **Restaurar sessão.** Abrir uma sessão devolve a mesma aba aberta. A aba que
   não existe mais cai na última que existe. O passo é limitado a
   `[0, total-1]`. Quebrar isso faz o aluno perder onde estava.
2. **Revisão leva o estado.** Mesmo kit leva `passo` e `entradas`, com o passo
   limitado. Kit diferente zera o estado. Entradas cujos nomes sumiram são
   descartadas.
3. **O chip é o passo exibido.** O `passo` do payload do "Perguntar aqui" é o
   passo pintado quando o botão foi apertado, nunca o seguinte. Pergunta sobre
   o passo errado faz o tutor responder outra coisa. O artefato gerado entra
   no pacote do kit servido à sandbox, porque é lá que o chip nasce.
4. **(depois, na cena)** O portão de previsão: a resposta não aparece antes da
   tentativa, no mesmo padrão de `revealAllowed` do `quizcard.bend`.

Fica em JS com teste: layout, cores, classes, ordem das abas, textos e
durações.

## 8. Onde mora cada coisa (para o mapa)

| Camada | Arquivo |
| --- | --- |
| Núcleo | `core/quadroview.bend` + leis e provas |
| Artefato | `desk/src/generated/quadroview.core.js` |
| Kit (roda na sandbox) | `desk/src/quadro/kit-roteiro/{gravar,estruturas,palco,transporte,pergunta}.mjs`, servido como `mesa-activity://lib/quadro-roteiro.js`, como o Chart.js |
| Documento da peça | `desk/activity-document.cjs` ganha o modo peça: marcação e CSS do kit + roteiro do modelo |
| Ferramentas | `desk/src/extensions/mesa-peca/{guide,client}.mjs`; Claude em `desk/src/agents/activity-tools.cjs`; OpenCode em `desk/src/extensions/summa-mcp/tools.mjs`; rota `/peca` em `desk/activity-bridge.cjs` |
| ver_peca | `desk/activity-preview.cjs` (mesma janela, mesma sessão trancada) |
| Store | `desk/activity-store.cjs` sem mudança de formato: a peça é uma atividade com `spec.peca` |
| Quadro na Livre | `desk/src/study/quadro/*.mjs` (abas, troca de peça, chip) no lugar do leitor em `free-study.mjs`. A ordem das abas e a aba aberta são estado de interface: vão em `desk.json` → `quadro`, com chave `free:<id>`, como o `pdfModels`. Ficam fora do `config.json` e do registro da sessão |
| Chip e link | composer: chip com payload; renderer do chat: link `mesa-peca:` |
| Textos | catálogos `pt-BR` e `en` (#41) |
| Testes | `desk/tests/quadro-*.test.mjs` (gravação, avisos, layout fixo, reconciliação, restauração), `quadro-ui.mjs` (janela), `hunt-pecas.mjs` (banco entre modelos) |

Cada arquivo novo fica abaixo de 500 linhas, como o AGENTS.md pede. O
protótipo `quadro-kit-roteiro.js` tem 445 linhas e mistura tudo; ao portar,
separe nas camadas da tabela.

## 9. Banco de teste entre modelos

`desk/tests/hunt-pecas.mjs` roda seis pedidos fixos em dois motores:

- **Motores:** Claude (Sonnet) e o modelo grátis padrão do OpenCode
  (`free-models.json`).
- **Pedidos:** busca binária; inserção em árvore com pilha; ordenação por
  inserção num vetor; fatorial recursivo com pilha; percurso em ordem; um pedido
  vago ("me mostra recursão").

Para cada um, o banco confere quatro coisas:

1. o esquema passou;
2. a `ver_peca` final saiu sem aviso bloqueante;
3. houve no máximo dois avisos comuns;
4. o roteiro não tem cor, coordenada nem tamanho literal (grep simples por `#`,
   `px` e `rgb`).

O banco também guarda a folha de quadros-chave para olhar. Ele não roda no
`npm test` (gasta tokens); roda à mão, como os outros hunts.

## 10. Fatias (issues `ready-for-agent`)

Em ordem; cada uma fecha com testes e passa pelos portões.

1. **Casca do Quadro na Livre.**
   - A área do leitor vira o Quadro, com abas de peça; os PDFs da sessão viram
     abas.
   - O estado das abas fica na sessão.
   - `quadroview.bend` com a lei 1.
   - Sem kit ainda: a aba de PDF funciona como o leitor de hoje.
   - A barra da Livre e o vazio ficam como na §3; o seletor Materiais sai.
   - Teste de regressão: Criar matéria leva as atividades da sessão.
2. **Kit de roteiro na sandbox.**
   - Gravação, estruturas, palco com layout fixo e movimento (§5.3–5.5).
   - `mesa.state` com `{passo, entradas}`.
   - Testes de gravação, reconciliação e layout.
3. **`criar_peca` + guia único.**
   - Esquema, publicação na Livre (aba nova) e na matéria (tocável +
     Abrir no quadro).
   - Revisão por `pecaId` e lei 2. Hoje o `activity-store.cjs` guarda o
     estado por `<id>@<versão>@<hash>`, e uma versão nova começa vazia. A
     fatia faz o store copiar o estado da versão anterior pela lei 2 (só
     peças; atividade comum segue como está).
4. **`ver_peca`.**
   - Gravação dupla, avisos (§6.2), folha PNG.
   - Bloqueio na `criar_peca`.
5. **Perguntar aqui.**
   - Notificação `mesa/notifications/ask`, chip e painel, payload ao tutor,
     link `mesa-peca:`.
   - Lei 3.
6. **Abrir no quadro** a partir da matéria, com a conversa ligada.
7. **Banco entre modelos** (§9).

Depois do MVP, cada um em marco próprio: kit de desenho narrado (protótipo
`quadro-kit-desenho.js`), kit de cena (`quadro-cena.js`) com o portão de
previsão no Bend, e então construção arrastável, circuito e som
**(aberto)**. Antes de inventar construção arrastável, verificar se o GeoGebra
já resolve.

## 11. Fora do escopo

- Canvas de tinta na Mesa (regra do AGENTS.md; o caderno é o Xournal++).
- Voz, vídeo, psychoscript.
- Mudar defaults de `desk/config.cjs`.
- Um segundo app de chat.
