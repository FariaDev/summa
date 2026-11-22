import test from 'node:test';
import assert from 'node:assert/strict';
import {tscErrors, judgeRatchet} from '../scripts/typecheck-ratchet.mjs';

test('tscErrors conta por arquivo e separa erro sem arquivo', () => {
  const out = 'src/a.mjs(1,2): error TS2322: x\nsrc\\b.cjs(3,4): error TS18047: y\nsrc/a.mjs(5,6): error TS2531: z\nerror TS5083: sem tsconfig\n  continuação\n';
  const {byFile, global} = tscErrors(out);
  assert.deepEqual([...byFile], [['src/a.mjs', 2], ['src/b.cjs', 1]]);
  assert.deepEqual(global, ['error TS5083: sem tsconfig']);
});

test('judgeRatchet reprova erro novo e teto estourado, cobra a dívida paga', () => {
  const verdict = judgeRatchet(new Map([['novo.mjs', 1], ['velho.mjs', 4], ['menor.mjs', 1]]), {'velho.mjs': 3, 'menor.mjs': 2, 'pago.mjs': 5});
  assert.deepEqual(verdict, {fresh: ['novo.mjs'], over: ['velho.mjs: 4 > 3'], paid: ['pago.mjs'], lower: ['menor.mjs: 1 < 2']});
});

test('judgeRatchet sem erro e sem dívida passa limpo', () => {
  assert.deepEqual(judgeRatchet(new Map(), {}), {fresh: [], over: [], paid: [], lower: []});
});
