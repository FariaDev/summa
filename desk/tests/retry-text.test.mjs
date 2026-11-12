/* Código de recusa do refazer (#164) → chave da frase. O botão da janela usa
   esta tabela; o código desconhecido não inventa frase e mostra o próprio
   código na chave genérica. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {UNKNOWN_RETRY_KEY, retryFailureKey} from '../src/retry-text.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};

const CASES = {
  RETRY_BUSY: 'talk.retry.busy',
  RETRY_UNCERTAIN: 'talk.retry.uncertain',
  RETRY_NO_TURN: 'talk.retry.noTurn',
  RETRY_NO_ENGINE_ID: 'talk.retry.noEngineId',
  RETRY_EMPTY: 'talk.retry.empty',
  RETRY_UNSUPPORTED: 'talk.retry.unsupported',
};

test('cada recusa do serviço tem a sua chave de frase', () => {
  for (const [code, key] of Object.entries(CASES)) {
    assert.equal(retryFailureKey(code), key, code);
    assert.equal(typeof ptBR[key], 'string', `${key} existe no catálogo`);
  }
});

test('código desconhecido cai no aviso genérico com o código', () => {
  for (const code of ['RETRY_NOVO', 'OPENCODE_REVERT_REFUSED', '', null, undefined]) {
    assert.equal(retryFailureKey(code), UNKNOWN_RETRY_KEY, String(code));
  }
  assert.equal(ptBR[UNKNOWN_RETRY_KEY], 'Não foi possível refazer ({code}).');
});
