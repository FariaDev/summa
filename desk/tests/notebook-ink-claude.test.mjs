/* Ponte de tinta no Claude (#158): a mesma leitura escondida do OpenCode,
   numa consulta temporária sem ferramentas nem sessão salva — o SDK fake de
   `claude-fixtures.mjs` (o mesmo dos testes do `claude-review-draft`). */
import test from 'node:test';
import './keep-loop-alive.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as fx from './claude-fixtures.mjs';
import {message} from '../src/i18n.mjs';
import {ptMatches, ptText} from './pt-text.mjs';

const require = createRequire(import.meta.url);
const {createClaudeInkBridge, readInk, inkPrompt} = require('../src/agents/notebook-ink-bridge.cjs');

const COMMANDS = [{name: 'compact', description: 'Free up context', argumentHint: '<instructions>'}, {name: 'review', description: 'Revisa', argumentHint: ''}];
/* Um PNG de 1×1 pixel em base64, como o host entrega. */
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=';

/* SDK fake cuja consulta também responde `supportedCommands()`. */
function sdkWithCommands(list = COMMANDS) {
  const sdk = fx.fakeSdk();
  const base = sdk.query;
  sdk.query = (args) => {
    const query = base(args);
    query.supportedCommands = typeof list === 'function' ? list : async () => list;
    return query;
  };
  return sdk;
}

test('lê a tinta numa consulta temporária com a imagem, e a fecha no fim', async () => {
  const sdk = sdkWithCommands();
  const bridge = createClaudeInkBridge({cwd: process.cwd(), sdkLoader: async () => sdk, selection: {model: null, effort: null}});
  const reading = readInk({bridge, png: PNG_1X1, language: 'pt-BR', timeoutMs: 4000});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const query = sdk.state.queries[0];
  assert.deepEqual(query.options.tools, []);
  assert.equal(query.options.persistSession, false);
  assert.deepEqual(query.options.mcpServers, {});
  const item = await fx.takeInput(query);
  const blocks = item.message.content;
  assert.equal(blocks[0].type, 'text');
  assert.equal(blocks[0].text, inkPrompt('pt-BR'));
  const image = blocks.find((block) => block.type === 'image');
  assert.ok(image, 'a página vai como bloco de imagem');
  assert.equal(image.source.media_type, 'image/png');
  assert.equal(image.source.data, PNG_1X1);
  query.emit(fx.replayMessage(item));
  query.emit(fx.assistantMessage({text: 'texto da tinta'}));
  query.emit(fx.resultMessage({userMessageUuid: item.uuid}));
  assert.deepEqual(await reading, {text: 'texto da tinta', reason: null});
  assert.ok(query.closeCalls >= 1, 'a consulta temporária fecha no fim');
});

test('erro não-quota do Claude também fecha a consulta', async () => {
  const sdk = sdkWithCommands();
  const bridge = createClaudeInkBridge({cwd: process.cwd(), sdkLoader: async () => sdk});
  const reading = readInk({bridge, png: PNG_1X1, language: 'pt-BR', timeoutMs: 4000});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const query = sdk.state.queries[0];
  const item = await fx.takeInput(query);
  query.emit(fx.replayMessage(item));
  query.emit(fx.assistantMessage({text: '', error: 'overloaded'}));
  query.emit(fx.resultMessage({subtype: 'error_during_execution', isError: true, userMessageUuid: item.uuid}));
  await assert.rejects(reading);
  assert.ok(query.closeCalls >= 1, 'o erro não-quota também fecha a consulta');
});

test('aborto também fecha a consulta', async () => {
  const sdk = sdkWithCommands();
  const bridge = createClaudeInkBridge({cwd: process.cwd(), sdkLoader: async () => sdk});
  const controller = new AbortController();
  const reading = readInk({bridge, png: PNG_1X1, language: 'pt-BR', signal: controller.signal, timeoutMs: 4000});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const query = sdk.state.queries[0];
  const item = await fx.takeInput(query);
  query.emit(fx.replayMessage(item));
  controller.abort();
  await assert.rejects(reading, ptMatches(/cancelada/i));
  assert.ok(query.closeCalls >= 1, 'o aborto também fecha a consulta');
});

test('timeout também fecha a consulta', async () => {
  const sdk = sdkWithCommands();
  const bridge = createClaudeInkBridge({cwd: process.cwd(), sdkLoader: async () => sdk});
  const reading = readInk({bridge, png: PNG_1X1, language: 'pt-BR', timeoutMs: 800});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const query = sdk.state.queries[0];
  const item = await fx.takeInput(query);
  query.emit(fx.replayMessage(item));
  await assert.rejects(reading, ptMatches(/demorou demais/i));
  assert.ok(query.closeCalls >= 1, 'o timeout também fecha a consulta');
});

test('mensagem crua de erro no message_end vira o erro genérico, sem vazar o texto', async () => {
  const sdk = sdkWithCommands();
  const bridge = createClaudeInkBridge({cwd: process.cwd(), sdkLoader: async () => sdk});
  const reading = readInk({bridge, png: PNG_1X1, language: 'pt-BR', timeoutMs: 4000});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const query = sdk.state.queries[0];
  const item = await fx.takeInput(query);
  query.emit(fx.replayMessage(item));
  bridge.emit('event', {type: 'message_end', message: {role: 'assistant', content: [], errorMessage: 'detalhe cru do provedor XYZ'}});
  const error = await reading.then(() => null, (caught) => caught);
  assert.ok(error, 'a leitura recusa');
  assert.doesNotMatch(String(error.message), /detalhe cru do provedor XYZ/, 'o texto cru não vaza');
  assert.match(ptText(String(error.message)), /falhou/i, 'vira o erro genérico localizado');
  assert.ok(query.closeCalls >= 1, 'a consulta fecha no fim');
});

test('mensagem crua de erro de quota no message_end vira motivo quota', async () => {
  const sdk = sdkWithCommands();
  const bridge = createClaudeInkBridge({cwd: process.cwd(), sdkLoader: async () => sdk});
  const reading = readInk({bridge, png: PNG_1X1, language: 'pt-BR', timeoutMs: 4000});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const query = sdk.state.queries[0];
  const item = await fx.takeInput(query);
  query.emit(fx.replayMessage(item));
  bridge.emit('event', {type: 'message_end', message: {role: 'assistant', content: [], errorMessage: message('opencode.event.freeTier')}});
  assert.deepEqual(await reading, {text: null, reason: 'quota'});
  assert.ok(query.closeCalls >= 1, 'a consulta fecha no fim');
});

test('limite de uso do Claude vira motivo quota e também fecha a consulta', async () => {
  const sdk = sdkWithCommands();
  const bridge = createClaudeInkBridge({cwd: process.cwd(), sdkLoader: async () => sdk});
  const reading = readInk({bridge, png: PNG_1X1, language: 'en', timeoutMs: 4000});
  await fx.waitFor(() => sdk.state.queries.length === 1, 2000, 'consulta criada');
  const query = sdk.state.queries[0];
  const item = await fx.takeInput(query);
  query.emit(fx.replayMessage(item));
  query.emit(fx.assistantMessage({text: '', error: 'rate_limit'}));
  query.emit(fx.resultMessage({subtype: 'error_during_execution', isError: true, userMessageUuid: item.uuid}));
  assert.deepEqual(await reading, {text: null, reason: 'quota'});
  assert.ok(query.closeCalls >= 1);
});
