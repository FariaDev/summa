import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeIpcMain,fakeShell} from './fake-electron-shell.mjs';
import {fakeInstallerSwitch} from './fake-installer-switch.mjs';
const require=createRequire(import.meta.url);
const {registerUpdateHost}=require('../update-host.cjs');
const {switchTarget}=require('../installer-switch.cjs');

/** Host completo com transporte IPC e troca nativa observáveis (#187). */
export function fakeInstallerSwitchHost({mode='zip',testMode=false,platform='linux',arch='x64'}={}){
 const fake=fakeInstallerSwitch(),{input}=fake,ipcMain=fakeIpcMain();
 const calls=[];
 let deskDir=input.deskDir;
 let env={};
 if(mode==='git'||mode==='legacy'){
  const git=path.join(deskDir,'..','.git');fs.mkdirSync(git);
  fs.writeFileSync(path.join(git,'config'),`[remote "origin"]\n url = https://github.com/FariaDev/${mode==='legacy'?'mesa-de-estudos':'summa'}.git\n`);
 }
 if(mode==='bundle'||mode==='unavailable'){
  const source=path.dirname(deskDir);deskDir=path.join(fake.root,'bundle');fs.mkdirSync(deskDir);
  fs.writeFileSync(path.join(deskDir,'install-source.json'),JSON.stringify({path:mode==='bundle'?source:path.join(fake.root,'missing')}));
 }
 if(mode==='dmg')fs.writeFileSync(path.join(deskDir,'release-install.json'),'{"kind":"macos-dmg"}');
 if(mode==='appimage'){env={APPIMAGE:'/apps/Summa.AppImage',APPDIR:fake.root};}
 if(mode==='exe'){env={LOCALAPPDATA:'C:\\Users\\ana\\AppData\\Local'};deskDir=env.LOCALAPPDATA+'\\Programs\\Summa\\resources\\app';}
 const nativeSwitch={switchTarget,async switchToInstaller(args){calls.push(args);return {ok:true,version:args.installed};}};
 registerUpdateHost({ipcMain,shell:fakeShell(),...input,deskDir,env,platform,arch,testMode,
  config:()=>input.config,app:{...input.app,isPackaged:true,hasSingleInstanceLock:()=>true,getVersion:()=>input.installed},
  logFile:path.join(input.runtime,'desk.log'),win:()=>null,appendLog:()=>{},nativeSwitch,
  toolHost:{state:()=>({}),persist:()=>{},isBusy:()=>false,hasBridge:()=>false,relink:()=>{}},
 });
 return {...fake,ipcMain,calls};
}
