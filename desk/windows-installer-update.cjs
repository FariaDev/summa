// @ts-check
'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {cacheWrite,readCache,semverCompare}=require('./updater-core.cjs');
const {defaultFetchBuffer}=require('./updater-check.cjs');
const signature=require('./updater-signature.cjs');
const {message: uiMsg}=require('./src/i18n.mjs');
const {causeArg}=require('./src/error-detail.mjs');

/* Atualização pelo instalador do Windows (#119, ADR 0006). O app aberto baixa o
   `.exe`, confere com o manifesto assinado e só então o abre em silêncio. Quem
   troca os arquivos é o instalador, depois de a Summa fechar: o Windows trava o
   `electron.exe` em uso. Nada aqui depende de Node do sistema, npm ou clone. */
const DOWNLOAD_TIMEOUT_MS=30*60*1000;
/* A Summa fica aberta durante a extração (31 s na VM de teste) e só fecha quando
   a versão nova está pronta para a troca. O prazo folga para máquinas bem lentas. */
const INSTALLER_READY_TIMEOUT_MS=20*60*1000;

/**
 * A Summa roda da pasta instalada por usuário? Rodar do código (`npm start`)
 * continua no updater antigo.
 * @param {{platform?: string, deskDir: string, env?: Record<string,string|undefined>}} input
 * @returns {boolean}
 * @example isWindowsInstalledApp({platform:'win32',deskDir:'C:\\Users\\ana\\AppData\\Local\\Programs\\Summa\\resources\\app',env:{LOCALAPPDATA:'C:\\Users\\ana\\AppData\\Local'}}) // true
 */
function isWindowsInstalledApp({platform=process.platform,deskDir,env=process.env}){
 if(platform!=='win32'||!env.LOCALAPPDATA)return false;
 const expected=path.win32.resolve(env.LOCALAPPDATA,'Programs','Summa','resources','app');
 return path.win32.resolve(deskDir).toLowerCase()===expected.toLowerCase();
}

/* Grava em `.part`: um download cortado nunca fica com o nome do instalador. */
async function downloadInstallerFile({response,partial,maxBytes}){
 const hash=crypto.createHash('sha256');
 const output=fs.openSync(partial,'w');
 let bytes=0;
 try{
  const reader=response.body.getReader();
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   bytes+=value.length;
   if(bytes>maxBytes){
    await reader.cancel().catch(()=>{});
    break;
   }
   hash.update(value);
   fs.writeSync(output,value);
  }
 }finally{fs.closeSync(output);}
 return {bytes,sha256:hash.digest('hex')};
}

function defaultFetchInstaller(url){
 return fetch(url,{headers:{'user-agent':'summa'},signal:AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)});
}

/**
 * Baixa o instalador da versão e confere tamanho e SHA-256 com o manifesto
 * assinado. Qualquer divergência apaga o download e recusa a atualização.
 * @param {{version: string, publicKey: string, dir: string, fetchBuffer?: Function, fetchInstaller?: (url: string) => Promise<Response>}} input
 * @returns {Promise<{file: string, manifest: object}>}
 * @example await prepareInstallerUpdate({version:'1.4.0',publicKey,dir:'C:\\dados\\update-installer'})
 */
async function prepareInstallerUpdate({version,publicKey,dir,fetchBuffer=defaultFetchBuffer,fetchInstaller=defaultFetchInstaller}){
 const {manifest,urls}=await signature.loadSignedRelease({version,publicKey,fetchBuffer,needZip:false});
 const declared=signature.assertInstallerDeclared(manifest);
 fs.rmSync(dir,{recursive:true,force:true});
 fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,signature.installerAssetName(manifest.version));
 const partial=`${file}.part`;
 let received;
 try{
  const response=await fetchInstaller(urls.installer);
  if(!response.ok||!response.body)throw Error(`HTTP ${response.status}`);
  received=await downloadInstallerFile({response,partial,maxBytes:declared.exeBytes});
 }catch(error){
  fs.rmSync(dir,{recursive:true,force:true});
  throw Error(uiMsg('err.update.installerDownload',{version:manifest.version,error:causeArg(error)}));
 }
 try{signature.assertInstallerMatches(received,declared);}
 catch(error){
  fs.rmSync(dir,{recursive:true,force:true});
  throw error;
 }
 fs.renameSync(partial,file);
 return {file,manifest};
}

/**
 * Arquivo que o instalador cria quando a versão nova terminou de ser extraída.
 * @param {{env?: Record<string,string|undefined>}} [input]
 * @returns {string}
 * @example installerReadyFile({env:{LOCALAPPDATA:'C:\\Users\\ana\\AppData\\Local'}}) // 'C:\\Users\\ana\\AppData\\Local\\Programs\\Summa.ready'
 */
