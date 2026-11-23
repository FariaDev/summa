// node --test tests/reader-selection.test.mjs — a leitura da seleção do leitor
// que o ouvinte da partida e as Notas do material dividem (handoff da 1.4.0, seção 6).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readerSelectionSnapshot} from '../src/pdf/reader-selection.mjs';
import * as loader from '../src/pdf/pdf-notes-loader.mjs';

/* Um leitor mínimo: painel com o seletor de PDF, página 4 e a camada de texto. */
function fakeReader({path = '/cursos/Calculo.pdf', inReader = true} = {}) {
  const panel = {querySelector: (selector) => (selector === '.pdf-select' ? {value: path} : null)};
  const pageEl = {dataset: {page: '4'}};
  const layer = {closest: (selector) => ({'.pdf-panel': inReader ? panel : null, '.pdf-page': pageEl})[selector] ?? null};
  const element = {nodeType: 1, closest: (selector) => (selector === '.textLayer' ? layer : null)};
  return {element, text: {nodeType: 3, parentElement: element}};
}

function fakeDocument(node, {rangeText = '', selectionText = '', collapsed = false} = {}) {
  const range = {commonAncestorContainer: node, toString: () => rangeText};
  const selection = {isCollapsed: collapsed, rangeCount: 1, getRangeAt: () => range, toString: () => selectionText};
  return /** @type {any} */ ({defaultView: {getSelection: () => selection}});
}

test('seleção do leitor: o range vale quando o Selection.toString vem vazio', () => {
  const {text} = fakeReader();
  const doc = fakeDocument(text, {rangeText: '  trecho \n do   pdf ', selectionText: ''});
  assert.deepEqual(readerSelectionSnapshot(doc), {quote: 'trecho do pdf', page: 4, path: '/cursos/Calculo.pdf', name: 'Calculo.pdf'});
});

test('seleção do leitor: um elemento como ancestral comum também é lido, e caminho do Windows dá o nome', () => {
  const {element} = fakeReader({path: 'C:\\cursos\\Lista 2.pdf'});
  const doc = fakeDocument(element, {selectionText: 'item b'});
  assert.deepEqual(readerSelectionSnapshot(doc), {quote: 'item b', page: 4, path: 'C:\\cursos\\Lista 2.pdf', name: 'Lista 2.pdf'});
});

test('seleção do leitor: fora de um leitor, colapsada, só com espaço ou com o DOM recusando, não há seleção', () => {
  assert.equal(readerSelectionSnapshot(fakeDocument(fakeReader({inReader: false}).text, {rangeText: 'x'})), null);
  assert.equal(readerSelectionSnapshot(fakeDocument(fakeReader().text, {rangeText: 'x', collapsed: true})), null);
  assert.equal(readerSelectionSnapshot(fakeDocument(fakeReader().text, {rangeText: ' \n '})), null);
  const throwing = /** @type {any} */ ({defaultView: {getSelection: () => { throw new Error('DOM'); }}});
  assert.equal(readerSelectionSnapshot(throwing), null);
  assert.equal(readerSelectionSnapshot(/** @type {any} */ (null)), null);
});

test('seleção do leitor: o carregador das notas reexporta a mesma função, sem cópia', () => {
  assert.equal(loader.readerSelectionSnapshot, readerSelectionSnapshot);
});
