# Nota da rodada 5 — cadernos

**Recorte:** #133 (biblioteca de cadernos `.xopp` + plugin MesaPagina), #135
(`ler_caderno` no diário do chat) e #158 (busca no texto dos cadernos e leitura
da tinta). **Capturas:** `docs/design-loop/rodada-5/antes/cadernos/` (173 PNG +
173 `.json` de medidas + `_falhas.json` vazio = 347 arquivos, como o inventário
declara). **Base do checkout:** `504badf4` ("capturas da rodada 5 (antes)"),
que já inclui `2e3e359f` (busca legível e inerte + limpar próprio) e `599fd17b`
(escopo do chat lateral). **Nota escrita em:** 2026-11-09.

**Método:** 30 PNGs abertos (lista na seção 4) + os 173 `.json` de medidas em
lote (contraste, fonte, alvos, foco, rótulos) + CSS/JS de `desk/`. Os dois
achados desta rodada só aparecem nos pixels: o kit de captura mede cor e fundo
computados, mas **não aplica a `opacity` do próprio elemento** ao texto
(`desk/tests/capture-ciclo2-cadernos-kit.mjs:143,162`); por isso o `.json`
mostra 5,79–6,93:1 onde o PNG renderiza 2,05–2,81:1. Amostrei os pixels de
`plugin-instalando-light`, `plugin-instalando-dark`, `tinta-sem-chave-light` e
`tinta-sem-chave-dark` para fechar a conta. O movimento está congelado
(`freezeMotion`): "Feedback e movimento" foi julgado pelas pistas visíveis
(spinner, toast, `aria-busy`, `aria-live`) e pelo CSS, não por quadros de
animação. A referência da casa (tema inspirado no Claude Desktop, cinzas
neutros, composer colado na coluna, sem canvas de tinta e leitura da tinta
desligada por padrão) não conta como achado.

**Resumo:** os dois achados da rodada 4 fecharam — as linhas de "Buscando…"
ficaram em contraste cheio, `inert` e `aria-busy`, e o "×" nativo virou um
botão de 24×24 com "Limpar busca" na rota de Tab. O recorte continua em **8,5**
por dois detalhes baixos que o `.json` não via: o "Instalando…" do plugin e o
rótulo do interruptor desabilitado ainda herdam `opacity` de botão desabilitado
e caem a **2,69:1/2,81:1** (plugin) e **2,05:1/2,50:1** (tinta) no pixel
renderizado. São componentes inativos (o WCAG 1.4.3 os isenta), mas são o rótulo de
progresso (plugin) e o nome do controle (tinta) naqueles estados e a casa já mantém texto
desabilitado legível no composer (`opacity:1` + `--faint`/`--muted`,
`desk/src/composer.css:255-265`). Fora disso, o caminho feliz da biblioteca, do
plugin, da busca, do diário e da tinta está consistente.

## 1. Notas

Sub-partes: **#133** biblioteca + plugin MesaPagina; **#135** `ler_caderno` no
diário; **#158** busca no texto e leitura da tinta. A coluna "Geral" é a leitura
do recorte. "—" não se aplica. A nota de uma categoria num estado **sem
captura** não é dada (seção 3).

| Categoria | #133 biblioteca + plugin | #135 `ler_caderno` | #158 busca + tinta | Geral |
|---|---|---|---|---|
| Typography | 9,0 | 9,0 | 9,0 | 9,0 |
| Hierarchy | 9,0 | 9,0 | 9,0 | 9,0 |
| Spacing & density | 9,0 | 9,0 | 9,0 | 9,0 |
| Color & contrast | 9,0 | 9,0 | 9,0 | 9,0 |
| Iconography | 9,0 | 9,0 | 9,0 | 9,0 |
| Consistency & polish | 8,5 (1) | 9,0 | 8,5 (2) | 8,5 |
| Clarity | 9,0 | 9,0 | 9,0 | 9,0 |
| Estados (vazio/carregando/erro) | 9,0 | 9,0 | 9,0 | 9,0 |
| Feedback e movimento | 9,0 | 9,0 | 9,0 | 9,0 |
| Acessibilidade | 8,5 (1) | 9,0 | 8,5 (2) | 8,5 |
| Janela pequena | 9,5 | 9,0 | 9,0 | 9,0 |
| **Overall** | **8,5** | **9,0** | **8,5** | **8,5** |

