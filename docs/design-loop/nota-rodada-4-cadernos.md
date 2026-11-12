# Nota da rodada 4 — cadernos

**Recorte:** #133 (biblioteca de cadernos `.xopp` + plugin MesaPagina), #135
(`ler_caderno` no diário do chat) e #158 (busca no texto dos cadernos e leitura
da tinta). **Capturas:** `docs/design-loop/rodada-4/antes/cadernos/` (173 PNG +
173 `.json` de medidas + `_falhas.json` vazio = 347 arquivos, como declara o
inventário). **Data da captura:** 2026-11-07. **Base do checkout:** `21eddada`
("capturas da rodada 4 (antes)"), que já inclui `e665046a` (retentativa da
leitura + próximo passo das recusas) e `caeda681` (`--faint` escuro). **Nota
escrita em:** 2026-11-09.

**Método:** 30 PNGs abertos (lista na seção 4) + os 173 `.json` de medidas em
lote (contraste WCAG, fonte, alvos, foco, rótulo) + CSS/JS de `desk/src`. O
movimento foi congelado na captura (`freezeMotion`): "Feedback e movimento" foi
julgado pelas pistas visíveis (spinner, toast, estados) e pelo CSS, não por
quadros de animação. A régua é a do pedido: 9 = polido; 8 = defeito visível; 7
ou menos = problema que o usuário sente. A referência da casa (tema inspirado no
Claude Desktop, cinzas neutros, composer colado na coluna, sem canvas de tinta e
leitura da tinta desligada por padrão) não conta como achado.

**Resumo:** os quatro achados da rodada 3 fecharam — a tinta agora retenta a
leitura (`Tentar ler de novo`), o toast duplicado saiu, as recusas do plugin
dizem o próximo passo e o `--faint` escuro subiu para `#a0a0a0`. Nenhum texto
reprova no AA em 1.256 nós medidos; nenhum dos 601 alvos fica abaixo de 24 px;
as 40 capturas de teclado têm foco visível de 2 px. O que segura o recorte em
8,5 são dois defeitos baixos e localizados no #158: (1) as linhas preservadas
durante "Buscando…" ficam com `opacity:.5` e caem para 3,36:1/2,22:1 no claro
(e 4,13:1/2,51:1 no escuro), embora continuem clicáveis; (2) o "×" de limpar do
campo de busca é o controle nativo do Chromium (~14 px), fora da rota de Tab e
do inventário de alvos. O caminho feliz da biblioteca, do plugin, da busca, do
diário e da tinta está consistente.

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
| Consistency & polish | 9,0 | 9,0 | 8,5 (2) | 8,5 |
| Clarity | 9,0 | 9,0 | 9,0 | 9,0 |
| Estados (vazio/carregando/erro) | 9,0 | 9,0 | 8,5 (1) | 8,5 |
| Feedback e movimento | 9,0 | 9,0 | 9,0 | 9,0 |
| Acessibilidade | 9,5 | 9,0 | 8,5 (1/2) | 8,5 |
| Janela pequena | 9,5 | 9,0 | 9,0 | 9,0 |
| **Overall** | **9,0** | **9,0** | **8,5** | **8,5** |

**Lastro dos 9,0 e dos 9,5.**

