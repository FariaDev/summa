# Nota da rodada 1 — cadernos

**Recorte:** #133 (biblioteca de cadernos `.xopp` + plugin MesaPagina), #135
(`ler_caderno` no diário do chat) e #158 (busca no texto dos cadernos e leitura
da tinta). **Capturas:** `docs/design-loop/rodada-1/antes/cadernos/` (101 PNG +
101 `.json`; `_falhas.json` vazio, então os estados ausentes são os que o
inventário declara fora do recorte, não falha de captura). **Data:** 2026-11-07.
**Base do checkout:** `6ac6d868`.

**Método:** imagens + `.json` de medidas (contraste WCAG, fonte, alvos, foco e
rótulo acessível) + CSS/JS do `desk/src`. O movimento foi congelado na captura
(`freezeMotion`), então "Feedback e movimento" foi julgado pelas pistas visíveis
(spinner, toast, estados) e pelo CSS, não por quadros de animação. A régua é a
do pedido: 9 = polido; 8 = defeitos visíveis; 7 ou menos = problema que o
usuário sente.

**Resumo:** a base visual é consistente e a densidade é boa. O que puxa a nota
para baixo é o estado "instalando" do plugin (não existe visualmente), o erro
que só vive em toast, o detalhe técnico cru no diário e a acessibilidade do
interruptor da tinta (alvo de 18 px e trilho de 1,54:1).

## 1. Notas

| Categoria | #133 biblioteca + plugin | #135 `ler_caderno` | #158 busca + tinta | Geral |
|---|---|---|---|---|
| Typography | 7,5 (F16) | 7,0 (F8) | 7,5 (F16) | 7,0 (F8, F16) |
| Hierarchy | 7,0 (F4, F18) | 7,0 (F12, F25) | 6,5 (F5, F6, F18) | 7,0 (F4, F5, F6, F18) |
| Spacing & density | 8,0 (E1, F4) | 8,5 (E6, F8) | 8,0 (F5, F6) | 8,0 (E1, E6, F5) |
| Color & contrast | 8,0 (F14, F24) | 7,5 (F15, F24) | 7,0 (F14, F24) | 7,5 (F14, F15, F24) |
| Iconography | 8,0 (F21, F23) | 8,0 (F12) | 8,0 (F21) | 8,0 (F21, F23) |
| Consistency & polish | 5,5 (F1, F2, F3, F21) | 7,0 (F9, F10, F12) | 7,5 (F17, F21) | 6,5 (F1, F2, F9, F17) |
| Clarity | 6,5 (F2, F18, F22) | 6,5 (F8, F10, F12) | 6,5 (F6, F7, F19) | 6,5 (F7, F8, F10, F18) |
| Estados (vazio/carregando/erro) | 5,0\* (F1, F2, F3) | 7,5 (F12, F25) | 6,0\* (F19) | 6,0\* (F1, F3, F19) |
| Feedback e movimento | 5,5 (F1, F3, F17) | 7,0 (F12, E3) | 6,5 (F17, F19) | 6,0 (F1, F3, F17, F19) |
| Acessibilidade | 6,5 (F13, F14, F20) | 6,0 (F11, F12, F15) | 6,5 (F13, F14, F20) | 6,5 (F11, F13, F14, F20) |
| Janela pequena | 8,5 (E2) | 8,5 (E2) | 8,5 (E2) | 8,5 (E2) |
| **Overall** | **6,5** (F1, F2, F3, F18) | **7,0** (F8, F9, F11) | **7,0** (F5, F6, F13) | **6,5** (F1, F3, F8, F13) |

\* A nota de Estados cobre só os estados **capturados**. "Buscando…", cota
pausada da tinta e erro persistente da leitura da tinta ficam de fora (seção 3);
o mesmo vale para os estados do plugin sem captura. As notas de Spacing e de
Janela pequena se apoiam nas evidências positivas E1, E2 e E6.

## 2. Achados

### #133 — biblioteca e plugin

