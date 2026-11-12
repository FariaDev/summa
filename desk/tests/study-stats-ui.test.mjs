/* Painel de Estatísticas (renderer independente).

   `desk/src/study-stats.mjs` não importa o estado global nem edita o shell: o
   integrador chama `initStudyStats({state, host})` e o módulo monta o próprio
   botão e o próprio `<dialog>` acessível. Aqui o teste roda o módulo com um DOM
   mínimo de mentira e um host simulado, provando o que o painel DESENHA e o que
   ele PEDE — sem Electron e sem tocar em arquivo real.

   O que fica para a integração (main/preload): as chaves de IPC e o host de
   verdade (`statistics.cjs`), cobertos por `study-stats.test.mjs`. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {setMaxListeners} from 'node:events';
import {pathToFileURL} from 'node:url';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setUiLanguage} from '../src/ui-text.mjs';
import {FREE_COURSE_ID} from '../src/free-names.mjs';

const SRC = join(dirname(dirname(fileURLToPath(import.meta.url))), 'src');

/* ---------- DOM mínimo ---------- */

class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this._listeners = {};
    this._text = '';
    this._className = '';
    this.value = '';
    this.hidden = false;
    this.open = false;
    this.disabled = false;
  }
  get textContent() {
    if (this._text) return this._text;
    return this.children.map((kid) => kid.textContent).join('');
  }
  set textContent(value) {
    this.children = [];
    this._text = String(value);
  }
  get className() { return this._className; }
  set className(value) { this._className = String(value); }
  get id() { return this.attributes.id || ''; }
  append(...kids) {
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      const node = typeof kid === 'string' ? new FakeNode('#text') : kid;
      if (typeof kid === 'string') node._text = kid;
      node.parentNode = this;
      this.children.push(node);
    }
  }
  prepend(...kids) { this.children.unshift(...kids); }
  replaceChildren(...kids) { this.children = []; this.append(...kids); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this._listeners[type] = (this._listeners[type] || []).filter((one) => one !== fn); }
  dispatch(type, extra = {}) {
    const event = {target: this, currentTarget: this, preventDefault() {}, ...extra};
    for (const fn of this._listeners[type] || []) fn(event);
  }
  querySelector(selector) { return find(this, selector); }
  querySelectorAll(selector) { return findAll(this, selector); }
  closest() { return this; }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatch('close'); }
  get firstChild() { return this.children[0] || null; }
  get options() { return this.children.filter((kid) => kid.tagName === 'OPTION'); }
}

function matches(node, selector) {
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  if (selector.startsWith('.')) return node.className.split(/\s+/).includes(selector.slice(1));
  return node.tagName === selector.toUpperCase();
}

function find(node, selector) {
  for (const kid of node.children) {
    if (matches(kid, selector)) return kid;
    const hit = find(kid, selector);
    if (hit) return hit;
  }
  return null;
}

function findAll(node, selector, out = []) {
  for (const kid of node.children) {
    if (matches(kid, selector)) out.push(kid);
    findAll(kid, selector, out);
  }
  return out;
}

function installDom() {
  const body = new FakeNode('body');
  const head = new FakeNode('head');
  const document = {
    body,
    head,
    documentElement: {},
    querySelectorAll: () => [],
    createElement: (tag) => new FakeNode(tag),
    getElementById: (id) => find(body, `#${id}`) || find(head, `#${id}`),
  };
  globalThis.document = document;
  const window = Object.assign(new EventTarget(), {confirm: () => true, desk: undefined});
  setMaxListeners(50, window);
  globalThis.window = window;
  return {body, head, document};
}

const {body} = installDom();
let version = 0;

/* Cada teste recebe uma instância própria do módulo (o painel é singleton por
   módulo): o cache-busting da URL dá um módulo novo sem API de teste dentro do
   arquivo de produção. */
async function loadPanel(options) {
  version += 1;
  const module = await import(`${pathToFileURL(join(SRC, 'study-stats.mjs')).href}?v=${version}`);
  return module.initStudyStats(options);
}

const summary = {
  period: '7',
  periodLabel: 'Últimos 7 dias',
  totals: {seconds: 5400, sessions: 2, prompts: 3},
  labels: {active: '1 h 30 min', sessions: '2', prompts: '3', input: '120', output: '30', cache: 'indisponível'},
  usage: {
    input: {available: true, count: 120},
    output: {available: true, count: 30},
    cache: {available: false, count: 0},
  },
  series: [
    {day: 20740, weekday: 'qua', minutes: 0, secondsLabel: '0 min'},
    {day: 20741, weekday: 'qui', minutes: 30, secondsLabel: '30 min'},
    {day: 20742, weekday: 'sex', minutes: 60, secondsLabel: '1 h'},
  ],
  courses: [{courseId: 'A', seconds: 5400, sessions: 2, prompts: 3, secondsLabel: '1 h 30 min'}],
  timer: {running: false, idle: false, startedAt: 0, seconds: 0, label: '0 min'},
};

