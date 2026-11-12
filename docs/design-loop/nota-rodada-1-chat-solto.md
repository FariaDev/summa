# Nota da rodada 1 — chat solto (#157)

Avaliação do recorte "Chat solto" do ciclo 2: janela solta (380×800 e
420×1000), faixa "Chat em outra janela", soltar/trazer e "sempre por cima",
chat preso com resposta, cartões, envio incerto e janela pequena. Base:
`docs/design-loop/inventario-chat-solto.md`, as capturas de
`docs/design-loop/rodada-1/antes/chat-solto/` (PNG + JSON homônimo), o CSS e o
código em `desk/src`. Não implementei nem corrigi nada.

Referência da casa (não conta como achado): tema inspirado no Claude Desktop,
cinzas neutros, composer colado de ponta a ponta com fio em cima, sem canvas de
tinta. Também não contam como achado as decisões do autor da #157: fechar a
janela solta devolve o chat, posição/tamanho no `desk.json`, "sempre por cima"
começa desligado e é o mesmo chat lateral movido para a janela filha.

As notas são de 0 a 10, em passos de 0,5. O "lastro" abaixo da tabela dá a
medida que sustenta cada nota (inclusive as altas); os defeitos que puxam a nota
para 8 ou menos estão numerados na seção 2. Células com nota cobrem os estados
que têm captura; os estados sem PNG estão na seção 3 e não entram na nota.

## 1. Notas

Sub-partes: **A** janela solta (380×800 e 420×1000); **B** faixa "Chat em outra
janela" (1440×900 e 900×650); **C** soltar/trazer e "sempre por cima" (menus);
**D** chat preso com resposta, cartões, envio incerto e janela pequena
(1440×900 e 900×650). A última coluna é a leitura geral do recorte; a última
linha é o Overall de cada sub-parte.

| Categoria | A · janela solta | B · faixa | C · soltar/trazer | D · preso/cartões | Geral |
|---|---|---|---|---|---|
| Typography | 8,5 | 8,5 | 8,5 | 8,0 | 8,5 |
| Hierarchy | 8,0 | 6,5 | 8,5 | 8,0 | 7,5 |
| Spacing & density | 6,5 | 5,5 | 8,5 | 7,5 | 7,0 |
| Color & contrast | 7,0 | 8,5 | 8,0 | 7,0 | 7,5 |
| Iconography | 8,5 | 8,5 | 6,5 | 8,0 | 8,0 |
| Consistency & polish | 7,5 | 8,0 | 7,5 | 7,5 | 7,5 |
| Clarity | 8,0 | 8,0 | 7,5 | 7,0 | 7,5 |
| Estados (vazio/carregando/erro) | 6,5 ¹ | 8,0 | 7,0 ² | 7,0 ¹ | 6,5 |
| Feedback e movimento | 7,0 ³ | 7,5 | 7,5 | 7,0 ³ | 7,0 |
| Acessibilidade | 6,5 | 8,0 | 4,0 ⁴ | 6,5 | 6,0 |
| Janela pequena | 8,0 | 7,0 | 8,0 | 7,0 | 7,5 |
| **Overall** | **7,0** | **6,5** | **6,5** | **7,0** | **7,0** |

¹ Vazio, carregando e erro sem captura; a nota cobre só o estado incerto (A) e o
cartão/incerto (D).
² Foco por Tab nos itens do menu sem captura (não existe caminho); a nota cobre
on/off por mouse.
³ Hover e toast de "copiado" sem captura; a nota cobre o que está congelado.
⁴ O caminho de teclado do menu não tem PNG; o achado 1 vem do código
(`desk/src/sidechat.mjs`) e do inventário, não de uma imagem.

**Geral do recorte: 7,0.** A base visual é boa (tipografia e hierarquia por
volta de 8–8,5), mas o vão de ~490 px, o composer de 234 px, as ações a 3,92:1 e
o menu sem teclado seguram a nota.

**Lastro das notas (para nenhuma nota ficar sem medida):**

