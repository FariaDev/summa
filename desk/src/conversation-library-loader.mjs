// @ts-check
/* Biblioteca de conversas: o diálogo e a árvore do `chatlibraryview.core.js`
   só entram na primeira abertura (#desempenho). A partida guarda só o callback
   de retomada que o diálogo usa. */
import {createLazyModule} from './lazy-module.mjs';

/**
 * Cria a fachada da biblioteca; o `resume` fica guardado para o init tardio.
 * @param {{resume: (row: any) => Promise<boolean>}} options
 * @param {() => Promise<typeof import('./conversation-library.mjs')>} [importModule]
 * @returns {{load: () => Promise<any>, open: () => Promise<void>}}
 * @example const library = createConversationLibraryLoader({resume}); await library.open();
 */
export function createConversationLibraryLoader(options, importModule = () => import('./conversation-library.mjs')) {
  const lazy = createLazyModule({importModule});
  let facade = null;
  const backend = async () => {
    const module = await lazy.load();
    if (!facade) facade = module.initConversationLibrary(options);
    return facade;
  };
  return {load: () => lazy.load(), open: async () => { await (await backend()).open(); }};
}

let pendingOptions = null;
let library = null;
/**
 * Guarda o `resume` da partida; a biblioteca só é criada na primeira abertura.
 * @param {{resume: (row: any) => Promise<boolean>}} options
 * @returns {{open: () => Promise<void>}}
 * @example const library = mountConversationLibraryBoot({resume}); library.open();
 */
export function mountConversationLibraryBoot(options) {
  pendingOptions = options;
  library = createConversationLibraryLoader(options);
  return {open: () => (pendingOptions ? library.open() : Promise.resolve())};
}
/** Importa a biblioteca (o botão da paleta pode esperar).
 * @returns {Promise<any>} @example await loadConversationLibrary();
 */
export const loadConversationLibrary = () => library.load();
