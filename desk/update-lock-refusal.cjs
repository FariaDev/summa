// @ts-check
'use strict';
const fs=require('node:fs');
const {message}=require('./src/i18n.mjs');

/* A recusa por lock não manda o aluno apagar arquivo interno: o pid gravado é
   do app que já fechou, então só a idade do lock diz algo, e ela vai para o
   desk.log (o lock vence sozinho em LOCK_STALE_MS). */
function lockAgeSeconds(file,now){
 try{
  const at=JSON.parse(fs.readFileSync(file,'utf8')).at;
  if(typeof at==='number')return String(Math.round((now-at)/1000));
 }catch{}
 return '?';
}

/**
 * Registra no desk.log a recusa por lock (caminho e idade em segundos) e
 * devolve o erro traduzido para a janela.
 * @param {{lock:{file:string},appendLog:(src:string,line:string)=>void,now?:number}} input
 * @returns {Error}
 * @example if(!lock.ok)throw lockedUpdateError({lock,appendLog});
 */
function lockedUpdateError({lock,appendLog,now=Date.now()}){
 appendLog('update',`atualização recusada: lock ${lock.file} com ${lockAgeSeconds(lock.file,now)} s`);
 return Error(message('err.update.locked'));
}

module.exports={lockedUpdateError};
