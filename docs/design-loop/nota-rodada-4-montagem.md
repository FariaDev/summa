# Nota da rodada 4 — montagem real (Xournal++ + chat solto)

Recorte: a montagem real da #157/#159 — Xournal++ **900×650** à esquerda e a
janela solta do chat lateral **420×650** à direita — nas capturas **17** e
**18** de `docs/design-loop/rodada-4/antes/xournal/`, em Debian X11, com a Mesa
principal minimizada e o interior GTK do Xournal++ fora do escopo. O texto das
mensagens é fixture e não entra na nota. Para contraste, alvos e foco do chat,
usei os JSON da janela solta em `docs/design-loop/rodada-4/antes/chat-solto/`
(claro 420×1000 e 380×800, escuro 420×1000); para a família, o chat solto da
rodada 4. **D1** (espera síncrona do Converter) é **decisão do autor**; D2/D3
(cadernos) não tocam esta montagem.

**Vi as imagens.** Abri os PNG **17-montagem-real** e
**18-montagem-real-convertendo** (1356×650) e recortes ampliados do cabeçalho,
das mensagens, do composer e da emenda entre as janelas. Da janela solta, abri
**3 PNG**: `solto-resposta-claro-420x1000.png`,
`solto-resposta-claro-380x800.png` e `solto-resposta-escuro-420x1000.png`. Li os
JSON 17/18, `solto-resposta-claro-420x1000.json`,
`solto-resposta-claro-380x800.json`, `solto-resposta-escuro-420x1000.json` e
`teclado-solto-resumo.json`, e o código citado (`composer.css`, `sidechat.mjs`).
Não abri os demais PNG da janela solta (menus, preso, vazio/carregando/erro):
eles têm avaliador próprio na parte chat solto e não contam como SEM CAPTURA
aqui.

## Resposta curta

- **As duas janelas funcionam como posto?** Sim. Xournal em x=5–904, chat em
  x=941–1360, **36 px** de desktop entre eles; os dois clientes medem **650 px**
  de altura, com topos e bases alinhados, e o JSON 17/18 traz `seguro: true` e
  `intrusas: []`. O recorte de 1356×650 deixa 5 px à esquerda e 6 px à direita.
- **O 18 é “durante a conversão”?** Só até a confirmação. O chat é **idêntico
  pixel a pixel** ao 17 (diff de **0 px** em x=936–1355, y=0–649). O 18
  acrescenta a seleção no Xournal e o diálogo **545×144** em x=182–726,
  y=282–426, a **209 px** do chat. A espera real (“Convertendo…”) continua fora
  da montagem; é D1, decisão do autor, e não achado desta nota.
- **O chat mudou da rodada 3 para a 4?** Não. A região do chat é **idêntica** à
  da rodada 3 (diff de **0 px**); o 17 novo difere do 17 antigo em **2 px** com
  delta máximo 1, e o 18 novo difere do antigo em **10.205 px**, todos na área
  do diálogo/seleção do Xournal. O conserto do achado da rodada 3 não veio
  nesta captura.
- **O composer segue a regra da casa?** Sim. Fio de **1 px** em cima, azul no
  foco (y=493), colado de ponta a ponta (420 px), recuo de 12 px, campo fixo de
  **86 px (3 linhas)**; o bloco do composer mede **157 px (24,2%)**, com escopo
  de 24 px e Enviar de 28 px.
- **Cabe e lê bem a 420 px?** Sim. Corpo **15 px/24 px**, coluna de **396 px**,
  36–42 caracteres por linha, sem overflow (`scrollWidth` 420). Os alvos vão de
  **24×24** (cadeado) a **396×86** (campo); o foco de teclado tem anel de
  **2 px** `#2548c7` (7,42:1 no claro; `#8fa8ff`, 7,23:1 no escuro). Todo texto
  passa AA (claro 4,95–18,88:1; escuro 5,74–17,58:1).
- **O que ainda incomoda?** O **achado 1**: na mesma largura de 420, o escopo
  com **dois materiais** mede **140,5×15,4** e corta o segundo nome
  (“Formu…”); a 380 mede **100,5×15,4** (“p. 1…”). Na montagem 17/18 a fixture
  tem **um** material: o texto visível mede **84 px** e cabe. O cadeado focável
  sem ação e o foco duplo (fio + anel) seguem como detalhes, não como achados.

## Notas

