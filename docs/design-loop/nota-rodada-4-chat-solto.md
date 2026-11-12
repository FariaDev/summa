# Nota da rodada 4 — chat solto (#157)

Avaliação do recorte "Chat solto": janela solta (380×800 e 420×1000), faixa
"Chat em outra janela", soltar/trazer de volta, "sempre por cima", chat preso
na Mesa com resposta/cartões/envio incerto/janela pequena e os estados
vazio/carregando/erro. Base: as capturas novas de
`docs/design-loop/rodada-4/antes/chat-solto/` (PNG + JSON homônimo), o
inventário `docs/design-loop/inventario-chat-solto.md`, o CSS e o código em
`desk/src`. Não implementei nem corrigi nada; a nota é independente da rodada
3 e os status da seção 5 são uma reconferência, não uma reutilização das notas
anteriores.

**Nota sobre a pasta.** A pasta tem **60 PNG + 60 JSON de medidas + 3 resumos
de teclado + `falhas.json` = 124 arquivos**, não os 126 que o inventário
declara: o `teclado-solto-10-sidechat-more` que o inventário lista **não
existe**; o roteiro real termina no **09 `sidechat-more`** e o **08 é o
`sidechat-new`** (o Enviar desligado com o campo vazio não entra na ordem de
Tab; o `teclado-solto-resumo.json` traz 9 controles únicos). `falhas.json` está
vazio (`failures: []`). As observações 1–5 do inventário descrevem rodadas
anteriores e não devem ser lidas como estado atual: a 2 (ações a 3,92:1) está
corrigida nos JSON (Copiar 6,69:1 no claro / 6,93:1 no escuro), a 3 está
corrigida na janela solta (campo com anel de 2 px) e a 5 está corrigida (o erro
agora é "Aviso" com ícone de alerta). A observação 1 **não se reproduz** nas
capturas de 1440×900 e 900×650: a faixa mede 33 px em x=1016–1048 e o tutor
começa em x=1049; não há os ~490 px vazios descritos. A observação 4 foi
parcialmente resolvida (o `title`/nome acessível guardam o escopo, mas o corte
visual continua; ver achado 2).

