/* `ler_caderno` (#135, só leitura; #213 fundo PDF): PNG do Xournal++ sobre cópia temporária, texto/LaTeX do XML em gzip; só `.xopp` conhecido (canônico guardado na autorização, sem re-resolver a lista); fundo PDF da cópia só o que a autorização de PDF do tutor aceitaria (fora vira sólido com aviso; dentro vira absoluto). Nome final OpenCode: `mesa_ler_caderno`. */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {jsonSchemaOf} from '../tool-fields.mjs';
import {message} from '../../i18n.mjs';
import {NOTEBOOK_MAX_XML_BYTES, NOTEBOOK_TEXT_LIMIT, hasUnsafeDoctype, latexOf, pagesOfXml, textsOf} from '../../notebook-xopp.mjs';
import {missingPdfOf, sanitizeBackgrounds} from './notebook-background.mjs';
import toolErrorModule from '../../agents/tool-error-text.cjs';
const {toolErrorText} = toolErrorModule;
export {NOTEBOOK_MAX_XML_BYTES, NOTEBOOK_TEXT_LIMIT};
export const NOTEBOOK_TOOL_NAME = 'ler_caderno';
export const NOTEBOOK_TIMEOUT_MS = 15000;
/* 120 DPI (#135): 300 padrão gera PNG de vários MB; 120 legível e pequeno. */
export const NOTEBOOK_DPI = 120;
export const NOTEBOOK_ORPHAN_MS = 60 * 60 * 1000; /* órfãos > 1 h saem na 1ª chamada */
export const NOTEBOOK_DESCRIPTION = 'Reads one page of a saved .xopp notebook (Xournal++) through the desk library: the page PNG rendered by Xournal++ itself, plus the text and embedded LaTeX the .xopp already stores. Read-only: the notebook is never written; the export happens on a temporary copy. The notebook must be one the desk already knows. caminho is the .xopp path as the desk reported; pagina is counted from 1. If the notebook page has a missing PDF background, the response says the image has no PDF.';
export const NOTEBOOK_FIELDS = {
  caminho: {type: 'string', min: 1, max: 4096, description: '.xopp notebook path, as the desk reported.'},
  pagina: {type: 'integer', min: 1, max: 100000, description: 'Page, counted from 1.'},
};
/* O filtro antigo (regex de `attrOf` + `sanitizeBackgrounds` aqui) virou lista
   branca em `notebook-background.mjs`: tag NOVO, nunca copiado. */
