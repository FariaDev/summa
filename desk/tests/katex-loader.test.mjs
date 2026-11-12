/* KaTeX sob demanda (#desempenho): marcador antes do import, hidratação igual
   ao desenho direto, falha com TeX cru + `data-tex`, retentativa e marcador
   inserido tarde. Roda o cenário Electron (katex-loader-scenarios.cjs); o
   KaTeX e o DOMPurify precisam de DOM de verdade. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {createRequire} from 'node:module';
import {testEnv} from './electron-env.mjs';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const DESK = path.resolve(import.meta.dirname, '..');
const SCENARIO = path.join(DESK, 'tests', 'katex-loader-scenarios.cjs');
const SANDBOX_LIMIT = /mach_port_rendezvous|bootstrap_check_in|sandbox_extension_issue_file_to_process|Process failed to launch/i;

function runScenario() {
  const run = spawnSync(electronPath, [SCENARIO], {
    cwd: DESK,
    env: testEnv({DESK_TEST: '1'}),
    encoding: 'utf8',
    timeout: 120000,
    killSignal: 'SIGKILL',
  });
  const match = /__RESULT__ (\{.*\})\s*$/m.exec(String(run.stdout || ''));
  return {output: `${run.stdout || ''}${run.stderr || ''}`, data: match ? JSON.parse(match[1]) : null};
}

const {output, data} = runScenario();
const skip = !data && SANDBOX_LIMIT.test(output)
  ? `Electron não inicia neste ambiente (sandbox): ${output.split('\n').map((line) => line.trim()).filter(Boolean)[0] || 'sem saída'}`
  : false;

function got() {
  assert.ok(data, `sem resultado:\n${output.slice(-3000)}`);
  return data;
}

test('render antes do import vira marcador; o import hidrata igual ao desenho direto', {skip}, () => {
  const {before, after, direct} = got().pendingThenHydrated;
  assert.equal(before.markers, 2, 'as duas fórmulas viram marcador');
  assert.equal(before.katex, 0, 'nada de fórmula crua nem KaTeX antes do import');
  assert.equal(before.text.trim(), 'Antes  e depois  fim', 'o marcador fica vazio, sem piscar a fonte');
  assert.deepEqual(before.dataTex, ['$x+1$', '$$y^2$$'], 'o marcador já leva a fonte para copiar/citar');
  assert.equal(after.markers, 0, 'não sobra marcador depois do import');
  assert.equal(after.katex, 2, 'as duas fórmulas desenharam');
  assert.equal(after.html, direct, 'o HTML final é idêntico ao desenho direto');
});

test('import que falha vira TeX cru com data-tex, loga uma vez e a retentativa hidrata', {skip}, () => {
  const {failed, retried} = got().failureFallsBack;
  assert.deepEqual(failed.texts, ['$a$', '$$b$$'], 'a fórmula mostra o TeX cru como texto');
  assert.deepEqual(failed.dataTex, ['$a$', '$$b$$'], 'o data-tex da fonte acompanha a falha');
  assert.equal(failed.katex, 0, 'sem KaTeX na falha');
  assert.equal(failed.logs.length, 1, 'o erro é registrado uma vez, não por fórmula');
  assert.match(failed.logs[0], /KaTeX/, 'o log diz o que falhou');
  assert.doesNotMatch(failed.logs[0], /\/home\//, 'o log não carrega caminho pessoal');
  assert.equal(retried.katex, 2, 'a retentativa desenha as duas fórmulas');
  assert.equal(retried.markers, 0, 'a hidratação da retentativa troca os marcadores');
  assert.equal(retried.raw, false, 'o TeX cru some depois do desenho');
});

test('marcador inserido depois do import é hidratado pela hidratação do subtree', {skip}, () => {
  const {before, after, direct} = got().lateMarkerHydrated;
  assert.deepEqual(before, {markers: 1, katex: 0}, 'o HTML guardado de antes do import entrou como marcador');
  assert.equal(after.markers, 0, 'a hidratação do subtree não deixa marcador órfão');
  assert.equal(after.katex, 1, 'a fórmula tardia desenhou');
  assert.equal(after.html, direct, 'o HTML final é idêntico ao desenho direto');
});

test('cache do histórico (#120) não guarda o marcador de antes do import do KaTeX', {skip}, () => {
  const run = got().cachedSkipsPendingMarker;
  assert.equal(run.pendingHasMarker, true, 'antes do import a fórmula sai como marcador');
  assert.equal(run.sizeBefore, 0, 'o HTML com marcador não entrou no cache');
  assert.equal(run.drawnHasKatex, true, 'depois do import o mesmo texto desenha a fórmula');
  assert.equal(run.drawnHasMarker, false, 'sem marcador no HTML desenhado');
  assert.equal(run.hits, 1, 'a segunda leitura sai do cache');
  assert.equal(run.same, true, 'o cache devolve o HTML desenhado');
});