- **Typography 8,5 (A/B/C) e 8,0 (D):** corpo 15 px/24 px (1,6), papéis
  11 px/600, título 12 px/600, menu 12 px. O piso da casa é 11 px e nenhum texto
  visível amostrado fica abaixo disso. Em D, o "I don't know" quebra em duas
  linhas em 253 px (`en-preso-cartao-light-900x650`), o que é aceitável mas
  aperta o cartão.
- **Hierarchy 8,0/8,5:** o cabeçalho, o papel do falante (11 px, 600), o corpo
  (15 px) e o composer se leem nesta ordem. Em B a hierarquia é 6,5 porque o
  vazio de 489,5 px passa a ser o elemento mais forte da tela.
- **Spacing 8,5 (C):** itens de menu 230×28, menu 240×96 (3 itens), sem
  desalinhamento. Em A é 6,5 (composer de 234 px, achado 3), em B é 5,5 (vazio,
  achado 2) e em D é 7,5 (cartão e coluna de 253 px sem estouro).
- **Color 8,5 (B):** rótulo da faixa 12 px/600 com 18,88:1 no claro e 16,48:1 no
  escuro. Menu 8,0: itens 17,58:1 no claro e 11,48:1 no escuro; o estado
  "Desligada" é `--faint` e passa raspando no escuro (4,52:1, medido por mim no
  CSS; não está no JSON porque é pseudo-elemento). A e D 7,0 pelo achado 4
  (no D também pesa o "Enviar" desligado, achado 13).
- **Iconography 8,5 (A/B):** ícones de 16 px dentro de alvos de 28×28, lock e
  refresh de 12 px dentro de 24×24, chevron de 16 px na faixa. C 6,5 pelos
  achados 9 e 10; D 8,0 (lock e refresh corretos).
- **Consistency 7,5/8,0:** claro e escuro têm as mesmas formas, o menu é o
  mesmo `.chat-pop` do tutor e o selo do motor some abaixo de 300 px. O que
  segura é a diferença de contraste das ações só no claro (achado 4) e os ícones
  trocados (achados 9 e 10).
- **Clarity 8,0 (A/B):** "Atualizar contexto", "Levar à sessão principal" (com
  `title` explicando que insere sem enviar), cadeado "Fora da sessão principal"
  e "Trazer de volta" têm nome e dica. D 7,0 pelos achados 6, 8 e 11.
- **Estados 8,0 (B):** a faixa é um estado bem comunicado; o rótulo vertical
  diz exatamente onde o chat está. As demais notas são menores justamente pelo
  que falta capturar (seção 3).
- **Feedback 7,5 (B/C):** a faixa responde ao clique (reabre o chat) e o menu
  atualiza "Ligada/Desligada" na hora, sem fechar. Em A/D pesam o envio desligado
  quase invisível (achado 13) e o Enter silencioso no incerto (achado 14).
- **Acessibilidade 8,0 (B):** alvo de 33×829 px, `aria-label` "Chat em outra
  janela" e anel de 2 px `var(--ring)`; contraste do rótulo passa. C 4,0 pelo
  achado 1; A/D 6,5 pelos achados 4, 5 e 7.
- **Janela pequena 8,0 (A/C):** em 380×800 e 420×1000 `scrollWidth` = largura da
  janela (380/420), sem rolagem horizontal; em 253 px o menu de 240 px cabe e o
  selo do motor some. B 7,0 e D 7,0 pelos vazios/truncamento (achados 2 e 11).
- **Overall 7,0:** a base visual é boa (tipografia e hierarquia por volta de
  8–8,5), mas quatro coisas que o usuário sente seguram o recorte: o vão de
  ~490 px (B), o composer de 234 px (A), as ações a 3,92:1 no claro (A/D) e o
  menu sem teclado (C).

## 2. Achados

### 1. Menu "Mais opções" sem caminho de teclado — Acessibilidade · grave

- **Tela:** menus da janela solta e do chat preso — `solto-menu-trazer-claro/escuro-380x800`,
  `solto-menu-por-cima-claro/escuro-380x800`, `mesa-menu-soltar-claro/escuro-1440x900`.
- **Evidência medida:** os itens medem 230×28; o `Tab` fecha o pop
  (`desk/src/sidechat.mjs:144`) e só o `ArrowDown` no gatilho foca o primeiro
  item (`sidechat.mjs:139-142`); não há setas entre os itens. O inventário
  registra esse estado como sem captura porque não existe caminho só de teclado
  até "Trazer de volta" e "Sempre por cima".
