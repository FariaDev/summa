/* O limite do grátis no chat lateral (#144): o aviso do lateral oferece a
   MESMA saída do tutor — sem conta, entrar ou usar chave; com a chave, trocar
   de modelo. O botão é do LATERAL: a troca vale para a sessão lateral e o
   modelo do tutor continua o mesmo. Nenhum modelo de verdade: o `serve` é o
   `fake-opencode.mjs` com `FAKE_OPENCODE_FAIL=free-limit` (o formato real, que
   só falha no grátis) e a chave é testada no console falso. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,statusOnline,currentEngine,pickModel,selectedModelKey,modelRows,fakeEngineLauncher} from './helpers.mjs';
import {pollUntil} from './waits.mjs';
import {createFakeOpencode} from './fake-opencode.mjs';
import {trackTempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const conversations = require('../src/agents/conversations.cjs');
const FAKE_OPENCODE_BIN = fakeEngineLauncher(path.resolve(import.meta.dirname, 'fake-opencode.mjs'));
const CIPHER = path.resolve(import.meta.dirname, 'fake-secret-cipher.cjs');
const KEY = 'sk-janela-teste-limite-lateral-11223344';
const FREE_MODEL = 'deepseek-v4.1-flash-free';
const PAID_MODEL = 'gpt-5.5';
const FREE_LINE = 'O modelo grátis não respondeu aqui. Entre numa conta ou use uma chave.';
const LOGGED_LINE = 'O modelo grátis não respondeu aqui. Escolha outro modelo para continuar.';
const ASK = 'Explique derivadas, por favor';
const NOTE = '#sidechat-free-limit-note';

const tempDir = (tag) => trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(), `mesa-${tag}-`)));
const sidechatIdle = (page) => page.waitForFunction(async () => {
  const mod = await import('./src/sidechat.mjs');
  const state = mod.sidechatState();
  return !state.busy && !state.sending;
}, undefined, {timeout: 30000});
const noteText = (page) => page.locator(NOTE).innerText().then((text) => text.replace(/\s+/g, ' ').trim());
const pickSettled = (page, id) => pollUntil(() => selectedModelKey(page), (value) => value && JSON.parse(value)[1] === id, {what: `o modelo ${id} escolhido`, timeout: 30000});

await withArtifacts('sidechat-free-limit', async (ctx) => {
  const fake = await createFakeOpencode({validKeys: [KEY]});
  const runtime = ctx.runtime = newRuntime('sidechat-free-limit');
  const folder = seedCourse(runtime, 'Calculo');
  writeConfigJson(runtime, {vaultPath: runtime, courses: [{id: 'Calculo', name: 'Cálculo', path: folder}]});
  const first = conversations.createClaudeConversation({runtime, courseId: 'Calculo', engine: 'opencode'});
  writeDeskJson(runtime, {courseId: 'Calculo', session: first, courseStates: {Calculo: {session: first, sessions: [{path: first}]}}});
  fs.chmodSync(FAKE_OPENCODE_BIN, 0o755);
  const clipboardFile = path.join(tempDir('clip'), 'clipboard.txt');
  fs.writeFileSync(clipboardFile, 'texto qualquer que não é chave');
  const app = ctx.app = await launchDesk({runtime, opencode: false, env: {
    LEARNING_DESK_OPENCODE: FAKE_OPENCODE_BIN, FAKE_OPENCODE_FAIL: 'free-limit',
    LEARNING_DESK_OPENCODE_BASE: fake.url, LEARNING_DESK_SECRET_CIPHER: CIPHER,
    LEARNING_DESK_FAKE_CLIPBOARD: clipboardFile,
  }});
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await statusOnline(page, {timeout: 60000});
  assert.equal(await currentEngine(page), 'opencode');
  await pollUntil(async () => (await modelRows(page)).length, (count) => count >= 3, {what: 'o catálogo do servidor no seletor', timeout: 30000});
  await pickModel(page, 'opencode', FREE_MODEL);
  await pickSettled(page, FREE_MODEL);

  /* 1. Sem conta: o aviso do lateral pede entrar ou usar chave e abre o mesmo
     diálogo do tutor. */
  await page.locator('#sidechat-toggle').click();
  await page.waitForFunction(() => {
    const sidechat = document.querySelector('#sidechat');
    return sidechat && !sidechat.hidden;
  });
  await page.locator('#sidechat-prompt').fill(ASK);
  await page.locator('#sidechat-send').click();
  await page.locator(`${NOTE}:not([hidden])`).waitFor({timeout: 30000});
  assert.equal(await noteText(page), `${FREE_LINE} Entrar ou usar chave`);
  await page.locator(`${NOTE} .free-limit-action`).click();
  await page.waitForSelector('#free-models-dialog[open]', {timeout: 15000});

  /* 2. Guardar a chave pelo diálogo que já existe (console falso): testa só a
     lista, guarda e religa. */
  await page.locator('#free-models-open-site').click();
  await page.locator('#free-models-key').waitFor({state: 'visible', timeout: 15000});
  fs.writeFileSync(clipboardFile, `${KEY}\n`);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.locator('#free-models-clip').waitFor({state: 'visible', timeout: 15000});
  await page.locator('#free-models-clip-yes').click();
  await page.waitForSelector('#free-models-done:not(:empty)', {timeout: 30000});
  assert.ok(!(await page.content()).includes(KEY), 'a chave inteira nunca chega à página');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#free-models-dialog').open, undefined, {timeout: 15000});
  await statusOnline(page, {timeout: 60000});
  await sidechatIdle(page);

  /* 3. Com a chave, um lateral novo herda o grátis: o aviso do LATERAL oferece
     trocar de modelo, com a mesma frase do tutor. */
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#sidechat-new').click();
  await page.waitForFunction(() => document.querySelector('#sidechat-prompt') && !document.querySelector('#sidechat-prompt').disabled, undefined, {timeout: 15000});
  await page.locator('#sidechat-prompt').fill(ASK);
  await page.locator('#sidechat-send').click();
  await page.locator(`${NOTE}:not([hidden])`).waitFor({timeout: 30000});
  await sidechatIdle(page);
  assert.equal(await noteText(page), `${LOGGED_LINE} Escolher outro modelo`);
  assert.equal(JSON.parse(await selectedModelKey(page))[1], FREE_MODEL, 'o tutor segue no grátis antes da troca');

  /* 4. A troca é do lateral: o seletor do aviso muda o modelo da sessão lateral
     e o indicador do tutor continua no grátis. */
  await page.locator(`${NOTE} .free-limit-action`).click();
  const models = page.locator(`${NOTE} .free-limit-models`);
  await models.waitFor({state: 'visible', timeout: 5000});
  await models.selectOption({value: JSON.stringify(['opencode', PAID_MODEL])});
  await page.waitForFunction((selector) => document.querySelector(selector)?.hidden === true, NOTE, {timeout: 15000});
  const sideModel = await page.evaluate(async () => {
    const mod = await import('./src/sidechat.mjs');
    return mod.sidechatState().model;
  });
  assert.equal(sideModel, `opencode/${PAID_MODEL}`, 'o modelo do lateral mudou');
  assert.equal(JSON.parse(await selectedModelKey(page))[1], FREE_MODEL, 'o modelo do tutor não muda');

  /* 5. O mesmo lateral responde no modelo pago, sem repetir o aviso. */
  await page.locator('#sidechat-prompt').fill('Depois do modelo pago');
  await page.locator('#sidechat-send').click();
  await page.waitForFunction(() => document.querySelector('#sidechat-messages')?.textContent.includes('Resposta do OpenCode falso'), undefined, {timeout: 60000});
  assert.equal(await page.locator(NOTE).isHidden(), true, 'sem aviso de limite na resposta paga');
  assert.deepEqual(errors, [], 'sem erro de página');
  await fake.close();
});
console.log('ok sidechat-free-limit-ui');
