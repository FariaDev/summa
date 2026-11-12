'use strict';

/* Canal de resultado dos runners Electron: escreve o JSON entre `__RESULT__`
   e só encerra depois que o stdout aceitou todos os bytes. `app.exit()` não
   emite os eventos de saída e mata o processo na hora; com o stdout num cano
   (o `spawnSync` dos testes), a escrita é assíncrona e o JSON grande chegava
   truncado no macOS — o `__RESULT__` nunca fechava e o teste dizia "não
   devolveu resultado" (CI do #95). O callback da escrita só dispara com o
   último pedaço entregue ao cano.

   Resultado sem `ok` é sucesso: os cenários de `katex-loader`,
   `markup-live-loss` e `cards-math` devolvem dados sem `ok` e as asserções
   ficam no teste; só `ok: false` é falha do runner (#95). */

/**
 * Escreve o resultado do runner e chama `exit` só depois do flush do stdout.
 * @param {object} result Resultado serializável; só `ok: false` sai com 1.
 * @param {(code: number) => void} [exit] Encerramento do processo (o runner passa `app.exit`).
 * @example writeResultAndExit({ok: true}, (code) => app.exit(code));
 */
function writeResultAndExit(result, exit = (code) => process.exit(code)) {
  process.stdout.write(`\n__RESULT__ ${JSON.stringify(result)}\n`, () => exit(result.ok === false ? 1 : 0));
}

module.exports = {writeResultAndExit};
