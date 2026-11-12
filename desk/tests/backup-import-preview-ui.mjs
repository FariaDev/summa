/* Prévia de importação (#140) na janela de verdade: o pacote traz uma conversa
   com marcação hostil; a prévia mostra o resumo e o começo do texto, o texto
   inteiro abre no clique e nada do pacote vira elemento (o renderer pinta com
   textContent). O Importar só roda depois do confirmar. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts, newRuntime, seedCourse, writeConfigJson, writeDeskJson, launchDesk, statusOnline, resizeWindow, freezeMotion, tinyPdf, seedNativeSession} from './helpers.mjs';

const require = createRequire(import.meta.url);
const packages = require('../src/study-data/packages.cjs');

const hostile = '<img src=x onerror="window.__pwned=1">';
const userText = `${hostile} Explique limites.`;
const assistantText = `O limite de x² em 2 é 4. ${'Repetição para o texto passar do começo. '.repeat(12)}<script>window.__pwned=2</script> Fim do texto.`;
const transcript = `user: ${userText}\n\nassistant: ${assistantText}`;

await withArtifacts('backup-import-preview', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('import-preview');
  const course = seedCourse(runtime, 'calc');
  fs.writeFileSync(path.join(course, 'Limites.pdf'), tinyPdf('Limites e derivadas'));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: path.join(course, 'Limites.pdf'), page: 1}], study: {title: '', xopp: ''}}}});

  seedNativeSession(runtime, [
    {role: 'user', content: [{type: 'text', text: userText}]},
    {role: 'assistant', content: [{type: 'text', text: assistantText}]},
  ], {engine: 'claude', courseId: 'calc', preview: 'limites'});
  const built = packages.buildPackage({
    runtime,
    course: {id: 'calc', name: 'Cálculo I'},
    materialsDir: course,
    include: {conversations: true},
  });
  const packageFile = path.join(runtime, 'pacote-hostil.mesa-materia');
  fs.writeFileSync(packageFile, built.buffer);
  const importRoot = path.join(runtime, 'importados');
  fs.mkdirSync(importRoot, {recursive: true});

  const app = ctx.app = await launchDesk({runtime});
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await resizeWindow(app, page, 1440, 900);
  await statusOnline(page, {timeout: 60000});
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});

  /* Os dois diálogos nativos que o Importar abre: o pacote e a pasta nova. */
  await app.evaluate(({dialog}, picks) => {
    let index = 0;
    dialog.showOpenDialog = async () => ({canceled: false, filePaths: [picks[Math.min(index++, picks.length - 1)]]});
  }, [packageFile, importRoot]);

  await page.locator('#study-menu .nav-trigger').click();
  await page.locator('#study-menu #study-share-open').click();
  await page.waitForSelector('#mesa-backup-panel[open]', {timeout: 15000});
  await page.locator('#mesa-backup-panel [data-bkp-act="importar"]').click();

  const preview = page.locator('#mesa-backup-panel [data-bkp-import]');
  await preview.waitFor({state: 'visible', timeout: 20000});
  const previewText = await preview.textContent();
  assert.match(previewText, /2 mensagens · \d+ caracteres/, 'o resumo traz mensagens e tamanho');
  assert.match(previewText, /Texto de outra pessoa/, 'o aviso de texto não confiável aparece');
  assert.ok(previewText.includes(hostile), 'a transcrição aparece como texto, com a marcação literal');
  assert.equal(await page.locator('#mesa-backup-panel [data-bkp-import] img').count(), 0, 'nada do texto vira <img>');
  assert.equal(await page.locator('#mesa-backup-panel [data-bkp-import] script').count(), 0, 'nada do texto vira <script>');
  assert.equal(await page.evaluate(() => window.__pwned), undefined, 'o texto do pacote não executa');

  const shown = await page.locator('#mesa-backup-panel [data-bkp-import-text]').textContent();
  assert.ok(shown.length < transcript.length, 'a prévia mostra só o começo');
  await page.locator('#mesa-backup-panel [data-bkp-act="importar-abrir"]').click();
  const full = await page.locator('#mesa-backup-panel [data-bkp-import-text]').textContent();
  assert.equal(full, transcript, 'Mostrar texto inteiro abre o texto completo');
  assert.match(full, /Fim do texto\./);

  await page.locator('#mesa-backup-panel [data-bkp-act="importar-confirmar"]').click();
  await page.waitForFunction(() => {
    const live = document.querySelector('#mesa-backup-panel [data-bkp-live]');
    return !!live && /Importada em/.test(live.textContent);
  }, undefined, {timeout: 30000});
  assert.equal(await preview.isVisible(), false, 'a prévia some depois de importar');
  assert.equal(fs.existsSync(path.join(importRoot, 'Matéria importada')), true, 'o confirmar criou a matéria nova');
  assert.deepEqual(errors, [], 'sem erro de página');
});
console.log('ok backup-import-preview-ui');
