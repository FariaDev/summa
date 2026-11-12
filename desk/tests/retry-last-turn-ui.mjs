/* "Tentar de novo" na última resposta do tutor (#164), na janela real com o
   `opencode serve` falso: o botão só existe na última resposta, some quando o
   motor não refaz (Claude), fica desabilitado enquanto o tutor responde, e o
   refazer troca a resposta sem duplicar a pergunta. Capturas com
   MESA_REVIEW_SHOTS. */
import assert from 'node:assert/strict';
import {
  withArtifacts, newRuntime, seedCourse, seedNativeSession, writeConfigJson, writeDeskJson,
  launchDesk, statusOnline, sendEnabled, resizeWindow, setTheme, freezeMotion, reviewShot,
  screenshotDirectory, toastWait,
} from './helpers.mjs';

const OUT = screenshotDirectory('retry-last-turn');
const STEPS = [
  {text: 'Primeira parte da resposta nova.', tool: {name: 'mesa_ler_pdf', input: {caminho: 'apostila.pdf', pagina: 1}, output: 'Trecho lido.'}},
  {text: 'Resposta nova pronta.'},
];

const retryState = page => page.evaluate(() => {
  const buttons = [...document.querySelectorAll('#messages .msg-retry')];
  const answers = [...document.querySelectorAll('#messages .message.assistant')];
  const button = buttons[0];
  const style = button ? getComputedStyle(button) : null;
  return {
    count: buttons.length,
    inLast: !!button && button.closest('.message') === answers.at(-1),
    ariaLabel: button?.getAttribute('aria-label') || '',
    title: button?.title || '',
    disabled: !!button?.disabled,
    icon: button?.querySelector('svg')?.outerHTML || '',
    width: style ? Math.round(button.getBoundingClientRect().width) : 0,
    height: style ? Math.round(button.getBoundingClientRect().height) : 0,
    earlier: answers.slice(0, -1).some(el => el.querySelector('.msg-retry')),
  };
});

const counts = page => page.evaluate(() => ({
  users: document.querySelectorAll('#messages .message.user').length,
  answers: document.querySelectorAll('#messages .message.assistant').length,
  works: document.querySelectorAll('#messages article.work').length,
}));

