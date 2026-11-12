/* O `fake-xournalpp.mjs` é um script `.mjs`: no Windows não dá para `spawn`
   direto (EFTYPE), então os testes rodam o fake pelo próprio Node. O
   `binary` recebido é ignorado de propósito — quem chama já escolheu o fake. */
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const FAKE_XOURNALPP = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fake-xournalpp.mjs');

/**
 * Spawn compatível com `runXournalpp` que executa o fake pelo Node.
 * @param {string} _binary caminho do binário do Xournal++ (ignorado)
 * @param {string[]} args argumentos do fake
 * @param {import('node:child_process').SpawnOptions} options opções do spawn
 * @returns {import('node:child_process').ChildProcess}
 * @example const child = spawnFakeXournalpp('xournalpp', ['notas.xopp', '--create-img', 'page.png'], {});
 */
export function spawnFakeXournalpp(_binary, args, options) {
  return spawn(process.execPath, [FAKE_XOURNALPP, ...args], options);
}
