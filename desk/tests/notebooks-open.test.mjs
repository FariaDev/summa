import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {fakeFsTree} from './fake-fs-tree.mjs';
import {fakeLauncher} from './fake-launcher.mjs';
import {ptText} from './pt-text.mjs';
import {readNotebookPage} from '../src/extensions/mesa-mcp/notebook-tool.mjs';

const require = createRequire(import.meta.url);
const {registerNotebooksHost} = require('../notebooks-host.cjs');

/* Abrir o `.xopp` no Xournal++ (#133): o renderer manda só `{courseId, path}`;
   o host valida realpath + `.xopp` + existência + contenção na matéria e só
   então autoriza (`allowedXopp`) e lança. Recusa não autoriza nem lança. */

function createFakeIpcMain() {
  const handlers = new Map();
  return {
    handle: (channel, fn) => handlers.set(channel, fn),
    invoke: (channel, payload) => handlers.get(channel)({}, payload),
  };
}

const FAKE_XOURNALPP = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fake-xournalpp.mjs');
/* O fake resolve os caminhos com o `path` do sistema (como o `fs` real); no
   Windows o canônico de `/vault/...` sai com barra invertida. */
const CANONICAL_AULA = path.normalize('/vault/Courses/Calculo/aula.xopp');

function setup({config = {}, platform = 'linux'} = {}) {
  const fakeFs = fakeFsTree({
    '/vault/Courses/Calculo': {'aula.xopp': 1000, 'apostila.pdf': 2000},
    '/vault/Courses/Calculo2': {'evil.xopp': 3000},
    '/vault/livre': {'fora.xopp': 4000},
  }, {
    symlinks: {'/vault/Courses/Calculo/atalho.xopp': '/vault/livre/fora.xopp'},
  });
  const launcher = fakeLauncher();
  const allowedXopp = new Set();
  const ipcMain = createFakeIpcMain();
  registerNotebooksHost({
    ipcMain,
    courses: () => [{id: 'Calculo', name: 'Cálculo', path: '/vault/Courses/Calculo'}],
    allowedXopp,
    config: () => config,
    shell: launcher.shell,
    fs: fakeFs,
    spawn: launcher.spawn,
    platform,
  });
  return {ipcMain, launcher, allowedXopp, fakeFs};
}

