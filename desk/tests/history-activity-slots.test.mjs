/* Recuperação do slot de atividade que só existe no store (H4, 2ª rodada):
   decisão de posição pelo `createdAt`, sem duplicar quem já tem slot por passo
   de ferramenta e sem quebrar quando a lista chega depois de outra abertura. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {activityItemsWithoutSlot, activityTurnIndex, recoverActivitySlots} from '../src/history-activity-slots.mjs';

const slot = (toolCallId, version = 1, createdAt = 0) => ({toolCallId, version, createdAt});

/* DOM mínimo: o que `recoverActivitySlots` usa (append/after/contains/querySelector). */
function fakeNode() {
  return {
    children: [],
    parent: null,
    dataset: {},
    isConnected: true,
    className: '',
    set classNameValue(value) { this.className = value; },
    get nextElementSibling() {
      const siblings = this.parent ? this.parent.children : [];
      const at = siblings.indexOf(this);
      return at >= 0 ? siblings[at + 1] || null : null;
    },
    append(child) {
      child.parent = this;
      child.isConnected = true;
      this.children.push(child);
      return child;
    },
    after(node) {
      const siblings = this.parent ? this.parent.children : [];
      const at = siblings.indexOf(this);
      node.parent = this.parent;
      node.isConnected = true;
      siblings.splice(at + 1, 0, node);
    },
    classList: {
      contains() { return false; },
    },
    contains(node) {
      for (let current = node; current; current = current.parent) if (current === this) return true;
      return false;
    },
    querySelector() { return null; },
  };
}

function fakeRoot() {
  const root = fakeNode();
  root.classList = {contains: () => false};
  root.querySelector = (selector) => {
    const match = /^\.activity-slot\[data-activity-call="(.*)"\]$/.exec(String(selector));
    if (!match) return null;
    const wanted = match[1];
    const walk = (node) => {
      for (const child of node.children) {
        if (child.className === 'activity-slot' && child.dataset.activityCall === wanted) return child;
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(root);
  };
  return root;
}

/* O `className` do slot é escrito direto (`slot.className='activity-slot'`). */
function newDoc() {
  return {
    createElement() {
      const node = fakeNode();
      node.classList = {contains: (name) => name === node.className};
      return node;
    },
  };
}

test('activityItemsWithoutSlot: pula quem já tem slot, deduplica por chamada e ordena por createdAt', () => {
  const items = [
    slot('previa:prv-b', 1, 200),
    slot('call-1', 1, 100),
    slot('previa:prv-b', 2, 200),
    slot('previa:prv-a', 1, 300),
    slot('', 1, 50),
  ];
  const missing = activityItemsWithoutSlot(items, (id) => id === 'call-1');
  assert.deepEqual(missing.map((item) => [item.toolCallId, item.version]), [['previa:prv-b', 2], ['previa:prv-a', 1]]);
});

test('activityItemsWithoutSlot: id de passo comum sem slot não volta (turno cortado ou refeito)', () => {
  const missing = activityItemsWithoutSlot([slot('toolu_123', 1, 100), slot('opencode-mcp:abc', 1, 200)], () => false);
  assert.deepEqual(missing.map((item) => item.toolCallId), ['opencode-mcp:abc']);
});

test('recoverActivitySlots: quadro de antes do primeiro turno (histórico cortado) não vai para o fim', async () => {
  const root = fakeRoot();
  const tail = root.append(fakeNode());
  const placed = await recoverActivitySlots({root, ranges: [{start: 1000, tail}],
    list: async () => [{toolCallId: 'previa:prv-velho', version: 1, createdAt: 10}], doc: newDoc()});
  assert.deepEqual(placed, []);
});

test('activityTurnIndex: escolhe o último turno que já tinha começado; sem carimbo, -1', () => {
  const ranges = [{start: 100}, {start: 0}, {start: 200}];
  assert.equal(activityTurnIndex(ranges, 250), 2);
  assert.equal(activityTurnIndex(ranges, 150), 0);
  assert.equal(activityTurnIndex(ranges, 50), -1);
  assert.equal(activityTurnIndex(ranges, 0), -1);
  assert.equal(activityTurnIndex([{start: 0}], 250), -1);
});

test('recoverActivitySlots: insere depois da fala do turno, no fim sem carimbo, uma vez só', async () => {
  const doc = newDoc();
  const root = fakeRoot();
  const firstSpeech = root.append(fakeNode());
  const secondSpeech = root.append(fakeNode());
  const dispatched = [];
  const ranges = [{start: 100, tail: firstSpeech}, {start: 200, tail: secondSpeech}];
  const result = await recoverActivitySlots({
    root,
    ranges,
    doc,
    list: async () => ({items: [slot('previa:prv-2', 1, 250), slot('previa:prv-1', 1, 0)]}),
    dispatch: (detail) => dispatched.push(detail.toolCallId),
  });
  assert.deepEqual(result.map((entry) => entry.toolCallId), ['previa:prv-1', 'previa:prv-2']);
  assert.deepEqual(dispatched, ['previa:prv-1', 'previa:prv-2'], 'o renderer de atividades é avisado de cada slot');
  const order = root.children.map((node) => node.dataset.activityCall || (node === firstSpeech ? 'fala-1' : 'fala-2'));
  assert.deepEqual(order, ['fala-1', 'fala-2', 'previa:prv-1', 'previa:prv-2'], 'carimbo desconhecido vai para o fim, depois do turno com carimbo');
  assert.equal(root.children.at(-2).dataset.status, 'done', 'o quadro recuperado já é publicação terminada');

  const again = await recoverActivitySlots({root, ranges, doc, list: async () => ({items: [slot('previa:prv-1', 1, 0)]})});
  assert.deepEqual(again, [], 'quem já tem slot não ganha segundo');
});

test('recoverActivitySlots: o id de fallback do OpenCode usa a mesma recuperação', async () => {
  const doc = newDoc();
  const root = fakeRoot();
  const speech = root.append(fakeNode());
  const result = await recoverActivitySlots({
    root,
    ranges: [{start: 100, tail: speech}],
    doc,
    list: async () => ({items: [slot('opencode-mcp:0f0e-abc', 1, 150)]}),
  });
  assert.deepEqual(result.map((entry) => entry.toolCallId), ['opencode-mcp:0f0e-abc']);
  assert.deepEqual(root.children.map((node) => node.dataset.activityCall || 'fala'), ['fala', 'opencode-mcp:0f0e-abc']);
});

test('recoverActivitySlots: item de outra conversa não entra no histórico', async () => {
  const doc = newDoc();
  const root = fakeRoot();
  const speech = root.append(fakeNode());
  const result = await recoverActivitySlots({
    root,
    ranges: [{start: 100, tail: speech}],
    doc,
    conversationId: 'conv-atual',
    list: async () => ({items: [{...slot('previa:prv-1', 1, 150), conversationId: 'conv-antiga'}]}),
  });
  assert.deepEqual(result, []);
  assert.deepEqual(root.children, [speech]);
});

test('recoverActivitySlots: lista atrasada de outra abertura não mexe no DOM', async () => {
  const doc = newDoc();
  const root = fakeRoot();
  const speech = root.append(fakeNode());
  const result = await recoverActivitySlots({
    root,
    ranges: [{start: 100, tail: speech}],
    doc,
    list: async () => ({items: [slot('previa:prv-1', 1, 150)]}),
    isCurrent: () => false,
  });
  assert.deepEqual(result, []);
  assert.deepEqual(root.children, [speech]);
});
