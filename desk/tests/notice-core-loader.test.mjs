import test from 'node:test';
import assert from 'node:assert/strict';
import {createNoticeCoreLoader} from '../src/notice-core-loader.mjs';

test('o núcleo de avisos desembrulha o default e reutiliza a carga', async () => {
  let imports = 0;
  const core = {seesLine: () => true};
  const load = createNoticeCoreLoader(async () => { imports++; return {default: core}; });
  assert.equal(imports, 0);
  assert.equal(load.current(), null);
  const [first, second] = await Promise.all([load.load(), load.load()]);
  assert.equal(first, core);
  assert.equal(second, core);
  assert.equal(await load.load(), core);
  assert.equal(load.current(), core);
  assert.equal(imports, 1);
});
