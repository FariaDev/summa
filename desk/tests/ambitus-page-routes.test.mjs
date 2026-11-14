/* As rotas do Conferir pela ponte, em HTTP de verdade no 127.0.0.1: o
   long-poll `GET /pedido-pagina` (204 sem pedido, `{pedido}` quando a Summa
   pede) e `POST /pagina-atual` (a página renderizada). Mesmo token das outras
   rotas; pedido desconhecido ou expirado, PNG inválido e corpo grande demais
   são recusados. O Ambitus é um cliente `fetch` do teste. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {ANSWER_CAP, createAmbitusBridgeHost, parsePageAnswer} = require('../ambitus-bridge-host.cjs');
const {createPageBroker} = require('../ambitus-page-broker.cjs');
const {requestAmbitusPage} = require('../ambitus-bridge-wiring.cjs');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
const PNG_B64 = PNG.toString('base64');

async function startedBridge(t, brokerOptions = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'summa-ambitus-routes-'));
  const pageBroker = createPageBroker({holdMs: 150, answerMs: 400, graceMs: 100, waitPollMs: 100, ...brokerOptions});
  const host = createAmbitusBridgeHost({runtime, deskState: () => ({}), readText: async () => ({text: '', reason: null}), pickModel: null, pageBroker});
  t.after(async () => { await host.close().catch(() => {}); fs.rmSync(runtime, {recursive: true, force: true}); });
  await host.start();
  const file = JSON.parse(fs.readFileSync(host.bridgeFile, 'utf8'));
  const base = `http://127.0.0.1:${file.port}`;
  const poll = (token = file.token) => fetch(`${base}/pedido-pagina`, {headers: token === null ? {} : {'x-summa-token': token}});
  const answer = async (body, {token = file.token, contentType = 'application/json'} = {}) => {
    const response = await fetch(`${base}/pagina-atual`, {method: 'POST', headers: {'content-type': contentType, 'x-summa-token': token}, body: typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)});
    return {status: response.status, json: await response.json().catch(() => null)};
  };
  return {host, pageBroker, poll, answer, file};
}

const good = (pedido, extra = {}) => ({pedido, caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites', png: PNG_B64, ...extra});

test('long-poll sem pedido: 204 depois do tempo de espera, e o Ambitus conta como conectado', async (t) => {
  const {poll, pageBroker} = await startedBridge(t);
  const pending = poll();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(pageBroker.connected(), true);
  const response = await pending;
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
});

test('o Conferir pede: o long-poll recebe {pedido} e a resposta chega ao Conferir', async (t) => {
  const {poll, answer, pageBroker} = await startedBridge(t);
  const pending = poll();
  await new Promise((resolve) => setTimeout(resolve, 30));
  const asking = pageBroker.request();
  const response = await pending;
  assert.equal(response.status, 200);
  const {pedido} = await response.json();
  assert.match(pedido, /^[0-9a-f]{24}$/);
  const sent = await answer(good(pedido));
  assert.deepEqual(sent, {status: 200, json: {ok: true}});
  const outcome = await asking;
  assert.equal(outcome.ok, true);
  assert.deepEqual({...outcome.answer}, good(pedido));
});

test('sem documento aberto o Ambitus responde {pedido, erro: "sem-pagina"}', async (t) => {
  const {poll, answer, pageBroker} = await startedBridge(t);
  const pending = poll();
  await new Promise((resolve) => setTimeout(resolve, 30));
  const asking = pageBroker.request();
  const {pedido} = await (await pending).json();
  assert.equal((await answer({pedido, erro: 'sem-pagina'})).status, 200);
  assert.deepEqual((await asking).answer, {pedido, erro: 'sem-pagina'});
});

test('token errado ou ausente: 403 nas duas rotas, nada é entregue', async (t) => {
  const {poll, answer, pageBroker} = await startedBridge(t);
  assert.equal((await poll('errado')).status, 403);
  assert.equal((await poll(null)).status, 403);
  assert.equal(pageBroker.connected(), false, 'long-poll recusado não conecta');
  assert.equal((await answer(good('aaaaaaaaaaaaaaaa'), {token: 'errado'})).status, 403);
});

test('pedido desconhecido ou já respondido: 404 unknown-request', async (t) => {
  const {poll, answer, pageBroker} = await startedBridge(t);
  assert.deepEqual(await answer(good('0123456789abcdef')), {status: 404, json: {reason: 'unknown-request'}});
  const pending = poll();
  await new Promise((resolve) => setTimeout(resolve, 30));
  const asking = pageBroker.request();
  const {pedido} = await (await pending).json();
  assert.equal((await answer(good(pedido))).status, 200);
  await asking;
  assert.equal((await answer(good(pedido))).status, 404, 'o id vale uma resposta só');
});

test('timeout: depois de answerMs a resposta é recusada e o Conferir recebe timeout', async (t) => {
  const {poll, answer, pageBroker} = await startedBridge(t, {answerMs: 60});
  const pending = poll();
  await new Promise((resolve) => setTimeout(resolve, 30));
  const asking = pageBroker.request();
  const {pedido} = await (await pending).json();
  assert.deepEqual(await asking, {ok: false, reason: 'timeout'});
  assert.equal((await answer(good(pedido))).status, 404, 'resposta tardia é recusada');
});

test('PNG inválido: 400, e o pedido falha na hora em vez de esperar o teto', async (t) => {
  const {poll, answer, pageBroker} = await startedBridge(t, {answerMs: 5000});
  const pending = poll();
  await new Promise((resolve) => setTimeout(resolve, 30));
  const asking = pageBroker.request();
  const {pedido} = await (await pending).json();
  const notPng = Buffer.from('isto não é um png de jeito nenhum').toString('base64');
  assert.equal((await answer(good(pedido, {png: notPng}))).status, 400);
  assert.deepEqual(await asking, {ok: false, reason: 'invalid'});
});

test('corpo grande demais: 413 sem chegar ao Conferir', async (t) => {
  const {poll, answer} = await startedBridge(t);
  await poll();
  const huge = Buffer.alloc(ANSWER_CAP + 1024, 'A').toString();
  assert.equal((await answer(huge)).status, 413);
});

test('só um long-poll vale: o novo substitui o anterior (409 no antigo)', async (t) => {
  const {poll, pageBroker} = await startedBridge(t, {holdMs: 2000});
  const first = poll();
  await new Promise((resolve) => setTimeout(resolve, 30));
  const second = poll();
  const replaced = await first;
  assert.equal(replaced.status, 409);
  assert.deepEqual(await replaced.json(), {reason: 'replaced'});
  const asking = pageBroker.request();
  const {pedido} = await (await second).json();
  pageBroker.answer(pedido, {});
  await asking;
});

test('o corpo de /pagina-atual: caminho vazio vale (caderno sem arquivo); caminho relativo, pagina 0 e id torto não', () => {
  const parse = (value) => parsePageAnswer(Buffer.from(JSON.stringify(value)));
  const id = 'abcdef0123456789';
  assert.equal(parse({pedido: id, caminho: '', pagina: 1, nome: '', png: PNG_B64}).caminho, '');
  assert.equal(parse({pedido: id, caminho: 'rel/a.xopp', pagina: 1, png: PNG_B64}), null);
  assert.equal(parse({pedido: id, caminho: '/c/a.pdf', pagina: 1, png: PNG_B64}), null);
  assert.equal(parse({pedido: id, caminho: '', pagina: 0, png: PNG_B64}), null);
  assert.equal(parse({pedido: 'x/../y', caminho: '', pagina: 1, png: PNG_B64}), null);
  assert.equal(parse({pedido: id, erro: 'qualquer-coisa'}), null);
  assert.equal(parse({pedido: id, caminho: '', pagina: 1, png: '***'}), null);
  assert.equal(parse({pedido: id, caminho: '', pagina: 1, nome: 'a\u0007b', png: PNG_B64}).nome, 'a b');
  assert.equal(parsePageAnswer(null), null);
});

test('requestAmbitusPage autoriza o caderno que existe e esconde o caminho de um que sumiu', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'summa-ambitus-xopp-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const notebook = path.join(dir, 'Limites.xopp');
  fs.writeFileSync(notebook, 'x');
  const answered = (answer) => ({request: async () => ({ok: true, answer})});
  const allowed = new Set();
  const page = {caminho: notebook, pagina: 2, nome: 'Limites', png: PNG_B64};
  const got = await requestAmbitusPage(answered(page), {allowedXopp: allowed});
  assert.deepEqual(got, {ok: true, ...page});
  assert.equal(allowed.has(notebook), true, 'o caderno entrou na lista viva do ler_caderno');
  const gone = await requestAmbitusPage(answered(page), {allowedXopp: new Set(), isFile: () => false});
  assert.equal(gone.caminho, '', 'arquivo que não existe vira imagem, sem caminho');
  const unsaved = await requestAmbitusPage(answered({...page, caminho: ''}), {allowedXopp: allowed, isFile: () => { throw Error('não deve olhar o disco'); }});
  assert.equal(unsaved.caminho, '');
  assert.deepEqual(await requestAmbitusPage(answered({erro: 'sem-pagina'}), {allowedXopp: allowed}), {ok: false, reason: 'no-page'});
  assert.deepEqual(await requestAmbitusPage({request: async () => ({ok: false, reason: 'timeout'})}, {allowedXopp: allowed}), {ok: false, reason: 'timeout'});
});
