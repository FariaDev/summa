#!/usr/bin/env node
/* Caça do revert por fronteira do OpenCode 2.2.4 real (#164): sobe o
   `opencode serve` de verdade com HOME/XDG temporários e um provedor
   OpenAI-compatible local que só devolve texto fixo. Sem rede e sem login.

   Mede o que o "tentar de novo" da Mesa assume, e o que o binário faz:

   1. `POST .../revert/stage` com o `messageID` de P2: o GET de mensagens
      continua com P2 e R2 (o stage NÃO esconde); o GET da sessão ganha
      `revert: {messageID, files: []}`;
   2. o `prompt` seguinte comita o revert: o histórico fica P1, R1, P2', R2'
      e o provedor não vê mais P2;
   3. `DELETE .../revert` desfaz o revert pendente e o histórico continua
      P1, R1, P2, R2;
   4. um prompt RECUSADO antes do aceite (corpo sem `text`, HTTP 400) deixa o
      revert PENDENTE; o DELETE restaura. Modelo inexistente NÃO é recusa no
      2.2.4: o prompt é aceito (200) e comita o revert;
   5. o id devolvido pelo `prompt` é o `msg_…` da mensagem do aluno no GET e é
      o mesmo id que o stage aceita;
   6. `POST .../revert/commit` existe e corta o histórico dali (204).

   Sem `LEARNING_DESK_OPENCODE` apontando para um binário 2.x, PULA (77). O
   runner de hunts entende "PULADO:" e não conta como falha. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {trackTempDir} from './temp-dir.mjs';

const require = (await import('node:module')).createRequire(import.meta.url);
const {serveEnv, writeServeConfig} = require('../src/agents/opencode-serve-config.cjs');
const {startOpenCodeServer} = require('../src/agents/opencode-process.cjs');
const {createOpenCodeClient} = require('../src/agents/opencode-http.cjs');

function skip(reason) {
  console.log(`PULADO: ${reason}`);
  process.exit(77);
}

function binaryFromEnv() {
  const configured = String(process.env.LEARNING_DESK_OPENCODE || '');
  return configured && fs.existsSync(configured) ? configured : '';
}

function versionOf(binary) {
  try { return execFileSync(binary, ['--version'], {encoding: 'utf8', timeout: 15000}).trim(); } catch { return ''; }
}

/* Provedor OpenAI-compatible mínimo: toda chamada devolve texto fixo no
   formato SSE do `chat/completions` e guarda o corpo para provar qual
   histórico o modelo viu. O título da sessão também passa por aqui. */
