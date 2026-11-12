# Nota da rodada 3 — chat solto (#157)

Avaliação do recorte "Chat solto" do ciclo 3: janela solta (380×800 e
420×1000), faixa "Chat em outra janela", soltar/trazer, "sempre por cima",
chat preso com resposta/cartões/envio incerto/janela pequena e os estados
vazio/carregando/erro. Base: as capturas novas de
`docs/design-loop/rodada-3/antes/chat-solto/` (PNG + JSON homônimo), o
inventário `docs/design-loop/inventario-chat-solto.md`, o CSS e o código em
`desk/src`. Não implementei nem corrigi nada.

**Nota sobre o inventário e a pasta.** O inventário fala em 61 PNG + 61 JSON
= 126 arquivos; a pasta tem **60 PNG + 60 JSON de medidas + 3 resumos de
teclado + `falhas.json` = 124**, e `falhas.json` está vazio. O
`teclado-solto-10-sidechat-more` que o inventário lista **não existe**: o
roteiro real termina no **09 `sidechat-more`**, e o **08 é `sidechat-new`**
(não `sidechat-send`). O motivo é o conserto do "Enviar" desligado com o campo
vazio: o botão sai da ordem de Tab e o `teclado-solto-resumo.json` traz **9
controles únicos** (24 passos ciclando por eles), não 10. O estado "Enviar habilitado com rascunho" não tem captura
(ver SEM CAPTURA). As observações 1–4 do inventário descrevem o estado da
rodada 1; uso o JSON/PNG como prova e o inventário só como pista.

Não contam como achado a referência da casa (tema inspirado no Claude Desktop,
cinzas neutros, composer colado de ponta a ponta com fio em cima e campo fixo
de 3 linhas, nada de canvas de tinta) nem as decisões do autor para o chat
solto: fechar a janela solta devolve o chat, "sempre por cima" começa
desligado, e é um chat lateral só, o mesmo, movido para a janela filha. Os
pontos de `docs/design-loop/decisoes.md` são de outros recortes e ficam como
**decisão do autor**.

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
|---|---|---|---|---|---|---|---|---|---|
| Typography | 8,5 | 8,5 | 9,0 | 9,0 | 9,0 | 8,0 | 9,0 | 8,5 |
| Hierarchy | 8,5 | 8,5 | 9,0 | 9,0 | 9,0 | 8,0 | 8,5 | 8,5 |
| Spacing & density | 8,5 | 8,5 | 9,0 | 9,0 | 9,0 | 8,0 | 9,0 | 8,5 |
| Color & contrast | 8,5 | 8,5 | 9,0 | 8,5 | 8,5 | 8,0 | 8,5 | 8,5 |
| Iconography | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Consistency & polish | 8,5 | 8,5 | 9,0 | 8,5 | 8,5 | 8,0 | 8,5 | 8,5 |
| Clarity | 8,5 | 8,5 | 9,0 | 9,0 | 9,0 | 8,0 | 8,5 | 8,5 |
| Estados (vazio/carregando/erro) | — (F) | — (F) | 9,0 | 9,0 | 9,0 | 8,5 | 8,5 | 8,5 |
| Feedback e movimento | 8,5 | 8,5 | 7,5 | 9,0 | 8,5 | 8,5 | 8,0 | 8,5 |
| Acessibilidade | 9,0 | 9,0 | 7,5 | 9,0 | 9,0 | 8,0 | 9,0 | 8,5 |
| Janela pequena | 8,5 | 8,5 | 9,0 | 9,0 | 9,0 | 8,0 | 9,0 | 8,5 |
| **Overall** | **8,5** | **8,5** | **8,0** | **8,5** | **8,5** | **8,0** | **8,5** | **8,0** |

**Overall do recorte: 8,0.** Os defeitos da rodada 2 que o usuário sentia
sumiram: o erro virou uma notícia única, vermelha e com papel de alerta; o
quiz ganhou círculo de escolha; o escopo deixou de ter órfão; o "Not sure"
encurtou; o carregando ganhou três pontos junto do cartão; o alfinete virou
ícone; o Copiar confirma no próprio botão; e o "Enviar" fica desligado com o
campo vazio. O que segura o recorte em 8,0 é o **foco da faixa "Chat em outra
janela" que não pinta no tema claro**, o **círculo do quiz a 1,54:1**, o
**campo do composer do chat preso a 126 px (5 linhas) em vez das 3 linhas da
casa**, as **ações de mensagem quebrando em duas linhas em 900×650**, a
**legenda do escopo sumindo justamente em 900×650** e os dois resquícios de
contraste no escuro ("Concluir" 4,61:1 e "Desligada" 4,52:1).

**Lastro das notas (para nenhuma nota ficar sem medida):**

