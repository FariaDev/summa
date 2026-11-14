/* Binário do Electron antes da primeira janela (relatório do Mac, 2026-10-31).

   Desde o 45 o pacote `electron` não baixa o binário no `npm ci`: baixa na
   primeira vez que alguém pede o caminho. No `npm test` vários testes pediram
   juntos, um download atropelou o outro (`failed to create symlink … Electron
   Framework`) e o macOS acusou o `.app` pela metade. Quem abre muitas janelas
   (setup, `npm test`, `npm run ui`/`hunts`) garante o binário antes, uma vez. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {vcRedistProblem} from './windows-vcredist.mjs';

/**
 * O binário falta quando o `path.txt` não existe ou aponta para nada em `dist/`.
 * @param {string} electronDir a pasta `node_modules/electron`
 * @returns {boolean}
 * @example electronBinaryMissing('desk/node_modules/electron') // false depois do download
 */
export function electronBinaryMissing(electronDir) {
  const pathFile = path.join(electronDir, 'path.txt');
  if (!fs.existsSync(pathFile)) return true;
  const relative = fs.readFileSync(pathFile, 'utf8').trim();
  return !relative || !fs.existsSync(path.join(electronDir, 'dist', relative));
}

/**
 * Baixa o binário uma vez, em série, se faltar. Sem o pacote, não faz nada (o
 * `npm ci` é quem reclama). `run` roda o `install.js` e devolve o status e a
 * saída (um número também vale, para os testes antigos).
 * @param {{electronDir:string, run?:(installScript:string)=>number|null|{status:number|null, output?:string},
 *   platform?:string, existsSync?:(file:string)=>boolean, systemRoot?:string}} options
 * @returns {'present'|'downloaded'|'no-package'}
 * @example ensureElectronBinary({electronDir}) // 'present'
 */
export function ensureElectronBinary({electronDir, run = runInstallScript, platform = process.platform, existsSync = fs.existsSync, systemRoot = process.env.SystemRoot}) {
  const installScript = path.join(electronDir, 'install.js');
  if (!fs.existsSync(installScript)) return 'no-package';
  if (!electronBinaryMissing(electronDir)) return 'present';
  const beforeDownload = vcRedistProblem({platform, existsSync, systemRoot});
  if (beforeDownload) throw new Error(beforeDownload);
  console.log('Baixando o binário do Electron (uma vez, antes das janelas)…');
  const {status, output} = readRunResult(run(installScript));
  if (status !== 0 || electronBinaryMissing(electronDir)) {
    const hint = vcRedistProblem({platform, existsSync, systemRoot, output});
    throw new Error(hint || `o download do Electron falhou (status ${status}); esperado o binário em ${path.basename(electronDir)}/dist. Apague node_modules/electron e rode npm ci.`);
  }
  return 'downloaded';
}

function readRunResult(result) {
  if (!result || typeof result !== 'object') return {status: result, output: ''};
  return {status: result.status, output: result.output || ''};
}

/* A saída é capturada para reconhecer a falha de dlopen do Windows (#5) e
   reimpressa inteira; o install.js não mostra progresso, então nada se perde. */
function runInstallScript(installScript) {
  const result = spawnSync(process.execPath, [installScript], {encoding: 'utf8'});
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return {status: result.status, output: `${result.stdout || ''}\n${result.stderr || ''}`};
}
