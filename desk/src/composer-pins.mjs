// @ts-check
/* Ações fixas do menu Anexar (#99): a pessoa escolhe até duas ações do clipe
   para ficarem à vista na fileira do composer; o resto continua no menu. A
   preferência é estado de interface (`desk.json`), fora dos defaults do
   `config.json`. Regra de interface com consequência para o aluno cabe em JS
   com teste (ADR 0003). */

/** Teto de ações fixas: o composer precisa continuar cabendo em coluna estreita. */
export const PIN_LIMIT = 2;
/** As ações que podem ser fixadas, na ordem canônica do menu Anexar. */
export const PIN_IDS = /** @type {const} */ (['attach-file', 'phone-photo', 'check']);

/**
 * O valor é o id de uma ação fixável?
 * @param {unknown} value
 * @returns {value is 'attach-file' | 'phone-photo' | 'check'}
 */
export function isPinId(value) {
  return typeof value === 'string' && PIN_IDS.some((id) => id === value);
}

/**
 * Lê a lista gravada: só ids conhecidos, sem repetição e até `PIN_LIMIT`.
 * @param {unknown} value
 * @returns {Array<'attach-file' | 'phone-photo' | 'check'>}
 * @example normalizeComposerPins(['check', 'bogus', 'attach-file']) // ['check', 'attach-file']
 */
export function normalizeComposerPins(value) {
  /** @type {Array<'attach-file' | 'phone-photo' | 'check'>} */
  const out = [];
  if (!Array.isArray(value)) return out;
  for (const item of value) {
    if (!isPinId(item) || out.includes(item)) continue;
    if (out.length >= PIN_LIMIT) break;
    out.push(item);
  }
  return out;
}

/**
 * Fixa ou desafixa uma ação. O terceiro fixo é recusado sem mudar a lista.
 * @param {unknown} pins lista corrente (a que veio do estado)
 * @param {unknown} id ação escolhida
 * @returns {{pins: Array<'attach-file' | 'phone-photo' | 'check'>, changed: boolean, refused: boolean}}
 * @example toggleComposerPin(['check'], 'attach-file') // {pins: ['check', 'attach-file'], changed: true, refused: false}
 */
export function toggleComposerPin(pins, id) {
  const current = normalizeComposerPins(pins);
  if (!isPinId(id)) return {pins: current, changed: false, refused: false};
  if (current.includes(id)) return {pins: current.filter((pin) => pin !== id), changed: true, refused: false};
  if (current.length >= PIN_LIMIT) return {pins: current, changed: false, refused: true};
  return {pins: [...current, id], changed: true, refused: false};
}

/**
 * O que o `save-state` grava: campo ausente mantém a corrente; o resto passa
 * pelo mesmo saneamento da carga.
 * @param {unknown} current
 * @param {unknown} value
 * @returns {Array<'attach-file' | 'phone-photo' | 'check'>}
 * @example savedComposerPins(['check'], undefined) // ['check']
 */
export function savedComposerPins(current, value) {
  return value === undefined ? normalizeComposerPins(current) : normalizeComposerPins(value);
}
