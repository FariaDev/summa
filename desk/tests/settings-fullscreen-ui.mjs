/* Configurações e Guia em tela cheia (Carbon r2, aprovado em 2026-11-10).
   Mede na janela real: as duas telas ocupam a janela inteira; a busca das
   Configurações filtra as linhas e a lateral; o interruptor liga/desliga o
   mesmo checkbox de antes e o Salvar grava o mesmo `desk.calculator`; Escape
   fecha as duas. As capturas claro/escuro em 1440×900 saem em
   `MESA_REVIEW_SHOTS` (a pasta docs/reviews/r2-config-guia no pedido do r2). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';
import {
  DESK, deskEnv, freezeMotion, newRuntime, reviewShot, screenshotDirectory,
  seedCourse, setTheme, statusOnline, tinyPdf, withArtifacts, writeConfigJson,
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const requested = process.env.MESA_REVIEW_SHOTS;
const SHOT_DIR = requested && requested !== '1' ? path.resolve(requested) : screenshotDirectory('settings-fullscreen');
fs.mkdirSync(SHOT_DIR, {recursive: true});

const box = (page, selector) => page.locator(selector).evaluate((el) => {
  const r = el.getBoundingClientRect();
  return {left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height};
});

async function assertFullscreen(page, selector, label) {
  const rect = await box(page, selector);
  const view = await page.evaluate(() => ({width: innerWidth, height: innerHeight}));
  assert.ok(Math.abs(rect.left) <= 1 && Math.abs(rect.top) <= 1, `${label}: começa no canto da janela (${JSON.stringify(rect)})`);
  assert.ok(Math.abs(rect.right - view.width) <= 1 && Math.abs(rect.bottom - view.height) <= 1, `${label}: ocupa a janela inteira (${JSON.stringify(rect)} em ${view.width}×${view.height})`);
}

async function saveAndClose(page) {
  await page.locator('#settings-save').click();
  await page.waitForFunction(() => !document.querySelector('#settings-dialog').open, undefined, {timeout: 15000});
  await page.waitForSelector('.pdf-panel', {timeout: 15000});
}

await withArtifacts('settings-fullscreen', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('settings-fullscreen');
  const course = seedCourse(runtime, 'A');
  fs.writeFileSync(path.join(course, 'Limites.pdf'), tinyPdf('Exercicio'));
  writeConfigJson(runtime, {
    runtimePath: runtime, vaultPath: runtime,
    courses: [{id: 'A', name: 'Cálculo', path: course}],
    desk: {title: 'Mesa de teste'},
  });
  /* userData temporário: a persistência normal (o override de runtime dos
     smokes comuns deliberadamente não grava configurações). */
  const entry = path.join(runtime, 'entry.cjs');
  fs.writeFileSync(entry, `require('electron').app.setPath('userData',__dirname);require(${JSON.stringify(path.join(DESK, 'main.cjs'))});`);
  const env = deskEnv(runtime);
  delete env.LEARNING_DESK_RUNTIME;
  ctx.app = await electron.launch({args: [entry], cwd: DESK, env});
  const page = await ctx.app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});

  /* ---- 1. Configurações ocupam a janela inteira ---- */
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]');
  await layoutStable(page, '#settings-dialog');
  await assertFullscreen(page, '#settings-dialog', 'Configurações');
  assert.equal(await page.locator('#settings-search').isVisible(), true, 'a busca das Configurações está à vista');
  assert.equal(await page.locator('.settings-nav').isVisible(), true, 'a lateral está à vista');
  /* Revisão do 839f7227: a nota do idioma do tutor caía fora da grade, e
     Avisos repetia a dica do rodapé como frase da seção. */
  assert.equal(await page.locator('label.set-row .set-text #tutor-language-note').count(), 1, 'a nota do idioma do tutor fica na coluna do rótulo');
  /* Texto que não é necessário não entra (AGENTS.md, Interface): sem marca
     acima do título, sem frase de abertura e sem grupo que repete a seção. */
  assert.equal(await page.locator('#settings-dialog .settings-lead').count(), 0, 'nenhuma seção abre com frase');
  assert.equal(await page.locator('#settings-dialog .settings-brand').count(), 0, 'sem marca acima de "Configurações"');
  assert.equal(await page.locator('#settings-sec-mesa .set-group-label').count(), 0, 'Recursos da mesa sem os grupos "Mesa" e "Recursos"');

  /* ---- 1b. Rodapé e rótulo de grupo do r2 (2026-11-11) ---- */
  await page.locator('#settings-tab-avisos').click();
  const chrome=await page.evaluate(()=>{
   const cancel=document.querySelector('#settings-dialog .settings-actions button[value="cancel"]');
   const label=document.querySelector('#settings-sec-avisos .set-group > .set-group-label');
   const probe=document.createElement('i');
   probe.style.cssText='position:fixed;background:var(--code);color:var(--fg)';
   const muted=document.createElement('i');
   muted.style.cssText='position:fixed;color:var(--muted)';
   document.body.append(probe,muted);
   const code=getComputedStyle(probe).backgroundColor,fg=getComputedStyle(probe).color,mutedColor=getComputedStyle(muted).color;
   const cancelStyle=getComputedStyle(cancel),labelStyle=getComputedStyle(label);
   const facts={cancelBorder:cancelStyle.borderTopWidth,cancelBg:cancelStyle.backgroundColor,cancelColor:cancelStyle.color,
    code,fg,labelSize:labelStyle.fontSize,labelWeight:labelStyle.fontWeight,labelColor:labelStyle.color,mutedColor};
   probe.remove();muted.remove();
   return facts;
  });
  assert.equal(chrome.cancelBorder,'0px','o Cancelar não tem borda');
  assert.equal(chrome.cancelBg,chrome.code,'o Cancelar fica no fundo da camada');
  assert.equal(chrome.cancelColor,chrome.fg,'o Cancelar usa --fg');
  assert.equal(chrome.labelSize,'12px','o rótulo de grupo tem 12px');
  assert.equal(chrome.labelWeight,'600','o rótulo de grupo é semibold');
  assert.equal(chrome.labelColor,chrome.mutedColor,'o rótulo de grupo usa --muted (--text-2 do r2)');
  await page.locator('#settings-tab-materias').click();

  /* ---- 2. A busca filtra as linhas e a lateral ---- */
  await page.locator('#settings-search').fill('Nome da mesa');
  await page.waitForFunction(() => document.querySelector('#settings-tabs [aria-current="page"]')?.dataset.sec === 'mesa');
  assert.equal(await page.locator('#settings-tab-materias').isHidden(), true, 'a busca esconde a seção sem resultado (Matérias)');
  assert.equal(await page.locator('#settings-tab-mesa').isVisible(), true, 'a seção com resultado fica na lateral');
  assert.equal(await page.locator('#cfg-title').isVisible(), true, 'a linha "Nome da mesa" fica à vista');
  assert.equal(await page.locator('#cfg-desk-calculator').isHidden(), true, 'as outras linhas da seção somem');
  await page.locator('#settings-search').fill('');
  await page.waitForFunction(() => document.querySelector('#settings-tabs [aria-current="page"]')?.dataset.sec === 'mesa');
  assert.equal(await page.locator('#cfg-desk-calculator').isVisible(), true, 'limpar a busca devolve as linhas');
  await page.locator('#settings-search').press('Enter');
  assert.equal(await page.locator('#settings-dialog').evaluate((el) => el.open), true, 'Enter na busca não fecha nem salva');

  /* ---- 3. O interruptor muda o mesmo checkbox que o Salvar lê ---- */
  const switchBox = await page.locator('#cfg-desk-calculator').evaluate((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {appearance: s.appearance, radius: s.borderRadius, width: r.width, height: r.height, checked: el.checked};
  });
  assert.equal(switchBox.appearance, 'none', 'o checkbox vira o interruptor do protótipo');
  assert.equal(switchBox.radius, '50%', 'interruptor em pílula (--r-round)');
  assert.deepEqual([Math.round(switchBox.width), Math.round(switchBox.height)], [40, 20], 'interruptor de 40×20');
  assert.equal(switchBox.checked, true, 'a calculadora começa ligada');
  await page.locator('#cfg-desk-calculator').click();
  assert.equal(await page.locator('#cfg-desk-calculator').isChecked(), false, 'o clique no interruptor desliga o mesmo checkbox');
  await saveAndClose(page);
  const saved = JSON.parse(fs.readFileSync(path.join(runtime, 'config.json'), 'utf8'));
  assert.equal(saved.desk.calculator, false, 'Salvar grava o mesmo desk.calculator de antes');
  assert.equal(await page.locator('#calculator').isHidden(), true, 'e a calculadora some da mesa');

  /* ---- 4. Escape fecha as Configurações ---- */
  await page.keyboard.press('ControlOrMeta+,');
  await page.waitForSelector('#settings-dialog[open]');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#settings-dialog').open);

  /* ---- 5. O Guia também ocupa a janela inteira e o Escape o fecha ---- */
  await page.keyboard.press('ControlOrMeta+/');
  await page.waitForSelector('#help-dialog[open]');
  await layoutStable(page, '#help-dialog');
  await assertFullscreen(page, '#help-dialog', 'Guia');
  assert.equal(await page.locator('.guide-side').isVisible(), true, 'a lateral do Guia está à vista');
  assert.equal(await page.locator('#guide-search').isVisible(), true, 'a busca do Guia está à vista');
  assert.equal(await page.locator('#help-dialog .guide-sub').count(), 0, 'o Guia não tem subtítulo');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#help-dialog').open);

  /* ---- 6. Capturas claro/escuro, 1440×900 ---- */
  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    await page.keyboard.press('ControlOrMeta+,');
    await page.waitForSelector('#settings-dialog[open]');
    await page.locator('#settings-tab-avisos').click();
    await page.mouse.move(2, 2);
    await reviewShot(page, SHOT_DIR, `configuracoes-${theme === 'light' ? 'claro' : 'escuro'}.png`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#settings-dialog').open);
    await page.keyboard.press('ControlOrMeta+/');
    await page.waitForSelector('#help-dialog[open]');
    await page.mouse.move(2, 2);
    await reviewShot(page, SHOT_DIR, `guia-${theme === 'light' ? 'claro' : 'escuro'}.png`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#help-dialog').open);
  }
  await setTheme(page, 'light');
  assert.deepEqual(errors, []);
  console.log('PASS: Configurações e Guia em tela cheia, busca filtrando, interruptor no mesmo estado e Escape fechando.');
  console.log('Screenshots:', SHOT_DIR);
});
