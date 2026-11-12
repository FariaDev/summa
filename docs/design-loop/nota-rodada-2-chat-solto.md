# Nota da rodada 2 — chat solto (#157)

Avaliação do recorte "Chat solto" do ciclo 2: janela solta (380×800 e
420×1000), faixa "Chat em outra janela", soltar/trazer, "sempre por cima",
chat preso com resposta/cartões/envio incerto/janela pequena e os estados
vazio/carregando/erro. Base: as capturas de
`docs/design-loop/rodada-2/antes/chat-solto/` (PNG + JSON homônimo), o
inventário `docs/design-loop/inventario-chat-solto.md`, o CSS e o código em
`desk/src`. Não implementei nem corrigi nada.

**Nota sobre o inventário.** As observações 1–4 do inventário e as exceções de
"Medidas que valem para a nota" descrevem o estado da rodada 1, não o "antes"
da rodada 2: os JSON novos medem as ações de mensagem a **6,69:1** (não 3,92),
o foco do campo com **outline de 2 px** (não só o fio de 1 px), o escopo com
`title` (não sem) e o composer da filha com **~170 px / 3 linhas** (não 234 px
com uma linha). A observação 5 (erro do motor como resposta normal) continua
verdadeira e a captura nova mostra que piorou: são **duas** mensagens de erro.
A observação 1 (vão de ~490 px) também está desatualizada: as PNGs
`mesa-faixa-*` e o `readers.css:82` mostram o leitor fixado crescendo até a
faixa. Uso o JSON/PNG como prova; o inventário fica como pista.

Não contam como achado a referência da casa (tema inspirado no Claude Desktop,
cinzas neutros, composer colado de ponta a ponta com fio em cima e campo fixo
de 3 linhas, nada de canvas de tinta) nem as decisões do autor para o chat
solto: fechar a janela solta devolve o chat, "sempre por cima" começa
desligado, e é um chat lateral só, o mesmo, movido para a janela filha. Os
pontos de `docs/design-loop/decisoes.md` (D1 converter/Xournal++, D2 Cadernos,
D3 capas) são de outros recortes; nenhum afeta a nota do chat solto e ficam
como **decisão do autor**.

## 1. Notas

Sub-partes: **A1** janela solta 380×800; **A2** janela solta 420×1000; **B**
faixa "Chat em outra janela" (1440×900 e 900×650, claro/escuro, inglês);
**C** soltar/trazer (menus "Soltar em outra janela" e "Trazer de volta");
**D** "sempre por cima" (menu ligado + sinal do alfinete); **E** chat preso
com resposta/cartões/envio incerto/janela pequena; **F** vazio, carregando e
erro. A coluna "Geral" é a leitura do recorte; a última linha é o Overall de
cada sub-parte. "—" em A1/A2 na linha Estados significa que os estados
vazio/carregando/erro são avaliados na coluna F; A1/A2 avaliam a resposta e o
teclado.

| Categoria | A1 · solta 380 | A2 · solta 420 | B · faixa | C · soltar/trazer | D · por cima | E · preso/cartões | F · vazio/carregando/erro | Geral |
|---|---|---|---|---|---|---|---|---|
| Typography | 8,5 | 9,0 | 9,0 | 9,0 | 8,5 | 8,0 | 8,5 | 8,5 |
| Hierarchy | 8,5 | 9,0 | 9,0 | 9,0 | 8,5 | 8,5 | 8,0 | 8,5 |
| Spacing & density | 8,5 | 9,0 | 9,0 | 9,0 | 8,5 | 8,0 | 8,5 | 8,5 |
| Color & contrast | 8,5 | 8,5 | 9,0 | 8,5 | 8,5 | 8,0 | 8,0 | 8,5 |
| Iconography | 8,5 | 8,5 | 9,0 | 9,0 | 9,0 | 8,5 | 8,0 | 8,5 |
| Consistency & polish | 8,5 | 9,0 | 9,0 | 8,5 | 8,5 | 8,0 | 8,0 | 8,5 |
| Clarity | 8,5 | 9,0 | 9,0 | 9,0 | 8,0 | 7,5 | 7,5 | 8,0 |
| Estados (vazio/carregando/erro) | — | — | 9,0 | 9,0 | 9,0 | 8,5 | 7,5 | 8,0 |
| Feedback e movimento | 8,5 | 8,5 | 8,5 | 9,0 | 8,5 | 8,0 | 7,5 | 8,0 |
| Acessibilidade | 8,5 | 8,5 | 9,0 | 9,0 | 8,5 | 8,5 | 8,0 | 8,5 |
| Janela pequena | 8,5 | 9,0 | 9,0 | 9,0 | 9,0 | 8,0 | 8,5 | 8,5 |
| **Overall** | **8,0** | **8,5** | **9,0** | **8,5** | **8,5** | **8,0** | **7,5** | **8,0** |

