// @ts-check
/* Relato: com o monitor externo desconectado, a janela principal abria fora da
   tela. O `placeWindow` cobre o boot; com o app aberto, o host escuta
   `display-removed`/`display-metrics-changed` e devolve a janela para a
   primária. O chat solto segue a mesma ideia no host dele. Sem Electron: os
   fakes de `fake-webcontents.mjs` ganham os eventos de tela aqui. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {FakeBrowserWindow,FakeScreen} from './fake-webcontents.mjs';

const require = createRequire(import.meta.url);
const {keepWindowOnDisplays} = require('../window-display-host.cjs');
const sidechat = require('../sidechat-window-host.cjs');

/* Geometria real do autor: interna 2560x1664 à direita (x=0), LG 1920x1080 à
   esquerda (x negativo). O interno é o primário. */
const INTERNA = {id: 1, internal: true, workArea: {x: 0, y: 0, width: 2560, height: 1664}};
const EXTERNO = {id: 2, internal: false, workArea: {x: -1920, y: -292, width: 1920, height: 1080}};

class ChangingScreen extends FakeScreen {
  constructor(displays, primaryId) {
    super(displays, primaryId);
    this.changes = new EventEmitter();
  }
  on(event, fn) {
    this.changes.on(event, fn);
  }
  emit(event, ...args) {
    return this.changes.emit(event, ...args);
  }
  setDisplays(displays) {
    this._displays = displays;
  }
}

function trackBounds(win) {
  const calls = [];
  const setBounds = win.setBounds.bind(win);
  win.setBounds = (bounds) => {
    calls.push({...bounds});
    setBounds(bounds);
  };
  return calls;
}

test('display-removed traz a janela que sumiu para a primária e não mexe na que está dentro', () => {
  const screen = new ChangingScreen([INTERNA, EXTERNO], 1);
  const win = new FakeBrowserWindow({bounds: {x: -1900, y: -272, width: 1500, height: 900}});
  const calls = trackBounds(win);
  keepWindowOnDisplays({screenLike: screen, window: win});

  screen.setDisplays([INTERNA]);
  screen.emit('display-removed', {}, EXTERNO);
  assert.deepEqual(calls, [{x: 20, y: 20, width: 1500, height: 900}], 'volta para o fallback da primária');

  const kept = {x: 120, y: 80, width: 1600, height: 1020};
  win.setBounds(kept);
  calls.length = 0;
  screen.emit('display-metrics-changed');
  assert.deepEqual(calls, [], 'a janela visível não se mexe');
  assert.deepEqual(win.getBounds(), kept);
});

test('display-metrics-changed resgata a janela quando a área útil encolheu', () => {
  const screen = new ChangingScreen([INTERNA], 1);
  const win = new FakeBrowserWindow({bounds: {x: 1500, y: 0, width: 1000, height: 900}});
  const calls = trackBounds(win);
  keepWindowOnDisplays({screenLike: screen, window: win});

  screen.setDisplays([{id: 1, internal: true, workArea: {x: 0, y: 0, width: 1600, height: 900}}]);
  screen.emit('display-metrics-changed');
  assert.deepEqual(calls, [{x: 20, y: 20, width: 1000, height: 860}], 'tamanho adaptado à área útil nova');
});

test('chat lateral solto também volta para a primária quando a tela some', () => {
  const screen = new ChangingScreen([INTERNA, EXTERNO], 1);
  const win = new FakeBrowserWindow({bounds: {x: 0, y: 0, width: 900, height: 650}});
  const state = {};
  sidechat.registerSidechatWindowGuard(win, undefined, {
    screen,
    loadState: () => ({...state}),
    saveState: (patch) => { Object.assign(state, patch); },
    debounceMs: 5,
  });
  const child = new FakeBrowserWindow({bounds: {x: -1900, y: 100, width: 400, height: 800}});
  win.webContents.emit('did-create-window', child, {});

  screen.setDisplays([INTERNA]);
  screen.emit('display-removed', {}, EXTERNO);
  assert.deepEqual(child.getBounds(), {x: -280, y: 100, width: 400, height: 800}, 'a filha fica com 120 px à vista na primária');

  const kept = {x: 120, y: 80, width: 400, height: 800};
  child.setBounds(kept);
  screen.emit('display-metrics-changed');
  assert.deepEqual(child.getBounds(), kept, 'a filha que está na tela não se mexe');
});
