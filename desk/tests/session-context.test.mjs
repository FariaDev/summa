import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfGoesName, sessionContextLine} from '../src/session-context.mjs';

test('linha do cabeçalho: o primeiro PDF com a página e a questão ativa', () => {
  assert.equal(sessionContextLine({pdfs: [{name: 'Limites.pdf', page: 1}], exercise: 'Lista 3, questão 2'}), 'Limites.pdf, p. 1 · Lista 3, questão 2');
  assert.equal(sessionContextLine({pdfs: [{name: 'Limites.pdf', page: 1}]}), 'Limites.pdf, p. 1');
  assert.equal(sessionContextLine({exercise: 'Lista 3, questão 2'}), 'Lista 3, questão 2');
});

test('linha do cabeçalho: mais de um PDF mostra o primeiro e "+N"', () => {
  assert.equal(pdfGoesName({name: 'Limites.pdf', page: 1}, 1), 'Limites.pdf, p. 1 +1');
  assert.equal(sessionContextLine({pdfs: [{name: 'Limites.pdf', page: 1}, {name: 'Formulario.pdf', page: 2}]}), 'Limites.pdf, p. 1 +1');
  assert.equal(sessionContextLine({pdfs: [{name: 'Limites.pdf', page: 1}, {name: 'Formulario.pdf', page: 2}, {name: 'Apostila.pdf', page: 3}]}), 'Limites.pdf, p. 1 +2');
});

test('linha do cabeçalho: sem fato nenhum fica vazia, sem texto inventado', () => {
  assert.equal(sessionContextLine({}), '');
  assert.equal(sessionContextLine({pdfs: [], exercise: '   '}), '');
  assert.equal(sessionContextLine({pdfs: [{name: '', page: 3}], exercise: ''}), '');
});

test('linha do cabeçalho: página ausente não vira "p. 0"', () => {
  assert.equal(pdfGoesName({name: 'Limites.pdf', page: 0}), 'Limites.pdf');
  assert.equal(pdfGoesName({name: 'Limites.pdf', page: 0}, 1), 'Limites.pdf +1');
  assert.equal(sessionContextLine({pdfs: [{name: 'Limites.pdf', page: 0}]}), 'Limites.pdf');
});
