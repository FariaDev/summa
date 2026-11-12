// @ts-check
/* Biblioteca de cadernos (#133) fora da partida (#desempenho): o item vive no
   menu Mais opções, mas o painel só é necessário no primeiro uso (ou no
   atalho). O boot guarda a promessa do import dinâmico (`notebooks-desk.mjs`
   → `notebooks.mjs`): dois cliques não avaliam o módulo duas vezes, e o `init`
   (ouvintes e primeira pintura do painel) roda uma vez, no primeiro uso. */
import {createLazyModule} from './lazy-module.mjs';

/**
 * Carregador da biblioteca de cadernos: importa e liga uma vez, no primeiro
 * uso. O `closePops` é o mesmo que o cabeçalho do tutor passava no init — ele
 * fecha os popovers do cabeçalho antes de o caderno abrir (`notebooks.mjs`
 * chama `deps.closePops?.()` no abrir). Falha no import não marca como pronto:
 * a próxima abertura tenta de novo (o mesmo molde de `lazy-module.mjs`).
 * @param {{importModule: () => Promise<any>}} options
 * @returns {{ensure: (closePops?: () => void) => Promise<any>, ready: () => boolean, current: () => any | null}}
 * @example
 * const boot = createNotebooksBoot({importModule: () => import('./notebooks-desk.mjs')});
 * await boot.ensure(() => closeTutorPops());
 */
export function createNotebooksBoot({importModule}) {
  /** @type {() => void} */
  let closePops = () => {};
  const lazy = createLazyModule({importModule, prepare: (module) => module.initDeskNotebooks(closePops)});
  return {
    ensure(nextClosePops) {
      if (typeof nextClosePops === 'function') closePops = nextClosePops;
      return lazy.load();
    },
    ready: () => lazy.ready(),
    current: () => lazy.current(),
  };
}

const defaultBoot = createNotebooksBoot({importModule: () => import('./notebooks-desk.mjs')});

/**
 * Garante a biblioteca ligada no primeiro uso (o item Cadernos do menu Mais
 * opções ou o atalho). Depois de carregado, toda abertura passa pelo módulo já pronto.
 * @param {() => void} [closePops] fecha os popovers do cabeçalho antes de abrir
 * @returns {Promise<any>} o módulo `notebooks-desk.mjs` já ligado
 * @example ensureNotebooks(() => closeTutorPops());
 */
export function ensureNotebooks(closePops) {
  return defaultBoot.ensure(closePops);
}

/**
 * Diz se a biblioteca já entrou (sem disparar o import).
 * @returns {boolean}
 * @example notebooksReady() // false antes do primeiro Contexto
 */
export function notebooksReady() {
  return defaultBoot.ready();
}

/** Fecha o painel Cadernos se ele já entrou, sem carregar o módulo nem mexer
 *  no foco (o Contexto vai abrir no lugar).
 *  @returns {void}
 *  @example closeNotebooks();
 */
export function closeNotebooks() {
  defaultBoot.current()?.closeNotebooks?.();
}

/** O atalho global (D2) é o mesmo do catálogo de `keys.mjs`. O preload do
 *  remap engole o combo atual e reenvia o padrão, então aqui só o padrão.
 *  @type {boolean} */
let shortcutBound = false;

/**
 * Liga o atalho de Cadernos no boot (D2): abre o mesmo popover do item do menu,
 * já com a biblioteca ligada pelo `ensureNotebooks`. O combo é
 * o padrão `CmdOrCtrl+Shift+K`; quem remapeia no editor continua caindo aqui
 * porque o preload reenvia o padrão. Diálogo modal aberto fica de fora.
 * @param {() => void} [closePops] fecha os popovers do cabeçalho antes de abrir
 * @param {(text: string) => void} [notify] aviso quando o import falha
 * @returns {void}
 * @example bindNotebooksShortcut(() => closeTutorPops(), text => toast(text));
 */
export function bindNotebooksShortcut(closePops, notify) {
  if (shortcutBound || typeof window === 'undefined' || typeof document === 'undefined') return;
  shortcutBound = true;
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');
  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.repeat || event.isComposing) return;
    if (event.altKey || !event.shiftKey) return;
    if (isMac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return;
    if (String(event.key || '').toLowerCase() !== 'k') return;
    if (document.querySelector('dialog[open]')) return;
    event.preventDefault();
    ensureNotebooks(closePops)
      .then((module) => module.toggleNotebooks?.())
      .catch((error) => {
        if (typeof notify === 'function') notify(error instanceof Error ? error.message : String(error));
      });
  });
}
