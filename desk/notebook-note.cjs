// @ts-check
'use strict';

const path=require('node:path');
const {message}=require('./src/i18n.mjs');
const {notebookRecorte}=require('./src/notebook-facts.mjs');

/* O bloco escondido dos cadernos anexados (a página que o Ambitus manda): vai
   no fim do prompt, na língua do tutor, com o caminho do arquivo para o
   `ler_caderno`; a pessoa não o vê (`text.mjs#displayUserText` o tira da bolha).
   Serve ao chat lateral (`sidechat-host.cjs`) e ao tutor principal
   (`tutor-prompt-host.cjs`, no modo mini). Com `recorte`, a linha diz que a
   imagem é só esse trecho, em pontos, e onde ele fica na página. */

/** Teto de cadernos por mensagem (o mesmo da bandeja). */
const MAX_NOTEBOOKS=4;

/**
 * O trecho de um cartão (`recorte`, em pontos), ou null quando a página vai
 * inteira. Um `recorte` que não é trecho válido recusa o envio, como um caderno
 * desconhecido: a imagem não pode passar por página inteira.
 * @param {{recorte?: unknown}} item
 * @returns {{x: number, y: number, largura: number, altura: number}|null}
 * @example excerptOf({recorte: {x: 0, y: 286, largura: 595, altura: 555}}) // {x: 0, y: 286, largura: 595, altura: 555}
 */
function excerptOf(item){
 if(item.recorte===undefined)return null;
 const excerpt=notebookRecorte(item.recorte);
 if(!excerpt)throw Error(message('err.sidechat.notebookRecorte',{received:String(JSON.stringify(item.recorte)).slice(0,200)}));
 return excerpt;
}

/**
 * O bloco de cadernos de um envio. O caderno só vale se a Mesa já o conhece
 * (`allowedXopp`): caminho desconhecido recusa o envio inteiro, antes de escrever.
 * Cartão com `recorte` sai na linha de trecho (`sidechatctx.notebookExcerpt`).
 * @param {unknown} notebooks `[{caminho, pagina, nome, recorte?}]` como veio do renderer
 * @param {{allowedXopp: Set<string>, tutorT: (key: string, args?: object) => string}} deps
 * @returns {string} bloco vazio quando não há caderno
 * @example notebookNote([{caminho: '/c/Limites.xopp', pagina: 2, nome: 'Limites'}], {allowedXopp, tutorT}) // '[Cadernos anexados à mensagem]\n- caderno “Limites”, pág. 2, arquivo /c/Limites.xopp; a imagem anexada é esta página (use ler_caderno para reler esta ou outras páginas)'
 */
function notebookNote(notebooks,{allowedXopp,tutorT}){
 const lines=(Array.isArray(notebooks)?notebooks:[]).slice(0,MAX_NOTEBOOKS).map(item=>{
  const caminho=typeof item?.caminho==='string'?item.caminho:'';
  if(!caminho||!allowedXopp.has(caminho))throw Error(message('err.sidechat.notebookUnknown',{received:String(caminho).slice(0,200)}));
  const page=Number.isInteger(item.pagina)&&item.pagina>=1?item.pagina:1;
  const name=String(typeof item.nome==='string'&&item.nome.trim()?item.nome:path.basename(caminho).replace(/\.xopp$/i,'')).replace(/\s+/g,' ').slice(0,200);
  const excerpt=excerptOf(item);
  if(excerpt)return tutorT('sidechatctx.notebookExcerpt',{name,page,path:caminho,x:Math.round(excerpt.x),y:Math.round(excerpt.y),width:Math.round(excerpt.largura),height:Math.round(excerpt.altura)});
  return tutorT('sidechatctx.notebook',{name,page,path:caminho});
 });
 return lines.length?[tutorT('sidechatctx.notebookHead'),...lines].join('\n'):'';
}

module.exports={MAX_NOTEBOOKS,notebookNote};
