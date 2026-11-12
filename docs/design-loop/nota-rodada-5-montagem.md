# Nota da rodada 5 — montagem real (Xournal++ + chat solto)

Recorte: a montagem da #157/#159 — Xournal++ **900×650** à esquerda e a janela
solta do chat lateral **420×650** à direita — nas capturas **17** e **18** de
`docs/design-loop/rodada-5/antes/xournal/`, em Debian X11 (tela 1366×768,
Xournal++ 1.3.8, recorte de 1356×650 em `x=5,y=56`). O interior GTK do Xournal++
fica fora; o texto das mensagens é fixture. Para contraste, alvos e foco do chat
usei os JSON da janela solta em `docs/design-loop/rodada-5/antes/chat-solto/`
(claro 420×1000 e 380×800, escuro 420×1000) e, para conferir a correção do
escopo, os PNG claro 420 e 380 e o escuro 420. **D1** (espera síncrona do
Converter) é decisão do autor; D2/D3 não tocam esta montagem; D4 (Tentar de novo
do erro) não aparece no 17/18.

**Vi as imagens.** Abri os PNG **17-montagem-real** e
**18-montagem-real-convertendo** (1356×650), recortes ampliados do cabeçalho,
das mensagens, do escopo/composer e da base esquerda, e os três PNG da janela
solta citados (claro 420, claro 380, escuro 420). Medi os PNG por decodificação
de pixels; não abri visualmente os outros 17 PNG do inventário (eles são a outra
parte desta rodada).

## Resposta curta

- **As duas janelas funcionam como posto?** Sim. Xournal em x=0–899 e chat em
  x=936–1355 no recorte, **36 px** de desktop entre eles (x=900–935, `#d9d9d9`);
  os dois clientes medem **650 px** de altura, com topos e bases alinhados. O 17
  e o 18 trazem `seguro: true` e `intrusas: []`; o recorte encosta nas duas
  janelas (0 px de sobra à esquerda e à direita).
- **O 18 é “durante a conversão”?** Só até a confirmação. O chat é **idêntico
  pixel a pixel** ao 17 (diff de **0 px** em x=936–1355, y=0–649). O 18
  acrescenta a seleção no Xournal e o diálogo **545×144** em `x=187,y=338`
  (recorte x=182–726, y=282–425), a **209 px** do chat. A espera real
  (“Convertendo…”) continua fora da montagem; é D1 e não é achado desta nota.
- **O que mudou da rodada 4 para a 5?** Praticamente só o escopo do chat: o
  diff do 17 novo contra o 17 da rodada 4 é de **2.908 px**, sendo **2.892 px**
  na região do chat (x=0–419) e todos em **y=478–517** — a linha do escopo e o
  fio do composer. Os outros **16 px** ficam na base do Xournal (x=3–812,
  y=595–646), fora do diálogo e da seleção. O resto do chat (mensagens, ações,
  campo) é idêntico; o 18 também difere do 18 antigo nos mesmos 2.908 px, com
  diálogo e seleção do Xournal inalterados.
- **O escopo resolveu o corte da rodada 4?** Sim. No JSON 420 da rodada 5 o
  `#sidechat-scope-text` mede **392×15,4** com o texto completo (“Limites.pdf
  p. 1, Formulario.pdf p. 1”); a 380 mede **352×15,4**; o texto renderizado tem
  **195 px** (x=13–207) nas duas larguras, dentro da linha. A query nova
  (`@container sidechat-composer (max-width:480px)`) põe o texto em linha
  própria. O que ficou é o custo dessa quebra — achado 1.
- **O composer segue a regra da casa?** Sim. Fio de **1 px** em cima, azul no
  foco (y=478), colado de ponta a ponta (420 px), recuo de 12 px, campo fixo de
  **86 px (3 linhas)**; o bloco do composer mede **172 px (26,5%)** dos 650, com
  escopo de 43 px e Enviar de 28 px.
- **Cabe e lê bem a 420/380?** Sim. Corpo **15 px/24 px**, coluna de **396 px**
  (420) e **356 px** (380), sem overflow (`scrollWidth` 420/420 e 380/380). Os
  alvos vão de **24×24** (cadeado) a **396×86** (campo); o foco de teclado tem
  anel de **2 px** `#2548c7` (7,42:1 no claro; `#8fa8ff`, 7,23:1 no escuro).
  Todo texto passa AA (claro 4,95–18,88:1; escuro 5,74–17,58:1).

