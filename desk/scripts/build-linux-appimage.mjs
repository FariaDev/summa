// @ts-check
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {ensureElectronBinary} from './electron-binary.mjs';

const require = createRequire(import.meta.url);
const {stageBundlePayload, writeManifest} = require('../bundle-runtime.cjs');
const {appImageAssetName} = require('../updater-signature.cjs');
const DESK = path.resolve(import.meta.dirname, '..');

/**
 * Monta o AppDir com Electron Linux e o payload independente do clone.
 * @param {{desk:string,electronDist:string,stage:string,version:string}} input
 * @returns {{payload:string}}
 * @example stageLinuxRelease({desk,electronDist,stage,version:'1.4.0'})
 */
export function stageLinuxRelease({desk, electronDist, stage, version}) {
  if (!fs.existsSync(path.join(electronDist, 'electron'))) throw Error('Electron Linux ausente; esperado electron na distribuição informada');
  fs.cpSync(electronDist, stage, {recursive: true});
  fs.chmodSync(stage, 0o755);
  fs.rmSync(path.join(stage, 'resources', 'default_app.asar'), {force: true});
  const payload = path.join(stage, 'resources', 'app');
  writeManifest(payload, stageBundlePayload(desk, payload), version);
  fs.copyFileSync(path.join(desk, 'assets', 'mesa-1024.png'), path.join(stage, 'summa.png'));
  fs.writeFileSync(path.join(stage, 'summa.desktop'), '[Desktop Entry]\nType=Application\nName=Summa\nExec=AppRun %U\nIcon=summa\nCategories=Education;\nTerminal=false\n');
  // AppImage não preserva SUID; só desliga o sandbox inteiro se namespaces não funcionarem.
  fs.writeFileSync(path.join(stage, 'AppRun'), `#!/bin/sh
APPDIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" != 1 ] && unshare -Ur true 2>/dev/null; then
  exec "$APPDIR/electron" --disable-setuid-sandbox "$@"
fi
exec "$APPDIR/electron" --no-sandbox "$@"
`, {mode: 0o755});
  return {payload};
}

/**
 * Argumentos reproduzíveis do appimagetool para x86_64, sem exigir FUSE no build.
 * @param {{stage:string,outFile:string}} input
 * @returns {string[]}
 * @example appImageToolArgs({stage:'/build/Summa.AppDir',outFile:'/out/Summa.AppImage'})
 */
export function appImageToolArgs({stage, outFile}) {
  return ['--appimage-extract-and-run', stage, outFile];
}

async function main(args) {
  if (process.platform !== 'linux' || process.arch !== 'x64') throw Error(`plataforma recebida: ${process.platform}/${process.arch}; esperado linux/x64`);
  const at = args.indexOf('--out');
  if (at >= 0 && !args[at + 1]) throw Error('--out vazio; esperado uma pasta');
  const outDir = path.resolve(at >= 0 ? args[at + 1] : path.join(DESK, '..', 'release-appimage'));
  const version = JSON.parse(fs.readFileSync(path.join(DESK, 'package.json'), 'utf8')).version;
  const electronDir = path.join(DESK, 'node_modules', 'electron');
  ensureElectronBinary({electronDir});
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'summa-appimage-'));
  const outFile = path.join(outDir, appImageAssetName(version));
  try {
    stageLinuxRelease({desk: DESK, electronDist: path.join(electronDir, 'dist'), stage, version});
    fs.mkdirSync(outDir, {recursive: true});
    execFileSync(process.env.APPIMAGETOOL || 'appimagetool', appImageToolArgs({stage, outFile}), {stdio: 'inherit', env: {...process.env, ARCH: 'x86_64'}});
  } finally {
    fs.rmSync(stage, {recursive: true, force: true});
  }
  console.log(`AppImage: ${outFile} (${fs.statSync(outFile).size} bytes)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`build-linux-appimage: ${error.message}`);
    process.exitCode = 1;
  });
}
