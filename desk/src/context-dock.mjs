// @ts-check
import {$,S,refs,studySnapshot,supportsCapability} from './state.mjs';
import {t} from './ui-text.mjs';
import {icon} from '../icons.mjs';
import {sessionContextLine,pdfGoesName} from './session-context.mjs';

/* Painel Contexto encaixado (r2, "Cabeçalho e Contexto"): a linha de baixo do
   cabeçalho abre, no fluxo da coluna e logo abaixo do cabeçalho, um painel
   encaixado. A sanfona dentro de Mais opções saiu. O conteúdo é o
   que vai com a mensagem (PDF e página; captura do Conferir), a questão ativa,
   o rascunho .xopp e o uso do contexto com "Resumir agora". A matéria e a
   contagem de referências saíram da linha (a aba e o nome do PDF já dizem).
   Os nós vivos `#exercise-title`, `#pick-xopp`, `#ctx-meter` e `#study-context`
   vêm do `index.html`; este módulo só os leva para o painel. */

const NOTE_PDF='context.pdfNote';
const NOTE_CAPTURE='context.captureNote';

/** @typedef {{icon: string, name: string, note: string}} GoesItem */
/** @typedef {{name: string, origin: 'course'|'vault'|'default', text: string}} TutorContractFile */

/** @type {null | {line: HTMLButtonElement, summary: HTMLElement, dock: HTMLElement, title: HTMLElement, close: HTMLButtonElement, group: HTMLElement, items: HTMLElement, contractGroup: HTMLElement, contractItems: HTMLElement, contractList: HTMLElement, contractRead: HTMLElement, contractOrigin: HTMLElement, contractText: HTMLElement, contractBack: HTMLButtonElement, contractBackLabel: HTMLElement, contractReading: boolean, contractFile: TutorContractFile | null, contractReturn: HTMLElement | null, questionLabel: HTMLLabelElement, draftLabel: HTMLLabelElement, usageText: HTMLElement, summarize: HTMLButtonElement, returnFocus: HTMLElement | null}} */
let ui=null;

/** @type {{courseId: string, files: TutorContractFile[], signature: string} | null} */
let contract=null;
let contractRequest=0;
let contractRendered=null;

function fileName(path){return String(path||'').split(/[/\\]/).at(-1);}

/** Os PDFs que vão com a mensagem, na ordem dos leitores; a página é a do
 *  leitor de cada um. A fonte é a mesma do envio (`refs()`), então o que a
 *  linha/painel dizem é o que o host manda.
 *  @returns {Array<{name: string, page: number}>} */
function goesPdfs(){
 return refs().map(ref=>({name:fileName(ref.path),page:Math.max(0,Number(ref.page)||0)})).filter(pdf=>pdf.name);
}

/** Fatos do painel: o primeiro PDF (com "+N") e, se o Conferir existe, a
 *  captura como imagem. Só entra o que vai de verdade.
 *  @param {{pdfs?: Array<{name: string, page: number}>, capture?: boolean}} facts
 *  @returns {GoesItem[]} */
export function contextGoesItems({pdfs=[],capture=false}={}){
 const list=Array.isArray(pdfs)?pdfs.filter(pdf=>pdf&&String(pdf.name||'').trim()):[];
 const items=[];
 if(list.length)items.push({icon:'file',name:pdfGoesName(list[0],list.length-1),note:t(NOTE_PDF)});
 if(capture)items.push({icon:'image',name:t('context.captureName'),note:t(NOTE_CAPTURE)});
 return items;
}

function captureGoes(){return S.appConfig.desk?.conferir!==false;}

/* A flag `studyContext` desligada esconde a questão e o rascunho: eles não vão
   com a mensagem. A linha e o painel mostram só o que o envio leva. */
function goesExercise(){return S.appConfig.desk?.studyContext===false?'':studySnapshot().title;}

function paintLine(){
 if(!ui)return;
 const text=sessionContextLine({pdfs:goesPdfs(),exercise:goesExercise()});
 ui.summary.textContent=text;
 ui.line.hidden=!text;
 ui.line.title=text;
}

