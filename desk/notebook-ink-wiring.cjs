// @ts-check
'use strict';

/* Fiação real da leitura da tinta dos cadernos (#158, #159): monta as
   dependências de verdade do vigia e da ponte e passa `app` + `inkConvert`
   ao `registerNotebooksHost`, ligando `before-quit`. Desligado por padrão;
   o aluno liga no painel. Usa o modelo de visão DO USUÁRIO (pago, com visão),
   nunca grátis; separado do tutor (sessão temporária escondida, já na ponte).
   Sem modelo pago com visão, a busca fica só no texto digitado. */

const fs = require('node:fs');
const path = require('node:path');
const {selectInkModel} = require('./notebook-ink-model.cjs');
const {readInk, createClaudeInkBridge} = require('./src/agents/notebook-ink-bridge.cjs');
const {createInkRenderer, inkReadingEnabled} = require('./ink-convert-host.cjs');
const {registerNotebooksHost} = require('./notebooks-host.cjs');
const {message} = require('./src/i18n.mjs');
const conversations = require('./src/agents/conversations.cjs');

/**
 * Liga a tinta dos cadernos ao main e ao interruptor do painel.
 * @param {{
 *   ipcMain: {handle: (channel: string, fn: Function) => void, removeHandler?: (channel: string) => void},
 *   courses: () => Array<{id: string, name: string, path: string}>,
 *   allowedXopp: Set<string>,
 *   config: () => object,
 *   shell: {openPath: (target: string) => Promise<string>},
 *   spawn?: Function, platform?: string, app?: {on: (event: string, fn: Function) => void},
 *   runtime?: string, state?: () => object, patchState?: (patch: object) => void,
 *   persist?: () => void, session?: () => string,
 *   openCodeTutor?: {inkBridge?: Function, inkCatalog?: Function},
 *   engine?: () => string, claudeBinary?: () => string, claudeDetector?: Function|null,
 *   testClaudeSdkLoader?: () => Function|null,
 *   log?: (line: string) => void,
 *   allowSender?: (event: Electron.IpcMainInvokeEvent) => boolean,
 *   selection?: () => {model: string|null, effort: string|null}|null,
 *   catalog?: () => import('./src/agents/opencode-catalog.cjs').CatalogModel[],
 *   createBridge?: (selection: {model: string|null, effort: string|null}|null) => object,
 *   readInkImpl?: typeof readInk, exportInkPng?: (args: {file: string, page: number, xml: string, signal?: AbortSignal}) => Promise<unknown>, renderSvg?: Function,
 *   pdfAuthorize?: (file: string) => string,
 *   readText?: Function, pickModel?: Function,
 *   registerNotebooksHostImpl?: typeof registerNotebooksHost,
 * }} deps dependências injetadas (produção passa o estado vivo e o tutor OpenCode)
 * @returns {ReturnType<typeof registerNotebooksHost> & {setInkEnabled: (payload: {on: boolean}) => Promise<{ok: true}>}} host dos cadernos e o ligante do interruptor
 * @example const notebooks = registerNotebookInkWiring({ipcMain, courses: () => courses, allowedXopp, config: () => config, shell, app, runtime, state: () => state, patchState: p => {state = {...state, ...p}; persist(true);}, persist, session: () => session, openCodeTutor, engine});
 */
