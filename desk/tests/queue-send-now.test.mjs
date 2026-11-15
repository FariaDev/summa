/* Regressão da #36: a fila segurada numa conversa de entrega incerta não pode
   oferecer um "Enviar agora" que o host vai recusar. A decisão de começar um
   envio é a do núcleo (`canBegin`, lei `agentdelivery_comecar_incerto`); aqui
   se prova o estado da ação: à vista, bloqueada e sem esconder a fila. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {sendNowState} from '../src/queue-send-now.mjs';

test('fila segurada sem incerteza oferece o "Enviar agora"', () => {
  assert.deepEqual(sendNowState({held: true, count: 2, uncertain: false}), {visible: true, blocked: false});
  assert.deepEqual(sendNowState({held: true, count: 1, uncertain: false}), {visible: true, blocked: false});
});

test('conversa incerta mantém a ação à vista, mas bloqueada', () => {
  assert.deepEqual(sendNowState({held: true, count: 2, uncertain: true}), {visible: true, blocked: true});
  assert.deepEqual(sendNowState({held: true, count: 1, uncertain: true}), {visible: true, blocked: true}, 'um item só também bloqueia');
});

test('sem fila segurada não há ação para bloquear', () => {
  assert.deepEqual(sendNowState({held: false, count: 2, uncertain: true}), {visible: false, blocked: false});
  assert.deepEqual(sendNowState({held: true, count: 0, uncertain: true}), {visible: false, blocked: false});
});
