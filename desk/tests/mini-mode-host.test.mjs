// @ts-check
/* Modo mini no main (`mini-mode-host.cjs`): a geometria do canto (área de
   trabalho, várias telas), guardar e restaurar os limites do mini e da janela
   normal, "sempre por cima", fechar no mini e o canal `mini-mode`. Sem
   Electron: janela e telas de mentira (`fake-main-window.mjs`). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {FakeMainWindow, FakeScreenWithEvents} from './fake-main-window.mjs';
import {FakeScreen} from './fake-webcontents.mjs';
import {pollUntil} from './waits.mjs';

const require = createRequire(import.meta.url);
const host = require('../mini-mode-host.cjs');
const sanitize = require('../desk-state-sanitize.cjs');

const PRIMARY = {id: 1, bounds: {x: 0, y: 0, width: 1920, height: 1080}, workArea: {x: 0, y: 0, width: 1920, height: 1040}, internal: true};
const EXTERNAL = {id: 2, bounds: {x: 1920, y: 100, width: 2560, height: 1440}, workArea: {x: 1920, y: 100, width: 2560, height: 1400}, internal: false};
const LEFT = {id: 3, bounds: {x: -1280, y: 200, width: 1280, height: 1024}, workArea: {x: -1280, y: 224, width: 1280, height: 1000}, internal: false};
const NORMAL = {x: 50, y: 40, width: 1200, height: 800};

test('o canto: baixo à direita da área de trabalho, com folga, e o mini cabe na área pequena', () => {
  assert.deepEqual(host.cornerBounds(PRIMARY.workArea), {x: 1920 - 360 - 16, y: 1040 - 480 - 16, width: 360, height: 480}, 'tela 1920×1040 (barra de tarefas descontada)');
  assert.deepEqual(host.cornerBounds(EXTERNAL.workArea), {x: 1920 + 2560 - 360 - 16, y: 100 + 1400 - 480 - 16, width: 360, height: 480}, 'tela à direita, com origem deslocada');
  assert.deepEqual(host.cornerBounds(LEFT.workArea), {x: -1280 + 1280 - 360 - 16, y: 224 + 1000 - 480 - 16, width: 360, height: 480}, 'tela à esquerda, coordenada negativa');
  assert.deepEqual(host.cornerBounds({x: 0, y: 0, width: 300, height: 400}), {x: 0, y: 0, width: 300, height: 400}, 'área menor que o mini: encolhe e encosta, sem folga');
  assert.deepEqual(host.cornerBounds({x: 0, y: 25, width: 1280.5, height: 775.4}), {x: 905, y: 304, width: 360, height: 480}, 'área fracionária arredonda');
});

test('a tela da janela é a de maior sobreposição; fora de toda tela vale a primária', () => {
  const displays = [PRIMARY, EXTERNAL, LEFT];
  assert.deepEqual(host.pickWorkArea(displays, {x: 2000, y: 150, width: 900, height: 650}, PRIMARY), EXTERNAL.workArea);
  assert.deepEqual(host.pickWorkArea(displays, {x: 1700, y: 300, width: 900, height: 650}, PRIMARY), EXTERNAL.workArea, 'a maior parte está na externa');
  assert.deepEqual(host.pickWorkArea(displays, {x: 100, y: 100, width: 900, height: 650}, EXTERNAL), PRIMARY.workArea);
  assert.deepEqual(host.pickWorkArea(displays, {x: 9000, y: 9000, width: 900, height: 650}, PRIMARY), PRIMARY.workArea, 'fora de toda tela: a primária');
  assert.equal(host.pickWorkArea([], {x: 0, y: 0, width: 10, height: 10}, null), null, 'sem tela nenhuma');
});

test('onde o mini nasce: o salvo se ainda toca uma tela, senão o canto da tela da Mesa', () => {
  const displays = [PRIMARY, EXTERNAL];
  const first = host.resolveMiniBounds({displays, primary: PRIMARY, mainBounds: {x: 2000, y: 150, width: 900, height: 650}, saved: null});
  assert.deepEqual(first, host.cornerBounds(EXTERNAL.workArea), 'primeira vez: canto da tela onde a Mesa está');
  const saved = {x: 300, y: 200, width: 400, height: 520};
  assert.deepEqual(host.resolveMiniBounds({displays, primary: PRIMARY, mainBounds: {x: 2000, y: 150, width: 900, height: 650}, saved}), saved, 'o salvo vale mesmo com a Mesa em outra tela');
  const gone = host.resolveMiniBounds({displays: [PRIMARY], primary: PRIMARY, mainBounds: {x: 10, y: 10, width: 900, height: 650}, saved: {x: 2500, y: 300, width: 360, height: 480}});
  assert.deepEqual(gone, host.cornerBounds(PRIMARY.workArea), 'o monitor do salvo sumiu: canto da tela da Mesa');
  const partly = host.resolveMiniBounds({displays: [PRIMARY], primary: PRIMARY, mainBounds: NORMAL, saved: {x: 1800, y: 1000, width: 360, height: 480}});
  assert.deepEqual(partly, {x: 1560, y: 560, width: 360, height: 480}, 'saindo pela borda: puxado para dentro da área');
  const tiny = host.resolveMiniBounds({displays: [PRIMARY], primary: PRIMARY, mainBounds: NORMAL, saved: {x: 10, y: 10, width: 50, height: 50}});
  assert.deepEqual([tiny.width, tiny.height], [300, 360], 'tamanho salvo minúsculo sobe ao mínimo do mini');
  assert.deepEqual(host.resolveMiniBounds({displays: [], primary: null, mainBounds: NORMAL, saved: 'lixo'}), {width: 360, height: 480}, 'sem tela conhecida: só o tamanho');
});

/** Liga o host a uma janela e a um estado falsos. */
function setup({win = new FakeMainWindow({bounds: NORMAL}), displays = [PRIMARY], state = {}, trusted = () => true} = {}) {
  const screen = new FakeScreenWithEvents(displays, displays[0].id);
  const store = {...state};
  const saves = [];
  const handlers = {};
  const logs = [];
  const mini = host.registerMiniModeHost({
    win, screen, trusted, debounceMs: 20, settleMs: 200,
    ipcMain: {handle: (channel, fn) => { handlers[channel] = fn; }},
    loadState: () => ({...store}),
    saveState: (patch) => { Object.assign(store, patch); saves.push({...patch}); },
    log: (line) => logs.push(line),
  });
  return {win, screen, mini, store, saves, handlers, logs, call: (payload, event = {sender: win.webContents}) => handlers['mini-mode'](event, payload)};
}

