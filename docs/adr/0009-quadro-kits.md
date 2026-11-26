# ADR 0009 — Peças do Quadro por kit

Status: proposta.

## Contexto

A aba Livre vai ganhar o Quadro: peças interativas (roteiro de código, desenho
narrado, cena) que o aluno pausa em qualquer ponto para perguntar ao tutor
([estudo](../design/221-quadro.md)). Quem escreve as peças são modelos diferentes,
nos dois motores. Com HTML livre (`criar_atividade`, #42), cada modelo inventa
o próprio layout, ritmo, cor e transporte; a peça muda de cara conforme o
modelo e o "Perguntar aqui" não tem um ponto exato para mandar.

As figuras (#60) já mostraram o caminho: a Mesa é dona da forma (a cor literal
vira token), e a `ver_figura` devolve o que foi desenhado com avisos objetivos.

## Decisão

A peça é escrita contra um **kit** da Mesa. O modelo manda um roteiro curto
(o algoritmo, o desenho ou a cena, com os pontos de parada) e o kit é dono do
resto: tempo, ritmo, layout, cores por token, fontes por papel, transições,
transporte, acessibilidade, limites e o "Perguntar aqui" com o instante exato.

- **Ferramentas:** `criar_peca` e `ver_peca`, com um guia único para Claude e
  OpenCode. `criar_atividade` continua para o HTML livre.
- **Infraestrutura:** a peça é uma atividade do #42 por baixo, com o mesmo
  store por conversa, versões, revisão no lugar, sandbox offline, ponte MCP
  Apps e janela escondida da prévia. O kit é servido como biblioteca da
  sandbox, como o Chart.js.
- **Gravação determinística:** o roteiro roda uma vez e grava instantâneos; o
  tocador só percorre os instantâneos. A `ver_peca` grava duas vezes e acusa
  diferença. O "E se…" é outra gravação com outra entrada, nunca uma edição do
  estado no meio da execução.
- **Validação antes de publicar:** a `criar_peca` roda a `ver_peca`. Erro,
  não determinismo, linha fora do código e mais de 400 passos bloqueiam; o
  resto é aviso com valor e limite.
- **Regras com custo para o aluno** (restaurar sessão, levar o estado na
  revisão, o chip ser o passo exibido e, na cena, o portão de previsão) ficam
  no núcleo Bend `quadroview.bend`, pelo ADR 0003.
- **psychoscript fica de fora:** ele só suspende em chamada ao host e não dá
  passo por linha; a gravação determinística na sandbox basta.

## Consequências

Peças de modelos diferentes ficam com a mesma cara e o mesmo comportamento, e
o tutor sempre recebe o ponto exato. O que o kit não cobre exige um kit novo
(trabalho da Mesa) ou cai no HTML livre. Cada kit novo traz guia, limites,
avisos e testes próprios; por isso entram um de cada vez: roteiro e
estruturas primeiro, depois desenho narrado, depois cena.

O teto de 400 passos e a gravação inteira na criação limitam roteiros longos
ou interativos de verdade (jogo, simulação contínua); a cena terá um contrato
próprio, de tempo contínuo, quando chegar a vez dela.
