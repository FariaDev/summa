import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPalette} from '../src/palette-boot.mjs';

function keydown(win, props = {}) {
  const event = new Event('keydown', {cancelable: true});
  Object.assign(event, {
    key: 'k', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false,
    repeat: false, isComposing: false, ...props,
  });
  win.dispatchEvent(event);
  return event;
}

test('o ⌘K abre a paleta antes do módulo carregar; depois e com diálogo, não', () => {
  const win = new EventTarget();
  const calls = [];
  let loaded = false;
  let dialogOpen = false;
  const palette = mountPalette({
    loader: {
      open: async () => { calls.push('open'); return true; },
      close: () => { calls.push('close'); return true; },
      current: () => (loaded ? {} : null),
    },
    window: win,
    document: {querySelector: () => (dialogOpen ? {} : null)},
    toast: (message) => calls.push(['toast', message]),
  });
  assert.equal(win.mesaPalette.open, palette.open);
  assert.equal(win.mesaPalette.close, palette.close);

  const first = keydown(win);
  assert.equal(first.defaultPrevented, true);
  assert.deepEqual(calls, ['open']);

  loaded = true;
  keydown(win);
  assert.deepEqual(calls, ['open'], 'com o módulo carregado, o listener de dentro assume');

  loaded = false;
  dialogOpen = true;
  keydown(win);
  assert.deepEqual(calls, ['open'], 'diálogo aberto não carrega a paleta');

  palette.unbind();
  dialogOpen = false;
  keydown(win);
  assert.deepEqual(calls, ['open'], 'sem listener, nada abre');
});

test('falha ao abrir avisa pelo toast e devolve false', async () => {
  const calls = [];
  const palette = mountPalette({
    loader: {open: async () => { throw Error('sem paleta'); }, close: () => false, current: () => null},
    window: new EventTarget(),
    document: {querySelector: () => null},
    toast: (message) => calls.push(message),
  });
  assert.equal(await palette.open(), false);
  assert.deepEqual(calls, ['sem paleta']);
});
