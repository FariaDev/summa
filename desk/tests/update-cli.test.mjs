import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {acquireLock} from '../updater-worker.cjs';
import {tempDir} from './temp-dir.mjs';

for (const xdgConfigHome of [false, true]) {
 const configHome = xdgConfigHome ? 'XDG_CONFIG_HOME' : '~/.config';
 test(`update CLI usa o lock do runtime configurado em ${configHome} no Linux`, {skip: process.platform !== 'linux'}, () => {
  const home = tempDir('summa-update-cli-');
  const env = {...process.env, HOME: home};
  delete env.LEARNING_DESK_RUNTIME;
  delete env.XDG_CONFIG_HOME;
  if (xdgConfigHome) env.XDG_CONFIG_HOME = path.join(home, 'xdg');
  const configDir = path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'Mesa de Estudos');
  const runtime = path.join(home, 'runtime-personalizado');
  fs.mkdirSync(configDir, {recursive: true});
  fs.mkdirSync(runtime);
  fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({runtimePath: runtime}));
  const lock = acquireLock(runtime);
  assert.ok(lock.ok, lock.reason);

  try {
   const cli = path.join(import.meta.dirname, '..', 'scripts', 'update-cli.mjs');
   const result = spawnSync(process.execPath, [cli, '--sem-reabrir', '--versao', '0.0.0'], {env, encoding: 'utf8', timeout: 10000});
   assert.ifError(result.error);
   assert.equal(result.status, 1, result.stderr);
   assert.ok(result.stderr.includes(`apague ${lock.file})`), result.stderr);
  } finally {
   lock.release();
  }
 });
}
