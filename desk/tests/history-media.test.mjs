// Mídia do histórico no renderer (#121): observer → pedido → pintura, o
// cancelamento na troca de conversa e a falha visível com "tentar de novo".
import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';

installDom();
const {createHistoryMediaLoader, historyMediaMarker, historyMediaId} = await import('../src/history-media.mjs');
const {markupKey} = await import('../src/history-render-cache.mjs');

const ID = `hm-${'a'.repeat(32)}`;
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

class FakeIntersectionObserver {
  static instances = [];
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.targets = new Set();
    FakeIntersectionObserver.instances.push(this);
  }
  observe(target) { this.targets.add(target); }
  unobserve(target) { this.targets.delete(target); }
  disconnect() { this.targets.clear(); }
  fire(target) { this.callback([{target, isIntersecting: true}]); }
}

function fakeElement(tag = 'div') {
  const el = {
    tagName: String(tag).toUpperCase(),
    dataset: {},
    className: '',
    children: [],
    listeners: {},
    isConnected: true,
    style: {},
    classList: {add() {}, remove() {}},
    append(...kids) { el.children.push(...kids); },
    prepend(...kids) { el.children.unshift(...kids); },
    replaceChildren(...kids) { el.children = kids; },
    addEventListener(type, listener) { (el.listeners[type] ||= []).push(listener); },
    click() { for (const listener of el.listeners.click || []) listener(); },
    setAttribute(name, value) { el[name] = String(value); },
    getAttribute(name) { return name in el ? el[name] : null; },
    replaceWith(node) { el.replaced = node; el.isConnected = false; },
    remove() { el.removed = true; el.isConnected = false; },
  };
  return el;
}

function placeholder(id = ID) {
  const el = fakeElement('span');
  el.dataset = {historyMediaId: id, historyMediaState: 'pending'};
  el['aria-label'] = 'Imagem da conversa';
  return el;
}

function rootOf(elements) {
  return {querySelectorAll: () => elements};
}

function loaderWith(read, extra = {}) {
  const calls = [];
  const loader = createHistoryMediaLoader({
    read: (id) => { calls.push(id); return read(id); },
    wrap: (img) => img,
    observeClass: FakeIntersectionObserver,
    translate: (key) => key,
    createElement: fakeElement,
    ...extra,
  });
  return {loader, calls};
}

test('historyMediaMarker lê id e dimensões, e a URL muda a chave do cache de HTML', () => {
  const url = `mesa-history-media:${ID}?b=12&m=image%2Fpng&w=640&h=480`;
  assert.deepEqual(historyMediaMarker(url), {id: ID, bytes: 12, mime: 'image/png', width: 640, height: 480});
  assert.equal(historyMediaId(ID), ID);
  assert.equal(historyMediaId('hm-curto'), null);
  assert.notEqual(markupKey({text: 'x', images: []}), markupKey({text: 'x', images: [url]}),
    'o marcador entra na chave do cache (#120): imagem vazia não é o final');
  assert.equal(markupKey({text: 'x', images: [url]}), markupKey({text: 'x', images: [url]}),
    'a mesma URL mantém a chave ao reabrir');
});

test('observer → pedido → pintura: o espaço vira img com o data URL', async () => {
  const el = placeholder();
  const {loader, calls} = loaderWith(async () => ({kind: 'image', dataUrl: 'data:image/png;base64,QUJD'}));
  loader.arm(rootOf([el]), 1);
  const observer = FakeIntersectionObserver.instances.at(-1);
  assert.equal(observer.targets.has(el), true, 'a bolha perto da vista é observada');
  observer.fire(el);
  await tick();
  assert.deepEqual(calls, [ID]);
  assert.equal(el.replaced?.tagName, 'IMG');
  assert.equal(el.replaced?.src, 'data:image/png;base64,QUJD');
  assert.equal(el.replaced?.alt, 'Imagem da conversa');
});

