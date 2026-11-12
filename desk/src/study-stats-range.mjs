// @ts-check
/* Intervalo personalizado das Estatísticas (#124): a data civil do
   `<input type=date>` vira o mesmo número de dia que o host grava (dia local
   desde a época), e o gráfico agrupa dias em semanas ou meses quando a janela
   é longa — sem cortar nenhum dia da soma. Puro, sem DOM e sem estado: o
   painel (`study-stats.mjs`) só desenha o que sai daqui. */

/** Acima disto o gráfico deixa de desenhar uma barra por dia. */
export const DAILY_BARS = 31;
/** Acima disto a barra vira mês, em vez de semana. */
export const MONTHLY_BARS = 180;
const DAY_MS = 86400000;

/**
 * Data civil `YYYY-MM-DD` → dia desde a época (o mesmo do store). `null` para
 * formato inválido, data inexistente (31/02) ou antes de 1970.
 * @param {unknown} value
 * @returns {number | null}
 * @example dayOfIso('1970-01-02') // 1
 */
export function dayOfIso(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const number = Math.floor(time / DAY_MS);
  return number >= 0 ? number : null;
}

/**
 * Dia desde a época → data civil `YYYY-MM-DD` (para preencher o input).
 * @param {unknown} value
 * @returns {string}
 * @example isoOfDay(1) // '1970-01-02'
 */
export function isoOfDay(value) {
  const day = Math.trunc(Number(value));
  if (!Number.isFinite(day) || day < 0) return '';
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Dia civil local de agora, no mesmo domínio dos dias gravados.
 * @param {Date} [now]
 * @returns {number}
 * @example localDayOf(new Date(2026, 0, 10)) // 20463 (em qualquer fuso)
 */
export function localDayOf(now = new Date()) {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

/**
 * Intervalo inicial do seletor: os últimos 7 dias, incluindo hoje.
 * @param {number} [todayDay]
 * @returns {{start: string, end: string}}
 * @example defaultRange(100) // {start: '1970-04-04', end: '1970-04-10'}
 */
export function defaultRange(todayDay = localDayOf()) {
  const end = Number.isFinite(Number(todayDay)) && Number(todayDay) >= 0 ? Math.trunc(Number(todayDay)) : 0;
  return {start: isoOfDay(Math.max(0, end - 6)), end: isoOfDay(end)};
}

/**
 * Preenche o intervalo inicial do seletor só quando ainda está vazio.
 * @param {{value: string}} startInput
 * @param {{value: string}} endInput
 * @param {number | undefined} todayDay
 * @example ensureRangeValues(startInput, endInput, summary.today)
 */
export function ensureRangeValues(startInput, endInput, todayDay) {
  if (startInput.value && endInput.value) return;
  const range = defaultRange(todayDay);
  startInput.value = range.start;
  endInput.value = range.end;
}

/** @param {string} period @param {string} start @param {string} end */
export function rangeMissing(period, start, end) {
  return period === 'custom' && (!start || !end);
}

/** Início depois do fim, data futura ou intervalo sem estudo: a frase que a
 * tela mostra no lugar do aviso. O host manda o erro; a escolha do texto é da
 * interface.
 * @param {{range?: {error?: string} | null, totals?: {seconds?: number, sessions?: number, prompts?: number}}} summary
 * @param {(key: string) => string} translate
 * @returns {string}
 * @example rangeNotice({range: {error: 'order'}}, t) // 'A data de início está depois da data de fim.'
 */
export function rangeNotice(summary, translate) {
  const error = summary.range?.error;
  if (error === 'order') return translate('stats.range.error.order');
  if (error === 'future') return translate('stats.range.error.future');
  if (error === 'invalid') return translate('stats.range.error.invalid');
  const totals = summary.totals || {};
  const empty = !(Number(totals.seconds) > 0) && !(Number(totals.sessions) > 0) && !(Number(totals.prompts) > 0);
  return empty ? translate('stats.range.empty') : '';
}

/** @typedef {{day?: number, weekday?: string, seconds?: number, minutes?: number}} SeriesDay */
/** @typedef {{first: number, last: number, weekday: string, seconds: number, minutes: number, days: number}} ChartBucket */

const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

/** @param {SeriesDay} day @returns {ChartBucket} */
function bucketOfDay(day) {
  /* O minuto é o do grupo, arredondado uma vez: somar minutos já arredondados
     por dia inflava o total (30 s + 30 s viravam 2 min em vez de 1). */
  const seconds = numberOrZero(day.seconds) || numberOrZero(day.minutes) * 60;
  return {
    first: Math.trunc(Number(day.day) || 0),
    last: Math.trunc(Number(day.day) || 0),
    weekday: String(day.weekday || ''),
    seconds,
    minutes: Math.round(seconds / 60),
    days: 1,
  };
}

/** @param {ChartBucket} bucket @param {SeriesDay} day @returns {ChartBucket} */
function addDay(bucket, day) {
  const one = bucketOfDay(day);
  const seconds = bucket.seconds + one.seconds;
  return {
    first: bucket.first,
    last: one.last,
    weekday: bucket.weekday,
    seconds,
    minutes: Math.round(seconds / 60),
    days: bucket.days + 1,
  };
}

const monthOf = (day) => {
  const date = new Date(Math.trunc(Number(day) || 0) * DAY_MS);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
};

/**
 * Agrupa a série para o gráfico: dia até 31 pontos, semana até 180, mês
 * acima disso. A soma dos minutos e dos segundos de todos os grupos é a
 * mesma da série inteira; o primeiro e o último grupo podem ser parciais.
 * @param {SeriesDay[]} series
 * @returns {{mode: 'day' | 'week' | 'month', buckets: ChartBucket[]}}
 * @example bucketSeries(sevenDays).mode // 'day'
 */
export function bucketSeries(series) {
  const list = Array.isArray(series) ? series : [];
  if (list.length <= DAILY_BARS) return {mode: 'day', buckets: list.map(bucketOfDay)};
  const mode = list.length > MONTHLY_BARS ? 'month' : 'week';
  /** @type {ChartBucket[]} */
  const buckets = [];
  let current = null;
  let currentKey = null;
  for (let index = 0; index < list.length; index += 1) {
    const day = list[index];
    const key = mode === 'month' ? monthOf(day.day) : Math.floor(index / 7);
    if (key !== currentKey) {
      if (current) buckets.push(current);
      currentKey = key;
      current = bucketOfDay(day);
    } else if (current) {
      current = addDay(current, day);
    }
  }
  if (current) buckets.push(current);
  return {mode, buckets};
}
