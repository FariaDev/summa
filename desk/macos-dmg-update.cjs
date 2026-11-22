// @ts-check
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const signature=require('./updater-signature.cjs');
const {defaultFetchBuffer}=require('./updater-check.cjs');
const installer=require('./windows-installer-update.cjs');
const {downloadReleaseFile,fetchReleaseFile}=require('./update-download.cjs');

/**
 * Baixa uma imagem autenticada, sem deixar arquivos parciais em uma recusa.
 * @param {{version:string,publicKey:string,dir:string,fetchBuffer?:Function,fetchInstaller?:Function}} input
 * @returns {Promise<{file:string}>}
 * @example await prepareDmgUpdate({version:'1.4.1',publicKey,dir})
 */
async function prepareDmgUpdate({version,publicKey,dir,fetchBuffer=defaultFetchBuffer,fetchInstaller=fetchReleaseFile}){
 fs.rmSync(dir,{recursive:true,force:true});
 try{
  const {manifest,urls}=await signature.loadSignedRelease({version,publicKey,fetchBuffer,needZip:false});
  const declared=signature.assertDmgDeclared(manifest);
  fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,signature.dmgAssetName(version)),partial=file+'.part';
  const response=await fetchInstaller(urls.dmg);
  if(!response.ok||!response.body)throw Error(`DMG: HTTP ${response.status}`);
  const received=await downloadReleaseFile({response,partial,maxBytes:declared.dmgBytes});
  signature.assertDmgMatches(received,declared);
  fs.renameSync(partial,file);
  return {file};
 }catch(error){fs.rmSync(dir,{recursive:true,force:true});throw error;}
}

/** Verifica o destino sem fechar o app. @param {string} app @returns {void} @example assertWritableBundle(app) */
function assertWritableBundle(app){
 const parent=path.dirname(app);
 try{
  fs.accessSync(parent,fs.constants.W_OK);
  const probe=fs.mkdtempSync(path.join(parent,'.summa-write-'));
  fs.rmdirSync(probe);
 }catch{throw Error('A pasta da Summa não permite atualização. Mova Summa.app para uma pasta gravável em Aplicativos.');}
}

/**
 * Inicia uma cópia independente do helper com o Node do próprio Electron.
 * @param {{file:string,app:string,dir:string,version:string,lockFile:string,pid?:number,executable?:string,env?:NodeJS.ProcessEnv,spawnFn?:typeof spawn}} input
 * @returns {Promise<import('node:child_process').ChildProcess>}
 * @example await launchDmgUpdate({file,app,dir,version,lockFile})
 */
function launchDmgUpdate({file,app,dir,version,lockFile,pid=process.pid,executable=process.execPath,env=process.env,spawnFn=spawn}){
 const worker=path.join(dir,'macos-dmg-worker.cjs'),input=path.join(dir,'input.json');
 fs.copyFileSync(path.join(__dirname,'macos-dmg-worker.cjs'),worker);
 fs.writeFileSync(input,JSON.stringify({file,app,dir,version,lockFile,pid}));
 return new Promise((resolve,reject)=>{
  const child=spawnFn(executable,[worker,input],{detached:true,stdio:'ignore',env:{...env,ELECTRON_RUN_AS_NODE:'1'}});
  child.once('error',reject);
  child.once('spawn',()=>{child.unref();resolve(child);});
 });
}

/** Espera a pré-extração antes de autorizar o quit. @param {{child:any,dir:string,timeoutMs?:number}} input @returns {Promise<void>} @example await waitForDmgReady({child,dir}) */
async function waitForDmgReady({child,dir,timeoutMs}){
 try{await installer.waitForInstallerReady({child,readyFile:path.join(dir,'ready'),timeoutMs});}
 catch(error){
  fs.writeFileSync(path.join(dir,'cancel'),'cancel\n');
  if(fs.existsSync(path.join(dir,'error')))throw Error(fs.readFileSync(path.join(dir,'error'),'utf8'));
  throw error;
 }
}

module.exports={prepareDmgUpdate,assertWritableBundle,launchDmgUpdate,waitForDmgReady,
 markInstallerPending:installer.markInstallerPending,clearInstallerPending:installer.clearInstallerPending,settleInstallerUpdate:installer.settleInstallerUpdate};
