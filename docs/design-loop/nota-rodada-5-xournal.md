# Nota da rodada 5 — Xournal++ (MesaPagina)

Recorte: os quatro itens do plugin **MesaPagina** (#133, #159) no Xournal++ 1.3.8,
com as capturas novas de `docs/design-loop/rodada-5/antes/xournal/` (PNG + JSON
homônimo), o inventário `docs/design-loop/inventario-xournal.md`, o Lua do plugin
em `desk/src/xournal-plugins/MesaPagina/` e os textos da Mesa em
`desk/src/locales/pt-BR.json` / `en.json`. As capturas **17** e **18** (montagem)
ficam **fora** desta nota: têm avaliador próprio. Não implementei nem corrigi
nada; a nota é independente das rodadas anteriores e os status da seção 5 são
uma reconferência.

**Estado congelado.** As capturas foram geradas em 2026-11-10T00:33Z, depois do
commit `117fd506` ("conta os textos da página e marca a fonte atual no Trocar
fonte"), que é o conserto dos achados 2 e 3 da rodada 4. A pasta tem 19 PNG + 19
JSON de estado + `capturas.json`; todos os 19 estados saíram com `seguro: true`,
`intrusas: []` e `falhas: []`.

## 1. Notas

| Categoria | Converter (Ctrl+Shift+K) | Trocar fonte (Ctrl+Shift+J) | Aumentar página (#133) | Geral |
|---|---:|---:|---:|---:|
| Clarity | 9,0 | 9,0 | 9,0 | 9,0 |
| Feedback e movimento | 6,5 | 9,0 | 8,5 | 8,0 |
| Estados (vazio/carregando/erro) | 8,0 | 8,0 | 9,0 | 8,3 |
| Consistência & polish | 9,0 | 9,0 | 9,0 | 9,0 |
| **Overall da sub-parte** | **8,1** | **8,8** | **8,9** | **8,6** |
| Tipografia, hierarquia, espaçamento e densidade, cor e contraste, iconografia, acessibilidade e janela pequena (GTK do Xournal++) | fora | fora | fora | fora |

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
  fica. Continuar?"; **06** "A conversão precisa da Mesa aberta e de “Ler a
  escrita à mão” ligado em Cadernos. Abra a Mesa, ligue a leitura da tinta e
  tente de novo."; **07** "Sem cota no modelo com visão. Escolha outro modelo
  com visão na Mesa ou tente mais tarde."; **08** "A Mesa respondeu de um jeito
  que não entendi. Tente de novo."; **09** separa conexão de timeout; **10**
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
  acionáveis; nenhuma frase muda a decisão do aluno); Feedback 6,5; Estados 8,0
  (9 estados capturados, **02–10**; o carregando é o próprio **04**, e os ramos
  sem captura estão na seção 3); Consistência 9,0 (aspas curvas em **03/06**,
  títulos iguais, e "Ler a escrita à mão", "Cadernos", "modelo com visão", "sem
  cota" e "Desfazer" iguais a `pt-BR.json:1721, 1708, 96/1723, 1734 e 2645`; os
  achados 3–5 são detalhes de concordância, tom e repetição).
- **Trocar fonte, 8,8.** O **11** diz alvo, contagem, fonte atual e posição na
  lista: "Todos os textos da página (2 textos). Fonte atual: Sans. Lista de
  fontes: página 1 de 13. Escolha a nova fonte:"; os botões são **Sans (atual),
  C059, Cantarell, D050000L, Mais…, Cancelar** (666×127). O **12** nomeia a
  fonte e o desfazer: "Fonte trocada para C059 em 2 textos. Desfazer (Ctrl+Z ou
  ⌘Z)."; o **12b** mostra os dois textos em C059. O **13** diz o que fazer
  quando não há texto. O **11** agora conta os textos e marca a fonte atual
  (**Sans (atual)**), o que resolve os dois achados da rodada 4; escolher a
  fonte atual fecha com "Os textos já estão em Sans." (`main.lua:435-437`), sem
  recriar nada. Clarity 9,0; Feedback 9,0 (nome, contagem e desfazer dos dois
  sistemas; a falta de amostra e o diálogo modal são limite da API, não
  desconto); Estados 8,0 (**11/12/12b/13**; o alvo por seleção, as fontes
  mistas, a segunda página, a fonte atual escolhida e a falha do `addTexts` não
  têm captura); Consistência 9,0.
- **Aumentar página, 8,9.** O **01** mostra "Página atual +2 cm à direita" e
  "Página atual +2 cm abaixo", com Ctrl+Alt+R/B; os dois dizem alvo, sentido e
  quantidade, sem jargão e sem "…" (agem na hora, ao contrário de Converter e
  Trocar fonte). O **14** (300×300 pt; contorno de 304×304 px a 100%) e o
  **15/16** mostram a página maior: contorno de 361×304 e 361×361 px, +57 px em
  cada eixo (≈2 cm), com a vista acompanhando (`scrollToPos`). Clarity 9,0;
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
`docs/design-loop/rodada-5/antes/xournal/NN-*.png`; os valores medidos saem dos
JSON de estado (geometria), do texto exato da captura e do contorno da página
em px a 100% de zoom.

| # | Categoria | Severidade | Captura | Valor medido / texto exato | Sugestão em uma linha | Arquivo provável |
| ---: |---|---|---|---|---|---|---|
| 1 | Feedback e movimento | grave (decisão do autor D1; limite da API) | `04-converter-convertendo.png` | 700 ms depois de **Continuar**: nenhum diálogo, barra ou cursor de progresso; o JSON do 04 lista só a janela do Xournal++ em 800×650. O host dorme 4.000 ms e o `curl` tem `--max-time 20`. O aviso de **03** já fechou. | D1: em **A**, o **03** agora diz que a janela para de responder e não deve ser fechada; em **B/C**, dar o segundo toque ou o segundo plano. Não é regressão desta rodada. | `main.lua:154-159, 222`; `ponte.lua:347`; `docs/design-loop/decisoes.md` D1 |
| 2 | Feedback e movimento | baixa | `14-pagina-antes.png`, `15-pagina-direita.png`, `16-pagina-abaixo.png` | O contorno da página passa de 304×304 px (**14**) para 361×304 (**15**) e 361×361 (**16**) a 100% de zoom (+57 px ≈ 2 cm); a barra de status só mostra "Página 9 de 9" e "100%". Não há linha, aviso ou texto com o tamanho novo. | Mostrar o tamanho novo numa linha de status, se a API 1.3.8 expuser; senão, registrar como limite. | `main.lua:23-36` |
| 3 | Consistência & polish | baixa | `06-converter-ponte-desligada.png` | "A conversão precisa da Mesa aberta e de “Ler a escrita à mão” ligado em Cadernos." — "ligado" não tem núcleo com que concordar; a etiqueta citada é "Ler a escrita à mão" (feminino "a escrita"/"a leitura"). | Nomear o núcleo: "…da opção “Ler a escrita à mão” ligada em Cadernos." | `main.lua:108` |
| 4 | Consistência & polish | baixa | `08-converter-resposta-invalida.png` | "A Mesa respondeu de um jeito que não entendi. Tente de novo." — primeira pessoa e vaga, ao lado dos erros impessoais "Não deu para falar com a Mesa" (**09**) e "A conversão demorou demais" (**10**); só manda repetir, sem dizer o que houve. | Trocar por "A resposta da Mesa veio em um formato inesperado. Tente de novo." | `main.lua:169` |
| 5 | Consistência & polish | baixa | `07-converter-erro-quota.png` | "Sem cota no modelo com visão. Escolha outro modelo com visão na Mesa ou tente mais tarde." — "modelo com visão" aparece duas vezes na mesma mensagem. | Dizer "Sem cota no modelo atual." e manter a saída com "modelo com visão". | `ponte.lua:403` |

**Nota de captura (não é achado de interface).** O **12** ainda tem a faixa preta
de x≈650 a 800, os fragmentos-fantasma "y" e "For" e a barra de título solta
acima do aviso. É o mesmo artefato de composição da rodada 4: o
`snapshot(main)` é tirado com o aviso de sucesso aberto
(`desk/tests/capture-ciclo2-xournal.mjs:328`). O texto "Fonte trocada para C059
em 2 textos. Desfazer (Ctrl+Z ou ⌘Z)." está legível e o **12b** prova a fonte
aplicada; não é defeito da interface e não entrou na nota. Para a próxima
captura, usar a janela principal limpa, como já se faz no **12b**.

## 3. SEM CAPTURA

Estados do inventário (e estados do código que o inventário não lista) sem
imagem nesta rodada. As notas de **Estados** consideram só os estados com
captura; os estados desta lista ficam **sem nota** na categoria correspondente.
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
| "Os textos já estão em Sans." (fonte atual escolhida) | Trocar fonte | `main.lua:435-437` | **SEM CAPTURA**; estado novo de `117fd506` |
| Gerenciador de Plugins e metadados do `plugin.ini` (autor, descrição, versão 1.1.0) | — | UI do Xournal++; `plugin.ini:3-7` | **SEM CAPTURA**; o **01** mostra só o item de menu que leva a ele |
| Cancelar da confirmação e Cancelar da fonte | Converter / Trocar fonte | `main.lua:225-230, 459` | **SEM CAPTURA** (mesmos diálogos de **03** e **11**, sem tela nova; o caminho não altera nada) |
| Interface em inglês (Mesa em `en`; plugin em pt-BR fixo) | — | `main.lua`/`ponte.lua`; `locales/en.json`; `README.md:115` | **SEM CAPTURA**; o plugin não tem catálogo `en`, só o pt-BR; não pontuei a paridade de idioma |

## 4. Vi as imagens?

**Sim.** Abri os PNG **01–16** e **12b** da rodada 5 (17 arquivos); **não abri
17 e 18** (montagem, fora desta nota). Para comparar o artefato do **12**, abri
também `rodada-4/antes/xournal/12-trocar-fonte-sucesso.png` e
`rodada-4/depois/xournal/12-trocar-fonte-sucesso.png` (2 arquivos); total 19
PNG. Li os 19 JSON de estado e o `capturas.json`, o inventário, o Lua do plugin
(`main.lua`, `ponte.lua`, `converter.lua`, `tamanho.lua`), o `README.md` do
plugin, os testes Lua (trechos de mensagens), `desk/src/locales/pt-BR.json` /
`en.json` e o script de captura.

Três notas de evidência:

- **JSON do Xournal++ não tem medidas de acessibilidade.** Os 19 JSON de estado
  do xournal registram só recorte, janelas, papéis e geometria; não trazem
  contraste WCAG, fonte, alvos, foco nem rótulos acessíveis medidos (isso é do
  formato das capturas Electron, não do X11). As categorias correspondentes são
  do GTK e ficaram **fora**; as medidas usadas nesta nota são a geometria, o
  texto exato e o contorno da página em px a 100%.
- **Inventário desatualizado.** `inventario-xournal.md:48` ainda diz "Todos os
  textos da página. Fonte atual: Sans. Lista de fontes: 1 de 13." (o **11** já
  diz "(2 textos)" e "página 1 de 13"); `:49` diz "Fonte trocada em 2 textos.
  Ctrl+Z desfaz." (o **12** diz "Fonte trocada para C059 em 2 textos. Desfazer
  (Ctrl+Z ou ⌘Z)."); `:78` traz o texto antigo da quota; `:87`, o texto antigo
  do Windows; e `:93-101`, os textos antigos dos motivos da ponte (`disabled`,
  `no-model`, `no-vision`, `free`, `busy`, `too-large`, `bad-request`,
  `forbidden`, desconhecido). A captura e `ponte.lua:400-416` são a fonte de
  verdade; usei o texto atual do código, não o do inventário.
