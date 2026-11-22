import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* Trava a cobertura do `npm run typecheck` (#43 fase 3). O tsc verifica o que
   casa com `include` do `tsconfig.json` (menos `exclude`), com `checkJs` ligado,
   e cada arquivo de lá começa com `// @ts-check`. Regras:
   - a cobertura só cresce: TYPECHECK_FLOOR é o tamanho dela hoje; ao criar
     arquivo novo coberto, suba o piso;
   - todo arquivo da lista tem `// @ts-check` na primeira linha;
   - todo arquivo com `// @ts-check` está na lista (senão o comentário promete
     uma verificação que ninguém roda). */
const DESK = path.resolve(import.meta.dirname, '..');
const TYPECHECK_FLOOR = 568;
const SKIPPED_DIRS = new Set(['node_modules', 'tests', 'generated', 'out']);
const TS_CHECK = '// @ts-check';

/* `include`/`exclude` só usam `*` (dentro de um segmento) e `**` (qualquer
   profundidade), então basta traduzir esses dois para regex. */
function globRegex(pattern) {
  const escape = (part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  const body = pattern.split('/').map((part) => part === '**' ? '(?:[^/]+/)*' : `${escape(part)}/`).join('');
  return new RegExp(`^${body.endsWith('/') ? body.slice(0, -1) : `${body}[^/]+`}$`);
}

function listedFiles() {
  const config = JSON.parse(fs.readFileSync(path.join(DESK, 'tsconfig.json'), 'utf8'));
  const include = config.include.map(globRegex);
  const exclude = (config.exclude || []).map(globRegex);
  return sourceFilesAll().filter((file) => include.some((rx) => rx.test(file)) && !exclude.some((rx) => rx.test(file)));
}

function sourceFilesAll(dir = DESK, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'tests' || entry.name === 'out') continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...sourceFilesAll(path.join(dir, entry.name), relative));
    else if (/\.(cjs|mjs|js)$/.test(entry.name)) out.push(relative);
  }
  return out;
}

function sourceFiles(dir = DESK, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name)) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...sourceFiles(path.join(dir, entry.name), relative));
    else if (/\.(cjs|mjs|js)$/.test(entry.name)) out.push(relative);
  }
  return out;
}

const firstLine = (file) => fs.readFileSync(path.join(DESK, file), 'utf8').split('\n', 1)[0];

test('a lista do typecheck só cresce', () => {
  const files = listedFiles();
  assert.ok(files.length >= TYPECHECK_FLOOR,
    `tsconfig.json verifica ${files.length} arquivos; esperado pelo menos ${TYPECHECK_FLOOR}. A lista só cresce: devolva o arquivo tirado (e tipe o que quebrou).`);
});

test('todo arquivo da lista começa com // @ts-check', () => {
  const missing = listedFiles().filter((file) => firstLine(file).trim() !== TS_CHECK);
  assert.deepEqual(missing, [], `sem "${TS_CHECK}" na primeira linha: ${missing.join(', ')}`);
});

test('todo arquivo com // @ts-check está na lista do tsconfig.json', () => {
  const listed = new Set(listedFiles());
  const orphans = sourceFiles().filter((file) => firstLine(file).trim() === TS_CHECK && !listed.has(file));
  assert.deepEqual(orphans, [], `com "${TS_CHECK}" mas fora do "include" do tsconfig.json (o tsc não os vê): ${orphans.join(', ')}`);
});
