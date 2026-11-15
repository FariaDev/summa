import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';

/* #6: no Windows, o `npm ci` do update falhava com EPERM/EBUSY porque um
   processo do Electron (MCP via ELECTRON_RUN_AS_NODE, chat lateral, filho do
   app) continuava usando o `node_modules\electron\dist`. A espera e a nova
   tentativa têm de ser só do Windows; fora dele o update segue como antes. */
const require = createRequire(import.meta.url);
const {electronDistDir, listElectronProcesses, parseElectronProcessList, waitForElectronProcesses, fileLockCode, npmCiWithRetry} = require('../updater-npm-ci.cjs');

const ELECTRON = path.join('node_modules', 'electron', 'dist', 'electron.exe');

test('lista processos do electron/dist com PowerShell, só no Windows', async () => {
  let call = null;
  const rows = await listElectronProcesses('C:\\Meu App\\desk', {
    platform: 'win32',
    execFileFn: async (cmd, args, opts) => {
      call = {cmd, args, opts};
      return {stdout: JSON.stringify([{ProcessId: 99, ExecutablePath: 'C:\\Meu App\\desk\\' + ELECTRON.replaceAll('/', '\\')}])};
    },
  });
  assert.equal(call.cmd, 'powershell.exe');
  const script = call.args[call.args.indexOf('-Command') + 1];
  assert.match(script, /Get-CimInstance Win32_Process/);
  assert.match(script, /C:\\Meu App\\desk\\node_modules\\electron\\dist/);
  assert.match(script, /ProcessId,ExecutablePath/);
  assert.deepEqual(rows, [{pid: 99, exe: 'C:\\Meu App\\desk\\node_modules\\electron\\dist\\electron.exe'}]);

  let called = false;
  const vazio = await listElectronProcesses('/x/desk', {platform: 'linux', execFileFn: async () => { called = true; return {stdout: ''}; }});
  assert.deepEqual(vazio, [], 'fora do Windows não chama PowerShell');
  assert.equal(called, false);
});

test('parse do JSON do PowerShell aceita objeto único, lista e saída vazia', () => {
  assert.deepEqual(parseElectronProcessList(''), []);
  assert.deepEqual(parseElectronProcessList('{"ProcessId":1,"ExecutablePath":"C:\\\\x\\\\electron.exe"}'), [{pid: 1, exe: 'C:\\x\\electron.exe'}]);
  assert.deepEqual(parseElectronProcessList('[{"ProcessId":1,"ExecutablePath":"a"},{"ProcessId":"x"}]'), [{pid: 1, exe: 'a'}], 'entrada sem pid válido sai');
  assert.equal(electronDistDir('/x/desk'), path.join('/x/desk', 'node_modules', 'electron', 'dist'));
  assert.equal(electronDistDir('C:\\x\\desk', 'win32'), 'C:\\x\\desk\\node_modules\\electron\\dist');
});

test('espera até o processo do Electron sumir e registra pid + caminho', async () => {
  let now = 0;
  const polls = [];
  const lines = [];
  const holder = {pid: 1234, exe: 'C:\\Summa\\desk\\node_modules\\electron\\dist\\electron.exe'};
  const result = await waitForElectronProcesses({
    deskDir: 'C:\\Summa\\desk',
    platform: 'win32',
    timeoutMs: 30000,
    pollMs: 500,
    list: async () => {
      polls.push(now);
      return polls.length < 3 ? [holder] : [];
    },
    sleep: async (ms) => { now += ms; },
    now: () => now,
    log: (line) => lines.push(line),
  });
  assert.deepEqual(result, {ok: true, remaining: []});
  assert.deepEqual(polls, [0, 500, 1000], 'espera entre as listagens em vez de apertar o PowerShell');
  assert.equal(lines.length, 1, 'o processo que segurava é registrado uma vez');
  assert.match(lines[0], /pid 1234/);
  assert.match(lines[0], /electron\.exe/);
});

