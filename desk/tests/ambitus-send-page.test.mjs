/* Mandar a página do Ambitus ao tutor principal: a rota `POST /mandar-pagina`
   da ponte (JSON com caminho e página, mesmo token da leitura), o main que
   autoriza o caderno, chama a janela e manda a miniatura depois, e o renderer
   que põe a página como cartão na bandeja do tutor (caminho escondido no
   cartão). Não depende da leitura da tinta estar ligada. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import {notebookCardOf, createAmbitusPage} from '../src/ambitus-page.mjs';
import {decodePng, pixelAt} from './png-pixels.mjs';

const require = createRequire(import.meta.url);
const {ANSWER_CAP, createAmbitusBridgeHost, parsePageRequest} = require('../ambitus-bridge-host.cjs');
const {sendPageToSidechat, sendPageThumbnail} = require('../ambitus-bridge-wiring.cjs');

/* 1×1 RGB opaco: o achatamento da #105 devolve o original e os testes de
   passagem comparam os mesmos bytes; o fundo transparente tem teste próprio. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC', 'base64');
const PNG_B64 = PNG.toString('base64');
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Um pedaço do PNG: tamanho + tipo + dados + CRC. @param {string} type @param {Buffer} data */
function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(data, zlib.crc32(Buffer.from(type, 'latin1'))) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