await withArtifacts('retry-last-turn', async ctx => {
  const runtime = ctx.runtime = newRuntime('retry-last-turn');
  const course = seedCourse(runtime, 'calc');
  const now = Date.now() - 60_000;
  const session = seedNativeSession(runtime, [
    {role: 'user', content: [{type: 'text', text: 'Pergunta antiga um'}], timestamp: now},
    {role: 'assistant', content: [{type: 'text', text: 'Resposta antiga um'}], timestamp: now + 1_000, model: 'opencode/deepseek-v4.1-flash-free'},
    {role: 'user', content: [{type: 'text', text: 'Pergunta antiga dois'}], timestamp: now + 2_000},
    {role: 'assistant', content: [{type: 'text', text: 'Resposta antiga dois'}], timestamp: now + 3_000, model: 'opencode/deepseek-v4.1-flash-free'},
  ], {courseId: 'calc', model: 'opencode/deepseek-v4.1-flash-free', started: now, preview: 'Pergunta antiga um'});
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', session, courseStates: {calc: {session, sessions: [{path: session, started: now, preview: 'Pergunta antiga um'}], pdfs: [], study: {title: '', xopp: ''}}}});

  const app = ctx.app = await launchDesk({
    runtime,
    env: {FAKE_OPENCODE_STEPS: JSON.stringify(STEPS), FAKE_OPENCODE_QUEUE_HOLD_MS: '1000'},
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await statusOnline(page, {timeout: 60000});
  await resizeWindow(app, page, 1440, 900);
  await freezeMotion(page);
  await page.waitForFunction(() => document.querySelectorAll('#messages .message.assistant').length === 2, undefined, {timeout: 30000});
  await sendEnabled(page, {timeout: 30000});

  /* ---------- 1. só a última resposta tem o botão, com o ícone e o nome acessível ---------- */
  const first = await retryState(page);
  assert.equal(first.count, 1, 'um botão só, na conversa');
  assert.equal(first.inLast, true, 'o botão mora na última resposta');
  assert.equal(first.earlier, false, 'as respostas anteriores ficam sem o botão');
  assert.equal(first.ariaLabel, 'Tentar de novo', 'o nome acessível vem do catálogo');
  assert.equal(first.title, 'Tentar de novo', 'o tooltip diz a mesma ação');
  assert.equal(first.disabled, false, 'parado, dá para tentar de novo');
  assert.match(first.icon, /M3 12a9 9 0 1 0 9-9/, 'o ícone é o rotate-ccw do Lucide (#164)');
  assert.deepEqual([first.width, first.height], [24, 24], 'o botão tem a mesma área das outras ações da linha');

  /* ---------- 2. recusa sem turno no motor vira toast traduzido, sem mexer na conversa ---------- */
  await page.locator('#messages .msg-retry').click();
  await toastWait(page, 'Não há pergunta recente para refazer nesta conversa.');
  assert.deepEqual(await counts(page), {users: 2, answers: 2, works: 0}, 'a recusa não apaga nada');

  /* ---------- 3. durante a resposta o botão continua no lugar, desabilitado ---------- */
  await page.locator('#prompt').fill('Pergunta nova');
  await page.locator('#send').click();
  await page.waitForSelector('#stop:not([hidden])', {timeout: 15000});
  const busy = await retryState(page);
  assert.equal(busy.count, 1, 'o botão não some enquanto o tutor responde');
  assert.equal(busy.disabled, true, 'ocupado: o refazer fica desabilitado');
  await page.waitForFunction(() => [...document.querySelectorAll('.message.assistant .body')].some(el => el.textContent.includes('Resposta nova pronta.')), undefined, {timeout: 30000});
  await sendEnabled(page, {timeout: 30000});
  await page.waitForFunction(() => {
    const last = [...document.querySelectorAll('#messages .message.assistant')].at(-1);
    const button = last?.querySelector('.msg-retry');
    return !!button && !button.disabled;
  }, undefined, {timeout: 15000});

  /* ---------- 4. terminada a resposta, o botão mudou para ela ---------- */
  const moved = await retryState(page);
  assert.equal(moved.count, 1, 'continua um botão só');
  assert.equal(moved.inLast, true, 'o botão acompanha a resposta mais nova');
  assert.equal(moved.earlier, false, 'a resposta anterior perdeu o botão');
  const before = await counts(page);
  assert.deepEqual(before, {users: 3, answers: 4, works: 1}, 'duas falas antigas, a pergunta nova e as duas partes da resposta nova');

  await page.mouse.move(10, 10);
  await reviewShot(page, OUT, 'claro-ultima-resposta.png');
  await setTheme(page, 'dark');
  await reviewShot(page, OUT, 'escuro-ultima-resposta.png');
  await setTheme(page, 'light');

  /* ---------- 5. refazer tira a resposta e o diário do turno, sem duplicar a pergunta ---------- */
  const marked = await page.evaluate(() => {
    const lastUser = [...document.querySelectorAll('#messages .message.user')].at(-1);
    let count = 0;
    for (let node = lastUser?.nextElementSibling; node; node = node.nextElementSibling) {
      if (node.matches?.('.message.assistant, article.work, .activity-slot')) {
        node.dataset.retryOld = '1';
        count += 1;
      }
    }
    return count;
  });
  assert.ok(marked >= 2, `o turno novo tem resposta e diário para sair (marcados ${marked})`);

  await page.locator('#messages .msg-retry').click();
  await page.waitForFunction(expected => {
    const works = document.querySelectorAll('#messages article.work').length;
    const answers = document.querySelectorAll('#messages .message.assistant').length;
    const users = document.querySelectorAll('#messages .message.user').length;
    const buttons = [...document.querySelectorAll('#messages .msg-retry')];
    return !document.querySelector('[data-retry-old]')
      && users === 3 && answers === 4 && works === expected
      && buttons.length === 1 && !buttons[0].disabled;
  }, before.works, {timeout: 30000});

  assert.deepEqual(await counts(page), before, 'a resposta antiga e o diário do turno saíram; os novos entraram');
  const questions = await page.evaluate(() => [...document.querySelectorAll('#messages .message.user .body')].map(el => el.textContent.trim()));
  assert.deepEqual(questions, ['Pergunta antiga um', 'Pergunta antiga dois', 'Pergunta nova'], 'a pergunta aparece uma vez só');
  const final = await retryState(page);
  assert.equal(final.inLast, true, 'o botão voltou na última resposta');

  /* Capturas do estado desabilitado, claro e escuro. */
  await page.evaluate(async () => (await import('./src/state.mjs')).setBusy(true));
  await page.waitForFunction(() => document.querySelector('#messages .msg-retry')?.disabled === true, undefined, {timeout: 5000});
  await page.mouse.move(10, 10);
  await reviewShot(page, OUT, 'claro-desabilitado.png');
  await setTheme(page, 'dark');
  await reviewShot(page, OUT, 'escuro-desabilitado.png');
  await setTheme(page, 'light');
  await page.evaluate(async () => (await import('./src/state.mjs')).setBusy(false));

  assert.deepEqual(errors, [], 'sem erro de página');
  await app.close();
  ctx.app = null;
});

/* ---------- 6. no motor Claude a capacidade é falsa e o botão não aparece ---------- */
await withArtifacts('retry-last-turn-claude', async ctx => {
  const runtime = ctx.runtime = newRuntime('retry-last-turn-claude');
  const course = seedCourse(runtime, 'calc');
  const now = Date.now() - 60_000;
  const session = seedNativeSession(runtime, [
    {role: 'user', content: [{type: 'text', text: 'Pergunta no Claude'}], timestamp: now},
    {role: 'assistant', content: [{type: 'text', text: 'Resposta no Claude'}], timestamp: now + 1_000, model: 'anthropic/sonnet-5'},
  ], {engine: 'claude', courseId: 'calc', started: now, preview: 'Pergunta no Claude'});
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', session, courseStates: {calc: {session, sessions: [{path: session, started: now, preview: 'Pergunta no Claude'}], pdfs: [], study: {title: '', xopp: ''}}}});

  const app = ctx.app = await launchDesk({runtime, opencode: false});
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => document.querySelectorAll('#messages .message.assistant').length === 1, undefined, {timeout: 30000});
  assert.equal(await page.locator('#messages .msg-retry').count(), 0, 'Claude não tem o refazer: o botão não aparece');
  const caps = await page.evaluate(async () => {
    const {S} = await import('./src/state.mjs');
    return {engine: S.engine, retry: S.capabilities?.retryLastTurn};
  });
  assert.deepEqual(caps, {engine: 'claude', retry: false}, 'a capacidade do transporte é false no Claude');
  assert.deepEqual(errors, [], 'sem erro de página');
  await app.close();
  ctx.app = null;
});

console.log(`ok retry-last-turn-ui (capturas em ${OUT})`);
