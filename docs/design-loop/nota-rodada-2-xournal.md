# Nota da rodada 2 — Xournal++ (MesaPagina)

Recorte: os quatro itens do plugin **MesaPagina** (#133, #159) no Xournal++ 1.3.8,
com as capturas de `docs/design-loop/rodada-2/antes/xournal/` (01–16 e 12b). A
nota cobre **Clarity**, **Feedback e movimento**, **Estados (vazio/carregando/erro)**
e **Consistência & polish**; tipografia, hierarquia, espaçamento, cor, ícones,
acessibilidade e janela pequena são do GTK do Xournal++ e ficam **fora**. As
capturas **17** e **18** (montagem) também ficam fora: têm avaliador próprio.

**Vi as imagens.** Abri os PNG 01–16 e 12b com o leitor de imagens; não abri 17 e
18. Li os 19 JSON de estado e o `capturas.json`, o inventário
`inventario-xournal.md`, o Lua do plugin (`main.lua`, `ponte.lua`,
`converter.lua`, `tamanho.lua`),
`desk/ink-convert-host.cjs`, os testes do plugin/host e os textos da Mesa em
`desk/src/locales/pt-BR.json`. Também inspecionei os pixels do 12 para confirmar
o artefato de composição descrito na seção 4.

## 1. Notas

| Categoria | Converter (Ctrl+Shift+K) | Trocar fonte (Ctrl+Shift+J) | Aumentar página (#133) |
|---|---:|---:|---:|
| Clarity | 8,0 | 8,0 | 8,5 |
| Feedback e movimento | 5,5 | 7,5 | 8,5 |
| Estados (vazio/carregando/erro) | 7,5 | 8,0 | 8,5 |
| Consistência & polish | 8,5 | 8,5 | 9,0 |
| **Overall da sub-parte** | **7,5** | **8,0** | **8,5** |

**Geral da parte (as três sub-partes, 12 células): 8,0.**

Fora da nota: **Typography**, **Hierarchy**, **Spacing & density**, **Color &
contrast**, **Iconography**, **Acessibilidade** e **Janela pequena** — `fora`
(o recorte desta parte são só as quatro categorias acima; o resto é UI do
Xournal++/GTK).

### Por que as notas

- **Converter, 7,5.** O fluxo de erro ficou bom: 02, 06–10 e 13 usam o título
  neutro “Xournal++ Plugin «MesaPagina»”, o 06 nomeia “Ler a escrita à mão” e
  “Cadernos”, o 07 usa “modelo com visão” e o host de 15 s torna o 10 alcançável.
  O 03 explica o congelamento, a camada nova e a tinta que fica. O vocabulário
  bate com a Mesa: “Ler a escrita à mão” (`pt-BR.json:1715`), “modelo com visão”
  (`:96`, `:1717`), “Cadernos” (`:1703`) e “sem cota” (`:1726`). O que segura é o
  **04**: até 20 s sem nenhum sinal (achado 1, decisão D1), e o **09** ainda
  mistura conexão com timeout (achado 2).
- **Trocar fonte, 8,0.** O alvo (“Todos os textos da página.”), a fonte dos
  textos e o aviso de sucesso com “Ctrl+Z desfaz” resolvem os achados 5, 6 e 11
  da rodada 1. Ficam o indicador “Fontes: página 1 de 13.” ambíguo (achado 3), a
  “Fonte atual” no singular para uma página que pode ter fontes mistas (achado 4),
  os nomes crus sem amostra (achado 5) e a segunda página sem captura.
- **Aumentar página, 8,5.** Os rótulos do menu são curtos, paralelos e sem
  jargão; 15 e 16 mostram a vista acompanhando o crescimento (achado 12 da rodada
  1 resolvido). Feedback 8,5: o resultado é imediato e a borda nova fica visível;
  não há toast nem animação, o que é detalhe. Estados 8,5: antes, +direita e
  +abaixo estão capturados; a ação não tem caminho de erro previsto na API.
  Falta só um retorno textual do tamanho novo e o “atual” no rótulo (achado 8);
  nada que o usuário sinta. **Consistência & polish, 9,0:** os rótulos de
  `main.lua:424-427` são curtos, paralelos, sem jargão e sem mistura de idioma; o
  atalho aparece no menu (01) e o resultado no documento (15/16). O que um
  designer sênior mudaria é detalhe (“Página atual +2 cm…”).
- **Geral, 8,0.** É a média das 12 células. O 04 (5,5) puxa o Converter para
  baixo; as outras duas sub-partes estão em 8,0–8,5. Um designer sênior ainda
  mudaria o texto do 09, o indicador de página da fonte e a confirmação do
  tamanho da página.

**D1 — decisão do autor.** O Converter ser síncrono, de um toque, é a decisão
pendente D1 em `docs/design-loop/decisoes.md`. O 04 continua sem progresso; a
nota de **Feedback do Converter (5,5)** é limitada por isso, não por regressão da
rodada 2. Se D1 ficar em **A** (manter síncrono), o teto desta célula fica em
~6,0; se virar **B** ou **C** (dois toques ou segundo plano), sobe para ~8,0.

## 2. Achados

As capturas da coluna “Captura” são os arquivos
`docs/design-loop/rodada-2/antes/xournal/NN-*.png`.

| # | Categoria | Severidade | Captura | Valor exato | Conserto em uma linha | Arquivo provável |
|---:|---|---|---|---|---|---|
| 1 | Feedback e movimento | grave | **04** | 700 ms depois de “Continuar”: nenhum diálogo e nenhum indicador; o Xournal++ está bloqueado em `io.popen`, com `--max-time 20`; o aviso de 03 já fechou. **Decisão do autor (D1).** | Manter um modal de progresso se a API 1.3.8 permitir, ou assumir no aviso que a janela vai parar e não deve ser fechada; decidir D1. | `main.lua:154-159, 222`; `ponte.lua:347` |
| 2 | Clarity | baixa | **09** | “Não deu para falar com a Mesa ou a conversão demorou demais. Se a Mesa não estiver aberta, abra-a e tente de novo.” O timeout agora tem o 10 (host 15 s < curl 20 s); a primeira oração ficou sobrando e o “abra-a” não cobre a Mesa já aberta. | “Não deu para falar com a Mesa. Se ela estiver fechada, abra-a; se já estiver aberta, reabra-a e tente de novo.” | `main.lua:164` |
| 3 | Clarity | baixa | **11** | “Fontes: página 1 de 13.” O 13 é a página da lista de fontes, não a do caderno (9 páginas); o número pode ser lido como página do documento. | “Lista de fontes: página 1 de 13.” ou “Fontes: 1 de 13.” | `main.lua:295-297` |
| 4 | Clarity | baixa | **11** (código; a fixture só tem Sans) | “Fonte atual: Sans.” `fonteDosTextos` lê só a fonte do primeiro texto alvo; numa página com fontes mistas, o singular “Fonte atual” mente. | “Fonte do 1º texto: Sans” ou listar as fontes quando elas diferirem. | `main.lua:270-281, 294` |
| 5 | Feedback e movimento | baixa | **11** | Botões “Sans”, “C059”, “Cantarell”, “D050000L” sem amostra; o aluno só vê o efeito depois de aplicar. A API `openDialog` usa a fonte da interface, e a limitação está documentada no código. | Manter a limitação registrada e, se a API ganhar um seletor com fonte, mostrar amostra; por ora, ao menos manter “Sans” primeiro e os nomes legíveis. | `converter.lua:233-268` |
| 6 | Consistência & polish | baixa | **SEM CAPTURA** (código) | Quatro erros internos ainda passam `error=true` e mostram o título “Error in Xournal++ Plugin «MesaPagina»” em inglês; os erros capturados usam `false` e mostram o título neutro. | Trocar `true` por `false` nos quatro `openDialog` internos (a mensagem já diz o erro). | `main.lua:131, 142, 151, 318` |
| 7 | Estados | baixa | **10** | “A conversão demorou demais. Tente de novo.” Não há ação além de repetir; se o trecho for grande, o mesmo retry pode estourar de novo (o motivo `too-large` existe). | Acrescentar “Se o trecho for grande, selecione menos tinta.” | `ponte.lua:408` |
| 8 | Clarity | baixa | **01, 15, 16** | “Página +2 cm à direita” / “Página +2 cm abaixo”: não dizem “atual” e, depois do clique, não há uma linha com o tamanho novo; o retorno é só visual. | “Página atual +2 cm à direita/abaixo” e, se a API expuser, mostrar o novo tamanho na barra de status. | `main.lua:23-36, 424-427` |

**Nota sobre o 12:** o texto “Fonte trocada em 2 textos. Ctrl+Z desfaz.” está
legível, mas a imagem tem uma faixa preta de x≈600 a 800 e fragmentos-fantasma
do diálogo no canto superior esquerdo. É falha da composição da captura, não da
interface (ver seção 4); não penalizei a nota por isso.

## 3. SEM CAPTURA

Estados do inventário sem imagem nesta rodada. As notas acima consideram só os
estados com captura; os estados desta lista ficam **sem nota** na categoria
correspondente.

| Estado / texto | Origem | Captura |
|---|---|---|
| Windows: “A conversão ainda não funciona no Windows; por enquanto, use a Mesa no Linux ou no macOS.” | `main.lua:196` | **SEM CAPTURA** |
| Seleção sem traço desenhável: “Nenhum traço desenhável na seleção. Selecione a tinta a converter.” | `main.lua:213` | **SEM CAPTURA** |
| Falha de preparo, header: “Não consegui preparar a conversão.” | `main.lua:131`, `:142` | **SEM CAPTURA** |
| Falha de preparo, comando: “Não consegui preparar a conversão (<motivo>).” | `main.lua:151` | **SEM CAPTURA** |
| Resposta vazia: “A Mesa não leu nenhum texto da tinta.” | `main.lua:178` | **SEM CAPTURA** |
| Falha ao criar textos com a fonte nova: “Não consegui criar os textos com a fonte nova. Os textos antigos ficaram como estavam.” | `main.lua:318` | **SEM CAPTURA** |
| `disabled`: “Ligue 'Ler a escrita à mão' em Cadernos, na Mesa, para converter.” | `ponte.lua:402` | **SEM CAPTURA** |
| `no-model`: “Nenhum modelo com visão disponível. Configure um modelo com visão na Mesa.” | `ponte.lua:404` | **SEM CAPTURA** |
| `no-vision`: “O modelo atual não lê imagens. Escolha um modelo com visão na Mesa.” | `ponte.lua:405` | **SEM CAPTURA** |
| `free`: “O modelo gratuito não lê tinta. Escolha um modelo com visão na Mesa.” | `ponte.lua:406` | **SEM CAPTURA** |
| `busy`: “A Mesa ainda está terminando a conversão anterior. Aguarde e tente de novo.” | `ponte.lua:407` | **SEM CAPTURA** |
| `too-large`: “O trecho selecionado é grande demais. Selecione um trecho menor.” | `ponte.lua:409` | **SEM CAPTURA** |
| `bad-request`: “A Mesa recusou o trecho (formato inválido). Selecione de novo.” | `ponte.lua:410` | **SEM CAPTURA** |
| `forbidden`: “A Mesa recusou a chamada. Reabra a Mesa e tente de novo.” | `ponte.lua:411` | **SEM CAPTURA** |
| Motivo desconhecido: “Não deu para converter a tinta. Tente de novo.” | `ponte.lua:416` | **SEM CAPTURA** |
| Segunda página do diálogo de fonte (“Mais…” → “Voltar”) | `main.lua:349-358` | **SEM CAPTURA** |
| Trocar fonte com seleção: “N textos selecionados.” | `main.lua:288-292` | **SEM CAPTURA** |
| Gerenciador de Plugins e metadados do `plugin.ini` (autor, descrição, versão 1.1.0) | UI do Xournal++; `plugin.ini:3-7` | **SEM CAPTURA** |
| Cancelar da confirmação e Cancelar da fonte | `main.lua:225-230`, `:396-421` | **SEM CAPTURA** (sem tela nova) |

## 4. Vi as imagens?

Sim. Abri com o leitor de imagens os PNG **01–16** e **12b**; não abri **17** e
**18**, que ficam fora desta nota. Li os 19 JSON de estado e o `capturas.json`,
o inventário, o Lua do plugin, `desk/ink-convert-host.cjs`, os testes e
`desk/src/locales/pt-BR.json`.

Duas notas de evidência:

- **12 com artefato de composição.** A imagem tem uma faixa preta de x≈600 a
  800 e fragmentos-fantasma do próprio diálogo (acima e à esquerda da posição
  final). O texto está legível, mas a evidência visual do estado está
  comprometida. A causa provável é o `snapshot(main)` em
  `desk/tests/capture-ciclo2-xournal.mjs:314-315`, tirado com o aviso de
  sucesso aberto: o cliente volta cortado/preto à direita e o
  aviso é composto por cima. Não é defeito da interface; o 12b prova a fonte
  aplicada. Para a próxima rodada, capturar o 12 com a janela principal limpa,
  como já se faz no 12b.
- **Inventário desatualizado.** `inventario-xournal.md:48` e `:82` ainda descrevem
  o diálogo 11 sem “Fontes: página 1 de 13.” e sem o botão “Mais…”; as linhas
  78 e 93–101 ainda trazem os textos antigos dos motivos da ponte (por exemplo,
  “A cota do modelo de visão acabou…” e “Ligue a leitura da tinta na Mesa…”).
  A captura **07** e o `ponte.lua:400-416` são a fonte de verdade; usei o texto
  atual do código, não o do inventário.

## 5. Achados da rodada 1

Status de cada achado de `nota-rodada-1-xournal.md`, com a prova nova.

| # | Status | Prova na rodada 2 |
|---:|---|---|
| 1 | **ABERTO** (decisão do autor D1) | **04** continua sem diálogo/indicador; `main.lua:154-159, 222`; `ponte.lua:347`. |
| 2 | **RESOLVIDO** | Host desiste em 15 s, abaixo do `--max-time 20` (`ink-convert-host.cjs:34, 327-344`), e aborta no `res.close` (`:439`; a promessa de aborto está em `:366-375`); o **10** ficou alcançável. |
| 3 | **RESOLVIDO** | **06** mostra o erro sem passar pela confirmação; a ponte é conferida antes do aviso (`main.lua:216-220`). |
| 4 | **RESOLVIDO** | **06**: “A conversão precisa da Mesa aberta e de "Ler a escrita à mão" ligado em Cadernos…”; `main.lua:108`. |
| 5 | **RESOLVIDO** | **11**: “Todos os textos da página.”; `main.lua:288-292`. O caso com seleção (“N textos selecionados.”) é coberto por código/teste, mas não tem captura. |
| 6 | **RESOLVIDO** | **11**: “Fonte atual: Sans” vem dos textos alvo (`main.lua:270-281, 391`), não da ferramenta. O caso de fontes mistas virou o achado 4 desta rodada. |
| 7 | **RESOLVIDO** | **03**: “…O texto entra numa camada nova ("Texto convertido"); a tinta original fica. Continuar?”; `main.lua:222`. |
| 8 | **RESOLVIDO** | **07**: “Sem cota no modelo com visão. Escolha outro modelo com visão na Mesa ou tente mais tarde.”; `ponte.lua:403`. |
| 9 | **PARCIAL** | **11** mostra “Fontes: página 1 de 13.” e o botão “Mais…”; o “Voltar” existe em `main.lua:353-356`, mas a segunda página **não foi capturada** (SEM CAPTURA). |
| 10 | **PARCIAL** | **11** ainda mostra “C059” e “D050000L” sem amostra; a limitação da API está documentada em `converter.lua:238-241`, mas o aluno continua sem prévia. |
| 11 | **RESOLVIDO** | **12**: “Fonte trocada em 2 textos. Ctrl+Z desfaz.”; `main.lua:406`. A captura 12 tem o artefato de composição da seção 4; o texto está legível. |
| 12 | **RESOLVIDO** | **15/16**: a página cresce e a vista acompanha (`app.scrollToPos` relativo, `main.lua:28-35`); a borda inferior do 16 fica visível, com margem para a barra de status. |
| 13 | **RESOLVIDO** (SEM CAPTURA) | `main.lua:196`: “…por enquanto, use a Mesa no Linux ou no macOS.”; teste `mesa-main.test.lua:213`. Não há captura de Windows. |
| 14 | **RESOLVIDO** | **07** e `ponte.lua:403-406` usam “modelo com visão”, como `pt-BR.json:96, 1313, 1717`. |
| 15 | **RESOLVIDO** | **01**: “Converter a seleção em texto…”, com reticências; `main.lua:428`. |
| 16 | **PARCIAL** | **02, 06–10 e 13** usam o título neutro “Xournal++ Plugin «MesaPagina»” (`error=false`); quatro erros internos ainda usam `true` e mostrariam o título em inglês (`main.lua:131, 142, 151, 318`), sem captura. |
