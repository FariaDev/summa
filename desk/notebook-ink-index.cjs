// @ts-check
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {NOTEBOOK_TEXT_LIMIT} = require('./src/notebook-xopp.mjs');

/* Índice persistente da tinta dos cadernos (#158, passo 2).
   Mora em `runtime/notebook-ink/index.json`, pasta 0700 e arquivo 0600.
   O registro por caderno guarda `hashes` e `texts` por página, além de
   `mtimeMs` e `size` concluídos (B2). A escrita é assíncrona atômica
   tmp+rename e a carga só acontece com a opção ligada (M3). */

const INK_INDEX_DIR = 'notebook-ink';
const INK_INDEX_FILE = 'index.json';
const INK_INDEX_VERSION = 2; /* a v1 continua legível (sem mtime/size por caderno) (#158) */
const INK_INDEX_VERSIONS = new Set([1, 2]);
const INK_INDEX_MAX_BYTES = 8 * 1024 * 1024; /* acima disso, o índice descarta e reescreve (#158) */
const INK_MAX_INDEX_PAGES = 2000; /* teto do registro adulterado por caderno (#158) */

/**
 * Corta o texto da tinta no limite do texto extraído.
 * @param {string} text texto lido do modelo
 * @returns {string} texto cortado em `NOTEBOOK_TEXT_LIMIT` caracteres
 * @example cutInkText('x'.repeat(50000)).length // 20000
 */
function cutInkText(text) {
  const value = String(text ?? '');
  return value.length > NOTEBOOK_TEXT_LIMIT ? value.slice(0, NOTEBOOK_TEXT_LIMIT) : value;
}

/**
 * Valida o índice em disco (M3): adulterado nasce vazio, sem derrubar nem entrar na busca.
 * @param {string} raw conteúdo do `index.json`
 * @returns {{files: {[caminho: string]: {hashes: string[], texts: string[], mtimeMs?: number, size?: number}}, rewrite: boolean}} arquivos validados e pedido de reescrita
 * @example parseIndexFile(JSON.stringify({version: 1, files: {}})) // {files: {}, rewrite: false}
 */
function parseIndexFile(raw) {
  try {
    const parsed = JSON.parse(raw);
    const root = /** @type {{files?: unknown, version?: unknown}} */ (parsed);
    if (!root || typeof root !== 'object' || Array.isArray(parsed) || !INK_INDEX_VERSIONS.has(/** @type {number} */ (root.version))) {
      return {files: Object.create(null), rewrite: true};
    }
    const files = Object.create(null);
    if (!root.files || typeof root.files !== 'object' || Array.isArray(root.files)) return {files: Object.create(null), rewrite: true};
    for (const [key, value] of Object.entries(/** @type {Record<string, unknown>} */ (root.files))) {
      if (!key || !value || typeof value !== 'object' || Array.isArray(value)) continue;
      const hashesRaw = /** @type {{hashes?: unknown}} */ (value).hashes;
      const textsRaw = /** @type {{texts?: unknown}} */ (value).texts;
      const record = {
        hashes: (Array.isArray(hashesRaw) ? hashesRaw : []).slice(0, INK_MAX_INDEX_PAGES).map((entry) => (typeof entry === 'string' ? entry : '')),
        texts: (Array.isArray(textsRaw) ? textsRaw : []).slice(0, INK_MAX_INDEX_PAGES).map((entry) => (typeof entry === 'string' ? cutInkText(entry) : '')),
      };
      if (typeof /** @type {{mtimeMs?: unknown}} */ (value).mtimeMs === 'number') record.mtimeMs = /** @type {{mtimeMs: number}} */ (value).mtimeMs;
      if (typeof /** @type {{size?: unknown}} */ (value).size === 'number') record.size = /** @type {{size: number}} */ (value).size;
      files[key] = record;
    }
    return {files, rewrite: false};
  } catch {
    return {files: Object.create(null), rewrite: true};
  }
}

/**
 * Guarda o índice persistente em memória e no disco.
 * @param {{
*   indexFile: string | null,
*   listNotebooks: () => Array<{path: string}>,
*   fsImpl?: typeof fs,
*   stat?: typeof fs.promises.stat,
*   readIndexFile?: (file: string) => Promise<Buffer | string>,
*   log?: (line: string) => void,
*   isStopped?: () => boolean
* }} deps dependências injetadas (os testes usam fs e relógio falsos com nome)
 * @returns {{files: {[caminho: string]: {hashes: string[], texts: string[], mtimeMs?: number, size?: number}}, isDirty: () => boolean, markDirty: () => void, ensureIndexLoaded: () => Promise<void>, saveIndex: () => Promise<void>, pruneToLibrary: () => void}} guarda do índice
 * @example const store = createNotebookInkIndex({indexFile: '/rt/notebook-ink/index.json', listNotebooks: () => []}); await store.ensureIndexLoaded(); // carrega do disco
 */
