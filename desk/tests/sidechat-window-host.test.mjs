// @ts-check
/* Janela do chat lateral solto (#157, fatia 1): a liberação de `window.open` é
   estreita — só `about:blank` com o nome fixo do chat, com as opções seguras;
   todo o resto segue negado. Sem Electron: o módulo puro é importado direto. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {FakeBrowserWindow} from './fake-webcontents.mjs';

const require = createRequire(import.meta.url);
const host = require('../sidechat-window-host.cjs');

test('libera about:blank com o nome fixo do chat, com opções seguras e janela estreita', () => {
  const decision = host.decideSidechatWindowOpen({url: 'about:blank', frameName: host.SIDECHAT_WINDOW_NAME});
  assert.equal(decision.action, 'allow');
  const options = decision.overrideBrowserWindowOptions;
  assert.ok(options && typeof options === 'object', 'vem com overrideBrowserWindowOptions');
  assert.deepEqual(options.webPreferences, {sandbox: true, contextIsolation: true, nodeIntegration: false});
  assert.equal(options.width, 400);
  assert.equal(options.height, 800);
  assert.ok(options.minWidth < 900, `mínimo bem menor que 900 (${options.minWidth})`);
  assert.ok(options.minHeight < 650, `mínimo bem menor que 650 (${options.minHeight})`);
});

test('nega outra URL, outro nome, file: e https:', () => {
  const denied = [
    {url: 'https://example.com', frameName: host.SIDECHAT_WINDOW_NAME},
    {url: 'file:///etc/passwd', frameName: host.SIDECHAT_WINDOW_NAME},
    {url: 'about:blank', frameName: 'outra-janela'},
    {url: 'about:blank', frameName: ''},
    {url: 'about:blank', frameName: undefined},
    {url: '', frameName: host.SIDECHAT_WINDOW_NAME},
    {url: 'about:config', frameName: host.SIDECHAT_WINDOW_NAME},
    {url: 'https://example.com', frameName: 'outra-janela'},
  ];
  for (const details of denied) {
    assert.deepEqual(host.decideSidechatWindowOpen(details), {action: 'deny'}, JSON.stringify(details));
  }
  assert.deepEqual(host.decideSidechatWindowOpen(), {action: 'deny'});
  assert.deepEqual(host.decideSidechatWindowOpen({}), {action: 'deny'});
});

test('main.cjs liga o módulo em vez de negar tudo inline', () => {
  const main = fs.readFileSync(path.join(import.meta.dirname, '..', 'main.cjs'), 'utf8');
  assert.match(main, /require\(['"]\.\/sidechat-window-host\.cjs['"]\)/);
  assert.match(main, /registerSidechatWindowGuard\(win/);
  assert.doesNotMatch(main, /win\.webContents\.setWindowOpenHandler\(\(\)=>\(\{action:'deny'\}\)\)/);
});

test('o guarda registra o handler e tranca a filha (sem nova window.open nem navegação)', () => {
  const handlers = {main: null, child: null, navigations: 0};
  const childWebContents = {
    setWindowOpenHandler: (fn) => { handlers.child = fn; },
    on: (event, fn) => { if (event === 'will-navigate') handlers.navigate = fn; },
  };
  let closed = false;
  const childWin = {webContents: childWebContents, on: () => {}, isDestroyed: () => false, close: () => { closed = true; }};
  const mainListeners = {};
  const win = {
    webContents: {
      setWindowOpenHandler: (fn) => { handlers.main = fn; },
      on: (event, fn) => { mainListeners[event] = fn; },
    },
    on: (event, fn) => { mainListeners[`win-${event}`] = fn; },
  };
  host.registerSidechatWindowGuard(win);
  assert.equal(typeof handlers.main, 'function', 'o handler da principal foi registrado');
  assert.deepEqual(handlers.main({url: 'about:blank', frameName: host.SIDECHAT_WINDOW_NAME}).action, 'allow');
  assert.deepEqual(handlers.main({url: 'https://example.com', frameName: host.SIDECHAT_WINDOW_NAME}), {action: 'deny'});
  assert.equal(typeof mainListeners['did-create-window'], 'function', 'a filha é guardada ao nascer');
  mainListeners['did-create-window'](childWin, {});
  assert.deepEqual(handlers.child({url: 'about:blank', frameName: host.SIDECHAT_WINDOW_NAME}), {action: 'deny'}, 'a filha não abre outra janela');
  let prevented = false;
  handlers.navigate({preventDefault: () => { prevented = true; }});
  assert.equal(prevented, true, 'navegação na filha é bloqueada');
  assert.equal(typeof mainListeners['win-close'], 'function', 'fechar a Mesa fecha a filha');
  mainListeners['win-close']();
  assert.equal(closed, true, 'a filha fecha junto');
});

test('recarga da principal fecha a filha órfã (did-start-navigation isMainFrame, render-process-gone, destroyed)', () => {
  const win = new FakeBrowserWindow({backgroundColor: '#f7f7f7'});
  host.registerSidechatWindowGuard(win);
  const child = new FakeBrowserWindow({backgroundColor: '#f7f7f7'});
  win.webContents.emit('did-create-window', child, {});
  assert.equal(child.isDestroyed(), false, 'a filha nasce aberta');
  win.webContents.emit('did-start-navigation', {}, 'file:///index.html', false, false);
  assert.equal(child.isDestroyed(), false, 'navegação de subframe não fecha a filha');
  win.webContents.emit('did-start-navigation', {}, 'file:///index.html', false, true);
  assert.equal(child.isDestroyed(), true, 'começar a recarga do frame principal fecha a filha');

  const win2 = new FakeBrowserWindow({backgroundColor: '#f7f7f7'});
  host.registerSidechatWindowGuard(win2);
  const child2 = new FakeBrowserWindow({backgroundColor: '#f7f7f7'});
  win2.webContents.emit('did-create-window', child2, {});
  win2.webContents.emit('render-process-gone', {}, {}, {reason: 'crashed'});
  assert.equal(child2.isDestroyed(), true, 'render-process-gone fecha a filha');

  const win3 = new FakeBrowserWindow({backgroundColor: '#f7f7f7'});
  host.registerSidechatWindowGuard(win3);
  const child3 = new FakeBrowserWindow({backgroundColor: '#f7f7f7'});
  win3.webContents.emit('did-create-window', child3, {});
  win3.webContents.emit('destroyed');
  assert.equal(child3.isDestroyed(), true, 'destroyed fecha a filha');
});

test('a filha também bloqueia will-redirect', () => {
  const win = new FakeBrowserWindow({backgroundColor: '#f7f7f7'});
  host.registerSidechatWindowGuard(win);
  const child = new FakeBrowserWindow({backgroundColor: '#f7f7f7'});
  win.webContents.emit('did-create-window', child, {});
  let preventedNavigate = false;
  child.webContents.emit('will-navigate', {preventDefault: () => { preventedNavigate = true; }}, 'https://example.com');
  assert.equal(preventedNavigate, true, 'will-navigate é bloqueado');
  let preventedRedirect = false;
  child.webContents.emit('will-redirect', {preventDefault: () => { preventedRedirect = true; }}, 'https://example.com');
  assert.equal(preventedRedirect, true, 'will-redirect é bloqueado');
});

test('fundo da filha acompanha o tema nos dois modos (sem flash branco)', () => {
  assert.equal(host.sidechatChildWindowOptions('dark').backgroundColor, '#191919', 'tema escuro usa #191919');
  assert.equal(host.sidechatChildWindowOptions('light').backgroundColor, '#f7f7f7', 'tema claro usa #f7f7f7');
  assert.equal(host.sidechatChildWindowOptions('auto').backgroundColor, '#f7f7f7', 'auto cai no claro, como a principal');
  assert.equal(host.sidechatChildWindowOptions().backgroundColor, '#f7f7f7', 'sem tema, cai no claro');

  const darkDecision = host.decideSidechatWindowOpen({url: 'about:blank', frameName: host.SIDECHAT_WINDOW_NAME}, 'dark');
  assert.equal(darkDecision.overrideBrowserWindowOptions.backgroundColor, '#191919');
  const lightDecision = host.decideSidechatWindowOpen({url: 'about:blank', frameName: host.SIDECHAT_WINDOW_NAME}, 'light');
  assert.equal(lightDecision.overrideBrowserWindowOptions.backgroundColor, '#f7f7f7');

  const winDark = new FakeBrowserWindow({backgroundColor: '#191919'});
  host.registerSidechatWindowGuard(winDark);
  const darkOpen = winDark.webContents.handleWindowOpen({url: 'about:blank', frameName: host.SIDECHAT_WINDOW_NAME});
  assert.equal(darkOpen.action, 'allow');
  assert.equal(darkOpen.overrideBrowserWindowOptions.backgroundColor, '#191919', 'a principal escura abre a filha escura');

  const winLight = new FakeBrowserWindow({backgroundColor: '#f7f7f7'});
  host.registerSidechatWindowGuard(winLight);
  const lightOpen = winLight.webContents.handleWindowOpen({url: 'about:blank', frameName: host.SIDECHAT_WINDOW_NAME});
  assert.equal(lightOpen.overrideBrowserWindowOptions.backgroundColor, '#f7f7f7', 'a principal clara abre a filha clara');
});

test('a janela filha nasce sem a barra de menu do Electron', () => {
  const decision = host.decideSidechatWindowOpen({url: 'about:blank', frameName: host.SIDECHAT_WINDOW_NAME});
  assert.equal(decision.overrideBrowserWindowOptions.autoHideMenuBar, true, 'a filha nasce com a barra oculta');

  const visibility = [];
  const childWin = {
    webContents: {setWindowOpenHandler: () => {}, on: () => {}},
    on: () => {},
    isDestroyed: () => false,
    close: () => {},
    setMenuBarVisibility: (visible) => visibility.push(visible),
  };
  const win = new FakeBrowserWindow({backgroundColor: '#f7f7f7'});
  host.registerSidechatWindowGuard(win);
  win.webContents.emit('did-create-window', childWin, {});
  assert.deepEqual(visibility, [false], 'a barra de menu some na filha viva');
});
