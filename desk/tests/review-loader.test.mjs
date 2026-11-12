import test from 'node:test';
import assert from 'node:assert/strict';
import {createReviewLoader, mountReviewBoot} from '../src/review-loader.mjs';

const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

function fakeModule(calls) {
  return {
    activateReview: () => calls.push(['activate']),
    deactivateReview: () => calls.push(['deactivate']),
    openReviewFromMessage: (node) => calls.push(['message', node]),
    openReviewProposal: (payload) => calls.push(['proposal', payload]),
    cancelReviewProposal: (payload) => calls.push(['cancel', payload]),
  };
}

function fakeDesk() {
  const handles = {proposal: null, cancel: null};
  const desk = {
    onReviewProposal: (fn) => {
      handles.proposal = fn;
      return () => { handles.proposal = null; };
    },
    onReviewProposalCancel: (fn) => {
      handles.cancel = fn;
      return () => { handles.cancel = null; };
    },
  };
  return {desk, handles};
}

function deferredImport() {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  return {gate, release};
}

test('a revisão só importa quando a aba abre ou uma ação do caderno precisa dela', async () => {
  let imports = 0;
  const calls = [];
  const loader = createReviewLoader(async () => {
    imports++;
    return fakeModule(calls);
  });
  assert.equal(imports, 0);
  loader.deactivate();
  loader.cancelProposal({id: 'p0'});
  assert.equal(imports, 0, 'esconder um caderno que nunca abriu não paga o módulo');
  await loader.activate();
  assert.equal(imports, 1);
  loader.deactivate();
  await loader.openFromMessage({id: 'msg'});
  await loader.openProposal({id: 'p1'});
  loader.cancelProposal({id: 'p1'});
  assert.equal(imports, 1);
  assert.deepEqual(calls, [
    ['activate'],
    ['deactivate'],
    ['message', {id: 'msg'}],
    ['proposal', {id: 'p1'}],
    ['cancel', {id: 'p1'}],
  ]);
});

test('a proposta do tutor carrega a revisão e é repassada; cancelar antes não carrega', async () => {
  let imports = 0;
  const calls = [];
  const loader = createReviewLoader(async () => {
    imports++;
    return fakeModule(calls);
  });
  const {desk, handles} = fakeDesk();
  const unbind = mountReviewBoot({loader, desk, toast: (message) => calls.push(['toast', message])});
  handles.cancel({id: 'cedo'});
  await tick();
  assert.equal(imports, 0);
  assert.deepEqual(calls, []);
  handles.proposal({id: 'p1', question: 'Limite lateral'});
  await tick();
  assert.equal(imports, 1);
  assert.deepEqual(calls, [['proposal', {id: 'p1', question: 'Limite lateral'}]]);
  handles.cancel({id: 'p1'});
  assert.deepEqual(calls.at(-1), ['cancel', {id: 'p1'}]);
  unbind();
  assert.equal(handles.proposal, null);
  assert.equal(handles.cancel, null);
});

test('falha ao importar a revisão avisa pelo toast', async () => {
  const toasts = [];
  const loader = createReviewLoader(async () => {
    throw Error('sem caderno');
  });
  const {desk, handles} = fakeDesk();
  mountReviewBoot({loader, desk, toast: (message) => toasts.push(message)});
  handles.proposal({id: 'p1'});
  await tick();
  assert.deepEqual(toasts, ['sem caderno']);
});

test('sair do Caderno durante a carga cancela a ativação pendente', async () => {
  const calls = [];
  const {gate, release} = deferredImport();
  const loader = createReviewLoader(async () => {
    await gate;
    return fakeModule(calls);
  });
  const activating = loader.activate();
  loader.deactivate();
  release();
  await activating;
  assert.deepEqual(calls, [], 'a aba que a pessoa já deixou não abre o Caderno');
});

test('duas ativações durante a carga aplicam uma vez só', async () => {
  const calls = [];
  const {gate, release} = deferredImport();
  const loader = createReviewLoader(async () => {
    await gate;
    return fakeModule(calls);
  });
  const first = loader.activate();
  const second = loader.activate();
  release();
  await Promise.all([first, second]);
  assert.deepEqual(calls, [['activate']], 'a segunda ativação não duplica a abertura');
});

test('voltar ao Caderno durante a carga rearma a intenção', async () => {
  const calls = [];
  const {gate, release} = deferredImport();
  const loader = createReviewLoader(async () => {
    await gate;
    return fakeModule(calls);
  });
  const first = loader.activate();
  loader.deactivate();
  const second = loader.activate();
  release();
  await Promise.all([first, second]);
  assert.deepEqual(calls, [['activate']]);
});

test('proposta cancelada durante a carga não abre o diálogo', async () => {
  const calls = [];
  const {gate, release} = deferredImport();
  const loader = createReviewLoader(async () => {
    await gate;
    return fakeModule(calls);
  });
  const opening = loader.openProposal({id: 'p9', question: 'Limite'});
  loader.cancelProposal({id: 'p9'});
  release();
  await opening;
  assert.deepEqual(calls, [], 'o card que o host já descartou não aparece');
  await loader.openProposal({id: 'p10'});
  assert.deepEqual(calls, [['proposal', {id: 'p10'}]], 'a próxima proposta abre normalmente');
});
