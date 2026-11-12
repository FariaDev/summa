/* Partida da leitura da tinta com o opt-in salvo (#158, revisão): o catálogo
   do modelo precisa ser buscado fora do caminho síncrono da partida, o status
   de modelo é transitório, o motor Claude fica no estado honesto (nada sobe) e
   ligar sem modelo válido/ponte quebrada devolve falha em vez de gravar
   `inkReading: true`. Usa a fiação REAL (vigia + ponte) com catálogo, leitor,
   exportador e renderizador falsos com nome. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {registerNotebookInkWiring} = require('../notebook-ink-wiring.cjs');
const {createFakeInkReader} = require('./fake-ink.mjs');
const {createFakeInkRenderer} = require('./fake-ink-renderer.cjs');

const PAID = {provider: 'xai', id: 'grok-vision', name: 'Grok Visão', variants: ['high'], input: ['text', 'image'], cost: {input: 1, output: 2}};
const FREE = {provider: 'opencode', id: 'zen-free', name: 'Zen', variants: [], input: ['text', 'image'], cost: {input: 0, output: 0}};
const VALID_SVG = fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'mesa-pagina-ink.svg'), 'utf8').trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Espera uma condição virar verdadeira; o polling é do helper, não do alvo. */
async function waitFor(check, what, timeout = 3000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() >= deadline) throw Error(`esperava ${what} em ${timeout} ms`);
    await sleep(20);
  }
}

function tempDir(t, tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `mesa-ink-boot-${tag}-`));
  t.after(() => { try { fs.rmSync(dir, {recursive: true, force: true}); } catch { /* já apagado */ } });
  return dir;
}

/** Matéria com um `.xopp` de uma página com tinta. */
function seedCourse(t) {
  const dir = tempDir(t, 'course');
  const xml = '<?xml version="1.0"?><xournal version="4"><page width="100" height="100"><layer><stroke tool="pen"><point x="1" y="1"/></stroke></layer></page></xournal>';
  const file = path.join(dir, 'aula.xopp');
  fs.writeFileSync(file, zlib.gzipSync(xml));
  return {dir, file};
}

function fakeIpc() {
  const handlers = new Map();
  return {handlers, handle: (channel, fn) => handlers.set(channel, fn), removeHandler: (channel) => handlers.delete(channel), invoke: (channel, payload) => handlers.get(channel)({}, payload)};
}

function postConvert(bridgeFile) {
  const {port, token} = JSON.parse(fs.readFileSync(bridgeFile, 'utf8'));
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({svg: VALID_SVG});
    const req = http.request({host: '127.0.0.1', port, method: 'POST', path: '/converter', headers: {'content-type': 'application/json', 'x-mesa-token': token, 'content-length': Buffer.byteLength(body)}}, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({status: res.statusCode, body: JSON.parse(data)}));
    });
    req.on('error', reject);
    req.end(body);
  });
}

/** Fiação real com fakes nomeados; `onExit` para parar vigia/ponte no teste. */
function boot(t, {state, engine = () => 'opencode', catalog, selection, reader, renderer, inkCatalog, registerHostImpl, createBridge, courses}) {
  const runtime = tempDir(t, 'runtime');
  const course = seedCourse(t);
  const ipcMain = fakeIpc();
  const logs = [];
  const deps = {
    ipcMain,
    courses: courses || (() => [{id: 'c', name: 'C', path: course.dir}]),
    allowedXopp: new Set(),
    config: () => ({runtimePath: runtime}),
    shell: {openPath: async () => ''},
    app: {on: () => {}},
    runtime,
    state: () => state,
    patchState: (patch) => Object.assign(state, patch),
    persist: () => {},
    session: () => '',
    openCodeTutor: {inkCatalog: inkCatalog || (async () => catalog || [])},
    engine,
    selection: selection || (() => ({model: 'xai/grok-vision', effort: 'high'})),
    renderSvg: (renderer || createFakeInkRenderer()).render,
    readInkImpl: (reader || createFakeInkReader({text: 'texto lido'})).readInk,
    exportInkPng: async () => Buffer.from('png'),
    log: (line) => logs.push(String(line)),
  };
  if (catalog !== undefined) deps.catalog = () => catalog;
  if (registerHostImpl) deps.registerNotebooksHostImpl = registerHostImpl;
  deps.createBridge = createBridge || (() => ({}));
  const notebooks = registerNotebookInkWiring(deps);
  t.after(async () => {
    notebooks.stop();
    await notebooks.stopInkConvert().catch(() => {});
  });
  return {notebooks, ipcMain, runtime, logs, bridgeFile: path.join(runtime, 'ink-convert-bridge.json'), course};
}

