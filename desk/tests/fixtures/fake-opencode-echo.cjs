/* Fake do OpenCode para o teste do comando do PowerShell (#138): carregado por
   `NODE_OPTIONS=--require`, lê o stdin e grava os argumentos recebidos, saíndo
   antes de o Node tentar resolver o script `run`. A leitura é síncrona porque
   o Node resolveria o `run` (inexistente) e morreria antes de um 'end'
   assíncrono. O caminho do arquivo de saída vem em `MESA_FAKE_OPENCODE_LOG`. */

const fs = require('node:fs');

const input = (() => {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
})();

fs.writeFileSync(process.env.MESA_FAKE_OPENCODE_LOG, JSON.stringify({argv: process.argv.slice(2), stdin: input}));
process.exit(0);
