// @ts-check
'use strict';

const path=require('node:path');
const {message}=require('./src/i18n.mjs');

/* O bloco escondido dos cadernos anexados (a página que o Ambitus manda): vai
   no fim do prompt, na língua do tutor, com o caminho do arquivo para o
   `ler_caderno`; a pessoa não o vê (`text.mjs#displayUserText` o tira da bolha).
   Serve ao chat lateral (`sidechat-host.cjs`) e ao tutor principal
   (`tutor-prompt-host.cjs`, no modo mini). */

/** Teto de cadernos por mensagem (o mesmo da bandeja). */
const MAX_NOTEBOOKS=4;

/**
 * O bloco de cadernos de um envio. O caderno só vale se a Mesa já o conhece
 * (`allowedXopp`): caminho desconhecido recusa o envio inteiro, antes de escrever.
 * @param {unknown} notebooks `[{caminho, pagina, nome}]` como veio do renderer
 * @param {{allowedXopp: Set<string>, tutorT: (key: string, args?: object) => string}} deps
 * @returns {string} bloco vazio quando não há caderno
 * @example notebookNote([{caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites'}], {allowedXopp, tutorT}) // '[Cadernos anexados à mensagem]\n- caderno “Limites”, pág. 2, arquivo /c/Limites.xopp (releia com ler_caderno)'
 */
function notebookNote(notebooks,{allowedXopp,tutorT}){
 const lines=(Array.isArray(notebooks)?notebooks:[]).slice(0,MAX_NOTEBOOKS).map(item=>{
  const caminho=typeof item?.caminho==='string'?item.caminho:'';
  if(!caminho||!allowedXopp.has(caminho))throw Error(message('err.sidechat.notebookUnknown',{received:String(caminho).slice(0,200)}));
  const page=Number.isInteger(item.pagina)&&item.pagina>=1?item.pagina:1;
  const name=String(typeof item.nome==='string'&&item.nome.trim()?item.nome:path.basename(caminho).replace(/\.xopp$/i,'')).replace(/\s+/g,' ').slice(0,200);
  return tutorT('sidechatctx.notebook',{name,page,path:caminho});
 });
 return lines.length?[tutorT('sidechatctx.notebookHead'),...lines].join('\n'):'';
}

module.exports={MAX_NOTEBOOKS,notebookNote};
