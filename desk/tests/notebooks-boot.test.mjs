import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotebooksBoot} from '../src/notebooks-boot.mjs';

test('antes do primeiro uso nada é importado nem ligado', async () => {
  let imports = 0;
  let inits = 0;
  const boot = createNotebooksBoot({
    importModule: async () => {
      imports++;
      return {initDeskNotebooks: () => inits++};
    },
  });
  assert.equal(boot.ready(), false);
  assert.equal(boot.current(), null);
  assert.equal(imports, 0);
  assert.equal(inits, 0);
});

test('o primeiro uso importa e liga uma vez, mesmo com dois pedidos simultâneos', async () => {
  let imports = 0;
  const inits = [];
  const fake = {initDeskNotebooks: (closePops) => inits.push(closePops)};
  const boot = createNotebooksBoot({
    importModule: async () => {
      imports++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return fake;
    },
  });
  const closePops = () => {};
  const [first, second] = await Promise.all([boot.ensure(closePops), boot.ensure(closePops)]);
  assert.equal(first, fake);
  assert.equal(second, fake);
  assert.equal(imports, 1);
  assert.equal(inits.length, 1);
  assert.equal(inits[0], closePops);
  assert.equal(boot.ready(), true);
  assert.equal(boot.current(), fake);
  assert.equal(await boot.ensure(), fake);
  assert.equal(imports, 1);
  assert.equal(inits.length, 1);
});

test('falha no import não marca como pronto e a próxima abertura tenta de novo', async () => {
  let imports = 0;
  const boot = createNotebooksBoot({
    importModule: async () => {
      imports++;
      if (imports === 1) throw Error('arquivo faltando');
      return {initDeskNotebooks: () => {}};
    },
  });
  await assert.rejects(boot.ensure(() => {}), /arquivo faltando/);
  assert.equal(boot.ready(), false);
  assert.equal(boot.current(), null);
  const fake = await boot.ensure(() => {});
  assert.equal(fake.initDeskNotebooks !== undefined, true);
  assert.equal(boot.ready(), true);
  assert.equal(imports, 2);
});
