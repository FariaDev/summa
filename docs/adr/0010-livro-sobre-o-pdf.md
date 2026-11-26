# ADR 0010 — Livro lido sobre o próprio PDF

Status: proposta.

## Contexto

A aba Livros vai ler um livro técnico com revelação progressiva: a página se
descobre um parágrafo por vez e o aluno pergunta sobre o trecho exato
([estudo](../design/234-livros.md)). Para isso a Mesa precisa saber onde começa e
termina cada parágrafo, figura e trecho de código.

O caminho óbvio seria converter o PDF (para HTML, EPUB ou Markdown) e mostrar
o texto convertido. Livro técnico converte mal: código, fórmulas, figuras com
anotação, notas de margem e texto que contorna figura se perdem ou se
embaralham, e o aluno passaria a ler uma cópia pior do livro.

Um teste com um livro real (Grokking Algorithms, 258 páginas, 2026-11-26)
mostrou que dá para achar os blocos sem converter: a camada de texto do
pdf.js mais a tinta rasterizada em baixa resolução deram 9,4 passos por
página, em cerca de 15 s para o livro inteiro. Mostrou também dois limites:
código anotado se parte em vários blocos, e o PDF perde as ligaduras fi, fl,
ff e Th em todos os extratores.

## Decisão

O aluno lê **o próprio PDF**, desenhado pelo pdf.js. A Mesa monta um **índice
de blocos** ao lado (`runtime/livros/<id>/indice.json`) com página, passo,
tipo, caixa e texto de cada bloco, e desenha a cortina por cima da página,
uma caixa borrada por bloco ainda não revelado.

- O PDF é copiado para a pasta do livro e nunca é alterado.
- O índice é local, sem modelo, e pode ser remontado; os consertos do aluno
  (**Ver os blocos**: juntar, separar, tirar) são uma lista de operações
  aplicada por cima, para sobreviver à remontagem.
- O texto do índice serve ao tutor; como ele pode ter ligadura faltando, o
  "Perguntar aqui" manda sempre o recorte em imagem junto.
- Livro sem camada de texto cai em cortina por faixas, sem blocos.

## Consequências

A página é sempre a do livro, com a diagramação, as figuras e o código como o
autor fez. O custo é uma heurística de blocos que erra em casos de
diagramação (código anotado é o principal), consertada à mão pelo **Ver os
blocos**, e um texto para o tutor que pode ter palavra quebrada, compensado
pelo recorte. OCR para livro escaneado fica para depois.
