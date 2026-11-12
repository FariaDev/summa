import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline,freezeMotion} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

/* Chat solto lembra lugar e por cima (#157, fatia 2): soltar, mover/
   redimensionar, fechar a Mesa e reabrir volta solto na mesma posição e
   tamanho, com o "sempre por cima" lembrado. */

async function openSidechat(page) {
  await page.locator('#sidechat-toggle').click();
  await page.waitForFunction(() => {
    const el = document.querySelector('#sidechat');
    const prompt = document.querySelector('#sidechat-prompt');
    return !!el && !el.hidden && !!prompt && !prompt.disabled && !document.querySelector('#sidechat-messages .sidechat-msg.system');
  }, undefined, {timeout: 20000});
}

await withArtifacts('lateral-solto-lembrar', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('lateral-solto-lembrar'), course = seedCourse(runtime, 'Test');
  fs.writeFileSync(path.join(course, 'Limites.pdf'), tinyPdf(['Lista 2 - Limites', '5. lim x->2 (x^2 - 4)/(x - 2)'], 4));
  writeConfigJson(runtime, {vaultPath: runtime, courses: [{id: 'Test', name: 'Cálculo I', path: course}], desk: {pinnedExtensions: false}});
  ctx.app = await launchDesk({runtime});
  let page = await ctx.app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await statusOnline(page);
  await page.waitForSelector('.pdf-panel canvas', {timeout: 25000});
  await freezeMotion(page);
  await openSidechat(page);

  const opened = ctx.app.waitForEvent('window', {timeout: 10000});
  await page.locator('#sidechat-more').click();
  await page.locator('#sidechat-detach').click();
  const child = await opened;
  await child.waitForSelector('#sidechat', {timeout: 10000});
  await child.locator('#sidechat').waitFor({state: 'visible'});
  await freezeMotion(child);

  const moved = {x: 650, y: 60, width: 420, height: 600};
  const childWin = await ctx.app.browserWindow(child);
  await childWin.evaluate((bw, next) => bw.setBounds(next), moved);
  await pollUntil(() => { try { return JSON.parse(fs.readFileSync(path.join(runtime, 'desk.json'), 'utf8')).sidechatBounds; } catch { return null; } }, b => b && b.x === moved.x && b.y === moved.y && b.width === moved.width && b.height === moved.height, {timeout: 10000, interval: 100, what: 'a posição nova gravada no desk.json'});

  await child.locator('#sidechat-more').click();
  const top = child.locator('#sidechat-always-on-top');
  await top.waitFor({state: 'visible'});
  assert.equal(await top.getAttribute('role'), 'menuitemcheckbox', 'por cima é menuitemcheckbox');
  assert.equal(await top.getAttribute('aria-checked'), 'false', 'começa desligado');
  assert.ok(await top.locator('.icon').count() === 1, 'por cima tem ícone do conjunto');
  const detachBtn = child.locator('#sidechat-detach');
  assert.ok(await detachBtn.locator('.icon').count() === 1, 'soltar/trazer tem ícone ao lado do texto');
  await top.click();
  await pollUntil(() => childWin.evaluate((bw) => bw.isAlwaysOnTop()), v => v === true, {timeout: 10000, interval: 100, what: 'o sempre por cima ligar na janela'});
  await pollUntil(() => { try { return JSON.parse(fs.readFileSync(path.join(runtime, 'desk.json'), 'utf8')).sidechatAlwaysOnTop; } catch { return null; } }, v => v === true, {timeout: 10000, interval: 100, what: 'o sempre por cima gravar no desk.json'});
  assert.equal(await childWin.evaluate((bw) => bw.isAlwaysOnTop()), true, 'liga o por cima na janela');

  const desk = JSON.parse(fs.readFileSync(path.join(runtime, 'desk.json'), 'utf8'));
  assert.equal(desk.sidechatDetached, true, 'desk.json grava solto');
  assert.deepEqual(desk.sidechatBounds, moved, 'desk.json grava a posição nova');
  assert.equal(desk.sidechatAlwaysOnTop, true, 'desk.json grava por cima ligado');

  await ctx.app.close();
  ctx.app = await launchDesk({runtime});
  page = await ctx.app.firstWindow();
  await statusOnline(page);
  const child2 = await pollUntil(() => ctx.app.windows().find((p) => p !== page) || null, v => !!v, {timeout: 10000, interval: 100, what: 'a Mesa reabrir solta'});
  assert.ok(child2, 'reabrir a Mesa volta solto');
  await child2.waitForSelector('#sidechat', {timeout: 10000});
  await child2.locator('#sidechat').waitFor({state: 'visible'});
  await freezeMotion(child2);
  const reopenedWin = await ctx.app.browserWindow(child2);
  const bounds = await reopenedWin.evaluate((bw) => bw.getBounds());
  assert.deepEqual(bounds, moved, `volta na mesma posição e tamanho (${JSON.stringify(bounds)})`);
  assert.equal(await reopenedWin.evaluate((bw) => bw.isAlwaysOnTop()), true, 'por cima continua ligado ao reabrir');
  await child2.locator('#sidechat-more').click();
  const top2 = child2.locator('#sidechat-always-on-top');
  assert.equal(await top2.getAttribute('aria-checked'), 'true', 'o item mostra ligado ao reabrir');
  assert.match((await child2.locator('#sidechat-detach').textContent()) || '', /Trazer de volta/);
  assert.deepEqual(errors, []);
  await ctx.app.close();
  console.log('PASS: chat solto lembra lugar e por cima');
});
