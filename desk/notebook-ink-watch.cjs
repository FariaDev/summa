// @ts-check
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const {promisify} = require('node:util');
const gunzipAsync = promisify(zlib.gunzip);
const {NOTEBOOK_MAX_XML_BYTES, hasUnsafeDoctype, pagesOfXml} = require('./src/notebook-xopp.mjs');
const {selectInkModel} = require('./notebook-ink-model.cjs');
const {readInk} = require('./src/agents/notebook-ink-bridge.cjs');
const {message} = require('./src/i18n.mjs');
const {containedRealpath, realpathResolver} = require('./file-guard.cjs');
const {
  createNotebookInkIndex, cutInkText, INK_INDEX_DIR, INK_INDEX_FILE, INK_INDEX_MAX_BYTES,
} = require('./notebook-ink-index.cjs');

/* ---------- índice da tinta dos cadernos (#158, passo 2 + ajustes) ----------
   Com `inkEnabled()` verdadeiro, o vigia faz polling do `mtimeMs` dos cadernos
   da biblioteca (lista em cache, sem re-varrer as matérias) a cada ~3 s e só
   age com o mtime estável em duas leituras seguidas. O hash sha256 de cada
   `<page>` diz quais mudaram; página sem `<stroke>` nunca vai ao modelo. Página
   mudada com tinta vira PNG pela exportação do `ler_caderno` e o texto sai de
   uma chamada avulsa `readInk` com o modelo do aluno. `quota`, `no-vision`,
   `free` e `no-model` param a fila e viram estado para a UI futura. Falha no
   meio não marca concluído (M2), com espera crescente. O índice mora em
   `runtime/notebook-ink/index.json` (pasta 0700, arquivo `0600`, escrita
   assíncrona atômica tmp+rename), podado de cadernos que saíram da biblioteca.
   Só é carregado (async) com a opção ligada (M3), valida cada campo, grava
   mtime+size concluídos (B2) e o `stop()` aborta a leitura em voo (B1). O
   texto lido NUNCA é logado. Desligado, nada roda: zero stat, zero I/O. */

const INK_COMPRESSED_CAP = 32 * 1024 * 1024;
const INK_POLL_MS = 3000;
const INK_MAX_PAGES_PER_TICK = 4; /* teto de chamadas ao modelo por tick do vigia (#158) */
const INK_PAGE_MAX_ATTEMPTS = 3; /* página com falha permanente vira pulada (#158) */
/* Parada (quota/modelo) não usa esta fila: volta quando a escolha muda. */
const INK_RETRY_DELAYS_MS = [31000, 120000, 600000];
/* Motivos de modelo são TRANSITÓRIOS (#158/G1): quando o pick volta a valer,
   o status retorna a idle/reading em vez de ficar preso em "sem modelo". */
const TRANSIENT_STATUS = new Set(['no-model', 'no-vision', 'free']);

/** Interruptor do índice da tinta: desligado por padrão; a UI do interruptor vem na fatia C. @returns {boolean} @example inkEnabled() // false */
function inkEnabled() {
  return false;
}

/** @param {string} pageXml @returns {string} sha256 hexadecimal */
function pageHash(pageXml) { return crypto.createHash('sha256').update(String(pageXml), 'utf8').digest('hex'); }

/** @param {string} pageXml @returns {boolean} */
function isInkPage(pageXml) { return String(pageXml).includes('<stroke'); }

/**
 * Cria o vigia da tinta sobre a biblioteca viva. Sem `runtime`, o índice
 * fica só em memória (os hosts de teste usam `config: () => ({})` e não
 * podem escrever disco nenhum).
 * @param {{
*   listNotebooks: () => Array<{path: string}>,
*   runtime?: string|null,
*   inkEnabled?: () => boolean,
*   selection?: () => {model: string|null, effort: string|null}|null,
*   catalog?: () => import('./src/agents/opencode-catalog.cjs').CatalogModel[],
*   createBridge?: (selection: {model: string|null, effort: string|null}|null) => object,
*   readInkImpl?: typeof readInk,
*   exportInkPng?: (args: {file: string, page: number, xml: string, signal?: AbortSignal}) => Promise<unknown>, exportPageImageImpl?: typeof import('./src/extensions/mesa-mcp/notebook-tool.mjs').exportPageImage,
*   pdfAuthorize?: (file: string) => string, xournalPath?: string | (() => string),
*   courseRoots?: string[] | (() => string[]),
*   caseSensitive?: boolean, realpath?: (value: string) => string,
*   readFile?: typeof fs.promises.readFile,
*   stat?: typeof fs.promises.stat,
*   gunzip?: typeof gunzipAsync,
*   fsImpl?: typeof fs,
*   setIntervalImpl?: typeof setInterval,
*   clearIntervalImpl?: typeof clearInterval,
*   pollMs?: number,
*   nowMs?: () => number,
*   readIndexFile?: (file: string) => Promise<Buffer | string>,
*   log?: (line: string) => void
* }} deps dependências injetadas (os testes usam relógio, fs e modelo falsos com nome)
 * @returns {{start: () => void, stop: () => void, setEnabled: () => void, pollOnce: () => Promise<void>, whenIdle: () => Promise<void>, inkIndexStatus: () => {status: string, pagesRead: number, enabled: boolean}, inkTextsFor: (caminho: string) => string[] | null}}
 * @example const watcher = createNotebookInkWatcher({listNotebooks: () => lib.cadernos(), runtime}); watcher.start() // começa o polling de 3 s
 */
