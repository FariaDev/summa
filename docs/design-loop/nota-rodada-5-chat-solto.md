# Nota da rodada 5 — chat solto (#157)

Avaliação do recorte "Chat solto": a janela própria do chat lateral, a faixa
"Chat em outra janela", soltar/trazer de volta, "sempre por cima" e o chat
preso na Mesa com resposta, cartões, cartão respondido, copiado, envio incerto
e janela pequena, mais vazio, carregando e erro na janela solta. Base: as
capturas novas de `docs/design-loop/rodada-5/antes/chat-solto/` (PNG + JSON
homônimo), o inventário `docs/design-loop/inventario-chat-solto.md`, o CSS e o
código em `desk/src`. Não implementei nem corrigi nada; a nota é independente
da rodada 4 e os status da seção 5 são uma reconferência, não uma reutilização
das notas anteriores.

**Nota sobre a pasta.** A pasta tem **60 PNG + 60 JSON de medidas + 3 resumos
de teclado + `falhas.json` = 124 arquivos**, não os 126 que o inventário
declara: o `teclado-solto-10-sidechat-more` que o inventário lista **não
existe**; o roteiro real termina no **09 `sidechat-more`** e o **08 é o
`sidechat-new`** (o Enviar desligado com o campo vazio não entra na ordem de
Tab; o `teclado-solto-resumo.json` traz 9 controles únicos). `falhas.json` está
vazio (`failures: []`). O inventário ainda aponta as capturas para
`rodada-2/antes/chat-solto/` e a tabela de tamanhos diz 380×773 e 420×973 para
a janela solta; os JSON desta rodada medem **380×800 e 420×1000** (a filha é
sem moldura, então `innerHeight` = `outerHeight`); os 1440×873 e 900×623 da
Mesa batem. O inventário também fala num toast "Mensagem lateral copiada." e
num Enviar "reabilitado" no erro: o código e as capturas mostram o retorno
**inline** "Copiado" (`sidechat.copiedShort`, `sidechat-message-view.mjs:103-119`)
e o `#sidechat-send` **desligado** no erro porque o campo está vazio — o
"Tentar de novo" é que repõe a pergunta (seção 5). O "antes" desta rodada já
inclui o conserto do escopo do commit `599fd17b`; a nota avalia o que está
congelado agora.

## 1. Notas

Sub-partes: **A1** janela solta 380×800; **A2** janela solta 420×1000; **B**
faixa "Chat em outra janela" (1440×900 e 900×650, claro/escuro, inglês); **C**
soltar/trazer (menus "Soltar em outra janela" e "Trazer de volta" e a Mesa
restaurada); **D** "sempre por cima" (menu ligado + sinal do alfinete); **E**
chat preso na Mesa (resposta/cartões, cartão respondido, copiado, envio incerto
e 900×650); **F** vazio, carregando e erro na janela solta. A coluna "Geral" é
a leitura do recorte; a última linha é o Overall de cada sub-parte. O inglês de
380 aparece em A1 e repete o cartão do quiz de E: por isso A1 tem
`9,0 / 8,5 (en)` em Color, Acessibilidade e Overall. "—" em A1/A2 na linha
Estados significa que vazio/carregando/erro são avaliados na coluna F; A1/A2
avaliam a resposta, o teclado e a janela.

A nota de uma categoria num estado **sem captura** não é dada (seção 3).

| Categoria | A1 · solta 380 | A2 · solta 420 | B · faixa | C · soltar/trazer | D · por cima | E · preso (1440/900) | F · vazio/carregando/erro | Geral |
|---|---|---|---|---|---|---|---|---|
| Typography | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Hierarchy | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Spacing & density | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Color & contrast | 9,0 / 8,5 (en) | 9,0 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | 8,5 |
| Iconography | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Consistency & polish | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | 8,5 |
| Clarity | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Estados (vazio/carregando/erro) | — (F) | — (F) | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Feedback e movimento | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Acessibilidade | 9,0 / 8,5 (en) | 9,0 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | 8,5 |
| Janela pequena | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| **Overall** | **9,0 / 8,5 (en)** | **9,0** | **9,0** | **9,0** | **9,0** | **8,5** | **9,0** | **8,5** |