**F1 — grave — Estados / Feedback — o "instalando" do plugin não existe
visualmente.**
Captura: `plugin-instalando-light-1440x900.png` (comparar com
`plugin-nao-instalado-light-1440x900.png`). Medido: estado "não instalado"
(6,69:1), botão "Instalar plugin da página" 169×30, `desabilitado=false`, sem
`aria-busy`; as duas imagens são idênticas no botão (branco em ambas). No
`.json`, a aparência é a mesma: o fundo do botão medido em `plugin-instalando`
sai `#f1f1f1` porque o ponteiro ficou sobre ele (hover), e o `foco` medido é o
próprio botão com `focusVisible=false`. Dá para clicar de novo durante a
instalação, e o segundo clique cai no "Outra instalação em andamento". Conserto:
no pedido em voo, trocar o rótulo por "Instalando…", desabilitar o botão,
`aria-busy="true"` e um spinner; reabilitar no fim. Arquivo:
`desk/src/about-update.mjs:94` (handler) e `desk/src/dialogs.mjs:259` (botão).

**F2 — média — Estados / Consistency — "instalado" continua oferecendo
"Instalar plugin da página".**
Captura: `plugin-instalado-light-1440x900.png` (também `-dark-1440x900` e
`-en-1440x900`). Medido: estado "instalado" (6,69:1) e o mesmo botão
"Instalar plugin da página" 169×30 habilitado. A linha não vira "Reinstalar"
nem some; a única diferença em relação a "não instalado" é o texto de estado.
Conserto: "Reinstalar plugin" quando instalado, ou esconder a ação e deixar
"Instalado" com o check. Arquivo: `desk/src/dialogs.mjs:259` e as chaves
`component.plugin.*` em `desk/src/locales/pt-BR.json:405-410`.

**F3 — média — Estados / Feedback — erro do plugin só em toast, sem erro inline
nem tentar de novo.**
Captura: `plugin-erro-light-1440x900.png`. Medido: estado "não instalado" e
botão 169×30 continuam; o motivo aparece só no toast "Falha simulada ao instalar
o plugin." no canto inferior direito, por 3,2 s + 600 ms de saída
(`desk/src/state.mjs:135`). O olhar do usuário está no diálogo do Sobre; o toast
fica longe da linha e some sem deixar rastro. Conserto: erro inline na própria
linha do plugin, com o motivo e uma ação de tentar de novo; manter até
dispensar. Arquivo: `desk/src/about-update.mjs:99` (catch/toast).

**F4 — média — Hierarchy / Spacing — o ajuste da tinta fica acima da lista e do
estado vazio da biblioteca.**
Captura: `biblioteca-vazia-light-1440x900.png` e
`biblioteca-lista-light-1440x900.png`. Medido: no vazio, "Nenhum caderno .xopp
encontrado ainda." começa em y=235, **abaixo** do interruptor (y=168) e da
descrição da tinta (y=190-222); no topo do popover (367×383), a lista só começa
em y=237. A preferência (uma vez por modelo) vem antes do que o aluno abriu o
popover para ver. Conserto: mover o painel da tinta para o pé do popover (ou
para um "Ajustes" recolhido) e deixar lista/vazio logo abaixo do campo. Arquivo:
`desk/src/notebooks.mjs:195` (o `insertBefore` do painel).

**F5 — média — Hierarchy — os resultados da busca nascem depois do painel da
tinta.**
Captura: `busca-com-resultados-light-1440x900.png`. Medido: campo y=127-155,
status "3 resultados" em y=161, primeiro cartão em y=248 (título em y=255); o
bloco da tinta (interruptor y=187, descrição até y=241) fica entre o status e o
cartão. Em 900×650 é o mesmo, e o popover fica com 381 px de altura. Conserto:
com consulta ativa, esconder/recolher o painel da tinta ou colocá-lo depois dos
resultados. Arquivo: `desk/src/notebooks.mjs` (ordem `pop.append`) e
`notebooks-ink-panel.mjs`.

**F6 — média — Hierarchy / Clarity — o "sem resultado" tem duas mensagens
separadas pelo painel da tinta.**
Captura: `busca-sem-resultado-light-1440x900.png` (e `-dark-900x650`). Medido:
"Nenhum resultado." em y=161 (11 px, 6,69:1) e "Tente outro termo." em y=254
(12 px, 4,95:1): 93 px de distância, com o bloco da tinta no meio. O olho lê o
segundo como legenda da tinta, não da busca. Conserto: uma única mensagem de
vazio logo abaixo do campo/count ("Nenhum resultado. Tente outro termo.") e
remover o nó `.notebooks-search-empty` de dentro da lista. Arquivo:
`desk/src/notebooks.mjs:299-302` e as chaves `notebooks.searchEmpty*`.

