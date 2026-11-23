// Atalhos editáveis e menu nativo (#43 fase 2: saíram do main.cjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fakeIpcMain, fakeMenu, fakeWindow} from './fake-electron-shell.mjs';

const require = createRequire(import.meta.url);
const {validAccelerator, normalizeKeymap, createDeskMenu} = require('../desk-menu.cjs');

test('validAccelerator aceita modificadores conhecidos e recusa repetição ou tecla inválida', () => {
  assert.equal(validAccelerator('CmdOrCtrl+Shift+K'), true);
  assert.equal(validAccelerator('F12'), true);
  assert.equal(validAccelerator('Shift+Shift+K'), false);
  assert.equal(validAccelerator('Hyper+K'), false);
  assert.equal(validAccelerator('Ctrl+Alt+Shift+Super+K'), false);
  assert.equal(validAccelerator(''), false);
  assert.equal(validAccelerator(42), false);
});

test('normalizeKeymap só guarda ids do menu, com accelerator válido ou null', () => {
  assert.deepEqual(normalizeKeymap({menu: {help: 'F1', stop: null, inventado: 'F2', check: 'Hyper+C'}}), {help: 'F1', stop: null});
  assert.deepEqual(normalizeKeymap({menu: []}), {});
  assert.deepEqual(normalizeKeymap(null), {});
});

function deskMenu({conferir = true, platform = 'linux'} = {}) {
  const live = {config: {desk: {conferir}}, state: {}, win: fakeWindow(), languageHost: {t: key => key}};
  const menu = fakeMenu();
  const ipcMain = fakeIpcMain();
  const host = createDeskMenu({live, Menu: menu, captureAvailable: () => true, platform});
  host.register(ipcMain);
  return {host, menu, ipcMain, live};
}
const studyItems = menu => menu.template.find(item => item.label === 'chrome.study').submenu;

test('o menu usa o atalho padrão e troca pelo do usuário quando o renderer manda o mapa', async () => {
  const {host, menu, ipcMain} = deskMenu();
  host.buildMenu();
  assert.equal(studyItems(menu).find(item => item.label === 'menu.check').accelerator, 'CmdOrCtrl+Shift+C');
  assert.deepEqual(await ipcMain.invoke('set-keymap', {menu: {check: 'F5', stop: null}}), {ok: true, menu: 2});
  assert.equal(menu.builds, 2, 'set-keymap remonta o menu com a janela aberta');
  assert.equal(studyItems(menu).find(item => item.label === 'menu.check').accelerator, 'F5');
  assert.equal(studyItems(menu).find(item => item.label === 'menu.stop').accelerator, undefined);
});

test('conferir:false tira o Conferir do menu Estudar', () => {
  const {host, menu} = deskMenu({conferir: false});
  host.buildMenu();
  assert.equal(studyItems(menu).some(item => item.label === 'menu.check'), false);
});

const roles = items => items.filter(item => item.role).map(item => item.role);

test('no macOS o menu do app ganha Ocultar e o menu Janela entra antes da Ajuda', () => {
  const {host, menu} = deskMenu({platform: 'darwin'});
  host.buildMenu();
  assert.deepEqual(roles(menu.template[0].submenu), ['hide', 'hideOthers', 'unhide', 'quit']);
  assert.deepEqual(menu.template.map(item => item.label), ['Summa', 'menu.edit', 'chrome.study', 'menu.view', 'menu.window', 'menu.help']);
  assert.equal(menu.template.find(item => item.label === 'menu.window').role, 'windowMenu');
});

test('Windows e Linux ficam sem os itens só do macOS', () => {
  for (const platform of ['win32', 'linux']) {
    const {host, menu} = deskMenu({platform});
    host.buildMenu();
    assert.deepEqual(roles(menu.template[0].submenu), ['quit'], platform);
    assert.deepEqual(menu.template.map(item => item.label), ['Summa', 'menu.edit', 'chrome.study', 'menu.view', 'menu.help'], platform);
  }
});

test('itens com papel do Electron levam rótulo traduzido: no Windows e no Linux o padrão era "Exit", "Undo", "Copy" em inglês', () => {
  for (const platform of ['win32', 'linux', 'darwin']) {
    const {host, menu} = deskMenu({platform});
    host.buildMenu();
    const items = menu.template.flatMap(item => item.submenu || []);
    const translated = ['quit', 'undo', 'redo', 'cut', 'copy', 'paste', 'selectAll', 'reload', 'togglefullscreen'];
    for (const role of translated) {
      const item = items.find(entry => entry.role === role);
      assert.equal(item?.label, `menu.role.${role}`, `${platform}: ${role} sem rótulo traduzido`);
    }
  }
});

test('todo rótulo de papel do menu existe nos dois idiomas', async () => {
  const fs = await import('node:fs');
  for (const file of ['pt-BR.json', 'en.json']) {
    const locale = JSON.parse(fs.readFileSync(new URL(`../src/locales/${file}`, import.meta.url), 'utf8'));
    for (const role of ['quit', 'undo', 'redo', 'cut', 'copy', 'paste', 'selectAll', 'reload', 'togglefullscreen']) {
      assert.ok(String(locale[`menu.role.${role}`] || '').trim(), `${file}: menu.role.${role} ausente`);
    }
  }
});
