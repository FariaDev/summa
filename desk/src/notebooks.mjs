// @ts-check
import {t,LANGUAGE_EVENT} from './ui-text.mjs';
import {icon} from '../icons.mjs';
import {formatNotebookItem,notebookCourseColor} from './notebooks-format.mjs';

/* Vista da biblioteca de cadernos (#133): o item "Cadernos" de Mais opções
   (e o atalho) abre o painel encaixado abaixo do cabeçalho da sessão, com os
   `.xopp` de cada matéria — a da aba atual primeiro, as outras agrupadas
   abaixo. O host (`notebooks-host.cjs`) lista e abre no Xournal++; aqui só se
   mostra e se abre. A busca no texto digitado (#158) é o campo no mesmo
   painel: os resultados (caderno, página e trecho) abrem pela mesma ação. Sem
   lei Bend (ADR 0003: listar/abrir não esconde resposta nem alimenta o tutor)
   e sem cache de lista: a lista é lida de novo a cada abertura do painel (o
   host guarda o formato de cada caderno por caminho+mtime, #166). */

/** @typedef {{courseId:string,name:string,path:string,folder:string,mtimeMs:number,color?:string,format?:string}} NotebookItem */
/** @typedef {{courseId:string,items:NotebookItem[]}} NotebookGroup */
/** @typedef {{caminho:string,nomeExibido:string,materia:string,pagina:number,trecho:string}} NotebookSearchHit */
/** @typedef {{list:()=>Promise<{notebooks?:NotebookItem[]}>,open:(payload:{courseId:string,path:string,page?:number})=>Promise<unknown>,search?:(query:string)=>Promise<NotebookSearchHit[]>,inkStatus?:()=>Promise<{status?:string,pagesRead?:number,enabled?:boolean}>,inkSet?:(on:boolean)=>Promise<unknown>,courses:()=>Array<{id?:string,name?:string,color?:string}>,currentCourseId:()=>string,notify:(text:string)=>void,closePops?:()=>void}} NotebooksDeps */

/** Agrupa os cadernos por matéria, com a da aba atual primeiro e as outras
 *  na ordem em que o host manda (mais recente primeiro). Dentro do grupo
 *  vale a ordem do host. Lista vazia não tem grupo nenhum: a vista mostra
 *  o texto de vazio.
 *  @param {NotebookItem[]|null} items @param {string} currentCourseId
 *  @returns {NotebookGroup[]}
 *  @example groupNotebooks([{courseId:'fis',name:'o.xopp',path:'/o.xopp',folder:'',mtimeMs:1}],'')[0].courseId === 'fis'
 */
export function groupNotebooks(items,currentCourseId){
 const groups=[];
 const byId=new Map();
 for(const item of Array.isArray(items)?items:[]){
  if(!item||!item.courseId||!item.name||!item.path)continue;
  let group=byId.get(item.courseId);
  if(!group){group={courseId:item.courseId,items:[]};byId.set(item.courseId,group);groups.push(group);}
  group.items.push(item);
 }
 const current=currentCourseId?byId.get(currentCourseId):null;
 if(current){groups.splice(groups.indexOf(current),1);groups.unshift(current);}
 return groups;
}

/**
 * Sem acento/caixa, com mapa para o original (mesmo molde do host: índices
 * em code units, emoji conta 2).
 *  @param {string} value @returns {{folded: string, starts: number[]}}
 *  @example foldNotebookText('Á') // {folded: 'a', starts: [0]}
 */
function foldNotebookText(value){
 const foldedParts=[];
 /** @type {number[]} */
 const starts=[];
 let origPos=0;
 for(const char of String(value)){
  const form=char.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  for(let offset=0;offset<form.length;offset+=1){
   foldedParts.push(form[offset]);
   starts.push(origPos);
  }
  origPos+=char.length;
 }
 return {folded:foldedParts.join(''),starts};
}

