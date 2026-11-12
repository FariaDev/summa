/* Desenho do gráfico de Estatísticas (#34/#124): uma barra por dia ou, em
   janela longa, por semana/mês (`study-stats-range.mjs` agrupa sem cortar dia).
   Só toca no DOM que recebe; os valores e o texto de acessibilidade saem do
   mesmo grupo, para o tooltip e o leitor de tela contarem a mesma história. */
import statsCore from './generated/studystats.core.js';
import {t, text, formatDate} from './ui-text.mjs';
import {bucketSeries} from './study-stats-range.mjs';
import {wholeNat} from './bend-nat.mjs';

/**
 * @param {HTMLElement} bars
 * @param {Array<{day?: number, weekday?: string, seconds?: number, minutes?: number}>} series
 * @example renderChart(document.querySelector('#study-stats-chart'), summary.series)
 */
export function renderChart(bars, series) {
  const {mode, buckets} = bucketSeries(series);
  const max = buckets.reduce((peak, bucket) => Math.max(peak, Number(bucket.minutes) || 0), 0);
  const total = buckets.reduce((sum, bucket) => sum + (Number(bucket.minutes) || 0), 0);
  bars.replaceChildren();
  /* Sem barras o gráfico vira uma linha quieta (G1): o vão de 150 px parecia
     área não carregada. */
  if (!(total > 0)) {
    bars.setAttribute('data-empty', 'true');
    bars.append(element('p', {class: 'study-stats-empty', text: t('stats.chart.empty')}));
  } else {
    bars.removeAttribute('data-empty');
  }
  const labelStep = buckets.length > 14 ? Math.ceil(buckets.length / 8) : 1;
  const showAllValues = buckets.length <= 14;
  for (let index = 0; index < buckets.length && total > 0; index += 1) {
    const bucket = buckets[index];
    const minutes = Number(bucket.minutes) || 0;
    const peak = max > 0 && minutes === max;
    const height = max > 0 && minutes > 0 ? Math.max(4, Math.round((minutes / max) * 100)) : 0;
    const duration = text(statsCore.durationLabel(wholeNat(bucket.seconds)));
    const bar = element('div', {
      class: `study-stats-bar${minutes > 0 ? '' : ' empty'}`,
      style: minutes > 0 ? `height:${height}%` : null,
      title: chartTitle(mode, bucket, duration),
    });
    const value = element('span', {class: 'study-stats-value', text: minutes > 0 && (showAllValues || peak) ? `${minutes}` : ''});
    const label = element('span', {class: 'study-stats-day', text: index % labelStep === 0 ? chartLabel(mode, bucket) : ''});
    bars.append(element('div', {class: 'study-stats-col'}, [value, bar, label]));
  }
  const chartArgs = {days: series.length, weeks: buckets.length, months: buckets.length, total, peak: max};
  const key = mode === 'week' ? (max > 0 ? 'stats.chart.ariaWeekPeak' : 'stats.chart.ariaWeek')
    : mode === 'month' ? (max > 0 ? 'stats.chart.ariaMonthPeak' : 'stats.chart.ariaMonth')
      : (max > 0 ? 'stats.chart.ariaPeak' : 'stats.chart.aria');
  bars.setAttribute('aria-label', t(key, chartArgs));
}

function element(tag, attrs = {}, kids = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, String(value));
  }
  for (const kid of [].concat(kids)) node.append(kid);
  return node;
}

const utcDay = (day) => new Date((Number(day) || 0) * 86400000);

function chartTitle(mode, bucket, duration) {
  if (mode === 'week') {
    return t('stats.chart.weekTitle', {start: shortDate(bucket.first), end: shortDate(bucket.last), duration});
  }
  if (mode === 'month') return t('stats.chart.monthTitle', {month: longMonth(bucket.first), duration});
  return t('stats.chart.title', {weekday: text(String(bucket.weekday || '')), duration});
}

function chartLabel(mode, bucket) {
  if (mode === 'week') return shortDate(bucket.first);
  if (mode === 'month') return longMonth(bucket.first);
  return text(String(bucket.weekday || ''));
}

function shortDate(day) {
  return formatDate(utcDay(day), {day: '2-digit', month: '2-digit', timeZone: 'UTC'});
}

function longMonth(day) {
  return formatDate(utcDay(day), {month: 'short', year: 'numeric', timeZone: 'UTC'});
}
