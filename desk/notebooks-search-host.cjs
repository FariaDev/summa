// @ts-check
const fs = require('node:fs');
const zlib = require('node:zlib');
const {promisify} = require('node:util');
const gunzipAsync = promisify(zlib.gunzip);
const {message} = require('./src/i18n.mjs');
const {NOTEBOOK_MAX_XML_BYTES, hasUnsafeDoctype, notebookPageStrings} = require('./src/notebook-xopp.mjs');
const {isPathUnderRoot} = require('./file-guard.cjs');

/* ---------- busca no texto digitado dos cadernos (#158, passo 1, grátis) ----------
   O índice junta as caixas `<text>` e o LaTeX de cada página dos `.xopp` só da
   biblioteca (a lista vem do `notebooks-host.cjs`), sem nenhum modelo e sem
   rede. A leitura não trava o main: gunzip ASSÍNCRONO com teto de 32 MB (o
   mesmo do `ler_caderno`), cache em memória por caminho+mtime+ctime+tamanho,
   e XML com `<!DOCTYPE`/`<!ENTITY` ignorado (nunca vira resultado). Sem lei
   Bend (ADR 0003: o índice não esconde resposta nem alimenta o tutor); o
   índice fica só neste computador, em memória. */

const SEARCH_RESULT_LIMIT = 50;
const SEARCH_QUERY_LIMIT = 200;
const SEARCH_CACHE_LIMIT = 200;
const SEARCH_LIST_TTL_MS = 30000;
const SEARCH_COMPRESSED_CAP = 32 * 1024 * 1024;

/**
 * `realpath` nativo do fs, com queda léxica para quem injeta só uma árvore.
 * @param {{realpathSync?: any}} fsImpl @returns {(value: string) => string}
 */
function defaultRealpath(fsImpl) {
  const sync = fsImpl && fsImpl.realpathSync;
  if (typeof sync === 'function') return typeof sync.native === 'function' ? (value) => sync.native(value) : (value) => sync(value);
  return (value) => String(value);
}

/**
 * @typedef {{courseId: string, name: string, path: string, materia?: string, folder?: string, mtimeMs?: number}} LibraryNotebook
 * @typedef {{caminho: string, nomeExibido: string, materia: string, pagina: number, trecho: string, origem: 'texto'|'tinta'}} NotebookSearchHit
 */

/**
 * Minusculas sem acento, com mapa para mapear o achado de volta ao original.
 * Os índices são em code units (o que `slice` usa): emoji conta 2, sem
 * deslocar o achado. `starts[foldedIndex]` é o índice no original.
 *  @param {string} value @returns {{folded: string, starts: number[]}}
 *  @example foldSearchText('😀Á') // {folded: '😀a', starts: [0, 0, 2]}
 */
function foldSearchText(value) {
  const foldedParts = [];
  /** @type {number[]} */
  const starts = [];
  let origPos = 0;
  for (const char of String(value)) {
    const form = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (let offset = 0; offset < form.length; offset += 1) {
      foldedParts.push(form[offset]);
      starts.push(origPos);
    }
    origPos += char.length;
  }
  return {folded: foldedParts.join(''), starts};
}

/**
 * Trecho ao redor do achado, sem quebrar palavra no meio quando dá. `start`
 * e `end` já são índices no texto colapsado (o mesmo do `slice`), então o
 * achado e o recorte falam do mesmo texto. Bordas em par substituto e no
 * meio da palavra são ajustadas para a borda da palavra.
 *  @param {string} original @param {number} start @param {number} end @returns {string}
 *  @example snippetAround('a palavra alvo aqui', 3, 9) // 'a palavra alvo aqui'
 */