function createNotebookInkIndex({
  indexFile, listNotebooks, fsImpl = fs, stat = fs.promises.stat,
  readIndexFile = (file) => fs.promises.readFile(file), log = () => {},
  isStopped = () => false,
}) {
  let indexDirty = false;
  /** @type {{[caminho: string]: {hashes: string[], texts: string[], mtimeMs?: number, size?: number}}} */
  let index = Object.create(null);
  let indexLoaded = false;
  /** Carregamento em voo: dois ticks seguidos aguardam o mesmo pedido. @type {Promise<void>|null} */
  let indexLoading = null;
  /** Gravações do índice em série (tmp+rename): `saveIndex` espera o último. @type {Promise<void>} */
  let saveChain = Promise.resolve();

  /**
   * Carrega o índice em disco, assíncrono e só quando chamado.
   * Acima de 8 MB, JSON inválido ou tipos errados: nasce vazio e reescreve.
   * @returns {Promise<void>} promessa do carregamento
   * @example await store.ensureIndexLoaded() // resolve com o índice em memória
   */
  async function ensureIndexLoaded() {
    if (indexLoaded) return;
    if (indexLoading) return indexLoading;
    indexLoading = (async () => {
      if (!indexFile) { indexLoaded = true; return; }
      try {
        const fileInfo = await stat(indexFile);
        if (typeof fileInfo?.size === 'number' && fileInfo.size > INK_INDEX_MAX_BYTES) {
          index = Object.create(null);
          indexDirty = indexLoaded = true;
          return;
        }
        const parsed = parseIndexFile(String(await readIndexFile(indexFile)));
        index = parsed.files;
        indexDirty = indexDirty || parsed.rewrite;
        indexLoaded = true;
      } catch (error) {
        index = Object.create(null);
        /* Arquivo ausente é o caso normal (primeira vez): nasce vazio, limpo. */
        if (/** @type {{code?: unknown}} */ (error)?.code !== 'ENOENT') indexDirty = true;
        indexLoaded = true;
      } finally {
        indexLoading = null;
      }
    })();
    return indexLoading;
  }

  /**
   * Escrita assíncrona do índice (tmp + rename), pasta 0700 e arquivo 0600, sem logar texto.
   * Corta os cadernos mais antigos quando a gravação passaria de 8 MB.
   * @returns {Promise<void>} promessa das gravações em série
   * @example store.markDirty(); await store.saveIndex() // grava no disco
   */
  function saveIndex() {
    pruneToLibrary();
    const run = async () => {
      if (!indexDirty) return;
      if (isStopped()) return;
      indexDirty = false;
      try {
        await ensureIndexLoaded();
        if (isStopped()) { indexDirty = true; return; }
        const inkDir = path.dirname(/** @type {string} */ (indexFile));
        await fsImpl.promises.mkdir(inkDir, {recursive: true, mode: 0o700});
        try { await fsImpl.promises.chmod(inkDir, 0o700); } catch { /* mkdir já deu o modo */ }
        if (isStopped()) { indexDirty = true; return; }
        let payload = `${JSON.stringify({version: INK_INDEX_VERSION, files: index})}\n`;
        if (Buffer.byteLength(payload, 'utf8') > INK_INDEX_MAX_BYTES) {
          const oldestFirst = Object.keys(index).sort((a, b) => (index[a].mtimeMs ?? 0) - (index[b].mtimeMs ?? 0));
          for (const key of oldestFirst) {
            if (Buffer.byteLength(payload, 'utf8') <= INK_INDEX_MAX_BYTES) break;
            delete index[key];
            payload = `${JSON.stringify({version: INK_INDEX_VERSION, files: index})}\n`;
          }
        }
        if (Buffer.byteLength(payload, 'utf8') > INK_INDEX_MAX_BYTES) {
          for (const key of Object.keys(index)) {
            const record = index[key];
            while (Buffer.byteLength(payload, 'utf8') > INK_INDEX_MAX_BYTES && record.hashes.length > 0) {
              record.hashes.shift();
              record.texts.shift();
              payload = `${JSON.stringify({version: INK_INDEX_VERSION, files: index})}\n`;
            }
            if (Buffer.byteLength(payload, 'utf8') <= INK_INDEX_MAX_BYTES) break;
          }
        }
        if (Buffer.byteLength(payload, 'utf8') > INK_INDEX_MAX_BYTES) {
          log('índice da tinta: acima de 8 MB, sem gravar');
          return;
        }
        const temporary = `${indexFile}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
        await fsImpl.promises.writeFile(temporary, payload, {encoding: 'utf8', mode: 0o600});
        await fsImpl.promises.rename(temporary, /** @type {string} */ (indexFile));
      } catch (error) {
        indexDirty = true;
        log(`índice da tinta: não gravou (${String(/** @type {{code?: unknown}} */ (error)?.code || error || 'erro')})`);
      }
    };
    saveChain = saveChain.then(run, run);
    return saveChain;
  }

  /**
   * Poda de cadernos que saíram da biblioteca.
   * @returns {void} nada
   * @example store.pruneToLibrary() // remove do índice o que não está na biblioteca
   */
  function pruneToLibrary() {
    let known;
    try {
      known = new Set((listNotebooks() || []).map((item) => item && item.path).filter((entry) => typeof entry === 'string'));
    } catch {
      return;
    }
    for (const key of Object.keys(index)) {
      if (!known.has(key)) {
        delete index[key];
        indexDirty = true;
      }
    }
  }

  return {
    get files() { return index; },
    isDirty: () => indexDirty,
    markDirty: () => { indexDirty = true; },
    ensureIndexLoaded,
    saveIndex,
    pruneToLibrary,
  };
}

module.exports = {
  createNotebookInkIndex,
  cutInkText,
  parseIndexFile,
  INK_INDEX_DIR,
  INK_INDEX_FILE,
  INK_INDEX_VERSION,
  INK_INDEX_MAX_BYTES,
  INK_MAX_INDEX_PAGES,
};