## Notas

| Categoria | Posto lado a lado (17) | Durante a conversão (18) | Geral |
|---|---:|---:|---:|
| Typography | 9,0 | 9,0 (= posto) | 9,0 |
| Hierarchy | 9,0 | 9,0 (= posto) | 9,0 |
| Spacing & density | 8,5 | 8,5 (= posto) | 8,5 |
| Color & contrast | 9,0 | 9,0 (= posto) | 9,0 |
| Iconography | 9,0 | 9,0 (= posto) | 9,0 |
| Consistency & polish | 9,0 | 9,0 (= posto) | 9,0 |
| Clarity | 9,0 | 9,0 (= posto) | 9,0 |
| Estados | 9,0 | 9,0 (= posto) | 9,0 |
| Feedback e movimento | n/a | n/a | n/a |
| Acessibilidade | 9,0 | 9,0 (= posto) | 9,0 |
| Janela pequena | 9,0 | 9,0 (= posto) | 9,0 |
| **Overall / Geral** | **8,5** | **8,5** | **8,5** |

**Lastro das notas (para nenhuma nota ficar sem medida):**

- **Typography 9,0 (17/18):** corpo 15 px/24 px (1,6), título 12 px/600, selo
  do motor 11 px/600, papéis 11 px/600, ações 11 px, escopo 11 px/15,4 px,
  Enviar 12 px, placeholder 15 px/24 px. O piso é 11 px (`--fs-xs` em
  `desk/style.css:123`); os 41 textos do JSON 420 não têm nada abaixo disso. A
  coluna de 396 px mantém a resposta da fixture em duas linhas, sem truncar
  texto de mensagem. A 380 o corpo e os papéis mantêm as medidas
  (`solto-resposta-claro-380x800.json`). O escopo de dois materiais mede
  195 px e cabe inteiro em 392/352; o de um material mede 84 px. Não há achado
  de tipografia.
- **Hierarchy 9,0 (17/18):** pergunta → resposta → campo. A bolha do usuário
  mede **337 px (80,2% de 420)** em x=1007–1343, y=76–149, encostada à direita;
  o papel “Você” fica acima, alinhado à direita; a resposta é texto plano de
  15 px e as ações de 11 px ficam subordinadas; o composer de 172 px fecha a
  coluna. A linha de escopo de 11 px fica entre a conversa e o campo, sem
  competir com o corpo.
- **Spacing & density 8,5 (17/18):** cabeçalho **40 px** (y=0–39, fio #e0e0e0
  em y=39); recuo de 12 px; respiro de 6–10 px entre papel, bolha e ações;
  composer **172 px (26,5%)**, campo **86 px (3 linhas)**, escopo **43 px**,
  Enviar **28 px**; vão de **183 px** entre a última ação (y=295) e o fio do
  composer (y=478), que é conversa, não cromo. As duas janelas têm 650 px de
  altura e 36 px de vão. O que tira o 9 é o **achado 1**: a quebra do escopo é
  forçada mesmo quando o texto cabe numa linha, o que cresce o composer de
  **157 px (24,2%)** para **172 px (26,5%)** e deixa a segunda linha com
  **146,5 px** vazios à direita da ação. O resto do espaçamento é regular.
- **Color & contrast 9,0 (17/18):** neutros da Mesa e azul `#2548c7`. Claro:
  corpo 17,58:1, título 18,88:1, rótulos 4,95:1, ações/escopo 6,69:1,
  “Atualizar contexto” 7,42:1, Enviar desligado 5,36:1, placeholder 4,95:1.
  Escuro (JSON 420): 5,74–17,58:1 (papéis 6,72:1; Copiar 6,93:1; escopo/nota
  7,39:1; refresh 7,71:1; Enviar desligado 5,74:1; placeholder 6,72:1). Nenhum
  texto abaixo de AA; o fio da bolha (1,32:1) e o fio dos botões secundários
  são a forma da casa, não texto nem componente interativo. O anel de foco é
  7,42:1 no claro e 7,23:1 no escuro.
