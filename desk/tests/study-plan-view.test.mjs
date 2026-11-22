import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as plan from '../src/study/study-plan.mjs';

class PlanNode {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; }
  setAttribute(key, value) { this.attrs[key] = value; }
  hasAttribute(key) { return Object.hasOwn(this.attrs, key); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  matches(selector) {
    return [...selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)].every(([, key, value]) =>
      Object.hasOwn(this.attrs, key) && (value === undefined || this.attrs[key] === value));
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (!(child instanceof PlanNode)) continue;
      if (child.matches(selector)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  focus() { if (!Object.hasOwn(this.attrs, 'disabled')) focused = this; }
}
let focused;
const source = fs.readFileSync(new URL('../src/study/study-plan-view.mjs', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace('export function initStudyPlanView', 'function initStudyPlanView');
function harness(count) {
  let current = {tasks: Array.from({length: count}, (_, i) => ({id: String(i), text: `Task ${i}`, done: false, pdf: '', page: 0})), notes: ''};
  const root = new PlanNode('div');
  const context = vm.createContext({document: {createElement: tag => new PlanNode(tag)},
    plan: {...plan, studyPlanSnapshot: () => current, setStudyPlan: next => { current = next; }},
    pageRefs: () => [], icon: () => '', t: key => key, save() {}, CSS: {escape: id => id}});
  vm.runInContext(`${source}\npop = root; renderPop();`, Object.assign(context, {root}));
  return {root, move: (action, id) => vm.runInContext(`moveOrRemove('${action}', '${id}')`, context)};
}
const button = (root, id, action) => root.querySelector(`[data-id="${id}"][data-action="${action}"]`);
for (const [name, count, id, up, down] of [
  ['first', 3, '0', true, false], ['middle', 3, '1', false, false],
  ['last', 3, '2', false, true], ['single', 1, '0', true, true],
]) test(`${name} task move controls`, () => {
  const {root} = harness(count);
  assert.equal(Object.hasOwn(button(root, id, 'up').attrs, 'disabled'), up);
  assert.equal(Object.hasOwn(button(root, id, 'down').attrs, 'disabled'), down);
});
test('empty plan has no move controls', () => {
  assert.equal(harness(0).root.querySelector('[data-action="up"]'), null);
});
for (const [action, opposite] of [['up', 'down'], ['down', 'up']]) {
  test(`moving ${action} to a boundary focuses the enabled opposite control`, () => {
    const {root, move} = harness(3);
    move(action, '1');
    assert.equal(focused, button(root, '1', opposite));
  });
}
