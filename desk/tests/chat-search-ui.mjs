import assert from 'node:assert/strict';
import {withArtifacts,newSession,statusOnline,sendEnabled} from './helpers.mjs';
import {openLazyDesk} from './chat-history-lazy-seed.mjs';
import {pollUntil} from './waits.mjs';

/* Busca na conversa (#122) em janela real, com o fake OpenCode: o ⌘F/Ctrl+F
   segue o foco (conversa × leitor), a busca lê a fonte e formata a casca antiga
   ao navegar, o "n de m" é anunciado, a navegação é circular e o Esc fecha
   devolvendo o foco ao composer. A conversa é longa (600 mensagens) para a
   ocorrência antiga estar fora da vista e ainda em casca (#118). A fala AO VIVO
   (envio e resposta) entra na fonte ao terminar, a contagem se refaz com a
   busca aberta e a troca de conversa zera a fonte e fecha a busca. */

const findState = (page) => page.evaluate(() => ({
  chatOpen: !!document.querySelector('#chat-find:not([hidden])'),
  pdfOpen: [...document.querySelectorAll('.pdf-find')].some((form) => !form.hidden),
  focus: document.activeElement?.id || document.activeElement?.className || '',
  count: document.querySelector('#chat-find .chat-find-count')?.textContent || '',
  live: document.querySelector('#chat-find .chat-find-count')?.getAttribute('aria-live') || '',
}));

