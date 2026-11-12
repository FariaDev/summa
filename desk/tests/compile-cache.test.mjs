// Cache de compilação do main (#desempenho): pasta de dados do usuário,
// desligado no teste e nunca derruba a partida. A API do Node é um fake.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {enableDeskCompileCache} = require('../compile-cache.cjs');

const dirs = [];
after(() => { for (const dir of dirs) fs.rmSync(dir, {recursive: true, force: true}); });
function tempDir(tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `mesa-compile-${tag}-`));
  dirs.push(dir);
  return dir;
}
const api = (calls) => ({enableCompileCache: (dir) => { calls.push(dir); return {status: 1}; }, constants: {compileCacheStatus: {FAILED: 0}}});

test('liga o cache na pasta pedida, criando a pasta de dados', () => {
  const dir = path.join(tempDir('ok'), 'compile-cache');
  const calls = [];
  const result = enableDeskCompileCache({dir, env: {}, moduleApi: api(calls)});
  assert.deepEqual(result, {enabled: true, dir, status: 1});
  assert.deepEqual(calls, [dir]);
  assert.equal(fs.statSync(dir).isDirectory(), true);
});

test('Node sem enableCompileCache segue sem cache e sem lançar', () => {
  const dir = tempDir('old');
  assert.deepEqual(enableDeskCompileCache({dir, env: {}, moduleApi: {}}), {enabled: false, dir, reason: 'unsupported'});
});

test('falha ao criar a pasta ou status FAILED não derrubam o app', () => {
  const file = path.join(tempDir('file'), 'ocupado');
  fs.writeFileSync(file, 'não é pasta');
  assert.deepEqual(enableDeskCompileCache({dir: file, env: {}, moduleApi: api([])}), {enabled: false, dir: file, reason: 'failed'});
  const dir = tempDir('failed');
  const moduleApi = {enableCompileCache: () => ({status: 0}), constants: {compileCacheStatus: {FAILED: 0}}};
  assert.deepEqual(enableDeskCompileCache({dir, env: {}, moduleApi}), {enabled: false, dir, status: 0, reason: 'failed'});
});

test('DESK_TEST desliga o cache (o runtime do teste é temporário); a chave explícita liga', () => {
  const dir = tempDir('test');
  const calls = [];
  assert.deepEqual(enableDeskCompileCache({dir, env: {DESK_TEST: '1'}, moduleApi: api(calls)}), {enabled: false, dir, reason: 'disabled'});
  assert.deepEqual(calls, []);
  assert.equal(enableDeskCompileCache({dir, env: {DESK_TEST: '1', LEARNING_DESK_COMPILE_CACHE: '1'}, moduleApi: api(calls)}).enabled, true);
  assert.deepEqual(enableDeskCompileCache({dir, env: {LEARNING_DESK_COMPILE_CACHE: '0'}, moduleApi: api(calls)}), {enabled: false, dir, reason: 'disabled'});
});
