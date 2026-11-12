import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fakeEngineLauncher} from './helpers.mjs';

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-fake-engine-test-'));
}

test('no POSIX o lançador é o próprio script, executável', () => {
  const dir = scratch();
  try {
    const script = path.join(dir, 'fake-opencode.mjs');
    fs.writeFileSync(script, '');
    assert.equal(fakeEngineLauncher(script, {platform: 'linux'}), script);
    /* O NTFS não guarda o bit de execução: no Windows real só o retorno vale (CI do PR #163). */
    if (process.platform !== 'win32') assert.ok(fs.statSync(script).mode & 0o100, 'o bit de execução fica ligado');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('no Windows o lançador é um .cmd que chama o Node com o script e os argumentos', () => {
  const dir = scratch();
  try {
    const script = path.join(dir, 'fake-opencode.mjs');
    fs.writeFileSync(script, '');
    const launchers = path.join(dir, 'launchers');
    const execPath = 'C:\\Program Files\\nodejs\\node.exe';
    const cmd = fakeEngineLauncher(script, {platform: 'win32', execPath, dir: launchers});
    assert.equal(path.dirname(cmd), launchers);
    assert.match(path.basename(cmd), /^fake-opencode-[0-9a-f]{10}\.cmd$/);
    assert.equal(fs.readFileSync(cmd, 'utf8'), `@echo off\r\n"${execPath}" "${script}" %*\r\n`);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('no Windows um .cmd/.exe já executável volta como está', () => {
  const dir = scratch();
  try {
    const cmd = path.join(dir, 'opencode.cmd');
    fs.writeFileSync(cmd, '@echo off\r\n');
    assert.equal(fakeEngineLauncher(cmd, {platform: 'win32'}), cmd);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
