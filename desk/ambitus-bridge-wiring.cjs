// @ts-check
'use strict';

/* Fiação real da ponte com o Ambitus: monta a leitura da tinta da #158 (o
   modelo de visão DA PESSOA, pago, numa sessão descartável) e o interruptor
   `inkReading`, e sobe a ponte na partida. Vem da `notebook-ink-wiring.cjs`
   da tag `cadernos-antes-do-xournal`, sem a biblioteca nem o vigia: quem
   decide o que ler agora é o Ambitus. Com o motor Claude a leitura fica
   indisponível, como antes (M2): o catálogo que confere visão e custo é o do
   OpenCode. */

const fs = require('node:fs');
const path = require('node:path');
const {selectInkModel} = require('./notebook-ink-model.cjs');
const {readInk} = require('./src/agents/notebook-ink-bridge.cjs');
const {createAmbitusBridgeHost, inkReadingEnabled} = require('./ambitus-bridge-host.cjs');
const {authorizeXopp} = require('./xopp-authorization.cjs');
const conversations = require('./src/agents/conversations.cjs');
const {message} = require('./src/i18n.mjs');

/**
 * A escolha do modelo: o da sessão aberta, senão o padrão da Mesa.
 * @param {{session: () => string, runtime: string, state: () => any}} deps
 * @returns {{model: string|null, effort: string|null}}
 * @example currentSelection({session: () => '', runtime, state: () => ({modelDefault: {provider: 'p', id: 'm'}})}) // {model: 'p/m', effort: null}
 */
function currentSelection({session, runtime, state}) {
  try {
    const record = conversations.readClaudeConversation(session(), {runtime});
    if (record?.model) return {model: record.model, effort: record.effort || null};
  } catch { /* sem descritor: cai no padrão */ }
  const def = (state() || {}).modelDefault || {};
  if (def.provider && def.id) return {model: `${def.provider}/${def.id}`, effort: typeof def.effort === 'string' ? def.effort : null};
  return {model: null, effort: null};
}

/**
 * Leva uma página do Ambitus ao chat lateral: o caderno precisa existir; entra
 * na lista viva (`allowedXopp`) para o tutor relê-lo pelo `ler_caderno`, e a
 * janela vem para a frente com o pedido (`ambitus-page`). Sem janela, o motivo.
 * @param {{caminho: string, pagina: number, nome: string}} page
 * @param {{allowedXopp: Set<string>, win: () => any, isFile?: (file: string) => boolean}} deps
 * @returns {{ok: true}|{reason: string}}
 * @example sendPageToSidechat({caminho: '/c/a.xopp', pagina: 2, nome: 'a'}, {allowedXopp, win: () => win}) // {ok: true}
 */
function sendPageToSidechat(page, {allowedXopp, win, isFile = (file) => { try { return fs.statSync(file).isFile(); } catch { return false; } }}) {
  if (!isFile(page.caminho)) return {reason: 'not-found'};
  const window = win();
  if (!window || window.isDestroyed()) return {reason: 'no-window'};
  authorizeXopp(allowedXopp, page.caminho);
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  window.webContents.send('ambitus-page', {caminho: page.caminho, pagina: page.pagina, nome: page.nome});
  return {ok: true};
}

/**
 * Liga a ponte com o Ambitus ao main: sobe a ponte, registra o estado e o
 * interruptor da leitura (`ambitus-ink-status`, `ambitus-ink-set`) e devolve
 * o `close` para o `before-quit`.
 * @param {{ipcMain: {handle: (channel: string, fn: Function) => void}, runtime: string,
 *   state: () => any, patchState: (patch: object) => void, persist: () => void, session: () => string,
 *   engine: () => string, openCodeTutor: {inkBridge: Function, inkCatalog: () => Promise<any[]>},
 *   language: () => 'pt-BR'|'en', allowSender: (event: any) => boolean, log: (line: string) => void,
 *   allowedXopp: Set<string>, win: () => any, readInkImpl?: typeof readInk}} deps
 * @returns {{close: () => Promise<void>, setInkReading: (payload: unknown) => Promise<{ok: true}|{ok: false, reason: string}>, inkStatus: () => Promise<{enabled: boolean, reason: string|null}>}}
 * @example const ambitus = registerAmbitusBridge({ipcMain, runtime, state: () => state, patchState, persist, session: () => session, engine, openCodeTutor, language, allowSender: trustedMainSender, log});
 */
