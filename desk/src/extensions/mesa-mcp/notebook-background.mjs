/* Lista branca do fundo do `ler_caderno` (#135, revisão 8cbca4cc; #213): nunca
   copia o tag `<background` original — gera um tag NOVO só com atributos
   conhecidos e valores validados. Fundo PDF só entra se a autorização de PDF
   do tutor (`resolveTutorPdf`, recebida por parâmetro do main) aceitaria o
   mesmo arquivo; vizinho do `.xopp` ou raiz da matéria não autoriza PDF. O Xournal++ 1.3 (`LoadHandler.cpp`,
   `parseBgPdf`/`parseBgPixmap`, branch release-1.3) usa `GMarkupParseContext`
   com flags 0 e passthrough nulo: aceita aspas simples/duplas, espaços em
   volta do `=`, quebras de linha e referências de caractere (`&#100;`,
   `&#x64;`) mais as 5 entidades padrão; `domain="attach"` em gzip resolve
   `<.xopp>.<filename>` ao lado do arquivo e `clone` repete a imagem em
   memória. O tokenizador abaixo espelha isso; o que não se lê com certeza
   (repetido, aspas sem fechar, entidade desconhecida) vira o sólido branco. */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_WHITE = '<background type="solid" color="#ffffffff" style="plain"/>';
const VALID_COLOR = /^#[0-9a-fA-F]{8}$/;
const VALID_STYLE = /^[a-z]+$/;

/** @param {string} ch @returns {boolean} */
function isSpace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/** Decodifica entidades do valor; desconhecida ou inválida vira suspeito. @param {string} raw @returns {{value: string, suspect: boolean}} */
function decodeValue(raw) {
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const amp = raw.indexOf('&', i);
    if (amp < 0) { out += raw.slice(i); break; }
    out += raw.slice(i, amp);
    const semi = raw.indexOf(';', amp + 1);
    if (semi < 0 || semi - amp > 12) return {value: '', suspect: true};
    const body = raw.slice(amp + 1, semi);
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const hex = body.slice(2);
      if (!/^[0-9a-fA-F]+$/.test(hex)) return {value: '', suspect: true};
      try { out += String.fromCodePoint(Number.parseInt(hex, 16)); } catch { return {value: '', suspect: true}; }
    } else if (body.startsWith('#')) {
      const dec = body.slice(1);
      if (!/^\d+$/.test(dec)) return {value: '', suspect: true};
      try { out += String.fromCodePoint(Number.parseInt(dec, 10)); } catch { return {value: '', suspect: true}; }
    } else if (body === 'quot') out += '"';
    else if (body === 'apos') out += "'";
    else if (body === 'amp') out += '&';
    else if (body === 'lt') out += '<';
    else if (body === 'gt') out += '>';
    else return {value: '', suspect: true};
    i = semi + 1;
  }
  return {value: out, suspect: false};
}

/** Atributos tolerantes do `<background`; repetido/aspas/entidade = suspeito. @param {string} attrsText @returns {{attrs: Map<string, string>, suspect: boolean}} */
function parseAttributes(attrsText) {
  const attrs = new Map();
  const n = attrsText.length;
  let i = 0;
  const skipSpace = () => { while (i < n && isSpace(attrsText[i])) { i += 1; } };
  while (true) {
    skipSpace();
    if (i >= n) break;
    if (attrsText[i] === '/') {
      i += 1;
      skipSpace();
      if (i >= n) break;
      return {attrs, suspect: true};
    }
    if (!/[A-Za-z_:]/.test(attrsText[i])) return {attrs, suspect: true};
    const nameStart = i;
    i += 1;
    while (i < n && /[-A-Za-z0-9_.:]/.test(attrsText[i])) { i += 1; }
    const name = attrsText.slice(nameStart, i);
    if (attrs.has(name)) return {attrs, suspect: true};
    skipSpace();
    if (i >= n || attrsText[i] !== '=') return {attrs, suspect: true};
    i += 1;
    skipSpace();
    if (i >= n) return {attrs, suspect: true};
    const quote = attrsText[i];
    if (quote !== '"' && quote !== "'") return {attrs, suspect: true};
    const close = attrsText.indexOf(quote, i + 1);
    if (close < 0) return {attrs, suspect: true};
    const decoded = decodeValue(attrsText.slice(i + 1, close));
    if (decoded.suspect) return {attrs, suspect: true};
    attrs.set(name, decoded.value);
    i = close + 1;
  }
  return {attrs, suspect: false};
}