**Overall do recorte: 8,0.** A base visual está polida e os achados graves da
rodada 1 caíram (vão, composer, ações a 3,92:1, foco do campo, menu sem
teclado, ícones trocados, aviso repetido, escopo sem `title`, cartão sem nome,
"Enviar" invisível e sinal de "sempre por cima"). O que segura o recorte em
8,0 é o estado de erro — duas mensagens para a mesma falha, ambas com cara de
resposta normal — e as opções do quiz ainda com cara de campo, além dos órfãos
do escopo, do inglês "I don't know" e do "Concluir" no escuro.

**Lastro das notas (para nenhuma nota ficar sem medida):**

- **Typography 8,5/9,0 (A1/A2/B/C/D) e 8,0 (E), 8,5 (F):** corpo 15 px/24 px
  (1,6), papéis 11 px/600, título 12 px/600, menu 12 px, escopo 11 px, vazio
  12 px, atividade 11 px. O piso da casa é 11 px e nenhum texto visível
  amostrado fica abaixo disso. A2/B/C chegam a 9,0 porque o texto cabe: o
  escopo de 195,5 px em 420 vai numa linha, o rótulo da faixa de 142 px (PT) /
  161,3 px (EN) cabe em 829/579 px e os itens de menu de 230 px cabem os três
  rótulos. A1 fica em 8,5 pelo órfão do escopo (achado 3); D fica em 8,5
  porque o alfinete de 11 px é pequeno ao lado do selo do motor (achado 7); E
  fica em 8,0 pelo "I don't know" em duas linhas (achado 4); F fica em 8,5
  porque os textos de erro/vazio/carregando passam e não estouram.
- **Hierarchy 8,5/9,0:** cabeçalho, papel do falante (11 px, 600), corpo (15 px)
  e composer se leem nesta ordem. A2 e C chegam a 9,0 porque no 420 o escopo e
  o cartão cabem sem quebrar a ordem, e no menu os três itens e o estado têm a
  mesma hierarquia. B chega a 9,0 porque o leitor fixado agora ocupa o espaço e
  a faixa de 33 px marca a fronteira com o tutor, sem vazio dominante. E fica
  em 8,5 porque o cartão do quiz tem a pergunta em 15 px/600, opções em 15 px e
  ações separadas; F fica em 8,0 porque as duas mensagens de erro têm o mesmo
  peso e nenhuma marca de falha (achado 1).
- **Spacing 8,5/9,0 (A1/A2/B/C/D), 8,0 (E), 8,5 (F):** composer da filha de
  ~170 px (fio em y≈630, campo de 356×86 = 3 linhas, Enviar em y=762), sem a
  área morta de 234 px; faixa de 33×829 px (1440) e 33×579 px (900); itens de
  menu 230×28, menu 240×96 (3 itens); opções do quiz 473,5×35,8 (1440) e
  188,5×35,8 (900). E fica em 8,0 porque em 900×650 o cartão e o inglês
  apertam (achados 3 e 4); A1 fica em 8,5 pelo escopo em duas linhas.
