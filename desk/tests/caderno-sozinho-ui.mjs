// node tests/caderno-sozinho-ui.mjs — só a página do Ambitus, sem texto, na janela.
// A página que o Ambitus manda entra na bandeja do tutor como cartão; com o
// campo vazio, o Enviar liga e a mensagem sai com a página como imagem e a frase
// padrão do "só imagem" (#109). Antes, o cartão não contava como conteúdo e o
// envio era barrado. Motor falso (fake-opencode), sem rede.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,seedNativeSession,statusOnline,resizeWindow,syntheticFigurePng} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const PHRASE = 'Responda de acordo com a imagem que mandei.';

await withArtifacts('caderno-sozinho', async ctx => {
 const runtime = ctx.runtime = newRuntime('caderno-sozinho');
 const course = seedCourse(runtime, 'Test');
 const notebook = path.join(course, 'Limites.xopp');
 fs.writeFileSync(notebook, 'caderno');
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

 const bridge = () => JSON.parse(fs.readFileSync(path.join(runtime, 'ambitus-bridge.json'), 'utf8'));
 await pollUntil(() => { try { return bridge().port; } catch { return 0; } }, v => !!v, {timeout: 15000, interval: 100, what: 'a ponte do Ambitus subir'});
 const file = bridge();
 const response = await fetch(`http://127.0.0.1:${file.port}/mandar-pagina`, {method: 'POST', headers: {'content-type': 'application/json', 'x-summa-token': file.token},
  body: JSON.stringify({caminho: notebook, pagina: 2, nome: 'Limites', png: syntheticFigurePng(640, 360), recorte: {x: 0, y: 286, largura: 595, altura: 555}})});
 assert.equal(response.status, 200);
 await page.locator('#attachments .attachment.notebook-card img.notebook-thumb').waitFor({timeout: 10000});

 /* ---- O cartão sozinho liga o Enviar e a mensagem sai ---- */
 assert.equal(await page.locator('#prompt').inputValue(), '', 'o campo segue vazio');
 await page.waitForFunction(() => document.querySelector('#send')?.classList.contains('primary'), undefined, {timeout: 10000});
 await page.locator('#send').click();
 const bubble = page.locator('#messages .message.user').last();
 await bubble.locator('img.shot').waitFor({timeout: 15000});
 assert.doesNotMatch(await bubble.innerText(), /Responda de acordo|\.xopp/, 'a bolha mostra só a página');
 await page.waitForFunction(() => !document.querySelector('#attachments .notebook-card'), undefined, {timeout: 20000});
 await pollUntil(() => phraseCount(), n => n >= 1, {timeout: 30000, interval: 200, what: 'a frase padrão chegar ao motor com a página'});
 const entries = fs.readFileSync(serveLog, 'utf8').trim().split('\n').map(line => { try { return JSON.parse(line); } catch { return null; } });
 const sent = entries.filter(entry => String(entry?.body?.text || '').includes(PHRASE)).at(-1);
 assert.equal(sent.body.files.length, 1, 'a página vai ao motor como imagem');
 assert.match(sent.body.text, /trecho x=0 y=286 largura=595 altura=555 pt/, 'o bloco escondido leva o trecho');

 assert.deepEqual(errors, []);
});
