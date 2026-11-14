/* #181: o updater assinado continua trocando só o payload também na
   instalação por usuário do Windows. O layout é
   `<installDir>/resources/app`; o updater precisa achar essa pasta pelo
   `install-source.json`/`package.json`, re-sincronizar via install-app no modo
   bundle e reabrir pelo electron.exe da instalação — não pelo `.app` do macOS. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

import {tempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const {appRootFromDesk, reopenInstalled} = require('../install-location.cjs');
const {readInstallSource} = require('../update-origin.cjs');
const updater = require('../updater.cjs');

function installedCopy() {
  const root = tempDir('mesa-win-update');
  const installDir = path.join(root, 'Programs', 'Summa');
  const payload = path.join(installDir, 'resources', 'app');
  fs.mkdirSync(payload, {recursive: true});
  fs.writeFileSync(path.join(payload, 'package.json'), JSON.stringify({name: 'learning-desk', version: '1.2.0'}));
  fs.writeFileSync(path.join(payload, 'main.cjs'), '// payload');
  const clone = path.join(root, 'mesa');
  fs.mkdirSync(path.join(clone, 'desk', 'scripts'), {recursive: true});
  fs.writeFileSync(path.join(clone, 'desk', 'scripts', 'install-app.mjs'), '// install-app');
  fs.writeFileSync(path.join(payload, 'install-source.json'), JSON.stringify({path: clone, remote: 'https://github.com/FariaDev/mesa-de-estudos.git'}));
  return {root, installDir, payload, clone};
}

test('o updater acha o payload em resources/app e a versão instalada (#181)', () => {
  const {payload, clone} = installedCopy();
  assert.equal(updater.installedVersion(payload), '1.2.0', 'package.json do payload é a versão instalada');
  assert.deepEqual(readInstallSource(payload), {path: clone, remote: 'https://github.com/FariaDev/mesa-de-estudos.git'}, 'install-source.json do payload define o modo bundle');
  assert.equal(appRootFromDesk('C:\\Users\\ana\\AppData\\Local\\Programs\\Summa\\resources\\app', 'win32'),
    'C:\\Users\\ana\\AppData\\Local\\Programs\\Summa', 'raiz do app no Windows é a pasta em Programs');
  assert.equal(appRootFromDesk('/Applications/Summa.app/Contents/Resources/app', 'darwin'), '/Applications/Summa.app');
});

test('reabrir no Windows é o electron.exe da instalação; no macOS é o .app (#181)', () => {
  const payload = 'C:\\Users\\ana\\AppData\\Local\\Programs\\Summa\\resources\\app';
  assert.deepEqual(reopenInstalled({mode: 'bundle', deskDir: payload, platform: 'win32'}), {
    cmd: 'C:\\Users\\ana\\AppData\\Local\\Programs\\Summa\\electron.exe',
    args: [], cwd: 'C:\\Users\\ana\\AppData\\Local\\Programs\\Summa',
  });
  assert.deepEqual(reopenInstalled({mode: 'bundle', deskDir: '/Applications/Summa.app/Contents/Resources/app', platform: 'darwin'}), {
    cmd: 'open', args: ['/Applications/Summa.app'],
  });
  assert.deepEqual(reopenInstalled({mode: 'git', deskDir: '/home/ana/mesa/desk', platform: 'win32'}), {
    cmd: 'npm', args: ['start'], cwd: '/home/ana/mesa/desk', shell: true,
  });
});

test('modo bundle no Windows re-sincroniza o payload pelo install-app (#181)', async () => {
  const {clone} = installedCopy();
  const calls = [];
  const logs = [];
  await updater.syncBundle({
    mode: 'bundle', sourceDir: clone, platform: 'win32',
    run: async (cmd, args, opts) => {
      calls.push({cmd, args, cwd: opts.cwd});
      return {stdout: 'Instalado: C:\\Users\\ana\\AppData\\Local\\Programs\\Summa\nAtalho: C:\\Users\\ana\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Summa.lnk\n'};
    },
    log: (line) => logs.push(line),
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, 'node');
  assert.match(calls[0].args[0], /desk[\\/]scripts[\\/]install-app\.mjs$/);
  assert.equal(calls[0].cwd, path.join(clone, 'desk'));
  assert.ok(logs.some((line) => line.startsWith('Instalado: ')), 'a saída do install-app vai para o log');
});

test('modo git/zip no Windows não mexe em instalação nenhuma (#181)', async () => {
  const calls = [];
  await updater.syncBundle({mode: 'git', sourceDir: '/home/ana/mesa', platform: 'win32', run: async () => { calls.push('run'); }, log: () => {}});
  await updater.syncBundle({mode: 'zip', sourceDir: '/home/ana/mesa', platform: 'win32', run: async () => { calls.push('run'); }, log: () => {}});
  assert.deepEqual(calls, []);
});
