# Plugins no Xournal++ e montagem real (#159, #133)

Recorte do ciclo 2 para os quatro itens do plugin **MesaPagina** e para a
montagem real com o chat solto da Mesa ao lado. As capturas são de janelas de
verdade, num Xournal++ 1.3.8 com um caderno sintético; a ponte da Mesa usa
`createInkConvertHost` com leitores falsos, sem motor nem chave de verdade.

## Como foi capturado

- Script: `desk/tests/capture-ciclo2-xournal.mjs` (fora do `npm run ui`), kit
  X11/PNG `desk/tests/capture-ciclo2-xournal-kit.mjs` e fixtures
  `desk/tests/capture-ciclo2-xournal-fixtures.mjs`.
- Comando: `cd desk && DISPLAY=:0 node tests/capture-ciclo2-xournal.mjs`.
- Xournal++ 1.3.8 em `~/.local/bin/xournalpp` (ou `XOURNALPP_BIN`), com Lua,
  `xwd`, `xprop`, `xwininfo` e Python 3 com `libX11`/`libXtst`.
- HOME/XDG temporários: o plugin é copiado para
  `<tmp>/config/xournalpp/plugins/MesaPagina` e habilitado só nessa cópia. O
  `~/.config/xournalpp` real não é lido nem escrito.
- O caderno tem 10 páginas, uma delas pequena (300×300) para o crescimento de
  página ficar visível e a última com fontes mistas (C059 e Sans) para o
  diálogo do Trocar fonte. Os textos "Texto sintético da página", "Segunda
  linha", "Página pequena", "Texto em C059" e "Texto em Sans" são só fixture.
- A ponte falsa cobre sucesso, resposta inválida (`{}`), porta fechada, todos
  os motivos (`quota`, `timeout`, `disabled`, `no-model`, `no-vision`, `free`,
  `busy`, `too-large`, `bad-request`, `forbidden` e desconhecido), resposta
  vazia e ponte ausente. Nenhum modelo, chave ou sessão real é usada.
- Saída: `CICLO2_OUT=../docs/design-loop/rodada-6/antes/xournal` (o padrão é
  `docs/design-loop/rodada-2/antes/xournal/`; `--out <dir>` troca).
  `CICLO2_ONLY=01-menu-plugin` filtra; `CICLO2_KEEP=1` preserva os temporários
  para depurar.
- Precisa de X11 (XTest e `xwd`); Wayland puro não serve.

Cada JSON ao lado do PNG registra o recorte, as janelas usadas (título,
classe, geometria), `seguro` e `intrusas`. Com uma janela alheia por cima, a
imagem não é gravada e o motivo fica no JSON. Nesta rodada todos os 33 estados
saíram com `seguro: true` e o `capturas.json` traz `falhas: []`.

## Estados capturados

