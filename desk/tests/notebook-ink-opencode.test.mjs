/* Ponte de tinta no OpenCode (#158): a chamada avulsa que lê o texto
   manuscrito de uma página do caderno, escondida do tutor — sessão própria,
   descartável, sem MCP e sem descritor de conversa. O 403/429 do grátis vira
   motivo `quota`, e a sessão some no sucesso, no erro e no aborto. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createFakeOpencodeServe} from './fake-opencode.mjs';
import {trackTempDir} from './temp-dir.mjs';
import {ptMatches} from './pt-text.mjs';

const require = createRequire(import.meta.url);
const {createOpenCodeInkBridge, readInk, inkPrompt} = require('../src/agents/notebook-ink-bridge.cjs');

const PASSWORD = 'senha-da-tinta';
/* Um PNG de 1×1 pixel: o que importa é o transporte (base64 → arquivo
   temporário → `files`), não o conteúdo. */
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=';

const tempCwd = () => trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-ink-')));
const bridgeFor = (serve, cwd) => createOpenCodeInkBridge({
  cwd,
  acquire: async () => ({baseUrl: serve.url, password: PASSWORD, binary: '/fake/opencode'}),
  readVersion: async () => 'opencode v2.2.4',
});

test('lê a tinta numa sessão escondida, com a imagem, e apaga a sessão no fim', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, reply: () => 'limite lateral do caderno'});
  const cwd = tempCwd();
  t.after(async () => { await serve.close(); fs.rmSync(cwd, {recursive: true, force: true}); });
  const result = await readInk({bridge: bridgeFor(serve, cwd), png: PNG_1X1, language: 'pt-BR'});
  assert.deepEqual(result, {text: 'limite lateral do caderno', reason: null});
  const prompts = serve.requests.filter((entry) => String(entry.url).endsWith('/prompt'));
  assert.equal(prompts.length, 1, 'uma consulta só');
  assert.equal(prompts[0].body.text, inkPrompt('pt-BR'), 'o prompt fixo de transcrição');
  const files = prompts[0].body.files;
  assert.equal(files.length, 1, 'a página vai como arquivo');
  assert.match(files[0].uri, /^file:\/\/.*\.png$/);
  assert.equal(serve.requests.some((entry) => String(entry.url).includes('/experimental/mcp')), false, 'sem MCP da Mesa');
  assert.equal(serve.sessions.size, 0, 'a sessão temporária some no sucesso');
  const deleted = serve.requests.find((entry) => entry.method === 'DELETE');
  assert.ok(deleted, 'o DELETE foi pedido ao servidor');
  assert.match(String(deleted.url), /^\/api\/session\/[^/?]+\?location%5Bdirectory%5D=/);
  assert.equal(fs.readdirSync(cwd).some((name) => name.endsWith('.json') || name.endsWith('.jsonl')), false, 'sem sessão salva na pasta');
});

test('estouro do grátis (429) e recusa do grátis (403) viram motivo quota', async (t) => {
  for (const failTurn of ['free-limit', 'free-tier']) {
    const serve = await createFakeOpencodeServe({password: PASSWORD, failTurn});
    const cwd = tempCwd();
    t.after(async () => { await serve.close(); fs.rmSync(cwd, {recursive: true, force: true}); });
    const result = await readInk({bridge: bridgeFor(serve, cwd), png: PNG_1X1, language: 'en'});
    assert.deepEqual(result, {text: null, reason: 'quota'}, `${failTurn} vira quota`);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(serve.sessions.size, 0, `${failTurn} também apaga a sessão`);
  }
});

test('timeout também apaga a sessão', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, turnDelayMs: 2000});
  const cwd = tempCwd();
  t.after(async () => { await serve.close(); fs.rmSync(cwd, {recursive: true, force: true}); });
  await assert.rejects(readInk({bridge: bridgeFor(serve, cwd), png: PNG_1X1, language: 'pt-BR', timeoutMs: 500}), ptMatches(/demorou demais/i));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(serve.requests.filter((entry) => String(entry.url).endsWith('/prompt')).length >= 1, 'o prompt chegou antes do timeout');
  assert.equal(serve.sessions.size, 0, 'o timeout também apaga a sessão');
  assert.ok(serve.requests.some((entry) => entry.method === 'DELETE'), 'o DELETE foi pedido ao servidor');
});

test('PNG inválido também para a ponte, sem deixar nada aberto', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  const cwd = tempCwd();
  t.after(async () => { await serve.close(); fs.rmSync(cwd, {recursive: true, force: true}); });
  const bridge = bridgeFor(serve, cwd);
  let stops = 0;
  const stopped = bridge.stop.bind(bridge);
  bridge.stop = () => { stops += 1; return stopped(); };
  await assert.rejects(readInk({bridge, png: '', language: 'pt-BR'}), /png/i);
  assert.equal(stops, 1, 'a ponte é parada mesmo com PNG inválido');
  assert.equal(serve.sessions.size, 0, 'nenhuma sessão fica aberta');
  assert.equal(serve.requests.filter((entry) => String(entry.url).endsWith('/prompt')).length, 0, 'nada foi enviado');
});

test('PNG inválido recusa antes de criar sessão no servidor', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD});
  const cwd = tempCwd();
  t.after(async () => { await serve.close(); fs.rmSync(cwd, {recursive: true, force: true}); });
  await assert.rejects(readInk({bridge: bridgeFor(serve, cwd), png: '', language: 'pt-BR'}), /png/i);
  assert.equal(serve.sessions.size, 0);
  assert.equal(serve.requests.filter((entry) => String(entry.url).endsWith('/prompt')).length, 0, 'nada foi enviado');
});

test('erro do turno e aborto também apagam a sessão', async (t) => {
  const serve = await createFakeOpencodeServe({password: PASSWORD, chaos: ['desk-error'], turnDelayMs: 80});
  const cwd = tempCwd();
  t.after(async () => { await serve.close(); fs.rmSync(cwd, {recursive: true, force: true}); });
  await assert.rejects(readInk({bridge: bridgeFor(serve, cwd), png: PNG_1X1, language: 'pt-BR'}), /Falha de teste/);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(serve.sessions.size, 0, 'o erro também apaga a sessão');

  const slow = await createFakeOpencodeServe({password: PASSWORD, turnDelayMs: 400});
  t.after(async () => { await slow.close(); });
  const controller = new AbortController();
  const reading = readInk({bridge: bridgeFor(slow, cwd), png: PNG_1X1, language: 'pt-BR', signal: controller.signal, timeoutMs: 5000});
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && slow.requests.filter((entry) => String(entry.url).endsWith('/prompt')).length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  controller.abort();
  await assert.rejects(reading, ptMatches(/cancelada/i));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(slow.sessions.size, 0, 'o aborto também apaga a sessão');
});
