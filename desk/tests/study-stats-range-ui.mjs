// node tests/study-stats-range-ui.mjs — Estatísticas: intervalo personalizado (#124).
// Prova na janela real, com teclado: abrir o seletor, escolher as datas, ver o
// total mudar, os recados de início > fim e futuro, o agrupamento do gráfico
// longo e as capturas nos dois temas, 1440×900 e 900×650.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {
  withArtifacts, newRuntime, seedCourse, writeConfigJson, writeDeskJson,
  launchDesk, statusOnline, tinyPdf, reviewShot, screenshotDirectory, setTheme, freezeMotion, resizeWindow,
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const require = createRequire(import.meta.url);
const statistics = require('../src/study-data/statistics.cjs');
const out = screenshotDirectory('study-stats-range');
const DAY = 86400000;

const isoLocal = (time) => {
  const date = new Date(time);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

async function typeDate(page, selector, iso) {
  const [year, month, day] = iso.split('-');
  const language = await page.evaluate(() => navigator.language || '');
  const digits = language.toLowerCase().startsWith('en-us') ? `${month}${day}${year}` : `${day}${month}${year}`;
  const input = page.locator(selector);
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(digits);
  await page.keyboard.press('Tab');
  await page.waitForFunction(([sel, value]) => document.querySelector(sel)?.value === value, [selector, iso]);
}

async function waitHeadline(page, previous) {
  await page.waitForFunction((before) => {
    const text = document.querySelector('#study-stats-headline')?.textContent || '';
    return text.length > 0 && text !== before;
  }, previous);
}

await withArtifacts('study-stats-range', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('study-stats-range');
  const course = seedCourse(runtime, 'calc');
  const pdf = path.join(course, 'Limites.pdf');
  fs.writeFileSync(pdf, tinyPdf('Limites'));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: pdf, page: 1}], study: {title: '', xopp: ''}}}});

  ctx.app = await launchDesk({runtime});
  const page = await ctx.app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await resizeWindow(ctx.app, page, 1440, 900, {content: true});
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});
  /* O batimento do host liga o cronômetro sozinho em TEST_MODE; pausa antes de
     semear e grava os dias direto, para o total ser o do fixture. O `held`
     gravado segura o batimento durante o resto do teste. */
  await page.evaluate(() => window.desk.studyStatsControl({action: 'pause'}));
  const now = Date.now();
  const earliest = now - 10 * DAY;
  const offset = new Date(now).getTimezoneOffset();
  const tz = {offsetMinutes: Math.abs(offset), west: offset > 0};
  const activity = {};
  for (const [back, beats] of [[0, 1], [1, 2], [2, 3], [10, 4]]) {
    activity[statistics.localDay(now - back * DAY, tz)] = {calc: {seconds: beats * 30, sessions: 1}};
  }
  const meta = {createdAt: 0, resetAt: 0, frozen: false, beats: {}, timer: {running: false, idle: false, held: true, courseId: '', startedAt: 0, seconds: 0}, seen: [], seenStable: []};
  fs.writeFileSync(path.join(runtime, statistics.FILENAME), `${JSON.stringify({version: 1, activity, prompts: [], usage: {}, meta})}\n`);
  await page.locator('#study-menu .nav-trigger').click();
  await page.locator('#study-menu #study-stats-open').click();
  await page.waitForSelector('#study-stats-dialog[open]');
  await page.waitForFunction(() => document.querySelectorAll('.study-stats-chart .study-stats-bar').length === 7);
  await layoutStable(page, '#study-stats-dialog');
  const weekly = (await page.locator('#study-stats-headline').textContent()).trim();
  assert.match(weekly, /3 min de estudo em 3 sessões/, `manchete de 7 dias: ${weekly}`);

  /* Teclado: do período 7 dias, End leva ao Personalizado e as datas aparecem. */
  await page.locator('#study-stats-period [data-period="7"]').focus();
  await page.keyboard.press('End');
  await page.waitForFunction(() => document.querySelector('#study-stats-period [data-period="custom"]').getAttribute('aria-checked') === 'true');
  await page.waitForFunction(() => !document.querySelector('#study-stats-range').hidden);
  assert.equal((await page.locator('#study-stats-period [data-period="custom"]').textContent()).trim(), 'Personalizado');
  assert.equal((await page.locator('label[for="study-stats-start"] span').textContent()).trim(), 'Início');
  assert.equal((await page.locator('label[for="study-stats-end"] span').textContent()).trim(), 'Fim');
  assert.equal(await page.locator('#study-stats-start').getAttribute('type'), 'date');
  assert.equal(await page.locator('#study-stats-end').getAttribute('type'), 'date');
  await page.waitForFunction(() => document.querySelector('#study-stats-start').value.length === 10);
  await page.waitForFunction(() => document.querySelectorAll('.study-stats-chart .study-stats-bar').length === 7);

  /* Um dia só, o mais antigo: o total muda para o daquele dia. */
  const oldest = isoLocal(earliest);
  await typeDate(page, '#study-stats-start', oldest);
  await typeDate(page, '#study-stats-end', oldest);
  await page.waitForFunction(() => document.querySelectorAll('.study-stats-chart .study-stats-bar').length === 1);
  await waitHeadline(page, weekly);
  const oneDay = (await page.locator('#study-stats-headline').textContent()).trim();
  assert.match(oneDay, /2 min de estudo em 1 sessão/, `um dia tem o total do dia: ${oneDay}`);
  assert.equal((await page.locator('.study-stats-day').first().textContent()).trim().length > 0, true, 'o dia único tem rótulo');
  assert.match(await page.locator('#study-stats-chart').getAttribute('aria-label'), /total de 2 minutos/);
  assert.equal(await page.locator('#study-stats-warning, .study-stats-warn').textContent(), '', 'intervalo com estudo não mostra recado');

  /* Início depois do fim: recado claro e nenhum dado inventado. */
  await typeDate(page, '#study-stats-start', isoLocal(now));
  await typeDate(page, '#study-stats-end', isoLocal(earliest));
  await page.waitForFunction(() => document.querySelector('.study-stats-warn')?.textContent.includes('depois da data de fim'));
  assert.equal(await page.locator('.study-stats-chart .study-stats-bar').count(), 0, 'janela invertida não desenha barra');

  /* Fim no futuro: o resumo para em hoje e avisa. */
  await typeDate(page, '#study-stats-start', oldest);
  await typeDate(page, '#study-stats-end', isoLocal(now + 5 * DAY));
  await page.waitForFunction(() => document.querySelector('.study-stats-warn')?.textContent.includes('passa de hoje'));
  await page.waitForFunction(() => document.querySelectorAll('.study-stats-chart .study-stats-bar').length === 11);
  assert.match((await page.locator('#study-stats-headline').textContent()).trim(), /5 min de estudo em 4 sessões/);

  /* Intervalo longo (201 dias) agrupa sem cortar: barras de mês. */
  await typeDate(page, '#study-stats-start', isoLocal(now - 200 * DAY));
  await typeDate(page, '#study-stats-end', isoLocal(now));
  await page.waitForFunction(() => document.querySelectorAll('.study-stats-chart .study-stats-bar').length <= 8);
  assert.match(await page.locator('#study-stats-chart').getAttribute('aria-label'), /por mês, em minutos: \d+ meses, total de 5 minutos/);
  assert.match(await page.locator('.study-stats-bar').first().getAttribute('title'), /·/);

  /* Capturas no intervalo de um dia com estudo, nos dois temas e tamanhos. */
  await typeDate(page, '#study-stats-start', oldest);
  await typeDate(page, '#study-stats-end', isoLocal(earliest));
  await page.waitForFunction(() => document.querySelectorAll('.study-stats-chart .study-stats-bar').length === 1);
  for (const [width, height] of [[1440, 900], [900, 650]]) {
    await resizeWindow(ctx.app, page, width, height, {content: true});
    await layoutStable(page, '#study-stats-dialog');
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await layoutStable(page, '#study-stats-dialog');
      const tag = `${theme} ${width}×${height}`;
      const box = await page.locator('#study-stats-dialog').boundingBox();
      const inner = await page.locator('.study-stats-scroll').evaluate((el) => ({scrollW: el.scrollWidth, clientW: el.clientWidth}));
      assert.ok(box.width <= width * 0.92 + 1, `${tag}: diálogo cabe (${box.width})`);
      assert.ok(box.height <= height, `${tag}: diálogo cabe na altura (${box.height})`);
      assert.ok(inner.scrollW <= inner.clientW + 1, `${tag}: sem rolagem lateral`);
      assert.equal(await page.locator('#study-stats-range').isVisible(), true, `${tag}: datas à vista`);
      await reviewShot(page, out, `intervalo-${theme}-${width}.png`);
    }
  }
  assert.deepEqual(errors, []);
  console.log(`study-stats-range-ui: PASS — personalizado por teclado, 1 dia, início > fim, futuro, mês longo e capturas em ${out}.`);
});
