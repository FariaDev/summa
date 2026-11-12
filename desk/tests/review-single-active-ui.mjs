/* Revisão aberta, uma aba ativa só (auditoria de UI/UX, rodada 6, G3; r1): com
   o Caderno aberto, só ele lê como ativo. O sinal agora é o sublinhado de 2px
   no acento, não a pílula cinza: conta as abas sublinhadas e confere que a
   ativa não tem preenchimento, nos dois temas, com e sem hover na matéria. */
import assert from 'node:assert/strict';
import {
  withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,
  resizeWindow,setTheme,statusOnline,freezeMotion,
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const TRANSPARENT = new Set(['rgba(0, 0, 0, 0)', 'transparent']);

function tabs(page) {
  return page.evaluate(() => [...document.querySelectorAll('#course-tabs button[role="tab"]')].map((button) => ({
    id: button.dataset.id,
    active: button.classList.contains('active'),
    selected: button.getAttribute('aria-selected'),
    bg: getComputedStyle(button).backgroundColor,
    underline: parseFloat(getComputedStyle(button).borderBottomWidth) >= 2 && !['rgba(0, 0, 0, 0)', 'transparent'].includes(getComputedStyle(button).borderBottomColor),
  })));
}

function underlined(list) {
  return list.filter((tab) => tab.underline).map((tab) => tab.id);
}

await withArtifacts('revisao-aba-unica', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('revisao-aba-unica');
  const calc = seedCourse(runtime, 'calc');
  const fis = seedCourse(runtime, 'fis');
  writeConfigJson(runtime, {
    runtimePath: runtime, vaultPath: runtime,
    courses: [{id: 'calc', name: 'Cálculo I', path: calc}, {id: 'fis', name: 'Física', path: fis}],
    desk: {panels: [{label: 'Enunciado'}, {label: 'Formulário'}]},
  });
  writeDeskJson(runtime, {courseId: 'calc'});
  ctx.app = await launchDesk({runtime});
  const page = await ctx.app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await statusOnline(page);
  await page.waitForSelector('.pdf-panel .reader-sheet', {timeout: 25000});
  await freezeMotion(page);
  await resizeWindow(ctx.app, page, 1440, 900);
  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    const tag = `${theme} revisão aberta`;
    await page.locator('#course-tabs #review-tab').click();
    await page.waitForSelector('#references.review');
    await layoutStable(page, 'main');
    /* Sem hover: só o Caderno sublinhado, e a ativa sem pílula. */
    let list = await tabs(page);
    assert.deepEqual(underlined(list), ['review'], `${tag}: só o Caderno sublinhado (veio ${JSON.stringify(underlined(list))})`);
    assert.deepEqual(list.filter((tab) => tab.selected === 'true').map((tab) => tab.id), ['review'], `${tag}: aria-selected único no Caderno`);
    assert.ok(list.filter((tab) => tab.active).every((tab) => TRANSPARENT.has(tab.bg)), `${tag}: a aba ativa não tem pílula`);
    /* Com o mouse sobre a matéria: o hover não vira o sinal de ativo. */
    await page.locator('#course-tabs [data-id="calc"]').hover();
    list = await tabs(page);
    assert.deepEqual(underlined(list), ['review'], `${tag} com hover na matéria: só o Caderno sublinhado (veio ${JSON.stringify(underlined(list))})`);
    /* Fechar volta o sublinhado para a matéria, ainda único. */
    await page.mouse.move(1, 1);
    await page.locator('#review-bar .review-close').click();
    await page.waitForSelector('#references:not(.review)');
    await layoutStable(page, 'main');
    list = await tabs(page);
    assert.deepEqual(underlined(list), ['calc'], `${tag} fechada: só a matéria sublinhada (veio ${JSON.stringify(underlined(list))})`);
  }
  assert.deepEqual(errors, [], 'nenhum erro de página durante o fluxo');
  console.log('REVIEW SINGLE ACTIVE UI PASSED: com a revisão aberta só o Caderno fica sublinhado, sem pílula, nos dois temas, com e sem hover.');
});

