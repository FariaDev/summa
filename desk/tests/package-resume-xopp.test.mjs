import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {seedRuntime, tempDir, write, read, cleanup} from './study-backup-fixtures.mjs';

const require = createRequire(import.meta.url);
const packages = require('../src/study-data/packages.cjs');
const zipkit = require('../src/study-data/zipkit.cjs');
const {adoptPackage} = require('../src/study-data/adopt-package.cjs');
const {createCourseStateHost} = require('../course-state-host.cjs');
const {createPdfGrants} = require('../pdf-grants.cjs');

function buildPackage(fixture) {
  return packages.buildPackage({
    runtime: fixture.runtime,
    course: {id: 'mat-1', name: 'Algebra Linear'},
    materialsDir: fixture.materialsDir,
    learningDir: fixture.courseDir,
    include: {review: true, bookmarks: true, resume: true, conversations: false},
  });
}

function repack(built, mutate) {
  const entries = zipkit.readZip(built.buffer).map((entry) => ({name: entry.name, data: entry.data}));
  mutate(entries);
  return zipkit.writeZip(entries, {deflate: true});
}

function replaceResume(built, fields) {
  return repack(built, (entries) => {
    const resumeEntry = entries.find((entry) => entry.name === 'payload/store/resume.json');
    assert.ok(resumeEntry, 'retomada exportada no caminho do store');
    const original = JSON.parse(resumeEntry.data.toString('utf8'));
    assert.equal(Object.hasOwn(original, built.manifest.course.sourceId), false, 'o arquivo exportado contém a fatia, não um mapa de matérias');
    const data = Buffer.from(`${JSON.stringify({...original, ...fields}, null, 2)}\n`);
    resumeEntry.data = data;
    const manifestEntry = entries.find((entry) => entry.name === packages.MANIFEST_NAME);
    const manifest = JSON.parse(manifestEntry.data.toString('utf8'));
    const declared = manifest.files.find((item) => item.archivePath === resumeEntry.name);
    declared.bytes = data.length;
    declared.sha256 = crypto.createHash('sha256').update(data).digest('hex');
    manifestEntry.data = Buffer.from(JSON.stringify(manifest));
  });
}

function resumeHost({runtime, courseId, materialsDir}) {
  const live = {
    config: {courses: []},
    courses: [{id: courseId, name: 'X', path: materialsDir}],
    courseId,
    course: materialsDir,
    session: path.join(runtime, 'a.jsonl'),
    state: {theme: 'dark', study: {}, pdfs: []},
    win: null,
    freeSessionId: '',
    freeMutation: false,
    deferredPersist: false,
    lastPersist: '',
    languageHost: {payload: () => ({lang: 'pt-BR'})},
  };
  const allowed = new Set();
  const allowedXopp = new Set();
  const host = createCourseStateHost({
    live,
    runtime,
    FREE_ID: '__free__',
    stateFile: path.join(runtime, 'desk.json'),
    courseStates: {},
    allowed,
    pdfGrants: createPdfGrants({allowed}),
    allowedXopp,
    ggb: {resetRestored: () => {}},
    ggbCache: {persist: () => {}, read: () => '', remember: () => {}},
    appendLog: () => {},
    previewFile: () => '',
    sessionInfo: () => ({}),
    conversationData: () => ({}),
    resumeSession: (file) => file,
    freeSessionList: () => [],
    persistFreeSession: () => {},
    applyFreeCourse: () => {},
    freeWorkspacePayload: () => null,
    captureAvailable: () => false,
    deskVersionLabel: () => 'v-teste',
  });
  return {host, allowedXopp};
}

test('adotar pacote não autoriza .xopp externo vindo do resume.json', () => {
  const fixture = seedRuntime();
  const root = tempDir('mesa-import');
  const runtime = tempDir('mesa-rt-adotado');
  const outsideDir = tempDir('mesa-xopp-fora');
  try {
    const outside = write(outsideDir, 'Provas/calculo.xopp', 'caderno');
    const built = buildPackage(fixture);
    const buffer = replaceResume(built, {stopped: 'onde parei', next: 'próximo passo', xopp: outside, pages: []});
    const destination = packages.planDestination({root, name: 'Algebra Linear'});
    const preview = packages.previewImport({buffer, destination});
    const result = packages.importPackage({buffer, destination, courseId: preview.courseId});
    adoptPackage({runtime, result, writeConfiguration: () => {}});

    const {host, allowedXopp} = resumeHost({runtime, courseId: result.courseId, materialsDir: result.materialsDir});
    const payload = host.resumePayload();
    assert.ok(payload);
    assert.equal(payload.xopp, '');
    assert.equal(allowedXopp.has(outside), false);
    assert.equal(allowedXopp.has(fs.realpathSync.native(outside)), false);
    assert.equal(JSON.parse(read(runtime, 'resume.json'))[result.courseId].xopp, '');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, root, runtime, outsideDir);
  }
});

test('adotar pacote preserva .xopp dentro da pasta de estudo importada', () => {
  const fixture = seedRuntime();
  const root = tempDir('mesa-import');
  const runtime = tempDir('mesa-rt-adotado');
  try {
    const sourceXopp = write(fixture.courseDir, 'estudo.xopp', 'caderno');
    const built = buildPackage(fixture);
    const buffer = replaceResume(built, {stopped: 'onde parei', next: 'próximo passo', xopp: sourceXopp, pages: []});
    const destination = packages.planDestination({root, name: 'Algebra Linear'});
    const preview = packages.previewImport({buffer, destination});
    const result = packages.importPackage({buffer, destination, courseId: preview.courseId});
    adoptPackage({runtime, result, writeConfiguration: () => {}});

    const xopp = JSON.parse(read(runtime, 'resume.json'))[result.courseId].xopp;
    assert.ok(xopp);
    assert.equal(xopp, path.join(result.learningDir, 'estudo.xopp'));
    assert.ok(xopp.startsWith(result.learningDir + path.sep));
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, root, runtime);
  }
});
