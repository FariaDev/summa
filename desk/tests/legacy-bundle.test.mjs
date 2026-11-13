/* #190: o bundle antigo (`Mesa de Estudos.app`) sobrevive à atualização como
   link para o Summa.app — é o que o updater antigo reabre — e o Summa apaga o
   link quando abre. A unidade usa o fake nomeado; a última checagem garante
   que o install-app usa o link em vez de apagar o caminho antigo direto. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

import {fakeLegacyBundleFs} from './fake-legacy-bundle-fs.mjs';
import {tempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const {LEGACY_BUNDLE_NAME, ensureLegacyBundleLink, removeLegacyBundle} = require('../legacy-bundle.cjs');

const APP = path.join('/repo', 'Summa.app');
const LEGACY = path.join('/repo', LEGACY_BUNDLE_NAME);
const DESK = path.resolve(import.meta.dirname, '..');
const INSTALL_APP = path.join(DESK, 'scripts', 'install-app.mjs');

test('instalador troca o bundle antigo por link para o Summa.app (#190)', () => {
  const disk = fakeLegacyBundleFs({app: APP, legacy: LEGACY, kind: 'bundle'});
  const result = ensureLegacyBundleLink({fs: disk, app: APP, legacyApp: LEGACY});
  assert.deepEqual(result, {linked: true});
  assert.deepEqual(disk.calls.rm, [{file: LEGACY, options: {recursive: true, force: true}}]);
  assert.deepEqual(disk.calls.symlink, [{target: APP, link: LEGACY}]);
});

test('instalador não cria o nome antigo quando ele não existe (#190)', () => {
  const disk = fakeLegacyBundleFs({app: APP, legacy: LEGACY});
  assert.deepEqual(ensureLegacyBundleLink({fs: disk, app: APP, legacyApp: LEGACY}), {linked: false});
  assert.deepEqual(disk.calls.rm, []);
  assert.deepEqual(disk.calls.symlink, []);
});

test('instalador não refaz o link que já aponta para o Summa.app (#190)', () => {
  const disk = fakeLegacyBundleFs({app: APP, legacy: LEGACY, kind: 'symlink', target: APP});
  assert.deepEqual(ensureLegacyBundleLink({fs: disk, app: APP, legacyApp: LEGACY}), {linked: false, already: true});
  assert.deepEqual(disk.calls.rm, []);
  assert.deepEqual(disk.calls.symlink, []);
});

test('o install-app não apaga o bundle antigo direto; deixa o link (#190)', () => {
  const source = fs.readFileSync(INSTALL_APP, 'utf8');
  assert.doesNotMatch(source, /fs\.rmSync\(legacyApp/);
  assert.match(source, /ensureLegacyBundleLink\(\{fs,app,legacyApp\}\)/);
});

test('ao abrir, o Summa remove o link do nome antigo (#190)', () => {
  const disk = fakeLegacyBundleFs({app: APP, legacy: LEGACY, kind: 'symlink', target: APP, appBundle: true});
  const result = removeLegacyBundle({fs: disk, bundle: APP, platform: 'darwin'});
  assert.equal(result.removed, true);
  assert.deepEqual(disk.calls.rm, [{file: LEGACY, options: {recursive: true, force: true}}]);
});

test('ao abrir, o Summa remove o bundle antigo de verdade (#190)', () => {
  const disk = fakeLegacyBundleFs({app: APP, legacy: LEGACY, kind: 'bundle', appBundle: true});
  const result = removeLegacyBundle({fs: disk, bundle: APP, platform: 'darwin'});
  assert.equal(result.removed, true);
  assert.deepEqual(disk.calls.rm, [{file: LEGACY, options: {recursive: true, force: true}}]);
});

test('o bundle em execução nunca é removido, mesmo com o nome antigo (#190)', () => {
  const disk = fakeLegacyBundleFs({app: LEGACY, legacy: LEGACY, kind: 'bundle', appBundle: true});
  const result = removeLegacyBundle({fs: disk, bundle: LEGACY, platform: 'darwin'});
  assert.equal(result.removed, false);
  assert.deepEqual(disk.calls.rm, []);
});

test('fora do macOS ou sem Info.plist a limpeza não faz nada (#190/#27)', () => {
  for (const [platform, appBundle] of [['linux', true], ['darwin', false]]) {
    const disk = fakeLegacyBundleFs({app: APP, legacy: LEGACY, kind: 'symlink', target: APP, appBundle});
    const result = removeLegacyBundle({fs: disk, bundle: APP, platform});
    assert.equal(result.removed, false, `${platform}/bundle=${appBundle}`);
    assert.deepEqual(disk.calls.lstat, [], `${platform}/bundle=${appBundle}`);
  }
});

test('erro ao remover o bundle antigo não lança e vai para o log (#190)', () => {
  const lines = [];
  const disk = fakeLegacyBundleFs({app: APP, legacy: LEGACY, kind: 'bundle', failRemove: true, appBundle: true});
  const result = removeLegacyBundle({fs: disk, bundle: APP, platform: 'darwin',
    log: (area, line) => lines.push([area, line])});
  assert.equal(result.removed, false);
  assert.match(result.error, /remoção recusada pelo fake/);
  assert.equal(lines.length, 1);
  assert.equal(lines[0][0], 'legacy-bundle');
  assert.match(lines[0][1], /Mesa de Estudos\.app.*remoção recusada pelo fake/);
});

/* #27: bundle de ensaio do install-app — executável `Electron` e
   `app.isPackaged=false` —, reconhecido pelo `Contents/Info.plist`. */