| Categoria | Posto lado a lado (17) | Durante a conversão (18) | Geral |
|---|---:|---:|---:|
| Typography | 9,0 | 9,0 (= posto) | 9,0 |
| Hierarchy | 9,0 | 9,0 (= posto) | 9,0 |
| Spacing & density | 9,0 | 9,0 (= posto) | 9,0 |
| Color & contrast | 9,0 | 9,0 (= posto) | 9,0 |
| Iconography | 9,0 | 9,0 (= posto) | 9,0 |
| Consistency & polish | 9,0 | 9,0 (= posto) | 9,0 |
| Clarity | 8,5 | 8,5 (= posto) | 8,5 |
| Estados | 9,0 | 9,0 (= posto) | 9,0 |
| Feedback e movimento | n/a | n/a | n/a |
| Acessibilidade | 9,0 | 9,0 (= posto) | 9,0 |
| Janela pequena | 8,5 | 8,5 (= posto) | 8,5 |
| **Overall / Geral** | **8,5** | **8,5** | **8,5** |

**Lastro das notas (para nenhuma nota ficar sem medida):**

- **Typography 9,0 (17/18):** corpo 15 px/24 px (1,6), título 12 px/600, selo
  do motor 11 px/600, papéis 11 px/600, ações 11 px, escopo 11 px/15,4 px,
  Enviar 12 px, placeholder 15 px/24 px. O piso é 11 px; os 41 textos do JSON
  420 não têm nada abaixo disso. A coluna de 396 px fica em 36–42 caracteres e
  a fixture da montagem não trunca texto de mensagem. A 380 o corpo e os papéis
  mantêm as medidas (`solto-resposta-claro-380x800.json`); o único corte da
  linha é o escopo, contado no achado 1. Não há achado de tipografia.
- **Hierarchy 9,0 (17/18):** pergunta → resposta → campo. A bolha do usuário
  mede **337 px (80,2% de 420)** em x=1007–1343, y=76–149, encostada à direita;
  o papel “Você” fica acima, alinhado à direita; a resposta é texto plano de
  15 px e as ações de 11 px ficam subordinadas; o composer de 157 px fecha a
  coluna. A linha de escopo de 11 px fica entre a conversa e o campo, sem
  competir com o corpo.
- **Spacing & density 9,0 (17/18):** cabeçalho **40 px** (y=0–39, fio #e0e0e0
  em y=39); recuo de 12 px; respiro de 6–10 px entre papel, bolha e ações;
  composer **157 px (24,2%)**,
  campo **86 px (3 linhas)**, escopo **24 px**, Enviar **28 px**. O vão de
  **198 px** entre a última ação (y=295) e o fio do composer (y=493) é conversa,
  não cromo. O diálogo do 18 (545×144) não encosta no chat (209 px de vão) e
  não muda o espaçamento do chat. As duas janelas têm 650 px de altura e 36 px
  de vão.
- **Color & contrast 9,0 (17/18):** neutros da Mesa e azul `#2548c7`. Claro:
  corpo 17,58:1, rótulos 4,95:1, ações/escopo 6,69:1, “Atualizar contexto”
  7,42:1, título 18,88:1; Enviar desligado 5,36:1 (texto 92 sobre fundo 230).
  Escuro (JSON 420): 5,74–17,58:1 (Enviar desligado 5,74:1; escopo/nota 7,39:1;
  refresh 7,71:1). Nenhum texto abaixo de AA; o fio da bolha (1,32:1) e o fio
  dos botões secundários são a forma da casa, não texto. O anel de foco é
  7,42:1 no claro e 7,23:1 no escuro.
- **Iconography 9,0 (17/18):** +, ⋯ e × em **28×28**; cadeado **24×24** com
  glifo de 12 px; “Atualizar contexto” **134,2×24** com glifo de 12 px;
  “Copiar” **67,7×25,6**; “Levar à sessão principal” **148,6×25,6**; Enviar
  **75,9×28** com seta. Mesmo traço e mesma família do cabeçalho da Mesa; nada
  desalinha no recorte.
- **Consistency & polish 9,0 (17/18):** mesmo componente do chat preso:
  cabeçalho 40 px, título 12/600, corpo 15/24, rótulos 11 px, recuo 12 px,
  mesma paleta e acento. O diálogo do 18 é GTK do Xournal++ (fora da nota de
  estilo). O foco duplo (fio azul do composer + anel de 2 px do campo) é
  detalhe de polimento, não divergência.