| # | Estado | Captura | O que aparece |
|---|---|---|---|
| 01 | Menu do plugin | [`01-menu-plugin.png`](rodada-6/antes/xournal/01-menu-plugin.png) | Menu **Plugin** aberto, com **Gerenciador de Plugins** e os quatro itens do MesaPagina, com os atalhos. |
| 02 | Converter sem seleção | [`02-converter-sem-selecao.png`](rodada-6/antes/xournal/02-converter-sem-selecao.png) | Diálogo de erro "Selecione um trecho de tinta para converter em texto." sobre a página 1. |
| 03 | Confirmação da conversão | [`03-converter-confirmacao.png`](rodada-6/antes/xournal/03-converter-confirmacao.png) | Aviso de congelamento de até 20 s, dizendo que o texto entra em camada nova e a tinta fica, com **Continuar** e **Cancelar**, e a tinta/texto selecionados. |
| 04 | Convertendo | [`04-converter-convertendo.png`](rodada-6/antes/xournal/04-converter-convertendo.png) | Xournal++ congelado durante a chamada síncrona: seleção e texto originais ainda na tela, sem diálogo de progresso. Capturado 700 ms depois do **Continuar**, com a ponte respondendo em 4 s. |
| 05 | Conversão concluída | [`05-converter-sucesso.png`](rodada-6/antes/xournal/05-converter-sucesso.png) | Camada **Texto convertido** acima da tinta, com "texto convertido sintético"; a tinta original fica para comparar. |
| 06 | Ponte desligada/ausente | [`06-converter-ponte-desligada.png`](rodada-6/antes/xournal/06-converter-ponte-desligada.png) | Diálogo "A conversão precisa da Mesa aberta e da opção “Ler a escrita à mão” ligada em Cadernos…" na página 2 — **sem** confirmação antes: a ponte é conferida antes do aviso de congelamento. |
| 07 | Erro de quota | [`07-converter-erro-quota.png`](rodada-6/antes/xournal/07-converter-erro-quota.png) | Diálogo "Sem cota no modelo atual. Escolha outro modelo com visão na Mesa ou tente mais tarde." na página 3. |
| 08 | Resposta inválida | [`08-converter-resposta-invalida.png`](rodada-6/antes/xournal/08-converter-resposta-invalida.png) | Diálogo "A resposta da Mesa veio em um formato inesperado…" na página 4 (stub HTTP devolve `{}`). |
| 09 | Erro de conexão | [`09-converter-erro-conexao.png`](rodada-6/antes/xournal/09-converter-erro-conexao.png) | Diálogo "Não deu para falar com a Mesa. Se ela estiver fechada, abra-a; se já estiver aberta, reabra-a e tente de novo." na página 5 (porta fechada). |
| 10 | Timeout da ponte | [`10-converter-timeout.png`](rodada-6/antes/xournal/10-converter-timeout.png) | Diálogo "A conversão demorou demais. Tente de novo. Se o trecho for grande, selecione menos tinta." na página 6 (host com `requestTimeoutMs`). |
| 11 | Trocar fonte: diálogo | [`11-trocar-fonte-dialogo.png`](rodada-6/antes/xournal/11-trocar-fonte-dialogo.png) | "Todos os textos da página (2 textos). Fonte atual: Sans. Lista de fontes: página 1 de 17. Escolha a nova fonte:" com **Sans (atual)**, **C059**, **Cantarell**, **D050000L**, **Mais…** e **Cancelar**, na página 7. |
| 12 | Trocar fonte: aviso de sucesso | [`12-trocar-fonte-sucesso.png`](rodada-6/antes/xournal/12-trocar-fonte-sucesso.png) | Diálogo "Fonte trocada para C059 em 2 textos. Desfazer (Ctrl+Z ou ⌘Z)." sobre a página 7, já com os textos recriados em **C059** por baixo — capturado limpo, sem a faixa preta do `snapshot` com o aviso aberto. |
| 12b | Trocar fonte: página aplicada | [`12b-trocar-fonte-aplicada.png`](rodada-6/antes/xournal/12b-trocar-fonte-aplicada.png) | A página 7 depois do **OK** no aviso: textos em **C059**, sem diálogo. |
| 13 | Trocar fonte sem texto | [`13-trocar-fonte-sem-texto.png`](rodada-6/antes/xournal/13-trocar-fonte-sem-texto.png) | Diálogo "Não há textos para trocar a fonte…" na página 8 (só tinta). |
| 14 | Página antes do crescimento | [`14-pagina-antes.png`](rodada-6/antes/xournal/14-pagina-antes.png) | Página 9 pequena (300×300) antes de crescer. |
| 15 | Página +2 cm à direita | [`15-pagina-direita.png`](rodada-6/antes/xournal/15-pagina-direita.png) | Mesma página 9 mais larga, depois de **Ctrl+Alt+R**. |
| 16 | Página +2 cm abaixo | [`16-pagina-abaixo.png`](rodada-6/antes/xournal/16-pagina-abaixo.png) | Mesma página 9 mais alta, depois de **Ctrl+Alt+B**. |
| 17 | Montagem real | [`17-montagem-real.png`](rodada-6/antes/xournal/17-montagem-real.png) | Xournal++ (900×650, à esquerda) e a janela solta do chat lateral (420×650, à direita), sem sobreposição (36 px entre elas), recorte de 1356×650; a Mesa principal fica minimizada e a resposta do tutor é do motor falso de teste. |
| 18 | Montagem real com a conversão em curso | [`18-montagem-real-convertendo.png`](rodada-6/antes/xournal/18-montagem-real-convertendo.png) | Mesmo par de janelas do 17, com a tinta e o texto selecionados por **Ctrl+A** e o **diálogo de confirmação da conversão** (o aviso de congelamento de até 20 s do 03, com **Continuar** e **Cancelar**) por cima da seleção — o mesmo fluxo que o plugin Converter lê em `app.getStrokes("selection")`. |
| 19 | Converter: `no-model` | [`19-converter-erro-no-model.png`](rodada-6/antes/xournal/19-converter-erro-no-model.png) | Diálogo "Nenhum modelo com visão disponível. Configure um na Mesa." na página 6 (a ponte falsa devolve `no-model`). |
| 20 | Converter: `no-vision` | [`20-converter-erro-no-vision.png`](rodada-6/antes/xournal/20-converter-erro-no-vision.png) | Diálogo "O modelo atual não lê imagens. Escolha um modelo com visão na Mesa." na página 6 (a ponte falsa devolve `no-vision`). |
| 21 | Converter: `free` | [`21-converter-erro-free.png`](rodada-6/antes/xournal/21-converter-erro-free.png) | Diálogo "O modelo gratuito não lê tinta. Escolha um modelo com visão na Mesa." na página 6 (a ponte falsa devolve `free`). |
| 22 | Converter: `disabled` | [`22-converter-erro-disabled.png`](rodada-6/antes/xournal/22-converter-erro-disabled.png) | Diálogo "Ligue “Ler a escrita à mão” em Cadernos, na Mesa, para converter." na página 6 (a leitura é desligada depois de a ponte subir). |
| 23 | Converter: `busy` | [`23-converter-erro-busy.png`](rodada-6/antes/xournal/23-converter-erro-busy.png) | Diálogo "A Mesa ainda está terminando a conversão anterior. Aguarde e tente de novo." na página 6, com um pedido direto à ponte ainda em voo (sem o Xournal++ no meio). |
| 24 | Converter: `too-large` | [`24-converter-erro-too-large.png`](rodada-6/antes/xournal/24-converter-erro-too-large.png) | Diálogo "O trecho selecionado é grande demais. Selecione um trecho menor." na página 6 (a ponte falsa devolve `too-large`). |
| 25 | Converter: `bad-request` | [`25-converter-erro-bad-request.png`](rodada-6/antes/xournal/25-converter-erro-bad-request.png) | Diálogo "A Mesa recusou o trecho (formato inválido). Selecione de novo." na página 6 (a ponte falsa devolve `bad-request`). |
| 26 | Converter: `forbidden` | [`26-converter-erro-forbidden.png`](rodada-6/antes/xournal/26-converter-erro-forbidden.png) | Diálogo "A Mesa recusou a chamada. Reabra a Mesa e tente de novo." na página 6 (a ponte falsa devolve `forbidden`). |
| 27 | Converter: motivo desconhecido | [`27-converter-erro-desconhecido.png`](rodada-6/antes/xournal/27-converter-erro-desconhecido.png) | Diálogo "Não deu para converter a tinta. Tente de novo." na página 6 (a ponte devolve um motivo fora da lista). |
| 28 | Converter: resposta vazia | [`28-converter-resposta-vazia.png`](rodada-6/antes/xournal/28-converter-resposta-vazia.png) | Diálogo "A Mesa não leu nenhum texto da tinta. Tente de novo com uma seleção mais nítida." na página 6 (a ponte devolve `{"text":""}`). |
| 30 | Trocar fonte: alvo por seleção | [`30-trocar-fonte-selecao.png`](rodada-6/antes/xournal/30-trocar-fonte-selecao.png) | "2 textos selecionados. Fonte atual: C059. Lista de fontes: página 1 de 17. Escolha a nova fonte:" com os dois textos da página 7 destacados e **C059 (atual)** na lista. |
| 31 | Trocar fonte: fontes mistas | [`31-trocar-fonte-fontes-mistas.png`](rodada-6/antes/xournal/31-trocar-fonte-fontes-mistas.png) | "Todos os textos da página (2 textos). Fontes atuais: C059, Sans. Lista de fontes: página 1 de 17. Escolha a nova fonte:" na página 10, com um texto em cada fonte. |
| 32 | Trocar fonte: segunda página | [`32-trocar-fonte-segunda-pagina.png`](rodada-6/antes/xournal/32-trocar-fonte-segunda-pagina.png) | "Lista de fontes: página 2 de 17." depois de **Mais…**, com as fontes **…TeX Gyre**, **DejaVu Sans** e **…Sans Mono** (o corte preserva o sufixo que distingue as famílias), **Mais…**, **Voltar** e **Cancelar**, na página 7. |
| 33 | Trocar fonte: fonte atual escolhida | [`33-trocar-fonte-atual.png`](rodada-6/antes/xournal/33-trocar-fonte-atual.png) | Diálogo "Os textos já estão em C059." depois de escolher **C059 (atual)**, com a página 7 limpa por baixo. |