function goesRow(item){
 const row=document.createElement('div');row.className='ctx-row';
 const mark=document.createElement('span');mark.className='ctx-icon';mark.setAttribute('aria-hidden','true');mark.innerHTML=icon(item.icon);
 const name=document.createElement('span');name.className='ctx-name';name.textContent=item.name;
 const note=document.createElement('span');note.className='ctx-meta';note.textContent=item.note;
 row.append(mark,name,note);
 return row;
}

function paintItems(){
 if(!ui)return;
 const items=contextGoesItems({pdfs:goesPdfs(),capture:captureGoes()});
 ui.items.replaceChildren(...items.map(goesRow));
 ui.items.hidden=!items.length;
 ui.group.hidden=!items.length;
}

/* ---------- contrato do tutor (#180) ---------- */

function contractOriginLabel(origin){return t(`context.contract.origin.${origin}`);}
function contractDisplayName(file){return file.origin==='course'?t('context.contract.courseName',{name:file.name}):file.name;}
function contractSourceLine(file){return `${file.name} · ${contractOriginLabel(file.origin)}`;}

/** Assinatura barata do contrato: origem, nome e texto. Duas matérias com o
 *  mesmo TUTOR.md de nome mas texto diferente não podem reaproveitar as linhas
 *  antigas (o clique guarda o texto do arquivo). */
function contractSignature(files){
 return files.map(file=>{
  let hash=5381;
  for(let i=0;i<file.text.length;i++)hash=((hash<<5)+hash+file.text.charCodeAt(i))|0;
  return `${file.origin}:${file.name}:${file.text.length}:${hash}`;
 }).join('|');
}

/** @param {unknown} item @returns {item is TutorContractFile} */
function isContractFile(item){
 if(!item||typeof item!=='object')return false;
 const file=/** @type {{name?: unknown, origin?: unknown, text?: unknown}} */ (item);
 return typeof file.name==='string'&&typeof file.text==='string'&&(file.origin==='course'||file.origin==='vault'||file.origin==='default');
}

function contractParagraphs(text){
 const blocks=String(text||'').replace(/\r\n?/g,'\n').split(/\n{2,}/).map(block=>block.trim()).filter(Boolean);
 return (blocks.length?blocks:['']).map(block=>{
  const paragraph=document.createElement('p');paragraph.textContent=block;return paragraph;
 });
}

function contractRow(file){
 const row=document.createElement('button');
 row.type='button';row.className='ctx-row contract-row';row.setAttribute('aria-haspopup','dialog');
 const mark=document.createElement('span');mark.className='ctx-icon';mark.setAttribute('aria-hidden','true');mark.innerHTML=icon('file');
 const name=document.createElement('span');name.className='ctx-name';name.textContent=contractDisplayName(file);
 const meta=document.createElement('span');meta.className='ctx-meta';meta.textContent=contractOriginLabel(file.origin);
 const caret=document.createElement('span');caret.className='contract-open';caret.setAttribute('aria-hidden','true');caret.innerHTML=icon('chevronRight');
 row.append(mark,name,meta,caret);
 row.addEventListener('click',()=>openContractRead(file,row));
 return row;
}

function contractEmpty(){
 const empty=document.createElement('p');empty.className='contract-empty';empty.textContent=t('context.contract.empty');return empty;
}

function paintContractLabels(){
 if(!ui)return;
 ui.contractGroup.textContent=t('context.contract.group');
 ui.contractBackLabel.textContent=t('context.contract.back');
 ui.dock.setAttribute('aria-label',t(ui.contractReading?'context.contract.readAria':'header.context'));
 if(ui.contractReading&&ui.contractFile)ui.contractOrigin.textContent=contractSourceLine(ui.contractFile);
}

function resetContractRead(){
 if(!ui)return;
 ui.contractReading=false;ui.contractFile=null;ui.contractReturn=null;
 ui.contractRead.hidden=true;ui.contractList.hidden=false;
 ui.title.hidden=false;ui.contractBack.hidden=true;
 if(ui.contractGroup.isConnected)paintContractLabels();
}

