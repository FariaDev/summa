# Nota da rodada 3 — montagem real (Xournal++ + chat solto)

Recorte: a montagem real da #157/#159 — Xournal++ **900×650** à esquerda e a
janela solta do chat lateral **420×650** à direita — nas capturas **17** e **18**
de `docs/design-loop/rodada-3/antes/xournal/`, em Debian X11, com a Mesa
principal minimizada e o interior GTK do Xournal++ fora do escopo. O texto das
mensagens é fixture e não entra na nota. Para contraste, alvos e foco do chat,
usei os JSON da janela solta em `docs/design-loop/rodada-3/antes/chat-solto/`
(claro e escuro, 380×800 e 420×1000); para a família, a captura
`mesa-trazido-de-volta-claro-900x650.png`. A referência da casa (tema Claude
Desktop, cinzas neutros, composer colado com fio em cima e campo de 3 linhas,
nada de canvas de tinta, “sempre por cima” desligado) não é achado contra ela.
O Converter sem progresso é a decisão pendente D1 em `docs/design-loop/decisoes.md`.

**Vi as imagens.** Abri os PNG **17-montagem-real** e
**18-montagem-real-convertendo** (1356×650), as capturas
`solto-resposta-claro-420x1000.png` e `solto-resposta-claro-380x800.png` e a
captura da família `mesa-trazido-de-volta-claro-900x650.png`; recortei
e ampliei cabeçalho, composer, mensagens e o diálogo do 18 para conferir pixels.
Não abri os PNG escuros, de menu ou de outros estados do chat; para esses usei
os JSON. Li os JSON 17/18, `solto-resposta-claro-420x1000.json`,
`solto-resposta-claro-380x800.json`, `solto-resposta-escuro-420x1000.json` e
`teclado-solto-resumo.json`, e o código citado (`support-sidechat.css`,
`composer.css`, `sidechat.mjs`, `sidechat-message-view.mjs`, `pt-BR.json`,
`en.json`).

## Resposta curta

- **As duas janelas funcionam como posto?** Sim. Topos e bases alinhados (ambas
  650 px), **36 px** de desktop entre elas, sem sobreposição (JSON 17/18,
  `seguro: true`, `intrusas: []`). O Xournal fica à esquerda e o chat à direita.
- **O 18 é “durante a conversão”?** Só parcialmente. A região do chat é
  **idêntica pixel a pixel** ao 17 (diff de **0 px** em x=936–1355, y=0–649); o
  18 acrescenta a seleção no Xournal e o diálogo de confirmação **543×144** em
  x=188–731, y=338–482, dentro do Xournal e a **210 px** do chat. O diálogo diz
  que o Xournal++ pode congelar por até 20 s e que o texto entra numa camada
  nova; a espera real (o “Convertendo…” / bloqueio) continua fora da montagem —
  é D1, não um achado desta nota.
- **Os dois achados da rodada 2 caíram?** Sim. A legenda **“Só neste chat”**
  aparece em repouso (75,3×15,4 px, 11 px, **6,69:1**) e o **Enviar** está
  desligado com o campo vazio (`disabled:true` no JSON 420 e 380; 75,9×28,
  5,36:1). Ambos estão detalhados em “Achados da rodada 2”.
- **O composer segue a regra da casa?** Sim. Fio de 1 px em cima (azul no foco,
  y=493), colado de ponta a ponta (420 px), recuo de 12 px, campo fixo de
  **86 px (3 linhas)**; o bloco do composer mede **157 px (24,2%)**.
- **Cabe e lê bem a 420 px?** Sim. Corpo **15 px/24 px**, coluna de **396 px**,
  linhas de 36–42 caracteres, sem estouro. Os alvos vão de **24×24**
  (cadeado/atualizar) a **75,9×28** (Enviar) e **396×86** (campo); o foco de
  teclado tem anel de **2 px** `rgb(37, 72, 199)` no claro e `rgb(143, 168, 255)`
  no escuro. Todo texto passa AA (claro 4,95–18,88:1; escuro 6,02–7,71:1).
- **O que ainda incomoda?** A linha de escopo com **dois materiais** perde o
  segundo nome a 420 e a 380: o texto mede **140,5×15,4** a 420 e
  **100,5×15,4** a 380, contra **221,8×15,4** (uma linha, completa) e
  **181,8×30,8** (duas linhas) na rodada 2. A legenda nova ocupa **75,3 px** e a
  linha ficou presa em `nowrap` com reticências. É o achado 1, baixo. O cadeado
  focável sem ação e o foco duplo (fio do composer + anel do campo) ficam como
  detalhes, não como achados.

## Notas