test('boot com inkReading:true busca o catálogo sozinho e o status sai de no-model', async (t) => {
  const state = {inkReading: true};
  let catalogCalls = 0;
  let releaseCatalog;
  const gate = new Promise((resolve) => { releaseCatalog = resolve; });
  const reader = createFakeInkReader({text: 'texto lido'});
  const {notebooks, ipcMain, logs} = boot(t, {
    state,
    reader,
    inkCatalog: async () => {
      catalogCalls += 1;
      await gate;
      return [PAID];
    },
  });

  assert.equal(catalogCalls, 0, 'a partida síncrona não lê o catálogo');
  await waitFor(() => catalogCalls > 0, 'a leitura do catálogo agendada no boot');
  await notebooks.pollOnce();
  assert.equal(notebooks.inkIndexStatus().status, 'no-model', 'antes do catálogo, o estado é honesto');

  releaseCatalog();
  await waitFor(() => notebooks.inkIndexStatus().status !== 'no-model', 'o status voltar a idle/reading sozinho');
  await notebooks.pollOnce();
  await notebooks.pollOnce();
  await notebooks.whenIdle();

  const panel = await ipcMain.invoke('notebooks-ink-status');
  assert.notEqual(panel.status, 'no-model', 'o painel não mostra "sem modelo" depois que o catálogo chegou');
  assert.ok(['idle', 'reading'].includes(panel.status), `status do painel: ${panel.status}`);
  assert.ok(reader.calls.length > 0, `o vigia lê a página com o modelo pago verificado; logs: ${JSON.stringify(logs)}`);
  assert.equal(notebooks.inkIndexStatus().pagesRead > 0, true, 'o contador acompanha a leitura');
});

test('painel com a leitura desligada não lê o catálogo nem sobe a ponte (B7)', async (t) => {
  const state = {};
  let catalogCalls = 0;
  const {ipcMain, bridgeFile} = boot(t, {
    state,
    inkCatalog: async () => { catalogCalls += 1; return [PAID]; },
  });
  const status = await ipcMain.invoke('notebooks-ink-status');
  assert.equal(catalogCalls, 0, 'desligado, o status não pode subir o motor do catálogo');
  assert.equal(status.enabled, false);
  assert.equal(status.status, 'idle', 'desligado, o status é idle (o interruptor fica habilitado para ligar)');
  assert.equal(fs.existsSync(bridgeFile), false, 'desligado, nenhum arquivo de ponte nasce');
});

test('motor Claude: estado honesto, sem catálogo do OpenCode e sem ponte (M2)', async (t) => {
  const state = {inkReading: true};
  let catalogCalls = 0;
  const reader = createFakeInkReader({text: 'não devia ler'});
  const {notebooks, ipcMain, bridgeFile} = boot(t, {
    state,
    engine: () => 'claude',
    reader,
    inkCatalog: async () => { catalogCalls += 1; return [PAID]; },
  });
  const status = await ipcMain.invoke('notebooks-ink-status');
  assert.equal(catalogCalls, 0, 'com Claude, o catálogo do OpenCode nunca é chamado');
  assert.equal(status.status, 'claude-unavailable');
  assert.equal(status.enabled, true, 'o opt-in salvo continua ligado para o aluno poder desligar');
  assert.equal(fs.existsSync(bridgeFile), false, 'com Claude, a ponte não sobe');
  await notebooks.pollOnce();
  await notebooks.whenIdle();
  assert.equal(reader.calls.length, 0, 'com Claude, nada é lido');
  assert.equal(notebooks.inkIndexStatus().pagesRead, 0);

  const off = await ipcMain.invoke('notebooks-ink-set', {on: false});
  assert.deepEqual(off, {ok: true});
  assert.equal(state.inkReading, false);
  const refused = await ipcMain.invoke('notebooks-ink-set', {on: true});
  assert.deepEqual(refused, {ok: false, reason: 'claude-unavailable'});
  assert.equal(state.inkReading, false, 'com Claude, ligar não grava inkReading:true');
  assert.equal(fs.existsSync(bridgeFile), false);
});

