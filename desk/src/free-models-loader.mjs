import {createLazyModule} from './lazy-module.mjs';

/**
 * Mantém o fluxo dos modelos grátis fora da partida (#desempenho): o módulo só
 * entra quando o diálogo é pedido, quando as Configurações pintam o bloco do
 * OpenCode ou quando a pessoa escolhe um modelo pago do Zen.
 * @param {() => Promise<typeof import('./free-models.mjs')>} importModule
 * @returns {{init: () => Promise<void>, openFlow: () => Promise<void>, paintSettings: () => Promise<void>, confirmPaid: () => Promise<boolean>, current: () => any | null}}
 * @example const free = createFreeModelsLoader(); await free.openFlow();
 */
export function createFreeModelsLoader(importModule = () => import('./free-models.mjs')) {
  const lazy = createLazyModule({importModule, prepare: (module) => module.initFreeModels()});
  return {
    init: () => lazy.load().then(() => undefined),
    openFlow: async () => (await lazy.load()).openFreeModelsFlow(),
    paintSettings: async () => (await lazy.load()).paintFreeSettings(),
    confirmPaid: async () => (await lazy.load()).confirmPaidModel(),
    current: () => lazy.current(),
  };
}

const freeModels = createFreeModelsLoader();
/** Prepara o fluxo dos modelos grátis sem abrir o diálogo.
 * @returns {Promise<void>}
 * @example await initFreeModels();
 */
export const initFreeModels = () => freeModels.init();
/** Abre o diálogo dos modelos grátis (importa o módulo no primeiro uso).
 * @returns {Promise<void>}
 * @example await openFreeModelsFlow();
 */
export const openFreeModelsFlow = () => freeModels.openFlow();
/** Pinta o bloco dos modelos grátis nas Configurações.
 * @returns {Promise<void>}
 * @example await paintFreeSettings();
 */
export const paintFreeSettings = () => freeModels.paintSettings();
/** Confirma a escolha de um modelo pago do Zen.
 * @returns {Promise<boolean>} `true` quando a pessoa confirma
 * @example const ok = await confirmPaidModel();
 */
export const confirmPaidModel = () => freeModels.confirmPaid();

/**
 * Cobre o pedido "UseFreeModels" (coluna do tutor e primeira abertura) antes de
 * o módulo carregar: o evento dispara a carga e abre o fluxo; depois dela, o
 * ouvinte do próprio `free-models.mjs` assume, sem abrir duas vezes.
 * @param {{loader?: ReturnType<typeof createFreeModelsLoader>, window?: Window, toast?: (message: string) => void}} [options]
 * @returns {() => void} remove o ouvinte do evento
 * @example const unbind = mountFreeModelsBoot({window, toast});
 */
export function mountFreeModelsBoot({loader = freeModels, window: win = globalThis.window, toast = () => {}} = {}) {
  let opening = false;
  const onOpen = () => {
    if (loader.current() || opening) return;
    opening = true;
    loader.openFlow()
      .catch((error) => toast(error?.message || String(error)))
      .finally(() => { opening = false; });
  };
  win.addEventListener('desk-open-free-models', onOpen);
  return () => win.removeEventListener('desk-open-free-models', onOpen);
}
