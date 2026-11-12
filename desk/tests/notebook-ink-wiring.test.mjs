/* Fiação da tinta dos cadernos (#158, #159): o módulo novo que liga o vigia e
   a ponte ao main e ao interruptor. Desligado por padrão: vigia não lê e
   ponte não sobe. Ligado: setEnabled e ponte sobe. IPC valida tipo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

test('IPC notebooks-ink-set valida tipo e liga/desliga vigia e ponte', async () => {
  const wiring = require('../notebook-ink-wiring.cjs');
  assert.ok(typeof wiring.registerNotebookInkWiring === 'function', 'exporta registerNotebookInkWiring');
  const handlers = new Map();
  const ipcMain = {handle: (channel, fn) => handlers.set(channel, fn), removeHandler: (channel) => handlers.delete(channel), invoke: (channel, payload) => handlers.get(channel)({}, payload)};
  const state = {};
  let persisted = 0;
  const watcherCalls = [];
  const bridgeCalls = [];
  const watcher = {setEnabled: () => watcherCalls.push('set'), inkIndexStatus: () => ({status: 'idle', pagesRead: 0, enabled: !!state.inkReading}), inkTextsFor: () => null, stop: () => {}};
  const inkHost = {start: async () => {bridgeCalls.push('start'); return {port: 1, token: 't'};}, close: async () => {bridgeCalls.push('close');}};
  // Injeta hosts falsos com nome via deps da fiação.
  const notebooks = wiring.registerNotebookInkWiring({
    ipcMain,
    courses: () => [],
    allowedXopp: new Set(),
    config: () => ({}),
    shell: {openPath: async () => ''},
    spawn: () => ({unref: () => {}, on: () => {}}),
    platform: 'linux',
    app: {on: () => {}},
    runtime: '/tmp/fake-runtime', // nunca lido: os hosts são falsos
    state: () => state,
    patchState: (patch) => {Object.assign(state, patch);},
    persist: () => {persisted++;},
    // Hosts falsos: o teste conta setEnabled/start/close sem Electron nem rede.
    registerNotebooksHostImpl: () => ({...watcher, startInkConvert: inkHost.start, stopInkConvert: inkHost.close}),
    selection: () => ({model: 'xai/grok-vision', effort: null}),
    catalog: () => [{provider: 'xai', id: 'grok-vision', name: 'G', variants: [], input: ['text', 'image'], cost: {input: 1, output: 1}}],
    createBridge: () => ({}),
  });
  assert.ok(notebooks, 'devolve o host');
  assert.ok(handlers.has('notebooks-ink-set'), 'registra notebooks-ink-set');
  assert.ok(handlers.has('notebooks-ink-status'), 'registra notebooks-ink-status');
  assert.equal((await ipcMain.invoke('notebooks-ink-status')).enabled, false, 'o status do painel começa desligado');
  // Tipo inválido recusa sem tocar no estado nem na ponte.
  await assert.rejects(() => ipcMain.invoke('notebooks-ink-set', {on: 'yes'}), /on.*boolean/i);
  await assert.rejects(() => ipcMain.invoke('notebooks-ink-set', {on: 1}), /on.*boolean/i);
  await assert.rejects(() => ipcMain.invoke('notebooks-ink-set', null), /on.*boolean|objeto/i);
  assert.equal(watcherCalls.length, 0, 'tipo inválido não chama setEnabled');
  assert.equal(bridgeCalls.length, 0, 'tipo inválido não toca na ponte');
  assert.equal(state.inkReading, undefined, 'tipo inválido não grava estado');
  // Desligado: vigia não lê e ponte não sobe.
  await ipcMain.invoke('notebooks-ink-set', {on: false});
  assert.equal(state.inkReading, false, 'grava inkReading false no estado');
  assert.ok(persisted > 0, 'persiste no desk.json');
  assert.deepEqual(watcherCalls, ['set'], 'desligado chama setEnabled');
  assert.deepEqual(bridgeCalls, ['close'], 'desligado fecha a ponte');
  // Ligado: vigia setEnabled e ponte sobe.
  watcherCalls.length = 0; bridgeCalls.length = 0;
  await ipcMain.invoke('notebooks-ink-set', {on: true});
  assert.equal(state.inkReading, true, 'grava inkReading true');
  assert.deepEqual(watcherCalls, ['set'], 'ligado chama setEnabled');
  assert.deepEqual(bridgeCalls, ['start'], 'ligado sobe a ponte');
  // Preload expõe os dois canais.
  const preload = fs.readFileSync(new URL('../preload.cjs', import.meta.url), 'utf8');
  assert.match(preload, /notebooksInkSet/);
  assert.match(preload, /notebooks-ink-set/);
  assert.match(preload, /notebooksInkStatus/);
});