| Categoria | Posto lado a lado (17) | Durante a conversão (18) | Base medida |
|---|---:|---:|---|
| Typography | 9,0 | 9,0 (= posto) | Corpo 15 px/24 px; título 12 px/600; selo do motor 11 px/600; rótulos e ações 11 px/17,6 px; escopo 11 px; Enviar 12 px; placeholder 15 px/24 px; coluna de 396 px e 36–42 caracteres por linha. Sem truncamento no recorte 17/18 (a fixture de um material cabe na linha de escopo). |
| Hierarchy | 9,0 | 9,0 (= posto) | Pergunta → resposta → campo. A bolha do usuário mede **337 px (80,2% de 420)**, encostada à direita (x=1007–1343, fio #e0e0e0); a resposta em texto plano (15 px) e as ações de 11 px ficam subordinadas; o composer de 157 px fecha a coluna. |
| Spacing & density | 9,0 | 9,0 (= posto) | Cabeçalho 40 px (y=0–39, fio #e0e0e0 em y=39); recuo de 12 px; 16 px entre blocos; composer **157 px (24,2%)**, campo **86 px (3 linhas)**, escopo 24 px, Enviar 28 px. O vão de ≈198 px entre a última ação e o composer é conversa, não cromo. O diálogo do 18 (543×144) não encosta no chat (210 px de vão). |
| Color & contrast | 9,0 | 9,0 (= posto) | Neutros da Mesa e azul #2548c7. Claro: corpo 17,58:1, rótulos 4,95:1, ações/escopo 6,69:1, “Atualizar contexto” 7,42:1, título 18,88:1; Enviar desligado 5,36:1. Escuro: 6,02–7,71:1 (Enviar desligado 5,74:1). O fio da bolha (1,32:1) é a forma da casa (`--user:var(--surface)` + borda), não texto. Nada abaixo de AA no texto. |
| Iconography | 9,0 | 9,0 (= posto) | +, ⋯ e × em **28×28**; cadeado **24×24** com glifo de 12 px; “Atualizar contexto” **134,2×24** com glifo de 12 px; “Copiar” **67,7×25,6**; Enviar **75,9×28** com seta. Mesmo traço e mesma família do cabeçalho da Mesa; nada desalinha. |
| Consistency & polish | 9,0 | 9,0 (= posto) | Mesmo componente do chat preso: cabeçalho 40 px, título 12/600, corpo 15/24, rótulos 11 px, recuo 12 px, mesma paleta e acento; o escopo agora usa a linha de 24 px do composer. O diálogo do 18 é GTK do Xournal++ (fora da nota de estilo). O foco duplo (fio azul do composer + anel de 2 px do campo) é detalhe de polimento, não divergência. |
| Clarity | 8,5 | 8,5 (= posto) | Pergunta, resposta e campo se entendem; “Só neste chat” agora explica o cadeado em repouso (era o achado 1 da rodada 2). O que segura o 9 é o achado 1: com dois materiais o escopo corta o segundo nome a 420/380. O diálogo do 18 nomeia o congelamento de até 20 s, a camada nova e a tinta que fica. |
| Estados | 9,0 | 9,0 | O estado observável no 17/18 é o **campo vazio**: Enviar desligado (5,36:1, `disabled:true`) e campo focado; o 18 mostra a confirmação do Converter (543×144) e o chat no mesmo estado. Os outros estados do chat têm avaliador próprio na parte chat solto e não entram aqui (ver “Sem captura”). |
| Feedback e movimento | n/a | n/a | PNG estático: hover, transição, streaming e retorno do envio não aparecem. O foco visível (2 px) e o desligado do Enviar são medidos em Acessibilidade/Estados; o diálogo do 18 é estático e anterior à espera, que é D1. |
| Acessibilidade | 9,0 | 9,0 (= posto) | 10 alvos ≥24 px (28×28 no cabeçalho; 24×24 no cadeado; 134,2×24 no atualizar; 67,7×25,6 e 148,6×25,6 nas ações; 75,9×28 no Enviar; 396×86 no campo); foco de 2 px no campo e em todos os controles da rota; 14 nomes acessíveis no DOM, incluindo “Fora da sessão principal” no cadeado e “Enviar mensagem”; AA em todo texto. Não há captura de leitor de tela em execução (ver “Sem captura”). |
| Janela pequena | 9,0 | 9,0 (= posto) | 420×650 cabe sem overflow; o campo mede 396×86 e o Enviar 75,9×28. A 380 o campo fica 356×86, o Enviar 75,9×28 e o escopo corta com reticências (100,5×15,4), sem quebrar a linha; a legenda some abaixo de 300 px (container query), restando o nome acessível do cadeado. |
| **Overall / Geral** | **8,5** | **8,5** | O par funciona como posto e é da família; os dois achados da rodada 2 estão resolvidos e o diálogo do 18 não atrapalha o chat. O achado 1 (escopo com dois materiais cortado a 420/380, baixo) é o que impede o 9; o resto está polido. |

## Achados

| # | Categoria | Severidade | Evidência (captura + valor) | Conserto em uma linha | Arquivo provável |
|---:|---|---|---|---|---|
| 1 | Clarity | baixa | **17/18** usam um material e a linha cabe; na mesma largura de 420, a captura `solto-resposta-claro-420x1000.png` com dois materiais mostra “Limites.pdf p. 1, Formu…”: o `#sidechat-scope-text` mede **140,5×15,4** (x=12, y=852,3) e o texto completo fica só no `title`. A 380 (`solto-resposta-claro-380x800.png`) mede **100,5×15,4** e mostra “Limites.pdf p. 1…”. Na rodada 2 o mesmo texto media **221,8×15,4** a 420 (uma linha completa) e **181,8×30,8** a 380 (duas linhas); a legenda “Só neste chat” ocupa **75,3 px** e a linha ficou em `white-space:nowrap` com `text-overflow:ellipsis` (`composer.css:76`). O segundo material some em repouso. | Deixar a linha de escopo quebrar em duas linhas quando houver mais de um material (como a 380 da rodada 2) ou encurtar o rótulo fixo; o `title` completo continua. | `desk/src/composer.css:74-80` |

Não há achado grave ou médio. O cadeado é um `span` com `tabindex="0"`
(`sidechat.mjs:100`) e entra na rota de teclado como parada 5
(`teclado-solto-resumo.json`), mas não tem ação; a legenda visível agora carrega
o sentido. Fica como detalhe de acessibilidade (alvo 24×24, nome “Fora da sessão
principal”): se quiser, remover o `tabindex` ou transformar em botão que abra a
explicação do escopo. O anel de 1 px da janela solta (`#sidechat::after`) segue
`display:none` no `focus.chain`; o anel de 2 px do campo e a rota de foco cobrem
o requisito.

## O que ficou sem captura

| Item | Por quê | Onde |
|---|---|---|
| A espera/progresso real do Converter na montagem | O **18** mostra o diálogo de confirmação (543×144) e o chat idêntico; o `04-converter-convertendo` é só o Xournal; a espera síncrona é D1 | 18; `04-converter-convertendo` |
| Moldura e título nativo das janelas | O recorte começa em y=56 (área do cliente); a moldura/título do sistema não está na imagem | 17/18 JSON |
| Leitor de tela em execução | Os nomes acessíveis foram lidos do DOM (14 labels); não há captura de árvore de acessibilidade nem de leitor falando | `solto-resposta-claro-420x1000.json` |
| Tema escuro da montagem | O chat escuro tem captura própria (`solto-resposta-escuro-420x1000`, 6,02–7,71:1), mas o par 17/18 escuro não existe | `chat-solto/` |
| Windows: “Converter ainda não funciona no Windows.” | Sem máquina Windows neste ciclo; a montagem é Debian X11 | `xournal/capturas.json` |
| Interior do Xournal++ (GTK) | Fora do escopo por definição | — |

Não listei aqui os estados do chat que têm avaliador próprio na parte chat solto
(conversa vazia, carregando/streaming, erro/incerto, “Parar”, anexos e cartões
de permissão, rolagem longa, “sempre por cima” ligado/desligado, tema escuro do
chat, menus): eles estão nas capturas `solto-*`/`preso-*` e não contam como SEM
CAPTURA nesta nota. O 17/18 fixa a resposta concluída, o campo vazio/focado e a
confirmação do Converter.

## Achados da rodada 2

| # | Achado (rodada 2) | Status | Prova na rodada 3 |
|---:|---|---|---|
| 1 | Escopo “fora da sessão principal” só no `title`/`aria-label` do cadeado | **RESOLVIDO** | 17/18: “Só neste chat” visível na linha do escopo, **75,3×15,4** a 420, 11 px, **6,69:1** (`pt-BR.json:2426`; `composer.css:80`; `sidechat.mjs:738`). O cadeado mantém `title`/`aria-label` “Fora da sessão principal”. Ressalva: a legenda consumiu **81,3 px** do texto de escopo e criou o achado 1 desta rodada. |
| 2 | “Enviar” habilitado com o campo vazio | **RESOLVIDO** | 17/18: Enviar cinza (fundo 230,230,230; texto 92,92,92; **5,36:1**). JSON 420 e 380: `sidechat-send.disabled:true`; `paintSend` desliga com `!hasText` (`sidechat.mjs:783`) e o estilo desligado é o da casa (`composer.css:243`); o botão sai da rota de tab (9 controles no `teclado-solto-resumo.json`). |

## Nota independente

Não reusei as notas da rodada 2. Medi os dois PNG da montagem, o diff entre 17 e
18, os recortes ampliados e os JSON do chat solto. O par continua sendo o mesmo
posto da rodada 1/2 (900×650 + 420×650, vão 36, `seguro: true`), mas o cromo
mudou: a legenda do escopo aparece, o Enviar vazio está desligado e o 18 ganhou
o diálogo de confirmação. Concordo com a rodada 2 no que ela resolveu; discordo
de manter o escopo em uma linha depois da legenda: a 420 a linha completa de dois
materiais media 221,8 px na rodada 2 e caiu para 140,5 px agora, e a 380 deixou
de quebrar em duas linhas (181,8×30,8) para cortar em uma (100,5×15,4). O que
impede o 9 é esse achado baixo; o resto está polido.