/**
 * Destaque seguro do trecho do caderno: o termo vai num `<mark>` criado por
 * `createElement`/`textContent` (nunca `innerHTML` com texto do caderno),
 * então um trecho como `<img src=x onerror=…>` aparece literal.
 *  @param {ParentNode} parent onde o texto entra
 *  @param {string} trecho texto cru do caderno
 *  @param {string} query termo buscado (sem acento/caixa)
 *  @returns {void}
 *  @example appendNotebookHighlight(excerpt, 'a Equação aqui', 'equacao') // excerpt ganha um mark em "Equação"
 */
export function appendNotebookHighlight(parent,trecho,query){
 const body=String(trecho ?? '');
 const wanted=foldNotebookText(String(query ?? '').trim()).folded.trim();
 const doc=parent && parent.ownerDocument ? parent.ownerDocument : document;
 if(!wanted){
  parent.append(doc.createTextNode(body));
  return;
 }
 const found=foldNotebookText(body);
 const at=found.folded.indexOf(wanted);
 if(at<0){
  parent.append(doc.createTextNode(body));
  return;
 }
 const start=found.starts[at] ?? 0;
 const lastOriginal=found.starts[at+wanted.length-1] ?? start;
 const end=lastOriginal+(body.codePointAt(lastOriginal)>0xFFFF?2:1);
 if(start>0)parent.append(doc.createTextNode(body.slice(0,start)));
 const mark=doc.createElement('mark');
 mark.textContent=body.slice(start,Math.min(end,body.length));
 parent.append(mark);
 const rest=body.slice(Math.min(end,body.length));
 if(rest)parent.append(doc.createTextNode(rest));
}

/** Liga o item "Cadernos" (Mais opções) e o atalho ao painel da lista, que
 *  entra no fluxo da coluna logo depois do cabeçalho. O botão que nascia ao
 *  lado do rascunho saiu no r2: quem abre é o item do menu. As dependências
 *  entram por parâmetro (o padrão da Mesa): lista e abertura vêm do preload,
 *  matérias das abas e a matéria atual do estado, e o erro vai para o toast —
 *  onde a Mesa já mostra erro de ação. Esc e o × fecham e devolvem o foco ao
 *  Mais opções; as setas andam na lista (o mesmo molde dos menus do cabeçalho
 *  do tutor).
 *  @param {NotebooksDeps} deps
 *  @returns {{close:()=>void}}
 *  @example // a montagem real, no `initTutorHeader` (tutor-header.mjs)
 *  initNotebooks({list:()=>window.desk.notebookLibrary(),open:payload=>window.desk.openNotebook(payload),courses:()=>getTabsCourses(),currentCourseId:()=>S.currentCourseId,notify:message=>toast(message),closePops:()=>closeTutorPops()});
 */
let currentView=null;

/** Alterna o painel já ligado (atalho global de Cadernos, D2). A vista nasce
 *  no primeiro `initNotebooks`; antes disso não há o que abrir. */
export function toggleNotebooks(){
 currentView?.toggle();
}

/** Fecha o painel já ligado, sem devolver foco (o Contexto vai abrir no lugar).
 *  Antes do primeiro `initNotebooks` não há o que fechar. */
export function closeNotebooks(){
 currentView?.close();
}

