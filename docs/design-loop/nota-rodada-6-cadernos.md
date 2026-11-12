# Nota da rodada 6 — cadernos

**Recorte:** #133 (biblioteca de cadernos `.xopp` + instalação do plugin
MesaPagina), #135 (`ler_caderno` no diário do chat) e #158 (busca no texto dos
cadernos e leitura da tinta). **Capturas:** `docs/design-loop/rodada-6/antes/cadernos/`
(173 PNG + 173 `.json` de medidas + `_falhas.json` vazio = 347 arquivos).
**Base do checkout:** `3a6ff4a5` ("capturas da rodada 6 (antes)"), que já inclui
`32dbcccc` (os dois consertos da rodada 5), `a135c326`/`abdfb174`/`d72e5262`
(lateral, quiz e esperas), `195c5cb1` (refactor) e `814b741f` (avisos do
Xournal++). **Nota escrita em:** 2026-11-09.

**Método:** 30 PNGs abertos (lista na seção 4) + os 173 `.json` de medidas em
lote (contraste, fonte, alvos, foco, rótulos) + CSS/JS de `desk/`. O `antes`
desta rodada é o estado **depois** dos consertos da rodada 5: o "Instalando…" e
o rótulo do interruptor da tinta já saem legíveis aqui, e os dois achados
anteriores fecham. O kit de captura passou a compor a `opacity` do próprio
elemento e dos ancestrais no contraste (`desk/tests/capture-ciclo2-cadernos-kit.mjs:134-173`),
então os valores desta rodada já refletem o pixel onde os da rodada 5 eram
otimistas. O movimento está congelado (`freezeMotion`): "Feedback e movimento"
foi julgado pelas pistas visíveis (spinner, toast, `aria-busy`, `aria-live`) e
pelo CSS, não por quadros de animação. A referência da casa (tema inspirado no
Claude Desktop, cinzas neutros, composer colado na coluna, sem canvas de tinta e
leitura da tinta desligada por padrão) não conta como achado.

**Resumo:** os dois achados da rodada 5 fecharam — o "Instalando…" do plugin
passou de 2,69:1/2,81:1 para **7,42:1** no claro (pixel `#2548c7` sobre `#fff`;
6,57:1 no `.json` sobre `#f1f1f1`) e **5,79:1** no escuro; o rótulo do
interruptor desabilitado passou de 2,05:1/2,50:1 para **6,69:1** (claro) e
**6,93:1** (escuro). O recorte sobe de **8,5** para **9,0**. Sobra um único
detalhe baixo: o "Instalar plugin da página" **desabilitado** do estado de erro
ainda herda `opacity:.55` e renderiza a 2,69:1/2,81:1, mas é componente inativo
(o WCAG 1.4.3 isenta), a ação ativa "Tentar de novo" está em 6,93:1/5,96:1 e ele
não é o único caminho. Encontrei 5 textos abaixo de AA em 1.256, todos esse
mesmo botão inativo nas cinco variantes de `plugin-erro`.

## 1. Notas

Sub-partes: **#133** biblioteca + plugin; **#135** `ler_caderno` no diário;
**#158** busca + leitura da tinta. A coluna "Geral" é a leitura do recorte.
Todos os estados do inventário têm captura; a seção 3 lista o que ficou fora.

| Categoria | #133 biblioteca + plugin | #135 `ler_caderno` | #158 busca + tinta | Geral |
|---|---|---|---|---|
| Typography | 9,0 | 9,0 | 9,0 | 9,0 |
| Hierarchy | 9,0 | 9,0 | 9,0 | 9,0 |
| Spacing & density | 9,0 | 9,0 | 9,0 | 9,0 |
| Color & contrast | 9,0 | 9,0 | 9,0 | 9,0 |
| Iconography | 9,0 | 9,0 | 9,0 | 9,0 |
| Consistency & polish | 9,0 (1) | 9,0 | 9,0 | 9,0 |
| Clarity | 9,0 | 9,0 | 9,0 | 9,0 |
| Estados (vazio/carregando/erro) | 9,0 | 9,0 | 9,0 | 9,0 |
| Feedback e movimento | 9,0 | 9,0 | 9,0 | 9,0 |
| Acessibilidade | 9,0 (1) | 9,0 | 9,0 | 9,0 |
| Janela pequena | 9,5 | 9,0 | 9,0 | 9,0 |
| **Overall** | **9,0** | **9,0** | **9,0** | **9,0** |

