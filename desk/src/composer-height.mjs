// @ts-check
/* Altura do campo do tutor: o padrão de três linhas, o piso de duas e o teto
   de meia coluna. Só contas puras; quem mexe no DOM é o `composer-resize.mjs`.
   O campo rola por dentro, então a altura é uma escolha do aluno e não do
   conteúdo (o mesmo molde do #123, agora ajustável). */

export const COMPOSER_DEFAULT_LINES = 3;
export const COMPOSER_MIN_LINES = 2;

/** Altura de `lines` linhas do campo, em px inteiros.
 *  @param {number} lines @param {number} lineHeight
 *  @returns {number}
 *  @example composerHeightForLines(3, 24) // 72
 */
export function composerHeightForLines(lines, lineHeight) {
  const line = Number(lineHeight);
  if (!Number.isFinite(line) || line <= 0) return 0;
  return Math.round(Math.max(0, Number(lines) || 0) * line);
}

/** Piso, teto e padrão da altura para a coluna atual. O teto é metade da
 *  coluna; numa coluna baixa demais para duas linhas, o piso de duas linhas
 *  vence (o campo nunca desaparece).
 *  @param {{lineHeight:number, columnHeight:number}} facts
 *  @returns {{min:number, max:number, default:number}}
 *  @example composerHeightLimits({lineHeight:24, columnHeight:600}) // {min:48, max:300, default:72}
 */
export function composerHeightLimits({lineHeight, columnHeight}) {
  const line = Number(lineHeight);
  if (!Number.isFinite(line) || line <= 0) return {min: 0, max: Infinity, default: 0};
  const min = composerHeightForLines(COMPOSER_MIN_LINES, line);
  const half = Number(columnHeight) / 2;
  const max = Number.isFinite(half) && half > 0 ? Math.max(min, Math.round(half)) : Infinity;
  return {min, max, default: composerHeightForLines(COMPOSER_DEFAULT_LINES, line)};
}

/** Prende a altura entre o piso e o teto; valor ausente vira o padrão.
 *  @param {number} value @param {{lineHeight:number, columnHeight:number}} facts
 *  @returns {number}
 *  @example clampComposerHeight(10, {lineHeight:24, columnHeight:600}) // 48
 */
export function clampComposerHeight(value, facts) {
  const limits = composerHeightLimits(facts);
  const wanted = Number(value);
  const height = Number.isFinite(wanted) ? wanted : limits.default;
  return Math.round(Math.min(limits.max, Math.max(limits.min, height)));
}

/** Sobe (`direction` positivo) ou desce uma linha, sem passar dos limites.
 *  @param {number} value @param {number} direction @param {{lineHeight:number, columnHeight:number}} facts
 *  @returns {number}
 *  @example stepComposerHeight(72, 1, {lineHeight:24, columnHeight:600}) // 96
 */
export function stepComposerHeight(value, direction, facts) {
  const line = Number(facts.lineHeight);
  const delta = Number(direction) >= 0 ? 1 : -1;
  return clampComposerHeight(Number(value) + (Number.isFinite(line) ? line : 0) * delta, facts);
}
