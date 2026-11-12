/* Índice da tinta dos cadernos (#158, passo 2): vigia de mtime com duas
   leituras, hash sha256 por página, só página mudada e com `<stroke>` vai
   ao modelo (via PNG + `readInk` falsos com nome), fila de um por vez com
   quota parando tudo, índice local 0600 com escrita atômica, poda de
   caderno removido e busca no texto da tinta com `origem: 'tinta'`.
   Desligado por padrão: nada lê, nada chama o modelo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import {promisify} from 'node:util';
import {createFakeInkClock, createFakeInkExporter, createFakeInkReader, createFakeInkTimers} from './fake-ink.mjs';
import {fakeFsTree} from './fake-fs-tree.mjs';
import {createCountingReadFile} from './fake-read-file.mjs';
import {exportPageImage} from '../src/extensions/mesa-mcp/notebook-tool.mjs';

const require = createRequire(import.meta.url);
const watch = require('../notebook-ink-watch.cjs');
const {createNotebookInkWatcher, registerNotebookInkHost, inkEnabled} = watch;
const {registerNotebooksHost} = require('../notebooks-host.cjs');
const {createNotebookSearch} = require('../notebooks-search-host.cjs');
const {pagesOfXml} = require('../src/notebook-xopp.mjs');
const {resolveTutorPdf} = require('../pdf-read-path.cjs');

/* Catálogo no formato de `opencode-catalog.cjs`: visão + pago para o
   modelo bravo; o grátis do Zen (custo zero) vira `free`. */
const VISION_CATALOG = [
  {provider: 'xai', id: 'grok-vision', name: 'Grok Visão', variants: [], input: ['text', 'image'], cost: {input: 1, output: 2}, contextWindow: 200000},
];
const SECOND_VISION_CATALOG = [
  {provider: 'xai', id: 'grok-vision', name: 'Grok Visão', variants: [], input: ['text', 'image'], cost: {input: 1, output: 2}, contextWindow: 200000},
  {provider: 'openai', id: 'gpt-vision', name: 'GPT Visão', variants: [], input: ['text', 'image'], cost: {input: 1, output: 3}, contextWindow: 200000},
];

/** sha256 hexadecimal de cada `<page>` (o mesmo hash do vigia). */
function pageHashesOf(xml) {
  return pagesOfXml(xml).map((page) => crypto.createHash('sha256').update(String(page), 'utf8').digest('hex'));
}
const FREE_CATALOG = [
  {provider: 'opencode', id: 'big-pickle', name: 'Big Pickle', variants: [], input: ['text', 'image'], cost: {input: 0, output: 0}, contextWindow: 200000},
];

/** Página só com tinta (traço), sem caixa de texto digitado. */
function pageInkOnly(salt = '') {
  return `<page width="589.00" height="845.00">\n<background type="solid" color="#ffffffff" style="lined"/>\n<layer>\n<stroke tool="pen" color="#000000" size="1.50" ts="1"><point x="100.00" y="100.00"/><point x="140.00" y="120.00"/></stroke>\n<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="60.00"></text>\n<layer-tmp>${salt}</layer-tmp>\n</layer>\n</page>`;
}

/** Página só com texto digitado, sem tinta. */
function pageTypedOnly(text) {
  return `<page width="589.00" height="845.00">\n<background type="solid" color="#ffffffff" style="lined"/>\n<layer>\n<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="100.00">${text}</text>\n</layer>\n</page>`;
}

function xmlOf(pages) {
  return `<?xml version="1.0" standalone="no"?>\n<xournal version="4">\n${pages.join('\n')}\n</xournal>\n`;
}

function writeXopp(dir, xml, name = 'aula.xopp') {
  const file = path.join(dir, name);
  fs.writeFileSync(file, zlib.gzipSync(xml));
  return file;
}

function bumpMtime(file) {
  const future = new Date(Date.now() + 5000);
  fs.utimesSync(file, future, future);
}

