/* Índice persistente da tinta dos cadernos (#158, passo 2): guarda em
   módulo próprio (`notebook-ink-index.cjs`) com carga assíncrona, escrita
   atômica, poda de caderno removido e validação sem derrubar. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {
  createNotebookInkIndex, cutInkText, parseIndexFile,
  INK_INDEX_DIR, INK_INDEX_FILE, INK_INDEX_MAX_BYTES,
} = require('../notebook-ink-index.cjs');

function tmpRuntime() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tinta-idx-'));
}

function indexFileOf(runtime) {
  return path.join(runtime, INK_INDEX_DIR, INK_INDEX_FILE);
}

test('cutInkText corta no limite do texto extraído', () => {
  assert.equal(cutInkText('curto'), 'curto');
  assert.equal(cutInkText('x'.repeat(50000)).length, 20000);
  assert.equal(cutInkText(null), '');
  assert.equal(cutInkText(undefined), '');
});

test('parseIndexFile valida versão, campos e trunca texto gigante', () => {
  const valid = parseIndexFile(JSON.stringify({version: 1, files: {'/a.xopp': {hashes: ['h'], texts: ['oi'], mtimeMs: 1, size: 2}}}));
  assert.equal(valid.rewrite, false);
  assert.deepEqual(valid.files['/a.xopp'], {hashes: ['h'], texts: ['oi'], mtimeMs: 1, size: 2});
  const invalid = parseIndexFile('{isto não é JSON');
  assert.equal(invalid.rewrite, true);
  assert.deepEqual(Object.keys(invalid.files), []);
  const wrongVersion = parseIndexFile(JSON.stringify({version: 99, files: {}}));
  assert.equal(wrongVersion.rewrite, true);
  assert.deepEqual(Object.keys(wrongVersion.files), []);
  const huge = parseIndexFile(JSON.stringify({version: 1, files: {'/a.xopp': {hashes: [], texts: ['x'.repeat(50000)]}}}));
  assert.equal(huge.files['/a.xopp'].texts[0].length, 20000);
  const wrong = parseIndexFile(JSON.stringify({version: 1, files: {'/a.xopp': {hashes: [42], texts: [42], mtimeMs: 'ontem', size: {}}}}));
  assert.deepEqual(wrong.files['/a.xopp'], {hashes: [''], texts: ['']});
});

test('parseIndexFile guarda __proto__ como chave própria, sem poluir protótipo', () => {
  const raw = '{"version":1,"files":{"__proto__":{"hashes":["h1"],"texts":["segredo"]},"/ok.xopp":{"hashes":[],"texts":[]}}}';
  const parsed = parseIndexFile(raw);
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.files, '__proto__'), '__proto__ é propriedade própria');
  assert.deepEqual(parsed.files['__proto__'].texts, ['segredo']);
  assert.equal(({}).segredo, undefined, 'o protótipo global não ganha lixo');
  assert.equal(Object.getPrototypeOf(parsed.files), null, 'o mapa do índice não tem protótipo');
});

test('o mapa do índice do guarda nasce sem protótipo', async () => {
  const runtime = tmpRuntime();
  try {
    const store = createNotebookInkIndex({indexFile: indexFileOf(runtime), listNotebooks: () => []});
    assert.equal(Object.getPrototypeOf(store.files), null, 'Object.create(null) para os mapas do índice');
    await store.ensureIndexLoaded();
    assert.equal(Object.getPrototypeOf(store.files), null);
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('guarda carrega, poda e grava atômico com 0600', async () => {
  const runtime = tmpRuntime();
  try {
    const file = indexFileOf(runtime);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify({version: 1, files: {'/fica.xopp': {hashes: [], texts: ['fica']}, '/sai.xopp': {hashes: [], texts: ['sai']}}}));
    const writes = [];
    const store = createNotebookInkIndex({
      indexFile: file,
      listNotebooks: () => [{path: '/fica.xopp'}],
      fsImpl: {
        ...fs,
        promises: {
          ...fs.promises,
          writeFile: (...args) => {
            writes.push(String(args[0]));
            return fs.promises.writeFile(...args);
          },
        },
      },
    });
    await store.ensureIndexLoaded();
    assert.deepEqual(store.files['/fica.xopp'].texts, ['fica']);
    store.pruneToLibrary();
    assert.ok(!Object.prototype.hasOwnProperty.call(store.files, '/sai.xopp'), 'poda tira o que saiu da biblioteca');
    store.markDirty();
    await store.saveIndex();
    const back = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(Object.keys(back.files), ['/fica.xopp']);
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(file).mode & 0o777, 0o600);
      assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
    }
    assert.ok(writes.length >= 1, 'grava via tmp');
    assert.equal(fs.readdirSync(path.dirname(file)).filter((entry) => entry.includes('.tmp-')).length, 0, 'nenhum tmp sobra');
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('pasta existente 0755 vira 0700 ao gravar', {skip: process.platform === 'win32' && 'bits de modo POSIX (0700/0755) não existem no Windows'}, async () => {
  const runtime = tmpRuntime();
  try {
    const file = indexFileOf(runtime);
    const inkDir = path.dirname(file);
    fs.mkdirSync(inkDir, {recursive: true});
    fs.chmodSync(inkDir, 0o755);
    assert.equal(fs.statSync(inkDir).mode & 0o777, 0o755, 'pré-condição: 0755');
    const store = createNotebookInkIndex({indexFile: file, listNotebooks: () => [{path: '/a.xopp'}]});
    await store.ensureIndexLoaded();
    store.files['/a.xopp'] = {hashes: [], texts: ['oi']};
    store.markDirty();
    await store.saveIndex();
    assert.equal(fs.statSync(inkDir).mode & 0o777, 0o700, 'chmod 0700 endurece a pasta existente');
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('tmp carrega pid e aleatório, sem colidir entre gravações', async () => {
  const runtime = tmpRuntime();
  try {
    const file = indexFileOf(runtime);
    const writes = [];
    const store = createNotebookInkIndex({
      indexFile: file,
      listNotebooks: () => [{path: '/a.xopp'}],
      fsImpl: {
        ...fs,
        promises: {
          ...fs.promises,
          writeFile: (...args) => {
            writes.push(String(args[0]));
            return fs.promises.writeFile(...args);
          },
        },
      },
    });
    await store.ensureIndexLoaded();
    store.files['/a.xopp'] = {hashes: [], texts: ['um']};
    store.markDirty();
    await store.saveIndex();
    store.files['/a.xopp'] = {hashes: [], texts: ['dois']};
    store.markDirty();
    await store.saveIndex();
    assert.ok(writes.length >= 2, 'duas gravações viram dois tmp');
    assert.notEqual(writes[0], writes[1], 'tmp não colide no mesmo pid');
    for (const tmp of writes) {
      assert.ok(tmp.includes(`.tmp-${process.pid}-`), `tmp leva pid e aleatório (veio ${tmp})`);
      assert.match(tmp, /\.tmp-\d+-[a-f0-9]+$/, `tmp tem sufixo aleatório hex (veio ${tmp})`);
    }
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('não grava índice acima de 8 MB: corta as páginas mais antigas', async () => {
  const runtime = tmpRuntime();
  try {
    const file = indexFileOf(runtime);
    const oldPath = '/velho.xopp';
    const newPath = '/novo.xopp';
    const store = createNotebookInkIndex({indexFile: file, listNotebooks: () => [{path: oldPath}, {path: newPath}]});
    await store.ensureIndexLoaded();
    /* O texto em memória já foi cortado a 20000 por página, mas o adulterado
       pode ser gigante: a gravação não pode passar de 8 MB. */
    store.files[oldPath] = {hashes: ['h-old'], texts: ['A'.repeat(9 * 1024 * 1024)], mtimeMs: 1000, size: 1};
    store.files[newPath] = {hashes: ['h-new'], texts: ['novo'], mtimeMs: 2000, size: 1};
    store.markDirty();
    await store.saveIndex();
    assert.ok(fs.existsSync(file), 'grava alguma coisa');
    const written = fs.readFileSync(file, 'utf8');
    assert.ok(Buffer.byteLength(written) <= INK_INDEX_MAX_BYTES, `o índice gravado não passa de 8 MB (veio ${Buffer.byteLength(written)})`);
    const back = JSON.parse(written);
    assert.ok(newPath in back.files, 'o mais novo fica');
    assert.ok(!(oldPath in back.files), 'o mais antigo e gigante é cortado');
    assert.deepEqual(back.files[newPath].texts, ['novo']);
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('M1 (guarda): com isStopped verdadeiro, saveIndex não grava no disco', async () => {
  const runtime = tmpRuntime();
  try {
    const file = indexFileOf(runtime);
    let stopped = false;
    const store = createNotebookInkIndex({
      indexFile: file,
      listNotebooks: () => [{path: '/a.xopp'}],
      isStopped: () => stopped,
    });
    await store.ensureIndexLoaded();
    store.files['/a.xopp'] = {hashes: ['h'], texts: ['antes']};
    store.markDirty();
    /* Para no meio da fila: a gravação enfileirada não pode sair depois do stop. */
    stopped = true;
    await store.saveIndex();
    assert.ok(!fs.existsSync(file), 'depois de parar, nenhuma gravação do índice');
    /* Ao retomar, o sujo continua e grava. */
    stopped = false;
    await store.saveIndex();
    assert.ok(fs.existsSync(file), 'ao retomar, o índice grava');
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});