function installerReadyFile({env=process.env}={}){
 return path.win32.join(String(env.LOCALAPPDATA||''),'Programs','Summa.ready');
}

/**
 * Abre o instalador em silêncio e separado da Summa. Resolve só depois de o
 * processo existir, para o app não fechar à toa.
 * @param {{file: string, readyFile?: string, env?: Record<string,string|undefined>, spawnFn?: typeof spawn}} input
 * @returns {Promise<import('node:child_process').ChildProcess>}
 * @example const child=await launchInstaller({file:'C:\\dados\\Summa-Setup-1.4.0.exe'})
 */
function launchInstaller({file,readyFile='',env=process.env,spawnFn=spawn}){
 const {ELECTRON_RUN_AS_NODE:_ignored,...cleanEnv}=env;
 /* Um aviso de uma tentativa anterior faria a Summa fechar antes da hora. */
 if(readyFile)fs.rmSync(readyFile,{force:true});
 return new Promise((resolve,reject)=>{
  const child=spawnFn(file,['/S','/UPDATE'],{detached:true,stdio:'ignore',windowsHide:true,env:cleanEnv});
  child.once('error',reject);
  child.once('spawn',()=>{child.unref();resolve(child);});
 });
}

/**
 * Espera a versão nova ficar pronta para a troca. Se o instalador sair antes ou o
 * prazo acabar, recusa, e a Summa continua aberta nesta versão.
 * @param {{child: {exitCode: number|null, once: Function, off: Function}, readyFile: string, timeoutMs?: number, pollMs?: number}} input
 * @returns {Promise<void>}
 * @example await waitForInstallerReady({child,readyFile:installerReadyFile()})
 */
function waitForInstallerReady({child,readyFile,timeoutMs=INSTALLER_READY_TIMEOUT_MS,pollMs=500}){
 return new Promise((resolve,reject)=>{
  const deadline=Date.now()+timeoutMs;
  let timer=null;
  const finish=(error)=>{
   clearTimeout(timer);
   child.off('exit',onExit);
   if(error)reject(error);else resolve();
  };
  const onExit=code=>finish(Error(code===3?uiMsg('err.update.installerBusy'):`o instalador saiu com o código ${code}; esperado 0 e o aviso de pronto`));
  const tick=()=>{
   if(fs.existsSync(readyFile))return finish();
   if(child.exitCode!==null&&child.exitCode!==undefined)return onExit(child.exitCode);
   if(Date.now()>=deadline)return finish(Error(`o instalador não ficou pronto em ${Math.round(timeoutMs/60000)} min`));
   timer=setTimeout(tick,pollMs);
  };
  child.once('exit',onExit);
  tick();
 });
}

/**
 * Registra a versão pedida antes de fechar o app.
 * @param {{cacheFile: string, version: string, from: string}} input
 * @returns {Promise<unknown>}
 * @example await markInstallerPending({cacheFile,version:'1.4.1',from:'1.4.0'})
 */
function markInstallerPending({cacheFile,version,from}){
 return cacheWrite(cacheFile,cache=>({...cache,installerPending:{version,from,at:Date.now()}}));
}

/**
 * Esquece a versão pedida quando o instalador nem chegou a abrir.
 * @param {{cacheFile: string}} input
 * @returns {Promise<unknown>}
 * @example await clearInstallerPending({cacheFile})
 */
function clearInstallerPending({cacheFile}){
 return cacheWrite(cacheFile,({installerPending:_done,...cache})=>cache);
}

/**
 * Na abertura seguinte, transforma o pedido pendente no resultado que o Sobre
 * mostra: a versão que subiu é a prova de que o instalador terminou.
 * @param {{cacheFile: string, current: string, dir: string, failureReason: string}} input
 * @returns {Promise<{status: string, version: string}|null>}
 * @example await settleInstallerUpdate({cacheFile,current:'1.4.1',dir,failureReason:'não instalou'})
 */
async function settleInstallerUpdate({cacheFile,current,dir,failureReason}){
 const pending=readCache(cacheFile).installerPending;
 if(!pending)return null;
 const applied=semverCompare(current,pending.version)>=0;
 const result=applied
  ?{status:'applied',mode:'installer',version:current}
  :{status:'recovered',mode:'installer',version:pending.version,reason:failureReason};
 await cacheWrite(cacheFile,({installerPending:_done,...cache})=>({...cache,lastResult:{...result,at:Date.now()}}));
 fs.rmSync(dir,{recursive:true,force:true});
 return result;
}

module.exports={isWindowsInstalledApp,prepareInstallerUpdate,installerReadyFile,launchInstaller,waitForInstallerReady,markInstallerPending,clearInstallerPending,settleInstallerUpdate};
