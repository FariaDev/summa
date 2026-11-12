/* Descoberta do OpenCode pelo shell de login (#102). O shell e o `opencode`
   são fakes nomeados (`fake-login-shell.mjs` e `fake-bun-bin/opencode`): o app
   de teste chega com PATH mínimo, como o aberto pelo Finder, e o rc falso põe
   o binário "instalado por bun" no PATH e imprime lixo antes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeShellSpawn} from './fake-shell-spawn.mjs';
import {trackTempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const {findOpenCodeInLoginShell, findOpenCodeInLoginShellAsync, resetOpenCodeShellCache} = require('../src/agents/opencode-shell.cjs');
const {candidatePaths, findOpenCodeLauncher} = require('../src/agents/opencode-process.cjs');

const HERE = import.meta.dirname;
const FAKE_SHELL = path.join(HERE, 'fake-login-shell.mjs');
const BUN_OPENCODE = path.join(HERE, 'fake-bun-bin', 'opencode');
const MINIMAL_PATH = [path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter);
const shellEnv = (extra = {}) => ({PATH: MINIMAL_PATH, SHELL: FAKE_SHELL, HOME: os.tmpdir(), ...extra});

test('o shell de login acha o opencode do bun com o PATH mínimo do Finder (#102)', {skip: process.platform === 'win32' && 'o shell falso é um script POSIX'}, () => {
  resetOpenCodeShellCache();
  const found = findOpenCodeInLoginShell({shellPath: FAKE_SHELL, env: shellEnv(), platform: 'linux'});
  assert.equal(found, BUN_OPENCODE);
  assert.equal(fs.statSync(found).isFile(), true);
});

test('rc que só imprime lixo não vira caminho', {skip: process.platform === 'win32' && 'o shell falso é um script POSIX'}, () => {
  resetOpenCodeShellCache();
  assert.equal(findOpenCodeInLoginShell({shellPath: FAKE_SHELL, env: shellEnv({FAKE_LOGIN_SHELL_MODE: 'junk'}), platform: 'linux'}), '');
});

test('caminho devolvido que não existe é recusado', {skip: process.platform === 'win32' && 'o shell falso é um script POSIX'}, () => {
  resetOpenCodeShellCache();
  assert.equal(findOpenCodeInLoginShell({shellPath: FAKE_SHELL, env: shellEnv({FAKE_LOGIN_SHELL_MODE: 'ghost'}), platform: 'linux'}), '');
});

test('caminho devolvido sem permissão de execução é recusado', () => {
  resetOpenCodeShellCache();
  assert.equal(findOpenCodeInLoginShell({shellPath: FAKE_SHELL, env: shellEnv({FAKE_LOGIN_SHELL_MODE: 'noexec'}), platform: 'linux'}), '');
});

test('shell que trava para no prazo e não segura a Mesa', {skip: process.platform === 'win32' && 'o shell falso é um script POSIX'}, () => {
  resetOpenCodeShellCache();
  const started = Date.now();
  assert.equal(findOpenCodeInLoginShell({shellPath: FAKE_SHELL, env: shellEnv({FAKE_LOGIN_SHELL_MODE: 'hang'}), platform: 'linux', timeoutMs: 200}), '');
  assert.ok(Date.now() - started < 5000, 'o prazo do shell é respeitado');
});

test('o Windows não pergunta a shell de login', () => {
  resetOpenCodeShellCache();
  assert.equal(findOpenCodeInLoginShell({shellPath: FAKE_SHELL, env: shellEnv(), platform: 'win32'}), '');
});

test('caminho do ambiente e das Configurações vêm antes dos instaladores usuais', () => {
  const first = candidatePaths({envPath: '~/env/opencode', configuredPath: '~/bun/bin/opencode', home: '/casa', platform: 'linux'});
  assert.equal(first[0], path.resolve('/casa', 'env', 'opencode'));
  assert.equal(first[1], path.resolve('/casa', 'bun', 'bin', 'opencode'));
  const configuredOnly = candidatePaths({configuredPath: '~/bun/bin/opencode', home: '/casa', platform: 'linux'});
  assert.equal(configuredOnly[0], path.resolve('/casa', 'bun', 'bin', 'opencode'));
});

test('no Windows a busca continua só nos caminhos fixos, sem shell', () => {
  resetOpenCodeShellCache();
  const home = trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-shell-win-')));
  try {
    const found = findOpenCodeLauncher({
      home, envPath: '', configuredPath: '', platform: 'win32', shellPath: FAKE_SHELL,
      env: shellEnv(), spawnSyncProcess: () => { throw Error('o shell não devia rodar'); },
    });
    assert.equal(found, '');
  } finally {
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('quem já está num caminho fixo não abre o shell de login', () => {
  resetOpenCodeShellCache();
  const home = trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-shell-fixed-')));
  try {
    const fixed = path.join(home, '.opencode', 'bin');
    fs.mkdirSync(fixed, {recursive: true});
    fs.writeFileSync(path.join(fixed, 'opencode'), '#!/bin/sh\nexit 0\n', {mode: 0o755});
    const found = findOpenCodeLauncher({
      home, envPath: '', configuredPath: '', platform: 'linux', shellPath: FAKE_SHELL,
      env: shellEnv(), spawnSyncProcess: () => { throw Error('o shell não devia rodar'); },
    });
    assert.equal(found, path.join(fixed, 'opencode'));
  } finally {
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('"não achei" não abre outro shell até reabrir o app: a pergunta trava o processo principal', () => {
  resetOpenCodeShellCache();
  let spawns = 0;
  const spawnSyncProcess = () => { spawns += 1; return {stdout: ''}; };
  const ask = () => findOpenCodeInLoginShell({shellPath: '/bin/sh', env: {PATH: '/usr/bin'}, platform: 'linux', spawnSyncProcess});
  assert.equal(ask(), '');
  assert.equal(ask(), '');
  assert.equal(spawns, 1);
  resetOpenCodeShellCache();
});

test('a pergunta assíncrona acha o mesmo caminho e aquece o cache do init (#desempenho)', {skip: process.platform === 'win32' && 'o shell falso é um script POSIX'}, async () => {
  resetOpenCodeShellCache();
  const found = await findOpenCodeInLoginShellAsync({shellPath: FAKE_SHELL, env: shellEnv(), platform: 'linux'});
  assert.equal(found, BUN_OPENCODE);
  let syncSpawns = 0;
  assert.equal(findOpenCodeInLoginShell({shellPath: FAKE_SHELL, env: shellEnv(), platform: 'linux',
    spawnSyncProcess: () => { syncSpawns += 1; throw Error('o shell não devia rodar de novo'); }}), BUN_OPENCODE);
  assert.equal(syncSpawns, 0, 'a detecção síncrona do init lê o cache da assíncrona');
});

test('a pergunta assíncrona respeita o prazo e o laço do shell não segura a Mesa', {skip: process.platform === 'win32' && 'o shell falso é um script POSIX'}, async () => {
  resetOpenCodeShellCache();
  const started = Date.now();
  assert.equal(await findOpenCodeInLoginShellAsync({shellPath: FAKE_SHELL, env: shellEnv({FAKE_LOGIN_SHELL_MODE: 'hang'}), platform: 'linux', timeoutMs: 200}), '');
  assert.ok(Date.now() - started < 5000, 'o prazo do shell é respeitado');
  let syncSpawns = 0;
  assert.equal(findOpenCodeInLoginShell({shellPath: FAKE_SHELL, env: shellEnv({FAKE_LOGIN_SHELL_MODE: 'hang'}), platform: 'linux', timeoutMs: 200,
    spawnSyncProcess: () => { syncSpawns += 1; return {stdout: ''}; }}), '');
  assert.equal(syncSpawns, 1, 'o prazo não vira "não achei" permanente: o init pergunta de novo');
});

test('prazo e erro de spawn não gravam cache; o shell que termina sem achar grava (#desempenho)', async () => {
  resetOpenCodeShellCache();
  const env = {PATH: '/usr/bin'};
  const ask = (options = {}) => findOpenCodeInLoginShellAsync({shellPath: '/bin/fake', env, platform: 'linux', timeoutMs: 20, ...options});
  const syncAsks = () => {
    let spawns = 0;
    const found = findOpenCodeInLoginShell({shellPath: '/bin/fake', env, platform: 'linux', timeoutMs: 20,
      spawnSyncProcess: () => { spawns += 1; return {stdout: ''}; }});
    return {found, spawns};
  };

  const hang = fakeShellSpawn({mode: 'hang'});
  assert.equal(await ask({spawnProcess: hang.spawnProcess}), '');
  assert.deepEqual(syncAsks(), {found: '', spawns: 1}, 'depois do prazo a chamada síncrona pergunta de novo');

  resetOpenCodeShellCache();
  const broken = fakeShellSpawn({mode: 'error'});
  assert.equal(await ask({spawnProcess: broken.spawnProcess}), '');
  assert.deepEqual(syncAsks(), {found: '', spawns: 1}, 'erro de spawn não fica no cache');

  resetOpenCodeShellCache();
  const thrower = fakeShellSpawn({mode: 'throw'});
  assert.equal(await ask({spawnProcess: thrower.spawnProcess}), '');
  assert.deepEqual(syncAsks(), {found: '', spawns: 1}, 'spawn que lança não fica no cache');

  resetOpenCodeShellCache();
  const empty = fakeShellSpawn({mode: 'close', stdout: 'rc sem marcador\n'});
  assert.equal(await ask({spawnProcess: empty.spawnProcess}), '');
  assert.deepEqual(syncAsks(), {found: '', spawns: 0}, 'shell que terminou sem achar é definitivo e fica no cache');
  resetOpenCodeShellCache();
});
