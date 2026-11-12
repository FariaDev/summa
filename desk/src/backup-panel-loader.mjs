// @ts-check
/* Backup/compartilhamento: o painel autônomo (37 KiB com CSS e templates) só
   entra quando o menu ou a paleta o abrem (#desempenho). A partida guarda o IPC
   e o `document`; o init roda uma vez, na primeira abertura. */
import {createLazyModule} from './lazy-module.mjs';
import {ensureStyles} from './backup-panel-style.mjs';

/**
 * Cria a fachada do painel de backup.
 * @param {() => Promise<typeof import('./backup-panel.mjs')>} [importModule]
 * @returns {{init: (documento: Document, ipc?: object, options?: object) => void, load: () => Promise<any>, abrirBackup: () => Promise<void>, abrirCompartilhar: () => Promise<void>}}
 * @example const backup = createBackupPanelLoader(); backup.init(document, ipc); await backup.abrirBackup();
 */
export function createBackupPanelLoader(importModule = () => import('./backup-panel.mjs')) {
  const lazy = createLazyModule({importModule});
  let args = null;
  let panel = null;
  async function backend() {
    const module = await lazy.load();
    if (!panel) panel = module.initBackupPanel(args?.documento, args?.ipc || {}, args?.options || {});
    return panel;
  }
  return {
    init: (documento, ipc = {}, options = {}) => { args = {documento, ipc, options}; },
    load: () => lazy.load(),
    abrirBackup: async () => { await (await backend()).abrirBackup(); },
    abrirCompartilhar: async () => { await (await backend()).abrirCompartilhar(); },
  };
}

const backup = createBackupPanelLoader();
/**
 * Guarda o `document`/IPC da partida; o painel é criado na primeira abertura.
 * @param {Document} documento @param {object} [ipc] @param {object} [options]
 * @returns {{abrirBackup: () => Promise<void>, abrirCompartilhar: () => Promise<void>}}
 * @example const studyBackup = mountBackupPanelBoot(document, ipc);
 */
export function mountBackupPanelBoot(documento, ipc = {}, options = {}) {
  ensureStyles(documento);
  backup.init(documento, ipc, options);
  return {abrirBackup: () => backup.abrirBackup(), abrirCompartilhar: () => backup.abrirCompartilhar()};
}
