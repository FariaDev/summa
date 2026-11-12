/* Canais IPC novos de cadernos/tinta/plugin (#158/F7): a checagem de
   `event.sender` é a mesma dos outros IPCs da Mesa (`trustedMainSender` no
   main). O teste passa um `allowSender` nomeado que só aceita a janela
   principal e prova que outro remetente é recusado em cada canal novo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {registerNotebooksHost} = require('../notebooks-host.cjs');
const {registerNotebookInkWiring} = require('../notebook-ink-wiring.cjs');
const {registerXournalPluginHost} = require('../xournal-plugin-host.cjs');

const MAIN_SENDER = {sender: 'janela-principal'};
const STRANGER_SENDER = {sender: 'outra-janela'};

/** Aceita só o remetente da janela principal, como o `trustedMainSender`. */
function allowMainSender(event) {
  return event?.sender === MAIN_SENDER.sender;
}

/** Espera a recusa por remetente, venha ela síncrona ou como promessa rejeitada. */
async function expectSenderDenied(invoke) {
  try {
    await invoke();
  } catch (error) {
    assert.match(String(error?.message || error), /senderDenied/);
    return;
  }
  assert.fail('o canal aceitou um remetente estranho');
}

function createHandlerMap() {
  const handlers = new Map();
  return {
    ipcMain: {handle: (channel, fn) => handlers.set(channel, fn), removeHandler: (channel) => handlers.delete(channel)},
    handlers,
    invoke: (channel, event, payload) => handlers.get(channel)(event, payload),
  };
}

test('F7: notebooks-list/open/search/ink-status recusam remetente estranho', async () => {
  const box = createHandlerMap();
  const notebooks = registerNotebooksHost({
    ipcMain: box.ipcMain,
    courses: () => [],
    allowedXopp: new Set(),
    config: () => ({}),
    shell: {openPath: async () => ''},
    platform: 'linux',
    allowSender: allowMainSender,
  });
  try {
    for (const channel of ['notebooks-list', 'notebooks-open', 'notebooks-search', 'notebooks-ink-status']) {
      await expectSenderDenied(() => box.invoke(channel, STRANGER_SENDER, {}));
    }
    assert.deepEqual(await box.invoke('notebooks-list', MAIN_SENDER), {notebooks: []}, 'a janela principal continua aceita');
  } finally {
    notebooks.stop();
  }
});

test('F7: notebooks-ink-set e o status da fiação recusam remetente estranho', async () => {
  const box = createHandlerMap();
  const watcher = {setEnabled: () => {}, stop: () => {}, inkIndexStatus: () => ({status: 'idle', pagesRead: 0, enabled: false}), inkTextsFor: () => null, startInkConvert: async () => ({port: 0, token: ''}), stopInkConvert: async () => {}};
  registerNotebookInkWiring({
    ipcMain: box.ipcMain,
    courses: () => [],
    allowedXopp: new Set(),
    config: () => ({}),
    shell: {openPath: async () => ''},
    app: {on: () => {}},
    runtime: path.join('/tmp', 'runtime-ipc-sender'),
    state: () => ({inkReading: false}),
    registerNotebooksHostImpl: () => watcher,
    allowSender: allowMainSender,
  });
  for (const channel of ['notebooks-ink-set', 'notebooks-ink-status']) {
    await expectSenderDenied(() => box.invoke(channel, STRANGER_SENDER, {on: false}));
  }
});

test('F7: xournal-plugin-install recusa remetente estranho antes de instalar', async () => {
  const box = createHandlerMap();
  registerXournalPluginHost({ipcMain: box.ipcMain, deskDir: path.resolve(import.meta.dirname, '..'), env: {}, runtime: '', allowSender: allowMainSender});
  await expectSenderDenied(() => box.invoke('xournal-plugin-install', STRANGER_SENDER));
});
