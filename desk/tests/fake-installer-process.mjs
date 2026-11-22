import {EventEmitter} from 'node:events';

/** Processo de instalador que já terminou, sem abrir executável.
 * @param {number} code código de saída
 * @returns {EventEmitter & {exitCode:number}}
 * @example exitedInstaller(3)
 */
export function exitedInstaller(code) {
  const child = new EventEmitter();
  child.exitCode = code;
  return child;
}
