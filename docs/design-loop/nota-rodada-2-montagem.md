# Nota da rodada 2 — montagem real (Xournal++ + chat solto)

Recorte: a montagem real da #157/#159 — Xournal++ **900×650** à esquerda e a
janela solta do chat lateral **420×650** à direita — nas capturas **17** e
**18** de `docs/design-loop/rodada-2/antes/xournal/`, em Debian X11, com a Mesa
principal minimizada e o interior GTK do Xournal++ fora do escopo. O texto das
mensagens é fixture e não entra na nota. Para contraste, alvos e foco do chat,
usei os JSON da janela solta em `docs/design-loop/rodada-2/antes/chat-solto/`
(claro e escuro, 380×800 e 420×1000) e, para a família, a captura
`mesa-trazido-de-volta-claro-900x650.png`.

**Vi as imagens.** Abri os PNG **17-montagem-real** e
**18-montagem-real-convertendo** (1356×650), o **17 da rodada 1** para comparar
o antes, `solto-resposta-claro-420x1000.png` e
`mesa-trazido-de-volta-claro-900x650.png`. Não abri os PNG de tema escuro,
estados ou menus; para esses usei os JSON. Conferi também o código citado
(`support-sidechat.css`, `composer.css`, `tutor-chat.css`, `sidechat.mjs`,
`sidechat-detach.mjs`, `sidechat-window-host.cjs`).

## Resposta curta

- **As duas janelas funcionam como posto?** Sim. Topos e bases alinhados (ambas
  650 px), **36 px** de desktop entre elas, sem sobreposição (JSON 17/18,
  `seguro: true`, `intrusas: []`). A página do Xournal fica à esquerda e o chat
  à direita; a janela solta não compete com a barra de ferramentas do GTK.
- **A barra de menu do app sumiu?** Sim. No 17/18 o cabeçalho do chat começa em
  y=0 e o título em y=13–27; a barra de 27 px da rodada 1 (y=0–26, “Mesa de
  Estudos · Editar · Estudar · Visualizar · Ajuda”) não está mais lá
  (`sidechat-window-host.cjs:109-111`, `:186-187`).
- **O composer segue a regra da casa?** Sim. Fio de 1 px em cima, colado de
  ponta a ponta (420 px), texto recuado 12 px e **campo fixo de 86 px (3
  linhas)**. O bloco do composer caiu de **191 px (29,4%)** na rodada 1 para
  **157 px (24,2%)**, e o vão interno de ~105 px sumiu (achado 2 da rodada 1
  resolvido).
- **Cabe e lê bem a 420 px?** Sim. Corpo **15 px/24 px**, coluna de **396 px**,
  linhas de 36–42 caracteres, sem estouro ou truncamento no recorte. Os alvos
  medidos vão de **24×24** (cadeado/atualizar) a **75,9×28** (Enviar) e
  **396×86** (campo).
- **Contraste?** Todo texto passa AA no claro: corpo 17,58:1, rótulos 4,95:1,
  ações 6,69:1, “Atualizar contexto” 7,42:1, título 18,88:1. No escuro, 6,02:1
  a 7,71:1. O fio da bolha é 1,32:1, mas é a mesma forma da casa (o tutor usa
  `--user:var(--surface)` e a mesma borda; ver item 5 da rodada 1).
- **O que ainda incomoda?** O cadeado do escopo continua sem rótulo visível
  (“Fora da sessão principal” só em `title`/`aria-label`) e o “Enviar” fica
  habilitado, embora neutro, com o campo vazio — um clique/Enter não faz nada.
  São dois achados baixos; o resto é 9.
- **O 18 é “durante a conversão”?** Só em parte: o chat é **idêntico pixel a
  pixel** ao 17 (diff de 0 px na região x=936–1355) e o Xournal só ganhou a
  seleção (Ctrl+A). O diálogo “Convertendo…” não está na montagem; o estado de
  progresso fica sem captura (ver “SEM CAPTURA”).