**F7 — média — Clarity — o resultado promete "página 1" e o clique abre só o
caderno.**
Captura: `busca-com-resultados-light-1440x900.png`. Medido: cada cartão mostra
"Cálculo I · página 1"; o handler de clique chama
`deps.open({courseId, path})` sem a página (`notebooks.mjs:271`), então o aluno
cai no caderno, não no trecho. Conserto: levar `pagina` até a abertura ou
rotular o cartão como "abre o caderno" (sem a página) até a abertura aceitar a
página. Arquivo: `desk/src/notebooks.mjs:255-272`.

**F18 — média — Clarity / Hierarchy — Cadernos está a três passos.**
Captura: `teclado-cadernos-botao-light-1440x900.png`. Medido: o foco chega ao
botão Cadernos (135×28, x=1284, y=216) só depois de Mais opções → Contexto →
Tab; não há entrada na barra da sessão nem atalho. Um recurso central da #133
mora dentro de um submenu de contexto. Conserto: um botão de cadernos no
cabeçalho da sessão (ícone de livro) ou um atalho, mantendo o caminho atual.
Arquivo: `desk/src/notebooks.mjs:141-143` (posição do botão) e o menu em
`desk/src/tutor-header.mjs`.

**F22 — média — Clarity — o vazio da biblioteca não diz como um caderno chega
ali.**
Captura: `biblioteca-vazia-light-1440x900.png`. Medido: só "Nenhum caderno
.xopp encontrado ainda." (12 px, 4,95:1), sem dica nem ação; abaixo do painel da
tinta. Para quem abre a primeira vez, o vazio não ensina o próximo passo.
Conserto: uma linha de como o `.xopp` aparece (salvo na pasta da matéria) ou uma
ação "Abrir pasta da matéria". Arquivo: `desk/src/notebooks.mjs:331-333` e a
chave `notebooks.empty`.

**F23 — baixa — Consistency / Iconography — a linha do plugin não usa o ponto
de status das outras linhas do Sobre.**
Captura: `plugin-nao-instalado-light-1440x900.png` e
`plugin-instalado-light-1440x900.png`. Medido: Claude Code e Node têm o ponto
(`.component-dot`, verde/`em dia`); o estado do plugin é só texto 11 px
"não instalado"/"instalado". A mesma informação tem duas gramáticas visuais.
Conserto: um ponto de status coerente na sub-linha do plugin. Arquivo:
`desk/src/dialogs.mjs:253-263` e `.component-plugin-state` em
`desk/src/help-about.css:167`.

### #135 — `ler_caderno` no diário