await withArtifacts('chat-search', async (ctx) => {
  const {app, page, errors, runtime} = await openLazyDesk(150, {tag: 'busca', pdfSeed: 'Limites.pdf', env: {FAKE_OPENCODE_REPLY: 'A resposta ao vivo cita ornitorrinco.'}});
  ctx.app = app;
  ctx.runtime = runtime;
  assert.deepEqual(errors, []);

  /* Foco na conversa do tutor: Ctrl/Cmd+F abre a busca da conversa, não a do
     PDF (o PDF está aberto ao lado). */
  await page.locator('#prompt').focus();
  await page.keyboard.press('ControlOrMeta+f');
  await page.locator('#chat-find').waitFor({state: 'visible', timeout: 5000});
  assert.deepEqual(await findState(page), {
    chatOpen: true,
    pdfOpen: false,
    focus: 'chat-find-input',
    count: '',
    live: 'polite',
  });

  /* A ocorrência antiga (meio do histórico) está em casca: a busca acha pela
     fonte e, no Enter, formata e rola até ela, destacando o texto original
     (com acento e caixa diferentes). */
  const old = page.locator('#messages .message.user').nth(99);
  assert.equal(await old.getAttribute('data-lazy-shell') !== null, true, 'a pergunta 100 nasce em casca');
  await page.locator('#chat-find-input').fill('COMO RESOLVO A QUESTAO 100');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelectorAll('#messages .message.user')[99]?.hasAttribute('data-lazy-shell'), undefined, {timeout: 30000});
  await pollUntil(() => page.locator('#chat-find .chat-find-count').textContent(), (text) => text === '1 de 1', {what: 'a contagem "1 de 1"'});
  const hit = await pollUntil(() => page.evaluate(() => {
    const highlight = CSS.highlights.get('mesa-chat-find');
    const ranges = highlight ? [...highlight] : [];
    const chat = document.querySelector('#chat');
    const messages = document.querySelector('#messages');
    const scroller = chat && messages && chat.scrollHeight > chat.clientHeight + 1 ? chat : messages;
    const view = scroller.getBoundingClientRect();
    const rect = ranges[0]?.getBoundingClientRect();
    const bubble = document.querySelectorAll('#messages .message.user')[99]?.getBoundingClientRect();
    return {
      ranges: ranges.length,
      text: ranges[0]?.toString() || '',
      occurrenceVisible: !!rect && rect.top >= view.top - 1 && rect.bottom <= view.bottom + 1,
      bubbleVisible: !!bubble && bubble.bottom > view.top && bubble.top < view.bottom,
    };
  }), (value) => value.occurrenceVisible && value.bubbleVisible, {what: 'a ocorrência antiga dentro da vista'});
  assert.equal(hit.ranges, 1, 'uma ocorrência destacada');
  assert.match(hit.text, /como resolvo a questão 100/i, 'o destaque cai no texto original');
  assert.equal(await page.locator('#chat-find .chat-find-count').textContent(), '1 de 1');

  /* Navegação circular: Shift+Enter na primeira vai à última; Enter na última
     volta à primeira. O "m" (total) não muda. */
  await page.locator('#chat-find-input').fill('passo');
  await page.keyboard.press('Enter');
  const firstCount = await pollUntil(() => page.locator('#chat-find .chat-find-count').textContent(), (text) => /^1 de \d+$/.test(text), {what: 'a primeira ocorrência de "passo"'});
  const total = Number(firstCount.split(' de ')[1]);
  assert.ok(total > 5, `há várias ocorrências de "passo" (${total})`);
  await page.keyboard.press('Shift+Enter');
  await pollUntil(() => page.locator('#chat-find .chat-find-count').textContent(), (text) => text === `${total} de ${total}`, {what: 'a última ocorrência (volta circular)'});
  await page.keyboard.press('Enter');
  await pollUntil(() => page.locator('#chat-find .chat-find-count').textContent(), (text) => text === `1 de ${total}`, {what: 'a primeira ocorrência (volta circular)'});

  /* Esc fecha e devolve o foco ao composer. */
  await page.keyboard.press('Escape');
  await page.locator('#chat-find').waitFor({state: 'hidden', timeout: 5000});
  assert.deepEqual(await findState(page), {chatOpen: false, pdfOpen: false, focus: 'prompt', count: '', live: 'polite'});

  /* Fala AO VIVO: o envio e a resposta do tutor entram na fonte quando
     terminam. Termos únicos provam cada lado — "mariposa" só existe na fala do
     aluno; "ornitorrinco" só na resposta do fake. */
  await page.locator('#prompt').fill('Pergunta viva com mariposa');
  await page.locator('#send').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.message.assistant .body')].some((el) => el.textContent.includes('ornitorrinco')), undefined, {timeout: 30000});
  await sendEnabled(page, {timeout: 30000});

  await page.locator('#prompt').focus();
  await page.keyboard.press('ControlOrMeta+f');
  await page.locator('#chat-find').waitFor({state: 'visible', timeout: 5000});
  await page.locator('#chat-find-input').fill('mariposa');
  await page.keyboard.press('Enter');
  await pollUntil(() => page.locator('#chat-find .chat-find-count').textContent(), (text) => text === '1 de 1', {what: 'a fala ao vivo do aluno'});
  const liveUserHit = await page.evaluate(() => {
    const highlight = CSS.highlights.get('mesa-chat-find');
    return highlight ? [...highlight][0]?.toString() || '' : '';
  });
  assert.match(liveUserHit, /mariposa/i, 'o destaque cai na fala viva do aluno');

  await page.locator('#chat-find-input').fill('ornitorrinco');
  await page.keyboard.press('Enter');
  await pollUntil(() => page.locator('#chat-find .chat-find-count').textContent(), (text) => text === '1 de 1', {what: 'a resposta ao vivo do tutor'});
  const liveAnswerHit = await page.evaluate(() => {
    const highlight = CSS.highlights.get('mesa-chat-find');
    return highlight ? [...highlight][0]?.toString() || '' : '';
  });
  assert.match(liveAnswerHit, /ornitorrinco/i, 'o destaque cai na resposta viva do tutor');

  /* Busca aberta + mensagem nova: a contagem cresce e a ocorrência atual
     (a primeira) não é perdida. */
  await page.locator('#prompt').fill('Segunda pergunta viva');
  await page.locator('#send').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.message.assistant .body')].filter((el) => el.textContent.includes('ornitorrinco')).length === 2, undefined, {timeout: 30000});
  await sendEnabled(page, {timeout: 30000});
  await pollUntil(() => page.locator('#chat-find .chat-find-count').textContent(), (text) => text === '1 de 2', {what: 'a contagem atualizada com a busca aberta'});

  /* Trocar de conversa zera a fonte e fecha a busca. */
  await newSession(page);
  await page.locator('#chat-find').waitFor({state: 'hidden', timeout: 10000});
  assert.equal(await page.locator('#chat-find-input').inputValue(), '', 'a busca fechou e a caixa esvaziou');
  await statusOnline(page, {timeout: 60000});
  await page.locator('#prompt').focus();
  await page.keyboard.press('ControlOrMeta+f');
  await page.locator('#chat-find-input').fill('ornitorrinco');
  await page.keyboard.press('Enter');
  await pollUntil(() => page.locator('#chat-find .chat-find-count').textContent(), (text) => text === 'Nenhuma ocorrência', {what: 'o termo sumiu da conversa nova'});
  await page.keyboard.press('Escape');
  await page.locator('#chat-find').waitFor({state: 'hidden', timeout: 5000});

  /* Foco num leitor: o mesmo Ctrl/Cmd+F continua sendo a busca do PDF. */
  await page.locator('.pdf-panel').first().focus();
  await page.keyboard.press('ControlOrMeta+f');
  await page.locator('.pdf-panel .pdf-find').first().waitFor({state: 'visible', timeout: 5000});
  let state = await findState(page);
  assert.equal(state.chatOpen, false, 'a busca da conversa não abriu');
  assert.equal(state.pdfOpen, true, 'a busca do PDF abriu');
  assert.equal(await page.evaluate(() => !!document.activeElement?.closest?.('.pdf-find')), true, 'o foco foi para a busca do PDF');
  await page.keyboard.press('Escape');
  await page.locator('.pdf-panel .pdf-find').first().waitFor({state: 'hidden', timeout: 5000});
  assert.equal(await page.evaluate(() => !!document.activeElement?.closest?.('.pdf-panel')), true, 'o Esc devolve o foco ao leitor');

  /* Sem foco claro, o comportamento atual (busca do PDF) é mantido. */
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('ControlOrMeta+f');
  await page.locator('.pdf-panel .pdf-find').first().waitFor({state: 'visible', timeout: 5000});
  assert.equal((await findState(page)).pdfOpen, true, 'sem foco claro, a busca do PDF segue sendo a de hoje');
  await page.keyboard.press('Escape');
  await page.locator('.pdf-panel .pdf-find').first().waitFor({state: 'hidden', timeout: 5000});
});
