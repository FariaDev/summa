/* Mandar a página do Ambitus ao chat lateral: a rota `POST /mandar-pagina` da
   ponte (JSON com caminho e página, mesmo token da leitura), o main que
   autoriza o caderno, chama a janela e manda a miniatura depois, e o renderer
   que põe a página como cartão na bandeja de anexos (campo vazio, caminho
   escondido no cartão). Não depende da leitura da tinta estar ligada. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {notebookCardOf, createAmbitusPage} from '../src/ambitus-page.mjs';

const require = createRequire(import.meta.url);
const {createAmbitusBridgeHost, parsePageRequest} = require('../ambitus-bridge-host.cjs');
const {sendPageToSidechat, sendPageThumbnail} = require('../ambitus-bridge-wiring.cjs');

function hostWith(t, sendPage) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'summa-ambitus-page-'));
  const host = createAmbitusBridgeHost({runtime, deskState: () => ({inkReading: false}), readText: async () => ({text: '', reason: null}), pickModel: null, sendPage});
  t.after(async () => { await host.close().catch(() => {}); fs.rmSync(runtime, {recursive: true, force: true}); });
  return host;
}

async function send(host, body, {token, contentType = 'application/json'} = {}) {
  const file = JSON.parse(fs.readFileSync(host.bridgeFile, 'utf8'));
  const response = await fetch(`http://127.0.0.1:${file.port}/mandar-pagina`, {method: 'POST', headers: {'content-type': contentType, 'x-summa-token': token ?? file.token}, body: typeof body === 'string' ? body : JSON.stringify(body)});
  return {status: response.status, json: await response.json()};
}

test('o pedido é um .xopp de caminho absoluto e uma página contada de 1', () => {
  const ok = (v) => parsePageRequest(Buffer.from(JSON.stringify(v)));
  assert.deepEqual(ok({caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites'}), {caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites'});
  assert.deepEqual(ok({caminho: '/c/a.XOPP', pagina: 1}), {caminho: '/c/a.XOPP', pagina: 1, nome: ''});
  assert.equal(ok({caminho: 'rel/a.xopp', pagina: 1}), null);
  assert.equal(ok({caminho: '/c/a.pdf', pagina: 1}), null);
  assert.equal(ok({caminho: '/c/a\n.xopp', pagina: 1}), null);
  assert.equal(ok({caminho: '/c/a.xopp', pagina: 0}), null);
  assert.equal(ok({caminho: '/c/a.xopp', pagina: 1.5}), null);
  assert.equal(ok({caminho: '/c/a.xopp', pagina: '2'}), null);
  assert.equal(ok([1]), null);
  assert.equal(parsePageRequest(Buffer.from('{quebrado')), null);
  assert.equal(parsePageRequest(null), null);
  assert.equal(ok({caminho: '/c/a.xopp', pagina: 1, nome: 'a\u0007b'}).nome, 'a b');
});

test('a rota entrega a página ao main, mesmo com a leitura da tinta desligada', async (t) => {
  const got = [];
  const host = hostWith(t, (page) => { got.push(page); return {ok: true}; });
  await host.start();
  const r = await send(host, {caminho: '/c/Limites.xopp', pagina: 3, nome: 'Limites — aula 3'});
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, {ok: true});
  assert.deepEqual(got, [{caminho: '/c/Limites.xopp', pagina: 3, nome: 'Limites — aula 3'}]);
});

test('sem token, com outro tipo ou com corpo ruim, nada chega ao main', async (t) => {
  const got = [];
  const host = hostWith(t, (page) => { got.push(page); return {ok: true}; });
  await host.start();
  assert.equal((await send(host, {caminho: '/c/a.xopp', pagina: 1}, {token: 'x'})).status, 403);
  assert.equal((await send(host, {caminho: '/c/a.xopp', pagina: 1}, {contentType: 'text/plain'})).status, 400);
  assert.equal((await send(host, {caminho: 'a.xopp', pagina: 1})).status, 400);
  assert.equal((await send(host, 'x'.repeat(20000))).status, 400);
  assert.deepEqual(got, []);
});

test('o motivo do main volta ao Ambitus', async (t) => {
  const host = hostWith(t, () => ({reason: 'no-window'}));
  await host.start();
  assert.deepEqual((await send(host, {caminho: '/c/a.xopp', pagina: 1})).json, {reason: 'no-window'});
});

function fakeWin() {
  const calls = [];
  return {calls, win: {isDestroyed: () => false, isMinimized: () => true, restore: () => calls.push('restore'), show: () => calls.push('show'), focus: () => calls.push('focus'), webContents: {send: (channel, data) => calls.push([channel, data])}}};
}

test('o main autoriza o caderno, traz a janela e manda ao renderer', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'summa-ambitus-xopp-'));
  const file = path.join(dir, 'Limites.xopp');
  fs.writeFileSync(file, 'x');
  try {
    const allowed = new Set();
    const {calls, win} = fakeWin();
    assert.deepEqual(sendPageToSidechat({caminho: file, pagina: 2, nome: 'Limites'}, {allowedXopp: allowed, win: () => win}), {ok: true});
    assert.ok(allowed.has(file));
    assert.deepEqual(calls, ['restore', 'show', 'focus', ['ambitus-page', {caminho: file, pagina: 2, nome: 'Limites'}]]);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('caderno que não existe ou janela fechada não autorizam nada', () => {
  const allowed = new Set();
  const {calls, win} = fakeWin();
  assert.deepEqual(sendPageToSidechat({caminho: '/nao/existe.xopp', pagina: 1, nome: ''}, {allowedXopp: allowed, win: () => win}), {reason: 'not-found'});
  assert.deepEqual(sendPageToSidechat({caminho: '/c/a.xopp', pagina: 1, nome: ''}, {allowedXopp: allowed, win: () => null, isFile: () => true}), {reason: 'no-window'});
  assert.equal(allowed.size, 0);
  assert.deepEqual(calls, []);
});

function wiredWin() {
  const sent = [];
  return {sent, win: {isDestroyed: () => false, isMinimized: () => false, restore() {}, show() {}, focus() {}, webContents: {send: (channel, data) => sent.push([channel, data])}}};
}

test('a miniatura segue depois da resposta, num evento à parte, pelo mesmo leitor do ler_caderno', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'summa-ambitus-thumb-'));
  const file = path.join(dir, 'Limites.xopp');
  fs.writeFileSync(file, 'x');
  try {
    const {sent, win} = wiredWin();
    const reads = [];
    let release = () => {};
    const gate = new Promise((resolve) => { release = resolve; });
    const readNotebook = async (raw) => { reads.push(raw); await gate; return {image: 'QUJD'}; };
    const answer = sendPageToSidechat({caminho: file, pagina: 2, nome: 'Limites'}, {allowedXopp: new Set(), win: () => win, readNotebook});
    assert.deepEqual(answer, {ok: true}, 'o Ambitus recebe a resposta sem esperar a renderização');
    assert.deepEqual(sent.map(([channel]) => channel), ['ambitus-page']);
    assert.deepEqual(reads, [{caminho: file, pagina: 2}]);
    release();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(sent.at(-1), ['ambitus-page-thumb', {caminho: file, pagina: 2, thumb: 'data:image/png;base64,QUJD'}]);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('renderização que falha, volta vazia ou chega com a janela fechada não manda miniatura', async () => {
  const logs = [];
  const {sent, win} = wiredWin();
  const page = {caminho: '/c/a.xopp', pagina: 1};
  assert.equal(await sendPageThumbnail(page, {readNotebook: async () => { throw Error('xournalpp saiu com código 1'); }, win: () => win, log: (line) => logs.push(line)}), false);
  assert.equal(await sendPageThumbnail(page, {readNotebook: async () => ({image: ''}), win: () => win}), false);
  assert.equal(await sendPageThumbnail(page, {readNotebook: async () => ({image: 'QUJD'}), win: () => ({isDestroyed: () => true})}), false);
  assert.equal(await sendPageThumbnail(page, {readNotebook: async () => ({image: 'QUJD'}), win: () => null}), false);
  assert.deepEqual(sent, []);
  assert.match(logs[0], /sem miniatura da página 1: xournalpp saiu com código 1/);
});

test('o cartão da página tem o caderno, a página e o caminho; o que não é página não vira cartão', () => {
  assert.deepEqual(notebookCardOf({caminho: '/c/Limites — aula 3.xopp', pagina: 2, nome: ''}), {caminho: '/c/Limites — aula 3.xopp', pagina: 2, nome: 'Limites — aula 3'});
  assert.deepEqual(notebookCardOf({caminho: '/c/a.xopp', pagina: 1, nome: '  Cálculo  '}), {caminho: '/c/a.xopp', pagina: 1, nome: 'Cálculo'});
  assert.equal(notebookCardOf({caminho: 'C:\\cadernos\\Aula.xopp', pagina: 1, nome: ''}).nome, 'Aula');
  assert.equal(notebookCardOf({caminho: '/c/a.xopp', pagina: 0}), null);
  assert.equal(notebookCardOf({caminho: '/c/a.xopp', pagina: '2'}), null);
  assert.equal(notebookCardOf({caminho: '', pagina: 1}), null);
  assert.equal(notebookCardOf(null), null);
});

test('o renderer abre o lateral e espera ele montar para pôr o cartão na bandeja', async () => {
  const toasts = [];
  let opened = 0;
  let tries = 0;
  const cards = [];
  const receive = createAmbitusPage({ready: () => true, open: () => { opened++; }, attach: async (card) => { tries++; if (tries < 3) return false; cards.push(card); return true; }, toast: (m) => toasts.push(m), wait: async () => {}});
  assert.equal(await receive({caminho: '/c/a.xopp', pagina: 1, nome: 'a'}), true);
  assert.equal(opened, 1);
  assert.deepEqual(cards, [{caminho: '/c/a.xopp', pagina: 1, nome: 'a'}]);
  assert.deepEqual(toasts, []);
});

test('pedido que não é uma página não abre nada nem avisa', async () => {
  const receive = createAmbitusPage({ready: () => assert.fail('não consulta'), open: () => assert.fail('não abre'), attach: async () => assert.fail('não anexa'), toast: () => assert.fail('não avisa')});
  assert.equal(await receive({caminho: '/c/a.xopp', pagina: 0}), false);
  assert.equal(await receive(undefined), false);
});

test('sem matéria aberta ou sem o lateral montar, um aviso e nenhum cartão', async () => {
  const toasts = [];
  const noCourse = createAmbitusPage({ready: () => false, open: () => assert.fail('não abre'), attach: async () => assert.fail('não anexa'), toast: (m) => toasts.push(m)});
  assert.equal(await noCourse({caminho: '/c/a.xopp', pagina: 1}), false);
  const never = createAmbitusPage({ready: () => true, open: () => {}, attach: async () => false, toast: (m) => toasts.push(m), wait: async () => {}, tries: 3});
  assert.equal(await never({caminho: '/c/a.xopp', pagina: 1}), false);
  assert.equal(toasts.length, 2);
  assert.ok(toasts.every((m) => typeof m === 'string' && m.length > 0));
});
