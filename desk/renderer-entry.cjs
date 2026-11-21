// @ts-check
'use strict';

const path = require('node:path');
const fs = require('node:fs');

/* De onde a janela principal carrega o renderer (#125). O padrão segue
   sendo o código-fonte (`index.html`): zip de release, update e bundle rodam
   `electron .` sem build. O electron-vite só entra quando foi ele que abriu o
   app: `npm run dev` (servidor com HMR, ELECTRON_RENDERER_URL) ou
   `npm run preview` (build em `out/renderer/`). */
const BUILT_INDEX = path.join('out', 'renderer', 'index.html');

/**
 * Escolhe a URL do servidor de dev, o build ou o fonte.
 * @param {{env: Record<string, string|undefined>, deskDir: string, exists?: (file: string) => boolean}} input
 * @returns {{kind: 'url', url: string} | {kind: 'file', file: string}}
 * @example rendererEntry({env: {}, deskDir: '/app/desk'}) // {kind: 'file', file: '/app/desk/index.html'}
 */
function rendererEntry({env, deskDir, exists = fs.existsSync}) {
  const mode = env.NODE_ENV_ELECTRON_VITE;
  const url = String(env.ELECTRON_RENDERER_URL || '');
  if (mode === 'development' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url)) return {kind: 'url', url};
  const built = path.join(deskDir, BUILT_INDEX);
  if (mode === 'production' && exists(built)) return {kind: 'file', file: built};
  return {kind: 'file', file: path.join(deskDir, 'index.html')};
}

/**
 * Carrega o renderer escolhido em `rendererEntry` na janela.
 * @param {{loadURL: (url: string) => Promise<unknown>, loadFile: (file: string) => Promise<unknown>}} win
 * @param {{kind: 'url', url: string} | {kind: 'file', file: string}} entry
 * @returns {Promise<unknown>}
 * @example loadRenderer(win, rendererEntry({env: process.env, deskDir: __dirname}));
 */
function loadRenderer(win, entry) {
  return entry.kind === 'url' ? win.loadURL(entry.url) : win.loadFile(entry.file);
}

module.exports = {BUILT_INDEX, rendererEntry, loadRenderer};