- **Sugestão:** navegação por setas com tabindex móvel, Esc fecha e devolve o
  foco ao gatilho, Tab sai do menu sem largar o foco no body.
- **Arquivo provável:** `desk/src/sidechat.mjs:139-144`.

### 2. Vão de ~490 px com o chat solto — Spacing & density / Hierarchy · média

- **Tela:** `mesa-faixa-claro-1440x900`, `mesa-faixa-escuro-1440x900`,
  `mesa-faixa-claro-900x650`, `en-faixa-light-900x650`, `teclado-faixa-claro-1440x900`.
- **Evidência medida:** o slot de apoio recolhe para 34 px em x=525,5, mas o
  leitor fixado continua em 50% (`readers.css:74`); a coluna do tutor só começa
  em x≈1049. Sobram **489,5 px** vazios em 1440×900 e **220,5 px** em 900×650
  (o inventário estima ~490/~220 e a captura confirma).
- **Sugestão:** quando o slot está recolhido, deixar o leitor fixado crescer para
  ocupar o espaço liberado, como já se faz com leitor minimizado.
- **Arquivo provável:** `desk/src/readers.css:74` (regra `.pdf-panel.pinned`) e
  `desk/src/readers.css:105` (estado `.collapsed`).

### 3. Composer da janela solta com 234 px de área morta — Spacing & density · média

- **Tela:** `solto-resposta-claro-380x800`, `solto-resposta-escuro-380x800`,
  `solto-resposta-claro-420x1000`, `solto-resposta-escuro-420x1000`.
- **Evidência medida:** o fio superior do composer fica em y=539 e a janela útil
  termina em y=773: **234 px**, ou 30% da altura útil em 380×800; em 420×1000 é
  **233 px** de 973. O textarea sozinho mede **356×119,2 px** e o campo tem só
  uma linha de placeholder. A janela filha copia os atributos do `<html>`
  (`syncChildChrome`), inclusive as variáveis `--tutor-composer-h` e
  `--tutor-foot-h`; o `min-height` de `support-sidechat.css:61` reserva o pé do
  tutor mesmo sem tutor ao lado.
- **Sugestão:** zerar `--tutor-composer-h`/`--tutor-foot-h` no documento da
  filha e/ou dimensionar o composer pelo conteúdo na janela solta.
- **Arquivo provável:** `desk/src/support-sidechat.css:61`,
  `desk/src/sidechat-detach.mjs` (CSS de layout da filha, perto da linha 122) e
  `desk/src/composer-align.mjs:29-30`.

### 4. Ações de mensagem a 3,92:1 no tema claro — Color & contrast / Acessibilidade · média

- **Tela:** todas as capturas claras com mensagens — `solto-resposta-claro-380x800`,
  `solto-resposta-claro-420x1000`, `preso-cartao-claro-1440x900`,
  `preso-cartao-claro-900x650`, `preso-incerto-claro-1440x900`,
  `mesa-trazido-de-volta-claro-1440x900`, `en-preso-cartao-light-900x650`.
- **Evidência medida:** `.sidechat-msg-actions` usa `opacity:.55`
  (`support-sidechat.css:52`); "Copiar" e "Levar à sessão principal" ficam em
  **11 px, rgb(129,129,129) sobre #fff = 3,92:1**, abaixo do 4,5:1 do WCAG AA
  (33 amostras no claro). No escuro, 5,26:1.
- **Sugestão:** não apagar a linha inteira com opacidade; usar `--muted` em
  opacidade cheia (6,69:1 no claro) e guardar o `opacity` só para o realce de
  hover.
- **Arquivo provável:** `desk/src/support-sidechat.css:52-54`.

### 5. Foco do campo de mensagem só com o fio de 1 px na janela solta — Acessibilidade · média

- **Tela:** `teclado-solto-07-sidechat-prompt-claro-380x800` e as quatro
  `solto-resposta-*`.