- **Typography 8,5 (A1/A2), 9,0 (B/C/D/F), 8,0 (E):** corpo 15 px/24 px
  (1,6), papéis 11 px/600, título 12 px/600, menu 12 px, escopo 11 px/15,4 px,
  vazio 12 px, atividade 11 px, erro 15 px/24 px. O piso da casa é 11 px e
  nenhum dos **60 JSON** tem texto abaixo disso; nenhum texto medido fica
  abaixo de 4,5:1 (0 de 60). A1/A2 ficam em 8,5 porque o escopo não cabe:
  `solto-resposta-claro-380x800.json` mede **100,5×15,4 px** e
  `-420x1000` **140,5×15,4 px**, e as PNGs mostram "Limites.pdf p. 1…" /
  "Limites.pdf p. 1, Formu…". B chega a 9,0 porque o rótulo vertical de
  **142 px (PT) / 161,3 px (EN)** cabe nos **829/579 px** da faixa e não corta.
  C/D chegam a 9,0 porque os itens de menu de **230×28 px** comportam os três
  rótulos e "Desligada"/"Ligada" em 11 px. E fica em 8,0 porque em 900×650
  "Levar à sessão principal" mede **140,8×43,2 px** (duas linhas) e o escopo
  corta. F chega a 9,0 porque vazio (12 px/28 px), carregando (11 px) e erro
  (15 px/24 px, 4 linhas em 336×96) cabem em 380.
- **Hierarchy 8,5 (A1/A2), 9,0 (B/C/D), 8,0 (E), 8,5 (F):** cabeçalho, papel
  do falante (11 px/600), corpo (15 px), ações (11 px) e composer se leem nesta
  ordem; o cartão do quiz tem pergunta 15 px/600, opções 15 px e ações
  separadas. B chega a 9,0 porque a faixa de 33 px encosta no leitor (que
  cresce até x≈1016/476) e marca a fronteira com o tutor sem vão dominante.
  C/D chegam a 9,0 porque o menu diz o estado e o alfinete no cabeçalho marca
  "sempre por cima" sem competir com o selo do motor. E fica em 8,0 porque a
  linha de ações de 43,2 px quebra a leitura depois do cartão e a legenda do
  escopo some no 900. F fica em 8,5 porque o erro ainda leva o papel
  "OpenCode" acima do texto vermelho, embora o ícone de alerta e a cor deem a
  hierarquia de falha.
- **Spacing 8,5 (A1/A2), 9,0 (B/C/D/F), 8,0 (E):** janela solta com campo
  356×86 px (380) e 396×86 px (420), 3 linhas; escopo em 24 px; Enviar
  75,9×28; fio do composer em y≈648/848; faixa 33×829 px (1440) e 33×579 px
  (900); itens de menu 230×28 e menu 240×96; opções do quiz 473,5×35,8 px
  (1440) e 188,5×35,8 px (900). E fica em 8,0 porque o campo do chat preso
  mede **499,5×126 px** (1440) e **229,5×120 px** (900), não as 3 linhas de
  86 px do tutor e da janela solta, e a linha de ações de 43,2 px aperta o
  900. A1/A2 ficam em 8,5 porque o escopo de 100,5/140,5 px fica espremido
  entre o cadeado, a legenda e o "Atualizar contexto" de 134,2 px.
- **Color 8,5 (A1/A2/C/D/F), 9,0 (B), 8,0 (E):** todo texto medido passa AA:
  corpo 17,58:1 / 15,29:1; papéis e escopo 4,95–7,39:1; "Copiar" 6,69–6,93:1;
  placeholder 4,95–6,02:1; erro 5,74–6,36:1; aviso incerto 5,71–10,53:1;
  "Enviar" desligado 5,36–5,74:1 (isento); faixa 18,88:1 / 16,48:1. B chega a
  9,0 porque o único texto da faixa é o rótulo 12 px/600 a 18,88:1 no claro e
  16,48:1 no escuro. E fica em 8,0 porque o círculo de escolha do quiz
  (14×14 px, borda de 1,5 px) usa `--border-strong` **#d0d0d0 sobre #fff =
  1,54:1** no claro e ~**1,7:1** no escuro (16% de branco sobre `#1f1f1f`),
  abaixo dos 3:1 de componente, e "Concluir" no escuro mede **4,61:1** (no
  claro, 7,42:1). C/D ficam em 8,5 porque "Desligada" no escuro é `--faint`
  #979797 sobre `#303030` = **4,52:1** (passa, mas é o texto mais fraco do
  menu). F fica em 8,5 porque o erro 5,74:1 e o vazio 4,95:1 passam com pouca
  margem.
