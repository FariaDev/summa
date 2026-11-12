import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {PIN_LIMIT, PIN_IDS, normalizeComposerPins, toggleComposerPin, savedComposerPins} from '../src/composer-pins.mjs';

/* Fixos do menu Anexar (#99): a regra dos dois vive fora do DOM, e a carga do
   `desk.json` precisa guardar exatamente os mesmos nomes. A preferência é
   estado de interface, nunca default do `config.json`. */
const require = createRequire(import.meta.url);
const {sanitizeState} = require('../desk-state-sanitize.cjs');

test('o padrão é nenhum fixo: o composer fica como hoje', () => {
  assert.equal(PIN_LIMIT, 2);
  assert.deepEqual([...PIN_IDS], ['attach-file', 'phone-photo', 'check']);
  assert.deepEqual(normalizeComposerPins(), []);
  assert.deepEqual(normalizeComposerPins(null), []);
});

test('lista gravada: só ações conhecidas, sem repetição e até o teto', () => {
  assert.deepEqual(normalizeComposerPins(['check', 'attach-file']), ['check', 'attach-file']);
  assert.deepEqual(normalizeComposerPins(['check', 'check', 'bogus', 'phone-photo']), ['check', 'phone-photo']);
  assert.deepEqual(normalizeComposerPins(['attach-file', 'phone-photo', 'check']), ['attach-file', 'phone-photo']);
  assert.deepEqual(normalizeComposerPins('check'), []);
});

test('fixar e desafixar; o terceiro é recusado sem mudar a lista', () => {
  const first = toggleComposerPin([], 'check');
  assert.deepEqual(first, {pins: ['check'], changed: true, refused: false});
  const second = toggleComposerPin(first.pins, 'attach-file');
  assert.deepEqual(second, {pins: ['check', 'attach-file'], changed: true, refused: false});
  const third = toggleComposerPin(second.pins, 'phone-photo');
  assert.deepEqual(third, {pins: ['check', 'attach-file'], changed: false, refused: true});
  assert.deepEqual(toggleComposerPin(second.pins, 'check'), {pins: ['attach-file'], changed: true, refused: false});
  assert.deepEqual(toggleComposerPin(second.pins, 'bogus'), {pins: ['check', 'attach-file'], changed: false, refused: false});
});

test('salvar mantém a corrente quando o campo falta e sanea o que veio', () => {
  const current = ['check', 'phone-photo'];
  assert.deepEqual(savedComposerPins(current, undefined), ['check', 'phone-photo']);
  assert.deepEqual(savedComposerPins(current, ['attach-file']), ['attach-file']);
  assert.deepEqual(savedComposerPins(current, 'attach-file'), []);
});

test('a carga do desk.json guarda os fixos no estado de interface', () => {
  assert.deepEqual(sanitizeState({}).composerPins, []);
  assert.deepEqual(sanitizeState({composerPins: ['check', 'bogus', 'attach-file', 'phone-photo']}).composerPins, ['check', 'attach-file']);
  assert.deepEqual(sanitizeState({composerPins: ['phone-photo', 'phone-photo']}).composerPins, ['phone-photo']);
  assert.deepEqual(sanitizeState({composerPins: 7}).composerPins, []);
});
