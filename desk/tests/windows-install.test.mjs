/* #181: instalação por usuário no Windows, espelhando o `.app` do macOS.
   A montagem dos scripts PowerShell e da chave entra por parâmetro; o fake
   nomeado (`fake-powershell.mjs`) guarda o que seria executado, então os
   testes rodam no Linux sem powershell.exe nem registro. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

import {fakePowerShell} from './fake-powershell.mjs';
import {tempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const windowsInstall = require('../windows-install.cjs');
const {WINDOWS_APP_ID} = require('../windows-shortcut.cjs');

const ENV = {LOCALAPPDATA: '/home/ana/AppData/Local', APPDATA: '/home/ana/AppData/Roaming'};
const INSTALL = path.join(ENV.LOCALAPPDATA, 'Programs', 'Summa');
const PAYLOAD = path.join(INSTALL, 'resources', 'app');
const SHORTCUT = path.join(ENV.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Summa.lnk');

test('installDir/payloadDir põem a Mesa em %LOCALAPPDATA%\\Programs, sem admin (#181)', () => {
  assert.equal(windowsInstall.installDir({env: ENV}), INSTALL);
  assert.equal(windowsInstall.payloadDir({env: ENV}), PAYLOAD);
  assert.throws(() => windowsInstall.installDir({env: {}}), /LOCALAPPDATA ausente.*%LOCALAPPDATA%\\Programs\\Summa/i);
});

test('atalho do Iniciar leva alvo, ícone da Mesa e AppUserModelId (#181, #178)', () => {
  const script = windowsInstall.shortcutScript({
    env: ENV, execPath: path.join(INSTALL, 'electron.exe'), appPath: PAYLOAD, assetsDir: path.join(PAYLOAD, 'assets'),
  });
  assert.ok(script.includes(`CreateShortcut('${SHORTCUT}')`), script);
  assert.ok(script.includes(`$shortcut.TargetPath = '${path.join(INSTALL, 'electron.exe')}'`), script);
  assert.ok(script.includes(`$shortcut.Arguments = ''`), 'sem `npm start`: o electron.exe acha resources/app sozinho');
  assert.ok(script.includes(`$shortcut.WorkingDirectory = '${PAYLOAD}'`), script);
  assert.ok(script.includes(`$shortcut.IconLocation = '${path.join(PAYLOAD, 'assets', 'mesa.ico')},0'`), script);
  assert.ok(script.includes(`$shortcut.Description = 'Summa'`), script);
  assert.ok(script.includes(`[MesaShortcut]::SetAppUserModelId('${SHORTCUT}', '${WINDOWS_APP_ID}')`), script);
  assert.equal(WINDOWS_APP_ID, 'br.com.fariadev.mesa-de-estudos');
  /* O WScript.Shell não grava o AUMID; o IPropertyStore entra por C# inline. */
  assert.match(script, /IPropertyStore/);
  assert.match(script, /9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3/);
});

test('aspas e espaços nos caminhos não quebram o PowerShell (#181)', () => {
  const quoted = {LOCALAPPDATA: `/home/O'Brien/AppData/Local`, APPDATA: `/home/O'Brien/AppData/Roaming`};
  const script = windowsInstall.uninstallScript({env: quoted});
  const install = path.join(quoted.LOCALAPPDATA, 'Programs', 'Summa');
  assert.ok(script.includes(`$installDir = '${install.replace("'", "''")}'`), script);
  assert.ok(script.includes(`Summa.lnk'`), script);
  assert.ok(script.includes(`O''Brien`), 'apóstrofo do caminho é duplicado no literal PowerShell');
  assert.ok(!script.includes(`O'Brien`), 'nenhum apóstrofo solto sobra no script');
});

test('aspa curva no caminho também é dobrada: o PowerShell a lê como apóstrofo (#181)', () => {
  const curly = {LOCALAPPDATA: `/home/D’Avila/AppData/Local`, APPDATA: `/home/D’Avila/AppData/Roaming`};
  const script = windowsInstall.uninstallScript({env: curly});
  assert.ok(script.includes(`D’’Avila`), script);
  assert.ok(!/D’Avila/.test(script.replace(/’’/g, '')), 'nenhuma aspa curva solta sobra no script');
});

test('chave de desinstalação tem nome, versão do package.json, ícone, publisher e UninstallString (#181)', () => {
  const values = windowsInstall.registryValues({env: ENV, version: '1.2.0'});
  assert.deepEqual(values, {
    DisplayName: 'Summa',
    DisplayVersion: '1.2.0',
    DisplayIcon: path.join(PAYLOAD, 'assets', 'mesa.ico'),
    Publisher: 'Lucas Faria',
    UninstallString: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${path.join(PAYLOAD, 'scripts', 'uninstall.ps1')}"`,
  });
  assert.ok(values.UninstallString.includes('"'), 'o caminho do UninstallString vai entre aspas');
  const script = windowsInstall.registryScript({env: ENV, version: '1.2.0'});
  assert.ok(script.includes(`$key = '${windowsInstall.UNINSTALL_KEY}'`), script);
  assert.ok(script.includes(`New-Item -Path $key -Force`), script);
  for (const [name, value] of Object.entries(values)) {
    assert.ok(script.includes(`-Name '${name}' -Value '${value.replace(/'/g, "''")}' -PropertyType String`), `${name} ausente do script`);
  }
});

