'use strict';

/* Data civil do `<input type=date>` → dia desde a época, o mesmo domínio que
   `statistics.cjs` grava (dia civil local). A data não tem fuso: `Date.UTC`
   faz só a conta do calendário. Data inexistente (31/02) ou fora da época é
   recusada; quem chama transforma `null` em recado na tela. */

const DAY_MS = 86400000;

/**
 * @param {unknown} value texto `YYYY-MM-DD`
 * @returns {number | null} dia desde 1970-01-01, ou `null`
 * @example dayOfDate('1970-01-02') // 1
 */
function dayOfDate(value) {
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

/** @param {unknown} value */
function isCustomPeriod(value) {
  return value === 'custom' || value === 'personalizado';
}

module.exports = {dayOfDate, isCustomPeriod};
