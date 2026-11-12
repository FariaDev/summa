/* Sonda do applet (#147): a revisão da #118 suspeitou, sem prova, de duas
   cadeias de polling depois de reabrir a aba. A causa era `stopGgbWatch` só
   cancelar o timer pendente: a sonda já em voo (`executeJavaScript`) voltava a
   agendar quando o `ggbVisible` virava true de novo, e cada reabertura somava
   uma cadeia. A época da sonda invalida a cadeia antiga. O Electron é o falso
   com nome (`fake-ggb-electron.cjs`), com a sonda presa até o teste liberar,
   como o IPC real, que não responde no mesmo tick. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pollUntil} from './waits.mjs';
import {createI18n} from '../src/i18n.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

const require = createRequire(import.meta.url);
const {createGeogebraHost} = require('../geogebra-host.cjs');
const {FakeGgbApplet} = require('./fixtures/fake-ggb-applet.cjs');
const {createFakeViewClass, createFakeWindow, createFakeIpcMain} = require('./fixtures/fake-ggb-electron.cjs');

const ptTutor = (key, args) => createI18n({catalogs: {'pt-BR': ptBR, en}, language: 'pt-BR'}).t(key, args);
const RECT = {x: 10, y: 40, width: 600, height: 400};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup() {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'ggb-poll-'));
  const applet = new FakeGgbApplet();
  const readyFlag = {value: false};
  const ipcMain = createFakeIpcMain();
  const state = {ggbBase64: ''};
  const window = createFakeWindow(() => {});
  const ViewClass = createFakeViewClass(applet, readyFlag, {gateProbes: true});
  const host = createGeogebraHost({
    WebContentsView: ViewClass, win: () => window, deskState: () => state, courseKey: () => 'Calc',
    persist() {}, runtime, deskDir: runtime, appendLog() {}, tutorT: ptTutor, ggbPage: '/ggb-falso.html',
    openDeadlineMs: 60000, openExternal: () => {}, confirmExternal: () => false,
  });
  host.register(ipcMain);
  const contents = () => ViewClass.instances[0]?.webContents;
  const pending = () => contents()?.pendingProbes.length ?? 0;
  const cleanup = () => { host.close(); fs.rmSync(runtime, {recursive: true, force: true}); };
  return {applet, readyFlag, ipcMain, state, window, host, runtime, cleanup, ViewClass, contents, pending};
}

/* Uma sonda por cadeia fica em voo; libera todas (o applet segue "carregando")
   e espera cada cadeia disparar o próximo poll (50 ms). O que sobra pendente é
   o número de chamadas do polling no ciclo — uma por cadeia. */
async function probesPerCycle(ctx) {
  for (let released = ctx.contents()?.releaseProbe(); released; released = ctx.contents()?.releaseProbe()) await tick();
  await pollUntil(() => ctx.pending(), (count) => count > 0, {timeout: 5000, what: 'o próximo poll de cada cadeia'});
  await sleep(20); // espera fixa: as cadeias agendam o poll no mesmo ciclo; folga para as demais
  return ctx.pending();
}

async function reopen(ctx) {
  await ctx.ipcMain.invoke('ggb-view', {visible: false});
  await ctx.ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  await sleep(20);
}

test('reabrir a aba 3 vezes não soma cadeias de polling (#147)', async (t) => {
  const ctx = setup();
  t.after(ctx.cleanup);
  await ctx.ipcMain.invoke('ggb-view', {visible: true, rect: RECT});
  await sleep(30); // espera fixa: o `did-finish-load` do fake chega em 5 ms
  const before = await probesPerCycle(ctx);
  for (let round = 0; round < 3; round += 1) await reopen(ctx);
  const after = await probesPerCycle(ctx);
  assert.equal(after, before, `reabrir 3 vezes não muda as sondas por ciclo (antes ${before}, depois ${after})`);
  assert.equal(after, 1, 'uma cadeia só: uma sonda por ciclo de 50 ms');
});
