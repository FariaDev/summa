import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {rendererEntry, loadRenderer} = require('../renderer-entry.cjs');
const DESK = path.join(path.sep, 'app', 'desk');
const BUILT = path.join(DESK, 'out', 'renderer', 'index.html');

test('sem electron-vite o renderer vem do fonte, mesmo com build no disco', () => {
  assert.deepEqual(rendererEntry({env: {}, deskDir: DESK, exists: () => true}), {kind: 'file', file: path.join(DESK, 'index.html')});
});

test('npm run dev usa o servidor do electron-vite', () => {
  const env = {NODE_ENV_ELECTRON_VITE: 'development', ELECTRON_RENDERER_URL: 'http://localhost:5173'};
  assert.deepEqual(rendererEntry({env, deskDir: DESK}), {kind: 'url', url: 'http://localhost:5173'});
});

test('URL de dev fora do localhost não é carregada', () => {
  const env = {NODE_ENV_ELECTRON_VITE: 'development', ELECTRON_RENDERER_URL: 'https://example.com'};
  assert.equal(rendererEntry({env, deskDir: DESK}).kind, 'file');
});

test('npm run preview usa out/renderer só quando o build existe', () => {
  const env = {NODE_ENV_ELECTRON_VITE: 'production'};
  assert.deepEqual(rendererEntry({env, deskDir: DESK, exists: (file) => file === BUILT}), {kind: 'file', file: BUILT});
  assert.deepEqual(rendererEntry({env, deskDir: DESK, exists: () => false}), {kind: 'file', file: path.join(DESK, 'index.html')});
});

test('loadRenderer chama loadURL ou loadFile conforme a escolha', async () => {
  const calls = [];
  const win = {loadURL: async (url) => calls.push(['url', url]), loadFile: async (file) => calls.push(['file', file])};
  await loadRenderer(win, {kind: 'url', url: 'http://localhost:5173'});
  await loadRenderer(win, {kind: 'file', file: BUILT});
  assert.deepEqual(calls, [['url', 'http://localhost:5173'], ['file', BUILT]]);
});
