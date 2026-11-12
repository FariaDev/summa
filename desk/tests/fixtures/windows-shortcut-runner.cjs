'use strict';

/* Runner do teste do atalho no menu Iniciar (#178): roda no Windows de verdade
   (Electron), cria o .lnk com um `APPDATA` temporário e imprime o que o próprio
   `shell.readShortcutLink` leu. Só depois do `ready` o shell do Windows está
   pronto para escrever o atalho. */

const path = require('node:path');
const fs = require('node:fs');
const {app, shell} = require('electron');
const {ensureStartMenuShortcut} = require('../../windows-shortcut.cjs');

app.whenReady().then(() => {
  const appData = process.argv[2];
  const appPath = path.resolve(__dirname, '..', '..');
  const deps = {
    shell,
    platform: process.platform,
    env: {APPDATA: appData},
    execPath: process.execPath,
    appPath,
    assetsDir: path.join(appPath, 'assets'),
    defaultApp: true,
    fs,
    log: () => {},
  };
  const first = ensureStartMenuShortcut(deps);
  const second = ensureStartMenuShortcut(deps);
  const file = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Summa.lnk');
  let shortcut;
  try {
    shortcut = shell.readShortcutLink(file);
  } catch (error) {
    shortcut = {error: error.message};
  }
  process.stdout.write(`__SHORTCUT__${JSON.stringify({appPath, execPath: process.execPath, first, second, shortcut})}\n`);
  app.exit(shortcut.error ? 1 : 0);
}).catch(error => {
  console.error(error && (error.stack || error.message) || String(error));
  app.exit(1);
});