- **Color 8,5 (A1/A2/C/D), 9,0 (B), 8,0 (E/F):** B chega a 9,0 porque o único
  texto da faixa é o rótulo 12 px/600 a **18,88:1** no claro e **16,48:1** no
  escuro, com anel de foco de 2 px; não há outro texto para tropeçar. A1/A2
  ficam em 8,5 porque "Copiar"/"Levar" medem **6,69:1** no claro e **6,93:1**
  no escuro, o "Enviar" desligado **5,36:1** (claro) / **5,74:1** (escuro) e o
  placeholder **4,95:1** / **6,02:1** — tudo passa. C fica em 8,5 pelo
  "Desligada" a **4,52:1** no escuro (achado 9); E fica em 8,0 pelo "Concluir"
  no escuro a **4,61:1** (achado 5) e pelo `dim` a 4,95:1/5,64:1; F fica em
  8,0 porque o erro usa a cor de corpo (17,58:1/15,29:1) e não uma cor de
  aviso (achado 1), embora o aviso incerto esteja a 5,71:1/10,53:1.
- **Iconography 8,5/9,0:** ícones de 16 px dentro de alvos de 28×28, lock e
  refresh de 12 px dentro de 24×24, chevron de 16 px na faixa, alfinete no
  menu e no cabeçalho, `undo` no "Trazer de volta" e `external` no "Soltar".
  B/C/D chegam a 9,0 porque o conjunto está correto e consistente; E fica em
  8,5 porque a opção do quiz não tem marca de escolha (achado 2); F fica em
  8,0 porque o erro não tem ícone/marca de falha e o carregando não tem
  spinner.
- **Consistency 8,5/9,0:** claro e escuro têm as mesmas formas; o menu é o
  mesmo `.chat-pop` do tutor; o selo do motor some abaixo de 300 px. A2/B
  chegam a 9,0 porque não há divergência de estado; C/D ficam em 8,5 pelo
  "Desligada" fraco no escuro e pelo chip do alfinete com a mesma forma do
  selo do motor (achado 7); E/F ficam em 8,0 pelo quiz com cara de campo
  (achado 2) e pelo erro como resposta normal (achado 1).
- **Clarity 8,5/9,0:** "Atualizar contexto", "Levar à sessão principal" (com
  `title` explicando que insere sem enviar), cadeado "Fora da sessão
  principal", "Trazer de volta", "Soltar em outra janela" e "Sempre por cima"
  têm nome e dica. A2/B/C chegam a 9,0 porque o escopo cabe inteiro e o menu
  diz o estado; D fica em 8,0 pelo alfinete não clicável (achado 7); E fica em
  7,5 porque as opções "1. 3"/"2. 4" ainda leem como campos (achado 2); F fica
  em 7,5 pelo erro duplicado e pelas ações "Levar à sessão principal" numa
  falha (achado 1).
- **Estados 9,0 (B/C/D), 8,5 (E), 7,5 (F):** B é um estado bem comunicado (a
  faixa diz exatamente onde o chat está); C mostra "Soltar"/"Trazer de volta"
  e "Desligada"/"Ligada" na hora; D mostra o alfinete no cabeçalho e o
  `aria-checked`; E mostra o cartão respondido (verde + "✓ Correta." +
  "Concluir") e o incerto com um aviso só; F tem vazio e carregando legíveis,
  mas o erro são duas mensagens iguais em peso (achado 1) e o carregando só
  tem a linha de 11 px no pé (achado 6).
- **Feedback 8,5 (A1/A2/B/D), 9,0 (C), 8,0 (E), 7,5 (F):** os anéis de foco de
  2 px aparecem em todos os controles da filha (close, copiar, levar, cadeado,
  refresh, campo, enviar, novo, mais) e na faixa; o menu atualiza o estado sem
  fechar e o Esc devolve o foco; o toast "Mensagem lateral copiada." nasce do
  caminho real; o incerto responde ao Enter com o aviso. F fica em 7,5 porque o
  erro não oferece "Tentar de novo" e o carregando não tem indicador junto do
  cartão pendente; E fica em 8,0 porque o toast aparece longe do botão
  (achado 8).