**Overall do recorte: 8,5.** O escopo que a rodada 4 cortava em 84,2 px está
resolvido: em 900×650 ele ocupa 225,5×15,4 px e lê "Limites.pdf p. 1,
Formulario.pdf p. 1" inteiro numa linha própria; em 380 e 420 são 352 e 396 px,
também inteiros, com o cadeado, "Só neste chat" e "Atualizar contexto" na linha
de baixo. O "Tentar de novo" que a rodada 4 apontou virou a decisão **D4** do
autor (recomenda manter o comportamento atual); ela não entra como achado. O
que segura o recorte em 8,5 são dois defeitos baixos, nenhum bloqueante: a
**borda da opção do quiz a 1,54:1/1,67:1** (o círculo já está em 6,69:1/6,93:1)
e o **"Copiado" que alarga o botão de 67,7 para 76,9 px e desloca o "Levar à
sessão principal" em 9,2 px** durante 1,5 s. Em E a categoria fica em 8,5 por
esses dois; a base visual (tipografia, hierarquia, spacing, ícones, estados e
foco) está em 9,0. O foco do campo no chat preso é o contorno de 1 px do painel
(padrão da casa, `readers.css:128`), não um anel de 2 px como na filha; é
visível e medido, então fica como observação, não como achado.

**Lastro das notas (para nenhuma nota ficar sem medida):**

- **Typography 9,0 (todas):** corpo 15 px/24 px (1,6), papéis 11 px/600, título
  12 px/600, motor 11 px/600, escopo 11 px/15,4 px, nota 11 px, ações 11 px,
  menu 12 px, faixa 12 px/600, vazio 12 px, atividade 11 px, erro 15 px/24 px,
  pergunta do quiz 15 px/600, opções 15 px, "Concluir" 15 px, "Parar" 12 px/500.
  O piso é 11 px e os **60 JSON** não têm texto abaixo disso; o menor contraste
  de texto é **4,95:1** e `textTruncated` é `false` em todos. Em 380/420 o
  escopo não corta mais (352/396 px); em 900 o corpo de 214,5 px vira 3 linhas
  de 24 px sem clipping. O inglês mantém as medidas ("Side chat" 63,2 px,
  "Side chat only" 78,1 px, "Bring to the main session" 156,4 px).
- **Hierarchy 9,0 (todas):** cabeçalho, papel do falante (11 px/600), corpo
  (15 px), ações (11 px) e composer se leem nesta ordem; o cartão do quiz tem
  pergunta 15 px/600, opções 15 px e ações separadas; em 380/420/900 o escopo
  ganhou linha própria e a legenda/cadeado/ação ficam na linha de baixo, sem
  competir com o campo (no 1440 os quatro seguem na mesma linha). Em 900 o
  cabeçalho perde o selo do motor pela container query de
  300 px (`support-sidechat.css:44`), mas o papel "OpenCode" segue no corpo e o
  nome da seção continua; o que se perde é redundante, não a identificação.
  F fica em 9,0 porque "Aviso" + ícone + texto vermelho + ações separa a falha
  da resposta, e o vazio e o carregando têm hierarquia própria.
- **Spacing & density 9,0 (todas):** campo 356×86 px (380), 396×86 px (420),
  499,5×86 px (1440 preso) e 229,5×86 px (900 preso), 3 linhas; escopo
  352/396/244/225,5 px de largura e 15,4 px de altura; nota 75,3 px (78,1 px no
  inglês); linha de ações 25,6 px; menu 230×28 px e popover 240×96 px; faixa
  33×829 px (1440) e 33×579 px (900); opções do quiz 473,5×35,8 px (1440),
  188,5×35,8 px (900) e 330×35,8 px (380); ações do quiz 77,6×38, 97×38 e
  83,4×38 px. Não há overflow horizontal: `scrollWidth` = 380/420/900/1440 em
  todos os 60 JSON. Em 380/420/900 a linha de escopo nova ocupa 15,4 px acima
  da linha do cadeado e não empurra o campo (o textarea segue em y=672 no
  380/420 e y=478,4 no 900); no 1440 os quatro seguem na mesma linha.