- **Iconography 9,0 (17/18):** +, ⋯ e × em **28×28**; cadeado **24×24** com
  glifo de 12 px; “Atualizar contexto” **134,2×24** com glifo de 12 px;
  “Copiar” **67,7×25,6** com glifo de 12 px; “Levar à sessão principal”
  **148,6×25,6** (só texto); Enviar **75,9×28** com seta. Mesmo traço e mesma
  família do cabeçalho da Mesa; nada desalinha no recorte. “Levar” sem ícone
  fica como detalhe, não achado.
- **Consistency & polish 9,0 (17/18):** mesmo componente do chat preso:
  cabeçalho 40 px, título 12/600, corpo 15/24, rótulos 11 px, recuo 12 px,
  mesma paleta e acento. O cabeçalho do chat da montagem é idêntico ao da
  janela solta 420 (linhas y=0–75 com diff de **0 px**); as mensagens diferem só
  pela fixture. O diálogo do 18 é GTK do Xournal++ (fora da nota de estilo). O
  foco duplo (fio azul do composer + anel de 2 px do campo) é detalhe de
  polimento, não divergência.
- **Clarity 9,0 (17/18):** pergunta, resposta e campo se entendem; “Só neste
  chat” explica o cadeado em repouso; “Atualizar contexto” nomeia a ação; o
  escopo completo aparece em 420/380 (195 px de texto); o diálogo do 18 nomeia
  o congelamento de até 20 s, a camada nova e a tinta que fica. Não há mais
  corte que esconda o segundo material.
- **Estados 9,0 (17/18):** o estado observável no 17/18 é o **campo vazio**:
  Enviar desligado (`disabled: true`, 5,36:1) e campo focado; o 18 mostra a
  confirmação do Converter (545×144) e o chat no mesmo estado. Os outros
  estados do chat têm avaliador próprio na parte chat solto e não entram aqui
  (ver “SEM CAPTURA”). A espera síncrona real é D1.
- **Feedback e movimento n/a (17/18):** PNG estático: hover, transição,
  streaming e retorno do envio não aparecem. O foco visível (2 px) e o
  desligado do Enviar são medidos em Acessibilidade/Estados; o diálogo do 18 é
  estático e anterior à espera, que é D1.
- **Acessibilidade 9,0 (17/18):** 10 alvos ≥24 px (28×28 no cabeçalho; 24×24 no
  cadeado; 134,2×24 no atualizar; 67,7×25,6 nos dois Copiar; 148,6×25,6 no
  Levar; 75,9×28 no Enviar; 396×86 no campo em 420, 356×86 em 380); foco de
  2 px em todos os controles da rota (`teclado-solto-resumo.json`, 9 paradas
  úteis; o Enviar desligado fica fora); 14 nomes acessíveis no DOM, incluindo
  “Fora da sessão principal” no cadeado e “Enviar mensagem”; AA em todo texto.
  O cadeado é um `role="img"` com `tabindex="0"` (`sidechat.mjs:100`), um stop
  a mais na ordem de Tab, mas expõe o nome a quem não usa mouse — fica como
  troca, não como achado. Não há captura de leitor de tela em execução.
- **Janela pequena 9,0 (17/18):** 420×650 cabe sem overflow (`scrollWidth`
  420/420); campo 396×86, Enviar 75,9×28; a 380 (`solto-resposta-claro-380x800`)
  o campo fica 356×86 e o `scrollWidth` é 380/380. O escopo de dois materiais
  ocupa 195 px em 392/352 e não corta mais; o de um material, 84 px. O cabeçalho
  e a linha de ações continuam cabendo nas duas larguras. O achado 1 é de
  densidade, não de falta de espaço.
- **Overall 8,5:** o par funciona como posto, é da família e o diálogo do 18 não
  atrapalha o chat. O corte da rodada 4 está resolvido, mas o conserto deixou o
  **achado 1** (quebra forçada + ação fora do canto), baixo e visível; por isso
  não sobe a 9. Não há achado grave ou médio.

## Achados

