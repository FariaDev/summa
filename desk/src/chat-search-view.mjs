// @ts-check
/* Busca na conversa do tutor (#122): a barra da coluna do tutor, o destaque e a
   rolagem. A regra de busca mora em `chat-search.mjs` (fonte + dobra); aqui só
   entram DOM, foco e teclado.

   O destaque usa a CSS Custom Highlight API (`Range` + `CSS.highlights`), sem
   `innerHTML` e sem trocar nós de texto: seleção, citação e leitor de tela
   continuam lendo a conversa. A casca da #118 é formatada só quando a ocorrência
   é visitada. */
import {createChatSearchSource,fold,foldText,searchEntries,stepHit} from './chat-search.mjs';
import {t,LANGUAGE_EVENT} from './ui-text.mjs';
import {messageScroller} from './state.mjs';
import {revealInChat} from './chat-scroll-view.mjs';
import {formatLazyShell} from './history-format-lazy.mjs';
import {noteHistoryOwnScroll} from './history-scroll-anchor.mjs';

const HIGHLIGHT='mesa-chat-find';
const SEARCH_DELAY=80;
const VIEW_MARGIN=12;

let bar=null,input=null,countEl=null;
/** @type {ReturnType<typeof setTimeout>|0} */
let previewTimer=0;
/* Histórico pelo `setChatSearchSource`; fala viva pelo `addChatSearchEntry`. */
const chatSearchSource=createChatSearchSource();
/** @type {Array<{text: string, el: Element, folded: string|null, source: boolean}>} */
let lastEntries=[];
/** @type {import('./chat-search.mjs').SearchResult|null} */
let result=null;
let current=-1;
let searchedQuery='';

/** Descarta a fonte e o destaque da conversa que saiu da tela e fecha a busca. */
export function resetChatSearch(){
  closeChatSearch();
  clearTimeout(previewTimer);
  previewTimer=0;
  chatSearchSource.clear();
  clearHighlight();
  lastEntries=[];
  result=null;
  current=-1;
  searchedQuery='';
  if(bar){input.value='';paintCount();}
}

/**
 * Guarda o texto que o `showHistory` montou em cada balão. É a FONTE (turnos do
 * `historyTurns`), não o DOM formatado — a casca ainda não tem rico.
 * @param {Array<{text?: unknown, el?: Element|null}>} entries
 * @returns {void}
 * @example setChatSearchSource([{text: turn.userText, el: userBubble}])
 */
export function setChatSearchSource(entries){
  clearHighlight();
  chatSearchSource.set(entries);
  lastEntries=[];
  result=null;
  current=-1;
  searchedQuery='';
  if(bar)paintCount();
}

/**
 * Registra a fala que terminou de aparecer ao vivo (envio do aluno ou resposta
 * do tutor). A mesma bolha atualiza o texto no lugar; com a busca aberta, a
 * contagem é refeita sem perder a ocorrência atual.
 * @param {{text?: unknown, el?: Element|null}} entry
 * @returns {boolean} ex.: addChatSearchEntry({text:'resposta final',el:bubble}) // true
 */
export function addChatSearchEntry(entry){
  if(!chatSearchSource.add(entry))return false;
  if(bar&&!bar.hidden&&foldQuery())runSearch();
  return true;
}

function ensureBar(){
  if(bar)return bar;
  const top=document.querySelector('#chat > .chat-top');
  if(!top)return null;
  const root=document.createElement('div');
  root.id='chat-find';
  root.className='chat-find';
  root.hidden=true;
  root.setAttribute('role','search');
  const label=document.createElement('label');
  label.className='visually-hidden';
  label.htmlFor='chat-find-input';
  label.textContent=t('chat.search.aria');
  input=document.createElement('input');
  input.id='chat-find-input';
  input.type='search';
  input.autocomplete='off';
  input.spellcheck=false;
  input.maxLength=200;
  input.setAttribute('aria-label',t('chat.search.aria'));
  countEl=document.createElement('span');
  countEl.className='chat-find-count';
  countEl.setAttribute('role','status');
  countEl.setAttribute('aria-live','polite');
  countEl.hidden=true;
  const prev=button('previous',t('chat.search.prev'),'↑');
  const next=button('next',t('chat.search.next'),'↓');
  const close=button('close',t('chat.search.close'),'×');
  root.append(label,input,countEl,prev,next,close);
  top.after(root);
  bar=root;
  input.addEventListener('input',()=>{current=-1;result=null;countEl.hidden=true;clearHighlight();schedulePreview();});
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();navigate(event.shiftKey?-1:1);return;}
    if(event.key==='ArrowDown'){event.preventDefault();navigate(1);return;}
    if(event.key==='ArrowUp'){event.preventDefault();navigate(-1);return;}
  });
  prev.addEventListener('click',()=>{navigate(-1);input.focus({preventScroll:true});});
  next.addEventListener('click',()=>{navigate(1);input.focus({preventScroll:true});});
  close.addEventListener('click',()=>closeChatSearch());
  /* O clique não tira o foco da caixa: Enter e as setas seguem valendo. */
  for(const item of [prev,next,close]){
    item.addEventListener('mousedown',event=>event.preventDefault());
  }
  window.addEventListener(LANGUAGE_EVENT,paintText);
  window.addEventListener('desk-conversation-changed',resetChatSearch);
  paintText();
  return bar;
}

