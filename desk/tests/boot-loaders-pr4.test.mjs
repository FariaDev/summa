import test from 'node:test';
import assert from 'node:assert/strict';
import {createSidechatLoader} from '../src/sidechat-loader.mjs';
import {createGuideLoader} from '../src/guide-loader.mjs';
import {createStudySearchLoader} from '../src/study-search-loader.mjs';
import {createPdfNotesLoader,mountPdfNotesBoot,readerSelectionSnapshot} from '../src/pdf-notes-loader.mjs';
import {createBackupPanelLoader} from '../src/backup-panel-loader.mjs';
import {createConversationLibraryLoader} from '../src/conversation-library-loader.mjs';
import {createTriageLoader} from '../src/triage-loader.mjs';
import {createActivityLoader} from '../src/activity-loader.mjs';

const slow = (module, counter) => async () => {
  counter.imports++;
  await new Promise((resolve) => setTimeout(resolve, 5));
  return module;
};

test('chat lateral: duas montagens durante o import avaliam uma vez; falha tenta de novo', async () => {
  const counter = {imports: 0, inits: 0, mounts: 0};
  const module = {initSidechat: () => { counter.inits++; }, mountSidechat: () => { counter.mounts++; return {}; }, sidechatElement: () => null, setSidechatVisible: () => {}, openSavedSidechat: () => {}};
  const sidechat = createSidechatLoader(slow(module, counter));
  assert.equal(sidechat.element(), null, 'sem carga não há nó');
  await Promise.all([sidechat.mount({}), sidechat.mount({})]);
  assert.deepEqual(counter, {imports: 1, inits: 1, mounts: 2});

  let attempts = 0;
  const flaky = createSidechatLoader(async () => { attempts++; if (attempts === 1) throw Error('disco'); return module; });
  await assert.rejects(flaky.load(), /disco/);
  await flaky.load();
  assert.equal(attempts, 2, 'a falha não fica presa');
});

test('guia: abrir duas seções durante o import aplica a última; relabel antes da carga não importa', async () => {
  const calls = [];
  let imports = 0;
  const guide = createGuideLoader(async () => {
    imports++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {openGuide: (section) => calls.push(section), relabelGuide: () => calls.push('relabel')};
  });
  guide.relabel();
  assert.equal(imports, 0);
  await Promise.all([guide.open('tutor'), guide.open('atalhos')]);
  assert.equal(imports, 1);
  assert.deepEqual(calls, ['tutor', 'atalhos']);
  guide.relabel();
  assert.deepEqual(calls, ['tutor', 'atalhos', 'relabel']);
});

test('busca de estudos: opções guardadas entram no init tardio; abertura concorrente importa uma vez', async () => {
  const seen = [];
  let imports = 0;
  const module = {initStudySearch: (options) => seen.push(['init', options.marker]), openStudySearch: () => { seen.push(['open']); return true; }, closeStudySearch: () => {}};
  const search = createStudySearchLoader(async () => { imports++; await new Promise((resolve) => setTimeout(resolve, 5)); return module; });
  search.init({marker: 'partida'});
  assert.equal(imports, 0);
  assert.deepEqual(await Promise.all([search.open(), search.open()]), [true, true]);
  assert.equal(imports, 1);
  assert.deepEqual(seen, [['init', 'partida'], ['open'], ['open']]);
});

test('anotações: abrir durante o import é uma carga só; falha tenta de novo', async () => {
  let imports = 0, opened = 0;
  const module = {initPdfNotes: () => {}, openPdfNotes: () => { opened++; return true; }, closePdfNotes: () => {}};
  const flaky = createPdfNotesLoader(async () => { imports++; if (imports === 1) throw Error('sem módulo'); return module; });
  flaky.init();
  await assert.rejects(flaky.open(), /sem módulo/);
  assert.equal(await flaky.open(), true);
  assert.equal(imports, 2);
  assert.equal(opened, 1);
});

function fakeReaderDocument() {
  let selection = null;
  const listeners = new Map();
  const panel = {querySelector: (selector) => (selector === '.pdf-select' ? {value: '/cursos/Calculo.pdf'} : null)};
  const page = {dataset: {page: '4'}};
  const layer = {closest: (selector) => (selector === '.textLayer' ? layer : selector === '.pdf-panel' ? panel : selector === '.pdf-page' ? page : null)};
  const doc = {
    defaultView: {getSelection: () => selection},
    addEventListener: (name, fn) => { listeners.set(name, fn); },
    removeEventListener: () => {},
    dispatchEvent: () => {},
  };
  const change = (next) => {
    selection = next;
    listeners.get('selectionchange')?.();
  };
  const select = () => {
    const text = {nodeType: 3, parentElement: layer};
    const range = {commonAncestorContainer: text, toString: () => '  trecho   do   pdf  '};
    change({isCollapsed: false, rangeCount: 1, getRangeAt: () => range, toString: () => ''});
  };
  const collapse = () => change({isCollapsed: true, rangeCount: 0});
  return {doc, select, collapse};
}