test('entrar: 360×480 no canto, por cima, sem barra de menu; a janela normal fica guardada para o persist', async () => {
  const {win, mini, call, logs} = setup();
  assert.equal(mini.windowBounds(), null, 'desligado: o persist lê a janela mesma');
  const state = await call({on: true});
  assert.deepEqual(state, {on: true, alwaysOnTop: true}, 'por cima ligado por padrão');
  assert.deepEqual(win.getBounds(), {x: 1544, y: 544, width: 360, height: 480});
  assert.equal(win.isAlwaysOnTop(), true);
  assert.deepEqual(win.getMinimumSize(), [300, 360], 'o mínimo da Mesa (900×650) cai antes do setBounds');
  assert.equal(win.isMenuBarVisible(), false);
  assert.deepEqual(mini.windowBounds(), NORMAL, 'com o mini ligado, o que se grava em `bounds` é a janela normal');
  assert.ok(logs.some((line) => /ligado/.test(line)));
  assert.equal((await call({on: true})).on, true, 'ligar de novo não faz nada');
});

test('voltar: bounds, mínimo, por cima e menu de antes; o lugar do mini fica salvo', async () => {
  const {win, mini, call, store} = setup();
  await call({on: true});
  win.setBounds({x: 700, y: 300, width: 400, height: 520});
  const state = await call({on: false});
  assert.deepEqual(state, {on: false, alwaysOnTop: true});
  assert.deepEqual(win.getBounds(), NORMAL, 'volta ao tamanho e ao lugar de antes');
  assert.deepEqual(win.getMinimumSize(), [900, 650]);
  assert.equal(win.isAlwaysOnTop(), false, 'a janela normal não fica por cima');
  assert.equal(win.isMenuBarVisible(), true);
  assert.deepEqual(store.miniBounds, {x: 700, y: 300, width: 400, height: 520}, 'o mini guarda onde foi deixado');
  assert.equal(mini.windowBounds(), null);
  await call({on: true});
  assert.deepEqual(win.getBounds(), {x: 700, y: 300, width: 400, height: 520}, 'na próxima vez o mini volta ao lugar guardado');
});

