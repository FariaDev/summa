/* "Tentar de novo" na última resposta do tutor (#164): o serviço guarda o
   `msg_…` da pergunta no descritor, o adaptador marca o revert no OpenCode,
   reenvia o MESMO pacote e o prompt comita o revert. O fake do motor cobre os
   dois caminhos de falha: reenvio recusado (revert desfeito) e revert recusado
   (nada reenviado). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createFakeOpencodeServe} from './fake-opencode.mjs';
import {parseMessage} from '../src/i18n.mjs';

const require = createRequire(import.meta.url);
const {NativeService, ClaudeService, metadata} = require('../src/agents/service.cjs');
const {OpenCodeAdapter} = require('../src/agents/opencode-adapter.cjs');
const {createOpenCodeClient} = require('../src/agents/opencode-http.cjs');
const conversations = require('../src/agents/conversations.cjs');
const {nativePersistence} = require('../src/agents/native-persistence.cjs');

const PASSWORD = 'senha-de-teste';
const fakeReadVersion = async () => 'opencode v2.2.4';
const IMAGE = {type: 'image', data: 'aGVsbG8=', mimeType: 'image/png'};

/** Adaptador real contra o `opencode serve` falso, com descritor de verdade. */
async function createHarness(t, serveOptions = {}) {
  const serve = await createFakeOpencodeServe({password: PASSWORD, ...serveOptions});
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-retry-'));
  const descriptor = conversations.createClaudeConversation({runtime, courseId: 'calc', engine: 'opencode'});
  const persistence = nativePersistence({descriptor, runtime, preview: ''});
  const adapter = new OpenCodeAdapter({conversationId: 'conv-1', sessionId: '', directory: '/tmp/mesa-ws/conv-1',
    acquire: async () => ({baseUrl: serve.url, password: PASSWORD, binary: '/fake/opencode'}),
    persistDelivery: persistence.persistDelivery, readVersion: fakeReadVersion,
    onSessionId: (id) => conversations.updateClaudeConversation(descriptor, {nativeSessionId: id}, {runtime})});
  const service = new NativeService({adapter, engine: 'opencode', onMessages: persistence.onMessages,
    lastTurn: persistence.lastTurn, onTurn: persistence.onTurn});
  const events = [];
  service.on('event', (event) => events.push(event));
  t.after(async () => { service.stop(); await serve.close(); fs.rmSync(runtime, {recursive: true, force: true}); });
  return {serve, runtime, descriptor, adapter, service, events};
}

