/* Intervalo personalizado das Estatísticas (#124): o dia civil do input, o
   intervalo inicial e o agrupamento do gráfico. Puro, sem Electron e sem DOM;
   o host (`study-stats.test.mjs`) prova a janela, e o painel prova a tela. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {bucketSeries, DAILY_BARS, dayOfIso, defaultRange, ensureRangeValues, isoOfDay, localDayOf, MONTHLY_BARS, rangeMissing, rangeNotice} from '../src/study-stats-range.mjs';

test('data civil vira o dia do store; data inexistente é recusada', () => {
  assert.equal(dayOfIso('1970-01-01'), 0);
  assert.equal(dayOfIso('1970-01-02'), 1);
  assert.equal(dayOfIso('2024-02-29'), 19782, '29/02 de ano bissexto existe');
  assert.equal(dayOfIso(' 2026-01-10 '), dayOfIso('2026-01-10'), 'espaço em volta não muda o dia');
  for (const bad of ['2025-02-29', '2026-02-31', '2026-13-01', '2026-00-10', '2026-01-00', '10/01/2026', '', null, 42]) {
    assert.equal(dayOfIso(bad), null, `"${bad}" não é data civil válida`);
  }
  assert.equal(dayOfIso('1969-12-31'), null, 'a época do store começa em 1970');
});

test('dia do store volta para a data civil do input', () => {
  assert.equal(isoOfDay(0), '1970-01-01');
  assert.equal(isoOfDay(19782), '2024-02-29');
  assert.equal(isoOfDay(dayOfIso('2026-01-10')), '2026-01-10');
  assert.equal(isoOfDay(-1), '');
  assert.equal(isoOfDay('x'), '');
});

test('intervalo inicial do seletor cobre os últimos 7 dias, incluindo hoje', () => {
  assert.deepEqual(defaultRange(100), {start: isoOfDay(94), end: isoOfDay(100)});
  assert.equal(dayOfIso(defaultRange(100).end) - dayOfIso(defaultRange(100).start), 6);
  assert.deepEqual(defaultRange(3), {start: isoOfDay(0), end: isoOfDay(3)}, 'perto da época não fica negativo');
});

test('dia civil local usa os componentes locais, não UTC', () => {
  const local = localDayOf(new Date(2026, 0, 10, 23, 59, 0));
  assert.equal(local, dayOfIso('2026-01-10'));
});

const seriesOf = (length, startDay = 20000) => Array.from({length}, (_, index) => ({
  day: startDay + index,
  weekday: 'qua',
  seconds: 60,
  minutes: 1,
}));

test('até 31 dias o gráfico continua com uma barra por dia', () => {
  const result = bucketSeries(seriesOf(DAILY_BARS));
  assert.equal(result.mode, 'day');
  assert.equal(result.buckets.length, DAILY_BARS);
  assert.equal(result.buckets[0].days, 1);
  assert.equal(result.buckets.at(-1).first, 20000 + DAILY_BARS - 1);
});

test('intervalo médio agrupa em semanas sem perder dia nem minuto', () => {
  const series = seriesOf(40);
  const result = bucketSeries(series);
  assert.equal(result.mode, 'week');
  assert.equal(result.buckets.length, 6, '40 dias são 5 semanas cheias e uma parcial');
  assert.equal(result.buckets[0].days, 7);
  assert.equal(result.buckets.at(-1).days, 5);
  assert.equal(result.buckets.reduce((sum, bucket) => sum + bucket.seconds, 0), 40 * 60);
  assert.equal(result.buckets.at(-1).last, series.at(-1).day, 'o último dia está no último grupo');
});

test('intervalo longo agrupa por mês, inclusive o mês parcial das pontas', () => {
  const start = dayOfIso('2026-01-20');
  const series = seriesOf(MONTHLY_BARS + 1, start);
  const result = bucketSeries(series);
  assert.equal(result.mode, 'month');
  assert.equal(result.buckets[0].first, start, 'o primeiro dia entra no primeiro grupo');
  assert.equal(result.buckets.at(-1).last, series.at(-1).day, 'o último dia entra no último grupo');
  assert.equal(result.buckets.reduce((sum, bucket) => sum + bucket.days, 0), series.length, 'nenhum dia é cortado');
  assert.equal(result.buckets.reduce((sum, bucket) => sum + bucket.seconds, 0), (MONTHLY_BARS + 1) * 60);
  assert.ok(result.buckets.length >= 7 && result.buckets.length <= 8, `181 dias cobrem 7 meses (${result.buckets.length})`);
});

test('a virada de mês separa os grupos mensais', () => {
  const start = dayOfIso('2026-01-30');
  const series = seriesOf(MONTHLY_BARS + 1, start);
  const result = bucketSeries(series);
  assert.equal(result.mode, 'month');
  assert.equal(result.buckets[0].first, start);
  assert.equal(result.buckets[0].last, dayOfIso('2026-01-31'), 'janeiro fecha no dia 31, sem invadir fevereiro');
  assert.equal(result.buckets[1].first, dayOfIso('2026-02-01'), 'fevereiro começa no dia 1');
});

test('data vazia e recados do intervalo saem do mesmo lugar', () => {
  assert.equal(rangeMissing('custom', '', '2026-01-01'), true);
  assert.equal(rangeMissing('custom', '2026-01-01', ''), true);
  assert.equal(rangeMissing('custom', '2026-01-01', '2026-01-02'), false);
  assert.equal(rangeMissing('7', '', ''), false, 'só o personalizado depende das datas');
  const translate = (key) => key;
  assert.equal(rangeNotice({range: {error: 'order'}}, translate), 'stats.range.error.order');
  assert.equal(rangeNotice({range: {error: 'future'}}, translate), 'stats.range.error.future');
  assert.equal(rangeNotice({range: {error: 'invalid'}}, translate), 'stats.range.error.invalid');
  assert.equal(rangeNotice({totals: {seconds: 0, sessions: 0, prompts: 0}}, translate), 'stats.range.empty');
  assert.equal(rangeNotice({totals: {seconds: 30}}, translate), '');
});

test('o seletor só preenche as datas quando elas estão vazias', () => {
  const start = {value: ''};
  const end = {value: ''};
  ensureRangeValues(start, end, 100);
  assert.deepEqual({start: start.value, end: end.value}, defaultRange(100));
  start.value = '2026-01-01';
  end.value = '2026-01-02';
  ensureRangeValues(start, end, 100);
  assert.equal(start.value, '2026-01-01', 'a escolha da pessoa não é sobrescrita');
});
