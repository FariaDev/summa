'use strict';

const fs = require('node:fs');

/**
 * Autoriza um caderno `.xopp` na lista viva (`allowedXopp`):
 * guarda o caminho cru E o canônico (`realpath`), os quatro consumidores
 * (save-state, tutor-prompt, sidechat, end-day-save) consultam o cru e a
 * leitura (`ler_caderno`) compara o realpath da entrada com o canônico.
 * Se o `realpath` falhar, não guarda nada.
 * @param {Set<string>} allowedXopp lista viva de autorização.
 * @param {string} rawPath caminho como ele veio (cru).
 * @param {(value: string) => string} [realpath] resolução canônica (padrão: `fs.realpathSync.native`).
 * @returns {void}
 * @example
 * const allowed = new Set();
 * authorizeXopp(allowed, '/cofre/aula.xopp');
 * allowed.has('/cofre/aula.xopp') // true
 * allowed.has(fs.realpathSync.native('/cofre/aula.xopp')) // true
 */
/* O padrão é o realpath nativo, o mesmo da leitura (`authorizedPath`): no macOS o
   JS devolve a caixa digitada e o nativo a do disco (revisão do e0edfd81). */
function nativeRealpath(value) {
  return (fs.realpathSync.native || fs.realpathSync)(value);
}

function authorizeXopp(allowedXopp, rawPath, realpath = nativeRealpath) {
  if (!allowedXopp || typeof allowedXopp.add !== 'function') return;
  if (typeof rawPath !== 'string' || !rawPath) return;
  let canonical;
  try {
    canonical = realpath(rawPath);
  } catch {
    return;
  }
  allowedXopp.add(rawPath);
  allowedXopp.add(canonical);
}

module.exports = {authorizeXopp};
