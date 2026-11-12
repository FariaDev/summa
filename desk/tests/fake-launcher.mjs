/* Lançador falso da biblioteca de cadernos (#133): grava cada `spawn` e cada
   `shell.openPath` em vez de abrir processo ou janela. É o que prova que a
   recusa não chama processo nenhum e que o aceite chama com o arquivo certo. */
import {EventEmitter} from 'node:events';

export function fakeLauncher() {
  const calls = [];
  const launcher = {
    calls,
    spawnError: null,
    spawnThrows: null,
    spawn(cmd, args, opts) {
      calls.push({kind: 'spawn', cmd, args: [...args], opts: {...opts}});
      if (launcher.spawnThrows) throw launcher.spawnThrows;
      const child = new EventEmitter();
      child.unref = () => {};
      const pendingError = launcher.spawnError;
      if (pendingError) queueMicrotask(() => child.emit('error', pendingError));
      else queueMicrotask(() => child.emit('spawn'));
      return child;
    },
    shell: {
      openPath(target) {
        calls.push({kind: 'openPath', target});
        return Promise.resolve('');
      },
    },
  };
  return launcher;
}