function paintContract(){
 if(!ui)return;
 const files=contract&&contract.courseId===S.currentCourseId?contract.files:null;
 if(!files){
  ui.contractGroup.hidden=true;ui.contractItems.hidden=true;ui.contractItems.replaceChildren();contractRendered=null;return;
 }
 ui.contractGroup.hidden=false;ui.contractItems.hidden=false;
 /* A resposta forçada ao abrir o painel não pode recriar as mesmas linhas: a
    troca de nós mexe na âncora de rolagem e o painel escapa para baixo do
    cabeçalho colado. Só o conteúdo diferente é redesenhado. */
 if(contract.signature!==contractRendered){
  ui.contractItems.replaceChildren(...(files.length?files.map(contractRow):[contractEmpty()]));
  contractRendered=contract.signature;
  if(ui.contractReading)resetContractRead();
  keepDockAtTop();
 }
 if(ui.contractReading){
  const current=ui.contractFile&&files.find(file=>file.name===ui.contractFile?.name&&file.origin===ui.contractFile?.origin);
  if(!current)resetContractRead();
  else{ui.contractFile=current;paintContractLabels();}
 }
 paintContractLabels();
}

/** Lê o contrato da matéria ativa no host; sem `force`, reaproveita o cache. */
async function loadContract({force=false}={}){
 if(!ui)return;
 const courseId=S.currentCourseId;
 if(!force&&contract&&contract.courseId===courseId)return;
 const request=++contractRequest;
 let answer;
 try{answer=await window.desk.tutorContract();}catch{return;}
 if(request!==contractRequest)return;
 const files=Array.isArray(answer)?answer.filter(isContractFile):[];
 contract={courseId,files,signature:contractSignature(files)};
 paintContract();
}

function syncContract(){
 if(!ui)return;
 paintContract();
 if(!contract||contract.courseId!==S.currentCourseId)void loadContract();
}

function openContractRead(file,row){
 if(!ui)return;
 ui.contractReading=true;ui.contractFile=file;ui.contractReturn=row;
 ui.contractOrigin.textContent=contractSourceLine(file);
 ui.contractText.replaceChildren(...contractParagraphs(file.text));
 ui.contractList.hidden=true;ui.contractRead.hidden=false;
 ui.title.hidden=true;ui.contractBack.hidden=false;
 paintContractLabels();
 ui.contractBack.focus();
}

function closeContractRead({restoreFocus=false}={}){
 if(!ui||!ui.contractReading)return;
 const target=ui.contractReturn;
 resetContractRead();
 if(restoreFocus&&target&&target.isConnected)target.focus();
}

/** O "Contexto em uso: N%" sai do medidor vivo (`#ctx-meter`); sem medição, o
 *  texto de hoje ("Sem medição ainda"). O `em` do medidor fica fora da vista no
 *  painel — o texto inteiro é anunciado uma vez só. */
function paintUsage(){
 if(!ui)return;
 const meter=$('#ctx-meter');
 const percent=Number.parseInt(meter?.querySelector('em')?.textContent||'',10);
 const measured=!!meter&&!meter.hidden&&Number.isFinite(percent);
 ui.usageText.textContent=measured?t('context.usage',{n:percent}):t('header.contextEmpty');
}

function paintSummarize(){
 if(!ui)return;
 const canCompact=supportsCapability('compact');
 ui.summarize.disabled=!canCompact||!S.connected;
 ui.summarize.title=t(!canCompact?'more.compactNow.unsupported':!S.connected?'more.compactNow.needsTutor':'more.compactNow.hint');
}

function paintLabels(){
 if(!ui)return;
 ui.title.textContent=t('header.context');
 ui.close.setAttribute('aria-label',t('common.close'));
 ui.group.textContent=t('context.goes');
 ui.questionLabel.textContent=t('context.question');
 ui.draftLabel.textContent=t('context.draft');
 ui.summarize.textContent=t('context.summarizeNow');
}