function button(kind,label,glyph){
  const el=document.createElement('button');
  el.type='button';
  el.className=`chat-find-${kind}`;
  el.textContent=glyph;
  el.title=label;
  el.setAttribute('aria-label',label);
  return el;
}

function paintText(){
  if(!bar)return;
  input.placeholder=t('chat.search.placeholder');
  input.setAttribute('aria-label',t('chat.search.aria'));
  bar.querySelector('.chat-find-previous').title=t('chat.search.prev');
  bar.querySelector('.chat-find-previous').setAttribute('aria-label',t('chat.search.prev'));
  bar.querySelector('.chat-find-next').title=t('chat.search.next');
  bar.querySelector('.chat-find-next').setAttribute('aria-label',t('chat.search.next'));
  bar.querySelector('.chat-find-close').title=t('chat.search.close');
  bar.querySelector('.chat-find-close').setAttribute('aria-label',t('chat.search.close'));
  bar.querySelector('label').textContent=t('chat.search.aria');
  paintCount();
}

function schedulePreview(){
  clearTimeout(previewTimer);
  previewTimer=setTimeout(()=>{previewTimer=0;runSearch();},SEARCH_DELAY);
}

/* Balões vivos (envio/stream) entram pelo `_raw` enquanto não foram
   registrados; ao terminar, o `addChatSearchEntry` fixa o texto final. */
function sourceEntries(){
  const box=document.getElementById('messages');
  if(!box)return [];
  for(const el of box.children){
    if(!el.classList?.contains('message'))continue;
    const entry=chatSearchSource.get(el);
    if(!entry){
      chatSearchSource.add({text:rawOf(el),el});
      continue;
    }
    if(entry.source)continue;
    const raw=String(rawOf(el));
    if(raw!==entry.text){entry.text=raw;entry.folded=null;}
  }
  return chatSearchSource.list();
}

/* Texto-fonte guardado pela bolha viva (`message()`/`updateMessage`). */
function rawOf(el){
  return /** @type {{_raw?: unknown}} */ (el)._raw??'';
}

function runSearch(){
  lastEntries=sourceEntries();
  result=searchEntries(lastEntries,foldQuery());
  searchedQuery=result.needle;
  current=Math.min(current,result.total-1);
  paintCount();
  return result;
}

function foldQuery(){
  return fold(input?.value??'').trim();
}

function paintCount(){
  if(!countEl)return;
  const needle=foldQuery();
  if(!needle||!result){
    countEl.hidden=true;
    countEl.textContent='';
    countEl.classList.remove('none');
    return;
  }
  countEl.hidden=false;
  if(!result.total){
    countEl.textContent=t('chat.search.none');
    countEl.classList.add('none');
    return;
  }
  const shown=current<0?0:current+1;
  countEl.textContent=t('chat.search.count',{current:shown,total:result.total});
  countEl.classList.toggle('none',shown===0);
}

function navigate(delta){
  if(!bar||bar.hidden)return -1;
  clearTimeout(previewTimer);
  previewTimer=0;
  const needle=foldQuery();
  if(needle!==searchedQuery){
    searchedQuery=needle;
    current=-1;
    clearHighlight();
  }
  if(!result||result.needle!==needle)runSearch();
  const target=stepHit(current,result?.total||0,delta);
  if(target<0){current=-1;paintCount();return -1;}
  current=target;
  paintCount();
  const hit=result.hits[current];
  const entry=lastEntries[hit.entryIndex];
  if(entry)revealOccurrence(entry,hit.occurrence);
  return current;
}

