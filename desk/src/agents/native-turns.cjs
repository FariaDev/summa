'use strict';

/* Turnos do motor no descritor (#164): o `msg_…` que o servidor deu à fala
   do aluno em cada pergunta. O revert do OpenCode precisa dele para refazer
   sem duplicar a pergunta. Fica fora de `conversations.cjs` para o arquivo
   continuar abaixo do teto de 500 linhas. */

const {isPlainObject} = require('../../plain-object.cjs');

const MAX_NATIVE_TURNS = 200;
const MAX_NATIVE_TURN_ID = 200;
const boundedString = (value, max) => typeof value === 'string' && value.length <= max;

/**
 * `messageId` vazio é turno aceito sem id do motor (comando): a pergunta
 * existe, mas não dá para refazer.
 * @param {unknown} turns
 * @returns {boolean}
 * @example validateNativeTurns([{user: 'u1', messageId: 'msg_1'}]) // true
 */
function validateNativeTurns(turns) {
  return Array.isArray(turns)
    && turns.length <= MAX_NATIVE_TURNS
    && turns.every((turn) => isPlainObject(turn)
      && boundedString(turn.user, MAX_NATIVE_TURN_ID)
      && boundedString(turn.messageId, MAX_NATIVE_TURN_ID));
}

/**
 * Aplica o patch `nativeTurns` no descritor em construção.
 * @param {Record<string, unknown>} next @param {Record<string, unknown>} patch
 * @param {(text: string) => Error} patchError @param {(field: string, value: unknown, expected: string) => string} invalidValue
 * @returns {void}
 * @example patchNativeTurns(next, {nativeTurns: [{user: 'u1', messageId: 'msg_1'}]}, patchError, invalidValue);
 */
function patchNativeTurns(next, patch, patchError, invalidValue) {
  if (!Object.hasOwn(patch, 'nativeTurns')) return;
  if (patch.nativeTurns === null) { delete next.nativeTurns; return; }
  if (!validateNativeTurns(patch.nativeTurns)) {
    throw patchError(invalidValue('nativeTurns', patch.nativeTurns, `array(0..${MAX_NATIVE_TURNS}) de {user: string(0..${MAX_NATIVE_TURN_ID}), messageId: string(0..${MAX_NATIVE_TURN_ID})}|null`));
  }
  next.nativeTurns = patch.nativeTurns.map((turn) => ({user: turn.user, messageId: turn.messageId}));
}

module.exports = {MAX_NATIVE_TURNS, validateNativeTurns, patchNativeTurns};
