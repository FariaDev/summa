# Nota da rodada 3 — cadernos

**Recorte:** #133 (biblioteca de cadernos `.xopp` + plugin MesaPagina), #135
(`ler_caderno` no diário do chat) e #158 (busca no texto dos cadernos e leitura
da tinta). **Capturas:** `docs/design-loop/rodada-3/antes/cadernos/` (173 PNG +
173 `.json` de medidas + `_falhas.json` vazio = 347 arquivos; todos os blocos
imprimiram `ok`). **Data da captura:** 2026-11-07. **Base do checkout:** `fdda29b6`
(“capturas de antes da rodada 3 no HEAD com os consertos da rodada 2”). **Nota
escrita em:** 2026-11-08.

**Método:** imagens + `.json` de medidas (contraste WCAG, fonte, alvos, foco e
rótulo acessível) + CSS/JS de `desk/src`. O movimento foi congelado na captura
(`freezeMotion`): “Feedback e movimento” foi julgado pelas pistas visíveis
(spinner, toast, estados) e pelo CSS, não por quadros de animação. A régua é a do
pedido: 9 = polido; 8 = defeito visível; 7 ou menos = problema que o usuário
sente. A referência da casa (tema inspirado no Claude Desktop, cinzas neutros,
composer colado na coluna, sem canvas de tinta e leitura da tinta desligada por
padrão) não conta como achado.

**Resumo:** os consertos da rodada 2 entraram. Dos 14 achados daquela nota, 13
fecharam e 1 ficou **parcial** (N5, `modified`): a frase e o botão desabilitado
entraram, mas a linha ainda não diz o que a pessoa deve fazer. A rodada 3 também
fechou as duas rotas de teclado do plugin que a rodada 2 listou como SEM CAPTURA
(`teclado-plugin-instalar` e `teclado-plugin-fechar`). O que ainda segura a nota:
(a) o **erro persistente da leitura da tinta não tem retentativa da leitura**
(item 4 do inventário, ainda aberto), (b) o **toast duplica o erro inline** da
tinta, (c) as **recusas do plugin não dizem o próximo passo** e (d) dois textos
passam no AA por 0,02–0,10 de margem (`--faint` no escuro e a cabeça de falha no
hover). O caminho feliz da biblioteca, da busca e do diário está consistente.

## 1. Notas

| Categoria | #133 biblioteca + plugin | #135 `ler_caderno` na conversa | #158 busca + leitura da tinta | Geral |
|---|---|---|---|---|
| Typography | 9,0 | 9,0 | 9,0 | 9,0 |
| Hierarchy | 9,0 | 9,0 | 9,0 | 9,0 |
| Spacing & density | 9,0 | 9,0 | 9,0 | 9,0 |
| Color & contrast | 9,0 | 9,0 | 9,0 | 9,0 |
| Iconography | 9,0 | 9,0 | 9,0 | 9,0 |
| Consistency & polish | 9,0 | 9,0 | 8,5 (A2) | 8,5 |
| Clarity | 8,5 (A3) | 9,0 | 9,0 | 8,5 |
| Estados (vazio/carregando/erro) | 9,0\* | 9,0 | 8,0 (A1) | 8,5 |
| Feedback e movimento | 9,0 | 9,0 | 9,0 | 9,0 |
| Acessibilidade | 9,5† | 9,0 | 9,5 | 9,5 |
| Janela pequena | 9,5 | 9,0 | 9,5 | 9,5 |
| **Overall** | **9,0** | **9,0** | **8,5** | **8,5** |