As capturas "antes" desta rodada já incluem os consertos do commit `601533ca`
(foco da faixa, círculo do quiz, composer de 3 linhas, rótulo curto do
"Levar", erro com "Aviso"/retry, texto do vazio) e o ajuste de contraste do
`caeda681` (`--faint` escuro #a0a0a0 e `--acc-blue` escuro #4663dd). A nota
avalia o que está congelado agora, não o histórico.

## 1. Notas

Sub-partes: **A1** janela solta 380×800; **A2** janela solta 420×1000; **B**
faixa "Chat em outra janela" (1440×900 e 900×650, claro/escuro, inglês);
**C** soltar/trazer (menus "Soltar em outra janela" e "Trazer de volta" e a
Mesa restaurada); **D** "sempre por cima" (menu ligado + sinal do alfinete);
**E** chat preso na Mesa (resposta/cartões, cartão respondido, copiado, envio
incerto e 900×650); **F** vazio, carregando e erro na janela solta. A coluna
"Geral" é a leitura do recorte; a última linha é o Overall de cada sub-parte.
"—" em A1/A2 na linha Estados significa que os estados vazio/carregando/erro
são avaliados na coluna F; A1/A2 avaliam a resposta, o teclado e a janela.

A nota de uma categoria num estado **sem captura** não é dada (ver seção 3).
As colunas usam só os estados com PNG/JSON; onde a coluna cobre mais de um
tamanho, o valor entre parênteses separa 1440 de 900 ou 380 de 420.

| Categoria | A1 · solta 380 | A2 · solta 420 | B · faixa | C · soltar/trazer | D · por cima | E · preso (1440/900) | F · vazio/carregando/erro | Geral |
|---|---|---|---|---|---|---|---|---|
| Typography | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Hierarchy | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | 8,5 |
| Spacing & density | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Color & contrast | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | 8,5 |
| Iconography | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Consistency & polish | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Clarity | 8,5 | 8,5 | 9,0 | 9,0 | 9,0 | 8,5 | 8,5 | 8,5 |
| Estados (vazio/carregando/erro) | — (F) | — (F) | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Feedback e movimento | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 8,5 | 8,5 |
| Acessibilidade | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | 8,5 |
| Janela pequena | 8,5 | 8,5 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | 8,5 |
| **Overall** | **8,5** | **8,5** | **9,0** | **9,0** | **9,0** | **8,5** | **8,5** | **8,5** |

**Overall do recorte: 8,5.** Os defeitos que o usuário sentia na rodada 3
sumiram: o foco da faixa agora pinta 2 px por dentro nos dois temas (medido no
pixel), o círculo do quiz passou de 1,54:1 para 6,69:1/6,93:1, o composer do
chat preso voltou às 3 linhas (86 px) em 1440 e 900, as ações não quebram mais
em 900, a legenda "Só neste chat" aparece no 900, o erro virou "Aviso" com
"Tentar de novo" e o escopo tem texto neutro ("Pergunte sem mexer na sessão
principal."). O que segura em 8,5 são três defeitos baixos, nenhum bloqueante:
a **borda da opção do quiz a 1,54:1/1,67:1** (o círculo já resolve a escolha),
o **escopo reduzido a 84,2 px em 900×650** ("Limites.pdf p…") porque a legenda
ocupa a linha, e o **"Tentar de novo" que repõe a pergunta no campo em vez de
reenviar** (dois cliques). Nada disso chega a "problema que o usuário sente"
como bloqueio; por isso 8,5 e não 8,0.

**Lastro das notas (para nenhuma nota ficar sem medida):**

- **Typography 9,0 (todas):** corpo 15 px/24 px (1,6), papéis 11 px/600,
  título 12 px/600, menu 12 px, escopo 11 px/15,4 px, vazio 12 px,
  atividade 11 px, erro 15 px/24 px, ações 11 px. O piso é 11 px e os **60
  JSON** não têm texto abaixo disso; nenhum texto medido fica abaixo de 4,5:1
  (0 de 60). Em 380/420 o escopo corta com reticências, mas a tipografia não
  quebra; em 900 o corpo de 214,5 px vira 3 linhas de 24 px sem clipping
  (`preso-cartao-claro-900x650.json`). O inglês mantém as mesmas medidas
  (`en-preso-cartao-light-900x650.json`). Não há achado de tipografia.
- **Hierarchy 9,0 (A1/A2/B/C/D), 8,5 (E):** cabeçalho, papel do falante
  (11 px/600), corpo (15 px), ações (11 px) e composer se leem nesta ordem; o
  cartão do quiz tem pergunta 15 px/600, opções 15 px e ações separadas. B
  chega a 9,0 porque a faixa de 33 px encosta no leitor e marca a fronteira
  sem vão dominante (x=1016–1048 contra o tutor em 1049). C/D chegam a 9,0
  porque o menu diz o estado e o alfinete no cabeçalho marca "sempre por cima"
  sem competir com o selo do motor. E fica em 8,5 porque em 900×650 o
  cabeçalho perde o selo do motor (só "Chat lateral", contra "Chat lateral
  OpenCode" no 1440) e a linha de contexto distribui quatro elementos (escopo
  cortado, cadeado, "Só neste chat" e o ícone de atualizar) nos 229,5 px do
  composer.
  F fica em 9,0 porque "Aviso" + ícone + texto vermelho + ações separa a falha
  da resposta sem ambiguidade, e o vazio e o carregando têm hierarquia própria.
- **Spacing & density 9,0 (todas):** janela solta com campo 356×86 px (380) e
  396×86 px (420), 3 linhas; escopo em 24 px; Enviar 75,9×28; fio do composer
  em y≈648/848; faixa 33×829 px (1440) e 33×579 px (900); itens de menu
  230×28 e menu 240×96; opções do quiz 473,5×35,8 px (1440) e 188,5×35,8 px
  (900); chat preso com campo 499,5×86 px (1440) e 229,5×86 px (900). O respiro
  que sobra no composer preso fica fora do campo, que é a intenção do conserto;
  não há overflow horizontal (`scrollWidth` = 380/420/900/1440). A linha de
  contexto do 900 é apertada, mas isso está medido em Clarity/Janela pequena,
  não em spacing.
- **Color & contrast 9,0 (A1/A2/B/C/D/F), 8,5 (E):** todo texto medido passa
  AA: corpo 17,58:1 / 15,29:1; papéis e escopo 4,95–7,39:1; "Copiar"
  6,69–6,93:1; placeholder 4,95:1 no claro / 6,72:1 no escuro; vazio
  4,95:1 / 6,72:1; aviso incerto 5,71:1 / 10,53:1; erro 5,74:1 / 6,36:1;
  "Enviar" desligado 5,36:1 / 5,74:1 (isento); "Desligada" 5,05:1 (pixel
  (160,160,160) sobre #303030; o commit `caeda681` subiu o `--faint` escuro);
  "Concluir" 5,14:1 (fill #4663dd, pixel (70,99,221)); faixa 18,88:1 / 16,48:1;
  menu 17,58:1 / 11,48:1; círculo do quiz 6,69:1 / 6,93:1. E fica em 8,5 pela
  **borda da opção** (achado 1): o pixel da borda é #d0d0d0 (208,208,208) sobre
  #fff = 1,54:1 no claro e (67,67,67) sobre #1f1f1f = 1,67:1 no escuro.
  Nenhum texto abaixo de AA; o defeito é de componente.
- **Iconography 9,0 (todas):** ícones de 16 px em alvos de 28×28; copiar com
  glifo de 12 px; cadeado e atualizar de 12 px em 24×24; chevron de 16 px na
  faixa; alfinete de 14 px no cabeçalho e no menu; `list`, `undo` e `external`
  nos menus; alerta de 14 px no erro; três pontos de 5 px no carregando; ✓ de
  15 px/700 no cartão respondido. O conjunto está na mesma família e não
  desalinha em nenhum estado capturado.
- **Consistency & polish 9,0 (todas):** claro e escuro têm as mesmas formas; o
  menu é o mesmo `.chat-pop` do tutor; o chat preso e a janela solta usam o
  mesmo cabeçalho, papéis e ações; o campo é 86 px nos quatro tamanhos; o
  rótulo curto "Levar à sessão" (97,6 px) só aparece abaixo de 300 px e mantém
  `aria-label`/`title` completos; o inglês usa "To main session" (102,8 px).
  O rótulo muda de forma, mas o nome acessível não; não conto como defeito.
  O único resquício de forma é a borda da opção (achado 1), avaliado em Color.
- **Clarity 8,5 (A1/A2/E/F), 9,0 (B/C/D):** "Atualizar contexto", "Levar à
  sessão principal" (com `title`), "Só neste chat", "Trazer de volta", "Soltar
  em outra janela" e "Sempre por cima" têm nome e dica; o menu diz o estado; o
  vazio agora diz "Pergunte sem mexer na sessão principal." A1/A2/E ficam em
  8,5 pelo escopo cortado (achado 2): no 900 o texto visível é "Limites.pdf
  p…", no 380 "Limites.pdf p. 1…" e no 420 "Limites.pdf p. 1, Formu…"; o
  `title` e o nome acessível guardam "Limites.pdf p. 1, Formulario.pdf p. 1".
  F fica em 8,5 porque "Tentar de novo" promete um retry e o código só devolve
  a pergunta ao campo (achado 3), exigindo um segundo clique em Enviar.
- **Estados 9,0 (B/C/D/E/F):** B é um estado bem comunicado (a faixa diz onde
  o chat está); C mostra "Soltar"/"Trazer de volta" e "Desligada"/"Ligada" na
  hora; D mostra o alfinete no cabeçalho e o `aria-checked`; E mostra o cartão
  respondido (círculo cheio, ✓, "✓ Correta.", "Concluir"), o copiado inline e
  o incerto com **um** aviso e o Enviar desligado; F tem vazio, carregando
  (três pontos + linha de atividade) e erro único, vermelho, `role=alert`,
  ícone de alerta e "Tentar de novo". Nenhum estado do inventário ficou sem
  captura além dos listados na seção 3.
- **Feedback e movimento 9,0 (A1/A2/B/C/D/E), 8,5 (F):** os anéis de foco de
  2 px aparecem em todos os controles da filha e no item de menu; a faixa
  "Chat em outra janela" agora pinta 2 px por dentro nos dois temas (achado
  resolvido; prova de pixel na seção 5); o campo da filha tem anel de 2 px; o
  menu atualiza o estado sem fechar e o Esc devolve o foco; o Copiar confirma
  no próprio botão por 1,5 s; o incerto responde com o aviso. F fica em 8,5
  pelo retry em dois passos (achado 3); a animação de soltar/trazer, a
  abertura do menu e o `prefers-reduced-motion` não foram congelados (seção 3).
- **Acessibilidade 9,0 (A1/A2/B/C/D/F), 8,5 (E):** alvos ≥24 px em tudo
  (cabeçalho 28×28, Copiar 67,7×25,6, Levar 148,6×25,6/97,6×25,6, cadeado
  24×24, refresh 134,2×24/24×24, campo 356×86/396×86/229,5×86/499,5×86,
  Enviar 75,9×28, Parar 49,3×28, menu 230×28, faixa 33×829/579, "Tentar de
  novo" 97,9×25,6); foco de 2 px na filha, no item de menu e na faixa; nomes
  "Copiar sua pergunta"/"Copiar resposta"/"Copiar aviso"; cartões com
  `aria-labelledby`; escopo com `title`; quiz com `radiogroup` e `role=radio`;
  `aria-live` na lista; erro com `role=alert`; carregando com `aria-busy`. E
  fica em 8,5 pela borda da opção a 1,54:1/1,67:1 (o círculo de 6,69:1 resolve
  a escolha, mas a caixa do componente continua abaixo dos 3:1). O cadeado é
  um `role=img` com `tabindex=0`, um stop a mais na ordem de Tab, mas expõe
  "Fora da sessão principal" a quem não usa mouse — fica como troca, não como
  achado.
- **Janela pequena 8,5 (A1/A2/E), 9,0 (B/C/D/F):** em 380/420 não há rolagem
  horizontal (`scrollWidth` = 380/420); em 900×650 a faixa tem 33×579, o menu
  de 240 px cabe, o refresh vira ícone de 24×24, o campo do chat preso tem
  229,5×86 e as ações ficam em uma linha (97,6×25,6). A1/A2/E ficam em 8,5
  pelo escopo de 100,5/140,5/84,2 px e pela linha de contexto do 900; F chega
  a 9,0 porque os três estados cabem em 380.
- **Overall 8,5:** a base visual é boa (tipografia, hierarquia e spacing em
  volta de 9,0), mas há três defeitos visíveis: a borda da opção do quiz, o
  escopo cortado e o retry em dois passos. São baixos e não bloqueiam o uso;
  B/C/D ficam em 9,0, A1/A2/E/F em 8,5 e o recorte em 8,5.

## 2. Achados

### 1. Borda da opção do quiz a 1,54:1 no claro e 1,67:1 no escuro (o círculo já está em 6,69:1) — Color & contrast / Consistency · baixa

- **Tela:** `preso-cartao-claro-1440x900`, `preso-cartao-claro-900x650`,
  `preso-cartao-escuro-1440x900`, `en-preso-cartao-light-900x650`.
- **Evidência medida:** a opção continua com `border:1px solid
  var(--border-strong)` (`tutor-chat.css:304`); o pixel da borda é #d0d0d0
  (208,208,208) sobre #fff = **1,54:1** no claro, e (67,67,67) sobre #1f1f1f =
  **1,67:1** no escuro. O círculo de escolha, que é a affordance, foi corrigido
  para `--muted`: núcleo (95,95,95) no claro = #5c5c5c sobre #fff = **6,69:1**;
  no escuro `--muted` #a8a8a8 sobre #1f1f1f = **6,93:1**. O texto da opção mede
  17,58:1 no claro e 14,33:1 no escuro; a opção mede 473,5×35,8 px (1440) e
  188,5×35,8 px (900). Ou seja, o
  achado 2 da rodada 3 está quase resolvido: o rádio passa; a caixa do
  componente, não.
- **Sugestão:** aplicar `border-color:var(--muted)` (ou um tom de
  `--border-strong` que chegue a 3:1) em `.quiz-option`, mantendo o círculo.
- **Arquivo provável:** `desk/src/tutor-chat.css:304`; token
  `desk/style.css:23`.

### 2. Escopo do chat preso reduzido a 84,2 px em 900×650 para manter a legenda — Clarity / Janela pequena · baixa

- **Tela:** `preso-cartao-claro-900x650`, `preso-cartao-escuro-900x650`,
  `mesa-trazido-de-volta-claro-900x650`, `solto-resposta-claro-380x800`,
  `solto-resposta-claro-420x1000` e `en-solto-resposta-light-380x800`.
- **Evidência medida:** o texto do escopo mede **84,2×15,4 px** no 900
  ("Limites.pdf p…"), **100,5×15,4 px** no 380 ("Limites.pdf p. 1…") e
  **140,5×15,4 px** no 420 ("Limites.pdf p. 1, Formu…"); o nome acessível e o
  `title` guardam "Limites.pdf p. 1, Formulario.pdf p. 1". No 900 o composer
  tem 229,5 px e a linha é dividida entre escopo 84,2, cadeado 24, "Só neste
  chat" 75,3 e refresh 24 (com ~6 px de respiro entre eles): a legenda que a
  rodada 3 pediu entrou, mas o escopo virou o primeiro a cortar. O escopo é a
  informação que diz **o que** está no contexto; a legenda é redundante com o
  cadeado e o `title`.
- **Sugestão:** no container abaixo de 300 px, esconder a legenda antes do
  escopo (ou encurtá-la para "Só aqui"), ou dar ao escopo uma segunda linha;
  manter o texto completo no `title`/`aria-label`.
- **Arquivo provável:** `desk/src/composer.css:80-98`;
  `desk/src/sidechat.mjs` (`paintScope`/`scopeLabels`).

### 3. "Tentar de novo" devolve a pergunta ao campo em vez de reenviar — Clarity / Feedback · baixa

- **Tela:** `solto-erro-claro-380x800`, `solto-erro-escuro-380x800` (o botão e o
  card); o estado depois do clique não foi capturado (seção 3).
- **Evidência medida:** o botão mede **97,9×25,6 px**, com texto 11 px a
  **6,69:1** no claro e **6,93:1** no escuro; o card tem `role=alert`, papel
  "Aviso", ícone de alerta e texto de erro a 5,74:1/6,36:1. O código
  `retrySidechat` (`sidechat.mjs:482-494`) preenche o campo com a última
  pergunta, chama `paintSend()` e `promptEl.focus()`, mas **não chama
  `sendMessage()`**; o texto do erro diz "envie de novo" e o Enviar estava
  desligado. O usuário precisa de dois cliques, mas o rótulo "Tentar de novo"
  sugere um só.
- **Sugestão:** reenviar após repor a pergunta (um clique), ou renomear para
  "Reescrever pergunta"/"Preencher a pergunta" e deixar claro que o envio é
  manual.
- **Arquivo provável:** `desk/src/sidechat.mjs:482-494`;
  `desk/src/locales/pt-BR.json:2428`, `desk/src/locales/en.json:2428`.

## 3. SEM CAPTURA

Estados do inventário sem PNG; a nota da categoria naquele estado **não** é
dada:

- **Estado `unavailable`** (ponte `window.desk.sidechat*` ausente, texto em
  `renderUnavailable`): **SEM CAPTURA**. Exigiria um host sem a ponte do
  lateral; o inventário o deixa fora do recorte.
- **Hover das ações de mensagem** ("Copiar"/"Levar à sessão principal"):
  **SEM CAPTURA**. O clique do "Copiar" aparece em
  `preso-copiado-claro/escuro-1440x900` (o botão vira "✓ Copiado"), mas o hover
  em repouso do "Copiar" e o do "Levar" não foram congelados. A nota de
  Feedback usa o repouso e o `:focus-within`.
- **Enviar habilitado (campo com rascunho) e sua parada de Tab:** **SEM
  CAPTURA**. O inventário lista `teclado-solto-08-sidechat-send`, mas o 08 real
  é `teclado-solto-08-sidechat-new`; o `#sidechat-send` está `disabled` em
  todas as capturas (vazio, erro, incerto, carregando e mesmo com a conversa
  pronta) e o `teclado-solto-resumo.json` tem 9 controles únicos, sem o Enviar.
  O visual do botão **habilitado** não foi provado; a nota de Estados/Feedback
  vale só para o Enviar desligado.
- **`teclado-solto-10-sidechat-more`:** **SEM CAPTURA** como arquivo; o estado
  "Mais opções" está coberto por `teclado-solto-09-sidechat-more`. É uma
  inconsistência de numeração/contagem do inventário (60 PNG, não 61), não um
  estado ausente.
- **Retry clicado (campo reposto + Enviar habilitado):** **SEM CAPTURA**; a
  prova do comportamento é o código (`sidechat.mjs:482-494`), não uma captura
  depois do clique.
- **Trazido de volta escuro em 900×650:** **SEM CAPTURA** (o inventário marca
  "—"); só há 1440 escuro e 900 claro.
- **Inglês em 1440×900:** **SEM CAPTURA**; o inglês tem só as variantes de
  900×650 (e a solta de 380×800).
- **Vazio, carregando e erro em inglês:** **SEM CAPTURA**; o inventário só
  congela `en-solto-resposta`, `en-solto-incerto` e os menus/faixa/preso. O
  texto novo do vazio em inglês ("Ask without touching the main session.") está
  no locale, mas não foi congelado.
- **Roteiro de teclado em 420×1000, em inglês e no escuro (controles
  principais):** **SEM CAPTURA**; o roteiro completo é 380×800, claro, e o menu
  tem as duas variantes de tema.
- **Menu "Mais opções" do chat preso em 900×650:** **SEM CAPTURA**; só há
  1440×900 (`mesa-menu-soltar-*`). O menu de 240 px cabe na coluna de 260 px,
  mas não foi provado.
- **Menus "Trazer de volta"/"Sempre por cima" em 420×1000:** **SEM CAPTURA**;
  os menus da filha só existem em 380×800 (claro/escuro), e o inglês também só
  em 380.
- **Foco da faixa "Chat em outra janela" em 900×650:** **SEM CAPTURA**; o
  `teclado-faixa-*` só tem 1440×900. O CSS é o mesmo (`outline-offset:-2px`),
  mas o estado não foi congelado no tamanho mínimo.
- **Movimento/transição** de soltar, trazer de volta, abrir o menu, o flash do
  "Copiado" e os três pontos: **SEM CAPTURA** (PNGs estáticos). O
  `prefers-reduced-motion` dos três pontos existe no CSS
  (`support-sidechat.css:78`), mas não foi capturado.
- **Leitor de tela em execução:** **SEM CAPTURA**; os nomes/roles vêm do DOM
  (`labels` do JSON), não de uma sessão de leitor de tela.
- **"Sempre por cima" no nível do sistema operacional:** o JSON registra
  `alwaysOnTop:true` e o alfinete, mas não há captura da janela sobre outra
  janela; a prova é o estado do host, não a sobreposição real.
- **Hover das opções do quiz e dos itens do menu:** **SEM CAPTURA**; a nota usa
  o repouso e o CSS (`tutor-chat.css:305`, `:54`).
- **"Copiado" em 900×650 (claro e escuro):** **SEM CAPTURA**; só há
  `preso-copiado-claro/escuro-1440x900`.

## 4. Imagens

**Vi as imagens.** Abri **33 dos 60 PNGs** com a ferramenta de leitura:
`solto-resposta-claro-380x800`, `solto-resposta-escuro-380x800`,
`solto-resposta-claro-420x1000`, `solto-vazio-claro-380x800`,
`solto-vazio-escuro-380x800`, `solto-carregando-claro-380x800`,
`solto-carregando-escuro-380x800`, `solto-erro-claro-380x800`,
`solto-erro-escuro-380x800`, `solto-menu-trazer-claro-380x800`,
`solto-menu-trazer-escuro-380x800`, `solto-menu-por-cima-claro-380x800`,
`solto-por-cima-sinal-claro-380x800`, `mesa-faixa-claro-1440x900`,
`mesa-faixa-claro-900x650`, `mesa-faixa-escuro-900x650`,
`teclado-faixa-claro-1440x900`, `preso-cartao-claro-1440x900`,
`preso-cartao-claro-900x650`, `preso-cartao-respondido-claro-900x650`,
`preso-cartao-respondido-escuro-1440x900`, `preso-copiado-claro-1440x900`,
`preso-incerto-claro-900x650`, `preso-incerto-escuro-1440x900`,
`mesa-menu-soltar-claro-1440x900`, `mesa-trazido-de-volta-claro-900x650`,
`mesa-trazido-de-volta-escuro-1440x900`, `en-preso-cartao-light-900x650`,
`en-solto-resposta-light-380x800`, `en-solto-incerto-light-380x800`,
`en-faixa-light-900x650`, `en-menu-soltar-light-900x650` e
`teclado-solto-menu-item-escuro-380x800`. Nos **27 PNGs restantes** avaliei
pelos JSON homônimos, pelo CSS/código e por análise de pixel; não inventei o
que não vi. Li os **60 JSON de medidas**, os **3 resumos de teclado** e o
`falhas.json` (vazio). Por análise de pixel (decodificador PNG próprio)
confirmei o anel da faixa (2 px em x=1016–1017 e x=1047–1048, e nas linhas
y=44–45/871–872; rgb(37,72,199) no claro e rgb(143,168,255) no escuro), a
borda da opção (#d0d0d0 no claro, (67,67,67) no escuro), o círculo
((95,95,95) no claro) e o fill do "Concluir" escuro ((70,99,221)).

## 5. Achados da rodada 3

Os 9 achados de `docs/design-loop/nota-rodada-3-chat-solto.md`, reconferidos
contra as capturas novas:

| # | Achado da rodada 3 | Status | Prova na rodada 4 |
|---:|---|---|---|
| 1 | Foco da faixa "Chat em outra janela" não pintava no claro e só sangrava 1 px no escuro | **RESOLVIDO** | `teclado-faixa-claro-1440x900` e `-escuro`: o anel de 2 px agora é desenhado por dentro (`#support-restore:focus-visible{outline-offset:-2px}`, `readers.css:120`). Pixel: rgb(37,72,199) no claro e rgb(143,168,255) no escuro em x=1016,1017 e 1047,1048, e nas linhas y=44,45 e 871,872; o PNG com foco difere do sem foco (md5 `0a09a21c…` vs `90bbeaf8…` no claro; `08e392df…` vs `8f85d504…` no escuro). |
| 2 | Círculo de escolha do quiz a 1,54:1 no claro e ~1,7:1 no escuro | **PARCIAL** | `preso-cartao-claro-1440x900`: o círculo passou para `--muted`, com núcleo (95,95,95) = #5c5c5c sobre #fff = **6,69:1** (escuro **6,93:1**), acima dos 3:1; a **borda da opção** continua #d0d0d0 = **1,54:1** (escuro 1,67:1) — achado 1 desta rodada. |
| 3 | Legenda "Só neste chat" sumia em 900×650 e o escopo cortava em 380/420 | **PARCIAL** | `preso-cartao-claro-900x650` e `mesa-trazido-de-volta-claro-900x650`: "Só neste chat" agora aparece (75,3×15,4 px; `composer.css:92-98`), mas o escopo caiu para **84,2 px** ("Limites.pdf p…"); no 380/420 segue em 100,5/140,5 px. O `title` guarda o texto completo — achado 2 desta rodada. |
| 4 | Campo do composer do chat preso com 126/120 px, não as 3 linhas (86 px) | **RESOLVIDO** | `preso-cartao-claro-1440x900`: campo **499,5×86 px**; `-900x650`: **229,5×86 px**; a janela solta segue 356×86 (380) e 396×86 (420). `support-sidechat.css:96-104` fixa `field-sizing:fixed` e `calc(3lh + 14px)`. |
| 5 | Ações de mensagem quebravam em duas linhas em 900×650 | **RESOLVIDO** | `preso-cartao-claro-900x650` e `en-preso-cartao-light-900x650`: "Levar à sessão" mede **97,6×25,6 px** e "To main session" **102,8×25,6 px**, uma linha; no 1440 o rótulo completo tem 148,6×25,6. `support-sidechat.css:63-74` (`nowrap` + `data-short` + `aria-label` completo). |
| 6 | Erro do motor ainda vestia "OpenCode" e não oferecia "Tentar de novo" | **RESOLVIDO** | `solto-erro-claro/escuro-380x800`: papel **"Aviso"**, ícone de alerta, `role=alert`, texto 5,74:1/6,36:1, **"Tentar de novo"** (97,9×25,6) + "Copiar aviso". O retry repõe a pergunta no campo (`sidechat.mjs:482-494`); o rótulo/dois passos virou o achado 3 desta rodada. |
| 7 | Estado vazio da janela solta dizia "Pergunte ao lado…" | **RESOLVIDO** | `solto-vazio-claro/escuro-380x800`: "Pergunte sem mexer na sessão principal." (12 px, 4,95:1/6,72:1, 247,5×14 px). O inglês está no locale ("Ask without touching the main session."), mas não foi capturado (seção 3). |
| 8 | "Desligada" no menu escuro a 4,52:1 | **RESOLVIDO** | `solto-menu-trazer-escuro-380x800`: o `--faint` escuro virou #a0a0a0; pixel core (160,160,160) sobre #303030 = **5,05:1** (`style.css:21`, commit `caeda681`). O menu claro mede 17,58:1 nos itens e o "Ligada" usa `--accent-text` (7,71:1). |
| 9 | "Concluir" no escuro a 4,61:1 | **RESOLVIDO** | `preso-cartao-respondido-escuro-1440x900`: o fill agora é #4663dd (pixel (70,99,221)); branco sobre ele = **5,14:1** (JSON 5,14; claro 7,42:1). `style.css:39` (`--acc-blue` escuro, commit `caeda681`). |

**Resumo:** 7 resolvidos e 2 parciais (o círculo do quiz e o escopo/legenda).
Não há achado aberto da rodada 3 sem remanescente; os remanescentes viraram os
achados 1 e 2 desta rodada, e o retry ganhou o achado 3. Os 11 achados da
rodada 2 que a nota da rodada 3 já havia reconferido continuam cobertos pelos
mesmos consertos; não os reabro.

## 6. Decisões do autor

- **D1 (Converter síncrono):** fora deste recorte (Xournal++); não afeta a
  nota. **Decisão do autor.**
- **D2 (Cadernos a três cliques):** não está aplicada; se a opção C for a
  escolhida, mexe no cabeçalho do chat, mas é uma decisão de outro recorte e não
  entra nesta nota. **Decisão do autor.**
- **D3 (capas de caderno):** é da biblioteca de cadernos; não afeta a nota.
  **Decisão do autor.**

As decisões já fixadas para o chat solto (fechar a filha devolve o chat,
"sempre por cima" começa desligado, é um chat só movido para a filha) também
não são achados; a nota as trata como referência da casa.