- **Color & contrast 8,5 (E e inglês de A1), 9,0 (A1/A2/B/C/D/F):** todo texto
  medido passa AA: corpo 17,58:1 / 15,29:1; papéis e motor 4,95:1 / 6,72:1;
  "Copiar" 6,69:1 / 6,93:1; escopo e nota 6,69:1 / 7,39:1; placeholder
  4,95:1 / 6,72:1; vazio 4,95:1 / 6,72:1; atividade 6,69:1 / 7,39:1; aviso
  incerto 5,71:1 / 10,53:1; erro 5,74:1 / 6,36:1; "Parar" 17,63:1 / 17,58:1;
  "Enviar" desligado 5,36:1 / 5,74:1 (isento, mas passa); menu 17,58:1 /
  11,48:1; "Desligada" 4,95:1 / 5,05:1 (pixel (160,160,160) sobre #303030);
  faixa 18,88:1 / 16,48:1; "Concluir" 7,42:1 / 5,14:1; círculo do quiz 6,69:1 /
  6,93:1; borda da opção correta (22,163,74) sobre #fff = 3,3:1, passa. E e o
  inglês de A1 ficam em 8,5 pela **borda da opção não marcada** (achado 1):
  #d0d0d0 (208,208,208) sobre #fff = 1,54:1 e (67,67,67) sobre #1f1f1f =
  1,67:1. Nenhum texto abaixo de AA; o defeito é de componente.
- **Iconography 9,0 (todas):** ícones de 16 px em alvos de 28×28; copiar com
  glifo de 12 px; cadeado, atualizar e cópia de 12 px; alfinete de 14 px no
  cabeçalho; `textQuote`, `undo`, `external` e alfinete nos menus; alerta de
  14 px no erro; três pontos de 5 px no carregando; círculo de 14 px no quiz;
  ✓ de 15 px/700 no cartão respondido; chevron de 16 px na faixa. O conjunto
  está na mesma família e não desalinha em nenhum estado capturado.
- **Consistency & polish 8,5 (E), 9,0 (A1/A2/B/C/D/F):** claro e escuro têm as
  mesmas formas; o menu é o mesmo `.chat-pop` do tutor; o chat preso e a janela
  solta usam o mesmo cabeçalho, papéis, ações e campo de 86 px nos quatro
  tamanhos; o rótulo curto "Levar à sessão" (97,6 px) só aparece abaixo de
  300 px e mantém `aria-label`/`title` completos; o inglês usa "To main session"
  (102,8 px). O "Copiado" inline é bom, mas **alarga o botão e desloca o vizinho
  em 9,2 px** (achado 2), e é o que põe E em 8,5. O foco do campo no preso
  (contorno de 1 px do painel) difere do anel de 2 px da filha; é o padrão da
  casa e não conta como achado (ver Feedback).
- **Clarity 9,0 (todas):** "Atualizar contexto", "Levar à sessão principal"
  (com `title`), "Só neste chat", "Trazer de volta", "Soltar em outra janela",
  "Sempre por cima" e "Chat em outra janela" têm nome e dica; o menu diz o
  estado; o vazio diz "Pergunte sem mexer na sessão principal."; o escopo agora
  lê inteiro. O "Tentar de novo" promete reenvio e o código só repõe a pergunta,
  mas isso é a **decisão D4 do autor** (recomenda manter); a nota não penaliza
  e a ressalva está na seção 6.
- **Estados 9,0 (B/C/D/E/F):** B é um estado bem comunicado (a faixa diz onde
  o chat está); C mostra "Soltar"/"Trazer de volta" e "Desligada"/"Ligada" na
  hora; D mostra o alfinete no cabeçalho e o `aria-checked`; E mostra o cartão
  respondido (círculo cheio, ✓, "✓ Correta.", "Concluir"), o copiado inline e o
  incerto com **um** aviso e o Enviar desligado; F tem vazio, carregando (três
  pontos + linha de atividade + Parar + Enviar desligado) e erro único,
  vermelho, `role=alert`, ícone de alerta e "Tentar de novo". Nenhum estado do
  inventário ficou sem captura além dos listados na seção 3.
- **Feedback e movimento 9,0 (todas):** os anéis de foco de 2 px aparecem em
  todos os controles da filha, no cadeado, no refresh, no campo e no item de
  menu; a faixa pinta 2 px por dentro nos dois temas (pixel #2548c7 em
  x=1016–1017/1047–1048 e y=44–45); o menu atualiza o estado sem fechar e o Esc
  devolve o foco; o Copiar confirma no próprio botão; o incerto responde com o
  aviso; o carregando usa três pontos com `prefers-reduced-motion`
  (`support-sidechat.css:78`). No preso, o foco do campo é o contorno de 1 px
  do painel (`#sidechat:focus-within::after`, `readers.css:128`) + o fio do
  composer; o JSON do campo dá `outline:3px none` e `box-shadow:none`, mas o
  pixel do painel é #2548c7 em x=526/1048 e o foco é visível — é o padrão da
  casa, não um defeito. O "Copiado" que alarga o botão é o detalhe do achado 2;
  não tira a nota de Feedback porque o retorno é local e imediato.
- **Acessibilidade 8,5 (E e inglês de A1), 9,0 (A1/A2/B/C/D/F):** alvos ≥24 px
  em tudo (cabeçalho 28×28, Copiar 67,7×25,6, Levar 148,6×25,6/97,6×25,6,
  cadeado 24×24, refresh 134,2×24/24×24, campo 356×86/396×86/229,5×86/499,5×86,
  Enviar 75,9×28, Parar 49,3×28, menu 230×28, faixa 33×829/579, "Tentar de
  novo" 97,9×25,6, opções do quiz 35,8 de altura); foco de 2 px na filha, no
  item de menu, no cadeado, no refresh e na faixa; nomes "Copiar sua
  pergunta"/"Copiar resposta"/"Copiar aviso"; cartões com `aria-labelledby`;
  escopo com `title`; quiz com `radiogroup`/`role=radio`; `aria-live` na lista;
  `aria-busy` no cartão ao vivo; erro com `role=alert`; carregando com
  `role=status`. E e o inglês de A1 ficam em 8,5 pela borda da opção a
  1,54:1/1,67:1; o resto passa. O cadeado é um `role=img` com `tabindex=0`, um
  stop a mais no Tab, mas expõe "Fora da sessão principal" a quem não usa mouse
  — fica como troca, não como achado. Não houve sessão de leitor de tela; a
  nota usa `labels`/`role` do DOM (seção 3).
- **Janela pequena 9,0 (todas):** em 380/420 não há rolagem horizontal
  (`scrollWidth` = 380/420); o escopo lê inteiro e a nota/cadeado/refresh cabem
  na linha de baixo; em 900×650 a faixa tem 33×579, o menu de 240 px cabe na
  coluna de 260 px (pela conta; captura em falta, seção 3), o refresh vira
  ícone de 24×24, o campo do chat preso tem 229,5×86 e as ações ficam em uma
  linha (97,6×25,6); o quiz de 188,5 px de opção e as ações 77,6/97 px cabem.
  O 1440 preso tem campo 499,5 e escopo/nota/ação na mesma linha.
- **Overall 8,5:** a base visual está em 9,0 em quase tudo, mas há dois
  defeitos visíveis e baixos (borda do quiz e shift do Copiado); o escopo está
  resolvido e o retry é D4. A1 (pt), A2, B, C, D e F ficam em 9,0; A1 (en) e E
  em 8,5; o recorte em 8,5. Nada bloqueia o uso; um designer sênior mexeria
  nesses dois detalhes.

## 2. Achados

### 1. Borda da opção do quiz a 1,54:1 no claro e 1,67:1 no escuro (o círculo já está em 6,69:1) — Color & contrast / Acessibilidade · baixa

- **Tela:** `preso-cartao-claro-1440x900`, `preso-cartao-escuro-1440x900`,
  `preso-cartao-claro-900x650`, `en-preso-cartao-light-900x650` e
  `en-solto-resposta-light-380x800`.
- **Evidência medida:** a opção continua com `border:1px solid
  var(--border-strong)` (`tutor-chat.css:304`); o pixel da borda é #d0d0d0
  (208,208,208) sobre #fff = **1,54:1** no claro, e (67,67,67) sobre #1f1f1f =
  **1,67:1** no escuro. O círculo de escolha, que é a affordance, está em
  `--muted`: #5c5c5c (95,95,95) sobre #fff = **6,69:1**; no escuro #a8a8a8
  sobre #1f1f1f = **6,93:1**. O texto da opção mede 17,58:1 no claro e 14,33:1
  no escuro; a opção mede 473,5×35,8 px (1440), 188,5×35,8 px (900) e
  330×35,8 px (380). A borda da opção **correta** é (22,163,74) sobre #fff =
  3,3:1 e passa; o defeito é só a opção em repouso.
- **Sugestão:** aplicar `border-color:var(--muted)` (ou um tom de
  `--border-strong` que chegue a 3:1) em `.quiz-option`, mantendo o círculo.
- **Arquivo provável:** `desk/src/tutor-chat.css:304`; token
  `desk/style.css:23`.

### 2. "Copiado" alarga o botão de 67,7 para 76,9 px e desloca o "Levar" em 9,2 px — Consistency & polish · baixa

- **Tela:** `preso-copiado-claro-1440x900` e `preso-copiado-escuro-1440x900`
  (o mesmo componente viaja para a filha; o estado não foi capturado em 380,
  seção 3).
- **Evidência medida:** em repouso o "Copiar resposta" mede **67,7×25,6 px** em
  x=537,5 e o "Levar à sessão principal" começa em x=611,2; no "Copiado" o
  botão vira **76,9×25,6 px** (rótulo 44,9 px + ✓) e o "Levar" salta para
  x=620,4 — **9,2 px** de deslocamento por 1,5 s, até `flashMark` devolver o
  original (`sidechat-message-view.mjs:103-119`). O retorno inline é bom; o
  defeito é o vizinho andar.
- **Sugestão:** reservar a largura do estado de sucesso (`min-width:76,9px` no
  `.sidechat-copy`) ou manter o rótulo "Copiar" e trocar só o ícone.
- **Arquivo provável:** `desk/src/support-sidechat.css:63` e
  `desk/src/sidechat-message-view.mjs:109-112`.

### 3. Observação que não conta como achado: foco do campo no chat preso é um contorno de 1 px no painel

- **Tela:** `mesa-trazido-de-volta-claro-1440x900`,
  `mesa-trazido-de-volta-claro-900x650`, `mesa-trazido-de-volta-escuro-1440x900`,
  `preso-cartao-claro-1440x900` e `preso-cartao-claro-900x650`.
- **Evidência medida:** o JSON do campo dá `focusVisible:true`, `outline:3px
  none` e `box-shadow:none`; o sinal é o `#sidechat:focus-within::after`
  (`readers.css:128`, 1 px de `--ring`; pixel #2548c7 em x=526 e x=1048) mais o
  fio do composer. Na filha o mesmo campo tem `outline:2px solid #2548c7`
  (`composer.css:184`). O contorno de 1 px é visível e é o padrão dos painéis
  da casa; registro a diferença (1 px no preso, 2 px na filha) para quem for
  unificar, mas não baixo nota por ela.
- **Sugestão, se o autor quiser unificar:** dar ao campo do preso o mesmo anel
  de 2 px da filha, em vez de só o contorno do painel.
- **Arquivo provável:** `desk/src/readers.css:128` e `desk/src/composer.css:184`.

## 3. SEM CAPTURA

Estados do inventário sem PNG; a nota da categoria naquele estado **não** é
dada:

- **Estado `unavailable`** (ponte `window.desk.sidechat*` ausente, texto em
  `renderUnavailable`): **SEM CAPTURA**. Exigiria um host sem a ponte do
  lateral; o inventário o deixa fora do recorte. Invalida Estados e
  Acessibilidade nesse estado.
- **Hover das ações de mensagem** ("Copiar"/"Levar à sessão principal"):
  **SEM CAPTURA**. O clique do "Copiar" aparece em `preso-copiado-*`
  (o botão vira "✓ Copiado"), mas o hover em repouso do "Copiar" e o do
  "Levar" não foram congelados; a nota de Feedback usa o repouso e o
  `:focus-within`. Invalida o hover desse estado.
- **Hover das opções do quiz e dos itens do menu:** **SEM CAPTURA**; a nota
  usa o repouso e o CSS (`tutor-chat.css:305`, `chat-pop`).
- **Enviar habilitado (campo com rascunho) e sua parada de Tab:** **SEM
  CAPTURA**. O `#sidechat-send` está `disabled` nos **42** JSON que o têm; não
  há captura do botão habilitado nem do Tab até ele. O `Concluir` prova o
  `.primary` (7,42:1/5,14:1), mas não o Enviar. Invalida o visual do Enviar
  habilitado em A1/A2/E/F.
- **Retry clicado (campo reposto + Enviar habilitado):** **SEM CAPTURA**; a
  prova do comportamento é o código (`sidechat.mjs:482-494`), não uma captura
  depois do clique. D4 cobre a decisão.
- **`teclado-solto-10-sidechat-more`:** **SEM CAPTURA** como arquivo; o estado
  "Mais opções" está coberto por `teclado-solto-09-sidechat-more`. É uma
  inconsistência de numeração/contagem do inventário (60 PNG, não 61), não um
  estado ausente.
- **"Copiado" em 900×650 (claro e escuro):** **SEM CAPTURA**; só há
  `preso-copiado-claro/escuro-1440x900`.
- **Popover "Ver o contexto copiado" (`#sidechat-context-pop`) aberto:** **SEM
  CAPTURA**; o item do menu foi congelado, o painel de destino não.
- **"Levar à sessão principal" clicado** (rascunho na sessão principal + toast
  `sidechat.toMainDone`): **SEM CAPTURA**; o botão e o `title` foram, o
  resultado não.
- **"Novo chat" e "Atualizar contexto" clicados:** **SEM CAPTURA**; os botões
  foram, o estado resultante não.
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
- **A contagem de 61 PNG/126 arquivos e o `teclado-solto-10`**: não existem; a
  pasta tem 60/124 e o resumo tem 9 controles (Nota sobre a pasta). Não é um
  estado ausente, é uma divergência do inventário.
- **O toast "Mensagem lateral copiada." e o "Enviar reabilitado" do erro**: não
  existem como descritos; o retorno é inline e o Enviar segue desligado porque
  o campo está vazio. Também é divergência do inventário, não estado ausente.

## 4. Imagens

**Vi as imagens.** Abri **29 dos 60 PNGs** com a ferramenta de leitura:
`solto-resposta-claro-380x800`, `solto-resposta-escuro-380x800`,
`solto-resposta-claro-420x1000`, `solto-vazio-claro-380x800`,
`solto-carregando-claro-380x800`, `solto-erro-claro-380x800`,
`solto-erro-escuro-380x800`, `solto-menu-trazer-claro-380x800`,
`solto-menu-por-cima-claro-380x800`, `solto-por-cima-sinal-claro-380x800`,
`mesa-faixa-claro-1440x900`, `mesa-faixa-claro-900x650`,
`mesa-faixa-escuro-900x650`, `mesa-menu-soltar-claro-1440x900`,
`mesa-trazido-de-volta-claro-1440x900`, `mesa-trazido-de-volta-claro-900x650`,
`mesa-trazido-de-volta-escuro-1440x900`, `preso-cartao-claro-1440x900`,
`preso-cartao-claro-900x650`, `preso-cartao-escuro-900x650`,
`preso-cartao-respondido-claro-900x650`, `preso-copiado-claro-1440x900`,
`preso-incerto-claro-900x650`, `preso-incerto-escuro-1440x900`,
`en-preso-cartao-light-900x650`, `en-solto-resposta-light-380x800`,
`en-solto-incerto-light-380x800`,
`teclado-solto-05-sidechat-scope-lock-claro-380x800` e
`teclado-solto-menu-item-claro-380x800`. Nos **31 PNGs restantes** avaliei pelos
JSON homônimos, pelo CSS/código e por sondas de pixel; não inventei o que não
vi. Li os **60 JSON de medidas**, os **3 resumos de teclado** e o
`falhas.json` (vazio). Por análise de pixel (decodificador PNG próprio)
confirmei a borda da opção (#d0d0d0 no claro, (67,67,67) no escuro), o círculo
((95,95,95) no claro), a borda verde da opção correta ((22,163,74)), o anel da
faixa (2 px em x=1016–1017 e x=1047–1048, e nas linhas y=44–45), o contorno de
1 px do painel preso (#2548c7 em x=526 e x=1048), o estado "Desligada" do menu
escuro (token #a0a0a0 sobre #303030) e o alfinete do cabeçalho ((92,92,92) a
14 px).

## 5. Achados da rodada 4

Os três achados de `docs/design-loop/nota-rodada-4-chat-solto.md`, reconferidos
contra as capturas novas:

| # | Achado da rodada 4 | Status | Prova na rodada 5 |
|---:|---|---|---|
| 1 | Borda da opção do quiz a 1,54:1 no claro e 1,67:1 no escuro (o círculo já está em 6,69:1) | **ABERTO** | `preso-cartao-claro-1440x900`, `preso-cartao-escuro-1440x900`, `preso-cartao-claro-900x650` e `en-preso-cartao-light-900x650`: o pixel da borda segue #d0d0d0 sobre #fff = **1,54:1** e (67,67,67) sobre #1f1f1f = **1,67:1**; o círculo segue 6,69:1 / 6,93:1; `tutor-chat.css:304` ainda usa `--border-strong`, e não há commit de conserto depois de `599fd17b`. É o achado 1 desta rodada. |
| 2 | Escopo do chat preso reduzido a 84,2 px em 900×650 para manter a legenda | **RESOLVIDO** | `preso-cartao-claro-900x650` e `mesa-trazido-de-volta-claro-900x650`: o escopo mede **225,5×15,4 px** e lê "Limites.pdf p. 1, Formulario.pdf p. 1" inteiro numa linha própria; `solto-resposta-claro-380x800` mede **352×15,4** e `solto-resposta-claro-420x1000` **396×15,4**, também inteiros; o cadeado, "Só neste chat" e "Atualizar contexto" passam para a linha de baixo. `composer.css:91-108` (query de 480 px) e o commit `599fd17b`. O `title`/`aria-label` continuam completos. |
| 3 | "Tentar de novo" devolve a pergunta ao campo em vez de reenviar | **ABERTO (comportamento), coberto por D4** | `solto-erro-claro-380x800` e `solto-erro-escuro-380x800`: o botão "Tentar de novo" (97,9×25,6) e o `retrySidechat` (`sidechat.mjs:482-494`) seguem repondo a pergunta e focando, sem enviar; o estado depois do clique não foi capturado (seção 3). **D4 é decisão do autor** (recomenda manter A); não conta como achado desta nota. |

**Os 9 achados da rodada 3** rechecados na nota da rodada 4 continuam, com uma
mudança: **8 resolvidos e 1 parcial**. O parcial é o #2 (círculo do quiz), que
virou a borda do achado 1 desta rodada; o #3 (legenda "Só neste chat" sumindo e
escopo cortado) agora está **RESOLVIDO** (o escopo inteiro em 900/380/420 e a
legenda visível). Os outros sete seguem como na nota da rodada 4: #1 faixa
(2 px medido em `teclado-faixa-*`), #4 campo de 3 linhas (86 px nos quatro
tamanhos), #5 ações em uma linha (97,6/102,8 px em 900), #6 erro com
"Aviso"/ícone/`role=alert`/retry, #7 vazio "Pergunte sem mexer na sessão
principal." (4,95:1/6,72:1), #8 "Desligada" escuro a 5,05:1 e #9 "Concluir"
escuro a 5,14:1.

## 6. Decisões do autor

- **D1 (Converter síncrono):** fora deste recorte (Xournal++); não afeta a
  nota. **Decisão do autor.**
- **D2 (Cadernos a três cliques):** é da biblioteca de cadernos; não afeta a
  nota. **Decisão do autor.**
- **D3 (capas de caderno):** é da biblioteca de cadernos; não afeta a nota.
  **Decisão do autor.**
- **D4 ("Tentar de novo" no erro do chat lateral):** afeta Clarity/Feedback e o
  status do achado 3 da rodada 4. O autor recomenda **A** (manter: repor a
  pergunta e deixar a pessoa conferir e enviar), porque o canal tem envio
  incerto e reenviar sozinho pode duplicar a pergunta e gastar cota. A nota
  **não** conta o comportamento como defeito; a ressalva de que o rótulo
  "Tentar de novo" promete um reenvio e o código só repõe a pergunta fica
  registrada. **Decisão do autor.**

As decisões já fixadas para o chat solto (fechar a filha devolve o chat,
"sempre por cima" começa desligado, é um chat só movido para a filha) também
não são achados; a nota as trata como referência da casa.