test('ligar sem modelo pago com visão não grava inkReading:true (B6d)', async (t) => {
  const state = {};
  const textOnly = {provider: 'xai', id: 'grok-text', name: 'Grok Texto', variants: [], input: ['text'], cost: {input: 1, output: 2}};
  const {ipcMain, bridgeFile} = boot(t, {
    state,
    catalog: [textOnly],
    selection: () => ({model: 'xai/grok-text', effort: null}),
  });
  const result = await ipcMain.invoke('notebooks-ink-set', {on: true});
  assert.deepEqual(result, {ok: false, reason: 'no-vision'});
  assert.notEqual(state.inkReading, true, 'o opt-in não é gravado sem modelo válido');
  assert.equal(fs.existsSync(bridgeFile), false, 'sem modelo válido, a ponte não sobe');
});

test('ligar com modelo grátis não grava inkReading:true (B6d)', async (t) => {
  const state = {};
  const {ipcMain} = boot(t, {
    state,
    catalog: [FREE],
    selection: () => ({model: 'opencode/zen-free', effort: null}),
  });
  const result = await ipcMain.invoke('notebooks-ink-set', {on: true});
  assert.deepEqual(result, {ok: false, reason: 'free'});
  assert.notEqual(state.inkReading, true);
});

test('notebooks-ink-set devolve falha real de start e de stop (B6c)', async (t) => {
  const baseWatcher = () => ({setEnabled: () => {}, inkIndexStatus: () => ({status: 'idle', pagesRead: 0, enabled: false}), inkTextsFor: () => null, stop: () => {}});

  const startState = {};
  const start = boot(t, {
    state: startState,
    catalog: [PAID],
    registerHostImpl: () => ({...baseWatcher(), startInkConvert: async () => ({port: 0, token: ''}), stopInkConvert: async () => {}}),
  });
  const failedStart = await start.ipcMain.invoke('notebooks-ink-set', {on: true});
  assert.deepEqual(failedStart, {ok: false, reason: 'start'}, 'falha de start volta como {ok:false, reason}');
  assert.notEqual(startState.inkReading, true, 'start falho desfaz o opt-in');

  const stopState = {};
  const stop = boot(t, {
    state: stopState,
    catalog: [PAID],
    registerHostImpl: () => ({...baseWatcher(), startInkConvert: async () => ({port: 1, token: 't'}), stopInkConvert: async () => { throw Error('porta presa'); }}),
  });
  assert.deepEqual(await stop.ipcMain.invoke('notebooks-ink-set', {on: true}), {ok: true});
  const failedStop = await stop.ipcMain.invoke('notebooks-ink-set', {on: false});
  assert.deepEqual(failedStop, {ok: false, reason: 'stop'}, 'falha de stop volta como {ok:false, reason}');
  assert.equal(stopState.inkReading, false);
});

test('convert usa o modelo verificado no pick, não a seleção viva (M3)', async (t) => {
  const state = {inkReading: true};
  let selection = {model: 'xai/grok-vision', effort: 'high'};
  const bridgeSelections = [];
  const renderer = createFakeInkRenderer({delayMs: 120});
  const reader = createFakeInkReader({text: 'convertido'});
  const {bridgeFile} = boot(t, {
    state,
    courses: () => [],
    catalog: [PAID, FREE],
    selection: () => selection,
    renderer,
    reader,
    createBridge: (picked) => { bridgeSelections.push(picked); return {}; },
  });
  await waitFor(() => fs.existsSync(bridgeFile), 'a ponte da tinta subir');
  const pending = postConvert(bridgeFile);
  /* Barreira por estado, não por tempo: o render só começa depois do pick, e
     a troca da seleção tem de cair entre os dois (com `sleep(30)` a suíte
     carregada trocava antes do pick e a ponte respondia `free`). */
  await waitFor(() => renderer.calls.length === 1, 'o render começar (pick já feito)');
  selection = {model: 'opencode/zen-free', effort: null};
  const converted = await pending;
  assert.equal(converted.status, 200);
  assert.equal(converted.body.text, 'convertido');
  assert.equal(reader.calls.length, 1, 'a leitura acontece uma vez');
  assert.deepEqual(bridgeSelections, [{model: 'xai/grok-vision', effort: 'high'}],
    'a ponte recebe o modelo pago verificado no pick, nunca o grátis da seleção viva');
});
