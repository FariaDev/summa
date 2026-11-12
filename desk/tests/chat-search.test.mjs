import assert from 'node:assert/strict';
import test from 'node:test';
import {createChatSearchSource,fold,foldText,searchEntries,stepHit} from '../src/chat-search.mjs';

/* Busca na conversa (#122), parte pura: a fonte é o texto dos turnos, sem DOM;
   acento e caixa não diferenciam, cada mensagem conta TODAS as ocorrências e a
   navegação é circular. A mensagem em casca (#118) entra pelo mesmo caminho:
   o `showHistory` entrega o texto-fonte, não o rico que ainda não foi pintado. */

test('dobra sem acento e sem caixa, como a busca de estudos', () => {
  assert.equal(fold('  Formulário\n de AÇÃO '), 'formulario de acao');
});

test('acha acento e caixa em qualquer combinação', () => {
  const entries = [{text: 'A fórmula de Bhaskara e a FÓRMULA reduzida.'}];
  const result = searchEntries(entries, 'formula');
  assert.equal(result.total, 2);
  assert.deepEqual(result.hits, [
    {entryIndex: 0, occurrence: 0},
    {entryIndex: 0, occurrence: 1},
  ]);
  assert.equal(searchEntries(entries, 'FÓRMULA').total, 2);
  assert.equal(searchEntries(entries, 'bháskara').total, 1);
});

test('conta várias ocorrências na mesma mensagem e preserva a ordem das mensagens', () => {
  const entries = [{text: 'passo a passo, passo'}, {text: 'sem nada'}, {text: 'outro passo'}];
  const result = searchEntries(entries, 'passo');
  assert.equal(result.total, 4);
  assert.deepEqual(result.hits, [
    {entryIndex: 0, occurrence: 0},
    {entryIndex: 0, occurrence: 1},
    {entryIndex: 0, occurrence: 2},
    {entryIndex: 2, occurrence: 0},
  ]);
});

test('mensagem ainda não formatada (casca) entra pela fonte, sem DOM', () => {
  const entries = [{text: 'Resposta antiga com a palavra Integral', formatted: false}];
  assert.equal(searchEntries(entries, 'integral').total, 1);
  assert.equal(entries[0].folded, 'resposta antiga com a palavra integral');
});

test('texto vazio, consulta vazia e consulta sem casamento não inventam ocorrência', () => {
  assert.deepEqual(searchEntries([{text: 'nada'}], '   ').hits, []);
  assert.deepEqual(searchEntries([{text: 'nada'}], 'ausente').hits, []);
  assert.deepEqual(searchEntries([], 'nada').hits, []);
});

test('espaços e quebras de linha contam como um espaço só', () => {
  const entries = [{text: 'primeira linha\n\nsegunda   linha'}];
  assert.equal(searchEntries(entries, 'linha segunda').total, 1);
});

test('navegação circular: próxima depois da última volta à primeira, anterior antes da primeira volta à última', () => {
  assert.equal(stepHit(2, 3, 1), 0);
  assert.equal(stepHit(0, 3, -1), 2);
  assert.equal(stepHit(1, 3, 1), 2);
  assert.equal(stepHit(-1, 3, 1), 0);
  assert.equal(stepHit(-1, 3, -1), 2);
  assert.equal(stepHit(0, 0, 1), -1);
  assert.equal(stepHit(0, 1, 1), 0);
});

test('fonte da busca: histórico entra de uma vez e a fala viva entra depois, no lugar da mesma bolha', () => {
  const source = createChatSearchSource();
  const historyEl = {};
  const liveEl = {};
  source.set([{text: 'Pergunta antiga', el: historyEl}]);
  source.add({text: 'Uma mariposa', el: liveEl});
  assert.deepEqual(source.list().map((entry) => entry.text), ['Pergunta antiga', 'Uma mariposa']);
  assert.equal(source.get(liveEl), source.list()[1], 'a bolha viva é achada pelo elemento');
  source.add({text: 'Uma mariposa final', el: liveEl});
  assert.deepEqual(source.list().map((entry) => entry.text), ['Pergunta antiga', 'Uma mariposa final'], 'a mesma bolha atualiza sem duplicar');
  assert.equal(source.list().length, 2);
});

test('fonte da busca: zerar descarta tudo e bolha removida sai da lista', () => {
  const source = createChatSearchSource();
  source.set([{text: 'antiga', el: {isConnected: true}}]);
  source.add({text: 'viva', el: {isConnected: true}});
  source.add({text: 'removida', el: {isConnected: false}});
  assert.deepEqual(source.list().map((entry) => entry.text), ['antiga', 'viva']);
  source.clear();
  assert.deepEqual(source.list(), []);
  assert.equal(source.get({}), null);
});

test('foldText devolve o intervalo no texto original para destacar a ocorrência', () => {
  const {folded,map} = foldText('AÇÃO e fórmula');
  assert.equal(folded, 'acao e formula');
  const at = folded.indexOf('formula');
  assert.deepEqual(map[at], {start: 7, end: 8});
  assert.deepEqual(map[at + 'formula'.length - 1], {start: 13, end: 14});
  const other = folded.indexOf('acao');
  assert.deepEqual(map[other], {start: 0, end: 1});
  assert.deepEqual(map[other + 3], {start: 3, end: 4});
});

test('foldText com marcas combinantes mantém o mapa no caractere-base', () => {
  const {folded,map} = foldText('A\u0301RVORE');
  assert.equal(folded, 'arvore');
  assert.deepEqual(map[0], {start: 0, end: 1});
  assert.deepEqual(map[1], {start: 2, end: 3});
});

test('fonte da busca: a lista segue a ordem da tela, não a do registro (#122)', () => {
  const position = new Map();
  /* Node.DOCUMENT_POSITION_PRECEDING = 2: `other` vem antes de `this`. */
  const bubble = (at) => {
    const el = {isConnected: true, compareDocumentPosition: (other) => (position.get(other) < at ? 2 : 4)};
    position.set(el, at);
    return el;
  };
  const source = createChatSearchSource();
  const first = bubble(1);
  const anchored = bubble(2);
  const last = bubble(3);
  source.add({text: 'primeira', el: first});
  source.add({text: 'última', el: last});
  source.add({text: 'ancorada', el: anchored});
  assert.deepEqual(source.list().map((entry) => entry.text), ['primeira', 'ancorada', 'última']);
});
