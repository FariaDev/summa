import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tempDir} from './temp-dir.mjs';
import {xournalMenuAvailable} from '../src/study/xournal-menu.mjs';
import tabsCore from '../src/generated/tabsview.core.js';

const require=createRequire(import.meta.url);
const {loadBootConfig}=require('../desk-boot-config.cjs');
const {linuxXournalPath}=require('../xournal-path.cjs');
const {seedConfig}=require('../config.cjs');

function fakeExecutable(root,name='xournalpp'){
 const executable=path.join(root,name);
 fs.copyFileSync(new URL('./fake-xournalpp.mjs',import.meta.url),executable);
 fs.chmodSync(executable,0o755);
 return executable;
}

test('fresh isolated Linux config detects Xournal++ on PATH', {skip:process.platform!=='linux'},()=>{
 const root=tempDir('xournal-detection');
 const executable=fakeExecutable(root);
 const config=loadBootConfig({configFile:path.join(root,'config.json'),persist:false,env:{PATH:root,LEARNING_VAULT:root,LEARNING_DESK_RUNTIME:root}});
 assert.equal(config.xournalPath,executable);
});

test('Linux detection checks PATH before common executable locations',{skip:process.platform!=='linux'},()=>{
 const root=tempDir('xournal-path');
 const executable=fakeExecutable(root);
 const fallback=fakeExecutable(root,'fallback');
 assert.equal(linuxXournalPath({env:{PATH:root},candidates:[fallback]}),executable);
 assert.equal(linuxXournalPath({env:{PATH:''},candidates:[fallback]}),fallback);
});

test('Linux detection ignores missing, non-executable and directory candidates',{skip:process.platform!=='linux'},()=>{
 const root=tempDir('xournal-unavailable');
 const nonExecutable=path.join(root,'xournalpp');
 fs.writeFileSync(nonExecutable,'not executable',{mode:0o644});
 assert.equal(linuxXournalPath({env:{PATH:root},candidates:[path.join(root,'missing'),nonExecutable,root]}),'');
 assert.equal(linuxXournalPath({env:{PATH:'.'},candidates:[]}),'');
});

test('Linux seed detects executable but an explicit saved path is preserved', {skip:process.platform!=='linux'},()=>{
 const root=tempDir('xournal-seed');
 const executable=fakeExecutable(root);
 const previous=process.env.PATH;
 try{
  process.env.PATH=root;
  assert.equal(seedConfig().xournalPath,executable);
 }finally{if(previous===undefined)delete process.env.PATH;else process.env.PATH=previous;}
 const configFile=path.join(root,'config.json');
 fs.writeFileSync(configFile,JSON.stringify({xournalPath:'/custom/xournalpp'}));
 const config=loadBootConfig({configFile,persist:false,env:{PATH:root}});
 assert.equal(config.xournalPath,'/custom/xournalpp');
});

test('Xournal++ menu availability preserves macOS/Windows behavior and hides missing Linux installs',()=>{
 for(const platform of ['linux','win32','darwin']){
  assert.equal(xournalMenuAvailable({platform,xournalPath:'/xournalpp'}),true);
  assert.equal(xournalMenuAvailable({platform,xournalPath:''}),platform==='darwin');
  assert.equal(xournalMenuAvailable({platform,xournalPath:'/xournalpp',desk:{xournal:false}}),false);
 }
 const view=tabsCore.xournalItem(xournalMenuAvailable({platform:'linux',xournalPath:''}),false,false);
 const attrs=[];
 for(let node=view.attrs;node?.$==='Con';node=node.tail)attrs.push(node.head.name);
 assert.ok(attrs.includes('hidden'));
});
