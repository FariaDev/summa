// @ts-check
/* Chat solto lembra lugar e pode ficar por cima (#157, fatia 2): colocação
   da filha (primeira vez encosta à direita, posição salva restaura, fora de
   monitor volta à principal — a mesma lógica `placed` da Mesa), sanitização
   no desk.json e o "sempre por cima". Sem Electron: host puro + fakes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {FakeBrowserWindow, FakeScreen} from './fake-webcontents.mjs';
import {pollUntil} from './waits.mjs';

const require = createRequire(import.meta.url);
const host = require('../sidechat-window-host.cjs');
const sanitize = require('../desk-state-sanitize.cjs');

const PRIMARY_WORK = {x: 0, y: 0, width: 1920, height: 1000};
const SECOND_WORK = {x: 1920, y: 0, width: 1440, height: 860};
function twoScreens() {
  return new FakeScreen([
    {id: 1, bounds: {x: 0, y: 0, width: 1920, height: 1040}, workArea: {...PRIMARY_WORK}, internal: true},
    {id: 2, bounds: {x: 1920, y: 0, width: 1440, height: 900}, workArea: {...SECOND_WORK}, internal: false},
  ], 1);
}

test('primeira vez: encosta à direita da tela da Mesa, altura útil toda, largura 400', () => {
  const screen = twoScreens();
  const mainOnSecond = {x: 2000, y: 50, width: 1200, height: 800};
  const placed = host.resolveSidechatPlacement(screen, mainOnSecond, undefined);
  assert.equal(placed.width, 400, 'largura 400');
  assert.equal(placed.height, SECOND_WORK.height, 'altura útil toda');
  assert.equal(placed.x, SECOND_WORK.x + SECOND_WORK.width - 400, 'borda direita da tela da Mesa');
  assert.equal(placed.y, SECOND_WORK.y, 'topo da área útil');

  const mainOnPrimary = {x: 100, y: 100, width: 900, height: 650};
  const onPrimary = host.resolveSidechatPlacement(screen, mainOnPrimary, null);
  assert.deepEqual(onPrimary, {x: PRIMARY_WORK.width - 400, y: PRIMARY_WORK.y, width: 400, height: PRIMARY_WORK.height});
});

test('posição salva dentro de um monitor é restaurada intacta', () => {
  const screen = twoScreens();
  const saved = {x: 2000, y: 60, width: 380, height: 700};
  const placed = host.resolveSidechatPlacement(screen, {x: 0, y: 0, width: 900, height: 650}, saved);
  assert.deepEqual(placed, saved);

  const onPrimary = {x: 300, y: 80, width: 420, height: 900};
  assert.deepEqual(host.resolveSidechatPlacement(screen, {x: 0, y: 0, width: 900, height: 650}, onPrimary), onPrimary);
});

test('MacBook Air 1280×832: altura salva maior que a área útil é limitada ao restaurar', () => {
  const work = {x: 0, y: 25, width: 1280, height: 807};
  const screen = new FakeScreen([
    {id: 1, bounds: {x: 0, y: 0, width: 1280, height: 832}, workArea: work, internal: true},
  ], 1);
  const saved = {x: 800, y: 40, width: 420, height: 1000};
  const placed = host.resolveSidechatPlacement(screen, {x: 0, y: 0, width: 900, height: 650}, saved);
  assert.equal(placed.width, 420, 'largura salva que cabe é mantida');
  assert.equal(placed.height, work.height, 'altura limitada à área útil da tela baixa');
  assert.ok(placed.x >= work.x && placed.x + placed.width <= work.x + work.width, 'janela dentro da largura da tela');
  assert.ok(placed.y >= work.y && placed.y < work.y + work.height, 'topo dentro da área útil');
});

test('posição fora de qualquer monitor volta para a tela principal', () => {
  const screen = twoScreens();
  const lost = {x: 9000, y: 9000, width: 400, height: 800};
  const placed = host.resolveSidechatPlacement(screen, {x: 0, y: 0, width: 900, height: 650}, lost);
  assert.deepEqual(placed, {x: PRIMARY_WORK.width - 400, y: PRIMARY_WORK.y, width: 400, height: PRIMARY_WORK.height});

  const above = {x: 100, y: -5000, width: 400, height: 800};
  assert.deepEqual(host.resolveSidechatPlacement(screen, {x: 0, y: 0, width: 900, height: 650}, above).height, PRIMARY_WORK.height);
});

test('decida a janela solta com posição e por cima quando o estado pede', () => {
  const screen = twoScreens();
  const saved = {x: 1500, y: 40, width: 400, height: 900};
  const placement = host.resolveSidechatPlacement(screen, {x: 0, y: 0, width: 900, height: 650}, saved);
  const decision = host.decideSidechatWindowOpen(
    {url: 'about:blank', frameName: host.SIDECHAT_WINDOW_NAME}, 'light', {...placement, alwaysOnTop: true},
  );
  assert.equal(decision.action, 'allow');
  const options = decision.overrideBrowserWindowOptions;
  assert.equal(options.x, saved.x);
  assert.equal(options.y, saved.y);
  assert.equal(options.width, saved.width);
  assert.equal(options.height, saved.height);
  assert.equal(options.alwaysOnTop, true, 'sempre por cima entra nas opções da filha');
});

test('sanitiza solto, limites e por cima no desk.json (aceita bom, recusa lixo)', () => {
  const good = sanitize.sanitizeState({sidechatDetached: true, sidechatBounds: {x: 10, y: 20, width: 400, height: 800}, sidechatAlwaysOnTop: true});
  assert.equal(good.sidechatDetached, true);
  assert.deepEqual(good.sidechatBounds, {x: 10, y: 20, width: 400, height: 800});
  assert.equal(good.sidechatAlwaysOnTop, true);

  const bad = sanitize.sanitizeState({sidechatDetached: 'sim', sidechatBounds: {x: 'a', y: 0, width: 0, height: 800}, sidechatAlwaysOnTop: 1});
  assert.equal(bad.sidechatDetached, false, 'texto não vira solto');
  assert.equal('sidechatBounds' in bad, false, 'limite inválido cai fora');
  assert.equal(bad.sidechatAlwaysOnTop, false, 'número não liga o por cima');

  const absent = sanitize.sanitizeState({});
  assert.equal(absent.sidechatDetached, false, 'sem campo começa preso');
  assert.equal(absent.sidechatAlwaysOnTop, false, 'sem campo começa por baixo');
  assert.equal('sidechatBounds' in absent, false);
});

test('sempre por cima liga/desliga na filha viva e persiste no estado', async () => {
  const screen = twoScreens();
  const win = new FakeBrowserWindow({backgroundColor: '#f7f7f7', bounds: {x: 0, y: 0, width: 900, height: 650}});
  const saved = [];
  let state = {sidechatAlwaysOnTop: false};
  const ipcHandlers = {};
  const fakeIpc = {handle: (channel, fn) => { ipcHandlers[channel] = fn; }};
  host.registerSidechatWindowGuard(win, undefined, {
    screen,
    loadState: () => ({...state}),
    saveState: (patch) => { state = {...state, ...patch}; saved.push({...patch}); },
    ipcMain: fakeIpc,
  });
  assert.equal(typeof ipcHandlers['sidechat-always-on-top'], 'function', 'IPC do por cima registrado');

  const child = new FakeBrowserWindow({backgroundColor: '#f7f7f7'});
  win.webContents.emit('did-create-window', child, {});
  await ipcHandlers['sidechat-always-on-top']({sender: win.webContents}, {on: true});
  assert.equal(child.isAlwaysOnTop(), true, 'liga o por cima na janela viva');
  assert.equal(state.sidechatAlwaysOnTop, true, 'persiste ligado');

  await ipcHandlers['sidechat-always-on-top']({sender: win.webContents}, {on: false});
  assert.equal(child.isAlwaysOnTop(), false, 'desliga o por cima na janela viva');
  assert.equal(state.sidechatAlwaysOnTop, false, 'persiste desligado');
  assert.ok(saved.length >= 2, 'cada troca salva');

  assert.throws(() => ipcHandlers['sidechat-always-on-top']({sender: win.webContents}, {on: 'sim'}), /booleano/, 'lixo no IPC é recusado');
});

test('mover/redimensionar salva com debounce e fechar a filha grava solto falso', async () => {
  const screen = twoScreens();
  const win = new FakeBrowserWindow({backgroundColor: '#f7f7f7', bounds: {x: 0, y: 0, width: 900, height: 650}});
  const saved = [];
  let state = {};
  host.registerSidechatWindowGuard(win, undefined, {
    screen,
    loadState: () => ({...state}),
    saveState: (patch) => { state = {...state, ...patch}; saved.push({...patch}); },
    debounceMs: 20,
  });
  const child = new FakeBrowserWindow({backgroundColor: '#f7f7f7', bounds: {x: 1500, y: 0, width: 400, height: 900}});
  win.webContents.emit('did-create-window', child, {});
  assert.equal(state.sidechatDetached, true, 'criar a filha grava solto');

  child.setBounds({x: 650, y: 70, width: 420, height: 900});
  await pollUntil(() => state.sidechatBounds, b => b && b.x === 650 && b.y === 70 && b.width === 420 && b.height === 900, {timeout: 2000, interval: 10, what: 'o debounce gravar o lugar novo'});
  assert.deepEqual(state.sidechatBounds, {x: 650, y: 70, width: 420, height: 900}, 'debounce grava o lugar novo');
  assert.equal(state.sidechatDetached, true);

  child.close();
  assert.equal(state.sidechatDetached, false, 'fechar a filha grava preso');
  assert.deepEqual(state.sidechatBounds, {x: 650, y: 70, width: 420, height: 900}, 'fechar guarda os limites');

  const child2 = new FakeBrowserWindow({backgroundColor: '#f7f7f7', bounds: {x: 700, y: 80, width: 380, height: 880}});
  win.webContents.emit('did-create-window', child2, {});
  assert.equal(state.sidechatDetached, true);
  win.emit('close');
  assert.equal(state.sidechatDetached, true, 'fechar a Mesa com solto mantém solto');
  assert.deepEqual(state.sidechatBounds, {x: 700, y: 80, width: 380, height: 880}, 'fechar a Mesa guarda os limites');
});

test('did-start-navigation antes da primeira filha e fechar à mão grava solto falso', () => {
  const screen = twoScreens();
  const win = new FakeBrowserWindow({backgroundColor: '#f7f7f7', bounds: {x: 0, y: 0, width: 900, height: 650}});
  let state = {};
  host.registerSidechatWindowGuard(win, undefined, {
    screen,
    loadState: () => ({...state}),
    saveState: (patch) => { state = {...state, ...patch}; },
  });
  win.webContents.emit('did-start-navigation', {}, 'file:///index.html', false, true);
  const child = new FakeBrowserWindow({backgroundColor: '#f7f7f7', bounds: {x: 1500, y: 0, width: 400, height: 900}});
  win.webContents.emit('did-create-window', child, {});
  assert.equal(state.sidechatDetached, true, 'criar a filha grava solto');
  child.close();
  assert.equal(state.sidechatDetached, false, 'fechar à mão após navegação inicial grava preso');
});

test('navegação depois filha nova fechar à mão grava falso, recarga com filha aberta mantém true', () => {
  const screen = twoScreens();
  const win = new FakeBrowserWindow({backgroundColor: '#f7f7f7', bounds: {x: 0, y: 0, width: 900, height: 650}});
  let state = {};
  host.registerSidechatWindowGuard(win, undefined, {
    screen,
    loadState: () => ({...state}),
    saveState: (patch) => { state = {...state, ...patch}; },
  });
  const child1 = new FakeBrowserWindow({backgroundColor: '#f7f7f7', bounds: {x: 1500, y: 0, width: 400, height: 900}});
  win.webContents.emit('did-create-window', child1, {});
  assert.equal(state.sidechatDetached, true);
  win.webContents.emit('did-start-navigation', {}, 'file:///index.html', false, true);
  assert.equal(child1.isDestroyed(), true, 'recarga fecha a filha órfã');
  assert.equal(state.sidechatDetached, true, 'recarga com filha aberta mantém solto');
  const child2 = new FakeBrowserWindow({backgroundColor: '#f7f7f7', bounds: {x: 700, y: 80, width: 380, height: 880}});
  win.webContents.emit('did-create-window', child2, {});
  assert.equal(state.sidechatDetached, true, 'nova filha grava solto');
  child2.close();
  assert.equal(state.sidechatDetached, false, 'fechar à mão após recarga grava preso');
});

test('colocação limita largura/altura a [240, área útil] em tela 1920×1000', () => {
  const screen = new FakeScreen([
    {id: 1, bounds: {x: 0, y: 0, width: 1920, height: 1040}, workArea: {...PRIMARY_WORK}, internal: true},
  ], 1);
  const mainBounds = {x: 0, y: 0, width: 900, height: 650};
  const small = host.resolveSidechatPlacement(screen, mainBounds, {x: 100, y: 100, width: 10, height: 10});
  assert.equal(small.width, 240, '10 vira 240 na largura');
  assert.equal(small.height, 240, '10 vira 240 na altura');
  assert.equal(small.x, 100, 'lugar dentro da tela fica');
  assert.equal(small.y, 100, 'topo dentro da tela fica');
  const huge = host.resolveSidechatPlacement(screen, mainBounds, {x: 0, y: 0, width: 5000, height: 5000});
  assert.equal(huge.width, PRIMARY_WORK.width, '5000 vira a área útil na largura');
  assert.equal(huge.height, PRIMARY_WORK.height, '5000 vira a área útil na altura');
  assert.equal(huge.x, 0);
  assert.equal(huge.y, 0);
});

test('colocação mantém barra de título visível com 120 px em tela 1920×1000', () => {
  const screen = new FakeScreen([
    {id: 1, bounds: {x: 0, y: 0, width: 1920, height: 1040}, workArea: {...PRIMARY_WORK}, internal: true},
  ], 1);
  const mainBounds = {x: 0, y: 0, width: 900, height: 650};
  const visible = (b) => Math.min(b.x + b.width, PRIMARY_WORK.x + PRIMARY_WORK.width) - Math.max(b.x, PRIMARY_WORK.x);
  const left = host.resolveSidechatPlacement(screen, mainBounds, {x: -200, y: 0, width: 400, height: 800});
  assert.equal(left.width, 400);
  assert.equal(left.height, 800);
  assert.ok(visible(left) >= 120, `x=-200 mantém ao menos 120 visíveis (${visible(left)})`);
  assert.ok(left.y >= PRIMARY_WORK.y && left.y < PRIMARY_WORK.y + PRIMARY_WORK.height, 'topo dentro da área útil');
  const corner = host.resolveSidechatPlacement(screen, mainBounds, {x: 1800, y: 900, width: 400, height: 400});
  assert.equal(corner.width, 400);
  assert.equal(corner.height, 400);
  assert.ok(visible(corner) >= 120, `1800 mantém ao menos 120 visíveis (${visible(corner)})`);
  assert.ok(corner.y >= PRIMARY_WORK.y && corner.y < PRIMARY_WORK.y + PRIMARY_WORK.height, 'topo do canto dentro da área útil');
});

test('sempre por cima só aceita principal ou filha, desconhecido é ignorado', async () => {
  const screen = twoScreens();
  const win = new FakeBrowserWindow({backgroundColor: '#f7f7f7', bounds: {x: 0, y: 0, width: 900, height: 650}});
  const saved = [];
  let state = {sidechatAlwaysOnTop: false};
  const ipcHandlers = {};
  const fakeIpc = {handle: (channel, fn) => { ipcHandlers[channel] = fn; }};
  host.registerSidechatWindowGuard(win, undefined, {
    screen,
    loadState: () => ({...state}),
    saveState: (patch) => { state = {...state, ...patch}; saved.push({...patch}); },
    ipcMain: fakeIpc,
  });
  const child = new FakeBrowserWindow({backgroundColor: '#f7f7f7'});
  win.webContents.emit('did-create-window', child, {});
  const unknown = new FakeBrowserWindow({backgroundColor: '#f7f7f7'});
  const countBefore = saved.length;
  await ipcHandlers['sidechat-always-on-top']({sender: unknown.webContents}, {on: true});
  assert.equal(child.isAlwaysOnTop(), false, 'desconhecido não liga o por cima');
  assert.equal(state.sidechatAlwaysOnTop, false, 'desconhecido não persiste');
  assert.equal(saved.length, countBefore, 'desconhecido não salva');
  await ipcHandlers['sidechat-always-on-top']({sender: win.webContents}, {on: true});
  assert.equal(child.isAlwaysOnTop(), true, 'principal liga o por cima');
  assert.equal(state.sidechatAlwaysOnTop, true);
  await ipcHandlers['sidechat-always-on-top']({sender: child.webContents}, {on: false});
  assert.equal(child.isAlwaysOnTop(), false, 'filha desliga o por cima');
  assert.equal(state.sidechatAlwaysOnTop, false);
});
