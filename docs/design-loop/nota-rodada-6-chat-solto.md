# Nota da rodada 6 — chat solto (#157)

Avaliação do recorte "Chat solto": a janela própria do chat lateral (resposta,
vazio, carregando e erro), a faixa "Chat em outra janela", soltar/trazer de
volta, "sempre por cima" e o chat preso na Mesa (resposta, cartões, cartão
respondido, copiado, envio incerto e 900×650). Base: as capturas novas de
`docs/design-loop/rodada-6/antes/chat-solto/` (PNG + JSON homônimo), o
inventário `docs/design-loop/inventario-chat-solto.md`, o CSS e o código em
`desk/src`. Não implementei nem corrigi nada; a nota é independente da rodada 5
e os status da seção 5 são uma reconferência contra as capturas desta rodada.

**Nota sobre a pasta.** A pasta tem **60 PNG + 60 JSON de medidas + 3 resumos
de teclado + `falhas.json` = 124 arquivos**, não os 61 PNG/126 do inventário;
`falhas.json` está vazio (`"failures": []`). O inventário ainda aponta as
capturas para `rodada-2/antes/chat-solto/` e mede a janela solta em 380×773 e
420×973; os JSON desta rodada medem **380×800 e 420×1000** (a filha é sem
moldura) e os 1440×873 e 900×623 da Mesa batem. O
`teclado-solto-10-sidechat-more` que o inventário lista **não existe**: o
roteiro real tem 9 controles (01 `close` a 09 `more`; o Enviar desligado com o
campo vazio não entra na ordem de Tab) e o `teclado-solto-resumo.json` traz 9.

O inventário é de rodada 2 e as cinco "Observações de UI" estão vencidas: (1) a
área vazia não aparece nas capturas novas — o leitor fixado cresce para ocupar
o slot recolhido (`readers.css:85`); (2) as ações de mensagem estão em
`--muted` cheio, 6,69:1 no claro e 6,93:1 no escuro, não em `opacity:.55` a
3,92:1; (3) o campo da filha tem anel de 2 px (`composer.css:184`), não só o
fio; (4) o escopo lê inteiro (225,5 px em 900×650, 352 px em 380 e 392 px em
420); (5) o erro tem "Aviso", ícone de alerta e `role=alert`, não é uma
resposta comum. O "toast Mensagem lateral copiada." e o "Enviar reabilitado no
erro" também não existem como descritos: o retorno do Copiar é inline
("Copiado", `sidechat-message-view.mjs:107-122`) e o `#sidechat-send` está
desligado no erro porque o campo está vazio — **os 33 JSON que trazem o
`#sidechat-send` o têm `disabled`**. O inventário mede o Enviar desligado do
incerto em 2,04:1/2,52:1; o JSON da rodada 6 mede 5,36:1/5,74:1 (isento, mas
passando).

## 1. Notas

