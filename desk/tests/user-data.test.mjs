/* #137/#190: o caminho de dados que o app usa (`defaultUserData` de `main.cjs`)
   vem de `user-data.cjs`, o mesmo que o `npm run setup` lê. Com o nome Summa,
   o app fixa a pasta antiga (`<appData>/Mesa de Estudos`) para não abrir vazio.
   Este teste prova a conta contra o Electron de verdade: o runner imprime
   `electronUserData(app)` (a conta do main.cjs) depois do nome Summa, sem abrir janela. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {userDataDirectory, electronUserData, LEGACY_DATA_FOLDER} = require('../user-data.cjs');
const electronPath = require('electron');
const RUNNER = path.join(import.meta.dirname, 'fixtures', 'electron-user-data-runner.cjs');
const SANDBOX_LIMIT = /mach_port_rendezvous|bootstrap_check_in|sandbox_extension_issue_file_to_process|Process failed to launch/i;

/* No Windows o Electron acha o Roaming pela API de pastas conhecidas, não por
   `APPDATA`/`USERPROFILE`: com os dois apontando para uma pasta temporária, o
   runner morre com "Failed to get 'userData' path" (CI do PR #163). Lá o teste
   compara com o `APPDATA` real, que é o que `userDataDirectory` lê.

   No macOS o Electron resolve o `DIR_APP_DATA` do Chromium por
   `NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory,
   NSUserDomainMask, ...)` (`base/apple/foundation_util.mm`, `GetUserDirectory`),
   que vem do usuário do sistema e ignora o `HOME` do processo: na CI do #95,
   com `HOME` apontando para a pasta temporária, o Electron devolveu
   `/Users/runner/Library/Application Support/Mesa de Estudos`. Por isso o
   macOS também compara com o home real, como o Windows.

   O runner sai antes do `ready`, então não grava nada no perfil. */
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const scratchHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-user-data-'));
const home = isWindows || isMac ? os.homedir() : scratchHome;
const env = isWindows || isMac ? {...process.env} : {
  ...process.env,
  HOME: home,
  XDG_CONFIG_HOME: path.join(home, '.config'),
};
delete env.LEARNING_DESK_RUNTIME;
delete env.ELECTRON_RUN_AS_NODE;

const run = spawnSync(electronPath, [RUNNER], {env, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL'});
const output = `${run.stdout || ''}${run.stderr || ''}`;
const electronValue = /^__USERDATA__(.+)$/m.exec(String(run.stdout || ''))?.[1]?.trim() || '';
const skip = !electronValue && SANDBOX_LIMIT.test(output)
  ? `Electron não inicia neste ambiente (sandbox): ${output.split('\n').map((line) => line.trim()).filter(Boolean)[0] || 'sem saída'}`
  : false;

test.after(() => fs.rmSync(scratchHome, {recursive: true, force: true}));

test('userDataDirectory coincide com a pasta que o app monta a partir do appData do Electron (#137)', {skip}, () => {
  assert.ok(electronValue, `o runner não devolveu o userData do Electron:\n${output.slice(-3000)}`);
  assert.equal(userDataDirectory({platform: process.platform, home, env}), electronValue);
});

test('a pasta de dados continua "Mesa de Estudos" depois do nome Summa (#190)', () => {
  assert.equal(LEGACY_DATA_FOLDER, 'Mesa de Estudos', 'sem a pasta antiga o app abriria vazio');
  assert.equal(
    userDataDirectory({platform: 'linux', home: '/home', env: {XDG_CONFIG_HOME: '/xdg'}}),
    path.join('/xdg', 'Mesa de Estudos'),
  );
  assert.equal(path.basename(userDataDirectory({platform: 'darwin', home: '/Users/a', env: {}})), 'Mesa de Estudos');
});

test('electronUserData: pasta antiga por padrão, setPath explícito vence (#190)', () => {
  const fakeApp = (userData) => ({getName: () => 'Summa', getPath: (name) => (name === 'appData' ? '/ad' : userData)});
  assert.equal(electronUserData(fakeApp(path.join('/ad', 'Summa'))), path.join('/ad', 'Mesa de Estudos'));
  assert.equal(electronUserData(fakeApp('/tmp/isolado')), '/tmp/isolado', 'o harness dos testes fixa a sua pasta');
});
