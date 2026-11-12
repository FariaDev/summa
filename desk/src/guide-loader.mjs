// @ts-check
/* Guia da Mesa (`#help-dialog`): o corpo mora no HTML e o aplicador só entra na
   primeira abertura (#desempenho). Trocar o idioma antes disso não pinta nada —
   o guia nasce já no idioma atual. */
import {createLazyModule} from './lazy-module.mjs';

/**
 * Cria a fachada do Guia. `open` espera o import; `relabel` só repinta o que já
 * está carregado.
 * @param {() => Promise<typeof import('./guide.mjs')>} [importModule]
 * @returns {{load: () => Promise<typeof import('./guide.mjs')>, current: () => typeof import('./guide.mjs') | null, open: (section?: string) => Promise<void>, relabel: () => void}}
 * @example const guide = createGuideLoader(); await guide.open('tutor');
 */
export function createGuideLoader(importModule = () => import('./guide.mjs')) {
  const lazy = createLazyModule({importModule});
  return {
    load: () => lazy.load(),
    current: () => lazy.current(),
    open: async (section = '') => { await lazy.load(); lazy.current()?.openGuide(section); },
    relabel: () => lazy.current()?.relabelGuide(),
  };
}

const guide = createGuideLoader();
/** Abre o guia na seção pedida, importando o aplicador na primeira vez.
 * @param {string} [section] @returns {Promise<void>}
 * @example await openGuide('tutor');
 */
export const openGuide = (section = '') => guide.open(section);
/** Troca de idioma: repinta o guia só se ele já foi aberto.
 * @returns {void} @example relabelGuide();
 */
export const relabelGuide = () => guide.relabel();
/** Importa o aplicador do guia (testes e chamadas que precisam esperar).
 * @returns {Promise<typeof import('./guide.mjs')>} @example await loadGuide();
 */
export const loadGuide = () => guide.load();
