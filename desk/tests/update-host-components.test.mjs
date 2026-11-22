import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeIpcMain,fakeShell} from './fake-electron-shell.mjs';
import {tempDir} from './temp-dir.mjs';

/* #148: .exe, AppImage e DMG se atualizam pelo próprio app, sem o Node do
   sistema; o Sobre só lista o Node para quem roda do código. */
const require=createRequire(import.meta.url);
const {registerUpdateHost}=require('../update-host.cjs');

function macosReleaseDesk(){
 const deskDir=tempDir('summa-dmg-desk-');
 fs.writeFileSync(path.join(deskDir,'release-install.json'),JSON.stringify({kind:'macos-dmg',version:'1.4.0'}));
 return deskDir;
}

const MODES=[
 {name:'código',platform:'linux',deskDir:path.resolve(import.meta.dirname,'..'),env:{},systemNode:true},
 {name:'AppImage',platform:'linux',deskDir:'/tmp/mount/resources/app',env:{APPIMAGE:'/apps/Summa.AppImage',APPDIR:'/tmp/mount'},systemNode:false},
 {name:'instalador .exe',platform:'win32',deskDir:'C:\\Users\\ana\\AppData\\Local\\Programs\\Summa\\resources\\app',env:{LOCALAPPDATA:'C:\\Users\\ana\\AppData\\Local'},systemNode:false},
 {name:'DMG',platform:'darwin',deskDir:macosReleaseDesk(),env:{},systemNode:false},
];

for(const mode of MODES){
 test(`componentes do Sobre (${mode.name}): Node só onde o updater usa o do sistema`,async()=>{
  const ipcMain=fakeIpcMain(),runtime=tempDir('summa-components-host-');
  const host=registerUpdateHost({
   ipcMain,shell:fakeShell(),runtime,deskDir:mode.deskDir,logFile:path.join(runtime,'desk.log'),testMode:true,platform:mode.platform,env:mode.env,
   app:{isPackaged:mode.platform!=='linux'||!!mode.env.APPIMAGE,getVersion:()=>'1.4.0'},
   config:()=>({xournalPath:''}),win:()=>null,appendLog:()=>{},
   toolHost:{state:()=>({}),persist:()=>{},isBusy:()=>false,hasBridge:()=>false,relink:()=>{},fixtures:{claudeLauncher:''}},
  });
  assert.equal(host.usesSystemNode,mode.systemNode);
  const {rows}=await ipcMain.invoke('components',{manual:false});
  assert.deepEqual(rows.map(row=>row.id),mode.systemNode?['claude','node','xournal']:['claude','xournal']);
 });
}
