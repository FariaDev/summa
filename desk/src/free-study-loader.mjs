import {createLazyModule} from './lazy-module.mjs';
import {S} from './state.mjs';
import {isFreeData} from './free-study-base.mjs';

/**
 * Mantém a aba Livre fora da partida (#desempenho): o módulo só entra quando a
 * aba aparece (workspace livre), um pedido de PDF com o tutor abre ou o tutor
 * entrega um material. `init` também liga os ouvintes internos do módulo.
 * @param {() => Promise<typeof import('./free-study.mjs')>} importModule
 * @returns {{init: () => Promise<void>, openTutorPdfDialog: (...args: Parameters<typeof import('./free-study.mjs').openTutorPdfDialog>) => Promise<void>, receiveWorkspace: (data: object) => Promise<void>, receiveTutorMaterial: (data: object) => Promise<void>, current: () => any | null}}
 * @example const free = createFreeStudyLoader(); await free.openTutorPdfDialog('Lista 3');
 */
export function createFreeStudyLoader(importModule = () => import('./free-study.mjs')) {
  const lazy = createLazyModule({importModule, prepare: (module) => module.initFreeStudy()});
  return {
    init: () => lazy.load().then(() => undefined),
    openTutorPdfDialog: async (...args) => (await lazy.load()).openTutorPdfDialog(...args),
    receiveWorkspace: async (data) => (await lazy.load()).receiveFreeWorkspace(data),
    receiveTutorMaterial: async (data) => (await lazy.load()).receiveFreeTutorMaterial(data),
    current: () => lazy.current(),
  };
}

const freeStudy = createFreeStudyLoader();
/** Prepara a aba Livre (importa o módulo e liga os ouvintes internos) sem abrir nada.
 * @returns {Promise<void>}
 * @example await initFreeStudy();
 */
export const initFreeStudy = () => freeStudy.init();
/** Abre o diálogo de pedido de PDF ao tutor na aba Livre.
 * @param {...any} args semente do pedido (contrato do `openTutorPdfDialog` de `free-study.mjs`)
 * @returns {Promise<void>}
 * @example await openTutorPdfDialog('Lista 3');
 */
export const openTutorPdfDialog = (...args) => freeStudy.openTutorPdfDialog(...args);

/* Um PDF preparado pelo tutor também mora neste módulo, inclusive nas matérias
   comuns: o `#tutor-material-status` e a prévia vêm do `receive` dele. */
function hasTutorPdfDraft(data) {
  return !!(data?.pdfDraft || data?.workspace?.pdfDraft);
}

/**
 * Liga os fatos que precisam carregar a aba Livre antes do módulo: o primeiro
 * `desk-workspace` livre (a aba abrindo), um `desk-chrome` com o workspace já
 * livre e um material preparado que chegue antes do primeiro desenho. O evento
 * que disparou a carga é repassado ao módulo; depois dela, os ouvintes dele
 * assumem. Fica fora do `free-study.mjs` para a partida não pagar o módulo.
 * @param {{loader?: ReturnType<typeof createFreeStudyLoader>, window?: Window, state?: any, toast?: (message: string) => void}} [options]
 * @returns {() => void} remove os ouvintes de janela
 * @example const unbind = mountFreeStudyBoot({window, state: S, toast});
 */
export function mountFreeStudyBoot({loader = freeStudy, window: win = globalThis.window, state = S, toast = () => {}} = {}) {
  const fail = (error) => toast(error?.message || String(error));
  const loadThen = (run) => loader.init().then(run).catch(fail);
  const onWorkspace = (event) => {
    const data = event?.detail;
    if (loader.current() || (!isFreeData(data) && !hasTutorPdfDraft(data))) return;
    loadThen(() => loader.receiveWorkspace(data));
  };
  const onChrome = () => {
    if (loader.current() || !isFreeData({workspace: state.workspace})) return;
    loadThen(() => {});
  };
  const onTutorMaterial = (data) => {
    if (loader.current()) return;
    loadThen(() => loader.receiveTutorMaterial(data));
  };
  win.addEventListener('desk-workspace', onWorkspace);
  win.addEventListener('desk-chrome', onChrome);
  const offMaterial = win.desk?.onTutorMaterial?.(onTutorMaterial);
  return () => {
    win.removeEventListener('desk-workspace', onWorkspace);
    win.removeEventListener('desk-chrome', onChrome);
    offMaterial?.();
  };
}
