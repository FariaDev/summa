// @ts-check
/* A página do Ambitus no modo mini chega ao tutor principal como cartão de
   caderno: o `pi-prompt` leva o caminho ESCONDIDO ao motor (bloco no fim do
   prompt, na língua do tutor) e só de caderno que a Mesa já autorizou. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fakeIpcMain} from './fake-electron-shell.mjs';
import {fakeTutorBridge} from './fake-tutor-bridge.mjs';
import {displayUserText} from '../text.mjs';

const require = createRequire(import.meta.url);
const {registerTutorPromptHost} = require('../tutor-prompt-host.cjs');
const {message} = require('../src/i18n.mjs');

const NOTEBOOK = '/c/Limites — aula 3.xopp';

function setup({allowed = [NOTEBOOK], language = 'pt-BR'} = {}) {
  const ipcMain = fakeIpcMain();
  const bridge = fakeTutorBridge({get_state: {isStreaming: false}});
  const sent = [];
  bridge.request = async (method, params) => { if (method === 'prompt') sent.push(params); return method === 'get_state' ? {isStreaming: false} : {}; };
  const tutorT = (key, args = {}) => (key === 'sidechatctx.notebookHead' ? (language === 'en' ? '[Notebooks attached to the message]' : '[Cadernos anexados à mensagem]') : `- caderno “${args.name}”, pág. ${args.page}, arquivo ${args.path}`);
  const live = {config: {desk: {}}, state: {study: {title: ''}}, courseId: 'calc', courses: [{id: 'calc', name: 'Cálculo'}], session: '/s.jsonl', bridge, lastContextKey: '',
    languageHost: {tutorLanguage: () => language, tutor: () => language, ui: () => 'pt-BR', tutorT}, studyServices: {accepted() {}}};
  registerTutorPromptHost({ipcMain, live, runtime: '/rt', FREE_ID: '__free__', allowedXopp: new Set(allowed), ggb: {newRequest() {}}, appendLog: () => {},
    engine: () => 'pi', connect: () => bridge, promptImages: () => [], validPdf: (file) => file, assertNoFreeMutation() {}, assertNoNav() {}});
  return {ipcMain, sent};
}

test('o caderno anexado vai escondido ao motor, com o caminho, e a bolha não o mostra', async () => {
  const {ipcMain, sent} = setup();
  await ipcMain.invoke('pi-prompt', {text: 'por que posso cancelar?', notebooks: [{caminho: NOTEBOOK, pagina: 2, nome: 'Limites — aula 3'}]});
  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /^por que posso cancelar\?/);
  assert.match(sent[0].message, /\[Cadernos anexados à mensagem\]\n- caderno “Limites — aula 3”, pág\. 2, arquivo \/c\/Limites — aula 3\.xopp/);
  assert.equal(displayUserText(sent[0].message), 'por que posso cancelar?', 'depois do reload a bolha mostra só o que a pessoa escreveu');
});

test('sem caderno nada muda no prompt', async () => {
  const {ipcMain, sent} = setup();
  await ipcMain.invoke('pi-prompt', {text: 'oi'});
  await ipcMain.invoke('pi-prompt', {text: 'oi', notebooks: []});
  for (const prompt of sent) assert.doesNotMatch(prompt.message, /Cadernos anexados/);
});

test('caderno que a Mesa não autorizou recusa o envio antes de escrever, com o caminho na mensagem', async () => {
  const {ipcMain, sent} = setup({allowed: []});
  await assert.rejects(() => ipcMain.invoke('pi-prompt', {text: 'oi', notebooks: [{caminho: NOTEBOOK, pagina: 1, nome: ''}]}), (error) => {
    assert.equal(error.message, message('err.sidechat.notebookUnknown', {received: NOTEBOOK}));
    return true;
  });
  assert.deepEqual(sent, [], 'nada foi escrito');
});