Sub-partes: **A1** janela solta 380×800 (claro/escuro; o inglês de 380 entra
aqui); **A2** janela solta 420×1000; **B** faixa "Chat em outra janela"
(1440/900, claro/escuro, inglês em 900); **C** soltar/trazer (menus "Soltar em
outra janela" e "Trazer de volta" e a Mesa restaurada); **D** "sempre por cima"
(menu ligado + sinal do alfinete); **E** chat preso na Mesa (1440/900,
claro/escuro; resposta/cartões, cartão respondido, copiado em 1440, envio
incerto e inglês em 900); **F** vazio, carregando e erro na janela solta. A
coluna "Geral" é a leitura do recorte; a última linha é o Overall de cada
sub-parte. "—" em A1/A2 na linha Estados significa que vazio/carregando/erro
são avaliados na coluna F; A1/A2 avaliam a resposta, o teclado e a janela.

A nota de uma categoria num estado **sem captura** não é dada (seção 3).

| Categoria | A1 · solta 380 | A2 · solta 420 | B · faixa | C · soltar/trazer | D · por cima | E · preso (1440/900) | F · vazio/carregando/erro | Geral |
|---|---|---|---|---|---|---|---|---|
| Typography | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Hierarchy | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Spacing & density | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Color & contrast | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Iconography | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Consistency & polish | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Clarity | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Estados (vazio/carregando/erro) | — (F) | — (F) | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Feedback e movimento | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Acessibilidade | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| Janela pequena | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 |
| **Overall** | **9,0** | **9,0** | **9,0** | **9,0** | **9,0** | **9,0** | **9,0** | **9,0** |

**Overall do recorte: 9,0.** Os dois achados baixos da rodada 5 foram
corrigidos e medidos nesta rodada: a borda da opção do quiz saiu de
1,54:1/1,67:1 para 6,69:1/6,93:1 e o "Copiado" não desloca mais o "Levar"
(76,9 px nos dois estados, x=537,5 e 620,4 nas duas capturas). O que sobra são
quatro observações de detalhe, nenhuma bloqueante: a linha de escopo em duas
linhas alinha o grupo cadeado/legenda/ação à direita; o "Copiar" reserva
9,2 px (pt) / 10,3 px (en) para o "Copiado"; a borda da opção do quiz é a mais
forte do cartão (6,69:1/6,93:1, acima do mínimo de 3:1); e o foco do campo no
preso continua sendo o contorno de 1 px do painel, não o anel de 2 px da
filha. O escopo, o retorno inline do Copiar e o envio incerto seguem como na
rodada 5; o "Tentar de novo" é a decisão **D4** do autor e não conta como
achado. A base visual está polida; um designer sênior só mexeria nos quatro
detalhes acima.

**Lastro das notas (para nenhuma nota ficar sem medida):**

- **Typography 9,0 (todas):** corpo 15 px/24 px (1,6); papéis 11 px/600; título
  12 px/600; motor 11 px/600; escopo 11 px/15,4 px; nota 11 px; ações 11 px;
  menu 12 px; faixa 12 px/600; vazio 12 px; atividade 11 px; erro 15 px/24 px;
  pergunta do quiz 15 px/600; opções 15 px; "Concluir" 15 px; "Parar" 12 px/500.
  O piso é 11 px e os **47 JSON dos estados** (mais os 13 do teclado, 60 no
  total) não têm texto abaixo disso; `textsTruncated` é `false` em todos. O menor contraste
  de texto é **4,95:1** (papéis e placeholder no claro). Em 380/420/900 o
  escopo lê inteiro (352/392/225,5 px); em 900 o corpo de 214,5 px vira 3
  linhas de 24 px sem clipping. O inglês mantém as medidas ("Side chat"
  63,2 px, "Side chat only" 78,1 px, "Bring to the main session" 156,4 px).
- **Hierarchy 9,0 (todas):** cabeçalho, papel do falante (11 px/600), corpo
  (15 px), ações (11 px) e composer se leem nesta ordem; o cartão do quiz tem
  pergunta 15 px/600, opções 15 px e ações separadas; o escopo tem linha
  própria em 380/420/900 e a legenda/cadeado/ação descem juntos; em 1440 os
  quatro seguem na mesma linha. Em 900 o cabeçalho perde o selo do motor pela
  container query de 300 px (`support-sidechat.css:44`), mas o papel "OpenCode"
  segue no corpo e o nome da seção continua: o que se perde é redundante. F fica
  em 9,0 porque "Aviso" + ícone + texto vermelho + ações separa a falha da
  resposta; vazio e carregando têm hierarquia própria. Observação 1 (não
  conta): na linha quebrada o grupo cadeado/legenda/ação fica à direita, sob a
  parte direita do texto do escopo; é intencional no `a135c326` e não confunde.
- **Spacing & density 9,0 (todas):** campo 356×86 px (380), 396×86 px (420),
  499,5×86 px (1440 preso) e 229,5×86 px (900 preso), 3 linhas; escopo
  352/392/225,5/244 px de largura e 15,4 px de altura; nota 75,3 px (78,1 px no
  inglês); linha de ações 25,6 px; menu 230×28 px e popover 240×96 px; faixa
  33×829 px (1440) e 33×579 px (900); opções do quiz 473,5×35,8 px (1440),
  188,5×35,8 px (900) e 330×35,8 px (380); ações do quiz 77,6×38, 97×38 e
  83,4×38 px. Não há overflow horizontal: `scrollWidth` = 380/420/900/1440 em
  todos os 47 JSON. Em 380/420/900 o escopo ocupa 15,4 px acima do grupo
  cadeado/ação e não empurra o campo (textarea em y=672 no 380/420, y=478,4 no
  900, y=705 no 1440); no 1440 o escopo termina a 4 px da borda direita, com a
  linha única. Observação 1: o grupo em 380 começa em x=118,5, deixando
  106,5 px vazios à esquerda (146,5 px em 420 e 94,2 px em 900).
- **Color & contrast 9,0 (todas):** todo texto medido passa AA: corpo
  17,58:1 / 15,29:1; papéis e motor 4,95:1 / 6,72:1; "Copiar" 6,69:1 / 6,93:1;
  escopo e nota 6,69:1 / 7,39:1; placeholder 4,95:1 / 6,72:1; vazio 4,95:1 /
  6,72:1; atividade 6,69:1 / 7,39:1; aviso incerto 5,71:1 / 10,53:1; erro
  5,74:1 / 6,36:1; "Parar" 17,63:1 / 17,58:1; "Enviar" desligado 5,36:1 /
  5,74:1 (isento, mas passa); menu 17,58:1 / 11,48:1; estado "Desligada"
  4,95:1 / 5,05:1 (token `--faint`, #707070 sobre #fff e #a0a0a0 sobre #303030;
  sem mudança de token nesta rodada); "Ligada" no `--accent-text` 7,42:1 no
  claro e 5,79:1 sobre #303030 no escuro; faixa 18,88:1 / 16,48:1; "Concluir"
  7,42:1 / 5,14:1; círculo do quiz 6,69:1 / 6,93:1; borda da opção correta
  (22,163,74) sobre #fff = 3,30:1 no claro e (52,211,153) sobre #1f1f1f acima
  de 8:1 no escuro; texto da opção desabilitada 4,95:1 / 6,30:1. A borda da
  opção em repouso agora é `--muted`: #5c5c5c sobre #fff = **6,69:1** e
  #a8a8a8 sobre #1f1f1f = **6,93:1** (sondas de pixel em
  `preso-cartao-claro-1440x900`, `preso-cartao-escuro-1440x900`,
  `preso-cartao-claro-900x650` e `en-preso-cartao-light-900x650`). Nenhum texto
  abaixo de AA; o defeito de componente da rodada 5 está fechado. Observação 3
  (não conta): a opção é a borda mais forte do cartão, acima dos 3:1 exigidos.
