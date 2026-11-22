import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tempDir, write, cleanup} from './study-backup-fixtures.mjs';

const require = createRequire(import.meta.url);
const {snapshot, verifySnapshot} = require('../src/study-data/backup-snapshot.cjs');

function fakeStagingRename(failures, code = 'EPERM') {
  const fake = {calls: 0, waits: [], platform: 'win32'};
  fake.rename = (from, to) => {
    fake.calls++;
    if (fake.calls <= failures) throw Object.assign(new Error(`${code}: rename`), {code});
    fs.renameSync(from, to);
  };
  fake.wait = (ms) => fake.waits.push(ms);
  return fake;
}

for (const failures of [0, 1, 2]) {
  test(`snapshot: publica staging após ${failures} falhas transitórias no Windows`, async () => {
    const runtime = tempDir('mesa-rename-runtime');
    const root = tempDir('mesa-rename-dest');
    const fake = fakeStagingRename(failures);
    try {
      write(runtime, 'desk.json', '{}');
      const result = await snapshot({runtime, root}, fake);
      assert.equal(fake.calls, failures + 1);
      assert.deepEqual(fake.waits, [50, 100].slice(0, failures));
      assert.equal((await verifySnapshot(result.path)).ok, true);
      assert.deepEqual(fs.readdirSync(path.join(root, 'snapshots')), [result.snapshotId]);
    } finally {
      cleanup(runtime, root);
    }
  });
}

for (const [code, failures, calls] of [['EPERM', Infinity, 8], ['ENOENT', 1, 1]]) {
  test(`snapshot: falha ${code} não publica versão e remove staging`, async () => {
    const runtime = tempDir('mesa-rename-runtime');
    const root = tempDir('mesa-rename-dest');
    const fake = fakeStagingRename(failures, code);
    try {
      await assert.rejects(snapshot({runtime, root}, fake), (error) => error.message.includes(code));
      assert.equal(fake.calls, calls);
      assert.deepEqual(fs.readdirSync(path.join(root, 'snapshots')), []);
    } finally {
      cleanup(runtime, root);
    }
  });
}
