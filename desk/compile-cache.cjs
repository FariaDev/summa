'use strict';

const fs=require('node:fs');
const nodeModule=require('node:module');

/* Cache de compilação do Node (#desempenho): o main é o maior grafo CommonJS
   do app e relê os mesmos arquivos a cada abertura. O `enableCompileCache`
   (Node 24 do Electron 45) guarda o bytecode numa pasta de dados do usuário —
   nunca no bundle, que é só leitura. Falta da API, pasta sem permissão ou
   status FAILED seguem sem cache: o app não pode deixar de abrir por causa
   disso, e o caminho normal não vira log. */

/**
 * Liga o cache de compilação do Node numa pasta gravável de dados do usuário.
 * Em `DESK_TEST=1` fica desligado (o runtime dos testes é temporário), a não
 * ser que `LEARNING_DESK_COMPILE_CACHE=1` peça o contrário; o `0` desliga nos
 * dois modos. Nunca lança e nunca lê o cache antigo para decidir.
 * @param {{dir: string, env?: NodeJS.ProcessEnv, moduleApi?: {enableCompileCache?: (dir: string) => {status?: number},
 *   constants?: {compileCacheStatus?: {FAILED?: number}}}}} [options] pasta do cache, ambiente e API do Node (testes)
 * @returns {{enabled: boolean, dir: string, status?: number, reason?: 'disabled'|'unsupported'|'failed'}}
 * @example enableDeskCompileCache({dir: '/home/ana/.mesa/compile-cache', env: {}}).enabled // true
 */
function enableDeskCompileCache({dir, env=process.env, moduleApi=nodeModule}={}){
 if(!dir)return {enabled:false,dir:'',reason:'disabled'};
 const off=env.LEARNING_DESK_COMPILE_CACHE==='0'||(env.DESK_TEST==='1'&&env.LEARNING_DESK_COMPILE_CACHE!=='1');
 if(off)return {enabled:false,dir,reason:'disabled'};
 if(typeof moduleApi.enableCompileCache!=='function')return {enabled:false,dir,reason:'unsupported'};
 try{
  fs.mkdirSync(dir,{recursive:true});
  const result=moduleApi.enableCompileCache(dir);
  const failed=moduleApi.constants?.compileCacheStatus?.FAILED;
  if(typeof result?.status==='number'&&typeof failed==='number'&&result.status===failed)return {enabled:false,dir,status:result.status,reason:'failed'};
  return {enabled:true,dir,...(typeof result?.status==='number'?{status:result.status}:{})};
 }catch{return {enabled:false,dir,reason:'failed'};}
}

module.exports={enableDeskCompileCache};
