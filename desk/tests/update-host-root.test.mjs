import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeIpcMain,fakeShell} from './fake-electron-shell.mjs';
import {tempDir} from './temp-dir.mjs';

/* #20: quem instala pelo zip extraído não tem `install-source.json` (o
   `install-app` só registra a origem de um clone). O `rootDir` do update-host
   tem de ser a raiz da extração — a pasta que CONTÉM `desk/` —, senão o zip da
   Release seria aplicado um nível acima e a instalação não mudaria. O prefixo
   imita o `buildReleaseZip` (desk/scripts/update-zip.mjs: `git archive
   --prefix=<nome>/`). */
const require=createRequire(import.meta.url);
const updater=require('../updater.cjs');
const {registerUpdateHost}=require('../update-host.cjs');

const tmp=()=>tempDir('mesa-update-root-');

/* Árvore igual à que sai do zip publicado: `<prefixo>/desk`, `<prefixo>/core`. */
function extractedZipTree(){
 const parent=tmp();
 const root=path.join(parent,'summa-1.2.0');
 const desk=path.join(root,'desk');
 fs.mkdirSync(path.join(desk,'src'),{recursive:true});
 fs.mkdirSync(path.join(root,'core'),{recursive:true});
 fs.writeFileSync(path.join(desk,'package.json'),'{"version":"1.2.0"}\n');
 fs.writeFileSync(path.join(desk,'main.cjs'),'// código da versão extraída\n');
 fs.writeFileSync(path.join(desk,'src','main.mjs'),'// renderer\n');
 fs.writeFileSync(path.join(root,'core','view.bend'),'// núcleo\n');
 return {root,desk};
}

/* O worker real é outro processo; aqui ele só entrega o handshake que o
   handler espera e guarda os argumentos para o teste conferir. */
function fakeSpawnWorker(runtime,captured){
 return (args)=>{
  captured.push(args);
  const status=path.join(runtime,'status-de-teste.json');
  fs.mkdirSync(path.dirname(status),{recursive:true});
  fs.writeFileSync(status,JSON.stringify({phase:'started'})+'\n');
  return {ok:true,script:'worker-de-teste',status};
 };
}

test('zip extraído sem install-source.json: rootDir é a raiz da extração',async()=>{
 const {root,desk}=extractedZipTree();
 const runtime=tmp();
 assert.equal(fs.existsSync(path.join(desk,'install-source.json')),false,'cenário: sem install-source.json');
 updater.writeCache(path.join(runtime,'update.json'),{release:{at:Date.now(),version:'1.3.0',notes:'',url:''}});
 const captured=[];
 const originalSpawn=updater.spawnWorker;
 updater.spawnWorker=fakeSpawnWorker(runtime,captured);
 try{
  const ipcMain=fakeIpcMain();
  registerUpdateHost({
   ipcMain,shell:fakeShell(),runtime,deskDir:desk,logFile:path.join(runtime,'desk.log'),testMode:false,
   app:{isPackaged:true,getVersion:()=>'1.2.0',quit:()=>{}},config:()=>({}),win:()=>null,appendLog:()=>{},
   toolHost:{state:()=>({}),persist:()=>{},isBusy:()=>false,hasBridge:()=>false,relink:()=>{}},
  });
  assert.deepEqual(await ipcMain.invoke('update-apply'),{ok:true,version:'1.3.0'});
 }finally{
  updater.spawnWorker=originalSpawn;
  updater.releaseLock(path.join(runtime,'update.lock'));
 }
 assert.equal(captured.length,1,'o clique abre o worker uma vez');
 assert.equal(captured[0].mode,'zip','sem .git e sem install-source.json a atualização é por zip');
 assert.equal(captured[0].deskDir,desk);
 assert.equal(captured[0].rootDir,root,'rootDir é a pasta que contém desk/ (a raiz extraída), não a pasta acima dela');
});