- **Clarity 8,5 (17/18):** pergunta, resposta e campo se entendem; “Só neste
  chat” explica o cadeado em repouso; “Atualizar contexto” nomeia a ação; o
  diálogo do 18 nomeia o congelamento de até 20 s, a camada nova e a tinta que
  fica. O que segura o 9 é o achado 1: com dois materiais o escopo corta o
  segundo nome a 420/380. Na montagem de um material, a linha cabe.
- **Estados 9,0 (17/18):** o estado observável no 17/18 é o **campo vazio**:
  Enviar desligado (`disabled: true`, 5,36:1) e campo focado; o 18 mostra a
  confirmação do Converter (545×144) e o chat no mesmo estado. Os
  outros estados do chat têm avaliador próprio na parte chat solto e não entram
  aqui (ver “SEM CAPTURA”).
- **Feedback e movimento n/a (17/18):** PNG estático: hover, transição,
  streaming e retorno do envio não aparecem. O foco visível (2 px) e o
  desligado do Enviar são medidos em Acessibilidade/Estados; o diálogo do 18 é
  estático e anterior à espera, que é D1.
- **Acessibilidade 9,0 (17/18):** 10 alvos ≥24 px (28×28 no cabeçalho; 24×24 no
  cadeado; 134,2×24 no atualizar; 67,7×25,6 nos dois Copiar; 148,6×25,6 no
  Levar; 75,9×28 no Enviar; 396×86 no campo); foco de 2 px no campo e em todos
  os controles da rota (`teclado-solto-resumo.json`); 14 nomes acessíveis no
  DOM, incluindo
  “Fora da sessão principal” no cadeado e “Enviar mensagem”; AA em todo texto.
  O cadeado é um `role="img"` com `tabindex="0"` (`sidechat.mjs:100`), um stop
  a mais na ordem de Tab, mas expõe o nome a quem não usa mouse — fica como
  troca, não como achado. Não há captura de leitor de tela em execução (ver
  “SEM CAPTURA”).
- **Janela pequena 8,5 (17/18):** 420×650 cabe sem overflow (`scrollWidth`
  420/420); campo 396×86, Enviar 75,9×28, escopo de um material com 84 px
  visíveis e a nota de 75,3 px. Mas o componente na mesma largura de 420 com
  dois materiais corta o escopo (140,5×15,4) e a 380 corta mais
  (100,5×15,4), sem quebrar a linha; é o achado 1, que também pesa em Clarity.
  O campo e o Enviar continuam cabendo nas duas larguras.
- **Overall 8,5:** o par funciona como posto, é da família e o diálogo do 18 não
  atrapalha o chat. O que impede o 9 é o achado 1, baixo e ainda aberto; o resto
  está polido. Não há achado grave ou médio.

## Achados

| # | Categoria | Severidade | Evidência (captura + valor) | Conserto em uma linha | Arquivo provável |
|---:|---|---|---|---|---|
| 1 | Clarity / Janela pequena | baixa | **17/18** usam um material: o escopo visível mede **84 px** (x=949–1032) e a linha cabe. Na mesma largura de 420, `solto-resposta-claro-420x1000.png` com dois materiais mostra “Limites.pdf p. 1, Formu…”: o `#sidechat-scope-text` mede **140,5×15,4** (x=12, y=852,3) e o texto completo fica só no `title`. A 380 (`solto-resposta-claro-380x800.png`) mede **100,5×15,4** e mostra “Limites.pdf p. 1…”. O texto completo (no `title`) não cabe nesse espaço; a legenda “Só neste chat” ocupa **75,3 px** e a linha fica em `white-space:nowrap` com `text-overflow:ellipsis` (`composer.css:76`). O segundo material some em repouso. | Esconder ou encurtar a legenda antes do escopo no container estreito (ou deixar o escopo quebrar em duas linhas); o `title` completo continua. | `desk/src/composer.css:76-98`; `desk/src/sidechat.mjs` (`paintScope`/`scopeLabels`) |

**Detalhes que não contam como achado.** O cadeado é um `span` com
`tabindex="0"` (`sidechat.mjs:100`) e entra na rota de teclado como parada 5
(`teclado-solto-05-sidechat-scope-lock-claro-380x800.json`), mas não tem ação; a
legenda visível carrega o sentido. O foco duplo (fio azul do composer em y=493 e
anel de 2 px do campo em y=521–522) é o padrão da casa, não divergência. O fio
da bolha do usuário mede 1,32:1, mas é contorno de mensagem, não texto nem
componente interativo.

