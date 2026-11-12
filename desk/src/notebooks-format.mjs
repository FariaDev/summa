// @ts-check
import {formatDate,t} from './ui-text.mjs';

/* Formatação da biblioteca de cadernos (#133, D3): data curta, meta, cor da
   matéria e etiqueta de formato. Sem DOM: a vista (`notebooks.mjs`) e os
   testes de unidade usam estas funções; a cor e o formato já vêm resolvidos
   do host (#166): a cor do `config.json` e o formato do começo do `.xopp`. */

/** @typedef {{courseId:string,name:string,path:string,folder:string,mtimeMs:number,color?:string,format?:string}} NotebookItem */
/** @typedef {(key:string) => string} Translator */

/* Rótulos da tabela de tamanhos do host (#166), na grafia da tabela. A série
   A é igual nos dois idiomas; Carta, Ofício e Tabloide vêm do catálogo, que
   traduz para Letter, Legal e Tabloid (#184). Lista fechada: valor fora dela
   não vira etiqueta. */
const FORMAT_LABELS=[
 {label:'A4'},
 {label:'A3'},
 {label:'A5'},
 {label:'A6'},
 {label:'Carta',key:'notebooks.format.letter'},
 {label:'Ofício',key:'notebooks.format.legal'},
 {label:'Tabloide',key:'notebooks.format.tabloid'},
];

/** Data curta no formato da lista de sessões (`course-conversations.mjs`):
 *  hoje é hora (HH:MM); outro dia é dia/mês e hora. Sem mtime, sai vazia —
 *  nunca "undefined".
 *  @param {number} mtimeMs @param {number} [nowMs]
 *  @returns {string}
 *  @example notebookWhen(new Date(2026, 10, 6, 9, 5).getTime(), new Date(2026, 10, 6, 12, 0).getTime()) === '09:05'
 */
export function notebookWhen(mtimeMs,nowMs=Date.now()){
 const stamp=Number(mtimeMs)||0;
 if(!stamp)return '';
 const date=new Date(stamp),today=new Date(nowMs);
 const sameDay=date.toDateString()===today.toDateString();
 return formatDate(date,sameDay?{hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}

/** Cor do ícone do caderno: a cor da matéria quando o host manda uma válida
 *  (`#rrggbb`, nome de cor, `rgb()/hsl()` ou `var(--token)`); vazio cai no
 *  cinza neutro do tema — sem `color` no `config.json`, é o normal (#166).
 *  Valor estranho não vira estilo.
 *  @param {{color?: unknown}|null|undefined} course
 *  @returns {string}
 *  @example notebookCourseColor({color:'#c02667'}) // '#c02667'
 *  @example notebookCourseColor({}) // '' (o CSS pinta --muted)
 */
export function notebookCourseColor(course){
 const value=course&&typeof course.color==='string'?course.color.trim():'';
 if(!value||value.length>40)return '';
 return /^(?:#[\da-f]{3,8}|[a-z]{3,20}|(?:rgb|hsl)a?\([^)]*\)|var\(--[\w-]+\))$/i.test(value)?value:'';
}

/** Etiqueta curta do formato da página ("A4", "Carta"), só quando a lista já
 *  conhece o formato do começo do `.xopp` (#166). Mantém a grafia da tabela,
 *  sem forçar maiúsculas, e segue o idioma da interface (#184): Carta, Ofício
 *  e Tabloide viram Letter, Legal e Tabloid em inglês. Vazio não desenha
 *  etiqueta e não entra no rótulo acessível.
 *  @param {unknown} value
 *  @param {Translator} [translate]
 *  @returns {string}
 *  @example notebookFormatLabel(' a4 ') // 'A4'
 *  @example notebookFormatLabel('Ofício') // 'Ofício' (pt-BR); 'Legal' em inglês
 */
export function notebookFormatLabel(value,translate=t){
 const text=typeof value==='string'?value.trim():'';
 if(!text||text.length>8)return '';
 const found=FORMAT_LABELS.find(entry=>entry.label.toLocaleLowerCase('pt-BR')===text.toLocaleLowerCase('pt-BR'));
 if(!found)return '';
 return found.key?translate(found.key):found.label;
}

/** Linha de exibição de um caderno: nome, pasta relativa (se houver) e data
 *  curta, com a meta no molde "pasta · data" da lista de sessões.
 *  @param {NotebookItem} item @param {number} [nowMs] @param {Translator} [translate]
 *  @returns {{courseId:string,name:string,path:string,meta:string,format:string}}
 *  @example formatNotebookItem({courseId:'calc',name:'aula.xopp',path:'/v/aula.xopp',folder:'sub',mtimeMs:1000},1000).meta.startsWith('sub · ')
 */
export function formatNotebookItem(item,nowMs,translate=t){
 const folder=typeof item?.folder==='string'?item.folder:'';
 const meta=[folder,notebookWhen(item?.mtimeMs,nowMs)].filter(Boolean).join(' · ');
 return {courseId:String(item?.courseId||''),name:String(item?.name||''),path:String(item?.path||''),meta,format:notebookFormatLabel(item?.format,translate)};
}
