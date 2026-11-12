# Decisões de visual da Mesa

Fonte única do que vale no visual. Se algo aqui contradiz um arquivo datado em
`docs/` ou uma captura antiga, vale este arquivo. Só o Lucas aprova mudança.

Protótipo de referência: [`carbon-r2/`](carbon-r2/) (abra os `.html` no
navegador; `index.html` troca tema e acento). O `carbon-r1/` fica como histórico.

## Fluxo

1. Toda mudança visual nasce em HTML no `carbon-r2/`, não em captura.
2. O Lucas aprova o HTML.
3. Só então ela vai para o app (`desk/`), com testes.

## Valendo (aprovado em 2026-11-10)

| Item | Valor |
| --- | --- |
| Fonte da interface | IBM Plex Sans |
| Fonte mono | IBM Plex Mono, só em hora, números e nomes de ferramenta |
| Fonte de título e matemática | STIX Two Text |
| Texto do chat | 15px, linha de 24px |
| Superfícies claras | fundo `#ffffff`, camada `#f4f4f4` |
| Superfícies escuras | `#161616`, `#262626`, `#393939` |
| Cantos | 4px em controles (botão, campo, balão, item de lista); 8px no que flutua (menu, aviso); interruptor redondo |
| Abas | texto com sublinhado de 2px no acento |
| Campos | preenchidos com a camada, sem o fio de baixo do Carbon |
| Botão cheio | texto branco nos dois temas; no grafite escuro, texto `#161616` |
| Leitor de PDF | página ocupa o painel como no app de hoje (sem cartão nem margem larga) |
| Texto na tela | sem sobretítulo nem subtítulo desnecessário; texto que não é necessário não entra (2026-11-11, regra no `AGENTS.md`) |
| Botão de camada | Cancelar e ações secundárias sem borda, no fundo da camada, texto `--text` (2026-11-11) |
| Seletor de acento | seis círculos de 24px com o nome embaixo; o escolhido tem anel de 2px no acento (2026-11-11) |
| Rótulo de grupo | 12px semibold em `--text-2` (2026-11-11) |
| Erro | `--danger-text` = rosa aprovado: `#bd1c67` claro, `#e78eaa` escuro (2026-11-11) |
| Realce de busca | `--highlight`, derivado do acento; sai o amarelo fixo (2026-11-11) |
| Estados | `carbon-r2/estados.html`: hover, foco no acento, pressionado, desabilitado, erro, carregando e vazio (2026-11-11) |

### Acentos (família própria, nem Tailwind nem IBM)

| Acento | Botão claro | Botão escuro | Link no escuro |
| --- | --- | --- | --- |
| Azul (padrão) | `#2d5fdc` | `#4663dd` | `#88acf5` |
| Violeta | `#8044ca` | `#8957d0` | `#b89cea` |
| Verde | `#028053` | `#068758` | `#66c394` |
| Laranja | `#af4700` | `#c14f00` | `#e8956f` |
| Rosa | `#bd1c67` | `#c63a73` | `#e78eaa` |
| Grafite | `#303030` | `#e6e6e6` | `#e6e6e6` |

