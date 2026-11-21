import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {tempDir} from './temp-dir.mjs';
import {captureExitExec} from './fake-capture-win.mjs';
import {ptMatches} from './pt-text.mjs';

const require=createRequire(import.meta.url);
const {buildScript,captureWindow}=require('../capture-win.cjs');
const run=promisify(execFile);
const fixture=fileURLToPath(new URL('./fake-capture-window.ps1',import.meta.url));

test('Windows capture renders the selected HWND and never reads desktop pixels',()=>{
 const script=buildScript('C:\\capture.png','notepad',123);
 assert.doesNotMatch(script,/CopyFromScreen/);
 assert.match(script,/\$printed=\[MesaWin\]::PrintWindow\(\$p.MainWindowHandle,\$hdc,2\)/);
 assert.match(script,/if\(-not \$printed\)/);
 assert.match(script,/IsIconic/);
 assert.match(script,/SetProcessDPIAware/);
});

test('Windows capture reports failed HWND rendering and cleans up instead of attaching screen pixels',async()=>{
 const dir=tempDir('capture-render-failure-');
 await assert.rejects(captureWindow({exec:captureExitExec(6),tmp:()=>dir}),ptMatches(/PrintWindow.*false.*true/));
 assert.equal(fs.existsSync(dir),false);
});

function openWindow(role){
 const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',fixture,'-Role',role],{stdio:['ignore','pipe','pipe']});
 const ready=new Promise((resolve,reject)=>{
  let output='',errors='';
  const timer=setTimeout(()=>reject(Error(`Window ${role} did not become ready: ${errors}`)),15000);
  child.stdout.on('data',chunk=>{output+=chunk; if(output.includes('READY')){clearTimeout(timer);resolve();}});
  child.stderr.on('data',chunk=>{errors+=chunk;});
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('exit',code=>{clearTimeout(timer);reject(Error(`Window ${role} exited ${code}: ${errors}`));});
 });
 return {child,ready};
}

test('Windows real capture excludes an opaque covering window and is not blank',{skip:process.platform!=='win32',timeout:45000},async()=>{
 const dir=tempDir('capture-covered-');
 const target=openWindow('target');
 let cover;
 try{
  await target.ready;
  cover=openWindow('cover');
  await cover.ready;
  const result=await captureWindow({processName:'powershell',processId:target.child.pid,label:'Capture target'});
  const png=path.join(dir,'capture.png');
  fs.writeFileSync(png,Buffer.from(result.dataUrl.split(',')[1],'base64'));
  const {stdout}=await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',fixture,'-Role','inspect','-Png',png]);
  const pixels=JSON.parse(stdout.trim());
  assert.equal(pixels.cover,0,`Cover pixels leaked: ${JSON.stringify(pixels)}`);
  assert.ok(pixels.target>1000,`Expected rendered green target, not black/blank: ${JSON.stringify(pixels)}`);
 }finally{
  cover?.child.kill();
  target.child.kill();
 }
});
