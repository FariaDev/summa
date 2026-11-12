import {createLazyModule} from './lazy-module.mjs';

/**
 * Adia e memoiza o núcleo de avisos até uma linha precisar ser pintada. O
 * artefato gerado só tem `export default`; o namespace é desembrulhado aqui.
 * @param {() => Promise<{default: any}>} importModule
 * @returns {{load: () => Promise<any>, current: () => any | null}}
 * @example const core = createNoticeCoreLoader(() => import('./generated/updatenotice.core.js')); await core.load();
 */
export function createNoticeCoreLoader(importModule = () => import('./generated/updatenotice.core.js')) {
  const lazy = createLazyModule({importModule: () => importModule().then((module) => module.default)});
  return {load: () => lazy.load(), current: () => lazy.current()};
}