function createNotebookInkWatcher({
  listNotebooks, runtime = null, inkEnabled = moduleInkEnabled,
  selection = () => null, catalog = () => [],
  createBridge = () => { throw Error('ponte de tinta não ligada'); },
  readInkImpl = readInk, exportInkPng, exportPageImageImpl, pdfAuthorize, xournalPath = '', courseRoots = [],
  caseSensitive = process.platform !== 'win32' && process.platform !== 'darwin', realpath,
  readFile = fs.promises.readFile, stat = fs.promises.stat, gunzip = gunzipAsync, fsImpl = fs,
  setIntervalImpl = setInterval, clearIntervalImpl = clearInterval,
  pollMs = INK_POLL_MS, nowMs = () => Date.now(),
  readIndexFile = (file) => fs.promises.readFile(file), log = () => {},
}) {
  const realpathOf = realpath || realpathResolver(fsImpl);
  const exportPng = exportInkPng || defaultExportInkPng;
  const indexFile = typeof runtime === 'string' && runtime ? path.join(runtime, INK_INDEX_DIR, INK_INDEX_FILE) : null;
  /** @type {{status: string, pagesRead: number}} */
  const state = {status: 'idle', pagesRead: 0};
  let timer = null, processing = false, halted = false, haltedKey = '', stopped = true;
  /* Começa vazio: o disco só entra quando `inkEnabled()` vale true pela primeira vez (M3). */
  const inkIndex = createNotebookInkIndex({
    indexFile, listNotebooks, fsImpl, stat, readIndexFile, log,
    isStopped: () => stopped,
  });
  /** Último mtime visto; só o igual ao do tick anterior estabiliza. @type {Map<string, number>} */
  const seenMtime = new Map();
  /** mtime já processado (sucesso): não re-enfileira sem mudar. @type {Map<string, number>} */
  const doneMtime = new Map();
  /** Fila coalescida por arquivo: um pedido por vez, com o canônico conferido. @type {Map<string, {mtimeMs: number, size: number, canonical?: string}>} */
  const queue = new Map();
  let tickModelCalls = 0; /* gasto do tick corrente, global entre cadernos (#158/F3) */
  /** Espera crescente da falha transitória (M2): quantas vezes falhou e quando tentar. */
  const failures = new Map();
  const retryAt = new Map();
  /** Tentativas por página com falha transitória (M4): chave arquivo+página+hash, o hash novo zera. @type {Map<string, number>} */
  const pageAttempts = new Map();
  /** Controlador da página em voo: `stop()` aborta o `readInk` (B1). @type {AbortController|null} */
  let inFlight = null;
  /** Sondas do `whenIdle`: resolvidas quando a fila esvazia. @type {Array<(value?: unknown) => void>} */
  let idleWaiters = [];

  /** Exportação de produção: o PNG do `ler_caderno` (cópia higienizada + CLI), com fundo PDF só pela autorização limitada do host (#224). O `exportPageImage` não aceita AbortSignal: o `stop()` aborta o `readInk` e descarta o PNG em voo — a exportação em si não para. (#158, B1). @param {{file: string, page: number, xml: string, signal?: AbortSignal}} args @returns {Promise<Buffer>} */
  async function defaultExportInkPng({file, page, xml}) {
    const exportPageImage = exportPageImageImpl || require('./src/extensions/mesa-mcp/notebook-tool.mjs').exportPageImage;
    const roots = typeof courseRoots === 'function' ? courseRoots() : courseRoots;
    const binary = typeof xournalPath === 'function' ? xournalPath() : xournalPath;
    const {png} = await exportPageImage({file, page, xml, xournalPath: binary, courseRoots: roots, pdfAuthorize});
    return png;
  }

  /** Chave do modelo atual: o halt de quota só sai com modelo novo. @param {import('./notebook-ink-model.cjs').InkModelPick} pick @returns {string} */
  function pickKey(pick) {
    const sel = selection();
    return `${pick.model || ''}|${pick.reason || ''}|${sel && typeof sel.model === 'string' ? sel.model : ''}`;
  }

  function currentPick() {
    try {
      return selectInkModel(selection(), catalog());
    } catch {
      return /** @type {import('./notebook-ink-model.cjs').InkModelPick} */ ({model: null, reason: 'no-model'});
    }
  }

  function haltQueue(reason, key) {
    halted = true;
    haltedKey = key;
    state.status = reason;
    queue.clear();
    settleIdleWaiters();
  }

  function settleIdleWaiters() {
    if (processing || queue.size > 0) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const resolve of waiters) resolve();
  }

  /* Polls serializados: o intervalo dispara sem aguardar, então dois ticks
     seguidos não leem a biblioteca ao mesmo tempo — e o `whenIdle` sabe
     aguardar o poll em voo, não só a fila. */
  let pollChain = Promise.resolve();

  /** Resolve quando o poll em voo terminar e a fila esvaziar. @returns {Promise<void>} @example await watcher.whenIdle() */
  async function whenIdle() {
    for (;;) {
      await pollChain;
      if (!processing && queue.size === 0) return;
      await new Promise((resolve) => { idleWaiters.push(resolve); });
    }
  }

  /** @param {string} file @param {{mtimeMs: number, size: number, canonical?: string}} info @returns {void} */
  function enqueue(file, info) {
    queue.set(file, info);
    void drainQueue();
  }

  /** Roda a fila, um pedido por vez, coalescendo por arquivo. @returns {Promise<void>} */
  async function drainQueue() {
    if (processing) return;
    processing = true;
    if (state.status === 'idle' || TRANSIENT_STATUS.has(state.status)) state.status = 'reading';
    try {
      while (queue.size > 0) {
        const file = /** @type {string} */ (queue.keys().next().value);
        const info = queue.get(file);
        queue.delete(file);
        await processNotebook(file, info);
        if (halted || stopped) break;
      }
    } finally {
      processing = false;
      if (state.status === 'reading') state.status = 'idle';
      settleIdleWaiters();
    }
  }

  /* Lê um caderno estável e indexa só as páginas mudadas com tinta. Só marca
     como concluído (e grava mtime+size, B2) com TODAS as páginas pendentes
     lidas; falha no meio deixa o resto para o próximo tick, com espera
     crescente (M2). O teto de 4 chamadas é POR TICK, somando os cadernos
     (#158/F3); o índice guarda o caminho da lista e o disco é lido pelo
     canônico conferido (F4). @param {string} file @param {{mtimeMs: number, size: number, canonical?: string}|undefined} info @returns {Promise<void>} */
  async function processNotebook(file, info) {
    const target = info && typeof info.canonical === 'string' && info.canonical ? info.canonical : file;
    const xml = await readNotebookXml(target);
    if (xml === null) { markDone(file, info); return; }
    const pages = pagesOfXml(xml);
    const record = inkIndex.files[file] || {hashes: [], texts: []};
    inkIndex.files[file] = record;
    let completed = true;
    for (let at = 0; at < pages.length; at += 1) {
      if (halted || stopped) { completed = false; break; }
      const hash = pageHash(pages[at]);
      if (record.hashes[at] === hash) continue;
      if (!isInkPage(pages[at])) { record.hashes[at] = hash; record.texts[at] = ''; inkIndex.markDirty(); continue; }
      if (tickModelCalls >= INK_MAX_PAGES_PER_TICK) { completed = false; break; }
      tickModelCalls += 1;
      const outcome = await readInkPage(target, at + 1, xml);
      if (outcome.kind === 'ok') {
        pageAttempts.delete(`${file}\u0000${at}\u0000${hash}`);
        record.hashes[at] = hash;
        record.texts[at] = outcome.text || '';
        inkIndex.markDirty();
        await new Promise((resolve) => setImmediate(resolve));
        continue;
      }
      if (outcome.kind === 'transient') {
        const attemptKey = `${file}\u0000${at}\u0000${hash}`;
        const attempts = (pageAttempts.get(attemptKey) || 0) + 1;
        if (attempts >= INK_PAGE_MAX_ATTEMPTS) {
          pageAttempts.delete(attemptKey);
          record.hashes[at] = hash;
          record.texts[at] = '';
          inkIndex.markDirty();
          log(`índice da tinta: página ${at + 1} pulada após 3 tentativas`);
          await new Promise((resolve) => setImmediate(resolve));
          continue;
        }
        pageAttempts.set(attemptKey, attempts);
      }
      completed = false;
      if (outcome.kind === 'transient') scheduleRetry(file);
      break;
    }
    if (record.hashes.length > pages.length) { record.hashes.length = record.texts.length = pages.length; inkIndex.markDirty(); }
    if (completed && info) {
      /* B2: concluído = mtime+size gravados, para o reinício não re-ler. */
      record.mtimeMs = info.mtimeMs;
      record.size = info.size;
      inkIndex.markDirty();
      failures.delete(file);
      retryAt.delete(file);
    }
    if (inkIndex.isDirty()) await inkIndex.saveIndex();
    if (completed) markDone(file, info);
  }

  /** Espera crescente da falha transitória (M2): 30 s, 2 min, 10 min… @param {string} file @returns {void} */
  function scheduleRetry(file) {
    const attempt = failures.get(file) || 0;
    failures.set(file, attempt + 1);
    retryAt.set(file, nowMs() + INK_RETRY_DELAYS_MS[Math.min(attempt, INK_RETRY_DELAYS_MS.length - 1)]);
  }

  /** @param {string} file @returns {Promise<string|null>} */
  async function readNotebookXml(file) {
    try {
      const info = await stat(file);
      if (Number(info?.size) > INK_COMPRESSED_CAP) return null;
      const bytes = /** @type {Buffer} */ (await readFile(file));
      if (!bytes || bytes.length > INK_COMPRESSED_CAP) return null;
      const output = /** @type {Buffer} */ (await gunzip(bytes, {maxOutputLength: NOTEBOOK_MAX_XML_BYTES}));
      if (!output || output.length > NOTEBOOK_MAX_XML_BYTES) return null;
      const xml = output.toString('utf8');
      return hasUnsafeDoctype(xml) ? null : xml;
    } catch {
      return null;
    }
  }

  function markDone(file, info) {
    const next = info ? info.mtimeMs : seenMtime.get(file);
    if (typeof next === 'number') doneMtime.set(file, next);
  }
  /* PNG da página + `readInk`. Retorna o texto quando leu; `transient` para
     falha transitória (timeout/erro, com espera crescente), `halt` para
     parada da fila (quota/modelo) e `aborted` quando `stop()` cancelou.
     @param {string} file @param {number} page @param {string} xml @returns {Promise<{kind: 'ok'|'transient'|'halt'|'aborted', text?: string}>} */
  async function readInkPage(file, page, xml) {
    const pick = currentPick();
    if (pick.reason) { haltQueue(pick.reason, pickKey(pick)); return {kind: 'halt'}; }
    const controller = new AbortController();
    inFlight = controller;
    try {
      let exported;
      try { exported = await exportPng({file, page, xml, signal: controller.signal}); } catch (error) {
        if (controller.signal.aborted) return {kind: 'aborted'};
        log(`índice da tinta: página ${page} sem PNG (${String(/** @type {{code?: unknown}} */ (error)?.code || 'erro')})`);
        return {kind: 'transient'};
      }
      if (controller.signal.aborted) return {kind: 'aborted'};
      const png = Buffer.isBuffer(exported) ? exported.toString('base64') : String(exported || '');
      if (!png) return {kind: 'transient'};
      let bridge;
      /* M3: a ponte usa o modelo verificado no pick, nunca a seleção viva — o
         export pode demorar e o aluno trocar de modelo no meio. */
      try { bridge = createBridge({model: pick.model, effort: pick.effort ?? null}); } catch { haltQueue('no-model', pickKey(pick)); return {kind: 'halt'}; }
      /* A ponte é do vigia: a sessão temporária nasce e morre por página. */
      try {
        const result = await readInkImpl({bridge: /** @type {any} */ (bridge), png, language: 'pt-BR', signal: controller.signal});
        if (result && result.reason === 'quota') { haltQueue('quota', pickKey(pick)); return {kind: 'halt'}; }
        const text = cutInkText(typeof result?.text === 'string' ? result.text : '');
        state.pagesRead += 1;
        log(`índice da tinta: página ${page} lida (${state.pagesRead} no total)`);
        return {kind: 'ok', text};
      } catch {
        /* Leitura que falha não tranca a fila: só o quota/modelo param. */
        if (controller.signal.aborted) return {kind: 'aborted'};
        log(`índice da tinta: página ${page} sem leitura (${state.pagesRead} no total)`);
        return {kind: 'transient'};
      }
    } finally {
      if (inFlight === controller) inFlight = null;
    }
  }

  /* Um tick de polling: sem `inkEnabled()`, nem stat. */
  function pollOnce() {
    const run = pollChain.then(() => pollOnceBody());
    pollChain = run.then(() => {}, () => {});
    return run;
  }

  /** Corpo do tick, serializado pelo `pollChain`. @returns {Promise<void>} */
  async function pollOnceBody() {
    if (stopped) return;
    if (!inkEnabled()) return;
    tickModelCalls = 0;
    /* O índice só sai do disco agora: nunca antes do primeiro true (M3). */
    await inkIndex.ensureIndexLoaded();
    if (stopped) return;
    const pick = currentPick();
    if (!pick.model) {
      state.status = /** @type {string} */ (pick.reason || 'no-model');
      return;
    }
    /* O catálogo pode ter chegado depois do primeiro tick: o status de modelo
       era transitório e volta a idle antes de a fila andar (#158/G1). */
    if (TRANSIENT_STATUS.has(state.status)) state.status = 'idle';
    if (halted) {
      if (pickKey(pick) !== haltedKey) { halted = false; state.status = 'idle'; } else { return; }
    }
    const items = (() => { try { return listNotebooks() || []; } catch { return null; } })();
    if (!items) return;
    inkIndex.pruneToLibrary();
    if (inkIndex.isDirty()) await inkIndex.saveIndex();
    for (const item of items) {
      const file = item && typeof item.path === 'string' ? item.path : '';
      if (!file) continue;
      /* F4: o caminho da lista pode ter virado symlink; lê só o canônico contido. */
      const canonical = containedRealpath(file, courseRoots, {caseSensitive, realpath: realpathOf});
      if (!canonical) continue;
      let info;
      try {
        info = await stat(canonical);
      } catch {
        continue;
      }
      const mtime = Number(info?.mtimeMs) || 0;
      const size = Number(/** @type {{size?: unknown}} */ (info)?.size) || 0;
      /* B2: gravado no índice com o mesmo mtime+size, pula sem re-ler. */
      const record = inkIndex.files[file];
      if (record && record.mtimeMs === mtime && record.size === size) {
        seenMtime.set(file, mtime);
        doneMtime.set(file, mtime);
        continue;
      }
      /* M2: falha transitória na espera crescente — sem laço a cada 3 s. */
      const retryAfter = retryAt.get(file);
      if (typeof retryAfter === 'number' && retryAfter > nowMs()) continue;
      if (seenMtime.get(file) !== mtime) { seenMtime.set(file, mtime); continue; }
      if (doneMtime.get(file) === mtime) continue;
      if (halted) return;
      enqueue(file, {mtimeMs: mtime, size, canonical});
    }
  }

  /** Liga o polling, só com a opção ligada; `unref` para não segurar o app aberto. @returns {void} */
  function start() {
    stop();
    if (!inkEnabled()) return;
    stopped = false;
    const handle = setIntervalImpl(() => { void pollOnce(); }, pollMs);
    timer = handle;
    try {
      (/** @type {{unref?: () => void}} */ (handle))?.unref?.();
    } catch { /* intervalo falso sem unref */ }
  }

  /** Para ao fechar o app ou no teste: desarma o timer e aborta a leitura em voo (B1). @returns {void} */
  function stop() {
    if (timer !== null) clearIntervalImpl(timer);
    timer = null;
    stopped = true;
    if (inFlight) {
      try { inFlight.abort(); } catch { /* controlador já descartado */ }
      inFlight = null;
    }
    queue.clear();
    settleIdleWaiters();
  }

  /** Reavalia o interruptor do painel: arma quando liga, desarma quando desliga. @returns {void} @example ligado = true; watcher.setEnabled() // arma o timer */
  function setEnabled() {
    if (!inkEnabled()) {
      stop();
      return;
    }
    if (timer === null) start();
  }

  /** Estado para o IPC (`notebooks-ink-status`) e a UI futura. O motivo de modelo é transitório: reflete o pick ATUAL, não um estado velho (#158/G1). @returns {{status: string, pagesRead: number, enabled: boolean}} @example watcher.inkIndexStatus() // {status: 'idle', pagesRead: 3, enabled: true} */
  function inkIndexStatus() {
    const enabled = inkEnabled();
    const pick = currentPick();
    let status = state.status;
    if (!enabled) status = 'idle';
    else if (pick.reason) {
      if (status !== 'reading' && status !== 'quota') status = pick.reason;
    } else if (TRANSIENT_STATUS.has(status)) {
      status = processing ? 'reading' : 'idle';
    }
    return {status, pagesRead: state.pagesRead, enabled};
  }

  /* Textos lidos da tinta, por página — o que a busca consome. Chave fora da
     biblioteca nunca responde (#158, M3), mesmo antes do primeiro tick.
     @param {string} caminho @returns {string[] | null} @example watcher.inkTextsFor('/notas/aula.xopp') // ['∫ x dx', ''] */
  function inkTextsFor(caminho) {
    if (!inkEnabled()) return null;
    if (Object.keys(inkIndex.files).length > 0) inkIndex.pruneToLibrary();
    const record = inkIndex.files[caminho];
    if (!record) return null;
    return [...record.texts];
  }

  return {start, stop, setEnabled, pollOnce, whenIdle, inkIndexStatus, inkTextsFor};
}