- **Evidência medida:** o JSON do foco registra `outline: 3px none` e
  `boxShadow: none` no `#sidechat-prompt`; a cadeia mostra o `::after` do
  `#sidechat` com `display: none` na filha. O único sinal é o fio de **1 px** do
  topo do composer mudando de cinza para `--ring`. Na Mesa o contorno do painel
  compensa; na janela solta ele foi desligado (`sidechat-detach.mjs:122`) e o
  `:has(:focus-visible)` não repõe `display`.
- **Sugestão:** no CSS da filha, repor `display: block` no `::after` de
  `:has(:focus-visible)` ou dar ao textarea um `:focus-visible` próprio de
  2 px.
- **Arquivo provável:** `desk/src/sidechat-detach.mjs:122` e
  `desk/src/composer.css:19-20`.

### 6. Opções do quiz parecem campos desabilitados — Clarity / Consistency · média

- **Tela:** `preso-cartao-claro-1440x900`, `preso-cartao-escuro-1440x900`,
  `preso-cartao-claro-900x650`, `preso-cartao-escuro-900x650`,
  `en-preso-cartao-light-900x650`.
- **Evidência medida:** as opções medem **473,5×35,8 px** (188,5×35,8 em
  900×650) e usam fundo `--surface` + borda de 1 px, a mesma forma dos campos de
  texto; "Não sei" (77,6×38) e "Dispensar" (97×38) já parecem botões. À primeira
  vista, "1. 3" e "2. 4" leem como inputs desabilitados, não como respostas
  clicáveis.
- **Sugestão:** dar marca de escolha (círculo/chevron), hover mais claro e/ou
  uma linha "Escolha uma" acima das opções.
- **Arquivo provável:** `desk/src/tutor-chat.css:298` (`.quiz-option`).

### 7. Dois botões "Copiar" com o mesmo nome acessível — Acessibilidade · média

- **Tela:** `teclado-solto-02-copiar-claro-380x800`,
  `teclado-solto-03-copiar-claro-380x800` e `teclado-solto-resumo.json`.
- **Evidência medida:** os passos 2 e 3 do percurso têm ambos o rótulo
  **"Copiar"**; o JSON de rótulos mostra dois `button` sem `aria-label` com nome
  "Copiar" (um na fala do aluno, outro na resposta do tutor).
- **Sugestão:** incluir o falante no nome acessível ("Copiar a resposta do
  OpenCode", "Copiar a sua mensagem").
- **Arquivo provável:** `desk/src/sidechat-message-view.mjs:47`.

### 8. Aviso de entrega incerta repetido em dois lugares — Clarity / Consistency · baixa

- **Tela:** `preso-incerto-claro-1440x900`, `preso-incerto-escuro-1440x900`,
  `preso-incerto-claro-900x650`, `preso-incerto-escuro-900x650`,
  `en-solto-incerto-light-380x800`.
- **Evidência medida:** o aviso laranja "Há uma entrega incerta neste chat
  lateral: confira antes de reenviar." (11 px, 5,71:1) aparece acima do composer
  e a linha de atividade "Entrega incerta neste chat lateral." (11 px, 6,69:1)
  aparece no fim da lista; em inglês, "There is an uncertain delivery…" +
  "Uncertain delivery…".
- **Sugestão:** manter uma mensagem só (o aviso perto do composer) e trocar a
  linha de atividade por outra informação ou suprimi-la no estado incerto.
- **Arquivo provável:** `desk/src/sidechat.mjs:742` (atividade) e
  `desk/src/sidechat.mjs:753` (aviso).

### 9. Ícone de "Sempre por cima" é o de maximizar — Iconography · baixa

- **Tela:** `solto-menu-trazer-claro-380x800`, `solto-menu-por-cima-claro-380x800`
  (e variantes escuras).
- **Evidência medida:** o item usa `icon('maximize')` (`sidechat-detach.mjs:75`),
  um quadrado de cantos abertos de 16 px que significa maximizar/expandir, não
  "ficar por cima".
- **Sugestão:** usar um alfinete (pin) ou ícone de camadas para o estado.
- **Arquivo provável:** `desk/src/sidechat-detach.mjs:75`.

### 10. "Trazer de volta" mantém o ícone de "Soltar em outra janela" — Iconography · baixa

- **Tela:** `solto-menu-trazer-claro-380x800`, `solto-menu-trazer-escuro-380x800`.
- **Evidência medida:** o botão é criado uma vez com `icon('external')`
  (`sidechat-detach.mjs:60`) e, ao virar "Trazer de volta", só o `<span>` do
  rótulo é atualizado (`:68-70`); a seta continua saindo da caixa, ao contrário
  do sentido da ação.
- **Sugestão:** trocar o ícone conforme o estado (seta para dentro/retorno para
  "Trazer de volta").
- **Arquivo provável:** `desk/src/sidechat-detach.mjs:60-70`.

### 11. Escopo truncado sem `title` na coluna estreita — Clarity / Janela pequena · baixa

- **Tela:** `preso-cartao-claro-900x650`, `preso-cartao-escuro-900x650`,
  `en-preso-cartao-light-900x650`.
- **Evidência medida:** com a coluna em 253,5 px, o texto "Limites.pdf p. 1,
  Formulario.pdf p. 1" vira "Limites.pdf p. 1, Formulario…" (elemento de
  **165,5 px** com `text-overflow: ellipsis`); o `#sidechat-scope-text` é
  `role="status"` e não tem `title` nem revelação no foco.
