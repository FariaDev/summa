'use strict';

/* Cenário Electron do KaTeX sob demanda (#desempenho): o desenho antes do
   import vira marcador vazio; o import troca por `.katex` idêntico ao desenho
   direto; a falha mostra o TeX cru com `data-tex` (uma linha de log) e a
   próxima tentativa hidrata; marcador inserido depois do import é hidratado
   pelo subtree. Precisa de DOM de verdade (DOMPurify); roda numa janela
   escondida. As asserções ficam em katex-loader.test.mjs.

   Roda: DISPLAY=:0 desk/node_modules/.bin/electron desk/tests/katex-loader-scenarios.cjs */

const {app, BrowserWindow} = require('electron');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {writeResultAndExit} = require('./fixtures/result-channel.cjs');

const DESK = path.resolve(__dirname, '..');
const url = (relative) => pathToFileURL(path.join(DESK, relative)).href;
const PAGE = path.join(DESK, 'tests', 'figures-page.html');
const MARKDOWN = url('src/markdown.mjs');
const KATEX = url('node_modules/katex/dist/katex.mjs');

app.on('window-all-closed', () => {});

async function inWindow(body) {
  const win = new BrowserWindow({show: false, webPreferences: {sandbox: true, contextIsolation: true}});
  try {
    await win.loadFile(PAGE);
    return await win.webContents.executeJavaScript(`(async () => {
      const markdownUrl = ${JSON.stringify(MARKDOWN)};
      const katexUrl = ${JSON.stringify(KATEX)};
      ${body}
    })()`);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

async function pendingThenHydrated() {
  return inWindow(`
    const {markup, ensureMath} = await import(markdownUrl);
    const text = 'Antes $x+1$ e depois $$y^2$$ fim';
    const pending = markup(text, true);
    const host = document.createElement('div');
    host.innerHTML = pending;
    document.body.append(host);
    const before = {
      markers: host.querySelectorAll('.math-loading[data-math-tex]').length,
      katex: host.querySelectorAll('.katex').length,
      dataTex: [...host.querySelectorAll('.math-loading')].map((el) => el.getAttribute('data-tex')),
      text: host.textContent,
    };
    await ensureMath();
    const after = {
      markers: host.querySelectorAll('.math-loading').length,
      katex: host.querySelectorAll('.katex').length,
      html: host.innerHTML,
    };
    return {before, after, direct: markup(text, true)};
  `);
}

async function failureFallsBack() {
  return inWindow(`
    window.__logs = [];
    window.desk = {logError: (line) => { window.__logs.push(String(line)); return Promise.resolve(); }};
    const {markup, ensureMath} = await import(markdownUrl);
    let rejectImport;
    const attempt = ensureMath(() => new Promise((_resolve, reject) => { rejectImport = reject; }));
    const host = document.createElement('div');
    host.innerHTML = markup('Falha $a$ e $$b$$ fim', true);
    document.body.append(host);
    rejectImport(new Error('katex indisponível'));
    await attempt;
    const failed = {
      texts: [...host.querySelectorAll('.math-loading')].map((el) => el.textContent),
      dataTex: [...host.querySelectorAll('.math-loading')].map((el) => el.getAttribute('data-tex')),
      katex: host.querySelectorAll('.katex').length,
      logs: window.__logs.slice(),
    };
    await ensureMath(() => import(katexUrl));
    const retried = {
      katex: host.querySelectorAll('.katex').length,
      markers: host.querySelectorAll('.math-loading').length,
      raw: host.textContent.includes('$a$') || host.textContent.includes('$$b$$'),
    };
    return {failed, retried};
  `);
}

async function lateMarkerHydrated() {
  return inWindow(`
    const {markup, ensureMath, hydrateMathIn} = await import(markdownUrl);
    const stale = markup('Tarde $c$ fim', true);
    await ensureMath();
    const host = document.createElement('div');
    host.innerHTML = stale;
    document.body.append(host);
    const before = {markers: host.querySelectorAll('.math-loading').length, katex: host.querySelectorAll('.katex').length};
    hydrateMathIn(host);
    return {
      before,
      after: {markers: host.querySelectorAll('.math-loading').length, katex: host.querySelectorAll('.katex').length, html: host.innerHTML},
      direct: markup('Tarde $c$ fim', true),
    };
  `);
}

/* Cache do histórico (#120) com o KaTeX sob demanda: o HTML com marcador de
   antes do import não entra no cache; depois do import, o mesmo texto desenha
   a fórmula e esse HTML é o que fica guardado. */
async function cachedSkipsPendingMarker() {
  return inWindow(`
    const {markupCached, ensureMath} = await import(markdownUrl);
    const {historyRenderCacheStats} = await import(${JSON.stringify(url('src/history-render-cache.mjs'))});
    const text = 'Guardado $z^3$ fim';
    const pending = markupCached(text, true, []);
    const sizeBefore = historyRenderCacheStats().html.entries;
    await ensureMath();
    const drawn = markupCached(text, true, []);
    const again = markupCached(text, true, []);
    return {
      pendingHasMarker: pending.includes('math-loading'),
      sizeBefore,
      drawnHasKatex: drawn.includes('class="katex'),
      drawnHasMarker: drawn.includes('math-loading'),
      hits: historyRenderCacheStats().html.hits,
      same: again === drawn,
    };
  `);
}

app.whenReady().then(async () => {
  const data = {
    cachedSkipsPendingMarker: await cachedSkipsPendingMarker(),
    pendingThenHydrated: await pendingThenHydrated(),
    failureFallsBack: await failureFallsBack(),
    lateMarkerHydrated: await lateMarkerHydrated(),
  };
  writeResultAndExit(data, (code) => app.exit(code));
}).catch((error) => { console.error(error); app.exit(1); });
