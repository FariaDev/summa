# Inventário de UI/UX — Cadernos (ciclo 2, rodada 2, "antes")

Recorte: **#133** (biblioteca de cadernos `.xopp` e instalação do plugin
MesaPagina), **#135** (`ler_caderno` no diário do chat) e **#158** (busca no
texto dos cadernos e leitura da tinta). Este documento é o inventário e as
capturas do "antes" da rodada 2: o código já tem os consertos da rodada 1, e os
estados que faltavam foram acrescentados. Nada aqui foi corrigido pelo capturador.

Os estados e checagens abaixo já seguem as telas consertadas na rodada 2
(#133, #158), sem afrouxar o que o roteiro confere. A pasta `antes/` guarda a
captura feita antes desses consertos; a regeneração no HEAD integrado roda a
mesma suíte sobre as telas atuais.

Data da captura: 2026-11-07. Script:
[`desk/tests/capture-ciclo2-cadernos.mjs`](../../desk/tests/capture-ciclo2-cadernos.mjs)
(kit em [`capture-ciclo2-cadernos-kit.mjs`](../../desk/tests/capture-ciclo2-cadernos-kit.mjs),
blocos do plugin em [`capture-ciclo2-cadernos-plugin.mjs`](../../desk/tests/capture-ciclo2-cadernos-plugin.mjs)),
fora do `npm run ui`.

## Como reproduzir

Na pasta `desk/`:

```sh
DISPLAY=:0 node tests/capture-ciclo2-cadernos.mjs
DISPLAY=:0 node tests/capture-ciclo2-cadernos.mjs --out /tmp/cadernos-depois
DISPLAY=:0 CICLO2_OUT=/tmp/cadernos-depois node tests/capture-ciclo2-cadernos.mjs
DISPLAY=:0 CICLO2_ONLY=biblioteca,tinta node tests/capture-ciclo2-cadernos.mjs --out /tmp/so-dois-blocos
```

Saída padrão: `docs/design-loop/rodada-2/antes/cadernos/`. A rodada seguinte
repete o mesmo script com `--out`/`CICLO2_OUT` apontando para outra pasta, sem
editar o script. A rodada 1 continua em `docs/design-loop/rodada-1/antes/cadernos/`.

Dados sintéticos: matérias de mentira com `.xopp` que são XML gzip sintético
(`seedLibrary`), PDF mínimo gerado no próprio teste, `fake-opencode.mjs` como
motor e `fake-xournalpp.mjs` no lugar do Xournal++. Nenhum material de curso,
PDF real ou `~/.config/xournalpp` real é tocado; `HOME`/`XDG` ficam no runtime
temporário do teste.

Cada bloco começa o estado e **confere por DOM** que ele está na tela antes da
foto; se não estiver, o bloco imprime `FALHOU` e não grava a foto daquele
estado. O resultado da rodada fica em `_falhas.json` (hoje: `{"falhas":[]}`).

## Convenção dos arquivos

Cada série comum tem cinco PNGs e cinco `.json` de mesmo nome-base:

| Sufixo | Janela | Tema | Idioma |
|---|---|---|---|
| `-light-1440x900` | 1440×900 (conteúdo; `innerHeight` real 873) | claro | pt-BR |
| `-dark-1440x900` | 1440×900 | escuro | pt-BR |
| `-light-900x650` | 900×650 (conteúdo; `innerHeight` real 623) | claro | pt-BR |
| `-dark-900x650` | 900×650 | escuro | pt-BR |
| `-en-1440x900` | 1440×900 | claro | en |

Exemplo: `busca-com-resultados-dark-900x650.png` e
`busca-com-resultados-dark-900x650.json`. A captura é da janela inteira; o
`.json` mede a **região** indicada na tabela. O teclado usa os quatro sufixos
`-light-1440x900`, `-dark-1440x900`, `-light-900x650` e `-dark-900x650`; o hover
usa `-light-1440x900` e `-dark-1440x900`.

## Estados cobertos

"Onde" é a região medida no `.json`.

### #133 — biblioteca de cadernos

| Estado | Base de captura | Onde | O que confere antes da foto |
|---|---|---|---|
| Lista agrupada por matéria (a da aba atual primeiro; mais recente primeiro; pasta e hora na meta) | `biblioteca-lista` | `#notebooks-pop` | 2 grupos, 3 linhas, `aula-nova.xopp` primeiro |
| Lista vazia (matéria sem `.xopp`) | `biblioteca-vazia` | `#notebooks-pop` | `.notebooks-empty` visível e zero linhas |

A ação "abrir no Xournal++" não tem tela própria na Mesa: o popover fecha e o
arquivo vai para o programa de escrita. Ela não entra como estado capturado
(ver "Estados não capturados").

### #133 — plugin MesaPagina (Sobre → Componentes)

| Estado | Base de captura | Onde | O que confere antes da foto |
|---|---|---|---|
| Não instalado | `plugin-nao-instalado` | `.component-plugin` | estado "não instalado", botão "Instalar plugin da página", ponto `muted` |
| Instalando (IPC em voo) | `plugin-instalando` | `.component-plugin` | pedido pendente; "não instalado"; botão "Instalando…", `disabled`, `aria-busy=true`, spinner e ponto `busy` |
| Instalado | `plugin-instalado` | `.component-plugin` | estado "instalado", botão "Reinstalar plugin", linha "Reinicie o Xournal++ para carregar o plugin.", ponto `ok` |
| Instalado + aviso de reiniciar | `plugin-instalado-aviso` (4 variantes: claro/escuro × 1440×900/900×650) | `.component-plugin` | estado "instalado", "Reinstalar plugin", a linha de reiniciar e o toast "Plugin instalado." |
| Erro da instalação | `plugin-erro` | `.component-plugin` | estado "não instalado", erro inline (`role=alert`) com o motivo e "Tentar de novo"; botão da linha `disabled` + `aria-disabled=true`; **sem toast** |
| Instalado, versão diferente | `plugin-different` | `.component-plugin` | estado "instalado, versão diferente", ponto `new`, botão "Atualizar plugin" e "versão 1.0.0 na pasta" (o fake publica a versão) |
| Modificado | `plugin-modified` | `.component-plugin` | estado "A pasta MesaPagina foi modificada — não vou sobrescrevê-la.", ponto `warn`, botão "Instalar plugin da página" `disabled` + `aria-disabled=true` |
| De outro autor (`foreign`) | `plugin-foreign` | `.component-plugin` | estado "Já existe uma pasta MesaPagina de outro autor — não vou tocar nela.", ponto `warn`, botão "Instalar plugin da página" `disabled` + `aria-disabled=true` |
| Link simbólico (`symlink`) | `plugin-symlink` | `.component-plugin` | estado "O alvo é um link simbólico — recuso seguir links.", ponto `warn`, botão "Instalar plugin da página" `disabled` + `aria-disabled=true` |

O "instalado" é uma instalação de verdade dentro do runtime temporário. O
"instalando" segura o handler `xournal-plugin-install`; os quatro estados de
recusa vêm do IPC `components` falso (o mesmo molde de
`tests/notebooks-plugin-ui.mjs`), sem tocar no `~/.config` real. O aviso de
instalado é recriado a cada variante com um "Reinstalar plugin" real, porque o
toast some em ~3,8 s.

### #135 — `ler_caderno` no diário do chat

| Estado | Base de captura | Onde | O que confere antes da foto |
|---|---|---|---|
| Em andamento | `ler-caderno-andamento` | último `article.work` | `data-live="true"` + passo `data-status="running"` citando `ler_caderno` |
| Ok | `ler-caderno-ok` | último `article.work` | `data-live="false"` + passo `data-status="done"` com detalhe aberto |
| Erro | `ler-caderno-erro` | último `article.work` | passo `data-status="error"` com o texto do erro no detalhe |

O "em andamento" e o "ok" vêm de um turno real contra o fake do OpenCode, com o
MCP `mesa` de verdade e a ponte `/notebook-page`; o Xournal++ falso demora 13 s
para exportar o PNG, o que deixa o passo em andamento tempo suficiente para a
série. O caderno é autorizado pelo mesmo caminho da pessoa (abrir na
biblioteca). O "erro" vem de um histórico sintético com `toolResult`
`isError: true`, que é como o diário reconstrói a falha ao reabrir a conversa.
O argumento `caminho` do "ok" usa um alias em `/tmp` para não expor o caminho
do runtime na captura.

### #158 — busca no texto dos cadernos

| Estado | Base de captura | Onde | O que confere antes da foto |
|---|---|---|---|
| Campo vazio (lista) | `busca-vazia` | `#notebooks-pop` | campo `""` e lista com 2+ cadernos |
| Buscando… (IPC em voo) | `busca-buscando` | `#notebooks-pop` | campo `EQUACAO`, lista com `notebooks-searching` (opacity .5), linhas anteriores preservadas e status "Buscando…"/"Searching…" |
| Sem resultado | `busca-sem-resultado` | `#notebooks-pop` | `.notebooks-search-empty` com a mensagem única + status com texto |
| Com resultados | `busca-com-resultados` | `#notebooks-pop` | linhas de resultado, `<mark>` no trecho e status com contagem |

A busca roda de verdade no main sobre os `.xopp` gzip sintéticos; a consulta é
`zzz sem match` (vazio) e `EQUACAO` (acha "Equação" sem acento/caixa). Em
`busca-buscando`, o handler `notebooks-search` é trocado por um fake que só
resolve no fim do bloco — é o que segura o estado de 150 ms até a foto.

### #158/#159 — leitura da tinta no painel de cadernos

| Estado | Base de captura | Onde | O que confere antes da foto |
|---|---|---|---|
| Desligada por padrão (modelo disponível) | `tinta-desligada-padrao` | `#notebooks-pop` | `aria-checked=false`, interruptor habilitado, descrição presente |
| Sem chave/modelo com visão | `tinta-sem-chave` | `#notebooks-pop` | desabilitado, `aria-checked=false`, aviso "Sem modelo com visão…" |
| Motor Claude indisponível | `tinta-claude` | `#notebooks-pop` | desabilitado, aviso "Com o Claude, a leitura da tinta ainda não está disponível." |
| Lendo | `tinta-lendo` | `#notebooks-pop` | ligado, "3 páginas lidas" e "Lendo as páginas…" |
| Ligada, em dia | `tinta-ligada` | `#notebooks-pop` | ligado, "7 páginas lidas" e "Em dia" |
| Cota pausada (`quota`) | `tinta-quota` | `#notebooks-pop` | ligado, "4 páginas lidas" e "Pausado: sem cota" |
| Erro ao ligar (toast + inline) | `tinta-erro` | `#notebooks-pop` | toast "Não foi possível ligar a leitura da tinta.", erro inline com "Tentar de novo" e interruptor de volta em desligado |
| Status `error` persistente | `tinta-status-erro` | `#notebooks-pop` | ligado, "5 páginas lidas", "Erro ao ler a tinta" e erro inline da tentativa de desligar |

Os estados do painel entram pelo IPC `notebooks-ink-status`/`notebooks-ink-set`
com fakes nomeados, como em `tests/notebooks-ink-ui.mjs`; o vigia real não é
exercitado nesta captura (ele tem provas próprias em `.test.mjs`). `tinta-erro`
e `tinta-status-erro` combinam o status do vigia com uma falha real do
`notebooks-ink-set` (o fake devolve `{ok:false,reason}`), que é o caminho do erro
inline.

### Hover medido

| Estado | Base de captura | Onde | O que confere antes da foto |
|---|---|---|---|
| Hover na linha da lista | `hover-linha-caderno` (claro/escuro, 1440×900) | `#notebooks-pop` | fundo computado da primeira `.notebooks-row` deixa de ser transparente (`--hover`) |
| Hover no interruptor da tinta | `hover-tinta-interruptor` (claro/escuro, 1440×900) | `#notebooks-pop` | fundo computado de `#notebooks-ink-switch` deixa de ser transparente (`--hover`) |

A foto é tirada com o ponteiro ainda em cima (`capture(..., {keepPointer:true})`)
e o `.json` registra `alvos[].fundo`, que é a prova medida do realce.

## Percurso só pelo teclado

Capturas nos dois temas e nos dois tamanhos (1440×900 e 900×650), com o anel de
foco medido no `.json` (`foco.contorno`/`sombra` e `:focus-visible`). O caminho
usa Tab/Shift+Tab, setas e Enter de verdade; nada de `.focus()` como prova final.

| Base | Tela | Como chegou | Foco |
|---|---|---|---|
| `teclado-cadernos-botao` | Mais opções → Contexto | `#chat-more` + ↓ abre o menu, ↓ até Contexto, → abre o submenu, Tab até o botão | `#notebooks-btn` (botão Cadernos) |
| `teclado-cadernos-busca` | popover Cadernos | abrir pelo botão (o foco entra no campo) | `#notebooks-search` |
| `teclado-cadernos-fechar` | popover Cadernos | Shift+Tab a partir do campo | `#notebooks-close` (×) |
| `teclado-cadernos-linha` | popover Cadernos | Tab a partir do campo (as linhas vêm antes do painel da tinta) | primeira `.notebooks-row` |
| `teclado-tinta-interruptor` | popover Cadernos | Tab a partir da primeira linha (campo → linhas → interruptor) | `#notebooks-ink-switch` (`role=switch`) |
| `teclado-tinta-linha` | popover Cadernos | Tab a partir do campo | primeira `.notebooks-row` |
| `teclado-plugin-instalar` | Sobre → Componentes | foco anterior + Tab/Shift+Tab no diálogo | `.component-plugin-install` |
| `teclado-plugin-fechar` | Sobre | idem, no × do diálogo | `.dialog-close` do Sobre |
| `teclado-ler-caderno-cabeca` | diário do chat | foco anterior + Tab/Shift+Tab | `.work-head` (abre/fecha o diário) |
| `teclado-ler-caderno-passo` | diário do chat | Tab a partir da cabeça | `.step-toggle` do passo da ferramenta |

O painel da tinta agora vem **depois** da lista no DOM (`list.after(...)` em
`notebooks.mjs`), sem `order` no CSS: a ordem do Tab é campo → linhas →
interruptor, e as rotas acima seguem essa ordem. As duas rotas do plugin
(`teclado-plugin-instalar`/`-fechar`) entraram junto com este ajuste.

## O que cada `.json` mede

Além de janela, tema, idioma e retângulo da região:

- `textos[]`: cada nó com texto visível na região — texto, tag/classe, cor
  computada, fundo efetivo (composição dos fundos até um opaco), razão de
  contraste WCAG, tamanho/peso/line-height/família e caixa.
- `alvos[]`: cada controle (button, link, input, `role=button/switch/option`,
  `[tabindex]`) — rótulo acessível (`aria-label`/`aria-labelledby`/title/
  placeholder/texto), `role`, caixa (largura×altura), `abaixo24`/`abaixo44`,
  contorno/sombra e `fundo` computado (para o hover).
- `foco`: elemento ativo, `:focus-visible`, caixa, contorno (largura/estilo/cor),
  offset e box-shadow.
- O fundo efetivo compõe cores sólidas; fundo com imagem/gradiente não é
  desenhado no cálculo (nenhuma região deste recorte usa imagem de fundo).

## Estados não capturados (e por quê)

| Estado | Motivo |
|---|---|
| Abrir o caderno no Xournal++ | A ação fecha o popover e abre outro programa; a janela do Xournal++ não é UI da Mesa e não existe neste ambiente (o teste usa `fake-xournalpp.mjs`). A prova da abertura é o IPC, já coberto por `tests/notebooks-ui.mjs`. |
| Comportamento do plugin dentro do Xournal++ (Ctrl+Alt+R/B, converter, trocar fonte) | É UI do Xournal++ com o plugin carregado, fora da janela da Mesa; a rodada do Xournal++ cobre os diálogos do plugin. |

Todos os estados que os avaliadores da rodada 1 listaram como SEM CAPTURA e que
são UI da Mesa estão cobertos agora; `_falhas.json` está vazio.

## Problemas de UI notados no "antes"

Os itens 1–3 e 5 foram corrigidos na rodada 2 (#133/#158), e o roteiro agora
confere o estado consertado; ficam aqui como registro do que a captura "antes"
mostrava. O item 4 segue em aberto.

1. **`different` oferece "Instalar plugin da página", não "Atualizar".** O
   estado diz "instalado, versão diferente", mas a ação tem o mesmo rótulo da
   instalação nova (`plugin-different-*`). Para o aluno, o botão não diz que vai
   atualizar nem que a versão da pasta é outra.
2. **`modified` explica pouco.** O estado é só "modificado"
   (`plugin-modified-*`), enquanto `foreign` e `symlink` trazem uma frase
   completa; a linha fica sem dizer o que foi modificado nem o que fazer.
3. **As recusas ainda mostram o botão de instalar.** `modified`, `foreign` e
   `symlink` mantêm "Instalar plugin da página" habilitado; o clique só descobre
   a recusa depois, no erro inline/toast. Desabilitar ou trocar o rótulo para
   "Ver motivo" evitaria a tentativa fadada.
4. **O erro do vigia não tem ação própria.** `tinta-status-erro` mostra "Erro ao
   ler a tinta" e o erro inline vem da tentativa de desligar; não há um "Tentar
   de novo" do próprio status do vigia, só o do toggle.
5. **"Buscando…" não tem indicador além do texto.** A lista anterior fica com
   `opacity:.5` e o status anuncia a busca, mas não há spinner/skeleton na área
   dos resultados (`busca-buscando-*`).

## Contagem

Com as 10 bases de teclado, a rodada completa rende 173 PNG + 173 `.json` de
medidas + `_falhas.json` = 347 arquivos na pasta de saída. Todos os blocos
imprimem `ok`; `_falhas.json` fica vazio. A soma:

- 25 séries de 5 variantes = 125 (biblioteca 2, plugin 8, `ler_caderno` 3,
  busca 4, tinta 8 — `plugin-instalado-aviso` é a exceção de 4);
- `plugin-instalado-aviso`: 4 (claro/escuro × 1440×900/900×650);
- 10 bases de teclado × 4 variantes = 40;
- 2 hovers × 2 temas = 4.

Total: 125 + 4 + 40 + 4 = 173.
