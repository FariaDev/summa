import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts} from './helpers.mjs';
import {openLazyDesk} from './chat-history-lazy-seed.mjs';
import {nextFrames, pollUntil} from './waits.mjs';

const require = createRequire(import.meta.url);
const free = require('../free-workspaces.cjs');
const conversations = require('../src/agents/conversations.cjs');

/* Abrir um resultado da busca global (#143) leva o aluno à mensagem
   encontrada, não ao fim da conversa. Histórico longo (#118): a mensagem do
   meio nasce em casca e precisa ser formatada antes de rolar. */

const FOUND = 'Fechando a resposta 80';

const foundState = (page) => page.evaluate(async (needle) => {
  const {messageScroller, distanceFromEnd} = await import('./src/state.mjs');
  const scroller = messageScroller();
  const bubble = [...document.querySelectorAll('#messages .message')].find((el) => el.textContent.includes(needle));
  if (!bubble || !scroller) return {found: false, visible: false};
  const view = scroller.getBoundingClientRect();
  const box = bubble.getBoundingClientRect();
  return {
    found: true,
    visible: box.bottom > view.top + 1 && box.top < view.bottom - 1,
    top: box.top - view.top,
    distance: distanceFromEnd(),
    index: Number(bubble.dataset.messageIndex),
    shell: bubble.hasAttribute('data-lazy-shell'),
  };
}, FOUND);

await withArtifacts('study-search-open-message', async (ctx) => {
  const {app, page, errors, runtime} = await openLazyDesk(300, {tag: 'busca-mensagem'});
  ctx.app = app;
  ctx.runtime = runtime;

  const pendingOpen = await page.evaluate(async () => (await import('./src/history-format-lazy.mjs')).lazyStats().pending);
  assert.ok(pendingOpen > 500, `a conversa longa abre em casca (${pendingOpen} pendentes)`);

  const before = await foundState(page);
  assert.equal(before.found, true, 'a mensagem alvo está no histórico montado');
  assert.equal(before.visible, false, 'a conversa abre no fim, com a mensagem do meio fora da vista');

  await page.locator('#study-menu .nav-trigger').click();
  await page.locator('#study-menu #study-search-open').click();
  await page.locator('#study-search-input').fill(FOUND);
  await page.locator('#study-search-submit').click();
  await page.waitForSelector('.study-search-result', {timeout: 30000});
  await page.locator('.study-search-result').filter({hasText: FOUND}).locator('.study-search-open-result').first().click();
  await page.waitForFunction(() => !document.querySelector('#study-search-dialog')?.open, undefined, {timeout: 30000});

  await pollUntil(() => foundState(page), (state) => state.visible, {timeout: 15000, what: 'a mensagem encontrada na vista'});
  await nextFrames(page, 6);
  const settled = await foundState(page);
  assert.equal(settled.visible, true, `a mensagem encontrada fica na área visível (${JSON.stringify(settled)})`);
  assert.ok(settled.distance > 500, `a vista subiu até a mensagem em vez de ficar no fim (${settled.distance.toFixed(0)}px do fim)`);
  assert.equal(settled.shell, false, 'a casca da mensagem foi formatada antes de rolar (#118)');
  assert.ok(Number.isInteger(settled.index) && settled.index > 100, `o alvo é uma mensagem do meio (índice ${settled.index})`);
  assert.deepEqual(errors, []);
  console.log('STUDY SEARCH OPEN MESSAGE UI PASSED: o resultado da busca global abre na mensagem encontrada, inclusive em histórico longo.');
});

/* Complemento da revisão do #143: a fala de uma conversa da aba Livre
   (`cv:` com scope free) abre na mensagem certa, inclusive no meio de um
   histórico longo, e um resultado na segunda fala de um balão mesclado não
   pode parar na primeira (ou no fim). */
const FREE_TITLE = 'Sessão Livre Encontrável';
const MIDDLE = 'Resposta livre 20';
const SPECIAL = 'SEGUNDA FALA MESCLADA';

