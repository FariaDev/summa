// @ts-check
'use strict';

/* Fechamento do `opencode serve` no Windows (#165): o binário do npm é um shim
   `.cmd`, então o filho do spawn é um `cmd.exe`. `child.kill` derruba só o cmd
   e o `node` neto continua vivo segurando o pipe do stdout; o main fica com o
   handle aberto e não sai. O handle do spawn prova que o cmd é nosso, então o
   `taskkill /T /F` desce a árvore sem tocar em processo de outro dono. */

/**
 * Sinaliza o serve. No Windows mata a árvore do cmd; no POSIX usa o
 * ChildProcess (o serve é detached e lidera o próprio grupo).
 * @param {{platform: NodeJS.Platform, pid: number, name: NodeJS.Signals,
 *   child: {kill?: (signal: NodeJS.Signals) => unknown},
 *   signalGroup: (target: {pid: number, pgid: number, signal: string}) => void}} input
 * @returns {void}
 * @example signalServeChild({platform: 'win32', pid: 42, name: 'SIGTERM', child, signalGroup});
 */
function signalServeChild({platform, pid, name, child, signalGroup}) {
  /* Sem pid o handle não prova nada: o `child.kill` do Node ainda é o caminho
     seguro (spawn que falhou não abre processo). */
  if (platform === 'win32' && pid) {
    try { signalGroup({pid, pgid: pid, signal: name}); } catch { /* o grupo já saiu */ }
    return;
  }
  try { child.kill?.(name); } catch { /* o filho já saiu */ }
}

/**
 * Fecha os pipes do serve depois do sinal final. No Windows o neto do shim
 * pode segurar a ponta de escrita mesmo depois do exit do cmd, e o main não
 * termina enquanto o handle do stdout existir.
 * @param {{stdout?: {destroy?: () => void}, stderr?: {destroy?: () => void}}} child
 * @returns {void}
 * @example releaseServeStdio(child);
 */
function releaseServeStdio(child) {
  try { child.stdout?.destroy?.(); } catch { /* pipe já fechado */ }
  try { child.stderr?.destroy?.(); } catch { /* pipe já fechado */ }
}

module.exports = {signalServeChild, releaseServeStdio};
