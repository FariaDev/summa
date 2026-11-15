// @ts-check

/* Fatos visíveis do caderno anexado: nome e página, nunca o caminho. É a forma
   que a bolha mostra e que o descritor do chat lateral guarda; o caminho segue
   escondido ao motor no bloco de `notebook-note.cjs`. O histórico do tutor relê
   o bloco do texto já enviado com `attachedNotebooks`, como `chat-pdf.mjs` faz
   com os PDFs. */

export const MAX_NOTEBOOKS = 4;
/* As mesmas frases de `sidechatctx.notebookHead` nos dois idiomas; o parser e o
   gerador do bloco não podem divergir. */
export const NOTEBOOK_HEADERS = ['Cadernos anexados à mensagem', 'Notebooks attached to the message'];
const HEADER = new RegExp(`\\[(?:${NOTEBOOK_HEADERS.map(escapeRegExp).join('|')})\\]`);
const LINE = /^- (?:caderno|notebook) “(.+?)”, (?:pág\.|p\.) (\d+), (?:arquivo|file) /;
const MAX_PAGE = 100000;
const MAX_NAME = 200;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function oneLine(value) {
  return String(value ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * O que a bolha mostra do caderno: nome e página, até o teto da bandeja. O
 * caminho não entra — ele não vai ao DOM, à busca nem ao histórico.
 * @param {unknown} raw `[{caminho, pagina, nome}]` ou já `[{nome, pagina}]`
 * @returns {Array<{nome: string, pagina: number}>}
 * @example notebookFactsOf([{caminho: '/c/a.xopp', pagina: 2, nome: 'A'}]) // [{nome: 'A', pagina: 2}]
 */
export function notebookFactsOf(raw) {
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    if (out.length >= MAX_NOTEBOOKS) break;
    const pagina = Math.trunc(Number(/** @type {{pagina?: unknown}} */ (item)?.pagina));
    if (!Number.isFinite(pagina) || pagina < 1) continue;
    const nome = oneLine(/** @type {{nome?: unknown}} */ (item)?.nome).slice(0, MAX_NAME);
    if (!nome) continue;
    out.push({nome, pagina: Math.min(pagina, MAX_PAGE)});
  }
  return out;
}

/**
 * Lê o bloco escondido dos cadernos de um texto já enviado (histórico): devolve
 * só `{nome, pagina}` para o chip da bolha. Texto sem o bloco (mensagens
 * antigas) devolve lista vazia.
 * @param {unknown} text
 * @returns {Array<{nome: string, pagina: number}>}
 * @example attachedNotebooks('[Cadernos anexados à mensagem]\n- caderno “A”, pág. 2, arquivo /c/a.xopp (releia com ler_caderno)') // [{nome: 'A', pagina: 2}]
 */
export function attachedNotebooks(text) {
  const source = String(text ?? '');
  const header = HEADER.exec(source);
  if (!header) return [];
  const out = [];
  for (const line of source.slice(header.index + header[0].length).split('\n')) {
    const hit = LINE.exec(line);
    if (!hit) {
      if (out.length) break;
      continue;
    }
    out.push({nome: hit[1], pagina: Number(hit[2])});
    if (out.length >= MAX_NOTEBOOKS) break;
  }
  return out;
}
