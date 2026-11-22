// Selo e notificação do sistema (#43 fase 2: saíram do main.cjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {ptMatches} from './pt-text.mjs';
import {createRequire} from 'node:module';
import {fakeIpcMain, fakeNotificationClass, fakeWindow, fakeBadgeApp, fakeBadgeNativeImage, fakeBadgeText} from './fake-electron-shell.mjs';

const require = createRequire(import.meta.url);
const {createDeskNotifier} = require('../desk-notify-host.cjs');

function notifier({TEST_MODE = false, focused = false, platform = 'darwin'} = {}) {
  const app = fakeBadgeApp();
  const {badges} = app;
  const nativeImage = fakeBadgeNativeImage();
  const Notification = fakeNotificationClass();
  const live = {win: fakeWindow({focused, minimized: true})};
  const host = createDeskNotifier({app, nativeImage, t: fakeBadgeText, Notification, live, TEST_MODE, platform});
  const ipcMain = fakeIpcMain();
  host.register(ipcMain);
  return {host, ipcMain, badges, nativeImage, Notification, live};
}

test('notify limpa o texto, mostra fora de foco e o clique traz a janela de volta', async () => {
  const {ipcMain, Notification, live} = notifier();
  assert.equal(await ipcMain.invoke('notify', {body: '  pronto \n  para  revisar '}), true);
  const [shown] = Notification.created;
  assert.equal(shown.options.body, 'pronto para revisar');
  assert.equal(shown.shown, true);
  shown.emit('click');
  assert.deepEqual(live.win.calls, ['restore', 'show', 'focus']);
  await assert.rejects(async () => ipcMain.invoke('notify', {body: '   '}), ptMatches(/Pedido inválido em notify: body recebeu "   "/));
});

test('com a janela em foco ou no modo de teste não há notificação', async () => {
  assert.equal(await notifier({focused: true}).ipcMain.invoke('notify', {body: 'x'}), false);
  const quiet = notifier({TEST_MODE: true});
  assert.equal(await quiet.ipcMain.invoke('notify', {body: 'x'}), false);
  assert.equal(quiet.Notification.created.length, 0);
});

for (const platform of ['darwin', 'linux']) test(`badge limita entre 0 e 99 no ${platform}`, async () => {
  const {ipcMain, badges, live, nativeImage} = notifier({platform});
  await ipcMain.invoke('badge', 250);
  await ipcMain.invoke('badge', null);
  assert.deepEqual(badges, [99, 0]);
  await assert.rejects(async () => ipcMain.invoke('badge', 'muito'), ptMatches(/badge: value recebeu "muito"; esperado number\|null/));
  assert.deepEqual(live.win.overlays, []);
  assert.equal(nativeImage.images.length, 0);
});

test('Windows mostra a contagem e limpa o selo com zero ou null', async () => {
  const {ipcMain, live, badges, nativeImage} = notifier({platform: 'win32'});
  for (const value of [3, 250, 0, null]) await ipcMain.invoke('badge', value);
  assert.deepEqual(live.win.overlays, [
    {image: nativeImage.images[0], description: 'Respostas não lidas: 3'},
    {image: nativeImage.images[1], description: 'Respostas não lidas: 99'},
    {image: null, description: ''}, {image: null, description: ''},
  ]);
  assert.deepEqual(badges, []);
  for (const image of nativeImage.images) {
    assert.deepEqual(image.size, {width: 64, height: 64});
    assert.deepEqual(image.resized, {width: 16, height: 16, quality: 'best'});
    assert.equal(image.pixels.length, 64 * 64 * 4);
    assert.equal(image.pixels[3], 0);
    assert.ok(image.pixels.includes(214));
    assert.ok(image.pixels.includes(255));
  }
  assert.notDeepEqual(nativeImage.images[0].pixels, nativeImage.images[1].pixels);
  await assert.rejects(async () => ipcMain.invoke('badge', NaN), /number\|null/);
});

test('Windows ignora janela ausente ou destruída', async () => {
  const {host, live, nativeImage} = notifier({platform: 'win32'});
  const win = live.win;
  win.destroyed = true;
  host.setBadge(3);
  live.win = null;
  host.setBadge(3);
  host.setBadge(null);
  assert.deepEqual(win.overlays, []);
  assert.equal(nativeImage.images.length, 0);
});

for (const platform of ['darwin', 'linux', 'win32']) test(`TEST_MODE não altera selo no ${platform}`, async () => {
  const {host, ipcMain, badges, live, nativeImage} = notifier({platform, TEST_MODE: true});
  host.setBadge(3);
  await ipcMain.invoke('badge', 3);
  await ipcMain.invoke('badge', null);
  assert.deepEqual(badges, []);
  assert.deepEqual(live.win.overlays, []);
  assert.equal(nativeImage.images.length, 0);
});
