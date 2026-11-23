// @ts-check
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {promisify}=require('node:util');
const {execFile}=require('node:child_process');
const {writeConfigPreservingExtras}=require('./config-write.cjs');
const {readCache,isNewer}=require('./updater-core.cjs');
const worker=require('./updater-worker.cjs');
const signature=require('./updater-signature.cjs');
const windows=require('./windows-installer-update.cjs');
const linux=require('./linux-appimage-update.cjs');
const macos=require('./macos-dmg-update.cjs');
const {reopenArgs}=require('./macos-dmg-worker.cjs');
const {message,parseMessage}=require('./src/i18n.mjs');
const {causeArg}=require('./src/error-detail.mjs');
const runFile=promisify(execFile);

/**
 * Formato nativo publicado para a plataforma; o workflow macos-latest gera arm64.
 * @param {{platform?:string,arch?:string}} [input]
 * @returns {'exe'|'dmg'|'appimage'|null}
 * @example switchTarget({platform:'linux',arch:'x64'}) // 'appimage'
 */
function switchTarget({platform=process.platform,arch=process.arch}={}){
 if(platform==='win32'&&arch==='x64')return 'exe';
 if(platform==='darwin'&&arch==='arm64')return 'dmg';
 return platform==='linux'&&arch==='x64'?'appimage':null;
}

/**
 * Fixa os dados em uso antes de trocar de app, inclusive sem config anterior (#187).
 * @param {{configFile:string,config:any,runtime:string,env?:NodeJS.ProcessEnv}} input
 * @returns {void}
 * @example keepStudyPaths({configFile,config,runtime})
 */
function keepStudyPaths({configFile,config,runtime,env=process.env}){
 let saved;try{saved=JSON.parse(fs.readFileSync(configFile,'utf8'));}catch{}
 const runtimePath=env.LEARNING_DESK_RUNTIME?saved?.runtimePath||'':runtime;
 if(saved&&saved.runtimePath===runtimePath&&saved.vaultPath===config.vaultPath)return;
 writeConfigPreservingExtras(configFile,{...config,runtimePath,vaultPath:config.vaultPath});
}

async function switchWindows(ctx){
 const {version,publicKey,runtime,env,app,windowsUpdate}=ctx;
 const {file}=await windowsUpdate.prepareInstallerUpdate({version,publicKey,dir:path.join(runtime,'update-installer')});
 ctx.keepPaths();
 await windowsUpdate.markInstallerPending(ctx.pending);
 const readyFile=windowsUpdate.installerReadyFile({env});
 app.releaseSingleInstanceLock();
 ctx.released=true;
 const child=await windowsUpdate.launchInstaller({file,readyFile,env});
 /* Sem instalação anterior, o sinal pode nascer e sumir entre duas leituras;
    saída 0 também prova que o Setup concluiu e reabriu o app (#187). */
 await windowsUpdate.waitForInstallerReady({child,readyFile,allowCompleted:true});
}

function assertDestination(destination){
 if(fs.existsSync(destination)||fs.lstatSync(destination,{throwIfNoEntry:false}))throw Error(message('err.update.switchExists',{path:path.basename(destination)}));
}

async function switchLinux(ctx){
 const {version,publicKey,home,linuxUpdate,app,env}=ctx;
 const dir=path.join(home,'Applications'),destination=path.join(dir,'Summa-x86_64.AppImage');
 fs.mkdirSync(dir,{recursive:true});
 assertDestination(destination);
 const {file}=await linuxUpdate.prepareAppImageUpdate({version,publicKey,dir});
 try{
  ctx.keepPaths();
  /* link exclusivo não sobrescreve um arquivo criado durante o download (#187). */
  try{fs.linkSync(file,destination);}
  catch(error){if(error.code==='EEXIST')throw Error(message('err.update.switchExists',{path:path.basename(destination)}));throw error;}
  ctx.created=destination;
 }finally{fs.rmSync(file,{force:true});}
 await ctx.windowsUpdate.markInstallerPending(ctx.pending);
 app.releaseSingleInstanceLock();
 ctx.released=true;
 await linuxUpdate.relaunchAppImage({appImage:destination,env});
}

