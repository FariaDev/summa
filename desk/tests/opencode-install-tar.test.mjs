import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {trackTempDir} from './temp-dir.mjs';

const require=createRequire(import.meta.url);
const {installOpenCode,PINNED_VERSION}=require('../src/agents/opencode-install.cjs');
const {fakeOpenCodeExtract}=require('./fake-opencode-extract.cjs');

for(const env of [{SystemRoot:'D:\\Windows'},{windir:'E:\\Windows'},{}]){
 test(`installOpenCode usa o tar do Windows sem consultar PATH: ${JSON.stringify(env)}`,async()=>{
  const runtime=trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-tar-windows-')));
  const fake=fakeOpenCodeExtract(PINNED_VERSION);
  const result=await installOpenCode({runtime,platform:'win32',arch:'arm64',env,...fake});
  assert.equal(result.version,PINNED_VERSION);
  assert.equal(fake.commands[0].file,path.win32.join(env.SystemRoot||env.windir||'C:\\Windows','System32','tar.exe'));
  assert.equal(fake.commands[0].args[0],'-xzf');
  assert.equal(fake.commands[0].args[2],'-C');
 });
}
