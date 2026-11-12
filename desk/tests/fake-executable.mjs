import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {trackTempDir} from './temp-dir.mjs';

/* No Windows o CreateProcess não executa um script com shebang (`spawn
   EFTYPE`), e o Pi/instaladores de verdade chegam como `.cmd`/`.exe`. Os fakes
   dos testes passam a ter o mesmo formato que a produção encontra: no POSIX o
   script com shebang; no Windows um `.cjs`/`.mjs` + um `.cmd` que chama o Node.
   Sem isto o teste mediria o formato do fake, não o caminho do app. */

/** Escreve um fake executável no formato da plataforma.
 * @param {string} dir pasta do fake
 * @param {string} name nome do comando (sem extensão)
 * @param {string} source corpo do script (shebang é aceito)
 * @returns {string} caminho para passar a `spawn`/`PiBridge`
 * @example const pi = writeFakeExecutable(dir, 'pi', 'console.log("oi")\n');
 */
export function writeFakeExecutable(dir, name, source) {
  if (process.platform !== 'win32') {
    const file = path.join(dir, name);
    fs.writeFileSync(file, source);
    fs.chmodSync(file, 0o755);
    return file;
  }
  fs.writeFileSync(path.join(dir, `${name}.cjs`), source);
  return cmdShim(dir, name, path.join(dir, `${name}.cjs`));
}

/** Embrulha um script já escrito num `.cmd` no Windows; no POSIX devolve o
 * próprio script. A extensão (`.cjs`, `.mjs`) é preservada para o Node não
 * trocar o modo do módulo.
 * @param {string} script caminho do script já gravado
 * @param {string} [dir] pasta do shim (padrão: a do script)
 * @returns {string} caminho executável na plataforma
 * @example const opencode = fakeCommand(fileURLToPath(new URL('./fake-opencode.mjs', import.meta.url)), runtime);
 */
export function fakeCommand(script, dir = path.dirname(script)) {
  if (process.platform !== 'win32') {
    fs.chmodSync(script, 0o755);
    return script;
  }
  const name = path.basename(script, path.extname(script));
  return cmdShim(dir, name, path.resolve(script));
}

function cmdShim(dir, name, target) {
  const file = path.join(dir, `${name}.cmd`);
  fs.writeFileSync(file, `@echo off\r\n"${process.execPath}" "${target}" %*\r\n`);
  return file;
}

let engineLauncherRoot = '';

/**
 * O caminho que o app deve receber para subir um motor falso: no POSIX, o
 * próprio script; no Windows, um `.cmd` num diretório temporário que chama o
 * Node com o script e repassa os argumentos. O Windows não executa `.mjs`
 * direto (`spawn EFTYPE`), e o app já manda `.cmd` pelo cmd.exe
 * (`win-cmd-spawn.cjs`). O diretório é único por processo e varrido no fim,
 * como os runtimes de teste.
 * @param {string} script caminho do fake `.mjs`/`.cjs`
 * @param {{platform?: NodeJS.Platform, execPath?: string, dir?: string, write?: boolean}} [options]
 *   `platform`/`execPath`/`dir` existem para o teste unitário do shim; `write:false`
 *   devolve o caminho do `.cmd` sem criá-lo (motor que só aparece depois)
 * @returns {string} caminho para pôr em `LEARNING_DESK_OPENCODE` e afins
 * @example const opencode = fakeEngineLauncher(path.join(DESK, 'tests', 'fake-opencode.mjs'));
 */
export function fakeEngineLauncher(script, {platform = process.platform, execPath = process.execPath, dir, write = true} = {}) {
  const target = path.resolve(script);
  if (platform !== 'win32') {
    try { fs.chmodSync(target, 0o755); } catch { /* fake ausente (ghost) segue como está */ }
    return target;
  }
  if (/\.(exe|cmd|bat)$/i.test(target)) return target;
  const root = dir || (engineLauncherRoot || (engineLauncherRoot = trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-fake-engine-')))));
  fs.mkdirSync(root, {recursive: true});
  const name = path.basename(target, path.extname(target));
  const key = crypto.createHash('sha256').update(target).digest('hex').slice(0, 10);
  const file = path.join(root, `${name}-${key}.cmd`);
  if (write) fs.writeFileSync(file, `@echo off\r\n"${execPath}" "${target}" %*\r\n`);
  return file;
}