- **Typography (#133/#135/#158):** a escala é 12/700 (título do popover),
  13/600 (título do caderno), 12/600 (interruptor), 12,5 (diário), 12/400
  (trecho, erro, vazio), 11/400–600 (meta, grupo, estado, contagem) e mono 12,5
  no detalhe técnico. Nenhuma caixa de texto excede a região medida nos 173
  `.json`, e o `en` cabe nas mesmas caixas (`plugin-different-en`: "installed, different version"
  144×13 + "version 1.0.0 in the folder" 142×13 + "Update plugin" 104×30 dentro
  dos 498 px da linha; `busca-com-resultados-en`: "3 results" 339×13).
- **Hierarchy:** o título do popover (12/700) vence o grupo (11/600 caixa alta),
  que vence o nome do caderno (13/600) e a meta (11/400); no diário, a cabeça do
  turno (12/400) fica acima do passo (12,5) e do detalhe técnico (11); na tinta,
  o interruptor (12/600) vem antes da descrição (11) e do status (11). As
  recusas do plugin usam a frase do motivo (11) e a do próximo passo (11) em
  linhas separadas de 100% da largura, e a ação fica oculta nesses estados.
- **Spacing & density:** linhas de 49 px, resultados de 68, grupo de 21, gap de
  6; popover 367×397 em 1440 e 340×397 em 900; linha do plugin 498×30–37;
  painel da tinta 238–344; nenhuma caixa de texto sai da região medida
  (`textos[]` fora da região = 0). As 173 capturas estão dentro da janela
  (`regiao` fora de `janela` = 0).
- **Color & contrast:** 1.256 nós de texto medidos, **0 reprovações AA**. O
  menor é o `<mark>` da busca: 4,83:1 no claro (`#5c5c5c` sobre `#eedb8e`) e
  4,99:1 no escuro (`#fff` sobre `#7e6f34`). O vazio/`--faint` é 4,95:1 no
  claro (`#707070` sobre `#fff`) e 5,05:1 no escuro (`#a0a0a0` sobre `#303030`);
  o erro da tinta 5,74:1 (claro) e 5,96:1 (escuro); o aviso/recusa do plugin
  5,55–6,69:1; a ação azul 7,42:1 no claro e 5,79:1 no escuro; o `--danger-text`
  sobre a cabeça de falha em hover fica em 5,74:1 no claro e 4,77:1 no escuro
  (a regra do hover agora mantém `--surface`).
- **Iconography:** Lucide coerente — livro em `ler_caderno`, check/alert no
  estado do turno, chevron no diário e × no fechar; spinner de 3 pontos
  (`ts-dots`) na instalação e no `Buscando…`; pontos de status do plugin (`muted`, `busy`, `ok`, `new`, `warn`) todos `aria-hidden` porque o
  texto ao lado carrega o estado. Nenhum ícone de chave de fenda no passo de
  `ler_caderno` (N14 da rodada 2 segue fechado).
- **Consistency & polish:** os estados do plugin usam o mesmo molde (ponto +
  estado + versão + ação + linha de reiniciar/próximo passo); a instalação usa
  `Instalando…` com `disabled` + `aria-busy`, o erro usa `role=alert` sem toast,
  as recusas escondem o botão e mostram o próximo passo. A busca usa o mesmo
  `ts-dots` da instalação e o mesmo padrão de hover das linhas; o painel da
  tinta usa os mesmos tokens de superfície/borda. O defeito de consistência do
  #158 é o achado 2 (o × nativo do campo não segue os 28 px do × do popover).
- **Clarity:** os textos dizem o estado e a ação — "Atualizar plugin" com
  "versão 1.0.0 na pasta" (N4), "Renomeie ou remova a pasta MesaPagina e reabra
  o Sobre." (`modified`), "Mova a pasta…" (`foreign`), "Troque o link…"
  (`symlink`), "Tentar ler de novo" + "Tentar desligar de novo" na tinta,
  "Nenhum resultado. Tente outro termo.", "3 resultados", "Pausado: sem cota",
  "Em dia". A3 da rodada 3 fechou: a recusa explica o motivo e o que fazer.
- **Estados:** os 26 estados do inventário (25 séries de captura) têm foto
  (`_falhas.json` vazio): biblioteca cheia/vazia, plugin não instalado/instalando/instalado/aviso/erro/
  different/modified/foreign/symlink, `ler_caderno` andamento/ok/erro, busca
  vazia/buscando/sem resultado/com resultado, tinta desligada/sem chave/Claude/
  lendo/ligada/cota/erro/status-erro, 2 hovers e 10 rotas de teclado. O que não
  existe de propósito está na seção 3. O #158 perde 0,5 no achado 1.
- **Feedback e movimento:** spinner de 3 pontos na instalação e na busca,
  `aria-busy` no botão e no interruptor, `role=status`/`aria-live` na busca e no
  status da tinta, `role=alert` no erro inline, toast de sucesso do plugin (fora
  do diálogo), hover medido (linha `#e6e6e6` no claro e `rgba(255,255,255,.09)`
  no escuro; interruptor idem), foco de 2 px. O movimento em si está congelado;
  a presença e o lugar das pistas foram conferidos.
- **Acessibilidade #133 (9,5):** 601 alvos nos `.json`, **0** com `abaixo24`;
  fechar 28×28, linhas 349×49, interruptor 335×28, ações do plugin 114–169×30,
  retry 374×30, × do Sobre 28×28. Rótulos acessíveis vazios = 0. As 8 capturas
  de teclado do plugin (2 bases × 4) têm `focusVisible=true` e anel de 2 px. O
  ponto de status é `aria-hidden` e o texto vizinho carrega o estado.
- **Acessibilidade #135 (9,0):** as 8 capturas de teclado do diário (2 bases ×
  4) têm `focusVisible=true`, anel de 2 px (claro `#2548c7`, escuro `#8fa8ff`);
  a cabeça mede 366×24–28 (≥24) e o passo 357×29; os nomes acessíveis dos passos
  são curtos ("Ler o caderno: aula-nova.xopp, página 1") e o JSON cru fica no
  bloco técnico, fora do nome (N9). Nota: o `rotulo` do kit é concatenação de
  `textContent`; ele não prova o nome que o leitor de tela calcula (ver a
  cobertura parcial na seção 3), por isso não virou achado.
