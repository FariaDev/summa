// @ts-check
'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');

/**
 * Grava um stream com teto de bytes e SHA-256 incremental.
 * @param {{response:Response,partial:string,maxBytes:number,fsImpl?:typeof fs}} input
 * @returns {Promise<{bytes:number,sha256:string}>}
 * @example await downloadReleaseFile({response,partial:'update.part',maxBytes:1024})
 */
async function downloadReleaseFile({response,partial,maxBytes,fsImpl=fs}){
 if(!response.body)throw Error('Download sem corpo; esperado stream de bytes');
 const hash=crypto.createHash('sha256');
 const output=fsImpl.openSync(partial,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_TRUNC|(fs.constants.O_NOFOLLOW||0),0o600);
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
   for(let offset=0;offset<value.length;){
    const written=fsImpl.writeSync(output,value,offset,value.length-offset);
    if(written<=0)throw Error('Escrita sem progresso; esperado gravar o download completo');
    offset+=written;
   }
  }
 }finally{fsImpl.closeSync(output);}
 return {bytes,sha256:hash.digest('hex')};
}

/**
 * Abre o download de um pacote com prazo de trinta minutos.
 * @param {string} url
 * @returns {Promise<Response>}
 * @example await fetchReleaseFile('https://example.org/Summa.AppImage')
 */
function fetchReleaseFile(url){
 return fetch(url,{headers:{'user-agent':'summa'},signal:AbortSignal.timeout(30*60*1000)});
}
module.exports={downloadReleaseFile,fetchReleaseFile};
