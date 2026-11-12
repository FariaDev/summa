import {after} from 'node:test';

/* Os timers de parada do `opencode serve` são `unref` de propósito: o app não
   fica preso a eles (opencode-process.cjs, opencode-orphans.cjs). No executor de
   testes do Node 22 (o mínimo do `engines`), um teste que espera por eles vê o
   loop esvaziar e é cancelado ("Promise resolution is still pending but the
   event loop has already resolved"); no Node 24 não. Isto segura o loop até o
   fim do arquivo, sem mudar os timers do app.

   @returns {void}
   @example holdEventLoopUntilFileEnds(); // no topo do arquivo de teste */
export function holdEventLoopUntilFileEnds() {
  const handle = setInterval(() => {}, 1 << 30);
  after(() => clearInterval(handle));
}