- **Acessibilidade 8,5 (A1/A2/D/E), 9,0 (B/C), 8,0 (F):** alvos ≥24 px em tudo
  (cabeçalho 28×28, Copiar 51,7×25,6, Levar 148,6×25,6, cadeado 24×24,
  refresh 24×24/134,2×24, campo 356×86, Enviar 75,9×28, Parar 49,3×28, menu
  230×28, faixa 33×829/579); foco visível de 2 px na filha e na faixa; menu com
  ↑/↓/Home/End/Esc/Tab e `aria-checked`; nomes "Copiar sua pergunta"/"Copiar
  resposta"; cartões com `aria-labelledby` ("Você"/"OpenCode"); escopo com
  `title`; quiz com `radiogroup` e `role=radio`; `aria-live` na lista. F fica
  em 8,0 porque o erro é anunciado duas vezes e as ações de resposta aparecem
  numa falha (achado 1).
- **Janela pequena 8,5/9,0 (A1/A2/B/C/D), 8,0 (E), 8,5 (F):** em 380/420 não
  há rolagem horizontal (`scrollWidth` = 380/420); em 900×650 a faixa tem
  33×579, o menu de 240 px cabe, o selo do motor some e o refresh vira ícone de
  24×24. A2/B/C/D chegam a 9,0 porque o conteúdo cabe sem cortar; A1 fica em
  8,5 pelo órfão do escopo; E fica em 8,0 pelo escopo truncado (com `title`) e
  pelo "I don't know" em duas linhas; F fica em 8,5 porque os três estados
  cabem em 380.
- **Overall 8,0:** a base visual é boa (tipografia/hierarquia/espaçamento por
  volta de 8,5–9,0), mas quatro coisas que o usuário sente seguram o recorte:
  o erro duplicado/sem marca de falha (F), as opções do quiz com cara de
  campo (E), o órfão do escopo (A1) e o "Concluir" no limite no escuro (E).
  B chega a 9,0 porque o vão sumiu e a faixa está limpa; E/F ficam em 8,0/7,5
  porque são onde os defeitos visíveis moram.

## 2. Achados

### 1. Erro do motor duplicado e apresentado como resposta normal — Clarity / Estados · média

- **Tela:** `solto-erro-claro-380x800`, `solto-erro-escuro-380x800`.
- **Evidência medida:** a mesma falha gera **duas** mensagens `OpenCode`
  seguidas: "Erro do chat lateral: Sem conexão para alcançar o modelo. Confira
  sua internet e envie de novo — sua mensagem continua na conversa." (15 px,
  17,58:1 no claro / 15,29:1 no escuro) e "A resposta do chat lateral falhou."
  (15 px, 17,58:1 / 15,29:1), cada uma com "Copiar" (51,7×25,6) e "Levar à
  sessão principal" (148,6×25,6). Nenhuma tem cor/ícone de falha; as duas usam
  a forma de uma resposta do tutor. A primeira vem de `message_end` com
  `errorMessage`; a segunda de `finishTurn` com `isError`.
- **Sugestão:** uma notícia só por turno (deduplicar `message_end`/`agent_end`),
  pintada com `--warn-text`/ícone de falha, e sem "Levar à sessão principal"
  em aviso de sistema (no lugar, "Tentar de novo").
- **Arquivo provável:** `desk/src/sidechat.mjs:570` (`noteText`) e `:652` (`finishTurn`);
  `desk/src/sidechat-message-view.mjs:51-61` (cartão e ações).

### 2. Opções do quiz ainda leem como campos desabilitados — Clarity / Consistency · média

- **Tela:** `preso-cartao-claro-1440x900`, `preso-cartao-claro-900x650`,
  `en-preso-cartao-light-900x650`.
- **Evidência medida:** as opções medem **473,5×35,8 px** (188,5×35,8 em
  900×650) e usam fundo `--surface` + borda de 1 px `--border-strong`, sem
  marca de escolha (círculo/chevron) e sem uma linha "Escolha uma"; "Não sei"
  (77,6×38) e "Dispensar" (97×38) já parecem botões. O CSS ganhou hover
  (`tutor-chat.css:301-302`), mas a captura estática continua lendo "1. 3" e
  "2. 4" como inputs desabilitados.