test('prazo esgotado devolve quem ainda estava vivo (pid + caminho)', async () => {
  let now = 0;
  const lines = [];
  const holder = {pid: 4321, exe: 'C:\\Summa\\desk\\node_modules\\electron\\dist\\electron.exe'};
  const result = await waitForElectronProcesses({
    deskDir: 'C:\\Summa\\desk',
    platform: 'win32',
    timeoutMs: 1000,
    pollMs: 500,
    list: async () => [holder],
    sleep: async (ms) => { now += ms; },
    now: () => now,
    log: (line) => lines.push(line),
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.remaining, [holder]);
  assert.match(lines.join('\n'), /prazo de 1000 ms/);
  assert.match(lines.join('\n'), /pid 4321/);
  assert.match(lines.join('\n'), /node_modules/);
});

test('fora do Windows a espera responde na hora sem listar processos', async () => {
  for (const platform of ['linux', 'darwin']) {
    let listed = false;
    const result = await waitForElectronProcesses({
      deskDir: '/x/desk',
      platform,
      list: async () => { listed = true; return [{pid: 1, exe: 'x'}]; },
      sleep: async () => assert.fail('não devia esperar fora do Windows'),
    });
    assert.deepEqual(result, {ok: true, remaining: []});
    assert.equal(listed, false, `${platform} não chama PowerShell`);
  }
});

test('listagem que falha não trava o update: segue para o npm ci', async () => {
  const lines = [];
  const result = await waitForElectronProcesses({
    deskDir: 'C:\\Summa\\desk',
    platform: 'win32',
    list: async () => { throw Error('powershell sumiu'); },
    log: (line) => lines.push(line),
  });
  assert.deepEqual(result, {ok: true, remaining: [], unreadable: true});
  assert.match(lines[0], /não deu para listar os processos do Electron/);
  assert.doesNotMatch(lines[0], /C:\\Summa/, 'o log não inventa caminho que não veio');
});

test('npm ci: EBUSY no Windows repete com espera crescente e então passa', async () => {
  const calls = [];
  const delays = [];
  let failures = 2;
  const run = async (cmd, args) => {
    calls.push([cmd, ...args]);
    if (failures-- > 0) {
      const error = Error('Command failed: npm ci');
      error.code = 1; /* npm sai com 1; a trava aparece no stderr */
      error.stderr = 'npm error code EBUSY\nnpm error syscall unlink';
      throw error;
    }
    return {stdout: '', stderr: ''};
  };
  const result = await npmCiWithRetry({
    deskDir: 'C:\\Summa\\desk', run, platform: 'win32', delays: [100, 200],
    sleep: async (ms) => delays.push(ms), log: () => {},
  });
  assert.deepEqual(result, {attempts: 3});
  assert.deepEqual(calls, [['npm', 'ci'], ['npm', 'ci'], ['npm', 'ci']]);
  assert.deepEqual(delays, [100, 200], 'espera crescente entre as tentativas');
});

test('npm ci: trava persistente desiste e devolve o erro original', async () => {
  let calls = 0;
  const delays = [];
  const run = async () => {
    calls++;
    const error = Error('Command failed: npm ci');
    error.code = 'EPERM';
    throw error;
  };
  await assert.rejects(
    () => npmCiWithRetry({deskDir: 'C:\\Summa\\desk', run, platform: 'win32', delays: [10, 20], sleep: async (ms) => delays.push(ms), log: () => {}}),
    /npm ci/,
  );
  assert.equal(calls, 3, 'tentativa inicial + uma por espera');
  assert.deepEqual(delays, [10, 20]);
});

test('npm ci: erro que não é de trava não repete', async () => {
  let calls = 0;
  const run = async () => {
    calls++;
    const error = Error('npm error code ERESOLVE');
    error.stderr = 'npm error code ERESOLVE';
    throw error;
  };
  await assert.rejects(
    () => npmCiWithRetry({deskDir: 'C:\\Summa\\desk', run, platform: 'win32', sleep: async () => assert.fail('não podia esperar')}),
    /ERESOLVE/,
  );
  assert.equal(calls, 1);
  assert.equal(fileLockCode(Error('qualquer outra coisa')), '');
  assert.equal(fileLockCode(Object.assign(Error('x'), {stderr: 'npm error code ENOTEMPTY'})), 'ENOTEMPTY');
});

test('npm ci: fora do Windows uma falha EBUSY não repete (comportamento igual)', async () => {
  let calls = 0;
  const run = async () => {
    calls++;
    const error = Error('Command failed: npm ci');
    error.stderr = 'npm error code EBUSY';
    throw error;
  };
  await assert.rejects(
    () => npmCiWithRetry({deskDir: '/x/desk', run, platform: 'linux', sleep: async () => assert.fail('não podia esperar')}),
    (error) => /EBUSY/.test(String(error.stderr)),
  );
  assert.equal(calls, 1);
});
