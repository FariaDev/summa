// Fakes nomeados do que o main pega do Electron para menu, notificação e IPC
// (#43 fase 2): os hosts recebem isto por parâmetro nos testes.
import {EventEmitter} from 'node:events';

/** ipcMain que guarda os handlers e deixa o teste chamá-los. */
export function fakeIpcMain() {
  const handlers = new Map();
  return {
    handlers,
    handle(channel, fn) {
      if (handlers.has(channel)) throw Error(`handler repetido: ${channel}`);
      handlers.set(channel, fn);
    },
    invoke: (channel, ...args) => handlers.get(channel)({sender: null}, ...args),
  };
}

/** Menu do Electron que guarda o último template montado. */
export function fakeMenu() {
  const menu = {template: null, builds: 0};
  menu.buildFromTemplate = template => template;
  menu.setApplicationMenu = template => { menu.template = template; menu.builds += 1; };
  return menu;
}

/** Notification do Electron: registra cada uma criada e se foi mostrada. */
export function fakeNotificationClass({supported = true} = {}) {
  const created = [];
  class FakeNotification extends EventEmitter {
    constructor(options) { super(); this.options = options; this.shown = false; created.push(this); }
    show() { this.shown = true; }
    static isSupported() { return supported; }
  }
  FakeNotification.created = created;
  return FakeNotification;
}

/** BrowserWindow mínima: foco, minimizado e o que o clique da notificação chama. */
export function fakeWindow({focused = false, minimized = false} = {}) {
  const calls = [];
  const overlays = [];
  return {calls, overlays, destroyed: false, sent: [], isDestroyed() { return this.destroyed; }, isFocused: () => focused, isMinimized: () => minimized,
    setOverlayIcon: (image, description) => overlays.push({image, description}),
    restore: () => calls.push('restore'), show: () => calls.push('show'), focus: () => calls.push('focus'),
    webContents: {send(channel) { calls.push(`send:${channel}`); }, focus() {}}};
}

/** NativeImage que guarda os pixels BGRA e o tamanho pedido pelo selo. */
export function fakeBadgeNativeImage() {
  const images = [];
  return {images, createFromBitmap(pixels, size) {
    const image = {pixels, size, resize(options) { this.resized = options; return this; }};
    images.push(image);
    return image;
  }};
}

/** App do Electron que registra contagens no Dock/launcher. */
export function fakeBadgeApp() {
  return {badges: [], setBadgeCount(value) { this.badges.push(value); return true; }};
}

/** Tradução nomeada da descrição acessível do selo. */
export function fakeBadgeText(key, {count}) {
  if (key !== 'notify.unreadReplies') throw Error(`chave inesperada: ${key}`);
  return `Respostas não lidas: ${count}`;
}

/** shell do Electron: guarda o que o host pediu para abrir. */
export function fakeShell() {
  const opened = [];
  return {
    opened,
    openPath: async (target) => { opened.push(target); return ''; },
    openExternal: async (url) => { opened.push(url); },
  };
}

/** dialog do Electron: `showOpenDialog` devolve `answer` (troque-o no teste) e guarda as opções de cada chamada. */
export function fakeDialog() {
  const dialog = {
    calls: [],
    answer: {canceled: true, filePaths: []},
    showOpenDialog: async (win, options) => {
      dialog.calls.push({win, options});
      return dialog.answer;
    },
  };
  return dialog;
}