function revealOccurrence(entry,occurrence){
  const el=entry.el;
  if(!el?.isConnected)return;
  formatLazyShell(el);
  const body=el.querySelector('.body');
  const needle=foldQuery();
  const ranges=body?domRanges(body,needle):[];
  const range=ranges.length?ranges[Math.min(occurrence,ranges.length-1)]:null;
  clearHighlight();
  if(range)setHighlight(range);
  /* `revealInChat` desliga o "seguir o fim" quando a busca sobe a conversa:
     sem isso o ResizeObserver do formato puxava a vista de volta ao rodapé. */
  revealInChat(el);
  reveal(range||el);
}

function domRanges(root,needle){
  if(!needle || typeof document==='undefined')return [];
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let folded='';
  /** @type {Array<{node: Node, start: number, end: number}>} */
  const map=[];
  while(walker.nextNode()){
    const node=walker.currentNode;
    const value=node.nodeValue;
    if(!value)continue;
    if(node.parentElement?.closest?.('.katex, .katex-display, .katex-mathml'))continue;
    let piece=foldText(value);
    if(!piece.folded)continue;
    if(folded.endsWith(' ')&&piece.folded.startsWith(' ')){
      piece={folded:piece.folded.slice(1),map:piece.map.slice(1)};
    }
    for(const slot of piece.map)map.push({node,start:slot.start,end:slot.end});
    folded+=piece.folded;
  }
  const ranges=[];
  let at=0;
  while((at=folded.indexOf(needle,at))!==-1){
    const first=map[at];
    const last=map[at+needle.length-1];
    if(first&&last){
      try{
        const range=document.createRange();
        range.setStart(first.node,first.start);
        range.setEnd(last.node,last.end);
        ranges.push(range);
      }catch{}
    }
    at+=needle.length;
  }
  return ranges;
}

function setHighlight(range){
  try{
    if(typeof CSS==='undefined'||!CSS.highlights||typeof Highlight==='undefined')return;
    CSS.highlights.set(HIGHLIGHT,new Highlight(range));
  }catch{}
}

function clearHighlight(){
  try{CSS?.highlights?.delete(HIGHLIGHT);}catch{}
}

let revealToken=0,revealFrame=0;
/* O rico e o `content-visibility` mudam a altura em quadros seguintes: mede de
   novo por alguns quadros até a ocorrência assentar na vista (nunca deixa a
   busca cair num lugar que a pintura seguinte desfaz). No Windows a casca
   longa assenta depois dos 5 quadros antigos; 20 dão folga sem rolar de novo
   quando a ocorrência já está centrada. */
function reveal(target){
  const token=++revealToken;
  if(revealFrame)cancelAnimationFrame(revealFrame);
  const step=attempt=>{
    if(token!==revealToken)return;
    centerOn(target);
    /* Mesmo parado, segue medindo: a casca pode crescer acima depois de já
       estar centrada e empurrar a ocorrência para fora (Windows e casca longa). */
    if(attempt<20)revealFrame=requestAnimationFrame(()=>step(attempt+1));
  };
  step(0);
}

function centerOn(target){
  const scroller=messageScroller();
  if(!scroller||!target?.getBoundingClientRect)return false;
  const view=scroller.getBoundingClientRect();
  const rect=target.getBoundingClientRect();
  if(rect.top>=view.top+VIEW_MARGIN&&rect.bottom<=view.bottom-VIEW_MARGIN)return false;
  const height=Math.min(rect.height,scroller.clientHeight);
  const before=scroller.scrollTop;
  scroller.scrollTop=Math.max(0,scroller.scrollTop+(rect.top-view.top)-(scroller.clientHeight-height)/2);
  if(scroller.scrollTop!==before)noteHistoryOwnScroll(scroller.scrollTop);
  return true;
}

/**
 * Abre a busca da conversa e leva o foco para a caixa.
 * @returns {boolean} ex.: openChatSearch() // true
 */
export function openChatSearch(){
  const root=ensureBar();
  if(!root)return false;
  root.hidden=false;
  input.focus();
  input.select();
  paintText();
  return true;
}

/**
 * Fecha a busca, limpa o destaque e devolve o foco ao composer.
 * @returns {boolean} ex.: closeChatSearch() // true quando estava aberta
 */
export function closeChatSearch(){
  if(!bar||bar.hidden)return false;
  clearTimeout(previewTimer);
  previewTimer=0;
  bar.hidden=true;
  clearHighlight();
  current=-1;
  if(countEl){countEl.textContent='';countEl.hidden=true;}
  const prompt=document.getElementById('prompt');
  prompt?.focus();
  return true;
}