test('sempre por cima: valia na janela viva e fica guardado para a próxima vez', async () => {
  const {win, call, store} = setup();
  await call({on: true});
  assert.deepEqual(await call({alwaysOnTop: false}), {on: true, alwaysOnTop: false});
  assert.equal(win.isAlwaysOnTop(), false, 'desliga na janela viva');
  assert.equal(store.miniAlwaysOnTop, false, 'e guarda a escolha');
  assert.deepEqual(await call({alwaysOnTop: true}), {on: true, alwaysOnTop: true});
  assert.equal(win.isAlwaysOnTop(), true);
  await call({alwaysOnTop: false});
  await call({on: false});
  await call({on: true});
  assert.equal(win.isAlwaysOnTop(), false, 'a escolha vale na entrada seguinte');
  assert.deepEqual(await call({}), {on: true, alwaysOnTop: false}, 'sem campos só lê o estado');
});

test('janela que estava por cima volta por cima; a normal fora do mini não é tocada pelo alfinete', async () => {
  const win = new FakeMainWindow({bounds: NORMAL, alwaysOnTop: true});
  const {call} = setup({win});
  await call({alwaysOnTop: false});
  assert.equal(win.isAlwaysOnTop(), true, 'fora do mini o alfinete só guarda a escolha');
  await call({on: true});
  assert.equal(win.isAlwaysOnTop(), false);
  await call({on: false});
  assert.equal(win.isAlwaysOnTop(), true, 'devolve o estado de antes');
});

test('maximizada: usa os limites normais, sai da maximização e volta a ela', async () => {
  const win = new FakeMainWindow({bounds: {x: 0, y: 0, width: 1920, height: 1040}, maximized: true});
  win._normal = NORMAL;
  const {mini, call} = setup({win});
  await call({on: true});
  assert.equal(win.isMaximized(), false, 'saiu da maximização antes de encolher');
  assert.deepEqual(mini.windowBounds(), NORMAL, 'a janela normal é a de antes de maximizar');
  assert.deepEqual([win.getBounds().width, win.getBounds().height], [360, 480]);
  await call({on: false});
  assert.equal(win.isMaximized(), true, 'volta maximizada');
  assert.deepEqual(win.getNormalBounds(), NORMAL, 'e o normal continua o mesmo');
});

test('tela cheia: sai dela para encolher e volta a ela', async () => {
  const win = new FakeMainWindow({bounds: {x: 0, y: 0, width: 1920, height: 1080}, fullScreen: true});
  win._normal = NORMAL;
  const {call} = setup({win});
  await call({on: true});
  assert.equal(win.isFullScreen(), false);
  assert.deepEqual([win.getBounds().width, win.getBounds().height], [360, 480]);
  await call({on: false});
  assert.equal(win.isFullScreen(), true, 'volta à tela cheia');
});

test('fechar no mini volta à Mesa antes: o persist grava a janela normal e o lugar do mini fica salvo', async () => {
  const {win, mini, call, store} = setup();
  await call({on: true});
  const miniBounds = win.getBounds();
  win.emit('close');
  assert.deepEqual(win.getBounds(), NORMAL, 'a janela já está normal quando o persist roda');
  assert.deepEqual(mini.windowBounds(), NORMAL, 'e o persist lê os limites normais, não os do mini');
  assert.deepEqual(store.miniBounds, miniBounds);
  assert.equal(mini.isOn(), false, 'o modo não é persistido: o Summa abre normal');
  assert.equal(win.isAlwaysOnTop(), false);
});

test('recarregar a página (o renderer perde o modo) devolve a janela à Mesa', async () => {
  const {win, mini, call} = setup();
  await call({on: true});
  win.webContents.emit('did-start-navigation', {}, 'file:///index.html', false, false);
  assert.equal(mini.isOn(), true, 'navegação de subframe não conta');
  win.webContents.emit('did-start-navigation', {}, 'file:///index.html', false, true);
  assert.equal(mini.isOn(), false);
  assert.deepEqual(win.getBounds(), NORMAL);
});

test('mover o mini guarda o lugar com debounce', async () => {
  const {win, call, saves} = setup();
  await call({on: true});
  saves.length = 0;
  win.setBounds({x: 100, y: 120, width: 380, height: 500});
  win.setBounds({x: 110, y: 130, width: 380, height: 500});
  await pollUntil(() => saves.find((patch) => patch.miniBounds), (patch) => !!patch, {timeout: 2000, interval: 10, what: 'o debounce gravar o lugar do mini'});
  assert.deepEqual(saves.filter((patch) => patch.miniBounds).map((patch) => patch.miniBounds), [{x: 110, y: 130, width: 380, height: 500}], 'um save só, com o último lugar');
});

