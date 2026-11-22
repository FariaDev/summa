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
export function fakeAppImageProcess({error=''}={}){
 const calls=[];
 const spawnFn=(file,args,options)=>{
  calls.push({file,args,options});
  const child=new EventEmitter();
  child.unref=()=>calls.push('unref');
  queueMicrotask(()=>error?child.emit('error',Error(error)):child.emit('spawn'));
  return child;
 };
 return {calls,spawnFn};
}

/**
 * Dependências do host: nenhuma rede, worker ou processo real.
 * @param {object} update módulo real de detecção
 * @param {{fail?:boolean}} [options]
 * @example const fake=fakeAppImageHost(update);
 */
export function fakeAppImageHost(update,{fail=false}={}){
 const calls=[];
 return {calls,app:{isPackaged:true,getVersion:()=> '1.3.3',quit:()=>calls.push('quit'),releaseSingleInstanceLock:()=>calls.push('unlock'),requestSingleInstanceLock:()=>calls.push('lock')},
  toolHost:{state:()=>({}),persist:()=>{},isBusy:()=>false,hasBridge:()=>false,relink:()=>{}},
  config:()=>({}),win:()=>null,appendLog:()=>{},
  appImageUpdate:{isLinuxAppImage:update.isLinuxAppImage,
   prepareAppImageUpdate:async()=>{calls.push('prepare');if(fail)throw Error('hash recusado');return {file:'/apps/.new.part'};},
   swapAppImage:()=>calls.push('swap'),relaunchAppImage:async()=>{calls.push('relaunch');}},
 };
}