/** Fim do tag aberto respeitando aspas; -1 sem `>` fora de aspas. @param {string} source @param {number} start @returns {number} */
function findTagEnd(source, start) {
  let inQuote = null;
  for (let i = start + 11; i < source.length; i += 1) {
    const ch = source[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
    } else if (ch === '"' || ch === "'") inQuote = ch;
    else if (ch === '>') return i;
  }
  return -1;
}

/** Escapa valor para atributo entre aspas duplas. @param {string} value @returns {string} */
function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** `file` sob `root`? Sem prefixo solto; caixa exata só com `caseSensitive` (Linux). @param {string} file @param {string} root @param {boolean} caseSensitive @returns {boolean} */
function isUnderDir(file, root, caseSensitive) {
  const rawFile = String(file || '');
  const rawRoot = String(root || '');
  if (!rawFile || !rawRoot) return false;
  const looksWin = /^[a-zA-Z]:[\\/]/.test(rawFile) || /^[a-zA-Z]:[\\/]/.test(rawRoot);
  const mod = looksWin ? path.win32 : path.posix;
  const norm = (value) => {
    let out = String(value);
    if (looksWin) out = out.replace(/\//g, '\\');
    else out = out.replace(/\\/g, '/');
    const normalized = mod.normalize(out);
    return caseSensitive ? normalized : normalized.toLowerCase();
  };
  const fileNorm = norm(rawFile);
  let rootNorm = norm(rawRoot);
  const sep = looksWin ? '\\' : '/';
  while (rootNorm.length > 1 && rootNorm.endsWith(sep)) rootNorm = rootNorm.slice(0, -1);
  return fileNorm === rootNorm || fileNorm.startsWith(rootNorm + sep);
}

/** @param {string} value @param {typeof fs.realpathSync} realpath @returns {string} */
function realpathOrResolve(value, realpath) {
  try { return realpath(String(value)); } catch { return path.resolve(String(value)); }
}

/** `file` imediatamente dentro de `dir`? `dirname(realpath(arquivo)) === realpath(pasta)`, caixa por plataforma. @param {string} file @param {string} dir @param {boolean} caseSensitive @returns {boolean} */
function isImmediateFile(file, dir, caseSensitive) {
  const rawFile = String(file || '');
  const rawDir = String(dir || '');
  if (!rawFile || !rawDir) return false;
  const looksWin = /^[a-zA-Z]:[\\/]/.test(rawFile) || /^[a-zA-Z]:[\\/]/.test(rawDir);
  const mod = looksWin ? path.win32 : path.posix;
  const norm = (value) => {
    let out = String(value);
    if (looksWin) out = out.replace(/\//g, '\\');
    else out = out.replace(/\\/g, '/');
    const normalized = mod.normalize(out);
    return caseSensitive ? normalized : normalized.toLowerCase();
  };
  return mod.dirname(norm(rawFile)) === norm(rawDir);
}

/** Inícios de `<page` não vazio, na ordem; índice do clone é a página de origem. @param {string} source @returns {number[]} */
function collectPageStarts(source) {
  const starts = [];
  let at = 0;
  while (true) {
    const start = source.indexOf('<page', at);
    if (start < 0) break;
    const next = source[start + 5];
    if (next !== ' ' && next !== '\t' && next !== '\n' && next !== '\r' && next !== '>' && next !== '/') { at = start + 5; continue; }
    const openEnd = source.indexOf('>', start);
    if (openEnd < 0) break;
    if (source[openEnd - 1] === '/') { at = openEnd + 1; continue; }
    starts.push(start);
    at = openEnd + 1;
  }
  return starts;
}

/** Índice (0-based) da página que contém `offset`, ou -1 fora de página. Busca binária (O(log n) por clone, O(n log n) no total). @param {number[]} starts @param {number} offset @returns {number} */
function pageIndexOf(starts, offset) {
  let lo = 0;
  let hi = starts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= offset) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/** Clone só em pixmap, com `filename` numérico menor que o total e que a página atual; senão branco com aviso. @param {string} type @param {Map<string, string>} attrs @param {number} pageIdx @param {number} totalPages @returns {{tag: string, ignored: boolean}} */
function cloneTag(type, attrs, pageIdx, totalPages) {
  if (type !== 'pixmap') return {tag: DEFAULT_WHITE, ignored: true};
  const filename = attrs.get('filename');
  if (!filename || !/^\d+$/.test(filename)) return {tag: DEFAULT_WHITE, ignored: true};
  const index = Number(filename);
  if (!(index < totalPages && index < pageIdx)) return {tag: DEFAULT_WHITE, ignored: true};
  return {tag: `<background type="pixmap" domain="clone" filename="${filename}"/>`, ignored: false};
}

/** @param {Map<string, string>} attrs @returns {{tag: string, ignored: boolean}} */
function solidTag(attrs) {
  if (attrs.has('filename')) return {tag: DEFAULT_WHITE, ignored: true};
  const color = attrs.get('color') || '';
  const style = attrs.get('style') || '';
  if (VALID_COLOR.test(color) && VALID_STYLE.test(style)) {
    return {tag: `<background type="solid" color="${color}" style="${style}"/>`, ignored: false};
  }
  return {tag: DEFAULT_WHITE, ignored: true};
}

/** @param {string} type @param {Map<string, string>} attrs @param {{notebookDir: string, realDir: string, pdfAuthorize?: (file: string) => string, realpath: typeof fs.realpathSync, caseSensitive: boolean}} deps @returns {{tag: string, ignored: boolean}} */
function absoluteTag(type, attrs, {notebookDir, realDir, pdfAuthorize, realpath, caseSensitive}) {
  const filename = attrs.get('filename');
  if (!filename) return {tag: DEFAULT_WHITE, ignored: true};
  const input = path.isAbsolute(filename) ? filename : path.join(notebookDir, filename);
  let resolved;
  try { resolved = realpath(input); } catch { resolved = path.resolve(input); }
  /* #213: o fundo PDF segue a mesma autorização do tutor (`resolveTutorPdf` via
     `pdfAuthorize`); o pixmap continua vizinho/pasta do caderno, sem a raiz da
     matéria. O caminho devolvido pela autorização é o canônico do PDF. */
  const allowed = type === 'pdf'
    ? (typeof pdfAuthorize === 'function' ? String(pdfAuthorize(resolved) || '') : '')
    : (isImmediateFile(resolved, realDir, caseSensitive) ? resolved : '');
  if (!allowed) return {tag: DEFAULT_WHITE, ignored: true};
  const esc = escapeAttr(allowed);
  if (type === 'pdf') {
    const pageno = attrs.get('pageno');
    if (pageno !== undefined && /^\d+$/.test(pageno)) {
      return {tag: `<background type="pdf" domain="absolute" filename="${esc}" pageno="${pageno}"/>`, ignored: false};
    }
    return {tag: `<background type="pdf" domain="absolute" filename="${esc}"/>`, ignored: false};
  }
  return {tag: `<background type="pixmap" domain="absolute" filename="${esc}"/>`, ignored: false};
}

/** @param {string} type @param {Map<string, string>} attrs @param {{notebookPath: string, realDir: string, realpath: typeof fs.realpathSync, existsSync: typeof fs.existsSync, statSync: typeof fs.statSync, caseSensitive: boolean}} deps @returns {{tag: string, ignored: boolean, copy?: {source: string, filename: string}}} */
function attachTag(type, attrs, {notebookPath, realDir, realpath, existsSync, statSync, caseSensitive}) {
  const filename = attrs.get('filename');
  if (!filename) return {tag: DEFAULT_WHITE, ignored: true};
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..') || filename === '.') {
    return {tag: DEFAULT_WHITE, ignored: true};
  }
  const source = `${notebookPath}.${filename}`;
  if (!existsSync(source)) return {tag: DEFAULT_WHITE, ignored: true};
  let stat;
  try { stat = statSync(source); } catch { return {tag: DEFAULT_WHITE, ignored: true}; }
  if (!stat || typeof stat.isFile !== 'function' || !stat.isFile()) return {tag: DEFAULT_WHITE, ignored: true};
  let realSrc;
  try { realSrc = realpath(source); } catch { return {tag: DEFAULT_WHITE, ignored: true}; }
  if (!isUnderDir(realSrc, realDir, caseSensitive)) return {tag: DEFAULT_WHITE, ignored: true};
  const esc = escapeAttr(filename);
  const copy = {source, filename};
  if (type === 'pdf') {
    const pageno = attrs.get('pageno');
    if (pageno !== undefined && /^\d+$/.test(pageno)) {
      return {tag: `<background type="pdf" domain="attach" filename="${esc}" pageno="${pageno}"/>`, ignored: false, copy};
    }
    return {tag: `<background type="pdf" domain="attach" filename="${esc}"/>`, ignored: false, copy};
  }
  return {tag: `<background type="pixmap" domain="attach" filename="${esc}"/>`, ignored: false, copy};
}

/** Cópia com lista branca de fundo (base no ORIGINAL, `realpath`); gera tags novos. @param {string} xml @param {{notebookPath: string, notebookDir: string, pdfAuthorize?: (file: string) => string, realpath: typeof fs.realpathSync, existsSync?: typeof fs.existsSync, statSync?: typeof fs.statSync, caseSensitive: boolean}} deps @returns {{xml: string, backgroundIgnored: boolean, attachCopies: Array<{source: string, filename: string}>}} @example sanitizeBackgrounds('<background type="pdf" filename="/fora/privado.pdf"/>', {notebookPath: '/curso/aula.xopp', notebookDir: '/curso', realpath: fs.realpathSync, caseSensitive: true}).backgroundIgnored // true */
export function sanitizeBackgrounds(xml, {notebookPath, notebookDir, pdfAuthorize, realpath, existsSync = fs.existsSync, statSync = fs.statSync, caseSensitive}) {
  const source = String(xml);
  const realDir = realpathOrResolve(notebookDir, realpath);
  const pageStarts = collectPageStarts(source);
  const totalPages = pageStarts.length;
  let ignored = false;
  let out = '';
  let at = 0;
  const copies = [];
  while (true) {
    const start = source.indexOf('<background', at);
    if (start < 0) { out += source.slice(at); break; }
    const next = source[start + 11];
    if (next !== ' ' && next !== '\t' && next !== '\n' && next !== '\r' && next !== '>' && next !== '/') {
      out += source.slice(at, start + 11);
      at = start + 11;
      continue;
    }
    const openEnd = findTagEnd(source, start);
    if (openEnd < 0) {
      out += source.slice(at, start);
      out += DEFAULT_WHITE;
      ignored = true;
      break;
    }
    const attrsText = source.slice(start + 11, openEnd);
    out += source.slice(at, start);
    const parsed = parseAttributes(attrsText);
    let result;
    if (parsed.suspect) {
      result = {tag: DEFAULT_WHITE, ignored: true};
    } else {
      const type = parsed.attrs.get('type');
      if (type === 'solid') {
        result = solidTag(parsed.attrs);
      } else if (type === 'pdf' || type === 'pixmap') {
        const domain = parsed.attrs.get('domain');
        if (domain === 'clone') {
          result = cloneTag(type, parsed.attrs, pageIndexOf(pageStarts, start), totalPages);
        } else if (domain === 'absolute') {
          result = absoluteTag(type, parsed.attrs, {notebookDir, realDir, pdfAuthorize, realpath, caseSensitive});
        } else if (domain === 'attach') {
          result = attachTag(type, parsed.attrs, {notebookPath, realDir, realpath, existsSync, statSync, caseSensitive});
          if (result.copy) copies.push(result.copy);
        } else {
          result = {tag: DEFAULT_WHITE, ignored: true};
        }
      } else {
        result = {tag: DEFAULT_WHITE, ignored: true};
      }
    }
    if (result.ignored) ignored = true;
    out += result.tag;
    at = openEnd + 1;
  }
  return {xml: out, backgroundIgnored: ignored, attachCopies: copies};
}

/** PDF de fundo aceito que não está no disco (`attach`/`clone` e fundo não autorizado não avisam; #213: só consulta o disco depois da autorização). @param {string} pageXml @param {string} notebookDir @param {typeof fs.existsSync} existsSync @param {{pdfAuthorize?: (file: string) => string, realpath?: typeof fs.realpathSync}} [deps] @returns {boolean} @example missingPdfOf('<background type="pdf" filename="fundo.pdf"/>', '/notas', fs.existsSync, {pdfAuthorize}) // true quando o PDF autorizado não existe */
export function missingPdfOf(pageXml, notebookDir, existsSync, deps = {}) {
  const {pdfAuthorize, realpath = fs.realpathSync} = deps;
  const source = String(pageXml);
  let at = 0;
  while (true) {
    const start = source.indexOf('<background', at);
    if (start < 0) return false;
    const next = source[start + 11];
    if (next !== ' ' && next !== '\t' && next !== '\n' && next !== '\r' && next !== '>' && next !== '/') { at = start + 11; continue; }
    const openEnd = source.indexOf('>', start);
    if (openEnd < 0) return false;
    const attrsText = source.slice(start + 11, openEnd);
    const parsed = parseAttributes(attrsText);
    if (parsed.suspect) { at = openEnd + 1; continue; }
    if (parsed.attrs.get('type') !== 'pdf') { at = openEnd + 1; continue; }
    const filename = parsed.attrs.get('filename');
    const domain = parsed.attrs.get('domain');
    if (filename && domain !== 'attach' && domain !== 'clone') {
      const input = path.isAbsolute(filename) ? filename : path.join(notebookDir, filename);
      let resolved;
      try { resolved = realpath(input); } catch { resolved = path.resolve(input); }
      /* Sem autorização não se pergunta ao disco: `missingPdf` não pode virar
         oráculo de existência para arquivo que o tutor não pode ler. */
      if (!(typeof pdfAuthorize === 'function' && pdfAuthorize(resolved))) { at = openEnd + 1; continue; }
      if (!existsSync(input)) return true;
    }
    at = openEnd + 1;
  }
}
