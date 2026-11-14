/* Mede, na janela real, quanto a gravação da conversa ainda bloqueia o
   processo principal por turno depois da #119 (uma reescrita completa no
   `turn_end`). A #4 propõe mover essa gravação para `worker_threads`; este
   teste dá o número com janela para a decisão.

   A conversa sintética de 5.000 mensagens é semeada no runtime temporário do
   teste e aberta com o OpenCode falso. Depois de a janela terminar de montar o
   histórico, um turno é enviado. O bloqueio do main é lido por
   `perf_hooks.monitorEventLoopDelay` no processo principal (instrumentado por
   `app.evaluate`, como em `conversation-write-ui.mjs`), e as long tasks da
   janela por `PerformanceObserver` de `longtask` no renderer. As gravações
   reais (`updateClaudeConversation` e `writeTurnMetadata`) também são
   cronometradas para conferir o número do event loop.

   O teste imprime os números e só falha se a Mesa quebrar: o turno não
   terminar, a conversa não gravar a pergunta/resposta ou a janela lançar erro.
   Não há limite de tempo — a medição acompanha a máquina.

   Uso: `cd desk && DISPLAY=:0 npm run ui -- conversation-write-block --jobs 1`. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  withArtifacts, newRuntime, seedCourse, writeDeskJson, writeConfigJson, launchDesk,
  statusOnline, sendEnabled, seedNativeSession, fakeEngineLauncher,
} from './helpers.mjs';
import {syntheticMessages} from '../scripts/measure-conversation-write.mjs';

const FAKE_OPENCODE_BIN = fakeEngineLauncher(path.resolve(import.meta.dirname, 'fake-opencode.mjs'));
const REPLY = 'Resposta medida do bloqueio.';
const PROMPT = 'turno de medição de bloqueio';
/* 5.000 é o caso da issue; a variável serve para um fumo rápido do roteiro. */
const MESSAGES = Number(process.env.MESA_UI_WRITE_MESSAGES || 5000);
/* O último turno sintético fecha com esta fala: vê-la prova que a janela já
   montou o histórico inteiro antes de medir o turno novo. */
const LAST_TURN = Math.ceil(MESSAGES / 4);
const LAST_TEXT = `Fechando a resposta ${LAST_TURN}`;

/* O caminho real no main: `nativePersistence` chama estas funções e o serviço
   dispara a completa no `turn_end` (#119). O histograma mede o atraso do loop,
   que é o bloqueio sentido pela janela e pelo IPC. */
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

/* Long tasks da janela: cada tarefa acima de 50 ms que o renderer executou
   durante o turno. */
async function observeLongTasks(page) {
  return page.evaluate(() => {
    globalThis.__longTasks = [];
    globalThis.__longTaskSupported = Array.isArray(PerformanceObserver.supportedEntryTypes)
      && PerformanceObserver.supportedEntryTypes.includes('longtask');
    if (!globalThis.__longTaskSupported) return false;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) globalThis.__longTasks.push({ms: entry.duration});
    });
    observer.observe({type: 'longtask', buffered: false});
    globalThis.__longTaskObserver = observer;
    return true;
  });
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

async function readLongTasks(page) {
  return page.evaluate(() => {
    const observer = globalThis.__longTaskObserver;
    if (observer) {
      for (const entry of observer.takeRecords()) globalThis.__longTasks.push({ms: entry.duration});
      observer.disconnect();
    }
    return {supported: globalThis.__longTaskSupported === true, tasks: globalThis.__longTasks};
  });
}

/* A gravação acontece no `turn_end`, antes do `agent_settled` que reabilita o
   Enviar. A leitura com prazo cobre um flush atrasado sem transformar tempo em
   falha: só reprova se a conversa nunca gravar o turno. */
