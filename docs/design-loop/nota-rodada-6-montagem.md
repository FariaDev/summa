# Nota da rodada 6 — montagem real (Xournal++ + chat solto)

Recorte: a montagem da #157/#159 — Xournal++ **900×650** à esquerda e a janela
solta do chat lateral **420×650** à direita — nas capturas **17-montagem-real** e
**18-montagem-real-convertendo** de `docs/design-loop/rodada-6/antes/xournal/`,
em Debian X11 (tela 1366×768, Xournal++ 1.3.8, recorte de 1356×650 em
`x=5,y=56`). O interior GTK do Xournal++ fica fora; o texto das mensagens é
fixture e não entra na nota. Para contraste, alvos e foco do chat usei os JSON
da janela solta em `docs/design-loop/rodada-6/antes/chat-solto/` (claro
420×1000 e 380×800, escuro 420×1000, resumo de teclado); para a montagem, medi
os pixels dos dois PNG. **D1** (espera síncrona do Converter) é decisão do
autor; D2/D3 não tocam esta montagem; D4 (Tentar de novo do erro) não aparece
no 17/18.

**Vi as imagens.** Abri os PNG **17-montagem-real** e
**18-montagem-real-convertendo** da rodada 6, o **17 da rodada 5** (para o
diff), os três PNG da janela solta (**claro 420**, **claro 380** e **escuro
420**) e recortes ampliados do 17 (cabeçalho/mensagens, composer, vão entre as
janelas) e do diálogo do 18. Não abri os outros 17 PNG do inventário (são a
outra parte desta rodada); as medidas de todos os JSON de `chat-solto/` saíram
de um script só, e não os abri um a um.

## Resposta curta

- **As duas janelas funcionam como posto?** Sim. Xournal em x=0–899 e chat em
  x=936–1355 no recorte, **36 px** de desktop entre eles (x=900–935,
  `#d9d9d9`); os dois clientes medem **650 px** de altura, com topos e bases
  alinhados. O 17 e o 18 trazem `seguro: true` e `intrusas: []`; o recorte
  encosta nas duas janelas (0 px de sobra à esquerda e à direita).
- **O 18 é “durante a conversão”?** Só até a confirmação. O chat é **idêntico
  pixel a pixel** ao 17 (diff de **0 px** em x=936–1355, y=0–649). O 18
  acrescenta a seleção no Xournal e o diálogo **545×144** em `x=182,y=282`
  (recorte x=182–726, y=282–425), a **209 px** do chat. A espera real
  (“Convertendo…”) continua fora da montagem; é D1 e não é achado desta nota.
- **O achado 1 da rodada 5 foi resolvido?** Sim. No 17 novo o escopo de um
  material (“Limites.pdf p. 1”, 84 px) fica na **mesma linha** do cadeado,
  da legenda e da ação; o fio do composer subiu para **y=493** (era y=478) e o
  composer caiu de **172 px (26,5%)** para **157 px (24,2%)**, com o campo no
  mesmo lugar (anel em y=521–522 e y=611–612). A ação “Atualizar contexto”
  termina em **x=1340** (borda direita), não mais em x=1193,5. No JSON 420 com
  **dois** materiais a linha ainda quebra — é necessário —, mas a ação volta a
  ficar encostada à direita (269,8–404).
- **O que ficou?** Nenhum achado novo. Ficam os detalhes de sempre: foco duplo
  (fio do composer + anel do campo), cadeado focável sem ação, “Levar à sessão
  principal” sem ícone, escopo com 3+ materiais/nowrap (não capturado) e o
  foco composto do chat no 18 (o chat é o mesmo do 17; o foco do campo é da
  captura, não do layout). Nada disso é defeito visível que o usuário sinta.

## Notas

| Categoria | Posto lado a lado (17) | Durante a conversão (18) | Geral |
|---|---:|---:|---:|
| Typography | 9,0 | 9,0 (= posto) | 9,0 |
| Hierarchy | 9,0 | 9,0 (= posto) | 9,0 |
| Spacing & density | 9,0 | 9,0 (= posto) | 9,0 |
| Color & contrast | 9,0 | 9,0 (= posto) | 9,0 |
| Iconography | 9,0 | 9,0 (= posto) | 9,0 |
| Consistency & polish | 9,0 | 9,0 (= posto) | 9,0 |
| Clarity | 9,0 | 9,0 (= posto) | 9,0 |
| Estados | 9,0 | 9,0 (= posto) | 9,0 |
| Feedback e movimento | n/a | n/a | n/a |
| Acessibilidade | 9,0 | 9,0 (= posto) | 9,0 |
| Janela pequena | 9,0 | 9,0 (= posto) | 9,0 |
| **Overall / Geral** | **9,0** | **9,0** | **9,0** |

