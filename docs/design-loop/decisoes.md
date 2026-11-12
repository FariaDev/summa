# Decisões do Lucas (ciclo 2)

Achados que o ciclo não aplica sozinho: são gosto, mudam o sentido de um texto,
tiram ou trocam algo que ele pediu, ou batem numa decisão dele. Cada item tem as
opções, a minha recomendação e a captura que mostra o problema.

**Decidido em 2026-11-10:** o Lucas seguiu as quatro recomendações (D1 A, D2 B,
D3 B, D4 A).

## D1. Converter: o Xournal++ fica parado até 20 s sem sinal

Nota Xournal++ rodada 1, achado 1 (grave).
Captura: `rodada-1/antes/xournal/04-*`.
O plugin chama a ponte de forma síncrona (`io.popen`), e o Lua do Xournal++
não tem como mostrar nada enquanto espera.

- **A.** Manter um toque e síncrono. O aviso antes de "Continuar" já diz que o
  Xournal++ para. Medir o tempo real e recusar seleção grande.
- **B.** Dois toques: um manda ler, outro insere o texto.
- **C.** Segundo plano, com a Mesa avisando quando acabar e o texto entrando no
  próximo toque.

Recomendo **A**, com a medição. Se o normal passar de ~8 s, rever para B ou C.
Esta rodada só corrige o prazo (o host espera 60 s e o plugin 20 s) e os textos.

## D2. Cadernos a três cliques (Mais opções → Contexto → Cadernos)

Nota cadernos rodada 1, F18.
Captura: `rodada-1/antes/cadernos/biblioteca-lista-light-1440x900.png`.
Bate na decisão da #123: "nada novo no cabeçalho". Só anotado.

- **A.** Deixar como está.
- **B.** Atalho de teclado para Cadernos.
- **C.** Botão no cabeçalho do chat.

Recomendo **B**, porque não mexe no cabeçalho.

## D3. Capas de caderno na biblioteca

Ideia dele em 2026-11-07: estante de capas coloridas.

- **A.** Estante de capas.
- **B.** Lista com ícone de caderno na cor da matéria e formato (A4) como
  etiqueta.
- **C.** Lista como está.

Recomendo **B**. A estante não cabe no popover nem em 900×650 e foge dos cinzas
neutros da referência visual.

## D4. "Tentar de novo" no erro do chat lateral

Desde a rodada 3 o aviso de falha do motor tem "Tentar de novo". Hoje ele põe a
última pergunta de volta no campo e foca, sem enviar
(`rodada-4/antes/chat-solto/solto-erro-claro-380x800.png`). O avaliador da
rodada 4 sugeriu reenviar direto.

- **A.** Como está: devolve ao campo; a pessoa confere e envia.
- **B.** Reenvia na hora a mesma pergunta.
- **C.** Reenvia na hora, mas só se a falha veio antes de qualquer resposta
  parcial; senão, devolve ao campo.

Recomendo **A**. O canal do chat tem envio incerto (a entrega anterior pode ter
chegado), e reenviar sozinho pode duplicar a pergunta e gastar cota.
