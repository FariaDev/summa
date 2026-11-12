// Cache do render do histórico (#120): acerto, invalidação por cada componente
// da chave, teto/evicção e a guarda que nunca deixa HTML executável entrar.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HTML_CACHE_MAX_ENTRIES,
  TURNS_CACHE_MAX_ENTRIES,
  createHistoryRenderCache,
  hash64,
  historyTurnsKey,
  markupKey,
  stableJson,
  unsafeHtml,
} from '../src/history-render-cache.mjs';

const messages = (text = 'Pergunta', image = '') => {
  const user = [{type: 'text', text}];
  if (image) user.push({type: 'image', data: image, mimeType: 'image/png'});
  return [
    {role: 'user', content: user, timestamp: 1_000},
    {role: 'assistant', content: [{type: 'text', text: `Resposta ${text}`}], timestamp: 2_000},
  ];
};

function makeCache(overrides = {}) {
  let language = 'pt-BR';
  const cache = createHistoryRenderCache({
    language: () => language,
    pipeline: 'pipeline-a',
    html: {maxEntries: 10, maxBytes: 1_000_000},
    turns: {maxEntries: 10, maxBytes: 1_000_000},
    ...overrides,
  });
  return {cache, setLanguage: (next) => { language = next; }};
}

test('historyTurns: acerto devolve o mesmo resultado sem recomputar', () => {
  const {cache} = makeCache();
  let calls = 0;
  const compute = (list) => {
    calls += 1;
    return [{text: list[0].content[0].text}];
  };
  const first = cache.historyTurns(messages('A'), 'id-1', compute);
  const second = cache.historyTurns(messages('A'), 'id-1', compute);
  assert.equal(calls, 1, 'a segunda abertura não refaz o historyTurns');
  assert.equal(second, first, 'devolve a mesma projeção cacheada');
  const stats = cache.stats().turns;
  assert.equal(stats.misses, 1);
  assert.equal(stats.hits, 1);
});

test('historyTurns: identidade, texto, imagem, idioma e pipeline invalidam', () => {
  const {cache, setLanguage} = makeCache();
  let calls = 0;
  const compute = () => {
    calls += 1;
    return calls;
  };
  cache.historyTurns(messages('A'), 'id-1', compute);
  cache.historyTurns(messages('A'), 'id-1', compute);
  assert.equal(calls, 1, 'mesma identidade acerta');

  cache.historyTurns(messages('A'), 'id-2', compute);
  assert.equal(calls, 2, 'outra identidade (outra sessão/cartões) invalida');

  cache.historyTurns(messages('B'), null, compute);
  assert.equal(calls, 3, 'texto trocado sem identidade invalida');
  cache.historyTurns(messages('B'), null, compute);
  assert.equal(calls, 3, 'mesmo texto sem identidade acerta');

  cache.historyTurns(messages('B', 'imagem-1'), null, compute);
  assert.equal(calls, 4, 'imagem diferente invalida');
  cache.historyTurns(messages('B', 'imagem-2'), null, compute);
  assert.equal(calls, 5, 'bytes de imagem diferentes invalidam');

  setLanguage('en');
  cache.historyTurns(messages('B', 'imagem-2'), null, compute);
  assert.equal(calls, 6, 'idioma entra na chave (displayUserText/figuras)');

  cache.setMarkupPipeline('pipeline-b');
  cache.historyTurns(messages('B', 'imagem-2'), null, compute);
  assert.equal(calls, 7, 'versão do pipeline entra na chave');
});

test('historyTurns: a ordem das chaves do objeto não muda a chave', () => {
  const left = [{role: 'user', content: [{type: 'text', text: 'A'}], timestamp: 1, details: {b: 2, a: 1}}];
  const right = [{role: 'user', content: [{type: 'text', text: 'A'}], timestamp: 1, details: {a: 1, b: 2}}];
  assert.equal(historyTurnsKey({messages: left, identity: null, language: 'pt-BR', pipeline: 'p'}),
    historyTurnsKey({messages: right, identity: null, language: 'pt-BR', pipeline: 'p'}));
});

test('HTML: acerto e invalidação por texto, assets, imagens, idioma e pipeline', () => {
  const {cache, setLanguage} = makeCache();
  let calls = 0;
  const compute = (text) => {
    calls += 1;
    return `<p>${text}</p>`;
  };
  const render = (text, allowAssets = true, images = []) => cache.sanitizedHtml(text, allowAssets, images, () => compute(text));

  assert.equal(render('A'), '<p>A</p>');
  assert.equal(render('A'), '<p>A</p>');
  assert.equal(calls, 1, 'mesmo texto acerta');

  render('B');
  assert.equal(calls, 2, 'texto diferente invalida');

  render('B', false);
  assert.equal(calls, 3, 'allowAssets entra na chave');

  render('B', false, ['data:image/png;base64,AAA']);
  assert.equal(calls, 4, 'imagem entra na chave');

  render('B', false, ['data:image/png;base64,BBB']);
  assert.equal(calls, 5, 'imagem diferente invalida');

  setLanguage('en');
  render('B', false, ['data:image/png;base64,BBB']);
  assert.equal(calls, 6, 'idioma entra na chave');

  cache.setMarkupPipeline('pipeline-b');
  render('B', false, ['data:image/png;base64,BBB']);
  assert.equal(calls, 7, 'pipeline entra na chave');
});

