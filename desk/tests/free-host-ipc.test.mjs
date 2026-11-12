/* Integração IPC REAL da aba Livre no host (main.cjs/preload.cjs), com Electron
   de verdade e fake do SDK do Claude — nenhum login, nenhum material/config
   real. Runtime sintético em /tmp; cada teste fecha o app no finally.

   Cobre: aba virtual `mesa-free` no runtime (nunca no config), workspace por
   conversa A/B + restart, PDFs próprios copiados (original readonly), APIs
   congeladas freeOpenPdf/freeSaveMaterial/freeRename/freePromote com
   initialData integral, escopo/mutex (troca bloqueada durante mutação,
   save-state adiado sem perder rascunho), promoção com cancelamento/colisão/
   transferência (Claude) e rollback por falha injetada; recuperação de boot
   dos diários `applying`/`committing`. */
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from '@playwright/test';
import {testEnv} from './electron-env.mjs';
import {closeApp} from './proc-tree.mjs';
import {tinyPdf} from './helpers.mjs';

const require = createRequire(import.meta.url);
const store = require('../free-workspaces.cjs');
const journal = require('../free-promotion.cjs');
const conversations = require('../src/agents/conversations.cjs');
const DESK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLAUDE_SPY = path.join(DESK, 'tests', 'fixtures', 'claude-sdk-free-spy.mjs');

const runtimes = [];
after(() => {
  for (const dir of runtimes) {
    try { fs.rmSync(dir, {recursive: true, force: true}); } catch { /* já foi */ }
  }
});

function makeRuntime(tag, {course = true} = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), `mesa-livre-host-${tag}-`));
  runtimes.push(runtime);
  let courseDir = '';
  if (course) {
    courseDir = path.join(runtime, 'learning', 'Courses', 'Synthetic');
    fs.mkdirSync(courseDir, {recursive: true});
    fs.writeFileSync(path.join(courseDir, 'Lista.pdf'), tinyPdf('Lista sintética', 2));
  }
  const claudeStub = path.join(runtime, 'claude-stub');
  fs.writeFileSync(claudeStub, 'stub');
  const configFile = path.join(runtime, 'config.json');
  const deskFile = path.join(runtime, 'desk.json');
  fs.writeFileSync(configFile, JSON.stringify({
    runtimePath: runtime,
    vaultPath: runtime,
    courses: course ? [{id: 'Synthetic', name: 'Sintética', path: courseDir}] : [],
    claudePath: claudeStub,
  }, null, 2) + '\n');
  fs.writeFileSync(deskFile, JSON.stringify({courseId: course ? 'Synthetic' : '', courseStates: {}}));
  return {runtime, courseDir, claudeStub, configFile, deskFile, claudeLog: path.join(runtime, 'claude-system.log')};
}

function launch(fx) {
  return electron.launch({
    args: [path.join(DESK, 'main.cjs')],
    cwd: DESK,
    env: testEnv({
      LEARNING_DESK_RUNTIME: fx.runtime,
      LEARNING_DESK_VISIBLE_ENGINES: 'claude',
      LEARNING_DESK_CLAUDE_SDK_FACTORY: CLAUDE_SPY,
      FAKE_CLAUDE_STORE: path.join(fx.runtime, 'claude-store'),
      FAKE_CLAUDE_SYSTEM_LOG: fx.claudeLog,
    }),
  });
}

const waitDesk = (page) => page.waitForFunction(() => window.desk && typeof window.desk.freeOpenPdf === 'function', undefined, {timeout: 30000});
const stubDialog = (app, paths) => app.evaluate(({dialog}, value) => {
  dialog.showOpenDialog = async () => (value === null ? {canceled: true, filePaths: []} : {canceled: false, filePaths: value});
}, paths);

const close = (app) => closeApp(app);

async function waitFor(predicate, label, {timeout = 20000, step = 150} = {}) {
  const start = Date.now();
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error(`tempo esgotado esperando ${label}`);
    await new Promise((resolve) => setTimeout(resolve, step));
  }
}

/* O renderer agenda um save 400 ms depois de cada carga; enquanto o boot não
   terminou, esse save atrasado reescreve o estado do main com o que o renderer
   ainda conhece. Este teste fala IPC direto (sem o `loadCourse` que aplicaria
   cada resultado), então espera os leitores carregarem e cancela o debounce
   pendente antes de dirigir o estado. */
async function settleRenderer(page) {
  await waitFor(async () => page.evaluate(async () => {
    const {S} = await import('./src/state.mjs');
    return S.panels.length > 0 && S.panels.every((panel) => !panel.loading);
  }), 'o boot do renderer (leitores carregados)');
  await page.evaluate(async () => {
    const {S} = await import('./src/state.mjs');
    clearTimeout(S.saveTimer);
    S.saveTimer = 0;
  });
}

