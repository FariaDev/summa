// node --test tests/title-bar-host.test.mjs — barra de título própria da janela
// principal no Windows e no Linux: opções da janela e o IPC dos botões e do ≡.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fakeIpcMain, fakeMenu, fakeWindow} from './fake-electron-shell.mjs';

const require = createRequire(import.meta.url);
const {titleBarOptions, usesOverlayTitleBar, titleBarOverlayFrom, registerTitleBar} = require('../title-bar-host.cjs');

test('barra de título: própria no Windows e no Linux, a do sistema no macOS ou com SUMMA_SYSTEM_TITLEBAR=1', () => {
  assert.equal(usesOverlayTitleBar('win32', {}), true);
  assert.equal(usesOverlayTitleBar('linux', {}), true);
  assert.equal(usesOverlayTitleBar('darwin', {}), false);
  assert.equal(usesOverlayTitleBar('linux', {SUMMA_SYSTEM_TITLEBAR: '1'}), false);
  assert.deepEqual(titleBarOptions('darwin', {}), {});
  assert.deepEqual(titleBarOptions('win32', {SUMMA_SYSTEM_TITLEBAR: '1'}), {});
  const options = titleBarOptions('win32', {});
  assert.equal(options.titleBarStyle, 'hidden');
  assert.equal(options.titleBarOverlay?.height, 44);
});

test('barra de título: cores e altura do renderer passam só no formato #rrggbb e de 24 a 80 px', () => {
  assert.deepEqual(titleBarOverlayFrom({color: '#191919', symbolColor: '#EEEEEE', height: 43}), {color: '#191919', symbolColor: '#EEEEEE', height: 43});
  assert.throws(() => titleBarOverlayFrom({color: 'red', symbolColor: '#000000', height: 43}), /cor inválida \(recebido "red"; esperado #rrggbb\)/);
  assert.throws(() => titleBarOverlayFrom({color: '#000000', symbolColor: '#000', height: 43}), /cor dos botões inválida/);
  assert.throws(() => titleBarOverlayFrom({color: '#000000', symbolColor: '#000000', height: 400}), /altura inválida \(recebido 400/);
  assert.throws(() => titleBarOverlayFrom(null), /cor inválida/);
});

test('barra de título: o IPC pinta os botões da janela e abre o menu no ≡', async () => {
  const ipcMain = fakeIpcMain();
  const win = fakeWindow();
  const menu = fakeMenu();
  menu.setApplicationMenu([{label: 'Summa'}]);
  registerTitleBar({ipcMain, getWin: () => win, Menu: menu, enabled: true});
  assert.deepEqual(await ipcMain.invoke('title-bar-overlay', {color: '#191919', symbolColor: '#eeeeee', height: 43}), {ok: true});
  assert.deepEqual(win.titleBarOverlays, [{color: '#191919', symbolColor: '#eeeeee', height: 43}]);
  assert.deepEqual(await ipcMain.invoke('title-bar-menu', {x: 12.4, y: 43.6}), {ok: true});
  assert.deepEqual(menu.popups, [{window: win, x: 12, y: 44}]);
});

test('barra de título: com a do sistema, o IPC não mexe nos botões; sem janela, nada quebra', async () => {
  const ipcMain = fakeIpcMain();
  const win = fakeWindow();
  registerTitleBar({ipcMain, getWin: () => win, Menu: fakeMenu(), enabled: false});
  assert.deepEqual(await ipcMain.invoke('title-bar-overlay', {color: '#191919', symbolColor: '#eeeeee', height: 43}), {ok: false});
  assert.deepEqual(win.titleBarOverlays, []);
  assert.deepEqual(await ipcMain.invoke('title-bar-menu', {x: 1, y: 1}), {ok: false}, 'sem menu da aplicação');
  const gone = fakeIpcMain();
  registerTitleBar({ipcMain: gone, getWin: () => null, Menu: fakeMenu(), enabled: true});
  assert.deepEqual(await gone.invoke('title-bar-overlay', {color: '#191919', symbolColor: '#eeeeee', height: 43}), {ok: false});
});

test('barra de título: main.cjs cria a janela com as opções e passa o modo ao preload', () => {
  const source = fs.readFileSync(new URL('../main.cjs', import.meta.url), 'utf8');
  const creation = source.split('\n').find(line => /win=new BrowserWindow\(/.test(line)) || '';
  assert.match(creation, /\.\.\.titleBarOptions\(process\.platform,process\.env\)/);
  assert.match(creation, /--mesa-titlebar=/);
  assert.match(source, /registerTitleBar\(\{ipcMain,getWin:\(\)=>win,Menu,enabled:usesOverlayTitleBar\(process\.platform,process\.env\)\}\)/);
});
