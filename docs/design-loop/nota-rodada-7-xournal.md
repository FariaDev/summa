# Nota da rodada 7 — Xournal++ (MesaPagina)

Recorte: os quatro itens do plugin **MesaPagina** (#133, #159) no Xournal++ 1.3.8,
com as capturas novas de `docs/design-loop/rodada-6/antes/xournal/` (PNG + JSON
homônimo), o inventário `docs/design-loop/inventario-xournal.md`, o Lua do plugin
em `desk/src/xournal-plugins/MesaPagina/` e os textos da Mesa em
`desk/src/locales/pt-BR.json` / `en.json`. As capturas **17** e **18** (montagem)
ficam **fora** desta nota: têm avaliador próprio. Não implementei nem corrigi
nada; a nota é independente das rodadas anteriores e os status da seção 5 são
uma reconferência.

**Estado congelado.** As capturas foram geradas em 2026-11-10T02:51:28Z (o
`geradoEm` do `capturas.json`) e entraram no commit `38ff8770` ("capturas dos
estados do MesaPagina que faltavam"), que acrescentou os 14 estados novos
(19–28 e 30–33) e regravou os 19 anteriores, com o 12 limpo. A pasta tem 33 PNG,
33 JSON de estado e o `capturas.json`; todos os 33 estados saíram com
`seguro: true`, `intrusas: []` e o `capturas.json` traz `falhas: []`.

## 1. Notas

| Categoria | Converter (Ctrl+Shift+K) | Trocar fonte (Ctrl+Shift+J) | Aumentar página (#133) | Geral |
|---|---:|---:|---:|---:|
| Clarity | 8,5 | 8,5 | 9,0 | 8,7 |
| Feedback e movimento | 6,5 | 9,0 | 8,5 | 8,0 |
| Estados (vazio/carregando/erro) | 8,5 | 9,0 | 9,0 | 8,8 |
| Consistência & polish | 9,0 | 8,5 | 9,0 | 8,8 |
| **Overall da sub-parte** | **8,1** | **8,8** | **8,9** | **8,6** |
| Tipografia, hierarquia, espaçamento e densidade, cor e contraste, iconografia, acessibilidade e janela pequena (GTK do Xournal++) | fora | fora | fora | fora |

O Overall de cada sub-parte é a média das 4 categorias; a coluna Geral é a média
das três sub-partes em cada categoria; o Overall geral é a média das 12 células
= **8,6** (32,5 + 35,0 + 35,5 = 103,0; 103,0 / 12 = 8,58). Tipografia,
hierarquia, espaçamento e densidade, cor e contraste, iconografia,
acessibilidade e janela pequena são do GTK/Xournal++ e ficam **fora** nas três
sub-partes.

### Por que as notas

- **Converter, 8,1.** O fluxo de erro agora está inteiro e o vocabulário fecha:
  **02** "Selecione um trecho de tinta para converter em texto."; **03** "A Mesa
  vai ler a tinta agora. O Xournal++ vai parar de responder por até 20 segundos;
  não feche a janela. O texto entra numa camada nova (“Texto convertido”); a
  tinta original fica. Continuar?"; **06** "A conversão precisa da Mesa aberta e
  da opção “Ler a escrita à mão” ligada em Cadernos. Abra a Mesa, ligue a leitura
  da tinta e tente de novo."; **07** "Sem cota no modelo atual. Escolha outro
  modelo com visão na Mesa ou tente mais tarde."; **08** "A resposta da Mesa veio
  em um formato inesperado. Tente de novo."; **09** separa conexão de timeout;
  **10** "A conversão demorou demais. Tente de novo. Se o trecho for grande,
  selecione menos tinta."; **19–27** dão um texto próprio por motivo da ponte
  (`no-model`, `no-vision`, `free`, `disabled`, `busy`, `too-large`,
  `bad-request`, `forbidden`, desconhecido); **28** cobre a resposta vazia. O
  **05** mostra a camada "Texto convertido" e o texto acima da tinta. O que
  segura a sub-parte é o **04**: 700 ms depois de **Continuar**, só a janela do
  Xournal++ congelada, sem diálogo ou indicador; o host responde em 4.000 ms e o
  `--max-time` é 20 s. É a **decisão do autor D1** (síncrono, um toque), o aviso
  do **03** cobre o congelamento e o limite da API (sem barra de progresso) não é
  descontado. Como o usuário sente a janela parada, Feedback fica em 6,5; se D1
  virar B/C, sobe para ~9,0. Clarity 8,5 (textos exatos, mas os achados 5 e 6
  são repetição e falta de próximo passo em dois estados novos); Feedback 6,5;
  Estados 8,5 (19 estados capturados, **02–10** e **19–28**; os 4 textos de erro
  sem captura estão na seção 3); Consistência 9,0 (aspas curvas em **03/06/22**,
  títulos iguais, e "Ler a escrita à mão", "Cadernos", "modelo com visão", "sem
  cota" e "Desfazer" iguais a `pt-BR.json:1721, 1708, 96/1723, 1734 e 2645`).
- **Trocar fonte, 8,8.** O **11** diz alvo, contagem, fonte atual e posição na
  lista: "Todos os textos da página (2 textos). Fonte atual: Sans. Lista de
  fontes: página 1 de 13. Escolha a nova fonte:"; os botões são **Sans (atual),
  C059, Cantarell, D050000L, Mais…, Cancelar** (666×127; JSON). O **30** mostra o
  alvo por seleção ("2 textos selecionados. Fonte atual: C059." + **C059
  (atual)**); o **31** cobre fontes mistas ("Fontes atuais: C059, Sans."); o
  **32** mostra a segunda página ("Lista de fontes: página 2 de 13." + **Voltar**
  e **Mais…**); o **33** fecha a fonte atual escolhida ("Os textos já estão em
  C059."); o **12** nomeia a fonte e o desfazer ("Fonte trocada para C059 em 2
  textos. Desfazer (Ctrl+Z ou ⌘Z).") e o **12b** prova a página com os textos
  recriados em C059; o **13** diz o que fazer quando não há texto. Clarity 8,5
  pelo **achado 3** (rótulos truncados que ficam ambíguos na página 2); Feedback
  9,0 (nome, contagem e desfazer dos dois sistemas; a falta de amostra e o
  diálogo modal são limite da API, não desconto); Estados 9,0 (**11/12/12b/13** e
  **30–33**; só a falha do `addTexts` e o Cancelar ficam sem captura); Consistência
  8,5 pelo **achado 4** (o diálogo da página 2 passa dos 800 px que o próprio
  código promete).
- **Aumentar página, 8,9.** O **01** mostra "Página atual +2 cm à direita" e
  "Página atual +2 cm abaixo", com Ctrl+Alt+R/B; os dois dizem alvo, sentido e
  quantidade, sem jargão e sem "…" (agem na hora, ao contrário de Converter e
  Trocar fonte). O **14** (300×300 pt; contorno medido de 304×304 px a 100%) e o
  **15/16** mostram a página maior: contorno de 361×304 e 361×361 px, +57 px em
  cada eixo (≈2,01 cm), com a vista acompanhando (`scrollToPos`). Clarity 9,0;
  Feedback 8,5 pelo **achado 2** (não há linha com o tamanho novo; o retorno é a
  página maior e a vista); Estados 9,0 (**14/15/16**, sem caminho de erro
  aplicável); Consistência 9,0 (mesma estrutura nos dois itens, sem mistura de
  idioma, e o resultado no documento).

**Limites da API 1.3.8 registrados, não descontados:** sem barra de progresso,
sem amostra de fonte, sem seletor de lista e sem diálogo não modal. A lista de
fontes em páginas de 4 (13 páginas no ambiente, uma página por toque em
"Mais…") e o aviso de sucesso em diálogo com **OK** são consequência do
`openDialog` de botões; o que entra na nota é o que o plugin escolheu dentro
disso (por exemplo, a decisão D1 e o limite de 12 caracteres do rótulo).

## 2. Achados

As capturas da coluna "Captura" são
`docs/design-loop/rodada-6/antes/xournal/NN-*.png`; os valores medidos saem dos
JSON de estado (geometria), do texto exato da captura e do contorno da página em
px a 100% de zoom (medido no PNG desta rodada).

| # | Categoria | Severidade | Captura | Valor medido / texto exato | Sugestão em uma linha | Arquivo provável |
| ---: |---|---|---|---|---|---|---|
| 1 | Feedback e movimento | grave (decisão do autor D1; limite da API) | `04-converter-convertendo.png` | 700 ms depois de **Continuar**: nenhum diálogo, barra ou cursor de progresso; o JSON do 04 lista só a janela do Xournal++ em 800×650. O host responde em 4.000 ms e o `curl` tem `--max-time 20`; o aviso de **03** já fechou. | D1: em **A**, o **03** já avisa que a janela para e pede para não fechá-la; em **B/C**, dar o segundo toque ou o segundo plano. Não é regressão desta rodada. | `main.lua:222`; `ponte.lua:347`; `docs/design-loop/decisoes.md` D1 |
| 2 | Feedback e movimento | baixa | `14-pagina-antes.png`, `15-pagina-direita.png`, `16-pagina-abaixo.png` | O contorno da página passa de 304×304 px (**14**) para 361×304 (**15**) e 361×361 (**16**) a 100% de zoom (+57 px ≈ 2,01 cm); a barra de status mostra "Página 9 de 10", "Camada 1" e "100%", e não há linha, aviso ou texto com o tamanho novo. | Mostrar o tamanho novo numa linha de status, se a API 1.3.8 expuser; senão, registrar como limite. | `main.lua:23-36` |
| 3 | Clarity | média | `32-trocar-fonte-segunda-pagina.png` | Na mesma página de fontes aparecem **DejaVu Sans** e **DejaVu Sans…** lado a lado; o `rotuloCurto` corta em 12 caracteres e esconde o sufixo que distingue as famílias (o segundo rótulo cortado perde justamente a parte final do nome). O mesmo corte aparece em **DejaVu Math…**. | Cortar preservando o fim (o sufixo da família) ou reduzir para 3 famílias quando houver "Voltar", para o rótulo caber inteiro. | `converter.lua:222` (`rotuloCurto`), `converter.lua:265` |
| 4 | Consistência & polish | baixa | `32-trocar-fonte-segunda-pagina.png` | O diálogo da página 2 mede **903×127 px** (JSON, `dialogo 903×127 em (5, 346)`) contra a janela principal de **800×650**; o recorte teve de crescer para 903×650. São 7 botões (4 famílias + **Mais…** + **Voltar** + **Cancelar**), e o comentário do próprio código diz "para o diálogo caber em 800 px". | Reduzir para 3 famílias por página quando houver **Voltar** (ou esconder **Mais…** na última página), para o diálogo não passar da janela. | `main.lua:367-383` (`mostraPaginaFonte`) |
| 5 | Clarity | baixa | `19-converter-erro-no-model.png` | "Nenhum modelo com visão disponível. Configure um modelo com visão na Mesa." repete "modelo com visão" em duas frases seguidas. | "Nenhum modelo com visão disponível. Configure um na Mesa." | `ponte.lua:404` |
| 6 | Clarity | baixa | `28-converter-resposta-vazia.png` | "A Mesa não leu nenhum texto da tinta." é o único erro do Converter que não diz o próximo passo; os outros 16 terminam com uma ação ("Tente de novo", "Selecione…", "Abra a Mesa…"). | Acrescentar "Tente de novo com uma seleção mais nítida." | `main.lua:178` |

**Nota de captura (não é achado de interface).** O **12** da rodada 7 está limpo:
sem a faixa preta, sem os fantasmas "y"/"For" e sem a barra de título solta da
rodada 6. O script agora captura o aviso vivo e compõe a janela principal limpa
por baixo (`captureNotice`, `desk/tests/capture-ciclo2-xournal.mjs:76-94`), e o
**12b** continua provando a fonte aplicada.

## 3. SEM CAPTURA

Estados do inventário (e estados do código que o inventário lista em "O que não
foi capturado") sem imagem nesta rodada. As notas de **Estados** consideram só
os estados com captura; cada estado desta lista fica **sem nota** na categoria
correspondente. Os estados **17** e **18** têm captura, mas ficam fora desta
nota (montagem, avaliador próprio).

| Estado / texto | Sub-parte | Origem | Status |
|---|---|---|---|
| Windows: "A conversão ainda não funciona no Windows; por enquanto, use a Mesa no Linux ou no macOS." | Converter | `main.lua:196` | **SEM CAPTURA** |
| "Nenhum traço desenhável na seleção. Selecione a tinta a converter." | Converter | `main.lua:213` | **SEM CAPTURA** |
| "Não consegui preparar a conversão." (duas saídas: header e corpo) | Converter | `main.lua:131, 142` | **SEM CAPTURA** |
| "Não consegui preparar a conversão (`<motivo>`)." | Converter | `main.lua:151` | **SEM CAPTURA** |
| "Não consegui criar os textos com a fonte nova. Os textos antigos ficaram como estavam." | Trocar fonte | `main.lua:343` | **SEM CAPTURA** |
| Cancelar da confirmação e Cancelar da fonte | Converter / Trocar fonte | `main.lua:225-230, 459` | **SEM CAPTURA** (mesmos diálogos de **03** e **11/30–32**, sem tela nova; o caminho não altera nada) |
| Gerenciador de Plugins e metadados do `plugin.ini` (autor, descrição, versão 1.1.0) | — | UI do Xournal++; `plugin.ini:3-7` | **SEM CAPTURA**; o **01** mostra só o item de menu que leva a ele |
| Interface em inglês (Mesa em `en`; plugin em pt-BR fixo) | — | `main.lua`/`ponte.lua` (textos fixos); `locales/en.json` | **SEM CAPTURA**; o plugin não tem catálogo `en`, só o pt-BR; não pontuei a paridade de idioma |

Os 10 estados que a rodada 6 listava como **SEM CAPTURA** em Converter
(`disabled`, `no-model`, `no-vision`, `free`, `busy`, `too-large`,
`bad-request`, `forbidden`, motivo desconhecido e resposta vazia) e os 4 do
Trocar fonte (alvo por seleção, fontes mistas, segunda página e fonte atual
escolhida) agora têm captura (**19–28** e **30–33**).

## 4. Vi as imagens?

**Sim.** Abri 31 PNG desta rodada — **01, 02, 03, 04, 05, 06, 07, 08, 09, 10,
11, 12, 12b, 13, 14, 15, 16, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31,
32 e 33** —, 31 em vez dos 30 do limite: o **09** entrou por último, só para
conferir o texto de conexão (o limite era 30 e eu o ultrapassei em um; não abri
**17** e **18**). Li os 33 JSON de estado de uma vez por script (geometria,
janelas, `seguro` e `intrusas`), o `capturas.json`, o inventário, a nota da
rodada 6, o Lua do plugin (`main.lua`, `ponte.lua`, `converter.lua`,
`tamanho.lua`), os locales `pt-BR.json`/`en.json`, o script de captura e o
histórico dos commits `38ff8770` e `814b741f`.

Três notas de evidência:

- **JSON do Xournal++ não tem medidas de acessibilidade.** Os 33 JSON de estado
  do xournal registram só recorte, janelas, papéis e geometria; não trazem
  contraste WCAG, fonte, alvos, foco nem rótulos acessíveis medidos (isso é do
  formato das capturas Electron, não do X11). As categorias correspondentes são
  do GTK e ficaram **fora**; as medidas usadas nesta nota são a geometria dos
  JSON, o texto exato das capturas e o contorno da página em px a 100% (medido
  no PNG: 304×304 → 361×304 → 361×361).
- **O diálogo do 32 é mais largo que a janela.** O JSON do 32 registra
  `recorte 903×650` e `dialogo 903×127 em (5, 346)`, contra a janela principal
  `800×650 em (5, 56)`; é a base do achado 4, não um erro de captura.
- **Todos os 33 estados** saíram com `seguro: true`, `intrusas: []` e o
  `capturas.json` traz `falhas: []`.

## 5. Achados da rodada 6

Status de cada achado de `docs/design-loop/nota-rodada-6-xournal.md`, com a
prova nova.

| # | Achado da rodada 6 | Status | Prova na rodada 7 |
| ---: |---|---|---|---|
| 1 | **04**: até 20 s sem diálogo, barra ou cursor de progresso; o aviso do **03** já fechou (grave; decisão D1) | **ABERTO** (decisão do autor D1; sem mudança) | O **03** mantém "vai parar de responder por até 20 segundos; não feche a janela." (`main.lua:222`); o **04** novo continua só com a janela do Xournal++ em 800×650 (JSON), capturado 700 ms depois do **Continuar** (`desk/tests/capture-ciclo2-xournal.mjs:96-102`); o host responde em 4.000 ms e o `curl` tem `--max-time 20` (`ponte.lua:347`). |
| 2 | **14/15/16**: sem uma linha com o tamanho novo; só a página maior e a vista | **ABERTO** | O contorno medido nos PNG novos cresce 304×304 → 361×304 → 361×361 px a 100% (+57 px ≈ 2,01 cm), mas a barra de status só diz "Página 9 de 10", "Camada 1" e "100%"; `main.lua:23-36`. |
| — | Nota de captura do **12** (faixa preta, fantasmas "y"/"For" e barra de título solta) | **RESOLVIDO** (não era achado de interface) | O **12** novo está limpo, com o aviso legível sobre a página e sem a faixa preta; o script passou a usar `captureNotice` (`desk/tests/capture-ciclo2-xournal.mjs:76-94`) e o **12b** prova a fonte aplicada. |

**Resumo:** 1 resolvido (a nota de captura do **12**), 2 abertos (achados 1 e 2;
o 1 é a decisão D1) e 14 estados que estavam **SEM CAPTURA** na rodada 6 agora
estão cobertos (seção 3).

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
