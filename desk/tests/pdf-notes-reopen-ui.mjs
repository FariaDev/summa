import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from '@playwright/test';
import {createRequire} from 'node:module';
import {seedCourse, seedNativeSession, tinyPdf, writeConfigJson, writeDeskJson} from './helpers.mjs';

const require = createRequire(import.meta.url);
const desk = path.resolve(import.meta.dirname, '..');
const output = process.env.NOTES_REOPEN_ARTIFACTS || path.join(desk, '.notes-reopen-artifacts');
fs.mkdirSync(output, {recursive: true});
const runtime = fs.mkdtempSync(path.join(output, 'runtime-'));
const course = seedCourse(runtime, 'synthetic');
const alpha = path.join(course, 'Alpha.pdf');
const beta = path.join(course, 'Beta.pdf');
fs.writeFileSync(alpha, tinyPdf('Alpha: synthetic study material'));
fs.writeFileSync(beta, tinyPdf('Beta: synthetic study material'));
writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, language: {ui: 'en', tutor: 'en'}, courses: [{id: 'synthetic', name: 'Synthetic course', path: course}]});
const session = seedNativeSession(runtime, [], {courseId: 'synthetic'});
writeDeskJson(runtime, {releaseNotesSeen: require('../package.json').version, courseId: 'synthetic', session, courseStates: {synthetic: {session, pdfs: [{path: alpha, page: 1}]}}});
const log = fs.openSync(path.join(runtime, 'electron.log'), 'a');
const app = spawn(require('electron'), ['--remote-debugging-port=0', '.'], {
  cwd: desk,
  env: {...process.env, HOME: runtime, USERPROFILE: runtime, XDG_CONFIG_HOME: path.join(runtime, '.config'), LEARNING_DESK_RUNTIME: runtime, LEARNING_VAULT: runtime},
  stdio: ['ignore', log, 'pipe'],
});
let stderr = '';
const endpoint = await new Promise((resolve, reject) => {
  const portFile = path.join(runtime, 'electron', 'DevToolsActivePort');
  const timer = setTimeout(() => {fs.unwatchFile(portFile); reject(new Error(`CDP startup timed out: ${stderr}`));}, 30000);
  fs.watchFile(portFile, {interval: 100}, () => {
    if (!fs.existsSync(portFile)) return;
    const [port, endpointPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
    if (!endpointPath) return;
    clearTimeout(timer);
    fs.unwatchFile(portFile);
    resolve(`ws://127.0.0.1:${port}${endpointPath}`);
  });
  app.stderr.on('data', chunk => {
    stderr += chunk;
    const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (match) {clearTimeout(timer); fs.unwatchFile(portFile); resolve(match[1]);}
  });
  app.once('exit', code => reject(new Error(`Electron exited ${code}: ${stderr}`)));
});
const browser = await chromium.connectOverCDP(endpoint);
try {
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.waitForEvent('page');
  await page.waitForSelector('.pdf-page[data-rendered] canvas');
  const gotIt = page.getByRole('button', {name: 'Got it', exact: true});
  if (await gotIt.isVisible()) await gotIt.click();
  await page.evaluate(async () => {const {applyTheme} = await import('./src/state.mjs'); applyTheme('light');});
  const open = async () => {
    await page.locator('#study-menu .nav-trigger').click();
    await page.locator('#study-menu #study-notes-open').click();
    await page.waitForFunction(() => {const dialog = document.querySelector('#study-notes-dialog'); return dialog?.open && getComputedStyle(dialog).opacity === '1';});
  };
  await open();
  await page.locator('#study-note-note').fill('This note belongs to Alpha.');
  await page.locator('#study-note-save').click();
  await page.locator('.study-note-card').waitFor();
  await page.locator('#study-notes-close').click();
  await page.locator('.pdf-select').first().selectOption(beta);
  await open();
  await page.locator('.study-note-actions button').first().click();
  await page.locator('#study-note-note').fill('Alpha note edited after reopening.');
  const snapshot = () => page.evaluate(() => ({
    target: {...document.querySelector('#study-note-quote').dataset},
    page: document.querySelector('#study-note-page').value,
    note: document.querySelector('#study-note-note').value,
    status: document.querySelector('#study-notes-status').textContent,
  }));
  const editing = await snapshot();
  await page.locator('#study-notes-close').click();
  await open();
  const reopened = await snapshot();
  await page.locator('#study-note-save').click();
  await page.waitForFunction(() => document.querySelector('.study-note-card')?.textContent.includes('Alpha note edited after reopening.'));
  const items = await page.evaluate(async () => (await window.desk.studyNotesRead({})).items);
  const label = process.env.NOTES_REOPEN_LABEL || 'after';
  await page.screenshot({path: path.join(output, `${label}.png`)});
  fs.writeFileSync(path.join(output, `${label}-state.json`), JSON.stringify({editing, reopened, items}, null, 2));
  assert.equal(items.length, 1);
  assert.equal(items[0].ref.path, alpha, 'reopening an edit must not move the note to the current reader');
  assert.deepEqual(reopened.target, editing.target);
  assert.equal(items[0].note, 'Alpha note edited after reopening.');
  console.log('PASS: close/reopen preserves the edited note and its Alpha.pdf reference while reading Beta.pdf');
} finally {
  await browser.close();
  const exited = once(app, 'exit');
  app.kill('SIGKILL');
  await exited;
  fs.closeSync(log);
}
