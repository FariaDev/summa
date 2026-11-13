import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeIpcMain,fakeShell} from './fake-electron-shell.mjs';
import {tempDir} from './temp-dir.mjs';

/* #21: instalações por clone (modo git) e por bundle montado de clone (modo
   bundle) com `origin` no `mesa-de-estudos` nunca recebem as tags do Summa
   (histórico novo). O clique recusa ANTES de abrir o worker/git/baixar e manda
   reinstalar a partir do Summa; clone do Summa segue como antes. */
const require=createRequire(import.meta.url);
const updater=require('../updater.cjs');
const {registerUpdateHost}=require('../update-host.cjs');
const ptBR=require('../src/locales/pt-BR.json');
const en=require('../src/locales/en.json');
const {createI18n}=require('../src/i18n.mjs');

const i18n=createI18n({catalogs:{'pt-BR':ptBR,en},language:'pt-BR'});
const tmp=()=>tempDir('mesa-legacy-origin-');
const OLD='https://github.com/FariaDev/mesa-de-estudos.git';
const NEW='https://github.com/FariaDev/summa.git';

function gitClone(dir,url){
 fs.mkdirSync(path.join(dir,'.git'),{recursive:true});
 fs.writeFileSync(path.join(dir,'.git','config'),`[core]\n\tbare = false\n[remote "origin"]\n\turl = ${url}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n`);
 const desk=path.join(dir,'desk');
 fs.mkdirSync(desk,{recursive:true});
 return {root:dir,desk};
}

function bundleOf(clone,remote=OLD){
 const bundle=path.join(tmp(),'Summa.app','Contents','Resources','app');
 const desk=path.join(bundle,'desk');
 fs.mkdirSync(desk,{recursive:true});
 fs.writeFileSync(path.join(desk,'install-source.json'),JSON.stringify({path:clone,remote}));
 return desk;
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

function cacheUpdate(runtime,version='1.3.0'){
 updater.writeCache(path.join(runtime,'update.json'),{release:{at:Date.now(),version,notes:'',url:''}});
}

/* O worker real é outro processo; aqui ele só entrega o handshake esperado. */
function fakeSpawnWorker(runtime,captured){
 return (args)=>{
  captured.push(args);
  const status=path.join(runtime,'status-de-teste.json');
  fs.mkdirSync(path.dirname(status),{recursive:true});
  fs.writeFileSync(status,JSON.stringify({phase:'started'})+'\n');
  return {ok:true,script:'worker-de-teste',status};
 };
}

async function withFakeSpawn(runtime,captured,fn){
 const original=updater.spawnWorker;
 updater.spawnWorker=fakeSpawnWorker(runtime,captured);
 try{return await fn();}finally{updater.spawnWorker=original;}
}

test('update-apply: clone do mesa-de-estudos recusa antes de abrir o worker',async()=>{
 const runtime=tmp(),clone=gitClone(path.join(tmp(),'mesa-de-estudos'),OLD);
 cacheUpdate(runtime);
 const captured=[];
 await withFakeSpawn(runtime,captured,async()=>{
  const ipcMain=hostWith({runtime,deskDir:clone.desk});
  await assert.rejects(ipcMain.invoke('update-apply'),error=>{
   assert.match(error.message,/update\.legacyOrigin/,'motivo novo');
   assert.match(i18n.text(error.message),/mesa-de-estudos/);
   assert.match(i18n.text(error.message),/github\.com\/FariaDev\/summa/,'diz de onde reinstalar');
   assert.match(i18n.text(error.message),/Não apague a pasta antiga/,'os dados podem estar na pasta antiga');
   return true;
  });
 });
 assert.equal(captured.length,0,'nenhum worker aberto');
 assert.equal(fs.existsSync(path.join(runtime,'update.lock')),false,'a recusa vem antes do lock');
 assert.equal(fs.existsSync(path.join(runtime,'status-de-teste.json')),false,'nada de handshake');
});

test('update-apply: bundle montado de clone antigo também recusa',async()=>{
 const runtime=tmp(),clone=gitClone(path.join(tmp(),'mesa-de-estudos'),NEW);
 /* O registro do install-source manda: mesmo com o clone já apontando para o
    Summa, o bundle foi montado do repositório antigo. */
 const desk=bundleOf(clone.root,OLD);
 cacheUpdate(runtime);
 const captured=[];
 await withFakeSpawn(runtime,captured,async()=>{
  const ipcMain=hostWith({runtime,deskDir:desk});
  await assert.rejects(ipcMain.invoke('update-apply'),/update\.legacyOrigin/);
 });
 assert.equal(captured.length,0);
});

test('update-apply: clone do summa segue abrindo o worker como antes',async()=>{
 const runtime=tmp(),clone=gitClone(path.join(tmp(),'summa'),NEW);
 cacheUpdate(runtime);
 const captured=[];
 try{
  await withFakeSpawn(runtime,captured,async()=>{
   const ipcMain=hostWith({runtime,deskDir:clone.desk});
   assert.deepEqual(await ipcMain.invoke('update-apply'),{ok:true,version:'1.3.0'});
  });
 }finally{
  updater.releaseLock(path.join(runtime,'update.lock'));
 }
 assert.equal(captured.length,1,'o clone do Summa continua atualizando');
 assert.equal(captured[0].mode,'git');
 assert.equal(captured[0].deskDir,clone.desk);
 assert.equal(captured[0].rootDir,clone.root);
});

test('update-check: versão nova no clone antigo vira legado; no summa segue update',async()=>{
 const original=updater.checkForUpdates;
 updater.checkForUpdates=async()=>({status:'update',version:'1.3.0',notes:'',url:'',current:'1.2.0',checkedAt:Date.now()});
 try{
  const oldClone=gitClone(path.join(tmp(),'mesa-de-estudos'),OLD);
  const oldHost=hostWith({runtime:tmp(),deskDir:oldClone.desk});
  const legacy=await oldHost.invoke('update-check',{manual:true});
  assert.equal(legacy.status,'legacy-origin','o Sobre recebe o aviso, não o botão que falharia');
  assert.equal(legacy.version,'1.3.0','a versão anunciada continua no resultado');
  const newClone=gitClone(path.join(tmp(),'summa'),NEW);
  const newHost=hostWith({runtime:tmp(),deskDir:newClone.desk});
  const fresh=await newHost.invoke('update-check',{manual:true});
  assert.equal(fresh.status,'update');
 }finally{
  updater.checkForUpdates=original;
 }
});

test('update-check: sem versão nova o clone antigo continua "current"',async()=>{
 const original=updater.checkForUpdates;
 updater.checkForUpdates=async()=>({status:'current',version:'1.2.0',notes:'',url:'',current:'1.2.0',checkedAt:Date.now()});
 try{
  const clone=gitClone(path.join(tmp(),'mesa-de-estudos'),OLD);
  const ipcMain=hostWith({runtime:tmp(),deskDir:clone.desk});
  const result=await ipcMain.invoke('update-check',{manual:true});
  assert.equal(result.status,'current','o aviso só aparece quando há versão nova de verdade');
 }finally{
  updater.checkForUpdates=original;
 }
});
