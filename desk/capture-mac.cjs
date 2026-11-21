// @ts-check
'use strict';
const {message} = require('./src/i18n.mjs');

/**
 * Lista as janelas visíveis via helper do macOS, só com permissão de tela.
 * @param {{helper?: string, screenStatus: () => string, execFile: (file: string, args: string[], options: {timeout: number, maxBuffer: number}) => Promise<{stdout: string}>}} deps
 * @example await listWindowsMac({helper, screenStatus, execFile})
 */
async function listWindowsMac({helper, screenStatus, execFile}) {
  if (!helper) throw Error(message('err.capture.helperMissing'));
  const options = {timeout: 15000, maxBuffer: 1024 * 1024};
  if (screenStatus() !== 'granted') {
    /* O Electron informa 'denied' também antes do primeiro pedido. O macOS,
       não o Electron, decide se mostra o aviso. A orientação fica até autorizar. */
    await execFile(helper, ['--request-permission'], options).catch(() => {});
    if (screenStatus() !== 'granted') throw Error(message('err.capture.permission'));
  }
  const {stdout} = await execFile(helper, [], options);
  let listed;
  try { listed = JSON.parse(stdout); } catch { throw Error(message('err.capture.listFail')); }
  if (!listed.permission) throw Error(message('err.capture.permission'));
  return Array.isArray(listed.windows) ? listed.windows : [];
}

module.exports = {listWindowsMac};