- **Iconography 9,0 (todas):** ícones de 16 px em alvos de 28×28; copiar com
  glifo de 12 px; cadeado e atualizar de 12 px em 24×24; chevron de 16 px na
  faixa; alfinete de 14 px no cabeçalho e no menu; `list`, `undo` e `external`
  nos menus; ícone de alerta de 14 px no erro; três pontos de 5 px no
  carregando; ✓ de 15 px/700 no cartão respondido. O conjunto está na mesma
  família e não desalinha em nenhum estado capturado.
- **Consistency 8,5 (A1/A2/C/D/F), 9,0 (B), 8,0 (E):** claro e escuro têm as
  mesmas formas; o menu é o mesmo `.chat-pop` do tutor; o chat preso e a
  janela solta usam o mesmo cabeçalho, papéis e ações. B chega a 9,0 porque a
  faixa repete a forma do leitor recolhido (ícone + rótulo vertical). C/D
  ficam em 8,5 pelo "Desligada" fraco no escuro. E fica em 8,0 porque o mesmo
  chat tem campo de 126/120 px na Mesa e 86 px na janela filha, e as ações
  quebram em 900. F fica em 8,5 porque o erro veste o papel "OpenCode" e o
  estado vazio usa uma frase de layout docked ("ao lado").
- **Clarity 8,5 (A1/A2/F), 9,0 (B/C/D), 8,0 (E):** "Atualizar contexto",
  "Levar à sessão principal" (com `title`), "Só neste chat", "Trazer de
  volta", "Soltar em outra janela" e "Sempre por cima" têm nome e dica; o menu
  diz o estado. B/C/D chegam a 9,0 porque a faixa e os menus dizem exatamente o
  que fazem. E fica em 8,0 pela legenda "Só neste chat" sumir em 900×650 e
  pelo "Levar à sessão principal" quebrar em duas linhas. F fica em 8,5 pela
  frase "Pergunte ao lado…" na janela solta (não há "lado" ali) e pelo erro
  ainda se chamar "OpenCode".
- **Estados 9,0 (B/C/D), 8,5 (E/F):** B é um estado bem comunicado (a faixa diz
  onde o chat está); C mostra "Soltar"/"Trazer de volta" e "Desligada"/"Ligada"
  na hora; D mostra o alfinete no cabeçalho e o `aria-checked`. E mostra o
  cartão respondido (círculo cheio, ✓, "✓ Correta.", "Concluir") e o incerto
  com um aviso só e o Enviar desligado. F tem vazio, carregando e erro
  capturados, com o erro único, vermelho, `role=alert` e ícone de alerta; o que
  falta é o "Tentar de novo". Nenhum estado do inventário ficou sem captura
  além do `unavailable` e do hover de ações (ver SEM CAPTURA).
- **Feedback 8,5 (A1/A2/D/E), 9,0 (C), 7,5 (B), 8,0 (F):** os anéis de foco de
  2 px aparecem em todos os controles da filha (close, copiar, levar, cadeado,
  refresh, campo, enviar, novo, mais) e no item de menu; o menu atualiza o
  estado sem fechar e o Esc devolve o foco; o Copiar confirma no próprio botão
  por 1,5 s; o incerto responde com o aviso. B fica em 7,5 porque o foco da
  faixa não aparece no claro e só sangra 1 px no escuro (achado 1). F fica em
  8,0 porque o erro não oferece "Tentar de novo" (achado 6).
- **Acessibilidade 9,0 (A1/A2/C/D/F), 7,5 (B), 8,0 (E):** alvos ≥24 px em tudo
  (cabeçalho 28×28, Copiar 67,7×25,6, Levar 148,6×25,6, cadeado 24×24,
  refresh 134,2×24/24×24, campo 356×86/396×86/229,5×120, Enviar 75,9×28,
  Parar 49,3×28, menu 230×28, faixa 33×829/579); foco de 2 px na filha e no
  item de menu; nomes "Copiar sua pergunta"/"Copiar resposta"; cartões com
  `aria-labelledby` ("Você"/"OpenCode"); escopo com `title`; quiz com
  `radiogroup` e `role=radio`; `aria-live` na lista; erro com `role=alert`;
  carregando com `aria-busy`. O cadeado é um `role=img` com `tabindex=0`, um
  stop a mais na ordem de Tab, mas expõe "Fora da sessão principal" a quem não
  usa mouse — fica como troca, não como achado. B fica em 7,5 pelo foco da
  faixa (achado 1); E fica em 8,0 pelo círculo do quiz a 1,54:1 (achado 2).
  F fica em 9,0 porque o erro é anunciado uma vez e as ações de resposta não
  aparecem na falha.