/** Repinta a linha do cabeçalho, os itens do painel e o texto do medidor com os
 *  fatos vivos. Chamado por `state.mjs#updateContextSummary` a cada troca de
 *  página, questão, referências ou idioma.
 *  @returns {void} */
export function updateContextDock(){
 if(!ui)return;
 paintLabels();
 paintLine();
 paintItems();
 syncContract();
 paintUsage();
 paintSummarize();
}

/** Espelha os fatos do motor no pé do painel (Resumir agora) e no medidor.
 *  @returns {void} */
export function syncContextDock(){
 paintSummarize();
 paintUsage();
}

/** Diz se o painel está aberto. @returns {boolean} */
export function contextDockOpen(){return !!ui&&!ui.dock.hidden;}

function focusDock(){ui?.close.focus();}

/* O painel nasce colado ao cabeçalho, mas o conteúdo novo pode ligar o modo de
   rolagem da coluna; se a conversa já estava no fim, o topo do painel ficaria
   sob o cabeçalho sticky. Depois do layout, devolve a coluna ao topo quando o
   painel está aberto. */
function keepDockAtTop(){
 const chat=$('#chat');
 if(!chat)return;
 const reset=()=>{if(contextDockOpen()&&chat.scrollTop)chat.scrollTop=0;};
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>requestAnimationFrame(reset));
 else reset();
}

/** Fecha o painel; com `restoreFocus`, devolve o foco a quem o abriu (a linha
 *  do cabeçalho ou o botão Mais opções, quando veio do menu).
 *  @param {{restoreFocus?: boolean}} [options]
 *  @returns {void} */
export function closeContextDock({restoreFocus=false}={}){
 if(!contextDockOpen())return;
 resetContractRead();
 ui.dock.hidden=true;
 ui.line.setAttribute('aria-expanded','false');
 if(restoreFocus){
  const target=ui.returnFocus&&ui.returnFocus.isConnected?ui.returnFocus:ui.line;
  target?.focus();
 }
 ui.returnFocus=null;
}

/** Abre o painel Contexto. Veio de um clique no teclado ou do menu, o foco
 *  entra no × do painel.
 *  @param {{focusReturn?: HTMLElement | null, focus?: boolean}} [options]
 *  @returns {void} */
export function openContextDock({focusReturn=null,focus=false}={}){
 if(!ui)return;
 if(!contextDockOpen()){
  ui.returnFocus=focusReturn;
  ui.dock.hidden=false;
  ui.line.setAttribute('aria-expanded','true');
  updateContextDock();
 }
 void loadContract({force:true});
 keepDockAtTop();
 if(focus)focusDock();
}

/** Alterna o painel; usado pela linha do cabeçalho (ela abre e fecha).
 *  @param {{focusReturn?: HTMLElement | null, focus?: boolean}} [options]
 *  @returns {void} */
export function toggleContextDock(options={}){
 if(contextDockOpen())closeContextDock({restoreFocus:true});
 else openContextDock(options);
}

function buildLine(){
 const title=$('#session-title');
 if(!title)return null;
 const line=document.createElement('button');
 line.type='button';line.id='context-line';line.className='head-context';
 line.setAttribute('aria-controls','context-dock');line.setAttribute('aria-expanded','false');line.hidden=true;
 const summary=document.createElement('span');summary.id='context-summary';
 line.append(summary);
 title.after(line);
 return {line,summary};
}

