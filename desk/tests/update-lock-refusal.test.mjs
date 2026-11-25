import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeIpcMain, fakeShell} from './fake-electron-shell.mjs';
import {fakeInstallerSwitchHost} from './fake-installer-switch-host.mjs';
import {tempDir} from './temp-dir.mjs';

/* Uma atualização em curso (worker no `npm ci`) e um novo clique em Atualizar:
   a janela diz que a Summa reabre sozinha, sem mandar apagar arquivo interno,
   e o desk.log ganha o caminho e a idade do lock. */
const require = createRequire(import.meta.url);
const {registerUpdateHost} = require('../update-host.cjs');
const {lockedUpdateError} = require('../update-lock-refusal.cjs');
const updater = require('../updater.cjs');
const ptBR = require('../src/locales/pt-BR.json');
const en = require('../src/locales/en.json');

function heldLock(runtime, ageMs) {
 const file = path.join(runtime, 'update.lock');
 fs.writeFileSync(file, JSON.stringify({pid: 1, at: Date.now() - ageMs, cmd: 'worker'}) + '\n');
 return file;
}

test('err.update.locked não cita arquivo nem pede para apagar nada', () => {
 for (const phrase of [ptBR['err.update.locked'], en['err.update.locked']]) {
  assert.doesNotMatch(phrase, /\{file\}|lock|apague|delete|\//i, phrase);
  assert.match(phrase, /30/, 'diz quando vale tentar de novo');
 }
 assert.match(ptBR['err.update.locked'], /reabre sozinha/);
 assert.match(en['err.update.locked'], /reopens by itself/);
});

test('lockedUpdateError: loga caminho e idade em segundos; o erro não leva o caminho', () => {
 const runtime = tempDir('mesa-lock-refusal');
 const file = heldLock(runtime, 0);
 const at = JSON.parse(fs.readFileSync(file, 'utf8')).at;
 const logs = [];
 const error = lockedUpdateError({lock: {file}, appendLog: (src, line) => logs.push([src, line]), now: at + 95_400});
 assert.deepEqual(logs, [['update', `atualização recusada: lock ${file} com 95 s`]]);
 assert.equal(error.message.includes(file), false);
 assert.match(error.message, /err\.update\.locked/);
 lockedUpdateError({lock: {file: path.join(runtime, 'sumiu.lock')}, appendLog: (src, line) => logs.push([src, line])});
 assert.match(logs[1][1], /sumiu\.lock com \? s$/, 'lock ilegível não derruba a recusa');
});

test('update-apply recusado pelo lock escreve a linha no log e não cita o caminho', async () => {
 const runtime = tempDir('mesa-lock-apply');
 updater.writeCache(path.join(runtime, 'update.json'), {release: {at: Date.now(), version: '9.0.0', notes: '', url: ''}});
 const file = heldLock(runtime, 180_000);
 const logs = [];
 const ipcMain = fakeIpcMain();
 registerUpdateHost({
  ipcMain, shell: fakeShell(), runtime, deskDir: runtime, logFile: path.join(runtime, 'desk.log'), testMode: false, platform: 'linux', env: {},
  app: {isPackaged: true, hasSingleInstanceLock: () => true, getVersion: () => '1.0.0'}, config: () => ({}), win: () => null,
  appendLog: (src, line) => logs.push(`${src}: ${line}`), toolHost: {state: () => ({}), persist: () => {}, isBusy: () => false, hasBridge: () => false, relink: () => {}},
 });
 const error = await ipcMain.invoke('update-apply').then(() => assert.fail('devia recusar'), (e) => e);
 assert.match(error.message, /err\.update\.locked/);
 assert.equal(error.message.includes(file), false, 'o caminho do lock fica no log, não na janela');
 const refused = logs.filter((line) => line.includes('atualização recusada'));
 assert.equal(refused.length, 1, logs.join('\n'));
 assert.match(refused[0], new RegExp(`^update: atualização recusada: lock ${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} com 1(79|80|81) s$`));
 assert.ok(fs.existsSync(file), 'a recusa não mexe no lock da atualização em curso');
});

test('update-switch entrega o appendLog para a troca nativa logar a recusa', async () => {
 const {ipcMain, calls} = fakeInstallerSwitchHost();
 await ipcMain.invoke('update-switch');
 assert.equal(typeof calls[0].appendLog, 'function');
});
