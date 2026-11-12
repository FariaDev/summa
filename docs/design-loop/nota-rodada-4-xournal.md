# Nota da rodada 4 — Xournal++ (MesaPagina)

Recorte: os quatro itens do plugin **MesaPagina** (#133, #159) no Xournal++ 1.3.8,
com as capturas novas de `docs/design-loop/rodada-4/antes/xournal/` (PNG + JSON
homônimo), o inventário `docs/design-loop/inventario-xournal.md`, o Lua do plugin
em `desk/src/xournal-plugins/MesaPagina/` e `desk/src/locales/pt-BR.json`. As
capturas **17** e **18** (montagem) ficam **fora** desta nota: têm avaliador
próprio. Não implementei nem corrigi nada; a nota é independente das rodadas
anteriores e os status da seção 5 são uma reconferência.

**Estado congelado.** As capturas "antes" desta rodada já incluem o commit
`9d46deb3` ("avisos do MesaPagina mais precisos"), que corrigiu os achados 2, 3,
4, 6 e 7 da rodada 3. A pasta tem 19 PNG + 19 JSON de estado + `capturas.json`;
todos os estados saíram com `seguro: true`, `intrusas: []` e `falhas: []`.

## 1. Notas

| Categoria | Converter (Ctrl+Shift+K) | Trocar fonte (Ctrl+Shift+J) | Aumentar página (#133) | Geral |
|---|---:|---:|---:|---:|
| Clarity | 9,0 | 8,5 | 9,0 | 8,8 |
| Feedback e movimento | 6,5 | 9,0 | 8,5 | 8,0 |
| Estados (vazio/carregando/erro) | 8,0 | 8,0 | 8,5 | 8,2 |
| Consistência & polish | 9,0 | 8,5 | 9,0 | 8,8 |
| **Overall da sub-parte** | **8,1** | **8,5** | **8,8** | **8,5** |
| Tipografia, layout, ícones e cor (GTK do Xournal++) | fora | fora | fora | fora |

O Overall de cada sub-parte é a média das 4 categorias; a coluna Geral é a
média das três sub-partes em cada categoria; o Overall geral é a média das 12
células = **8,5**. Tipografia, hierarquia, espaçamento e densidade, cor e
contraste, iconografia, acessibilidade e janela pequena são do GTK/Xournal++ e
ficam **fora** nas três sub-partes.

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
  acionáveis; só o detalhe de concordância de "ligado" com a frase citada);
  Feedback 6,5; Estados 8,0 (o carregando é o próprio **04**, e os motivos da
  ponte além de quota/timeout e as falhas internas não têm captura);
  Consistência 9,0 (aspas curvas em **03/06**, e "Ler a escrita à mão",
  "Cadernos", "modelo com visão" e "sem cota" iguais a `pt-BR.json:1720, 1708,
  96 e 1733`; "Desfazer" como `pt-BR.json:2644`).
- **Trocar fonte, 8,5.** O **11** diz alvo, fonte atual e posição na lista:
  "Todos os textos da página. Fonte atual: Sans. Lista de fontes: página 1 de
  13. Escolha a nova fonte:"; os botões são **Sans, C059, Cantarell, D050000L,
  Mais…, Cancelar** (588×127). O **12** nomeia a fonte e o desfazer: "Fonte
  trocada para C059 em 2 textos. Desfazer (Ctrl+Z ou ⌘Z)."; o **12b** mostra os
  dois textos em C059. O **13** diz o que fazer quando não há texto. Clarity
  8,5 pelo **achado 2** (o alvo de página não conta quantos textos serão
  trocados; o de seleção conta); Feedback 9,0 (nome, contagem e desfazer dos
  dois sistemas; a falta de amostra e o diálogo modal são limite da API, não
  desconto); Estados 8,0 (**11/12/12b/13**; a segunda página do "Mais…", as
  fontes mistas, a seleção e a falha do `addTexts` não têm captura);
  Consistência 8,5 pelo **achado 3** (a fonte atual "Sans" também é oferecida
  como botão).
- **Aumentar página, 8,8.** O **01** mostra "Página atual +2 cm à direita" e
  "Página atual +2 cm abaixo", com Ctrl+Alt+R/B; os dois dizem alvo, sentido e
  quantidade, sem jargão e sem "…" (agem na hora, ao contrário de Converter e
  Trocar fonte). O **14** (300×300 pt) e o **15/16** mostram a página maior:
  356,7×300 e 356,7×356,7 pt a 100% de zoom, com a vista acompanhando
  (`scrollToPos`). Clarity 9,0; Feedback 8,5 pelo **achado 4** (não há linha
  com o tamanho novo; o retorno é a página maior e a vista); Estados 8,5
  (**14/15/16**, sem caminho de erro); Consistência 9,0 (mesma estrutura nos
  dois itens, sem mistura de idioma, e o resultado no documento).

**Limites da API 1.3.8 registrados, não descontados:** sem barra de progresso,
sem amostra de fonte, sem diálogo não modal e sem detecção de SO no Lua. A
lista de fontes em páginas de 4 e o aviso de sucesso em diálogo com **OK** são
consequência do `openDialog` de botões. O que entra na nota é o que o plugin
escolheu dentro disso (por exemplo, a decisão D1).

## 2. Achados

As capturas da coluna "Captura" são
`docs/design-loop/rodada-4/antes/xournal/NN-*.png`.

| # | Categoria | Severidade | Captura | Valor medido / texto exato | Sugestão em uma linha | Arquivo provável |
|---:|---|---|---|---|---|---|
| 1 | Feedback e movimento | grave (decisão do autor D1; limite da API) | **04** | 700 ms depois de **Continuar**: nenhum diálogo, barra ou cursor de progresso; o JSON do 04 lista só a janela do Xournal++ em 800×650. O host dorme 4.000 ms e o `curl` tem `--max-time 20`. O aviso de **03** já fechou. | D1: em **A**, o **03** agora diz que a janela para de responder e não deve ser fechada; em **B/C**, dar o segundo toque ou o segundo plano. Não é regressão desta rodada. | `main.lua:154-159, 222`; `ponte.lua:347`; `docs/design-loop/decisoes.md` D1 |
| 2 | Clarity | baixa | **11** | "Todos os textos da página." não conta quantos textos serão trocados; a página 7 tem **2 textos** visíveis atrás do diálogo ("Texto sintético da página" e "Segunda linha"). O mesmo diálogo, no alvo por seleção, usa "1 texto selecionado."/"N textos selecionados." | Contar no alvo de página: "Todos os textos da página (2 textos)." | `main.lua:303-308` |
| 3 | Consistência & polish | baixa | **11** | "Fonte atual: Sans." e o **1º de 6 botões** é "Sans" (linha de 588 px). Escolher Sans recria os textos e o aviso do **12** diria "Fonte trocada para Sans…" sem mudança de família. | Não oferecer a fonte atual quando ela é a única, ou marcar "Sans (atual)". | `converter.lua:243-263`; `main.lua:360-374` |
| 4 | Feedback e movimento | baixa | **14, 15, 16** | A página passa de 300×300 pt (**14**) para 356,7×300 (**15**) e 356,7×356,7 (**16**) a 100% de zoom; não há nenhum texto com o tamanho novo, só a página maior e a vista que acompanha. | Mostrar o tamanho novo numa linha de status, se a API 1.3.8 expuser; senão, registrar como limite. | `main.lua:23-36` |

**Nota de captura (não é achado de interface).** O **12** ainda tem uma faixa
preta de x≈630 a 800, fragmentos-fantasma "y" e "For" e uma barra de título solta
acima do aviso. É o mesmo artefato de composição da rodada 3: o
`snapshot(main)` é tirado com o aviso de sucesso aberto
(`desk/tests/capture-ciclo2-xournal.mjs:328`). O texto "Fonte trocada para C059
em 2 textos. Desfazer (Ctrl+Z ou ⌘Z)." está legível e o **12b** prova a fonte
aplicada; não é defeito da interface e não entrou na nota. Para a próxima
captura, usar a janela principal limpa, como já se faz no **12b**.

## 3. SEM CAPTURA

Estados do inventário (e dois do código que o inventário não lista) sem imagem
nesta rodada. As notas de **Estados** consideram só os estados com captura; os
estados desta lista ficam **sem nota** na categoria correspondente. Os estados
**17** e **18** têm captura, mas ficam fora desta nota (montagem, avaliador
próprio).

| Estado / texto | Origem | Status |
|---|---|---|
| Conversão no Windows: "A conversão ainda não funciona no Windows; por enquanto, use a Mesa no Linux ou no macOS." | `main.lua:196` | **SEM CAPTURA**; o inventário ainda traz o texto antigo "Converter ainda não funciona no Windows." |
| Seleção sem traço desenhável: "Nenhum traço desenhável na seleção. Selecione a tinta a converter." | `main.lua:213` | **SEM CAPTURA** |
| Falha de preparo, header: "Não consegui preparar a conversão." | `main.lua:131` | **SEM CAPTURA** |
| Falha de preparo, corpo: "Não consegui preparar a conversão." | `main.lua:142` | **SEM CAPTURA** |
| Falha de preparo, comando: "Não consegui preparar a conversão (`<motivo>`)." | `main.lua:151` | **SEM CAPTURA** |
| Resposta vazia: "A Mesa não leu nenhum texto da tinta." | `main.lua:178` | **SEM CAPTURA**; o texto não diz o próximo passo (observação, não achado) |
| Falha ao criar textos com a fonte nova: "Não consegui criar os textos com a fonte nova. Os textos antigos ficaram como estavam." | `main.lua:334` | **SEM CAPTURA** |
| `disabled`: "Ligue “Ler a escrita à mão” em Cadernos, na Mesa, para converter." | `ponte.lua:402` | **SEM CAPTURA**; o inventário ainda traz "Ligue a leitura da tinta na Mesa para converter." |
| `no-model`: "Nenhum modelo com visão disponível. Configure um modelo com visão na Mesa." | `ponte.lua:404` | **SEM CAPTURA**; o inventário ainda traz "Nenhum modelo de visão disponível…" |
| `no-vision`: "O modelo atual não lê imagens. Escolha um modelo com visão na Mesa." | `ponte.lua:405` | **SEM CAPTURA**; o inventário ainda traz "…Escolha outro modelo na Mesa." |
| `free`: "O modelo gratuito não lê tinta. Escolha um modelo com visão na Mesa." | `ponte.lua:406` | **SEM CAPTURA**; o inventário ainda traz "…Escolha outro modelo na Mesa." |
| `busy`: "A Mesa ainda está terminando a conversão anterior. Aguarde e tente de novo." | `ponte.lua:407` | **SEM CAPTURA** |
| `too-large`: "O trecho selecionado é grande demais. Selecione um trecho menor." | `ponte.lua:409` | **SEM CAPTURA** |
| `bad-request`: "A Mesa recusou o trecho (formato inválido). Selecione de novo." | `ponte.lua:410` | **SEM CAPTURA** |
| `forbidden`: "A Mesa recusou a chamada. Reabra a Mesa e tente de novo." | `ponte.lua:411` | **SEM CAPTURA** |
| Motivo desconhecido: "Não deu para converter a tinta. Tente de novo." | `ponte.lua:416` | **SEM CAPTURA** |
| Segunda página do diálogo de fonte ("Mais…" → "Voltar") | `main.lua:365-374` | **SEM CAPTURA** |
| Gerenciador de Plugins e metadados do `plugin.ini` (autor, descrição, versão 1.1.0) | UI do Xournal++; `plugin.ini:3-7` | **SEM CAPTURA**; o **01** mostra só o item de menu que leva a ele |
| Cancelar da confirmação e Cancelar da fonte | `main.lua:225-230, 412-437` | **SEM CAPTURA** (mesmos diálogos de **03** e **11**, sem tela nova) |
| "N textos selecionados." (alvo da troca de fonte com seleção) | `main.lua:303-306` | **SEM CAPTURA**; não está no inventário, mas existe no código e no teste |
| "Fontes atuais: …" (página com fontes mistas) | `main.lua:288-296` | **SEM CAPTURA**; o **11** só tem uma fonte (Sans) |

## 4. Vi as imagens?

**Sim.** Abri com o leitor de imagens os PNG **01–16** e **12b**, um a um; **não
abri 17 e 18** (montagem, fora desta nota). Li os 19 JSON de estado e o
`capturas.json`, o inventário, o Lua do plugin (`main.lua`, `ponte.lua`,
`converter.lua`, `tamanho.lua`), `desk/src/locales/pt-BR.json` e os testes.
Todos os estados saíram com `seguro: true` e `intrusas: []`.

Duas notas de evidência:

- **12 com artefato de composição.** A imagem tem faixa preta de x≈630 a 800 e
  fragmentos-fantasma do próprio diálogo ("y", "For", uma barra de título
  solta). O texto do aviso está legível e o **12b** prova a fonte **C059**
  aplicada. Não é defeito da interface; não penalizei a nota (ver seção 2).
- **Inventário desatualizado.** `inventario-xournal.md:78` ainda traz o texto
  antigo da quota ("A cota do modelo de visão acabou…"); a linha 87, o texto
  antigo da Windows; e as linhas 93–101, os textos antigos dos motivos da ponte
  (`disabled`, `no-model`, `no-vision`, `free`, `busy`, `too-large`,
  `bad-request`, `forbidden`, desconhecido). A captura **07** e
  `ponte.lua:400-416` são a fonte de verdade; usei o texto atual do código, não
  o do inventário.

## 5. Achados da rodada 3

Status de cada achado de `docs/design-loop/nota-rodada-3-xournal.md`, com a
prova nova.

| # | Achado da rodada 3 | Status | Prova na rodada 4 |
|---:|---|---|---|
| 1 | **04**: até 20 s sem diálogo, barra ou cursor de progresso; o aviso do **03** já fechou (grave; decisão D1) | **PARCIAL** (decisão do autor D1) | O **03** agora diz "O Xournal++ vai parar de responder por até 20 segundos; não feche a janela." (`main.lua:222`); o **04** continua sem diálogo/indicador — o JSON lista só a janela do Xournal++ em 800×650. O congelamento é a D1, não uma regressão. |
| 2 | **03**: "pode congelar" não diz que a janela para nem que não deve ser fechada | **RESOLVIDO** | **03**: "vai parar de responder por até 20 segundos; não feche a janela." (`main.lua:222`). |
| 3 | **11**: "Lista de fontes: 1 de 13." parece "fonte 1 de 13" | **RESOLVIDO** | **11**: "Lista de fontes: página 1 de 13." (`main.lua:312`). |
| 4 | **12**: o sucesso não diz a fonte escolhida | **RESOLVIDO** | **12**: "Fonte trocada para C059 em 2 textos. Desfazer (Ctrl+Z ou ⌘Z)." (`main.lua:425`); o **12b** mostra C059 aplicada. |
| 5 | **15/16**: sem uma linha com o tamanho novo; só a página maior e a vista | **ABERTO** | **14–16**: a página cresce (300×300 → 356,7×356,7 pt), mas não há texto com o tamanho; `main.lua:23-36`. |
| 6 | **12**: "Ctrl+Z desfaz." fixa o atalho de Linux/Windows | **RESOLVIDO** | **12**: "Desfazer (Ctrl+Z ou ⌘Z)." (`main.lua:422-425`). |
| 7 | **03/06**: aspas retas em "Texto convertido" e "Ler a escrita à mão" | **RESOLVIDO** | **03** e **06**: “Texto convertido” e “Ler a escrita à mão” (`main.lua:108, 222`); a mensagem `disabled` também usa aspas curvas (`ponte.lua:402`), mas está **SEM CAPTURA**. |

**Resumo:** 5 resolvidos, 1 parcial (o **04**, por D1) e 1 aberto (o tamanho da
página). O parcial e o aberto já são os achados 1 e 4 desta rodada.

## 6. Decisões do autor

- **D1 — Converter síncrono, de um toque (decisão do autor).** É o que limita a
  célula de Feedback do Converter a 6,5. O **03** agora avisa que a janela para
  de responder e pede para não fechá-la; o **04** segue congelado. Se D1 virar
  **B** (dois toques) ou **C** (segundo plano), a célula sobe para ~9,0. O
  limite da API (sem barra de progresso, sem diálogo não modal) não foi
  descontado.
- **D2 (Cadernos a três cliques) e D3 (capas) não afetam esta nota:** são da
  parte Cadernos, não do plugin.
