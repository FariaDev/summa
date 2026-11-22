// @ts-check
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const signature=require('./updater-signature.cjs');
const {defaultFetchBuffer}=require('./updater-check.cjs');
const installer=require('./windows-installer-update.cjs');
const {downloadReleaseFile,fetchReleaseFile}=require('./update-download.cjs');
const {message:uiMsg}=require('./src/i18n.mjs');
const {causeArg}=require('./src/error-detail.mjs');

/* O helper roda de uma cópia em `dir`; o `src/i18n.mjs` vai ao lado para os erros dele chegarem traduzíveis ao Sobre. */
const WORKER_FILES=['macos-dmg-worker.cjs','src/i18n.mjs'];

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
  await downloadDmg({url:urls.dmg,partial,declared,fetchInstaller,version:manifest.version});
  fs.renameSync(partial,file);
  return {file};
 }catch(error){fs.rmSync(dir,{recursive:true,force:true});throw error;}
}

async function downloadDmg({url,partial,declared,fetchInstaller,version}){
 try{
  const response=await fetchInstaller(url);
  if(!response.ok||!response.body)throw Error(`HTTP ${response.status}`);
  signature.assertDmgMatches(await downloadReleaseFile({response,partial,maxBytes:declared.dmgBytes}),declared);
 }catch(error){throw Error(uiMsg('err.update.dmgDownload',{version,error:causeArg(error)}));}
}

/** Verifica o destino sem fechar o app. @param {string} app @returns {void} @example assertWritableBundle(app) */
function assertWritableBundle(app){
 const parent=path.dirname(app);
 try{
  fs.accessSync(parent,fs.constants.W_OK);
  const probe=fs.mkdtempSync(path.join(parent,'.summa-write-'));
  fs.rmdirSync(probe);
 }catch(error){throw Error(uiMsg('err.update.dmgNotWritable',{error:causeArg(error)}));}
}

/**
 * Inicia uma cópia independente do helper com o Node do próprio Electron.
 * @param {{file:string,app:string,dir:string,version:string,lockFile:string,pid?:number,executable?:string,env?:NodeJS.ProcessEnv,spawnFn?:typeof spawn}} input
 * @returns {Promise<import('node:child_process').ChildProcess>}
 * @example await launchDmgUpdate({file,app,dir,version,lockFile})
 */
function launchDmgUpdate({file,app,dir,version,lockFile,pid=process.pid,executable=process.execPath,env=process.env,spawnFn=spawn}){
 const worker=path.join(dir,'macos-dmg-worker.cjs'),input=path.join(dir,'input.json');
 for(const rel of WORKER_FILES){
  fs.mkdirSync(path.dirname(path.join(dir,rel)),{recursive:true});
  fs.copyFileSync(path.join(__dirname,rel),path.join(dir,rel));
 }
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

/**
 * Conserva o motivo salvo pelo helper antes de limpar o download na reabertura.
 * @param {Parameters<typeof installer.settleInstallerUpdate>[0]} input
 * @returns {ReturnType<typeof installer.settleInstallerUpdate>}
 * @example await settleInstallerUpdate({cacheFile,current,dir,failureReason})
 */
function settleInstallerUpdate(input){
 let reason='';
 if(input.dir){try{reason=fs.readFileSync(path.join(input.dir,'error'),'utf8').trim();}catch{}}
 return installer.settleInstallerUpdate({...input,failureReason:reason||input.failureReason});
}

module.exports={WORKER_FILES,prepareDmgUpdate,assertWritableBundle,launchDmgUpdate,waitForDmgReady,
 markInstallerPending:installer.markInstallerPending,clearInstallerPending:installer.clearInstallerPending,settleInstallerUpdate};