**Lastro dos 9,0 e dos 9,5.**

- **Typography (#133/#135/#158):** a escala é 12/700 (título do popover),
  13/600 (título do caderno), 12/600 (interruptor), 12,5 (diário), 12/400
  (trecho, erro, vazio), 11/400–600 (meta, grupo, estado, contagem, recusa) e
  mono 12,5 no detalhe técnico. Nenhuma caixa de texto excede a região medida
  nos 173 `.json` (`textos[]` fora da região = 0) e o `en` cabe nas mesmas
  caixas: `plugin-different-en` ("installed, different version" 144×13 +
  "version 1.0.0 in the folder" 142×13 + "Update plugin" 104×30 dentro dos 498
  px da linha), `busca-com-resultados-en` ("3 results" 339×13) e
  `tinta-status-erro-en` ("Handwriting read error" 125×24 com quebra).
- **Hierarchy:** o título do popover (12/700) vence o grupo (11/600 caixa
  alta), que vence o nome do caderno (13/600) e a meta (11/400); na busca, o
  campo vem antes do status (11) e o resultado mostra título (13/600), meta
  (11) e trecho (12) nessa ordem; no diário, a cabeça do turno (12/400) fica
  acima do passo (12,5) e do detalhe técnico (11); na tinta, o interruptor
  (12/600) vem antes da descrição (11) e do status (11). As recusas do plugin
  usam a frase do motivo (11) e a do próximo passo (11) em linhas separadas de
  100% da largura, sem ação.
- **Spacing & density:** linhas de 49 px, resultados de 68, grupo de 21, gap de
  6; popover 367×397 em 1440 e 340×399 em 900; linha do plugin 498×30–37;
  painel da tinta 238–344; o toast de `plugin-instalado-aviso` fica fora do
  diálogo (x≈752–888 em 900×650) e nenhuma região sai da janela (173/173). No
  900×650 com busca, a última linha da biblioteca é cortada pelo fim da área
  rolável (`busca-buscando-dark-900x650`); é o comportamento normal do
  `overflow:auto`, com barra visível e o painel da tinta fixo abaixo.
- **Color & contrast:** 1.256 nós de texto medidos, **0 reprovações AA pelos
  valores computados**. O menor texto ativo é o `<mark>` da busca: 4,83:1 no
  claro (`#5c5c5c` sobre `#eedb8e`) e 4,99:1 no escuro (`#fff` sobre
  `#7e6f34`); o vazio/`--faint` é 4,95:1 no claro (`#707070` sobre `#fff`) e
  5,05:1 no escuro (`#a0a0a0` sobre `#303030`); o erro da tinta 5,74:1 (claro)
  e 5,96:1 (escuro); o aviso/recusa do plugin 5,55–6,69:1; o erro do plugin 5,33:1
  (claro) e 9,41:1 (escuro); a ação azul 7,42:1
  no claro e 5,79:1 no escuro; o link sobre o hover do aviso do plugin 6,57:1
  no claro e 4,99:1 no escuro. Os dois achados de opacidade (2,05–2,81:1) são
  de componente inativo e estão na seção 2/Acessibilidade, não neste token.
- **Iconography:** Lucide coerente — livro em `ler_caderno`, check/alerta no
  estado do turno, chevron no diário, × no fechar e no limpar; spinner de 3
  pontos (`ts-dots`) na instalação e no `Buscando…`; pontos de status do plugin
  (`muted`, `busy`, `ok`, `new`, `warn`) todos `aria-hidden` porque o texto ao
  lado carrega o estado. Nenhum ícone de chave de fenda no passo de
  `ler_caderno` (N14 da rodada 2 segue fechado).
- **Consistency & polish:** os estados do plugin usam o mesmo molde (ponto +
  estado + versão + ação + linha de reiniciar/próximo passo); a instalação usa
  `Instalando…` com `disabled` + `aria-busy`, o erro usa `role=alert` sem
  toast, as recusas escondem o botão e mostram o próximo passo. A busca usa o
  mesmo `ts-dots` da instalação e o mesmo padrão de hover das linhas; o painel
  da tinta usa os mesmos tokens de superfície/borda. O × de limpar entrou no
  mesmo desenho do × do popover (mesmo ícone; 24 vs 28 px de alvo, ambos
  dentro do mínimo). Os dois desvios são os achados 1 e 2 — texto de botão
  desabilitado abaixo do padrão de leitura que o composer já pratica.
- **Clarity:** os textos dizem o estado e a ação — "Atualizar plugin" com
  "versão 1.0.0 na pasta", "Renomeie ou remova a pasta MesaPagina e reabra o
  Sobre." (`modified`), "Mova a pasta…" (`foreign`), "Troque o link…"
  (`symlink`), "Tentar ler de novo" + "Tentar desligar de novo" na tinta,
  "Nenhum resultado. Tente outro termo.", "3 resultados", "Pausado: sem cota",
  "Em dia", "Limpar busca". A3 da rodada 3 segue fechada: a recusa explica o
  motivo e o que fazer.
- **Estados:** os 26 estados do inventário (25 séries de captura) têm foto
  (`_falhas.json` vazio): biblioteca cheia/vazia, plugin não
  instalado/instalando/instalado/aviso/erro/different/modified/foreign/symlink,
  `ler_caderno` andamento/ok/erro, busca vazia/buscando/sem resultado/com
  resultado, tinta desligada/sem chave/Claude/lendo/ligada/cota/erro/status-erro,
  2 hovers e 10 rotas de teclado. O que não existe de propósito está na seção 3.
  O estado "Buscando…" agora mantém as linhas em contraste cheio e inertes; o
  estado existe e funciona (achado da rodada 4 fechado).
- **Feedback e movimento:** spinner de 3 pontos na instalação e na busca,
  `aria-busy` no botão e na lista, `role=status`/`aria-live` na busca e no
  status da tinta, `role=alert` no erro inline, toast de sucesso do plugin
  (fora do diálogo), hover medido (linha `#e6e6e6` no claro e
  `rgba(255,255,255,.09)` no escuro; interruptor idem), foco de 2 px. O
  movimento em si está congelado; a presença e o lugar das pistas foram
  conferidos. A legibilidade do "Instalando…" fica no achado 1.
- **Acessibilidade #133 (8,5):** 616 alvos nos `.json` (15 a mais que a rodada
  4: os botões de limpar), **0** com `abaixo24`; fechar 28×28, linhas 349×49,
  interruptor 335×28, ações do plugin 104–169×30, retry 374×30, limpar 24×24,
  × do Sobre 28×28. Rótulos acessíveis vazios = 0. As 8 capturas de teclado do
  plugin (2 bases × 4) têm `focusVisible=true` e anel de 2 px. Perde 1,0 no
  achado 1 (texto do botão em `Instalando…` a 2,69:1/2,81:1 no pixel; 1.4.3
  isenta componente inativo, mas é o único rótulo de progresso).