function registerAmbitusBridge(deps) {
  const {ipcMain, runtime, state, patchState, persist, log} = deps;
  /** @type {any[]} */
  let catalog = [];
  const isClaude = () => { try { return String(deps.engine()) === 'claude'; } catch { return false; } };

  /* O catálogo é lido sob demanda (ligar ou consultar), nunca na partida: o
     servidor do tutor não sobe por causa de uma leitura desligada. */
  async function refreshCatalog() {
    try {
      const models = await deps.openCodeTutor.inkCatalog();
      if (Array.isArray(models) && models.length) catalog = models;
    } catch (error) { log(`ambitus: catálogo não lido: ${/** @type {Error} */ (error)?.message || error}`); }
  }

  /** @returns {{model: string|null, effort: string|null, reason: string|null}} */
  function pickModel() {
    if (isClaude()) return {model: null, effort: null, reason: 'claude-unavailable'};
    try { return selectInkModel(currentSelection({session: deps.session, runtime, state}), catalog); }
    catch { return {model: null, effort: null, reason: 'no-model'}; }
  }

  function inkTmpDir() {
    const dir = path.join(runtime, 'opencode-workspaces', 'notebook-ink');
    try { fs.mkdirSync(dir, {recursive: true}); } catch { /* a ponte do OpenCode diz o erro */ }
    return dir;
  }

  /** Uma leitura avulsa por PNG, com o modelo conferido pela ponte (M3). @param {string} png @param {{signal: AbortSignal, selection: {model: string, effort: string|null}}} options */
  function readText(png, {signal, selection}) {
    const bridge = deps.openCodeTutor.inkBridge({cwd: inkTmpDir(), selection});
    return (deps.readInkImpl || readInk)({bridge, png, language: deps.language(), signal});
  }

  const sendPage = (page) => sendPageToSidechat(page, {allowedXopp: deps.allowedXopp, win: deps.win});
  const host = createAmbitusBridgeHost({runtime, deskState: () => ({inkReading: !isClaude() && inkReadingEnabled(state())}), readText, pickModel, sendPage, log});
  /* Opt-in já salvo: o catálogo vem fora do caminho síncrono da partida. */
  if (inkReadingEnabled(state()) && !isClaude()) setImmediate(() => { void refreshCatalog(); });
  void host.start().catch((error) => log(`ambitus: a ponte não subiu: ${error?.message || error}`));

  /** O estado do interruptor e, ligado, o motivo de não poder ler agora. */
  async function inkStatus() {
    const enabled = inkReadingEnabled(state());
    if (isClaude()) return {enabled, reason: 'claude-unavailable'};
    if (!enabled) return {enabled, reason: null};
    if (!catalog.length) await refreshCatalog();
    return {enabled, reason: pickModel().reason};
  }

  /**
   * Liga ou desliga a leitura. Ligar confere antes o modelo contra o catálogo:
   * sem modelo pago com visão (ou com o Claude), não grava e devolve o motivo.
   * @param {unknown} payload `{on: boolean}`
   * @returns {Promise<{ok: true}|{ok: false, reason: string}>}
   */
  async function setInkReading(payload) {
    const on = /** @type {{on?: unknown}} */ (payload)?.on;
    if (typeof on !== 'boolean') {
      throw Error(`ambitus-ink-set: recebido ${String(JSON.stringify(payload)).slice(0, 80)}; esperado {on: boolean}`);
    }
    if (on) {
      if (isClaude()) return {ok: false, reason: 'claude-unavailable'};
      await refreshCatalog();
      const pick = pickModel();
      if (!pick.model) return {ok: false, reason: pick.reason || 'no-model'};
    }
    patchState({inkReading: on});
    persist();
    return {ok: true};
  }

  const guarded = (channel, fn) => ipcMain.handle(channel, (event, payload) => {
    if (!deps.allowSender(event)) throw Error(message('err.ipc.senderDenied', {channel}));
    return fn(payload);
  });
  guarded('ambitus-ink-status', () => inkStatus());
  guarded('ambitus-ink-set', (payload) => setInkReading(payload));

  return {close: () => host.close(), setInkReading, inkStatus};
}

module.exports = {registerAmbitusBridge, currentSelection, sendPageToSidechat};
