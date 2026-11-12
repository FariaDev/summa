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
  const disk = fakeLegacyBundleFs({app: APP, legacy: LEGACY, kind: 'symlink', target: APP});
  const result = removeLegacyBundle({fs: disk, bundle: APP, platform: 'darwin', isPackaged: true});
  assert.equal(result.removed, true);
  assert.deepEqual(disk.calls.rm, [{file: LEGACY, options: {recursive: true, force: true}}]);
});

test('ao abrir, o Summa remove o bundle antigo de verdade (#190)', () => {
  const disk = fakeLegacyBundleFs({app: APP, legacy: LEGACY, kind: 'bundle'});
  const result = removeLegacyBundle({fs: disk, bundle: APP, platform: 'darwin', isPackaged: true});
  assert.equal(result.removed, true);
  assert.deepEqual(disk.calls.rm, [{file: LEGACY, options: {recursive: true, force: true}}]);
});

test('o bundle em execução nunca é removido, mesmo com o nome antigo (#190)', () => {
  const disk = fakeLegacyBundleFs({app: LEGACY, legacy: LEGACY, kind: 'bundle'});
  const result = removeLegacyBundle({fs: disk, bundle: LEGACY, platform: 'darwin', isPackaged: true});
  assert.equal(result.removed, false);
  assert.deepEqual(disk.calls.rm, []);
});

test('fora do macOS empacotado a limpeza não faz nada (#190)', () => {
  for (const [platform, isPackaged] of [['linux', true], ['darwin', false]]) {
    const disk = fakeLegacyBundleFs({app: APP, legacy: LEGACY, kind: 'symlink', target: APP});
    const result = removeLegacyBundle({fs: disk, bundle: APP, platform, isPackaged});
    assert.equal(result.removed, false, `${platform}/packaged=${isPackaged}`);
    assert.deepEqual(disk.calls.lstat, [], `${platform}/packaged=${isPackaged}`);
  }
});

test('erro ao remover o bundle antigo não lança e vai para o log (#190)', () => {
  const lines = [];
  const disk = fakeLegacyBundleFs({app: APP, legacy: LEGACY, kind: 'bundle', failRemove: true});
  const result = removeLegacyBundle({fs: disk, bundle: APP, platform: 'darwin', isPackaged: true,
    log: (area, line) => lines.push([area, line])});
  assert.equal(result.removed, false);
  assert.match(result.error, /remoção recusada pelo fake/);
  assert.equal(lines.length, 1);
  assert.equal(lines[0][0], 'legacy-bundle');
  assert.match(lines[0][1], /Mesa de Estudos\.app.*remoção recusada pelo fake/);
});
