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
/* A linha de trecho (`recorte`, o Ambitus manda só o que a pessoa vê) traz as
   mesmas quatro medidas nos dois idiomas; a linha antiga, sem trecho, segue valendo. */
const LINE = /^- (?:caderno|notebook) “(.+?)”, (?:pág\.|p\.) (\d+), (?:(?:trecho|excerpt) x=\S+ y=\S+ (?:largura|width)=\S+ (?:altura|height)=\S+ pt, )?(?:arquivo|file) /;
const MAX_PAGE = 100000;
const MAX_NAME = 200;

/**
 * O trecho de uma página do Ambitus (`recorte`), em pontos PDF (1/72 in) com a
 * origem no canto superior esquerdo da página. Só vale com as quatro medidas
 * numéricas finitas, `x` e `y` ≥ 0 e `largura` e `altura` > 0; qualquer outra
 * coisa é null (o pedido que a traz é recusado, nunca vira a página inteira).
 * @param {unknown} raw `{x, y, largura, altura}`
 * @returns {{x: number, y: number, largura: number, altura: number}|null}
 * @example notebookRecorte({x: 0, y: 286, largura: 595, altura: 555}) // {x: 0, y: 286, largura: 595, altura: 555}
 * @example notebookRecorte({x: 0, y: 0, largura: 0, altura: 555}) // null
 */
export function notebookRecorte(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const {x, y, largura, altura} = /** @type {{x?: unknown, y?: unknown, largura?: unknown, altura?: unknown}} */ (raw);
  if (![x, y, largura, altura].every((value) => typeof value === 'number' && Number.isFinite(value))) return null;
  const [left, top, width, height] = /** @type {number[]} */ ([x, y, largura, altura]);
  if (left < 0 || top < 0 || width <= 0 || height <= 0) return null;
  return {x: left, y: top, largura: width, altura: height};
}

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
