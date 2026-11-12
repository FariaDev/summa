// Host de matéria e estado da mesa (#43 fase 2: saiu do main.cjs). Runtime
// sintético em pasta temporária; o `live` é um objeto simples no lugar do main.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnFakeXournalpp} from './fake-xournalpp-spawn.mjs';

const require = createRequire(import.meta.url);
const {createCourseStateHost} = require('../course-state-host.cjs');
const {createPdfGrants} = require('../pdf-grants.cjs');
const {historyIdentity} = require('../src/history-identity.cjs');

const dirs = [];
after(() => { for (const dir of dirs) fs.rmSync(dir, {recursive: true, force: true}); });

/** Cache do GeoGebra em memória, no formato de ggb-cache.cjs. */
function memoryGgbCache() {
  const saved = new Map();
  return {saved, persist: (id, value) => saved.set(id, value), read: id => saved.get(id) || '', remember: (id, value) => saved.set(id, value)};
}

function courseStateHost({courseStates = {}, live: liveOverrides = {}, resumeSession = (file) => file, conversationData = () => ({}), trimMessageImages, historyIdentity: identityOf} = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-course-state-'));
  dirs.push(runtime);
  const live = {config: {courses: []}, courses: [{id: 'calc', name: 'Cálculo', path: path.join(runtime, 'calc')}, {id: 'fis', name: 'Física', path: ''}],
    courseId: 'calc', course: '', session: path.join(runtime, 'a.jsonl'), state: {theme: 'dark', study: {}, pdfs: []}, win: null, freeSessionId: '',
    freeMutation: false, deferredPersist: false, lastPersist: '', languageHost: {payload: () => ({lang: 'pt-BR'})}, ...liveOverrides};
  const ggbCache = memoryGgbCache();
  const calls = [];
  const allowed = new Set();
  const host = createCourseStateHost({live, runtime, FREE_ID: '__free__', stateFile: path.join(runtime, 'desk.json'), courseStates,
    allowed, pdfGrants: createPdfGrants({allowed}), allowedXopp: new Set(), ggb: {resetRestored: () => calls.push('ggb-reset')}, ggbCache, appendLog: () => {},
    previewFile: () => '', sessionInfo: () => ({}), conversationData, piBinary: () => '', newSessionPath: (courseId) => path.join(runtime, `pi-${courseId}.jsonl`), resumeSession, freeSessionList: () => [],
    ...(trimMessageImages ? {trimMessageImages} : {}), ...(identityOf ? {historyIdentity: identityOf} : {}),
    persistFreeSession: () => calls.push('free-persist'), applyFreeCourse: () => calls.push('free-apply'), freeWorkspacePayload: () => null,
    captureAvailable: () => false, deskVersionLabel: () => 'v-teste'});
  return {host, live, runtime, courseStates, ggbCache, calls};
}

test('persist grava o desk.json da matéria e guarda o último payload', () => {
  const {host, live, runtime, courseStates} = courseStateHost();
  host.persist();
  const written = fs.readFileSync(path.join(runtime, 'desk.json'), 'utf8');
  assert.equal(JSON.parse(written).courseId, 'calc');
  assert.equal(live.lastPersist, written, 'o mesmo payload não é regravado na próxima chamada');
  assert.ok(courseStates.calc, 'o estado da matéria ativa entra em courseStates');
});

test('persist durante mutação Livre só adia; com force grava', () => {
  const {host, live, runtime} = courseStateHost({live: {freeMutation: true}});
  host.persist();
  assert.equal(live.deferredPersist, true);
  assert.equal(fs.existsSync(path.join(runtime, 'desk.json')), false);
  host.persist(true);
  assert.ok(fs.existsSync(path.join(runtime, 'desk.json')));
});

test('applyCourse troca para a matéria salva e Livre vai para o host da aba Livre', () => {
  const {host, live, calls} = courseStateHost({courseStates: {fis: {session: '/x/fis.jsonl', draft: 'equação', pdfs: []}}});
  host.applyCourse('fis');
  assert.equal(live.courseId, 'fis');
  assert.equal(live.session, '/x/fis.jsonl');
  assert.equal(live.state.draft, 'equação');
  assert.equal(live.state.theme, 'dark');
  host.applyCourse('__free__');
  assert.deepEqual(calls, ['ggb-reset', 'free-apply']);
  host.applyCourse('sumiu');
  assert.equal(live.courseId, '');
});

test('applyCourse passa a sessão salva pelo resumeSession: marcador Pi vazio não ressuscita (#93)', () => {
  const calls = [];
  const empty = path.join(os.tmpdir(), `mesa-pi-vazio-${process.pid}-${Date.now()}.jsonl`);
  fs.writeFileSync(empty, '');
  try {
    const {host, live, runtime} = courseStateHost({courseStates: {fis: {session: empty}}, resumeSession: (file, courseId) => {
      calls.push([file, courseId]);
      return file ? path.join(runtime, 'opencode-novo.json') : path.join(runtime, `pi-${courseId}.jsonl`);
    }});
    host.applyCourse('fis');
    assert.deepEqual(calls, [[empty, 'fis']], 'a troca de matéria usa a MESMA normalização da abertura');
    assert.equal(live.session, path.join(runtime, 'opencode-novo.json'));
    assert.equal(fs.readFileSync(empty, 'utf8'), '', 'o arquivo da sessão antiga nunca é tocado');
  } finally {
    fs.rmSync(empty, {force: true});
  }
});

