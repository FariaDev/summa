/* Chat lateral no primeiro uso (#desempenho): o import pode terminar depois de
   uma troca de matéria (o `attachPanels` recria o `body`) ou depois de a área
   de apoio sair do modo chat. A montagem tem de esperar o import e usar o corpo
   ATUAL; sem isso o `<div>` nasce num `body` desconectado. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';

installDom();
const {mountSidechatWhenLoaded} = await import('../src/support.mjs');

function deferred() {
  let release;
  const promise = new Promise((resolve) => { release = resolve; });
  return {promise, release};
}

test('import lento monta no body atual, não no que existia no pedido', async () => {
  const oldBody = {id: 'body-velho'};
  const newBody = {id: 'body-novo'};
  let current = oldBody;
  let mounted = null;
  const importing = deferred();
  const pending = mountSidechatWhenLoaded({
    load: () => importing.promise,
    mount: (container) => { mounted = container; },
    body: () => current,
    isChatOpen: () => true,
  });
  current = newBody;
  importing.release();
  assert.equal(await pending, true);
  assert.equal(mounted, newBody, 'montou no corpo da matéria que está na tela');
});

test('saiu do modo chat durante o import: não monta', async () => {
  let mounted = null;
  const importing = deferred();
  const pending = mountSidechatWhenLoaded({
    load: () => importing.promise,
    mount: (container) => { mounted = container; },
    body: () => ({id: 'body'}),
    isChatOpen: () => false,
  });
  importing.release();
  assert.equal(await pending, false);
  assert.equal(mounted, null, 'a área de apoio já não é o chat');
});

test('sem body (grid desmontado) durante o import: não monta', async () => {
  let mounted = null;
  const importing = deferred();
  const pending = mountSidechatWhenLoaded({
    load: () => importing.promise,
    mount: (container) => { mounted = container; },
    body: () => null,
    isChatOpen: () => true,
  });
  importing.release();
  assert.equal(await pending, false);
  assert.equal(mounted, null);
});
