import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';

installDom();
const {createFreeStudyLoader, mountFreeStudyBoot} = await import('../src/free-study-loader.mjs');

const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

function fakeModule(calls) {
  return {
    initFreeStudy: () => calls.push(['init']),
    openTutorPdfDialog: (seed) => calls.push(['open', seed]),
    receiveFreeWorkspace: (data) => calls.push(['workspace', data]),
    receiveFreeTutorMaterial: (data) => calls.push(['material', data]),
  };
}

function workspaceEvent(detail) {
  return Object.assign(new Event('desk-workspace'), {detail});
}

function fakeWindow() {
  const win = new EventTarget();
  const material = [];
  win.desk = {
    onTutorMaterial: (fn) => {
      material.push(fn);
      return () => material.splice(material.indexOf(fn), 1);
    },
  };
  return {win, material};
}

test('a aba Livre só importa no primeiro uso e inicializa uma vez', async () => {
  let imports = 0;
  const calls = [];
  const loader = createFreeStudyLoader(async () => {
    imports++;
    return fakeModule(calls);
  });
  assert.equal(imports, 0);
  await loader.openTutorPdfDialog('Lista 3');
  await loader.receiveWorkspace({courseId: 'mesa-free'});
  await loader.receiveTutorMaterial({status: 'prepared'});
  assert.equal(imports, 1);
  assert.deepEqual(calls, [
    ['init'],
    ['open', 'Lista 3'],
    ['workspace', {courseId: 'mesa-free'}],
    ['material', {status: 'prepared'}],
  ]);
});

test('workspace de matéria não carrega a aba; o livre carrega e recebe o mesmo estado', async () => {
  let imports = 0;
  const calls = [];
  const loader = createFreeStudyLoader(async () => {
    imports++;
    return fakeModule(calls);
  });
  const {win} = fakeWindow();
  const unbind = mountFreeStudyBoot({loader, window: win, state: {workspace: {kind: 'course'}}, toast: () => {}});
  win.dispatchEvent(workspaceEvent({courseId: 'calc', workspace: {kind: 'course'}}));
  await tick();
  assert.equal(imports, 0);
  const free = {courseId: 'mesa-free', workspace: {kind: 'free'}};
  win.dispatchEvent(workspaceEvent(free));
  await tick();
  assert.equal(imports, 1);
  assert.deepEqual(calls, [['init'], ['workspace', free]]);
  win.dispatchEvent(workspaceEvent(free));
  await tick();
  assert.equal(imports, 1, 'o módulo já carregado assume os próximos eventos');
  unbind();
});

test('o primeiro material do tutor carrega a aba e é repassado; depois o módulo assume', async () => {
  let imports = 0;
  const calls = [];
  const loader = createFreeStudyLoader(async () => {
    imports++;
    return fakeModule(calls);
  });
  const {win, material} = fakeWindow();
  const unbind = mountFreeStudyBoot({loader, window: win, state: {workspace: null}, toast: () => {}});
  const payload = {status: 'prepared', draft: {title: 'Pitágoras'}};
  material[0](payload);
  await tick();
  assert.equal(imports, 1);
  assert.deepEqual(calls, [['init'], ['material', payload]]);
  material[0]({status: 'prepared', draft: {title: 'Outro'}});
  await tick();
  assert.equal(imports, 1, 'a carga acontece uma vez');
  assert.equal(calls.filter((call) => call[0] === 'material').length, 1, 'o evento repetido fica para o ouvinte do módulo');
  unbind();
});

test('PDF preparado do tutor numa matéria comum carrega a aba e desenha o aviso', async () => {
  let imports = 0;
  const calls = [];
  const loader = createFreeStudyLoader(async () => {
    imports++;
    return fakeModule(calls);
  });
  const {win} = fakeWindow();
  const unbind = mountFreeStudyBoot({loader, window: win, state: {workspace: {kind: 'course'}}, toast: () => {}});
  const data = {courseId: 'calc', workspace: {kind: 'course'}, pdfDraft: {title: 'Pitágoras', markdown: '# ...'}};
  win.dispatchEvent(workspaceEvent(data));
  await tick();
  assert.equal(imports, 1);
  assert.deepEqual(calls, [['init'], ['workspace', data]]);
  unbind();
});

test('desk-chrome com workspace livre carrega sem redespachar estado', async () => {
  let imports = 0;
  const calls = [];
  const loader = createFreeStudyLoader(async () => {
    imports++;
    return fakeModule(calls);
  });
  const {win} = fakeWindow();
  const unbind = mountFreeStudyBoot({loader, window: win, state: {workspace: {kind: 'free'}}, toast: () => {}});
  win.dispatchEvent(new Event('desk-chrome'));
  await tick();
  assert.equal(imports, 1);
  assert.deepEqual(calls, [['init']]);
  unbind();
});

test('falha ao importar avisa pelo toast', async () => {
  const calls = [];
  const loader = createFreeStudyLoader(async () => {
    throw Error('sem aba Livre');
  });
  const {win} = fakeWindow();
  mountFreeStudyBoot({loader, window: win, state: {workspace: null}, toast: (message) => calls.push(message)});
  win.dispatchEvent(workspaceEvent({courseId: 'mesa-free'}));
  await tick();
  assert.deepEqual(calls, ['sem aba Livre']);
});

test('o desmonte tira os ouvintes de janela', async () => {
  let imports = 0;
  const loader = createFreeStudyLoader(async () => {
    imports++;
    return fakeModule([]);
  });
  const {win, material} = fakeWindow();
  const unbind = mountFreeStudyBoot({loader, window: win, state: {workspace: null}, toast: () => {}});
  unbind();
  win.dispatchEvent(workspaceEvent({courseId: 'mesa-free'}));
  await tick();
  assert.equal(imports, 0);
  assert.deepEqual(material, []);
});
