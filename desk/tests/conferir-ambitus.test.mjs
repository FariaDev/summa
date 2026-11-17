/* O Conferir pela ponte, no host: com o Ambitus pendurado e nenhum outro
   programa escolhido, `capture-ready` pede a página a ele (nada de janela,
   nem permissão de tela); escolher outro programa, ou o Ambitus desconectado,
   mantém a captura de janela de sempre. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ptText, ptMatches} from './pt-text.mjs';

const require = createRequire(import.meta.url);
const {createConferirHost} = require('../conferir-host.cjs');

const PNG_B64 = 'iVBORw0KGgo=';
const WINDOW_PNG = 'data:image/png;base64,AAAA';

function harness({linked = true, choice = null, platform = 'linux', result = {ok: true, png: PNG_B64, caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites'}} = {}) {
  const calls = {request: 0, list: 0};
  const host = createConferirHost({
    ipcMain: {handle() {}},
    platform,
    state: () => choice,
    setChoice() {},
    listWindows: async () => { calls.list += 1; return [{id: '1', app: 'Xournal++', title: 'Lista', bounds: {Width: 900, Height: 700}}]; },
    captureWindow: async () => ({title: 'Lista', dataUrl: WINDOW_PNG}),
    ambitus: {linked: () => linked, request: async () => { calls.request += 1; return result; }},
  });
  return {host, calls};
}

test('Ambitus conectado e sem escolha: a página vem pela ponte, no Linux também', async () => {
  const {host, calls} = harness();
  const shot = await host.ready();
  assert.deepEqual({...shot, title: ptText(shot.title)}, {
    title: 'Limites — pág. 2',
    dataUrl: `data:image/png;base64,${PNG_B64}`,
    app: 'Ambitus',
    ambitus: {caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites'},
  });
  assert.deepEqual(calls, {request: 1, list: 0}, 'nenhuma janela foi listada');
});

test('caderno sem arquivo: caminho vazio e nome de reserva no título', async () => {
  const {host} = harness({result: {ok: true, png: PNG_B64, caminho: '', pagina: 1, nome: ''}});
  const shot = await host.ready();
  assert.equal(ptText(shot.title), 'Caderno sem título — pág. 1');
  assert.equal(shot.ambitus.caminho, '');
});

test('com outro programa escolhido, o Conferir captura a janela como sempre', async () => {
  const {host, calls} = harness({platform: 'darwin', choice: {app: 'OneNote', key: 'onenote'}});
  // a lista só tem o Xournal++; o app escolhido ausente vira o aviso de "ausente", nunca a ponte
  const shot = await host.ready();
  assert.equal(shot.absent, true);
  assert.equal(calls.request, 0);
});

test('Ambitus desconectado: volta ao comportamento de hoje (captura do Xournal++)', async () => {
  const {host, calls} = harness({linked: false, platform: 'darwin'});
  const shot = await host.ready();
  assert.equal(shot.dataUrl, WINDOW_PNG);
  assert.equal(shot.app, 'Xournal++');
  assert.deepEqual(calls, {request: 0, list: 1});
});

test('Ambitus desconectado no Linux: o erro de plataforma de sempre', async () => {
  const {host} = harness({linked: false});
  await assert.rejects(host.ready(), ptMatches(/macOS e no Windows/));
});

test('sem resposta e sem página viram mensagens diferentes', async () => {
  await assert.rejects(harness({result: {ok: false, reason: 'timeout'}}).host.ready(), ptMatches(/Ambitus não respondeu/));
  await assert.rejects(harness({result: {ok: false, reason: 'not-connected'}}).host.ready(), ptMatches(/Ambitus não respondeu/));
  await assert.rejects(harness({result: {ok: false, reason: 'no-page'}}).host.ready(), ptMatches(/não tem uma página aberta/));
});

test('o recorte que o Ambitus mandou vai no cartão; a página inteira não ganha a chave', async () => {
  const recorte = {x: 0, y: 286, largura: 595, altura: 555};
  const excerpt = harness({result: {ok: true, png: PNG_B64, caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites', recorte}});
  assert.deepEqual((await excerpt.host.ready()).ambitus, {caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites', recorte});
  const whole = harness();
  assert.equal('recorte' in (await whole.host.ready()).ambitus, false);
});
