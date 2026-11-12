// Biblioteca de conversas e troca de sessão (#43 fase 2: saiu do main.cjs).
// Runtime sintético em pasta temporária; o `live` é um objeto simples no lugar
// do main e os fakes de motor/ponte são nomeados no harness.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ptMatches} from './pt-text.mjs';
import {fakeIpcMain} from './fake-electron-shell.mjs';

const require = createRequire(import.meta.url);
const {createSessionLibraryHost} = require('../session-library-host.cjs');

const FREE_ID = '__free__';
const dirs = [];
after(() => { for (const dir of dirs) fs.rmSync(dir, {recursive: true, force: true}); });

function tempFile(name, contents = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-session-library-'));
  dirs.push(dir);
  const file = path.join(dir, name);
  fs.writeFileSync(file, contents);
  return file;
}

/** `live` mínimo, no formato do main, e fakes que registram as decisões do host. */
function harness({
  courseId = 'calc', session = '', courseStates = {}, courseSessions = () => [],
  freeSessions = [], records = [], allowedXopp = new Set(),
} = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-session-library-'));
  dirs.push(runtime);
  const calls = [];
  const live = {
    courses: [{id: 'calc', name: 'Cálculo'}, {id: 'fis', name: 'Física'}],
    courseId, session, state: {draft: 'rascunho', study: {title: '', xopp: ''}},
    freeSessionId: '', lastContextKey: 'contexto antigo',
  };
  const ipcMain = fakeIpcMain();
  const host = createSessionLibraryHost({
    ipcMain, live, runtime, FREE_ID, courseStates,
    courseSessions: () => courseSessions(),
    freeSessionList: () => freeSessions,
    freeRecordForToken: token => records.find(record => record.nativePath === token || token === `free-session:${record.id}`) || null,
    isPromotedRecord: record => record?.promotion?.status === 'promoted',
    ensureFreeNativePath: record => ({...record, nativePath: path.join(runtime, 'livre-nova.jsonl')}),
    hydrateFreeRecord: record => { live.session = record.nativePath; calls.push(['hydrate', record.id]); },
    createFreeSession: (engine, carry) => calls.push(['create-free', engine, carry]),
    sessionInfo: file => ({engine: 'opencode', preview: `prévia de ${path.basename(file)}`}),
    previewFile: file => `preview de ${path.basename(file)}`,
    visibleEngines: () => ['opencode'],
    defaultEngine: () => 'opencode',
    newSessionPath: (id, engine, carry) => { calls.push(['new-path', id, engine, carry]); return path.join(runtime, 'nova.jsonl'); },
    sessionHandoff: {carryFor: (from, engine, mode) => ({from, engine, mode})},
    withHostNav: fn => fn(),
    assertIdle: async reason => { calls.push(['assert-idle', reason]); },
    persist: () => { calls.push(['persist']); },
    stopBridge: () => { calls.push(['stop']); },
    applyCourse: id => { live.courseId = id; calls.push(['apply-course', id]); },
    initialData: () => ({courseId: live.courseId, session: live.session, draft: live.state.draft}),
    rememberSession: () => { calls.push(['remember']); },
    allowedXopp,
    t: key => (key === 'free.tab' ? 'Livre' : key),
  });
  host.register();
  return {host, ipcMain, live, calls, runtime, allowedXopp};
}

test('registra os mesmos canais de antes da divisão', () => {
  const {ipcMain} = harness();
  assert.deepEqual([...ipcMain.handlers.keys()].sort(), ['library-chat-open', 'library-chat-update', 'library-chats', 'new-session', 'open-session']);
});

test('libraryAuthorizedChats junta matéria ativa, outras matérias e Livre, sem repetir nem listar arquivo sumido', () => {
  const active = tempFile('a.jsonl');
  const other = tempFile('b.jsonl');
  const {host} = harness({
    session: active,
    courseSessions: () => [{path: active}, {path: active}],
    courseStates: {calc: {sessions: [{path: active}]}, fis: {sessions: [{path: other}, {path: path.join(os.tmpdir(), 'sumiu.jsonl')}]}},
    freeSessions: [
      {path: '/livre/s1.jsonl', label: 'Conversa livre', promoted: false},
      {path: '/livre/s2.jsonl', label: 'Promovida', promoted: true},
    ],
  });
  const rows = host.libraryAuthorizedChats();
  assert.deepEqual(rows.map(row => [row.courseId, row.session]), [
    ['calc', active],
    ['fis', other],
    [FREE_ID, '/livre/s1.jsonl'],
  ]);
  assert.equal(rows[0].current, true, 'a conversa ativa é a única marcada');
  assert.equal(rows[1].current, false);
  assert.equal(rows[0].courseName, 'Cálculo');
  assert.equal(rows[0].engine, 'opencode');
  assert.equal(rows[2].courseName, 'Livre');
  assert.equal(rows[2].title, 'Conversa livre');
});

