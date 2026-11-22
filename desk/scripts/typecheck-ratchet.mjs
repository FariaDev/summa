/* `npm run typecheck` com catraca do strictNullChecks (#43 fase 3). O tsconfig
   liga `strictNullChecks`, mas ~2 mil erros antigos ainda moram em arquivos da
   dívida (`scripts/strict-null-debt.json`, arquivo -> teto de erros). Reprova:
   erro em arquivo fora da dívida, arquivo da dívida acima do teto, e arquivo da
   dívida já limpo (tire-o da lista). Abaixo do teto só avisa para baixar o teto.
   Uso: `node scripts/typecheck-ratchet.mjs` (em `desk/`). */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ERROR_LINE = /^(.+?)\(\d+,\d+\): error TS\d+:/;

/**
 * Conta os erros do `tsc --pretty false` por arquivo (caminho com /).
 * @param {string} output saída do tsc
 * @returns {{byFile: Map<string, number>, global: string[]}} `global` são erros sem arquivo
 * @example tscErrors('a.mjs(1,2): error TS2322: x\n').byFile.get('a.mjs') // 1
 */
export function tscErrors(output) {
  const byFile = new Map();
  const global = [];
  for (const line of output.split(/\r?\n/)) {
    const match = ERROR_LINE.exec(line);
    if (match) {
      const file = match[1].split(path.sep).join('/').replace(/\\/g, '/');
      byFile.set(file, (byFile.get(file) || 0) + 1);
    } else if (/^error TS\d+:/.test(line)) global.push(line);
  }
  return {byFile, global};
}

/**
 * Compara os erros com a dívida.
 * @param {Map<string, number>} byFile erros por arquivo
 * @param {Record<string, number>} debt teto de erros de cada arquivo da dívida
 * @returns {{fresh: string[], over: string[], paid: string[], lower: string[]}}
 * @example judgeRatchet(new Map([['a.mjs', 2]]), {'a.mjs': 3, 'b.mjs': 1}) // {fresh: [], over: [], paid: ['b.mjs'], lower: ['a.mjs: 2 < 3']}
 */
export function judgeRatchet(byFile, debt) {
  const fresh = [...byFile.keys()].filter((file) => !(file in debt)).sort();
  const over = [];
  const paid = [];
  const lower = [];
  for (const [file, cap] of Object.entries(debt)) {
    const count = byFile.get(file) || 0;
    if (count > cap) over.push(`${file}: ${count} > ${cap}`);
    else if (count === 0) paid.push(file);
    else if (count < cap) lower.push(`${file}: ${count} < ${cap}`);
  }
  return {fresh, over, paid, lower};
}

function main() {
  const desk = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const tsc = path.join(desk, 'node_modules', 'typescript', 'bin', 'tsc');
  const run = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json', '--pretty', 'false'], {cwd: desk, encoding: 'utf8'});
  if (run.error) throw run.error;
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const debt = JSON.parse(fs.readFileSync(path.join(desk, 'scripts', 'strict-null-debt.json'), 'utf8'));
  const {byFile, global} = tscErrors(output);
  const {fresh, over, paid, lower} = judgeRatchet(byFile, debt);
  const freshSet = new Set(fresh);
  const shown = output.split(/\r?\n/).filter((line) => freshSet.has((ERROR_LINE.exec(line)?.[1] || '').replace(/\\/g, '/')));
  if (shown.length) console.error(shown.join('\n'));
  if (global.length) console.error(global.join('\n'));
  if (over.length) console.error(`typecheck: arquivos da dívida acima do teto (scripts/strict-null-debt.json):\n${over.join('\n')}`);
  if (paid.length) console.error(`typecheck: já limpos, tire da dívida (scripts/strict-null-debt.json):\n${paid.join('\n')}`);
  if (lower.length) console.log(`typecheck: abaixo do teto, baixe-o em scripts/strict-null-debt.json:\n${lower.join('\n')}`);
  const failed = fresh.length || global.length || over.length || paid.length || (run.status !== 0 && !byFile.size);
  if (failed) {
    if (run.status !== 0 && !byFile.size && !global.length) console.error(output);
    process.exit(1);
  }
  const debtErrors = [...byFile.values()].reduce((sum, count) => sum + count, 0);
  console.log(`typecheck: ok (${Object.keys(debt).length} arquivos e ${debtErrors} erros de strictNullChecks na dívida).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
