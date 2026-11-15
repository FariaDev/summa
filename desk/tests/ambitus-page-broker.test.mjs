/* O corretor dos pedidos de página ao Ambitus (Conferir pela ponte): um
   long-poll vale por vez, o pedido só vive até a resposta ou o teto, e
   "conectado" tem uma folga entre dois long-polls. Sem HTTP: o long-poll é um
   fake com nome (`fakePoll`), os tempos são curtos. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import './keep-loop-alive.mjs';

const require = createRequire(import.meta.url);
const {createPageBroker} = require('../ambitus-page-broker.cjs');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Um long-poll do Ambitus: guarda o que a Summa respondeu e deixa o teste fechar o socket. */
function fakePoll() {
  const poll = {replies: [], closeHandlers: []};
  poll.handle = {send: (code, payload) => { poll.replies.push({code, payload}); }, onClose: (fn) => { poll.closeHandlers.push(fn); }};
  poll.dropSocket = () => { for (const fn of poll.closeHandlers) fn(); };
  return poll;
}

function brokerWith(t, options = {}) {
  const changes = [];
  const ids = ['aaaaaaaaaaaa', 'bbbbbbbbbbbb', 'cccccccccccc'];
  const broker = createPageBroker({holdMs: 60, answerMs: 80, graceMs: 50, waitPollMs: 40, newId: () => ids.shift(), onLinkChange: (value) => changes.push(value), ...options});
  t.after(() => broker.close());
  return {broker, changes};
}

test('sem Ambitus pendurado, pedir a página falha na hora com not-connected', async (t) => {
  const {broker} = brokerWith(t);
  assert.equal(broker.connected(), false);
  assert.deepEqual(await broker.request(), {ok: false, reason: 'not-connected'});
});

test('o long-poll sem pedido termina em 204 após o tempo de espera', async (t) => {
  const {broker} = brokerWith(t);
  const poll = fakePoll();
  broker.poll(poll.handle);
  assert.equal(broker.connected(), true);
  await wait(100);
  assert.deepEqual(poll.replies, [{code: 204, payload: undefined}]);
});

test('o pedido responde o long-poll com {pedido} e a resposta do Ambitus fecha o pedido', async (t) => {
  const {broker} = brokerWith(t);
  const poll = fakePoll();
  broker.poll(poll.handle);
  const asking = broker.request();
  assert.deepEqual(poll.replies, [{code: 200, payload: {pedido: 'aaaaaaaaaaaa'}}]);
  assert.equal(broker.has('aaaaaaaaaaaa'), true);
  assert.equal(broker.answer('aaaaaaaaaaaa', {pagina: 2}), true);
  assert.deepEqual(await asking, {ok: true, answer: {pagina: 2}});
  assert.equal(broker.has('aaaaaaaaaaaa'), false, 'o id vale uma vez só');
  assert.equal(broker.answer('aaaaaaaaaaaa', {pagina: 3}), false);
});

test('pedido desconhecido ou nunca feito é recusado', async (t) => {
  const {broker} = brokerWith(t);
  assert.equal(broker.has('dddddddddddd'), false);
  assert.equal(broker.answer('dddddddddddd', {}), false);
  assert.equal(broker.fail('dddddddddddd'), false);
});

test('sem resposta em answerMs o pedido expira (timeout) e o id deixa de valer', async (t) => {
  const {broker} = brokerWith(t);
  broker.poll(fakePoll().handle);
  const outcome = await broker.request();
  assert.deepEqual(outcome, {ok: false, reason: 'timeout'});
  assert.equal(broker.answer('aaaaaaaaaaaa', {}), false, 'resposta tardia é recusada');
});

test('corpo inválido (fail) encerra o pedido na hora, sem esperar o teto', async (t) => {
  const {broker} = brokerWith(t, {answerMs: 5000});
  broker.poll(fakePoll().handle);
  const asking = broker.request();
  assert.equal(broker.fail('aaaaaaaaaaaa'), true);
  assert.deepEqual(await asking, {ok: false, reason: 'invalid'});
});

test('só um long-poll vale: o novo substitui o anterior, que recebe 409', async (t) => {
  const {broker} = brokerWith(t);
  const first = fakePoll();
  const second = fakePoll();
  broker.poll(first.handle);
  broker.poll(second.handle);
  assert.deepEqual(first.replies, [{code: 409, payload: {reason: 'replaced'}}]);
  const asking = broker.request();
  assert.deepEqual(second.replies, [{code: 200, payload: {pedido: 'aaaaaaaaaaaa'}}], 'o pedido vai ao long-poll novo');
  broker.answer('aaaaaaaaaaaa', {});
  await asking;
});

test('entre dois long-polls ainda conta como conectado; o pedido espera o próximo long-poll', async (t) => {
  const {broker} = brokerWith(t, {holdMs: 20});
  const first = fakePoll();
  broker.poll(first.handle);
  await wait(35);
  assert.equal(first.replies[0].code, 204);
  assert.equal(broker.connected(), true, 'dentro da folga');
  const asking = broker.request();
  const second = fakePoll();
  broker.poll(second.handle);
  assert.deepEqual(second.replies, [{code: 200, payload: {pedido: 'aaaaaaaaaaaa'}}]);
  broker.answer('aaaaaaaaaaaa', {});
  assert.equal((await asking).ok, true);
});

test('no vão, sem long-poll novo a tempo, o pedido falha com not-connected', async (t) => {
  const {broker} = brokerWith(t, {holdMs: 20});
  broker.poll(fakePoll().handle);
  await wait(35);
  assert.deepEqual(await broker.request(), {ok: false, reason: 'not-connected'});
});

test('passada a folga sem Ambitus, deixa de estar conectado e avisa a mudança', async (t) => {
  const {broker, changes} = brokerWith(t, {holdMs: 20});
  broker.poll(fakePoll().handle);
  assert.deepEqual(changes, [true]);
  await wait(150);
  assert.equal(broker.connected(), false);
  assert.deepEqual(changes, [true, false]);
});

test('o socket do Ambitus que cai desconecta na hora, sem folga', async (t) => {
  const {broker, changes} = brokerWith(t, {graceMs: 5000});
  const poll = fakePoll();
  broker.poll(poll.handle);
  poll.dropSocket();
  assert.equal(broker.connected(), false);
  assert.deepEqual(changes, [true, false]);
  assert.deepEqual(await broker.request(), {ok: false, reason: 'not-connected'});
});

test('close resolve o pedido em voo como closed e responde o long-poll pendurado', async (t) => {
  const {broker} = brokerWith(t, {answerMs: 5000});
  const poll = fakePoll();
  broker.poll(poll.handle);
  const asking = broker.request();
  broker.close();
  assert.deepEqual(await asking, {ok: false, reason: 'closed'});
  assert.equal(broker.connected(), false);
  broker.open();
  broker.poll(fakePoll().handle);
  assert.equal(broker.connected(), true, 'a ponte que sobe de novo volta a aceitar long-poll');
});
