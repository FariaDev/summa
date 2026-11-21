import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require=createRequire(import.meta.url);
const {buildScript,captureWindow}=require('../capture-win.cjs');

test('Windows capture targets the selected picker process, not the first app instance',()=>{
 const script=buildScript('C:\\capture.png','notepad','5272');
 assert.match(script,/Get-Process -Id 5272/);
 assert.doesNotMatch(script,/Get-Process -Name/);
});

test('Windows capture keeps the app fallback only without a selected process',()=>{
 assert.match(buildScript('C:\\capture.png','notepad'),/Get-Process -Name 'notepad'/);
});

test('Windows capture rejects malformed selected process ids instead of falling back',()=>{
 for(const id of ['',0,-1,'1;calc','1.5','4294967296']){
  assert.throws(()=>buildScript('C:\\capture.png','notepad',id),/process ID/i);
 }
});

test('Windows capture forwards the chosen process id to PowerShell',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'capture-instance-'));
 async function fakeCapture(_command,args){
  const script=fs.readFileSync(args.at(-1),'utf8');
  assert.match(script,/Get-Process -Id 5272/);
  fs.writeFileSync(path.join(dir,'attempt.png'),Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(200)]));
  return {stdout:'Second instance'};
 }
 const result=await captureWindow({processName:'notepad',processId:'5272',tmp:()=>dir,exec:fakeCapture});
 assert.equal(result.title,'Second instance');
 assert.equal(fs.existsSync(dir),false);
});