**Lastro das notas (para nenhuma nota ficar sem medida):**

- **Typography 9,0 (17/18):** corpo **15 px/24 px** (1,6), título **12 px/600**,
  selo do motor **11 px/600**, papéis **11 px/600**, ações **11 px**, escopo
  **11 px/15,4 px**, Enviar **12 px**, placeholder **15 px/24 px**. O piso é
  **11 px** (`--fs-xs`/`--fs-2xs` em `desk/style.css:123`); os **41 textos** do
  JSON 420 não têm nada abaixo disso (`textsTruncated: false`). A coluna de
  **396 px** mantém a pergunta da fixture em duas linhas e a resposta em duas,
  sem truncar texto de mensagem. A 380 (`solto-resposta-claro-380x800.json`) o
  corpo e os papéis mantêm as medidas. O escopo de um material mede **84 px**
  e cabe inteiro; o de dois mede **195 px** e fica inteiro na linha 1 de
  392 px, mas a linha com o grupo todo não cabe e quebra. Não há achado de
  tipografia.
- **Hierarchy 9,0 (17/18):** pergunta → resposta → campo. A bolha do usuário
  mede **337 px (80,2% de 420)** em x=1007–1343, y=76–149, encostada à direita;
  o papel “Você” fica acima, alinhado à direita; a resposta é texto plano de
  15 px e as ações de 11 px ficam subordinadas; o composer de **157 px** fecha
  a coluna. O escopo de 11 px fica entre a conversa e o campo, sem competir com
  o corpo; o azul “Atualizar contexto” é a única ação de contexto e fica à
  direita.
- **Spacing & density 9,0 (17/18):** cabeçalho **40 px** (y=0–39, fio #e0e0e0
  em y=39); recuo de 12 px; respiro de 6–10 px entre papel, bolha e ações;
  composer **157 px (24,2%)**, campo **86 px (3 linhas)**, escopo em **uma
  linha** (28 px entre o fio e o campo), Enviar **28 px**; vão de **198 px**
  entre a última ação
  (y=295) e o fio do composer (y=493), que é conversa, não cromo. As duas
  janelas têm 650 px de altura e 36 px de vão. O **achado 1 da rodada 5** está
  resolvido: a quebra só acontece quando a linha inteira não cabe, a ação fica
  à direita e o composer não cresce no caso de um material. O caso de dois
  materiais quebra (195 + 24 + 75,3 + 134,2 + vãos > 392) e é o único que
  cresce.
- **Color & contrast 9,0 (17/18):** neutros da Mesa e azul `#2548c7`. Claro:
  corpo **17,58:1**, título **18,88:1**, papéis/selo **4,95:1**, ações/escopo
  **6,69:1**, “Atualizar contexto” **7,42:1**, placeholder **4,95:1**, Enviar
  desligado **5,36:1** (`#5c5c5c` sobre `#e6e6e6`, opacidade 1 por regra
  própria em `composer.css:259`). Escuro (JSON 420): **5,74–17,58:1** (papéis
  6,72:1; Copiar 6,93:1; escopo/nota 7,39:1; refresh 7,71:1; Enviar desligado
  5,74:1; placeholder 6,72:1). Nenhum texto abaixo de AA. O fio da bolha
  (1,32:1) e o fio dos botões secundários são a forma da casa, não texto nem
  componente interativo. O anel de foco é 7,42:1 no claro e `#8fa8ff` no
  escuro.
- **Iconography 9,0 (17/18):** +, ⋯ e × em **28×28**; cadeado **24×24** com
  glifo de 12 px; “Atualizar contexto” **134,2×24** com glifo de 12 px;
  “Copiar” **76,9×25,6** com glifo de 12 px; “Levar à sessão principal”
  **148,6×25,6** (só texto); Enviar **75,9×28** com seta. Mesmo traço e mesma
  família do cabeçalho da Mesa; nada desalinha no recorte. “Levar” sem ícone
  fica como detalhe, não achado.
