/* Fallback do SVG solto que o sanitizador esvazia (#150): a cerca `svg` com
   `style`, `use` ou `image` já virava código, mas o SVG inline do modelo
   passava direto pelo DOMPurify e, sem esses elementos, sobrava um `<svg>`
   vazio na resposta — um quadro em branco, sem aviso. Aqui o SVG inline é
   limpo antes (a mesma configuração da guarda) e, quando não sobra nada que
   desenhe, ele vira o mesmo bloco de código da cerca, com aviso visível.
   A decisão é estrutural: `<defs>`, `<symbol>`, `<clippath>`, `<mask>`,
   `<pattern>`, `<marker>`, gradientes e filtros são definição, não desenho;
   `<text>` vazio também não pinta nada. `use`/`image`/`foreignObject` não
   entram na lista de desenho porque a guarda os remove sempre (o clone limpo
   é que é medido). A regra de não ler HTML/SVG com regex vale aqui: o parser
   do navegador lê, nós perguntamos a ele. */
import {highlightCode} from '../../highlight.mjs';
import {t} from '../ui-text.mjs';
import {svgSafeConfig} from './svg-guard.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
/* Tags que pintam por si quando estão na árvore renderizada. */
export const SVG_DRAWABLE_TAGS = new Set([
  'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'path',
  'text', 'tspan', 'textpath',
]);
/* Tags cujo conteúdo é definição/estilo: o que está dentro delas não aparece
   até ser referenciado (e o `use`, que referenciaria, a guarda remove). */
export const SVG_NOT_RENDERED_TAGS = new Set([
  'defs', 'symbol', 'clippath', 'mask', 'pattern', 'marker',
  'lineargradient', 'radialgradient', 'filter', 'title', 'desc', 'metadata',
  'style', 'script',
]);
const TEXT_TAGS = new Set(['text', 'tspan', 'textpath']);

/* O elemento está dentro de uma definição (defs, symbol, gradiente…), que não
   pinta até ser referenciada. A raiz do SVG não conta: o que é filho dela é
   renderizado. */
function insideNotRendered(element, root) {
  for (let parent = element.parentElement; parent && parent !== root; parent = parent.parentElement) {
    if (SVG_NOT_RENDERED_TAGS.has(String(parent.localName || '').toLowerCase())) return true;
  }
  return false;
}

/**
 * Diz se o SVG limpo ainda tem algo que o aluno vê: geometria na árvore
 * renderizada ou texto com conteúdo. `<defs>`, `<symbol>`, gradiente, filtro
 * e metadados não contam; `<text>` vazio também não.
 * @param {{querySelectorAll: (selector: string) => Iterable<any>} | null | undefined} svg elemento `svg` já sanitizado
 * @returns {boolean} `true` quando há algo desenhável
 * @example svgHasVisibleContent(parse('<svg><rect/></svg>')) // true
 * @example svgHasVisibleContent(parse('<svg><defs><rect/></defs></svg>')) // false
 */
export function svgHasVisibleContent(svg) {
  if (!svg || typeof svg.querySelectorAll !== 'function') return false;
  for (const element of svg.querySelectorAll('*')) {
    if (element.namespaceURI !== SVG_NS) continue;
    const tag = String(element.localName || '').toLowerCase();
    if (!SVG_DRAWABLE_TAGS.has(tag)) continue;
    if (TEXT_TAGS.has(tag) && !String(element.textContent || '').trim()) continue;
    if (!insideNotRendered(element, svg)) return true;
  }
  return false;
}

/* O SVG solto está dentro de outro SVG (forma inválida): o de fora decide, e
   o token não pode cair dentro de um `<svg>` que ainda vai ser sanitizado. */
function insideSvgElement(element) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (String(parent.localName || '').toLowerCase() === 'svg') return true;
  }
  return false;
}

/* O `<p>` do marked só embrulha este SVG (e espaço/comentário): trocar o `<p>`
   inteiro evita `<div>`/`<pre>` dentro de parágrafo na saída. */
function onlySvgChild(parent, svg) {
  for (const node of parent.childNodes) {
    if (node === svg || node.nodeType === 8) continue;
    if (node.nodeType === 3 && !String(node.textContent || '').trim()) continue;
    return false;
  }
  return true;
}

/* Limpa uma cópia com a mesma guarda do markup e diz se sobrou desenho. */
function blankAfterSanitize(svg, purify, config) {
  const clean = purify.sanitize(svg.outerHTML, svgSafeConfig(purify, config));
  const holder = document.createElement('template');
  holder.innerHTML = clean;
  return !svgHasVisibleContent(holder.content.querySelector('svg'));
}

/**
 * Troca cada SVG inline que o sanitizador esvaziaria por um token de texto e
 * devolve os originais na ordem. O token é resolvido depois do DOMPurify por
 * `svgFallbackHtml`, para o código aparecer com o realce e o aviso da casa.
 * Sem DOM (Node puro) devolve o HTML intacto, como o resto da cadeia.
 * @param {string} html saída do `marked.parse`, antes da faixa do modelo
 * @param {{sanitize: (dirty: string, config: any) => string, addHook: Function} | null} purify DOMPurify com a guarda
 * @param {any} config a mesma configuração do `DOMPurify.sanitize` do `markup`
 * @returns {{html: string, sources: string[]}} HTML com tokens e originais na ordem
 * @example dropBlankSvg('<p><svg><use href="#a"/></svg></p>', DOMPurify, config)
 * // {html: '<p>SVGEMPTY0END</p>', sources: ['<svg><use href="#a"/></svg>']}
 */
export function dropBlankSvg(html, purify, config) {
  const text = String(html ?? '');
  if (typeof document === 'undefined' || !purify || !config) return {html: text, sources: []};
  const holder = document.createElement('template');
  holder.innerHTML = text;
  const blank = [];
  const sources = [];
  for (const svg of [...holder.content.querySelectorAll('svg')]) {
    if (insideSvgElement(svg) || !blankAfterSanitize(svg, purify, config)) continue;
    blank.push(svg);
    sources.push(svg.outerHTML);
  }
  if (!sources.length) return {html: text, sources};
  for (const [index, svg] of blank.entries()) {
    const token = document.createTextNode(`SVGEMPTY${index}END`);
    const parent = svg.parentElement;
    if (parent && parent.localName === 'p' && onlySvgChild(parent, svg)) parent.replaceWith(token);
    else svg.replaceWith(token);
  }
  return {html: holder.innerHTML, sources};
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char] ?? char));
}

/**
 * O bloco que substitui um SVG que ficaria em branco: aviso visível (a mesma
 * moldura `.plot-warning` da cerca) e o SVG original como código realçado.
 * O chamador insere isto DEPOIS do DOMPurify, como o bloco de código da
 * cerca; o texto entra escapado pelo realce.
 * @param {string} source o `outerHTML` original do SVG
 * @returns {string} HTML do aviso + `<pre class="hl">`
 * @example svgFallbackHtml('<svg><use href="#a"/></svg>')
 */
export function svgFallbackHtml(source) {
  const code = String(source ?? '');
  return `<div class="plot-warning figure-warning" role="note" data-svg-error="blank"><strong>${escapeHtml(t('talk.svgFallback'))}</strong></div>`
    + `<pre class="hl"><code data-lang="svg">${highlightCode(code, 'svg')}</code></pre>`;
}
