import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {vcRedistProblem, VC_REDIST_URL} from '../scripts/windows-vcredist.mjs';
import {ensureElectronBinary} from '../scripts/electron-binary.mjs';

/* VM Windows 11 limpa (#5): sem o VC++ Redistributable x64 o download do
   Electron falha com ERR_DLOPEN_FAILED, e a mensagem antiga mandava apagar o
   node_modules. A detecção confere a dll antes do download e a saída depois. */
const DLL_PRESENT = () => true;
const DLL_MISSING = () => false;
const DLOPEN_OUTPUT = 'Error: Cannot find native binding. npm has a bug related to optional dependencies\n  code=ERR_DLOPEN_FAILED';

function electronPackage() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-vcredist-test-'));
  fs.writeFileSync(path.join(dir, 'install.js'), '');
  return dir;
}

test('Windows sem vcruntime140.dll: manda instalar o VC++ Redistributable antes do download', () => {
  const message = vcRedistProblem({platform: 'win32', existsSync: DLL_MISSING});
  assert.match(message, /Visual C\+\+ Redistributable x64/);
  assert.ok(message.includes(VC_REDIST_URL), 'traz o link oficial');
  assert.match(message, /instale e rode npm run setup de novo/);
});

test('Windows com a dll e falha de dlopen no download: a mesma explicação', () => {
  assert.equal(vcRedistProblem({platform: 'win32', existsSync: DLL_PRESENT, output: DLOPEN_OUTPUT}), vcRedistProblem({platform: 'win32', existsSync: DLL_MISSING}));
});

test('Windows com a dll e outro erro: a mensagem antiga continua', () => {
  assert.equal(vcRedistProblem({platform: 'win32', existsSync: DLL_PRESENT, output: 'o download falhou por falta de rede'}), null);
});

test('fora do Windows nada muda, mesmo sem a dll ou com a falha de dlopen', () => {
  assert.equal(vcRedistProblem({platform: 'linux', existsSync: DLL_MISSING}), null);
  assert.equal(vcRedistProblem({platform: 'linux', existsSync: DLL_MISSING, output: DLOPEN_OUTPUT}), null);
});

test('a dll é procurada em System32', () => {
  const seen = [];
  vcRedistProblem({platform: 'win32', systemRoot: 'C:\\Windows', existsSync: (file) => { seen.push(file); return true; }});
  assert.deepEqual(seen, ['C:\\Windows\\System32\\vcruntime140.dll']);
});

test('setup no Windows sem a dll explica antes de tentar o download', () => {
  const dir = electronPackage();
  assert.throws(
    () => ensureElectronBinary({electronDir: dir, platform: 'win32', existsSync: DLL_MISSING, run: () => assert.fail('não pode baixar')}),
    /Visual C\+\+ Redistributable x64/,
  );
});

test('setup no Windows com o erro de dlopen não manda apagar o node_modules', () => {
  const dir = electronPackage();
  assert.throws(
    () => ensureElectronBinary({electronDir: dir, platform: 'win32', existsSync: DLL_PRESENT, run: () => ({status: 1, output: DLOPEN_OUTPUT})}),
    (error) => /instale e rode npm run setup de novo/.test(error.message) && !/Apague node_modules/.test(error.message),
  );
});