/* O nome do acessor padrão, sem colidir com o parâmetro `inkEnabled`. */
function moduleInkEnabled() { return inkEnabled(); }

/**
 * Liga o vigia ao IPC (`notebooks-ink-status`): registra o canal de estado,
 * começa o polling e devolve o vigia para a busca ler `inkTextsFor`.
 * @param {{
*   ipcMain: {handle: (channel: string, fn: Function) => void},
*   listNotebooks: () => Array<{path: string}>,
*   runtime?: string|null,
*   allowSender?: (event: Electron.IpcMainInvokeEvent) => boolean,
*   inkEnabled?: () => boolean,
*   selection?: () => {model: string|null, effort: string|null}|null,
*   catalog?: () => import('./src/agents/opencode-catalog.cjs').CatalogModel[],
*   createBridge?: (selection: {model: string|null, effort: string|null}|null) => object,
*   readInkImpl?: typeof readInk,
*   exportInkPng?: (args: {file: string, page: number, xml: string, signal?: AbortSignal}) => Promise<unknown>, exportPageImageImpl?: typeof import('./src/extensions/mesa-mcp/notebook-tool.mjs').exportPageImage,
*   pdfAuthorize?: (file: string) => string, xournalPath?: string | (() => string),
*   courseRoots?: string[] | (() => string[]),
*   caseSensitive?: boolean, realpath?: (value: string) => string,
*   readFile?: typeof fs.promises.readFile,
*   stat?: typeof fs.promises.stat,
*   gunzip?: typeof gunzipAsync,
*   fsImpl?: typeof fs,
*   setIntervalImpl?: typeof setInterval,
*   clearIntervalImpl?: typeof clearInterval,
*   pollMs?: number,
*   nowMs?: () => number,
*   readIndexFile?: (file: string) => Promise<Buffer | string>,
*   log?: (line: string) => void
* }} deps dependências injetadas
 * @returns {{start: () => void, stop: () => void, setEnabled: () => void, pollOnce: () => Promise<void>, whenIdle: () => Promise<void>, inkIndexStatus: () => {status: string, pagesRead: number, enabled: boolean}, inkTextsFor: (caminho: string) => string[] | null}}
 * @example const watcher = registerNotebookInkHost({ipcMain, listNotebooks, runtime: config().runtimePath}) // registra notebooks-ink-status
 */
function registerNotebookInkHost(deps) {
  const watcher = createNotebookInkWatcher(deps);
  const allowSender = deps.allowSender || (() => true);
  deps.ipcMain.handle('notebooks-ink-status', (event) => {
    if (!allowSender(event)) throw Error(message('err.ipc.senderDenied', {channel: 'notebooks-ink-status'}));
    return watcher.inkIndexStatus();
  });
  watcher.start();
  return watcher;
}

module.exports = {createNotebookInkWatcher, registerNotebookInkHost, inkEnabled, INK_INDEX_DIR, INK_INDEX_FILE, INK_INDEX_MAX_BYTES, INK_RETRY_DELAYS_MS, INK_POLL_MS, INK_MAX_PAGES_PER_TICK};