## Notas

| Categoria | Posto lado a lado (17) | Durante a conversão (18) | Base medida |
|---|---:|---:|---|
| Typography | 9,0 | 9,0 (= posto) | Corpo 15 px/24 px; título 12 px/600; rótulos e ações 11 px/17,6 px; coluna de 396 px; linhas de 36–42 caracteres; sem truncamento no recorte. A escala é a da casa (11 px é o piso). |
| Hierarchy | 9,0 | 9,0 (= posto) | Pergunta → resposta → campo, na ordem. A bolha do usuário agora fica em **337 px (80,2% de 420)**, encostada à direita (x=1007–1343), e não estica mais a coluna; a resposta em texto plano e as ações de 11 px ficam subordinadas. |
| Spacing & density | 9,0 | 9,0 (= posto) | Cabeçalho 40 px (y=0–39, fio #e0e0e0 em y=39); recuo de 12 px; mensagens com 16 px entre blocos; composer com **157 px (24,2%)**, campo de **86 px (3 linhas)**, escopo 24 px e Enviar 28 px. Sem vão morto dentro do campo; a área vazia entre a última ação (y≈295) e o composer (y=493) é de ≈198 px e é conversa, não cromo. |
| Color & contrast | 9,0 | 9,0 (= posto) | Neutros da Mesa (branco no cabeçalho/corpo, fio #e0e0e0) e azul #2548c7. Claro: 17,58 / 4,95 / 6,69 / 7,42 / 18,88:1. Escuro: 6,02–17,58:1 (texto pequeno 6,02–7,71:1). O fio da bolha a 1,32:1 é a forma da casa (mesma `--user` e mesma borda do tutor); não há texto abaixo de 4,5:1. |
| Iconography | 9,0 | 9,0 (= posto) | +, ⋯ e × em **28×28** (JSON targets); cadeado em alvo **24×24** com glifo de 12 px; atualizar **134,2×24** com glifo de 12 px; seta do Enviar em **75,9×28**. Mesmo traço e mesma família do cabeçalho da Mesa; nada desalinha. |
| Consistency & polish | 9,0 | 9,0 (= posto) | Mesmo componente do chat preso (`mesa-trazido-de-volta-claro-900x650.png`): cabeçalho de 40 px, título 12/600, corpo 15/24, rótulos 11 px, recuo 12 px, mesma paleta e mesmo acento; a bolha segue o tutor (`max-width:85%`, `--user`/borda iguais). A barra de menu do app saiu. O foco acende o fio do composer e o anel do campo; o reforço duplo é detalhe, não divergência. |
| Clarity | 8,5 | 8,5 (= posto) | Pergunta, resposta e campo se entendem sem legenda. O escopo visível diz só “Limites.pdf. p. 1” com um cadeado de 12 px; “Fora da sessão principal” continua apenas em `title`/`aria-label` (JSON labels); a legenda só aparece no tooltip (achado 1, baixa). |
| Estados | 8,5 | sem captura | O único estado observável em 17/18 é o **campo vazio**: “Enviar” está neutro (6,69:1) e `disabled:false`; clique/Enter não faz nada. Vazio da conversa, carregando/streaming, erro/incerto, “Parar”, anexos/cartões de permissão, rolagem longa, tema escuro na montagem e “sempre por cima” ligado/desligado não estão na montagem (ver “SEM CAPTURA”). |
| Feedback e movimento | sem captura | sem captura | PNG estático: hover, transição, streaming e retorno do envio não aparecem. O foco de teclado é o único feedback medido: anel de **2 px** `rgb(37, 72, 199)` no campo, `focusVisible: true` (JSON 420×1000). |
| Acessibilidade | 9,0 | 9,0 (= posto) | Alvos ≥24 px em todos os 10 alvos do JSON; contraste AA em todo texto; foco visível de 2 px; nomes acessíveis no DOM (14 labels, incluindo “Fora da sessão principal” no cadeado e “Enviar mensagem” no botão). Não há captura de leitor de tela em execução (ver “SEM CAPTURA”). |
| Janela pequena | 9,0 | 9,0 (= posto) | 420×650 cabe sem overflow; escopo em uma linha em 420; a 380×800 o escopo quebra em duas linhas (181,8×30,8) e ainda cabe com campo 356×86 e Enviar 75,9×28. O selo “OpenCode” só some abaixo de 300 px (container query), não neste recorte. |
| **Overall / Geral** | **8,5** | **8,5** | O par funciona como posto e é da família; quase todos os consertos da rodada 1 pegaram. Restam dois achados baixos (rótulo do escopo e Enviar vazio habilitado) que impedem o 9. |

## Achados

| # | Categoria | Severidade | Evidência (captura + valor) | Conserto em uma linha | Arquivo provável |
|---:|---|---|---|---|---|
| 1 | Clarity | baixa | **17/18**: a linha de escopo visível diz só “Limites.pdf. p. 1” (y≈503–517) com um cadeado de 12 px em alvo 24×24; “Fora da sessão principal” existe só em `title`/`aria-label` do cadeado (JSON `labels`); a legenda só aparece no tooltip. O aluno lê um cadeado sem legenda em repouso. | Mostrar “fora da sessão” quando couber (ou um rótulo curto no popover) e manter tooltip/aria. | `desk/src/sidechat.mjs:726-730`; `desk/src/support-sidechat.css:74-81`; `desk/src/composer.css:80-82` |
| 2 | Estados | baixa | **17/18**: campo vazio (placeholder “Pergunte no lateral…”) e “Enviar” em 6,69:1, mas o alvo `sidechat-send` do JSON está `disabled:false` (420×1000 e 380×800); `paintHeader` só desliga em unavailable/busy/uncertain e `sendMessage` retorna quando o texto está vazio (`:486`). O botão parece desligado, é focável e o clique/Enter não dá retorno. | Desligar o Enviar quando o rascunho estiver vazio (ou responder ao clique vazio), mantendo o estilo de desligado. | `desk/src/sidechat.mjs:769-776`, `:486`; `desk/src/composer.css:238` |

Não há achado grave ou médio. O fio de 1 px do composer acender junto com o anel
de 2 px do campo (y=493 e y=521–522/611–612, ambos `rgb(37,72,199)`) é um
reforço duplo de foco; fica como detalhe de polimento, não como achado.

## O que ficou sem captura

| Item | Por quê | Onde |
|---|---|---|
| “Durante a conversão” de verdade (diálogo “Convertendo…”, progresso, bloqueio do Xournal) | O **18** só mostra a seleção (Ctrl+A): a região do chat é **0 px de diferença** para o 17 e o Xournal ganhou o retângulo tracejado. O diálogo de conversão existe no `04-converter-convertendo`, mas é um recorte só do Xournal, não a montagem. | 18; `04-converter-convertendo.png` |
| Estados do chat: conversa vazia, carregando/streaming, erro/incerto, “Parar”, anexos, cartões de permissão, conversa longa com rolagem, tema escuro na montagem, “sempre por cima” ligado/desligado | 17/18 mostram só a resposta concluída e o campo vazio. A rodada do chat solto tem estados separados (`solto-vazio`, `solto-carregando`, `solto-erro`, `en-solto-incerto`, `solto-por-cima-sinal`), mas fora desta montagem. | 17/18; `chat-solto/` |
| Movimento: hover, transição de opacidade, envio/streaming | As duas capturas são PNG estáticos; não há captura de movimento. O foco de teclado mensurável está no JSON. | 17/18; `solto-resposta-claro-420x1000.json` |
| Moldura e título nativo da janela solta | O recorte começa na área do cliente (y=56; `xwininfo`); a moldura/título do sistema não está na imagem. No cliente, o título é o cabeçalho “Chat lateral”. | 17/18 JSON |
| Leitor de tela em execução | Os nomes acessíveis foram lidos do DOM (`labels` do JSON); não há captura de árvore de acessibilidade nem de leitor de tela falando. | `solto-resposta-claro-420x1000.json` (`labels`) |
| Tema escuro na montagem | Não há 17/18 escuro; os JSON escuros da janela solta passam AA (6,02–7,71:1) e o foco é `rgb(143,168,255)`, mas isso não prova a montagem. | `solto-resposta-escuro-420x1000.json` |
| Windows: “Converter ainda não funciona no Windows.” | Sem máquina Windows neste ciclo; registrado no `capturas.json` da rodada. | `xournal/capturas.json` |
| Interior do Xournal++ (GTK) | Fora do escopo por definição. | — |

## Achados da rodada 1

| # | Achado (rodada 1) | Status | Prova na rodada 2 |
|---:|---|---|---|
| 1 | Barra de menu do app inteiro (27 px) na janela solta | **RESOLVIDO** | 17/18: o cabeçalho começa em y=0 e o título em y=13–27; a barra de 27 px do 17 da rodada 1 sumiu. `autoHideMenuBar:true` + `setMenuBarVisibility(false)` (`sidechat-window-host.cjs:109-111`, `:186-187`). Ressalva: Alt ainda pode revelar o menu do app; não aparece na captura. |
| 2 | Composer de 191 px (29,4%) com ~105 px de vão e campo de 126 px | **RESOLVIDO** | 17: fio do composer em y=493 → **157 px (24,2%)**; campo de **86 px (3 linhas)** contra 126 px na rodada 1; o vão interno sumiu. `body>#sidechat` zera o `min-height` do tutor e fixa o campo em 3 linhas (`composer.css:147-157`). O custo restante (24,2%) é a regra da casa do campo de 3 linhas. |
| 3 | “Copiar”/“Levar à sessão principal” a 3,92:1 no claro | **RESOLVIDO** | JSON 420×1000: **6,69:1** no claro e **6,93:1** no escuro, opacidade 1 (era 3,92 com `opacity:.55`). `support-sidechat.css:52-57`. |
| 4 | Anel de foco da janela solta não pintava (`display:none`) | **PARCIAL** | JSON `focus`: `outline: 2px solid rgb(37, 72, 199)` no campo (era `3px none`), `focusVisible: true`; o 17 mostra o anel azul em volta do campo. O `::after` da janela segue `display:none`, então o anel de 1 px em volta da janela não foi reposto; o foco visível foi resolvido por outro caminho, o anel de 2 px do campo (`composer.css:159-163`). |
| 5 | Bolha do usuário esticada em 396 px e branca sobre branco | **RESOLVIDO** | 17: bolha em **337 px (80,2%)**, encostada à direita (x=1007–1343), com o mesmo `max-width:85%` do tutor (`support-sidechat.css:51`). O fundo `--user:var(--surface)` e o fio de 1 px são os mesmos do tutor (`tutor-chat.css:9`, `:180-184`); a comparação da rodada 1 com `#f1f1f1` não valia — o tutor também usa `surface` e borda. |
| 6 | Escopo “fora da sessão principal” só no `title`/`aria-label` | **ABERTO** | 17/18: a linha visível continua só “Limites.pdf. p. 1” + cadeado; “Fora da sessão principal” segue só em `title`/`aria-label` (`sidechat.mjs:726-730`). É o achado 1 desta rodada. |

## Nota independente

Não reusei as notas da rodada 1. As notas acima foram medidas nas capturas 17/18
e nos JSON da janela solta; onde discordo da rodada 1 (o fundo da bolha no item
5), digo por quê na própria tabela. O 17/18 continua sendo o mesmo par de
janelas da rodada 1 (900×650 + 420×650, gap 36, `seguro: true`), mas o cromo da
janela solta mudou: sem menu, composer de 3 linhas, ações AA e foco visível. O
que impede o 9 no Overall são o rótulo do escopo e o Enviar habilitado com o
campo vazio; o resto está polido.
