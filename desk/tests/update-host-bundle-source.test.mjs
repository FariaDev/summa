import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeIpcMain,fakeShell} from './fake-electron-shell.mjs';
import {tempDir} from './temp-dir.mjs';

/* #23: um Summa.app montado por `npm run install-app` numa pasta extraída do
   zip não tem `.git`. Sem `install-source.json` (instalação antiga) ou com a
   origem registrada sumida, o update-host tem de RECUSAR antes de abrir o
   worker: o modo `zip` cairia em `Contents/Resources`, fora do payload. Com a
   origem registrada e um `desk/` nela, o clique segue no modo bundle. */
const require=createRequire(import.meta.url);
const updater=require('../updater.cjs');
const {registerUpdateHost}=require('../update-host.cjs');

const tmp=()=>tempDir('mesa-update-bundle-');

/* `.app` mínimo: o update-host reconhece o bundle pelo Contents/Info.plist. */
function bundleTree({sourcePath}={}){
 const app=path.join(tmp(),'Summa.app');
 const desk=path.join(app,'Contents','Resources','app');
 fs.mkdirSync(desk,{recursive:true});
 fs.writeFileSync(path.join(app,'Contents','Info.plist'),'<?xml version="1.0"?>\n<plist version="1.0"><dict/></plist>\n');
 fs.writeFileSync(path.join(desk,'package.json'),'{"version":"1.2.0"}\n');
 fs.writeFileSync(path.join(desk,'main.cjs'),'// payload antigo\n');
 if(sourcePath)fs.writeFileSync(path.join(desk,'install-source.json'),JSON.stringify({path:sourcePath,remote:''})+'\n');
 return {app,desk};
}

/* Pasta extraída do zip: tem `desk/`, não tem `.git`. */
function zipSource(){
 const root=tmp();
 fs.mkdirSync(path.join(root,'desk'),{recursive:true});
 fs.writeFileSync(path.join(root,'desk','package.json'),'{"version":"1.2.0"}\n');
 return root;
}

function fakeSpawn(captured){
 return (args)=>{
  captured.push(args);
  const status=path.join(args.runtime,'status-de-teste.json');
  fs.mkdirSync(path.dirname(status),{recursive:true});
  fs.writeFileSync(status,JSON.stringify({phase:'started'})+'\n');
  return {ok:true,script:'worker-de-teste',status};
 };
}

function hostWith({runtime,deskDir}){
 const ipcMain=fakeIpcMain();
 registerUpdateHost({
  ipcMain,shell:fakeShell(),runtime,deskDir,logFile:path.join(runtime,'desk.log'),testMode:false,
  app:{isPackaged:true,getVersion:()=>'1.2.0',quit:()=>{}},config:()=>({}),win:()=>null,appendLog:()=>{},
  toolHost:{state:()=>({}),persist:()=>{},isBusy:()=>false,hasBridge:()=>false,relink:()=>{}},
 });
 return ipcMain;
}

function withCache(runtime){
 updater.writeCache(path.join(runtime,'update.json'),{release:{at:Date.now(),version:'1.3.0',notes:'',url:''}});
}

function releaseLock(runtime){
 updater.releaseLock(path.join(runtime,'update.lock'));
}

test('#23: bundle sem install-source.json recusa antes de abrir o worker',async()=>{
 const {desk}=bundleTree();
 const runtime=tmp();
 withCache(runtime);
 const captured=[];
 const originalSpawn=updater.spawnWorker;
 updater.spawnWorker=fakeSpawn(captured);
 try{
  const ipcMain=hostWith({runtime,deskDir:desk});
  await assert.rejects(ipcMain.invoke('update-apply'),(error)=>{
   assert.match(error.message,/err\.update\.sourceMissing/);
   return true;
  });
 }finally{
  updater.spawnWorker=originalSpawn;
  releaseLock(runtime);
 }
 assert.deepEqual(captured,[],'nenhum worker é aberto');
 assert.equal(fs.readFileSync(path.join(desk,'main.cjs'),'utf8'),'// payload antigo\n','o payload não é tocado');
});

test('#23: origem registrada que sumiu recusa antes de abrir o worker',async()=>{
 const missing=path.join(tmp(),'sumiu');
 const {desk}=bundleTree({sourcePath:missing});
 const runtime=tmp();
 withCache(runtime);
 const captured=[];
 const originalSpawn=updater.spawnWorker;
 updater.spawnWorker=fakeSpawn(captured);
 try{
  const ipcMain=hostWith({runtime,deskDir:desk});
  await assert.rejects(ipcMain.invoke('update-apply'),(error)=>{
   assert.match(error.message,/err\.update\.sourceGone/);
   return true;
  });
 }finally{
  updater.spawnWorker=originalSpawn;
  releaseLock(runtime);
 }
 assert.deepEqual(captured,[],'nenhum worker é aberto');
 assert.equal(fs.readFileSync(path.join(desk,'main.cjs'),'utf8'),'// payload antigo\n','o payload não é tocado');
});

test('#23: origem registrada sem desk/ também recusa antes do worker',async()=>{
 const semDesk=tmp();
 const {desk}=bundleTree({sourcePath:semDesk});
 const runtime=tmp();
 withCache(runtime);
 const captured=[];
 const originalSpawn=updater.spawnWorker;
 updater.spawnWorker=fakeSpawn(captured);
 try{
  const ipcMain=hostWith({runtime,deskDir:desk});
  await assert.rejects(ipcMain.invoke('update-apply'),(error)=>{
   assert.match(error.message,/err\.update\.sourceGone/);
   return true;
  });
 }finally{
  updater.spawnWorker=originalSpawn;
  releaseLock(runtime);
 }
 assert.deepEqual(captured,[],'nenhum worker é aberto');
});

test('#23: bundle com origem sem .git segue no modo bundle',async()=>{
 const source=zipSource();
 const {desk}=bundleTree({sourcePath:source});
 const runtime=tmp();
 withCache(runtime);
 const captured=[];
 const originalSpawn=updater.spawnWorker;
 updater.spawnWorker=fakeSpawn(captured);
 try{
  const ipcMain=hostWith({runtime,deskDir:desk});
  assert.deepEqual(await ipcMain.invoke('update-apply'),{ok:true,version:'1.3.0'});
 }finally{
  updater.spawnWorker=originalSpawn;
  releaseLock(runtime);
 }
 assert.equal(captured.length,1,'o clique abre o worker uma vez');
 assert.equal(captured[0].mode,'bundle');
 assert.equal(captured[0].sourceInfo.path,source);
});