O resumo da rodada, com ambiente, estados, falhas e o que não foi capturado,
fica em `capturas.json`, que a captura gera ao lado das imagens (fora do git).

## Textos vistos

| Texto | Onde | Origem | Captura |
|---|---|---|---|
| Página atual +2 cm à direita | Menu do plugin | `main.lua` | 01 |
| Página atual +2 cm abaixo | Menu do plugin | `main.lua` | 01 |
| Converter a seleção em texto… | Menu do plugin | `main.lua` | 01 |
| Trocar fonte dos textos… | Menu do plugin | `main.lua` | 01 |
| Gerenciador de Plugins | Menu do plugin (item do Xournal++) | UI do Xournal++ | 01 |
| MesaPagina | Nome do plugin no menu/diálogos | pasta do plugin | 01, 11 |
| Xournal++ Plugin «MesaPagina» | Título dos diálogos do plugin (erros, confirmação e avisos) | gerado pelo Xournal++ | 02–13, 18–28, 30–33 |
| Selecione um trecho de tinta para converter em texto. | Erro | `main.lua` | 02 |
| A Mesa vai ler a tinta agora. O Xournal++ vai parar de responder por até 20 segundos; não feche a janela. O texto entra numa camada nova (“Texto convertido”); a tinta original fica. Continuar? | Confirmação | `main.lua` | 03, 18 |
| Continuar / Cancelar | Botões da confirmação | `main.lua` | 03, 18 |
| Texto convertido | Nome da camada nova | `main.lua` | 05 |
| A conversão precisa da Mesa aberta e da opção “Ler a escrita à mão” ligada em Cadernos. Abra a Mesa, ligue a leitura da tinta e tente de novo. | Erro de ponte ausente | `main.lua` | 06 |
| Sem cota no modelo atual. Escolha outro modelo com visão na Mesa ou tente mais tarde. | Erro (`quota`) | `ponte.lua` | 07 |
| A resposta da Mesa veio em um formato inesperado. Tente de novo. | Erro | `main.lua` | 08 |
| Não deu para falar com a Mesa. Se ela estiver fechada, abra-a; se já estiver aberta, reabra-a e tente de novo. | Erro de conexão (separado do timeout) | `main.lua` | 09 |
| A conversão demorou demais. Tente de novo. Se o trecho for grande, selecione menos tinta. | Erro (`timeout`) | `ponte.lua` | 10 |
| Todos os textos da página (2 textos). Fonte atual: Sans. Lista de fontes: página 1 de 17. Escolha a nova fonte: | Diálogo de fonte (o nome vem de `app.getFonts`; "Lista de fontes: página N de M" só aparece com mais de uma página) | `main.lua` | 11 |
| Sans (atual), C059, Cantarell, D050000L, Mais…, Cancelar | Botões de fonte (até 4 na primeira página e 3 nas seguintes + `Mais…`/`Voltar`) | `converter.lua` + fontes do sistema | 11 |
| Cancelar | Fecha o diálogo de fonte | `main.lua` | 11, 30–32 |
| Fonte trocada para C059 em 2 textos. Desfazer (Ctrl+Z ou ⌘Z). | Aviso de sucesso | `main.lua` | 12 |
| Não há textos para trocar a fonte. Selecione textos ou abra uma página com textos. | Erro | `main.lua` | 13 |
| Nenhum modelo com visão disponível. Configure um na Mesa. | Erro (`no-model`) | `ponte.lua` | 19 |
| O modelo atual não lê imagens. Escolha um modelo com visão na Mesa. | Erro (`no-vision`) | `ponte.lua` | 20 |
| O modelo gratuito não lê tinta. Escolha um modelo com visão na Mesa. | Erro (`free`) | `ponte.lua` | 21 |
| Ligue “Ler a escrita à mão” em Cadernos, na Mesa, para converter. | Erro (`disabled`) | `ponte.lua` | 22 |
| A Mesa ainda está terminando a conversão anterior. Aguarde e tente de novo. | Erro (`busy`) | `ponte.lua` | 23 |
| O trecho selecionado é grande demais. Selecione um trecho menor. | Erro (`too-large`) | `ponte.lua` | 24 |
| A Mesa recusou o trecho (formato inválido). Selecione de novo. | Erro (`bad-request`) | `ponte.lua` | 25 |
| A Mesa recusou a chamada. Reabra a Mesa e tente de novo. | Erro (`forbidden`) | `ponte.lua` | 26 |
| Não deu para converter a tinta. Tente de novo. | Erro (motivo desconhecido) | `ponte.lua` | 27 |
| A Mesa não leu nenhum texto da tinta. Tente de novo com uma seleção mais nítida. | Erro de resposta vazia | `main.lua` | 28 |
| 2 textos selecionados. | Alvo por seleção no diálogo de fonte | `main.lua` | 30 |
| Todos os textos da página (2 textos). Fontes atuais: C059, Sans. | Alvo de página com fontes mistas no diálogo de fonte | `main.lua` | 31 |
| Lista de fontes: página 2 de 17. | Segunda página da lista de fontes, depois de `Mais…` | `main.lua` | 32 |
| Mais… / Voltar | Botões de paginação da lista de fontes | `main.lua` | 32 |
| Os textos já estão em C059. | Aviso de fonte atual escolhida | `main.lua` | 33 |
| A conversão ainda não funciona no Windows; por enquanto, use a Mesa no Linux ou no macOS. | Erro no Windows | `main.lua` | não capturado |
| Nenhum traço desenhável na seleção. Selecione a tinta a converter. | Erro | `main.lua` | não capturado |
| Não consegui preparar a conversão. | Erro de temporário | `main.lua` | não capturado |
| Não consegui preparar a conversão (<motivo>). | Erro de comando | `main.lua` | não capturado |
| Não consegui criar os textos com a fonte nova. Os textos antigos ficaram como estavam. | Erro ao trocar fonte | `main.lua` | não capturado |
| Lucas Faria / Aumenta a página em 2 cm à direita ou abaixo, converte tinta em texto pela Mesa e troca a fonte dos textos. / 1.1.0 | Gerenciador de Plugins do Xournal++ | `plugin.ini` | não capturado |

