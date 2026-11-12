/* #137: o `npm run setup` lê o `config.json` do diretório de dados da pessoa e
   passa a config ao `detectTutorEngines`; o `opencodePath` escolhido nas
   Configurações (#102) passa a contar no relatório do setup. Tudo com
   diretório temporário injetado — o HOME de verdade não é tocado. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {setupTutorEngines} from '../scripts/setup-engines.mjs';

const DESK = path.resolve(import.meta.dirname, '..');

function fakeOpenCode(dir) {
  fs.mkdirSync(dir, {recursive: true});
  const file = path.join(dir, 'opencode-escolhido');
  fs.writeFileSync(file, '#!/bin/sh\necho 2.2.4\n');
  fs.chmodSync(file, 0o755);
  return file;
}

test('setup relata o OpenCode do opencodePath no config.json (#137)', {skip: process.platform === 'win32' && 'o binário falso é script sh'}, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-setup-engines-'));
  try {
    const chosen = fakeOpenCode(path.join(dir, 'bin'));
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({opencodePath: chosen}));
    const report = setupTutorEngines({configDir: dir, env: {}, home: dir, platform: 'linux', deskDir: DESK});
    assert.equal(report.config.opencodePath, chosen, 'a config lida é a mesma que o app usaria');
    assert.deepEqual(report.engineLabels, ['OpenCode']);
    assert.equal(report.preferredEngine, 'opencode');
    assert.equal(report.preferredLabel, 'OpenCode');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('config ausente ou inválida não derruba o setup (#137)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-setup-sem-config-'));
  try {
    const missing = setupTutorEngines({configDir: dir, env: {}, home: dir, platform: 'win32', deskDir: DESK});
    assert.equal(missing.config, null);
    assert.deepEqual(missing.engineLabels, [], 'sem config e sem instalador, nenhum motor');
    assert.equal(missing.preferredEngine, 'opencode');
    fs.writeFileSync(path.join(dir, 'config.json'), '{"opencodePath":');
    const invalid = setupTutorEngines({configDir: dir, env: {}, home: dir, platform: 'win32', deskDir: DESK});
    assert.equal(invalid.config, null, 'JSON inválido é lido como config ausente');
    assert.ok(Array.isArray(invalid.engineLabels));
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
