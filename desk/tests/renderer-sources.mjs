/* As folhas e módulos do renderer moram na raiz de `src/` e nas pastas de
   família da #43 fase 4 (`src/chat/`, `src/pdf/`...). As varreduras de CSS
   olham essas pastas; `materials/`, `figures/` e as demais têm regra própria. */
import fs from 'node:fs';
import path from 'node:path';

export const FAMILY_DIRS = ['chat', 'sidechat', 'composer', 'queue', 'settings', 'pdf', 'history', 'phone', 'study', 'tutor', 'mascote', 'setup', 'worklog'];

/**
 * Arquivos do renderer em `src/` (raiz + pastas de família), relativos a `src/`.
 * @param {string} desk pasta `desk/`
 * @param {(name: string) => boolean} keep filtro pelo nome
 * @returns {string[]} caminhos como `chat/chat.mjs` ou `keys.mjs`, com `/`
 * @example rendererSources(desk, (name) => name.endsWith('.css')) // ['composer/composer.css', ...]
 */
export function rendererSources(desk, keep) {
  const src = path.join(desk, 'src');
  const roots = ['', ...FAMILY_DIRS];
  return roots.flatMap((dir) => fs.readdirSync(path.join(src, dir), {withFileTypes: true})
    .filter((entry) => entry.isFile() && keep(entry.name))
    .map((entry) => (dir ? `${dir}/${entry.name}` : entry.name)));
}
