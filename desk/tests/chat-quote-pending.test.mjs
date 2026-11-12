/* Citar uma fórmula que o KaTeX ainda não desenhou (#desempenho): o marcador
   `.math-loading` leva o `data-tex` da fonte e a citação o usa no lugar do nó
   vazio. DOM mínimo do `dom-shim` + seleção/ranges falsos com nome. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {installDom} from './dom-shim.mjs';

installDom();
globalThis.document.createTextNode = (text) => ({nodeType: 3, nodeValue: String(text)});
const {messageQuote} = await import('../src/chat-quote.mjs');

function pendingMarker(tex) {
  return {
    nodeType: 1,
    getAttribute: (name) => (name === 'data-tex' ? tex : null),
    querySelector: (selector) => (selector === '[data-tex]' ? {getAttribute: () => tex} : null),
    closest: () => null,
    replaceWith() {},
  };
}

function fragmentWith(children, texFinders = {}) {
  return {
    nodeType: 11,
    childNodes: [...children],
    querySelectorAll(selector) {
      return texFinders[selector] ? texFinders[selector](this.childNodes) : [];
    },
  };
}

function selectionOf(container, fragment) {
  const range = {
    commonAncestorContainer: container,
    startContainer: container,
    endContainer: container,
    cloneContents: () => fragment,
  };
  return {getRangeAt: () => range, isCollapsed: false, rangeCount: 1, toString: () => ''};
}

const hostInsideMessages = {
  nodeType: 1,
  closest: (selector) => (selector === '#messages' ? hostInsideMessages : null),
};

test('fórmula inline pendente é citada pela fonte $…$', () => {
  const marker = pendingMarker('$d$');
  const fragment = fragmentWith([marker], {
    '.math-loading[data-tex]': (children) => children.filter((node) => node === marker),
  });
  marker.replaceWith = (node) => { fragment.childNodes = fragment.childNodes.map((child) => (child === marker ? node : child)); };
  assert.equal(messageQuote(selectionOf(hostInsideMessages, fragment)), '$d$');
});

test('seleção só da fórmula inline pendente vira a fonte', () => {
  const marker = pendingMarker('$d$');
  marker.closest = (selector) => (selector === '.math-loading' ? marker : (selector === '#messages' ? hostInsideMessages : null));
  assert.equal(messageQuote(selectionOf(marker, fragmentWith([]))), '$d$');
});

test('fórmula de bloco pendente é citada entre linhas pela fonte $$…$$', () => {
  const marker = pendingMarker('$$d$$');
  const display = {
    nodeType: 1,
    getAttribute: () => null,
    querySelector: () => marker,
    closest: (selector) => (selector === '.katex-display' ? display : null),
    replaceWith(node) { fragment.childNodes = fragment.childNodes.map((child) => (child === display ? node : child)); },
  };
  const fragment = fragmentWith([display], {'.katex-display': () => [display]});
  assert.equal(messageQuote(selectionOf(hostInsideMessages, fragment)).trim(), '$$d$$');
});