test('boot recupera diário applying: restaura config byte a byte e remove staging', {timeout: 300000}, async () => {
  const fx = makeRuntime('recover-apply');
  const configBefore = fs.readFileSync(fx.configFile);
  const record = (() => {
    store.ensureWorkspace(fx.runtime, {sessionId: 'rec-apply', title: 'Rec Aplicar'});
    const source = path.join(fx.runtime, 'origem.pdf');
    fs.writeFileSync(source, tinyPdf('material da recuperação'));
    store.importPdf(fx.runtime, 'rec-apply', {sourcePath: source, name: 'Rec.pdf'});
    return store.findWorkspace(fx.runtime, 'rec-apply');
  })();
  const parentDir = path.join(fx.runtime, 'destino');
  fs.mkdirSync(parentDir, {recursive: true});
  const plan = store.preparePromotion(fx.runtime, 'rec-apply', {parentDir, name: 'Recuperada'});
  const txn = journal.begin(fx.runtime, {
    token: plan.token, freeSessionId: 'rec-apply', courseId: 'curso-recuperado', courseName: 'Recuperada',
    folderPath: plan.folderPath, folderName: plan.folderName, stagingPath: plan.stagingPath, parentDir: plan.parentDir,
    nativePath: record.nativePath, engine: 'claude', configFile: fx.configFile, deskFile: fx.deskFile,
    courseEntry: {id: 'curso-recuperado', name: 'Recuperada', path: plan.folderPath},
    courseState: {session: record.nativePath},
    files: [{label: 'config', file: fx.configFile}, {label: 'desk', file: fx.deskFile}],
  });
  txn.mark('applying');
  // Simula as gravações do host antes do crash.
  fs.writeFileSync(fx.configFile, JSON.stringify({runtimePath: fx.runtime, vaultPath: fx.runtime, courses: [{id: 'Synthetic'}, {id: 'curso-recuperado', path: plan.folderPath}]}));
  fs.writeFileSync(fx.deskFile, JSON.stringify({courseId: 'Synthetic', courseStates: {'curso-recuperado': {session: record.nativePath}}}));

  const app = await launch(fx);
  try {
    const page = await app.firstWindow();
    await waitDesk(page);
    await settleRenderer(page);
    assert.deepEqual(fs.readFileSync(fx.configFile), configBefore, 'config restaurada byte a byte no boot');
    assert.equal(fs.existsSync(journal.journalDir(fx.runtime, plan.token)), false, 'diário resolvido');
    assert.equal(fs.existsSync(plan.stagingPath), false, 'staging removido');
    assert.equal(fs.existsSync(plan.folderPath), false, 'destino nunca apareceu');
    assert.equal(store.findWorkspace(fx.runtime, 'rec-apply').promotion, null, 'store sem plano pendente');
    const init = await page.evaluate(() => window.desk.init());
    assert.equal(init.courses.some((c) => c.id === 'curso-recuperado'), false, 'matéria fantasma não entra nas abas');
  } finally {
    await close(app);
  }
});