export function initNotebooks(deps){
 const chat=document.querySelector('#chat'),top=chat?.querySelector('.chat-top');
 if(!chat||!top)return {close(){}};
 const pop=document.createElement('div');
 pop.id='notebooks-pop';pop.setAttribute('role','dialog');pop.hidden=true;
 const head=document.createElement('div');
 head.className='dock-head';
 const heading=document.createElement('strong');
 const closeButton=document.createElement('button');
 closeButton.type='button';closeButton.id='notebooks-close';closeButton.className='icon-btn';closeButton.innerHTML=icon('close');
head.append(heading,closeButton);
const list=document.createElement('div');
list.id='notebooks-list';
 /* Campo de busca no texto digitado (#158): só existe quando o preload manda
    a busca; sem ela a lista é a de #133. O resultado mostra caderno, página
    e trecho e abre pela mesma ação, levando a página do trecho. */
 const searchInput=typeof deps.search==='function'?document.createElement('input'):null;
 const searchField=typeof deps.search==='function'?document.createElement('div'):null;
 const searchClear=typeof deps.search==='function'?document.createElement('button'):null;
 const searchIcon=typeof deps.search==='function'?document.createElement('span'):null;
 if(searchInput&&searchField&&searchClear&&searchIcon){
  searchInput.type='search';searchInput.id='notebooks-search';searchInput.className='notebooks-search-input';
  /* O × nativo do `input[type=search]` some no CSS (#158, rodada 4): o
     limpar próprio é maior, tem rótulo e entra na rota de Tab. */
  searchField.className='notebooks-search-field guide-search';
  /* A lupa é a mesma da busca do Guia (`.guide-search-icon`). */
  searchIcon.className='guide-search-icon';searchIcon.setAttribute('aria-hidden','true');searchIcon.innerHTML=icon('search');
  searchClear.type='button';searchClear.id='notebooks-search-clear';searchClear.className='notebooks-search-clear';
  searchClear.hidden=true;searchClear.innerHTML=icon('close');
  searchField.append(searchIcon,searchInput,searchClear);
 }
 const searchStatus=typeof deps.search==='function'?document.createElement('p'):null;
 const searchSpinner=document.createElement('span');
 if(searchStatus){
  searchStatus.className='notebooks-search-status';searchStatus.setAttribute('role','status');searchStatus.setAttribute('aria-live','polite');
  /* Mesmo indicador de 3 pontos da instalação do plugin (N10). */
  searchSpinner.className='ts-dots';searchSpinner.setAttribute('aria-hidden','true');
  searchSpinner.append(document.createElement('span'),document.createElement('span'),document.createElement('span'));
 }
 pop.append(head);
 if(searchField)pop.append(searchField);
 if(searchStatus)pop.append(searchStatus);
 pop.append(list);
 top.after(pop);
 function paintLabels(){
  pop.setAttribute('aria-label',t('notebooks.title'));
  heading.textContent=t('notebooks.title');
  closeButton.setAttribute('aria-label',t('common.close'));
  if(searchInput){
   searchInput.placeholder=t('notebooks.searchPlaceholder');
   searchInput.setAttribute('aria-label',t('notebooks.searchLabel'));
  }
  if(searchClear)searchClear.setAttribute('aria-label',t('notebooks.searchClear'));
 }
 function paintClear(){
  if(searchClear&&searchInput)searchClear.hidden=!searchInput.value;
 }
  paintLabels();
  /* O interruptor da tinta (#158) vem por `import()` na primeira abertura:
     módulo fora do caminho de partida do renderer (tests/measure-boot). */
  /** @type {{element:HTMLElement,refresh:()=>Promise<void>,repaint:()=>void,setActive:(active:boolean)=>void}|null} */
  let inkPanel=null;
  /** @type {Promise<unknown>|null} */
  let inkMounting=null;
  function ensureInkPanel(){
    if(typeof deps.inkStatus!=='function')return Promise.resolve(null);
    if(inkPanel)return inkPanel.refresh();
    inkMounting??=import('./notebooks-ink-panel.mjs').then(module=>{
      inkPanel=module.initNotebooksInk({status:deps.inkStatus,set:deps.inkSet,notify:deps.notify});
      /* Depois da lista no DOM: o Tab e o leitor de tela seguem a tela
         (campo → linhas → interruptor), sem depender de `order` (N2). */
      list.after(inkPanel.element);
      inkPanel.setActive(open());
      return inkPanel.refresh();
    }).catch(error=>{deps.notify(error instanceof Error?error.message:String(error));return null;}).finally(()=>{inkMounting=null;});
    return inkMounting;
  }
  let loading=false;
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let searchTimer;
  let searchGeneration=0;
  const open=()=>!pop.hidden;
  function close(restoreFocus=false){
   clearTimeout(searchTimer);
   searchGeneration+=1;
   pop.hidden=true;
   inkPanel?.setActive(false);
   setSearching(false);
   paintSearchStatus('');
   if(restoreFocus)(/** @type {HTMLButtonElement} */ (document.querySelector('#chat-more'))).focus();
  }
  const rows=()=>/** @type {HTMLButtonElement[]} */ ([...pop.querySelectorAll('.notebooks-row, .notebooks-search-row')]);
  const courseByPath=new Map();
  /** @type {NotebookItem[]} */
  let lastItems=[];
  function ensureCourseMap(){
   if(courseByPath.size)return courseByPath;
   for(const item of lastItems){
    if(item&&item.path&&item.courseId)courseByPath.set(item.path,item.courseId);
   }
   return courseByPath;
  }
 function courseOf(courseId){
  return (deps.courses()||[]).find(entry=>entry&&entry.id===courseId)||null;
 }
 function itemButton(item){
  const formatted=formatNotebookItem(item);
  const row=document.createElement('button');
  row.type='button';row.className='notebooks-row';row.title=formatted.name;
  row.setAttribute('aria-label',[formatted.name,formatted.meta,formatted.format].filter(Boolean).join(', '));
  /* O ícone é decorativo (a cor da matéria não carrega informação sozinha) e
     fica fora da altura do texto: a linha cresce pelo título e pela meta. */
  const marker=document.createElement('span');
  marker.className='notebooks-icon';marker.setAttribute('aria-hidden','true');
  marker.innerHTML=icon('book');
  /* Cor da matéria: o host já a manda no item (#166) quando o `config.json`
     tem `color`; a da aba fica como reserva para listas antigas. */
  const ink=notebookCourseColor({color:item.color||courseOf(formatted.courseId)?.color});
  if(ink)marker.style.setProperty('color',ink);
  const title=document.createElement('span');
  title.className='notebooks-title';title.textContent=formatted.name;
  const meta=document.createElement('span');
  meta.className='notebooks-meta';meta.textContent=formatted.meta;
  row.append(marker,title,meta);
  if(formatted.format){
   const format=document.createElement('span');
   format.className='notebooks-format';format.setAttribute('aria-hidden','true');format.textContent=formatted.format;
   row.append(format);
  }
  row.addEventListener('click',async()=>{
   /* Dois cliques rápidos no mesmo caderno não abrem dois Xournal++: a linha
      trava enquanto a primeira abertura estiver em voo (o mesmo molde do
      botão Salvar em conversation-library.mjs). */
   if(row.disabled)return;
   row.disabled=true;
   try{await deps.open({courseId:formatted.courseId,path:formatted.path});close(true);}
   catch(error){deps.notify(error instanceof Error?error.message:String(error));}
   finally{row.disabled=false;}
  });
  return row;
 }
 function courseName(courseId){
  const course=courseOf(courseId);
  return course&&course.name?String(course.name):courseId;
 }
  let searchRowSeq=0;
  function hitButton(hit,query){
   if(!hit||!hit.caminho)return null;
   const page=Number(hit.pagina)||1;
   const materia=String(hit.materia||'');
   const pageText=t('notebooks.searchPage',{page});
   const row=document.createElement('button');
   row.type='button';row.className='notebooks-search-row';row.title=String(hit.nomeExibido||'');
   row.setAttribute('aria-label',[String(hit.nomeExibido||''),materia,pageText].filter(Boolean).join(', '));
   const title=document.createElement('span');
   title.className='notebooks-title';title.textContent=String(hit.nomeExibido||'');
   const meta=document.createElement('span');
   meta.className='notebooks-meta';meta.textContent=[materia,pageText].filter(Boolean).join(' · ');
   const excerpt=document.createElement('span');
   excerpt.className='notebooks-excerpt';
   /* O trecho é o motivo do resultado: entra na descrição acessível (N3). */
   if(String(hit.trecho||'').trim()){
    excerpt.id=`notebooks-search-excerpt-${++searchRowSeq}`;
    row.setAttribute('aria-describedby',excerpt.id);
   }
   appendNotebookHighlight(excerpt,String(hit.trecho||''),String(query||''));
   row.append(title,meta,excerpt);
  row.addEventListener('click',async()=>{
   /* Dois cliques rápidos no mesmo caderno não abrem dois Xournal++: a linha
      trava enquanto a primeira abertura estiver em voo (o mesmo molde do
      botão Salvar em conversation-library.mjs). O Xournal++ aceita
      `--page=N`, então a página do trecho vai junto na abertura. */
   if(row.disabled)return;
   row.disabled=true;
   try{await deps.open({courseId:courseByPath.get(hit.caminho)||'',path:hit.caminho,page});close(true);}
   catch(error){deps.notify(error instanceof Error?error.message:String(error));}
   finally{row.disabled=false;}
  });
  return row;
 }
  function paintSearchStatus(value,empty=false,loading=false){
   if(!searchStatus)return;
   searchStatus.classList.toggle('notebooks-search-empty',empty);
   /* A contagem ("N resultados") é só para leitor de tela (r2, cadernos.html);
      "Buscando…" e o vazio seguem à vista. */
   searchStatus.classList.toggle('sr-only',Boolean(value)&&!empty&&!loading);
   if(!value&&!loading){searchStatus.replaceChildren();return;}
   searchStatus.replaceChildren(...(loading?[searchSpinner]:[]),document.createTextNode(value));
  }
  /* "Buscando…" (#158, rodada 4): as linhas antigas ficam em contraste cheio
     e inertes (sem clique nem foco) até a resposta; a espera é do status. */
  function setSearching(on){
   list.classList.toggle('notebooks-searching',on);
   list.inert=on;
   if(on)list.setAttribute('aria-busy','true');
   else list.removeAttribute('aria-busy');
  }
   async function renderSearch(query){
   const seq=++searchGeneration;
   setSearching(true);
   ensureCourseMap();
   paintSearchStatus(t('notebooks.searchLoading'),false,true);
   let hits;
   try{hits=await (deps.search?deps.search(query):[]);}
   catch(error){
    if(seq!==searchGeneration)return;
    setSearching(false);
    deps.notify(error instanceof Error?error.message:String(error));
    paintSearchStatus('');
    return;
   }
   if(seq!==searchGeneration)return;
   setSearching(false);
   list.replaceChildren();
   const rows_=(Array.isArray(hits)?hits:[]).map((hit)=>hitButton(hit,query)).filter(Boolean);
   /* O vazio é uma mensagem só no próprio status (F6): nada de um segundo
      parágrafo dentro da lista, longe do campo. */
   paintSearchStatus(rows_.length
     ?t('notebooks.searchCount',{count:rows_.length})
     :`${t('notebooks.searchEmpty')} ${t('notebooks.searchEmptyHint')}`,!rows_.length);
   for(const row of rows_)list.append(row);
  }
   async function render(){
   searchGeneration+=1;
   paintSearchStatus('');
   void ensureInkPanel();
   setSearching(false);
   if(!(searchInput&&searchInput.value.trim()))list.replaceChildren();
   let items=[];
   try{
    const result=await deps.list();
    items=Array.isArray(result?.notebooks)?result.notebooks:[];
   }catch(error){deps.notify(error instanceof Error?error.message:String(error));}
   lastItems=items;
   /* Matéria atual e nomes das matérias entram no mesmo try: se um deles
      falhar, a vista mostra o erro no toast em vez de uma rejeição solta. */
   try{
    courseByPath.clear();
    for(const item of items){
     if(item&&item.path&&item.courseId)courseByPath.set(item.path,item.courseId);
    }
    if(searchInput&&searchInput.value.trim()){
     await renderSearch(searchInput.value);
     return;
    }
   const groups=groupNotebooks(items,deps.currentCourseId());
   if(!groups.length){
    const empty=document.createElement('p');
    empty.className='notebooks-empty';empty.textContent=t('notebooks.empty');
    list.append(empty);return;
   }
   for(const group of groups){
    const heading=document.createElement('h3');
    heading.className='notebooks-group';heading.textContent=courseName(group.courseId);
    list.append(heading);
    for(const item of group.items)list.append(itemButton(item));
   }
  }catch(error){deps.notify(error instanceof Error?error.message:String(error));}
 }
  /** @type {HTMLElement|null} */
  let focusReturn=null;
  async function toggle(){
   if(open()){
    close(true);
    const target=focusReturn;
    focusReturn=null;
    if(target&&target.isConnected!==false&&typeof target.focus==='function')target.focus();
    return;
   }
   const active=/** @type {HTMLElement|null} */ (document.activeElement);
   focusReturn=active&&typeof active.focus==='function'?active:null;
   deps.closePops?.();
   if(searchInput)searchInput.value='';
   paintClear();
   pop.hidden=false;
   inkPanel?.setActive(true);
   if(!loading){loading=true;try{await render();}finally{loading=false;}}
   /* Se o popover fechou enquanto a lista carregava, nada de focar uma linha
      de um popover oculto (o foco ficaria órfão). Com busca, o foco vai para
      o campo de busca. */
   if(open()){
    if(searchInput)searchInput.focus();
    else rows()[0]?.focus();
   }
  }
  if(searchInput&&searchClear&&typeof deps.search==='function'){
  /* A busca espera o fim da digitação; o resultado vai para a mesma lista e o
     foco continua no campo (o Enter abre o primeiro resultado). */
  searchInput.addEventListener('input',()=>{
   const value=searchInput.value;
   paintClear();
   clearTimeout(searchTimer);
   searchTimer=setTimeout(()=>{void (value.trim()?renderSearch(value):render());},150);
  });
  searchInput.addEventListener('keydown',event=>{
   if(event.key==='Enter'){event.preventDefault();rows()[0]?.focus();}
  });
  searchClear.addEventListener('click',()=>{
   searchInput.value='';
   clearTimeout(searchTimer);
   /* Foco antes de esconder o botão: esconder o elemento focado soltaria o
      foco no body (#158, rodada 4). */
   searchInput.focus();
   paintClear();
   void render();
  });
 }
 /* Esc com o foco fora do painel (por exemplo depois de um botão interno sumir)
    também fecha: sem o clique-fora, o documento é a última saída. O handler do
    pop chama stopPropagation, então não fecha duas vezes. */
 document.addEventListener('keydown',event=>{
  if(event.defaultPrevented)return;
  if(event.key==='Escape'&&open()){event.preventDefault();close(true);}
 });
 pop.addEventListener('click',event=>event.stopPropagation());
 pop.addEventListener('keydown',event=>{
  const items=rows(),active=document.activeElement;
  const at=active?items.indexOf(/** @type {HTMLButtonElement} */ (active)):-1;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}
  else if(event.key==='ArrowDown'){event.preventDefault();items[at<0?0:(at+1)%items.length]?.focus();}
  else if(event.key==='ArrowUp'){event.preventDefault();items[at<0?items.length-1:(at-1+items.length)%items.length]?.focus();}
  else if(event.key==='Home'){event.preventDefault();items[0]?.focus();}
  else if(event.key==='End'){event.preventDefault();items.at(-1)?.focus();}
 });
 closeButton.addEventListener('click',()=>close(true));
 window.addEventListener(LANGUAGE_EVENT,()=>{paintLabels();if(open()&&!loading){loading=true;void render().finally(()=>{loading=false;});}});
 window.addEventListener('mesa-keys-changed',()=>paintLabels());
 const view={close:()=>close(),toggle:()=>toggle()};
 currentView=view;
 return view;
}
