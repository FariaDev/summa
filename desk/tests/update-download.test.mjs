import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {downloadReleaseFile} from '../update-download.cjs';
import {fakeAppImageDownload,fakeShortWritingFs} from './fake-appimage.mjs';
import {tempDir} from './temp-dir.mjs';

test('download grava cada byte mesmo quando o disco aceita só parte do chunk',async()=>{
 const bytes=Buffer.from('download com escritas curtas'),partial=path.join(tempDir('summa-write-'),'image.part');
 const response=await fakeAppImageDownload(bytes)('');
 const received=await downloadReleaseFile({response,partial,maxBytes:bytes.length,fsImpl:fakeShortWritingFs(2)});
 assert.deepEqual(fs.readFileSync(partial),bytes);
 assert.deepEqual(received,{bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
});

test('download recusa escrita sem progresso em vez de retornar hash de bytes não gravados',async()=>{
 const partial=path.join(tempDir('summa-write-error-'),'image.part');
 const response=await fakeAppImageDownload(Buffer.from('bytes'))('');
 await assert.rejects(downloadReleaseFile({response,partial,maxBytes:5,fsImpl:fakeShortWritingFs(0)}),/Escrita sem progresso/);
 assert.equal(fs.statSync(partial).size,0);
});
