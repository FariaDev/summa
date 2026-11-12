import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeFsTree} from './fake-fs-tree.mjs';

const require = createRequire(import.meta.url);
const {registerNotebooksHost} = require('../notebooks-host.cjs');

/* Biblioteca de cadernos, só a lista (#133): RAISE recursivo atrás de `.xopp`
   na pasta de cada matéria (o mesmo molde do `listPdfs` de `courses.cjs`),
   sem ler conteúdo. Decisões (não reabertas): symlink para fora da matéria
   NÃO aparece — listar um que a abertura recusaria seria item morto; pasta
   "ignorada" é a que o `listPdfs` já ignora, a de profundidade > 6. */

function createFakeIpcMain() {
  const handlers = new Map();
  return {
    handle: (channel, fn) => handlers.set(channel, fn),
    invoke: (channel, payload) => handlers.get(channel)({}, payload),
  };
}

function setup() {
  const fakeFs = fakeFsTree({
    '/vault/Courses/Calculo': {
      'aula-raiz.xopp': 1000,
      'apostila.pdf': 2000,
      'sub': {'aula-sub.xopp': 3000},
      'a': {'b': {'c': {'d': {'e': {'f': {'h': {'g.xopp': 9000}}}}}}},
    },
    '/vault/Courses/Fisica': {
      'fis-raiz.xopp': 2500,
    },
    '/vault/livre': {'fora.xopp': 4000},
  }, {
    symlinks: {
      '/vault/Courses/Calculo/atalho.xopp': '/vault/livre/fora.xopp',
      '/vault/Courses/Fisica/dentro.xopp': '/vault/Courses/Fisica/fis-raiz.xopp',
    },
  });
  const courses = [
    {id: 'Calculo', name: 'Cálculo', path: '/vault/Courses/Calculo'},
    {id: 'Fisica', name: 'Física', path: '/vault/Courses/Fisica'},
  ];
  const ipcMain = createFakeIpcMain();
  registerNotebooksHost({
    ipcMain,
    courses: () => courses,
    allowedXopp: new Set(),
    config: () => ({}),
    shell: {},
    fs: fakeFs,
    spawn: () => {
      throw Error('lista não abre processo');
    },
    platform: 'linux',
  });
  return {ipcMain, fakeFs};
}

test('lista .xopp de cada matéria, ordem por mtime, só stat/readdir', async () => {
  const {ipcMain, fakeFs} = setup();
  const result = await ipcMain.invoke('notebooks-list');
  const names = result.notebooks.map((n) => n.name);
  /* fora.xopp (fora das matérias), apostila.pdf, g.xopp (profundidade 7) e
     atalho.xopp (symlink que escapa da matéria) não aparecem. */
  assert.deepEqual(names, ['aula-sub.xopp', 'fis-raiz.xopp', 'aula-raiz.xopp']);
  const calc = result.notebooks[0];
  assert.equal(calc.courseId, 'Calculo');
  assert.equal(calc.folder, 'sub');
  assert.equal(calc.mtimeMs, 3000);
  assert.equal(calc.path, path.join('/vault/Courses/Calculo', 'sub', 'aula-sub.xopp'));
  assert.equal(result.notebooks[1].courseId, 'Fisica');
  assert.equal(result.notebooks[1].folder, '');
  assert.equal(result.notebooks[2].folder, '');
  const kinds = [...new Set(fakeFs.calls.map(([fn]) => fn))].sort();
  assert.deepEqual(kinds, ['readdirSync', 'realpathSync', 'statSync']);
});
