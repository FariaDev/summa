/* Ponte local com o Ambitus: no 127.0.0.1 com token em arquivo 0600, uma
   rota `POST /ler-tinta` com o PNG da página, um pedido por vez. Fica no ar
   com a leitura desligada, mas aí responde `disabled` sem ler nada; o texto
   sai do `readText` injetado (o fake tem nome) e nada de imagem, texto lido
   ou token vai para o log. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {BRIDGE_NAME, PNG_CAP, createAmbitusBridgeHost, inkReadingEnabled, isPng} = require('../ambitus-bridge-host.cjs');
const {createFakeInkReader} = require('./fake-ink-reader.cjs');

/* Um PNG 1×1 de verdade: a ponte só confere a assinatura, mas o corpo é real. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');

function tempRuntime(t, tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `summa-ambitus-${tag}-`));
  t.after(() => { try { fs.rmSync(dir, {recursive: true, force: true}); } catch { /* a ponte também apaga */ } });
  return dir;
}

function startedHost(t, {enabled = true, runtime = tempRuntime(t, 'host'), reader = createFakeInkReader(), pickModel = () => ({model: 'p/visao', effort: null, reason: null}), logs = [], requestTimeoutMs} = {}) {
  const deps = {
    runtime,
    deskState: () => ({inkReading: enabled}),
    readText: (png, options) => reader.readText(png, options),
    pickModel,
    log: (line) => { logs.push(String(line)); },
  };
  if (requestTimeoutMs !== undefined) deps.requestTimeoutMs = requestTimeoutMs;
  const host = createAmbitusBridgeHost(deps);
  t.after(async () => { await host.close().catch(() => {}); });
  return {host, runtime, reader, logs};
}

function bridgeFileOf(host) {
  return JSON.parse(fs.readFileSync(host.bridgeFile, 'utf8'));
}

async function post(host, {token = bridgeFileOf(host).token, body = PNG, contentType = 'image/png', route = '/ler-tinta', signal} = {}) {
  const file = bridgeFileOf(host);
  const headers = {'content-type': contentType};
  if (token !== null) headers['x-summa-token'] = token;
  const response = await fetch(`http://127.0.0.1:${file.port}${route}`, {method: 'POST', headers, body, signal});
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* corpo de erro simples segue cru */ }
  return {status: response.status, json};
}

function postWithHost(host, hostHeader) {
  return new Promise((resolve, reject) => {
    const file = bridgeFileOf(host);
    const req = http.request({hostname: '127.0.0.1', port: file.port, path: '/ler-tinta', method: 'POST', headers: {'content-type': 'image/png', 'x-summa-token': file.token, host: hostHeader}}, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end(PNG);
  });
}

test('pedido válido: {text}, o leitor recebe o PNG em base64 e o modelo conferido', async (t) => {
  const {host, reader} = startedHost(t, {pickModel: () => ({model: 'p/visao', effort: 'high', reason: null})});
  await host.start();
  const result = await post(host);
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, {text: '∫ x dx'});
  assert.equal(reader.calls[0], PNG.toString('base64'));
  assert.deepEqual(reader.selections[0], {model: 'p/visao', effort: 'high'});
});

test('leitura desligada: a ponte fica no ar e responde disabled sem chamar o leitor', async (t) => {
  const {host, reader} = startedHost(t, {enabled: false});
  const info = await host.start();
  assert.ok(info.port > 0, 'a ponte sobe mesmo desligada');
  const result = await post(host);
  assert.deepEqual(result.json, {reason: 'disabled'});
  assert.equal(reader.calls.length, 0);
});

test('sem modelo, sem visão ou grátis: o motivo volta e nada é lido', async (t) => {
  for (const reason of ['no-model', 'no-vision', 'free']) {
    const {host, reader} = startedHost(t, {pickModel: () => ({model: null, effort: null, reason})});
    await host.start();
    assert.deepEqual((await post(host)).json, {reason});
    assert.equal(reader.calls.length, 0);
  }
  const {host} = startedHost(t, {pickModel: null});
  await host.start();
  assert.deepEqual((await post(host)).json, {reason: 'no-model'}, 'sem pickModel, falha fechada');
});