- **Sugestão:** pôr `title` com os rótulos completos (ou abrir o popover de
  contexto pelo cadeado/atalho) quando o texto estiver truncado.
- **Arquivo provável:** `desk/src/sidechat.mjs:720-726` e
  `desk/src/composer.css:76`.

### 12. Cartão de mensagem é `role="group"` sem nome acessível — Acessibilidade · baixa

- **Tela:** `solto-resposta-claro-380x800` (e todas as capturas de conversa).
- **Evidência medida:** o `article` é criado como `role:'group'`
  (`sidechat-message-view.mjs:41`) sem `aria-label`/`aria-labelledby`; o rótulo
  do falante ("Você"/"OpenCode") é um `div` genérico. O leitor de tela não
  recebe o falante como nome do grupo.
- **Sugestão:** `aria-labelledby` apontando para o rótulo do falante (ou
  `aria-label="Mensagem do OpenCode"`).
- **Arquivo provável:** `desk/src/sidechat-message-view.mjs:41`.

### 13. "Enviar" desligado quase invisível — Color & contrast / Estados · baixa

- **Tela:** `preso-incerto-claro-1440x900`, `preso-incerto-claro-900x650`,
  `preso-incerto-escuro-1440x900`, `en-solto-incerto-light-380x800`.
- **Evidência medida:** o botão usa `opacity:.45`, ficando **2,04:1** no claro e
  **2,52:1** no escuro (amostras do JSON). A WCAG isenta componente inativo, mas
  na prática o "Enviar" some e o aluno pode não entender que o envio existe e
  está bloqueado.
- **Sugestão:** manter o ícone em `--muted` e marcar o desabilitado por forma
  (ou por uma dica ao lado), não só por opacidade.
- **Arquivo provável:** `desk/src/composer.css:155` (regra
  `.composer-actions button:disabled`) e `desk/src/sidechat.mjs:741`.

### 14. Enter no campo com envio incerto não dá retorno — Feedback e movimento · baixa

- **Tela:** `preso-incerto-claro-900x650` e `en-solto-incerto-light-380x800`.
- **Evidência medida:** no estado incerto o `#sidechat-send` fica desabilitado,
  mas o textarea continua aceitando texto; `sendMessage()` retorna em silêncio
  (`sidechat.mjs:451`), então o Enter parece não fazer nada.
- **Sugestão:** desabilitar o campo junto com o botão ou repetir o aviso de
  entrega incerta ao tentar enviar.
- **Arquivo provável:** `desk/src/sidechat.mjs:451` e `:741`.

### 15. "Sempre por cima" ligado não deixa sinal fora do menu — Clarity / Feedback · baixa

- **Tela:** `solto-menu-por-cima-claro-380x800` versus
  `solto-resposta-claro-380x800` (a janela fica visualmente igual).
- **Evidência medida:** o JSON confirma `alwaysOnTop: true` e
  `sidechatAlwaysOnTop: true`, mas não há indicador no cabeçalho; a única pista
  é reabrir "Mais opções".
