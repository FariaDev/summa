// Estado de interface da Mesa no IPC (#43 fase 2: saiu do main.cjs).
// O `live` é um objeto simples no lugar do main; a janela e o ícone são fakes
// nomeados que registram o que o host aplicou.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ptText} from './pt-text.mjs';
import {fakeIpcMain} from './fake-electron-shell.mjs';

const require = createRequire(import.meta.url);
const {createDeskStateHost} = require('../desk-state-host.cjs');
const {message} = require('../src/i18n.mjs');

const dirs = [];
after(() => { for (const dir of dirs) fs.rmSync(dir, {recursive: true, force: true}); });

function tempFile(name, contents = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-desk-state-'));
  dirs.push(dir);
  const file = path.join(dir, name);
  fs.writeFileSync(file, contents);
  return file;
}

function harness({allowed = new Set(), allowedXopp = new Set()} = {}) {
  const ipcMain = fakeIpcMain();
  const live = {state: {draft: '', theme: 'auto', accent: 'graphite', study: {}, pdfs: []}};
  const calls = [];
  const win = {setBackgroundColor: color => calls.push(['background', color])};
  const appIcon = {apply: (target, accent, theme) => calls.push(['icon', target === win ? 'win' : 'outro', accent, theme])};
  createDeskStateHost({
    ipcMain, live, allowed, allowedXopp,
    assertNoFreeMutation: () => calls.push(['guard-free']),
    assertNoNav: () => calls.push(['guard-nav']),
    persist: () => calls.push(['persist']),
    win: () => win,
    appIcon: () => appIcon,
  }).register();
  return {ipcMain, live, calls, win, appIcon};
}

test('registra save-state e os dois canais de presets de layout', () => {
  const {ipcMain} = harness();
  assert.deepEqual([...ipcMain.handlers.keys()].sort(), ['layout-presets-get', 'layout-presets-save', 'save-state']);
});

test('save-state filtra PDFs e rotações, guarda só o .xopp autorizado e aplica tema/ícone', async () => {
  const xopp = tempFile('lista.xopp');
  const {ipcMain, live, calls} = harness({allowed: new Set(['/p/a.pdf']), allowedXopp: new Set([xopp])});
  await ipcMain.invoke('save-state', {
    draft: 'novo rascunho', theme: 'dark', accent: 'violet', referenceVisible: true,
    chatWidth: 400, calcHeight: 200, pdfSplit: 0.5, viewLayout: {chatWidth: 500},
    pdfs: [
      {path: '/p/a.pdf', page: 2, zoom: 1.5, rotation: 90, scrollX: 1, scrollY: 2, invert: true, minimized: false},
      {path: '/p/fora.pdf', page: 1},
      {path: '/p/c.pdf', page: 1},
    ],
    pdfRotations: {'/p/a.pdf': 90, '/p/x.pdf': 45},
    study: {title: 'Lista 3', xopp},
  });
  assert.deepEqual(live.state.pdfs, [{path: '/p/a.pdf', page: 2, zoom: 1.5, rotation: 90, scrollX: 1, scrollY: 2, invert: true, minimized: false}],
    'só duas entradas entram na conta e a não autorizada cai fora');
  assert.deepEqual(live.state.pdfRotations, {'/p/a.pdf': 90}, 'rotação inválida fica em pé e não entra no mapa');
  assert.equal(live.state.study.xopp, xopp);
  assert.equal(live.state.draft, 'novo rascunho');
  assert.equal(live.state.theme, 'dark');
  assert.equal(live.state.accent, 'violet');
  assert.deepEqual(live.state.viewLayout, {chatWidth: 500});
  assert.deepEqual(calls, [['background', '#191919'], ['icon', 'win', 'violet', 'dark'], ['persist']]);
});

test('save-state derruba o .xopp que a Mesa não autorizou', async () => {
  const xopp = tempFile('fora.xopp');
  const {ipcMain, live} = harness();
  await ipcMain.invoke('save-state', {study: {title: 'Lista', xopp}});
  assert.equal(live.state.study.xopp, '');
});

test('layout-presets-save grava o store novo e devolve get com ele', async () => {
  const {ipcMain, live, calls} = harness();
  const layout = {chatWidth: 390, calcHeight: 220, pdfSplit: 0.5, chatCollapsed: false, calculatorCollapsed: false, referenceVisible: true, minimized: [false, false]};
  const store = await ipcMain.invoke('layout-presets-save', {action: 'upsert', preset: {name: 'Leitura', layout}});
  assert.equal(store.presets.length, 1);
  assert.equal(store.presets[0].name, 'Leitura');
  assert.equal(live.state.layoutPresets, store);
  assert.deepEqual(await ipcMain.invoke('layout-presets-get'), store);
  assert.deepEqual(calls, [['guard-free'], ['guard-nav'], ['persist']]);
});

test('layout-presets-save recusa comando inválido sem gravar nem persistir', async () => {
  const {ipcMain, live, calls} = harness();
  await assert.rejects(async () => ipcMain.invoke('layout-presets-save', {action: 'upsert', preset: {name: '', layout: {}}}),
    error => ptText(error.message) === ptText(message('err.layout.invalid')));
  assert.equal(live.state.layoutPresets, undefined);
  assert.deepEqual(calls, [['guard-free'], ['guard-nav']]);
});