- **Consistency & polish 9,0 (17/18):** mesmo componente do chat preso:
  cabeçalho 40 px, título 12/600, corpo 15/24, rótulos 11 px, recuo 12 px,
  mesma paleta e acento. O cabeçalho do chat da montagem é **idêntico pixel a
  pixel** ao da janela solta 420 (diff de **0 px** em x=936–1355, y=0–39). O
  “Copiar” agora reserva a largura do “Copiado” (76,9 px contra 67,7 px da
  rodada 5; `support-sidechat.css:68-70`), então o vizinho não anda ao copiar.
  O diálogo do 18 é GTK do Xournal++ (fora da nota de estilo). O foco duplo
  (fio azul do composer + anel de 2 px do campo) é detalhe de polimento, não
  divergência.
- **Clarity 9,0 (17/18):** pergunta, resposta e campo se entendem; “Só neste
  chat” explica o cadeado em repouso; “Atualizar contexto” nomeia a ação; o
  escopo completo aparece em 420/380; o diálogo do 18 nomeia o congelamento de
  até 20 s, a camada nova e a tinta que fica. Não há corte que esconda o
  segundo material quando ele existe.
- **Estados 9,0 (17/18):** o estado observável no 17/18 é o **campo vazio**:
  Enviar desligado (`disabled: true`, **5,36:1**) e campo focado; o 18 mostra a
  confirmação do Converter (545×144) e o chat no mesmo estado. Os outros
  estados do chat (vazio de conversa, carregando, erro, cartões, menus) têm
  avaliador próprio na parte chat solto e não entram aqui (ver “SEM CAPTURA”).
  A espera síncrona real é D1.
- **Feedback e movimento n/a (17/18):** PNG estático: hover, transição,
  streaming e retorno do envio não aparecem. O foco visível (2 px) e o
  desligado do Enviar são medidos em Acessibilidade/Estados; o diálogo do 18 é
  estático e anterior à espera, que é D1.
- **Acessibilidade 9,0 (17/18):** **10 alvos ≥24 px** (28×28 no cabeçalho;
  24×24 no cadeado; 134,2×24 no atualizar; 76,9×25,6 nos dois Copiar;
  148,6×25,6 no Levar; 75,9×28 no Enviar; 396×86 no campo em 420, 356×86 em
  380); foco de **2 px** `#2548c7` em todos os controles da rota
  (`teclado-solto-resumo.json`, 9 paradas úteis; o Enviar desligado fica fora);
  14 nomes acessíveis no DOM, incluindo “Fora da sessão principal” no cadeado e
  “Enviar mensagem”; AA em todo texto. O cadeado é um `role="img"` com
  `tabindex="0"` (`sidechat.mjs:92`), um stop a mais na ordem de Tab, mas expõe
  o nome a quem não usa mouse — fica como troca, não como achado. Não há
  captura de leitor de tela em execução.
- **Janela pequena 9,0 (17/18):** 420×650 cabe sem overflow (`scrollWidth`
  420/420 no JSON 420); campo **396×86**, Enviar **75,9×28**; a 380
  (`solto-resposta-claro-380x800`) o campo fica **356×86**, o Enviar segue
  75,9×28 e o `scrollWidth` é 380/380. O escopo de dois materiais ocupa
  195 px de texto e quebra com a ação à direita (269,8–404); o de um material
  fica em uma linha. O cabeçalho e a linha de ações continuam cabendo nas duas
  larguras.
- **Overall 9,0:** o par funciona como posto (900×650 + 420×650, vão 36,
  `seguro: true`, `intrusas: []`); é da família; o diálogo do 18 não atrapalha
  o chat; o achado 1 da rodada 5 está resolvido e não há achado novo grave,
  médio ou baixo. Os detalhes abaixo não tiram o 9.

## Achados

**Nenhum achado novo.** O único achado da rodada 5 está resolvido (prova na
seção 5). Os itens abaixo ficam registrados como detalhes, sem severidade de
achado porque não são defeito (ou são de captura, não de layout).