- **Acessibilidade #158 (8,5):** os mesmos 601 alvos e as 24 capturas de teclado
  da busca/tinta têm foco visível; o interruptor tem `role=switch`,
  `aria-checked` e `aria-describedby`; a busca tem `role=status`; a tinta tem
  `aria-live`. Perde 1,0 nos achados 1 (texto a 50%) e 2 (o × nativo ~14 px, fora da
  rota de Tab e do inventário).
- **Janela pequena:** o popover usa `max-height:min(64vh,440px)` e rola por
  dentro; em 900×650 ele mede no máximo 340×399 (tinta-status-erro 340×344), o
  Sobre cabe (nas rotas de teclado, 540×457 em y=83–540; com o aviso, y=74–590)
  e o toast de sucesso fica à direita do diálogo (x≈752–888), sem cobri-lo; o
  diário rola no `#messages`; nenhuma região sai da janela.

## 2. Achados

### 1 — baixa — Estados / Acessibilidade — as linhas preservadas em "Buscando…" caem abaixo do AA e continuam clicáveis

Capturas: `busca-buscando-light-1440x900.png` e `busca-buscando-dark-900x650.png`
(e `-dark-1440x900`, `-light-900x650`).
Medido: nas linhas em repouso, o título é 17,58:1 e a meta 6,69:1 no claro (a
primeira linha, sob o ponteiro, mede 14,09/14,09); a regra
`#notebooks-list.notebooks-searching{opacity:.5}` reduz o conjunto — o título de
13 px cai para **3,36:1** (claro) e **4,13:1** (escuro), e a meta de 11 px para
**2,22:1** (claro) e **2,51:1** (escuro), abaixo dos 4,5:1 exigidos.
Os três `<button.notebooks-row>` continuam `desabilitado=false` no `.json` e não
há `aria-busy` na lista: a tela parece desabilitada, mas o clique ainda abre o
caderno antigo. O spinner de 3 pontos e o `role=status` estão lá (N10 fechado);
o problema é só o texto apagado.
Sugestão: não apagar o texto — cobrir a lista com um overlay/skeleton enquanto
`buscando` e deixar as linhas em contraste cheio, ou desabilitá-las de verdade
(`disabled`/`pointer-events:none` + `aria-busy`) enquanto a busca não chega.
Arquivo: `desk/src/conversations-dividers.css:43` (`#notebooks-list.notebooks-searching`)
e `desk/src/notebooks.mjs:303-316` (a classe e o status).

### 2 — baixa — Acessibilidade / Consistência — o "×" de limpar a busca é o controle nativo (~14 px), fora da rota de Tab e do inventário de alvos

Capturas: `busca-com-resultados-light-1440x900.png` (o × dentro do campo, à
direita) e `busca-buscando-dark-900x650.png`.
Medido: o campo é `<input type="search">` (`notebooks.mjs:159-161`) e o × é o
`::-webkit-search-cancel-button` do Chromium; ele não aparece no `.alvos[]`
(601 alvos, nenhum abaixo de 24 — o fechar do popover é 28×28, o campo 349×28),
não entra nas 40 rotas de teclado (o Tab vai campo → linhas → interruptor) e o
glifo mede cerca de 14×14 px na imagem. Para quem usa mouse, o alvo é bem menor
que os 24 px do resto; para quem usa teclado, não existe.
Sugestão: esconder o nativo (`::-webkit-search-cancel-button{-webkit-appearance:none}`)
e desenhar um botão de 24–28 px com `aria-label` "Limpar busca", ou manter o
nativo mas aumentar a área e a rota de teclado.
Arquivo: `desk/src/notebooks.mjs:159-184`; estilo do campo em
`desk/src/conversations-dividers.css:56-58`.

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
- o `rotulo` do kit é `aria-label`/`aria-labelledby`/`title`/`textContent`; ele
  não é o nome que o leitor de tela calcula. Por isso o "Lendo o caderno1s" do
  cabeçalho vivo (concatenação sem espaço) ficou como limitação de medição, não
  como achado.

## 4. O que eu vi

**Abri 30 PNGs** (de 173); nas 143 restantes usei o `.json` de medidas, o CSS e
o JS, sem afirmar o que só a imagem mostraria (sombra, posição exata de toast
fora dos casos vistos). Os 30:

- **biblioteca:** `biblioteca-lista-light-1440x900`,
  `biblioteca-lista-dark-900x650`, `biblioteca-vazia-light-900x650`,
  `biblioteca-vazia-dark-1440x900`.
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
  `ler-caderno-ok-dark-900x650`.