- **Todos os 19 estados** saíram com `seguro: true`, `intrusas: []` e
  `falhas: []` no `capturas.json`.

## 5. Achados da rodada 4

Status de cada achado de `docs/design-loop/nota-rodada-4-xournal.md`, com a
prova nova.

| # | Achado da rodada 4 | Status | Prova na rodada 5 |
| ---: |---|---|---|---|
| 1 | **04**: até 20 s sem diálogo, barra ou cursor de progresso; o aviso do **03** já fechou (grave; decisão D1) | **ABERTO** (decisão do autor D1; sem mudança) | O **03** mantém "vai parar de responder por até 20 segundos; não feche a janela." (`main.lua:222`); o **04** continua só com a janela do Xournal++ em 800×650 (JSON), 700 ms depois do **Continuar**; o host responde em 4.000 ms e o `curl` tem `--max-time 20` (`ponte.lua:347`). |
| 2 | **11**: "Todos os textos da página." não contava quantos textos seriam trocados | **RESOLVIDO** | **11**: "Todos os textos da página (2 textos)." (`main.lua:316`); a página 7 tem 2 textos visíveis. |
| 3 | **11**: "Fonte atual: Sans." e o **1º de 6 botões** era "Sans", sem marcar que era a atual | **RESOLVIDO** | **11**: "Sans (atual)" (`converter.lua:266-268`); escolher a atual fecha com "Os textos já estão em Sans." (`main.lua:435-437`); o teste `mesa-main.test.lua:513` cobre. O estado novo está **SEM CAPTURA**. |
| 4 | **14, 15, 16**: sem uma linha com o tamanho novo; só a página maior e a vista | **ABERTO** | **14–16**: o contorno da página cresce 304×304 → 361×304 → 361×361 px a 100% (+57 px ≈ 2 cm), mas não há texto com o tamanho; a barra de status só diz "Página 9 de 9" e "100%"; `main.lua:23-36`. |
| — | Nota de captura do **12** (faixa preta, fantasmas "y"/"For" e barra de título solta) | **ABERTO** (não é achado de interface) | O **12** da rodada 5 repete o artefato; o script ainda tira o `snapshot(main)` com o aviso aberto (`desk/tests/capture-ciclo2-xournal.mjs:328`). O texto e o **12b** estão legíveis; não pontuei. |

**Resumo:** 2 resolvidos (achados 2 e 3), 2 abertos (achados 1 e 4; o 1 é a
decisão D1) e a nota de captura do **12** segue aberta.

## 6. Decisões do autor

- **D1 — Converter síncrono, de um toque (decisão do autor).** É o que limita a
  célula de Feedback do Converter a 6,5. O **03** avisa que a janela para de
  responder e pede para não fechá-la; o **04** segue congelado. Se D1 virar
  **B** (dois toques) ou **C** (segundo plano), a célula sobe para ~9,0. O
  limite da API (sem barra de progresso, sem diálogo não modal) não foi
  descontado.
- **D2 (Cadernos a três cliques) e D3 (capas) não afetam esta nota:** são da
  parte Cadernos, não do plugin.
- **D4 ("Tentar de novo" no erro do chat) não afeta esta nota:** é do chat
  solto, não do plugin.
- O aviso "Os textos já estão em Sans." e o rótulo "Sans (atual)" não são uma
  decisão pendente; são o conserto aplicado do achado 3 da rodada 4.