- **Sugestão:** pôr uma marca de escolha à esquerda (ou um chip de índice), um
  realce visível em repouso e/ou a linha "Escolha uma" acima das opções.
- **Arquivo provável:** `desk/src/tutor-chat.css:301-304` e
  `desk/src/cards-view.mjs:132`.

### 3. Escopo quebra com órfão em 380 e no inglês — Typography / Spacing · baixa

- **Tela:** `solto-resposta-claro-380x800`, `solto-resposta-escuro-380x800`,
  `en-solto-incerto-light-380x800`, `en-preso-cartao-light-900x650`.
- **Evidência medida:** em 380 o texto do escopo mede **181,8×30,8 px** e a
  segunda linha fica só com "p. 1"; em inglês mede **195,5×30,8 px** e a
  segunda linha fica só com "1"; em 900×650 o texto de **165,5×15,4 px** corta
  com "Formulario…". O `title` agora guarda a linha completa (o achado 11 da
  rodada 1 está resolvido), mas a quebra visual ficou.
- **Sugestão:** `text-wrap: balance`/`pretty`, ou manter cada referência numa
  linha com `white-space: nowrap` e reticências (o `title` cobre o resto), ou
  dar a linha inteira ao escopo e descer cadeado/refresh.
- **Arquivo provável:** `desk/src/support-sidechat.css:92-97` (media
  `max-width:500px`) e `desk/src/composer.css:76`.

### 4. Inglês "I don't know" quebra e estica os botões do quiz — Typography / Janela pequena · baixa

- **Tela:** `en-preso-cartao-light-900x650`.
- **Evidência medida:** "I don't know" mede **102,5×62 px** e "Dismiss"
  **80×62 px**; o rótulo em duas linhas define a altura da linha de ações
  (62 px), contra **77,6×38 px** do "Não sei" em português.
- **Sugestão:** encurtar o rótulo em inglês ("Not sure"/"Skip") ou deixar a
  linha de ações quebrar/alinhar pelo topo.
- **Arquivo provável:** `desk/src/locales/en.json` (`nKnowButton`) e
  `desk/src/tutor-chat.css:313` (`.quiz-actions`).

### 5. "Concluir" no escuro a 4,61:1 — Color & contrast · baixa

- **Tela:** `preso-cartao-respondido-escuro-1440x900`,
  `preso-cartao-respondido-escuro-900x650`.
- **Evidência medida:** branco `rgb(255,255,255)` sobre `rgb(80,108,223)` =
  **4,61:1** no escuro; no claro é branco sobre `rgb(37,72,199)` = **7,42:1**.
  Passa no AA (4,5:1), mas com pouca margem e com uma diferença grande entre os
  temas para a mesma ação primária.
- **Sugestão:** escurecer o `--primary` no escuro ou usar `--fg` sobre o
  accent, mirando ≥5:1 para a ação primária.
- **Arquivo provável:** `desk/style.css:39` (`--accent-fill`/`--accent-fg`) e
  `desk/src/composer.css:242` (`.primary`).

### 6. Carregando sem indicador junto do cartão pendente — Estados / Feedback · baixa

- **Tela:** `solto-carregando-claro-380x800`, `solto-carregando-escuro-380x800`.
- **Evidência medida:** o papel "OpenCode" fica em y=167 com o corpo vazio; a
  única pista é a linha de atividade de **11 px** a 6,69:1 em y=614, **447 px**
  abaixo; "Parar" mede 49,3×28 e "Enviar" fica desligado a 5,36:1.
- **Sugestão:** um indicador de digitação (três pontos) sob o papel "OpenCode"
  ou na própria linha de atividade, para o "respondendo" ficar junto do cartão
  pendente.
- **Arquivo provável:** `desk/src/sidechat.mjs:669` (`ensureLive`) e `:781` (`paintBusy`);
  `desk/src/support-sidechat.css:60`.