async function waitForSavedTurn(file, {timeout = 5000} = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const stored = JSON.parse(fs.readFileSync(file, 'utf8')).messages || [];
    const tail = stored.slice(-4).map((message) => JSON.stringify(message.content));
    const saved = tail.some((content) => content.includes(PROMPT)) && tail.some((content) => content.includes(REPLY));
    if (saved) return {saved: true, stored: stored.length};
    if (Date.now() >= deadline) return {saved: false, stored: stored.length};
    // espera fixa: intervalo do poll até o descritor terminar de gravar
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await withArtifacts('conversation-write-block', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('conversation-write-block');
  const folder = seedCourse(runtime, 'Calculo');
  writeConfigJson(runtime, {vaultPath: runtime, courses: [{id: 'Calculo', name: 'Cálculo', path: folder}]});
  const session = seedNativeSession(runtime, syntheticMessages(MESSAGES), {courseId: 'Calculo'});
  writeDeskJson(runtime, {courseId: 'Calculo', session, courseStates: {Calculo: {session, sessions: [{path: session}]}}});
  fs.chmodSync(FAKE_OPENCODE_BIN, 0o755);

  const app = ctx.app = await launchDesk({
    runtime, opencode: false,
    env: {LEARNING_DESK_OPENCODE: FAKE_OPENCODE_BIN, FAKE_OPENCODE_REPLY: REPLY},
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  /* O boot pode montar o histórico mais de uma vez (cache do descritor e
     `connect`); contar os eventos mostra quantas terminaram antes da medição. */
  await page.evaluate(() => {
    globalThis.__historyRenders = 0;
    window.addEventListener('desk-history-rendered', () => { globalThis.__historyRenders += 1; });
  });
  await statusOnline(page, {timeout: 120000});
  /* Espera o histórico inteiro, não só a primeira bolha: medir o turno com a
     montagem de 5.000 ainda em andamento misturaria os dois custos. */
  await page.waitForFunction((last) => document.body.textContent.includes(last), LAST_TEXT, {timeout: 120000});
  // espera fixa: deixa o layout do histórico de 5.000 assentar antes do turno
  await page.waitForTimeout(300);

  await instrumentMain(app);
  const longTasksSupported = await observeLongTasks(page);
  await resetTurnWindow(app);

  await page.locator('#prompt').fill(PROMPT);
  await page.locator('#send').click();
  await page.waitForFunction((wanted) => [...document.querySelectorAll('.message.assistant .body')]
    .some((element) => element.textContent.includes(wanted)), REPLY, {timeout: 120000});
  await sendEnabled(page, {timeout: 120000});
  // espera fixa: o histograma e o observer só entregam no tique seguinte
  await page.waitForTimeout(200);

  const result = await readTurnWindow(app);
  const longTasks = await readLongTasks(page);
  const historyRenders = await page.evaluate(() => globalThis.__historyRenders || 0);
  const turn = await waitForSavedTurn(session);

  assert.deepEqual(errors, []);
  assert.ok(turn.saved, `a conversa não gravou o turno no descritor (${turn.stored} mensagens)`);
  assert.ok(turn.stored >= MESSAGES, `a conversa continuou no descritor (${turn.stored} mensagens)`);

  const writes = result.samples.map((sample) => `${sample.patch || '?'}=${sample.ms.toFixed(1)}ms`);
  const longestTask = longTasks.tasks.reduce((max, entry) => Math.max(max, entry.ms), 0);
  const totalTask = longTasks.tasks.reduce((sum, entry) => sum + entry.ms, 0);
  const sizeMb = fs.statSync(session).size / 1048576;
  console.log(`ok conversation-write-block-ui: mensagens=${MESSAGES} arquivo=${sizeMb.toFixed(2)}MB `
    + `montagens=${historyRenders} gravações=[${writes.join(', ')}] metadados=${result.turnSamples.length} `
    + `event-loop max=${result.maxMs.toFixed(1)}ms p95=${result.p95Ms.toFixed(1)}ms p99=${result.p99Ms.toFixed(1)}ms `
    + `longtask suportado=${longTasksSupported} n=${longTasks.tasks.length} máx=${longestTask.toFixed(1)}ms total=${totalTask.toFixed(1)}ms`);
  await app.close();
  ctx.app = null;
});