function fakeHost() {
  const calls = [];
  const host = {
    calls,
    timer: {running: false, idle: false, startedAt: 0, seconds: 0, label: '0 min'},
    studyStatsSummary: async (payload) => { calls.push(['summary', payload]); return {...summary, timer: {...host.timer}}; },
    studyStatsControl: async (payload) => {
      calls.push(['control', payload]);
      if (payload.action === 'start' || payload.action === 'resume') host.timer = {running: true, idle: false, startedAt: 1000, seconds: 1800, label: '30 min'};
      else if (payload.action === 'pause') host.timer = {running: false, idle: false, startedAt: 1000, seconds: 1800, label: '30 min'};
      else host.timer = {running: false, idle: false, startedAt: 0, seconds: 0, label: '0 min'};
      return {...host.timer};
    },
    studyStatsReset: async (payload) => { calls.push(['reset', payload]); return {cleared: true}; },
  };
  return host;
}

test('o painel monta botão e diálogo acessíveis sem o shell global', async () => {
  const panel = await loadPanel({state: {currentCourseId: 'A'}, host: fakeHost()});
  assert.equal(panel.toggle.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(panel.toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(body.children.includes(panel.toggle), true);
  assert.equal(body.children.includes(panel.dialog), true);
  assert.equal(panel.dialog.getAttribute('aria-labelledby'), 'study-stats-title');
  assert.ok(panel.dialog.querySelector('.study-stats-close'));
  assert.equal(typeof panel.open, 'function');
});

test('abrir o painel pede o resumo e escreve a manchete em linguagem de gente', async () => {
  const host = fakeHost();
  const panel = await loadPanel({state: {currentCourseId: 'A'}, host});
  await panel.open();
  await panel.reload();
  assert.equal(panel.dialog.open, true);
  assert.equal(panel.toggle.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(host.calls[0], ['summary', {period: '7', courseId: ''}]);
  assert.equal(panel.headline.textContent, '1 h 30 min de estudo em 2 sessões');
  assert.equal(panel.support.textContent, '3 perguntas ao tutor · melhor dia: sexta, 60 min');
  assert.match(panel.usageText.textContent, /^120 tokens lidos · 30 escritos$/, 'cache indisponível some do texto');
  assert.match(panel.dialog.textContent, /Só neste computador/);
  assert.match(panel.dialog.textContent, /Uso do tutor no período/);
});

test('o período é um segmento: clicar pede o período e marca o escolhido', async () => {
  const host = fakeHost();
  const panel = await loadPanel({state: {}, host});
  await panel.reload();
  const month = panel.period.buttons.find((one) => one.dataset.period === '30');
  month.dispatch('click');
  await tick();
  assert.equal(host.calls.at(-1)[1].period, '30');
  assert.equal(month.getAttribute('aria-checked'), 'true');
  assert.equal(panel.period.buttons[0].getAttribute('aria-checked'), 'false');
});

test('intervalo personalizado é a quarta opção, mostra as datas e pede start/end', async () => {
  const host = fakeHost();
  const panel = await loadPanel({state: {}, host});
  await panel.reload();
  const custom = panel.period.buttons.find((one) => one.dataset.period === 'custom');
  assert.equal(custom.textContent, 'Personalizado');
  assert.equal(panel.range.getAttribute('hidden'), '');
  custom.dispatch('click');
  await tick();
  await tick();
  const first = host.calls.at(-1)[1];
  assert.equal(first.period, 'custom');
  assert.match(first.start, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(first.end, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(custom.getAttribute('aria-checked'), 'true');
  assert.equal(custom.tabIndex, 0);
  assert.equal(panel.period.buttons[0].tabIndex, -1);

  panel.rangeStart.value = '2026-01-01';
  panel.rangeEnd.value = '2026-01-31';
  panel.rangeStart.dispatch('change');
  await tick();
  await tick();
  const chosen = host.calls.at(-1)[1];
  assert.equal(chosen.start, '2026-01-01');
  assert.equal(chosen.end, '2026-01-31');
});

test('data vazia não pede resumo e explica o que falta', async () => {
  const host = fakeHost();
  const panel = await loadPanel({state: {}, host});
  await panel.reload();
  panel.period.buttons.find((one) => one.dataset.period === 'custom').dispatch('click');
  await tick();
  const calls = host.calls.length;
  panel.rangeStart.value = '';
  panel.rangeStart.dispatch('change');
  await tick();
  assert.match(panel.warning.textContent, /Informe as duas datas/);
  assert.equal(host.calls.length, calls, 'sem as duas datas não há pedido ao host');
});

test('o teclado anda no grupo de períodos e escolhe com as setas', async () => {
  const host = fakeHost();
  const panel = await loadPanel({state: {}, host});
  await panel.reload();
  const week = panel.period.buttons[0];
  week.dispatch('keydown', {key: 'ArrowRight'});
  await tick();
  await tick();
  assert.equal(panel.period.value, '30');
  assert.equal(host.calls.at(-1)[1].period, '30');
  assert.equal(panel.period.buttons[1].getAttribute('aria-checked'), 'true');
  panel.period.buttons[1].dispatch('keydown', {key: 'End'});
  await tick();
  await tick();
  assert.equal(panel.period.value, 'custom');
});

test('início depois do fim, futuro e intervalo vazio têm recado na tela', async () => {
  const empty = {totals: {seconds: 0, sessions: 0, prompts: 0}};
  for (const [error, pattern] of [['order', /depois da data de fim/], ['future', /passa de hoje/], ['', /Sem estudo registrado/]]) {
    const host = {...fakeHost(), studyStatsSummary: async () => ({...empty, range: {error}})};
    const panel = await loadPanel({state: {}, host});
    await panel.reload();
    panel.period.buttons.find((one) => one.dataset.period === 'custom').dispatch('click');
    await tick();
    await tick();
    assert.match(panel.warning.textContent, pattern, `recado para "${error || 'vazio'}"`);
  }
});

test('intervalo longo agrupa as barras por semana sem perder o total', async () => {
  const days = Array.from({length: 40}, (_, index) => ({
    day: 20740 + index,
    weekday: 'qua',
    seconds: 60,
    minutes: 1,
  }));
  const long = {
    ...summary,
    period: 'custom',
    series: days,
    totals: {seconds: 2400, sessions: 0, prompts: 0},
  };
  const host = {...fakeHost(), studyStatsSummary: async () => long};
  const panel = await loadPanel({state: {}, host});
  await panel.reload();
  assert.equal(panel.bars.querySelectorAll('.study-stats-bar').length, 6, '40 dias viram 6 semanas');
  assert.match(panel.bars.getAttribute('aria-label'), /por semana, em minutos: 6 semanas, total de 40 minutos/);
  assert.match(panel.bars.querySelector('.study-stats-bar').getAttribute('title'), /\d{2}\/\d{2} a \d{2}\/\d{2}/);
});

test('o gráfico tem uma barra por dia, valor acima e dia da semana abaixo', async () => {
  const panel = await loadPanel({state: {}, host: fakeHost()});
  await panel.reload();
  const bars = panel.bars.querySelectorAll('.study-stats-bar');
  assert.equal(bars.length, 3);
  assert.match(panel.bars.getAttribute('aria-label'), /3 dias, total de 90 minutos/);
  assert.deepEqual(panel.bars.querySelectorAll('.study-stats-value').map((one) => one.textContent), ['', '30', '60']);
  assert.deepEqual(panel.bars.querySelectorAll('.study-stats-day').map((one) => one.textContent), ['qua', 'qui', 'sex']);
  assert.equal(bars[0].className.includes('empty'), true, 'dia vazio é um fio de 2px');
  assert.ok(bars[2].getAttribute('style')?.includes('height:100%'), 'a barra do pico usa 100% da altura');
});

test('a tabela por matéria traz nome, tempo, sessões e perguntas', async () => {
  const panel = await loadPanel({
    state: {appConfig: {courses: [{id: 'A', name: 'Cálculo'}]}},
    host: fakeHost(),
  });
  await panel.reload();
  const text = panel.coursesTable.textContent;
  assert.match(text, /MatériaTempoSessõesPerguntas/);
  assert.match(text, /Cálculo1 h 30 min23/);
});

test('a matéria filtrada aparece no seletor e no pedido', async () => {
  const host = fakeHost();
  const panel = await loadPanel({
    state: {currentCourseId: 'A', activeCourseName: 'Cálculo', appConfig: {courses: [{id: 'A', name: 'Cálculo'}, {id: 'B', name: 'Física'}]}},
    host,
  });
  await panel.reload();
  const options = panel.course.options.map((one) => one.getAttribute('value') || '');
  assert.deepEqual(options, ['', 'A', 'B']);
  panel.course.value = 'B';
  await panel.reload();
  assert.equal(host.calls.at(-1)[1].courseId, 'B');
});

test('a tabela mostra a aba Livre pelo nome do idioma, não pelo id interno (#125)', async () => {
  const freeSummary = {
    ...summary,
    courses: [{courseId: FREE_COURSE_ID, seconds: 1800, sessions: 1, prompts: 0, secondsLabel: '30 min'}],
  };
  const host = {...fakeHost(), studyStatsSummary: async () => freeSummary};
  try {
    setUiLanguage('pt-BR');
    const panel = await loadPanel({state: {appConfig: {courses: [{id: 'A', name: 'Cálculo'}]}}, host});
    await panel.reload();
    assert.match(panel.coursesTable.textContent, /Livre/);
    assert.doesNotMatch(panel.coursesTable.textContent, new RegExp(FREE_COURSE_ID));
    setUiLanguage('en');
    await panel.reload();
    assert.match(panel.coursesTable.textContent, /Free/);
    assert.doesNotMatch(panel.coursesTable.textContent, new RegExp(FREE_COURSE_ID));
  } finally {
    setUiLanguage('pt-BR');
  }
});

test('o seletor de matérias chama a aba Livre pelo nome do idioma (#125)', async () => {
  try {
    setUiLanguage('pt-BR');
    const panel = await loadPanel({
      state: {currentCourseId: FREE_COURSE_ID, activeCourseName: 'Livre', appConfig: {courses: [{id: 'A', name: 'Cálculo'}]}},
      host: fakeHost(),
    });
    await panel.reload();
    const freeOption = () => panel.course.options.find((one) => one.getAttribute('value') === FREE_COURSE_ID);
    assert.equal(freeOption()?.textContent, 'Livre');
    setUiLanguage('en');
    await panel.reload();
    assert.equal(freeOption()?.textContent, 'Free');
  } finally {
    setUiLanguage('pt-BR');
  }
});

test('uma ação só no cronômetro: começa, pausa, retoma e encerra pela ação discreta', async () => {
  const host = fakeHost();
  const panel = await loadPanel({state: {currentCourseId: 'A'}, host});
  await panel.open();
  assert.match(panel.sessionText.textContent, /Pausado · nada está sendo contado/);
  assert.equal(panel.timerAction.textContent, 'Retomar');
  assert.equal(panel.sessionStop.hidden, true, 'sem sessão não há o que encerrar');
  await panel.timerAction.dispatch('click');
  await settle(host);
  assert.deepEqual(host.calls.find(([kind]) => kind === 'control')[1], {action: 'start', courseId: 'A'}, 'sem sessão, Retomar começa uma');
  assert.match(panel.sessionText.textContent, /Contando agora · 30 min nesta sessão/);
  assert.equal(panel.timerAction.textContent, 'Pausar');
  assert.equal(panel.sessionStop.hidden, false);
  await panel.timerAction.dispatch('click');
  await settle(host);
  assert.equal(host.calls.filter(([kind]) => kind === 'control').at(-1)[1].action, 'pause');
  assert.equal(panel.timerAction.textContent, 'Retomar');
  await panel.timerAction.dispatch('click');
  await settle(host);
  assert.equal(host.calls.filter(([kind]) => kind === 'control').at(-1)[1].action, 'resume', 'com sessão, Retomar continua a mesma');
});

test('sem o host o painel explica o contrato em vez de quebrar', async () => {
  const panel = await loadPanel({state: {}, host: {}});
  await panel.open();
  await panel.reload();
  assert.match(panel.warning.textContent, /study-stats-summary/);
});

test('o reset exige confirmação e só então chama o host', async () => {
  const host = fakeHost();
  const panel = await loadPanel({state: {}, host});
  let answer = false;
  globalThis.window.confirm = () => answer;
  await panel.reset.dispatch('click');
  await tick();
  assert.equal(host.calls.some(([kind]) => kind === 'reset'), false);
  answer = true;
  await panel.reset.dispatch('click');
  await tick();
  assert.deepEqual(host.calls.find(([kind]) => kind === 'reset')[1], {confirm: true});
});

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test('o uso do tutor tem chevron visível no summary (auditoria rodada 7, D2)', async () => {
  const panel = await loadPanel({state: {}, host: fakeHost()});
  const summary = panel.usage.querySelector('summary');
  assert.ok(summary, 'o details tem summary');
  const chevron = summary.querySelector('.study-stats-usage-chevron');
  assert.ok(chevron, 'o summary tem chevron visível em vez de parecer seção vazia');
  assert.equal(chevron.getAttribute('aria-hidden'), 'true', 'o chevron é decorativo');
  assert.match(summary.textContent, /Uso do tutor no período/, 'o título continua');
});

/* Espera as chamadas assíncronas do painel assentarem (host + refresh). */
async function settle(host) {
  for (let i = 0; i < 20 && !host.calls.some(([kind]) => kind === 'control'); i += 1) await tick();
  await tick();
  await tick();
}
