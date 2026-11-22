import fs from 'node:fs';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {fakeIpcMain,fakeShell} from './fake-electron-shell.mjs';
const require=createRequire(import.meta.url);
const {registerUpdateHost}=require('../update-host.cjs');

export function fakeDmgDownload(bytes,{fail=false,status=200}={}){
 const calls=[];
 const fetchInstaller=async url=>{calls.push(url);if(fail)throw Error('rede interrompida');return new Response(bytes,{status});};
 return {calls,fetchInstaller};
}

export function fakeDmgProcess({error=false}={}){
 const calls=[],child=new EventEmitter();child.exitCode=null;child.unref=()=>{};
 function spawn(file,args,options){
  calls.push({file,args,options});
  queueMicrotask(()=>child.emit(error?'error':'spawn',error?Error('EACCES'):undefined));
  return child;
 }
 return {calls,child,spawn};
}

export function fakeDmgCommands({app,dir,version='1.4.1',markerKind='macos-dmg',markerVersion=version,packageVersion=version,fail='',cancel=false}){
 const calls=[],renames=[];
 let observedReady=false;
 function run(cmd,args){
  calls.push([cmd,...args]);
  if(fail&&path.basename(cmd)===fail)throw Error(`falhou ${fail}`);
  if(path.basename(cmd)==='hdiutil'&&args[0]==='attach'){
   const payload=path.join(dir,'volume','Summa.app','Contents','Resources','app');
   fs.mkdirSync(payload,{recursive:true});
   fs.writeFileSync(path.join(payload,'package.json'),JSON.stringify({version:packageVersion}));
   fs.writeFileSync(path.join(payload,'release-install.json'),JSON.stringify({kind:markerKind,version:markerVersion}));
  }
  if(path.basename(cmd)==='ditto'){
   if(fs.existsSync(path.join(dir,'ready')))throw Error('ready antes da cópia');
   fs.cpSync(args[0],args[1],{recursive:true});
   if(cancel)fs.writeFileSync(path.join(dir,'cancel'),'cancel');
  }
 }
 function rename(from,to){
  renames.push([from,to]);
  if(fail==='swap'&&from===app+'.new')throw Error('falhou swap');
  fs.renameSync(from,to);
 }
 function pidAlive(){
  observedReady=fs.existsSync(path.join(dir,'ready'));
  return fail==='pid';
 }
 return {calls,renames,run,rename,pidAlive,waitMs:0,get observedReady(){return observedReady;}};
}

export function fakeDmgHost({runtime,deskDir,fail=''}){
 const calls=[];
 let quits=0;
 function record(name){return async input=>{calls.push(name);if(fail===name)throw Error(`falhou ${name}`);return name==='prepare'?{file:path.join(input.dir,'Summa-1.4.1.dmg')}:{};};}
 const dmgUpdate={
  assertWritableBundle(){calls.push('writable');if(fail==='writable')throw Error('pasta não gravável');},
  prepareDmgUpdate:record('prepare'),markInstallerPending:record('pending'),clearInstallerPending:record('clear'),
  launchDmgUpdate:record('launch'),waitForDmgReady:record('ready'),settleInstallerUpdate:record('settle'),
 };
 const ipcMain=fakeIpcMain();
 registerUpdateHost({ipcMain,shell:fakeShell(),runtime,deskDir,platform:'darwin',env:{},logFile:path.join(runtime,'desk.log'),testMode:false,dmgUpdate,
  app:{isPackaged:true,getVersion(){return '1.4.0';},quit(){quits++;}},config(){return {};},win(){return null;},appendLog(){},
  toolHost:{state(){return {};},persist(){},isBusy(){return false;},hasBridge(){return false;},relink(){}},
 });
 return {ipcMain,calls,get quits(){return quits;}};
}