async function assertRefusal(ipcMain, launcher, allowedXopp, payload, received) {
  const before = [...allowedXopp];
  await assert.rejects(() => ipcMain.invoke('notebooks-open', payload), (error) => {
    assert.match(String(error.message), new RegExp(received.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    return true;
  });
  assert.deepEqual([...allowedXopp], before, 'recusa não entra em allowedXopp');
  assert.deepEqual(launcher.calls, [], 'recusa não chama processo nem shell');
}

test('recusa caminho fora da matéria, ../, symlink que escapa, prefixo enganoso, extensão e inexistente', async () => {
  const {ipcMain, launcher, allowedXopp} = setup();
  await assertRefusal(ipcMain, launcher, allowedXopp, {courseId: 'Calculo', path: '/vault/livre/fora.xopp'}, 'fora.xopp');
  await assertRefusal(ipcMain, launcher, allowedXopp, {courseId: 'Calculo', path: '/vault/Courses/Calculo/../Calculo2/evil.xopp'}, 'evil.xopp');
  await assertRefusal(ipcMain, launcher, allowedXopp, {courseId: 'Calculo', path: '/vault/Courses/Calculo2/evil.xopp'}, 'evil.xopp');
  await assertRefusal(ipcMain, launcher, allowedXopp, {courseId: 'Calculo', path: '/vault/Courses/Calculo/atalho.xopp'}, 'atalho.xopp');
  await assertRefusal(ipcMain, launcher, allowedXopp, {courseId: 'Calculo', path: '/vault/Courses/Calculo/apostila.pdf'}, 'apostila.pdf');
  await assertRefusal(ipcMain, launcher, allowedXopp, {courseId: 'Calculo', path: '/vault/Courses/Calculo/naoexiste.xopp'}, 'naoexiste.xopp');
  await assertRefusal(ipcMain, launcher, allowedXopp, {courseId: 'SemMateria', path: '/vault/Courses/Calculo/aula.xopp'}, 'SemMateria');
});

test('aceita o caderno da matéria: autoriza o realpath e lança o executável', async () => {
  const {ipcMain, launcher, allowedXopp} = setup({config: {xournalPath: '/opt/xournalpp/bin/xournalpp'}});
  await ipcMain.invoke('notebooks-open', {courseId: 'Calculo', path: '/vault/Courses/Calculo/aula.xopp'});
  assert.deepEqual([...allowedXopp], [CANONICAL_AULA]);
  assert.deepEqual(launcher.calls, [{
    kind: 'spawn',
    cmd: '/opt/xournalpp/bin/xournalpp',
    args: [CANONICAL_AULA],
    opts: {detached: true, stdio: 'ignore'},
  }]);
});

test('F7: a página do resultado vai até a abertura no Xournal++ (--page, 1-based)', async () => {
  const {ipcMain, launcher, allowedXopp} = setup({config: {xournalPath: '/opt/xournalpp/bin/xournalpp'}});
  await ipcMain.invoke('notebooks-open', {courseId: 'Calculo', path: '/vault/Courses/Calculo/aula.xopp', page: 2});
  assert.deepEqual([...allowedXopp], [CANONICAL_AULA]);
  assert.deepEqual(launcher.calls, [{
    kind: 'spawn',
    cmd: '/opt/xournalpp/bin/xournalpp',
    args: ['-n', '2', CANONICAL_AULA],
    opts: {detached: true, stdio: 'ignore'},
  }], 'a página 1-based vira --page na linha de comando do Xournal++');
});

test('F7: página ausente ou inválida não muda a abertura de sempre', async () => {
  for (const page of [undefined, 0, -1, '2', 2.5, null]) {
    const {ipcMain, launcher} = setup({config: {xournalPath: '/opt/xournalpp/bin/xournalpp'}});
    const payload = {courseId: 'Calculo', path: '/vault/Courses/Calculo/aula.xopp'};
    if (page !== undefined) payload.page = page;
    await ipcMain.invoke('notebooks-open', payload);
    assert.deepEqual(launcher.calls[0].args, [CANONICAL_AULA], `página ${JSON.stringify(page)} é ignorada`);
  }
});

test('macOS com xournalPath .app usa open -a; darwin sem xournalPath usa o .app padrão (mesma resolução do open-xournal)', async () => {
  const darwin = setup({config: {xournalPath: '/Applications/Xournal++.app'}, platform: 'darwin'});
  await darwin.ipcMain.invoke('notebooks-open', {courseId: 'Calculo', path: '/vault/Courses/Calculo/aula.xopp'});
  assert.deepEqual(darwin.launcher.calls, [{
    kind: 'spawn',
    cmd: 'open',
    args: ['-a', '/Applications/Xournal++.app', CANONICAL_AULA],
    opts: {detached: true, stdio: 'ignore'},
  }]);

  const darwinDefault = setup({config: {}, platform: 'darwin'});
  await darwinDefault.ipcMain.invoke('notebooks-open', {courseId: 'Calculo', path: '/vault/Courses/Calculo/aula.xopp'});
  assert.deepEqual(darwinDefault.launcher.calls, [{
    kind: 'spawn',
    cmd: 'open',
    args: ['-a', '/Applications/Xournal++.app', CANONICAL_AULA],
    opts: {detached: true, stdio: 'ignore'},
  }]);
});

test('F7: no macOS a página vai como argumento do app aberto pelo open', async () => {
  const darwin = setup({config: {xournalPath: '/Applications/Xournal++.app'}, platform: 'darwin'});
  await darwin.ipcMain.invoke('notebooks-open', {courseId: 'Calculo', path: '/vault/Courses/Calculo/aula.xopp', page: 3});
  assert.deepEqual(darwin.launcher.calls, [{
    kind: 'spawn',
    cmd: 'open',
    args: ['-a', '/Applications/Xournal++.app', '--args', '-n', '3', CANONICAL_AULA],
    opts: {detached: true, stdio: 'ignore'},
  }]);
});

test('sem xournalPath fora do darwin, abre o arquivo pelo shell', async () => {
  const {ipcMain, launcher} = setup({config: {}, platform: 'linux'});
  await ipcMain.invoke('notebooks-open', {courseId: 'Calculo', path: '/vault/Courses/Calculo/aula.xopp'});
  assert.deepEqual(launcher.calls, [{kind: 'openPath', target: CANONICAL_AULA}]);
});

test('o caderno aberto pela biblioteca é aceito pelo ler_caderno (#135)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebooks-open-'));
  const course = path.join(dir, 'Calculo');
  fs.mkdirSync(course, {recursive: true});
  const file = path.join(course, 'aula.xopp');
  fs.writeFileSync(file, gzipSync(`<?xml version="1.0" standalone="no"?>
<xournal version="4">
<page width="589.00" height="845.00">
<background type="solid" color="#ffffffff" style="lined"/>
<layer>
<text fn="" size="12" color="#0013ff" font="Sans" x="100.00" y="100.00">Limites</text>
</layer>
</page>
</xournal>
`));
  const launcher = fakeLauncher();
  const allowedXopp = new Set();
  const ipcMain = createFakeIpcMain();
  registerNotebooksHost({
    ipcMain,
    courses: () => [{id: 'Calculo', name: 'Cálculo', path: course}],
    allowedXopp,
    config: () => ({}),
    shell: launcher.shell,
    spawn: launcher.spawn,
    platform: 'linux',
  });
  await ipcMain.invoke('notebooks-open', {courseId: 'Calculo', path: file});
  assert.equal(allowedXopp.size, 1);
  /* O processo de exportação é o fake-xournalpp (só escreve um PNG mínimo);
     nenhum Xournal++ de verdade é aberto aqui. */
  const spawnProcess = (binary, args, opts) => spawn(process.execPath, [FAKE_XOURNALPP, ...args], opts);
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebooks-open-tmp-'));
  const tmpdir = () => tmpRoot;
  const result = await readNotebookPage({caminho: file, pagina: 1}, {allowedXopp, spawnProcess, tmpdir});
  assert.equal(result.file, 'aula.xopp');
  assert.deepEqual(result.text, ['Limites']);
  fs.rmSync(tmpRoot, {recursive: true, force: true});
  fs.rmSync(dir, {recursive: true, force: true});
});

