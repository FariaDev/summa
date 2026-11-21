import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tempDir, cleanup} from './study-backup-fixtures.mjs';
import {windowsPackage} from './windows-package-fixture.mjs';

const require = createRequire(import.meta.url);
const packages = require('../src/study-data/packages.cjs');
const {adoptPackage} = require('../src/study-data/adopt-package.cjs');
const {createCourseStateHost} = require('../course-state-host.cjs');

test('Windows package bookmarks survive import and the course-state visibility filter', () => {
  const root = tempDir('windows-package');
  try {
    const result = packages.importPackage({buffer: windowsPackage(), destination: path.join(root, 'imported'), courseId: 'new-course'});
    const pdf = path.join(result.materialsDir, 'aula.pdf');
    assert.ok(fs.existsSync(pdf));
    adoptPackage({runtime: root, result, writeConfiguration() {}});
    const host = createCourseStateHost({runtime: root, live: {courseId: result.courseId}, allowed: new Set([pdf])});
    assert.deepEqual(host.bookmarksPayload(), [{name: 'Limites', path: pdf, page: 7}]);
  } finally {
    cleanup(root);
  }
});

test('source path flavors remap nested paths without matching sibling roots', () => {
  const newBase = path.resolve('destination');
  for (const oldBase of ['C:\\Users\\Student\\Algebra', 'C:/Users/Student/Algebra', '\\\\server\\share\\Algebra', '/home/student/Algebra']) {
    const sourcePath = oldBase.startsWith('/') ? path.posix : path.win32;
    const input = {nested: [sourcePath.join(oldBase, 'chapter', 'a.pdf')], root: oldBase,
      sibling: `${oldBase}-other/a.pdf`, empty: '', absent: null};
    assert.deepEqual(packages.remapValue(input, {oldBase, newBase}), {...input,
      nested: [path.join(newBase, 'chapter', 'a.pdf')], root: newBase});
  }
  assert.deepEqual(packages.remapValue([], {oldBase: '', newBase}), []);
  assert.equal(packages.remapValue('unchanged', {mappings: [null, {}]}), 'unchanged');
});
