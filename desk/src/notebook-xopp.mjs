// @ts-check
/* Extrator de texto do `.xopp` (#135, #158): uma fonte só para o que o tutor
   lê numa página (`ler_caderno`) e o que a busca da biblioteca indexa por
   página. Lê só o XML já descomprimido (o gzip, com teto, fica com quem
   chamou): as caixas `<text>` e o LaTeX (`<teximage text=...>`). Varredura
   linear por `indexOf`, sem regex quadrática; textos longos saem cortados. */

export const NOTEBOOK_MAX_XML_BYTES = 32 * 1024 * 1024; /* bomba de descompressão (#135) */
export const NOTEBOOK_TEXT_LIMIT = 20000; /* marca `…(cortado)` (#135) */

/** @param {string} text @returns {string} */
function decodeEntities(text) {
  return String(text).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10))).replace(/&amp;/g, '&');
}

/** @param {string} attrs @param {string} name @returns {string} */
function attrOf(attrs, name) {
  for (const match of String(attrs).matchAll(/([A-Za-z_:][-A-Za-z0-9_.:]*)="([^"]*)"/g)) {
    if (match[1] === name) return match[2];
  }
  return '';
}

/** @param {string} value @returns {string} */
function cutText(value) {
  const text = String(value);
  return text.length > NOTEBOOK_TEXT_LIMIT ? `${text.slice(0, NOTEBOOK_TEXT_LIMIT)}…(cortado)` : text;
}

/** Cada `<page>` na ordem; varredura linear por `indexOf` (#135, regex quadrática).
 *  @param {string} xml @returns {string[]}
 *  @example pagesOfXml('<xournal><page>a</page><page>b</page></xournal>') // ['a', 'b'] */
export function pagesOfXml(xml) {
  const pages = [];
  const source = String(xml);
  let at = 0;
  while (true) {
    const start = source.indexOf('<page', at);
    if (start < 0) break;
    const next = source[start + 5];
    if (next !== ' ' && next !== '\t' && next !== '\n' && next !== '\r' && next !== '>' && next !== '/') { at = start + 5; continue; }
    const openEnd = source.indexOf('>', start);
    if (openEnd < 0) break;
    if (source[openEnd - 1] === '/') { at = openEnd + 1; continue; }
    const closeAt = source.indexOf('</page>', openEnd + 1);
    if (closeAt < 0) break;
    pages.push(source.slice(openEnd + 1, closeAt));
    at = closeAt + 7;
  }
  return pages;
}

/** Os `<text>` da página, em ordem (linear, 20 mil caracteres).
 *  @param {string} pageXml @returns {string[]}
 *  @example textsOf('<page><text>Limites</text></page>') // ['Limites'] */
export function textsOf(pageXml) {
  const texts = [];
  const source = String(pageXml);
  let at = 0;
  while (true) {
    const start = source.indexOf('<text', at);
    if (start < 0) break;
    const next = source[start + 5];
    if (next !== ' ' && next !== '\t' && next !== '\n' && next !== '\r' && next !== '>') { at = start + 5; continue; }
    const openEnd = source.indexOf('>', start);
    if (openEnd < 0) break;
    const closeAt = source.indexOf('</text>', openEnd + 1);
    if (closeAt < 0) break;
    const text = decodeEntities(source.slice(openEnd + 1, closeAt)).trim();
    if (text) texts.push(cutText(text));
    at = closeAt + 7;
  }
  return texts;
}

const BASE64_PAYLOAD = /^[A-Za-z0-9+/=\s]+$/;

/** LaTeX dos `<teximage>` (atributo `text`); linear (#135: 256 KB sem fechar levava 2,4 s).
 *  @param {string} pageXml @returns {string[]}
 *  @example latexOf('<page><teximage text="x^2">iVBORw=</teximage></page>') // ['x^2'] */
export function latexOf(pageXml) {
  const latex = [];
  const source = String(pageXml);
  const hasClose = source.includes('</teximage>');
  let at = 0;
  while (true) {
    const start = source.indexOf('<teximage', at);
    if (start < 0) break;
    const next = source[start + 9];
    if (next !== ' ' && next !== '\t' && next !== '\n' && next !== '\r' && next !== '>' && next !== '/') { at = start + 9; continue; }
    const openEnd = source.indexOf('>', start);
    if (openEnd < 0) break;
    const attrs = source.slice(start + 9, openEnd);
    const selfClosing = source[openEnd - 1] === '/';
    const fromAttr = attrOf(attrs, 'text') || attrOf(attrs, 'tex');
    let inner = '';
    let after = openEnd + 1;
    if (!selfClosing && !fromAttr && hasClose) {
      const closeAt = source.indexOf('</teximage>', openEnd + 1);
      if (closeAt >= 0) { inner = decodeEntities(source.slice(openEnd + 1, closeAt)).trim(); after = closeAt + 10; }
    }
    const value = fromAttr ? decodeEntities(fromAttr).trim() : (inner && !(inner.length > 60 && BASE64_PAYLOAD.test(inner)) ? inner : '');
    if (value) latex.push(cutText(value));
    at = after;
  }
  return latex;
}

/** Verdadeiro quando o XML declara `DOCTYPE` ou `ENTITY`: nenhum parser expande
 *  entidades externas, mesmo assim recusamos/ignoramos para nenhum outro parser
 *  expandir XXE depois (#135).
 *  @param {string} xml @returns {boolean}
 *  @example hasUnsafeDoctype('<!DOCTYPE x><x/>') // true */
export function hasUnsafeDoctype(xml) {
  return String(xml).includes('<!DOCTYPE') || String(xml).includes('<!ENTITY');
}

/** Texto digitado de cada página (caixas `<text>` e LaTeX, na ordem), um
 *  item por página na ordem do documento; página sem texto sai vazia.
 *  @param {string} xml @returns {string[]}
 *  @example notebookPageStrings('<xournal><page><text>a</text></page></xournal>') // ['a'] */
export function notebookPageStrings(xml) {
  return pagesOfXml(xml).map((pageXml) => [...textsOf(pageXml), ...latexOf(pageXml)].join('\n'));
}
