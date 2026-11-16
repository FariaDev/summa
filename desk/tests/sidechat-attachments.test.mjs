/* Anexos do chat lateral (bandeja com imagens e cadernos): o que o manager
   leva ao motor e o que a pessoa vê. Sem Electron nem motor real: o canal é
   um fake com nome. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

import {ptMatches} from './pt-text.mjs';

const require = createRequire(import.meta.url);
const {createSideChatManager} = require('../sidechat.cjs');
const {displayUserText} = require('../sidechat-store.cjs');

const NOTE = '[Cadernos anexados à mensagem]\n- caderno “Limites”, pág. 2, arquivo /cadernos/Limites.xopp (releia com ler_caderno)';
const SHOT = {type: 'image', data: 'AAAA', mimeType: 'image/png'};

/** Canal que só registra o que o manager manda ao motor. */
class FakeSideChannel {
  constructor({onEvent}) { this.onEvent = onEvent; this.prompts = []; this.history = []; }
  async prompt(request) {
    this.prompts.push(request);
    this.history.push({role: 'user', content: [{type: 'text', text: request.text}]});
    return {accepted: true};
  }
  async warm() {}
  async abort() { return {aborted: true}; }
  respond() { return {ok: true}; }
  close() {}
  isBusy() { return false; }
  isUncertain() { return false; }
  messages() { return this.history; }
}

/* Frase padrão do envio só com imagem (#109); no app vem do locale, aqui é fixa. */
const IMAGE_ONLY = 'Responda de acordo com a imagem que mandei.';

function harness({validateImages, notebookNote, imageOnlyText, changingContext = false} = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-sidechat-anexos-'));
  const channels = [];
  let clock = 1000;
  const manager = createSideChatManager({
    runtime,
    current: () => ({session: '/principal/opencode-1.json', courseId: 'Calculo I', engine: 'opencode', courseName: 'Cálculo I'}),
    snapshot: ({refs}) => {
      const at = changingContext ? ++clock : 1001;
      return {mainSession: '/principal/opencode-1.json', refs, study: {title: '', xopp: ''}, at, digest: '[Contexto do chat lateral]\n- conversa principal: x', key: `k${at}`};
    },
    validPdf: (value) => value,
    createEngine: ({onEvent}) => { const channel = new FakeSideChannel({onEvent}); channels.push(channel); return channel; },
    emit: () => {},
    log: () => {},
    now: () => ++clock,
    validateImages,
    notebookNote,
    imageOnlyText,
  });
  return {manager, channels, runtime};
}

function opened(h) {
  return h.manager.open({refs: []}).id;
}

test('as imagens da bandeja chegam ao motor já validadas; a fala visível é só o texto', async () => {
  const seen = [];
  const h = harness({validateImages: (raw) => { seen.push(raw); return [SHOT]; }});
  const id = opened(h);
  const result = await h.manager.prompt({id, text: 'o que é isto?', images: [{dataUrl: 'data:image/png;base64,AAAA'}]});
  assert.equal(result.sent, true);
  assert.deepEqual(seen, [[{dataUrl: 'data:image/png;base64,AAAA'}]]);
  assert.deepEqual(h.channels[0].prompts[0].images, [SHOT]);
  const shown = h.manager.read({id}).messages.filter((message) => message.role === 'user');
  assert.deepEqual(shown.map((message) => message.content[0].text.split('\n\n').pop()), ['o que é isto?']);
});

test('sem anexos nada muda: o texto vai como sempre e a lista de imagens vai vazia', async () => {
  const h = harness({validateImages: () => assert.fail('sem imagens não valida'), notebookNote: () => assert.fail('sem cadernos não confere')});
  const id = opened(h);
  assert.equal((await h.manager.prompt({id, text: 'oi', images: [], notebooks: []})).sent, true);
  assert.equal((await h.manager.prompt({id, text: 'de novo'})).sent, true);
  assert.ok(h.channels[0].prompts.every((request) => request.images.length === 0));
  assert.ok(h.channels[0].prompts[1].text === 'de novo', 'o contexto já foi entregue e nada novo se soma');
});

test('só imagem, sem texto: o motor recebe a frase padrão e a fala visível fica vazia (#109)', async () => {
  const h = harness({validateImages: () => [SHOT], imageOnlyText: () => IMAGE_ONLY});
  const id = opened(h);
  const result = await h.manager.prompt({id, text: '', images: [{dataUrl: 'data:image/png;base64,AAAA'}]});
  assert.equal(result.sent, true);
  assert.ok(h.channels[0].prompts[0].text.endsWith(IMAGE_ONLY), 'o pedido ao motor termina na frase padrão');
  assert.deepEqual(h.channels[0].prompts[0].images, [SHOT]);
  const shown = h.manager.read({id}).messages.filter((message) => message.role === 'user');
  assert.deepEqual(shown.map((message) => message.content[0].text), ['']);
});