/** PDF mínimo com a magia `%PDF` que a autorização do tutor confere (#224). */
function writePdf(dir, name = 'fundo.pdf') {
  const file = path.join(dir, name);
  fs.writeFileSync(file, '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
  return file;
}

/** Página com tinta e fundo PDF absoluto (o índice só exporta página com `<stroke>`). */
function pageInkWithPdfBackground(pdf) {
  return `<page width="595.00" height="842.00">\n<background type="pdf" domain="absolute" filename="${pdf}" pageno="1"/>\n<layer>\n<stroke tool="pen" color="#000000" size="1.50" ts="1"><point x="100.00" y="100.00"/><point x="140.00" y="120.00"/></stroke>\n</layer>\n</page>`;
}

/** Autorização limitada como a do tutor (`resolveTutorPdf`); fora da lista, vazio (#224). */
function pdfAuthorizer(allowed) {
  return (file) => {
    try { return resolveTutorPdf(file, allowed); } catch { return ''; }
  };
}

/** Spawn falso que guarda a cópia higienizada que o índice mandaria ao Xournal++ (#224). */
function captureInkCopy() {
  let xml = '';
  const spawnProcess = (_binary, args, _options) => {
    xml = zlib.gunzipSync(fs.readFileSync(args[0])).toString('utf8');
    const child = {
      stderr: {on() {}},
      kill() {},
      on(event, callback) {
        if (event === 'close') queueMicrotask(() => callback(0));
        return child;
      },
    };
    const out = args[args.indexOf('--create-img') + 1];
    fs.writeFileSync(out, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    return child;
  };
  return {spawnProcess, copia: () => xml};
}

/** Vigia com a exportação de produção do `ler_caderno` sobre o spawn falso (#224). */
function setupInkDefaultExporter({listNotebooks, runtime, pdfAuthorize, capture}) {
  const timers = createFakeInkTimers();
  const reader = createFakeInkReader({text: 'tinta lida'});
  const watcher = createNotebookInkWatcher({
    listNotebooks,
    runtime,
    inkEnabled: () => true,
    selection: () => ({model: 'xai/grok-vision', effort: null}),
    catalog: () => VISION_CATALOG,
    createBridge: () => ({}),
    readInkImpl: reader.readInk,
    exportPageImageImpl: (args) => exportPageImage({...args, spawnProcess: capture.spawnProcess}),
    pdfAuthorize,
    xournalPath: 'xournalpp',
    setIntervalImpl: timers.setIntervalImpl,
    clearIntervalImpl: timers.clearIntervalImpl,
    log: () => {},
  });
  return {watcher, timers, reader};
}

/* Monta o vigia com fakes: timers injetados, exportador e leitor falsos. */
function setupInkWatcher({listNotebooks, runtime, inked = true, isInkEnabled, clock, selection, catalog, readerOptions, exporterOptions, stat: statImpl, gunzip: gunzipImpl, readIndexFile: readIndexImpl, readFile: readFileImpl, fsImpl} = {}) {
  const timers = createFakeInkTimers();
  const exporter = createFakeInkExporter(exporterOptions);
  const reader = createFakeInkReader(readerOptions);
  const watcher = createNotebookInkWatcher({
    listNotebooks,
    runtime,
    inkEnabled: isInkEnabled || (() => inked),
    selection: selection || (() => ({model: 'xai/grok-vision', effort: null})),
    catalog: catalog || (() => VISION_CATALOG),
    createBridge: () => ({}),
    readInkImpl: reader.readInk,
    exportInkPng: exporter.exportInkPng,
    nowMs: clock ? clock.nowMs : undefined,
    stat: statImpl,
    gunzip: gunzipImpl,
    readIndexFile: readIndexImpl,
    readFile: readFileImpl,
    fsImpl,
    setIntervalImpl: timers.setIntervalImpl,
    clearIntervalImpl: timers.clearIntervalImpl,
    log: () => {},
  });
  return {watcher, timers, exporter, reader};
}

/** Espera a fila do vigia terminar (o tick dispara async). */
async function settle(watcher) {
  await watcher.whenIdle();
}

test('desligado por padrão: inkEnabled() é false e nada roda', async () => {
  assert.equal(inkEnabled(), false);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-off-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-off-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly()]));
    let stats = 0;
    const timers = createFakeInkTimers();
    const exporter = createFakeInkExporter();
    const reader = createFakeInkReader();
    const watcher = createNotebookInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      inkEnabled: () => false,
      selection: () => ({model: 'xai/grok-vision', effort: null}),
      catalog: () => VISION_CATALOG,
      createBridge: () => ({}),
      readInkImpl: reader.readInk,
      exportInkPng: exporter.exportInkPng,
      stat: async (target) => {
        stats += 1;
        return fs.promises.stat(target);
      },
      setIntervalImpl: timers.setIntervalImpl,
      clearIntervalImpl: timers.clearIntervalImpl,
      log: () => {},
    });
    watcher.start();
    await timers.tick(3);
    assert.equal(stats, 0, 'desligado não faz stat de caderno nenhum');
    assert.equal(exporter.calls.length, 0, 'desligado não exporta PNG nenhum');
    assert.equal(reader.calls.length, 0, 'desligado não chama o modelo');
    assert.equal(watcher.inkIndexStatus().enabled, false);
    watcher.stop();
    assert.equal(timers.active(), 0, 'stop desarma o intervalo');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('mtime instável não dispara: muda entre ticks, nunca chega no modelo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-instavel-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-instavel-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly()]));
    let mtime = 1000;
    const timers = createFakeInkTimers();
    const exporter = createFakeInkExporter();
    const reader = createFakeInkReader();
    const watcher = createNotebookInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      inkEnabled: () => true,
      selection: () => ({model: 'xai/grok-vision', effort: null}),
      catalog: () => VISION_CATALOG,
      createBridge: () => ({}),
      readInkImpl: reader.readInk,
      exportInkPng: exporter.exportInkPng,
      stat: async (target) => {
        const real = await fs.promises.stat(target);
        mtime += 1000;
        return {mtimeMs: mtime, size: real.size, ctimeMs: real.ctimeMs};
      },
      setIntervalImpl: timers.setIntervalImpl,
      clearIntervalImpl: timers.clearIntervalImpl,
      log: () => {},
    });
    watcher.start();
    await timers.tick(4);
    await settle(watcher);
    assert.equal(exporter.calls.length, 0, 'mtime que não estabiliza não exporta PNG');
    assert.equal(reader.calls.length, 0, 'mtime que não estabiliza não chama o modelo');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('só página mudada e com tinta vai ao modelo; segunda passada zerada', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-fatia-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-fatia-rt-'));
  try {
    /* Página 1: só texto digitado (sem `<stroke>`); páginas 2 e 3: só tinta. */
    const file = writeXopp(dir, xmlOf([pageTypedOnly('porque inicial'), pageInkOnly(), pageInkOnly()]));
    const {watcher, timers, exporter, reader} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    assert.deepEqual(exporter.calls.map((call) => call.page), [2, 3], 'só as páginas com tinta vão ao exportador');
    assert.equal(reader.calls.length, 2, 'só as páginas com tinta vão ao modelo');
    assert.equal(watcher.inkIndexStatus().pagesRead, 2, 'contador acumulado de páginas lidas');
    assert.equal(watcher.inkIndexStatus().status, 'idle');

    /* Segunda passada, sem mudar o arquivo: zero chamadas novas. */
    await timers.tick(2);
    assert.equal(exporter.calls.length, 2, 'sem mudança não exporta de novo');
    assert.equal(reader.calls.length, 2, 'sem mudança não chama o modelo de novo');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('só a página que mudou vai ao modelo (hash por página)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-hash-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-hash-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly(), pageInkOnly('primeira')]));
    const {watcher, timers, exporter, reader} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    assert.deepEqual(exporter.calls.map((call) => call.page), [1, 2]);
    /* Muda só a página 2: a 1 volta com o mesmo hash e não vai de novo. */
    fs.writeFileSync(file, zlib.gzipSync(xmlOf([pageInkOnly(), pageInkOnly('segunda')])));
    bumpMtime(file);
    await timers.tick(2);
    await settle(watcher);
    assert.deepEqual(exporter.calls.map((call) => call.page), [1, 2, 2], 'só a página 2, que mudou, vai ao modelo');
    assert.equal(reader.calls.length, 3);
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('quota para a fila e vira estado, sem ler o resto', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-quota-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-quota-rt-'));
  try {
    const first = writeXopp(dir, xmlOf([pageInkOnly()]), 'um.xopp');
    const second = writeXopp(dir, xmlOf([pageInkOnly()]), 'dois.xopp');
    const {watcher, timers, exporter, reader} = setupInkWatcher({
      listNotebooks: () => [
        {courseId: 'calc', name: 'um.xopp', path: first},
        {courseId: 'calc', name: 'dois.xopp', path: second},
      ],
      runtime,
      readerOptions: {quota: true},
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    assert.equal(reader.calls.length, 1, 'o quota para a fila: só a primeira leitura é tentada');
    assert.equal(exporter.calls.length, 1, 'o segundo caderno nem chega no exportador');
    assert.equal(watcher.inkIndexStatus().status, 'quota');
    assert.equal(watcher.inkIndexStatus().pagesRead, 0, 'quota não conta página lida');
    /* Mesmo modelo, novos ticks: continua parado, sem retry. */
    await timers.tick(2);
    assert.equal(reader.calls.length, 1, 'quota grudou: sem retry com o mesmo modelo');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('modelo sem visão, grátis ou ausente tambémparam a fila e viram estado', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-d_block-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-no-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly()]));
    const cases = [
      {selection: () => ({model: 'xai/grok-inexistente', effort: null}), catalog: () => VISION_CATALOG, status: 'no-model'},
      {selection: () => ({model: 'xai/grok-vision', effort: null}), catalog: () => [{provider: 'xai', id: 'grok-vision', name: 'G', variants: [], input: ['text'], cost: {input: 1, output: 2}, contextWindow: 200000}], status: 'no-vision'},
      {selection: () => ({model: 'opencode/big-pickle', effort: null}), catalog: () => FREE_CATALOG, status: 'free'},
    ];
    for (const item of cases) {
      const {watcher, timers, exporter, reader} = setupInkWatcher({
        listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
        runtime,
        selection: item.selection,
        catalog: item.catalog,
      });
      watcher.start();
      await timers.tick(2);
      /* A carga do índice é assíncrona: o `whenIdle` espera o tick acabar. */
      await settle(watcher);
      assert.equal(watcher.inkIndexStatus().status, item.status, `estado vira ${item.status}`);
      assert.equal(reader.calls.length, 0, `${item.status} não chama o modelo`);
      assert.equal(exporter.calls.length, 0, `${item.status} não exporta PNG`);
      watcher.stop();
    }
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('índice com modo 0600, escrita assíncrona atômica (tmp + rename) e pasta 0700', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-modo-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-modo-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly()]));
    const writes = [];
    const renames = [];
    const timers = createFakeInkTimers();
    const exporter = createFakeInkExporter();
    const reader = createFakeInkReader({texts: ['integral da tinta']});
    const watcher = createNotebookInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      inkEnabled: () => true,
      selection: () => ({model: 'xai/grok-vision', effort: null}),
      catalog: () => VISION_CATALOG,
      createBridge: () => ({}),
      readInkImpl: reader.readInk,
      exportInkPng: exporter.exportInkPng,
      fsImpl: {
        ...fs,
        promises: {
          ...fs.promises,
          mkdir: (...args) => {
            writes.push({mkdir: String(args[0])});
            return fs.promises.mkdir(...args);
          },
          writeFile: (...args) => {
            writes.push(args[0]);
            return fs.promises.writeFile(...args);
          },
          rename: (...args) => {
            renames.push(args);
            return fs.promises.rename(...args);
          },
        },
      },
      setIntervalImpl: timers.setIntervalImpl,
      clearIntervalImpl: timers.clearIntervalImpl,
      log: () => {},
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    const inkDir = path.join(runtime, 'notebook-ink');
    const indexFile = path.join(inkDir, 'index.json');
    assert.ok(fs.existsSync(indexFile), 'o índice nasce no runtime da Mesa');
    if (process.platform !== 'win32') {
      const dirMode = fs.statSync(inkDir).mode & 0o777;
      assert.equal(dirMode, 0o700, `a pasta do índice abre 0700 (veio ${dirMode.toString(8)})`);
      const mode = fs.statSync(indexFile).mode & 0o777;
      assert.equal(mode, 0o600, `o índice abre 0600 (veio ${mode.toString(8)})`);
    }
    assert.ok(renames.length >= 1, 'a escrita é atômica (tmp + rename)');
    assert.ok(writes.some((target) => String(target).endsWith('.tmp-0') || String(target).includes('.tmp-')), `o tmp é escrito antes do rename (veio ${JSON.stringify(writes)})`);
    assert.equal(fs.readdirSync(inkDir).filter((entry) => entry.includes('.tmp-')).length, 0, 'nenhum tmp sobra');
    const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    assert.deepEqual(index.files[file].texts, ['integral da tinta']);
    assert.equal(index.files[file].hashes.length, 1);
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('busca acha termo só presente na tinta, com origem tinta e mesmo trecho', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-busca-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-busca-rt-'));
  try {
    /* Página 1: só tinta (o texto digitado não tem o termo); página 2: texto
       digitado com o mesmo termo — o digitado vem antes. */
    const file = writeXopp(dir, xmlOf([pageInkOnly(), pageTypedOnly('Equação do primeiro grau')]));
    const {watcher, timers} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file, materia: 'Cálculo'}],
      runtime,
      readerOptions: {texts: ['Equação manuscrita da tinta', 'limites']},
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    watcher.stop();
    const search = createNotebookSearch({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file, materia: 'Cálculo'}],
      inkTexts: watcher.inkTextsFor,
    });
    const both = await search.searchNotebooks('EQUACAO');
    assert.equal(both.length, 2, 'acha nas duas origens');
    assert.equal(both[0].origem, 'texto', 'o texto digitado vem antes');
    assert.equal(both[1].origem, 'tinta');
    assert.equal(both[1].pagina, 1);
    assert.match(both[1].trecho, /Equação manuscrita/, 'mesma normalização e mesmo recorte da tinta');
    assert.equal(both[1].caminho, file);
    const onlyInk = await search.searchNotebooks('manuscrita');
    assert.equal(onlyInk.length, 1, 'termo só na tinta também é achado');
    assert.equal(onlyInk[0].origem, 'tinta');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('caderno removido da biblioteca sai do índice', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-poda-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-poda-rt-'));
  try {
    const kept = writeXopp(dir, xmlOf([pageInkOnly()]), 'fica.xopp');
    const gone = writeXopp(dir, xmlOf([pageInkOnly()]), 'sai.xopp');
    let library = [
      {courseId: 'calc', name: 'fica.xopp', path: kept},
      {courseId: 'calc', name: 'sai.xopp', path: gone},
    ];
    const {watcher, timers} = setupInkWatcher({
      listNotebooks: () => library,
      runtime,
      readerOptions: {texts: ['texto fica', 'texto sai']},
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    const indexFile = path.join(runtime, 'notebook-ink', 'index.json');
    assert.ok(fs.existsSync(indexFile));
    assert.ok(gone in JSON.parse(fs.readFileSync(indexFile, 'utf8')).files, 'o caderno aparece antes');
    library = [{courseId: 'calc', name: 'fica.xopp', path: kept}];
    await timers.tick(2);
    await settle(watcher);
    const after = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    assert.ok(!(gone in after.files), 'saiu da biblioteca, saiu do índice');
    assert.ok(kept in after.files, 'o que ficou continua no índice');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('IPC notebooks-ink-status devolve estado e contador', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-ipc-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-ipc-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly()]));
    const handlers = new Map();
    const ipcMain = {
      handle: (channel, fn) => handlers.set(channel, fn),
      invoke: (channel, payload) => handlers.get(channel)({}, payload),
    };
    const timers = createFakeInkTimers();
    const watcher = registerNotebookInkHost({
      ipcMain,
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      inkEnabled: () => true,
      selection: () => ({model: 'xai/grok-vision', effort: null}),
      catalog: () => VISION_CATALOG,
      createBridge: () => ({}),
      readInkImpl: createFakeInkReader().readInk,
      exportInkPng: createFakeInkExporter().exportInkPng,
      setIntervalImpl: timers.setIntervalImpl,
      clearIntervalImpl: timers.clearIntervalImpl,
    });
    assert.ok(handlers.has('notebooks-ink-status'), 'registra o canal de estado');
    const status = await ipcMain.invoke('notebooks-ink-status');
    assert.deepEqual(Object.keys(status).sort(), ['enabled', 'pagesRead', 'status']);
    assert.equal(status.enabled, true);
    assert.equal(status.pagesRead, 0);
    assert.ok(['idle', 'reading'].includes(status.status));
    await timers.tick(2);
    await settle(watcher);
    const after = await ipcMain.invoke('notebooks-ink-status');
    assert.equal(after.pagesRead, 1, 'o contador sobe no estado do IPC');
    /* O preload expõe a leitura do estado. */
    const preload = fs.readFileSync(new URL('../preload.cjs', import.meta.url), 'utf8');
    assert.match(preload, /notebooksInkStatus/);
    assert.match(preload, /notebooks-ink-status/);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('M2: falha transitória no meio não marca concluído: espera cresce e tenta o resto sem re-ler a pronta', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m2-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m2-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly(), pageInkOnly('segunda'), pageInkOnly('terceira'), pageInkOnly('quarta'), pageInkOnly('quinta')]));
    const clock = createFakeInkClock();
    const {watcher, timers, exporter, reader} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      clock,
      readerOptions: {throwOnCalls: [2], texts: ['primeira', 'segunda', 'terceira', 'quarta']},
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    assert.deepEqual(exporter.calls.map((call) => call.page), [1, 2], 'a 2ª página falha: para no meio');
    assert.equal(watcher.inkTextsFor(file)[0], 'primeira', 'a página já lida fica salva');
    /* Sem avançar o relógio, o tick não tenta de novo: espera crescente,
       sem laço a cada 3 s. */
    await timers.tick(2);
    assert.deepEqual(exporter.calls.map((call) => call.page), [1, 2], 'antes da espera, nada é tentado de novo');
    clock.advance(31000);
    await timers.tick(2);
    await settle(watcher);
    assert.deepEqual(exporter.calls.map((call) => call.page), [1, 2, 2, 3, 4, 5], 'depois da espera, 2..5 são lidas sem nova edição; a 1ª não volta');
    assert.equal(reader.calls.length, 6, 'a página 1 não foi re-lida');
    assert.equal(watcher.inkTextsFor(file)[0], 'primeira');
    assert.equal(watcher.inkTextsFor(file)[1], 'segunda');
    assert.equal(watcher.inkIndexStatus().status, 'idle');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('M2: parada de quota no meio não marca concluído: com modelo novo, o resto tenta sem re-ler a pronta', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m2q-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m2q-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly(), pageInkOnly('segunda'), pageInkOnly('terceira'), pageInkOnly('quarta'), pageInkOnly('quinta')]));
    let modelo = 'xai/grok-vision';
    const clock = createFakeInkClock();
    const {watcher, timers, exporter, reader} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      clock,
      selection: () => ({model: modelo, effort: null}),
      catalog: () => SECOND_VISION_CATALOG,
      readerOptions: {quotaOnCalls: [2]},
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    assert.equal(watcher.inkIndexStatus().status, 'quota');
    assert.deepEqual(exporter.calls.map((call) => call.page), [1, 2]);
    /* Mesmo modelo: continua parado, sem retry. */
    await timers.tick(2);
    assert.deepEqual(exporter.calls.map((call) => call.page), [1, 2], 'quota grudou: sem retry com o mesmo modelo');
    /* Modelo novo: no próximo tick o resto tenta, a página pronta não volta. */
    modelo = 'openai/gpt-vision';
    await timers.tick(2);
    await settle(watcher);
    assert.deepEqual(exporter.calls.map((call) => call.page), [1, 2, 2, 3, 4, 5], 'com modelo novo, 2..5 são lidas sem nova edição');
    assert.equal(reader.calls.length, 6, 'a página 1 não foi re-lida');
    assert.equal(watcher.inkIndexStatus().status, 'idle');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('M3: com a opção desligada nada toca o disco: sem leitura e sem escrita do índice', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3off-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3off-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly()]));
    let syncReads = 0;
    let asyncReads = 0;
    let ligado = false;
    const timers = createFakeInkTimers();
    const exporter = createFakeInkExporter();
    const reader = createFakeInkReader();
    const watcher = createNotebookInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      inkEnabled: () => ligado,
      selection: () => ({model: 'xai/grok-vision', effort: null}),
      catalog: () => VISION_CATALOG,
      createBridge: () => ({}),
      readInkImpl: reader.readInk,
      exportInkPng: exporter.exportInkPng,
      readIndexFile: async (target) => {
        asyncReads += 1;
        return fs.promises.readFile(target);
      },
      fsImpl: {
        ...fs,
        readFileSync: (...args) => {
          syncReads += 1;
          return fs.readFileSync(...args);
        },
      },
      setIntervalImpl: timers.setIntervalImpl,
      clearIntervalImpl: timers.clearIntervalImpl,
      log: () => {},
    });
    /* O índice antigo já existe em disco com um texto plantado. */
    const inkDir = path.join(runtime, 'notebook-ink');
    fs.mkdirSync(inkDir, {recursive: true});
    fs.writeFileSync(path.join(inkDir, 'index.json'), JSON.stringify({version: 1, files: {[file]: {hashes: [], texts: ['plantado']}}}));
    watcher.start();
    await timers.tick(3);
    assert.equal(syncReads, 0, 'desligado não lê o índice de forma síncrona');
    assert.equal(asyncReads, 0, 'desligado não lê o índice de forma assíncrona');
    assert.equal(watcher.inkTextsFor(file), null, 'desligado não carrega o índice na busca');
    /* Ligando pela primeira vez, o índice fica; o texto plantado não pode
       ser honrado sem hash correspondente: a página é lida de novo. */
    ligado = true;
    watcher.setEnabled();
    await timers.tick(2);
    await settle(watcher);
    assert.ok(asyncReads >= 1, 'ligando carrega o índice uma vez');
    assert.equal(reader.calls.length, 1, 'o índice carregado não pula a leitura sem hash');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('M3: índice adulterado (JSON inválido) não derruba e não entra na busca', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3json-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3json-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly()]));
    const inkDir = path.join(runtime, 'notebook-ink');
    fs.mkdirSync(inkDir, {recursive: true});
    fs.writeFileSync(path.join(inkDir, 'index.json'), '{isto não é JSON');
    const {watcher, timers, reader} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    assert.equal(reader.calls.length, 1, 'o índice inválido nasce vazio: a página é lida de novo');
    assert.deepEqual(watcher.inkTextsFor(file), ['texto particular da tinta']);
    const index = JSON.parse(fs.readFileSync(path.join(inkDir, 'index.json'), 'utf8'));
    assert.equal(index.files[file].texts[0], 'texto particular da tinta', 'o índice é reescrito válido');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('M3: índice com tipos errados não derruba; texto gigante é truncado no limite', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3tipos-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3tipos-rt-'));
  try {
    const xml = xmlOf([pageInkOnly()]);
    const file = writeXopp(dir, xml);
    const inkDir = path.join(runtime, 'notebook-ink');
    fs.mkdirSync(inkDir, {recursive: true});
    fs.writeFileSync(path.join(inkDir, 'index.json'), JSON.stringify({
      version: 1,
      files: {
        [file]: {
          hashes: [42, null, pageHashesOf(xml)[0]],
          texts: [42, 'x'.repeat(50000)],
          mtimeMs: 'ontem',
          size: {},
        },
        fora: 'nada',
      },
    }));
    const {watcher, timers, reader} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    assert.equal(reader.calls.length, 1, 'hash errado não dispensa a leitura');
    assert.equal(watcher.inkTextsFor(file)[0], 'texto particular da tinta');
    assert.equal(watcher.inkTextsFor('fora'), null, 'chave com tipo errado não entra na busca');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('M3: texto gigante já gravado no índice é truncado no limite ao carregar', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3corte-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3corte-rt-'));
  try {
    const xml = xmlOf([pageInkOnly()]);
    const file = writeXopp(dir, xml);
    const inkDir = path.join(runtime, 'notebook-ink');
    fs.mkdirSync(inkDir, {recursive: true});
    fs.writeFileSync(path.join(inkDir, 'index.json'), JSON.stringify({
      version: 1,
      files: {[file]: {hashes: pageHashesOf(xml), texts: ['x'.repeat(50000)]}},
    }));
    const {watcher, timers, reader} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    assert.equal(reader.calls.length, 0, 'hash correspondente: nada volta ao modelo');
    assert.equal(watcher.inkTextsFor(file)[0].length, 20000, 'o texto é truncado no NOTEBOOK_TEXT_LIMIT');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('M3: índice acima do teto (8 MB) começa vazio, é lido de novo e reescrito pequeno', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3teto-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3teto-rt-'));
  try {
    const xml = xmlOf([pageInkOnly()]);
    const file = writeXopp(dir, xml);
    const inkDir = path.join(runtime, 'notebook-ink');
    fs.mkdirSync(inkDir, {recursive: true});
    const planted = JSON.stringify({
      version: 1,
      files: {[file]: {hashes: pageHashesOf(xml), texts: ['A'.repeat(50000)]}, resto: 'x'.repeat(8 * 1024 * 1024)},
    });
    assert.ok(Buffer.byteLength(planted) > 8 * 1024 * 1024, 'o índice plantado passa do teto');
    fs.writeFileSync(path.join(inkDir, 'index.json'), planted);
    const {watcher, timers, reader} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    assert.equal(reader.calls.length, 1, 'acima do teto o índice é descartado: a página é lida de novo');
    const rewritten = fs.readFileSync(path.join(inkDir, 'index.json'), 'utf8');
    assert.ok(Buffer.byteLength(rewritten) < 8 * 1024 * 1024, 'o índice é reescrito pequeno');
    assert.equal(JSON.parse(rewritten).files[file].texts[0], 'texto particular da tinta');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('M3: chave de caminho fora da biblioteca não entra na busca', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3fora-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3fora-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly()]));
    const outside = path.join(dir, 'fora-da-biblioteca.xopp');
    const inkDir = path.join(runtime, 'notebook-ink');
    fs.mkdirSync(inkDir, {recursive: true});
    fs.writeFileSync(path.join(inkDir, 'index.json'), JSON.stringify({
      version: 1,
      files: {[file]: {hashes: [], texts: []}, [outside]: {hashes: ['abc'], texts: ['termo segredo da tinta']}},
    }));
    const {watcher, timers} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
    });
    watcher.start();
    assert.equal(watcher.inkTextsFor(outside), null, 'antes do primeiro tick, a chave fora da biblioteca não responde');
    await timers.tick(2);
    await settle(watcher);
    assert.equal(watcher.inkTextsFor(outside), null, 'depois do tick, continua podada');
    const index = JSON.parse(fs.readFileSync(path.join(inkDir, 'index.json'), 'utf8'));
    assert.ok(!(outside in index.files), 'sai do índice em disco');
    const search = createNotebookSearch({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      inkTexts: watcher.inkTextsFor,
    });
    assert.equal((await search.searchNotebooks('segredo')).length, 0, 'a busca não acha termo da chave podada');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('B1: com a opção desligada o timer não arma; setEnabled arma e desarma', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-b1-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-b1-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly()]));
    let ligado = false;
    const {watcher, timers, exporter, reader} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      isInkEnabled: () => ligado,
    });
    watcher.start();
    assert.equal(timers.active(), 0, 'desligado: o timer não fica armado');
    await timers.tick(2);
    assert.equal(exporter.calls.length, 0, 'desligado: nada exporta');
    ligado = true;
    watcher.setEnabled();
    assert.equal(timers.active(), 1, 'ligando arma o timer');
    await timers.tick(2);
    await settle(watcher);
    assert.equal(reader.calls.length, 1, 'ligado: a página é lida');
    ligado = false;
    watcher.setEnabled();
    assert.equal(timers.active(), 0, 'desligando desarma o timer');
    await timers.tick(2);
    assert.equal(reader.calls.length, 1, 'desligado de novo: nada volta ao modelo');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('B1: stop() aborta a leitura em voo e o caderno não fica concluído', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-b1stop-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-b1stop-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly('primeira'), pageInkOnly('segunda')]));
    const clock = createFakeInkClock();
    const {watcher, timers, exporter, reader} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      clock,
      readerOptions: {delayMs: 2000, delayOnCalls: [1], texts: ['primeira', 'segunda']},
    });
    watcher.start();
    await timers.tick(2);
    /* Pumba o loop até a primeira leitura de fato entrar em voo (a carga do
       índice e o `stat` são assíncronos de verdade). */
    const deadline = Date.now() + 5000;
    while (reader.calls.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(reader.calls.length, 1, 'a primeira leitura está em voo');
    assert.equal(exporter.calls[0].signal instanceof AbortSignal, true, 'o vigia passa o sinal para o exportador');
    watcher.stop();
    await settle(watcher);
    assert.equal(reader.aborted, 1, 'o stop aborta a leitura em voo');
    assert.equal(timers.active(), 0, 'o stop desarma o timer');
    assert.equal(watcher.inkIndexStatus().pagesRead, 0, 'nada foi contado como lido');
    /* Ao retomar, a mesma página é tentada sem esperar backoff de falha. */
    watcher.setEnabled();
    assert.equal(timers.active(), 1);
    await timers.tick(2);
    await settle(watcher);
    assert.deepEqual(exporter.calls.map((call) => call.page), [1, 1, 2], 'a página abortada é tentada de novo');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('B1: o host registra stop() no before-quit quando recebe o app', async () => {
  const fakeFs = fakeFsTree({'/vault/Cursos': {'aula.xopp': 1000}});
  const handlers = new Map();
  const appHandlers = new Map();
  const fakeApp = {
    on: (event, fn) => appHandlers.set(event, fn),
  };
  registerNotebooksHost({
    ipcMain: {handle: (channel, fn) => handlers.set(channel, fn)},
    courses: () => [{id: 'calc', name: 'Cálculo', path: '/vault/Cursos'}],
    allowedXopp: new Set(),
    config: () => ({}),
    shell: {},
    fs: fakeFs,
    spawn: () => {
      throw Error('não abre processo');
    },
    platform: 'linux',
    app: fakeApp,
  });
  assert.ok(appHandlers.has('before-quit'), 'registra o stop no before-quit do app');
  appHandlers.get('before-quit')();
});

test('B2: reinício da Mesa não relê nem descomprime caderno gravado no índice', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-b2-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-b2-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly(), pageInkOnly('segunda')]));
    const first = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
    });
    first.watcher.start();
    await first.timers.tick(2);
    await settle(first.watcher);
    assert.equal(first.reader.calls.length, 2);
    first.watcher.stop();
    const before = JSON.parse(fs.readFileSync(path.join(runtime, 'notebook-ink', 'index.json'), 'utf8'));
    assert.equal(typeof before.files[file].mtimeMs, 'number', 'o índice guarda o mtime concluído');
    assert.equal(typeof before.files[file].size, 'number', 'o índice guarda o tamanho concluído');
    /* "Reinicia": novo vigia sobre o mesmo runtime; nada mudou no arquivo. */
    let gunzips = 0;
    const second = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      gunzip: async (...args) => {
        gunzips += 1;
        return promisify(zlib.gunzip)(...args);
      },
    });
    second.watcher.start();
    await second.timers.tick(3);
    await settle(second.watcher);
    assert.equal(second.exporter.calls.length, 0, 'sem mudança, nada volta ao exportador');
    assert.equal(second.reader.calls.length, 0, 'sem mudança, nada volta ao modelo');
    assert.equal(gunzips, 0, 'sem mudança, nem descomprime');
    assert.deepEqual(second.watcher.inkTextsFor(file), first.watcher.inkTextsFor(file), 'o texto gravado sobrevive ao reinício');
    second.watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('M1: stop() durante a 2ª página não grava o índice no disco', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m1-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m1-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly('primeira'), pageInkOnly('segunda')]));
    const {watcher, timers, reader} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      readerOptions: {delayMs: 2000, delayOnCalls: [2], texts: ['primeira', 'segunda']},
    });
    const indexFile = path.join(runtime, 'notebook-ink', 'index.json');
    assert.ok(!fs.existsSync(indexFile), 'pré-condição: ainda não gravou');
    watcher.start();
    await timers.tick(2);
    const deadline = Date.now() + 5000;
    while (reader.calls.length < 2 && Date.now() < deadline) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(reader.calls.length, 2, 'a 2ª leitura está em voo');
    watcher.stop();
    await settle(watcher);
    assert.ok(!fs.existsSync(indexFile), 'depois de stop(), nenhuma gravação do índice');
    assert.equal(watcher.inkIndexStatus().pagesRead, 1, 'só a 1ª página lida ficou em memória');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('M1: com a opção desligada, inkTextsFor não serve a tinta em memória', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m1off-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m1off-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly()]));
    let ligado = true;
    const {watcher, timers} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      isInkEnabled: () => ligado,
      readerOptions: {texts: ['transcrição da tinta']},
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    assert.deepEqual(watcher.inkTextsFor(file), ['transcrição da tinta'], 'ligado serve a tinta');
    ligado = false;
    watcher.setEnabled();
    assert.equal(watcher.inkTextsFor(file), null, 'desligado não serve a tinta em memória');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('M3: teto de 4 chamadas ao modelo por tick (global entre cadernos); o resto fica para o próximo tick', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3-rt-'));
  try {
    const pages = Array.from({length: 10}, (_, at) => pageInkOnly(`p${at}`));
    const file = writeXopp(dir, xmlOf(pages));
    const {watcher, timers, exporter, reader} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    assert.equal(reader.calls.length, 4, 'o 1º tick lê no máximo 4 páginas');
    assert.equal(exporter.calls.length, 4);
    assert.equal(watcher.inkTextsFor(file).length, 4, 'o registro cresce página a página');
    await timers.tick(1);
    await settle(watcher);
    assert.equal(reader.calls.length, 8, 'o 2º tick lê as próximas 4');
    await timers.tick(1);
    await settle(watcher);
    assert.equal(reader.calls.length, 10, 'o 3º tick termina o caderno de 10 páginas');
    assert.equal(watcher.inkIndexStatus().pagesRead, 10);
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('M3: teto de 4 chamadas ao modelo por tick vale entre cadernos (3 × 6 páginas)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3global-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3global-rt-'));
  try {
    const files = [0, 1, 2].map((n) => writeXopp(dir, xmlOf(Array.from({length: 6}, (_, at) => pageInkOnly(`${n}-${at}`))), `caderno-${n}.xopp`));
    const {watcher, timers, exporter, reader} = setupInkWatcher({
      listNotebooks: () => files.map((file, n) => ({courseId: 'calc', name: `caderno-${n}.xopp`, path: file})),
      runtime,
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    assert.equal(reader.calls.length, 4, 'o 1º tick com 3 cadernos gasta no máximo 4 chamadas no total');
    assert.equal(exporter.calls.length, 4);
    const ticks = [4];
    for (let round = 0; round < 4; round += 1) {
      await timers.tick(1);
      await settle(watcher);
      ticks.push(reader.calls.length);
    }
    assert.deepEqual(ticks, [4, 8, 12, 16, 18], 'cada tick seguinte gasta no máximo 4, e os 3 cadernos terminam');
    assert.equal(watcher.inkIndexStatus().pagesRead, 18);
    assert.equal(new Set(exporter.calls.map((call) => call.file)).size, 3, 'os três cadernos foram lidos');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('F5: .xopp acima do teto de 32 MB é recusado pelo stat, sem ler o arquivo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-f5-'));
  try {
    const file = path.join(dir, 'grande.xopp');
    const handle = fs.openSync(file, 'w');
    fs.ftruncateSync(handle, 40 * 1024 * 1024);
    fs.closeSync(handle);
    const counter = createCountingReadFile((target, ...args) => fs.promises.readFile(target, ...args));
    const {watcher, timers, reader} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'grande.xopp', path: file}],
      readFile: counter.readFile,
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    assert.equal(counter.calls.length, 0, 'o tamanho é conferido antes do readFile');
    assert.equal(counter.bytesRead(), 0);
    assert.equal(reader.calls.length, 0, 'arquivo acima do teto não vai ao modelo');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('M4: página com falha permanente não bloqueia as seguintes; edição nova tenta de novo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m4-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m4-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly('primeira'), pageInkOnly('segunda')]));
    const clock = createFakeInkClock();
    const {watcher, timers, exporter, reader} = setupInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      clock,
      readerOptions: {throwOnCalls: [1, 2, 3], texts: ['segunda', 'nova-primeira']},
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    assert.deepEqual(exporter.calls.map((call) => call.page), [1], '1ª tentativa da página 1 falha e para');
    clock.advance(31000);
    await timers.tick(1);
    await settle(watcher);
    assert.deepEqual(exporter.calls.map((call) => call.page), [1, 1], '2ª tentativa da página 1 falha e para');
    clock.advance(120000);
    await timers.tick(1);
    await settle(watcher);
    assert.deepEqual(exporter.calls.map((call) => call.page), [1, 1, 1, 2], 'na 3ª falha, a página 1 é pulada e a 2 segue');
    assert.equal(reader.calls.length, 4);
    assert.deepEqual(watcher.inkTextsFor(file), ['', 'segunda'], 'página pulada guarda hash com texto vazio');
    /* Nova edição da página pulada (hash novo) tenta de novo. */
    fs.writeFileSync(file, zlib.gzipSync(xmlOf([pageInkOnly('nova'), pageInkOnly('segunda')])));
    bumpMtime(file);
    await timers.tick(2);
    await settle(watcher);
    assert.deepEqual(exporter.calls.map((call) => call.page), [1, 1, 1, 2, 1], 'hash novo volta ao modelo');
    assert.deepEqual(watcher.inkTextsFor(file), ['nova-primeira', 'segunda']);
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('G1: status de modelo é transitório e volta a idle quando o catálogo chega', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-g1-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-g1-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly()]));
    let catalog = [];
    const timers = createFakeInkTimers();
    const exporter = createFakeInkExporter();
    const reader = createFakeInkReader();
    const watcher = createNotebookInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      inkEnabled: () => true,
      selection: () => ({model: 'xai/grok-vision', effort: null}),
      catalog: () => catalog,
      createBridge: () => ({}),
      readInkImpl: reader.readInk,
      exportInkPng: exporter.exportInkPng,
      setIntervalImpl: timers.setIntervalImpl,
      clearIntervalImpl: timers.clearIntervalImpl,
      log: () => {},
    });
    watcher.start();
    await watcher.pollOnce();
    assert.equal(watcher.inkIndexStatus().status, 'no-model', 'catálogo vazio vira no-model');
    catalog = VISION_CATALOG;
    await watcher.pollOnce();
    assert.notEqual(watcher.inkIndexStatus().status, 'no-model', 'o pick válido tira o status de no-model');
    assert.ok(['idle', 'reading'].includes(watcher.inkIndexStatus().status));
    await watcher.pollOnce();
    await settle(watcher);
    assert.equal(watcher.inkIndexStatus().status, 'idle', 'depois da leitura, o status é idle');
    assert.equal(reader.calls.length, 1);
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('M3: o modelo verificado no pick vai para a ponte mesmo se a seleção mudar no export', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-m3-rt-'));
  try {
    const file = writeXopp(dir, xmlOf([pageInkOnly()]));
    const PAID = {provider: 'xai', id: 'grok-vision', name: 'Grok', variants: ['high'], input: ['text', 'image'], cost: {input: 1, output: 1}};
    const FREE = {provider: 'opencode', id: 'zen-free', name: 'Zen', variants: [], input: ['text', 'image'], cost: {input: 0, output: 0}};
    let selection = {model: 'xai/grok-vision', effort: 'high'};
    const bridgeSelections = [];
    const timers = createFakeInkTimers();
    let releaseExport;
    const exportGate = new Promise((resolve) => { releaseExport = resolve; });
    let exportStarted = false;
    const watcher = createNotebookInkWatcher({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      inkEnabled: () => true,
      selection: () => selection,
      catalog: () => [PAID, FREE],
      createBridge: (picked) => { bridgeSelections.push(picked); return {}; },
      readInkImpl: createFakeInkReader({text: 'lido'}).readInk,
      exportInkPng: async () => { exportStarted = true; await exportGate; return Buffer.from('png'); },
      setIntervalImpl: timers.setIntervalImpl,
      clearIntervalImpl: timers.clearIntervalImpl,
      log: () => {},
    });
    watcher.start();
    await watcher.pollOnce();
    const reading = watcher.pollOnce();
    /* Barreira por estado: com 20 ms fixos a suíte carregada trocava a seleção
       antes do pick. O export só começa depois do pick. */
    for (let tries = 0; !exportStarted && tries < 300; tries++) await new Promise((resolve) => setTimeout(resolve, 10)); /* espera fixa: passo do laço até o export entrar em voo, teto de 3 s */
    assert.equal(exportStarted, true, 'o export da página entrou em voo (pick já feito)');
    selection = {model: 'opencode/zen-free', effort: null};
    releaseExport();
    await reading;
    await watcher.whenIdle();
    assert.deepEqual(bridgeSelections, [{model: 'xai/grok-vision', effort: 'high'}],
      'a ponte recebe o modelo pago verificado no pick, nunca o grátis da seleção viva');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

/* --- #224: o índice da tinta volta a ter o fundo PDF autorizado --- */

test('#224: com PDF autorizado, a página do índice sai com o fundo do PDF', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-224-ok-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-224-ok-rt-'));
  try {
    const pdf = writePdf(dir);
    const file = writeXopp(dir, xmlOf([pageInkWithPdfBackground(pdf)]));
    const capture = captureInkCopy();
    const {watcher, timers, reader} = setupInkDefaultExporter({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      pdfAuthorize: pdfAuthorizer([pdf]),
      capture,
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    const copia = capture.copia();
    assert.equal(reader.calls.length, 1, 'a página com tinta foi ao modelo');
    assert.match(copia, /<background type="pdf"/, `a cópia mantém o fundo PDF (cópia: ${copia.slice(0, 300)})`);
    assert.ok(copia.includes(fs.realpathSync.native(pdf)), 'o fundo aponta para o PDF autorizado');
    assert.doesNotMatch(copia, /type="solid"/, 'o fundo não vira branco');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('#224: PDF fora da autorização continua sem fundo no índice', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-224-neg-'));
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-224-neg-rt-'));
  try {
    const pdf = writePdf(dir);
    const file = writeXopp(dir, xmlOf([pageInkWithPdfBackground(pdf)]));
    const capture = captureInkCopy();
    const {watcher, timers} = setupInkDefaultExporter({
      listNotebooks: () => [{courseId: 'calc', name: 'aula.xopp', path: file}],
      runtime,
      pdfAuthorize: pdfAuthorizer([]),
      capture,
    });
    watcher.start();
    await timers.tick(2);
    await settle(watcher);
    const copia = capture.copia();
    assert.match(copia, /type="solid"/, 'o PDF não autorizado vira fundo sólido');
    assert.ok(!copia.includes(fs.realpathSync.native(pdf)), 'a cópia não leva o caminho do PDF não autorizado');
    watcher.stop();
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});
