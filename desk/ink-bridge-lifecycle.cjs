// @ts-check
'use strict';

/* Ciclo de vida da ponte local da tinta (#159, B4): serializa `start`/`close`
   para o close antigo não apagar o arquivo do servidor novo e só remove o
   arquivo de descoberta quando ele ainda pertence ao servidor que fecha. */

const fs = require('node:fs');

/**
 * Fila de start/close: uma operação de cada vez, na ordem em que chegaram.
 * @returns {{run: <T>(task: () => Promise<T>) => Promise<T>}}
 * @example const queue = createLifecycleQueue(); await queue.run(() => host.close());
 */
function createLifecycleQueue() {
  /** @type {Promise<unknown>} */
  let tail = Promise.resolve();
  return {
    run(task) {
      const run = tail.then(task, task);
      tail = run.then(() => {}, () => {});
      return run;
    },
  };
}

/**
 * Apaga o arquivo de descoberta só se token e porta ainda forem do servidor
 * que está fechando; um servidor novo que já escreveu o arquivo fica intacto.
 * @param {string} bridgeFile caminho de `ink-convert-bridge.json`
 * @param {string} ownedToken token do servidor que fecha
 * @param {number} ownedPort porta do servidor que fecha
 * @returns {void}
 * @example removeOwnedBridge('/r/ink-convert-bridge.json', token, port);
 */
function removeOwnedBridge(bridgeFile, ownedToken, ownedPort) {
  if (!ownedToken || !ownedPort) return;
  try {
    const current = JSON.parse(fs.readFileSync(bridgeFile, 'utf8'));
    if (current && current.token === ownedToken && Number(current.port) === ownedPort) {
      fs.rmSync(bridgeFile, {force: true});
    }
  } catch { /* arquivo ausente/ilegível: nada a apagar */ }
}

/**
 * Sonda se um PID ainda existe (`0` não envia sinal). `EPERM` é processo vivo
 * de outro dono: conta como vivo. Vale também no Windows (#212).
 * @param {number} pid
 * @returns {boolean}
 * @example processAlive(process.pid) // true
 */
function processAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return !!error && /** @type {NodeJS.ErrnoException} */ (error).code === 'EPERM'; }
}

/**
 * Apaga o arquivo de descoberta que ficou de um processo morto (#212). Sem
 * `pid` (arquivo de versão anterior) ou com o PID vivo, não apaga: duas Mesas
 * podem estar abertas e o arquivo da outra instância não é órfão. PID
 * reaproveitado parece vivo e o arquivo fica — o lado seguro.
 * @param {string} bridgeFile caminho de `ink-convert-bridge.json`
 * @returns {boolean} `true` se apagou
 * @example removeOrphanBridge('/r/ink-convert-bridge.json');
 */
function removeOrphanBridge(bridgeFile) {
  let current;
  try { current = JSON.parse(fs.readFileSync(bridgeFile, 'utf8')); } catch { return false; }
  const pid = Number(current && current.pid);
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return false;
  if (processAlive(pid)) return false;
  try { fs.rmSync(bridgeFile, {force: true}); return true; } catch { return false; }
}

/**
 * Fecha um servidor HTTP com teto de 1 s (conexão em voo não trava o app).
 * @param {import('node:http').Server|null} server servidor a fechar
 * @returns {Promise<void>}
 * @example await closeServer(server);
 */
async function closeServer(server) {
  if (!server) return;
  await /** @type {Promise<void>} */ (new Promise((resolve) => {
    try { server.close(() => resolve()); } catch { resolve(); }
    setTimeout(resolve, 1000).unref();
  }));
}

module.exports = {createLifecycleQueue, removeOwnedBridge, removeOrphanBridge, closeServer};
