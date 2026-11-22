import {EventEmitter} from 'node:events';
import fs from 'node:fs';

/** Simula disco com escritas curtas ou sem progresso. */
export function fakeShortWritingFs(limit){
 return {...fs,writeSync(fd,buffer,offset,length){return fs.writeSync(fd,buffer,offset,Math.min(limit,length));}};
}

/**
 * Download controlado, sem rede, com falhas HTTP opcionais.
 * @param {Buffer} bytes
 * @param {number} [status]
 * @returns {(url:string)=>Promise<Response>}
 * @example const fetchAppImage=fakeAppImageDownload(Buffer.from('imagem'));
 */
export function fakeAppImageDownload(bytes,status=200){
 return async()=>new Response(bytes,{status});
}

/**
 * Processo separado observável para testar ambiente e falha de arranque.
 * @param {{error?:string}} [options]
 * @example const process=fakeAppImageProcess();
 */
export function fakeAppImageProcess({error='',exitImmediately=false,ready=true}={}){
 const calls=[];
 const spawnFn=(file,args,options)=>{
  calls.push({file,args,options});
  const child=new EventEmitter();
  child.unref=()=>calls.push('unref');
  child.kill=()=>{calls.push('kill');queueMicrotask(()=>child.emit('exit',null));return true;};
  queueMicrotask(()=>{
   if(error)return child.emit('error',Error(error));
   child.emit('spawn');
   if(exitImmediately)child.emit('exit',1);
   else if(ready&&options.env.SUMMA_APPIMAGE_READY_FILE)fs.writeFileSync(options.env.SUMMA_APPIMAGE_READY_FILE,'ready');
  });
  return child;
 };
 return {calls,spawnFn};
}

/**
 * Dependências do host: nenhuma rede, worker ou processo real.
 * @param {object} update módulo real de detecção
 * @param {{fail?:boolean,hasLock?:boolean}} [options]
 * @example const fake=fakeAppImageHost(update);
 */
export function fakeAppImageHost(update,{fail=false,hasLock=true}={}){
 const calls=[];
 return {calls,app:{isPackaged:true,getVersion:()=> '1.3.3',hasSingleInstanceLock:()=>hasLock,quit:()=>calls.push('quit'),releaseSingleInstanceLock:()=>calls.push('unlock'),requestSingleInstanceLock:()=>calls.push('lock')},
  toolHost:{state:()=>({}),persist:()=>{},isBusy:()=>false,hasBridge:()=>false,relink:()=>{}},
  config:()=>({}),win:()=>null,appendLog:()=>{},
  appImageUpdate:{isLinuxAppImage:update.isLinuxAppImage,
   cleanupAppImagePartials:update.cleanupAppImagePartials,
   prepareAppImageUpdate:async()=>{calls.push('prepare');if(fail)throw Error('hash recusado');return {file:'/apps/.new.part'};},
   swapAppImage:()=>{calls.push('swap');},relaunchAppImage:async()=>{calls.push('relaunch');}},
 };
}