- **Sugestão:** um alfinete discreto no cabeçalho quando o estado está ligado.
- **Arquivo provável:** `desk/src/sidechat-detach.mjs` (pintura do estado) e o
  cabeçalho de `desk/src/sidechat.mjs:73-91`.

## 3. SEM CAPTURA

Estados do inventário sem PNG (não há nota para a categoria naquele estado):

- **Foco por Tab nos itens do menu "Mais opções"** ("Trazer de volta" e "Sempre
  por cima"): o menu fecha no primeiro Tab (`sidechat.mjs:144`) e não há
  navegação por setas entre os itens; o `ArrowDown` do gatilho só foca o primeiro
  item. É o achado 1 — a evidência é o código e o próprio inventário, não uma
  imagem. **SEM CAPTURA.**
- **"Sempre por cima" fora do menu:** não existe diferença visual na janela; o
  estado só aparece no JSON (`alwaysOnTop`) e no `desk.json`. **SEM CAPTURA**
  (o inventário declara a ausência).

Estados exigidos pela rubrica que não estão no inventário e também não têm PNG
(a nota de "Estados" não os cobre; ver as notas ¹ e ³ da tabela):

- **Chat vazio** (novo, sem mensagens; existe `.sidechat-empty` em
  `sidechat.mjs:752`) — **SEM CAPTURA**.
- **Carregando/respondendo** (estado `busy`, linha de atividade e botão de
  parar; `sidechat.mjs:742`) — **SEM CAPTURA**.
- **Erro/indisponível** (`renderUnavailable` em `sidechat.mjs:668-672` e erro
  de pedido `.sidechat-request-error`) — **SEM CAPTURA**.
- **Cartão respondido** (acerto/erro/nota do quiz, estados `.correct`/`.wrong`
  de `tutor-chat.css:301-302`) — **SEM CAPTURA**; só o cartão inicial foi
  capturado.
- **Hover e toast de "copiado"** (`sidechat.copied` em
  `sidechat-message-view.mjs:75`) — **SEM CAPTURA**; a nota de Feedback cobre
  só o que está congelado.
- **Trazido de volta limpo em inglês a 900×650:** a captura
  `en-mesa-trazido-de-volta-light-900x650` existe, mas carrega o aviso de
  entrega incerta e o "Send" desligado da etapa anterior; para o estado
  restaurado normal, **SEM CAPTURA**.

Limitações de medição (não são ausência de imagem):

- O texto de estado do `menuitemcheckbox` ("Ligada"/"Desligada") é um
  pseudo-elemento `::after` (`tutor-chat.css:64-67`) e não entra no array
  `texts` do JSON; conferi no CSS: `--faint` #979797 sobre `#303030` = 4,52:1
  no escuro (passa) e #707070 sobre #fff = 4,95:1 no claro (passa).
- O JSON mede `rect` do `#sidechat-scope-text`, não a parte visível do texto
  truncado; a leitura do truncamento veio da PNG e da largura de 165,5 px.

## 4. Imagens

**Vi as imagens.** Abri 27 das 45 PNGs com a ferramenta de leitura: três das
quatro `solto-resposta-*` (claro e escuro 380×800 e claro 420×1000), três das
quatro `mesa-faixa-*` (claro 1440/900 e escuro 1440),
`mesa-menu-soltar-claro-1440x900`, `solto-menu-trazer-claro/escuro-380x800`,
`solto-menu-por-cima-claro-380x800`, `preso-cartao-claro-1440x900`,
`preso-cartao-claro/escuro-900x650`, `preso-incerto-claro-1440x900`,
`mesa-trazido-de-volta-claro/escuro-1440x900`, `en-preso-cartao-light-900x650`,
`en-solto-incerto-light-380x800`, `en-faixa-light-900x650`,
`en-menu-soltar-light-900x650`, `en-mesa-trazido-de-volta-light-900x650`,
`teclado-solto-01/04/05/07/08` e `teclado-faixa-claro-1440x900`. Nos 18 PNGs
restantes avaliei pelos JSON homônimos e pelo CSS/código (não inventei o que
não vi); de todos os 49 JSON li as medidas.