test('recusa sem courseId (vazio ou não-string) expõe só o basename, sem o caminho absoluto', async () => {
  const {ipcMain, launcher, allowedXopp} = setup();
  const payloads = [
    {courseId: '', path: '/vault/Courses/Calculo/aula.xopp'},
    {courseId: 123, path: '/vault/Courses/Calculo/aula.xopp'},
    {courseId: null, path: '/vault/Courses/Calculo/aula.xopp'},
    {courseId: undefined, path: '/vault/Courses/Calculo/aula.xopp'},
    {path: '/vault/Courses/Calculo/aula.xopp'},
    {courseId: {}, path: '/vault/Courses/Calculo/aula.xopp'},
  ];
  for (const payload of payloads) {
    const before = [...allowedXopp];
    await assert.rejects(() => ipcMain.invoke('notebooks-open', payload), (error) => {
      const raw = String(error.message);
      assert.ok(!raw.includes('/vault/Courses/Calculo/aula.xopp'), `caminho absoluto vazou: ${raw}`);
      assert.ok(!raw.includes('/vault/'), `caminho absoluto vazou: ${raw}`);
      assert.ok(raw.includes('aula.xopp'), `esperava basename: ${raw}`);
      assert.ok(!ptText(raw).includes('/vault/'), `texto decodificado vazou: ${ptText(raw)}`);
      return true;
    });
    assert.deepEqual([...allowedXopp], before, 'recusa não entra em allowedXopp');
  }
  assert.deepEqual(launcher.calls, [], 'recusa não chama processo nem shell');
});

