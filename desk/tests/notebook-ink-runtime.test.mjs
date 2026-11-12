/* Runtime do índice da tinta (#158/F2): o vigia tem de gravar em
   `runtime/notebook-ink/` mesmo quando o `config.json` não tem `runtimePath`.
   A fiação recebe o runtime resolvido do main e o repassa ao host; a segunda
   partida sobre o mesmo runtime não chama o modelo de novo para páginas já
   lidas. Fakes com nome: leitor/exportador de `fake-ink.mjs` e um host
   gravador para provar a passagem do runtime. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import {createFakeInkExporter, createFakeInkReader} from './fake-ink.mjs';

const require = createRequire(import.meta.url);
const {registerNotebooksHost} = require('../notebooks-host.cjs');
const {registerNotebookInkWiring} = require('../notebook-ink-wiring.cjs');

const VISION_CATALOG = [
  {provider: 'xai', id: 'grok-vision', name: 'Grok Visão', variants: [], input: ['text', 'image'], cost: {input: 1, output: 2}, contextWindow: 200000},
];

function xmlComTinta() {
  return '<?xml version="1.0"?><xournal version="4"><page width="589" height="845"><layer><stroke tool="pen" color="#000000" size="1.5"><point x="1" y="1"/></stroke></layer></page></xournal>';
}

function writeXopp(dir) {
  const file = path.join(dir, 'aula.xopp');
  fs.writeFileSync(file, zlib.gzipSync(xmlComTinta()));
  return file;
}

/** Host gravador com nome: guarda as deps recebidas da fiação. */
function createNotebooksHostRecorder() {
  const calls = [];
  function registerNotebooksHostImpl(deps) {
    calls.push(deps);
    return {
      setEnabled: () => {},
      stop: () => {},
      pollOnce: async () => {},
      whenIdle: async () => {},
      startInkConvert: async () => ({port: 1, token: 't'}),
      stopInkConvert: async () => {},
      inkIndexStatus: () => ({status: 'idle', pagesRead: 0, enabled: false}),
      inkTextsFor: () => null,
    };
  }
  return {registerNotebooksHostImpl, calls};
}

function createHost({runtime, course, reader, exporter}) {
  const handlers = new Map();
  const ipcMain = {handle: (channel, fn) => handlers.set(channel, fn), removeHandler: (channel) => handlers.delete(channel)};
  const notebooks = registerNotebooksHost({
    ipcMain,
    courses: () => [{id: 'calc', name: 'Cálculo', path: course}],
    allowedXopp: new Set(),
    config: () => ({}),
    shell: {openPath: async () => ''},
    platform: 'linux',
    runtime,
    inkEnabled: () => true,
    selection: () => ({model: 'xai/grok-vision', effort: null}),
    catalog: () => VISION_CATALOG,
    createBridge: () => ({}),
    readInkImpl: reader.readInk,
    exportInkPng: exporter.exportInkPng,
  });
  return {notebooks, handlers};
}

test('F2: a fiação entrega o runtime resolvido do main ao host dos cadernos', async () => {
  const recorder = createNotebooksHostRecorder();
  registerNotebookInkWiring({
    ipcMain: {handle: () => {}, removeHandler: () => {}},
    courses: () => [],
    allowedXopp: new Set(),
    config: () => ({}),
    shell: {openPath: async () => ''},
    app: {on: () => {}},
    runtime: '/runtime/do/main',
    state: () => ({inkReading: false}),
    registerNotebooksHostImpl: recorder.registerNotebooksHostImpl,
  });
  assert.equal(recorder.calls.length, 1, 'o registro do host aconteceu');
  assert.equal(recorder.calls[0].runtime, '/runtime/do/main', 'o runtime do main chega ao vigia');
});

test('F2: config sem runtimePath grava o índice no runtime injetado e a 2ª partida não relê', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-runtime-'));
  const course = path.join(base, 'Curso');
  const runtime = path.join(base, 'runtime');
  fs.mkdirSync(course, {recursive: true});
  try {
    const file = writeXopp(course);
    const firstReader = createFakeInkReader({text: 'tinta da primeira partida'});
    const first = createHost({runtime, course, reader: firstReader, exporter: createFakeInkExporter()});
    await first.handlers.get('notebooks-list')({});
    await first.notebooks.pollOnce();
    await first.notebooks.whenIdle();
    await first.notebooks.pollOnce();
    await first.notebooks.whenIdle();
    assert.equal(firstReader.calls.length, 1, 'a 1ª partida lê a página com tinta');
    const indexFile = path.join(runtime, 'notebook-ink', 'index.json');
    assert.ok(fs.existsSync(indexFile), 'o índice é gravado no runtime real, mesmo sem config.runtimePath');
    first.notebooks.stop();

    const secondReader = createFakeInkReader({text: 'não devia ler'});
    const second = createHost({runtime, course, reader: secondReader, exporter: createFakeInkExporter()});
    await second.handlers.get('notebooks-list')({});
    await second.notebooks.pollOnce();
    await second.notebooks.whenIdle();
    await second.notebooks.pollOnce();
    await second.notebooks.whenIdle();
    assert.equal(secondReader.calls.length, 0, 'a 2ª partida não chama o modelo para páginas já lidas');
    assert.deepEqual(second.notebooks.inkTextsFor(file), ['tinta da primeira partida'], 'o texto gravado sobrevive à partida');
    second.notebooks.stop();
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});
