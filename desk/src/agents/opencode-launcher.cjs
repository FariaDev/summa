// @ts-check
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {findOpenCodeInLoginShell, findOpenCodeInLoginShellAsync} = require('./opencode-shell.cjs');
const {openCodeRuntimeBinary} = require('./opencode-binary.cjs');

/** @param {unknown} candidate @param {string} home @returns {string|null} */
function expandHome(candidate, home) {
  if (typeof candidate !== 'string' || !candidate) return null;
  if (candidate === '~') return home;
  if (candidate.startsWith('~/') || candidate.startsWith('~\\')) return path.resolve(home, candidate.slice(2));
  return path.resolve(candidate);
}

/**
 * Onde procurar o CLI: `LEARNING_DESK_OPENCODE`, o `opencodePath` (#102), a
 * cópia da Mesa no runtime (#94) e os instaladores usuais; só a existência é lida.
 * @param {{envPath?: string, configuredPath?: string, runtime?: string, version?: string, home?: string, platform?: NodeJS.Platform}} [options]
 * @returns {string[]}
 * @example candidatePaths({home: '/Users/ana', runtime: '/r'}) // ['/r/opencode/2.2.7/bin/opencode', '/Users/ana/.opencode/bin/opencode', …]
 */
function candidatePaths({envPath = '', configuredPath = '', runtime = '', version, home = os.homedir(), platform = process.platform} = {}) {
  /* Mesmo resolvedor para todos (CI windows-latest): `expandHome` usa `path.resolve`; um
     `path.join` puro devolvia `\casa\...` no Windows e o mesmo caminho saía
     com e sem drive conforme a origem. */
  const out = [expandHome(envPath, home), expandHome(configuredPath, home), ...(runtime ? [openCodeRuntimeBinary({runtime, version, platform})] : [])];
  if (platform === 'win32') out.push(path.resolve(home, 'AppData', 'Local', 'Programs', 'opencode', 'opencode.exe'), path.resolve(home, '.opencode', 'bin', 'opencode.exe'));
  out.push(path.resolve(home, '.opencode', 'bin', 'opencode'), path.resolve(home, '.local', 'bin', 'opencode'));
  if (platform !== 'win32') out.push('/opt/homebrew/bin/opencode', '/usr/local/bin/opencode');
  return [...new Set(out.filter((item) => typeof item === 'string'))];
}

/**
 * @typedef {{envPath?: string, configuredPath?: string, runtime?: string, version?: string, home?: string,
 *   platform?: NodeJS.Platform, shellPath?: string, env?: NodeJS.ProcessEnv, timeoutMs?: number,
 *   spawnSyncProcess?: typeof import('node:child_process').spawnSync}} LauncherOptions
 */

/** @param {string} file */
function isFile(file) {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}

/** @param {NodeJS.ProcessEnv} env @param {string} key */
function windowsEnv(env, key) {
  return env[Object.keys(env).find((name) => name.toUpperCase() === key) || key];
}

/** @param {NodeJS.ProcessEnv} env */
function findWindowsOpenCodeOnPath(env) {
  const extensions = (windowsEnv(env, 'PATHEXT') || '.COM;.EXE;.BAT;.CMD').toLowerCase().split(';')
    .filter((extension) => /^\.(?:com|exe|bat|cmd)$/.test(extension));
  for (const entry of (windowsEnv(env, 'PATH') || '').split(';')) {
    const dir = entry.trim().replace(/^"(.*)"$/, '$1');
    if (!dir) continue;
    const found = extensions.map((extension) => path.resolve(dir, `opencode${extension}`)).find(isFile);
    if (found) return found;
  }
  return '';
}

/** @param {LauncherOptions} options */
function findOpenCodeFile(options) {
  const found = candidatePaths(options).find(isFile);
  if (found || (options.platform ?? process.platform) !== 'win32') return found || '';
  return findWindowsOpenCodeOnPath(options.env ?? process.env);
}

/**
 * O primeiro candidato que existe: caminhos fixos, depois PATH no Windows ou
 * o shell de login no POSIX (#102). `shellPath: ''` desliga a pergunta ao shell.
 * @param {LauncherOptions} [options]
 * @returns {string}
 * @example findOpenCodeLauncher({envPath: process.env.LEARNING_DESK_OPENCODE})
 */
function findOpenCodeLauncher(options = {}) {
  return findOpenCodeFile(options) || findOpenCodeInLoginShell(options);
}

/**
 * A mesma descoberta, sem esperar pelo shell de login de forma síncrona.
 * @param {LauncherOptions} [options]
 * @returns {Promise<string>}
 * @example await findOpenCodeLauncherAsync({runtime: '/r'})
 */
async function findOpenCodeLauncherAsync(options = {}) {
  return findOpenCodeFile(options) || findOpenCodeInLoginShellAsync(options);
}

module.exports = {candidatePaths, findOpenCodeLauncher, findOpenCodeLauncherAsync};