- **Janela pequena 8,5 (A1/A2), 9,0 (B/C/D/F), 8,0 (E):** em 380/420 não há
  rolagem horizontal (`scrollWidth` = 380/420; `scrollHeight` = 800/1000); em
  900×650 a faixa tem 33×579, o menu de 240 px cabe, o refresh vira ícone de
  24×24 e o campo do chat preso tem 229,5×120. A1/A2 ficam em 8,5 pelo escopo
  cortado. E fica em 8,0 porque em 900×650 a coluna de **260 px** esconde a
  legenda do escopo e quebra as ações em duas linhas. F chega a 9,0 porque os
  três estados cabem em 380.
- **Overall 8,0:** a base visual é boa (tipografia/hierarquia/espaçamento em
  volta de 8,5–9,0), mas há um defeito de acessibilidade que o usuário de
  teclado sente (foco da faixa) e um de contraste de componente (círculo do
  quiz), além do composer de 5 linhas no preso e das ações quebradas em 900.
  B e E ficam em 8,0; A1/A2, C/D e F em 8,5; o recorte em 8,0.

## 2. Achados

### 1. Foco da faixa "Chat em outra janela" não pinta no claro e só sangra 1 px no escuro — Acessibilidade / Feedback · média

- **Tela:** `teclado-faixa-claro-1440x900`, `teclado-faixa-escuro-1440x900`;
  comparação com `mesa-faixa-claro-1440x900` / `mesa-faixa-escuro-1440x900`.
- **Evidência medida:** o PNG claro do teclado é **byte-idêntico** ao da faixa
  sem foco (md5 `fd2892d2f8c49f26ba3c7f71df36948b` nos dois) e não há **nenhum
  pixel azul** em x=1000–1070; o JSON diz `focusVisible:true` e
  `outline: 2px solid rgb(37, 72, 199)` no alvo de **33×829 px**. No escuro há
  **uma única coluna** azul em x=1014 (`rgb(161, 182, 255)`), com x=1015 já em
  `rgb(62, 62, 62)`; o anel de 2 px é coberto dos dois lados porque
  `.pdf-panel` (`readers.css:28-31`) e `#sidebar` (`readers.css:122`) têm
  `position:relative` e o `outline-offset:1px` global (`style.css:197`) cai
  fora da faixa de 33 px, atrás dos vizinhos posicionados. No escuro o fio
  translúcido do painel deixa 1 px vazar; no claro, o fio opaco o esconde.
- **Sugestão:** desenhar o anel **por dentro** (`outline-offset:-2px` ou
  `box-shadow: inset 0 0 0 2px var(--ring)`) ou dar a `#support-slot`
  `position:relative;z-index:6` para o anel ficar acima do leitor e do tutor.
- **Arquivo provável:** `desk/src/readers.css:109-115` (`#support-restore`),
  `desk/style.css:197` (regra global de `:focus-visible`),
  `desk/src/support-sidechat.css:8` (`#support-slot`).

### 2. Círculo de escolha do quiz a 1,54:1 no claro e ~1,7:1 no escuro — Acessibilidade / Color & contrast · média

- **Tela:** `preso-cartao-claro-1440x900`, `preso-cartao-claro-900x650`,
  `preso-cartao-escuro-900x650`; `en-preso-cartao-light-900x650`.
- **Evidência medida:** o novo `::before` de escolha tem **14×14 px** com borda
  de **1,5 px** `--border-strong` (`tutor-chat.css:304`). No claro,
  `--border-strong` é `#d0d0d0` (`style.css:23`) sobre `--surface` `#fff` =
  **1,54:1**; no escuro, 16% de branco sobre `#1f1f1f` ≈ **1,7:1**. A borda da
  própria opção usa a mesma cor (o mesmo 1,54:1). O estado escolhido preenche o
  círculo com `--accent-text` (7,42:1 no claro / 7,71:1 no escuro) e aí está
  correto; o que falha é o círculo **em repouso**, que é a affordance de
  escolha. A opção mede **473,5×35,8 px** (1440) e **188,5×35,8 px** (900).
- **Sugestão:** usar `--muted` (4,95:1) ou um tom de `--border-strong` que
  chegue a 3:1 no círculo e na borda da opção, mantendo o miolo preenchido no
  estado escolhido.
- **Arquivo provável:** `desk/src/tutor-chat.css:303-309`; token
  `desk/style.css:23`.

### 3. Escopo do chat: legenda "Só neste chat" some em 900×650 e o texto corta em 380/420 — Clarity / Janela pequena · baixa

- **Tela:** `preso-cartao-claro-900x650` e `mesa-trazido-de-volta-claro-900x650`
  contra `solto-resposta-claro-380x800`, `solto-resposta-claro-420x1000` e
  `solto-resposta-claro-1440x900`.