| Detalhe | Evidência (captura + valor) | Conserto (opcional) | Arquivo |
|---|---|---|---|
| Foco duplo (fio do composer + anel do campo) | No 17/18 o fio azul do composer mede 1 px em **y=493** (420 px) e o anel do campo mede 2 px em **y=521–522** e **y=611–612**; os dois são `#2548c7` (7,42:1). É o padrão da casa (composer aceso + campo focado), já tratado como detalhe na rodada 4. | Unificar num só sinal, se o autor quiser; hoje não atrapalha. | `desk/src/composer.css:19-20,184` |
| Cadeado focável sem ação | `teclado-solto-resumo.json`: parada 5, `sidechat-scope-lock`, **24×24**, foco de 2 px; `role="img"` com `tabindex="0"`. O nome “Fora da sessão principal” explica o estado, mas é um Tab sem ação. | Remover o `tabindex` e deixar a legenda visível carregar o sentido, ou manter como está. | `desk/src/sidechat.mjs:92` |
| “Levar à sessão principal” sem ícone | “Copiar” tem glifo de 12 px + texto e mede **76,9×25,6**; “Levar” é só texto e mede **148,6×25,6**. Os dois têm a mesma altura e o mesmo contorno. | Adicionar o ícone de “levar” ou aceitar a diferença (o rótulo já é longo). | `desk/src/sidechat-message-view.mjs:81-82` |
| Escopo com 3+ materiais ou nome longo | `#sidechat-scope-text` segue `white-space:nowrap`+`text-overflow:ellipsis` (`composer.css:79`); o `title` guarda a linha completa (`sidechat.mjs:679`). O caso de dois materiais — o da rodada 4 — cabe inteiro. | Nenhum para o caso capturado; se aparecer nome maior, o `title` continua. | `desk/src/composer.css:79`; `desk/src/sidechat.mjs:679` |
| Foco composto no 18 | O chat do 18 é **idêntico pixel a pixel** ao 17 (diff 0 px), com o fio em y=493 e o anel do campo em y=521–522/611–612; o diálogo do Xournal tem o foco no “Continuar” (retângulo pontilhado do GTK). Na sessão real só uma janela tem foco; a montagem compõe duas capturas focadas. Não é CSS: é composição/captura. | Capturar/compôr o chat sem foco para o 18 (campo desfocado), se a imagem for publicada. | `desk/tests/capture-ciclo2-xournal.mjs` |
| Bolha do usuário branca com fio | No 17 a bolha é `--surface` branca com fio `--border` #e0e0e0 (1,32:1); o texto tem 17,58:1. É a forma do lateral (`#sidechat{--user:var(--surface)}`), diferente do tutor (#f1f1f1). O contorno e o alinhamento bastam para ler a bolha. | Opcional: usar `--user` do tutor, se quiser o mesmo preenchimento dos dois chats. | `desk/src/support-sidechat.css:25,57`; `desk/src/tutor-chat.css:180-184` |
| “Copiar” com largura reservada | Os dois “Copiar” medem **76,9×25,6** (na rodada 5 mediam 67,7); o rótulo invisível “Copiado” reserva a largura e o vizinho não anda. | Nenhum; é o conserto do achado de chat solto da rodada 5. | `desk/src/support-sidechat.css:68-70` |
| Enviar desligado legível | `#sidechat .composer-actions #sidechat-send:disabled` força `opacity:1` e dá **5,36:1** (#5c5c5c em #e6e6e6); o pixel medido confirma 5,36:1, não a opacidade .45 global. | Nenhum; é o padrão do chat lateral. | `desk/src/composer.css:259` |

## SEM CAPTURA

| Item | Por quê | Onde |
|---|---|---|
| A espera/progresso real do Converter na montagem | O **18** mostra o diálogo de confirmação (545×144) e o chat idêntico; o `04-converter-convertendo` é só o Xournal congelado; a espera síncrona é **D1, decisão do autor** | 18; `04-converter-convertendo` |
| O chat do 18 sem foco (estado real de duas janelas) | O chat do 18 é o do 17, com o campo focado; não há variante capturada com o chat desfocado ao lado do diálogo | 17/18 |
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

## Achados da rodada 5

| # | Achado (rodada 5) | Status | Prova na rodada 6 |
|---:|---|---|---|
| 1 | Spacing & density (e polimento), baixa: a quebra do escopo era forçada mesmo quando o texto cabia e a ação perdia o canto direito | **RESOLVIDO** | No 17 novo o escopo “Limites.pdf p. 1” (84 px, x=949–1032) fica na **mesma linha** do cadeado (glifo em x=1101–1110), de “Só neste chat” (x=1128–1183) e de “Atualizar contexto” (botão 1205,8–1340; texto azul 1221–1321), com o fio em **y=493** e o composer em **157 px (24,2%)** — antes o fio era y=478 e o composer, 172 px. O diff do chat contra o 17 da rodada 5 é de **4.647 px**, todo em x=936–1355: as linhas y=478 (fio antigo), y=488–497 e y=506–517 (as duas linhas antigas do escopo), mais 1 px de deslocamento nos “Copiar” (y=156–180 e 271–295) por causa da largura reservada do “Copiado”. No JSON 420 com dois materiais, a ação vai de **269,8 a 404** (encostada à direita; na rodada 5 ia de 123,3 a 257,5) e o texto de 195 px quebra porque 195 + 24 + 75,3 + 134,2 + vãos passa de 392. O código tem o wrapper `.sidechat-scope-meta` com `margin-left:auto` e o texto `flex:1 1 auto` (`composer.css:74-87`; `sidechat.mjs:89-95`), com o comentário citando o achado 1. |
| — | Foco duplo fio do composer + anel do campo (detalhe da rodada 4/5) | **ABERTO** | No 17/18 o fio azul está em **y=493** (1 px) e o anel de 2 px do campo em **y=521–522** e **y=611–612**; o JSON de foco do 420 confirma `outline: 2px solid rgb(37, 72, 199)`. É detalhe, não achado. |
| — | Cadeado focável sem ação (detalhe da rodada 4/5) | **ABERTO** | `teclado-solto-resumo.json`: parada 5, **24×24**, foco de 2 px; `sidechat.mjs:92` mantém `role="img"` e `tabindex="0"`. |
| — | “Levar à sessão principal” sem ícone (detalhe da rodada 4/5) | **ABERTO** | “Copiar” tem glifo de 12 px + texto (**76,9×25,6**); “Levar” é só texto (**148,6×25,6**), visível no recorte do 17. |
| — | Escopo com 3+ materiais ou nome longo (detalhe da rodada 4/5) | **ABERTO (não capturado)** | `composer.css:79` mantém `nowrap`+`ellipsis`; o `title` completo segue em `sidechat.mjs:679`. O caso de dois materiais cabe inteiro quando a linha quebra; não há captura de 3+. |

A rodada 5 também registrava, na tabela dela, que o **achado 1 da rodada 4**
(escopo de dois materiais cortado a 420/380) estava resolvido; ele **segue
resolvido**: no JSON 420 o `#sidechat-scope-text` mede 392×15,4 com o texto
completo e o 380 mede 352×15,4; o que mudou na rodada 6 foi só o caso de um
material, que deixou de quebrar à força.

## Decisões do autor

- **D1** — o 18 é o aviso de congelamento (o mesmo do 03), não a espera real; a
  montagem não mostra o Xournal parado ao lado do chat. É decisão do autor e
  não entra como achado; a nota de “Estados” vale para o que a captura mostra.
- **D2/D3** — cadernos e capas não tocam esta montagem.
- **D4** — “Tentar de novo” do erro do chat não aparece no 17/18; o estado de
  erro tem avaliador próprio na parte chat solto. Não afeta esta nota.

## Nota independente

Não reusei as notas da rodada 5. Medi os dois PNG da montagem, o diff entre 17
e 18, o diff do 17 contra o da rodada 5, as linhas de pixel do escopo/composer,
o vão entre as janelas e os JSON 420/380 claro e 420 escuro; abri também os três
PNG da janela solta. Concordo que o par continua sendo o mesmo posto (900×650 +
420×650, vão 36, `seguro: true`, `intrusas: []`). O defeito da rodada 5 está
resolvido: o escopo de um material fica em linha única, a ação volta à borda, o
composer mede 157 px e o campo não se move; o caso de dois materiais só quebra
quando precisa. Por isso **Spacing & density sobe de 8,5 para 9,0** e o
**Overall sobe de 8,5 para 9,0**; as demais categorias seguem em 9,0, agora sem
o achado que puxava o conjunto. Os detalhes (foco duplo, cadeado, “Levar” sem
ícone, escopo 3+, foco composto do 18) e as lacunas de captura (espera real,
escuro, moldura, leitor de tela) seguem registrados.