const freeBubbleState = (page, needle) => page.evaluate(async (text) => {
  const {messageScroller, distanceFromEnd} = await import('./src/state.mjs');
  const scroller = messageScroller();
  const bubbles = [...document.querySelectorAll('#messages .message')];
  const bubble = bubbles.find((el) => el.textContent.includes(text));
  if (!bubble || !scroller) return {found: false, visible: false};
  const view = scroller.getBoundingClientRect();
  const box = bubble.getBoundingClientRect();
  return {
    found: true,
    visible: box.bottom > view.top + 1 && box.top < view.bottom - 1,
    index: Number(bubble.dataset.messageIndex),
    shared: bubbles.filter((el) => el.dataset.messageIndex === bubble.dataset.messageIndex).length,
    distance: distanceFromEnd(),
  };
}, needle);

/* Sessão Livre longa no runtime já aberto: o `cv:` de uma fala do meio abre
   nela, e o `cv:` da fala especial cai na segunda bolha do mesmo índice
   (a primeira é alta de propósito e empurra a segunda para fora da vista). */
function seedFreeSession(runtime) {
  const record = free.ensureWorkspace(runtime, {sessionId: 'livre-busca-mensagem', title: FREE_TITLE});
  const file = conversations.createClaudeConversation({runtime, courseId: free.freeCourseId(), engine: 'opencode', started: Date.now() - 3600000, preview: 'sessão livre sintética'});
  const longFirst = ('Trecho longo da primeira fala. '.repeat(115)).trim();
  const second = `${('Fecho da resposta com detalhe. '.repeat(6)).trim()} ${SPECIAL} ${('e continua com o fecho. '.repeat(3)).trim()}`;
  const messages = [
    {role: 'user', content: [{type: 'text', text: 'Pergunta inicial da sessão livre'}]},
    {role: 'assistant', content: [
      {type: 'text', text: longFirst},
      {type: 'toolCall', id: 'livre-ferramenta', name: 'web_search', arguments: {query: 'livre'}},
      {type: 'text', text: second},
    ]},
    {role: 'toolResult', toolCallId: 'livre-ferramenta', content: [{type: 'text', text: 'resultado da ferramenta'}]},
  ];
  for (let n = 1; n <= 40; n++) {
    messages.push({role: 'user', content: [{type: 'text', text: `Pergunta livre ${n}`}]});
    messages.push({role: 'assistant', content: [{type: 'text', text: `Resposta livre ${n}. ${'Conteúdo para dar altura à conversa. '.repeat(20)}`}]});
  }
  conversations.updateClaudeConversation(file, {messages}, {runtime});
  free.setNativePath(runtime, record.id, file);
  return {record, file};
}

async function searchAndOpen(page, query, hitPrefix) {
  await page.locator('#study-menu .nav-trigger').click();
  await page.locator('#study-menu #study-search-open').click();
  await page.locator('#study-search-input').fill(query);
  await page.locator('#study-search-submit').click();
  await page.waitForSelector(`.study-search-result[data-hit^="${hitPrefix}"]`, {timeout: 30000});
  await page.locator(`.study-search-result[data-hit^="${hitPrefix}"]`).first().locator('.study-search-open-result').click();
  await page.waitForFunction(() => !document.querySelector('#study-search-dialog')?.open, undefined, {timeout: 30000});
}

await withArtifacts('study-search-open-free-and-split', async (ctx) => {
  const {app, page, errors, runtime} = await openLazyDesk(20, {tag: 'busca-livre'});
  ctx.app = app;
  ctx.runtime = runtime;
  seedFreeSession(runtime);

  await searchAndOpen(page, MIDDLE, 'cv:');
  await page.waitForFunction((text) => document.querySelector('#messages')?.textContent.includes(text), MIDDLE, {timeout: 60000});
  await pollUntil(() => freeBubbleState(page, MIDDLE), (state) => state.visible, {timeout: 15000, what: 'a fala do meio da sessão Livre na vista'});
  await nextFrames(page, 6);
  const middle = await freeBubbleState(page, MIDDLE);
  assert.equal(middle.index, 41, `a fala do meio é a mensagem 41 (índice ${middle.index})`);
  assert.ok(middle.distance > 500, `a Livre abriu na mensagem e não no fim (${middle.distance.toFixed(0)}px do fim)`);

  await searchAndOpen(page, SPECIAL, 'cv:');
  await pollUntil(() => freeBubbleState(page, SPECIAL), (state) => state.visible, {timeout: 15000, what: 'a segunda fala do balão mesclado na vista'});
  await nextFrames(page, 6);
  const special = await freeBubbleState(page, SPECIAL);
  assert.ok(special.shared > 1, `as duas falas da mensagem dividem o índice ${special.index}`);
  assert.equal(special.visible, true, `a segunda fala fica na área visível (${JSON.stringify(special)})`);
  assert.deepEqual(errors, []);
  console.log('STUDY SEARCH OPEN FREE UI PASSED: a fala da Livre e a segunda fala do balão mesclado abrem na mensagem certa.');
});