test('com texto digitado, a frase padrão não entra: vai só o que a pessoa escreveu', async () => {
  const h = harness({validateImages: () => [SHOT], imageOnlyText: () => IMAGE_ONLY});
  const id = opened(h);
  await h.manager.prompt({id, text: 'o que é isto?', images: [{dataUrl: 'data:image/png;base64,AAAA'}]});
  assert.ok(h.channels[0].prompts[0].text.endsWith('o que é isto?'));
  assert.doesNotMatch(h.channels[0].prompts[0].text, /Responda de acordo/);
});

test('sem texto e sem imagem continua recusado: a frase padrão não libera envio vazio', async () => {
  const h = harness({validateImages: () => [], imageOnlyText: () => IMAGE_ONLY});
  const id = opened(h);
  await assert.rejects(() => h.manager.prompt({id, text: '   ', images: []}), ptMatches(/Mensagem inválida/));
  assert.equal(h.channels.length, 0, 'o motor nem sobe');
});

test('o caderno anexado vai ao motor dentro do envelope e a pessoa só vê a pergunta', async () => {
  const given = [];
  const h = harness({notebookNote: (notebooks) => { given.push(notebooks); return NOTE; }});
  const id = opened(h);
  const notebooks = [{caminho: '/cadernos/Limites.xopp', pagina: 2, nome: 'Limites'}];
  assert.equal((await h.manager.prompt({id, text: 'por que o limite não existe aqui?', notebooks})).sent, true);
  assert.deepEqual(given, [notebooks]);
  const toEngine = h.channels[0].prompts[0].text;
  assert.match(toEngine, /\/cadernos\/Limites\.xopp/);
  assert.ok(toEngine.startsWith('[Contexto do chat lateral]'), 'o bloco abre o envelope que a tela e a busca cortam');
  assert.ok(toEngine.endsWith('por que o limite não existe aqui?'));
  assert.equal(displayUserText(toEngine), 'por que o limite não existe aqui?');
  const shown = h.manager.read({id}).messages.find((message) => message.role === 'user');
  assert.equal(shown.content[0].text, 'por que o limite não existe aqui?');
  assert.doesNotMatch(JSON.stringify(h.manager.read({id}).messages), /Limites\.xopp/);
});

test('com o contexto do principal indo junto, o caderno entra no mesmo envelope, depois dele', async () => {
  const h = harness({notebookNote: () => NOTE, changingContext: true});
  const id = opened(h);
  await h.manager.prompt({id, text: 'primeira', notebooks: [{caminho: '/cadernos/Limites.xopp', pagina: 2, nome: ''}]});
  const toEngine = h.channels[0].prompts[0].text;
  const at = (needle) => toEngine.indexOf(needle);
  assert.ok(at('- conversa principal: x') > -1 && at('/cadernos/Limites.xopp') > at('- conversa principal: x'));
  assert.equal(toEngine.match(/\[Contexto do chat lateral\]/g).length, 1, 'um envelope só');
  assert.equal(displayUserText(toEngine), 'primeira');
});

test('caderno que a Mesa não conhece é recusado antes de qualquer escrita', async () => {
  const h = harness({notebookNote: () => { throw Error('O caderno /x.xopp não é um que a Summa conheça'); }});
  const id = opened(h);
  await assert.rejects(() => h.manager.prompt({id, text: 'oi', notebooks: [{caminho: '/x.xopp', pagina: 1, nome: ''}]}), /não é um que a Summa conheça/);
  assert.equal(h.channels.length, 0, 'o motor nem sobe');
  assert.deepEqual(h.manager.read({id}).messages, []);
});

test('anexos em formato errado, ou sem validador no host, são recusados com o valor recebido', async () => {
  const h = harness();
  const id = opened(h);
  await assert.rejects(() => h.manager.prompt({id, text: 'oi', images: [{dataUrl: 'data:image/png;base64,AA'}]}), ptMatches(/Anexos inválidos.*dataUrl/));
  await assert.rejects(() => h.manager.prompt({id, text: 'oi', notebooks: 'x'}), ptMatches(/Anexos inválidos.*"x"/));
  const withValidators = harness({validateImages: () => [], notebookNote: () => ''});
  await assert.rejects(() => withValidators.manager.prompt({id: opened(withValidators), text: 'oi', images: 'x'}), ptMatches(/Anexos inválidos/));
});
