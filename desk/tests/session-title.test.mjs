/* Regressão do título da sessão: o preview da primeira fala pode trazer o
   bloco interno depois de `\n\n` ou depois de espaço simples (o host antigo
   juntava as partes da mensagem com espaço), em pt e en. O rótulo do host
   limpa o bloco pelo corte do núcleo; o título mostra só a fala, e o
   `displayUserText` do chat não corta o marcador no meio da frase. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {installDom} from './dom-shim.mjs';

installDom();
const require = createRequire(import.meta.url);
const {formatSessionLabel, sessionPreviewFromJsonl} = require('../lib.cjs');
const {sessionNameParts} = await import('../src/state.mjs');

const STARTED = 1700000000000;
const BLOCKS = [
  '[Desk context] - references open on the desk - course: Cálculo I',
  '[Contexto da Mesa] - matéria: Cálculo I',
];
const jsonl = (content) =>
  JSON.stringify({type: 'message', message: {role: 'user', content}}) + '\n';

test('título da sessão: "teste" + bloco interno vira "teste" em qualquer forma', () => {
  for (const block of BLOCKS) {
    for (const preview of [`teste ${block}`, `teste\n\n${block}`]) {
      const label = formatSessionLabel({started: STARTED, preview});
      assert.equal(sessionNameParts({label, started: STARTED}).name, 'teste', preview);
    }
  }
});

test('preview do JSONL: partes juntadas com espaço também perdem o bloco interno', () => {
  for (const block of BLOCKS) {
    const marker = block.split(' - ')[0];
    const raw = jsonl([
      {type: 'text', text: 'teste'},
      {type: 'text', text: `${marker}\n- references open on the desk`},
    ]);
    assert.equal(sessionPreviewFromJsonl(raw), 'teste', marker);
  }
});