**Lastro dos 9,0 e do 9,5.**

- **Typography (#133/#135/#158):** a escala é 12/700 (título do popover),
  11/600 caixa alta (grupo), 13/600 (título do caderno), 11/400 (meta), 12/600
  (interruptor), 11/400 (descrição e status), 12/400 (cabeça do diário), 12,5
  (passo), 11 (detalhe técnico), 11/600 (estado do plugin), 12/400 (ação e erro
  inline). Os 173 `.json` têm **0 textos fora da região medida** e **0 alvos
  sem rótulo**; o `en` cabe nas mesmas caixas (`plugin-different-en` 498×30,
  `busca-com-resultados-en` 367×384, `tinta-status-erro-en` 367×311). Nenhuma
  caixa de texto estoura a região.
- **Hierarchy:** o título do popover (12/700) vence o grupo (11/600 caixa
  alta), que vence o nome do caderno (13/600) e a meta (11/400); na busca, o
  campo vem antes do status (11) e o resultado mostra título (13/600), meta
  (11) e trecho (12); no diário, a cabeça do turno (12/400) fica acima do passo
  (12,5) e do detalhe técnico (11); na tinta, o interruptor (12/600) vem antes
  da descrição (11) e do status (11). As recusas do plugin usam o motivo (11) e
  o próximo passo (11) em linhas separadas de 100% da largura, sem ação.
- **Spacing & density:** linhas de 49 px, resultados de 68, grupo de 21, gap de
  6; popover 367×397 em 1440 e 340×397/399 em 900; linha do plugin 498×30–37;
  painel da tinta 238–344; no 900×650 o Sobre mede 540×457, o painel da tinta
  chega a 340×344 e o toast de `plugin-instalado-aviso` fica em x≈752–888, à
  direita do diálogo; **173/173 regiões dentro da janela**. No 900×650 com
  busca a última linha da lista é cortada no fim da área rolável: é o
  `overflow:auto` normal, com barra visível e o painel da tinta fixo abaixo
  (não é achado; a rodada 5 já o registrou assim).
- **Color & contrast:** **1.251 de 1.256** nós de texto passam AA; os 5
  reprovados são o mesmo botão inativo do achado 1. O menor texto ativo é o
  `<mark>` da busca: **4,83:1** no claro (`#5c5c5c` sobre `#eedb8e`) e
  **4,99:1** no escuro (`#fff` sobre `#7e6f34`); o vazio/`--faint` é **4,95:1**
  no claro (`#707070` sobre `#fff`) e **5,05:1** no escuro (`#a0a0a0` sobre
  `#303030`); o erro da tinta **5,74:1** (claro) e **5,96:1** (escuro); o
  aviso/recusa do plugin **5,33–6,69:1**; o erro do plugin **5,33:1** (claro)
  e **9,41:1** (escuro); a ação azul **7,42:1** no claro e **5,79:1** no
  escuro; o link "Reinstalar plugin" sobre o aviso **6,57:1** (claro) e
  **4,99:1** (escuro). O trilho do interruptor é `--faint` (**4,95:1/5,05:1**
  contra a superfície) e o polegar tem borda `--border`, então o desenho do
  controle não some.
- **Iconography:** Lucide coerente — livro em `ler_caderno`, check/alerta no
  estado do turno, chevron no diário, × no fechar e no limpar; spinner de 3
  pontos (`ts-dots`) na instalação e no "Buscando…"; pontos de status do plugin
  (`muted`, `busy`, `ok`, `new`, `warn`) todos `aria-hidden`, com o texto ao
  lado carregando o estado. O `↻` do bloco de atualizações é um glifo dentro de
  um badge circular de 20 px (`update-icon`, `help-about.css:109`), não um
  ícone Lucide, mas o desenho é consistente com o restante do Sobre e o botão
  tem nome acessível ("Verificar atualizações agora"/"Conferir os componentes de
  novo"). Nenhum ícone de chave de fenda no passo de `ler_caderno`.
- **Consistency & polish:** os estados do plugin usam o mesmo molde (ponto +
  estado + versão + ação + linha de reiniciar/próximo passo); a instalação usa
  "Instalando…" com `disabled` + `aria-busy` e agora em contraste cheio; o erro
  usa `role=alert` sem toast; as recusas escondem o botão e mostram o próximo
  passo. A busca usa o mesmo `ts-dots` e o mesmo hover das linhas; o painel da
  tinta usa os mesmos tokens de superfície/borda; o × de limpar tem o mesmo
  desenho do × do popover (24 vs 28 px, ambos ≥24). O único desvio é o achado 1
  (texto do botão inativo no erro abaixo do padrão de leitura que o composer já
  pratica).
- **Clarity:** os textos dizem o estado e a ação — "Atualizar plugin" com
  "versão 1.0.0 na pasta", "Renomeie ou remova a pasta MesaPagina e reabra o
  Sobre." (`modified`), "Mova a pasta…" (`foreign`), "Troque o link…"
  (`symlink`), "Tentar ler de novo" + "Tentar desligar de novo" na tinta,
  "Nenhum resultado. Tente outro termo.", "3 resultados", "Pausado: sem cota",
  "Em dia", "Sem modelo com visão: a busca usa só o texto digitado." e "Com o
  Claude, a leitura da tinta ainda não está disponível.".
- **Estados:** os 26 estados do inventário (25 séries de 5 variantes +
  `plugin-instalado-aviso` de 4) têm foto; `_falhas.json` está vazio. Entram
  biblioteca cheia/vazia, os 9 do plugin, os 3 de `ler_caderno`, os 4 da busca,
  os 8 da tinta, 2 hovers e 10 rotas de teclado. O "Buscando…" mantém as linhas
  em contraste cheio, `inert` e `aria-busy` (rodada 4 fechada); o erro da tinta
  tem "Tentar ligar de novo" e o status persistente tem "Tentar ler de novo" +
  "Tentar desligar de novo".
- **Feedback e movimento:** spinner de 3 pontos na instalação e na busca,
  `aria-busy` no botão e na lista, `role=status`/`aria-live` na busca e no
  status da tinta, `role=alert` no erro inline, toast de sucesso do plugin (fora
  do diálogo), hover medido (linha `#e6e6e6` no claro e
  `rgba(255,255,255,.09)` no escuro; interruptor idem) e foco de 2 px. O
  movimento em si está congelado; a presença e o lugar das pistas foram
  conferidos.
- **Acessibilidade #133 (9,0):** **616 alvos** nos `.json`, **0** com
  `abaixo24`, **0** sem rótulo acessível; fechar 28×28, linhas 349×49,
  interruptor 335×28, ações do plugin 104–169×30, retry 374×30, limpar 24×24,
  × do Sobre 28×28. As 8 capturas de teclado do plugin (2 bases × 4) têm
  `focusVisible=true` e anel de 2 px. O achado 1 é texto de componente inativo
  (1.4.3 isenta) e não derruba a categoria; o "Instalando…" agora tem rótulo
  cheio (achado da rodada 5 fechado).
- **Acessibilidade #135 (9,0):** as 8 capturas de teclado do diário (2 bases ×
  4) têm `focusVisible=true`, anel de 2 px (claro `#2548c7`, escuro
  `#8fa8ff`); a cabeça mede 366×24–28 (≥24) e o passo 357×29–118; os nomes
  acessíveis dos passos são curtos ("Ler o caderno: aula-nova.xopp, página 1")
  e o JSON cru fica no bloco técnico. O `rotulo` do kit é `textContent`; ele não
  é o nome que o leitor de tela calcula — a concatenação "Lendo o caderno1s" do
  cabeçalho vivo segue como limitação de medição, não como achado (seção 3).
- **Acessibilidade #158 (9,0):** os mesmos 616 alvos e as 24 capturas de
  teclado da busca/tinta (6 bases × 4) têm foco visível; o interruptor tem
  `role=switch`, `aria-checked` e `aria-describedby`; a busca tem `role=status`,
  o limpar tem nome ("Limpar busca"/"Clear search") e entra no Tab logo após o
  campo; a tinta tem `aria-live`. O rótulo do interruptor desabilitado agora
  mede 6,69:1/6,93:1 (achado da rodada 5 fechado).
- **Janela pequena:** o popover usa `max-height:min(64vh,440px)` e rola por
  dentro; em 900×650 ele mede no máximo 340×399 (tinta-status-erro 340×344), o
  Sobre cabe (540×457 em x=180–720, y=83–540) e o toast de sucesso fica à
  direita do diálogo (x≈752–888), sem cobri-lo; o diário rola no `#messages`;
  nenhuma região sai da janela (173/173). O #133 leva 9,5 porque a lista mantém
  2 grupos e 3 linhas visíveis na largura de 340 e o painel da tinta cabe
  inteiro nos 399 px.

## 2. Achados

### 1 — baixa — #133 — Consistência & polimento / Acessibilidade de componente inativo — o "Instalar plugin da página" desabilitado no erro renderiza a 2,69:1 (claro) e 2,81:1 (escuro)

Capturas: `plugin-erro-light-1440x900.png`, `plugin-erro-dark-1440x900.png` (e
as duas `-900x650` e a `en`). Medido: o `.json` registra `contraste` **2,72** no
claro (`#2548c7` sobre `#fff`, já com a `opacity` do botão) e **2,81** no escuro
(`#8fa8ff` sobre `#303030`); no pixel, o texto sai `#879be0` sobre `#fff` =
**2,69:1** no claro e `#6472a2` sobre `#303030` = **2,81:1** no escuro. A causa
é `.component-update[disabled]{opacity:.55}` (`desk/src/help-about.css:164`); a
regra nova da rodada 5 só cobre o `aria-busy="true"` (`:170`). O estado "não
instalado" ao lado continua em 6,69:1/5,55:1 e o "Tentar de novo" do erro em
6,93:1/5,96:1. É o único texto abaixo de AA em 1.256; o WCAG 1.4.3 isenta texto
de componente inativo, e ali a ação ativa é o retry, não o instalar. Fica como
detalhe de polimento porque a casa mantém desabilitado legível no composer
(`opacity:1` + `--faint`/`--muted`, `desk/src/composer.css:255-265`) e o botão
de erro é o único que ainda usa a opacidade global.
Sugestão: acrescentar `.component-plugin-install[disabled]{opacity:1;color:var(--faint)}`
(depois da regra de `aria-busy`, que continua em `--accent-text`), mantendo
`disabled` + `aria-disabled`; o botão fica legível (4,95:1/5,05:1) e o azul
segue reservado para a ação ativa.
Arquivo: `desk/src/help-about.css:164`; o `disabled`/`aria-disabled` é posto em
`desk/src/dialogs.mjs:306-309`.

**Observação, não achado:** durante o "Buscando…", o CSS mantém
`.notebooks-row:hover` e o cursor de `button`; o `inert` impede clique e foco,
mas esta captura não tem o ponteiro sobre uma linha preservada. Não afirmo que
a linha pareça clicável sem uma foto com hover nesse estado — fica na cobertura
parcial da seção 3.

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
  diário em inglês ("Worked for 14s · 1 tool", "Read the notebook…"), apesar de
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
- **o inventário ainda descreve `tinta-erro` como "toast + inline"**, mas o
  estado atual é só inline: o teste confere que nenhum toast abre
  (`desk/tests/capture-ciclo2-cadernos.mjs:355-356`, comentário R3 #158) e a
  captura `tinta-erro-light-900x650.png` não tem toast. O estado está correto;
  a linha do inventário é que ficou velha. Sugestão: trocar a descrição para
  "erro inline, sem toast (R3)" em `docs/design-loop/inventario-cadernos.md`;
- o hover sobre uma linha preservada durante o "Buscando…" não foi capturado; o
  CSS deixa `.notebooks-row:hover` e o cursor de botão ativos, e o `inert` só
  bloqueia clique/foco. Não vira achado sem a foto do ponteiro nesse estado;
- o movimento está congelado; "Feedback e movimento" foi julgado pela presença e
  pelo lugar das pistas e pelo CSS, não pela animação em si.

## 4. O que eu vi

**Abri 30 PNGs** (de 173); nas 143 restantes usei o `.json` de medidas, o CSS e
o JS, sem afirmar o que só a imagem mostraria. Os 30:

- **biblioteca/busca:** `biblioteca-lista-light-1440x900`,
  `biblioteca-lista-dark-900x650`, `biblioteca-vazia-light-1440x900`,
  `busca-vazia-light-1440x900`, `busca-buscando-light-1440x900`,
  `busca-buscando-dark-900x650`, `busca-sem-resultado-dark-1440x900`,
  `busca-com-resultados-light-1440x900`.
- **plugin:** `plugin-nao-instalado-light-1440x900`,
  `plugin-instalando-light-1440x900`, `plugin-instalando-dark-900x650`,
  `plugin-instalado-light-1440x900`, `plugin-instalado-aviso-dark-900x650`,
  `plugin-erro-light-1440x900`, `plugin-different-light-900x650`,
  `plugin-modified-light-1440x900`, `plugin-foreign-dark-900x650`,
  `plugin-symlink-dark-1440x900`.
- **diário:** `ler-caderno-andamento-light-1440x900`,
  `ler-caderno-ok-dark-900x650`, `ler-caderno-erro-light-900x650`.
- **tinta:** `tinta-desligada-padrao-light-1440x900`,
  `tinta-sem-chave-dark-1440x900`, `tinta-sem-chave-light-900x650`,
  `tinta-claude-dark-1440x900`, `tinta-lendo-light-1440x900`,
  `tinta-ligada-dark-900x650`, `tinta-quota-dark-1440x900`,
  `tinta-erro-light-900x650`, `tinta-status-erro-light-900x650`.

Para os achados da rodada 5 e para o achado 1 amostrei os pixels de
`plugin-instalando-light-1440x900`, `plugin-instalando-dark-1440x900`,
`plugin-erro-light-1440x900`, `plugin-erro-dark-1440x900`,
`tinta-sem-chave-light-1440x900` e `tinta-sem-chave-dark-1440x900` (esses
arquivos eu não abri como imagem inteira; os valores vêm da amostra, não do
olho). As capturas de teclado (`teclado-*`) foram julgadas pelo `.json` e pelo
CSS; não abri nenhuma.

## 5. Achados da rodada 5

**Status:** 2 RESOLVIDOS, 0 PARCIAIS, 0 ABERTOS. A tabela cita a captura nova
que prova cada status; quando a prova é de código, digo explicitamente.

| Achado da rodada 5 | Status | Prova na rodada 6 |
|---|---|---|
| 1 — o "Instalando…" do plugin renderizava a 2,69:1 (claro) e 2,81:1 (escuro) | **RESOLVIDO** | `plugin-instalando-light-1440x900.png` e `-dark-900x650`: o texto agora sai `#2548c7` sobre `#fff` = **7,42:1** no pixel claro (6,57:1 no `.json` sobre `#f1f1f1`) e `#8fa8ff` sobre `#303030` = **5,79:1** no escuro; os 3 pontos do spinner são `--muted` (5,92:1 sobre o fundo do botão claro e 5,55:1 no escuro) e o botão tem `aria-busy` com `opacity:1` (`help-about.css:170`). A regra e o teste de janela entraram em `32dbcccc`; o kit agora compõe a opacidade no `.json` (6,57/5,79, sem o 2,69 antigo). |
| 2 — o rótulo do interruptor desabilitado caía a 2,05:1 (claro) e 2,50:1 (escuro) | **RESOLVIDO** | `tinta-sem-chave-dark-1440x900.png`, `tinta-sem-chave-light-900x650.png` e `tinta-claude-dark-1440x900.png`: o rótulo "Ler a escrita à mão" sai `#5c5c5c` sobre `#fff` = **6,69:1** no claro e `#a8a8a8` sobre `#1f1f1f` = **6,93:1** no escuro; a regra `.notebooks-ink-switch:disabled{opacity:1}` (`conversations-dividers.css:91`) manteve o desligado no trilho `--faint` e o texto em `--muted`, como o composer. Entrou em `32dbcccc`. |

Os dois achados de 8,5 da rodada 5, portanto, fecharam. O recorte sobe para
**9,0**; o único texto ainda abaixo de AA é o botão inativo do estado de erro
(achado 1 desta rodada, baixa), que não tem o mesmo peso: é componente inativo,
com o retry ativo ao lado.

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
