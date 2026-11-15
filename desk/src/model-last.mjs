// @ts-check

/* Último modelo e esforço usados numa sessão OpenCode (#76): estado de
   interface, fora do `config.json`, com o mesmo formato e o mesmo saneamento
   do modelo padrão (`model-default.mjs`). A sessão nova prefere o padrão
   explícito, depois o último usado, e só então o padrão do OpenCode. */

import {normalizeModelDefault} from './model-default.mjs';

/**
 * Sanea o último modelo usado com as mesmas regras do modelo padrão (nada de
 * duplicar o saneamento). Sem provedor ou sem id, não há lembrete.
 * `normalizeModelLast({provider: 'opencode', id: 'big-pickle', effort: 'high'})`
 * → `{provider: 'opencode', id: 'big-pickle', effort: 'high'}`
 * @param {unknown} raw
 * @returns {{provider: string, id: string, effort: string}|null}
 */
export function normalizeModelLast(raw) {
  return normalizeModelDefault(raw);
}

/**
 * A escolha de modelo e esforço para uma sessão nova: o padrão explícito manda
 * sempre; sem ele, vale o último usado; sem os dois, o padrão do motor
 * (`null`, que faz a sessão abrir no padrão do OpenCode).
 * `sessionModelChoice({modelLast: {provider: 'opencode', id: 'x'}})`
 * → `{provider: 'opencode', id: 'x', effort: ''}`
 * @param {{modelDefault?: unknown, modelLast?: unknown}} [facts]
 * @returns {{provider: string, id: string, effort: string}|null}
 */
export function sessionModelChoice({modelDefault, modelLast} = {}) {
  return normalizeModelDefault(modelDefault) || normalizeModelLast(modelLast);
}
