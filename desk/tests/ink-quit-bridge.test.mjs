/* #212: o `before-quit` do main espera o fechamento da ponte da tinta, e não
   só o serve do tutor. O arquivo `ink-convert-bridge.json` tem de sumir antes
   de o app sair; o teto de 1 s do `closeServer` cabe no teto de 3 s do quit.
   Carrega o `main.cjs` REAL com um `electron` de mentira (mesmo padrão do
   `core.test.mjs`) e segura uma conexão com a ponte para o `server.close` só
   terminar no teto — sem isso, o fechamento seria rápido demais para provar a
   espera. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const DESK = path.resolve(import.meta.dirname, '..');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadMainWithMockElectron(runtime) {
  const handlers = new Map();
  const listeners = new Map();
  const winEvents = new Map();
  const wcEvents = new Map();
  const record = (map, key, fn) => { if (!map.has(key)) map.set(key, []); map.get(key).push(fn); };
  const emitFor = (map) => (key, ...args) => { for (const fn of map.get(key) || []) fn(...args); };
  const win = {
    isDestroyed: () => true, setBackgroundColor() {}, setAppDetails() {},
    webContents: {on: (name, fn) => record(wcEvents, name, fn), getURL: () => '', send() {}, setWindowOpenHandler() {}, session: {protocol: {handle() {}}, webRequest: {onBeforeRequest() {}}, setPermissionRequestHandler() {}}},
    contentView: {addChildView() {}},
    loadFile: async () => {}, on: (name, fn) => record(winEvents, name, fn), getBounds: () => ({x: 10, y: 10, width: 1200, height: 800}),
  };
  let quits = 0;
  const app = {
    setName() {}, setPath() {}, getVersion: () => '0.4.0', setAboutPanelOptions() {}, setAppUserModelId() {},
    dock: {setIcon() {}}, getPath: () => path.join(runtime, 'electron'),
    whenReady: () => Promise.resolve(), requestSingleInstanceLock: () => true,
    quit() { quits += 1; },
    on(name, cb) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(cb); },
  };
  const ggbViews = [];
  class WebContentsView {
    constructor() {
      this.visible = false;
      this.bounds = null;
      this.scripts = [];
      const events = new Map();
      this.webContents = {isDestroyed: () => false, on: (name, fn) => record(events, name, fn), emit: (name, ...args) => emitFor(events)(name, ...args), loadFile: async () => {}, executeJavaScript: async (script) => { this.scripts.push(script); return null; }, session: {setPermissionRequestHandler() {}}, setWindowOpenHandler() {}, getURL: () => ''};
      ggbViews.push(this);
    }
    setBounds(bounds) { this.bounds = bounds; }
    setVisible(value) { this.visible = value; }
    capturePage() { return {isEmpty: () => true, toPNG: () => Buffer.alloc(0)}; }
  }
  const electron = {
    app,
    protocol: {registerSchemesAsPrivileged() {}},
    BrowserWindow: class { constructor() { return win; } },
    ipcMain: {handle: (name, fn) => handlers.set(name, fn), on() {}},
    dialog: {showOpenDialog: async () => ({canceled: true, filePaths: []}), showSaveDialog: async () => ({canceled: true})},
    shell: {openPath: async () => '', showItemInFolder() {}},
    Menu: {buildFromTemplate: () => ({}), setApplicationMenu() {}},
    screen: {getAllDisplays: () => [{id: 1, workArea: {x: 0, y: 0, width: 1600, height: 1000}}], getPrimaryDisplay: () => ({id: 1, workArea: {x: 0, y: 0, width: 1600, height: 1000}})},
    systemPreferences: {getMediaAccessStatus: () => 'granted', askForMediaAccess: async () => {}},
    nativeImage: {createFromBuffer: () => ({isEmpty: () => true, getSize: () => ({width: 0, height: 0})})},
    WebContentsView,
  };
  const Module = require('node:module');
  const original = Module._load;
  Module._load = function (request, parent, isMain) { if (request === 'electron') return electron; return original.call(Module, request, parent, isMain); };
  const previousRuntime = process.env.LEARNING_DESK_RUNTIME;
  process.env.LEARNING_DESK_RUNTIME = runtime;
  const mainPath = require.resolve(path.join(DESK, 'main.cjs'));
  delete require.cache[mainPath];
  try { require(mainPath); } finally {
    Module._load = original;
    if (previousRuntime === undefined) delete process.env.LEARNING_DESK_RUNTIME;
    else process.env.LEARNING_DESK_RUNTIME = previousRuntime;
  }
  return {
    handlers,
    beforeQuit(event) { for (const cb of listeners.get('before-quit') || []) cb(event); },
    get quits() { return quits; },
  };
}

async function waitFor(predicate, label, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) await sleep(10);
  assert.ok(predicate(), `esperava ${label}`);
}

test('before-quit espera a ponte fechar e apaga o bridge file antes de sair (#212)', async (t) => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-ink-quit-'));
  const bridgeFile = path.join(runtime, 'ink-convert-bridge.json');
  let socket = null;
  t.after(() => {
    try { socket?.destroy(); } catch { /* já fechou */ }
    fs.rmSync(runtime, {recursive: true, force: true});
  });
  fs.writeFileSync(path.join(runtime, 'config.json'), JSON.stringify({vaultPath: runtime, courses: []}));
  fs.writeFileSync(path.join(runtime, 'desk.json'), JSON.stringify({inkReading: true}));

  const main = loadMainWithMockElectron(runtime);
  await waitFor(() => fs.existsSync(bridgeFile), 'a ponte subir no boot');
  const {port} = JSON.parse(fs.readFileSync(bridgeFile, 'utf8'));

  /* Conexão viva: o `server.close` da ponte só termina no teto de 1 s. */
  socket = net.connect(port, '127.0.0.1');
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });

  main.beforeQuit({preventDefault() {}});
  await waitFor(() => main.quits > 0, 'o app sair');
  assert.equal(fs.existsSync(bridgeFile), false, 'o bridge file tem de sumir antes de o app sair');
});