- **Evidência medida:** no 900×650 o texto "Só neste chat" **não está** no
  `texts` do JSON (e não aparece na PNG), porque o container do composer tem
  **229,5 px** e `@container sidechat-composer (max-width:300px)` esconde a
  legenda (`composer.css:91-95`); em 380 (composer 356 px) e 420 (396 px) ela
  aparece. O texto do escopo mede **165,5×15,4 px** no 900, **100,5×15,4 px**
  no 380 e **140,5×15,4 px** no 420; a PNG de 380 mostra "Limites.pdf p. 1…",
  a de 420 "Limites.pdf p. 1, Formu…" e a de 900 "Limites.pdf p. 1,
  Formulario…". A inversão é visível: no 900 o "Atualizar contexto" vira ícone
  de 24×24 e sobra mais texto; no 380 ele mantém o rótulo de **134,2 px** e o
  escopo fica com 100,5 px. O `title` e o nome acessível guardam o texto
  completo.
- **Sugestão:** definir prioridade de corte (esconder o rótulo do "Atualizar
  contexto" primeiro e manter a legenda do escopo, ou dar ao escopo uma linha
  extra só na janela solta) e não deixar a legenda sumir exatamente na coluna
  mínima.
- **Arquivo provável:** `desk/src/composer.css:74-95`; `desk/src/sidechat.mjs:724-770`
  (`scopeLabels`/`paintScope`).

### 4. Campo do composer do chat preso com 126/120 px, não as 3 linhas (86 px) da casa — Spacing & density / Consistency · baixa

- **Tela:** `preso-cartao-claro-1440x900`, `preso-cartao-claro-900x650`,
  `mesa-trazido-de-volta-claro-1440x900` contra `solto-resposta-claro-380x800`
  e `-420x1000`.
- **Evidência medida:** o campo do chat preso mede **499,5×126 px** (1440) e
  **229,5×120 px** (900); o da janela solta mede **356×86 px** (380) e
  **396×86 px** (420). A regra de 3 linhas de `composer.css:147-162` só vale
  para `body>#sidechat` (a filha); na Mesa o `#sidechat-box>#sidechat-prompt`
  fica `flex:1 1 auto` (`support-sidechat.css:87`) e cresce até a altura do
  composer do tutor, resultando em ~5 linhas. O mesmo chat tem dois composers
  de alturas diferentes.
- **Sugestão:** aplicar `field-sizing:fixed;height:calc(3lh + 14px)` também ao
  `#sidechat-prompt` preso, deixando o respiro restante fora do campo (ou
  alinhar o composer do lateral ao campo de 3 linhas do tutor).
- **Arquivo provável:** `desk/src/composer.css:147-162`;
  `desk/src/support-sidechat.css:85-87`.

### 5. Ações de mensagem quebram em duas linhas no chat preso a 900×650 e esticam o "Copiar" para 43,2 px — Spacing / Consistency · baixa

- **Tela:** `preso-cartao-claro-900x650`, `preso-incerto-claro-900x650`,
  `en-preso-cartao-light-900x650`.
- **Evidência medida:** "Copiar resposta" mede **67,7×43,2 px** e "Levar à
  sessão principal" **140,8×43,2 px** no 900×650, contra **67,7×25,6** e
  **148,6×25,6** no 1440; no inglês, "Copy" **59,9×43,2 px** e "Bring to the
  main session" **148,6×43,2 px**. As PNGs mostram "Levar à sessão / principal"
  em duas linhas e o "Copiar" de uma linha esticado, com o texto no topo. O
  `white-space:nowrap` do conserto da rodada 2 foi só em `.quiz-actions button`
  (`tutor-chat.css:321`), não nas `.sidechat-msg-actions`.
- **Sugestão:** `white-space:nowrap` nas ações de mensagem e um rótulo curto
  ("Levar à sessão") ou ícone-só abaixo de 300 px; se a quebra for intencional,
  alinhar a linha pelo topo.
- **Arquivo provável:** `desk/src/support-sidechat.css:60-64`.

### 6. Erro do motor ainda veste "OpenCode" e não oferece "Tentar de novo" — Clarity / Feedback · baixa

- **Tela:** `solto-erro-claro-380x800`, `solto-erro-escuro-380x800`.
- **Evidência medida:** a captura mostra **uma** notícia vermelha com ícone de
  alerta (o achado 1 da rodada 2 está resolvido), `role=alert` no card e
  **5,74:1 no claro / 6,36:1 no escuro**; mas o papel acima do texto continua
  "OpenCode" (o `aria-labelledby` aponta para a voz do motor) e a única ação é
  "Copiar". O texto diz "envie de novo", o campo está vazio e o
  `#sidechat-send` está **desligado**, então o usuário precisa redigitar; não
  há "Tentar de novo".