test('HTML: ordem das imagens importa; a chave acompanha', () => {
  const one = markupKey({text: 'x', allowAssets: true, images: ['a', 'b'], language: 'pt-BR', pipeline: 'p'});
  const two = markupKey({text: 'x', allowAssets: true, images: ['b', 'a'], language: 'pt-BR', pipeline: 'p'});
  assert.notEqual(one, two);
  assert.equal(hash64('abc'), hash64('abc'));
  assert.notEqual(hash64('abc'), hash64('abd'));
  assert.equal(stableJson({b: 1, a: {d: 2, c: 3}}), stableJson({a: {c: 3, d: 2}, b: 1}));
});

test('teto por entradas: o mais antigo sai e volta a computar', () => {
  const {cache} = makeCache({html: {maxEntries: 2, maxBytes: 1_000_000}});
  let calls = 0;
  const render = (text) => cache.sanitizedHtml(text, true, [], () => {
    calls += 1;
    return `<p>${text}</p>`;
  });
  render('A');
  render('B');
  assert.equal(render('A'), '<p>A</p>', 'A ainda está no cache (LRU toca)');
  assert.equal(calls, 2, 'A e B computados uma vez');
  render('C');
  assert.equal(cache.stats().html.evictions, 1, 'entrar C evicta o menos recente (B)');
  assert.equal(render('A'), '<p>A</p>', 'A, tocado antes, sobreviveu');
  assert.equal(calls, 3, 'A não recomputa');
  render('B');
  assert.equal(calls, 4, 'B evictado volta a computar');
  render('D');
  assert.equal(calls, 5, 'D entra e evicta C');
  render('A');
  assert.equal(calls, 6, 'A, o menos recente agora, volta a computar');
});

test('teto por bytes: entrada maior que o teto não é guardada', () => {
  const {cache} = makeCache({html: {maxEntries: 10, maxBytes: 10}});
  let calls = 0;
  const render = () => cache.sanitizedHtml('grande', true, [], () => {
    calls += 1;
    return '<p>01234567890123456789</p>';
  });
  assert.equal(render(), '<p>01234567890123456789</p>');
  assert.equal(render(), '<p>01234567890123456789</p>');
  assert.equal(calls, 2, 'sem teto para a entrada, sempre recomputa');
  assert.equal(cache.stats().html.entries, 0);
  assert.equal(cache.stats().html.rejected, 2, 'cada tentativa grande é recusada');
});

test('nunca guarda HTML executável: tag/atributo perigoso é recusado', () => {
  const {cache} = makeCache();
  let calls = 0;
  const dirty = (html) => () => {
    calls += 1;
    return html;
  };
  for (const html of [
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '<a href="javascript:alert(1)">x</a>',
    '<iframe srcdoc="<script>x</script>"></iframe>',
  ]) {
    assert.equal(cache.sanitizedHtml(html, true, [], dirty(html)), html, 'devolve a saída para o DOM');
    cache.sanitizedHtml(html, true, [], dirty(html));
    assert.equal(cache.stats().html.entries, 0, `não guardou: ${html}`);
  }
  assert.equal(calls, 8, 'cada tentativa recomputa; nada foi cacheado');
  assert.equal(cache.stats().html.rejected, 8);
  assert.equal(unsafeHtml('<p>ok</p>'), false);
  assert.equal(unsafeHtml('<p> onerror=alert(1)</p>'), true, 'falso positivo só perde o cache');
  assert.equal(cache.sanitizedHtml('<p>ok</p>', true, [], dirty('<p>ok</p>')), '<p>ok</p>');
  assert.equal(cache.sanitizedHtml('<p>ok</p>', true, [], dirty('<p>ok</p>')), '<p>ok</p>');
  assert.equal(calls, 9, 'HTML limpo é cacheado');
  assert.equal(cache.stats().html.hits, 1);
});

test('regressão: reabrir conversa editada ou apagada mostra o conteúdo novo', () => {
  const {cache} = makeCache();
  const compute = (list) => list.map((message) => message.content[0].text);
  const before = messages('Pergunta original');
  const edited = messages('Pergunta corrigida');
  assert.deepEqual(cache.historyTurns(before, null, compute), ['Pergunta original', 'Resposta Pergunta original']);
  assert.deepEqual(cache.historyTurns(before, null, compute), ['Pergunta original', 'Resposta Pergunta original']);
  assert.deepEqual(cache.historyTurns(edited, null, compute), ['Pergunta corrigida', 'Resposta Pergunta corrigida'], 'edição invalida');
  assert.deepEqual(cache.historyTurns([], null, compute), [], 'conversa apagada não devolve o cache velho');
  assert.deepEqual(cache.historyTurns(before, null, compute), ['Pergunta original', 'Resposta Pergunta original'], 'voltar ao original usa o cache certo');
});

test('desligado e clear: o caminho continua correto e o cache não cresce', () => {
  const {cache} = makeCache();
  let calls = 0;
  const compute = () => {
    calls += 1;
    return calls;
  };
  cache.setEnabled(false);
  cache.historyTurns(messages('A'), 'id', compute);
  cache.historyTurns(messages('A'), 'id', compute);
  assert.equal(calls, 2, 'desligado sempre computa');
  assert.equal(cache.stats().turns.entries, 0);
  cache.setEnabled(true);
  cache.historyTurns(messages('A'), 'id', compute);
  cache.historyTurns(messages('A'), 'id', compute);
  assert.equal(calls, 3, 'ligado volta a acertar');
  cache.clear();
  assert.equal(cache.stats().turns.entries, 0);
  assert.equal(cache.stats().html.entries, 0);
  assert.ok(HTML_CACHE_MAX_ENTRIES > 0);
  assert.ok(TURNS_CACHE_MAX_ENTRIES > 0);
});
