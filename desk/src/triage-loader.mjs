// @ts-check
/* "Relatar um problema" (#62): o diálogo só entra na primeira abertura
   (#desempenho). O clique em `#help-triage` é capturado cedo, porque o botão
   nasce no HTML antes de o módulo existir. */
import {createLazyModule} from './lazy-module.mjs';

/**
 * Cria a fachada do relato de problema.
 * @param {() => Promise<typeof import('./triage.mjs')>} [importModule]
 * @returns {{load: () => Promise<typeof import('./triage.mjs')>, current: () => typeof import('./triage.mjs') | null, open: () => Promise<void>}}
 * @example const triage = createTriageLoader(); await triage.open();
 */
export function createTriageLoader(importModule = () => import('./triage.mjs')) {
  const lazy = createLazyModule({importModule, prepare: (module) => module.initTriage()});
  return {load: () => lazy.load(), current: () => lazy.current(), open: async () => { await lazy.load(); await lazy.current()?.openTriage(); }};
}

const triage = createTriageLoader();
/**
 * Liga o clique de `#help-triage` antes da carga: o primeiro clique importa e
 * abre; os seguintes são do listener que o módulo registra.
 * @param {Document} doc
 * @param {(message: string) => void} [notify]
 * @returns {() => void} remove o listener
 * @example const unbind = mountTriageBoot(document, toast);
 */
export function mountTriageBoot(doc, notify = () => {}) {
  const onClick = (event) => {
    if (triage.current()) return;
    const button = /** @type {Element | null} */ (event.target)?.closest?.('#help-triage');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const help = /** @type {HTMLDialogElement | null} */ (doc.querySelector('#help-dialog'));
    if (help?.open) help.close('ok');
    triage.open().catch((error) => notify(error?.message || String(error)));
  };
  doc.addEventListener('click', onClick, true);
  return () => doc.removeEventListener('click', onClick, true);
}

/** Abre o relato, importando o módulo na primeira vez.
 * @returns {Promise<void>} @example await openTriage();
 */
export const openTriage = () => triage.open();