- **Acessibilidade #135 (9,0):** as 8 capturas de teclado do diário (2 bases ×
  4) têm `focusVisible=true`, anel de 2 px (claro `#2548c7`, escuro `#8fa8ff`);
  a cabeça mede 366×24–28 (≥24) e o passo 357×29–118; os nomes acessíveis dos
  passos são curtos ("Ler o caderno: aula-nova.xopp, página 1") e o JSON cru
  fica no bloco técnico, fora do nome (N9). O `rotulo` do kit é concatenação de
  `textContent`; ele não prova o nome que o leitor de tela calcula (ver a
  cobertura parcial na seção 3), por isso não virou achado.
- **Acessibilidade #158 (8,5):** os mesmos 616 alvos e as 24 capturas de
  teclado da busca/tinta (6 bases × 4) têm foco visível; o interruptor tem
  `role=switch`, `aria-checked` e `aria-describedby`; a busca tem
  `role=status`, o limpar tem nome e entra no Tab logo após o campo; a tinta
  tem `aria-live`. Perde 0,5 no achado 2 (rótulo do interruptor desabilitado a
  2,05:1/2,50:1 no pixel).
- **Janela pequena:** o popover usa `max-height:min(64vh,440px)` e rola por
  dentro; em 900×650 ele mede no máximo 340×399 (tinta-status-erro 340×344), o
  Sobre cabe (540×457 em x=180–720, y=83–540) e o toast de sucesso fica à
  direita do diálogo (x≈752–888), sem cobri-lo; o diário rola no `#messages`;
  nenhuma região sai da janela. O #133 leva 9,5 porque, além disso, a lista
  mantém 2 grupos e 3 linhas visíveis na largura de 340 e o painel da tinta
  cabe inteiro nos 399 px.

