/* #160: o resultado persistido de clone sujo vira o caso novo do Sobre —
   "nada foi atualizado" com a contagem, nunca o texto de "a versão anterior
   voltou". O caminho de quem já lê `recovered` fica igual. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';
import {message} from '../src/i18n.mjs';
import {t} from '../src/ui-text.mjs';
import {fakeAboutUpdate} from './fake-about-update.mjs';

installDom();
const {resultStateOf, updateStateOf, refreshMesaUpdate, aboutHandlers} = await import('../src/about-update.mjs');

function renderedText(node){
  return [node.textContent,...node.children.map(renderedText)].join(' ');
}

function renderedNodes(node){return [node,...node.children.flatMap(renderedNodes)];}

test('refresh automático conserva recuperação e botão explícito permite tentar de novo', async () => {
  const fake=fakeAboutUpdate({status:'recovered',version:'1.3.3',reason:'erro salvo'});
  Object.assign(window.desk,fake.desk);
  const box=document.querySelector('#about-update');
  box.replaceChildren=function(...children){this.children=children;};
  await refreshMesaUpdate(false);
  assert.match(renderedText(box),/erro salvo/);
  assert.equal(fake.checks.length,0);
  assert.ok(renderedNodes(box).some(node=>node.getAttribute('id')==='update-check'));
  await aboutHandlers.CheckUpdate();
  assert.deepEqual(fake.checks,[{manual:true}]);
  assert.doesNotMatch(renderedText(box),/erro salvo/);
  assert.match(renderedText(box),/1.3.3/);
});

test('refresh automático sem resultado ou com sucesso mantém a checagem normal', async () => {
  for(const result of [null,{status:'applied',version:'1.3.3'}]){
    const fake=fakeAboutUpdate(result);
    Object.assign(window.desk,fake.desk);
    await refreshMesaUpdate(false);
    assert.deepEqual(fake.checks,[{manual:false}]);
  }
});

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

test('resultado recuperado traduz o motivo marcado antes de chegar à view', () => {
  for (const key of ['err.update.dmgStillOpen', 'err.update.installerFailed', 'err.update.appImageFailed']) {
    assert.deepEqual(
      resultStateOf({status: 'recovered', version: '1.3.3', reason: message(key)}),
      {$: 'UpdateRecovered', version: '1.3.3', reason: t(key)},
    );
  }
  assert.equal(resultStateOf({status: 'recovered'}).reason, '');
});

/* #21: a checagem marca a instalação vinda do repositório antigo; o Sobre
   mostra o aviso de reinstalar no lugar do botão que recusaria. */
test('#21: versão nova em instalação do repositório antigo vira UpdateLegacyOrigin', () => {
  assert.deepEqual(
    updateStateOf({status: 'legacy-origin', version: '1.3.0'}),
    {$: 'UpdateLegacyOrigin'},
  );
});

test('#21: versão nova em instalação normal continua UpdateReady', () => {
  assert.deepEqual(
    updateStateOf({status: 'update', version: '1.3.0', notes: '', url: ''}),
    {$: 'UpdateReady', version: '1.3.0', notes: '', url: ''},
  );
});