- **Iconography 9,0 (todas):** ícones de 16 px em alvos de 28×28; copiar com
  glifo de 12 px; cadeado, atualizar e cópia de 12 px; alfinete de 14 px no
  cabeçalho; `textQuote`, `undo`, `external` e alfinete nos menus; alerta de
  14 px no erro; três pontos de 5 px no carregando; círculo de 14 px no quiz;
  ✓ de 15 px/700 no cartão respondido; chevron de 16 px na faixa. O conjunto
  está na mesma família e não desalinha em nenhum estado capturado.
- **Consistency & polish 9,0 (todas):** claro e escuro têm as mesmas formas; o
  menu é o mesmo `.chat-pop` do tutor; o chat preso e a janela solta usam o
  mesmo cabeçalho, papéis, ações e campo de 86 px nos quatro tamanhos; o rótulo
  curto "Levar à sessão" (97,6 px) só aparece abaixo de 300 px e mantém
  `aria-label`/`title` completos; o inglês usa "To main session" (102,8 px). O
  "Copiado" agora nasce com 76,9 px (pt) / 70,2 px (en) e o vizinho não anda:
  `preso-cartao-claro-1440x900` e `preso-copiado-claro-1440x900` têm o "Copiar/
  Copiado" em 537,5 e o "Levar" em 620,4 nas duas capturas. Observação 2 (não
  conta): a reserva deixa 9,2/10,3 px de folga à direita do rótulo visível.
- **Clarity 9,0 (todas):** "Atualizar contexto", "Levar à sessão principal"
  (com `title`), "Só neste chat", "Trazer de volta", "Soltar em outra janela",
  "Sempre por cima" e "Chat em outra janela" têm nome e dica; o menu diz o
  estado ("Desligada"/"Ligada"); o vazio diz "Pergunte sem mexer na sessão
  principal."; o escopo lê inteiro; o "Copiado" confirma no próprio botão. O
  "Tentar de novo" promete reenvio e o código só repõe a pergunta, mas isso é a
  **decisão D4 do autor** (recomenda manter); a nota não penaliza e a ressalva
  está na seção 6.
