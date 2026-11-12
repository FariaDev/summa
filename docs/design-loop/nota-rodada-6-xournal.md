# Nota da rodada 6 — Xournal++ (MesaPagina)

Recorte: os quatro itens do plugin **MesaPagina** (#133, #159) no Xournal++ 1.3.8,
com as capturas novas de `docs/design-loop/rodada-6/antes/xournal/` (PNG + JSON
homônimo), o inventário `docs/design-loop/inventario-xournal.md`, o Lua do plugin
em `desk/src/xournal-plugins/MesaPagina/` e os textos da Mesa em
`desk/src/locales/pt-BR.json` / `en.json`. As capturas **17** e **18** (montagem)
ficam **fora** desta nota: têm avaliador próprio. Não implementei nem corrigi
nada; a nota é independente das rodadas anteriores e os status da seção 5 são
uma reconferência.

**Estado congelado.** As capturas foram geradas em 2026-11-10T02:15:56Z, depois do
commit `814b741f` ("avisos do MesaPagina com concordância, tom e sem repetição"),
que aplicou os consertos dos achados 3, 4 e 5 da rodada 5. A pasta tem 19 PNG +
19 JSON de estado + `capturas.json`; todos os 19 estados saíram com
`seguro: true` e `intrusas: []`, e o `capturas.json` traz `falhas: []`.

## 1. Notas

| Categoria | Converter (Ctrl+Shift+K) | Trocar fonte (Ctrl+Shift+J) | Aumentar página (#133) | Geral |
|---|---:|---:|---:|---:|
| Clarity | 9,0 | 9,0 | 9,0 | 9,0 |
| Feedback e movimento | 6,5 | 9,0 | 8,5 | 8,0 |
| Estados (vazio/carregando/erro) | 8,0 | 8,0 | 9,0 | 8,3 |
| Consistência & polish | 9,0 | 9,0 | 9,0 | 9,0 |
| **Overall da sub-parte** | **8,1** | **8,8** | **8,9** | **8,6** |
| Tipografia, layout (hierarquia, espaçamento e densidade), cor e contraste, ícones (iconografia), acessibilidade e janela pequena (GTK do Xournal++) | fora | fora | fora | fora |

O Overall de cada sub-parte é a média das 4 categorias; a coluna Geral é a média
das três sub-partes em cada categoria; o Overall geral é a média das 12 células
= **8,6**. Tipografia, hierarquia, espaçamento e densidade, cor e contraste,
iconografia, acessibilidade e janela pequena são do GTK/Xournal++ e ficam
**fora** nas três sub-partes.

### Por que as notas

- **Converter, 8,1.** O fluxo de erro e o vocabulário fecham: **02** "Selecione
  um trecho de tinta para converter em texto."; **03** "A Mesa vai ler a tinta
  agora. O Xournal++ vai parar de responder por até 20 segundos; não feche a
  janela. O texto entra numa camada nova (“Texto convertido”); a tinta original
  fica. Continuar?"; **06** "A conversão precisa da Mesa aberta e da opção “Ler
  a escrita à mão” ligada em Cadernos. Abra a Mesa, ligue a leitura da tinta e
  tente de novo."; **07** "Sem cota no modelo atual. Escolha outro modelo com
  visão na Mesa ou tente mais tarde."; **08** "A resposta da Mesa veio em um
  formato inesperado. Tente de novo."; **09** separa conexão de timeout; **10**
  "A conversão demorou demais. Tente de novo. Se o trecho for grande, selecione
  menos tinta."; **13** diz o que fazer. Os títulos são o neutro "Xournal++
  Plugin «MesaPagina»" (**02, 06–10, 13**), sem o "Error in" antigo. O **05**
  mostra a camada "Texto convertido" e o texto acima da tinta. O que segura a
  sub-parte é o **04**: 700 ms depois de **Continuar**, só a janela do
  Xournal++ congelada, sem diálogo ou indicador; o host responde em 4.000 ms e o
  `--max-time` é 20 s. É a **decisão do autor D1** (síncrono, um toque) e o
  limite da API (sem barra de progresso); **não é regressão desta rodada e o
  limite não é descontado**. Como o usuário sente a janela parada, Feedback fica
  em 6,5; se D1 virar B/C, sobe para ~9,0. Clarity 9,0 (textos exatos e
  acionáveis; **06**, **07** e **08** agora são exatamente os consertos
  sugeridos na rodada 5); Feedback 6,5; Estados 8,0 (9 estados capturados,
  **02–10**; o carregando é o próprio **04**, e os ramos sem captura estão na
  seção 3); Consistência 9,0 (aspas curvas em **03/06**, títulos iguais, e "Ler
  a escrita à mão", "Cadernos", "modelo com visão", "sem cota" e "Desfazer"
  iguais a `pt-BR.json:1721, 1708, 96/1723, 1734 e 2645`; os três achados
  baixos da rodada 5 estão fechados).
- **Trocar fonte, 8,8.** O **11** diz alvo, contagem, fonte atual e posição na
  lista: "Todos os textos da página (2 textos). Fonte atual: Sans. Lista de
  fontes: página 1 de 13. Escolha a nova fonte:"; os botões são **Sans (atual),
  C059, Cantarell, D050000L, Mais…, Cancelar** (666×127; JSON). O **12** nomeia
  a fonte e o desfazer: "Fonte trocada para C059 em 2 textos. Desfazer (Ctrl+Z
  ou ⌘Z)."; o **12b** mostra os dois textos em C059. O **13** diz o que fazer
  quando não há texto. Clarity 9,0; Feedback 9,0 (nome, contagem e desfazer dos
  dois sistemas; a falta de amostra e o diálogo modal são limite da API, não
  desconto); Estados 8,0 (**11/12/12b/13**; o alvo por seleção, as fontes
  mistas, a segunda página, a fonte atual escolhida e a falha do `addTexts` não
  têm captura); Consistência 9,0 ("Desfazer" e "Fonte atual" no tom da Mesa;
  nada de mistura de idioma).
- **Aumentar página, 8,9.** O **01** mostra "Página atual +2 cm à direita" e
  "Página atual +2 cm abaixo", com Ctrl+Alt+R/B; os dois dizem alvo, sentido e
  quantidade, sem jargão e sem "…" (agem na hora, ao contrário de Converter e
  Trocar fonte). O **14** (300×300 pt; contorno de 304×304 px a 100%) e o
  **15/16** mostram a página maior: contorno de 361×304 e 361×361 px, +57 px em
  cada eixo (≈2,01 cm), com a vista acompanhando (`scrollToPos`). Clarity 9,0;
  Feedback 8,5 pelo **achado 2** (não há linha com o tamanho novo; o retorno é a
  página maior e a vista); Estados 9,0 (**14/15/16**, sem caminho de erro
  aplicável); Consistência 9,0 (mesma estrutura nos dois itens, sem mistura de
  idioma, e o resultado no documento).

**Limites da API 1.3.8 registrados, não descontados:** sem barra de progresso,
sem amostra de fonte, sem diálogo não modal e sem detecção de SO no Lua. A
lista de fontes em páginas de 4 e o aviso de sucesso em diálogo com **OK** são
consequência do `openDialog` de botões. O que entra na nota é o que o plugin
escolheu dentro disso (por exemplo, a decisão D1).

## 2. Achados

As capturas da coluna "Captura" são
`docs/design-loop/rodada-6/antes/xournal/NN-*.png`; os valores medidos saem dos
JSON de estado (geometria), do texto exato da captura e do contorno da página
em px a 100% de zoom.

| # | Categoria | Severidade | Captura | Valor medido / texto exato | Sugestão em uma linha | Arquivo provável |
| ---: |---|---|---|---|---|---|---|
| 1 | Feedback e movimento | grave (decisão do autor D1; limite da API) | `04-converter-convertendo.png` | 700 ms depois de **Continuar**: nenhum diálogo, barra ou cursor de progresso; o JSON do 04 lista só a janela do Xournal++ em 800×650. O host dorme 4.000 ms e o `curl` tem `--max-time 20`. O aviso de **03** já fechou. | D1: em **A**, o **03** agora diz que a janela para de responder e não deve ser fechada; em **B/C**, dar o segundo toque ou o segundo plano. Não é regressão desta rodada. | `main.lua:222`; `ponte.lua:347`; `docs/design-loop/decisoes.md` D1 |
| 2 | Feedback e movimento | baixa | `14-pagina-antes.png`, `15-pagina-direita.png`, `16-pagina-abaixo.png` | O contorno da página passa de 304×304 px (**14**) para 361×304 (**15**) e 361×361 (**16**) a 100% de zoom (+57 px ≈ 2,01 cm); a barra de status só mostra "Página 9 de 9" e "100%". Não há linha, aviso ou texto com o tamanho novo. | Mostrar o tamanho novo numa linha de status, se a API 1.3.8 expuser; senão, registrar como limite. | `main.lua:23-36` |

**Nota de captura (não é achado de interface).** O **12** tem a faixa preta de
x≈650 a 800, os fragmentos-fantasma "y" e "For" e a barra de título solta acima
do aviso. É o artefato de composição já visto na rodada 5: o `snapshot(main)` é
tirado com o aviso de sucesso aberto
(`desk/tests/capture-ciclo2-xournal.mjs:328`). O texto "Fonte trocada para C059
em 2 textos. Desfazer (Ctrl+Z ou ⌘Z)." está legível e o **12b** prova a fonte
aplicada; não é defeito da interface e não entrou na nota. Para a próxima
captura, usar a janela principal limpa, como já se faz no **12b**.

## 3. SEM CAPTURA

Estados do inventário (e estados do código que o inventário não lista) sem
imagem nesta rodada. As notas de **Estados** consideram só os estados com
captura; cada estado desta lista fica **sem nota** na categoria correspondente.
Os estados **17** e **18** têm captura, mas ficam fora desta nota (montagem,
avaliador próprio).

| Estado / texto | Sub-parte | Origem | Status |
|---|---|---|---|
| Windows: "A conversão ainda não funciona no Windows; por enquanto, use a Mesa no Linux ou no macOS." | Converter | `main.lua:196` | **SEM CAPTURA**; o inventário `:87` ainda traz o texto antigo |
| "Nenhum traço desenhável na seleção. Selecione a tinta a converter." | Converter | `main.lua:213` | **SEM CAPTURA** |
| Falha de preparo, header: "Não consegui preparar a conversão." | Converter | `main.lua:131` | **SEM CAPTURA** |
| Falha de preparo, corpo: "Não consegui preparar a conversão." | Converter | `main.lua:142` | **SEM CAPTURA** |
| Falha de preparo, comando: "Não consegui preparar a conversão (`<motivo>`)." | Converter | `main.lua:151` | **SEM CAPTURA** |
| Resposta vazia: "A Mesa não leu nenhum texto da tinta." | Converter | `main.lua:178` | **SEM CAPTURA**; o texto não diz o próximo passo (observação, não achado) |
| Falha ao criar textos com a fonte nova: "Não consegui criar os textos com a fonte nova. Os textos antigos ficaram como estavam." | Trocar fonte | `main.lua:343` | **SEM CAPTURA** |
| `disabled`: "Ligue “Ler a escrita à mão” em Cadernos, na Mesa, para converter." | Converter | `ponte.lua:402` | **SEM CAPTURA**; o inventário `:93` ainda traz o texto antigo |
| `no-model`: "Nenhum modelo com visão disponível. Configure um modelo com visão na Mesa." | Converter | `ponte.lua:404` | **SEM CAPTURA**; o inventário `:94` ainda traz o texto antigo |
| `no-vision`: "O modelo atual não lê imagens. Escolha um modelo com visão na Mesa." | Converter | `ponte.lua:405` | **SEM CAPTURA**; o inventário `:95` ainda traz o texto antigo |
| `free`: "O modelo gratuito não lê tinta. Escolha um modelo com visão na Mesa." | Converter | `ponte.lua:406` | **SEM CAPTURA**; o inventário `:96` ainda traz o texto antigo |
| `busy`: "A Mesa ainda está terminando a conversão anterior. Aguarde e tente de novo." | Converter | `ponte.lua:407` | **SEM CAPTURA** |
| `too-large`: "O trecho selecionado é grande demais. Selecione um trecho menor." | Converter | `ponte.lua:409` | **SEM CAPTURA** |
| `bad-request`: "A Mesa recusou o trecho (formato inválido). Selecione de novo." | Converter | `ponte.lua:410` | **SEM CAPTURA** |
| `forbidden`: "A Mesa recusou a chamada. Reabra a Mesa e tente de novo." | Converter | `ponte.lua:411` | **SEM CAPTURA** |
| Motivo desconhecido: "Não deu para converter a tinta. Tente de novo." | Converter | `ponte.lua:416` | **SEM CAPTURA** |
| Segunda página do diálogo de fonte ("Mais…" → "Voltar") | Trocar fonte | `main.lua:374-382, 449-457` | **SEM CAPTURA** |
| "N textos selecionados." (alvo por seleção) | Trocar fonte | `main.lua:311-313` | **SEM CAPTURA**; não está no inventário, mas existe no código e no teste |
| "Fontes atuais: …" (página com fontes mistas) | Trocar fonte | `main.lua:288-296` | **SEM CAPTURA**; o **11** só tem uma fonte (Sans) |
| "Os textos já estão em Sans." (fonte atual escolhida) | Trocar fonte | `main.lua:435-437` | **SEM CAPTURA** |
| Gerenciador de Plugins e metadados do `plugin.ini` (autor, descrição, versão 1.1.0) | — | UI do Xournal++; `plugin.ini:3-7` | **SEM CAPTURA**; o **01** mostra só o item de menu que leva a ele |
| Cancelar da confirmação e Cancelar da fonte | Converter / Trocar fonte | `main.lua:225-230, 459` | **SEM CAPTURA** (mesmos diálogos de **03** e **11**, sem tela nova; o caminho não altera nada) |
| Interface em inglês (Mesa em `en`; plugin em pt-BR fixo) | — | `main.lua`/`ponte.lua` (textos fixos); `locales/en.json` | **SEM CAPTURA**; o plugin não tem catálogo `en`, só o pt-BR; não pontuei a paridade de idioma |

## 4. Vi as imagens?

**Sim.** Abri os 17 PNG da rodada 6 (**01–16** e **12b**) e, para comparar os
três textos corrigidos, os PNG **06**, **07** e **08** da rodada 5; 20 PNG no
total. Não abri **17** e **18** (montagem, fora desta nota). Li os 19 JSON de
estado e o `capturas.json`, o inventário, a nota da rodada 5, o Lua do plugin
(`main.lua`, `ponte.lua`, `converter.lua`, `tamanho.lua`), os locales
`pt-BR.json`/`en.json`, o histórico do commit `814b741f` e o script de captura.

Três notas de evidência:

- **JSON do Xournal++ não tem medidas de acessibilidade.** Os 19 JSON de estado
  do xournal registram só recorte, janelas, papéis e geometria; não trazem
  contraste WCAG, fonte, alvos, foco nem rótulos acessíveis medidos (isso é do
  formato das capturas Electron, não do X11). As categorias correspondentes são
  do GTK e ficaram **fora**; as medidas usadas nesta nota são a geometria, o
  texto exato e o contorno da página em px a 100%.
- **Inventário parcialmente atualizado.** `814b741f` atualizou o **06**, o **08**
  e a linha do **07** em "Textos vistos", mas o inventário ainda está atrás da
  captura em `:44` (07 diz "A cota do modelo de visão acabou…"), `:48-49` e
  `:82/:85` (11 e 12 sem "(2 textos)", C059 e ⌘Z), `:71` ("Error in…"), `:74`
  (03 com "pode congelar") e `:87`/`:93-101` (Windows e motivos da ponte
  antigos). A captura e o código atual são a fonte de verdade; usei o texto
  atual, não o do inventário.
- **Todos os 19 estados** saíram com `seguro: true` e `intrusas: []`; o
  `capturas.json` traz `falhas: []`.

## 5. Achados da rodada 5

Status de cada achado de `docs/design-loop/nota-rodada-5-xournal.md`, com a
prova nova.

| # | Achado da rodada 5 | Status | Prova na rodada 6 |
| ---: |---|---|---|---|
| 1 | **04**: até 20 s sem diálogo, barra ou cursor de progresso; o aviso do **03** já fechou (grave; decisão D1) | **ABERTO** (decisão do autor D1; sem mudança) | O **03** mantém "vai parar de responder por até 20 segundos; não feche a janela." (`main.lua:222`); o **04** continua só com a janela do Xournal++ em 800×650 (JSON), 700 ms depois do **Continuar** (`desk/tests/capture-ciclo2-xournal.mjs:272-277`); o host responde em 4.000 ms e o `curl` tem `--max-time 20` (`ponte.lua:347`). |
| 2 | **14/15/16**: sem uma linha com o tamanho novo; só a página maior e a vista | **ABERTO** | O contorno cresce 304×304 → 361×304 → 361×361 px a 100% (+57 px ≈ 2,01 cm), mas a barra de status só diz "Página 9 de 9" e "100%"; `main.lua:23-36`. |
| 3 | **06**: "A conversão precisa da Mesa aberta e de “Ler a escrita à mão” ligado em Cadernos." (concordância) | **RESOLVIDO** | **06** agora diz "…da opção “Ler a escrita à mão” ligada em Cadernos." (`main.lua:108`). |
| 4 | **08**: "A Mesa respondeu de um jeito que não entendi. Tente de novo." (primeira pessoa e vaga) | **RESOLVIDO** | **08** agora diz "A resposta da Mesa veio em um formato inesperado. Tente de novo." (`main.lua:169`). |
| 5 | **07**: "Sem cota no modelo com visão. Escolha outro modelo com visão na Mesa…" (repetição) | **RESOLVIDO** | **07** agora diz "Sem cota no modelo atual. Escolha outro modelo com visão na Mesa ou tente mais tarde." (`ponte.lua:403`). |
| — | Nota de captura do **12** (faixa preta, fantasmas "y"/"For" e barra de título solta) | **ABERTO** (não é achado de interface) | O **12** da rodada 6 repete o artefato; o script ainda tira o `snapshot(main)` com o aviso aberto (`desk/tests/capture-ciclo2-xournal.mjs:328`). O texto e o **12b** estão legíveis; não pontuei. |

**Resumo:** 3 resolvidos (achados 3, 4 e 5), 2 abertos (achados 1 e 2; o 1 é a
decisão D1) e a nota de captura do **12** segue aberta.

## 6. Decisões do autor

- **D1 — Converter síncrono, de um toque (decisão do autor).** É o que limita a
  célula de Feedback do Converter a 6,5. O **03** avisa que a janela para de
  responder e pede para não fechá-la; o **04** segue congelado. Se D1 virar
  **B** (dois toques) ou **C** (segundo plano), a célula sobe para ~9,0 e o
  Overall do Converter para ~8,8. O limite da API (sem barra de progresso, sem
  diálogo não modal) não foi descontado.
- **D2 (Cadernos a três cliques) e D3 (capas) não afetam esta nota:** são da
  parte Cadernos, não do plugin.
- **D4 ("Tentar de novo" no erro do chat) não afeta esta nota:** é do chat
  solto, não do plugin.
- O aviso "Os textos já estão em Sans." e o rótulo "Sans (atual)" não são uma
  decisão pendente; são o conserto aplicado do achado 3 da rodada 4.
