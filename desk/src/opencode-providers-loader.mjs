import {createLazyModule} from './lazy-module.mjs';

/**
 * Inicializa os painéis OpenCode uma vez, no primeiro acesso à Configuração/setup.
 * @param {() => Promise<typeof import('./opencode-providers.mjs')>} importModule
 * @returns {{init: () => Promise<any>, refresh: (...args: Parameters<typeof import('./opencode-providers.mjs').refreshOpenCodeProviders>) => Promise<void>, cancel: (...args: Parameters<typeof import('./opencode-providers.mjs').cancelOpenCodeProviderLogin>) => void}}
 * @example await providers.init(); await providers.refresh('settings');
 */
export function createOpenCodeProvidersLoader(importModule = () => import('./opencode-providers.mjs')) {
  const lazy = createLazyModule({importModule, prepare: (module) => module.initOpenCodeProviders()});
  return {
    init: () => lazy.load(),
    refresh: async (...args) => (await lazy.load()).refreshOpenCodeProviders(...args),
    /* Sem módulo não há painel nem login pendente: cancelar não deve forçar a
       carga de 60 KiB só para não fazer nada. */
    cancel: (...args) => lazy.current()?.cancelOpenCodeProviderLogin(...args),
  };
}

const providers = createOpenCodeProvidersLoader();
/** Inicializa os painéis OpenCode (importa o módulo no primeiro acesso).
 * @returns {Promise<any>} o módulo carregado
 * @example await initOpenCodeProviders();
 */
export const initOpenCodeProviders = () => providers.init();
/** Atualiza os provedores do OpenCode na tela que pediu.
 * @param {...any} args tela de origem (contrato do `refreshOpenCodeProviders`)
 * @returns {Promise<void>}
 * @example await refreshOpenCodeProviders('settings');
 */
export const refreshOpenCodeProviders = (...args) => providers.refresh(...args);
/** Cancela um login de provedor pendente, sem carregar o módulo se ele nunca abriu.
 * @param {...any} args provedor/sessão do login (contrato do `cancelOpenCodeProviderLogin`)
 * @returns {void}
 * @example cancelOpenCodeProviderLogin('opencode');
 */
export const cancelOpenCodeProviderLogin = (...args) => providers.cancel(...args);