O azul do botão escuro era `#3f6fe0` (4,60:1); passou a `#4663dd`, o da main, que dá os 5:1 que o teste de contraste (#157) pede (2026-11-11).

## Telas

| Tela | Desenho | Estado no app |
| --- | --- | --- |
| Principal | `carbon-r2/principal.html`, com o PDF como hoje | aplicada (2b203aaf, fc7727c9) |
| Configurações | `carbon-r2/configuracoes.html`: tela cheia, lista lateral com busca, descrição em cada opção, interruptores | aplicada (839f7227 e o ajuste seguinte), falta o Lucas ver no app |
| Guia | `carbon-r2/guia.html`: tela cheia, seções numeradas, título em STIX; lateral só com número e nome; "Próximo" no fim do texto, sem faixa de rodapé | aplicada (839f7227), lateral e próximo aprovados em 2026-11-11 (`carbon-r2/revisao.html`) |
| Cadernos e chat solto | `carbon-r2/cadernos.html`: popover com lista, busca, leitura da tinta e vazio; janela do chat solto | aprovada em 2026-11-11 |
| Cadernos encaixado e composer | `carbon-r2/cadernos-composer.html`: Cadernos deixa de flutuar e encaixa no alto da coluna do tutor, abaixo do cabeçalho, sem sombra nem cantos; busca de 40px com lupa; leitura da tinta numa linha no pé, sem caixa. Composer com 3 linhas por padrão, texto no alto e altura ajustável pelo fio de cima (2 linhas até metade da coluna, duplo clique volta, setas no teclado, altura lembrada). O botão Cadernos fica no composer | aprovada em 2026-11-11 |
| Cabeçalho e Contexto | `carbon-r2/contexto.html`: título da sessão com seta (abre as sessões); abaixo, uma linha só com o que vai junto (PDF e página, questão ativa), que abre o Contexto. Matéria e "N referências" saem do cabeçalho. Contexto encaixado no alto da coluna como os Cadernos: "Vai com a mensagem" (cada item com a nota embaixo), Questão ativa em campo inteiro, Rascunho como seletor, uso do contexto com "Resumir agora" no pé. Mais opções plano: Contexto, Cadernos, Encerrar por hoje, Exportar, Recolher; "Como funciona" sai | aprovada em 2026-11-11 |
| Contrato do tutor (#180) | `carbon-r2/contrato.html`, opção A: no Contexto, grupo "Orienta o tutor" logo depois de "Vai com a mensagem", com o arquivo (TUTOR.md) e a origem embaixo (pasta da matéria, vault ou padrão da Mesa); clicar abre o texto no mesmo painel, com Voltar. Aba Livre: "Sem contrato" numa linha. Cabeçalho não muda. Instrução dada na conversa fica fora | aprovada em 2026-11-12 |

## Depois, separado

- "Tentar de novo" na última resposta: issue #164.
- Marca: integral a pincel ([`marca/r1.html`](marca/r1.html)), aprovada em 2026-11-11. O ícone segue tema e acento: Claro + grafite → integral `#161616` no branco; Escuro + grafite → integral branca no `#161616`; Claro + violeta → integral `#8044ca` no branco; Escuro + violeta → integral `#b89cea` no `#161616` (a "tingida"). Ícone fixo do pacote: Escuro + grafite. Saíram as outras cores no ícone, a placa papel e o tema Papel (mock histórico em [`marca/papel.html`](marca/papel.html)). Nome do app: **Summa** (2026-11-11), logotipo com a integral ao lado da palavra inteira em STIX Two ([`marca/nome.html`](marca/nome.html)); o "∫umma" saiu porque se lê "umma". Confirmado em 2026-11-12 depois de pesar Mesa (genérico, colide com o Mesa do Linux e com outros projetos dele) e o "suma" falado; nenhuma alternativa (Ductus, Quadra, Integra, Traço) amarrou com o ∫ como Summa. Troca de nome no app e no repositório é ticket próprio.
- Movimento da marca (2026-11-11, [`marca/movimento.html`](marca/movimento.html); `?todas=1` mostra as rodadas): a luminária sai da interface. "Pensando" no chat = **K**: integral parada ao lado de "Pensando…", e um brilho só atravessa as duas como uma peça; com movimento reduzido, a linha só respira. Primeira abertura = **I**: a integral se desenha nas Boas-vindas e encolhe rumo à aba enquanto a Mesa em miniatura entra; o passeio destaca cada região com contorno no acento e esmaece o resto; no Nome, "Cálculo I" é digitado com o cursor; no Pronto, a Mesa esmaece e a integral se desenha de novo. No app, o passeio do Como funciona passa sozinho pelas regiões.
- Divulgação (2026-11-11, [`marca/divulgacao.html`](marca/divulgacao.html), PNGs em `marca/png/`): topo do README = D (marca + lema *Solvitur ambulando* + app), claro e escuro conforme o tema; social preview = A escuro (marca + "Estude com seus PDFs e um tutor que não dá a resposta antes de você."); página do projeto = C (marca + lema); imagem de release = B (marca + frase da versão + app). As capturas de B e D são do mock e se refazem do app real quando ele estiver em grafite e com o nome Summa.
- Acentos (2026-11-11): só **grafite** (padrão) e **violeta**, nos dois temas; saem azul, verde, laranja e rosa como acento. O rosa fica só no erro. Aplicar na thread da interface.