- **Estados 9,0 (B/C/D/E/F):** B é um estado bem comunicado (a faixa diz onde o
  chat está); C mostra "Soltar"/"Trazer de volta" e "Desligada"/"Ligada" na
  hora; D mostra o alfinete no cabeçalho; E mostra o cartão respondido (círculo
  cheio, ✓, "✓ Correta.", "Concluir"), o copiado inline e o incerto com **um**
  aviso (`Há uma entrega incerta neste chat lateral: confira antes de
  reenviar.`) e o Enviar desligado; F tem vazio, carregando (três pontos + linha
  de atividade + Parar + Enviar desligado) e erro único, vermelho,
  `role=alert`, ícone de alerta e "Tentar de novo". Nenhum estado do inventário
  ficou sem captura além dos listados na seção 3.
- **Feedback e movimento 9,0 (todas):** os anéis de foco de 2 px aparecem em
  todos os controles da filha, no cadeado, no refresh, no campo e no item de
  menu (`teclado-solto-resumo.json`: 9 controles, todos `focusVisible=true` e
  `outline=2px solid rgb(37,72,199)` no claro; no escuro o mesmo anel usa
  `rgb(143,168,255)`, como em `teclado-solto-menu-item-escuro`); a faixa pinta
  2 px por dentro nos dois temas (`teclado-faixa-resumo-*`); o menu atualiza o
  estado sem fechar e o Esc
  devolve o foco; o Copiar confirma no próprio botão sem deslocar o vizinho; o
  incerto responde com o aviso; o carregando usa três pontos com
  `prefers-reduced-motion` (`support-sidechat.css:93-94`). No preso, o foco do
  campo é o contorno de 1 px do painel (`#sidechat:focus-within::after`,
  `readers.css:128`) + o fio do composer; o JSON do campo dá `outline:3px
  none` e `box-shadow:none`, mas o contorno é visível e é o padrão da casa —
  observação 4, não achado.
- **Acessibilidade 9,0 (todas):** alvos ≥24 px em tudo (cabeçalho 28×28,
  Copiar 76,9×25,6 / 70,2×25,6, Levar 148,6×25,6 / 97,6×25,6, cadeado 24×24,
  refresh 134,2×24 / 24×24, campo 356×86/396×86/229,5×86/499,5×86, Enviar
  75,9×28, Parar 49,3×28, menu 230×28, faixa 33×829/579, "Tentar de novo"
  97,9×25,6, opções do quiz 35,8 de altura; `meets24:true` em todos os 47
  JSON); foco de 2 px na filha, no item de menu, no cadeado, no refresh e na
  faixa; nomes "Copiar sua pergunta"/"Copiar resposta"/"Copiar aviso"; cartões
  com `aria-labelledby`; escopo com `title`; quiz com `radiogroup`/`role=radio`
  e `aria-checked`; `aria-live` na lista; `aria-busy` no cartão ao vivo; erro
  com `role=alert`; carregando com `role=status`; aviso incerto dentro da região
  `aria-live`; alfinete com nome "Sempre por cima ligado". O cadeado é um
  `role=img` com `tabindex=0` (`teclado-solto-resumo`, passo 5): um stop a mais
  no Tab em troca de expor "Fora da sessão principal" — fica como troca, não
  como achado. Não houve sessão de leitor de tela; a nota usa `labels`/`role`
  do DOM (seção 3).
- **Janela pequena 9,0 (todas):** em 380/420 não há rolagem horizontal
  (`scrollWidth` = 380/420); o escopo lê inteiro e a nota/cadeado/refresh cabem
  na linha de baixo; em 900×650 a faixa tem 33×579, o menu de 240 px cabe na
  coluna de 260 px (pela conta; captura em falta, seção 3), o refresh vira
  ícone de 24×24, o campo do chat preso tem 229,5×86 e as ações ficam em uma
  linha (76,9 + 97,6 px); o quiz de 188,5 px de opção e as ações 77,6/97 px
  cabem. O 1440 preso tem campo 499,5 e escopo/nota/ação na mesma linha.

## 2. Achados