/* #183: resultado de chat lateral (`sc:`) abre o lateral na mensagem
   encontrada, inclusive em histórico longo. O índice da bolha é o mesmo da
   busca: cada fala user/assistant com texto, na ordem do descritor. */
const LATERAL_FOUND = 'ALVO DO CHAT LATERAL 41';
const LATERAL_INDEX = 41;

const sidechatFoundState = (page, needle) => page.evaluate((text) => {
  const box = document.querySelector('#sidechat-messages');
  const bubble = [...(box?.querySelectorAll('.sidechat-msg') || [])].find((el) => el.textContent.includes(text));
  if (!box || !bubble) return {found: false, visible: false};
  const view = box.getBoundingClientRect();
  const row = bubble.getBoundingClientRect();
  return {
    found: true,
    visible: row.bottom > view.top + 1 && row.top < view.bottom - 1,
    top: row.top - view.top,
    distance: box.scrollHeight - box.scrollTop - box.clientHeight,
    index: Number(bubble.dataset.messageIndex),
  };
}, needle);

function seedSidechat(runtime, mainSession) {
  const native = conversations.createClaudeConversation({runtime, courseId: 'calc', engine: 'opencode'});
  const messages = [];
  for (let n = 1; n <= 30; n++) {
    messages.push({role: 'user', content: [{type: 'text', text: `Pergunta lateral ${n}: como sigo daqui?`}]});
    const answer = n === 21
      ? `${'Antes do alvo. '.repeat(4)}${LATERAL_FOUND}${' Depois do alvo.'.repeat(4)}`
      : `Resposta lateral ${n}. ${'Conteúdo para dar altura à conversa lateral. '.repeat(6)}`;
    messages.push({role: 'assistant', content: [{type: 'text', text: answer}]});
  }
  conversations.updateClaudeConversation(native, {messages}, {runtime});
  const id = `sc-${crypto.randomUUID()}`;
  const dir = path.join(runtime, 'sidechats');
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({
    schemaVersion: 1,
    id,
    engine: 'opencode',
    mainSession,
    courseId: 'calc',
    createdAt: Date.now() - 1000,
    updatedAt: Date.now(),
    draft: '',
    contextDeliveredKey: '',
    claude: native,
    context: {mainSession, refs: [], study: {title: '', xopp: ''}, at: Date.now(), digest: 'd', key: 'k'},
    messages: [],
  }));
  return {id, native};
}

await withArtifacts('study-search-open-sidechat', async (ctx) => {
  const {app, page, errors, runtime, session} = await openLazyDesk(20, {tag: 'busca-lateral'});
  ctx.app = app;
  ctx.runtime = runtime;
  seedSidechat(runtime, session);

  await searchAndOpen(page, LATERAL_FOUND, 'sc:');
  await page.waitForFunction((text) => document.querySelector('#sidechat-messages')?.textContent.includes(text), LATERAL_FOUND, {timeout: 30000});
  await pollUntil(() => sidechatFoundState(page, LATERAL_FOUND), (state) => state.visible, {timeout: 15000, what: 'a mensagem do chat lateral encontrada na vista'});
  await nextFrames(page, 6);
  const settled = await sidechatFoundState(page, LATERAL_FOUND);
  assert.equal(await page.locator('#sidechat').isVisible(), true, 'o resultado de chat lateral abre o painel lateral');
  assert.equal(settled.visible, true, `a mensagem do lateral fica na área visível (${JSON.stringify(settled)})`);
  assert.equal(settled.index, LATERAL_INDEX, `a bolha carrega o índice da busca (${settled.index})`);
  assert.ok(settled.distance > 500, `o lateral abriu na mensagem e não no fim (${settled.distance.toFixed(0)}px do fim)`);
  assert.deepEqual(errors, []);
  console.log('STUDY SEARCH OPEN SIDECHAT UI PASSED: o resultado de chat lateral abre o painel na mensagem encontrada, inclusive em histórico longo.');
});
