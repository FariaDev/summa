// @ts-check
/* Busca de estudos (62 KiB, núcleo incluso) fora da partida (#desempenho). Os
   gatilhos que existem antes dela — Ctrl/Cmd+Shift+F e o botão da barra — são
   capturados aqui; o init do módulo (diálogo, catálogo e teclado) roda no
   primeiro uso e recebe os callbacks guardados na partida. */
import {createLazyModule} from './lazy-module.mjs';

/**
 * Cria a fachada da busca de estudos.
 * @param {() => Promise<typeof import('./study-search.mjs')>} [importModule]
 * @returns {{init: (options?: object) => void, load: () => Promise<any>, open: (preset?: object) => Promise<any>, close: () => void, current: () => any | null}}
 * @example const search = createStudySearchLoader(); search.init({onOpenResult}); await search.open();
 */
export function createStudySearchLoader(importModule = () => import('./study-search.mjs')) {
  let options = {};
  const lazy = createLazyModule({importModule, prepare: (module) => module.initStudySearch(options)});
  return {
    init: (next = {}) => { options = {...options, ...next}; },
    load: () => lazy.load(),
    open: async (preset = {}) => {
      const module = await lazy.load();
      return module.openStudySearch(preset);
    },
    close: () => lazy.current()?.closeStudySearch(),
    current: () => lazy.current(),
  };
}

const studySearch = createStudySearchLoader();
/**
 * Guarda os callbacks da busca e liga os gatilhos que a partida já tem.
 * @param {{onOpenResult?: Function, onAnnotate?: Function, notify?: (message: string) => void, document?: Document}} options
 * @returns {{open: (preset?: object) => Promise<any>, close: () => void}}
 * @example mountStudySearchBoot({onOpenResult, notify: toast});
 */
export function mountStudySearchBoot(options = {}) {
  const doc = options.document || globalThis.document;
  const {notify = () => {}, ...rest} = options;
  studySearch.init(rest);
  const open = (preset = {}) => studySearch.open(preset).catch((error) => { notify(error?.message || String(error)); });
  const onKey = (event) => {
    if (studySearch.current() || event.defaultPrevented) return;
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || String(event.key || '').toLowerCase() !== 'f') return;
    event.preventDefault();
    open({autoSearch: true});
  };
  const onClick = (event) => {
    if (studySearch.current()) return;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const button = path.find((node) => node?.id === 'study-search-open' || node?.dataset?.studyAction === 'study-search');
    if (!button) return;
    event.preventDefault();
    open({autoSearch: true});
  };
  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('click', onClick);
  return {open, close: () => studySearch.close()};
}

/** Abre a busca, importando o módulo na primeira vez.
 * @param {object} [preset] @returns {Promise<any>} @example await openStudySearch();
 */
export const openStudySearch = (preset = {}) => studySearch.open(preset);
/** Fecha a busca se ela já foi importada.
 * @returns {void} @example closeStudySearch();
 */
export const closeStudySearch = () => studySearch.close();
