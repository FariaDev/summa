/* Código de recusa do "tentar de novo" (#164) → chave do catálogo. Puro, sem
   DOM e sem Electron: o botão na janela usa a mesma tabela que o teste. */

const RETRY_FAILURE_KEYS = Object.freeze({
  RETRY_BUSY: 'talk.retry.busy',
  RETRY_UNCERTAIN: 'talk.retry.uncertain',
  RETRY_NO_TURN: 'talk.retry.noTurn',
  RETRY_NO_ENGINE_ID: 'talk.retry.noEngineId',
  RETRY_EMPTY: 'talk.retry.empty',
  RETRY_UNSUPPORTED: 'talk.retry.unsupported',
});

export const UNKNOWN_RETRY_KEY = 'talk.retry.unknown';

/**
 * A chave da frase de recusa para um código do serviço; código desconhecido cai
 * no aviso genérico, que ainda mostra o código recebido.
 * @param {unknown} code
 * @returns {string} ex.: retryFailureKey('RETRY_BUSY') // 'talk.retry.busy'
 */
export function retryFailureKey(code) {
  return RETRY_FAILURE_KEYS[String(code ?? '')] || UNKNOWN_RETRY_KEY;
}