function snippetAround(original, start, end) {
  const source = String(original).replace(/\s+/g, ' ');
  const clampedStart = Math.max(0, Math.min(start, source.length));
  const clampedEnd = Math.max(clampedStart, Math.min(end, source.length));
  let from = Math.max(0, clampedStart - 40);
  let to = Math.min(source.length, clampedEnd + 80);
  if (from > 0 && from < source.length) {
    const code = source.charCodeAt(from);
    if (code >= 0xDC00 && code <= 0xDFFF) from += 1;
  }
  if (to > 0 && to < source.length) {
    const code = source.charCodeAt(to);
    if (code >= 0xDC00 && code <= 0xDFFF) to += 1;
  }
  if (from > 0 && source[from - 1] !== ' ' && source[from] !== ' ') {
    const prev = source.lastIndexOf(' ', from - 1);
    from = prev >= 0 ? prev + 1 : 0;
  }
  if (to < source.length && source[to - 1] !== ' ' && source[to] !== ' ') {
    const next = source.indexOf(' ', to);
    to = next >= 0 ? next : source.length;
  }
  return (from > 0 ? '…' : '') + source.slice(from, to) + (to < source.length ? '…' : '');
}

/**
 * Cria a busca sobre a lista viva da biblioteca; o cache mora na fábrica e
 * vale para toda a janela. Só os `.xopp` que `listNotebooks` lista entram no
 * índice; arquivo ilegível, gzip acima do teto, XML com DOCTYPE ou caderno
 * fora da lista é pulado em silêncio, sem derrubar a busca.
 *  @param {{listNotebooks: () => LibraryNotebook[], courses?: () => Array<{id: string, name?: string, path?: string}>, readFile?: typeof fs.promises.readFile, stat?: typeof fs.promises.stat, gunzip?: typeof gunzipAsync, realpath?: (value: string) => string, caseSensitive?: boolean, inkTexts?: (caminho: string) => string[] | null}} deps dependências injetadas (os testes usam pastas temporárias e contadores)
 *  @returns {{searchNotebooks: (query: unknown) => Promise<NotebookSearchHit[]>}}
 *  @example const busca = createNotebookSearch({listNotebooks: () => lib.cadernos()}); await busca.searchNotebooks('equacao') // [{caminho, nomeExibido, materia, pagina, trecho, origem: 'texto'}]
 */
