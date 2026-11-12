import {EventEmitter} from 'node:events';

/* Spawn falso do shell de login (#desempenho): devolve um filho no formato do
   `child_process.spawn` sem abrir processo. Modos: `close` (stdout + fim),
   `hang` (não emite nada, o prazo do chamador decide), `error` (emite 'error')
   e `throw` (o próprio spawn falha). */

/**
 * @param {{mode?: 'close'|'hang'|'error'|'throw', stdout?: string, delayMs?: number}} [options]
 * @returns {{spawnProcess: Function, calls: Array<{shell: string, args: string[], options: object}>}}
 * @example const {spawnProcess} = fakeShellSpawn({mode: 'hang'});
 */
export function fakeShellSpawn({mode = 'close', stdout = '', delayMs = 5} = {}) {
  const calls = [];
  const spawnProcess = (shell, args, options) => {
    calls.push({shell, args, options});
    if (mode === 'throw') throw new Error('spawn falhou');
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stdout.setEncoding = () => {};
    child.killed = false;
    child.kill = () => { child.killed = true; };
    if (mode === 'error') {
      setTimeout(() => child.emit('error', new Error('spawn falhou')), 0);
      return child;
    }
    if (mode === 'hang') return child;
    setTimeout(() => {
      if (child.killed) return;
      if (stdout) child.stdout.emit('data', stdout);
      child.emit('close', 0);
    }, delayMs);
    return child;
  };
  return {spawnProcess, calls};
}
