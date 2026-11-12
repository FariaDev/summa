import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPOSER_DEFAULT_LINES,
  COMPOSER_MIN_LINES,
  clampComposerHeight,
  composerHeightForLines,
  composerHeightLimits,
  stepComposerHeight,
} from '../src/composer-height.mjs';

/* Altura do campo do tutor (r2): padrão de três linhas, piso de duas e teto de
   meia coluna. As contas são puras para o ponteiro e o teclado do
   `composer-resize.mjs` só aplicarem o resultado. */

const FACTS = {lineHeight: 24, columnHeight: 600};

test('o padrão é três linhas e o piso é duas', () => {
  assert.equal(COMPOSER_DEFAULT_LINES, 3);
  assert.equal(COMPOSER_MIN_LINES, 2);
  assert.equal(composerHeightForLines(3, 24), 72);
  assert.deepEqual(composerHeightLimits(FACTS), {min: 48, max: 300, default: 72});
});

test('a altura fica entre duas linhas e metade da coluna', () => {
  assert.equal(clampComposerHeight(10, FACTS), 48, 'abaixo do piso, vale o piso');
  assert.equal(clampComposerHeight(900, FACTS), 300, 'acima do teto, vale metade da coluna');
  assert.equal(clampComposerHeight(96, FACTS), 96, 'dentro da faixa, a altura fica');
  assert.equal(clampComposerHeight(Number.NaN, FACTS), 72, 'altura ausente volta ao padrão');
});

test('as setas andam uma linha e param nos limites', () => {
  assert.equal(stepComposerHeight(72, 1, FACTS), 96, '↑ sobe uma linha');
  assert.equal(stepComposerHeight(72, -1, FACTS), 48, '↓ desce uma linha');
  assert.equal(stepComposerHeight(48, -1, FACTS), 48, '↓ no piso não passa');
  assert.equal(stepComposerHeight(300, 1, FACTS), 300, '↑ no teto não passa');
});

test('coluna baixa demais mantém o piso de duas linhas', () => {
  const limits = composerHeightLimits({lineHeight: 24, columnHeight: 80});
  assert.deepEqual(limits, {min: 48, max: 48, default: 72});
  assert.equal(clampComposerHeight(72, {lineHeight: 24, columnHeight: 80}), 48);
});

test('sem altura de linha legível, nada é inventado', () => {
  assert.equal(composerHeightForLines(3, 0), 0);
  assert.deepEqual(composerHeightLimits({lineHeight: 0, columnHeight: 600}), {min: 0, max: Infinity, default: 0});
  assert.equal(clampComposerHeight(90, {lineHeight: 0, columnHeight: 600}), 90);
  assert.equal(stepComposerHeight(90, 1, {lineHeight: 0, columnHeight: 600}), 90);
});