**Nenhum achado contado nesta rodada.** As quatro observações abaixo foram
medidas e ficam registradas como detalhe; a severidade "observação" significa
que elas não baixam a nota. A seção 5 mostra que os dois achados baixos da
rodada 5 estão resolvidos.

### 1. Linha de escopo quebrada alinha o grupo cadeado/legenda/ação à direita — Hierarchy / Consistency & polish · observação (não conta)

- **Tela:** `solto-resposta-claro-380x800`, `solto-resposta-claro-420x1000`,
  `preso-cartao-claro-900x650`, `en-preso-cartao-light-900x650` e
  `mesa-trazido-de-volta-claro-900x650`.
- **Evidência medida:** o cadeado começa em x=118,5 (380), 158,5 (420) e
  361,7 (900), enquanto o texto do escopo começa em 12/12/267,5;
  sobram 106,5 px, 146,5 px e 94,2 px vazios à esquerda da segunda linha. O
  grupo inteiro é empurrado por `.sidechat-scope-meta{margin-left:auto}`
  (`composer.css:87`, wrapper em `sidechat.mjs:91-94`). Em 1440 o grupo fica na
  mesma linha do texto (cadeado em x=787,5) e o efeito não aparece.
- **Sugestão:** se o autor quiser a legenda junto do texto na linha quebrada,
  deixar `margin-left:0` no grupo e `margin-left:auto` só no
  `#sidechat-refresh`, ou manter como está (o commit `a135c326` escolheu o
  grupo junto com a ação à direita).
- **Arquivo provável:** `desk/src/composer.css:87` e `desk/src/sidechat.mjs:91`.
- **Por que não conta:** o grupo é legível como rodapé de meta à direita, o
  cadeado/legenda continuam sob o texto e a leitura não se perde; é um detalhe
  de composição, não um defeito de uso.

### 2. O "Copiar" reserva 9,2 px (pt) / 10,3 px (en) para o "Copiado" — Consistency & polish · observação (não conta)

- **Tela:** `preso-cartao-claro-1440x900`, `preso-copiado-claro-1440x900`,
  `preso-copiado-escuro-1440x900` e `en-solto-resposta-light-380x800`.
- **Evidência medida:** o "Copiar" em repouso mede **76,9×25,6 px** (era
  67,7 px na rodada 5) e o "Copiado" mede 76,9×25,6 px em x=537,5 nas duas
  capturas; o "Levar à sessão principal" fica em **x=620,4 nas duas**, ou seja,
  o deslocamento de 9,2 px da rodada 5 é **0,0**. No inglês o botão vai de
  59,9 para 70,2 px (a célula reservada do rótulo mede 38,2 px). O efeito de reserva é
  `display:inline-grid` com o `::after` invisível (`support-sidechat.css:68-70`,
  `sidechat-message-view.mjs:74-76`).
- **Sugestão:** se quiser equilibrar, centralizar o conteúdo do botão
  (`justify-content:center` em `.sidechat-copy`) ou o rótulo na célula
  (`justify-items:center`); a reserva em si é a correção do achado 2 da rodada
  5.
- **Arquivo provável:** `desk/src/support-sidechat.css:63-70` e
  `desk/src/sidechat-message-view.mjs:74-76`.
- **Por que não conta:** o vizinho não anda mais e a folga de 9,2/10,3 px fica
  à direita do rótulo visível; é um detalhe de centralização, não um erro de
  layout.

### 3. A borda da opção do quiz agora é a mais forte do cartão (6,69:1/6,93:1, acima do mínimo de 3:1) — Color & contrast · observação (não conta)

- **Tela:** `preso-cartao-claro-1440x900`, `preso-cartao-escuro-1440x900`,
  `preso-cartao-claro-900x650`, `preso-cartao-respondido-claro-1440x900` e
  `en-preso-cartao-light-900x650`.
- **Evidência medida:** a opção em repouso usa `border:1px solid var(--muted)`
  (`tutor-chat.css:304`); o pixel é #5c5c5c (92,92,92) sobre #fff = **6,69:1**
  no claro e #a8a8a8 (168,168,168) sobre #1f1f1f = **6,93:1** no escuro. O
  círculo e a borda têm a mesma força; a opção correta usa o verde
  (22,163,74) = 3,30:1 no claro; as ações "Não sei"/"Dispensar" usam
  `--border` (bem mais claro). O cartão mede 473,5×35,8 px (1440), 188,5×35,8
  px (900) e 330×35,8 px (380).
