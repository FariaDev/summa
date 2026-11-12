/* #178: no Windows sem instalador, a Mesa roda pelo electron.exe e o menu
   Iniciar mostra o ícone embutido dele. O atalho com o AppUserModelId da Mesa
   corrige o menu e as notificações. A unidade usa fakes com nome; o último
   teste só roda no Windows e prova o .lnk com o shell do Electron de verdade. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

import {fakeShortcutFs, fakeShortcutShell} from './fake-windows-shortcut.mjs';

const require = createRequire(import.meta.url);
const {ensureStartMenuShortcut, WINDOWS_APP_ID} = require('../windows-shortcut.cjs');
const electronPath = require('electron');
const RUNNER = path.join(import.meta.dirname, 'fixtures', 'windows-shortcut-runner.cjs');
const APPDATA = '/mesa/appdata';
const APP = '/mesa/desk';
const EXEC = '/electron/electron.exe';
const SHORTCUT = path.join(APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Summa.lnk');
const LEGACY_SHORTCUT = path.join(APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Mesa de Estudos.lnk');
const EXPECTED = {target: EXEC, args: `"${APP}"`, cwd: APP, icon: path.join(APP, 'assets', 'mesa.ico'),
  iconIndex: 0, appUserModelId: WINDOWS_APP_ID, description: 'Summa'};

function deps({shell = fakeShortcutShell(), disk = fakeShortcutFs(), platform = 'win32', log = () => {}} = {}) {
  return {shell, platform, env: {APPDATA}, execPath: EXEC, appPath: APP, assetsDir: path.join(APP, 'assets'),
    defaultApp: true, fs: disk, log};
}

test('no Windows cria o atalho do menu Iniciar com o AppUserModelId da Mesa (#178)', () => {
  const shell = fakeShortcutShell();
  const disk = fakeShortcutFs();
  const result = ensureStartMenuShortcut(deps({shell, disk}));
  assert.equal(result.changed, true);
  assert.equal(shell.writes.length, 1);
  assert.deepEqual(shell.writes[0], {file: SHORTCUT, operation: 'create', details: EXPECTED});
  assert.deepEqual(disk.dirs, [{dir: path.dirname(SHORTCUT), options: {recursive: true}}]);
});

test('atalho já igual não é reescrito (#178)', () => {
  const shell = fakeShortcutShell({shortcut: EXPECTED});
  const disk = fakeShortcutFs();
  const result = ensureStartMenuShortcut(deps({shell, disk}));
  assert.equal(result.changed, false);
  assert.deepEqual(shell.reads, [SHORTCUT]);
  assert.deepEqual(shell.writes, []);
  assert.deepEqual(disk.dirs, []);
});

test('criar o Summa.lnk remove o Mesa de Estudos.lnk antigo na mesma pasta (#190)', () => {
  const disk = fakeShortcutFs({files: [LEGACY_SHORTCUT]});
  const result = ensureStartMenuShortcut(deps({disk}));
  assert.equal(result.changed, true);
  assert.deepEqual(disk.removed, [{file: LEGACY_SHORTCUT, options: {force: true}}]);
});

test('sem o atalho antigo nada é removido (#190)', () => {
  const disk = fakeShortcutFs();
  ensureStartMenuShortcut(deps({disk}));
  assert.deepEqual(disk.removed, []);
});

test('pasta do app mudou: o atalho é reescrito (#178)', () => {
  const shell = fakeShortcutShell({shortcut: {...EXPECTED, cwd: '/mesa/antiga', args: '"/mesa/antiga"'}});
  const result = ensureStartMenuShortcut(deps({shell}));
  assert.equal(result.changed, true);
  assert.equal(shell.writes.length, 1);
  assert.equal(shell.writes[0].details.cwd, APP);
});

test('fora do Windows não toca no menu Iniciar (#178)', () => {
  const shell = fakeShortcutShell();
  const disk = fakeShortcutFs();
  const result = ensureStartMenuShortcut(deps({shell, disk, platform: 'linux'}));
  assert.equal(result.changed, false);
  assert.deepEqual(shell.reads, []);
  assert.deepEqual(shell.writes, []);
  assert.deepEqual(disk.dirs, []);
});

test('erro ao gravar não derruba a abertura (#178)', () => {
  const lines = [];
  const shell = fakeShortcutShell({failWrite: true});
  const result = ensureStartMenuShortcut(deps({shell, log: (area, line) => lines.push([area, line])}));
  assert.equal(result.changed, false);
  assert.match(result.error, /gravação recusada pelo fake/);
  assert.equal(lines.length, 1);
  assert.equal(lines[0][0], 'windows-shortcut');
  assert.match(lines[0][1], /menu Iniciar.*gravação recusada pelo fake/);
});

const windows = process.platform === 'win32';
const appData = windows ? fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-shortcut-')) : '';
test.after(() => { if (appData) fs.rmSync(appData, {recursive: true, force: true}); });

test('o .lnk real abre a Mesa com o ícone e o AppUserModelId (#178)',
  {skip: windows ? false : 'o atalho do menu Iniciar só existe no Windows', timeout: 60000}, () => {
    const run = spawnSync(electronPath, [RUNNER, appData], {env: process.env, encoding: 'utf8',
      timeout: 60000, killSignal: 'SIGKILL'});
    const output = `${run.stdout || ''}${run.stderr || ''}`;
    const report = JSON.parse(/^__SHORTCUT__(.+)$/m.exec(String(run.stdout || ''))?.[1] || 'null');
    assert.ok(report, `o runner não devolveu o atalho:\n${output.slice(-3000)}`);
    assert.equal(report.first.changed, true, output.slice(-3000));
    assert.equal(report.second.changed, false, 'a segunda abertura não reescreve');
    const expected = {target: report.execPath, args: `"${report.appPath}"`, cwd: report.appPath,
      icon: path.join(report.appPath, 'assets', 'mesa.ico'), iconIndex: 0,
      appUserModelId: 'br.com.fariadev.mesa-de-estudos', description: 'Summa'};
    for (const [key, value] of Object.entries(expected)) assert.equal(report.shortcut[key], value, key);
    assert.match(report.shortcut.target, /electron\.exe$/i);
  });
