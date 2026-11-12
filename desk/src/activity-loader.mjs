// @ts-check
/* Renderer das atividades interativas (56 KiB) fora da partida (#desempenho).
   Ele tem efeito de carga — hidratar slots do histórico —, então um observador
   pequeno dispara o import no primeiro slot e o host existente assume daí. */
import {createLazyModule} from './lazy-module.mjs';
import {watchActivityColumn} from './activity-column.mjs';

/**
 * Cria a fachada do host de atividades.
 * @param {() => Promise<typeof import('./activity.mjs')>} [importModule]
 * @returns {{init: (options?: object) => void, load: () => Promise<any>, current: () => any | null}}
 * @example const activity = createActivityLoader(); activity.init({composer}); await activity.load();
 */
export function createActivityLoader(importModule = () => import('./activity.mjs')) {
  const lazy = createLazyModule({importModule});
  let options = {};
  let host = null;
  return {
    init: (next = {}) => { options = {...options, ...next}; },
    load: async () => {
      const module = await lazy.load();
      if (!host) host = module.initActivityHost(options);
      return host;
    },
    current: () => host,
  };
}

const activity = createActivityLoader();
/**
 * Carrega o host de atividades agora (idempotente). A publicação de fim de
 * turno (H4) precisa do host ligado ANTES do evento `desk-activity`, senão o
 * evento chega sem slot e para no vazio.
 * @returns {Promise<any>}
 * @example await ensureActivityHost();
 */
export function ensureActivityHost() {
  return activity.load();
}
/**
 * Liga o host de atividades ao primeiro slot (histórico ou novo) sem entrar na
 * partida quando a conversa não tem atividade.
 * @param {any} [options] opções do `initActivityHost`
 * @returns {{load: () => Promise<any>}} `load` para testes e chamadas tardias
 * @example const host = mountActivityBoot({composer: () => document.querySelector('#prompt')});
 */
export function mountActivityBoot(options = {}) {
  activity.init(options);
  const doc = options.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return {load: () => activity.load()};
  watchActivityColumn(doc, options.desktop || globalThis.window?.desk);
  const start = () => { activity.load().catch(() => {}); };
  if (doc.querySelector?.('.activity-slot')) start();
  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node?.nodeType !== 1) continue;
          const element = /** @type {Element} */ (node);
          if (element.matches?.('.activity-slot') || element.querySelector?.('.activity-slot')) {
            observer.disconnect();
            start();
            return;
          }
        }
      }
    })
    : null;
  observer?.observe(doc.body || doc.documentElement, {childList: true, subtree: true});
  return {load: () => activity.load()};
}
