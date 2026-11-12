/* Fechamento do serve no Windows (#165): o shim `.cmd` vira um cmd.exe e o
   `child.kill` deixa o node neto vivo com o pipe aberto. Aqui o killGroup e o
   ChildProcess são fakes nomeados; nada é sinalizado de verdade. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PassThrough} from 'node:stream';

const require = createRequire(import.meta.url);
const {signalServeChild, releaseServeStdio} = require('../src/agents/opencode-serve-stop.cjs');

const fakeChild = () => {
  const kills = [];
  return {kills, kill: signal => { kills.push(signal); return true; }};
};

test('Windows: o taskkill desce a árvore do cmd em vez de matar só o handle', () => {
  const child = fakeChild();
  const groups = [];
  signalServeChild({platform: 'win32', pid: 4242, name: 'SIGTERM', child, signalGroup: target => groups.push(target)});
  assert.deepEqual(groups, [{pid: 4242, pgid: 4242, signal: 'SIGTERM'}]);
  assert.deepEqual(child.kills, [], 'o cmd sozinho não resolve o node neto do shim');
});

test('Windows sem pid (spawn falhou) cai no handle e não sinaliza grupo', () => {
  const child = fakeChild();
  const groups = [];
  signalServeChild({platform: 'win32', pid: 0, name: 'SIGKILL', child, signalGroup: target => groups.push(target)});
  assert.deepEqual(groups, []);
  assert.deepEqual(child.kills, ['SIGKILL']);
});

test('POSIX: o sinal continua no ChildProcess', () => {
  const child = fakeChild();
  const groups = [];
  signalServeChild({platform: 'linux', pid: 4242, name: 'SIGTERM', child, signalGroup: target => groups.push(target)});
  assert.deepEqual(groups, [], 'o grupo do pid não é sinalizado sem prova');
  assert.deepEqual(child.kills, ['SIGTERM']);
});

test('releaseServeStdio fecha stdout e stderr, e tolera pipe já fechado', () => {
  const child = {stdout: new PassThrough(), stderr: new PassThrough()};
  releaseServeStdio(child);
  assert.equal(child.stdout.destroyed, true);
  assert.equal(child.stderr.destroyed, true);
  assert.doesNotThrow(() => releaseServeStdio({}));
  assert.doesNotThrow(() => releaseServeStdio({stdout: {destroy: () => { throw Error('já fechado'); }}}));
});