test('spawn que emite error ENOENT vira recusa com ENOENT e sem caminho, sem exceção escapada', async () => {
  const {ipcMain, launcher} = setup({config: {xournalPath: '/home/ana/.local/bin/xournalpp'}});
  launcher.spawnError = Object.assign(Error('spawn /home/ana/.local/bin/xournalpp ENOENT'), {code: 'ENOENT'});
  let escaped = null;
  const onUncaught = (error) => { escaped = error; };
  process.on('uncaughtException', onUncaught);
  try {
    await assert.rejects(
      () => ipcMain.invoke('notebooks-open', {courseId: 'Calculo', path: '/vault/Courses/Calculo/aula.xopp'}),
      (error) => {
        const raw = String(error.message);
        assert.match(raw, /ENOENT/);
        assert.ok(!raw.includes('/home/ana/.local/bin/xournalpp'), `binário absoluto vazou: ${raw}`);
        assert.ok(!raw.includes('/home/ana/.local/bin/'), `diretório do binário vazou: ${raw}`);
        assert.ok(!raw.includes('/vault/'), `caminho do caderno vazou: ${raw}`);
        assert.match(raw, /xournalpp/);
        assert.ok(!ptText(raw).includes('/home/ana/.local/bin/'), `texto decodificado vazou: ${ptText(raw)}`);
        return true;
      },
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(escaped, null, `exceção escapou: ${escaped && escaped.message}`);
  } finally {
    process.off('uncaughtException', onUncaught);
  }
});

test('spawn que lança síncrono vira a mesma recusa sem caminho', async () => {
  const {ipcMain, launcher} = setup({config: {xournalPath: '/home/ana/.local/bin/xournalpp'}});
  launcher.spawnThrows = Object.assign(Error('spawn /home/ana/.local/bin/xournalpp ENOENT'), {code: 'ENOENT'});
  let escaped = null;
  const onUncaught = (error) => { escaped = error; };
  process.on('uncaughtException', onUncaught);
  try {
    await assert.rejects(
      () => ipcMain.invoke('notebooks-open', {courseId: 'Calculo', path: '/vault/Courses/Calculo/aula.xopp'}),
      (error) => {
        const raw = String(error.message);
        assert.match(raw, /ENOENT/);
        assert.ok(!raw.includes('/home/ana/.local/bin/xournalpp'), `binário absoluto vazou: ${raw}`);
        assert.ok(!raw.includes('/home/ana/.local/bin/'), `diretório do binário vazou: ${raw}`);
        assert.ok(!raw.includes('/vault/'), `caminho do caderno vazou: ${raw}`);
        return true;
      },
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(escaped, null, `exceção escapou: ${escaped && escaped.message}`);
  } finally {
    process.off('uncaughtException', onUncaught);
  }
});

test('Windows: contenção sem caixa e com barra invertida (C:\\Cursos\\Calc × c:\\cursos\\calc\\aula.xopp)', async () => {
  /* O `fs` aqui fala win32: o host roda no Windows de verdade, então
     `path`/`realpath` devolvem `C:\…`; o que a contenção tem de provar é a
     caixa e a barra, não o sistema de arquivos. */
  const known = new Set(['c:\\cursos\\calc', 'c:\\cursos\\calc\\aula.xopp', 'c:\\cursos\\calc2\\evil.xopp']);
  const winFs = {
    realpathSync: (value) => {
      const canonical = path.win32.normalize(String(value).replace(/\//g, '\\'));
      if (!known.has(canonical.toLowerCase())) throw Error(`ENOENT ${value}`);
      return canonical;
    },
  };
  winFs.realpathSync.native = winFs.realpathSync;
  const launcher = fakeLauncher();
  const allowedXopp = new Set();
  const ipcMain = createFakeIpcMain();
  registerNotebooksHost({
    ipcMain,
    courses: () => [{id: 'Calc', name: 'Cálculo', path: 'C:\\Cursos\\Calc'}],
    allowedXopp,
    config: () => ({xournalPath: '/opt/xournalpp/bin/xournalpp'}),
    shell: launcher.shell,
    fs: winFs,
    spawn: launcher.spawn,
    platform: 'win32',
  });
  await ipcMain.invoke('notebooks-open', {courseId: 'Calc', path: 'c:\\cursos\\calc\\aula.xopp'});
  assert.deepEqual([...allowedXopp], ['c:\\cursos\\calc\\aula.xopp']);
  assert.deepEqual(launcher.calls, [{
    kind: 'spawn',
    cmd: '/opt/xournalpp/bin/xournalpp',
    args: ['c:\\cursos\\calc\\aula.xopp'],
    opts: {detached: true, stdio: 'ignore'},
  }]);
  const callsBefore = launcher.calls.length;
  await assert.rejects(() => ipcMain.invoke('notebooks-open', {courseId: 'Calc', path: 'c:\\cursos\\calc2\\evil.xopp'}), /evil\.xopp/);
  assert.deepEqual([...allowedXopp], ['c:\\cursos\\calc\\aula.xopp'], 'recusa não entra em allowedXopp');
  assert.equal(launcher.calls.length, callsBefore, 'recusa não chama processo nem shell');
});

test('shell.openPath que devolve erro com caminho vira mensagem sem caminho', async () => {
  const {ipcMain, launcher} = setup({config: {}, platform: 'linux'});
  launcher.shell.openPath = (target) => {
    launcher.calls.push({kind: 'openPath', target});
    return Promise.resolve(`não foi possível abrir ${target}: falha com caminho`);
  };
  await assert.rejects(
    () => ipcMain.invoke('notebooks-open', {courseId: 'Calculo', path: '/vault/Courses/Calculo/aula.xopp'}),
    (error) => {
      const raw = String(error.message);
      assert.ok(!raw.includes('/vault/Courses/Calculo/aula.xopp'), `caminho absoluto vazou: ${raw}`);
      assert.ok(!raw.includes('/vault/'), `caminho absoluto vazou: ${raw}`);
      assert.ok(raw.includes('aula.xopp'), `esperava basename: ${raw}`);
      assert.ok(!ptText(raw).includes('/vault/'), `texto decodificado vazou: ${ptText(raw)}`);
      return true;
    },
  );
});

/* --- regressões #135 (auditoria) --- */
test('item 6: launch que falha não entra em allowedXopp', async () => {
  const {ipcMain, launcher, allowedXopp} = setup({config: {xournalPath: '/opt/xournalpp/bin/xournalpp'}});
  launcher.spawnError = Object.assign(Error('spawn ENOENT'), {code: 'ENOENT'});
  await assert.rejects(
    () => ipcMain.invoke('notebooks-open', {courseId: 'Calculo', path: '/vault/Courses/Calculo/aula.xopp'}),
    /ENOENT/,
  );
  assert.deepEqual([...allowedXopp], [], 'falha de launch não autoriza');
});

test('item 6: openPath que devolve erro não entra em allowedXopp', async () => {
  const {ipcMain, launcher, allowedXopp} = setup({config: {}, platform: 'linux'});
  launcher.shell.openPath = (target) => {
    launcher.calls.push({kind: 'openPath', target});
    return Promise.resolve('erro');
  };
  await assert.rejects(
    () => ipcMain.invoke('notebooks-open', {courseId: 'Calculo', path: '/vault/Courses/Calculo/aula.xopp'}),
    /aula\.xopp/,
  );
  assert.deepEqual([...allowedXopp], [], 'openPath com erro não autoriza');
});

test('item 7: no Linux /x/Calc não vale como dentro de /x/calc (e win32/darwin seguem sem caixa)', async () => {
  const {isPathUnderRoot} = require('../file-guard.cjs');
  assert.equal(typeof isPathUnderRoot, 'function');
  /* Padrão atual (sem opção) não muda: sem caixa, como sempre. */
  assert.equal(isPathUnderRoot('/x/Calc/aula.xopp', '/x/calc'), true);
  /* Com sensibilidade, Linux é exato. */
  assert.equal(isPathUnderRoot('/x/Calc/aula.xopp', '/x/calc', {caseSensitive: true}), false);
  assert.equal(isPathUnderRoot('/x/calc/aula.xopp', '/x/calc', {caseSensitive: true}), true);
  assert.equal(isPathUnderRoot('/x/calc/aula.xopp', '/x/calc', {caseSensitive: false}), true);

  const known = new Set(['/vault/Courses/Calc', '/vault/Courses/Calc/aula.xopp', '/vault/Courses/calc', '/vault/Courses/calc/aula.xopp']);
  const caseFs = {
    realpathSync: (value) => {
      /* A árvore falsa é POSIX nos 3 sistemas: devolve a chave como veio,
         para o cru e o canônico coincidirem também no Windows. */
      const canonical = String(value);
      if (!known.has(canonical)) throw Error(`ENOENT ${value}`);
      return canonical;
    },
  };
  caseFs.realpathSync.native = caseFs.realpathSync;
  const launcher = fakeLauncher();
  const allowedXopp = new Set();
  const ipcMain = createFakeIpcMain();
  registerNotebooksHost({
    ipcMain,
    courses: () => [{id: 'Calc', name: 'Cálculo', path: '/vault/Courses/Calc'}],
    allowedXopp,
    config: () => ({xournalPath: '/opt/xournalpp/bin/xournalpp'}),
    shell: launcher.shell,
    fs: caseFs,
    spawn: launcher.spawn,
    platform: 'linux',
  });
  await assert.rejects(
    () => ipcMain.invoke('notebooks-open', {courseId: 'Calc', path: '/vault/Courses/calc/aula.xopp'}),
    /aula\.xopp/,
  );
  assert.deepEqual([...allowedXopp], [], 'caixa diferente no Linux recusa');

  const winLauncher = fakeLauncher();
  const winAllowed = new Set();
  const winIpc = createFakeIpcMain();
  registerNotebooksHost({
    ipcMain: winIpc,
    courses: () => [{id: 'Calc', name: 'Cálculo', path: '/vault/Courses/Calc'}],
    allowedXopp: winAllowed,
    config: () => ({xournalPath: '/opt/xournalpp/bin/xournalpp'}),
    shell: winLauncher.shell,
    fs: caseFs,
    spawn: winLauncher.spawn,
    platform: 'win32',
  });
  await winIpc.invoke('notebooks-open', {courseId: 'Calc', path: '/vault/Courses/calc/aula.xopp'});
  assert.deepEqual([...winAllowed], ['/vault/Courses/calc/aula.xopp'], 'win32 segue sem caixa');
});