| # | Categoria | Severidade | Evidência (captura + valor) | Conserto em uma linha | Arquivo provável |
|---:|---|---|---|---|---|
| 1 | Spacing & density (e polimento) | baixa | **17/18**: o escopo de **um** material (“Limites.pdf p. 1”) mede **84 px** (x=949–1032) e ocupa sozinho uma linha de **392 px**; a linha de baixo (cadeado + “Só neste chat” + “Atualizar contexto”) termina em **x=1.193,5** (botão de 134,2 px), **146,5 px antes** da borda direita do escopo (x=1.340), e o texto visível acaba em x=1.183. No JSON 420, o botão “Atualizar contexto” vai de **123,3 a 257,5** contra a borda direita **404** (146,5 px, 36% da linha); na rodada 4 ele ia de **269,8 a 404** (encostado à direita). A linha inteira com **um** material mede ~**335 px** (84 + 24 do cadeado + 75,3 da legenda + 134,2 da ação + 18 de vãos) e caberia em 392/352; com **dois** materiais ela vai a ~**446,5 px** e só então precisa quebrar — mas a query `max-width:480px` força a quebra em todos os casos. O composer cresce de **157 px (24,2%)** para **172 px (26,5%)** dos 650 e o campo não se move (anel em y=521–522 nos dois). | Só quebrar quando a linha completa não couber (texto com `flex:0 0 auto;max-width:100%`, ou um wrapper para cadeado+legenda+ação) e, na linha quebrada, empurrar a ação com `margin-left:auto`; o texto de dois materiais continua inteiro. | `desk/src/composer.css:77` e `:101-104`; se precisar de wrapper, `desk/src/sidechat.mjs:98-101` |

### Detalhes que não contam como achado

| Detalhe | Evidência | Conserto (opcional) | Arquivo |
|---|---|---|---|
| Foco duplo (fio do composer + anel do campo) | No 17/18 o fio azul do composer mede 1 px em **y=478** (420 px) e o anel do campo mede 2 px em **y=521–522** e **y=611–612**; os dois são `#2548c7` (7,42:1). É o padrão da casa (composer aceso + campo focado), já tratado como detalhe na rodada 4. | Unificar num só sinal, se o autor quiser; hoje não atrapalha. | `desk/src/composer.css:19-20,184` |
| Cadeado focável sem ação | `teclado-solto-resumo.json`: parada 5, `sidechat-scope-lock`, **24×24**, foco de 2 px; `role="img"` com `tabindex="0"`. O nome “Fora da sessão principal” explica o estado, mas é um Tab sem ação. | Remover o `tabindex` e deixar a legenda visível carregar o sentido, ou manter como está. | `desk/src/sidechat.mjs:100` |
| “Levar à sessão principal” sem ícone | “Copiar” tem glifo de 12 px + texto; “Levar” é só texto (148,6×25,6). Os dois têm a mesma altura e o mesmo contorno. | Adicionar o ícone de “levar” ou aceitar a diferença (o rótulo já é longo). | `desk/src/sidechat-message-view.mjs:70-80` |
| Escopo com 3+ materiais ou nome longo | `#sidechat-scope-text` segue `white-space:nowrap`+`text-overflow:ellipsis` (`composer.css:77`); o `title` guarda a linha completa (`sidechat.mjs:783`). O caso de dois materiais — o da rodada 4 — cabe inteiro. | Nenhum para o caso capturado; se aparecer nome maior, o `title` continua. | `desk/src/composer.css:77`; `desk/src/sidechat.mjs:780-783` |

## SEM CAPTURA

| Item | Por quê | Onde |
|---|---|---|
| A espera/progresso real do Converter na montagem | O **18** mostra o diálogo de confirmação (545×144) e o chat idêntico; o `04-converter-convertendo` é só o Xournal congelado; a espera síncrona é **D1, decisão do autor** | 18; `04-converter-convertendo` |
| Moldura e título nativo das janelas | O recorte começa em y=56 (área do cliente); a moldura/título do sistema não está na imagem | 17/18 JSON |
| Leitor de tela em execução | Os nomes acessíveis foram lidos do DOM (14 labels); não há captura de árvore de acessibilidade nem de leitor falando | `solto-resposta-claro-420x1000.json`; `teclado-solto-resumo.json` |
| Tema escuro da montagem | O chat escuro tem captura própria (`solto-resposta-escuro-420x1000`, 5,74–17,58:1), mas o par 17/18 escuro não existe | `chat-solto/` |
| Windows: “Converter ainda não funciona no Windows.” | Sem máquina Windows neste ciclo; a montagem é Debian X11 | `xournal/capturas.json` |
| Interior do Xournal++ (GTK) | Fora do escopo por definição | — |
| Enviar habilitado (campo com rascunho) e hover/transição/streaming | O 17/18 fixam o campo vazio; o PNG não captura movimento | 17/18 |
| Outros estados do chat (vazio, carregando, erro, cartões, menus, “sempre por cima”) | Têm avaliador próprio na parte chat solto; não contam como SEM CAPTURA nesta nota | `solto-*`, `preso-*` |

