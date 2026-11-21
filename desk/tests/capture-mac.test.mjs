import test from 'node:test';
import assert from 'node:assert/strict';
import {ptMatches} from './pt-text.mjs';
import {listWindowsMac} from '../capture-mac.cjs';

function fakeScreenCapture({status = 'denied', grantOnRequest = false, helperPermission = true} = {}) {
  const calls = [];
  const windows = [{id: 10, app: 'TextEdit', title: 'Notas'}];
  async function execFile(_helper, args) {
    calls.push(args);
    if (args.includes('--request-permission')) {
      if (grantOnRequest) status = 'granted';
      return {stdout: ''};
    }
    return {stdout: JSON.stringify({permission: helperPermission, windows})};
  }
  return {calls, windows, deps: {helper: '/visual-check/windows', screenStatus: () => status, execFile}};
}

test('macOS: pede permissão antes de listar, mesmo quando o Electron informa denied na primeira vez', async () => {
  const {calls, windows, deps} = fakeScreenCapture({grantOnRequest: true});
  assert.deepEqual(await listWindowsMac(deps), windows);
  assert.deepEqual(calls, [['--request-permission'], []]);
});

test('macOS: sem autorização, mantém a orientação e não lista janelas', async () => {
  const {calls, deps} = fakeScreenCapture();
  await assert.rejects(listWindowsMac(deps), ptMatches(/Autorize Gravação de Tela/));
  assert.deepEqual(calls, [['--request-permission']]);
});

test('macOS: permissão já concedida não é pedida novamente', async () => {
  const {calls, windows, deps} = fakeScreenCapture({status: 'granted'});
  assert.deepEqual(await listWindowsMac(deps), windows);
  assert.deepEqual(calls, [[]]);
});

test('macOS: o helper também precisa confirmar permissão antes de retornar janelas', async () => {
  const {calls, deps} = fakeScreenCapture({status: 'granted', helperPermission: false});
  await assert.rejects(listWindowsMac(deps), ptMatches(/Autorize Gravação de Tela/));
  assert.deepEqual(calls, [[]]);
});
