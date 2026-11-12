// @ts-check
/* O chat lateral inteiro (34 KiB + a árvore de mensagens) só importa quando a
   área de apoio o abre pela primeira vez (#desempenho). A área de apoio monta o
   `<div>` na hora e o loader cuida do import; o `${...}` continua vazio até lá. */
import {createLazyModule} from './lazy-module.mjs';

/**
 * Cria a fachada do chat lateral. `mount`/`openSaved` esperam o import; `element`
 * e `setVisible` respondem sem carregar — quem só quer saber o que já veio.
 * @param {() => Promise<typeof import('./sidechat.mjs')>} [importModule]
 * @returns {{load: () => Promise<typeof import('./sidechat.mjs')>, current: () => typeof import('./sidechat.mjs') | null, mount: (container: HTMLElement) => Promise<HTMLElement>, element: () => HTMLElement | null, setVisible: (visible: boolean) => void, rebindDocument: () => void, openSaved: (payload: any) => Promise<void>, reveal: (index: unknown, snippet?: unknown) => boolean}}
 * @example const sidechat = createSidechatLoader(); await sidechat.mount(document.body);
 */
export function createSidechatLoader(importModule = () => import('./sidechat.mjs')) {
  const lazy = createLazyModule({importModule, prepare: (module) => module.initSidechat()});
  return {
    load: () => lazy.load(),
    current: () => lazy.current(),
    mount: async (container) => (await lazy.load()).mountSidechat(container),
    element: () => lazy.current()?.sidechatElement() ?? null,
    setVisible: (visible) => lazy.current()?.setSidechatVisible(visible),
    rebindDocument: () => lazy.current()?.rebindSidechatDocument(),
    openSaved: async (payload) => (await lazy.load()).openSavedSidechat(payload),
    reveal: (index, snippet) => lazy.current()?.revealSidechatMessage(index, snippet) ?? false,
  };
}

const sidechat = createSidechatLoader();
/**
 * Monta o chat lateral no contêiner, importando o módulo se preciso.
 * @param {HTMLElement} container
 * @returns {Promise<HTMLElement>}
 * @example await mountSidechat(document.getElementById('support-body'));
 */
export const mountSidechat = (container) => sidechat.mount(container);
/** O nó já montado, ou `null` antes do primeiro uso.
 * @returns {HTMLElement | null} @example sidechatElement();
 */
export const sidechatElement = () => sidechat.element();
/** Mostra/esconde o chat já montado; antes da carga é inofensivo.
 * @param {boolean} visible @returns {void} @example setSidechatVisible(true);
 */
export const setSidechatVisible = (visible) => sidechat.setVisible(visible);
/** Reamarra o chat ao documento atual (a janela solta adota o nó); antes da carga é inofensivo.
 * @returns {void} @example rebindSidechatDocument();
 */
export const rebindSidechatDocument = () => sidechat.rebindDocument();
/** Importa o chat lateral (a área de apoio chama antes de montar).
 * @returns {Promise<typeof import('./sidechat.mjs')>} @example await loadSidechat();
 */
export const loadSidechat = () => sidechat.load();
/** Abre uma sessão lateral salva, importando o módulo se preciso.
 * @param {any} payload @returns {Promise<void>} @example await openSavedSidechat(saved);
 */
export const openSavedSidechat = (payload) => sidechat.openSaved(payload);
/** Rola o lateral até a mensagem de um resultado da busca global (#183).
 * @param {unknown} index @param {unknown} [snippet] @returns {boolean}
 * @example revealSidechatMessage(41, 'trecho')
 */
export const revealSidechatMessage = (index, snippet) => sidechat.reveal(index, snippet);
