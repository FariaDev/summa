// @ts-check
'use strict';

/* Onde mora a cópia do OpenCode que a Mesa instala (#94, passo 1): no runtime
   da Mesa, em `opencode/<versão>/bin/`, fora de `~/.opencode`. A Mesa nunca
   escreve, apaga nem move nada na pasta do OpenCode da pessoa; o binário que
   ela baixa fica só no runtime que o updater ignora.

   A versão fixa vem de `src/tested-versions.json`, a mesma fonte que o
   instalador lê: uma troca de versão é uma linha só, sem constante duplicada.

   Licença: o OpenCode é MIT (`github.com/anomalyco/opencode`). O pacote npm
   não traz o `LICENSE`; a Mesa baixa o binário na máquina da pessoa e não o
   redistribui, então o aviso fica nos comentários deste módulo e do instalador
   (`opencode-install.cjs`). */

const path = require('node:path');
const TESTED_VERSIONS = require('../tested-versions.json');

const PINNED_VERSION = String(TESTED_VERSIONS.opencode || '');

/** @param {unknown} runtime */
function assertRuntime(runtime) {
  if (typeof runtime !== 'string' || !runtime) {
    throw new TypeError(`OpenCode da Mesa: runtime inválido (${JSON.stringify(runtime)}); esperado o caminho do runtime da Mesa`);
  }
}

/**
 * A pasta da cópia própria de uma versão do OpenCode.
 * @param {{runtime: string, version?: string}} input
 * @returns {string}
 * @example openCodeRuntimeDirectory({runtime: '/r'}) // '/r/opencode/2.2.4'
 */
function openCodeRuntimeDirectory({runtime, version = PINNED_VERSION}) {
  assertRuntime(runtime);
  if (!version) throw new TypeError(`OpenCode da Mesa: versão inválida (${JSON.stringify(version)}); esperado a versão fixa em src/tested-versions.json`);
  return path.join(runtime, 'opencode', version);
}

/**
 * O binário da cópia própria (no Windows, `opencode.exe`).
 * @param {{runtime: string, version?: string, platform?: NodeJS.Platform}} input
 * @returns {string}
 * @example openCodeRuntimeBinary({runtime: '/r', platform: 'linux'}) // '/r/opencode/2.2.4/bin/opencode'
 */
function openCodeRuntimeBinary({runtime, version = PINNED_VERSION, platform = process.platform}) {
  return path.join(openCodeRuntimeDirectory({runtime, version}), 'bin', platform === 'win32' ? 'opencode.exe' : 'opencode');
}

module.exports = {PINNED_VERSION, openCodeRuntimeDirectory, openCodeRuntimeBinary};
