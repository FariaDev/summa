/* KaTeX nos cartões (regressão do quiz-edge): montar um quiz sem fórmula
   visível já pede o import, para a explicação escondida com fórmula nascer
   desenhada depois da resposta; e a resposta pintada antes de o import chegar
   é hidratada na chegada, sem depender do observador de 2 s. Roda o cenário
   Electron (cards-math-scenarios.cjs); o KaTeX e o DOMPurify precisam de DOM
   de verdade. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {createRequire} from 'node:module';
import {testEnv} from './electron-env.mjs';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const DESK = path.resolve(import.meta.dirname, '..');
const SCENARIO = path.join(DESK, 'tests', 'cards-math-scenarios.cjs');
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

test('quiz montado pré-carrega o KaTeX e a explicação nasce com .katex', {skip}, () => {
  const {beforeAnswer, fakeCalls, afterAnswer} = got().preloadOnMount;
  assert.equal(beforeAnswer.explanation, false, 'a explicação não aparece antes da resposta');
  assert.equal(fakeCalls, 0, 'a montagem do quiz já pediu o import; o carregador de reserva não foi usado');
  assert.ok(afterAnswer.katex >= 1, 'a explicação respondida desenha a fórmula');
  assert.equal(afterAnswer.markers, 0, 'não sobra marcador .math-loading na explicação');
});

test('explicação pintada antes do import é hidratada na chegada, sem observador', {skip}, () => {
  const {beforeAnswer, beforeArrival, afterArrival} = got().answerWhileMathLoads;
  assert.equal(beforeAnswer.explanation, false, 'a explicação não aparece antes da resposta');
  assert.equal(beforeArrival.katex, 0, 'sem KaTeX a fórmula ainda é marcador');
  assert.ok(beforeArrival.markers >= 1, 'a resposta pinta o marcador provisório');
  assert.ok(afterArrival.katex >= 1, 'quando o import chega a fórmula desenha');
  assert.equal(afterArrival.markers, 0, 'a hidratação não deixa marcador órfão, mesmo sem MutationObserver');
});