test('sem IntersectionObserver a mídia carrega direto (nunca fica vazia para sempre)', async () => {
  const el = placeholder();
  const {loader} = loaderWith(async () => ({kind: 'image', dataUrl: 'data:image/png;base64,QUJD'}), {observeClass: null});
  loader.arm(rootOf([el]), 1);
  await tick();
  assert.equal(el.replaced?.tagName, 'IMG');
});

test('trocar de conversa cancela: resposta atrasada não pinta no lote novo', async () => {
  const el = placeholder();
  let resolveRead;
  const {loader} = loaderWith(() => new Promise((resolve) => { resolveRead = resolve; }));
  loader.arm(rootOf([el]), 1);
  FakeIntersectionObserver.instances.at(-1).fire(el);
  await tick();
  loader.cancel();
  resolveRead({kind: 'image', dataUrl: 'data:image/png;base64,QUJD'});
  await tick();
  assert.equal(el.replaced, undefined, 'a resposta da conversa antiga é descartada');
});

test('falha mostra texto e tentar de novo; o retry pinta quando o main responde', async () => {
  const el = placeholder();
  let attempt = 0;
  const {loader, calls} = loaderWith(async () => {
    attempt += 1;
    if (attempt === 1) throw Error('IPC caiu');
    return {kind: 'image', dataUrl: 'data:image/png;base64,QUJD'};
  });
  loader.arm(rootOf([el]), 1);
  FakeIntersectionObserver.instances.at(-1).fire(el);
  await tick();
  assert.equal(el.dataset.historyMediaState, 'failed');
  assert.ok(el.children.some((node) => node.textContent === 'history.media.imageFailed'));
  const retry = el.children.find((node) => node.tagName === 'BUTTON');
  assert.equal(retry.textContent, 'activity.retry');
  retry.click();
  await tick();
  assert.deepEqual(calls, [ID, ID]);
  assert.equal(el.replaced?.src, 'data:image/png;base64,QUJD');
});

function outputRow() {
  const row = fakeElement('div');
  const detail = fakeElement('div');
  const pre = fakeElement('pre');
  detail.className = 'step-detail';
  pre.className = 'step-text';
  pre.hidden = true;
  detail.append = (...kids) => {
    detail.children.push(...kids);
    for (const kid of kids) if (kid.className === 'step-output') detail.outputBox = kid;
  };
  row.dataset.historyMediaOutput = ID;
  row.querySelector = (selector) => {
    if (selector === '.step-detail') return detail;
    if (selector === '.step-detail .step-text') return pre;
    if (selector === '.step-output') return detail.outputBox || null;
    return null;
  };
  return {row, detail, pre};
}

test('saída longa do histórico só é pedida ao clicar em Ver saída', async () => {
  const {row, detail, pre} = outputRow();
  const text = 'resultado completo\n'.repeat(4);
  const {loader, calls} = loaderWith(async () => ({kind: 'tool-output', text}));
  const scope = {querySelectorAll: (selector) => selector === '[data-history-media-output]' ? [row] : []};
  loader.decorate(scope);
  const box = detail.children.at(-1);
  assert.equal(box.className, 'step-output');
  assert.equal(box.children[0].textContent, 'history.media.showOutput');
  assert.deepEqual(calls, [], 'o clique é o que dispara o pedido');
  box.children[0].click();
  await tick();
  assert.deepEqual(calls, [ID]);
  assert.equal(pre.textContent, text);
  assert.equal(pre.hidden, false);
  assert.equal(row.dataset.historyMediaLoaded, '1');
  assert.equal(box.removed, true);
});

test('resposta com forma errada falha visível em vez de pintar imagem quebrada', async () => {
  const el = placeholder();
  const {loader} = loaderWith(async () => ({kind: 'image', dataUrl: 'nao-e-data-url'}));
  loader.arm(rootOf([el]), 1);
  FakeIntersectionObserver.instances.at(-1).fire(el);
  await tick();
  assert.equal(el.dataset.historyMediaState, 'failed');
  assert.equal(el.replaced, undefined);
});