function realBundleTree({infoPlist}) {
  const root = tempDir('mesa-legacy-bundle-');
  const app = path.join(root, 'Summa.app');
  const desk = path.join(app, 'Contents', 'Resources', 'app', 'desk');
  fs.mkdirSync(desk, {recursive: true});
  if (infoPlist) fs.writeFileSync(path.join(app, 'Contents', 'Info.plist'), '<?xml version="1.0"?>\n<plist version="1.0"><dict/></plist>\n');
  const legacy = path.join(root, LEGACY_BUNDLE_NAME);
  fs.symlinkSync(app, legacy, 'dir');
  return {app, desk, legacy};
}

test('ao abrir, o Summa remove o link do bundle mesmo com app.isPackaged=false (#27)', () => {
  const {app, desk, legacy} = realBundleTree({infoPlist: true});
  /* #27: o install-app mantém o executável Electron, e o Electron reporta
     `isPackaged=false`; o Info.plist é o sinal de bundle. */
  const result = removeLegacyBundle({fs, bundle: app, platform: 'darwin', isPackaged: false});
  assert.equal(result.removed, true);
  assert.equal(fs.existsSync(legacy), false, 'o link Mesa de Estudos.app sai');
  assert.equal(fs.existsSync(path.join(app, 'Contents', 'Info.plist')), true, 'o Summa.app fica');
  assert.equal(fs.existsSync(desk), true, 'o payload do Summa.app fica');
});

test('sem Info.plist (clone) a limpeza não apaga o link (#27)', () => {
  const {app, desk, legacy} = realBundleTree({infoPlist: false});
  const result = removeLegacyBundle({fs, bundle: app, platform: 'darwin', isPackaged: false});
  assert.equal(result.removed, false);
  assert.equal(fs.lstatSync(legacy).isSymbolicLink(), true, 'o link Mesa de Estudos.app continua');
  assert.equal(fs.existsSync(desk), true);
});

test('a limpeza no main.cjs não depende de app.isPackaged (#27)', () => {
  const source = fs.readFileSync(path.join(DESK, 'main.cjs'), 'utf8');
  const guard = source.split('\n').find((line) => line.includes('removeLegacyBundle(') && line.includes('process.platform'));
  assert.ok(guard, 'main.cjs chama removeLegacyBundle');
  assert.doesNotMatch(guard, /isPackaged/);
});
