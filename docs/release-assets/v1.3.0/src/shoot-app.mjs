#!/usr/bin/env node
/* Capturas reais da Summa para o README da 1.3.0 (#21), tiradas pelo mesmo
   harness dos testes de janela: runtime temporário, `fake-opencode` e uma
   matéria de mentira com PDFs inventados por `exercise-pdf.mjs`. Nenhum PDF,
   sessão ou material de curso de ninguém entra aqui. O script roda no macOS
   (não exige DISPLAY) e no Linux com um X virtual; a janela é 1440×900 e o PNG
   sai na escala da tela (1× ou 2×).
   Uso, a partir da raiz do repositório:
     node docs/release-assets/v1.3.0/src/shoot-app.mjs
     node docs/release-assets/v1.3.0/src/shoot-app.mjs --out /pasta/fora/do/repo
   Sem `--out`, grava ao lado do script (`docs/release-assets/v1.3.0/`). Os PNGs
   de uma rodada de prova ficam fora do repositório e não vão para o commit. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {writeSampleMaterials} from './exercise-pdf.mjs';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(SRC, '..', '..', '..', '..', 'desk');
const WIDTH = 1440;
const HEIGHT = 900;

/** A pasta de saída: `--out`, `SUMMA_SHOTS_DIR` ou a pasta da versão. @returns {string} */
function outputDirectory() {
  const flag = process.argv.indexOf('--out');
  if (flag >= 0 && process.argv[flag + 1]) return path.resolve(process.argv[flag + 1]);
  if (process.env.SUMMA_SHOTS_DIR) return path.resolve(process.env.SUMMA_SHOTS_DIR);
  return path.resolve(SRC, '..');
}

const OUT = outputDirectory();
fs.mkdirSync(OUT, {recursive: true});

const helpers = await import(pathToFileURL(path.join(DESK, 'tests', 'helpers.mjs')).href);
const waits = await import(pathToFileURL(path.join(DESK, 'tests', 'waits.mjs')).href);
const {
  withArtifacts, newRuntime, seedCourse, seedNativeSession, writeConfigJson, writeDeskJson,
  launchDesk, statusOnline, setTheme, freezeMotion, resizeWindow, pageWindow,
} = helpers;

const packageJson = JSON.parse(fs.readFileSync(path.join(DESK, 'package.json'), 'utf8'));

/** As mensagens da conversa de exemplo, no idioma da captura. @param {'pt'|'en'} lang @param {string} list caminho da lista @returns {Array<object>} */
function conversationMessages(lang, list) {
  const now = Date.now() - 120_000;
  const toolResult = {
    role: 'toolResult', toolCallId: 'read-1', toolName: 'mesa_ler_pdf', isError: false,
    timestamp: now + 2_200, content: [{type: 'text', text: lang === 'en' ? 'Problem set.' : 'Lista de exercícios.'}],
    details: {},
  };
  if (lang === 'en') {
    return [
      {role: 'user', content: [{type: 'text', text: 'I got f\'(x) = 3x² - 3x for f(x) = x³ - 3x² + 4. Is that right?'}], timestamp: now},
      {role: 'assistant', content: [{type: 'text', text: 'Let me check the problem set and the formula sheet.'}, {type: 'toolCall', id: 'read-1', name: 'mesa_ler_pdf', arguments: {caminho: list, pagina: 1}}], timestamp: now + 1_000, model: 'opencode/deepseek-v4.1-flash-free'},
      toolResult,
      {role: 'assistant', content: [{type: 'text', text: '**Almost.** The first term is right, and the constant really does vanish. Look again at the middle term, $-3x^2$, with the power rule:\n\n$$\\frac{d}{dx}(x^n) = n x^{n-1}$$\n\nThe exponent comes down and **multiplies** the coefficient. What do you get for $-3x^2$ now?'}], timestamp: now + 5_000},
    ];
  }
  return [
    {role: 'user', content: [{type: 'text', text: 'Derivei f(x) = x³ - 3x² + 4 e deu f\'(x) = 3x² - 3x. Está certo?'}], timestamp: now},
    {role: 'assistant', content: [{type: 'text', text: 'Vou conferir a lista e o formulário.'}, {type: 'toolCall', id: 'read-1', name: 'mesa_ler_pdf', arguments: {caminho: list, pagina: 1}}], timestamp: now + 1_000, model: 'opencode/deepseek-v4.1-flash-free'},
    toolResult,
    {role: 'assistant', content: [{type: 'text', text: '**Quase.** O primeiro termo está certo, e a constante some mesmo. Olhe de novo o termo do meio, $-3x^2$, com a regra do tombo:\n\n$$\\frac{d}{dx}(x^n) = n x^{n-1}$$\n\nO expoente desce e **multiplica** o coeficiente. Quanto dá $-3x^2$ agora?'}], timestamp: now + 5_000},
  ];
}

