import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Readable} from 'node:stream';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {tempDir, write, cleanup} from './study-backup-fixtures.mjs';

const require = createRequire(import.meta.url);
const {hashFile} = require('../src/study-data/backup-files.cjs');

function fakeReadStreamAwaitingClose() {
  const stream = new Readable({read() {}, autoDestroy: false});
  return {stream, createReadStream: () => stream};
}

for (const contents of ['conteúdo do backup', '']) {
  test(`hashFile: aguarda close depois de end (${contents ? 'com bytes' : 'vazio'})`, async (t) => {
    const fake = fakeReadStreamAwaitingClose();
    t.mock.method(fs, 'createReadStream', fake.createReadStream);
    let settled = false;
    const result = hashFile('synthetic-file').then((value) => { settled = true; return value; });
    const ended = once(fake.stream, 'end');
    fake.stream.push(Buffer.from(contents));
    fake.stream.push(null);
    await ended;
    try {
      assert.equal(settled, false, 'end não libera o descritor; precisa aguardar close');
    } finally {
      fake.stream.destroy();
    }
    assert.deepEqual(await result, {sha256: createHash('sha256').update(contents).digest('hex'), size: Buffer.byteLength(contents)});
    assert.equal(fake.stream.closed, true);
  });
}

test('hashFile: close antes de end rejeita sem devolver hash parcial', async (t) => {
  const fake = fakeReadStreamAwaitingClose();
  t.mock.method(fs, 'createReadStream', fake.createReadStream);
  const result = hashFile('synthetic-file');
  fake.stream.destroy();
  await assert.rejects(result, {code: 'ERR_STREAM_PREMATURE_CLOSE'});
});

test('hashFile: arquivo real já está fechado quando resolve; erro de leitura rejeita', async (t) => {
  const runtime = tempDir('mesa-hash-close');
  const createReadStream = fs.createReadStream;
  let observed;
  function watchingReadStream(...args) {
    observed = createReadStream(...args);
    return observed;
  }
  t.mock.method(fs, 'createReadStream', watchingReadStream);
  try {
    const file = write(runtime, 'notes.txt', 'backup');
    await hashFile(file);
    assert.equal(observed.closed, true);
    assert.equal(observed.fd, null);
    await assert.rejects(hashFile(`${file}.missing`), {code: 'ENOENT'});
  } finally {
    cleanup(runtime);
  }
});
