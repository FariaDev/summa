import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

/* A altura do composer é estado de interface no desk.json (como o rascunho e os
   painéis), nunca default do config.json. O sanitizador guarda só número
   finito e positivo; a faixa de duas linhas a meia coluna depende do DOM e é
   aplicada no renderer (`composer-height.mjs`). */
const require = createRequire(import.meta.url);
const {asComposerHeight, sanitizeState} = require('../desk-state-sanitize.cjs');

test('a altura do composer só entra no estado como número positivo', () => {
  assert.equal(asComposerHeight(96), 96);
  assert.equal(asComposerHeight(96.4), 96, 'altura fracionária vira inteiro');
  assert.equal(asComposerHeight('120'), 120, 'número gravado como texto é aceito');
  for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '', 'alto', null, undefined]) {
    assert.equal(asComposerHeight(value), undefined, `${String(value)} não vira altura`);
  }
});

test('a carga do desk.json preserva a altura e descarta o resto', () => {
  assert.equal(sanitizeState({composerHeight: 96}).composerHeight, 96);
  assert.equal(sanitizeState({composerHeight: '72'}).composerHeight, 72);
  assert.equal('composerHeight' in sanitizeState({composerHeight: 0}), false);
  assert.equal('composerHeight' in sanitizeState({composerHeight: 'alto'}), false);
  assert.equal('composerHeight' in sanitizeState({}), false);
});