/** Prepara a matéria de mentira, a conversa e o estado do app. @param {string} runtime @param {'pt'|'en'} lang */
function seedRuntime(runtime, lang) {
  const course = seedCourse(runtime, 'calc');
  seedCourse(runtime, 'fisica');
  const {list, formula} = writeSampleMaterials(course, lang);
  const now = Date.now() - 120_000;
  const preview = lang === 'en' ? 'Check the derivative of f(x) = x³ - 3x² + 4' : 'Conferir a derivada de f(x) = x³ - 3x² + 4';
  const messages = conversationMessages(lang, list);
  const session = seedNativeSession(runtime, messages, {courseId: 'calc', started: now, preview, model: 'opencode/deepseek-v4.1-flash-free'});
  writeConfigJson(runtime, {
    runtimePath: runtime,
    vaultPath: runtime,
    courses: [
      {id: 'calc', name: lang === 'en' ? 'Calculus I' : 'Cálculo I', path: course},
      {id: 'fisica', name: lang === 'en' ? 'Physics I' : 'Física I', path: path.join(runtime, 'learning', 'Courses', 'fisica')},
    ],
  });
  writeDeskJson(runtime, {
    courseId: 'calc',
    theme: 'light',
    accent: 'graphite',
    uiLanguage: lang === 'en' ? 'en' : 'pt-BR',
    tutorLanguage: 'follow',
    releaseNotesSeen: packageJson.version,
    session,
    courseStates: {
      calc: {
        session,
        sessions: [{path: session, started: now, preview}],
        pdfs: [{path: list, page: 1}, {path: formula, page: 1}],
        study: {title: '', xopp: ''},
      },
    },
  });
}

/** Abre a Summa, espera o tutor e os dois PDFs pintarem. @param {string} runtime @returns {Promise<import('@playwright/test').ElectronApplication>} */
async function openDesk(runtime) {
  const app = await launchDesk({runtime});
  const page = await app.firstWindow();
  await statusOnline(page, {timeout: 90_000});
  await resizeWindow(app, page, WIDTH, HEIGHT);
  await page.waitForFunction(() => document.querySelectorAll('.pdf-panel canvas').length >= 2, null, {timeout: 30_000});
  await page.waitForFunction(() => document.querySelectorAll('#messages .message').length >= 2, null, {timeout: 30_000});
  await waits.pdfRenderIdle(page);
  await freezeMotion(page);
  return app;
}

/** A escala da tela principal; é o dispositivo que o Chromium usa no PNG. @param {import('@playwright/test').ElectronApplication} app @returns {Promise<number>} */
function screenScale(app) {
  return app.evaluate(({screen}) => Number(screen.getPrimaryDisplay().scaleFactor) || 1);
}

/** Captura com `Page.captureScreenshot` na escala pedida, como a v1.0.0 fazia. @param {*} win @param {string} file @param {number} scale */
async function captureWindow(win, file, scale) {
  const data = await win.evaluate(async (bw, {width, height, scale}) => {
    const dbg = bw.webContents.debugger;
    if (!dbg.isAttached()) dbg.attach('1.3');
    await dbg.sendCommand('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: scale, mobile: false});
    const shot = await dbg.sendCommand('Page.captureScreenshot', {format: 'png', clip: {x: 0, y: 0, width, height, scale: 1}});
    dbg.detach();
    return shot.data;
  }, {width: WIDTH, height: HEIGHT, scale});
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(JSON.stringify({file: path.basename(file), width: WIDTH * scale, height: HEIGHT * scale}));
}

/** Uma rodada de capturas para um idioma. @param {'pt'|'en'} lang */
async function runLanguage(lang) {
  await withArtifacts(`readme-shots-${lang}`, async (ctx) => {
    const runtime = ctx.runtime = newRuntime(`readme-shots-${lang}`);
    seedRuntime(runtime, lang);
    const app = ctx.app = await openDesk(runtime);
    const page = await app.firstWindow();
    page.on('pageerror', (error) => console.error('[pageerror]', error.message));
    const win = await pageWindow(app, page);
    const scale = await screenScale(app);
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await page.evaluate(async (value) => {
        const {applyAccent} = await import('./src/state.mjs');
        applyAccent(value === 'dark' ? 'violet' : 'graphite');
      }, theme);
      await waits.nextFrames(page, 3);
      await waits.layoutStable(page, '#chat');
      await captureWindow(win, path.join(OUT, `app-${theme === 'light' ? 'claro' : 'escuro'}-${lang}.png`), scale);
    }
  });
}

await runLanguage('pt');
await runLanguage('en');
console.log(`Capturas em ${OUT}`);