## SEM CAPTURA

| Item | Por quê | Onde |
|---|---|---|
| A espera/progresso real do Converter na montagem | O **18** mostra o diálogo de confirmação (545×144) e o chat idêntico; o `04-converter-convertendo` é só o Xournal; a espera síncrona é **D1, decisão do autor** | 18; `04-converter-convertendo` |
| Moldura e título nativo das janelas | O recorte começa em y=56 (área do cliente); a moldura/título do sistema não está na imagem | 17/18 JSON |
| Leitor de tela em execução | Os nomes acessíveis foram lidos do DOM (14 labels); não há captura de árvore de acessibilidade nem de leitor falando | `solto-resposta-claro-420x1000.json` |
| Tema escuro da montagem | O chat escuro tem captura própria (`solto-resposta-escuro-420x1000`, 5,74–17,58:1), mas o par 17/18 escuro não existe | `chat-solto/` |
| Windows: “Converter ainda não funciona no Windows.” | Sem máquina Windows neste ciclo; a montagem é Debian X11 | `xournal/capturas.json` |
| Interior do Xournal++ (GTK) | Fora do escopo por definição | — |
| Enviar habilitado (campo com rascunho) e hover/transição/streaming | O 17/18 fixam o campo vazio; o PNG não captura movimento | 17/18 |
| Outros estados do chat (vazio, carregando, erro, cartões, menus, “sempre por cima”) | Têm avaliador próprio na parte chat solto; não contam como SEM CAPTURA nesta nota | `solto-*`, `preso-*` |

Não listei aqui os estados do chat que têm avaliador próprio na parte chat
solto: eles estão nas capturas `solto-*`/`preso-*` e não contam como SEM CAPTURA
nesta nota. O 17/18 fixa a resposta concluída, o campo vazio/focado e a
confirmação do Converter.

## Achados da rodada 3

| # | Achado (rodada 3) | Status | Prova na rodada 4 |
|---:|---|---|---|
| 1 | Escopo com dois materiais cortado a 420/380 | **ABERTO** | O chat 17/18 novo é idêntico ao da rodada 3 (diff de **0 px** na região x=936–1355); a fixture da montagem tem **um** material e o texto visível mede **84 px**, então a montagem não mostra o defeito. A prova nova é a janela solta: `solto-resposta-claro-420x1000.json` mede **140,5×15,4** (“Limites.pdf p. 1, Formu…”) e `solto-resposta-claro-380x800.json` mede **100,5×15,4** (“Limites.pdf p. 1…”), com o texto completo só no `title`; `composer.css:76` segue `nowrap`+`ellipsis`. |
| — | Cadeado focável sem ação (detalhe não numerado na rodada 3) | **ABERTO** | `teclado-solto-05-sidechat-scope-lock-claro-380x800.json`: parada 5, **24×24**, foco de 2 px; `sidechat.mjs:100` mantém `role="img"` e `tabindex="0"`. Continua como troca de acessibilidade, não como achado numerado. |
| — | Foco duplo fio do composer + anel do campo (detalhe não numerado) | **ABERTO (sem mudança)** | No 17/18, o fio azul do composer está em y=493 e o anel de 2 px do campo em y=521–522; a rodada 3 já o tratava como detalhe de polimento, e as capturas novas mostram o mesmo comportamento. |

## Nota independente

Não reusei as notas da rodada 3. Medi os dois PNG da montagem, o diff entre 17 e
18, o diff contra as capturas da rodada 3, os recortes ampliados e os JSON da
janela solta. O par continua sendo o mesmo posto (900×650 + 420×650, vão 36,
`seguro: true`, `intrusas: []`), mas a rodada 4 **não mudou o chat**: a região do
chat é pixel a pixel igual à da rodada 3 nas duas capturas (17 e 18), e o 17
novo difere do antigo em 2 px com delta 1. O que mudou no 18 está todo no
Xournal: o diálogo passou de 543×144 para **545×144** e a seleção mudou
(10.205 px de diff em x=3–726, y=282–595). Ou seja, o achado 1 da rodada 3 não
podia ter sido resolvido nesta captura; concordo com ele. O que impede o 9 é
esse achado baixo; o resto está polido, e o diálogo do 18 (GTK, fora do escopo)
não atrapalha o chat.