- **Sugestão:** se a opção parecer pesada demais, usar um tom de 3:1–4,5:1
  (ex.: #767676 no claro) em vez de `--muted`, mantendo o círculo.
- **Arquivo provável:** `desk/src/tutor-chat.css:304`; token
  `desk/style.css:23`.
- **Por que não conta:** o achado 1 da rodada 5 era a borda a 1,54:1/1,67:1;
  agora ela passa AA com folga e o círculo continua sendo a affordance. A força
  é uma escolha visual; não há falha de contraste nem de alvo.

### 4. Foco do campo no chat preso continua sendo o contorno de 1 px do painel — Feedback e movimento / Acessibilidade · observação (não conta)

- **Tela:** `mesa-trazido-de-volta-claro-1440x900`,
  `mesa-trazido-de-volta-claro-900x650`,
  `mesa-trazido-de-volta-escuro-1440x900` e `preso-cartao-claro-900x650`.
- **Evidência medida:** o JSON do campo dá `focusVisible:true`, `outline:3px
  none` e `box-shadow:none`; o sinal visível é o `#sidechat:focus-within::after`
  de 1 px (`readers.css:128`) + o fio do composer. Na filha o mesmo campo tem
  `outline:2px solid rgb(37,72,199)` (`composer.css:184`; o JSON de
  `solto-resposta-*` confirma). O contorno do painel é visível nas capturas
  (`mesa-trazido-de-volta-claro-900x650`, linha azul no painel) e é o padrão da
  casa.
- **Sugestão, se o autor quiser unificar:** dar ao campo do preso o mesmo anel
  de 2 px da filha, em vez de só o contorno do painel.
- **Arquivo provável:** `desk/src/readers.css:128` e
  `desk/src/composer.css:184`.
- **Por que não conta:** é visível e medido; a diferença de 1 px para 2 px é
  uma escolha de padrão, não uma falha de foco (o foco aparece nos dois temas).

## 3. SEM CAPTURA

Estados do inventário sem PNG; a nota da categoria naquele estado **não** é
dada:

- **Estado `unavailable`** (ponte `window.desk.sidechat*` ausente, texto em
  `renderUnavailable`): **SEM CAPTURA**. Exigiria um host sem a ponte do
  lateral; o inventário o deixa fora do recorte. Invalida Estados e
  Acessibilidade nesse estado.
- **Hover das ações de mensagem** ("Copiar"/"Levar à sessão principal" e o
  "Tentar de novo"/"Copiar aviso" do erro): **SEM CAPTURA**. O clique do
  "Copiar" aparece em `preso-copiado-*`, mas o hover em repouso não foi
  congelado; a nota de Feedback usa o repouso e o `:focus-within`.
- **Hover das opções do quiz, do "Não sei"/"Dispensar" e dos itens do menu:**
  **SEM CAPTURA**; a nota usa o repouso e o CSS (`tutor-chat.css:305`,
  `.chat-pop`).
- **Enviar habilitado (campo com rascunho) e sua parada de Tab:** **SEM
  CAPTURA**. O `#sidechat-send` está `disabled` nos **33 JSON** que o têm; não
  há captura do botão habilitado nem do Tab até ele. Invalida o visual do
  Enviar habilitado em A1/A2/E/F.
- **Retry clicado (campo reposto + Enviar habilitado):** **SEM CAPTURA**; a
  prova do comportamento é o código (`sidechat.mjs:482-494`), não uma captura
  depois do clique. D4 cobre a decisão.
- **`teclado-solto-10-sidechat-more`:** **SEM CAPTURA** como arquivo; o estado
  "Mais opções" está coberto por `teclado-solto-09-sidechat-more`. É uma
  inconsistência de numeração/contagem do inventário (60 PNG, não 61), não um
  estado ausente. O resumo tem 9 controles, não 10.
- **"Copiado" em 900×650 (claro e escuro) e na filha (380/420):** **SEM
  CAPTURA**; só há `preso-copiado-claro/escuro-1440x900`. A reserva de largura
  é a mesma nos quatro tamanhos pelo CSS e pelos 76,9/70,2 px do repouso.
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
  mas não foi provado. O teclado do menu preso também não foi capturado.
- **Menus "Trazer de volta"/"Sempre por cima" em 420×1000:** **SEM CAPTURA**;
  os menus da filha só existem em 380×800 (claro/escuro), e o inglês também só
  em 380.
- **Foco da faixa "Chat em outra janela" em 900×650:** **SEM CAPTURA**; o
  `teclado-faixa-*` só tem 1440×900. O CSS é o mesmo (`outline-offset:-2px`),
  mas o estado não foi congelado no tamanho mínimo.
- **Foco de teclado nas opções do quiz, no "Concluir" e no "Dispensar":** **SEM
  CAPTURA**; o anel de 2 px das opções está no CSS (`tutor-chat.css:308`) e o
  "Concluir" prova o `.primary`, mas nenhum dos dois foi congelado com foco.
- **"Outra resposta" (`quiz-free`) vazio, preenchido e focado:** **SEM
  CAPTURA**; a borda mudou para `--muted` junto com as opções, mas o campo não
  aparece em nenhuma captura.
- **Vazio, carregando e erro na coluna presa:** **SEM CAPTURA**; o inventário
  só define esses estados na janela solta. O componente é o mesmo, mas o
  tamanho de 900×650 não foi congelado neles.
- **Movimento/transição** de soltar, trazer de volta, abrir o menu, o flash do
  "Copiado" e os três pontos: **SEM CAPTURA** (PNGs estáticos). O
  `prefers-reduced-motion` dos três pontos existe no CSS
  (`support-sidechat.css:93-94`), mas não foi capturado.
- **Leitor de tela em execução:** **SEM CAPTURA**; os nomes/roles vêm do DOM
  (`labels` do JSON), não de uma sessão de leitor de tela.
- **"Sempre por cima" no nível do sistema operacional:** o JSON registra
  `alwaysOnTop:true`, `desk.sidechatAlwaysOnTop:true` e o alfinete, mas não há
  captura da janela sobre outra janela; a prova é o estado do host, não a
  sobreposição real.
- **A contagem de 61 PNG/126 arquivos, o `teclado-solto-10` e o "toast
  Mensagem lateral copiada.":** não existem; a pasta tem 60/124, o roteiro tem
  9 controles e o retorno é inline (Nota sobre a pasta). Não é um estado
  ausente, é uma divergência do inventário.

## 4. Imagens

**Vi as imagens.** Abri **30 dos 60 PNGs** com a ferramenta de leitura:
`solto-resposta-claro-380x800`, `solto-resposta-escuro-380x800`,
`solto-resposta-claro-420x1000`, `preso-cartao-claro-900x650`,
`preso-cartao-claro-1440x900`, `preso-cartao-escuro-900x650`,
`mesa-faixa-claro-1440x900`, `mesa-faixa-claro-900x650`,
`mesa-faixa-escuro-900x650`, `solto-menu-trazer-claro-380x800`,
`solto-menu-por-cima-claro-380x800`, `solto-por-cima-sinal-claro-380x800`,
`solto-vazio-claro-380x800`, `solto-carregando-claro-380x800`,
`solto-erro-claro-380x800`, `preso-cartao-respondido-claro-900x650`,
`preso-copiado-claro-1440x900`, `preso-incerto-claro-900x650`,
`preso-cartao-respondido-escuro-900x650`, `preso-incerto-escuro-1440x900`,
`mesa-trazido-de-volta-claro-900x650`, `en-solto-resposta-light-380x800`,
`en-preso-cartao-light-900x650`, `en-faixa-light-900x650`,
`en-menu-soltar-light-900x650`, `solto-menu-trazer-escuro-380x800`,
`mesa-menu-soltar-claro-1440x900`,
`teclado-solto-05-sidechat-scope-lock-claro-380x800`,
`teclado-solto-menu-item-escuro-380x800` e `solto-erro-escuro-380x800`. Nos
**30 PNGs restantes** avaliei pelos JSON homônimos, pelo CSS/código e por
sondas de pixel; não inventei o que não vi. Li os **60 JSON de medidas**, os
**3 resumos de teclado** e o `falhas.json` (vazio). Por análise de pixel
(decodificador PNG do próprio repo, `tests/png-pixels.mjs`) confirmei a borda
da opção do quiz (#5c5c5c no claro, (168,168,168) no escuro), a borda verde da
opção correta ((22,163,74) no claro e (52,211,153) no escuro) e a opção
desabilitada; os demais contrastes vêm direto do `contrast` dos JSON.

## 5. Achados da rodada 5

Os três itens de `docs/design-loop/nota-rodada-5-chat-solto.md`, reconferidos
contra as capturas desta rodada:

| # | Achado da rodada 5 | Status | Prova na rodada 6 |
|---:|---|---|---|
| 1 | Borda da opção do quiz a 1,54:1 no claro e 1,67:1 no escuro (o círculo já estava em 6,69:1) | **RESOLVIDO** | `preso-cartao-claro-1440x900`, `preso-cartao-escuro-1440x900`, `preso-cartao-claro-900x650` e `en-preso-cartao-light-900x650`: o pixel da borda em repouso é #5c5c5c sobre #fff = **6,69:1** e #a8a8a8 sobre #1f1f1f = **6,93:1**; o círculo segue 6,69:1/6,93:1; a opção correta é (22,163,74) = 3,30:1 no claro. `tutor-chat.css:304` agora usa `var(--muted)`, não `--border-strong` (commit `a135c326`). |
| 2 | "Copiado" alarga o botão de 67,7 para 76,9 px e desloca o "Levar" em 9,2 px | **RESOLVIDO** | `preso-cartao-claro-1440x900`: "Copiar" 76,9 px em x=537,5 e "Levar" em x=620,4; `preso-copiado-claro-1440x900`: "Copiado" 76,9 px em x=537,5 e "Levar" em x=620,4 — **0,0 px** de deslocamento (era 9,2). O `::after` invisível reserva a largura (`support-sidechat.css:68-70`; `sidechat-message-view.mjs:74-76`). O botão em repouso passou de 67,7 para 76,9 px; o inglês, de 59,9 para 70,2 px. |
| 3 | Observação que não contava: foco do campo no preso é 1 px no painel | **ABERTO (observação, não achado)** | `mesa-trazido-de-volta-claro-1440x900` e `preso-cartao-claro-900x650`: o JSON do campo segue `outline:3px none`/`box-shadow:none`; o sinal é o contorno de 1 px de `readers.css:128` + o fio do composer. Na filha, `solto-resposta-*` tem `outline:2px solid rgb(37,72,199)` (`composer.css:184`). A diferença continua registrada; não baixa a nota. |

**Os três itens da rodada 4** que a nota da rodada 5 rechecou continuam com o
mesmo desfecho: #1 (borda do quiz) **RESOLVIDO** (é o #1 acima); #2 (escopo de
84,2 px em 900×650) **RESOLVIDO** (o escopo mede 225,5×15,4 px em 900×650,
352 px em 380 e 392 px em 420, inteiro); #3 ("Tentar de novo" repõe em vez de
reenviar) **ABERTO como comportamento, coberto por D4** — `solto-erro-claro/
escuro-380x800` mostram o botão (97,9×25,6) e o código de `sidechat.mjs:482-494`
segue repondo e focando, sem enviar. **D4 é decisão do autor** (recomenda
manter A); não conta como achado desta nota.

## 6. Decisões do autor

- **D1 (Converter síncrono):** fora deste recorte (Xournal++); não afeta a
  nota. **Decisão do autor.**
- **D2 (Cadernos a três cliques):** é da biblioteca de cadernos; não afeta a
  nota. **Decisão do autor.**
- **D3 (capas de caderno):** é da biblioteca de cadernos; não afeta a nota.
  **Decisão do autor.**
- **D4 ("Tentar de novo" no erro do chat lateral):** afeta Clarity/Feedback e o
  status do #3 da rodada 4. O autor recomenda **A** (manter: repor a pergunta e
  deixar a pessoa conferir e enviar), porque o canal tem envio incerto e
  reenviar sozinho pode duplicar a pergunta e gastar cota. A nota **não** conta
  o comportamento como defeito; a ressalva de que o rótulo "Tentar de novo"
  promete um reenvio e o código só repõe a pergunta fica registrada. **Decisão
  do autor.**

As decisões já fixadas para o chat solto (fechar a filha devolve o chat,
"sempre por cima" começa desligado, é um chat só movido para a filha) também
não são achados; a nota as trata como referência da casa.
