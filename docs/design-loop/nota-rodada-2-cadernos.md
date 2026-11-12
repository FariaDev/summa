# Nota da rodada 2 — cadernos

**Recorte:** #133 (biblioteca de cadernos `.xopp` + plugin MesaPagina), #135
(`ler_caderno` no diário do chat) e #158 (busca no texto dos cadernos e leitura
da tinta). **Capturas:** `docs/design-loop/rodada-2/antes/cadernos/` (165 PNG +
165 `.json` + `_falhas.json` vazio = 331 arquivos; todos os blocos imprimiram
`ok`). **Data da captura:** 2026-11-07. **Base do checkout:** `9139a20e` (o
"antes" da rodada 2 já contém os consertos da rodada 1). **Nota escrita em:**
2026-11-08.

**Método:** imagens + `.json` de medidas (contraste WCAG, fonte, alvos, foco e
rótulo acessível) + CSS/JS do `desk/src`. O movimento foi congelado na captura
(`freezeMotion`): "Feedback e movimento" foi julgado pelas pistas visíveis
(spinner, toast, estados) e pelo CSS, não por quadros de animação. A régua é a
do pedido: 9 = polido; 8 = defeito visível; 7 ou menos = problema que o usuário
sente. A referência da casa (tema inspirado no Claude Desktop, cinzas neutros,
composer colado na coluna, sem canvas de tinta e leitura da tinta desligada por
padrão) não conta como achado.

**Resumo:** os consertos da rodada 1 entraram e a maior parte dos achados
fechou. O que segura a nota agora é (a) o **erro fantasma** da leitura da tinta,
que sobrevive ao estado, ao fechar e à troca de idioma, (b) a **ordem de foco**
do painel da tinta, que desce até o pé e volta para o topo da lista, (c) as
quatro linhas de **estado do plugin** (`different`, `modified`, `foreign`,
`symlink`) que mantêm "Instalar plugin da página" habilitado e (d) dois
contrastes de **texto secundário no hover** (4,16:1 e 3,97:1/4,33:1).
O caminho feliz da biblioteca, da busca e do diário está consistente.

## 1. Notas

| Categoria | #133 biblioteca + plugin | #135 `ler_caderno` na conversa | #158 busca + leitura da tinta | Geral |
|---|---|---|---|---|
| Typography | 9,0 | 9,0 | 9,0 | 9,0 |
| Hierarchy | 8,0 (N4–N6) | 8,5 (N9) | 9,0 | 8,5 |
| Spacing & density | 9,0 | 9,0 | 9,0 | 9,0 |
| Color & contrast | 9,0 | 8,0 (N7) | 8,0 (N8) | 8,0 |
| Iconography | 9,0 | 8,5 (N14) | 9,0 | 8,5 |
| Consistency & polish | 7,0 (N4–N6, N11, N12) | 8,0 (N9) | 7,5 (N1) | 7,5 |
| Clarity | 7,5 (N4–N6) | 8,0 (N9) | 8,0 (N13) | 7,5 |
| Estados (vazio/carregando/erro) | 8,0 (N11, N12)\* | 9,0 | 7,0 (N1, N13) | 7,5 |
| Feedback e movimento | 8,5 (N11, N12) | 8,5 | 7,5 (N10) | 8,0 |
| Acessibilidade | 8,5† | 8,5 | 7,5 (N2, N3) | 8,0 |
| Janela pequena | 8,5 (N11, N12) | 9,0 | 9,0 | 8,5 |
| **Overall** | **7,5** | **8,0** | **7,5** | **7,5** |

