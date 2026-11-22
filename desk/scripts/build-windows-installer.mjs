// @ts-check
/* Monta o `Summa-Setup-X.Y.Z.exe` (#119, ADR 0006): o Electron do Windows, o
   mesmo payload do `.app` e o script NSIS de `desk/scripts/summa.nsi`. O
   payload sai sem `install-source.json`: quem instala pelo `.exe` não tem clone.

   Uso (no Windows): npm run installer:windows -- --out <pasta>
   Em outro sistema, indique o Electron do Windows: --electron-dist <pasta>. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {stageBundlePayload, writeManifest} = require('../bundle-runtime.cjs');
const {copyElectronDist} = require('../windows-install.cjs');
const {installerAssetName} = require('../updater-signature.cjs');

const DESK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Monta a pasta que o instalador copia para `%LOCALAPPDATA%\Programs\Summa`.
 * @param {{desk: string, electronDist: string, stage: string, version: string}} input
 * @returns {{payload: string}}
 * @example stageWindowsRelease({desk, electronDist: 'node_modules/electron/dist', stage: 'C:\\tmp\\stage', version: '1.4.0'})
 */
export function stageWindowsRelease({desk, electronDist, stage, version}) {
  copyElectronDist({source: electronDist, dest: stage});
  const payload = path.join(stage, 'resources', 'app');
  writeManifest(payload, stageBundlePayload(desk, payload), version);
  return {payload};
}

/**
 * Tamanho instalado que o Windows mostra em Aplicativos instalados, em KB.
 * @param {string} stage pasta montada por `stageWindowsRelease`
 * @returns {number}
 * @example stageSizeKb('C:\\tmp\\stage') // 412000
 */
export function stageSizeKb(stage) {
  const entries = fs.readdirSync(stage, {recursive: true, withFileTypes: true});
  const bytes = entries.filter((entry) => entry.isFile()).reduce((sum, entry) => sum + fs.statSync(path.join(entry.parentPath, entry.name)).size, 0);
  return Math.ceil(bytes / 1024);
}

/**
 * Argumentos do `makensis` para esta versão.
 * @param {{desk: string, stage: string, outFile: string, version: string, installedKb: number, commit: string}} input
 * @returns {string[]}
 * @example makensisArgs({desk, stage, outFile: 'Summa-Setup-1.4.0.exe', version: '1.4.0', installedKb: 412000, commit: 'a'.repeat(40)})
 */
export function makensisArgs({desk, stage, outFile, version, installedKb, commit}) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw Error(`commit inválido: recebido ${JSON.stringify(commit)}; esperado SHA-1 git com 40 dígitos hexadecimais`);
  return [
    '-V2', '-WX',
    `-DVERSION=${version}`,
    `-DCOMMIT=${commit}`,
    `-DSTAGE_DIR=${stage}`,
    `-DOUT_FILE=${outFile}`,
    `-DINSTALLED_KB=${installedKb}`,
    `-DICON_FILE=${path.join(desk, 'assets', 'mesa.ico')}`,
    path.join(desk, 'scripts', 'summa.nsi'),
  ];
}

function flagValue(args, name) {
  const at = args.indexOf(name);
  return at >= 0 ? String(args[at + 1] || '') : '';
}

async function electronDistFor(args) {
  const given = flagValue(args, '--electron-dist');
  if (given) return path.resolve(given);
  if (process.platform !== 'win32') throw Error(`--electron-dist ausente; fora do Windows (recebido ${process.platform}) indique a pasta do Electron para win32-x64`);
  const {ensureElectronBinary} = await import('./electron-binary.mjs');
  const electronDir = path.join(DESK, 'node_modules', 'electron');
  ensureElectronBinary({electronDir});
  return path.join(electronDir, 'dist');
}

async function main(args) {
  const version = JSON.parse(fs.readFileSync(path.join(DESK, 'package.json'), 'utf8')).version;
  const commit = execFileSync('git', ['-C', DESK, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  const outDir = path.resolve(flagValue(args, '--out') || path.join(DESK, '..', 'release-installer'));
  const outFile = path.join(outDir, installerAssetName(version));
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'summa-installer-'));
  try {
    stageWindowsRelease({desk: DESK, electronDist: await electronDistFor(args), stage, version});
    fs.mkdirSync(outDir, {recursive: true});
    execFileSync(process.env.MAKENSIS || 'makensis', makensisArgs({desk: DESK, stage, outFile, version, installedKb: stageSizeKb(stage), commit}), {stdio: 'inherit'});
  } finally {
    fs.rmSync(stage, {recursive: true, force: true});
  }
  console.log(`instalador: ${outFile} (${fs.statSync(outFile).size} bytes)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`build-windows-installer: ${error.message}`);
    process.exitCode = 1;
  });
}
