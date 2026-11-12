// @ts-check
'use strict';

/* Onde está o `opencode` quando ele não está nos caminhos fixos (#102).

   O app aberto pelo Finder não herda o PATH do terminal: quem instalou o
   OpenCode por `bun` ou `npm` só o vê no PATH montado pelo rc do shell de
   login. Perguntamos ao shell da pessoa (`-ilc`), com prazo, e aceitamos só um
   arquivo executável de verdade. O rc pode imprimir qualquer coisa antes do
   comando; por isso o caminho vem entre marcadores. O Windows não tem shell de
   login (o comportamento de lá continua o dos caminhos fixos). */

const fs = require('node:fs');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');

const SHELL_TIMEOUT_MS = 3000;
const MARKER = '__MESA_OPENCODE__';

/** @typedef {{found: string, key: string}} ShellCache */

/** @type {ShellCache|null} */
let cache = null;
/** @type {{key: string, promise: Promise<string>}|null} */
let pending = null;
let shellGeneration = 0;

/**
 * Um arquivo comum com permissão de execução.
 * @param {unknown} file
 * @returns {boolean}
 * @example isExecutableFile('/home/ana/.bun/bin/opencode') // true
 */
function isExecutableFile(file) {
  if (typeof file !== 'string' || !file) return false;
  try {
    if (!fs.statSync(file).isFile()) return false;
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch { return false; }
}

/**
 * O shell de login a perguntar: o da pessoa ou um dos padrões do sistema.
 * @param {{env?: NodeJS.ProcessEnv, isExecutable?: (file: unknown) => boolean}} [options]
 * @returns {string}
 * @example loginShellPath({env: {SHELL: '/bin/zsh'}}) // '/bin/zsh'
 */
function loginShellPath({env = process.env, isExecutable = isExecutableFile} = {}) {
  return [env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh']
    .find((file) => !!file && isExecutable(file)) || '';
}

/**
 * O stdout de um shell que roda o comando, ou vazio quando ele falha/trava.
 * @param {{shell: string, env: NodeJS.ProcessEnv, timeoutMs: number,
 *   spawnSyncProcess: typeof spawnSync}} input
 * @returns {string}
 */
function runLoginShell({shell, env, timeoutMs, spawnSyncProcess}) {
  /* `-ilc` e não `-lc`: o `bun` põe o PATH no rc interativo (`.zshrc`), que um
     shell de login não-interativo não lê. Sem tty, a maioria dos rc só fala do
     job control no stderr, que não é lido. */
  const script = `printf '\\n${MARKER}%s${MARKER}\\n' "$(command -v opencode 2>/dev/null)"`;
  try {
    const result = spawnSyncProcess(shell, ['-ilc', script], {
      encoding: 'utf8', timeout: timeoutMs, killSignal: 'SIGKILL', env,
      windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (!result || result.error) return '';
    return typeof result.stdout === 'string' ? result.stdout : '';
  } catch { return ''; }
}

/**
 * O stdout de um shell que roda o comando, sem segurar o processo principal.
 * `definitive` é false quando o prazo estourou ou o spawn falhou — aí o
 * resultado não pode virar cache (#desempenho). Saída sem o marcador é
 * definitiva: o shell terminou e não achou.
 * @param {{shell: string, env: NodeJS.ProcessEnv, timeoutMs: number,
 *   spawnProcess: typeof spawn}} input
 * @returns {Promise<{output: string, definitive: boolean}>}
 */
function runLoginShellAsync({shell, env, timeoutMs, spawnProcess}) {
  const script = `printf '\\n${MARKER}%s${MARKER}\\n' "$(command -v opencode 2>/dev/null)"`;
  return new Promise((resolve) => {
    let output = '';
    let settled = false;
    const finish = (value, definitive) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({output: value, definitive});
    };
    let child;
    try {
      child = spawnProcess(shell, ['-ilc', script], {
        env, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      resolve({output: '', definitive: false});
      return;
    }
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* já saiu */ }
      finish('', false);
    }, timeoutMs);
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => { output += chunk; });
    child.on('error', () => finish('', false));
    child.on('close', () => finish(output, true));
  });
}

/**
 * O caminho entre os marcadores, quando ele é absoluto.
 * @param {string} output
 * @returns {string}
 * @example markedPath('rc falou\n__MESA_OPENCODE__/bin/opencode__\n') // '/bin/opencode'
 */
function markedPath(output) {
  const match = new RegExp(`${MARKER}([^\\n]*)${MARKER}`).exec(output);
  const candidate = match ? match[1].trim() : '';
  return candidate && path.isAbsolute(candidate) ? candidate : '';
}

/**
 * Pergunta ao shell de login onde está o `opencode`. Devolve `''` quando o
 * shell trava (prazo), imprime lixo sem o marcador, ou aponta um caminho que
 * não é um executável. A pergunta é síncrona e segura o processo principal, e
 * a detecção roda a cada sessão montada: por isso "não achei" vale até reabrir o
 * app. Escolher o caminho à mão não depende disto, porque `opencodePath` vem antes.
 * @param {{shellPath?: string, env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform,
 *   timeoutMs?: number, spawnSyncProcess?: typeof spawnSync,
 *   isExecutable?: (file: unknown) => boolean}} [options]
 *   `shellPath` ausente usa o shell da pessoa; `''` desliga a pergunta.
 * @returns {string}
 * @example findOpenCodeInLoginShell({shellPath: '/bin/zsh'}) // '/home/ana/.bun/bin/opencode'
 */
function findOpenCodeInLoginShell({shellPath, env = process.env, platform = process.platform,
  timeoutMs = SHELL_TIMEOUT_MS, spawnSyncProcess = spawnSync,
  isExecutable = isExecutableFile} = {}) {
  if (platform === 'win32') return '';
  const shell = shellPath === undefined ? loginShellPath({env, isExecutable}) : shellPath;
  if (!shell) return '';
  const key = JSON.stringify([shell, env.PATH || '', platform, timeoutMs]);
  if (cache && cache.key === key) {
    if (cache.found && isExecutable(cache.found)) return cache.found;
    if (!cache.found) return '';
  }
  const candidate = markedPath(runLoginShell({shell, env, timeoutMs, spawnSyncProcess}));
  const found = isExecutable(candidate) ? candidate : '';
  cache = {found, key};
  return found;
}

/**
 * A mesma pergunta do `findOpenCodeInLoginShell`, sem travar o processo
 * principal. Só um resultado definitivo (achou, ou o shell terminou sem achar)
 * grava no MESMO cache: prazo e erro de spawn não viram "não achei" permanente
 * e a chamada síncrona do `init` pergunta de novo (#desempenho).
 * @param {{shellPath?: string, env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform,
 *   timeoutMs?: number, spawnProcess?: typeof spawn,
 *   isExecutable?: (file: unknown) => boolean}} [options]
 * @returns {Promise<string>}
 * @example await findOpenCodeInLoginShellAsync({shellPath: '/bin/zsh'}) // '/home/ana/.bun/bin/opencode'
 */
function findOpenCodeInLoginShellAsync({shellPath, env = process.env, platform = process.platform,
  timeoutMs = SHELL_TIMEOUT_MS, spawnProcess = spawn,
  isExecutable = isExecutableFile} = {}) {
  if (platform === 'win32') return Promise.resolve('');
  const shell = shellPath === undefined ? loginShellPath({env, isExecutable}) : shellPath;
  if (!shell) return Promise.resolve('');
  const key = JSON.stringify([shell, env.PATH || '', platform, timeoutMs]);
  if (cache && cache.key === key) {
    if (cache.found && isExecutable(cache.found)) return Promise.resolve(cache.found);
    if (!cache.found) return Promise.resolve('');
  }
  if (pending && pending.key === key) return pending.promise;
  const generation = shellGeneration;
  const promise = runLoginShellAsync({shell, env, timeoutMs, spawnProcess})
    .then(({output, definitive}) => {
      const candidate = markedPath(output);
      const found = isExecutable(candidate) ? candidate : '';
      if (definitive && generation === shellGeneration) cache = {found, key};
      return found;
    })
    .finally(() => { if (pending && pending.promise === promise) pending = null; });
  pending = {key, promise};
  return promise;
}

/** Esquece o resultado guardado; só os testes precisam disso. */
function resetOpenCodeShellCache() {
  cache = null;
  pending = null;
  shellGeneration += 1;
}

module.exports = {SHELL_TIMEOUT_MS, findOpenCodeInLoginShell, findOpenCodeInLoginShellAsync, isExecutableFile, loginShellPath, resetOpenCodeShellCache};
