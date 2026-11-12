/* Mede, na janela real, quanto a gravação do turno atrasa o event loop do
   processo principal (#119). A conversa de 5.000 mensagens é aberta com o
   OpenCode falso e dois turnos são enviados; o main é instrumentado pelo
   Playwright (`app.evaluate`), sem tocar no código do app: o wrapper mede o
   tempo síncrono de `updateClaudeConversation` (reescrita completa) e de
   `writeTurnMetadata` (arquivo pequeno do turno), e o `monitorEventLoopDelay`
   registra o atraso do loop durante os turnos. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  withArtifacts, newRuntime, seedCourse, writeDeskJson, writeConfigJson, launchDesk,
  statusOnline, sendEnabled, seedNativeSession, fakeEngineLauncher,
} from './helpers.mjs';
import {syntheticMessages} from '../scripts/measure-conversation-write.mjs';

const FAKE_OPENCODE_BIN = fakeEngineLauncher(path.resolve(import.meta.dirname, 'fake-opencode.mjs'));
/* 5.000 é o caso da issue; a variável serve para um fumo rápido do roteiro. */
const MESSAGES = Number(process.env.MESA_UI_WRITE_MESSAGES || 5000);
const TURNS = 2;
/* #119: cada turno normal tem UMA reescrita completa do descritor, no
   `turn_end`; a fase da entrega vai para o arquivo pequeno. */
const FULL_WRITES_PER_TURN = 1;

/* O caminho real no main: `nativePersistence` chama estas funções e o serviço
   dispara a completa no `turn_end`. */
async function instrumentMain(app) {
  const patched = await app.evaluate(() => {
    const mainRequire = process.mainModule.require.bind(process.mainModule);
    const {performance, monitorEventLoopDelay} = mainRequire('node:perf_hooks');
    const conversations = mainRequire(mainRequire('node:path').join(process.cwd(), 'src/agents/conversations.cjs'));
    const original = conversations.updateClaudeConversation;
    globalThis.__writeSamples = [];
    conversations.updateClaudeConversation = function patchedWrite(...args) {
      const started = performance.now();
      try {
        return original.apply(this, args);
      } finally {
        const patch = args[1] && typeof args[1] === 'object' ? Object.keys(args[1]).join('+') : '';
        globalThis.__writeSamples.push({ms: performance.now() - started, patch});
      }
    };
    const originalTurn = conversations.writeTurnMetadata;
    globalThis.__turnSamples = [];
    conversations.writeTurnMetadata = function patchedTurnWrite(...args) {
      const started = performance.now();
      try {
        return originalTurn.apply(this, args);
      } finally {
        globalThis.__turnSamples.push(performance.now() - started);
      }
    };
    const histogram = monitorEventLoopDelay({resolution: 5});
    histogram.enable();
    globalThis.__writeHistogram = histogram;
    return conversations.updateClaudeConversation !== original && conversations.writeTurnMetadata !== originalTurn;
  });
  assert.equal(patched, true, 'o main expôs os caminhos reais de gravação para a medição');
}

async function resetTurnWindow(app) {
  await app.evaluate(() => {
    globalThis.__writeSamples = [];
    globalThis.__turnSamples = [];
    globalThis.__writeHistogram.reset();
  });
}

async function readTurnWindow(app) {
  return app.evaluate(() => {
    const histogram = globalThis.__writeHistogram;
    histogram.disable();
    return {
      samples: globalThis.__writeSamples,
      turnSamples: globalThis.__turnSamples,
      maxMs: histogram.max / 1e6,
      p95Ms: histogram.percentile(95) / 1e6,
      p99Ms: histogram.percentile(99) / 1e6,
    };
  });
}

async function sendTurn(page, text, expected) {
  await page.locator('#prompt').fill(text);
  await page.locator('#send').click();
  await page.waitForFunction(({wanted, count}) => [...document.querySelectorAll('.message.assistant .body')]
    .filter((element) => element.textContent.includes(wanted)).length >= count, {wanted: 'Resposta medida fixa.', count: expected}, {timeout: 60000});
  await sendEnabled(page, {timeout: 60000});
}

await withArtifacts('conversation-write', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('conversation-write');
  const folder = seedCourse(runtime, 'Calculo');
  writeConfigJson(runtime, {vaultPath: runtime, courses: [{id: 'Calculo', name: 'Cálculo', path: folder}]});
  const session = seedNativeSession(runtime, syntheticMessages(MESSAGES), {courseId: 'Calculo'});
  writeDeskJson(runtime, {courseId: 'Calculo', session, courseStates: {Calculo: {session, sessions: [{path: session}]}}});
  fs.chmodSync(FAKE_OPENCODE_BIN, 0o755);

  const app = ctx.app = await launchDesk({
    runtime, opencode: false,
    env: {LEARNING_DESK_OPENCODE: FAKE_OPENCODE_BIN, FAKE_OPENCODE_REPLY: 'Resposta medida fixa.'},
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await statusOnline(page, {timeout: 120000});
  await page.waitForFunction(() => document.querySelectorAll('#messages .message').length > 0, undefined, {timeout: 60000});

  await instrumentMain(app);
  /* Uma janela só para os dois turnos: o atraso do loop cobre as gravações de
     ambos, sem zerar entre eles. */
  await resetTurnWindow(app);
  await sendTurn(page, 'turno de medição 1', 1);
  await sendTurn(page, 'turno de medição 2', 2);

  /* espera fixa: o timer atrasado do histograma só roda no tique seguinte. */
  await page.waitForTimeout(200);
  const result = await readTurnWindow(app);
  const times = result.samples.map((sample) => sample.ms);
  assert.equal(result.samples.length, TURNS * FULL_WRITES_PER_TURN,
    `esperava uma reescrita completa por turno (#119) e recebi ${result.samples.length} em ${TURNS} turnos`);
  assert.ok(result.samples.every((sample) => sample.patch.split('+').includes('messages')),
    'a reescrita completa do turno é a das mensagens');
  assert.ok(result.turnSamples.length >= TURNS, `o metadado do turno passou pelo arquivo pequeno (${result.turnSamples.length} gravações)`);
  assert.ok(times.every((value) => Number.isFinite(value) && value > 0), 'toda gravação medida precisa ter tempo positivo');
  assert.ok(result.maxMs >= Math.max(...times) / 2, 'o event loop não pode ficar abaixo da metade da maior gravação');
  assert.deepEqual(errors, []);

  const byPatch = new Map();
  for (const sample of result.samples) {
    if (!byPatch.has(sample.patch)) byPatch.set(sample.patch, []);
    byPatch.get(sample.patch).push(sample.ms.toFixed(1));
  }
  const turnMax = Math.max(...result.turnSamples);
  const sizeMb = fs.statSync(session).size / 1048576;
  console.log(`ok conversation-write-ui: mensagens=${MESSAGES} arquivo=${sizeMb.toFixed(2)}MB `
    + `gravações=${result.samples.length} `
    + `[${[...byPatch].map(([patch, values]) => `${patch || '?'}=[${values.join(', ')}]ms`).join(' ')}] `
    + `metadado=${result.turnSamples.length} (máx ${turnMax.toFixed(1)}ms) `
    + `event-loop max=${result.maxMs.toFixed(1)}ms p95=${result.p95Ms.toFixed(1)}ms p99=${result.p99Ms.toFixed(1)}ms`);
  await app.close();
  ctx.app = null;
});
