'use strict';

/* Cenário Electron do KaTeX nos cartões (regressão do quiz-edge): montar um
   card de quiz já pede o import, para a explicação escondida com fórmula
   aparecer desenhada quando o aluno responde; a resposta pintada antes de o
   import chegar é hidratada na chegada, sem depender do observador de 2 s.
   Precisa de DOM de verdade (DOMPurify); roda numa janela escondida. As
   asserções ficam em cards-math.test.mjs.

   Roda: DISPLAY=:0 desk/node_modules/.bin/electron desk/tests/cards-math-scenarios.cjs */

const {app, BrowserWindow} = require('electron');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {writeResultAndExit} = require('./fixtures/result-channel.cjs');

const DESK = path.resolve(__dirname, '..');
const url = (relative) => pathToFileURL(path.join(DESK, relative)).href;
const PAGE = path.join(DESK, 'tests', 'figures-page.html');
const MARKDOWN = url('src/markdown.mjs');
const CARDS = url('src/cards-view.mjs');
const KATEX = url('node_modules/katex/dist/katex.mjs');

app.on('window-all-closed', () => {});

async function inWindow(body) {
  const win = new BrowserWindow({show: false, webPreferences: {sandbox: true, contextIsolation: true}});
  try {
    await win.loadFile(PAGE);
    return await win.webContents.executeJavaScript(`(async () => {
      const markdownUrl = ${JSON.stringify(MARKDOWN)};
      const cardsUrl = ${JSON.stringify(CARDS)};
      const katexUrl = ${JSON.stringify(KATEX)};
      ${body}
    })()`);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

/* Quiz sem fórmula no texto visível: a explicação `$2$` só chega na resposta. */
const FIXTURE = `
  const pending = {
    id: 'card-1', kind: 'quiz', createdAt: 1, answered: false, correct: false,
    dismissed: false, sendState: 'notSent', sendError: '', answer: {}, draft: {},
    question: 'Quanto é 1+1?', details: '', note: '', multiSelect: false,
    options: [{label: '1'}, {label: '2'}],
  };
  const answered = {
    ...pending, answered: true, correctIndices: [2], answer: {selected: [1]},
    explanation: 'A resposta é $2$.',
  };
  const api = {
    answer: async () => answered, draft: async () => pending,
    dismiss: async () => pending, conclude: async () => pending,
  };
`;

async function preloadOnMount() {
  return inWindow(`
    ${FIXTURE}
    const {ensureMath} = await import(markdownUrl);
    const {cardElement} = await import(cardsUrl);
    const article = cardElement(pending, api);
    document.body.append(article);
    const beforeAnswer = {explanation: article.querySelector('.quiz-explain') !== null};
    let fakeCalls = 0;
    await ensureMath(() => { fakeCalls += 1; return import(katexUrl); });
    article._update(answered);
    return {
      beforeAnswer,
      fakeCalls,
      afterAnswer: {
        katex: article.querySelectorAll('.quiz-explain .katex').length,
        markers: article.querySelectorAll('.quiz-explain .math-loading').length,
      },
    };
  `);
}

async function answerWhileMathLoads() {
  return inWindow(`
    window.MutationObserver = undefined;
    ${FIXTURE}
    const {ensureMath} = await import(markdownUrl);
    let releaseImport;
    const loading = ensureMath(() => new Promise((resolve) => { releaseImport = resolve; }));
    const {cardElement} = await import(cardsUrl);
    const article = cardElement(pending, api);
    document.body.append(article);
    const beforeAnswer = {explanation: article.querySelector('.quiz-explain') !== null};
    article._update(answered);
    const beforeArrival = {
      katex: article.querySelectorAll('.quiz-explain .katex').length,
      markers: article.querySelectorAll('.quiz-explain .math-loading').length,
    };
    releaseImport(await import(katexUrl));
    await loading;
    return {
      beforeAnswer,
      beforeArrival,
      afterArrival: {
        katex: article.querySelectorAll('.quiz-explain .katex').length,
        markers: article.querySelectorAll('.quiz-explain .math-loading').length,
      },
    };
  `);
}

app.whenReady().then(async () => {
  const data = {
    preloadOnMount: await preloadOnMount(),
    answerWhileMathLoads: await answerWhileMathLoads(),
  };
  writeResultAndExit(data, (code) => app.exit(code));
}).catch((error) => { console.error(error); app.exit(1); });