## 2. Achados

### 1 — baixa — #133 — Acessibilidade / Consistência — o "Instalando…" do plugin renderiza a 2,69:1 (claro) e 2,81:1 (escuro)

Capturas: `plugin-instalando-light-1440x900.png`,
`plugin-instalando-dark-1440x900.png` (e as duas `-900x650`).
Medido: o `.json` registra o texto `#2548c7` sobre `#f1f1f1` = **6,57:1** no
claro e `#8fa8ff` sobre `#303030` = **5,79:1** no escuro, mas esses são os
valores *computados*, sem a `opacity` do botão. O PNG mostra o `Instalando…`
em `#879be0` sobre `#fff` = **2,69:1** no claro e `#6472a2` sobre `#303030` =
**2,81:1** no escuro; os 3 pontos do spinner saem `#a6a6a6` sobre `#fff` =
**2,43:1**. A causa é `.component-update[disabled]{opacity:.55}`
(`desk/src/help-about.css:164`), que o botão em voo herda, e o kit de captura
não aplica `opacity` do próprio elemento (`capture-ciclo2-cadernos-kit.mjs:162`).
O texto de estado "não instalado" ao lado continua em 6,69:1/5,55:1, mas o
progresso em si é o texto menos legível da linha. O WCAG 1.4.3 isenta texto de
componente inativo; ainda assim é um detalhe visível e o único rótulo de
carregamento. O `Instalar plugin da página` desabilitado do estado de erro tem
o mesmo problema (2,72:1 no claro); ali a ação inativa é coberta pelo "Tentar
de novo" (6,93:1), então não abro um segundo achado. O conserto não deve
levantar a opacidade do erro, só a do estado ocupado.
Sugestão: `.component-plugin-install[aria-busy="true"]{opacity:1;color:var(--accent-text)}`
(e, se preciso, os pontos do spinner em `--muted`), mantendo `disabled` e
`aria-busy`; o spinner e o rótulo voltam ao contraste cheio do estado ativo.
Arquivo: `desk/src/help-about.css:164`; o `aria-busy` é posto em
`desk/src/dialogs.mjs:308`.

### 2 — baixa — #158 — Acessibilidade / Consistência — o rótulo do interruptor desabilitado cai a 2,05:1 (claro) e 2,50:1 (escuro)

