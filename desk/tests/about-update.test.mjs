/* #160: o resultado persistido de clone sujo vira o caso novo do Sobre —
   "nada foi atualizado" com a contagem, nunca o texto de "a versão anterior
   voltou". O caminho de quem já lê `recovered` fica igual. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';

installDom();
const {resultStateOf} = await import('../src/about-update.mjs');

test('#160: clone sujo recusado vira UpdateDirtyClone com a contagem', () => {
  assert.deepEqual(
    resultStateOf({status: 'refused', reason: 'dirty-clone', files: 3, mode: 'git', version: '0.4.1'}),
    {$: 'UpdateDirtyClone', files: '3'},
  );
});

test('#160: resultado recuperado continua no caso antigo', () => {
  assert.deepEqual(
    resultStateOf({status: 'recovered', version: '0.4.1', reason: 'npm ci morreu'}),
    {$: 'UpdateRecovered', version: '0.4.1', reason: 'npm ci morreu'},
  );
});