test('desinstalador só apaga a pasta da instalação, o atalho e a chave (#181)', () => {
  const targets = windowsInstall.uninstallTargets({env: ENV});
  assert.deepEqual(targets, {installDir: INSTALL, shortcut: SHORTCUT, key: windowsInstall.UNINSTALL_KEY});
  assert.equal(targets.key, 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Summa');
  const script = windowsInstall.uninstallScript({env: ENV});
  /* A única remoção recursiva é a pasta literal da instalação; atalho e chave
     vão como literais próprios. O alvo do `Remove-Item` nunca vem do usuário. */
  const removals = [...script.matchAll(/Remove-Item -LiteralPath ('(?:[^']|'')*'|\$\w+)/g)].map(match => match[1]);
  assert.deepEqual(removals, ['$full', `'${SHORTCUT}'`, `'${windowsInstall.UNINSTALL_KEY}'`]);
  assert.equal((script.match(/Remove-Item/g) || []).length, 3, script);
  /* A pasta sai pelo Directory.Delete do .NET, que não entra em junção interna;
     `Remove-Item -Recurse` só sobra para a chave do registro. */
  assert.match(script, /\[System\.IO\.Directory\]::Delete\(\$full, \$true\)/);
  assert.ok(!/Remove-Item -LiteralPath \$full -Recurse/.test(script), script);
  /* Guardas: pasta canônica dentro de ...\Programs e nome exato; link simbólico
     perde só o link (nunca o alvo). */
  assert.match(script, /GetFullPath\(\$installDir\)/);
  assert.match(script, /\.StartsWith\(\$parent, \[System\.StringComparison\]::OrdinalIgnoreCase\)/);
  assert.match(script, /GetFileName\(\$full\), 'Summa'/);
  assert.match(script, /ReparsePoint/);
  /* Dados do aluno em %APPDATA%\Mesa de Estudos não são tocados. */
  assert.ok(!script.includes(path.join(ENV.APPDATA, 'Mesa de Estudos')), 'userData do aluno fora do desinstalador');
  assert.ok(!script.includes(path.join(ENV.LOCALAPPDATA, 'Programs') + path.sep + '..'), 'sem caminho relativo que escape de Programs');
});

test('desinstalador não é montado sem LOCALAPPDATA/APPDATA (#181)', () => {
  assert.throws(() => windowsInstall.uninstallScript({env: {APPDATA: ENV.APPDATA}}), /LOCALAPPDATA ausente/);
  assert.throws(() => windowsInstall.uninstallScript({env: {LOCALAPPDATA: ENV.LOCALAPPDATA}}), /APPDATA ausente/);
});

test('copyElectronDist copia o dist, mas deixa o default_app.asar fora (#181)', () => {
  const root = tempDir('mesa-win-electron');
  const source = path.join(root, 'dist');
  fs.mkdirSync(path.join(source, 'resources'), {recursive: true});
  fs.writeFileSync(path.join(source, 'electron.exe'), 'exe');
  fs.writeFileSync(path.join(source, 'resources', 'icudtl.dat'), 'icu');
  fs.writeFileSync(path.join(source, 'resources', 'default_app.asar'), 'genérico');
  const dest = path.join(root, 'install');
  windowsInstall.copyElectronDist({source, dest});
  assert.equal(fs.readFileSync(path.join(dest, 'electron.exe'), 'utf8'), 'exe');
  assert.equal(fs.readFileSync(path.join(dest, 'resources', 'icudtl.dat'), 'utf8'), 'icu');
  assert.equal(fs.existsSync(path.join(dest, 'resources', 'default_app.asar')), false, 'sem fallback para o app do Electron');
  assert.throws(() => windowsInstall.copyElectronDist({source: path.join(root, 'nada'), dest}), /Electron ausente: esperava .*electron\.exe/);
});

test('installWindows copia Electron, monta payload, grava desinstalador e chama os dois scripts (#181)', () => {
  const root = tempDir('mesa-win-flow');
  const env = {LOCALAPPDATA: path.join(root, 'Local'), APPDATA: path.join(root, 'Roaming')};
  const install = windowsInstall.installDir({env});
  const payload = windowsInstall.payloadDir({env});
  const powershell = fakePowerShell();
  const calls = [];
  const result = windowsInstall.installWindows({
    desk: '/mesa/desk', root: '/mesa', electronDir: '/mesa/node_modules/electron', env, version: '1.2.0',
    deps: {
      copyElectron: ({source, dest}) => calls.push(['copy', source, dest]),
      installPayload: ({desk, root: repo, installDir, version}) => {
        calls.push(['payload', desk, repo, installDir, version]);
        fs.mkdirSync(path.join(installDir, 'resources', 'app', 'assets'), {recursive: true});
        return {dest: path.join(installDir, 'resources', 'app'), managed: []};
      },
      runPowerShell: (script) => { calls.push(['powershell', script]); powershell.run(script); },
    },
  });
  assert.deepEqual(calls[0], ['copy', path.join('/mesa/node_modules/electron', 'dist'), install]);
  assert.deepEqual(calls[1], ['payload', '/mesa/desk', '/mesa', install, '1.2.0']);
  assert.equal(calls[2][0], 'powershell');
  assert.match(calls[2][1], /CreateShortcut/);
  assert.equal(calls[3][0], 'powershell');
  assert.match(calls[3][1], /New-ItemProperty/);
  assert.deepEqual(powershell.scripts, [calls[2][1], calls[3][1]]);
  assert.deepEqual(result, {
    installDir: install, payloadDir: payload,
    shortcut: path.join(env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Summa.lnk'),
  });
  assert.equal(fs.readFileSync(path.join(payload, 'scripts', 'uninstall.ps1'), 'utf8'), windowsInstall.uninstallScript({env}));
});
