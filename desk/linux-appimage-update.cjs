// @ts-check
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const signature=require('./updater-signature.cjs');
const {defaultFetchBuffer}=require('./updater-check.cjs');
const {downloadReleaseFile,fetchReleaseFile}=require('./update-download.cjs');
const {message:uiMsg}=require('./src/i18n.mjs');
const {causeArg}=require('./src/error-detail.mjs');

/**
 * Reconhece o payload montado, não um clone aberto a partir do AppImage.
 * @param {{platform?:string,env?:NodeJS.ProcessEnv,deskDir:string}} input
 * @returns {boolean}
 * @example isLinuxAppImage({platform:'linux',env:{APPIMAGE:'/apps/Summa.AppImage',APPDIR:'/tmp/mount'},deskDir:'/tmp/mount/resources/app'})
 */
function isLinuxAppImage({platform=process.platform,env=process.env,deskDir}){
 if(platform!=='linux'||!env.APPIMAGE||!env.APPDIR||!path.isAbsolute(env.APPIMAGE)||!path.isAbsolute(env.APPDIR))return false;
 const relative=path.relative(env.APPDIR,deskDir);
 return !!relative&&!relative.startsWith('..')&&!path.isAbsolute(relative);
}

/**
 * Remove parciais de releases interrompidas sem seguir links nem impedir a abertura.
 * @param {string} dir pasta do AppImage instalado
 * @returns {void}
 * @example cleanupAppImagePartials('/home/ana/Applications')
 */
function cleanupAppImagePartials(dir){
 let names;
 try{names=fs.readdirSync(dir);}catch{return;}
 for(const name of names){
  const version=name.match(/\d+\.\d+\.\d+/)?.[0];
  if(!version)continue;
  try{
   if(name===`.${signature.appImageAssetName(version)}.part`)fs.rmSync(path.join(dir,name),{force:true});
  }catch{}
 }
}

/**
 * Baixa e autentica no mesmo sistema de arquivos do AppImage instalado.
 * @param {{version:string,publicKey:string,dir:string,fetchBuffer?:Function,fetchAppImage?:(url:string)=>Promise<Response>}} input
 * @returns {Promise<{file:string,manifest:object}>}
 * @example await prepareAppImageUpdate({version:'1.4.1',publicKey,dir:'/home/ana/Applications'})
 */
async function prepareAppImageUpdate({version,publicKey,dir,fetchBuffer=defaultFetchBuffer,fetchAppImage=fetchReleaseFile}){
 cleanupAppImagePartials(dir);
 const {manifest,urls}=await signature.loadSignedRelease({version,publicKey,fetchBuffer,needZip:false});
 const declared=signature.assertAppImageDeclared(manifest);
 const file=path.join(dir,`.${signature.appImageAssetName(manifest.version)}.part`);
 try{
  fs.accessSync(dir,fs.constants.W_OK|fs.constants.X_OK);
  // Criação exclusiva não segue links deixados por outro processo na pasta compartilhada.
  fs.closeSync(fs.openSync(file,'wx',0o600));
 }catch(error){throw Error(uiMsg('err.update.appImageNotWritable',{error:causeArg(error)}));}
 try{
  const response=await fetchAppImage(urls.appImage);
  if(!response.ok||!response.body)throw Error(`HTTP ${response.status}`);
  const received=await downloadReleaseFile({response,partial:file,maxBytes:declared.appImageBytes});
  signature.assertAppImageMatches(received,declared);
  fs.chmodSync(file,0o755);
  return {file,manifest};
 }catch(error){
  fs.rmSync(file,{force:true});
  throw Error(uiMsg('err.update.appImageDownload',{version:manifest.version,error:causeArg(error)}));
 }
}

/**
 * Troca atômica preservando o caminho usado pelos atalhos.
 * @param {{file:string,appImage:string}} input
 * @returns {void}
 * @example swapAppImage({file:'/apps/.Summa.part',appImage:'/apps/Summa.AppImage'})
 */
function swapAppImage({file,appImage}){
 try{fs.renameSync(file,appImage);}
 catch(error){fs.rmSync(file,{force:true});throw Error(uiMsg('err.update.appImageNotWritable',{error:causeArg(error)}));}
}

/**
 * Reabre o arquivo novo sem variáveis da montagem antiga nem modo Node.
 * @param {{appImage:string,env?:NodeJS.ProcessEnv,argv?:string[],spawnFn?:typeof spawn}} input
 * @returns {Promise<void>}
 * @example await relaunchAppImage({appImage:'/apps/Summa.AppImage'})
 */
function relaunchAppImage({appImage,env=process.env,argv=process.argv,spawnFn=spawn}){
 const cleanEnv=Object.fromEntries(Object.entries(env).filter(([key])=>!key.startsWith('APPIMAGE')&&!key.startsWith('OWD')&&!['ELECTRON_RUN_AS_NODE','APPDIR','ARGV0','LD_LIBRARY_PATH','LD_PRELOAD','GIO_EXTRA_MODULES','GSETTINGS_SCHEMA_DIR','UNION_PRELOAD'].includes(key)));
 if(env.APPIMAGE_EXTRACT_AND_RUN||argv.includes('--appimage-extract-and-run'))cleanEnv.APPIMAGE_EXTRACT_AND_RUN='1';
 return new Promise((resolve,reject)=>{
  const child=spawnFn(appImage,[],{detached:true,stdio:'ignore',env:cleanEnv,cwd:path.dirname(appImage)});
  child.once('error',reject);
  child.once('spawn',()=>{child.unref();resolve();});
 });
}

module.exports={isLinuxAppImage,cleanupAppImagePartials,prepareAppImageUpdate,swapAppImage,relaunchAppImage};