async function waitFor(events, predicate, label) {
  for (let i = 0; i < 300; i++) {
    if (events.some(predicate)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw Error(`evento não chegou: ${label}`);
}

const settledCount = (events) => events.filter((event) => event.type === 'agent_settled').length;
const prompts = (serve) => serve.requests.filter((item) => item.method === 'POST' && item.url.endsWith('/prompt'));
const recordOf = (descriptor, runtime) => conversations.readClaudeConversation(descriptor, {runtime});

test('refazer feliz reenvia o mesmo pacote e o motor fica com uma pergunta e uma resposta', async (t) => {
  const {serve, runtime, descriptor, adapter, service, events} = await createHarness(t);
  await service.request('prompt', {message: 'Explique a lista 2', images: [IMAGE]});
  await waitFor(events, (event) => event.type === 'agent_settled', 'primeiro turno');
  const first = prompts(serve)[0].body;
  const firstMessages = serve.sessions.get(adapter.sessionId).messages;
  assert.equal(firstMessages.length, 2, 'uma pergunta e uma resposta antes do refazer');
  const firstRecord = recordOf(descriptor, runtime);
  assert.equal(firstRecord.nativeTurns.length, 1, 'o descritor guarda o turno da pergunta');
  assert.equal(firstRecord.nativeTurns[0].messageId, firstMessages[0].id);
  assert.equal((await service.request('get_state')).canRetryLastTurn, true);

  const settled = settledCount(events);
  const result = await service.retryLastTurn();
  assert.equal(result.retried, true);
  await waitFor(events, () => settledCount(events) > settled, 'turno refeito');

  const retried = prompts(serve)[1].body;
  assert.equal(retried.text, first.text, 'texto exatamente igual (contexto, refs e menções)');
  assert.equal(retried.files?.length, first.files?.length, 'as mesmas imagens');
  const messages = serve.sessions.get(adapter.sessionId).messages;
  assert.equal(messages.length, 2, 'o motor não duplica a pergunta');
  assert.equal(messages[0].type, 'user');
  assert.equal(messages[0].text, first.text);
  assert.equal(messages[1].type, 'assistant');
  assert.equal(serve.sessions.get(adapter.sessionId).revert, null, 'o prompt comitou o revert');
  const record = recordOf(descriptor, runtime);
  assert.equal(record.nativeTurns.length, 1, 'o turno antigo saiu do descritor');
  assert.equal(record.nativeTurns[0].messageId, messages[0].id);
  assert.equal(record.messages.length, 2, 'o histórico salvo também fica com uma pergunta e uma resposta');
  assert.equal(service.messages.length, 2);
});

/* Medido no 2.2.4 real em 2026-11-10: o stage NÃO esconde a pergunta nem a
   resposta no GET de mensagens; ele só grava `revert` na sessão. Quem esconde é
   a interface, e o prompt seguinte comita cortando dali. */
test('o stage não esconde o histórico e o GET da sessão expõe o revert pendente', async (t) => {
  const {serve, adapter, service, events} = await createHarness(t);
  await service.request('prompt', {message: 'pergunta que fica visível'});
  await waitFor(events, (event) => event.type === 'agent_settled', 'primeiro turno');
  const session = serve.sessions.get(adapter.sessionId);
  const before = session.messages.map((item) => item.id);
  const user = session.messages.find((item) => item.type === 'user');
  const client = createOpenCodeClient({baseUrl: serve.url, password: PASSWORD});

  await adapter.stageRevert(user.id);
  const messages = await client.request('GET', `/api/session/${adapter.sessionId}/message`);
  assert.deepEqual(messages.payload.data.map((item) => item.id), before, 'o stage não esconde a pergunta nem a resposta');
  const state = await client.request('GET', `/api/session/${adapter.sessionId}`);
  assert.deepEqual(state.payload.data.revert, {messageID: user.id, files: []}, 'o GET da sessão mostra o revert pendente');
});

test('falha no reenvio desfaz o revert e mantém o histórico intacto', async (t) => {
  const {serve, runtime, descriptor, adapter, service, events} = await createHarness(t);
  await service.request('prompt', {message: 'oi'});
  await waitFor(events, (event) => event.type === 'agent_settled', 'primeiro turno');
  const before = recordOf(descriptor, runtime);
  serve.state.refusePrefix = 'oi';

  await assert.rejects(service.retryLastTurn(), (error) => error.notSent === true && error.code === undefined);
  assert.equal(prompts(serve).length, 2, 'tentou o reenvio uma vez');
  assert.ok(serve.requests.some((item) => item.method === 'DELETE' && item.url.endsWith('/revert')), 'desfez o revert');
  const session = serve.sessions.get(adapter.sessionId);
  assert.equal(session.messages.length, 2, 'o motor continua com uma pergunta e uma resposta');
  assert.equal(session.revert, null);
  const after = recordOf(descriptor, runtime);
  assert.deepEqual(after.messages, before.messages, 'o histórico salvo ficou como estava');
  assert.deepEqual(after.nativeTurns, before.nativeTurns, 'o id do turno continua o mesmo');
  assert.equal(service.messages.length, 2);
});

test('falha no revert não reenvia nada', async (t) => {
  const {serve, adapter, service, events} = await createHarness(t);
  await service.request('prompt', {message: 'oi'});
  await waitFor(events, (event) => event.type === 'agent_settled', 'primeiro turno');
  serve.state.revertStatus = 409;

  await assert.rejects(service.retryLastTurn(), (error) => error.code === 'OPENCODE_REVERT_REFUSED' && error.notSent === true);
  assert.equal(prompts(serve).length, 1, 'nada foi reenviado');
  const session = serve.sessions.get(adapter.sessionId);
  assert.equal(session.messages.length, 2);
  assert.equal(session.revert, null);
  assert.equal(service.messages.length, 2);
});

test('recusa enquanto o tutor responde', async (t) => {
  const {service} = await createHarness(t, {ask: true});
  await service.request('prompt', {message: 'oi'});
  await assert.rejects(service.retryLastTurn(), (error) => error.code === 'RETRY_BUSY' && parseMessage(error.message)?.key === 'opencode.svc.busy');
});

/* Revisão do #169: entre a checagem de ocupado e o `stageRevert` havia um
   await sem marca de envio. Uma pergunta nova (ou um segundo clique) passava
   nessa janela, comitava o revert no lugar do refazer e trocava a ordem. */
test('enquanto o revert é marcado, outra pergunta e outro refazer são recusados', async (t) => {
  const {serve, adapter, service, events} = await createHarness(t);
  await service.request('prompt', {message: 'Explique a lista 2'});
  await waitFor(events, (event) => event.type === 'agent_settled', 'primeiro turno');
  const stage = adapter.stageRevert.bind(adapter);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  adapter.stageRevert = async (id) => { await gate; return stage(id); };
  const retry = service.retryLastTurn();
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(service.request('prompt', {message: 'Pergunta nova'}), (error) => parseMessage(error.message)?.key === 'opencode.svc.busy', 'pergunta nova espera o refazer');
  await assert.rejects(service.retryLastTurn(), (error) => error.code === 'RETRY_BUSY', 'segundo clique é recusado');
  release();
  await retry;
  await waitFor(events, (event) => settledCount(events) >= 2 && event.type === 'agent_settled', 'turno refeito');
  assert.deepEqual(prompts(serve).map((item) => JSON.stringify(item.body).includes('Pergunta nova')), [false, false], 'só a pergunta antiga foi ao motor, duas vezes');
  const users = service.messages.filter((message) => message.role === 'user');
  assert.equal(users.length, 1, 'a lista local fica com uma pergunta');
});

test('descritor antigo sem o id continua lendo e o refazer recusa', async (t) => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-retry-old-'));
  t.after(() => fs.rmSync(runtime, {recursive: true, force: true}));
  const descriptor = conversations.createClaudeConversation({runtime, courseId: 'calc', engine: 'opencode'});
  conversations.updateClaudeConversation(descriptor, {messages: [
    {role: 'user', content: [{type: 'text', text: 'pergunta antiga'}]},
    {role: 'assistant', content: [{type: 'text', text: 'resposta antiga'}]}
  ]}, {runtime});
  const record = recordOf(descriptor, runtime);
  assert.equal(record.nativeTurns, undefined, 'descritor antigo não tem a lista');
  assert.equal(record.messages.length, 2, 'e continua lendo normalmente');
  const {EventEmitter} = await import('node:events');
  const adapter = new EventEmitter();
  adapter.snapshot = () => ({busy: false});
  adapter.connect = async () => {};
  const service = new NativeService({adapter, engine: 'opencode', messages: record.messages,
    lastTurn: () => null});
  await assert.rejects(service.retryLastTurn(), (error) => error.code === 'RETRY_NO_TURN');

  conversations.updateClaudeConversation(descriptor, {nativeTurns: [{user: 'u1', messageId: ''}]}, {runtime});
  const commandService = new NativeService({adapter, engine: 'opencode', messages: record.messages,
    lastTurn: () => ({user: 'u1', messageId: ''})});
  await assert.rejects(commandService.retryLastTurn(), (error) => error.code === 'RETRY_NO_ENGINE_ID');
});

test('Claude recusa o refazer e a capacidade é false', async () => {
  assert.equal(metadata('opencode').caps.retryLastTurn, true);
  assert.equal(metadata('claude').caps.retryLastTurn, false);
  const {EventEmitter} = await import('node:events');
  const adapter = new EventEmitter();
  adapter.snapshot = () => ({busy: false});
  adapter.connect = async () => {};
  adapter.cacheHistory = () => {};
  adapter.controlsSnapshot = () => ({selection: null});
  const service = new ClaudeService({adapter, messages: [{role: 'user', content: [{type: 'text', text: 'oi'}]}]});
  await assert.rejects(service.retryLastTurn(), (error) => error.code === 'RETRY_UNSUPPORTED' && parseMessage(error.message)?.key === 'claude.svc.noControl');
  assert.equal((await service.request('get_state')).canRetryLastTurn, false);
});

test('o descritor valida e remove nativeTurns sem tocar no resto', (t) => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-retry-desc-'));
  t.after(() => fs.rmSync(runtime, {recursive: true, force: true}));
  const descriptor = conversations.createClaudeConversation({runtime, courseId: 'calc', engine: 'opencode'});
  conversations.updateClaudeConversation(descriptor, {nativeTurns: [{user: 'u1', messageId: 'msg_1'}]}, {runtime});
  assert.deepEqual(recordOf(descriptor, runtime).nativeTurns, [{user: 'u1', messageId: 'msg_1'}]);
  assert.throws(() => conversations.updateClaudeConversation(descriptor, {nativeTurns: [{user: 'u1', messageId: 42}]}, {runtime}), /nativeTurns/);
  conversations.updateClaudeConversation(descriptor, {nativeTurns: null}, {runtime});
  assert.equal(recordOf(descriptor, runtime).nativeTurns, undefined);
});
