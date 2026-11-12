// @ts-check
'use strict';

/* Formato restrito do SVG da ponte da tinta (#159): o plugin do Xournal++
   manda só `<svg>`, `<rect>` e `<path>` com os atributos geométricos
   conhecidos. O parser e o tamanho para a janela de renderização moram aqui
   (saíram de `ink-convert-host.cjs` para caber no teto de linhas). */

const BODY_CAP = 300 * 1024;
/* Os mesmos tetos do plugin (`MAX_ELEMENTOS` e `MAX_BYTES` em
   desk/src/xournal-plugins/MesaPagina/converter.lua, #159): o plugin recusa
   o pedido acima deles antes de congelar o Xournal++; aqui ele é recusado
   depois. Mudou aqui, mude lá. */
const MAX_SHAPES = 2000;
const MAX_DIM = 2048;
const MIN_DIM = 8;

const SVG_TAG = 'svg';
const SHAPES = new Set(['rect', 'path']);
const ATTRS = {
  svg: new Set(['xmlns', 'width', 'height', 'viewBox']),
  rect: new Set(['x', 'y', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'opacity']),
  path: new Set(['d', 'fill', 'stroke', 'stroke-width', 'opacity', 'stroke-linecap', 'stroke-linejoin']),
};
const NUMERIC_ATTRS = new Set(['x', 'y', 'width', 'height', 'stroke-width']);
const DANGEROUS = /url\s*\(|javascript:|data:|vbscript:|expression\s*\(|&\w*(#\w+;)?/i;
const TAG_RE = /<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[a-zA-Z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>/g;
const ATTR_RE = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
const NUM_RE = /^-?\d+(?:\.\d+)?(?:px)?$/;
const PATH_DATA_RE = /^[MmLlHhVvCcQqSsTtAaZz0-9.,+\- \t]+$/;
const COLOR_VALUE = /^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})|none|white|black)$/;

/** @param {string} value @returns {number} */
function readNumber(value) {
  const match = /^(-?\d+(?:\.\d+)?)(?:px)?$/.exec(value.trim());
  return match ? Number(match[1]) : NaN;
}

/** @param {string} tag @param {Record<string, string>} attrs @returns {{ok: boolean, reason: string}} */
function checkAttrs(tag, attrs) {
  for (const [name, value] of Object.entries(attrs)) {
    if (!ATTRS[tag].has(name)) return {ok: false, reason: `atributo ${name} em <${tag}>`};
    if (value === '') return {ok: false, reason: `valor vazio em ${name}`};
    if (DANGEROUS.test(value)) return {ok: false, reason: `${tag} com valor proibido em ${name}`};
    if ((name === 'fill' || name === 'stroke') && !COLOR_VALUE.test(value.trim())) return {ok: false, reason: `cor inválida em ${name}`};
    if (NUMERIC_ATTRS.has(name) && !NUM_RE.test(value.trim())) return {ok: false, reason: `número inválido em ${name}`};
    if (name === 'viewBox') {
      const parts = value.trim().split(/\s+/).map(Number);
      if (parts.length !== 4 || !parts.every(Number.isFinite) || parts[2] <= 0 || parts[3] <= 0) return {ok: false, reason: 'viewBox inválido'};
    }
    if (name === 'd' && (!PATH_DATA_RE.test(value.trim()) || !/^M|m/.test(value.trim()))) return {ok: false, reason: 'caminho inválido em d'};
    if (name === 'stroke-linecap' && !['butt', 'round', 'square'].includes(value)) return {ok: false, reason: 'stroke-linecap inválido'};
    if (name === 'stroke-linejoin' && !['miter', 'round', 'bevel'].includes(value)) return {ok: false, reason: 'stroke-linejoin inválido'};
    if (name === 'opacity' && (!(Number(value) >= 0 && Number(value) <= 1) || !NUM_RE.test(value.trim()))) return {ok: false, reason: 'opacity inválido'};
  }
  return {ok: true, reason: ''};
}

/**
 * O formato restrito de SVG que o plugin gera: só `<svg>`, `<rect>` e `<path>`
 * com os atributos geométricos conhecidos; recusa outro elemento/atributo,
 * `href`, `<script>`, entidades e qualquer texto fora dos elementos. Devolve
 * o tamanho para a janela de renderização (até `MAX_DIM`).
 * @param {unknown} svg o `svg` do corpo JSON
 * @returns {{ok: boolean, reason: string, svg: string, width: number, height: number}}
 * @example checkInkSvg('<svg width="10" height="10"><path d="M0 0 L1 1"/></svg>') // {ok: true, …}
 */
function checkInkSvg(svg) {
  const fail = (reason) => ({ok: false, reason, svg: '', width: 0, height: 0});
  if (typeof svg !== 'string' || !svg.trim()) return fail('svg vazio');
  if (svg.length > BODY_CAP) return fail('svg grande demais');
  if (/&/.test(svg)) return fail('entidade recusada');
  if (/<!/.test(svg) || /<\?/.test(svg)) return fail('declaração recusada');
  const clean = svg.trim();
  const tagRe = new RegExp(TAG_RE.source, 'g');
  const stack = [];
  let rootSeen = false;
  let shapes = 0;
  let lastEnd = 0;
  let match;
  while ((match = tagRe.exec(clean)) !== null) {
    if (clean.slice(lastEnd, match.index).trim() !== '') return fail('texto fora dos elementos');
    const [, closeMark, tag, attrText, selfMark] = match;
    const closing = closeMark === '/';
    const selfClosing = selfMark === '/';
    if (tag !== SVG_TAG && !SHAPES.has(tag)) return fail(`elemento ${tag} recusado`);
    /* Atributos (sempre com aspas e sem duplicar) e o formato de cada um. */
    const attrs = {};
    const attrRe = new RegExp(ATTR_RE.source, 'g');
    let attrMatch;
    while ((attrMatch = attrRe.exec(attrText)) !== null) {
      if (attrMatch[0].trim() === '') continue;
      const name = attrMatch[1];
      if (attrMatch[2] === undefined && attrMatch[3] === undefined) return fail(`atributo sem valor em ${name}`);
      if (Object.hasOwn(attrs, name)) return fail(`atributo duplicado em ${name}`);
      attrs[name] = attrMatch[2] ?? attrMatch[3] ?? '';
    }
    if (Object.keys(attrs).length > 1 && attrText.trim() === '') return fail('atributos malformados');
    const checked = checkAttrs(tag, attrs);
    if (!checked.ok) return fail(checked.reason);
    if (closing) {
      const open = stack.pop();
      if (open !== tag) return fail(`fechamento sem abertura em ${tag}`);
      if (tag !== SVG_TAG && stack.length === 0) return fail(`<${tag}> fora do <svg>`);
    } else if (selfClosing) {
      if (tag === SVG_TAG) return fail('svg auto-fechado');
      if (stack[stack.length - 1] !== SVG_TAG) return fail(`<${tag}> fora do <svg>`);
      if (!shapeOk(tag, attrs)) return fail(`<${tag}> sem geometria`);
      shapes += 1;
    } else {
      if (tag === SVG_TAG) {
        if (rootSeen || stack.length > 0) return fail('svg duplicado');
        rootSeen = true;
        if (!attrs.width && !attrs.height && !attrs.viewBox) return fail('svg sem tamanho');
      } else {
        if (stack[stack.length - 1] !== SVG_TAG) return fail(`<${tag}> fora do <svg>`);
        if (!shapeOk(tag, attrs)) return fail(`<${tag}> sem geometria`);
        shapes += 1;
      }
      stack.push(tag);
    }
    if (shapes > MAX_SHAPES) return fail('elementos demais');
    lastEnd = match.index + match[0].length;
  }
  if (clean.slice(lastEnd).trim() !== '') return fail('texto fora dos elementos');
  if (!rootSeen || stack.length > 0) return fail('svg não fechado');
  if (shapes === 0) return fail('svg sem traços');
  const svgMatch = /<svg[^>]*>/.exec(clean);
  const size = svgSize(svgMatch ? svgMatch[0] : '');
  if (size.width <= 0 || size.height <= 0) return fail('tamanho inválido');
  return {ok: true, reason: '', svg: clean, width: size.width, height: size.height};
}

/** @param {string} tag @param {Record<string, string>} attrs @returns {boolean} */
function shapeOk(tag, attrs) {
  if (tag === 'rect') return attrs.width !== undefined && attrs.height !== undefined;
  if (tag === 'path') return typeof attrs.d === 'string' && attrs.d.trim() !== '' && attrs.stroke !== undefined && attrs['stroke-width'] !== undefined;
  return false;
}

/** @param {string} svgOpen @returns {{width: number, height: number}} */
function svgSize(svgOpen) {
  const attr = (name) => {
    const match = new RegExp(`${name}=\\s*(?:"([^"]*)"|'([^']*)')`).exec(svgOpen);
    return match ? (match[1] ?? match[2] ?? '') : '';
  };
  let width = readNumber(attr('width'));
  let height = readNumber(attr('height'));
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    const parts = attr('viewBox').trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) { width = parts[2]; height = parts[3]; }
  }
  return {
    width: Number.isFinite(width) ? Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(width))) : 0,
    height: Number.isFinite(height) ? Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(height))) : 0,
  };
}

module.exports = {BODY_CAP, checkInkSvg};