test('sem token, token errado ou Host de fora: 403 sem chamar o leitor', async (t) => {
  const {host, reader} = startedHost(t);
  await host.start();
  assert.equal((await post(host, {token: null})).status, 403);
  assert.equal((await post(host, {token: 'x'.repeat(43)})).status, 403);
  assert.equal(await postWithHost(host, 'exemplo.com'), 403);
  assert.equal(await postWithHost(host, `127.0.0.1:${bridgeFileOf(host).port + 1}`), 403);
  assert.equal(reader.calls.length, 0);
});

test('rota desconhecida: 404; corpo que não é PNG ou outro Content-Type: 400', async (t) => {
  const {host, reader} = startedHost(t);
  await host.start();
  assert.equal((await post(host, {route: '/converter'})).status, 404);
  assert.equal((await post(host, {contentType: 'application/json'})).status, 400);
  assert.equal((await post(host, {body: Buffer.from('<svg/>')})).status, 400);
  assert.equal(reader.calls.length, 0);
});

test('corpo acima do teto: 413', async (t) => {
  const {host} = startedHost(t);
  await host.start();
  const big = Buffer.concat([PNG, Buffer.alloc(PNG_CAP)]);
  assert.equal((await post(host, {body: big})).status, 413);
});

test('cota esgotada: {reason: quota}', async (t) => {
  const {host} = startedHost(t, {reader: createFakeInkReader({quota: true})});
  await host.start();
  assert.deepEqual((await post(host)).json, {reason: 'quota'});
});

test('segundo pedido enquanto o primeiro lê: busy', async (t) => {
  const {host} = startedHost(t, {reader: createFakeInkReader({delayMs: 300})});
  await host.start();
  const first = post(host);
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.deepEqual((await post(host)).json, {reason: 'busy'});
  assert.deepEqual((await first).json, {text: '∫ x dx'});
});

test('leitor que nunca responde: timeout no teto e o busy é liberado', async (t) => {
  const {host} = startedHost(t, {reader: createFakeInkReader({never: true}), requestTimeoutMs: 100});
  await host.start();
  assert.deepEqual((await post(host)).json, {reason: 'timeout'});
  assert.deepEqual((await post(host)).json, {reason: 'timeout'}, 'o segundo não cai em busy');
});

test('arquivo de ponte 0600 com versão, porta, token de 32 bytes e PID; close apaga', {skip: process.platform === 'win32' && 'bits de modo POSIX não existem no Windows'}, async (t) => {
  const {host, runtime} = startedHost(t);
  const info = await host.start();
  assert.equal(host.bridgeFile, path.join(runtime, BRIDGE_NAME));
  assert.equal(fs.statSync(host.bridgeFile).mode & 0o777, 0o600);
  const file = bridgeFileOf(host);
  assert.deepEqual(file, {version: 1, port: info.port, token: info.token, pid: process.pid});
  assert.equal(Buffer.from(file.token, 'base64url').length, 32);
  await host.close();
  assert.equal(fs.existsSync(host.bridgeFile), false);
});

test('log nunca leva token, imagem nem texto lido', async (t) => {
  const logs = [];
  const {host} = startedHost(t, {logs, reader: createFakeInkReader({text: 'segredo manuscrito'})});
  const {token} = await host.start();
  await post(host);
  const all = logs.join('\n');
  assert.ok(!all.includes(token));
  assert.ok(!all.includes('segredo manuscrito'));
  assert.ok(!all.includes(PNG.toString('base64')));
  assert.match(all, /ler-tinta pronto em \d+ ms/);
});

test('órfão de processo morto some na partida e dá lugar ao arquivo novo', async (t) => {
  const dead = spawnSync(process.execPath, ['-e', ''], {stdio: 'ignore'});
  assert.ok(dead.pid > 0, 'premissa: o processo morto teve PID');
  const runtime = tempRuntime(t, 'orphan');
  const file = path.join(runtime, BRIDGE_NAME);
  fs.writeFileSync(file, JSON.stringify({version: 1, port: 40001, token: 'fantasma', pid: dead.pid}));
  const {host} = startedHost(t, {runtime});
  const info = await host.start();
  assert.equal(bridgeFileOf(host).token, info.token, 'o órfão deu lugar ao arquivo novo');
});

test('inkReadingEnabled e isPng', () => {
  assert.equal(inkReadingEnabled({inkReading: true}), true);
  assert.equal(inkReadingEnabled({inkReading: 'true'}), false);
  assert.equal(inkReadingEnabled(null), false);
  assert.equal(isPng(PNG), true);
  assert.equal(isPng(Buffer.from('GIF89a')), false);
});