**F8 — média — Typography / Clarity — o detalhe do passo mostra JSON cru e
caminho temporário em texto proporcional.**
Captura: `ler-caderno-ok-light-1440x900.png` (e `-900x650.json`). Medido: o
`step-text` começa com `Entrada: {"caminho":"/tmp/ciclo2-caderno-4dVnNZ/aula-nova.xopp","pagina":1}`,
em 12,5 px na fonte do corpo (sem monoespaçada), quebrando no meio do token
("caderno-" / "4dVnNZ"). O resultado ainda traz os delimitadores de máquina
`--- texto ---`. Conserto: resumo humano ("Ler o caderno: aula-nova.xopp,
página 1") e os argumentos crus atrás de um "detalhes técnicos" em
monoespaçada. Arquivo: `desk/src/worklog-view.mjs:52` e
`desk/src/tutor-chat.css:385`.

**F9 — média — Consistency / Localization — o diário em inglês mistura
"Entrada:" e o texto da ferramenta em português.**
Captura: `ler-caderno-ok-en-1440x900.png` (também `ler-caderno-erro-en-1440x900.png`
e `ler-caderno-andamento-en-1440x900.png`). Medido: o cabeçalho está em inglês
("Worked for 13s · 1 tool", "Used mesa_ler_caderno"), mas o detalhe traz
`Entrada: {...}` e "Página 1 de 2, conteúdo do documento" / "--- texto ---". O
prefixo é do `worklog-view.mjs` e o texto é montado em português em
`notebookPageText`. Conserto: passar o prefixo e o texto da ferramenta pelo
idioma (`t()`/`language`). Arquivo: `desk/src/worklog-view.mjs:52` e
`desk/src/extensions/mesa-mcp/notebook-tool.mjs:191-197`.

**F10 — média — Clarity / Consistency — o nome técnico da ferramenta aparece
cru na conversa.**
Captura: `ler-caderno-ok-light-1440x900.png` e
`ler-caderno-andamento-light-1440x900.png`. Medido: "Usou mesa_ler_caderno"
(12,5 px) e "Usando mesa_ler_caderno…" (12 px) em vez de "Ler o caderno"/"Lendo
o caderno". Conserto: um mapa de nome de exibição para as ferramentas da Mesa,
mantendo o id técnico só no detalhe. Arquivo: `desk/src/worklog.mjs:350-362`
(`liveLabel`/`stepLabel`).

**F11 — média — Acessibilidade — o nome acessível do passo carrega o detalhe
inteiro.**
Captura: `ler-caderno-ok-light-1440x900.json` (alvos[1]) e
`teclado-ler-caderno-passo-light-1440x900.json`. Medido: o `.step-toggle` tem
120 caracteres de nome, incluindo
`{"caminho":"/tmp/ciclo2-caderno-4dVnNZ/aula-nova.xopp","pagina":1}`; no estado
em andamento são 99 e no erro 109. O leitor de tela ouve o JSON e o caminho, não
um rótulo curto. Conserto: `aria-label` resumido ("Ler o caderno, página 1") e
o detalhe fora do nome acessível. Arquivo: `desk/src/worklog-view.mjs` (montagem
da linha; a árvore vem de `core/worklogview.bend`).

**F12 — baixa — Estados / Acessibilidade — o erro do passo não muda a cabeça do
diário.**
Captura: `ler-caderno-erro-light-1440x900.png` (e `-dark-1440x900`). Medido: a
cabeça segue "Trabalhou por 10s · 1 ferramenta" com um ícone de alerta **cinza**
(`--faint`), enquanto o passo usa alerta vermelho (`--danger-text`); o rótulo
"Usou mesa_ler_caderno" continua na cor normal. O leitor de tela ouve a mesma
cabeça de um turno bem-sucedido. Conserto: cabeça de falha ("Falhou ao ler o
caderno") e marca vermelha, além do ícone. Arquivo:
`desk/src/worklog.mjs:390` (`headLine`) e `desk/src/tutor-chat.css:346`.

**F25 — baixa — Clarity — o estado em andamento diz a mesma frase duas vezes.**
Captura: `ler-caderno-andamento-light-1440x900.png` e `-dark-900x650`. Medido:
a cabeça do diário em y=199 e o passo em y=231 repetem "Usando
mesa_ler_caderno…" (12 px e 12,5 px), com "1s" no meio. Conserto: a cabeça
resume ("Lendo o caderno") e o passo guarda o alvo ("aula-nova.xopp, página 1").
Arquivo: `desk/src/worklog.mjs` (rótulos) e `desk/src/worklog-view.mjs`.

### #158 — busca e leitura da tinta

**F13 — média — Acessibilidade — o alvo do interruptor da tinta tem 18 px de
altura.**
Captura: `tinta-desligada-padrao-light-1440x900.json`, `tinta-lendo`,
`tinta-ligada`, `tinta-sem-chave`, `tinta-claude`, `tinta-erro` e as
`biblioteca-*` (o interruptor aparece em todas). Medido: 335×18 px em 1440×900 e
308×18 px em 900×650; `abaixo24=true` nas 60 entradas de alvo medidas (é o
único controle abaixo de 24 do recorte). WCAG 2.5.8 pede 24×24. Conserto:
`min-height` de 24-28 px no botão (a pílula de 30×18 continua igual). Arquivo:
`desk/src/conversations-dividers.css:74`.

**F14 — média — Color & contrast — o trilho do interruptor desligado fica em
1,54:1.**
Captura: `tinta-desligada-padrao-light-1440x900.png` (o trilho em (1408,185) =
`#d0d0d0` sobre `#ffffff` = 1,54:1; o polegar branco em (1400,177); a borda do
polegar `#e0e0e0` sobre `#d0d0d0` = 1,17:1) e
`tinta-desligada-padrao-dark-1440x900.png` (`#434343` sobre `#1f1f1f` =
1,67:1). Abaixo dos 3:1 de 1.4.11 para o contorno
do componente; o polegar quase some no trilho. Conserto: trilho com
`--muted`/`--faint` (ou um contorno de 1 px com ≥3:1); o estado ligado (azul,
7,4:1) está bom. Arquivo: `desk/src/conversations-dividers.css:79-80`.

**F15 — baixa — Color & contrast — o `work-meta` no hover fica em 3,97:1 no
claro e 4,33:1 no escuro.**
Captura: `ler-caderno-andamento-light-1440x900.json` e `-dark-1440x900.json`.
Medido: "1s"/"3s" em 11 px, `#707070` sobre `#e6e6e6` (3,97:1) no claro e
`#979797` sobre `#333333` (4,33:1) no escuro. O `.json` mediu o hover porque o
ponteiro ficou sobre a cabeça depois do clique; a imagem mostra o fundo normal
(branco no claro, `#1f1f1f` no escuro) — no claro, o token `#707070` sobre
`#fff` dá 4,95:1. Ainda assim, no hover o texto reprova AA. Conserto: usar
`--muted` no `.work-meta` ou não escurecer o fundo sob ele. Arquivo:
`desk/src/tutor-chat.css:367` (e `#sidebar --hover` em `tutor-chat.css:9`).

**F17 — baixa — Feedback — o interruptor da tinta não tem hover, ao contrário
das linhas.**
Captura: `tinta-desligada-padrao-light-1440x900.png` (estado normal) e o CSS;
não há captura de hover. Medido: `.notebooks-ink-switch:hover{background:transparent}`
(`conversations-dividers.css:75`), enquanto `.notebooks-row:hover` e
`.notebooks-search-row:hover` usam `--hover`. O controle clicável de 335×18 não
dá retorno ao passar o mouse. Conserto: o mesmo realce das linhas (com raio) no
hover do interruptor. Arquivo: `desk/src/conversations-dividers.css:75`.

**F19 — média — Estados / Feedback — o erro da tinta só existe em toast.**
Captura: `tinta-erro-light-1440x900.png`. Medido: o toast "Não foi possível
ligar a leitura da tinta." aparece no canto inferior direito e o interruptor
volta a `aria-checked=false`; o painel não mostra linha de erro nem ação de
tentar de novo, e o toast some em 3,2 s. Quem não estava olhando o canto vê só
o interruptor que não ligou. Conserto: erro inline sob o interruptor (com
"Tentar de novo") ou no `notebooks-ink-status`, persistente até dispensar.
Arquivo: `desk/src/notebooks-ink-panel.mjs:118-141` e
`desk/src/state.mjs:121-139`.

**F20 — baixa — Acessibilidade — o nome medido da linha de caderno sai sem
separador entre título e meta.**
Captura: `teclado-cadernos-linha-light-1440x900.json` (foco:
"aula-nova.xoppsub · 21:15") e `teclado-tinta-linha-light-1440x900.json`
("aula-teste.xopp31/12, 21:00"). A linha é um `<button>` com dois `<span>` sem
texto separador; o `.json` de foco mede a concatenação. Nas linhas com `title`,
o título pode mascarar; na linha focada o `title` está vazio. Conserto:
`aria-label` explícito com vírgulas (nome, pasta, hora). Arquivo:
`desk/src/notebooks.mjs:230-236`.

**F21 — baixa — Iconography — o fechar do popover é um glifo de texto.**
Captura: `biblioteca-lista-light-1440x900.json` (texto "×" 13 px em `.icon-btn`,
28×28) e as demais do popover. O app tem `icons.close` (Lucide, 24 px,
`aria-hidden`); o glifo muda de desenho conforme a fonte e não compartilha o
traço dos outros ícones. Conserto: usar `icon('close')` no `closeButton`.
Arquivo: `desk/src/notebooks.mjs:151`.

**F24 — baixa — Color & contrast — a meta em 11 px passa raspando no escuro.**
Captura: `biblioteca-lista-dark-1440x900.json` e
`busca-com-resultados-dark-1440x900.json`. Medido: `notebooks-meta` em
`#979797` sobre `#303030` = 4,52:1 (claro: `#707070` sobre `#fff` = 4,95:1), 11
px. Passa AA, mas a margem é de 0,02 e o texto é o secundário mais frequente da
lista. Conserto: usar `--muted` para a meta (5,55:1 no escuro) ou subir
`--faint` um degrau. Arquivo: `desk/src/conversations-dividers.css:53` e os
tokens em `desk/style.css:20-21`.

**F16 — baixa — Typography — a escala do popover é comprimida e a maior parte
do conteúdo fica em 11 px.**
Captura: `biblioteca-lista-light-1440x900.json` (título 12 px/600, meta 11
px/400, grupo 11 px/600) e `busca-com-resultados-light-1440x900.json` (trecho 11
px/400, status 11 px/400); o corpo de leitura do app é 15 px. O trecho do
resultado — o conteúdo que o aluno veio ler — é 11 px. Conserto: título 13 px e
trecho 12 px, deixando 11 px só para meta/grupo. Arquivo:
`desk/src/conversations-dividers.css:44,52,53,66,68` e os tokens
`--fs-*` em `desk/style.css:123`.

### Evidências de suporte (sem defeito)

**E1 — Spacing & density.** `biblioteca-lista-light-1440x900.json`: popover
367×383; linhas 349×48 (y=266/317/406), grupo 21 px, busca 28 px, intervalo 6
px; em 900×650 o popover é 340×383 e as três linhas continuam inteiras. O
ritmo é o mesmo nos dois tamanhos; não há corte nem sobreposição.

**E2 — Janela pequena.** As cinco variantes em 900×650 cabem: lista 340×383,
busca 381, tinta 259, `ler_caderno` 351×215 e o diálogo do Sobre 540×456
(medido na imagem); o `max-height` do popover é 64vh (399 px em 623 px de
altura) e a lista rola por dentro. As três linhas da busca e os seis estados da
tinta aparecem sem barra horizontal. Nenhum achado.

**E3 — Foco visível.** Os 10 `.json` de teclado têm `focusVisible=true` e
`outline: 2px solid #2548c7`; o offset varia de -2 px a 2 px e o anel aparece
no campo (`teclado-cadernos-busca`), no interruptor
(`teclado-tinta-interruptor`, offset 2 px) e no passo
(`teclado-ler-caderno-passo`). No tema escuro o token é `--ring: #8fa8ff`
(`desk/style.css:81`), mas o foco no escuro não foi capturado.

**E4 — Alvos.** Fora do interruptor da tinta (F13), todos os controles medidos
passam de 24 px: fechar 28×28, busca 349×28, linhas 349×48, instalar 169×30,
cabeça do diário 366×24 e passo 357×187. O `.work-head` fica exatamente no
mínimo de 24 px.

**E5 — Contraste de texto.** Nos 101 `.json`, o único texto abaixo de 4,5:1 é
o `work-meta` no hover (F15); o menor dos demais é 4,52 (meta no escuro) e o
`<mark>` da busca mede 5,55 no claro e 6,04 no escuro. O contraste de texto
não é o problema do recorte; o componente do interruptor é (F14).

**E6 — Spacing do diário.** `ler-caderno-ok-light-1440x900.json`: bloco do
diário 366×215, passo 357×187, texto 12,5 px/18,75; no erro 366×140/357×112 e
em andamento 366×61/357×29; em 900×650 o mesmo conteúdo rola dentro de
`#messages`, sem corte no bloco.

## 3. SEM CAPTURA

Estado do inventário sem captura — não entra na nota da categoria naquele
estado (o asterisco da tabela). O `_falhas.json` está vazio; estes são os
estados que o próprio inventário declara fora do recorte.

| Estado | Por que não há captura | O que fica fora |
|---|---|---|
| Abrir o caderno no Xournal++ | A ação fecha o popover e abre outro programa; a janela do Xournal++ não é UI da Mesa (o teste usa `fake-xournalpp.mjs`). | O retorno visual da abertura e o estado do popover depois do clique. A prova da abertura é o IPC (`tests/notebooks-ui.mjs`). |
| Plugin "instalado, versão diferente" (`different`) | Estado existe no `pluginStatus`, mas ficou para a rodada seguinte. | O texto/estado e a ação nesse caso. |
| Plugin "modificado" (`modified`) | Idem. | O estado de recusa e a ação. |
| Plugin "foreign" | Idem. | O estado de recusa (pasta de outro autor). |
| Plugin "symlink" | Idem. | O estado de recusa (link simbólico). |
| Plugin dentro do Xournal++ (Ctrl+Alt+R/B, converter, trocar fonte) | É UI do Xournal++ com o plugin carregado, fora da janela da Mesa. | Toda a interação do plugin no programa de escrita. |
| "Buscando…" (busca em voo) | Estado transitório de 150 ms, fora dos três estados pedidos. | A nota de Estados da #158 cobre só vazio/sem resultado/com resultados; o loading existe no código (`notebooks-search-status` + `.notebooks-searching`), mas não foi visto. |
| Leitura da tinta com cota pausada (`quota`) | Estado existe, mas não foi pedido. | A mensagem "Pausado: sem cota" e o interruptor nesse estado. |
| Erro persistente da leitura da tinta | **Não existe na interface**: só o toast do `notebooks-ink-set` (capturado em `tinta-erro`). O `stateText` mapeia qualquer status desconhecido para "Em dia" (`desk/src/notebooks-ink-panel.mjs:15-19`). | Não há estado visual para capturar; o erro do vigia apareceria como "Em dia". Não pontuado, mas é o risco mais alto dos estados não cobertos. |

**Cobertura parcial (não é "sem captura", mas limita o que se pode afirmar):**
`plugin-instalado-aviso` só existe em `light-1440x900` (o toast de reiniciar no
escuro/900 não foi visto); as 10 capturas de teclado são só `light-1440x900`
(o foco no escuro e em 900 não foi capturado); as variantes `en` cobrem os
estados-base, não o teclado. Não há captura de hover em nenhum estado — o hover
da tinta (F17) e o `work-meta` (F15) foram julgados por CSS/JSON.

## 4. O que eu vi

**Vi as imagens, sim.** Abri 36 PNGs de estado (de 101 variantes), entre eles:
`biblioteca-lista-light-1440x900`, `biblioteca-lista-dark-1440x900`,
`biblioteca-lista-light-900x650`, `biblioteca-vazia-light-1440x900`,
`busca-vazia-light-1440x900`, `busca-sem-resultado-light-1440x900`,
`busca-sem-resultado-dark-900x650`, `busca-com-resultados-light-1440x900`,
`busca-com-resultados-dark-900x650`, `busca-com-resultados-en-1440x900`,
`plugin-nao-instalado-light-1440x900`, `plugin-instalando-light-1440x900`,
`plugin-instalado-light-1440x900`, `plugin-instalado-dark-1440x900`,
`plugin-instalado-aviso-light-1440x900`, `plugin-erro-light-1440x900`,
`plugin-nao-instalado-dark-900x650`, `ler-caderno-andamento-light-1440x900`,
`ler-caderno-andamento-dark-900x650`, `ler-caderno-ok-light-1440x900`,
`ler-caderno-ok-light-900x650`, `ler-caderno-erro-light-1440x900`,
`ler-caderno-erro-dark-1440x900`, `ler-caderno-erro-en-1440x900`,
`tinta-desligada-padrao-light-1440x900`, `tinta-sem-chave-light-1440x900`,
`tinta-claude-light-1440x900`, `tinta-lendo-light-1440x900`,
`tinta-ligada-light-1440x900`, `tinta-erro-light-1440x900`,
`teclado-cadernos-botao-light-1440x900`, `teclado-cadernos-linha-light-1440x900`,
`teclado-tinta-interruptor-light-1440x900`,
`teclado-plugin-instalar-light-1440x900`,
`teclado-ler-caderno-cabeca-light-1440x900` e
`teclado-ler-caderno-passo-light-1440x900`.

Para as outras ~65 variantes usei o `.json` de medidas e o CSS/JS; não afirmo
sobre o que só a imagem mostraria (sombra, hover, foco no escuro, o toast em
900/escuro). As capturas têm `freezeMotion`, então não há como julgar a
animação em si — só a presença dos estados e dos realces.