\* A nota de Estados do #133 cobre os estados capturados da biblioteca e do
plugin; a ação “abrir no Xournal++” não tem tela na Mesa (seção 3), então o
retorno visual dela fica fora. A nota de Clarity do #133 **não desconta D2
(decisão do autor)**: os três cliques do F18 seguem registrados, mas a descoberta
pelo menu é a escolha atual da casa (#123).

† A nota de Acessibilidade do #133 inclui agora as duas rotas de teclado do
plugin (`teclado-plugin-instalar` e `teclado-plugin-fechar`), que a rodada 2 não
tinha. As 40 capturas de teclado (10 bases × 4 variantes) têm `focusVisible=true`
e anel de 2 px medido.

**Por que os 9 e os 9,5.** Typography tem a escala 12/700 (título do popover),
13/600 (título do caderno), 12/600 (interruptor), 12,5/18,75 (diário), 12/400
(trecho e ação), 11/400–600 (meta, grupo, estado, contagem) e mono 12,5 (detalhe
técnico), sem corte nem sobreposição em nenhuma variante; o `en` de
`biblioteca-lista` e `busca-com-resultados` cabe na mesma caixa. Spacing tem
linhas de 49 px, grupo de 21, gap de 6, popover 367×397 em 1440 e 340×397 em
900×650, resultados de 68 e lista que rola por dentro. Iconography usa Lucide
coerente (fechar, chevron, ponto de status, spinner de 3 pontos, livro para
`ler_caderno`, marca `<mark>` na busca); N14 fechou. Color & contrast não tem
falha AA: fora os dois casos de margem de A4, o menor texto é 4,95:1 no claro
(`--faint` #707070 sobre #fff) e 5,31:1 no escuro (`--muted` #a8a8a8 sobre #333),
o erro inline 5,74:1, o aviso do plugin 5,33:1, a ação azul 7,42:1 e o `<mark>`
4,83:1 no claro / 4,99:1 no escuro. Acessibilidade mediu **611 alvos** em 173
`.json`: **nenhum** `abaixo24`; o interruptor é 335×28, o fechar 28×28, as linhas
349×49, os resultados 349×68, as ações do plugin 114–169×30, as retentativas
122–141×24 (tinta) e 374×30 (plugin). Janela pequena: as 173 capturas cabem em 900×650 (maior popover
340×416; o Sobre e a linha do plugin cabem, e o toast do plugin agora flutua à
direita do diálogo, sem cobri-lo).

## 2. Achados

### A1 — média — Estados / Clarity — o erro persistente da tinta não oferece retentativa da leitura

Captura: `tinta-status-erro-light-1440x900.png` (e `-dark-900x650`).
Medido: “Erro ao ler a tinta” em `#c81e1e` sobre `#fff` = **5,74:1** (vermelho,
corrigido); “5 páginas lidas” em 11/600; a linha abaixo, “Não foi possível
desligar a leitura da tinta.”, também 5,74:1; a única ação é **“Tentar desligar
de novo” 141×24**, que refaz o desligamento (`retry.textContent` segue
`snapshot.enabled===true`). O interruptor continua `aria-checked=true`. Para
retomar a leitura que falhou, a pessoa precisa descobrir sozinha que deve desligar
e ligar de novo.
Sugestão: com `status === 'error'`, oferecer “Tentar ler de novo” (um `set(true)`
sem passar pelo desligamento) ao lado do “Tentar desligar de novo”, ou trocar o
retry para a leitura quando o erro é do vigia.
Arquivo: `desk/src/notebooks-ink-panel.mjs:132,184` (rótulo e `toggle`) e
`desk/src/locales/pt-BR.json:1730`; o estilo do status em
`desk/src/conversations-dividers.css:89`.

### A2 — baixa — Consistency & polish — o toast duplica o erro inline da tinta

Capturas: `tinta-erro-light-1440x900.png`, `tinta-status-erro-light-1440x900.png`
(e `-light-900x650`, `-dark-900x650`).
Medido: o erro inline “Não foi possível ligar/desligar a leitura da tinta.”
aparece a 5,74:1 com “Tentar … de novo”; **o mesmo texto** aparece de novo no
toast do canto inferior direito. O erro do plugin já resolveu exatamente isso na
rodada 2 (N12): lá o toast repetido saiu e o inline ficou como única mensagem.
Sugestão: não chamar `notify()` quando o erro inline está visível (ou manter só o
toast).
Arquivo: `desk/src/notebooks-ink-panel.mjs:166-178` (`paintError`/`notify`); o
padrão sem toast do plugin está em `desk/src/about-update.mjs:95-104`.

### A3 — baixa — Clarity / Consistency — as recusas do plugin não dizem o próximo passo

Capturas: `plugin-modified-light-1440x900.png`, `plugin-foreign-light-1440x900.png`
e `plugin-symlink-dark-900x650.png` (e `-dark`, `-en`, `-900x650`).
Medido: as frases completas entraram (“A pasta MesaPagina foi modificada — não
vou sobrescrevê-la.”, 341 px, 6,69:1; “Já existe uma pasta … de outro autor …”,
384 px; “O alvo é um link simbólico …”, 269 px), e o botão “Instalar plugin da
página” **169×30, `disabled=true`** (opacidade .55). O estado agora explica o
motivo, mas não oferece saída: a linha não diz se a pessoa deve renomear, remover
ou corrigir a pasta, e a única ação visível está desabilitada.
Sugestão: acrescentar uma linha de próximo passo (“Renomeie/remova a pasta
MesaPagina e reabra o Sobre”) ou um “Ver motivo” que abra instruções; alternativa:
esconder a ação desabilitada nesses três estados.
Arquivo: `desk/src/dialogs.mjs:257,287-297` e
`desk/src/locales/pt-BR.json:405,418-419`.

### A4 — baixa — Color & contrast — dois textos passam no AA sem margem

Capturas: `biblioteca-vazia-dark-1440x900.json`/`-900x650`,
`busca-sem-resultado-dark-1440x900.json` e `ler-caderno-erro-light-1440x900.json`
(e `-dark-1440x900`).
Medido: o vazio `--faint` `#979797` sobre `--raised` `#303030` dá **4,52:1** no
escuro (o limite é 4,5:1); no claro, `#707070` sobre `#fff` = 4,95:1. A cabeça de
falha `--danger-text` no hover do `.work-head` mede **4,60:1** no claro
(`#c81e1e` sobre `#e6e6e6`) e **4,57:1** no escuro (`#f87171` sobre `#333`). Nos
173 `.json`, todos os textos abaixo de 4,6:1 são variantes do `--faint` (4,52)
ou a cabeça de falha no hover (4,57–4,60); nada reprova, mas a margem é
0,02–0,10.
Sugestão: subir o `--faint` escuro um passo (ex.: `#a3a3a3`) e não escurecer o
fundo sob a cabeça de falha (ou escurecer o vermelho claro), para dar margem de
AA.
Arquivo: `desk/style.css:21` (`--faint`) e `desk/src/tutor-chat.css:382,390`
(`--danger-text`/`--hover`).

### Evidências de suporte (sem defeito)

**E1 — Alvos.** 611 entradas de alvo nos 173 `.json`: **nenhuma** com
`abaixo24`. O interruptor da tinta 335×28, o fechar 28×28, as linhas 349×49, os
resultados 349×68, as retentativas 122–141×24 (tinta) e 374×30 (plugin), as
ações do plugin 114–169×30, o × do Sobre 28×28. O F13 da rodada 1 continua
fechado.

**E2 — Foco.** As 40 capturas de teclado (10 bases × 4) têm `focusVisible=true` e
anel de 2 px: `#2548c7` no claro e `#8fa8ff` no escuro. O anel aparece no campo,
no fechar, na linha, no interruptor, no botão Cadernos, na cabeça/passo do diário,
no botão de instalar e no × do Sobre. As duas rotas do plugin que a rodada 2
listou como SEM CAPTURA agora existem e medem.

**E3 — Contraste de texto.** Fora os dois casos de margem (A4), o menor texto é
4,95:1 (`notebooks-empty`/`search-empty` no claro; 5,31–5,64 no escuro), o
`<mark>` 4,83/4,99, o erro inline da tinta 5,74, o aviso do plugin 5,33 e a ação
azul 7,42. A cabeça de falha do diário fica em 5,74 sem hover; 4,60/4,57 no
hover (passa, mas é o caso de A4).

**E4 — Nomes acessíveis.** Linhas da biblioteca com vírgulas (“aula-nova.xopp,
sub · 01:51”); fechar com “Fechar”; interruptor com `role=switch`,
`aria-checked` e `aria-describedby` para `notebooks-ink-desc`; passo do diário
com nome curto de 39 caracteres; resultado da busca com `aria-label`
caderno/matéria/página **e** `aria-describedby` para o trecho (N3 fechou no
código). O `role=status` da busca e o `aria-live=polite` do painel da tinta estão
no lugar; o erro inline tem `role=alert`.

**E5 — Espaçamento.** Popover 367×397 em 1440 e 340×397 em 900; linhas de 49,
grupo de 21, gap de 6; resultados de 68; vazio 208; tinta 238–316; Sobre 540 de
largura; plugin 498×30–112. Sem corte nem sobreposição nas 173 capturas.

**E6 — Janela pequena.** As variantes claro/escuro em 1440×900 e 900×650, mais o
`en` em 1440×900, e as 40 de teclado cabem; o popover usa
`max-height:min(64vh,440px)` e rola por dentro; o diário rola no `#messages`; o
toast do plugin em 900×650 fica à direita do diálogo (não cobre mais o Sobre,
como em N11).

**E7 — Caminho de erro do diário.** `ler-caderno-erro-light/dark` mostram a
cabeça vermelha “Não consegui ler o caderno”, o passo com ícone vermelho, o
motivo (“Página 2 não existe (o caderno tem 1).”) e o detalhe técnico. O F12
fechou; o passo ok não repete mais a frase no corpo (N9).

**E8 — Estados de vazio e de sucesso.** `biblioteca-vazia` ensina o próximo passo
(“Salve um na pasta da matéria e ele aparece aqui.”) sem segundo bloco longe do
campo; `busca-sem-resultado` tem uma mensagem só; o ok do diário tem rótulo
humano e o técnico atrás de “Detalhes técnicos”; a instalação do plugin tem
“Instalando…” com spinner, “Instalado” com a linha persistente de reiniciar e o
erro inline sem toast.

## 3. SEM CAPTURA

Estados do inventário sem captura — não entram na nota da categoria naquele
estado. O `_falhas.json` está vazio; os dois são declarados fora do recorte (não
são UI da Mesa).

| Estado | Por que não há captura | O que fica fora |
|---|---|---|
| Abrir o caderno no Xournal++ | A ação fecha o popover e abre outro programa; a janela do Xournal++ não é UI da Mesa (o teste usa `fake-xournalpp.mjs`). | O retorno visual da abertura e o estado do popover depois do clique. A prova da abertura e da página é o IPC (`tests/notebooks-ui.mjs`; `notebooks.mjs:288` passa `page`). A nota de Estados do #133 não cobre esse estado. |
| Comportamento do plugin dentro do Xournal++ (Ctrl+Alt+R/B, converter, trocar fonte) | É UI do Xournal++ com o plugin carregado, fora da janela da Mesa. | Toda a interação do plugin no programa de escrita. A nota do #133 cobre só a linha do Sobre e a instalação. |

**Cobertura parcial (não é “sem captura”, mas limita o que se pode afirmar):**

- o teclado só tem PT (claro/escuro × 1440×900 e 900×650) e o hover, PT
  (claro/escuro) só em 1440×900; as variantes `en` cobrem os estados-base, não
  o teclado/hover;
- as capturas de `plugin-different/modified/foreign/symlink` vêm do IPC falso
  `components`, que devolve só a linha do Xournal++: não se pode julgar o
  diálogo do Sobre inteiro nessas quatro variantes, só a linha e a ação;
- as capturas de teclado do diário (`teclado-ler-caderno-*`) saíram com o
  **diário em inglês** (“Worked for 13s · 1 tool”, “Read the notebook…”), apesar
  de o `.json` registrar `idioma: pt-BR`. É artefato de captura (o rótulo foi
  pintado no último estado `en` da série); os estados PT normais estão em
  `ler-caderno-ok-light-1440x900` e `ler-caderno-andamento-light-1440x900`;
- em `ler-caderno-erro-en`, o detalhe do `toolResult` sintético está em
  português (“Página 2 não existe...”); é dado do histórico sintético, não uma
  string fixa do `worklog-view`;
- `teclado-tinta-linha-dark-900x650.png` carrega um toast em inglês
  (“Could not turn off handwriting reading.”) de um estado anterior da mesma
  página; o painel medido está limpo (sem erro inline), mas a captura não serve
  para julgar o toast/idioma. É artefato de captura, não achado de produto.

As duas rotas de teclado do plugin que a rodada 2 listou como SEM CAPTURA
(`teclado-plugin-instalar`/`teclado-plugin-fechar`) agora têm PNG e `.json` nas
quatro variantes; a lacuna fechou.

## 4. O que eu vi

**Vi as imagens, sim.** Abri **52 PNGs** (de 173 variantes); nas 121 que não abri
usei o `.json` de medidas e o CSS/JS, sem afirmar o que só a imagem mostraria
(sombra, posição exata do toast, detalhe de foco). Os 52:

- **biblioteca:** `biblioteca-lista-light-1440x900`, `-dark-1440x900`,
  `-light-900x650`, `-en-1440x900`; `biblioteca-vazia-light-1440x900`,
  `-dark-900x650`.
- **plugin:** `plugin-nao-instalado-light-1440x900`, `plugin-instalando-light-1440x900`,
  `plugin-instalado-light-1440x900`, `-dark-1440x900`,
  `plugin-instalado-aviso-light-1440x900`, `-dark-900x650`, `-light-900x650`,
  `plugin-erro-light-1440x900`, `-light-900x650`, `plugin-different-light-1440x900`,
  `-light-900x650`, `plugin-modified-light-1440x900`, `-dark-900x650`,
  `plugin-foreign-light-1440x900`, `plugin-symlink-dark-900x650`.
- **busca:** `busca-buscando-light-1440x900`, `-dark-900x650`;
  `busca-com-resultados-light-1440x900`, `-dark-900x650`;
  `busca-sem-resultado-light-1440x900`.
- **diário:** `ler-caderno-andamento-light-1440x900`, `-en-1440x900`,
  `-dark-900x650`; `ler-caderno-ok-light-1440x900`, `-dark-900x650`;
  `ler-caderno-erro-light-1440x900`.
- **tinta:** `tinta-desligada-padrao-light-1440x900`, `tinta-sem-chave-dark-1440x900`,
  `tinta-claude-light-1440x900`, `tinta-lendo-light-1440x900`,
  `tinta-quota-dark-1440x900`, `tinta-erro-light-1440x900`, `-light-900x650`,
  `tinta-status-erro-light-1440x900`, `-dark-900x650`,
  `hover-tinta-interruptor-dark-1440x900`, `hover-linha-caderno-dark-1440x900`.
- **teclado:** `teclado-plugin-instalar-light-1440x900`, `-light-900x650`;
  `teclado-plugin-fechar-dark-900x650`; `teclado-tinta-interruptor-light-1440x900`;
  `teclado-cadernos-linha-light-1440x900`; `teclado-cadernos-botao-light-900x650`;
  `teclado-ler-caderno-passo-light-900x650`; `teclado-cadernos-fechar-dark-900x650`;
  `teclado-tinta-linha-dark-900x650`.

Para as 121 variantes restantes usei o `.json` e o código. As capturas têm
`freezeMotion`, então não há como julgar a animação em si — só a presença dos
estados e dos realces.

## 5. Achados da rodada 2

**Status:** 13 RESOLVIDOS e 1 PARCIAL (N5). Nenhum ABERTO. A tabela cita a
captura nova que prova cada status; quando a prova é de código (N3, N7), digo
explicitamente e mostro o valor medido na captura-base.

| Achado da rodada 2 | Status | Prova na rodada 3 |
|---|---|---|
| N1 — erro inline da tinta fantasma | **RESOLVIDO** | `hover-tinta-interruptor-light-1440x900.json` e `-dark`: nenhum `.notebooks-ink-error`, popover 367×254 (o mesmo de `tinta-desligada-padrao`); o `refresh()`/`setActive(false)` limpam o erro e o texto é repintado por chave (`notebooks-ink-panel.mjs:99-102,137-143,153`). Não há mais erro em inglês sob UI em PT no painel. |
| N2 — Tab desce ao pé e volta à lista | **RESOLVIDO** | `teclado-tinta-linha-light-1440x900.json` (foco na linha y=192) e `teclado-tinta-interruptor-light-1440x900.json` (interruptor y=254): a ordem é campo (y=127) → linha → interruptor, e o painel é anexado depois da lista no DOM (`list.after(inkPanel.element)`, `notebooks.mjs:201`), sem `order` no CSS. |
| N3 — trecho fora do nome acessível da busca | **RESOLVIDO (código)** | `busca-com-resultados-light-1440x900.json` mostra o trecho “Equação do primeiro grau” (12 px, `<mark>` 4,83:1) na linha de 349×68; o `aria-describedby` aponta para o `excerpt.id` (`notebooks.mjs:273-277`). O kit mede o nome (caderno/matéria/página), não a descrição; a prova é o código, sem leitor de tela real. |
| N4 — `different` com rótulo de instalação nova | **RESOLVIDO** | `plugin-different-light-1440x900.png`: “Atualizar plugin” 114×30 habilitado e “versão 1.0.0 na pasta” 120×13 a 6,69:1 (`dialogs.mjs:273-275,288-291`, `locales:403,411`). |
| N5 — `modified` só “modificado” e ação habilitada | **PARCIAL** | `plugin-modified-light-1440x900.png`: a frase completa entrou (341 px, 6,69:1) e a ação está `disabled=true` (169×30, opacidade .55), então o defeito medido de N5 fechou; **falta o próximo passo** (“o que fazer”), que é o achado A3 desta rodada. |
| N6 — `foreign`/`symlink` com instalar habilitado | **RESOLVIDO** | `plugin-foreign-light-1440x900.png` e `plugin-symlink-dark-900x650.png`: frases completas a 6,69:1 e ação 169×30 `disabled=true` (`dialogs.mjs:257,287-297`). |
| N7 — “Detalhes técnicos” reprova no hover | **RESOLVIDO (código)** | `ler-caderno-ok-light-1440x900.json`: `.step-tech-label` agora é `--muted` `#5c5c5c` sobre `#fff` = 6,69:1 (era `#707070`). Sobre o hover `#e6e6e6` o cálculo dá 5,36:1 no claro e 5,31:1 no escuro (`#a8a8a8` sobre `#333`), acima de 4,5; não há captura de hover do passo, então a prova do hover é o CSS (`tutor-chat.css:390,404`). |
| N8 — meta do resultado reprova no hover escuro | **RESOLVIDO** | `busca-com-resultados-dark-1440x900.json`: “Cálculo I · página 1” no hover agora é `#efefef` sobre `#434343` = **8,6:1** (era 4,16); a regra `.notebooks-search-row:hover .notebooks-meta{color:var(--fg)}` entrou (`conversations-dividers.css:66`). |
| N9 — passo ok repete a frase no toggle e no corpo | **RESOLVIDO** | `ler-caderno-ok-light-1440x900.json` não tem mais `.step-text` (só rótulo, “Detalhes técnicos” e o JSON); `ler-caderno-andamento-light` tem cabeça “Lendo o caderno” e passo só “aula-nova.xopp, página 1”. `stepBody()` devolve vazio quando o texto é igual ao rótulo (`worklog-view.mjs:139-146`). |
| N10 — “Buscando…” sem indicador | **RESOLVIDO** | `busca-buscando-light-1440x900.png` e `-dark-900x650`: um spinner de 3 pontos (`ts-dots`, `aria-hidden`) antes de “Buscando…” (11 px, 6,69:1), com a lista anterior a `.5`. `notebooks.mjs:164-170,298`. |
| N11 — aviso de reiniciar só no toast e toast cobre o Sobre | **RESOLVIDO** | `plugin-instalado-light-1440x900.png`: “Reinicie o Xournal++ para carregar o plugin.” é linha persistente 400×16 a 6,69:1 (`dialogs.mjs:278-281`); em `plugin-instalado-aviso-dark-900x650.png` o toast “Plugin instalado.” fica à direita do diálogo (x 752–888), sem cobrir o Sobre. |
| N12 — erro do plugin com duas ações iguais e toast | **RESOLVIDO** | `plugin-erro-light-1440x900.png` e `-light-900x650`: a ação da linha fica `disabled=true`; “Tentar de novo” 374×30 é a ação única; o toast não existe (o roteiro falha se ele aparecer, `capture-ciclo2-cadernos-plugin.mjs:144-145`; `about-update.mjs:95-104`). |
| N13 — erro do vigia cinza e retry do desligamento | **RESOLVIDO** | `tinta-status-erro-light-1440x900.png`: “Erro ao ler a tinta” agora em `--danger-text` `#c81e1e` = **5,74:1** e o botão diz o que faz: “Tentar desligar de novo” 141×24 (`notebooks-ink-panel.mjs:132`; `conversations-dividers.css:89`). A falta de retentativa **da leitura** é o item 4 do inventário e virou A1 desta rodada. |
| N14 — chave de fenda no passo de `ler_caderno` | **RESOLVIDO** | `ler-caderno-ok-light-1440x900.png` e `ler-caderno-andamento-light-1440x900.png`: o ícone do passo é o livro de 13 px; `READ_TOOLS` mapeia `ler_caderno`/`ler_pdf` para `book` (`worklog-view.mjs:29-33`). |

## 6. Decisões do autor (D1–D3)

- **D1 (converter síncrono no Xournal++):** não afeta esta nota. O convert é UI
  do Xournal++ e está fora do recorte de cadernos. **decisão do autor.**
- **D2 (Cadernos a três cliques):** afeta a descoberta do #133 (F18), mas é
  **decisão do autor** e não entra como defeito. A nota de Clarity do #133 é
  8,5 pelo achado A3, não por D2; se o autor escolher B (atalho), a descoberta
  melhora, mas a nota de Clarity continua limitada por A3; se A, o custo da
  descoberta fica registrado. **decisão do autor.**
- **D3 (capas de caderno):** não afeta a nota; a biblioteca está na opção C
  (lista como está). Se o autor escolher B (ícone de caderno na cor da matéria +
  etiqueta A4), muda a apresentação da lista, não os achados desta rodada.
  **decisão do autor.**