function registerNotebookInkWiring(deps) {
  const {ipcMain, courses, allowedXopp, config, shell, spawn, platform, app} = deps;
  const allowSender = deps.allowSender || (() => true);
  /** @param {Electron.IpcMainInvokeEvent} event @param {string} channel @returns {void} */
  function assertSender(event, channel) {
    if (!allowSender(event)) throw Error(message('err.ipc.senderDenied', {channel}));
  }
  const runtime = deps.runtime || '';
  /** @type {() => any} */
  const stateOf = deps.state || (() => ({}));
  /** @type {(patch: object) => void} */
  const patchStateOf = deps.patchState || (() => {});
  const persistOf = deps.persist || (() => {});
  const sessionOf = deps.session || (() => '');
  const log = deps.log || (() => {});
  const registerHost = deps.registerNotebooksHostImpl || registerNotebooksHost;

  /** Catálogo em cache (síncrono para o vigia): vazio até a primeira leitura. @type {import('./src/agents/opencode-catalog.cjs').CatalogModel[]} */
  let catalogCache = [];
  let refreshing = null;
  /* O catálogo é lido sob demanda (abrir o painel ou ligar), nunca na partida:
     o servidor do tutor não sobe por causa de uma leitura desligada. */
  let catalogLoaded = typeof deps.catalog === 'function';

  /** A escolha do modelo: o descritor da conversa aberta, ou o padrão da Mesa. @returns {{model: string|null, effort: string|null}|null} */
  function defaultSelection() {
    try {
      const record = conversations.readClaudeConversation(sessionOf(), {runtime});
      if (record?.model) return {model: record.model, effort: record.effort || null};
    } catch { /* sem descritor: cai no padrão */ }
    try {
      const def = /** @type {{provider?: unknown, id?: unknown, effort?: unknown}} */ ((stateOf() || {}).modelDefault || {});
      if (def?.provider && def?.id) return {model: `${def.provider}/${def.id}`, effort: typeof def.effort === 'string' ? def.effort : null};
    } catch { /* estado sem padrão */ }
    return {model: null, effort: null};
  }

  const selectionOf = deps.selection || defaultSelection;
  const catalogOf = deps.catalog || (() => catalogCache);

  /** Motor de escrita/tutor atual; o Claude não usa o catálogo do OpenCode. @returns {string} */
  function engineKindOf() {
    try { return deps.engine ? String(deps.engine()) : 'opencode'; } catch { return 'opencode'; }
  }

  async function refreshCatalog() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        if (deps.openCodeTutor?.inkCatalog) {
          const models = await deps.openCodeTutor.inkCatalog();
          if (Array.isArray(models)) { catalogCache = models; catalogLoaded = models.length > 0; }
        }
      } catch (error) { log(`tinta: catálogo não lido: ${error?.message || error}`); }
      finally { refreshing = null; }
    })();
    return refreshing;
  }

  /** Ponte descartável por página: OpenCode no servidor da Mesa, Claude na conversa aberta. @param {{model: string|null, effort: string|null}|null} sel @returns {object} */
  function defaultCreateBridge(sel) {
    const selection = sel || selectionOf();
    const engineKind = engineKindOf();
    if (engineKind === 'claude' && deps.claudeBinary !== undefined) {
      const cwd = inkTmpDir();
      return createClaudeInkBridge({cwd, claudePath: deps.claudeBinary ? deps.claudeBinary() : null, detectClaude: deps.claudeDetector || null, sdkLoader: deps.testClaudeSdkLoader ? deps.testClaudeSdkLoader() || null : null, selection});
    }
    if (!deps.openCodeTutor?.inkBridge) throw Error('ponte de tinta não ligada: tutor OpenCode sem inkBridge');
    return /** @type {object} */ (deps.openCodeTutor.inkBridge({cwd: inkTmpDir(), selection}));
  }

  function inkTmpDir() {
    const dir = runtime ? path.join(runtime, 'opencode-workspaces', 'notebook-ink') : path.join(process.cwd(), 'notebook-ink-tmp');
    try { fs.mkdirSync(dir, {recursive: true}); } catch (error) { log(`tinta: pasta temporária não criada: ${error?.message || error}`); }
    return dir;
  }

  const createBridgeOf = deps.createBridge || defaultCreateBridge;
  const renderSvgOf = deps.renderSvg || createInkRenderer();

  /** A ponte da leitura para a conversão do plugin: uma chamada avulsa por PNG. O `selection` verificado pelo `pickModel` da ponte chega em `options` e é o que vai para a sessão (M3), nunca a seleção viva. @param {unknown} png @param {{signal?: AbortSignal, selection?: {model: string, effort?: string|null}}} [options] @returns {Promise<{text: string|null, reason: 'quota'|'no-model'|'no-vision'|'free'|null}>} */
  async function defaultReadText(png, options = {}) {
    const signal = options?.signal || null;
    const verified = options?.selection && typeof options.selection.model === 'string' ? options.selection : null;
    const pick = verified
      ? {model: verified.model, effort: typeof verified.effort === 'string' ? verified.effort : null, reason: null}
      : defaultPickModel();
    if (!pick.model) return {text: null, reason: pick.reason || 'no-model'};
    const bridge = /** @type {any} */ (createBridgeOf({model: pick.model, effort: pick.effort ?? null}));
    const language = (stateOf()?.tutorLanguage === 'en' || stateOf()?.uiLanguage === 'en') ? 'en' : 'pt-BR';
    return /** @type {Promise<{text: string|null, reason: 'quota'|null}>} */ ((deps.readInkImpl || readInk)({bridge, png, language, signal}));
  }

  /** O modelo que pode ler a tinta agora, ou o motivo de não poder. @returns {{model: string|null, effort: string|null, reason: 'no-vision'|'free'|'no-model'|null}} */
  function defaultPickModel() {
    try {
      const pick = selectInkModel(selectionOf(), /** @type {any} */ (catalogOf()));
      return pick;
    } catch {
      return {model: null, effort: null, reason: 'no-model'};
    }
  }

  const readTextOf = deps.readText || defaultReadText;
  const pickModelOf = deps.pickModel || defaultPickModel;
  /* Com Claude, a leitura da tinta fica no estado honesto (M2): o catálogo é
     do OpenCode e não vale para o motor Claude, então nada arma nem sobe. */
  const inkEnabledOf = () => engineKindOf() !== 'claude' && inkReadingEnabled(stateOf());

  const inkConvert = {runtime: runtime || path.join(process.cwd(), 'runtime'), deskState: () => ({inkReading: inkEnabledOf()}), readText: readTextOf, renderSvg: renderSvgOf, pickModel: pickModelOf};

  const notebooks = /** @type {any} */ (registerHost({ipcMain, courses, allowedXopp, config, shell, runtime, allowSender, spawn: spawn || require('node:child_process').spawn, platform: platform || process.platform, app, inkConvert, inkEnabled: inkEnabledOf,
    ...(deps.selection ? {selection: deps.selection} : {selection: selectionOf}),
    ...(deps.catalog ? {catalog: deps.catalog} : {catalog: catalogOf}),
    ...(deps.createBridge ? {createBridge: deps.createBridge} : {createBridge: createBridgeOf}),
    ...(deps.readInkImpl ? {readInkImpl: deps.readInkImpl} : {}),
    ...(deps.exportInkPng ? {exportInkPng: deps.exportInkPng} : {}),
    ...(deps.pdfAuthorize ? {pdfAuthorize: deps.pdfAuthorize} : {})}));

  /** Lê o catálogo uma vez, na primeira consulta de estado do painel. @returns {Promise<void>} */
  async function ensureCatalog() {
    if (catalogLoaded) return;
    await refreshCatalog();
  }
  /* O estado do painel precisa do catálogo quando a leitura está ligada; com a
     opção desligada ele não sobe o motor (B7). Com Claude, o estado é honesto
     e o catálogo do OpenCode nunca é chamado (M2). */
  if (typeof ipcMain.removeHandler === 'function') {
    ipcMain.removeHandler('notebooks-ink-status');
    ipcMain.handle('notebooks-ink-status', async (event) => {
      assertSender(event, 'notebooks-ink-status');
      if (engineKindOf() === 'claude') {
        return {status: 'claude-unavailable', pagesRead: notebooks.inkIndexStatus().pagesRead, enabled: inkReadingEnabled(stateOf())};
      }
      if (inkReadingEnabled(stateOf())) await ensureCatalog();
      return notebooks.inkIndexStatus();
    });
  }
  /* Opt-in salvo (#158/G1): o catálogo é buscado FORA do caminho síncrono da
     partida, para o vigia e o plugin deixarem de responder "sem modelo" sem
     precisar abrir o painel. Desligado, nada é agendado. */
  if (inkReadingEnabled(stateOf()) && engineKindOf() !== 'claude') {
    setImmediate(() => {
      void ensureCatalog()
        .then(() => { try { notebooks.pollOnce?.(); } catch { /* vigia já parou */ } })
        .catch(() => { /* sem catálogo, o status segue honesto */ });
    });
  }

  /**
   * Liga ou desliga a leitura da tinta: grava `inkReading` no desk.json,
   * arma/desarma o vigia e sobe/fecha a ponte. Valida o tipo estrito; ligar
   * sem modelo pago com visão (ou com o motor Claude) NÃO grava o opt-in e
   * devolve o motivo. Falha real de start/stop também volta como `{ok:false}`.
   * @param {{on: unknown}} payload mesmo formato do renderer (`window.desk.notebooksInkSet`)
   * @returns {Promise<{ok: true} | {ok: false, reason: string}>}
   * @example await notebooks.setInkEnabled({on: true}) // {ok: true}
   * @example await notebooks.setInkEnabled({on: true}) // {ok: false, reason: 'no-vision'}
   */
  async function setInkEnabled(payload) {
    if (!payload || typeof payload !== 'object' || typeof payload.on !== 'boolean') {
      const received = JSON.stringify(payload)?.slice(0, 80) ?? String(payload);
      throw Error(`notebooks-ink-set: recebido ${received}; esperado objeto {on: boolean}`);
    }
    if (payload.on === true) {
      if (engineKindOf() === 'claude') return {ok: false, reason: 'claude-unavailable'};
      /* Ligar precisa da escolha conferida contra o catálogo antes do 1º tick. */
      await ensureCatalog();
      const pick = pickModelOf();
      if (!pick || !pick.model) return {ok: false, reason: (pick && pick.reason) || 'no-model'};
      patchStateOf({inkReading: true});
      persistOf();
      try { notebooks.setEnabled?.(); } catch { /* vigia já parou */ }
      let started;
      try { started = await notebooks.startInkConvert?.(); } catch { started = null; }
      if (!started || !(Number(/** @type {{port?: unknown}} */ (started).port) > 0)) {
        /* Sem porta não há conversão: desfaz o opt-in para não ler e gastar. */
        patchStateOf({inkReading: false});
        persistOf();
        try { notebooks.setEnabled?.(); } catch { /* vigia já parou */ }
        try { await notebooks.stopInkConvert?.(); } catch { /* ponte já fechada */ }
        return {ok: false, reason: 'start'};
      }
      return {ok: true};
    }
    patchStateOf({inkReading: false});
    persistOf();
    try { notebooks.setEnabled?.(); } catch { /* vigia já parou */ }
    try {
      await notebooks.stopInkConvert?.();
    } catch {
      return {ok: false, reason: 'stop'};
    }
    return {ok: true};
  }

  ipcMain.handle('notebooks-ink-set', (event, payload) => {
    assertSender(event, 'notebooks-ink-set');
    return setInkEnabled(payload);
  });

  return {...notebooks, setInkEnabled};
}

module.exports = {registerNotebookInkWiring, inkReadingEnabled};