/* ---------- #desempenho: clique rápido na PRIMEIRA abertura ----------
   O primeiro clique no Caderno dispara o import de `review.mjs`; um clique
   logo em GeoGebra/outra matéria durante a carga precisa vencer a ativação
   pendente, senão as duas áreas ficam ativas ao mesmo tempo (e nenhum clique
   seguinte conserta). Cada cenário usa um app novo: depois da primeira carga o
   módulo já está na memória e o caminho deixa de ser o da janela do import. */
function seedQuickTabs(tag) {
  const runtime = newRuntime(tag);
  const calc = seedCourse(runtime, 'calc');
  const fis = seedCourse(runtime, 'fis');
  writeConfigJson(runtime, {
    runtimePath: runtime, vaultPath: runtime,
    courses: [{id: 'calc', name: 'Cálculo I', path: calc}, {id: 'fis', name: 'Física', path: fis}],
  });
  writeDeskJson(runtime, {courseId: 'calc'});
  return runtime;
}

async function launchQuickTabs(ctx, tag) {
  ctx.runtime = seedQuickTabs(tag);
  ctx.app = await launchDesk({runtime: ctx.runtime});
  const page = await ctx.app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await statusOnline(page);
  await page.waitForSelector('.pdf-panel .reader-sheet', {timeout: 25000});
  await freezeMotion(page);
  await resizeWindow(ctx.app, page, 1440, 900);
  return {page, errors};
}

const areaState = (page) => page.evaluate(() => ({
  review: document.querySelector('#references').classList.contains('review'),
  ggb: document.querySelector('#references').classList.contains('ggb'),
  active: document.querySelector('#course-tabs button.active')?.dataset.id || '',
}));

await withArtifacts('revisao-clique-rapido-ggb', async (ctx) => {
  const {page, errors} = await launchQuickTabs(ctx, 'revisao-clique-rapido-ggb');
  /* Os dois cliques no mesmo task: o import de review.mjs não pode resolver
     entre eles, então a janela da carga é a mesma da pessoa. */
  await page.evaluate(() => {
    document.querySelector('#review-tab').click();
    document.querySelector('#course-tabs [data-id="geogebra"]').click();
  });
  await page.waitForFunction(() => document.querySelector('#course-tabs button.active')?.dataset.id === 'geogebra', undefined, {timeout: 20000});
  // espera fixa: o import do Caderno (~130 ms) termina aqui; o que se testa é que ele NÃO ativa depois
  await page.waitForTimeout(1000);
  assert.deepEqual(await areaState(page), {review: false, ggb: true, active: 'geogebra'}, 'só o GeoGebra fica ativo depois do clique rápido');
  assert.deepEqual(errors, [], 'nenhum erro de página no clique rápido Caderno→GeoGebra');
  console.log('REVIEW QUICK TAB GGB PASSED: o clique no GeoGebra durante a carga do Caderno vence a ativação pendente.');
});

await withArtifacts('revisao-clique-rapido-materia', async (ctx) => {
  const {page, errors} = await launchQuickTabs(ctx, 'revisao-clique-rapido-materia');
  await page.evaluate(() => {
    document.querySelector('#review-tab').click();
    document.querySelector('#course-tabs [data-id="fis"]').click();
  });
  await page.waitForFunction(() => document.querySelector('#course-tabs button.active')?.dataset.id === 'fis', undefined, {timeout: 20000});
  // espera fixa: o import do Caderno (~130 ms) termina aqui; o que se testa é que ele NÃO ativa depois
  await page.waitForTimeout(1000);
  assert.deepEqual(await areaState(page), {review: false, ggb: false, active: 'fis'}, 'só a matéria nova fica ativa depois do clique rápido');
  assert.deepEqual(errors, [], 'nenhum erro de página no clique rápido Caderno→matéria');
  console.log('REVIEW QUICK TAB COURSE PASSED: a matéria clicada durante a carga do Caderno vence a ativação pendente.');
});
