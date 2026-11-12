// @ts-check
'use strict';

/* Opções visuais do `ler_pdf`: giro, recorte proporcional, ampliação e as
   marcas do tutor (#113). A validação mora aqui, no processo principal, porque
   a mesma rota serve aos três motores e o render é uma janela escondida.
   Nenhuma opção muda o arquivo nem o caminho autorizado: só o PNG gerado na
   hora. Ordem: `girar` roda primeiro; as `marcas` usam o quadro da página
   depois do giro (o mesmo do `recorte`) e o `recorte` corta por cima delas. */

const {invalidValue} = require('./src/error-detail.mjs');

const GIRAR_VALUES = [90, 180, 270];
const MIN_AMPLIAR = 1;
const MAX_AMPLIAR = 3;
const FORMAS = ['circulo', 'seta', 'destaque'];
const FORMAS_TEXT = `${FORMAS.slice(0, -1).join(', ')} ou ${FORMAS.at(-1)}`;
const MAX_MARCAS = 8;
const EPSILON = 1e-9;

/** @typedef {{x: number, y: number, largura: number, altura: number}} Recorte */
/** @typedef {{forma: 'circulo'|'seta'|'destaque', x: number, y: number, largura: number, altura: number}} Marca */
/** @typedef {{girar: number, recorte: Recorte|null, ampliar: number, marcas: Marca[], visual: boolean}} PageView */

/**
 * Uma fração do retângulo, de 0 a 1, com o valor recebido no erro.
 * @param {string} label
 * @param {'x'|'y'|'largura'|'altura'} field
 * @param {unknown} value
 * @returns {number}
 */
function fractionOf(label, field, value) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw Error(invalidValue(`${label}.${field}`, value, 'número de 0 a 1'));
  }
  return number;
}

/**
 * Um retângulo em proporção da página, depois do giro.
 * @param {string} label
 * @param {unknown} raw
 * @returns {Recorte}
 */
function rectOf(label, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw Error(invalidValue(label, raw, '{x, y, largura, altura} com números de 0 a 1'));
  }
  const values = /** @type {Record<string, unknown>} */ (raw);
  const rect = {
    x: fractionOf(label, 'x', values.x),
    y: fractionOf(label, 'y', values.y),
    largura: fractionOf(label, 'largura', values.largura),
    altura: fractionOf(label, 'altura', values.altura),
  };
  if (rect.largura === 0) throw Error(invalidValue(`${label}.largura`, values.largura, 'número maior que 0 e até 1'));
  if (rect.altura === 0) throw Error(invalidValue(`${label}.altura`, values.altura, 'número maior que 0 e até 1'));
  if (rect.x + rect.largura > 1 + EPSILON) {
    throw Error(invalidValue(`${label} (x + largura)`, rect.x + rect.largura, 'até 1'));
  }
  if (rect.y + rect.altura > 1 + EPSILON) {
    throw Error(invalidValue(`${label} (y + altura)`, rect.y + rect.altura, 'até 1'));
  }
  return rect;
}

/**
 * O retângulo do recorte em proporção da página, depois do giro.
 * @param {unknown} raw
 * @returns {Recorte}
 * @example cropOf({x: 0, y: 0, largura: 0.5, altura: 0.25}) // {x: 0, y: 0, largura: 0.5, altura: 0.25}
 */
function cropOf(raw) {
  return rectOf('recorte', raw);
}

/**
 * Uma marca do tutor no quadro da página depois do giro.
 * @param {number} index
 * @param {unknown} raw
 * @returns {Marca}
 */
function markOf(index, raw) {
  const label = `marcas[${index}]`;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw Error(invalidValue(label, raw, '{forma, x, y, largura, altura} com números de 0 a 1'));
  }
  const forma = /** @type {Record<string, unknown>} */ (raw).forma;
  if (typeof forma !== 'string' || !FORMAS.includes(forma)) {
    throw Error(invalidValue(`${label}.forma`, forma, FORMAS_TEXT));
  }
  return {forma: /** @type {'circulo'|'seta'|'destaque'} */ (forma), ...rectOf(label, raw)};
}

/**
 * A lista de marcas, de 1 a `MAX_MARCAS`.
 * @param {unknown} raw
 * @returns {Marca[]}
 */
function marksOf(raw) {
  if (!Array.isArray(raw)) {
    throw Error(invalidValue('marcas', raw, `lista de 1 a ${MAX_MARCAS} marcas no formato {forma, x, y, largura, altura}`));
  }
  if (raw.length === 0) {
    throw Error(invalidValue('marcas', raw, `lista de 1 a ${MAX_MARCAS} marcas no formato {forma, x, y, largura, altura}`));
  }
  if (raw.length > MAX_MARCAS) {
    throw Error(invalidValue('marcas', raw, `lista de até ${MAX_MARCAS} marcas`));
  }
  return raw.map((entry, index) => markOf(index, entry));
}

/**
 * Normaliza `girar`, `recorte`, `ampliar` e `marcas` para o render. Opção
 * visual junto de `imagem: "nao"` é contradição: a imagem é justamente o que
 * se pediu.
 * @param {{girar?: unknown, recorte?: unknown, ampliar?: unknown, marcas?: unknown, imagem?: unknown}} [options]
 * @returns {PageView}
 * @example normalizePageView({girar: 90, marcas: [{forma: 'circulo', x: 0.1, y: 0.1, largura: 0.2, altura: 0.2}]})
 */
function normalizePageView({girar, recorte, ampliar, marcas, imagem} = {}) {
  const rotation = girar == null ? 0 : Number(girar);
  if (girar != null && !GIRAR_VALUES.includes(rotation)) {
    throw Error(invalidValue('girar', girar, '90, 180 ou 270'));
  }
  const zoom = ampliar == null ? 1 : Number(ampliar);
  if (ampliar != null && (!Number.isFinite(zoom) || zoom < MIN_AMPLIAR || zoom > MAX_AMPLIAR)) {
    throw Error(invalidValue('ampliar', ampliar, `número de ${MIN_AMPLIAR} a ${MAX_AMPLIAR}`));
  }
  const crop = recorte == null ? null : cropOf(recorte);
  const marks = marcas == null ? [] : marksOf(marcas);
  const visual = rotation !== 0 || crop !== null || zoom !== 1 || marks.length > 0;
  if (visual && imagem === 'nao') {
    throw Error('imagem "nao" não combina com girar, recorte, ampliar ou marcas: a imagem é o que se quer ver. Use imagem "sim" ou "auto".');
  }
  return {girar: rotation, recorte: crop, ampliar: zoom, marcas: marks, visual};
}

module.exports = {normalizePageView, cropOf, GIRAR_VALUES, FORMAS, MIN_AMPLIAR, MAX_AMPLIAR, MAX_MARCAS};
