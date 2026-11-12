/* SVG do tutor que vira nada (#150): `<use>`, `<image>` e `<style>` somem na
   guarda do DOMPurify; quando o desenho dependia deles, o SVG inline ficava
   vazio na resposta — um quadro em branco, sem aviso. A #150 já mandava a
   cerca `svg` para código; o SVG solto escapava. Aqui o aluno vê o aviso e o
   SVG como código no chat principal E no lateral (mesmo `markdown.mjs`), e o
   SVG honesto continua figura. Dados sintéticos: `evil.example` é domínio
   reservado (RFC 2606). */
import assert from 'node:assert/strict';
import {withArtifacts,newRuntime,seedCourse,seedNativeSession,writeDeskJson,writeConfigJson,launchDesk,statusOnline,freezeMotion,resizeWindow} from './helpers.mjs';
import {openSidechat} from './capture-ciclo2-chat-solto-kit.mjs';
import {nextFrames} from './waits.mjs';

const BLANK = [
  {name: 'use', source: '<svg viewBox="0 0 40 40" role="img" aria-label="símbolo"><use href="#s"/><defs><symbol id="s"><rect width="20" height="20" fill="var(--plot-1)"/></symbol></defs></svg>'},
  {name: 'image', source: '<svg viewBox="0 0 40 40" role="img" aria-label="imagem"><image href="https://evil.example/p.png" width="20" height="20"/></svg>'},
  {name: 'style', source: '<svg viewBox="0 0 40 40" role="img" aria-label="estilo"><style>rect{fill:var(--plot-1)}</style></svg>'},
];
const VALID = '<svg viewBox="0 0 40 40" role="img" aria-label="válido"><rect x="4" y="4" width="32" height="32" fill="var(--plot-1)"/></svg>';
const TEXT = `Casos:\n\n${BLANK.map((item) => item.source).join('\n\n')}\n\nVálido:\n\n${VALID}`;
const SAVED = {
  id: 'sc-55555555-5555-4555-8555-555555555555', engine: 'opencode',
  messages: [{role: 'user', text: 'e os desenhos?'}, {role: 'assistant', text: TEXT}],
  draft: '', busy: false, uncertain: false,
  context: {mainSession: '', refs: [], study: {}, at: 1700000000000}, cards: [],
};

/* Fatos do corpo: nenhum SVG em branco, três avisos visíveis e os três
   originais como código; o SVG honesto segue desenhando o retângulo. */
function bodyFacts(page, selector) {
  return page.evaluate((rootSelector) => {
    const root = document.querySelector(rootSelector);
    /* Os ícones do botão Copiar também são `<svg class="icon">`: o desenho da
       resposta é o que não é ícone. */
    const svgs = [...root.querySelectorAll('svg:not(.icon)')];
    return {
      svgs: svgs.length,
      rects: root.querySelectorAll('svg:not(.icon) rect').length,
      warnings: [...root.querySelectorAll('[data-svg-error="blank"]')].map((node) => {
        const box = node.getBoundingClientRect();
        return {text: (node.textContent || '').trim(), height: box.height, width: box.width, display: getComputedStyle(node).display};
      }),
      codes: [...root.querySelectorAll('pre code[data-lang="svg"]')].map((node) => node.textContent || ''),
    };
  }, selector);
}

function assertFallback(facts, where) {
  assert.equal(facts.svgs, 1, `${where}: sobrou ${facts.svgs} SVG; esperado só o honesto (nenhum quadro em branco)`);
  assert.equal(facts.rects, 1, `${where}: o SVG honesto perdeu o retângulo`);
  assert.equal(facts.warnings.length, 3, `${where}: avisos visíveis ${facts.warnings.length}; esperado 3`);
  for (const warning of facts.warnings) {
    assert.ok(warning.height > 0 && warning.width > 0, `${where}: aviso sem tamanho (${JSON.stringify(warning)})`);
    assert.notEqual(warning.display, 'none', `${where}: aviso escondido`);
    assert.match(warning.text, /SVG|código|code/, `${where}: aviso sem explicação (${warning.text})`);
  }
  assert.equal(facts.codes.length, 3, `${where}: blocos de código ${facts.codes.length}; esperado 3`);
  assert.match(facts.codes[0], /<use\b/, `${where}: o código perdeu o <use> original`);
  assert.match(facts.codes[1], /<image\b/, `${where}: o código perdeu o <image> original`);
  assert.match(facts.codes[2], /<style\b/, `${where}: o código perdeu o <style> original`);
}

await withArtifacts('svg-blank', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('svg-blank');
  const course = seedCourse(runtime, 'calc');
  writeConfigJson(runtime, {vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo', path: course}]});
  const session = seedNativeSession(runtime, [{role: 'assistant', content: [{type: 'text', text: TEXT}]}], {courseId: 'calc'});
  writeDeskJson(runtime, {courseId: 'calc', session});
  const app = ctx.app = await launchDesk({runtime});
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await resizeWindow(app, page, 1440, 900);
  await statusOnline(page);
  await freezeMotion(page);

  await page.waitForFunction(() => {
    const body = document.querySelector('#messages .message .body');
    return !!body && body.textContent.includes('Casos') && body.querySelectorAll('[data-svg-error="blank"]').length === 3;
  }, undefined, {timeout: 30000});
  await nextFrames(page);
  assertFallback(await bodyFacts(page, '#messages .message .body'), 'chat principal');

  await openSidechat(page);
  await page.evaluate(async (payload) => {
    const sidechat = await import('./src/sidechat.mjs');
    sidechat.openSavedSidechat(payload);
  }, SAVED);
  await page.waitForFunction(() => {
    const body = document.querySelector('#sidechat-messages .sidechat-msg.assistant .sidechat-body');
    return !!body && body.textContent.includes('Casos') && body.querySelectorAll('[data-svg-error="blank"]').length === 3;
  }, undefined, {timeout: 30000});
  await nextFrames(page);
  assertFallback(await bodyFacts(page, '#sidechat-messages .sidechat-msg.assistant .sidechat-body'), 'chat lateral');

  assert.deepEqual(errors, [], `erros de página: ${JSON.stringify(errors)}`);
});
console.log('PASS: SVG inline vazio vira código com aviso no chat e no lateral (#150)');