\* A nota de Estados do #133 cobre todos os estados capturados; a ação "abrir
no Xournal++" não tem tela na Mesa (seção 3), então o retorno visual dela fica
fora. A nota de Clarity do #133 **não desconta** D2 (decisão do autor): os três
cliques do F18 estão registrados, mas a descoberta pelo menu é a escolha atual
da casa (#123). O `_falhas.json` está vazio, mas isso não cobre as duas rotas de
teclado do plugin que o inventário lista e a pasta não tem (seção 3): a nota de
Acessibilidade do #133 não inclui o foco do botão de instalar nem do × do Sobre.

† A nota de Acessibilidade do #133 cobre os oito percursos de teclado
capturados e os alvos da linha do plugin (169×30, 28×28), **não** o foco do
plugin pelo teclado: `teclado-plugin-instalar`/`teclado-plugin-fechar` estão
SEM CAPTURA.

Por que os 9: **Typography** tem a escala 13/600 (título), 12/400 (trecho e
corpo), 11/400 (meta, grupo e status), 12,5/18,75 (diário) e mono 12,5
(detalhe técnico), sem corte nem sobreposição; o F16 da rodada 1 foi aplicado
exatamente (título 13, trecho 12, meta 11). **Spacing** tem linhas de 49 px,
grupo de 21 px e intervalo de 6 px, popover de 397 px e lista de resultados de
3×68 px sem corte em 1440×900 nem em 900×650. **Iconography** no #133 e no #158
usa Lucide coerente (fechar, chevron, ponto de status, spinner de 3 pontos) e o
`<mark>` da busca; o único detalhe é N14, no #135. **Color & contrast** do #133
não tem achado: o menor texto é 5,33:1 (aviso do plugin), o erro inline 5,74:1,
a ação azul 7,42:1 e o trilho 4,95:1/5,64:1; os casos de hover que reprovam
estão no #135 e no #158. **Hierarchy** do #158 põe
campo → status/contagem → resultados → painel da tinta no pé, com mensagem
única de vazio. **Estados** do #135 cobre andamento, ok e erro com cabeça de
falha vermelha, detalhe e rótulo humano; **Janela pequena** cabe em 900×650
(popover 340×397, Sobre 540×456, diário 351×165; a lista rola por dentro).

## 2. Achados

### #133 — biblioteca e plugin

**N4 — média — Clarity / Consistency — `different` diz "versão diferente" mas a ação se chama "Instalar plugin da página".**
Captura: `plugin-different-light-1440x900.png` (e `-dark-1440x900`,
`-en-1440x900`, `-dark-900x650`). Medido: estado "instalado, versão diferente"
(11 px, 6,69:1) e botão "Instalar plugin da página" 169×30 habilitado; o mesmo
rótulo de uma instalação nova. O aluno não sabe que o clique atualiza nem qual
versão está na pasta. Conserto: rotular "Atualizar plugin" quando o estado é
`different` e mostrar a versão instalada ao lado. Arquivo:
`desk/src/dialogs.mjs:270` e `desk/src/locales/pt-BR.json:402,405`.

**N5 — média — Clarity / Consistency — `modified` é só a palavra "modificado", e a instalação continua habilitada.**
Captura: `plugin-modified-light-1440x900.png` (e `-dark`, `-en`, `-900x650`).
Medido: estado "modificado" (11 px, 6,69:1), sem explicação do que mudou nem do
que fazer; botão "Instalar plugin da página" 169×30 habilitado. O catálogo já
tem a frase pronta `component.plugin.modifiedError` ("A pasta MesaPagina foi
modificada — não vou sobrescrevê-la.") que não é usada. Conserto: pintar a frase
e desabilitar/rotular a ação como "Ver motivo". Arquivo:
`desk/src/dialogs.mjs:245,270` e `desk/src/locales/pt-BR.json:415-416`.

**N6 — média — Consistency / Clarity — `foreign` e `symlink` recusam em texto e oferecem o botão de instalar habilitado.**
Capturas: `plugin-foreign-light-1440x900.png` e
`plugin-symlink-light-1440x900.png` (e `-dark`, `-en`, `-900x650`). Medido:
"Já existe uma pasta MesaPagina de outro autor — não vou tocar nela." e "O alvo
é um link simbólico — recuso seguir links." (11 px, 6,69:1), com "Instalar
plugin da página" 169×30 habilitado. O clique é uma tentativa fadada; a recusa só
aparece depois, no erro inline. Conserto: esconder/desabilitar a ação ou
rotulá-la "Ver motivo" nos dois estados. Arquivo:
`desk/src/dialogs.mjs:266-271`.

**N11 — baixa — Feedback / Consistency — o "reinicie o Xournal++" só existe no toast passageiro, e o toast cobre o Sobre em 900×650.**
Capturas: `plugin-instalado-aviso-light-1440x900.png`,
`plugin-instalado-aviso-dark-900x650.png` e `plugin-instalado-light-1440x900.png`.
Medido: o estado persistente diz só "instalado" + "Reinstalar plugin"; a única
instrução ("Plugin MesaPagina instalado — reinicie o Xournal++ para ele
carregar.") vive no toast, que sai em ~3,8 s. Em 900×650 o toast flutua sobre o
diálogo do Sobre (na variante escura, cobre a linha de descrição do Xournal++ e
encosta no "Abrir o site"). Conserto: deixar "Reinicie o Xournal++ para carregar" como linha
persistente no estado instalado, não só no toast. Arquivo:
`desk/src/about-update.mjs:98-99` e `desk/src/locales/pt-BR.json:403`.

**N12 — baixa — Consistency & polish — o erro do plugin tem duas ações iguais e um toast redundante.**
Capturas: `plugin-erro-light-1440x900.png` e `plugin-erro-light-900x650.png`.
Medido: a linha mantém "Instalar plugin da página" 169×30 habilitado enquanto o
erro inline oferece "Tentar de novo" 374×30 — o mesmo comando — e o toast
repete "Falha simulada ao instalar o plugin.". Em 900×650 o toast flutua sobre o
diálogo, na altura da linha do Xournal++. Conserto: manter uma ação primária
enquanto o erro inline está visível (esconder/desabilitar a da linha ou usar a
mesma) e dispensar o toast, já que o erro inline é persistente. Arquivo:
`desk/src/about-update.mjs:101-104` e `desk/src/dialogs.mjs:284-298`.

### #135 — `ler_caderno` no diário

**N9 — baixa — Clarity / Consistency — o passo "ok" repete a mesma frase no toggle e no corpo, e o andamento repete a cabeça.**
Captura: `ler-caderno-ok-light-1440x900.json` (e `-dark-1440x900`,
`-dark-900x650`, `ler-caderno-andamento-light-1440x900`). Medido: o
`.step-label` e o `.step-text` são exatamente a mesma string "Ler o caderno:
aula-nova.xopp, página 1" (12,5 px; 253 px de largura no rótulo, 300 px no
corpo); logo abaixo vêm "Detalhes técnicos" e o JSON. No andamento, a cabeça
"Lendo o caderno" e o passo "Lendo o caderno: aula-nova.xopp, página 1" ainda
começam com as mesmas palavras. Conserto: omitir o corpo quando ele é igual ao
rótulo, ou deixar o passo só com o alvo ("aula-nova.xopp, página 1") e a cabeça
com o verbo. Arquivo: `desk/src/worklog-view.mjs:126` e
`desk/src/locales/pt-BR.json:2717,2732`.

**N7 — baixa — Color & contrast — "Detalhes técnicos" reprova AA no hover do passo.**
Capturas: `ler-caderno-ok-light-900x650.json`, `ler-caderno-ok-dark-900x650.json`,
`ler-caderno-erro-light-900x650.json` e `ler-caderno-erro-dark-900x650.json`.
Medido: `.step-tech-label` "Detalhes técnicos" em 11 px, `#707070` sobre
`#e6e6e6` = **3,97:1** no claro e `#979797` sobre `#333333` = **4,33:1** no
escuro (o hover do `.step-toggle` escurece o fundo). Fora do hover é 4,95:1 no
claro e 5,64:1 no escuro. Conserto: usar `--muted` no rótulo ou não escurecer o
fundo sob ele. Arquivo: `desk/src/tutor-chat.css:382,396`.

**N14 — baixa — Iconography — o passo de `ler_caderno` usa a chave de fenda genérica.**
Capturas: `ler-caderno-ok-light-1440x900.png` e
`ler-caderno-andamento-light-1440x900.png`. Medido: o ícone do passo é a chave
de fenda de 13 px (`STEP_ICON[STEP.TOOL] = 'wrench'`), enquanto a leitura de
caderno é representada por livro em outros pontos. Conserto: mapear a ferramenta
`ler_caderno` para `book` (como MATERIAL/REFERENCE) e deixar a chave para as
outras ferramentas. Arquivo: `desk/src/worklog-view.mjs:22-24,208`.

### #158 — busca e leitura da tinta

**N1 — média — Estados / Consistency & polish — o erro inline da tinta é fantasma: sobrevive ao estado, ao fechar/reabrir e à troca de idioma.**
Capturas: `hover-tinta-interruptor-light-1440x900.png` e
`-dark-1440x900`, `hover-linha-caderno-light/dark-1440x900`,
`teclado-tinta-interruptor-light-1440x900.png` e `-dark-900x650`. Medido: o
interruptor está `aria-checked="false"`, a linha de status está escondida
(idle), mas o erro vermelho "Could not turn off handwriting reading." continua
(11 px; `#c81e1e` sobre `#fff` = 5,74:1 no claro; `#f87171` sobre `#1f1f1f` =
5,96:1 no escuro) com "Tentar de novo" 94×24. O popover mede 282 px de altura
contra 254 px em `tinta-desligada-padrao-light` — os 28 px do erro continuam
lá. Na captura de teclado a UI está em português e o erro em inglês (o
`LANGUAGE_EVENT` repinta o resto, não o erro). Causa: `refresh()` chama
`repaint()`, que não esconde nem reescreve o `errorLine`; `paintError()` só é
chamado pelo `toggle()`. Conserto: limpar/esconder o erro em `refresh()` (e no
`setActive(false)`) quando o snapshot não carrega a falha, e repintar o texto
por `t()` no evento de idioma. Arquivo: `desk/src/notebooks-ink-panel.mjs:91,96,120,165`.

**N2 — média — Acessibilidade / Consistency — a ordem do Tab desce para o interruptor no pé e volta para a lista no topo.**
Capturas: `teclado-tinta-interruptor-light-1440x900.json` (foco no interruptor
335×28 em y=254; a linha está em y=192) e `teclado-tinta-linha-light-1440x900.json`
(foco de volta na linha em y=192). O caminho é campo (y=127) → interruptor
(y=254) → primeira linha (y=192). O painel é inserido **antes** da lista no DOM
(`pop.insertBefore(inkPanel.element,list)`) e puxado para o pé só por
`order:1`; o leitor de tela lê a opção antes dos cadernos, ao contrário do que
se vê. Conserto: anexar o painel depois da lista no DOM (ou colocá-lo
visualmente acima) para a ordem de foco e a de leitura baterem com a tela.
Arquivo: `desk/src/notebooks.mjs:195` e
`desk/src/conversations-dividers.css:73`.

**N3 — média — Acessibilidade — o trecho que casou na busca fica fora do nome acessível do resultado.**
Captura: `busca-com-resultados-light-1440x900.json` (e `-dark-900x650`,
`-en-1440x900`). Medido: o alvo `notebooks-search-row` tem rótulo "aula-nova.xopp,
Cálculo I, página 1"; o trecho visível "Equação do primeiro grau" (12 px, com
`<mark>`) não entra no nome. O leitor de tela ouve caderno/matéria/página, mas
não o motivo do resultado. Conserto: apontar `aria-describedby` para o
`.notebooks-excerpt` (ou incluir o trecho no `aria-label`). Arquivo:
`desk/src/notebooks.mjs:260`.

**N8 — baixa — Color & contrast — a meta do resultado da busca reprova AA no hover escuro.**
Capturas: `busca-com-resultados-dark-1440x900.json` e `-dark-900x650`. Medido:
"Cálculo I · página 1" em 11 px, `#a8a8a8` sobre `#434343` = **4,16:1** no hover
do primeiro resultado (normal: 5,55:1; no claro com hover: 5,36:1). As linhas da
biblioteca já corrigem isso (`:hover .notebooks-meta{color:var(--fg)}`); os
resultados da busca só repintam o trecho. Conserto: incluir
`.notebooks-search-row:hover .notebooks-meta{color:var(--fg)}` na mesma regra.
Arquivo: `desk/src/conversations-dividers.css:51,63-65`.

**N10 — baixa — Feedback & movimento — "Buscando…" não tem indicador além do texto.**
Captura: `busca-buscando-light-1440x900.png`. Medido: status "Buscando…" em
11 px, 6,69:1, lista anterior com `opacity:.5`, sem spinner/skeleton na área dos
resultados; a instalação do plugin já ganhou um spinner de 3 pontos. Conserto:
um spinner pequeno ao lado do status (ou skeleton no topo da lista) para a
mesma gramática de carregamento. Arquivo: `desk/src/notebooks.mjs:287-299` e
`.notebooks-searching` em `desk/src/conversations-dividers.css:43`.

**N13 — baixa — Clarity / Estados — o erro persistente do vigia é cinza e o "Tentar de novo" pertence à tentativa de desligar, não à leitura.**
Captura: `tinta-status-erro-light-1440x900.png` (e `-dark`, `-650`). Medido:
"Erro ao ler a tinta" em 11 px, `#5c5c5c`, 6,69:1 — o mesmo estilo de "Em dia";
a linha vermelha abaixo é "Não foi possível desligar a leitura da tinta."
(5,74:1) e o "Tentar de novo" 94×24 repete o desligamento. O aluno vê dois erros
e uma ação que não retenta a leitura que falhou. Conserto: pintar o status de
erro com `--danger-text` e ligar o "Tentar de novo" à leitura (ou rotular
"Tentar desligar de novo"). Arquivo: `desk/src/notebooks-ink-panel.mjs:96-118`
e `desk/src/conversations-dividers.css:84-90`.

### Evidências de suporte (sem defeito)

**E1 — Alvos.** 567 entradas de alvo medidas nos 165 `.json`: **nenhuma** com
`abaixo24`. O interruptor da tinta agora é 335×28 (era 335×18), o
"Tentar de novo" é 94×24, as linhas 349×49/68, o fechar 28×28, a busca 349×28 e
as ações do plugin 121–169×30. O F13 fechou.

**E2 — Foco.** As 32 capturas de teclado (8 bases × 4 variantes) têm
`focusVisible=true` e anel de 2 px: `#2548c7` no claro e `#8fa8ff` no escuro,
nos dois tamanhos. O anel aparece no campo, no fechar, na linha, no interruptor,
no botão Cadernos e na cabeça/passo do diário. A lacuna de foco no escuro da
rodada 1 está coberta. As duas rotas do plugin que o inventário lista
(`teclado-plugin-instalar` e `-fechar`) não existem na pasta/script (seção 3).

**E3 — Contraste de texto.** Fora os dois casos de hover (N7/N8), o menor texto
é 4,95:1 (`notebooks-empty`/`search-empty` no claro; 5,31–5,64 no escuro); o
`<mark>` mede 4,83:1 no claro e 4,99:1 no escuro, o erro inline da tinta
5,74:1, o aviso do plugin 5,33:1 e a ação azul 7,42:1. A cabeça de falha do
diário fica em 4,60:1 no claro e 4,57:1 no escuro **no hover** (passa por
pouco; sem hover é 5,74:1). O F14 do trilho também fechou: os
pixels medidos dão `#707070` sobre `#fff` = **4,95:1** no claro e `#979797`
sobre `#1f1f1f` = **5,64:1** no escuro; o polegar `#fff`/`#303030` sobre o
trilho mede 4,95:1/4,52:1, e o trilho ligado `#2548c7`/`#506cdf` com polegar
branco fica em 7,42:1/~4,6:1. Acima dos 3:1 de componente.

**E4 — Nomes acessíveis.** Linhas da biblioteca com vírgulas ("aula-nova.xopp,
sub · 00:15"), fechar com "Fechar", interruptor com `role=switch` +
`aria-checked` + `aria-describedby`, passo com nome curto de 39 caracteres
("Ler o caderno: aula-nova.xopp, página 1"). O F11/F20 fecharam.

**E5 — Espaçamento.** Popover 367×397 em 1440 e 340×397 em 900; linhas de 49,
grupo de 21, gap de 6; resultados de 68; vazio 208; tinta 254; status-erro 299
(316 em 900). Sem corte nem sobreposição.

**E6 — Janela pequena.** As variantes claro/escuro em 1440×900 e 900×650, mais
o `en` em 1440×900, e as 32 de teclado cabem; o popover usa
`max-height:min(64vh,440px)` e rola por dentro; o diário rola no `#messages`; o
Sobre fica 540×456. Só o toast do plugin invade o diálogo em 900×650
(N11/N12), que é detalhe de sobreposição.

**E7 — Caminho de erro do diário.** `ler-caderno-erro-light/dark` mostram a
cabeça vermelha "Não consegui ler o caderno", o passo com ícone vermelho, o
motivo ("Página 2 não existe (o caderno tem 1).") e o detalhe técnico. O F12
fechou.

**E8 — Estados de vazio e de sucesso.** `biblioteca-vazia` ensina o próximo
passo ("Salve um na pasta da matéria e ele aparece aqui.") sem segundo bloco
longe do campo; `busca-sem-resultado` tem uma mensagem só; o ok do diário tem
rótulo humano e o técnico atrás de "Detalhes técnicos". F6/F8/F22 fecharam.

## 3. SEM CAPTURA

Estados do inventário sem captura — não entram na nota da categoria naquele
estado. O `_falhas.json` está vazio; os dois primeiros são declarados fora do
recorte (não são UI da Mesa) e os dois últimos são **lacuna de captura dentro
da Mesa**: a tabela do inventário lista 10 bases de teclado, mas a pasta e o
script têm 8 (a contagem 8×4=32 do próprio inventário confirma).

| Estado | Por que não há captura | O que fica fora |
|---|---|---|
| Abrir o caderno no Xournal++ | A ação fecha o popover e abre outro programa; a janela do Xournal++ não é UI da Mesa (o teste usa `fake-xournalpp.mjs`). | O retorno visual da abertura e o estado do popover depois do clique. A prova da abertura e da página é o IPC (`tests/notebooks-ui.mjs`; `notebooks.mjs:270` passa `page`). |
| Comportamento do plugin dentro do Xournal++ (Ctrl+Alt+R/B, converter, trocar fonte) | É UI do Xournal++ com o plugin carregado, fora da janela da Mesa. | Toda a interação do plugin no programa de escrita. |
| `teclado-plugin-instalar` e `teclado-plugin-fechar` (foco no botão de instalar e no × do Sobre) | A tabela do inventário lista 10 bases, mas a pasta e o script têm 8 (`8 bases × 4 variantes = 32`): não há PNG nem `.json` dessas duas rotas. | O anel de foco do `.component-plugin-install` e do `.dialog-close` do Sobre não foi medido; a nota de Acessibilidade do #133 não cobre esse estado. |

**Cobertura parcial (não é "sem captura", mas limita o que se pode afirmar):**

- o teclado só tem PT (claro/escuro × 1440×900 e 900×650) e o hover, PT
  (claro/escuro) só em 1440×900; as variantes `en` cobrem os estados-base, não
  o teclado/hover;
- as capturas de `plugin-different/modified/foreign/symlink` vêm do IPC falso
  `components`, que devolve só a linha do Xournal++: não se pode julgar o
  diálogo do Sobre inteiro nessas quatro variantes, só a linha medida;
- as capturas de teclado do diário (`teclado-ler-caderno-*`) saíram com o
  **diário em inglês** porque o rótulo foi pintado no último estado `en` da
  série e a rota de teclado não força o repaint. É artefato de captura, não
  mistura de idioma da UI: o estado PT normal está em
  `ler-caderno-ok-light-1440x900` e `ler-caderno-andamento-light-1440x900`;
- em `ler-caderno-erro-en`, o detalhe do `toolResult` sintético está em
  português ("Página 2 não existe..."); o dado é do histórico sintético, não
  uma string fixa do `worklog-view` (a ferramenta real usa
  `err.notebook.pageMissing` no idioma).

Os estados que a rodada 1 listou como sem captura — `different`, `modified`,
`foreign`, `symlink`, "Buscando…", cota pausada, status `error` persistente da
tinta e o aviso de reiniciar — agora estão capturados e medidos.

## 4. O que eu vi

**Vi as imagens, sim.** Abri 46 PNGs (de 165 variantes); nas 119 que não abri
usei o `.json` de medidas e o CSS/JS, sem afirmar o que só a imagem mostraria
(sombra, posição exata do toast, detalhe de foco). Os 46:

- **biblioteca:** `biblioteca-lista-light-1440x900`, `-dark-1440x900`,
  `-light-900x650`; `biblioteca-vazia-light-1440x900`, `-dark-900x650`,
  `-en-1440x900`.
- **busca:** `busca-buscando-light-1440x900`; `busca-com-resultados-light-1440x900`,
  `-light-900x650`, `-en-1440x900`; `busca-sem-resultado-light-1440x900`,
  `-dark-900x650`.
- **plugin:** `plugin-nao-instalado-light-1440x900`, `plugin-instalando-light-1440x900`,
  `plugin-instalando-dark-900x650`, `plugin-instalado-light-1440x900`,
  `plugin-instalado-aviso-light-1440x900`, `plugin-instalado-aviso-dark-900x650`,
  `plugin-erro-light-1440x900`, `plugin-erro-light-900x650`,
  `plugin-different-light-1440x900`, `plugin-different-dark-900x650`,
  `plugin-modified-light-1440x900`, `plugin-foreign-light-1440x900`,
  `plugin-symlink-light-1440x900`.
- **diário:** `ler-caderno-andamento-light-1440x900`,
  `ler-caderno-andamento-en-1440x900`, `ler-caderno-ok-light-1440x900`,
  `ler-caderno-ok-en-1440x900`, `ler-caderno-ok-dark-900x650`,
  `ler-caderno-erro-light-1440x900`, `ler-caderno-erro-dark-900x650`,
  `teclado-ler-caderno-passo-light-1440x900`.
- **tinta:** `tinta-desligada-padrao-light-1440x900`, `tinta-sem-chave-light-1440x900`,
  `tinta-claude-light-1440x900`, `tinta-lendo-light-1440x900`,
  `tinta-ligada-light-1440x900`, `tinta-quota-light-1440x900`,
  `tinta-erro-light-1440x900`, `tinta-status-erro-light-1440x900`,
  `hover-tinta-interruptor-light-1440x900`.
- **teclado:** `teclado-cadernos-botao-light-1440x900`,
  `teclado-cadernos-fechar-light-1440x900`,
  `teclado-tinta-interruptor-light-1440x900`,
  `teclado-tinta-interruptor-dark-900x650`.

Para as 119 variantes restantes usei o `.json` e o código. As capturas têm
`freezeMotion`, então não há como julgar a animação em si — só a presença dos
estados e dos realces.

## 5. Achados da rodada 1

**Status:** 22 RESOLVIDOS, 2 PARCIAIS (F24, F25) e 1 ABERTO por decisão do
autor (F18). O F7 está resolvido por código; a abertura em si segue SEM
CAPTURA. A tabela abaixo cita a captura nova que prova cada status.

| Achado da rodada 1 | Status | Prova na rodada 2 |
|---|---|---|
| F1 — "instalando" do plugin invisível | **RESOLVIDO** | `plugin-instalando-light-1440x900.png`: "Instalando…" 130×30, `disabled=true`, spinner de 3 pontos (e `aria-busy=true` na checagem do bloco); o segundo clique não cai mais no "Outra instalação em andamento". |
| F2 — "instalado" oferecia "Instalar plugin" | **RESOLVIDO** | `plugin-instalado-light-1440x900.png`: "Reinstalar plugin" 121×30. |
| F3 — erro do plugin só em toast | **RESOLVIDO** | `plugin-erro-light-1440x900.png`: erro inline com `role=alert`, motivo e "Tentar de novo" 374×30, além do toast. |
| F4 — painel da tinta acima da lista/vazio | **RESOLVIDO** | `biblioteca-lista-light-1440x900`: linhas até y=384 e interruptor em y=397; `biblioteca-vazia-light-1440x900`: vazio em y=171 e interruptor em y=208. O DOM ainda vem antes da lista — é o N2. |
| F5 — resultados nascem depois do painel | **RESOLVIDO** | `busca-com-resultados-light-1440x900`: status y=161, primeiro cartão y=174, painel da tinta no pé (interruptor y=400). |
| F6 — "sem resultado" em duas mensagens | **RESOLVIDO** | `busca-sem-resultado-light-1440x900`: uma linha "Nenhum resultado. Tente outro termo." (12 px, 4,95:1) logo abaixo do campo, sem segundo nó na lista. |
| F7 — resultado promete página e o clique abria só o caderno | **RESOLVIDO (código)** | `desk/src/notebooks.mjs:270` passa `page` ao `deps.open({courseId,path,page})`; a abertura em si continua SEM CAPTURA (janela do Xournal++). |
| F8 — JSON cru e caminho temporário em texto proporcional | **RESOLVIDO** | `ler-caderno-ok-light-1440x900.json`: `step-text` humano ("Ler o caderno: aula-nova.xopp, página 1") e `step-tech` mono 12,5 px atrás de "Detalhes técnicos". |
| F9 — diário em inglês misturava "Entrada:" e texto em português | **RESOLVIDO** | `ler-caderno-ok-en-1440x900.png`: "Input:" e "Read the notebook: aula-nova.xopp, page 1"; só as chaves cruas do JSON (`caminho`/`pagina`) seguem em português, como dado técnico. |
| F10 — nome técnico `mesa_ler_caderno` cru | **RESOLVIDO** | `ler-caderno-andamento-light-1440x900`: "Lendo o caderno" / "Lendo o caderno: aula-nova.xopp, página 1"; o id técnico não aparece no texto. |
| F11 — nome acessível do passo com o detalhe inteiro | **RESOLVIDO** | `ler-caderno-ok-light-1440x900.json` (`step-toggle`: "Ler o caderno: aula-nova.xopp, página 1") e `teclado-ler-caderno-passo-light-1440x900.json` (mesmo nome curto, 39 caracteres). |
| F12 — erro do passo não mudava a cabeça | **RESOLVIDO** | `ler-caderno-erro-light-1440x900.png`: cabeça "Não consegui ler o caderno" em vermelho, marca vermelha e `data-failed=true`. |
| F13 — alvo do interruptor com 18 px | **RESOLVIDO** | `tinta-*`/`biblioteca-*`: interruptor 335×28; nos 567 alvos medidos, `abaixo24=0`. |
| F14 — trilho do interruptor em 1,54:1 | **RESOLVIDO** | Pixels de `tinta-desligada-padrao-light/dark`: trilho `#707070`/`#979797` = 4,95:1/5,64:1 contra superfície; polegar 4,95:1/4,52:1; ligado 7,42:1/~4,6:1. |
| F15 — `work-meta` no hover em 3,97:1/4,33:1 | **RESOLVIDO** | `ler-caderno-andamento-light-1440x900.json`: "1s" `#5c5c5c` sobre `#e6e6e6` = 5,36:1; `-dark`: "2s" = 5,31:1. O mesmo padrão reaparece no novo `.step-tech-label` (N7). |
| F16 — escala comprimida, trecho em 11 px | **RESOLVIDO** | `biblioteca-lista`: título 13/600, meta 11/400; `busca-com-resultados`: trecho 12/400, status 11/400, grupo 11/600. |
| F17 — interruptor da tinta sem hover | **RESOLVIDO** | `hover-tinta-interruptor-light/dark-1440x900.json`: fundo do interruptor muda para `#e6e6e6`/`rgba(255,255,255,.09)`; `hover-linha-caderno` idem na linha. |
| F18 — Cadernos a três cliques | **ABERTO — decisão do autor (D2)** | `teclado-cadernos-botao-light-1440x900.png`: o foco chega ao botão Cadernos dentro de Mais opções → Contexto; não há atalho nem entrada no cabeçalho. D2 segue pendente; não conta como defeito novo. |
| F19 — erro da tinta só em toast | **RESOLVIDO** | `tinta-erro-light-1440x900.png`: erro inline "Não foi possível ligar a leitura da tinta." (5,74:1) + "Tentar de novo" 94×24, além do toast. |
| F20 — nome da linha sem separador | **RESOLVIDO** | `teclado-cadernos-linha-light-1440x900.json`: "aula-nova.xopp, sub · 00:15"; `teclado-tinta-linha`: "aula-teste.xopp, 31/12, 21:00". |
| F21 — fechar do popover era glifo de texto | **RESOLVIDO** | `biblioteca-lista-light-1440x900.png`: o "×" virou ícone Lucide (`icon('close')`, 28×28, `aria-label="Fechar"`); não há mais nó de texto "×". |
| F22 — vazio não dizia como o caderno chega ali | **RESOLVIDO** | `biblioteca-vazia-light-1440x900`/`-en`: "Nenhum caderno .xopp ainda. Salve um na pasta da matéria e ele aparece aqui." |
| F23 — linha do plugin sem o ponto de status | **RESOLVIDO** | `plugin-*`: ponto `muted`/`busy`/`ok`/`new`/`warn` na linha, na mesma gramática das linhas do Sobre. |
| F24 — meta em 11 px raspando no escuro | **PARCIAL** | Normal agora 5,55:1 no escuro e 6,69:1 no claro; mas no hover escuro da busca o "Cálculo I · página 1" mede **4,16:1** (`busca-com-resultados-dark-1440x900.json`) — N8. |
| F25 — andamento dizia a mesma frase duas vezes | **PARCIAL** | `ler-caderno-andamento-light`: cabeça "Lendo o caderno" + passo "Lendo o caderno: aula-nova.xopp, página 1" (a cabeça perdeu o nome técnico, mas o verbo se repete); no ok, o corpo repete o rótulo inteiro — N9. |

## 6. Decisões do autor (D1–D3)

- **D1 (converter síncrono no Xournal++):** não afeta esta nota. A UI do
  convert é do Xournal++, fora da janela da Mesa, e está fora do recorte de
  cadernos. **decisão do autor.**
- **D2 (Cadernos a três cliques):** afeta a descoberta do #133 (F18), mas é
  **decisão do autor** e não entra como defeito novo. Se o autor escolher B
  (atalho), a nota de Clarity do #133 tem espaço para subir; se A, o custo fica
  registrado. **decisão do autor.**
- **D3 (capas de caderno):** não afeta a nota; a biblioteca está na opção C
  (lista como está). Se o autor escolher B (ícone de caderno na cor da matéria
  + etiqueta A4), muda a apresentação da lista, não os achados desta rodada.
  **decisão do autor.**