test('rememberPdfModel lembra o modelo por matéria e ignora modelo desconhecido', () => {
  const {host} = courseStateHost();
  host.rememberPdfModel({model: 'nao-existe'});
  assert.equal(host.lastPdfModel(), null);
  const known = require('../material-model.cjs').MODEL_IDS[0];
  host.rememberPdfModel({model: known});
  assert.equal(host.lastPdfModel().model, known);
});

test('initialData manda marcador de mídia mas calcula a identidade sobre o conteúdo completo (#121)', () => {
  const messages = [{role: 'user', content: [{type: 'text', text: 'Pergunta'}, {type: 'image', data: 'aW1n', mimeType: 'image/png'}]}];
  const {host, live} = courseStateHost({live: {session: '/rt/conversations/claude-a.json'}, conversationData: () => ({messages, cards: []}), trimMessageImages: (list) => list, historyIdentity});
  const payload = host.initialData();
  assert.equal(payload.messages[0].content[1].data, undefined, 'o base64 não vai no payload');
  assert.match(payload.messages[0].content[1].url, /^mesa-history-media:hm-[0-9a-f]{32}/);
  assert.equal(payload.historyIdentity, historyIdentity({session: live.session, messages, cards: []}), 'a identidade continua sendo a do conteúdo completo');
});

test('initialData monta o payload da matéria com sessão, versão e matérias', () => {
  const {host, live} = courseStateHost();
  const payload = host.initialData();
  assert.equal(payload.course, 'Cálculo');
  assert.equal(payload.session, live.session);
  assert.equal(payload.deskVersion, 'v-teste');
  assert.deepEqual(payload.courses.map(item => item.id), ['__free__', 'calc', 'fis']);
  assert.equal(host.materialContext(), 'Cálculo');
});

test('resumePayload guarda o canônico do .xopp atrás de symlink', async () => {
  const {gzipSync} = await import('node:zlib');
  const {readNotebookPage} = await import('../src/extensions/mesa-mcp/notebook-tool.mjs');
  const {fileURLToPath} = await import('node:url');
  const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fake-xournalpp.mjs');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-course-sym-'));
  dirs.push(base);
  try {
    const xml = `<?xml version="1.0" standalone="no"?>\n<xournal version="4">\n<page width="595.00" height="842.00">\n<background type="solid" color="#ffffffff" style="plain"/>\n<layer>\n<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="100.00">Página</text>\n</layer>\n</page>\n</xournal>\n`;
    const real = path.join(base, 'real', 'aula.xopp');
    fs.mkdirSync(path.dirname(real), {recursive: true});
    fs.writeFileSync(real, gzipSync(xml));
    const link = path.join(base, 'cofre', 'aula.xopp');
    fs.mkdirSync(path.dirname(link), {recursive: true});
    fs.symlinkSync(real, link);
    const {createCourseStateHost: makeHost} = require('../course-state-host.cjs');
    const {createPdfGrants: makeGrants} = require('../pdf-grants.cjs');
    const resume = require('../resume.cjs');
    const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-course-rt-'));
    dirs.push(runtime);
    const live = {config: {courses: []}, courses: [{id: 'calc', name: 'Cálculo', path: path.join(runtime, 'calc')}], courseId: 'calc', course: '', session: path.join(runtime, 'a.jsonl'), state: {theme: 'dark', study: {}, pdfs: []}, win: null, freeSessionId: '', freeMutation: false, deferredPersist: false, lastPersist: '', languageHost: {payload: () => ({lang: 'pt-BR'})}};
    const allowedXopp = new Set();
    const allowed = new Set();
    const host = makeHost({live, runtime, FREE_ID: '__free__', stateFile: path.join(runtime, 'desk.json'), courseStates: {}, allowed, pdfGrants: makeGrants({allowed}), allowedXopp, ggb: {resetRestored: () => {}}, ggbCache: {persist: () => {}, read: () => '', remember: () => {}}, appendLog: () => {}, previewFile: () => '', sessionInfo: () => ({}), conversationData: () => ({}), resumeSession: (file) => file, freeSessionList: () => [], persistFreeSession: () => {}, applyFreeCourse: () => {}, freeWorkspacePayload: () => null, captureAvailable: () => false, deskVersionLabel: () => 'v-teste'});
    resume.saveResume(runtime, 'calc', {stopped: 'onde parei', next: 'próximo passo', xopp: link, pages: []});
    const payload = host.resumePayload();
    assert.equal(payload.xopp, link);
    assert.equal(allowedXopp.has(fs.realpathSync.native(real)), true, 'o canônico entra na lista');
    const ok = await readNotebookPage({caminho: link, pagina: 1}, {allowedXopp: [...allowedXopp], xournalPath: FAKE, spawnProcess: spawnFakeXournalpp});
    assert.equal(ok.page, 1);
  } finally {
  }
});
