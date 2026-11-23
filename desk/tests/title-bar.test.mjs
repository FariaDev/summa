// node --test tests/title-bar.test.mjs — lado do renderer da barra de título
// própria (src/title-bar.mjs): qual faixa está no topo e as cores dos botões.
import test from 'node:test';
import assert from 'node:assert/strict';
import {cssColorToHex, topBarOf, overlayOf, initTitleBar} from '../src/title-bar.mjs';

/* Documento mínimo: o body com classes e atributos e as faixas por seletor. */
function fakeTopDoc({mini = false, firstRun = false, bars = {}} = {}) {
  const classes = new Set(mini ? ['mini-mode'] : []);
  const body = {classList: {contains: name => classes.has(name)}, hasAttribute: name => name === 'data-first-run' && firstRun};
  return /** @type {any} */ ({body, querySelector: selector => bars[selector] ?? null});
}
const bar = (name, height = 44) => ({name, offsetHeight: height, clientHeight: height - 1});

test('barra de título: rgb e rgba do getComputedStyle viram #rrggbb; transparente não vale', () => {
  assert.equal(cssColorToHex('rgb(247, 247, 247)'), '#f7f7f7');
  assert.equal(cssColorToHex('rgba(25, 25, 25, 1)'), '#191919');
  assert.equal(cssColorToHex('rgba(0, 0, 0, 0)'), null);
  assert.equal(cssColorToHex('transparent'), null);
});

test('barra de título: a faixa do topo é a do mini, a da primeira abertura ou o cabeçalho, nessa ordem', () => {
  const bars = {'#mini-head': bar('mini', 40), '.setup-bar': bar('setup'), 'body>header': bar('header')};
  assert.equal(topBarOf(fakeTopDoc({mini: true, bars})).name, 'mini');
  assert.equal(topBarOf(fakeTopDoc({firstRun: true, bars})).name, 'setup');
  assert.equal(topBarOf(fakeTopDoc({bars})).name, 'header');
  assert.equal(topBarOf(fakeTopDoc({mini: true, bars: {...bars, '#mini-head': bar('mini', 0)}})).name, 'header', 'faixa escondida não conta');
});

test('barra de título: cor, cor dos botões e altura sem a borda de baixo', () => {
  const styleOf = () => /** @type {any} */ ({backgroundColor: 'rgb(25, 25, 25)', color: 'rgb(238, 238, 238)'});
  assert.deepEqual(overlayOf(/** @type {any} */ (bar('header')), styleOf), {color: '#191919', symbolColor: '#eeeeee', height: 43});
  const clear = () => /** @type {any} */ ({backgroundColor: 'rgba(0, 0, 0, 0)', color: 'rgb(0, 0, 0)'});
  assert.equal(overlayOf(/** @type {any} */ (bar('header')), clear), null);
});

test('barra de título: com a barra do sistema, nada muda na página', () => {
  const doc = /** @type {any} */ ({body: {classList: {add: () => { throw Error('não deveria marcar o body'); }}}});
  assert.equal(initTitleBar({doc, desk: /** @type {any} */ ({titleBarMode: 'system'}), label: () => 'Menu', languageEvent: 'x'}), null);
});