### 7. Alfinete de "sempre por cima" parece botão e não é — Consistency / Clarity · baixa

- **Tela:** `solto-por-cima-sinal-claro-380x800`,
  `solto-por-cima-sinal-escuro-380x800`.
- **Evidência medida:** o `#sidechat-pin` é um `span` `role="img"` com a mesma
  classe `.sidechat-engine` do selo "OpenCode" (borda de 1 px, 11 px,
  `--faint` a 4,95:1 no claro / 6,02:1 no escuro); tem `title`/`aria-label`
  "Sempre por cima ligado", mas não é clicável. Ao lado do selo do motor, a
  forma idêntica sugere um botão.
- **Sugestão:** deixar o alfinete como ícone sem chip (ou torná-lo um botão que
  desliga o estado), sem reutilizar a forma do selo do motor para status.
- **Arquivo provável:** `desk/src/sidechat.mjs:85` e
  `desk/src/support-sidechat.css:33`.

### 8. Toast de "copiado" longe do botão que o disparou — Feedback · baixa

- **Tela:** `preso-copiado-claro-1440x900`, `preso-copiado-escuro-1440x900`.
- **Evidência medida:** o "Copiar" clicado fica em x≈985–1037, y≈176–201; o
  toast "Mensagem lateral copiada." aparece em x≈1223–1428, y≈632–664 — ~450 px
  abaixo e ~200 px à direita, sobre a coluna do tutor. O toast está fora do
  escopo `#sidechat` do JSON, então o contraste não está medido; na PNG é
  branco sobre fundo escuro.
- **Sugestão:** ancorar o toast no pé da coluna do lateral ou usar um
  "Copiado" inline no próprio botão, para o retorno ficar junto da ação. Se o
  toast global for decisão de casa, manter e ignorar este achado.
- **Arquivo provável:** `desk/src/state.mjs` (`toast`) e
  `desk/src/sidechat-message-view.mjs` (`copySidechatMessage`).

### 9. "Desligada" no menu escuro a 4,52:1 — Color & contrast · baixa

- **Tela:** `solto-menu-trazer-escuro-380x800` e as variantes escuras dos menus.
- **Evidência medida:** o estado é um `::after` e não entra no array `texts`;
  no CSS, `--faint` `#979797` sobre o fundo do menu `#303030` = **4,52:1** no
  escuro (no claro, `#707070` sobre `#fff` = **4,95:1**). Passa no AA, mas é o
  texto mais fraco do menu.
- **Sugestão:** subir o estado para `--muted` no escuro (ou usar `--fg` no
  "Ligada"/"Desligada"), mantendo o mesmo peso dos outros itens.
- **Arquivo provável:** `desk/src/tutor-chat.css:64-67` (pseudo-elemento do
  `data-state`) e `desk/style.css:21` (`--faint`).

## 3. SEM CAPTURA

Estados do inventário sem PNG (a nota da categoria naquele estado não é dada):

- **Estado `unavailable`** (ponte `window.desk.sidechat*` ausente, texto em
  `renderUnavailable`): **SEM CAPTURA**. O inventário explica que exigiria um
  host sem a ponte do lateral; fica fora do recorte e não entra na nota.
- **Hover de "Levar à sessão principal"**: **SEM CAPTURA**. O hover do
  "Copiar" aparece em `preso-copiado-claro/escuro-1440x900` (17,58:1 no claro,
  14,33:1 no escuro) e o repouso está nos JSON (6,69:1 / 6,93:1); o hover do
  "Levar" não foi congelado. A nota de Feedback usa o repouso e o
  `:focus-within`.

Limitações de medição (não são ausência de estado do inventário):

- **Movimento/transição** de soltar, trazer de volta, abrir o menu e o toast:
  as capturas são estados parados; a nota de Feedback e movimento usa o que
  está congelado (foco, estado do menu, toast), não a animação.
- **Hover das opções do quiz e dos itens do menu**: não capturado; a nota usa
  o repouso e o CSS (`tutor-chat.css:302`, `tutor-chat.css:54`).
