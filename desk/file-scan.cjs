// @ts-check
'use strict';

/* Varredura recursiva de arquivos da Mesa (#133): um molde só para os PDFs da
   matéria (`courses.cjs`); os cadernos `.xopp` saíram para o Xournal++.
   Uma responsabilidade: andar a árvore (até 6 níveis) juntando os arquivos
   que o `isMatch` aceita, com o caminho canônico (realpath) e o `mtimeMs`.
   O `seen` de diretórios (por realpath) corta ciclos de symlink e pode ser
   compartilhado entre chamadas encadeadas (as raízes da matéria); a dedupe
   dos arquivos e o que cada chamador faz com o resultado ficam com quem
   chama. Mutação nenhuma: só `readdir`/`stat`/`realpath`. */

const fs = require('node:fs');
const path = require('node:path');

/**
 * @typedef {{name: string, path: string, canonical: string, mtimeMs: number}} ScannedFile
 */

/**
 * @param {any} fsImpl o `fs` de verdade ou a árvore falsa dos testes
 * @returns {(value: string) => string} o realpath nativo quando existe
 */
function realpathOf(fsImpl) {
  const realpathSync = /** @type {any} */ (fsImpl.realpathSync);
  return typeof realpathSync.native === 'function'
    ? (value) => realpathSync.native(value)
    : (value) => realpathSync(value);
}

/**
 * Varre `dir` em profundidade (na ordem do `readdir`, recursão imediata) até
 * `maxDepth` níveis, juntando os arquivos que `isMatch` aceita. Pasta já
 * vista (por realpath, em `seen`) não é varrida de novo: o ciclo de symlink
 * para. Entrada ilegível ou sem canônico é pulada, sem derrubar a pasta.
 * @param {{fs?: any, dir: string, isMatch: (name: string, stat: {isDirectory: () => boolean, isFile: () => boolean, mtimeMs: number}) => boolean, maxDepth?: number, seen?: Set<string>, result?: ScannedFile[]}} options
 * @returns {ScannedFile[]} os achados, na ordem de varredura (o `result` dado, quando houver)
 * @example scanFiles({dir: '/vault/Courses/Calc', isMatch: (name) => /\.pdf$/i.test(name)}) // [{name: 'a.pdf', path: '/vault/Courses/Calc/a.pdf', canonical: '/vault/Courses/Calc/a.pdf', mtimeMs: 123}, …]
 */
function scanFiles({fs: fsImpl = fs, dir, isMatch, maxDepth = 6, seen = new Set(), result = []}) {
  const realpath = realpathOf(fsImpl);
  /**
   * @param {string} current @param {number} depth
   */
  function walk(current, depth) {
    if (depth > maxDepth) return;
    let dirReal;
    try {
      dirReal = realpath(current);
    } catch { return; }
    if (seen.has(dirReal)) return;
    seen.add(dirReal);
    let names;
    try {
      names = fsImpl.readdirSync(current);
    } catch { return; }
    for (const name of names) {
      const full = path.join(current, name);
      let stat;
      try {
        stat = fsImpl.statSync(full);
      } catch { continue; }
      if (stat.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!isMatch(name, stat)) continue;
      let canonical;
      try {
        canonical = realpath(full);
      } catch { continue; }
      result.push({name, path: full, canonical, mtimeMs: stat.mtimeMs});
    }
  }
  walk(dir, 0);
  return result;
}

module.exports = {scanFiles};
