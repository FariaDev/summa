/* selectInkModel (#158): a peça pura que diz se o modelo escolhido pelo aluno
   serve para ler a tinta do caderno — só com visão (`input` com `image`, a
   mesma regra do seletor) e sem ser o grátis do Zen (custo zero). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {selectInkModel} = require('../notebook-ink-model.cjs');

/* No formato que `opencode-catalog.cjs` devolve (`sanitizeModel`): `cost` já
   é o objeto `{input, output}` e `input` é o `capabilities.input` cru. */
const CATALOG = [
  {provider: 'xai', id: 'grok-vision', name: 'Grok Visão', variants: [], input: ['text', 'image'], cost: {input: 1, output: 2}, contextWindow: 200000},
  {provider: 'xai', id: 'grok-text', name: 'Grok Texto', variants: [], input: ['text'], cost: {input: 1, output: 2}, contextWindow: 200000},
  {provider: 'opencode', id: 'big-pickle', name: 'Big Pickle', variants: [], input: ['text', 'image'], cost: {input: 0, output: 0}, contextWindow: 200000},
  {provider: 'opencode', id: 'plain-free-text', name: 'Grátis de Texto', variants: [], input: ['text'], cost: {input: 0, output: 0}, contextWindow: 200000},
  {provider: 'xai', id: 'grok-sem-custo', name: 'Grok Sem Custo', variants: [], input: ['text', 'image'], contextWindow: 200000},
  {provider: 'xai', id: 'grok-custo-nulo-entrada', name: 'Grok Custo Nulo Entrada', variants: [], input: ['text', 'image'], cost: {input: null, output: 0}, contextWindow: 200000},
  {provider: 'xai', id: 'grok-custo-nulo-saida', name: 'Grok Custo Nulo Saída', variants: [], input: ['text', 'image'], cost: {input: 0, output: null}, contextWindow: 200000},
];
const sel = (model, effort = null) => ({model, effort});

test('modelo com visão e pago: segue para a leitura', () => {
  assert.deepEqual(selectInkModel(sel('xai/grok-vision'), CATALOG), {model: 'xai/grok-vision', effort: null, reason: null});
});

test('modelo sem visão no catálogo: null com motivo no-vision', () => {
  assert.deepEqual(selectInkModel(sel('xai/grok-text'), CATALOG), {model: null, effort: null, reason: 'no-vision'});
});

test('modelo grátis com visão: null com motivo free', () => {
  assert.deepEqual(selectInkModel(sel('opencode/big-pickle'), CATALOG), {model: null, effort: null, reason: 'free'});
});

test('modelo com visão sem custo no catálogo: segue como pago', () => {
  assert.deepEqual(selectInkModel(sel('xai/grok-sem-custo'), CATALOG), {model: 'xai/grok-sem-custo', effort: null, reason: null});
});

test('preço nulo de um lado não vira grátis', () => {
  assert.deepEqual(selectInkModel(sel('xai/grok-custo-nulo-entrada'), CATALOG), {model: 'xai/grok-custo-nulo-entrada', effort: null, reason: null});
  assert.deepEqual(selectInkModel(sel('xai/grok-custo-nulo-saida'), CATALOG), {model: 'xai/grok-custo-nulo-saida', effort: null, reason: null});
});

test('grátis e sem visão: a capacidade decide primeiro', () => {
  assert.deepEqual(selectInkModel(sel('opencode/plain-free-text'), CATALOG), {model: null, effort: null, reason: 'no-vision'});
});

test('sem escolha ou fora do catálogo: null com motivo no-model', () => {
  assert.deepEqual(selectInkModel(null, CATALOG), {model: null, effort: null, reason: 'no-model'});
  assert.deepEqual(selectInkModel(sel(null), CATALOG), {model: null, effort: null, reason: 'no-model'});
  assert.deepEqual(selectInkModel(sel('meu-provedor/caseiro'), CATALOG), {model: null, effort: null, reason: 'no-model'});
  assert.deepEqual(selectInkModel('não-objeto', CATALOG), {model: null, effort: null, reason: 'no-model'});
  assert.deepEqual(selectInkModel(sel(42), CATALOG), {model: null, effort: null, reason: 'no-model'});
});

test('M3: devolve o esforço verificado junto do modelo pago com visão', () => {
  const withEffort = [
    {provider: 'xai', id: 'grok-vision', name: 'Grok Visão', variants: ['high'], input: ['text', 'image'], cost: {input: 1, output: 2}},
  ];
  assert.deepEqual(selectInkModel(sel('xai/grok-vision', 'high'), withEffort), {model: 'xai/grok-vision', effort: 'high', reason: null});
  assert.deepEqual(selectInkModel(sel('xai/grok-vision', 'max'), withEffort), {model: 'xai/grok-vision', effort: null, reason: null}, 'esforço fora das variantes não passa');
});
