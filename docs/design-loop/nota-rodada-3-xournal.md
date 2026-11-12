# Nota da rodada 3 — Xournal++ (MesaPagina)

Recorte: os quatro itens do plugin **MesaPagina** (#133, #159) no Xournal++ 1.3.8,
com as capturas de `docs/design-loop/rodada-3/antes/xournal/` (01–16 e 12b). As
capturas **17** e **18** (montagem) ficam fora: têm avaliador próprio. A nota
cobre **Clarity**, **Feedback e movimento**, **Estados (vazio/carregando/erro)** e
**Consistência & polish**; tipografia, hierarquia, espaçamento, cor, ícones,
acessibilidade e janela pequena ficam **fora** (UI do GTK/Xournal++ e recorte
desta parte).

**Vi as imagens.** Abri os PNG **01–16** e **12b** com o leitor de imagens; não
abri **17** e **18**. Li os 19 JSON de estado e o `capturas.json`, o inventário
`inventario-xournal.md`, o Lua do plugin (`main.lua`, `ponte.lua`,
`converter.lua`, `tamanho.lua`), os testes do plugin e
`desk/src/locales/pt-BR.json`.

## 1. Notas

| Categoria | Converter (Ctrl+Shift+K) | Trocar fonte (Ctrl+Shift+J) | Aumentar página (#133) |
|---|---:|---:|---:|
| Clarity | 8,5 | 8,0 | 9,0 |
| Feedback e movimento | 5,5 | 8,0 | 8,5 |
| Estados (vazio/carregando/erro) | 7,5 | 8,0 | 8,5 |
| Consistência & polish | 8,5 | 8,5 | 9,0 |
| **Overall da sub-parte** | **7,5** | **8,1** | **8,8** |
| **Geral da parte (12 células)** | **8,1** | | |

Typography, Hierarchy, Spacing & density, Color & contrast, Iconography,
Acessibilidade e Janela pequena: **`fora`** nas três sub-partes.

### Por que as notas

- **Converter, 7,5.** O fluxo de erro está bom e o vocabulário bate com a
  Mesa: “Ler a escrita à mão” (`pt-BR.json:1717`), “Cadernos” (`:1705`),
  “modelo com visão” (`:1719`) e “sem cota” (`:1729`). **02, 06–10 e 13** usam o
  título neutro “Xournal++ Plugin «MesaPagina»”; **09** separou conexão de
  timeout e **10** ganhou a dica de selecionar menos tinta. O **03** diz o que
  vai acontecer (ler a tinta, a camada nova e a tinta que fica); **05** mostra
  a camada “Texto convertido”. O que puxa é o **04**: até 20 s sem sinal (achado 1, decisão do
  autor D1), com o **03** só dizendo “pode congelar” (achado 2). Clarity 8,5;
  Feedback 5,5; Estados 7,5 (o estado de carregando é o próprio 04, e os demais
  motivos da ponte não têm captura); Consistência 8,5 (títulos e tom iguais aos
  da Mesa; os quatro erros internos agora usam `false`, sem captura; as aspas
  retas do 03/06 são o achado 7).
- **Trocar fonte, 8,1.** O alvo (“Todos os textos da página.”), a fonte dos
  textos (singular e plural no código) e o “Ctrl+Z desfaz” resolvem os achados
  3 e 4 da rodada 2; o **11** mostra “Lista de fontes: 1 de 13.” e o “Mais…”.
  Ficam a leitura de “1 de 13” sem “página” (achado 3), o sucesso sem dizer a
  fonte escolhida (achado 4) e a falta de amostra, que é limite da API
  (`converter.lua:238-241`). Clarity 8,0; Feedback 8,0 (o aviso de sucesso dá a
  contagem e o desfazer, mas não nomeia a fonte — achado 4 — e não há prévia,
  que é limite da API); Estados 8,0 (o erro de `addTexts`, a segunda página da
  lista, a seleção e as fontes mistas não têm captura); Consistência 8,5 (o
  “Ctrl+Z” fixo é o achado 6).
- **Aumentar página, 8,8.** Os dois rótulos do **01** dizem alvo (“Página
  atual”), sentido (“à direita”/“abaixo”) e quantidade (“+2 cm”), sem jargão; o
  “atual” resolve a primeira parte do achado 8 da rodada 2, e **15/16** mostram
  a página maior com a vista acompanhando. A consistência também fecha: mesma
  estrutura nos dois itens, sem mistura de idioma e sem “…” (agem na hora, ao
  contrário de Converter e Trocar); o atalho aparece no menu e o resultado no
  documento. O que um designer sênior acrescentaria é uma linha com o tamanho
  novo (achado 5), que é feedback. Clarity 9,0; Feedback 8,5; Estados 8,5 (14,
  15 e 16 cobrem o antes e os dois sentidos, mas não há caminho de erro nem
  captura de uso repetido); Consistência 9,0.

**D1 — decisão do autor.** O Converter ser síncrono, de um toque, é a decisão
pendente D1 em `docs/design-loop/decisoes.md`. O **04** continua sem progresso;
a nota de Feedback do Converter (5,5) é limitada por isso, não por regressão
desta rodada. Se D1 ficar em **A** (manter síncrono), o teto desta célula fica
em ~6,0; se virar **B** ou **C** (dois toques ou segundo plano), sobe para ~8,0.

## 2. Achados

As capturas da coluna “Captura” são os arquivos
`docs/design-loop/rodada-3/antes/xournal/NN-*.png`.

| # | Categoria | Severidade | Captura | Valor exato | Conserto em uma linha | Arquivo provável |
|---:|---|---|---|---|---|---|
| 1 | Feedback e movimento | grave | **04** | 700 ms depois de **Continuar**: nenhum diálogo, barra ou cursor de progresso; a seleção e o texto continuam na tela e o Xournal++ está bloqueado em `io.popen`, com `--max-time 20`. O aviso de **03** já fechou. **Decisão do autor (D1).** | Decidir D1: em **A**, dizer no 03 que a janela vai parar de responder e não deve ser fechada; em **B/C**, dar o segundo toque ou o segundo plano. | `main.lua:154-159, 222`; `ponte.lua:347` |
| 2 | Clarity | baixa | **03** | “O Xournal++ pode congelar por até 20 segundos.” não diz que a janela para de responder nem que não deve ser fechada; o **04** mostra o congelamento sem nenhum sinal. | “O Xournal++ vai parar de responder por até 20 segundos; não feche a janela.” | `main.lua:222` |
| 3 | Clarity | baixa | **11** | “Lista de fontes: 1 de 13.” não diz que 1 e 13 são páginas da lista; pode ser lido como “fonte 1 de 13”. | “Lista de fontes: página 1 de 13.” | `main.lua:311-313` |
| 4 | Clarity | baixa | **12** | “Fonte trocada em 2 textos. Ctrl+Z desfaz.” não diz a fonte escolhida; o aluno não confirma que foi **C059** sem olhar o texto atrás do aviso. | “Fonte trocada para C059 em 2 textos. Ctrl+Z desfaz.” | `main.lua:419-422` |
| 5 | Feedback e movimento | baixa | **15, 16** | Depois de “Página atual +2 cm…” o único retorno é a página maior e a vista que acompanha; não há uma linha com o tamanho novo (ex.: “Página: 12,0 × 10,6 cm”) na barra de status. As dimensões já estão em `pageWidth`/`pageHeight` (`main.lua:26`). | Mostrar o tamanho novo numa linha de status, se a API 1.3.8 expuser uma. | `main.lua:23-36` |
| 6 | Consistência & polish | baixa | **12** | “Ctrl+Z desfaz.” fixa o atalho de Linux/Windows. A captura é Linux e está certa; o plugin também roda no macOS (README) e o texto não pergunta à plataforma. Se o Xournal++ no macOS mostrar **⌘Z**, o aviso aponta a tecla errada. (Não verifiquei macOS nesta rodada.) | Usar o rótulo de desfazer da plataforma ou “Desfazer (Ctrl+Z/⌘Z)”. | `main.lua:422` |
| 7 | Consistência & polish | baixa | **03, 06** | As aspas em “Texto convertido” (03) e “Ler a escrita à mão” (06) são retas (`"`); a Mesa usa aspas curvas em textos como `pt-BR.json:608` (“{name}”). O resto do tom e dos títulos está consistente. | Trocar por aspas curvas (“…”) nas duas mensagens. | `main.lua:108, 222` |

**Nota sobre o 12:** o texto está legível, mas a imagem tem faixa preta à
direita (x≈600–800), fragmentos-fantasma do diálogo no canto superior esquerdo
(“Xc”, “Fonte 1”) e uma barra de título solta acima do aviso. É falha da
composição da captura, não da interface (ver seção 4); não penalizei a nota por
isso. O **12b** prova a fonte **C059** aplicada.

## 3. SEM CAPTURA

Estados do inventário sem imagem nesta rodada. As notas de **Estados**
consideram só os estados com captura; os estados desta lista ficam **sem nota**
na categoria correspondente. Os estados 17 e 18 têm captura, mas ficam fora
desta nota por terem avaliador próprio.

| Estado / texto | Origem | Observação |
|---|---|---|
| Windows: “A conversão ainda não funciona no Windows; por enquanto, use a Mesa no Linux ou no macOS.” | `main.lua:196` | **SEM CAPTURA**; o inventário ainda traz o texto antigo “Converter ainda não funciona no Windows.” |
| Seleção sem traço desenhável: “Nenhum traço desenhável na seleção. Selecione a tinta a converter.” | `main.lua:213` | **SEM CAPTURA** |
| Falha de preparo, header: “Não consegui preparar a conversão.” | `main.lua:131` | **SEM CAPTURA** |
| Falha de preparo, corpo: “Não consegui preparar a conversão.” | `main.lua:142` | **SEM CAPTURA** |
| Falha de preparo, comando: “Não consegui preparar a conversão (`<motivo>`).” | `main.lua:151` | **SEM CAPTURA** |
| Resposta vazia: “A Mesa não leu nenhum texto da tinta.” | `main.lua:178` | **SEM CAPTURA** |
| Falha ao criar textos com a fonte nova: “Não consegui criar os textos com a fonte nova. Os textos antigos ficaram como estavam.” | `main.lua:334` | **SEM CAPTURA** |
| `disabled`: “Ligue 'Ler a escrita à mão' em Cadernos, na Mesa, para converter.” | `ponte.lua:402` | **SEM CAPTURA**; o inventário ainda traz “Ligue a leitura da tinta na Mesa para converter.” |
| `no-model`: “Nenhum modelo com visão disponível. Configure um modelo com visão na Mesa.” | `ponte.lua:404` | **SEM CAPTURA**; o inventário ainda traz “Nenhum modelo de visão disponível…” |
| `no-vision`: “O modelo atual não lê imagens. Escolha um modelo com visão na Mesa.” | `ponte.lua:405` | **SEM CAPTURA**; o inventário ainda traz “…Escolha outro modelo na Mesa.” |
| `free`: “O modelo gratuito não lê tinta. Escolha um modelo com visão na Mesa.” | `ponte.lua:406` | **SEM CAPTURA**; o inventário ainda traz “…Escolha outro modelo na Mesa.” |
| `busy`: “A Mesa ainda está terminando a conversão anterior. Aguarde e tente de novo.” | `ponte.lua:407` | **SEM CAPTURA** |
| `too-large`: “O trecho selecionado é grande demais. Selecione um trecho menor.” | `ponte.lua:409` | **SEM CAPTURA** |
| `bad-request`: “A Mesa recusou o trecho (formato inválido). Selecione de novo.” | `ponte.lua:410` | **SEM CAPTURA** |
| `forbidden`: “A Mesa recusou a chamada. Reabra a Mesa e tente de novo.” | `ponte.lua:411` | **SEM CAPTURA** |
| Motivo desconhecido: “Não deu para converter a tinta. Tente de novo.” | `ponte.lua:416` | **SEM CAPTURA** |
| Segunda página do diálogo de fonte (“Mais…” → “Voltar”) | `main.lua:365-374` | **SEM CAPTURA** |
| Gerenciador de Plugins e metadados do `plugin.ini` (autor, descrição, versão 1.1.0) | UI do Xournal++; `plugin.ini:3-7` | **SEM CAPTURA**; o 01 mostra só o item de menu que leva a ele |
| Cancelar da confirmação e Cancelar da fonte | `main.lua:225-230, 412-437` | **SEM CAPTURA** (mesmos diálogos de 03 e 11, sem tela nova) |
| “N textos selecionados.” (alvo da troca de fonte com seleção) | `main.lua:303-306` | **SEM CAPTURA**; o estado existe no código e no teste, mas não está no inventário |
| “Fontes atuais: …” (página com fontes mistas) | `main.lua:288-296` | **SEM CAPTURA**; o 11 só tem uma fonte (Sans); o caso misto está coberto por teste |

## 4. Vi as imagens?

Sim. Abri com o leitor de imagens os PNG **01–16** e **12b**; não abri **17** e
**18**, que ficam fora desta nota. Li os 19 JSON de estado e o `capturas.json`,
o inventário, o Lua do plugin, os testes e `desk/src/locales/pt-BR.json`.

Duas notas de evidência:

- **12 com artefato de composição.** A imagem tem uma faixa preta de x≈600 a
  800 e fragmentos-fantasma do próprio diálogo (“Xc”, “Fonte 1”, uma barra de
  título solta). O texto “Fonte trocada em 2 textos. Ctrl+Z desfaz.” está
  legível. A causa provável continua sendo o `snapshot(main)` em
  `desk/tests/capture-ciclo2-xournal.mjs:328`, tirado com o aviso de sucesso
  aberto; o **12b** prova a fonte aplicada. Não é defeito da interface; não
  penalizei a nota. Para a próxima rodada, capturar o 12 com a janela principal
  limpa, como já se faz no 12b.
- **Inventário desatualizado.** `inventario-xournal.md:71` ainda diz “Error in
  Xournal++ Plugin «MesaPagina»” para 02, 06–10 e 13, mas as capturas novas mostram
  o título neutro “Xournal++ Plugin «MesaPagina»”; as linhas 44 e 78 ainda
  trazem o texto antigo da quota (“A cota do modelo de visão acabou…”), e as
  linhas 93–96, os textos antigos dos motivos da ponte. A captura **07** e
  `ponte.lua:400-416` são a fonte de verdade; usei o texto atual do código, não
  o do inventário.

## 5. Achados da rodada 2

Status de cada achado de `docs/design-loop/nota-rodada-2-xournal.md`, com a prova
nova. A nota acima é independente das rodadas anteriores.

| # | Status | Prova na rodada 3 |
|---:|---|---|
| 1 | **ABERTO** (decisão do autor D1) | **04** continua sem diálogo/indicador; `main.lua:154-159, 222`; `ponte.lua:347`. |
| 2 | **RESOLVIDO** | **09**: “Não deu para falar com a Mesa. Se ela estiver fechada, abra-a; se já estiver aberta, reabra-a e tente de novo.”; `main.lua:164`. |
| 3 | **RESOLVIDO** | **11**: “Lista de fontes: 1 de 13.”; `main.lua:311-313`. |
| 4 | **RESOLVIDO** (código/teste; captura só com uma fonte) | **11** mostra “Fonte atual: Sans.” com uma fonte; o caso misto (“Fontes atuais: Sans, C059.”) está em `main.lua:270-296` e no teste `mesa-main.test.lua` (“fontes mistas”); **SEM CAPTURA** da página com fontes mistas. |
| 5 | **PARCIAL** | **11** ainda mostra “C059” e “D050000L” sem amostra; a limitação da API 1.3.8 está documentada em `converter.lua:238-241`. Não há conserto no plugin enquanto o `openDialog` não aceitar seletor com fonte. |
| 6 | **RESOLVIDO** (código; sem captura dos quatro erros) | Os quatro `openDialog` internos agora passam `false`: `main.lua:131, 142, 151, 334`; **02, 06–10 e 13** mostram o título neutro. Os quatro erros internos seguem **SEM CAPTURA**. |
| 7 | **RESOLVIDO** | **10**: “A conversão demorou demais. Tente de novo. Se o trecho for grande, selecione menos tinta.”; `ponte.lua:408`. |
| 8 | **PARCIAL** | **01** mostra “Página atual +2 cm à direita” e “Página atual +2 cm abaixo” (`main.lua:440-443`); **15/16** mostram o crescimento, mas não há texto com o tamanho novo; `main.lua:23-36`. |
