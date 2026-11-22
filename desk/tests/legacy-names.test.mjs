/* Mesa → Summa: o app se chama Summa. Nomes antigos (`mesa*`,
   `Mesa*`, `MESA_*`, `learning-desk`, `LEARNING_DESK_*`) que já existem ficam
   por compatibilidade — variáveis de ambiente que scripts e testes de quem usa
   a Mesa já passam, o servidor MCP `mesa` (os nomes `mcp__mesa__*` estão nas
   conversas gravadas e nos prompts) e APIs do renderer. A lista em
   `scripts/legacy-names.json` só encolhe: nome novo reprova, nome que sumiu
   do código tem de sair da lista. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DESK = path.resolve(import.meta.dirname, '..');
const LEGACY_ID = /\b(?:mesa[A-Z_]\w*|Mesa[A-Z]\w*|MESA_\w+|learningDesk\w*|LearningDesk\w*|LEARNING_DESK\w*)\b|learning-desk/g;
const LEGACY_PATH = /mesa|learning-desk/i;
const SCANNED = /\.(?:cjs|mjs|js|html|css|json)$/;
const SKIPPED = /^(?:src\/generated\/|tests\/fixtures\/)|(?:^|\/)package-lock\.json$|^scripts\/legacy-names\.json$/;

/**
 * Nomes antigos achados no texto, sem repetição.
 * @param {string} text conteúdo do arquivo
 * @returns {string[]} identificadores em ordem de aparição
 * @example legacyIdentifiers('const mesaTools = 1; // MESA_X') // ['mesaTools', 'MESA_X']
 */
export function legacyIdentifiers(text) {
  return [...new Set(text.match(LEGACY_ID) || [])];
}

function trackedFiles() {
  return execFileSync('git', ['ls-files'], {cwd: DESK, encoding: 'utf8'}).split('\n').filter(Boolean);
}

const allowed = JSON.parse(fs.readFileSync(path.join(DESK, 'scripts', 'legacy-names.json'), 'utf8'));

test('legacyIdentifiers acha as formas antigas e ignora a palavra comum', () => {
  assert.deepEqual(legacyIdentifiers('mesaTools MESA_GATE_CACHE learning-desk LEARNING_DESK_RUNTIME a mesa'), ['mesaTools', 'MESA_GATE_CACHE', 'learning-desk', 'LEARNING_DESK_RUNTIME']);
});

test('nenhum identificador mesa/learning-desk novo fora da lista documentada', () => {
  const files = trackedFiles().filter((file) => SCANNED.test(file) && !SKIPPED.test(file) && fs.existsSync(path.join(DESK, file)));
  const found = new Set(files.flatMap((file) => legacyIdentifiers(fs.readFileSync(path.join(DESK, file), 'utf8'))));
  const fresh = [...found].filter((name) => !allowed.identifiers.includes(name)).sort();
  const gone = allowed.identifiers.filter((name) => !found.has(name));
  assert.deepEqual(fresh, [], `nome antigo novo: ${fresh.join(', ')}; use summa/Summa (ou documente a exceção em scripts/legacy-names.json)`);
  assert.deepEqual(gone, [], `já saiu do código, tire de scripts/legacy-names.json: ${gone.join(', ')}`);
});

test('nenhum arquivo novo com mesa/learning-desk no caminho fora da lista', () => {
  const paths = trackedFiles().filter((file) => LEGACY_PATH.test(file));
  const fresh = paths.filter((file) => !allowed.paths.includes(file));
  const gone = allowed.paths.filter((file) => !paths.includes(file));
  assert.deepEqual(fresh, [], `caminho com nome antigo: ${fresh.join(', ')}`);
  assert.deepEqual(gone, [], `caminho que já saiu, tire de scripts/legacy-names.json: ${gone.join(', ')}`);
});