- **tinta:** `tinta-desligada-padrao-light-1440x900`,
  `tinta-sem-chave-dark-1440x900`, `tinta-claude-light-1440x900`,
  `tinta-lendo-light-1440x900`, `tinta-ligada-dark-1440x900`,
  `tinta-quota-dark-900x650`, `tinta-erro-light-1440x900`,
  `tinta-status-erro-light-1440x900`.
- **foco:** `teclado-cadernos-busca-light-1440x900`,
  `teclado-tinta-interruptor-light-1440x900`.

`ler-caderno-erro`, `busca-vazia` e os quatro hovers foram julgados só pelo
`.json`; não os abri. Os valores citados deles vêm da medição, não da imagem.

## 5. Achados da rodada 3

**Status:** 4 RESOLVIDOS, 0 PARCIAIS, 0 ABERTOS. A tabela cita a captura nova
que prova cada status; quando a prova é de código, digo explicitamente.

| Achado da rodada 3 | Status | Prova na rodada 4 |
|---|---|---|
| A1 — erro persistente da tinta sem retentativa da leitura | **RESOLVIDO** | `tinta-status-erro-light-1440x900.png` e `-dark-900x650`: a linha do status agora tem "Tentar ler de novo" (112×24, 7,42:1 no claro / 7,23:1 no escuro) ao lado de "Erro ao ler a tinta" (5,74/5,96:1), e o inline da outra falha mantém "Tentar desligar de novo" (141×24). O `retryRead` chama `set(true)` sem passar pelo desligamento e esconde o botão do status quando o inline assume a ação (`notebooks-ink-panel.mjs:73-78,147-148,204-228`). |
| A2 — toast duplicava o erro inline da tinta | **RESOLVIDO** | `tinta-erro-light-1440x900.png`: só o erro inline "Não foi possível ligar a leitura da tinta." (5,74:1) com "Tentar ligar de novo" (122×24), **sem toast**. O roteiro agora falha se o erro abrir toast (`capture-ciclo2-cadernos.mjs:356`) e o `notify` é aceito e nunca chamado (`notebooks-ink-panel.mjs:42`; nenhuma chamada no arquivo); o toast do erro da tinta que a rodada 3 viu em inglês não tem mais como aparecer. |
| A3 — recusas do plugin não diziam o próximo passo | **RESOLVIDO** | `plugin-modified-light-1440x900.png`, `plugin-foreign-dark-1440x900.png` e `plugin-symlink-dark-900x650.png`: entrou a linha de 100% da largura "Renomeie ou remova a pasta MesaPagina e reabra o Sobre." (498×16, 6,69:1), "Mova a pasta MesaPagina para outro lugar e reabra o Sobre." e "Troque o link por uma pasta comum e reabra o Sobre." (5,55:1 no escuro). O botão "Instalar plugin da página" agora fica `hidden` nesses três estados (`dialogs.mjs:257,290-306`; `locales:419-421`), então não há mais ação morta. |
| A4 — contraste sem margem no `--faint` escuro e na cabeça de falha em hover | **RESOLVIDO** | `biblioteca-vazia-dark-1440x900.png` e `busca-sem-resultado-dark-1440x900.json`: o vazio escuro mede **5,05:1** (era 4,52) com `--faint` escuro `#a0a0a0` (`style.css:21`); no claro, 4,95:1. A cabeça de falha mantém 5,74:1 no estado base; no hover, a regra `.work[data-failed=true] .work-head:hover{background:var(--surface)}` (`tutor-chat.css:362`) impede o fundo `#e6e6e6`/`#333` que derrubava para 4,60/4,57 — o cálculo fica em 5,74:1 no claro e 4,77:1 no escuro. Nos 1.256 textos, o menor é o `<mark>` 4,83/4,99; não há mais nada abaixo de 4,8. |

O item 4 do inventário ("o erro do vigia não tem ação própria") fecha junto com
o A1 da rodada 3. As duas rotas de teclado do plugin que a rodada 2 listou como SEM CAPTURA
continuam cobertas (8 capturas de teclado do plugin nas quatro variantes).

## 6. Decisões do autor

- **D1 (converter síncrono no Xournal++):** não afeta esta nota; o convert é UI
  do Xournal++ e está fora do recorte de cadernos. **decisão do autor.**
- **D2 (Cadernos a três cliques):** a rota foi exercitada de verdade nesta
  rodada (`teclado-cadernos-botao` chega ao botão pelo menu Mais opções →
  Contexto); o custo de descoberta continua sendo escolha da casa e **não
  desconta** a nota de Clarity. **decisão do autor.**
- **D3 (capas de caderno):** a biblioteca continua na opção C (lista como
  está); não muda os achados desta rodada. **decisão do autor.**