- **Sugestão:** usar `sidechat.role.system` ("Aviso") no card de falha e
  oferecer "Tentar de novo" (reenviar a última pergunta ou restaurar o
  rascunho), mantendo o Copiar como secundário.
- **Arquivo provável:** `desk/src/sidechat.mjs:571-667`
  (`noteText`/`finishTurn`), `desk/src/sidechat-message-view.mjs:48-61`;
  `desk/src/locales/pt-BR.json` e `en.json` (`sidechat.role.system`).

### 7. Estado vazio da janela solta diz "Pergunte ao lado…" — Clarity (texto) · baixa

- **Tela:** `solto-vazio-claro-380x800`, `solto-vazio-escuro-380x800` (e
  `solto-vazio-*` em inglês).
- **Evidência medida:** a frase é "Pergunte ao lado, sem mexer na sessão
  principal." (12 px, 4,95:1 no claro / 6,02:1 no escuro, 259,6×28 px), dentro
  de uma janela própria de 380×800 que não tem "lado" visível; o inglês repete
  "Ask on the side...". A frase é a mesma do chat preso (`sidechat.mjs:803`).
- **Sugestão:** usar um texto neutro de host ("Pergunte sem mexer na sessão
  principal." / "Ask without touching the main session.") ou uma variante para
  a janela solta.
- **Arquivo provável:** `desk/src/locales/pt-BR.json:2396`,
  `desk/src/locales/en.json:2396`; `desk/src/sidechat.mjs:803`.

### 8. "Desligada" no menu escuro a 4,52:1 — Color & contrast · baixa

- **Tela:** `solto-menu-trazer-escuro-380x800` (e as variantes escuras dos
  menus).
- **Evidência medida:** o estado é um `::after` e não entra no array `texts`;
  no CSS, `--faint` `#979797` sobre o fundo do menu `#303030` = **4,52:1** no
  escuro (no claro, `#707070` sobre `#fff` = 4,95:1,
  `tutor-chat.css:62-67` e `style.css:21`). Passa no AA, mas é o texto mais
  fraco do menu; "Ligada" usa `--accent-text` (7,71:1) e fica bem mais forte.
- **Sugestão:** subir o estado para `--muted` (ou usar `--fg` em
  "Ligada"/"Desligada"), mantendo o mesmo peso dos outros itens.
- **Arquivo provável:** `desk/src/tutor-chat.css:65`; `desk/style.css:21`.

### 9. "Concluir" no escuro a 4,61:1 — Color & contrast · baixa

- **Tela:** `preso-cartao-respondido-escuro-1440x900`,
  `preso-cartao-respondido-escuro-900x650`; `preso-copiado-escuro-1440x900`.
- **Evidência medida:** branco `rgb(255,255,255)` sobre `rgb(80,108,223)` =
  **4,61:1** no escuro; no claro é branco sobre `rgb(37,72,199)` = **7,42:1**.
  Passa no AA, mas com pouca margem e com uma diferença grande entre os temas
  para a mesma ação primária.
- **Sugestão:** escurecer o `--accent-fill` no escuro ou usar `--fg` sobre o
  accent, mirando ≥5:1 para a ação primária.
- **Arquivo provável:** `desk/style.css:39` (`--accent-fill`/`--accent-fg`);
  `desk/src/composer.css:242` (`.primary`).

## 3. SEM CAPTURA

Estados do inventário sem PNG (a nota da categoria naquele estado **não** é
dada):

- **Estado `unavailable`** (ponte `window.desk.sidechat*` ausente, texto em
  `renderUnavailable`): **SEM CAPTURA**. O inventário explica que exigiria um
  host sem a ponte do lateral; fica fora do recorte e não entra na nota.
- **Hover das ações de mensagem** ("Copiar"/"Levar à sessão principal"):
  **SEM CAPTURA**. O hover do "Copiar" aparece em
  `preso-copiado-claro/escuro-1440x900` e o repouso está nos JSON; o hover do
  "Levar" não foi congelado. A nota de Feedback usa o repouso e o
  `:focus-within`.

Lacunas reais encontradas além das duas do inventário:

- **Enviar habilitado (campo com rascunho) e sua parada de Tab:** **SEM
  CAPTURA**. O inventário lista `teclado-solto-08-sidechat-send`, mas o 08 real
  é `teclado-solto-08-sidechat-new`; o `#sidechat-send` está `disabled` em
  todas as capturas (vazio, erro, incerto, carregando e mesmo com a conversa
  pronta) e o `teclado-solto-resumo.json` tem 9 controles únicos, sem o Enviar. O
  visual do botão **habilitado** não foi provado; a nota de Estados/Feedback
  vale só para o Enviar desligado.
- **`teclado-solto-10-sidechat-more`:** **SEM CAPTURA** como arquivo; o
  estado "Mais opções" está coberto por `teclado-solto-09-sidechat-more`. É
  uma inconsistência de numeração do inventário, não um estado ausente.
- **Trazido de volta escuro em 900×650:** **SEM CAPTURA** (o inventário marca
  "—"); só há 1440 escuro.
- **Inglês em 1440×900:** **SEM CAPTURA**; o inventário só tem as variantes
  inglesas de 900×650 (e a solta de 380×800). O rótulo da faixa em inglês mede
  161,3 px e cabe nos 829 px, mas isso não foi congelado em 1440.
- **Roteiro de teclado em 420×1000, em inglês e no escuro (controles
  principais):** **SEM CAPTURA**; o roteiro completo é 380×800, claro, e o
  menu tem as duas variantes de tema.
- **Movimento/transição** de soltar, trazer de volta, abrir o menu, o toast e o
  flash do "Copiado": **SEM CAPTURA** (PNGs estáticos); a nota de Feedback usa
  o que está congelado (foco, estado do menu, "Copiado" inline), não a
  animação. O `prefers-reduced-motion` dos três pontos existe no CSS
  (`support-sidechat.css:78`), mas não foi capturado.
- **Leitor de tela em execução:** **SEM CAPTURA**; os nomes/roles vêm do DOM
  (`labels` do JSON), não de uma sessão de leitor de tela.
- **"Sempre por cima" no nível do sistema operacional:** o JSON registra
  `alwaysOnTop:true` e o alfinete, mas não há captura da janela sobre outra
  janela; a prova é o estado do host, não a sobreposição real.
- **Hover das opções do quiz e dos itens do menu:** **SEM CAPTURA**; a nota usa
  o repouso e o CSS (`tutor-chat.css:305`, `:54`).

## 4. Imagens

**Vi as imagens.** Abri **32 dos 60 PNGs** com a ferramenta de leitura:
`solto-resposta-claro-380x800`, `solto-resposta-escuro-380x800`,
`solto-resposta-claro-420x1000`, `solto-vazio-claro-380x800`,
`solto-carregando-claro-380x800`, `solto-erro-claro-380x800`,
`solto-erro-escuro-380x800`, `solto-menu-trazer-claro-380x800`,
`solto-menu-trazer-escuro-380x800`, `solto-menu-por-cima-claro-380x800`,
`solto-por-cima-sinal-claro-380x800`, `solto-por-cima-sinal-escuro-380x800`,
`mesa-faixa-claro-1440x900`, `mesa-faixa-claro-900x650`,
`mesa-faixa-escuro-1440x900`, `teclado-faixa-claro-1440x900`,
`preso-cartao-claro-1440x900`, `preso-cartao-claro-900x650`,
`preso-cartao-escuro-900x650`, `preso-cartao-respondido-claro-1440x900`,
`preso-cartao-respondido-escuro-1440x900`, `preso-copiado-claro-1440x900`,
`preso-incerto-claro-900x650`, `preso-incerto-escuro-900x650`,
`mesa-trazido-de-volta-claro-1440x900`, `mesa-trazido-de-volta-claro-900x650`,
`mesa-menu-soltar-claro-1440x900`, `en-preso-cartao-light-900x650`,
`en-solto-resposta-light-380x800`, `en-solto-incerto-light-380x800`,
`en-solto-menu-trazer-light-380x800` e `teclado-solto-menu-item-claro-380x800`.
Nos **28 PNGs restantes** avaliei pelos JSON homônimos e pelo CSS/código; não
inventei o que não vi. Na faixa escura (`teclado-faixa-escuro-1440x900`)
confirmei por análise de pixel a coluna azul de 1 px em x=1014 e, no claro,
que o PNG é byte-idêntico ao sem foco. De todos os 60 JSON de medidas li os
campos de texto, contraste, alvos, foco, rótulos e tamanho de janela; li os 3
resumos de teclado e o `falhas.json` (vazio).

## 5. Achados da rodada 2

Os 9 achados de `docs/design-loop/nota-rodada-2-chat-solto.md` e os 2 de
`docs/design-loop/nota-rodada-2-montagem.md`, reconferidos contra as capturas
novas (a nota acima é independente; não reusei as notas anteriores):

| # | Achado da rodada 2 | Status | Prova na rodada 3 |
|---:|---|---|---|
| 1 | Erro do motor duplicado e apresentado como resposta normal | **RESOLVIDO** | `solto-erro-claro-380x800` / `-escuro`: **uma** notícia, vermelha (5,74:1 / 6,36:1), com ícone de alerta, `role=alert` no card e **sem "Levar à sessão principal"** (só "Copiar"); `sidechat.mjs:571-667` (`failureNoted`). O resíduo (papel "OpenCode" e falta de "Tentar de novo") virou o achado 6 desta rodada. |
| 2 | Opções do quiz lidas como campos desabilitados | **RESOLVIDO** | `preso-cartao-claro-1440x900` e `-900x650`: cada opção agora tem o **círculo de escolha** de 14 px à esquerda (`tutor-chat.css:304`); a respondida mostra círculo cheio + ✓. O contraste de 1,54:1 desse círculo é o achado 2 desta rodada. |
| 3 | Escopo quebra com órfão em 380 e no inglês | **RESOLVIDO** | `solto-resposta-claro-380x800`, `-420x1000` e `en-solto-incerto-light-380x800`: o escopo fica **numa linha só com reticências** (100,5/140,5 px) e o `title` guarda o texto inteiro; o órfão "p. 1"/"1" sumiu. O corte que restou é o achado 3 desta rodada. |
| 4 | Inglês "I don't know" quebra e estica os botões do quiz | **RESOLVIDO** | `en-preso-cartao-light-900x650`: "Not sure" mede **63,4×24 px** (alvo 85,4×38) e "Dismiss" **58×24 px** (alvo 80×38), uma linha; a linha de ações caiu de 62 px para 38 px. O "Bring to the main session" em duas linhas é o achado 5 desta rodada. |
| 5 | "Concluir" no escuro a 4,61:1 | **ABERTO** | `preso-cartao-respondido-escuro-1440x900` e `-900x650`: branco sobre `rgb(80,108,223)` = **4,61:1** (claro 7,42:1). É o achado 9 desta rodada. |
| 6 | Carregando sem indicador junto do cartão pendente | **RESOLVIDO** | `solto-carregando-claro-380x800` / `-escuro`: **três pontos de 5 px** sob o papel "OpenCode" (y≈200), no lugar do corpo vazio; `sidechat-thinking` (`support-sidechat.css:73-78`) e `aria-busy=true` no card. A linha de atividade de 11 px continua no pé, mas o indicador agora está junto do cartão. |
| 7 | Alfinete de "sempre por cima" parece botão e não é | **RESOLVIDO** | `solto-por-cima-sinal-claro-380x800` / `-escuro`: o `#sidechat-pin` virou **ícone de 14 px sem chip** (`.sidechat-pin`, `support-sidechat.css:37-39`), com nome "Sempre por cima ligado"; o menu mostra "Ligada". Não reusa mais a forma do selo do motor. |
| 8 | Toast de "copiado" longe do botão que o disparou | **RESOLVIDO** | `preso-copiado-claro-1440x900` / `-escuro`: o botão "Copiar resposta" vira **"✓ Copiado" inline** (76,9×25,6 px) sob o cursor, com o `aria-label` acompanhando por 1,5 s (`flashMark`/`copiedMark`, `sidechat-message-view.mjs:92-108`). |
| 9 | "Desligada" no menu escuro a 4,52:1 | **ABERTO** | `solto-menu-trazer-escuro-380x800`: o estado continua em `--faint` `#979797` sobre `#303030` = **4,52:1** (`tutor-chat.css:65`). É o achado 8 desta rodada. |
| M1 | Escopo visível só em `title`/`aria-label` (montagem 420×650) | **RESOLVIDO** | `solto-resposta-claro-420x1000` mostra "Só neste chat" e `en-solto-resposta-light-380x800` mostra "Side chat only" (75,3 px, 6,69:1 / 7,39:1); `composer.css:77-80`. Ressalva: a legenda some em 900×650 pelo container de 229,5 px — achado 3 desta rodada. |
| M2 | "Enviar" habilitado com o campo vazio, clique sem retorno | **RESOLVIDO** | `solto-vazio-claro-380x800`, `mesa-trazido-de-volta-claro-1440x900`, `preso-cartao-claro-1440x900` e as variantes `en-*`: `#sidechat-send` está **`disabled:true`** com o campo vazio; o `teclado-solto-resumo.json` não inclui o Enviar na rota (9 controles), e o botão só volta a ficar habilitado quando há rascunho. O visual habilitado não foi capturado (ver SEM CAPTURA). |

**Resumo:** 9 resolvidos (7 de chat-solto + 2 de montagem), 2 abertos
("Concluir" no escuro e "Desligada" no escuro), com 7 achados novos de rodada
3 (foco da faixa, contraste do círculo do quiz, escopo/legenda em 900,
composer de 5 linhas, ações quebradas em 900, erro ainda "OpenCode" sem
retry e o texto "ao lado" na janela solta).