/** PNG 4×4 RGBA com o fundo transparente e um pixel preto opaco em (1,1), o caso da #105. */
function transparentInkPng() {
  const width = 4;
  const height = 4;
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  const ink = 1 * (stride + 1) + 1 + 1 * 4;
  raw[ink + 3] = 255;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([SIGNATURE, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

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

test('o png da página é opcional e, quando vem, tem a validação de /pagina-atual', () => {
  const ok = (v) => parsePageRequest(Buffer.from(JSON.stringify(v)));
  assert.deepEqual(ok({caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites', png: PNG_B64}), {caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites', png: PNG_B64});
  assert.equal('png' in ok({caminho: '/c/Limites.xopp', pagina: 2}), false, 'sem o campo, o pedido é o de hoje');
  assert.equal(ok({caminho: '/c/Limites.xopp', pagina: 2, png: '***'}), null);
  assert.equal(ok({caminho: '/c/Limites.xopp', pagina: 2, png: Buffer.from('isto não é png').toString('base64')}), null, 'base64 sem a assinatura de PNG não passa');
  assert.equal(ok({caminho: '/c/Limites.xopp', pagina: 2, png: ''}), null);
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
  assert.equal((await send(host, {caminho: '/c/a.xopp', pagina: 1, png: '***'})).status, 400, 'png inválido não vira pedido');
  assert.deepEqual(got, []);
});

test('com png válido a ponte entrega o PNG ao main; grande demais é 413', async (t) => {
  const got = [];
  const host = hostWith(t, (page) => { got.push(page); return {ok: true}; });
  await host.start();
  assert.deepEqual(await send(host, {caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites', png: PNG_B64}), {status: 200, json: {ok: true}});
  assert.deepEqual(got, [{caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites', png: PNG_B64}]);
  const huge = JSON.stringify({caminho: '/c/a.xopp', pagina: 1, png: 'A'.repeat(ANSWER_CAP + 1024)});
  assert.equal((await send(host, huge)).status, 413);
  assert.equal(got.length, 1, 'o corpo grande não chega ao main');
});

test('o png de /mandar-pagina chega ao main achatado sobre branco (#105)', async (t) => {
  const got = [];
  const host = hostWith(t, (page) => { got.push(page); return {ok: true}; });
  await host.start();
  const transparent = transparentInkPng();
  assert.deepEqual(await send(host, {caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites', png: transparent.toString('base64')}), {status: 200, json: {ok: true}});
  assert.equal(got.length, 1);
  const flat = decodePng(got[0].png);
  assert.deepEqual(pixelAt(flat, 0, 0), {r: 255, g: 255, b: 255, a: 255}, 'o fundo transparente sai branco');
  assert.deepEqual(pixelAt(flat, 1, 1), {r: 0, g: 0, b: 0, a: 255}, 'a tinta preta continua preta');
  for (let y = 0; y < flat.height; y += 1) {
    for (let x = 0; x < flat.width; x += 1) assert.equal(pixelAt(flat, x, y).a, 255, `o pixel (${x},${y}) é opaco`);
  }
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

test('o PNG que veio no pedido vira a imagem do cartão, sem renderizar o disco', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'summa-ambitus-png-'));
  const file = path.join(dir, 'Limites.xopp');
  fs.writeFileSync(file, 'x');
  try {
    const {sent, win} = wiredWin();
    const readNotebook = async () => assert.fail('com o PNG do Ambitus não renderiza de novo');
    assert.deepEqual(sendPageToSidechat({caminho: file, pagina: 2, nome: 'Limites', png: PNG_B64}, {allowedXopp: new Set(), win: () => win, readNotebook}), {ok: true});
    assert.deepEqual(sent, [
      ['ambitus-page', {caminho: file, pagina: 2, nome: 'Limites'}],
      ['ambitus-page-thumb', {caminho: file, pagina: 2, thumb: `data:image/png;base64,${PNG_B64}`}],
    ]);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

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

test('o renderer põe a página na bandeja do tutor, sem abrir o chat lateral', async () => {
  const toasts = [];
  const cards = [];
  const receive = createAmbitusPage({ready: () => true, attachTutor: (card) => { cards.push(card); return true; }, toast: (m) => toasts.push(m)});
  assert.equal(await receive({caminho: '/c/a.xopp', pagina: 1, nome: 'a'}), true);
  assert.deepEqual(cards, [{caminho: '/c/a.xopp', pagina: 1, nome: 'a'}]);
  assert.deepEqual(toasts, []);
});

test('pedido que não é uma página não abre nada nem avisa', async () => {
  const receive = createAmbitusPage({ready: () => assert.fail('não consulta'), attachTutor: () => assert.fail('não anexa'), toast: () => assert.fail('não avisa')});
  assert.equal(await receive({caminho: '/c/a.xopp', pagina: 0}), false);
  assert.equal(await receive(undefined), false);
});

test('sem matéria aberta ou com o tutor recusando, um aviso e nenhum cartão', async () => {
  const toasts = [];
  const noCourse = createAmbitusPage({ready: () => false, attachTutor: () => assert.fail('não anexa'), toast: (m) => toasts.push(m)});
  assert.equal(await noCourse({caminho: '/c/a.xopp', pagina: 1}), false);
  const refused = createAmbitusPage({ready: () => true, attachTutor: () => false, toast: (m) => toasts.push(m)});
  assert.equal(await refused({caminho: '/c/a.xopp', pagina: 1}), false);
  assert.equal(toasts.length, 2);
  assert.ok(toasts.every((m) => typeof m === 'string' && m.length > 0));
});

test('o recorte do Ambitus (com o png) chega ao main; sem png, ou com um trecho torto, o pedido é recusado', async (t) => {
  const got = [];
  const host = hostWith(t, (page) => { got.push(page); return {ok: true}; });
  await host.start();
  const recorte = {x: 0, y: 286, largura: 595, altura: 555};
  assert.deepEqual(await send(host, {caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites', png: PNG_B64, recorte}), {status: 200, json: {ok: true}});
  assert.deepEqual(got, [{caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites', png: PNG_B64, recorte}]);
  assert.equal((await send(host, {caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites', recorte})).status, 400, 'recorte sem png não vira pedido');
  for (const bad of [{...recorte, largura: 0}, {...recorte, x: -1}, {...recorte, y: '286'}, {...recorte, altura: 'NaN'}]) {
    assert.equal((await send(host, {caminho: '/c/Limites.xopp', pagina: 2, png: PNG_B64, recorte: bad})).status, 400, JSON.stringify(bad));
  }
  assert.equal(got.length, 1, 'nenhum trecho torto chegou ao main');
});

test('o cartão do Ambitus leva o recorte no evento ambitus-page; sem ele, o evento é o de sempre', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'summa-ambitus-recorte-'));
  const file = path.join(dir, 'Limites.xopp');
  fs.writeFileSync(file, 'x');
  try {
    const recorte = {x: 0, y: 286, largura: 595, altura: 555};
    const withExcerpt = wiredWin();
    assert.deepEqual(sendPageToSidechat({caminho: file, pagina: 2, nome: 'Limites', png: PNG_B64, recorte}, {allowedXopp: new Set(), win: () => withExcerpt.win}), {ok: true});
    assert.deepEqual(withExcerpt.sent[0], ['ambitus-page', {caminho: file, pagina: 2, nome: 'Limites', recorte}]);
    const whole = wiredWin();
    assert.deepEqual(sendPageToSidechat({caminho: file, pagina: 2, nome: 'Limites', png: PNG_B64}, {allowedXopp: new Set(), win: () => whole.win}), {ok: true});
    assert.deepEqual(whole.sent[0], ['ambitus-page', {caminho: file, pagina: 2, nome: 'Limites'}]);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