test('anotações: a seleção do leitor feita antes do primeiro uso chega ao init (#desempenho)', () => {
  const {doc, select} = fakeReaderDocument();
  const seen = [];
  const loader = {init: (options) => seen.push(options), open: async () => {}, close: () => {}, current: () => null, load: async () => {}};
  mountPdfNotesBoot({document: doc, notify: () => {}}, loader);
  assert.equal(readerSelectionSnapshot(doc), null, 'sem seleção não há o que guardar');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].selection(), null, 'sem seleção o init não recebe nada');
  select();
  assert.deepEqual(readerSelectionSnapshot(doc), {quote: 'trecho do pdf', page: 4, path: '/cursos/Calculo.pdf', name: 'Calculo.pdf'});
  assert.deepEqual(seen[0].selection(), {quote: 'trecho do pdf', page: 4, path: '/cursos/Calculo.pdf', name: 'Calculo.pdf'}, 'a seleção feita depois da partida e antes do import chega ao init');
});

test('anotações: seleção colapsada depois não apaga a última do leitor', () => {
  const {doc, select, collapse} = fakeReaderDocument();
  select();
  const seen = [];
  mountPdfNotesBoot({document: doc, notify: () => {}}, {init: (options) => seen.push(options), open: async () => {}, close: () => {}, current: () => null, load: async () => {}});
  collapse();
  assert.equal(seen[0].selection()?.quote, 'trecho do pdf');
});

test('backup: o painel nasce uma vez, no primeiro abrir, com o IPC da partida', async () => {
  let imports = 0, inits = 0, opened = 0;
  const module = {initBackupPanel: (doc, ipc) => { inits++; assert.equal(doc.tag, 'doc'); assert.equal(ipc.value, 7); return {abrirBackup: async () => { opened++; }, abrirCompartilhar: async () => {}}; }};
  const backup = createBackupPanelLoader(async () => { imports++; await new Promise((resolve) => setTimeout(resolve, 5)); return module; });
  backup.init({tag: 'doc'}, {value: 7});
  assert.equal(imports, 0);
  await Promise.all([backup.abrirBackup(), backup.abrirBackup()]);
  assert.deepEqual({imports, inits, opened}, {imports: 1, inits: 1, opened: 2});
});

test('biblioteca: init e open acontecem depois do import, uma vez cada', async () => {
  let imports = 0, inits = 0, opens = 0;
  const module = {initConversationLibrary: (options) => { inits++; assert.equal(options.marker, 'resume'); return {open: async () => { opens++; }}; }};
  const library = createConversationLibraryLoader({marker: 'resume'}, async () => { imports++; await new Promise((resolve) => setTimeout(resolve, 5)); return module; });
  await Promise.all([library.open(), library.open()]);
  assert.deepEqual({imports, inits, opens}, {imports: 1, inits: 1, opens: 2});
});

test('relato de problema: init uma vez e a falha tenta de novo', async () => {
  const calls = [];
  let imports = 0;
  const module = {initTriage: () => calls.push('init'), openTriage: async () => { calls.push('open'); }};
  const triage = createTriageLoader(async () => { imports++; if (imports === 1) throw Error('sem módulo'); return module; });
  await assert.rejects(triage.open(), /sem módulo/);
  assert.equal(await triage.open(), undefined);
  assert.deepEqual(calls, ['init', 'open']);
  assert.equal(imports, 2);
});

test('atividades: init conta uma vez e duas cargas concorrentes dividem o import', async () => {
  let imports = 0, inits = 0;
  const module = {initActivityHost: (options) => { inits++; assert.equal(options.marker, 'host'); return {attached: true}; }};
  const activity = createActivityLoader(async () => { imports++; await new Promise((resolve) => setTimeout(resolve, 5)); return module; });
  activity.init({marker: 'host'});
  const [one, two] = await Promise.all([activity.load(), activity.load()]);
  assert.deepEqual([one.attached, two.attached], [true, true]);
  assert.deepEqual({imports, inits}, {imports: 1, inits: 1});
});