async function createFixedProvider() {
  const state = {bodies: []};
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (req.url?.includes('/models')) {
        res.writeHead(200, {'content-type': 'application/json'});
        res.end(JSON.stringify({object: 'list', data: [{id: 'm1', object: 'model'}]}));
        return;
      }
      if (!req.url?.includes('/chat/completions')) { res.writeHead(404).end('{}'); return; }
      let parsed = {};
      try { parsed = JSON.parse(body); } catch { /* corpo vazio */ }
      state.bodies.push(parsed);
      const text = `Resposta fixa ${state.bodies.length}`;
      const chunk = (delta, finish = null) => ({id: 'chatcmpl-hunt', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'm1', choices: [{index: 0, delta, finish_reason: finish}]});
      res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive'});
      res.write(`data: ${JSON.stringify(chunk({role: 'assistant', content: text}))}\n\n`);
      res.write(`data: ${JSON.stringify(chunk({}, 'stop'))}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    state,
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}

const providerCallHas = (call, text) => (call?.messages || []).some((message) => String(message.content || '').includes(text));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const binary = binaryFromEnv();
if (!binary) skip('defina LEARNING_DESK_OPENCODE com o binário do OpenCode 2.x');
const version = versionOf(binary);
if (!/^opencode v?2\./.test(version)) skip(`${binary} é "${version}" (o hunt exige 2.x, de preferência 2.2.4)`);

const runtime = trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-hunt-revert-')));
const workspace = path.join(runtime, 'ws');
const home = path.join(runtime, 'home');
const tmp = path.join(runtime, 'tmp');
fs.mkdirSync(workspace, {recursive: true});
fs.mkdirSync(home, {recursive: true});
fs.mkdirSync(tmp, {recursive: true});

const provider = await createFixedProvider();
let server = null;
try {
  const configDir = writeServeConfig({runtime});
  const configFile = path.join(configDir, 'opencode.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.model = 'acme/m1';
  config.provider = {acme: {npm: '@ai-sdk/openai-compatible', options: {baseURL: `${provider.url}/v1`, apiKey: 'fake'}, models: {m1: {name: 'M1'}}}};
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const env = serveEnv({...process.env, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config'), XDG_DATA_HOME: path.join(home, '.local', 'share'), XDG_CACHE_HOME: path.join(home, '.cache'), XDG_STATE_HOME: path.join(home, '.local', 'state'), TMPDIR: tmp}, configDir);
  server = await startOpenCodeServer({binary, cwd: workspace, env});
  const client = createOpenCodeClient({baseUrl: server.baseUrl, password: server.password});
  const query = {'location[directory]': workspace};
  const route = (id, tail = '') => `/api/session/${id}${tail}`;

  async function sessionState(id) {
    const response = await client.request('GET', route(id), {query});
    assert.equal(response.status, 200, 'GET da sessão');
    return response.payload.data;
  }
  async function messages(id) {
    const response = await client.request('GET', route(id, '/message'), {query: {...query, order: 'asc'}});
    assert.equal(response.status, 200, 'GET das mensagens');
    return (response.payload.data || []).filter((item) => item.type === 'user' || item.type === 'assistant')
      .map((item) => ({id: item.id, type: item.type, text: item.type === 'user' ? item.text : (item.content || []).find((part) => part.type === 'text')?.text}));
  }
  async function waitIdle(id, label) {
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const list = await messages(id);
      if (list.length && list.at(-1).type === 'assistant') return list;
      await sleep(25); // espera fixa: intervalo de polling até o turno real terminar
    }
    throw Error(`espera estourou: ${label}`);
  }
  async function prompt(id, text, extra = {}) {
    const response = await client.request('POST', route(id, '/prompt'), {body: {text, resume: true, ...extra}, query});
    assert.equal(response.status, 200, `prompt "${text}"`);
    return response.payload.data;
  }
  async function stage(id, messageID) {
    const response = await client.request('POST', route(id, '/revert/stage'), {body: {messageID}, query});
    assert.equal(response.status, 200, `stage de ${messageID}`);
    return response.payload;
  }
  async function undo(id) {
    const response = await client.request('DELETE', route(id, '/revert'), {query});
    assert.equal(response.status, 204, 'DELETE do revert');
    return response.status;
  }
  async function twoTurns(tag) {
    const created = await client.request('POST', '/api/session', {body: {location: {directory: workspace}}});
    assert.equal(created.status, 200, 'criação da sessão');
    const id = created.payload.data.id;
    const p1 = await prompt(id, `${tag} P1`);
    await waitIdle(id, `${tag} P1`);
    const p2 = await prompt(id, `${tag} P2`);
    const list = await waitIdle(id, `${tag} P2`);
    return {id, p1: p1.id, p2: p2.id, p1Text: `${tag} P1`, p2Text: `${tag} P2`, r2: list.at(-1).id};
  }

  const summary = {};

  /* 1. Stage não esconde: GET de mensagens igual; GET da sessão com revert. */
  {
    const s = await twoTurns('S1');
    const before = await messages(s.id);
    const staged = await stage(s.id, s.p2);
    const after = await messages(s.id);
    assert.deepEqual(after.map((item) => item.id), before.map((item) => item.id), 'o stage não esconde P2/R2 do GET');
    const state = await sessionState(s.id);
    assert.deepEqual(state.revert, {messageID: s.p2, files: []}, 'o GET da sessão expõe o revert pendente');
    summary.stage = {status: 200, stageData: staged.data, messageIds: after.map((item) => item.id), sessionRevert: state.revert};
  }

  /* 2. Prompt comita: P1, R1, P2', R2' e o provedor não vê a P2 antiga. */
  {
    const s = await twoTurns('S2');
    await stage(s.id, s.p2);
    const fresh = await prompt(s.id, 'S2 refeita');
    const after = await waitIdle(s.id, 'S2 refeita');
    assert.equal(after.length, 4, 'o histórico fica com dois turnos');
    assert.equal(after[0].text, s.p1Text);
    assert.equal(after[2].text, 'S2 refeita');
    assert.ok(!after.some((item) => item.id === s.p2 || item.id === s.r2), 'P2/R2 antigas saíram');
    const seen = provider.state.bodies.find((call) => providerCallHas(call, 'S2 refeita'));
    assert.ok(seen, 'o provedor recebeu o prompt novo');
    assert.equal(providerCallHas(seen, s.p2Text), false, 'o provedor não viu a P2 antiga');
    summary.prompt = {status: 200, promptId: fresh.id, messageIds: after.map((item) => item.id), sessionRevert: (await sessionState(s.id)).revert, providerSawOldP2: false};
  }

  /* 3. DELETE desfaz o revert e o histórico continua P1, R1, P2, R2. */
  {
    const s = await twoTurns('S3');
    const before = await messages(s.id);
    await stage(s.id, s.p2);
    const status = await undo(s.id);
    const after = await messages(s.id);
    assert.deepEqual(after.map((item) => item.id), before.map((item) => item.id), 'o DELETE não perde mensagens');
    const state = await sessionState(s.id);
    assert.equal(state.revert, undefined, 'o revert sumiu da sessão');
    summary.undo = {status, messageIds: after.map((item) => item.id), sessionRevert: state.revert ?? null};
  }

  /* 4a. Prompt recusado antes do aceite: revert fica pendente; DELETE restaura. */
  {
    const s = await twoTurns('S4a');
    const before = await messages(s.id);
    await stage(s.id, s.p2);
    const refused = await client.request('POST', route(s.id, '/prompt'), {body: {}, query});
    assert.equal(refused.status, 400, 'corpo sem text é recusado antes do aceite');
    const pending = await sessionState(s.id);
    assert.deepEqual(pending.revert, {messageID: s.p2, files: []}, 'a recusa NÃO comitou o revert');
    assert.deepEqual((await messages(s.id)).map((item) => item.id), before.map((item) => item.id), 'a recusa não mexeu no histórico');
    const status = await undo(s.id);
    const restored = await sessionState(s.id);
    assert.equal(restored.revert, undefined, 'o DELETE limpou o revert pendente');
    assert.deepEqual((await messages(s.id)).map((item) => item.id), before.map((item) => item.id), 'o histórico segue P1, R1, P2, R2');
    summary.refused = {status: refused.status, refusal: refused.payload, sessionRevertBeforeUndo: pending.revert, undoStatus: status, sessionRevertAfterUndo: restored.revert ?? null, messageIds: before.map((item) => item.id)};
  }

  /* 4b. Modelo inexistente NÃO é recusa no 2.2.4: o prompt é aceito e comita. */
  {
    const s = await twoTurns('S4b');
    await stage(s.id, s.p2);
    const accepted = await client.request('POST', route(s.id, '/prompt'), {body: {text: 'S4b P2 modelo inexistente', resume: true, model: {providerID: 'nao-existe', id: 'nada'}}, query});
    assert.equal(accepted.status, 200, 'o 2.2.4 aceita o prompt mesmo com modelo inexistente');
    const after = await waitIdle(s.id, 'S4b modelo inexistente');
    assert.equal(after.length, 4, 'o prompt aceito comitou o revert');
    assert.equal(after[2].text, 'S4b P2 modelo inexistente');
    assert.ok(!after.some((item) => item.id === s.p2 || item.id === s.r2), 'P2/R2 antigas saíram');
    summary.nonexistentModel = {status: accepted.status, messageIds: after.map((item) => item.id), sessionRevert: (await sessionState(s.id)).revert ?? null};
  }

  /* 5. O id do prompt é o msg_… do aluno no GET e o mesmo aceito pelo stage. */
  {
    const s = await twoTurns('S5');
    const before = await messages(s.id);
    assert.match(s.p2, /^msg_/);
    assert.equal(before.find((item) => item.type === 'user' && item.text === s.p2Text)?.id, s.p2, 'o id do prompt é o da mensagem do aluno');
    const staged = await stage(s.id, s.p2);
    assert.equal(staged.data.messageID, s.p2, 'o stage aceita o id do prompt');
    summary.id = {promptId: s.p2, messageId: before.find((item) => item.type === 'user' && item.text === s.p2Text)?.id, stageMessageId: staged.data.messageID};
  }

  /* 6. O commit explícito existe e corta dali. */
  {
    const s = await twoTurns('S6');
    await stage(s.id, s.p2);
    const commit = await client.request('POST', route(s.id, '/revert/commit'), {body: {}, query});
    assert.equal(commit.status, 204, 'POST .../revert/commit');
    const after = await messages(s.id);
    assert.equal(after.length, 2, 'o commit cortou P2/R2');
    assert.equal(after[0].text, s.p1Text);
    summary.commit = {status: commit.status, messageIds: after.map((item) => item.id), sessionRevert: (await sessionState(s.id)).revert ?? null};
  }

  console.log(JSON.stringify({version, scenarios: summary}, null, 2));
  console.log('OK: revert por fronteira conferido no OpenCode real');
} finally {
  if (server) await server.stop();
  await provider.close();
}