## O que não foi capturado, e por quê

Os 33 estados do recorte têm captura. Os ramos abaixo não são estados do
recorte; ficam registrados para a próxima rodada ou para quando o caso
aparecer de verdade.

| Estado | Motivo |
|---|---|
| Conversão no Windows | Não há máquina Windows neste ciclo; o texto está na tabela (`main.lua`). |
| Falhas de preparo (`main.lua`) | Exigiriam `os.tmpname`/`io.open` falhando ou `buildCurlCommand` recusando caminho; não foram forçadas. |
| Seleção sem traço desenhável (`main.lua`) | A API do Xournal++ só devolve traços com pontos válidos, e o `pad` de 10 pt do SVG cobre bbox de largura/altura zero; a única seleção sem traço seria a vazia, que cai antes em "Selecione um trecho de tinta…". Não é provocável sem mexer no plugin. |
| Falha ao criar textos com a fonte nova (`main.lua`) | Exigiria `app.addTexts` falhando; não foi forçado. |
| Gerenciador de Plugins | É UI do próprio Xournal++, não do plugin; o menu que leva a ele está em 01 e os metadados do `plugin.ini` estão na tabela. |
| Cancelar da confirmação / Cancelar da fonte | Mesmos diálogos de 03 e 11, sem tela nova; o caminho de cancelamento não altera nada (o Cancelar da fonte é usado só para fechar os diálogos de 30–32 sem trocar nada). |

