// node tests/imagem-sozinha-ui.mjs — só imagem, sem texto (#109), na janela.
// Tutor e chat lateral: com a imagem na bandeja o Enviar liga mesmo com o campo
// vazio; o motor recebe a frase padrão; a bolha mostra só a imagem, também depois
// do reload. Sem imagem e sem texto, o envio continua bloqueado. Motor falso
// (fake-opencode), sem rede.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,seedNativeSession,statusOnline,resizeWindow} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

/* PNG de 1×1: o menor anexo de imagem válido. */
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const PHRASE = 'Responda de acordo com a imagem que mandei.';
const IMAGE = {name: 'pagina.png', mimeType: 'image/png', buffer: PNG_1X1};

await withArtifacts('imagem-sozinha', async ctx => {
 const runtime = ctx.runtime = newRuntime('imagem-sozinha');
 const course = seedCourse(runtime, 'Test');
 const current = seedNativeSession(runtime, [{role: 'user', content: [{type: 'text', text: 'conversa atual'}]}], {courseId: 'Test', preview: 'conversa atual'});
 writeDeskJson(runtime, {session: current, courseId: 'Test', courseStates: {Test: {session: current, pdfs: [], sessions: [{path: current, started: Date.now(), preview: 'conversa atual'}]}}});
 writeConfigJson(runtime, {vaultPath: runtime, courses: [{id: 'Test', name: 'Teste', path: course}], desk: {pinnedExtensions: false}});
 const serveLog = path.join(runtime, 'serve.log');
 const phraseCount = () => { try { return fs.readFileSync(serveLog, 'utf8').split(PHRASE).length - 1; } catch { return 0; } };
 ctx.app = await launchDesk({runtime, env: {FAKE_OPENCODE_LOG: serveLog}});
 const page = await ctx.app.firstWindow();
 await resizeWindow(ctx.app, page, 1440, 900);
 const errors = [];
 page.on('pageerror', e => errors.push(e.message));
 await statusOnline(page);

 /* ---- 1. Tutor: sem texto e sem imagem nada sai ---- */
 const mainUsers = () => page.locator('#messages .message.user').count();
 const before = await mainUsers();
 await page.locator('#send').click();
 await page.waitForTimeout(500);// espera fixa: prova que nada sai; não há evento para esperar quando o envio é recusado
 assert.equal(await mainUsers(), before, 'campo vazio e sem anexo: o tutor não recebe nada');

 /* ---- 2. Tutor: a imagem sozinha envia ---- */
 await page.locator('#attach-input').setInputFiles(IMAGE);
 await page.waitForSelector('#attachments .attachment img', {timeout: 10000});
 assert.equal(await page.locator('#prompt').inputValue(), '', 'o campo segue vazio');
 await page.locator('#send').click();
 const mainBubble = page.locator('#messages .message.user').last();
 await mainBubble.locator('img').first().waitFor({timeout: 15000});
 assert.doesNotMatch(await mainBubble.innerText(), /Responda de acordo/, 'a bolha do tutor mostra só a imagem');
 await pollUntil(() => phraseCount(), n => n >= 1, {timeout: 30000, interval: 200, what: 'a frase padrão chegar ao motor pelo tutor'});

 /* ---- 3. Chat lateral: o Enviar só liga com texto ou imagem na bandeja ---- */
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(() => { const p = document.querySelector('#sidechat-prompt'); return p && !p.disabled && !document.querySelector('#sidechat').hidden; }, undefined, {timeout: 30000});
 assert.equal(await page.locator('#sidechat-send').isDisabled(), true, 'campo vazio e sem imagem: o Enviar do lateral segue desligado');
 await page.locator('#sidechat-attach-input').setInputFiles(IMAGE);
 await page.waitForSelector('#sidechat-attachments .attachment img', {timeout: 10000});
 assert.equal(await page.locator('#sidechat-send').isDisabled(), false, 'com a imagem na bandeja o Enviar do lateral liga');
 await page.locator('#sidechat-send').click();
 const sideBubble = page.locator('#sidechat-messages .sidechat-msg.user').last();
 await sideBubble.locator('img.shot').waitFor({timeout: 15000});
 assert.doesNotMatch(await sideBubble.innerText(), /Responda de acordo/, 'a bolha do lateral mostra só a imagem');
 await page.waitForFunction(() => document.querySelector('#sidechat-attachments').hidden, undefined, {timeout: 10000});
 await pollUntil(() => phraseCount(), n => n >= 2, {timeout: 30000, interval: 200, what: 'a frase padrão chegar ao motor pelo lateral'});

 /* ---- 4. Depois do reload, nenhuma bolha mostra a frase padrão ---- */
 await page.reload();
 await statusOnline(page, {timeout: 30000});
 await page.waitForFunction(() => document.querySelectorAll('#messages .message.user').length > 0, undefined, {timeout: 30000});
 assert.doesNotMatch(await page.locator('#messages .message.user').last().innerText(), /Responda de acordo/, 'o tutor reaberto não mostra a frase padrão');
 await page.waitForFunction(() => { const p = document.querySelector('#sidechat-prompt'); return p && !document.querySelector('#sidechat').hidden; }, undefined, {timeout: 30000});
 await page.waitForFunction(() => document.querySelectorAll('#sidechat-messages .sidechat-msg.user').length > 0, undefined, {timeout: 30000});
 assert.doesNotMatch(await page.locator('#sidechat-messages .sidechat-msg.user').last().innerText(), /Responda de acordo/, 'o lateral reaberto não mostra a frase padrão');
 assert.match(await page.locator('#sidechat-messages .sidechat-msg.user').last().innerText(), /imagem/, 'a bolha reaberta não some: fica a palavra "imagem", já que o histórico não guarda a figura');

 assert.deepEqual(errors, []);
});
