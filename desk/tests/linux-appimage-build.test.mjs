import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {stageLinuxRelease, appImageToolArgs} from '../scripts/build-linux-appimage.mjs';
import {tempDir} from './temp-dir.mjs';

const DESK = path.resolve(import.meta.dirname, '..');

function fakeLinuxElectronDist() {
  const dist = tempDir('summa-linux-electron-');
  fs.mkdirSync(path.join(dist, 'resources'));
  fs.writeFileSync(path.join(dist, 'electron'), 'electron', {mode: 0o755});
  fs.writeFileSync(path.join(dist, 'resources', 'default_app.asar'), 'genérico');
  return dist;
}

test('AppDir leva Electron, payload, ícone e entrada executável sem origem de clone', () => {
  const stage = tempDir('summa-appdir-');
  const {payload} = stageLinuxRelease({desk: DESK, electronDist: fakeLinuxElectronDist(), stage, version: '9.9.9'});
  assert.equal(fs.existsSync(path.join(stage, 'resources', 'default_app.asar')), false);
  assert.equal(fs.existsSync(path.join(payload, 'install-source.json')), false);
  for (const file of ['main.cjs', 'index.html', 'node_modules/marked/package.json', 'update-signing-key.pub']) assert.ok(fs.existsSync(path.join(payload, file)), file);
  assert.equal(JSON.parse(fs.readFileSync(path.join(payload, '.update-manifest.json'))).version, '9.9.9');
  assert.equal(fs.statSync(path.join(stage, 'AppRun')).mode & 0o111, 0o111);
  assert.equal(fs.statSync(stage).mode & 0o777, 0o755);
  assert.match(fs.readFileSync(path.join(stage, 'AppRun'), 'utf8'), /exec "\$APPDIR\/electron" --no-sandbox "\$@"/);
  assert.match(fs.readFileSync(path.join(stage, 'summa.desktop'), 'utf8'), /Exec=AppRun %U\nIcon=summa/);
  assert.deepEqual(fs.readFileSync(path.join(stage, 'summa.png')), fs.readFileSync(path.join(DESK, 'assets', 'mesa-1024.png')));
});

test('AppDir recusa distribuição vazia ou ausente', () => {
  for (const electronDist of [tempDir('summa-empty-dist-'), '/distribuicao-ausente']) {
    assert.throws(() => stageLinuxRelease({desk: DESK, electronDist, stage: tempDir('summa-stage-'), version: '1.4.0'}), /Electron Linux ausente/);
  }
});

test('appimagetool recebe caminhos sem quebrar espaços e dispensa FUSE no build', () => {
  assert.deepEqual(appImageToolArgs({stage: '/build com espaço', outFile: '/out/Summa.AppImage'}), ['--appimage-extract-and-run', '/build com espaço', '/out/Summa.AppImage']);
});