- **Foco por teclado no menu em inglês**: não capturado; o caminho de teclado
  está provado em português (`teclado-solto-menu-item-claro/escuro`), e o
  layout em inglês está em `en-solto-menu-*`.
- **Contraste do toast**: o toast fica fora do `#sidechat` do JSON; na PNG é
  branco sobre escuro, mas não há razão WCAG medida no arquivo.
- **Contraste do "Desligada"**: é pseudo-elemento `::after` e não está no
  array `texts`; o valor 4,52:1 do escuro vem do CSS (`--faint` sobre
  `#303030`), não do JSON.

Cobertura nova (o que a rodada 1 declarou SEM CAPTURA e agora tem PNG): vazio
(`solto-vazio-*`), carregando (`solto-carregando-*`), erro do motor
(`solto-erro-*`), cartão respondido (`preso-cartao-respondido-*`), foco por Tab
nos itens do menu (`teclado-solto-menu-item-*`), sinal de "sempre por cima"
(`solto-por-cima-sinal-*`), toast de copiado (`preso-copiado-*`) e trazido de
volta limpo em inglês a 900×650 (`en-mesa-trazido-de-volta-light-900x650`).

## 4. Imagens

**Vi as imagens.** Abri **26 dos 61 PNGs** com a ferramenta de leitura:
`solto-resposta-claro-380x800`, `solto-resposta-claro-420x1000`,
`solto-resposta-escuro-380x800`, `solto-vazio-claro-380x800`,
`solto-carregando-claro-380x800`, `solto-erro-claro-380x800`,
`solto-erro-escuro-380x800`, `mesa-faixa-claro-1440x900`,
`mesa-faixa-claro-900x650`, `mesa-faixa-escuro-1440x900`,
`solto-menu-trazer-claro-380x800`, `solto-menu-por-cima-claro-380x800`,
`solto-por-cima-sinal-claro-380x800`, `mesa-menu-soltar-claro-1440x900`,
`preso-cartao-claro-1440x900`, `preso-cartao-claro-900x650`,
`preso-cartao-respondido-claro-900x650`,
`preso-cartao-respondido-escuro-1440x900`, `preso-incerto-claro-900x650`,
`preso-copiado-claro-1440x900`, `teclado-solto-menu-item-claro-380x800`,
`en-solto-menu-trazer-light-380x800`,
`en-solto-menu-por-cima-light-380x800`,
`en-preso-cartao-light-900x650`, `en-solto-incerto-light-380x800` e
`mesa-trazido-de-volta-claro-1440x900`. Nos **35 PNGs restantes** avaliei
pelos JSON homônimos e pelo CSS/código; não inventei o que não vi. De todos os
61 JSON de medidas li os campos de texto, contraste, alvos, foco, rótulos e
tamanho de janela.

## 5. Achados da rodada 1

Todos os 15 achados de `docs/design-loop/nota-rodada-1-chat-solto.md` foram
reconferidos contra as capturas novas:

