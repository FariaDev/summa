/* Lista viva de `.xopp` como o main a monta: cada caminho cru passa pelo
   `authorizeXopp` (cru + canônico). Testes que montavam `[raw]` à mão
   quebravam no macOS e em tmpdir com symlink, onde o `realpath` da entrada
   não é o cru (`/var/folders` → `/private/var/folders`). */
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {authorizeXopp} = require('../xopp-authorization.cjs');

/**
 * Autoriza os caminhos na ordem dada, pelo caminho real de produção.
 * @param {...string} paths caminhos crus, como o aluno abriu
 * @returns {Set<string>} lista viva com o cru e o canônico de cada um
 * @example const allowed = authorizedXopp('/notas/aula.xopp');
 */
export function authorizedXopp(...paths) {
  const allowed = new Set();
  for (const file of paths) authorizeXopp(allowed, file);
  return allowed;
}
