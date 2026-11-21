import assert from 'node:assert/strict';
import test from 'node:test';
import {inkReasonKey, initInkSettings, mountInkSettings} from '../src/settings/settings-ink.mjs';

/* Interruptor da escrita à mão nas Configurações (ponte com o Ambitus): vale na
   hora, e a recusa do main (modelo sem visão, gratuito, motor Claude) volta a
   caixa e diz o motivo na linha de erro. */

function fakeDoc() {
  /** @type {Record<string, Function>} */
  const listeners = {};
  const box = {checked: false, disabled: false, addEventListener: (name, fn) => { listeners[name] = fn; }};
  const error = {textContent: '', hidden: true};
  const doc = /** @type {any} */ ({querySelector: (sel) => ({'#cfg-ambitus-ink': box, '#ambitus-ink-error': error})[sel] || null});
  return {doc, box, error, change: () => listeners.change()};
}

test('cada motivo de recusa tem o seu aviso', () => {
  assert.equal(inkReasonKey('claude-unavailable'), 'settings.ambitusInk.claude');
  assert.equal(inkReasonKey('no-vision'), 'settings.ambitusInk.noVision');
  assert.equal(inkReasonKey('free'), 'settings.ambitusInk.noVision');
  assert.equal(inkReasonKey('no-model'), 'settings.ambitusInk.noModel');
  assert.equal(inkReasonKey('outro'), 'settings.ambitusInk.failed');
  assert.equal(inkReasonKey(undefined), 'settings.ambitusInk.failed');
});

test('ligar aceito fica ligado e sem erro', async () => {
  const f = fakeDoc();
  /** @type {any[]} */
  const sent = [];
  initInkSettings({status: async () => ({enabled: false, reason: null}), set: async (p) => { sent.push(p); return {ok: true}; }}, f.doc);
  f.box.checked = true;
  await f.change();
  assert.deepEqual(sent, [{on: true}]);
  assert.equal(f.box.checked, true);
  assert.equal(f.box.disabled, false);
  assert.equal(f.error.hidden, true);
});

test('ligar recusado volta a caixa e mostra o motivo', async () => {
  const f = fakeDoc();
  initInkSettings({status: async () => ({enabled: false, reason: null}), set: async () => ({ok: false, reason: 'free'})}, f.doc);
  f.box.checked = true;
  await f.change();
  assert.equal(f.box.checked, false);
  assert.equal(f.error.hidden, false);
  assert.ok(f.error.textContent.length > 0);
});

test('uma falha do main também volta a caixa', async () => {
  const f = fakeDoc();
  initInkSettings({status: async () => ({enabled: true, reason: null}), set: async () => { throw Error('ipc'); }}, f.doc);
  f.box.checked = false;
  await f.change();
  assert.equal(f.box.checked, true);
  assert.equal(f.error.hidden, false);
});

test('abrir as Configurações pinta o estado salvo e o motivo de não ler', async () => {
  const f = fakeDoc();
  const ink = initInkSettings({status: async () => ({enabled: true, reason: 'no-vision'}), set: async () => ({ok: true})}, f.doc);
  await ink.refresh();
  assert.equal(f.box.checked, true);
  assert.equal(f.error.hidden, false);
});

test('o markup entra uma vez só, depois do último grupo de Recursos da mesa', () => {
  /** @type {string[]} */
  const inserted = [];
  let mounted = false;
  const last = {insertAdjacentHTML: (where, html) => { inserted.push(where); mounted = html.includes('cfg-ambitus-ink'); }};
  const section = {querySelectorAll: () => [{}, last], querySelector: () => (mounted ? {} : null)};
  const doc = /** @type {any} */ ({querySelector: () => section});
  assert.equal(mountInkSettings(doc), true);
  assert.equal(mountInkSettings(doc), false);
  assert.deepEqual(inserted, ['afterend']);
});