function buildDock(){
 const top=$('#chat .chat-top');
 const study=$('#study-context');
 const pick=$('#pick-xopp');
 const exercise=$('#exercise-title');
 if(!top||!study||!pick||!exercise)return null;
 const dock=document.createElement('section');
 dock.id='context-dock';dock.className='dock';dock.setAttribute('role','dialog');dock.setAttribute('aria-label',t('header.context'));dock.hidden=true;
 const head=document.createElement('div');head.className='dock-head';
 const title=document.createElement('strong');
 const back=document.createElement('button');
 back.type='button';back.id='context-contract-back';back.className='contract-back';back.hidden=true;
 back.innerHTML=icon('arrowLeft');
 const backLabel=document.createElement('span');back.append(backLabel);
 const close=document.createElement('button');
 close.type='button';close.id='context-dock-close';close.className='icon-btn';close.innerHTML=icon('close');
 head.append(title,back,close);
 const body=document.createElement('div');body.className='dock-body';
 const list=document.createElement('div');list.id='context-dock-list';
 const group=document.createElement('p');group.id='context-goes';group.className='dock-group';
 const items=document.createElement('div');items.id='context-dock-items';
 const contractGroup=document.createElement('p');contractGroup.id='context-contract-group';contractGroup.className='dock-group';contractGroup.hidden=true;
 const contractItems=document.createElement('div');contractItems.id='context-contract-items';contractItems.hidden=true;
 const contractRead=document.createElement('div');contractRead.id='context-contract-read';contractRead.hidden=true;
 const contractOrigin=document.createElement('p');contractOrigin.id='context-contract-origin';contractOrigin.className='contract-origin';
 const contractText=document.createElement('div');contractText.id='context-contract-text';contractText.className='contract-read';
 contractRead.append(contractOrigin,contractText);
 const questionLabel=document.createElement('label');questionLabel.className='field-label';questionLabel.htmlFor='exercise-title';
 const draftLabel=document.createElement('label');draftLabel.className='field-label';draftLabel.htmlFor='pick-xopp';
 study.insertBefore(questionLabel,exercise);
 study.insertBefore(draftLabel,pick);
 const caret=pick.querySelector('.pick-caret');
 if(caret)caret.innerHTML=icon('chevronRight');
 const usage=document.createElement('div');usage.className='context-usage';
 const usageCopy=document.createElement('div');usageCopy.className='context-usage-copy';
 const usageText=document.createElement('span');usageText.id='context-usage-text';
 usageCopy.append(usageText);
 const meter=$('#ctx-meter');
 if(meter)usageCopy.append(meter);
 const summarize=document.createElement('button');
 summarize.type='button';summarize.id='context-summarize';summarize.className='btn-layer';
 usage.append(usageCopy,summarize);
 list.append(group,items,contractGroup,contractItems,study,usage);
 body.append(list,contractRead);
 dock.append(head,body);
 top.after(dock);
 return {dock,title,contractBack:back,contractBackLabel:backLabel,close,group,items,contractGroup,contractItems,contractList:list,contractRead,contractOrigin,contractText,questionLabel,draftLabel,usageText,summarize};
}

function wire(){
 if(!ui)return;
 ui.line.addEventListener('click',()=>toggleContextDock({focusReturn:ui.line,focus:document.activeElement===ui.line&&ui.line.matches(':focus-visible')}));
 ui.close.addEventListener('click',()=>closeContextDock({restoreFocus:true}));
 ui.contractBack.addEventListener('click',()=>closeContractRead({restoreFocus:true}));
 ui.summarize.addEventListener('click',()=>hostCompactNow?.());
 document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.key!=='Escape'||!contextDockOpen())return;
  event.preventDefault();event.stopPropagation();closeContextDock({restoreFocus:true});
 });
 const meter=$('#ctx-meter');
 if(meter&&typeof MutationObserver==='function'){
  new MutationObserver(paintUsage).observe(meter,{attributes:true,attributeFilter:['hidden','class'],subtree:true,childList:true,characterData:true});
 }
}

/** @type {(() => void) | null} */
let hostCompactNow=null;

/** Monta a linha do cabeçalho e o painel no fluxo da coluna (uma vez). O
 *  "Resumir agora" chama a MESMA ação do antigo item de menu.
 *  @param {{compactNow: () => void}} deps
 *  @returns {void}
 *  @example initContextDock({compactNow: () => doCompact('')});
 */
export function initContextDock(deps){
 if(ui)return;
 hostCompactNow=typeof deps?.compactNow==='function'?deps.compactNow:null;
 const line=buildLine();
 const dock=buildDock();
 if(!line||!dock)return;
 ui={...line,...dock,contractReading:false,contractFile:null,contractReturn:null,returnFocus:null};
 wire();
 updateContextDock();
}