## Notas de captura

- **Fluxo novo do Converter (#159):** a ponte é conferida **antes** do aviso de
  congelamento. Sem ponte, o primeiro e único diálogo é o erro de 06; com
  ponte, 03 mostra a confirmação e 04 captura o congelamento. O estado 06 não
  passa por confirmação — o script `bridgeMissingError` captura o primeiro
  diálogo direto.
- **Fluxo novo do Trocar fonte (#159):** depois de escolher a fonte, o plugin
  abre o aviso "Fonte trocada para N textos… Desfazer (Ctrl+Z ou ⌘Z)." (12). O
  12b mostra a página com a fonte aplicada depois do **OK**. O 12 e o 33
  capturam o aviso vivo e, depois do **OK**, a janela principal limpa por
  baixo; o `snapshot(main)` com o aviso aberto deixava a faixa preta e os
  fragmentos-fantasma da rodada 6.
- **Estados novos (#159):** os motivos da ponte (19–28) usam a página 6 (só
  tinta) e o mesmo diálogo de erro; a ponte falsa devolve o motivo. O `busy`
  (23) vem de um pedido direto à ponte que fica em voo, sem o Xournal++ no
  meio. Os estados do Trocar fonte (30–33) usam a página 7 (C059 depois do 12)
  e a página 10 (fontes mistas); a seleção do Xournal++ atravessa a troca de
  página, por isso o Ctrl+A do 30 é o último dos estados de fonte.
- O Xournal++ é aberto em 800×650. O settings é gerado uma vez no HOME
  temporário e ajustado para esse tamanho (`primeXournalSettings`); um settings
  mínimo deixava o layout em 1000 px e uma área preta à direita. A faixa escura
  à direita da página nas imagens é a sombra da página do Xournal++, não uma
  janela alheia.
- Diálogos: a janela principal é pré-capturada limpa e o diálogo vivo é
  composto por cima. Sem isso, o Xournal++ redesenha o cliente com recorte
  errado enquanto o diálogo está aberto.
- Menu: o popup é uma janela override-redirect; ele entra como `papel: menu` no
  JSON e é composto sobre a janela principal pré-capturada. O ordenamento usa a
  pilha do X11 e põe no topo o que não está nela (o popup).
- Montagem: o colormap de 32 bits da janela Electron faz o `xwd` do Xournal++
  falhar com `BadColor`; por isso o Xournal++ é capturado antes de a Mesa abrir
  — sem seleção para o 17, e com **Ctrl+A** e o diálogo de confirmação para o
  18. Nesta sessão o `XRaiseWindow` da janela do Electron também devolvia
  `BadWindow` no `xwd`; o 17/18 usam `raise:false` (documentado no código), e as
  duas janelas não se sobrepõem, então o recorte e a composição não mudam. O
  Xournal++ fica no cliente em (5, 56) com 900×650; a janela solta do chat fica
  em (941, 56) com 420×650. A Mesa principal é minimizada; sobram 36 px entre as
  duas janelas e o recorte é 1356×650. O JSON lista as três janelas do 18
  (Xournal++, diálogo e chat) e `seguro: true`.
- O 18 foi viável com o diálogo de confirmação: Ctrl+A seleciona a tinta e o
  texto da página atual (a 9 na captura; o `gotoPage` do roteiro não voltou à
  página 1 nesta sessão — o mesmo aconteceu no "antes") e Ctrl+Shift+K abre o
  aviso de congelamento. O
  cliente do Xournal++ e o do diálogo são capturados antes da Mesa abrir e
  compostos; o **Cancelar** fecha o diálogo sem converter, então a montagem não
  espera a ponte. O estado travado do 04 sozinho não entraria: sem o diálogo, a
  imagem seria só a seleção, quase igual ao 17.
- A resposta do chat na montagem é do motor falso de teste
  ("Resposta do OpenCode falso: …"); o que se quer na imagem é o Xournal++ real
  ao lado da janela solta real do chat, não uma resposta de modelo.

## Contagem

33 PNG + 33 `.json` de estado + `capturas.json` = 67 arquivos nesta pasta.
Todos os estados saíram com `seguro: true` e `falhas: []`.