| # | Achado da rodada 1 | Status | Prova na rodada 2 |
|---|---|---|---|
| 1 | Menu "Mais opções" sem caminho de teclado | **RESOLVIDO** | `teclado-solto-menu-item-claro-380x800` e `-escuro`: foco em "Sempre por cima" com `outline: 2px solid` (2 px), `aria-checked=false`; `sidechat.mjs:185` (`onMorePopKeydown`) ganhou ↑/↓/Home/End/Esc/Tab. |
| 2 | Vão de ~490 px com o chat solto | **RESOLVIDO** | `mesa-faixa-claro-1440x900` e `mesa-faixa-claro-900x650`: o leitor fixado vai até x≈1017/476 e a faixa de 33 px encosta no tutor em x≈1050/509; `readers.css:82` (`:has(>#support-slot.collapsed)`). A observação 1 do inventário está desatualizada. |
| 3 | Composer da janela solta com 234 px de área morta | **RESOLVIDO** | `solto-resposta-claro-380x800` / `-420x1000`: composer de ~170 px, campo de 356×86 (3 linhas), Enviar em y=762; `composer.css:151-158` (`body>#sidechat` com `min-height:0` e `field-sizing:fixed`). |
| 4 | Ações de mensagem a 3,92:1 no claro | **RESOLVIDO** | `solto-resposta-claro-380x800.json`: "Copiar" **6,69:1** (claro) / **6,93:1** (escuro); `support-sidechat.css:55-56` usa `--muted` em opacidade cheia. |
| 5 | Foco do campo só com o fio de 1 px na filha | **RESOLVIDO** | `teclado-solto-07-sidechat-prompt-claro-380x800.json`: `outline: 2px solid rgb(37,72,199)`; `composer.css:163` (`body>#sidechat #sidechat-prompt:focus-visible`). |
| 6 | Opções do quiz parecem campos desabilitados | **PARCIAL** | `preso-cartao-claro-1440x900` / `-900x650`: opções 473,5×35,8 / 188,5×35,8 ainda com borda de campo e sem marca de escolha; `tutor-chat.css:301-302` ganhou `--border-strong` e hover, mas não a marca nem a linha "Escolha uma". |
| 7 | Dois botões "Copiar" com o mesmo nome acessível | **RESOLVIDO** | `teclado-solto-02-copiar-sua-pergunta` / `-03-copiar-resposta`: nomes "Copiar sua pergunta" e "Copiar resposta"; `sidechat-message-view.mjs` (`copyNameFor`). |
| 8 | Aviso de entrega incerta repetido em dois lugares | **RESOLVIDO** | `preso-incerto-claro-1440x900.json`: só o `.sidechat-warn` (11 px, 5,71:1); a linha de atividade está vazia no incerto; `sidechat.mjs:771` (`paintHeader`). |
| 9 | Ícone de "Sempre por cima" é o de maximizar | **RESOLVIDO** | `solto-menu-por-cima-claro-380x800` mostra o alfinete; `sidechat-detach.mjs:83` usa `icon('pin')`. |
| 10 | "Trazer de volta" mantém o ícone de "Soltar" | **RESOLVIDO** | `solto-menu-trazer-claro-380x800` mostra a seta de retorno (`undo`); `sidechat-detach.mjs:72` (`detached?'undo':'external'`). |
| 11 | Escopo truncado sem `title` na coluna estreita | **RESOLVIDO** | `preso-cartao-claro-900x650` e `en-preso-cartao-light-900x650`: o `#sidechat-scope-text` tem `title` com "Limites.pdf p. 1, Formulario.pdf p. 1"; `sidechat.mjs:752` (`paintScope`). O truncamento visual/órfão continua como achado 3 desta rodada. |
| 12 | Cartão de mensagem é `role="group"` sem nome | **RESOLVIDO** | `solto-resposta-claro-380x800.json`: `article role=group` com nome "Você"/"OpenCode"; `sidechat-message-view.mjs:51` (`aria-labelledby`). |
| 13 | "Enviar" desligado quase invisível | **RESOLVIDO** | `preso-incerto-claro-1440x900.json`: "Enviar" **5,36:1** no claro / **5,74:1** no escuro; `composer.css:238` (`opacity:1`, `--muted`). |
| 14 | Enter no campo com envio incerto não dá retorno | **RESOLVIDO (código; sem captura do toast)** | `sidechat.mjs:483` faz `toast(uiMessage('sidechat.warn'))` no incerto; a captura `preso-incerto-*` mostra o aviso único e o Enviar desligado, mas o toast do Enter não foi congelado. |
| 15 | "Sempre por cima" ligado não deixa sinal fora do menu | **RESOLVIDO** | `solto-por-cima-sinal-claro/escuro-380x800`: alfinete no cabeçalho; JSON `#sidechat-pin` `role=img` com `aria-label` "Sempre por cima ligado"; `sidechat-detach.mjs:101-107`. |

**Resumo:** 14 resolvidos, 1 parcial (achado 6). O achado 6 é o que mais pesa
na nota de E (Clarity/Consistency); os achados 1 e 6 desta rodada (erro
duplicado e carregando sem indicador) são os que seguram F.