function createNotebookSearch({listNotebooks, courses, readFile = fs.promises.readFile, stat = fs.promises.stat, gunzip = gunzipAsync, realpath = defaultRealpath(fs), caseSensitive = process.platform !== 'win32' && process.platform !== 'darwin', inkTexts}) {
  /** @type {Map<string, {mtimeMs: number, ctimeMs: number, size: number, pages: string[] | null}>} */
  const cache = new Map();
  let searchGeneration = 0;
  /** @type {LibraryNotebook[] | null} */
  let listCache = null;
  let listCacheAt = 0;

  /** A lista em cache (30 s): cada busca não re-varre as matérias. @returns {LibraryNotebook[]} */
  function currentList() {
    const now = Date.now();
    if (listCache && now - listCacheAt < SEARCH_LIST_TTL_MS) return listCache;
    const fresh = listNotebooks() || [];
    listCache = fresh;
    listCacheAt = now;
    return fresh;
  }

  /** Cede o event loop entre cadernos para o main respirar. @returns {Promise<void>} */
  function yieldToLoop() {
    return new Promise((resolve) => setImmediate(resolve));
  }

  /** Nome da matéria a partir das abas; sem ela, vale o que o item já traz. @param {LibraryNotebook} item @returns {string} */
  function materiaOf(item) {
    const live = (typeof courses === 'function' ? courses() || [] : []).find((entry) => entry && entry.id === item.courseId);
    if (live && live.name) return String(live.name);
    return String(item.materia || item.courseId || '');
  }

  /** Raiz canônica da matéria do item; `undefined` sem `courses` (testes puros), `null` quando a matéria sumiu. @param {LibraryNotebook} item @returns {string|undefined|null} */
  function courseRootOf(item) {
    if (typeof courses !== 'function') return undefined;
    const live = (courses() || []).find((entry) => entry && entry.id === item.courseId);
    if (!live || typeof live.path !== 'string' || !live.path) return null;
    try { return realpath(live.path); } catch { return null; }
  }

  /** XML do caderno na memória, com cache por caminho+mtime+ctime+tamanho; `null` quando não entra no índice. Re-resolve o canônico e confere a matéria antes de `stat`/`readFile` (#158/F4). @param {LibraryNotebook} item @returns {Promise<string[] | null>} */
  async function pagesOfNotebook(item) {
    let target = item.path;
    if (typeof courses === 'function') {
      const root = courseRootOf(item);
      if (!root) return null;
      try { target = realpath(item.path); } catch { return null; }
      if (!isPathUnderRoot(target, root, {caseSensitive})) return null;
    }
    let info;
    try {
      info = await stat(target);
    } catch { return null; }
    const mtimeMs = typeof info?.mtimeMs === 'number' ? info.mtimeMs : 0;
    const ctimeMs = typeof info?.ctimeMs === 'number' ? info.ctimeMs : 0;
    const size = typeof info?.size === 'number' ? info.size : 0;
    if (size > SEARCH_COMPRESSED_CAP) {
      if (cache.size >= SEARCH_CACHE_LIMIT) cache.delete(cache.keys().next().value);
      cache.set(item.path, {mtimeMs, ctimeMs, size, pages: null});
      return null;
    }
    const known = cache.get(item.path);
    if (known && known.mtimeMs === mtimeMs && known.ctimeMs === ctimeMs && known.size === size) return known.pages;
    let stores = null;
    try {
      const bytes = /** @type {Buffer} */ (await readFile(target));
      const output = /** @type {Buffer} */ (await gunzip(bytes, {maxOutputLength: NOTEBOOK_MAX_XML_BYTES}));
      if (output.length <= NOTEBOOK_MAX_XML_BYTES) {
        const xml = output.toString('utf8');
        if (!hasUnsafeDoctype(xml)) stores = notebookPageStrings(xml);
      }
    } catch { stores = null; }
    if (cache.size >= SEARCH_CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(item.path, {mtimeMs, ctimeMs, size, pages: stores});
    return stores;
  }

  /**
   * Busca o texto digitado na biblioteca; uma página com vários trechos vira
   * um resultado só (o primeiro achado). Consulta vazia não busca nada;
   * consulta inválida recusa sem caminho pessoal.
   *  @param {unknown} query @returns {Promise<NotebookSearchHit[]>}
   *  @example await searchNotebooks('EQUACAO') // [{caminho: '…/aula.xopp', nomeExibido: 'aula.xopp', materia: 'Cálculo', pagina: 1, trecho: '…Equação do primeiro grau…'}]
   */
  async function searchNotebooks(query) {
    if (typeof query !== 'string') {
      throw Error(message('err.notebook.searchInvalid', {received: typeof query}));
    }
    if (query.length > SEARCH_QUERY_LIMIT) {
      throw Error(message('err.notebook.searchInvalid', {received: `${query.length} caracteres`}));
    }
    const wanted = foldSearchText(query).folded.trim();
    if (!wanted) return [];
    const myGeneration = ++searchGeneration;
    const hits = [];
    const items = currentList();
    for (let at = 0; at < items.length; at += 1) {
      if (myGeneration !== searchGeneration) return hits;
      const item = items[at];
      if (at > 0) await yieldToLoop();
      if (myGeneration !== searchGeneration) return hits;
      if (!item || typeof item.path !== 'string' || !item.path) continue;
      const pages = await pagesOfNotebook(item);
      if (myGeneration !== searchGeneration) return hits;
      if (!pages) continue;
      for (let index = 0; index < pages.length; index += 1) {
        const pageText = pages[index];
        if (!pageText) continue;
        const plain = String(pageText).replace(/\s+/g, ' ').trim();
        if (!plain) continue;
        const {folded, starts} = foldSearchText(plain);
        const foundAt = folded.indexOf(wanted);
        if (foundAt < 0) continue;
        const originalAt = starts[foundAt] ?? 0;
        const lastOriginal = starts[foundAt + wanted.length - 1] ?? originalAt;
        const lastLength = plain.codePointAt(lastOriginal) > 0xFFFF ? 2 : 1;
        const originalEnd = lastOriginal + lastLength;
        hits.push({
          caminho: item.path,
          nomeExibido: String(item.name || ''),
          materia: materiaOf(item),
          pagina: index + 1,
          trecho: snippetAround(plain, originalAt, Math.min(originalEnd, plain.length)),
          origem: 'texto',
        });
        if (hits.length >= SEARCH_RESULT_LIMIT) return hits;
      }
      /* Texto da tinta (#158, passo 2): o mesmo texto lido pelo modelo,
         na mesma normalização e no mesmo recorte; o digitado vem antes. */
      if (myGeneration !== searchGeneration) return hits;
      const inkPages = typeof inkTexts === 'function' ? inkTexts(item.path) : null;
      if (Array.isArray(inkPages)) {
        for (let inkIndex = 0; inkIndex < inkPages.length; inkIndex += 1) {
          const inkPlain = String(inkPages[inkIndex] || '').replace(/\s+/g, ' ').trim();
          if (!inkPlain) continue;
          const foldedInk = foldSearchText(inkPlain);
          const inkFoundAt = foldedInk.folded.indexOf(wanted);
          if (inkFoundAt < 0) continue;
          const inkOriginalAt = foldedInk.starts[inkFoundAt] ?? 0;
          const inkLastOriginal = foldedInk.starts[inkFoundAt + wanted.length - 1] ?? inkOriginalAt;
          const inkLastLength = inkPlain.codePointAt(inkLastOriginal) > 0xFFFF ? 2 : 1;
          const inkOriginalEnd = inkLastOriginal + inkLastLength;
          hits.push({
            caminho: item.path,
            nomeExibido: String(item.name || ''),
            materia: materiaOf(item),
            pagina: inkIndex + 1,
            trecho: snippetAround(inkPlain, inkOriginalAt, Math.min(inkOriginalEnd, inkPlain.length)),
            origem: 'tinta',
          });
          if (hits.length >= SEARCH_RESULT_LIMIT) return hits;
        }
      }
      if (hits.length >= SEARCH_RESULT_LIMIT) return hits;
    }
    return hits;
  }

  return {searchNotebooks};
}

/**
 * Liga a busca ao IPC (`notebooks-search`): recebe a consulta como texto e
 * devolve os resultados no formato `{caminho, nomeExibido, materia, pagina,
 * trecho, origem}`. O cache vive no processo principal; o renderer nunca abre o
 * arquivo.
 *  @param {{ipcMain: {handle: (channel: string, fn: Function) => void}, courses?: () => Array<{id: string, name?: string, path?: string}>, listNotebooks: () => LibraryNotebook[], readFile?: typeof fs.promises.readFile, stat?: typeof fs.promises.stat, gunzip?: typeof gunzipAsync, realpath?: (value: string) => string, caseSensitive?: boolean, allowSender?: (event: Electron.IpcMainInvokeEvent) => boolean, inkTexts?: (caminho: string) => string[] | null}} deps dependências injetadas
 *  @returns {void}
 *  @example registerNotebookSearchHost({ipcMain, courses: () => live.courses, listNotebooks: () => allNotebooks()}) // registra notebooks-search
 */
function registerNotebookSearchHost({ipcMain, courses, listNotebooks, readFile = fs.promises.readFile, stat = fs.promises.stat, gunzip = gunzipAsync, realpath = defaultRealpath(fs), caseSensitive = process.platform !== 'win32' && process.platform !== 'darwin', allowSender = () => true, inkTexts}) {
  const search = createNotebookSearch({listNotebooks, courses, readFile, stat, gunzip, realpath, caseSensitive, inkTexts});
  ipcMain.handle('notebooks-search', (event, rawQuery) => {
    if (!allowSender(event)) throw Error(message('err.ipc.senderDenied', {channel: 'notebooks-search'}));
    return search.searchNotebooks(rawQuery);
  });
}

module.exports = {createNotebookSearch, registerNotebookSearchHost, SEARCH_RESULT_LIMIT, SEARCH_QUERY_LIMIT};