async function switchMacos(ctx){
 const {version,publicKey,runtime,applications,macosUpdate,run,app,env}=ctx;
 const destination=path.join(applications,'Summa.app');
 assertDestination(destination);
 try{fs.accessSync(applications,fs.constants.W_OK|fs.constants.X_OK);}
 catch{throw Error(message('err.update.switchNotWritable',{path:applications}));}
 const dir=path.join(runtime,'update-dmg');
 const {file}=await macosUpdate.prepareDmgUpdate({version,publicKey,dir});
 const mount=fs.mkdtempSync(path.join(dir,'mount-'));
 let mounted=false;
 try{
  await run('hdiutil',['attach','-nobrowse','-readonly','-mountpoint',mount,file]);
  mounted=true;
  ctx.keepPaths();
  fs.mkdirSync(destination);
  ctx.created=destination;
  await run('ditto',[path.join(mount,'Summa.app'),destination]);
 }finally{
  try{if(mounted){await run('hdiutil',['detach',mount]);mounted=false;}}
  finally{if(!mounted)fs.rmSync(mount,{recursive:true,force:true});}
 }
 await ctx.windowsUpdate.markInstallerPending(ctx.pending);
 app.releaseSingleInstanceLock();
 ctx.released=true;
 const {ELECTRON_RUN_AS_NODE:_ignored,...cleanEnv}=env;
 await run('open',['-n',...reopenArgs(destination,env)],{env:cleanEnv});
}

/**
 * Baixa a release assinada e abre o app nativo sem mover os estudos (#187).
 * @param {{target:'exe'|'dmg'|'appimage',installed:string,runtime:string,deskDir:string,configFile:string,config:any,app:any,
 * env?:NodeJS.ProcessEnv,home?:string,applications?:string,windowsUpdate?:any,linuxUpdate?:any,macosUpdate?:any,run?:Function}} input
 * @returns {Promise<{ok:boolean,version:string}>}
 * @example await switchToInstaller({target,installed,runtime,deskDir,configFile,config,app})
 */
async function switchToInstaller({target,installed,runtime,deskDir,configFile,config,app,env=process.env,home=os.homedir(),applications='/Applications',windowsUpdate=windows,linuxUpdate=linux,macosUpdate=macos,run=runFile}){
 const lock=worker.acquireLock(runtime);
 if(!lock.ok)throw Error(message('err.update.locked',{file:lock.file}));
 const cacheFile=path.join(runtime,'update.json');
 const announced=readCache(cacheFile)?.release?.version;
 const version=isNewer(announced,installed)?announced:installed;
 const ctx={version,publicKey:'',runtime,env,app,home,applications,windowsUpdate,linuxUpdate,macosUpdate,run,
  pending:{cacheFile,version,from:installed},released:false,created:'',keepPaths:()=>keepStudyPaths({configFile,config,runtime,env})};
 try{
  ctx.publicKey=signature.readUpdatePublicKey(path.join(deskDir,'update-signing-key.pub'));
  if(target==='exe')await switchWindows(ctx);
  else if(target==='appimage')await switchLinux(ctx);
  else if(target==='dmg')await switchMacos(ctx);
  else throw Error(message('err.update.switchUnavailable'));
 }catch(error){
  if(ctx.released)app.requestSingleInstanceLock();
  if(ctx.created)fs.rmSync(ctx.created,{recursive:true,force:true});
  await windowsUpdate.clearInstallerPending({cacheFile});
  if(parseMessage(error?.message))throw error;
  throw Error(message('err.update.switchFailed',{error:causeArg(error)}));
 }finally{worker.releaseLock(lock.file);}
 app.quit();
 return {ok:true,version};
}

module.exports={switchTarget,keepStudyPaths,switchToInstaller};
