import test from 'node:test';
import assert from 'node:assert/strict';
import {createFreeModelsLoader, mountFreeModelsBoot} from '../src/free-models-loader.mjs';

const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

function fakeModule(calls) {
  return {
    initFreeModels: () => calls.push(['init']),
    openFreeModelsFlow: async () => calls.push(['open']),
    paintFreeSettings: async () => calls.push(['paint']),
    confirmPaidModel: async () => {
      calls.push(['confirm']);
      return true;
    },
  };
}

test('modelos grátis só importam quando a interface pede e inicializam uma vez', async () => {
  let imports = 0;
  const calls = [];
  const loader = createFreeModelsLoader(async () => {
    imports++;
    return fakeModule(calls);
  });
  assert.equal(imports, 0);
  await loader.paintSettings();
  assert.equal(await loader.confirmPaid(), true);
  await loader.openFlow();
  assert.equal(imports, 1);
  assert.deepEqual(calls, [['init'], ['paint'], ['confirm'], ['open']]);
});

test('o pedido "UseFreeModels" carrega e abre uma vez; depois o módulo assume', async () => {
  let imports = 0;
  const calls = [];
  const loader = createFreeModelsLoader(async () => {
    imports++;
    return fakeModule(calls);
  });
  const win = new EventTarget();
  const unbind = mountFreeModelsBoot({loader, window: win, toast: () => {}});
  win.dispatchEvent(new Event('desk-open-free-models'));
  win.dispatchEvent(new Event('desk-open-free-models'));
  await tick();
  assert.equal(imports, 1);
  assert.deepEqual(calls, [['init'], ['open']]);
  win.dispatchEvent(new Event('desk-open-free-models'));
  await tick();
  assert.deepEqual(calls, [['init'], ['open']], 'com o módulo carregado, o ouvinte dele cuida do evento');
  unbind();
});

test('falha ao importar vira toast e o desmonte tira o ouvinte', async () => {
  const toasts = [];
  const loader = createFreeModelsLoader(async () => {
    throw Error('sem modelos grátis');
  });
  const win = new EventTarget();
  const unbind = mountFreeModelsBoot({loader, window: win, toast: (message) => toasts.push(message)});
  win.dispatchEvent(new Event('desk-open-free-models'));
  await tick();
  assert.deepEqual(toasts, ['sem modelos grátis']);
  unbind();

  let imports = 0;
  const other = createFreeModelsLoader(async () => {
    imports++;
    return fakeModule([]);
  });
  const win2 = new EventTarget();
  const off = mountFreeModelsBoot({loader: other, window: win2, toast: () => {}});
  off();
  win2.dispatchEvent(new Event('desk-open-free-models'));
  await tick();
  assert.equal(imports, 0);
});