test('library-chats e library-chat-open usam a lista autorizada e abrem a sessão', async () => {
  const file = tempFile('abrir.jsonl');
  const {ipcMain, calls} = harness({courseSessions: () => [{path: file}]});
  const rows = await ipcMain.invoke('library-chats');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].courseId, 'calc');
  const opened = await ipcMain.invoke('library-chat-open', rows[0].id);
  assert.equal(opened.session, file);
  assert.ok(calls.some(([name]) => name === 'assert-idle'));
});

test('open-session restaura o estudo e o layout da conversa da matéria', async () => {
  const file = tempFile('a.jsonl');
  const {ipcMain, live, calls} = harness({
    courseId: 'calc',
    courseStates: {calc: {sessions: [{path: file}], sessionStudies: {[file]: {title: 'Lista 3', xopp: ''}}}},
    courseSessions: () => [{path: file}],
  });
  const result = await ipcMain.invoke('open-session', file);
  assert.equal(live.session, file);
  assert.equal(live.state.study.title, 'Lista 3');
  assert.equal(live.lastContextKey, '');
  assert.equal(result.session, file);
  assert.ok(calls.some(([name]) => name === 'remember'));
  assert.ok(calls.some(([name]) => name === 'stop'));
});

test('open-session recusa arquivo fora da biblioteca da matéria', async () => {
  const {ipcMain} = harness({courseSessions: () => []});
  await assert.rejects(ipcMain.invoke('open-session', '/sumiu/x.jsonl'), ptMatches(/Sessão não encontrada nesta matéria/));
});

test('open-session de conversa promovida leva para a matéria de destino', async () => {
  const record = {id: 's1', nativePath: '/livre/s1.jsonl', promotion: {status: 'promoted', courseId: 'fis'}};
  const {ipcMain, live, calls} = harness({courseId: FREE_ID, records: [record]});
  const result = await ipcMain.invoke('open-session', '/livre/s1.jsonl');
  assert.equal(live.courseId, 'fis');
  assert.equal(result.courseId, 'fis');
  assert.deepEqual(calls.filter(([name]) => name === 'apply-course'), [['apply-course', 'fis']]);
});

test('new-session na aba Livre cria workspace e limpa rascunho, estudo e autorizações', async () => {
  const allowedXopp = new Set(['/x/a.xopp']);
  const {ipcMain, live, calls} = harness({courseId: FREE_ID, allowedXopp});
  const result = await ipcMain.invoke('new-session', {engine: 'claude'});
  assert.deepEqual(calls.find(([name]) => name === 'create-free'), ['create-free', 'opencode', {from: undefined, engine: 'claude', mode: 'digest'}],
    'motor fora da vista cai no padrão, com a passagem explícita');
  assert.equal(allowedXopp.size, 0);
  assert.equal(live.lastContextKey, '');
  assert.deepEqual(live.state.study, {title: '', xopp: ''});
  assert.equal(result.courseId, FREE_ID);
});

test('new-session na matéria grava a sessão nova e lembra a anterior', async () => {
  const {ipcMain, live, calls} = harness({courseId: 'calc'});
  const result = await ipcMain.invoke('new-session', {});
  assert.ok(result.session.endsWith('nova.jsonl'));
  assert.equal(live.session, result.session);
  assert.deepEqual(calls.find(([name]) => name === 'new-path'), ['new-path', 'calc', 'opencode', {from: undefined, engine: null, mode: 'digest'}]);
  assert.ok(calls.some(([name]) => name === 'remember'));
});

test('new-session recusa motor e passagem fora do contrato', async () => {
  const {ipcMain} = harness();
  await assert.rejects(ipcMain.invoke('new-session', {engine: 'outro'}), ptMatches(/new-session: engine recebeu "outro"/));
  await assert.rejects(ipcMain.invoke('new-session', {carryFrom: ''}), ptMatches(/new-session: carryFrom recebeu ""/));
});