Os 19 estados do inventário têm captura; os estados 01–16 e 12b são a outra
parte desta rodada, e os ramos que o inventário registra como não capturados
(Windows, motivos da ponte além de quota/timeout, falhas de preparo, resposta
vazia, seleção sem traço, falha ao criar textos com a fonte nova, segunda página
do diálogo de fonte, Gerenciador de Plugins, Cancelar) não são da montagem.

## Achados da rodada 4

| # | Achado (rodada 4) | Status | Prova na rodada 5 |
|---:|---|---|---|
| 1 | Escopo com dois materiais cortado a 420/380 | **RESOLVIDO** | O JSON 420 da rodada 5 mede `#sidechat-scope-text` **392×15,4** (x=12, y=832,6) com o texto completo; o 380 mede **352×15,4**; o texto renderizado tem **195 px** (x=13–207) nas duas larguras, então não há reticências. A query nova (`composer.css:101-104`) põe o texto em linha própria; o PNG claro 420 mostra “Limites.pdf p. 1, Formulario.pdf p. 1” inteiro e o 380 também. Na montagem, o 17 mostra “Limites.pdf p. 1” em linha própria (84 px); o diff da região do chat contra a rodada 4 é de 2.892 px, todos em y=478–517, que é a prova de que o conserto entrou na captura. Ressalva: o `nowrap`+`ellipsis` continua para nomes maiores/3+ materiais, com o `title` completo. |
| — | Cadeado focável sem ação (detalhe da rodada 4) | **ABERTO** | `teclado-solto-resumo.json`: parada 5, **24×24**, foco de 2 px; `sidechat.mjs:100` mantém `role="img"` e `tabindex="0"`. |
| — | Foco duplo fio do composer + anel do campo (detalhe da rodada 4) | **ABERTO (sem mudança)** | No 17/18 o fio azul do composer está em **y=478** (1 px) e o anel de 2 px do campo em **y=521–522** e **611–612**; o JSON de foco do 420 confirma `outline: 2px solid rgb(37,72,199)`. |

## Decisões do autor

- **D1** — o 18 é o aviso de congelamento (o mesmo do 03), não a espera real; a
  montagem não mostra o Xournal parado ao lado do chat. É decisão do autor e
  não entra como achado; a nota de “Estados” vale para o que a captura mostra.
- **D2/D3** — cadernos e capas não tocam esta montagem.
- **D4** — “Tentar de novo” do erro do chat não aparece no 17/18; o estado de
  erro tem avaliador próprio na parte chat solto. Não afeta esta nota.

## Nota independente

Não reusei as notas da rodada 4. Medi os dois PNG da montagem, o diff entre 17
e 18, o diff contra a rodada 4, as linhas de pixel do escopo/composer, os JSON
420/380 claro e 420 escuro e os três PNG da janela solta. Concordo que o par
continua sendo o mesmo posto (900×650 + 420×650, vão 36, `seguro: true`,
`intrusas: []`). O corte do escopo da rodada 4 está resolvido; o que impede o 9
agora é outro defeito, mais baixo: a quebra forçada quando o texto cabe e a ação
que perdeu o canto direito (achado 1). As notas de Clarity e Janela pequena
sobem de 8,5 para 9,0; Spacing & density desce de 9,0 para 8,5; o Overall fica
em 8,5, agora por um motivo diferente do da rodada 4. Os detalhes (foco duplo,
cadeado, “Levar” sem ícone) e as lacunas de captura (espera real, escuro, moldura,
leitor de tela) seguem registrados.
