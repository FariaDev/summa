# Nota da rodada 1 — Xournal++ (MesaPagina)

Recorte: os quatro itens do plugin MesaPagina (#133, #159) no Xournal++ 1.3.8,
com as capturas de `docs/design-loop/rodada-1/antes/xournal/` (01–17). A nota
cobre **Clarity**, **Feedback e movimento**, **Estados (vazio/carregando/erro)**
e **Consistência & polish**; tipografia, layout, ícones e cor são do GTK do
Xournal++ e ficam **fora**. A captura **17-montagem-real** também fica fora
(vai ser refeita).

**Vi as imagens.** Abri os PNG 01–16 com o leitor de imagens; o 17 não foi
aberto, por estar fora desta nota. Li também os 17 JSON, o inventário
`inventario-xournal.md` e o Lua do plugin (`main.lua`, `ponte.lua`,
`converter.lua`, `tamanho.lua`). A comparação de vocabulário usou os textos da
Mesa em `desk/src/locales/pt-BR.json` e `desk/src/*.mjs`.

## Notas

| Categoria | Converter | Trocar fonte | Aumentar página |
|---|---:|---:|---:|
| Clarity | 7,0 | 6,5 | 8,0 |
| Feedback e movimento | 5,0 | 6,5 | 7,0 |
| Estados (vazio/carregando/erro) | 5,5 | 7,5 | 8,0 |
| Consistência & polish | 7,0 | 8,0 | 9,0 |
| **Overall da sub-parte** | **6,0** | **7,0** | **8,0** |

**Geral da parte (as três sub-partes, 12 células): 7,0.**

Como cheguei às notas:

- **Converter, 6,0:** o aviso de congelamento existe (03) e a camada nova é
  nomeada (“Texto convertido”, 05), mas o estado 04 passa até 20 s sem nenhum
  sinal (achado 1, grave), a ponte é conferida só depois da confirmação
  (achado 3) e dois erros têm saída fraca (achados 4 e 8).
- **Trocar fonte, 7,0:** o diálogo funciona e o vazio de 13 é bom, mas o alvo
  (seleção ou página inteira) não é dito (5), “Fonte atual” pode ser falso (6)
  e “Mais…” não volta (9).
- **Aumentar página, 8,0:** menu curto e resultado visível em 15; em 16 o
  espaço ganho abaixo fica fora da vista e não há retorno (12).
- **Consistência & polish de aumentar página, 9,0:** os rótulos de
  `main.lua:348-351` são curtos, paralelos, sem jargão e sem mistura de
  idioma; o atalho aparece no menu (01) e o resultado aparece no documento
  (15). O que um designer sênior mudaria é detalhe (“Página atual +2 cm…”).

## Achados

| # | Categoria | Severidade | Evidência | Conserto em uma linha | Arquivo provável |
|---:|---|---|---|---|---|
| 1 | Feedback e movimento | grave | **04**, 700 ms depois de “Continuar”: nenhum diálogo e nenhum indicador; o app está bloqueado em `io.popen` (`main.lua:139-143`) com teto de 20 s (`ponte.lua:347`). O único aviso é o de **03**, “pode congelar por até 20 segundos” (`main.lua:201`), que já fechou. | Manter um modal de progresso durante a chamada (se a API 1.3.8 permitir) ou dizer no aviso que a janela vai parar de responder e não deve ser fechada; encurtar o teto. | `main.lua:200-209` |
| 2 | Feedback e movimento | média | O plugin aborta em 20 s (`main.lua:201`, `ponte.lua:347`), mas o host segue até 60 s (`desk/ink-convert-host.cjs:31` e `:341`); depois do timeout, “Tente de novo” (**09**) pode receber `busy` (`ponte.lua:406`) por até 40 s. Com os padrões reais o estado **10** é inalcançável: o aluno sempre cai no **09**, mais vago. | Alinhar os tetos (host abaixo do `--max-time`) e, no **09**, avisar que a Mesa pode ainda estar terminando. | `ponte.lua:347`; `desk/ink-convert-host.cjs:31` |
| 3 | Feedback e movimento | baixa | A ponte só é conferida dentro de `executaConversao` (`main.lua:100-107`), depois do “Continuar” (`main.lua:200-208`). Com a Mesa fechada, o aluno confirma o congelamento (**03**) e só então recebe **06**. | Conferir a ponte antes de abrir a confirmação. | `main.lua:100-107`, `200-208` |
| 4 | Clarity | média | **06**: “Abra a Mesa: não achei a ponte de conversão (leitura da tinta desligada ou Mesa fechada).” — “ponte de conversão” é jargão interno; se a causa é o interruptor, “abra a Mesa” não resolve, e o texto não diz que na Mesa ele se chama “Ler a escrita à mão” (`pt-BR.json:1711`) nem onde fica. | “A conversão precisa da Mesa aberta e de ‘Ler a escrita à mão’ ligado em Cadernos. Abra a Mesa, ligue a leitura da tinta e tente de novo.” | `main.lua:105` |
| 5 | Clarity | média | **11 → 12**: o diálogo não diz se troca a seleção ou a página inteira (`main.lua:299-309`); sem seleção, um clique recria **todos** os textos da página, em todas as camadas (capturas 11 e 12). | Dizer o alvo na mensagem (“2 textos selecionados” / “todos os textos da página”) e confirmar o caso página inteira. | `main.lua:318-326` |
| 6 | Clarity | média | **11**: “Fonte atual: Sans” vem de `app.getFonts().current` (`main.lua:312-317`), a fonte da ferramenta de texto, não a dos textos alvo. O teste monta textos em “Velha” com `current = 2` (`tests/mesa-main.test.lua:241-242`): a mensagem diria “DejaVu Sans”. | Ler a fonte do primeiro texto alvo ou rotular “Fonte da ferramenta”. | `main.lua:312-324` |
| 7 | Clarity | baixa | **03/05**: o aviso só fala do congelamento; não diz que o texto entra numa camada nova acima e que a tinta original fica (`main.lua:165-171`). Em **05** o aluno vê tinta e texto juntos sem uma frase que explique o resultado. | Acrescentar ao aviso: “O texto entra numa camada nova (‘Texto convertido’); a tinta original fica para comparar.” | `main.lua:201` |
| 8 | Clarity | baixa | **07**: “A cota do modelo de visão acabou. Tente de novo depois.” — não diz quando nem o que fazer; a Mesa tem “Pausado: sem cota” (`pt-BR.json:1721`) e troca de modelo. | “Sem cota no modelo com visão. Escolha outro modelo com visão na Mesa ou tente mais tarde.” | `ponte.lua:402` |
| 9 | Feedback e movimento | baixa | **11**: “Mais…” só avança (`main.lua:287`, `339-343`); depois de virar a página não há “Voltar” e o diálogo não diz “página 1 de N” — as 4 famílias anteriores só voltam fechando e reabrindo, o que reseta para a página 1. | “Voltar” quando `pagina > 1` e o indicador de página na mensagem. | `main.lua:283-290` |
| 10 | Clarity | baixa | **11**: as opções são nomes crus de família (“C059”, “D050000L”) sem amostra (`converter.lua:239-265`); o aluno só vê o efeito depois de aplicar (**12**). | Incluir uma amostra curta no rótulo quando a API deixar e documentar a limitação do diálogo de botões. | `converter.lua:239-265` |
| 11 | Feedback e movimento | baixa | **12**: a troca de fonte não dá retorno — só os glifos mudam e o título ganha “*” (`main.lua:251-279`); não há dica de Ctrl+Z. | Um aviso curto “Fonte trocada em N textos” ou a dica de Ctrl+Z na mensagem do diálogo. | `main.lua:324` |
| 12 | Feedback e movimento | baixa | **14 → 16**: “Página +2 cm abaixo” aumenta a página, mas a vista não acompanha; o espaço novo fica abaixo da área visível e a página aparece cortada na borda (capturas 14 e 16; `main.lua:23-28` só chama `setPageSize`). | Rolar/ajustar o zoom para mostrar a borda nova (se a API 1.3.8 expuser rolagem) ou confirmar o crescimento em uma linha. | `main.lua:23-28` |
| 13 | Estados | baixa | Windows: “Converter ainda não funciona no Windows.” (`main.lua:180`) constata a limitação e não dá saída (inventário, linha 84; **SEM CAPTURA**). | “A conversão ainda não funciona no Windows; por enquanto, use a Mesa no Linux ou no macOS.” | `main.lua:180` |
| 14 | Consistência & polish | baixa | “modelo de visão” (`ponte.lua:402-404`) diverge do “modelo com visão” que a Mesa usa em `pt-BR.json:96`, `:1309` e `:1713`. | Trocar por “modelo com visão” nos textos de quota e de `no-model`. | `ponte.lua:400-410` |
| 15 | Clarity | baixa | **01/02**: “Converter em texto” não diz que age na **seleção** — o aluno descobre pelo erro **02** — e não leva “…” como “Trocar fonte dos textos…”, embora abra diálogo (`main.lua:352` vs `:354`). | “Converter a seleção em texto…”. | `main.lua:352` |
| 16 | Consistência & polish | baixa | O título dos erros é “Error in Xournal++ Plugin «MesaPagina»”, em inglês, num Xournal++ em português (**02**, **06–10**, **13**); é gerado pelo Xournal++ com `error=true`, e **11** mostra o título neutro com `error=false`. | Usar `error=false` nas validações (**02**, **13**) e registrar a limitação do título do Xournal++ 1.3.8. | `main.lua:105`, `115`, `126`, `135`, `148`, `153`, `162`, `180`, `187`, `197`, `260`, `307` |

## SEM CAPTURA

Estados do inventário sem imagem nesta rodada:

| Estado / texto | Origem | Captura |
|---|---|---|
| Windows: “Converter ainda não funciona no Windows.” | `main.lua:180` | **SEM CAPTURA** |
| Seleção sem traço desenhável: “Nenhum traço desenhável na seleção. Selecione a tinta a converter.” | `main.lua:197` | **SEM CAPTURA** |
| Falha de preparo, header: “Não consegui preparar a conversão.” | `main.lua:115`, `:126` | **SEM CAPTURA** |
| Falha de preparo, comando: “Não consegui preparar a conversão (<motivo>).” | `main.lua:135` | **SEM CAPTURA** |
| Resposta vazia: “A Mesa não leu nenhum texto da tinta.” | `main.lua:162` | **SEM CAPTURA** |
| Falha ao criar textos com a fonte nova: “Não consegui criar os textos com a fonte nova. Os textos antigos ficaram como estavam.” | `main.lua:260` | **SEM CAPTURA** |
| `disabled`: “Ligue a leitura da tinta na Mesa para converter.” | `ponte.lua:401` | **SEM CAPTURA** |
| `no-model`: “Nenhum modelo de visão disponível. Configure um modelo na Mesa.” | `ponte.lua:403` | **SEM CAPTURA** |
| `no-vision`: “O modelo atual não lê imagens. Escolha outro modelo na Mesa.” | `ponte.lua:404` | **SEM CAPTURA** |
| `free`: “O modelo gratuito não lê tinta. Escolha outro modelo na Mesa.” | `ponte.lua:405` | **SEM CAPTURA** |
| `busy`: “Já há uma conversão em andamento. Aguarde e tente de novo.” | `ponte.lua:406` | **SEM CAPTURA** |
| `too-large`: “O trecho selecionado é grande demais. Selecione um trecho menor.” | `ponte.lua:408` | **SEM CAPTURA** |
| `bad-request`: “A Mesa recusou o trecho (formato inválido). Selecione de novo.” | `ponte.lua:409` | **SEM CAPTURA** |
| `forbidden`: “A Mesa recusou a chamada. Reabra a Mesa e tente de novo.” | `ponte.lua:410` | **SEM CAPTURA** |
| Motivo desconhecido: “Não deu para converter a tinta. Tente de novo.” | `ponte.lua:415` | **SEM CAPTURA** |
| Segunda página do diálogo de fonte (“Mais…”) | `main.lua:287`, `:339-343` | **SEM CAPTURA** |
| Gerenciador de Plugins e metadados do `plugin.ini` (autor, descrição, versão 1.1.0) | UI do Xournal++; `plugin.ini:3-7` | **SEM CAPTURA** |
| Cancelar da confirmação e Cancelar da fonte | `main.lua:204-209`, `:329-345` | **SEM CAPTURA** (sem tela nova) |

Fora desta nota: **17-montagem-real** tem captura, mas vai ser refeita. O estado
**10-converter-timeout** tem captura, porém é inalcançável com os padrões reais
do host e do plugin (achado 2).