test('monitor desconectado: o mini que ficou fora de toda tela volta ao canto da primária', async () => {
  const {win, screen, call} = setup({displays: [PRIMARY, EXTERNAL], win: new FakeMainWindow({bounds: {x: 2000, y: 150, width: 1200, height: 800}})});
  await call({on: true});
  assert.deepEqual(win.getBounds(), host.cornerBounds(EXTERNAL.workArea));
  screen.replaceDisplays([PRIMARY]);
  assert.deepEqual(win.getBounds(), host.cornerBounds(PRIMARY.workArea));
  const stay = win.getBounds();
  screen.replaceDisplays([PRIMARY], 'display-metrics-changed');
  assert.deepEqual(win.getBounds(), stay, 'mini já à vista: nada a resgatar');
});

test('o resgate da Mesa (900×650 no mínimo) pula a janela enquanto o mini está ligado', async () => {
  const {keepWindowOnDisplays} = require('../window-display-host.cjs');
  const win = new FakeMainWindow({bounds: {x: 9000, y: 9000, width: 360, height: 480}});
  const screen = new FakeScreenWithEvents([PRIMARY], 1);
  let skipping = true;
  const guard = keepWindowOnDisplays({screenLike: screen, window: win, skip: () => skipping});
  assert.equal(guard.reconcile(), null, 'com o mini ligado a janela fica como está');
  assert.deepEqual(win.getBounds(), {x: 9000, y: 9000, width: 360, height: 480}, 'nem mexeu');
  skipping = false;
  assert.ok(guard.reconcile(), 'sem o mini, o resgate de sempre');
});

test('o canal recusa remetente de fora e pedido malformado, com o valor recebido na mensagem', async () => {
  const {call} = setup({trusted: (event) => event.sender === 'confiavel'});
  await assert.rejects(() => call({on: true}, {sender: 'outro'}), /remetente não confiável/);
  for (const bad of [{on: 'sim'}, {alwaysOnTop: 1}, [true], 'ligar', null]) {
    await assert.rejects(() => call(bad, {sender: 'confiavel'}), (error) => /Modo mini inválido: esperado \{on\?: boolean, alwaysOnTop\?: boolean\}, recebido /.test(error.message) && error.message.includes(String(JSON.stringify(bad)).slice(0, 20)), `recusa ${JSON.stringify(bad)}`);
  }
});

test('janela sem limites válidos recusa entrar, com o valor na mensagem', async () => {
  const win = new FakeMainWindow({bounds: NORMAL});
  win.getBounds = () => ({x: 'a', y: 0, width: 0, height: 0});
  const {mini, call} = setup({win});
  await assert.rejects(() => call({on: true}), /a janela não tem limites válidos \(recebido \{"x":"a"/);
  assert.equal(mini.isOn(), false);
});

test('desk.json: miniBounds passa pela sanitização da Mesa e o por cima liga por padrão', () => {
  const good = sanitize.sanitizeState({miniBounds: {x: 10, y: 20, width: 360, height: 480}, miniAlwaysOnTop: false});
  assert.deepEqual(good.miniBounds, {x: 10, y: 20, width: 360, height: 480});
  assert.equal(good.miniAlwaysOnTop, false);
  const bad = sanitize.sanitizeState({miniBounds: {x: 'a', y: 0, width: 0, height: 480}, miniAlwaysOnTop: 'não'});
  assert.equal('miniBounds' in bad, false, 'limite inválido cai fora');
  assert.equal(bad.miniAlwaysOnTop, true, 'só `false` desliga');
  const absent = sanitize.sanitizeState({});
  assert.equal(absent.miniAlwaysOnTop, true, 'sem campo: por cima ligado');
  assert.equal('miniBounds' in absent, false);
});

test('tela única sem eventos (o `screen` mínimo) também serve', async () => {
  const screen = new FakeScreen([PRIMARY], 1);
  const win = new FakeMainWindow({bounds: NORMAL});
  const handlers = {};
  host.registerMiniModeHost({win, screen, ipcMain: {handle: (channel, fn) => { handlers[channel] = fn; }}});
  assert.deepEqual(await handlers['mini-mode']({}, {on: true}), {on: true, alwaysOnTop: true});
  assert.deepEqual(win.getBounds(), host.cornerBounds(PRIMARY.workArea));
});