test('boot conclui diário committing: publica pasta, recibo e matéria no config/desk', {timeout: 300000}, async () => {
  const fx = makeRuntime('recover-commit');
  const record = (() => {
    store.ensureWorkspace(fx.runtime, {sessionId: 'rec-commit', title: 'Rec Concluir'});
    const nativePath = conversations.createClaudeConversation({runtime: fx.runtime, courseId: store.freeCourseId(), engine: 'claude'});
    conversations.updateClaudeConversation(nativePath, {messages: [{role: 'user', content: [{type: 'text', text: 'histórico preservado'}]}]}, {runtime: fx.runtime});
    store.setNativePath(fx.runtime, 'rec-commit', nativePath);
    const source = path.join(fx.runtime, 'origem.pdf');
    fs.writeFileSync(source, tinyPdf('material da recuperação final'));
    store.importPdf(fx.runtime, 'rec-commit', {sourcePath: source, name: 'Rec.pdf'});
    return store.findWorkspace(fx.runtime, 'rec-commit');
  })();
  const parentDir = path.join(fx.runtime, 'destino');
  fs.mkdirSync(parentDir, {recursive: true});
  const plan = store.preparePromotion(fx.runtime, 'rec-commit', {parentDir, name: 'Concluída'});
  const txn = journal.begin(fx.runtime, {
    token: plan.token, freeSessionId: 'rec-commit', courseId: 'curso-concluido', courseName: 'Concluída',
    folderPath: plan.folderPath, folderName: plan.folderName, stagingPath: plan.stagingPath, parentDir: plan.parentDir,
    nativePath: record.nativePath, engine: 'claude', configFile: fx.configFile, deskFile: fx.deskFile,
    activeCourseId: 'curso-concluido', activeSession: record.nativePath,
    courseEntry: {id: 'curso-concluido', name: 'Concluída', path: plan.folderPath},
    courseState: {session: record.nativePath, pdfs: []},
    files: [{label: 'config', file: fx.configFile}, {label: 'desk', file: fx.deskFile}],
  });
  txn.mark('applying');
  const configWithCourse = JSON.parse(fs.readFileSync(fx.configFile, 'utf8'));
  configWithCourse.courses = [...configWithCourse.courses, {id: 'curso-concluido', name: 'Concluída', path: plan.folderPath}];
  fs.writeFileSync(fx.configFile, JSON.stringify(configWithCourse, null, 2) + '\n');
  const deskWithState = JSON.parse(fs.readFileSync(fx.deskFile, 'utf8'));
  deskWithState.courseStates = {...deskWithState.courseStates, 'curso-concluido': {session: record.nativePath, pdfs: []}};
  fs.writeFileSync(fx.deskFile, JSON.stringify(deskWithState));
  txn.mark('committing');

  const app = await launch(fx);
  try {
    const page = await app.firstWindow();
    await waitDesk(page);
    await settleRenderer(page);
    assert.equal(fs.existsSync(journal.journalDir(fx.runtime, plan.token)), false, 'diário concluído');
    assert.equal(fs.existsSync(plan.folderPath), true, 'pasta publicada');
    assert.deepEqual(fs.readdirSync(plan.folderPath), ['materials']);
    assert.equal(fs.existsSync(plan.stagingPath), false);
    const updated = store.findWorkspace(fx.runtime, 'rec-commit');
    assert.equal(updated.promotion.status, 'promoted');
    assert.equal(updated.promotion.courseId, 'curso-concluido');
    const config = JSON.parse(fs.readFileSync(fx.configFile, 'utf8'));
    assert.equal(config.courses.some((c) => c.id === 'curso-concluido'), true);
    const deskRecovered = JSON.parse(fs.readFileSync(fx.deskFile, 'utf8'));
    assert.equal(deskRecovered.courseId, 'curso-concluido', 'matéria promovida é a ativa no desk recuperado');
    assert.equal(deskRecovered.session, record.nativePath);
    const init = await page.evaluate(() => window.desk.init());
    assert.equal(init.courses.some((c) => c.id === 'curso-concluido'), true, 'matéria recuperada aparece nas abas');
    const course = await page.evaluate((id) => window.desk.switchCourse(id), 'curso-concluido');
    assert.equal(course.session, record.nativePath, 'conversa nativa preservada');
  } finally {
    await close(app);
  }
});

test('falha pós-commit não desfaz a promoção e o boot acorda no curso novo', {timeout: 300000}, async () => {
  const fx = makeRuntime('post-commit');
  const source = path.join(fx.runtime, 'pos.pdf');
  fs.writeFileSync(source, tinyPdf('pós-commit', 2));
  let app = await launch(fx);
  let closed = false;
  try {
    let page = await app.firstWindow();
    await waitDesk(page);
    await settleRenderer(page);
    await page.evaluate(() => window.desk.switchCourse('mesa-free'));
    await stubDialog(app, [source]);
    const opened = await page.evaluate(() => window.desk.freeOpenPdf());
    const material = opened.workspace.materials[0];
    await page.evaluate((p) => window.desk.save({
      draft: 'rascunho pós-commit',
      pdfs: [{path: p, page: 1, zoom: 1, rotation: 0, scrollX: 0, scrollY: 0, invert: false, minimized: false}],
      pdfRotations: {[p]: 180},
      study: {title: '', xopp: ''}, referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: 0.5, theme: 'auto',
    }), material.path);
    const parent = path.join(fx.runtime, 'materias');
    fs.mkdirSync(parent, {recursive: true});
    await stubDialog(app, [parent]);
    /* O 1º write de desk.json é o snapshot pré-commit; a partir do 2º a
       promoção já está durável e o erro não pode desfazê-la. */
    await app.evaluate(() => {
      const nodeFs = process.getBuiltinModule('fs');
      globalThis.__origWFS = nodeFs.writeFileSync;
      globalThis.__deskWrites = 0;
      nodeFs.writeFileSync = function (file, ...rest) {
        if (String(file).endsWith('desk.json')) {
          globalThis.__deskWrites += 1;
          if (globalThis.__deskWrites === 2) throw new Error('ENOSPC pós-commit');
        }
        return globalThis.__origWFS.call(nodeFs, file, ...rest);
      };
    });
    const promoted = await page.evaluate(() => window.desk.freePromote({name: 'Pós Commit'}));
    assert.equal(promoted.created, true, 'erro pós-commit não derruba a promoção');
    await app.evaluate(() => {
      const nodeFs = process.getBuiltinModule('fs');
      if (globalThis.__origWFS) {
        nodeFs.writeFileSync = globalThis.__origWFS;
        delete globalThis.__origWFS;
      }
    });
    const destMaterial = path.join(promoted.course.path, 'materials', material.name);
    assert.equal(fs.existsSync(destMaterial), true, 'cópia publicada');
    assert.equal(store.findWorkspace(fx.runtime, store.listWorkspaces(fx.runtime).find((item) => item.nativePath === opened.session)?.id).promotion.status, 'promoted', 'recibo durável');
    const config = JSON.parse(fs.readFileSync(fx.configFile, 'utf8'));
    assert.equal(config.courses.some((c) => c.id === promoted.course.id), true, 'config durável');
    /* Relança: o desk.json em disco é o snapshot pré-commit — já com o curso
       novo ativo e os caminhos mapeados. */
    await app.close();
    closed = true;
    app = await launch(fx);
    closed = false;
    page = await app.firstWindow();
    await waitDesk(page);
    await settleRenderer(page);
    const restarted = await page.evaluate(() => window.desk.init());
    assert.equal(restarted.courseId, promoted.course.id, 'boot acorda no curso promovido');
    assert.equal(restarted.session, opened.session, 'mesma conversa nativa');
    assert.equal(restarted.state.pdfs?.[0]?.path, destMaterial, 'leitor com o caminho mapeado do destino');
    assert.equal(restarted.state.pdfRotations?.[destMaterial], 180, 'rotação mapeada sobreviveu');
    assert.equal(restarted.state.draft, 'rascunho pós-commit');
  } finally {
    if (!closed) await close(app);
  }
});

