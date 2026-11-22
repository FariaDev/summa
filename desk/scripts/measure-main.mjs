/* Synthetic 60-minute study session: one launch, one saved draft change per
 * minute, 20 tutor turns, 4 PDF opens, 8 three-page text requests, 4 rendered
 * pages, and 2 phone/2 Ambitus submissions. Frequencies are assumptions, not
 * telemetry; weighted tails are ranking scores, not a session percentile.
 * Run from desk/ (omit xvfb-run on desktops with a display):
 *   xvfb-run -a node scripts/measure-main.mjs [all|startup|paths] [samples]
 * No real vault, runtime, phone, notebook or model is used. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {measureSize} from './measure-conversation-write.mjs';
import {DESK, launchDesk, syntheticFigurePng, writeConfigJson} from '../tests/helpers.mjs';
import {closeApp} from '../tests/proc-tree.mjs';
import {multiPagePdf} from '../tests/synthetic-pdf.mjs';
import {createFakeOpencodeServe} from '../tests/fake-opencode.mjs';
import {pdfTool} from '../src/extensions/summa-mcp/pdf-tool.mjs';

const require = createRequire(import.meta.url);
const {OpenCodeAdapter} = require('../src/agents/opencode-adapter.cjs');
const {createPhoneHost} = require('../phone-host.cjs');
const {createAmbitusBridgeHost} = require('../ambitus-bridge-host.cjs');
const {createFakeInkReader} = require('../tests/fake-ink-reader.cjs');

const [mode = 'all', count = '100'] = process.argv.slice(2);
const runs = Number(count);
assert(['all', 'startup', 'paths'].includes(mode) && Number.isInteger(runs) && runs > 0 && runs <= 100,
  'expected [all|startup|paths] and an integer sample count from 1 to 100');
const root = fs.mkdtempSync(path.join(os.homedir(), '.measure-main-'));
const pages = 320;

async function samples(operation, count = runs, warmup = 4) {
  const values = [];
  for (let i = -warmup; i < count; i++) {
    const started = performance.now();
    await operation(i);
    if (i >= 0) values.push(performance.now() - started);
  }
  return values;
}

function courseRuntime() {
  const runtime = fs.mkdtempSync(path.join(root, 'run-'));
  const course = path.join(runtime, 'course');
  fs.mkdirSync(course);
  writeConfigJson(runtime, {courses: [{id: 'study', name: 'Study', path: course}]});
  return runtime;
}

async function startDesk(runtime) {
  return launchDesk({runtime, env: {LEARNING_DESK_VISIBLE_ENGINES: 'opencode', LEARNING_DESK_COMPILE_CACHE: '1'}});
}

async function waitForStudy(app) {
  const page = await app.firstWindow();
  await page.waitForFunction(() => document.querySelector('#course-tabs button[data-id="study"]'), null, {polling: 5, timeout: 10_000});
  return page;
}

async function startup() {
  const runtime = courseRuntime();
  const values = [];
  for (let i = -2; i < runs; i++) {
    const started = performance.now();
    const app = await startDesk(runtime);
    try {
      await waitForStudy(app);
      if (i >= 0) values.push(performance.now() - started);
    } finally {
      await closeApp(app, {ledgerDir: runtime});
    }
  }
  return values;
}

async function pdfAndState(add) {
  const runtime = courseRuntime();
  const file = path.join(runtime, 'course', 'study.pdf');
  const line = 'Integrals and differential equations: compare the two solutions step by step. ';
  fs.writeFileSync(file, multiPagePdf(pages, (page) => `Page ${page}. ${line.repeat(30)}`));
  const app = await startDesk(runtime);
  try {
    const page = await waitForStudy(app);
    const pdf = await app.evaluate(async ({BrowserWindow, ipcMain}, {desk, file, runs}) => {
      const path = process.getBuiltinModule('node:path');
      const fs = process.getBuiltinModule('node:fs');
      const req = process.getBuiltinModule('node:module').createRequire(path.join(desk, 'main.cjs'));
      const {createPdfPageRenderer} = req('./pdf-page-render.cjs');
      const {createPdfPageReader} = req('./pdf-page-text.cjs');
      const {resolveTutorPdf} = req('./pdf-read-path.cjs');
      const {createActivityBridge} = req('./activity-bridge.cjs');
      const {registerPdfHost} = req('./pdf-host.cjs');
      const fixtureHandlers = new Map();
      const cached = new Map();
      const allowed = new Set([file]);
      const validPdf = (requested) => {
        if (!allowed.has(requested)) throw Error('unexpected benchmark PDF');
        return requested;
      };
      registerPdfHost({ipcMain: {handle: (channel, callback) => fixtureHandlers.set(channel, callback)}, pdfDisk: cached, validPdf});
      const renderer = createPdfPageRenderer({ipcMain, html: path.join(desk, 'pdf-render.html'), createWindow: () => new BrowserWindow({
        show: false, width: 900, height: 1200, skipTaskbar: true, focusable: false, paintWhenInitiallyHidden: true,
        webPreferences: {preload: path.join(desk, 'pdf-render-preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false},
      })});
      const reader = createPdfPageReader({renderPage: renderer.render});
      const bridge = createActivityBridge({publish: () => { throw Error('unexpected publish'); },
        pdfPage: ({path: raw, first, last, imagem}) => reader.read({file: resolveTutorPdf(raw, allowed), first, last, imagem})});
      await bridge.start();
      const read = fixtureHandlers.get('read-pdf');
      const readerOpen = [], render = [];
      try {
        for (let i = -4; i < runs; i++) {
          cached.clear();
          const started = performance.now();
          const bytes = read(null, file);
          if (i >= 0) readerOpen.push(performance.now() - started);
          if (bytes.length !== fs.statSync(file).size) throw Error('incomplete PDF read');
        }
        for (let i = -4; i < runs; i++) {
          const started = performance.now();
          const png = await renderer.render({file, page: i + 5});
          if (i >= 0) render.push(performance.now() - started);
          if (!png.startsWith('iVBORw0KGgo')) throw Error('missing rendered PNG');
        }
        return {readerOpen, render, grant: bridge.grant({conversationId: 'benchmark', generation: 1}, {engine: 'opencode'})};
      } finally {
        renderer.close();
      }
    }, {desk: DESK, file, runs});
    add('Reader open: read-pdf handler, warm OS cache', 4, pdf.readerOpen);
    add('Tutor PDF: render 1 page to PNG (warm window/document)', 4, pdf.render);
    const tool = pdfTool({grant: pdf.grant});
    add('mesa-mcp ler_pdf: 3 pages of text + HTTP/tool formatting', 8, await samples(async (i) => {
      const first = 1 + (i + 4) * 3;
      const result = await tool.call({caminho: file, pagina: first, ate: first + 2, imagem: 'nao'});
      assert(!result.isError, result.content?.[0]?.text);
      assert.match(result.content[0].text, /Integrals and differential equations/);
    }));
    add('save-state IPC: changing a draft + desk.json write', 60, await samples(async (i) => {
      await page.evaluate((n) => window.desk.save({draft: `Bench draft ${n}: ${'A study question. '.repeat(25)}`}), i);
    }));
    assert.match(fs.readFileSync(path.join(runtime, 'desk.json'), 'utf8'), /Bench draft/);
  } finally {
    await closeApp(app, {ledgerDir: runtime});
  }
}

async function opencode(add) {
  const serve = await createFakeOpencodeServe({turnDelayMs: 0});
  const adapter = new OpenCodeAdapter({conversationId: 'bench', sessionId: '', directory: root,
    acquire: async () => ({baseUrl: serve.url, password: '', binary: '/fake/opencode'}),
    mcpConfig: () => ({type: 'local', command: ['node', 'summa-mcp.mjs']}),
    systemPrompt: 'Tutor da Mesa', persistDelivery: () => {}, readVersion: async () => 'opencode v2.2.4'});
  try {
    await adapter.connect();
    add('OpenCode HTTP/SSE: prompt → synthetic short answer end', 20, await samples(async (i) => {
      const turn = Promise.withResolvers();
      const listener = (event) => { if (event.type === 'turn_end') turn.resolve(event); };
      adapter.on('event', listener);
      try {
        await adapter.send({id: `turn-${i}`, text: 'Explain the integral in the exercise.'});
        const timer = setTimeout(() => turn.reject(Error('no synthetic SSE turn end')), 5000);
        try { assert(!(await turn.promise).cancelled); } finally { clearTimeout(timer); }
      } finally {
        adapter.off('event', listener);
      }
    }));
  } finally {
    await adapter.stop();
    await serve.close();
  }
}

async function companions(add) {
  const png = Buffer.from(syntheticFigurePng(1600, 1200), 'base64');
  const phone = createPhoneHost({forcedAddress: '127.0.0.1', t: (key) => key, language: () => 'en', interfaces: () => ({}), send: () => {}});
  const inkReader = createFakeInkReader();
  const ambitus = createAmbitusBridgeHost({runtime: root, deskState: () => ({inkReading: true}),
    readText: inkReader.readText, pickModel: () => ({model: 'fake/vision'})});
  const upload = {method: 'POST', body: png, headers: {'content-type': 'image/png'}};
  try {
    const phoneTimes = [];
    for (let i = -4; i < runs; i++) {
      const {url} = await phone.start();
      const [ms] = await samples(async () => {
        const response = await fetch(`${url}/photo`, upload);
        assert.equal(response.status, 201);
        assert.equal((await response.json()).count, 1);
      }, 1, 0);
      if (i >= 0) phoneTimes.push(ms);
      phone.stop();
    }
    add(`Phone upload: ${(png.length / 1024).toFixed(0)} KiB PNG (loopback, no renderer IPC)`, 2, phoneTimes);
    await ambitus.start();
    const {port, token} = JSON.parse(fs.readFileSync(ambitus.bridgeFile, 'utf8'));
    add('Ambitus ler-tinta PNG HTTP + fake transcription', 2, await samples(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/ler-tinta`, {...upload, headers: {...upload.headers, 'x-summa-token': token}});
      assert.equal(response.status, 200);
      assert.equal((await response.json()).text, '∫ x dx');
    }));
  } finally {
    phone.stop();
    await ambitus.close();
  }
}

const rows = [];
function add(name, frequency, measurements) {
  const sorted = [...measurements].sort((a, b) => a - b);
  const at = (q) => sorted[Math.ceil(q * sorted.length) - 1];
  rows.push({name, frequency, n: sorted.length, p50: at(.5), p95: at(.95), p99: at(.99)});
}

try {
  console.log(`# ${process.platform} desktop main benchmark: ${process.version}; ${os.cpus()[0]?.model}; load ${os.loadavg().join('/')}`);
  if (mode !== 'paths') add('Startup: process launch → course tab mounted', 1, await startup());
  if (mode !== 'startup') {
    const write = measureSize(1000, runs);
    add(`Conversation writes per turn (${write.stored} messages, ${(write.bytes / 1048576).toFixed(2)} MiB)`, 20, write.turnSamples);
    await pdfAndState(add);
    await opencode(add);
    await companions(add);
  }
  const weighted = (row) => row.p95 * row.frequency;
  const ms = (value) => value.toFixed(2);
  console.log('| Path | n | p50 ms | p95 ms | p99 ms | Calls/session | p95 × calls ms | p99 × calls ms |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const row of rows.sort((a, b) => weighted(b) - weighted(a))) {
    console.log(`| ${row.name} | ${row.n} | ${ms(row.p50)} | ${ms(row.p95)} | ${ms(row.p99)} | ${row.frequency} | ${ms(weighted(row))} | ${ms(row.p99 * row.frequency)} |`);
  }
} finally {
  fs.rmSync(root, {recursive: true, force: true});
}