/** @param {unknown} value @param {typeof fs.realpathSync} realpath @returns {string} */
function normalizeForCompare(value, realpath) {
  try { return realpath(String(value || '')); } catch { return path.resolve(String(value || '')); }
}
/** Só `.xopp` conhecido; lista guarda canônico, aqui só `realpath` da entrada × canônico, sem re-resolver a lista (#135). @param {unknown} caminho @param {Iterable<string>} allowedXopp @param {typeof fs.realpathSync} realpath @returns {string} */
function authorizedPath(caminho, allowedXopp, realpath) {
  const normalized = normalizeForCompare(caminho, realpath);
  const known = new Set([...allowedXopp]);
  if (!known.has(normalized)) {
    throw Error(message('err.notebook.forbidden', {received: path.basename(String(caminho || ''))}));
  }
  return normalized;
}
/** XML dentro do gzip; ZIP (`.xoz`) recusado pelo nome. @param {Buffer} bytes @param {string} base @param {typeof zlib.gunzipSync} gunzip @returns {string} */
function gunzipXml(bytes, base, gunzip) {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    throw Error(message('err.notebook.zipUnsupported', {received: base}));
  }
  try {
    return gunzip(bytes, {maxOutputLength: NOTEBOOK_MAX_XML_BYTES}).toString('utf8');
  } catch (error) {
    const code = String(error?.code || '');
    const detail = String(error?.message || '');
    if (code === 'ERR_BUFFER_TOO_LARGE' || code === 'ERR_OUT_OF_RANGE' || /larger than|too large|out of range/i.test(detail)) {
      throw Error(message('err.notebook.tooLarge', {received: base}));
    }
    throw Error(message('err.notebook.badFormat', {received: base}));
  }
}
/** Exporta pelo CLI sem janela, com prazo e kill; stderr nunca volta ao modelo, só código + frase. @param {{binary: string, copy: string, out: string, page: number, timeoutMs: number, spawnProcess?: typeof spawn}} options @returns {Promise<void>} */
function runXournalpp({binary, copy, out, page, timeoutMs, spawnProcess = spawn}) {
  return new Promise((resolve, reject) => {
    const env = {...process.env};
    delete env.DISPLAY;
    let timedOut = false;
    const child = spawnProcess(binary, [copy, '-n', String(page), `--export-range=${page}`, '--create-img', out, '--export-png-dpi', String(NOTEBOOK_DPI)], {env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true});
    child.stderr?.on('data', () => {});
    const timer = setTimeout(() => { timedOut = true; try { child.kill('SIGKILL'); } catch { /* o processo já era */ } }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(Error(message('err.notebook.spawnFailed', {received: path.basename(binary), cause: String(error?.code || 'unknown')})));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(Error(message('err.notebook.timeout', {timeoutMs, page})));
        return;
      }
      if (code !== 0) {
        reject(Error(message('err.notebook.xournalFailed', {code: code ?? 'unknown'})));
        return;
      }
      resolve();
    });
  });
}
let orphanCleanupDone = false;
const ORPHAN_NAME = /^mesa-ler-caderno-[A-Za-z0-9]{6}$/;
/** 1ª chamada da execução: apaga só diretório `mesa-ler-caderno-XXXXXX` (lstat, formato exato, uid atual, mtime > 1 h); falha nunca derruba a leitura. @param {{tmpdir: typeof os.tmpdir, readdir: typeof fs.readdirSync, statSync: typeof fs.statSync, lstatSync: typeof fs.lstatSync, rm: typeof fs.rmSync}} deps @returns {void} */
function cleanupOrphanTemp({tmpdir, readdir, statSync, lstatSync, rm}) {
  if (orphanCleanupDone) return;
  orphanCleanupDone = true;
  const lstat = lstatSync || statSync;
  let entries;
  try { entries = readdir(tmpdir()); } catch { return; }
  const now = Date.now();
  const currentUid = typeof process.getuid === 'function' ? process.getuid() : undefined;
  for (const entry of entries) {
    if (typeof entry !== 'string' || !ORPHAN_NAME.test(entry)) continue;
    const full = path.join(tmpdir(), entry);
    let info;
    try { info = lstat(full); } catch { continue; }
    if (!info || typeof info.isDirectory !== 'function' || !info.isDirectory()) continue;
    if (currentUid !== undefined && info.uid !== currentUid) continue;
    if (!(now - info.mtimeMs > NOTEBOOK_ORPHAN_MS)) continue;
    try { rm(full, {recursive: true, force: true}); } catch { /* o órfão não derruba a leitura */ }
  }
}
/** Cópia temporária apagada em todos os desfechos; `rm` que falha não mascara o original. @param {{file: string, page: number, xournalPath: string, timeoutMs: number, copyBytes?: Buffer, attachCopies?: Array<{source: string, filename: string}>, spawnProcess?: typeof spawn, existsSync?: typeof fs.existsSync, copyFile?: typeof fs.copyFileSync, writeFile?: typeof fs.writeFileSync, mkdtemp?: typeof fs.mkdtempSync, rm?: typeof fs.rmSync, tmpdir?: typeof os.tmpdir, readFile?: typeof fs.readFileSync, readdir?: typeof fs.readdirSync, statSync?: typeof fs.statSync, lstatSync?: typeof fs.lstatSync}} options @returns {Promise<Buffer>} */
async function exportPage({file, page, xournalPath, timeoutMs, spawnProcess, existsSync = fs.existsSync, copyFile = fs.copyFileSync, copyBytes, attachCopies = [], writeFile = fs.writeFileSync, mkdtemp = fs.mkdtempSync, rm = fs.rmSync, tmpdir = os.tmpdir, readFile = fs.readFileSync, readdir = fs.readdirSync, statSync = fs.statSync, lstatSync = fs.lstatSync}) {
  cleanupOrphanTemp({tmpdir, readdir, statSync, lstatSync, rm});
  const dir = mkdtemp(path.join(tmpdir(), 'mesa-ler-caderno-'));
  try {
    const copy = path.join(dir, path.basename(file));
    try {
      if (copyBytes !== undefined) writeFile(copy, copyBytes);
      else copyFile(file, copy);
      for (const entry of attachCopies) copyFile(entry.source, `${copy}.${entry.filename}`);
    } catch {
      throw Error(message('err.notebook.readFailed'));
    }
    const out = path.join(dir, 'page.png');
    await runXournalpp({binary: xournalPath || 'xournalpp', copy, out, page, timeoutMs, spawnProcess});
    const pngFile = existsSync(out) ? out : path.join(dir, `page-${page}.png`);
    if (!existsSync(pngFile)) throw Error(message('err.notebook.noImage', {page}));
    return readFile(pngFile);
  } finally {
    try { rm(dir, {recursive: true, force: true}); } catch { /* apagar não mascara o original */ }
  }
}
/** PNG de uma página já localizada no XML descomprimido (cópia higienizada
   + CLI do Xournal++), um caminho só para o `ler_caderno` e o índice da
   tinta (#158, passo 2). O XML vem de quem já leu o `.xopp` uma vez (hash
   por página da tinta), então o chamador não paga a leitura de novo.
    @param {{file: string, page: number, xml: string, xournalPath?: string, timeoutMs?: number, courseRoots?: string[], pdfAuthorize?: (file: string) => string, caseSensitive?: boolean, spawnProcess?: typeof spawn, readFile?: typeof fs.readFileSync, realpath?: typeof fs.realpathSync, existsSync?: typeof fs.existsSync, copyFile?: typeof fs.copyFileSync, writeFile?: typeof fs.writeFileSync, mkdtemp?: typeof fs.mkdtempSync, rm?: typeof fs.rmSync, tmpdir?: typeof os.tmpdir, readdir?: typeof fs.readdirSync, statSync?: typeof fs.statSync, lstatSync?: typeof fs.lstatSync, gzip?: typeof zlib.gzipSync}} options `courseRoots` fica aceito para o índice da tinta, mas é ignorado desde a #213 (a raiz da matéria não autoriza fundo)
   @returns {Promise<{png: Buffer, backgroundIgnored: boolean}>} os bytes do PNG e se o fundo foi ignorado @example await exportPageImage({file: '/notas/aula.xopp', page: 2, xml}) // {png: Buffer, backgroundIgnored: false}
*/
export async function exportPageImage({file, page, xml, xournalPath = '', timeoutMs = NOTEBOOK_TIMEOUT_MS, courseRoots = [], pdfAuthorize, caseSensitive, spawnProcess, readFile = fs.readFileSync, realpath = fs.realpathSync.native, existsSync = fs.existsSync, copyFile = fs.copyFileSync, writeFile = fs.writeFileSync, mkdtemp = fs.mkdtempSync, rm = fs.rmSync, tmpdir = os.tmpdir, readdir = fs.readdirSync, statSync = fs.statSync, lstatSync = fs.lstatSync, gzip = zlib.gzipSync} = {}) {
  void courseRoots;
  const sensitive = caseSensitive ?? (process.platform !== 'win32' && process.platform !== 'darwin');
  const sanitized = sanitizeBackgrounds(xml, {notebookPath: String(file || ''), notebookDir: path.dirname(String(file || '')), pdfAuthorize, realpath, existsSync, statSync, caseSensitive: sensitive});
  const copyBytes = gzip(sanitized.xml);
  const png = await exportPage({file, page, xournalPath, timeoutMs, spawnProcess, existsSync, copyFile, copyBytes, attachCopies: sanitized.attachCopies, writeFile, mkdtemp, rm, tmpdir, readFile, readdir, statSync, lstatSync});
  return {png, backgroundIgnored: sanitized.backgroundIgnored};
}
/** Lê uma página de `.xopp` conhecido (lista antes de ler; fundo higienizado na cópia, PDF só com a autorização do tutor). @param {{caminho?: unknown, pagina?: unknown}} args @param {{allowedXopp?: Iterable<string>, xournalPath?: string, timeoutMs?: number, pdfAuthorize?: (file: string) => string, caseSensitive?: boolean, spawnProcess?: typeof spawn, readFile?: typeof fs.readFileSync, realpath?: typeof fs.realpathSync, existsSync?: typeof fs.existsSync, copyFile?: typeof fs.copyFileSync, writeFile?: typeof fs.writeFileSync, mkdtemp?: typeof fs.mkdtempSync, rm?: typeof fs.rmSync, tmpdir?: typeof os.tmpdir, readdir?: typeof fs.readdirSync, statSync?: typeof fs.statSync, lstatSync?: typeof fs.lstatSync, gunzip?: typeof zlib.gunzipSync, gzip?: typeof zlib.gzipSync}} [options] @returns {Promise<{file: string, page: number, total: number, text: string[], latex: string[], missingPdf: boolean, backgroundIgnored: boolean, image: string}>} @example await readNotebookPage({caminho: '/notas/aula.xopp', pagina: 2}, {allowedXopp: ['/notas/aula.xopp']}) */
export async function readNotebookPage(args, {
  allowedXopp = [], xournalPath = '', timeoutMs = NOTEBOOK_TIMEOUT_MS,
  pdfAuthorize, caseSensitive,
  spawnProcess = spawn, readFile = fs.readFileSync, realpath = fs.realpathSync.native,
  existsSync = fs.existsSync, copyFile = fs.copyFileSync, writeFile = fs.writeFileSync,
  mkdtemp = fs.mkdtempSync, rm = fs.rmSync, tmpdir = os.tmpdir,
  readdir = fs.readdirSync, statSync = fs.statSync, lstatSync = fs.lstatSync,
  gunzip = zlib.gunzipSync, gzip = zlib.gzipSync,
} = {}) {
  const pagina = args?.pagina;
  if (!Number.isInteger(pagina) || pagina < 1) {
    throw Error(message('err.notebook.badPage', {received: JSON.stringify(pagina)}));
  }
  const file = authorizedPath(args?.caminho, allowedXopp, realpath);
  const base = path.basename(file);
  /* F5: o teto do .xopp comprimido é conferido pelo `stat` ANTES de ler; um
     arquivo gigante não é alocado inteiro para depois ser recusado. */
  let fileInfo;
  try { fileInfo = statSync(file); } catch { /* sem stat, o readFile decide */ }
  if (fileInfo && typeof fileInfo.size === 'number' && fileInfo.size > NOTEBOOK_MAX_XML_BYTES) {
    throw Error(message('err.notebook.tooLarge', {received: base}));
  }
  let bytes;
  try { bytes = readFile(file); } catch {
    throw Error(message('err.notebook.notFound', {received: base}));
  }
  const xml = gunzipXml(bytes, base, gunzip);
  /* O Xournal++ 1.3 (`LoadHandler.cpp`, branch release-1.3, `parseXml`) usa
     `GMarkupParseContext` com flags 0 e passthrough nulo; pela doc do GLib
     (markup.html: "No user-defined entities", doctype "passed through but
     not interpreted") ele NÃO expande entidades externas. Recusamos DOCTYPE/
     ENTITY mesmo assim, para nenhum outro parser expandir XXE depois. */
  if (hasUnsafeDoctype(xml)) {
    throw Error(message('err.notebook.doctype', {received: base}));
  }
  const pages = pagesOfXml(xml);
  if (pages.length === 0) throw Error(message('err.notebook.noPages', {received: base}));
  if (pagina > pages.length) throw Error(message('err.notebook.pageMissing', {page: pagina, total: pages.length}));
  const pageXml = pages[pagina - 1];
  const sensitive = caseSensitive ?? (process.platform !== 'win32' && process.platform !== 'darwin');
  const {png, backgroundIgnored} = await exportPageImage({file, page: pagina, xml, xournalPath, timeoutMs, pdfAuthorize, caseSensitive: sensitive, spawnProcess, readFile, realpath, existsSync, copyFile, writeFile, mkdtemp, rm, tmpdir, readdir, statSync, lstatSync, gzip});
  return {file: base, page: pagina, total: pages.length, text: textsOf(pageXml), latex: latexOf(pageXml), missingPdf: missingPdfOf(pageXml, path.dirname(file), existsSync, {pdfAuthorize, realpath}), backgroundIgnored, image: png.toString('base64')};
}
/** @param {string} key @param {string} [language] @returns {string} */
function warningText(key, language) {
  try { return toolErrorText(Error(message(key)), language); } catch { return ''; }
}
/** Texto do tutor (cabeçalho + avisos traduzidos + texto/LaTeX). @param {{file: string, page: number, total: number, text: string[], latex: string[], missingPdf: boolean, backgroundIgnored?: boolean}} result @param {string} [language] @returns {string} @example notebookPageText({file: 'aula.xopp', page: 2, total: 9, text: ['Limites'], latex: ['x^2'], missingPdf: false}) @example notebookPageText({file: 'aula.xopp', page: 2, total: 9, text: [], latex: [], missingPdf: false, backgroundIgnored: true}, 'en') */
export function notebookPageText(result, language) {
  const parts = [`${result.file} (página ${result.page} de ${result.total}, conteúdo do documento)`];
  if (result.missingPdf) parts.push(warningText('notebook.missingPdf', language) || '(fundo PDF ausente: imagem sem o PDF)');
  if (result.backgroundIgnored) parts.push(warningText('notebook.backgroundIgnored', language) || '(fundo PDF ignorado: imagem sem o PDF)');
  if (result.text.length) parts.push(`--- texto ---\n${result.text.join('\n')}`);
  if (result.latex.length) parts.push(`--- LaTeX ---\n${result.latex.join('\n')}`);
  if (!result.text.length && !result.latex.length) parts.push('--- texto ---\n(página sem texto: pode ser só traço)');
  return parts.join('\n\n');
}
/** Pede à ponte local (`/notebook-page`, lista viva no main). @param {{url?: string, token?: string}} bridge @param {{caminho?: unknown, pagina?: unknown}} args @param {{fetchImpl?: typeof fetch}} [options] @returns {Promise<{file: string, page: number, total: number, text: string[], latex: string[], missingPdf: boolean, backgroundIgnored?: boolean, image: string}>} @example await readNotebookPageBridge({url: 'http://127.0.0.1:9/activity', token: 't'}, {caminho: '/notas/aula.xopp', pagina: 1}) // {file: 'aula.xopp', page: 1, ...} */
export async function readNotebookPageBridge(bridge, args, {fetchImpl = fetch} = {}) {
  if (!bridge || typeof bridge.token !== 'string' || !/^http:\/\/127\.0\.0\.1:\d+\/activity$/.test(bridge.url || '')) {
    throw Error(message('err.notebook.readUnavailable'));
  }
  let response;
  try {
    response = await fetchImpl(String(bridge.url).replace(/\/activity$/, '/notebook-page'), {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-mesa-token': bridge.token},
      body: JSON.stringify({caminho: args.caminho, pagina: args.pagina}),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    const cause = error?.cause?.code || error?.cause?.message || '';
    const reason = cause ? `${error?.message || error} (${cause})` : String(error?.message || error);
    throw Error(message('err.notebook.bridgeDown', {reason}));
  }
  const data = await response.json().catch(() => null);
  if (!data) throw Error(message('err.notebook.bridgeJson', {status: response.status}));
  if (!response.ok || data.read !== true) {
    let reason = typeof data.error === 'string' && data.error ? `: ${data.error}` : '';
    if (reason.includes('') || reason.includes('')) reason = `: ${toolErrorText(Error(data.error))}`;
    throw Error(message('err.notebook.bridgeStatus', {status: response.status, reason}));
  }
  return data;
}
/** Ferramenta MCP no OpenCode, ligada à ponte. @param {{grant: {url: string, token: string}, read?: typeof readNotebookPageBridge, language?: string}} options @returns {import('./protocol.mjs').McpTool} @example notebookBridgeTool({grant: {url: 'http://127.0.0.1:5000/activity', token}}).name // 'ler_caderno' */
export function notebookBridgeTool({grant, read = readNotebookPageBridge, language}) {
  return {
    name: NOTEBOOK_TOOL_NAME,
    description: NOTEBOOK_DESCRIPTION,
    inputSchema: jsonSchemaOf(NOTEBOOK_FIELDS),
    async call(args) {
      try {
        const result = await read(grant, args);
        return {content: [{type: 'text', text: notebookPageText(result, language)}, {type: 'image', data: result.image, mimeType: 'image/png'}]};
      } catch (error) {
        return {content: [{type: 'text', text: toolErrorText(error, language, 'err.notebook.readFailed')}], isError: true};
      }
    },
  };
}