Capturas: `tinta-sem-chave-dark-1440x900.png`, `tinta-claude-light-1440x900.png`
(e as duas `-900x650`).
Medido: o `.json` registra `Ler a escrita à mão` em `#5c5c5c` sobre `#fff` =
**6,69:1** no claro e `#a8a8a8` sobre `#1f1f1f` = **6,93:1** no escuro, mas o
PNG mostra o rótulo em `#b5b5b5` sobre `#fff` = **2,05:1** no claro e
`#5d5d5d` sobre `#1f1f1f` = **2,50:1** no escuro. A causa é o
`button:disabled{opacity:.45}` global (`desk/style.css:191`); a regra específica
do interruptor só troca `color` e `cursor`
(`desk/src/conversations-dividers.css:88`). A descrição abaixo ("Sem modelo
com visão…" / "Com o Claude…") fica no contraste cheio (6,69:1/6,93:1) e
explica o motivo; o nome do controle é o texto menos legível do painel justo
quando ele está indisponível. Vale para `tinta-sem-chave` e `tinta-claude`.
Componente inativo (1.4.3 isenta), mas o composer já mantém os desabilitados
legíveis com `opacity:1` + `--faint`/`--muted` (`desk/src/composer.css:255-265`).
Sugestão: `.notebooks-ink-switch:disabled{opacity:1}` (o `color:var(--muted)` e
o trilho `--faint` já dão o aspecto desligado), ou usar um token de texto cheio
no lugar da opacidade global.
Arquivo: `desk/src/conversations-dividers.css:88` e `desk/style.css:191`.

## 3. SEM CAPTURA

Estados do inventário sem captura — não entram na nota daquele estado. O
`_falhas.json` está vazio; os dois são declarados fora do recorte (não são UI da
Mesa).

| Estado | Por que não há captura | O que fica fora |
|---|---|---|
| Abrir o caderno no Xournal++ | A ação fecha o popover e abre outro programa; a janela do Xournal++ não é UI da Mesa (o teste usa `fake-xournalpp.mjs`). | O retorno visual da abertura e o estado do popover depois do clique. A prova da abertura e da página é o IPC (`tests/notebooks-ui.mjs`). |
| Comportamento do plugin dentro do Xournal++ (Ctrl+Alt+R/B, converter, trocar fonte) | É UI do Xournal++ com o plugin carregado, fora da janela da Mesa. | Toda a interação do plugin no programa de escrita. A nota do #133 cobre só a linha do Sobre e a instalação. |

**Cobertura parcial (não é "sem captura", mas limita o que se pode afirmar):**

- o teclado só tem PT (claro/escuro × 1440×900 e 900×650) e o hover, PT
  (claro/escuro) só em 1440×900; as variantes `en` cobrem os estados-base, não
  o teclado/hover;
- as capturas de `plugin-different/modified/foreign/symlink` vêm do IPC falso
  `components`, que devolve só a linha do Xournal++: não se pode julgar o
  diálogo do Sobre inteiro nessas quatro variantes, só a linha e a ação;
- as capturas de teclado do diário (`teclado-ler-caderno-*`) saíram com o
  diário em inglês ("Worked for 13s · 1 tool", "Read the notebook…"), apesar de
  o `.json` registrar `idioma: pt-BR`. É artefato de captura (o rótulo foi
  pintado no último estado `en` da série); os estados PT normais estão em
  `ler-caderno-ok-light-1440x900` e `ler-caderno-andamento-light-1440x900`;
- em `ler-caderno-erro-en`, o detalhe do `toolResult` sintético está em
  português ("Página 2 não existe..."); é dado do histórico sintético, não uma
  string fixa do `worklog-view`;
- o `rotulo` do kit é `aria-label`/`aria-labelledby`/`title`/`placeholder`/
  `textContent`; ele não é o nome que o leitor de tela calcula. Por isso o
  "Lendo o caderno1s" do cabeçalho vivo (concatenação sem espaço) ficou como
  limitação de medição, não como achado;
- `tinta-erro` e `tinta-status-erro` combinam o status do vigia com uma falha
  real do `notebooks-ink-set`; o vigia real não é exercitado nesta captura (ele
  tem provas próprias em `.test.mjs`);
- o kit de captura não aplica a `opacity` do próprio elemento no contraste
  (`capture-ciclo2-cadernos-kit.mjs:162`): os valores de texto de botão
  desabilitado no `.json` são otimistas. Os dois achados desta rodada vieram
  dos pixels; por isso a nota não se apoia só no JSON.

## 4. O que eu vi

**Abri 30 PNGs** (de 173); nas 143 restantes usei o `.json` de medidas, o CSS e
o JS, sem afirmar o que só a imagem mostraria. Os 30:

- **biblioteca:** `biblioteca-lista-light-1440x900`,
  `biblioteca-lista-dark-900x650`, `biblioteca-vazia-dark-1440x900`,
  `busca-vazia-light-1440x900`.
- **plugin:** `plugin-nao-instalado-light-1440x900`,
  `plugin-instalando-light-1440x900`, `plugin-instalado-light-1440x900`,
  `plugin-instalado-aviso-dark-900x650`, `plugin-erro-light-1440x900`,
  `plugin-different-light-1440x900`, `plugin-modified-light-1440x900`,
  `plugin-foreign-dark-1440x900`, `plugin-symlink-dark-900x650`.
- **busca:** `busca-buscando-light-1440x900`,
  `busca-buscando-dark-900x650`, `busca-sem-resultado-dark-1440x900`,
  `busca-com-resultados-light-1440x900`,
  `busca-com-resultados-dark-900x650`.
- **diário:** `ler-caderno-andamento-light-1440x900`,
  `ler-caderno-ok-dark-900x650`, `ler-caderno-erro-light-1440x900`.
- **tinta:** `tinta-desligada-padrao-light-1440x900`,
  `tinta-sem-chave-dark-1440x900`, `tinta-claude-light-1440x900`,
  `tinta-lendo-light-1440x900`, `tinta-ligada-dark-1440x900`,
  `tinta-quota-dark-900x650`, `tinta-erro-light-1440x900`,
  `tinta-status-erro-light-900x650`.
- **foco:** `teclado-cadernos-busca-light-1440x900`,
  `teclado-tinta-interruptor-light-1440x900`.

Ampliei recortes de `busca-buscando-light-1440x900`,
`busca-buscando-dark-900x650` e `tinta-status-erro-light-900x650` para ler o ×
do campo e os dois erros da tinta; não são estados novos. Para os achados 1 e 2
amostrei os pixels de `plugin-instalando-light`, `plugin-instalando-dark`,
`tinta-sem-chave-light` e `tinta-sem-chave-dark` (não abri a imagem inteira de
`plugin-instalando-dark` nem de `tinta-sem-chave-light`; os valores vêm da
amostra, não do olho). `busca-vazia`, `hover-linha-caderno`,
`hover-tinta-interruptor`, `tinta-status-erro-light-1440x900` e os quatro
`plugin-instalado-aviso` foram julgados pelo `.json` e pelo CSS; não os abri.

## 5. Achados da rodada 4

**Status:** 2 RESOLVIDOS, 0 PARCIAIS, 0 ABERTOS. A tabela cita a captura nova
que prova cada status; quando a prova é de código, digo explicitamente.

| Achado da rodada 4 | Status | Prova na rodada 5 |
|---|---|---|
| 1 — as linhas preservadas em "Buscando…" caíam abaixo do AA e continuavam clicáveis | **RESOLVIDO** | `busca-buscando-light-1440x900.png` e `-dark-900x650`: o título de 13 px mede **17,58:1** (claro) e **11,48:1** (escuro), a meta de 11 px **6,69:1** e **5,55:1**; não há mais `opacity` na lista (`#notebooks-list.notebooks-searching{cursor:progress}`, `conversations-dividers.css:45`). O `setSearching` põe `list.inert=true` e `aria-busy="true"` (`notebooks.mjs:313-319`), então o clique não abre o caderno antigo; o teste `tests/notebooks-search-rodada4-ui.mjs` mede o contraste efetivo com opacidade, a inércia e o `aria-busy`. O `alvos[].desabilitado` do `.json` continua `false` porque `inert` não muda a propriedade `disabled`; a prova é o `list.inert` no teste. |
| 2 — o "×" de limpar era o controle nativo (~14 px), fora da rota de Tab e do inventário | **RESOLVIDO** | `busca-com-resultados-light-1440x900.png` (e as outras 14 capturas com texto): existe `.notebooks-search-clear` de **24×24** com rótulo "Limpar busca" (e "Clear search" em `busca-com-resultados-en`), visível só com texto; `busca-vazia-light-1440x900` não tem o alvo (oculto). O nativo some em `::-webkit-search-cancel-button{...display:none}` (`conversations-dividers.css:62`); o teste `notebooks-search-rodada4-ui.mjs` confere 24×24, o nome, o Tab campo→limpar, o `hidden` quando vazio e o foco de volta ao campo. |

Os dois achados de 8,5 da rodada 4, portanto, fecharam. A rodada 5 não sobe a
9,0 por dois detalhes novos e localizados (achados 1 e 2), ambos de componente
inativo: o `.json` os dava como aprovados porque o kit não aplica a `opacity` do
próprio elemento; o pixel mostra 2,05–2,81:1. Não são regressões da rodada 4;
são o mesmo tipo de causa (opacidade) que o achado 1 antigo, agora em botões
desabilitados.

## 6. Decisões do autor

- **D1 (converter síncrono no Xournal++):** não afeta esta nota; o convert é UI
  do Xournal++ e está fora do recorte de cadernos. **decisão do autor.**
- **D2 (Cadernos a três cliques):** a rota foi exercitada de verdade nesta
  rodada (`teclado-cadernos-botao` chega ao botão pelo menu Mais opções →
  Contexto); o custo de descoberta continua sendo escolha da casa e **não
  desconta** a nota de Clarity. **decisão do autor.**
- **D3 (capas de caderno):** a biblioteca continua na opção C (lista como
  está); não muda os achados desta rodada. **decisão do autor.**
- **D4 (reenviar direto no erro do chat lateral):** é do chat solto, fora
  deste recorte; não entra na nota de cadernos. **decisão do autor.**