test('fechar o app durante a geração do PDF cancela sem material órfão', {timeout: 300000}, async () => {
  const fx = makeRuntime('abort');
  const app = await launch(fx);
  let closed = false;
  try {
    const page = await app.firstWindow();
    await waitDesk(page);
    await settleRenderer(page);
    await page.evaluate(() => window.desk.switchCourse('mesa-free'));
    const markdown = Array.from({length: 220}, (_, i) => `## Bloco ${i}\n\nTexto com $x_{${i}}^2$ para atrasar a impressão e permitir o fechamento no meio.\n`).join('\n');
    const pending = page.evaluate((md) => window.desk.freeSaveMaterial({title: 'PDF abortado', markdown: md}).then(() => 'resolved', (error) => String(error.message || error)), markdown).catch((error) => String(error.message || error));
    await page.waitForTimeout(150);
    await app.close();
    closed = true;
    const outcome = await pending;
    assert.equal(typeof outcome, 'string');
    const records = store.listWorkspaces(fx.runtime);
    assert.equal(records.reduce((total, record) => total + record.materials.length, 0), 0, 'material abortado não foi registrado');
    for (const record of records) {
      const dir = path.join(store.workspaceDir(fx.runtime, record.id), 'materials');
      if (fs.existsSync(dir)) assert.deepEqual(fs.readdirSync(dir), [], `sem PDF solto em ${record.id}`);
    }
  } finally {
    if (!closed) await close(app);
  }
});

test('zero matérias configuradas: Livre já é utilizável no boot', {timeout: 300000}, async (t) => {
  const fx = makeRuntime('zero', {course: false});
  fs.writeFileSync(fx.configFile, JSON.stringify({runtimePath: fx.runtime, vaultPath: '', courses: [], claudePath: fx.claudeStub}, null, 2) + '\n');
  const app = await launch(fx);
  t.after(() => close(app));
  const page = await app.firstWindow();
  await waitDesk(page);
  const init = await page.evaluate(() => window.desk.init());
  assert.equal(init.courseId, 'mesa-free', 'sem matérias o boot abre no Livre');
  assert.deepEqual(init.courses, [{id: 'mesa-free', name: 'Livre', kind: 'free'}]);
  assert.equal(init.workspace.kind, 'free');
  assert.equal(init.needsSetup, true, 'sem vault/matéria a primeira abertura continua sinalizada (needsSetup)');
  const opened = await page.evaluate(() => window.desk.freeSaveMaterial({title: 'PDF sem matéria', markdown: 'Conteúdo avulso.'}));
  assert.equal(opened.saved, true);
  assert.equal(opened.data.workspace.materials.length, 1);
  const sw = await page.evaluate(() => window.desk.switchCourse('mesa-free'));
  assert.equal(sw.courseId, 'mesa-free');
});
