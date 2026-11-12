import {displayUserText} from '../text.mjs';
import {$,toast,applyChatScroll} from './state.mjs';
import {message as uiMessage} from './i18n.mjs';
import {build,htmlNode,applyIcons} from './view-host.mjs';
import {openReviewFromMessage} from './review-loader.mjs';
import {copiedMark,flashMark} from './icon-motion.mjs';
import {t,formatDate,LANGUAGE_EVENT} from './ui-text.mjs';
import {markOf} from './marked-pages.mjs';
import {icon} from '../icons.mjs';
import {hydrateAssets,bendList,wrapCopy} from './chat-assets.mjs';
import {selectionInsideMessages} from './chat-quote.mjs';
import {deferLazyBubble,watchLazyShell} from './history-format-lazy.mjs';
import {linkifyRefs} from './chat-refs.mjs';
import talkCore from './generated/talkview.core.js';
import {paintMessageBody} from './chat-stream-view.mjs';
import {turnState} from './chat-turn-state.mjs';
import {installMessageLinks} from './message-links.mjs';
import {markRetryAnswer} from './chat-retry.mjs';

/* Coluna do tutor — a bolha de mensagem: criar, pintar (Markdown + LaTeX,
   imagens) e atualizar no fluxo.
   Saiu de chat.mjs na #43 fase 2. */

const CLOCK={hour:'2-digit',minute:'2-digit',hour12:false};
/** Hora da resposta no relógio da interface; '' sem carimbo. @param {number} stamp */
function clockText(stamp){
 const at=Number(stamp);
 return Number.isFinite(at)&&at>0?formatDate(new Date(at),CLOCK):'';
}
/* Linha de metadados da resposta (etapa 4): a hora fica sempre à vista, no
   começo das ações; copiar/citar/guardar seguem os mesmos botões de sempre,
   com o mesmo hover. O modelo que respondeu só entra quando veio com a
   própria mensagem (histórico do motor ou evento); o seletor atual nunca é
   usado como palpite. */
export function setMessageTime(el,stamp){
 if(!el)return;
 const at=Number(stamp);
 el._time=Number.isFinite(at)&&at>0?at:0;
 paintMessageTime(el);
}
/* Modelo da resposta: `model` é o nome completo (`provedor/modelo`) para o
   `title`; `modelName` é o curto que aparece na linha. Sem nome curto, o
   completo aparece — nunca se inventa um modelo. */
export function setMessageModel(el,model,modelName=''){
 if(!el)return;
 el._model=typeof model==='string'?model.trim():'';
 el._modelName=(typeof modelName==='string'?modelName.trim():'')||el._model;
 paintMessageTime(el);
}
function paintMessageTime(el){
 if(!el||el.classList?.contains('user'))return;
 const actions=el.querySelector?.('.message-actions');
 if(!actions)return;
 const clock=clockText(el._time);
 const model=typeof el._modelName==='string'?el._modelName:'';
 const text=[clock,model].filter(Boolean).join(' · ');
 let time=actions.querySelector('.message-time');
 if(!text){time?.remove();return;}
 if(!time){time=document.createElement('span');time.className='message-time';actions.prepend(time);}
 time.textContent=text;
 if(el._model)time.title=el._model;else time.removeAttribute('title');
}
if(typeof window!=='undefined')window.addEventListener(LANGUAGE_EVENT,()=>{
 for(const el of document.querySelectorAll('#messages .message'))paintMessageTime(el);
});
/* O rótulo acessível da página marcada (#113): o `source` da imagem guarda o
   marcador (`mesa-pdf-mark:<página>:<arquivo>`), nunca HTML do modelo. */
export function markedPageAlt(source){
 const mark=markOf(source);
 if(!mark)return '';
 return mark.file?t('talk.imageMarkedPageFile',{page:mark.page,file:mark.file}):t('talk.imageMarkedPage',{page:mark.page});
}
function paintImageAlts(body,sources){
 const list=Array.isArray(sources)?sources:[];
 if(!list.length)return;
 const images=[...body.querySelectorAll('img.shot')];
 for(let i=0;i<images.length;i++){
  const alt=markedPageAlt(list[i]);
  if(alt)images[i].alt=alt;
 }
}
function message(role,text,images=[],parent=null,files=[],imageSources=[],time=0,model='',modelName=''){
 let el;
 const handlers={
  CopyMessage:async e=>{e.stopPropagation();try{await navigator.clipboard.writeText(el._raw||el.querySelector('.body').innerText);flashMark(e.target.closest?.('.msg-copy'),copiedMark(),t('talk.copied'));toast(uiMessage('toast.messageCopied'));}catch(err){toast(err.message);}},
  SaveForReview:()=>openReviewFromMessage(el).catch(err=>toast(err.message)),
 };
 el=build(talkCore.message(role==='user',htmlNode(''),bendList(images),true,false,role!=='user'),handlers);
 el._imageSources=Array.isArray(imageSources)?imageSources:[];
 applyIcons(el,icon);
 setMessageTime(el,time);
 if(role!=='user')setMessageModel(el,model,modelName);
 /* Links no corpo da resposta abrem pelo diálogo da Mesa (F): um ouvinte só
    na coluna, delegado para o histórico e o stream. */
 installMessageLinks(document.querySelector('#messages'));
 el._files=Array.isArray(files)?files.slice():[];
  if(role!=='user')el.querySelector('.role').textContent='Tutor';
  /* Lote do histórico em conversa longa (#118): a bolha nasce em casca (texto
     cru) e o rico entra perto da vista. A viva do stream nunca passa por aqui:
     o lote só arma dentro do `showHistory`. */
  if(deferLazyBubble())return lazyShell(el,text,images,parent,imageSources);
  (parent||$('#messages')).append(el);updateMessage(el,text,images);return el;
}
/* Formatar uma casca não é envio nem stream: sem esta marca, cada pergunta antiga
   que chegasse perto da vista passava por `applyChatScroll('send')` e puxava o
   aluno para ela. Quem seguia o fim continua seguindo pelo ResizeObserver. */
let paintingLazyShell=false;
/* Casca preguiçosa: o mesmo andaime (ações, imagens, arquivos) com o texto via
   `textContent` — `$...$`, cerca de código e `<script>` ficam literais, sem
   executar nada; o rico usa o mesmo `updateMessage` do desenho direto. */
function lazyShell(el,text,images,parent,imageSources){
  el._raw=text;
  /* A região `#messages` é `aria-live=polite`: formatar a casca troca os nós e
     o leitor anunciaria a conversa inteira em massa (#118). A bolha em casca
     desliga o anúncio (descendente sobrepõe a região) e mantém isso depois de
     formatada; mensagem nova (envio e stream) continua anunciada. */
  el.setAttribute('aria-live','off');
  el._pendingImages=Array.isArray(images)?images:[];
  if(Array.isArray(imageSources))el._imageSources=imageSources;
  const body=el.querySelector('.body');
  if(body){
    body.prepend(document.createTextNode(displayUserText(text||'')));
    paintFiles(body,el._files,el);
    for(const img of body.querySelectorAll('img.shot'))wrapCopy(img);
  }
  (parent||$('#messages')).append(el);
  watchLazyShell(el,()=>{
    paintingLazyShell=true;
    try{updateMessage(el,el._raw,el._pendingImages);}finally{paintingLazyShell=false;}
  });
  return el;
}
function paintMessage(el,text,images,live){
 /* No lote de histórico quem rola é o `showHistory`, uma vez. Medir aqui
    forçava um layout por mensagem (o token longo congelava o Blink). */
 const batch=turnState.historyStick!==null||paintingLazyShell;
 const body=el.querySelector('.body');
 paintMessageBody(body,displayUserText(text||''),images||[],live);
 paintImageAlts(body,el._imageSources);
 window.dispatchEvent(new CustomEvent('desk-media-painted',{detail:{body}}));
 paintFiles(body,el._files,el);
 if(!live)hydrateAssets(body);
 if(!live)linkifyRefs(body);
 for(const img of body.querySelectorAll('img.shot'))wrapCopy(img);
 if(batch)return;
 /* `send` e `stream` decidem só por `chatFollow` (nunca pela distância):
    medir aqui forçava um layout por repintura, sem mudar a rolagem. */
 const intent=el.classList.contains('user')&&!live?'send':'stream';
 applyChatScroll(intent,intent==='send'?el:null,0);
}
function paintFiles(body,files,el){
 const list=Array.isArray(files)?files:[];
 if(!list.length)return;
 const row=document.createElement('div');row.className='message-files';
 for(const file of list){
  const name=typeof file==='string'?file:String(file?.name||'PDF');
  const pages=Number(file?.pages)||0;
  const chip=document.createElement('div');chip.className='attachment message-file';
  const label=document.createElement('div');label.className='file';
  label.textContent=pages>0?t('chatpdf.chip',{name,count:pages}):name;
  const remove=document.createElement('button');
  remove.type='button';remove.className='attachment-remove';remove.textContent='×';
  remove.setAttribute('aria-label',t('attach.remove',{name}));
  remove.addEventListener('click',event=>{
   event.stopPropagation();
   el._files=(el._files||[]).filter(item=>item!==file);
   chip.remove();
   if(!row.childElementCount)row.remove();
  });
  chip.append(label,remove);
  row.append(chip);
 }
 body.append(row);
}
function updateMessage(el,text,images,live){
 if(text!=null)el._raw=text;
 if(!live){clearTimeout(el._tick);el._tick=0;paintMessage(el,text,images);return;}
 el._live=text;if(el._tick)return;el._tick=setTimeout(()=>{el._tick=0;if(selectionInsideMessages())return;paintMessage(el,el._live,[],true);},80);
}

/* A última resposta concluída guarda o ícone de salvar à vista (#90): o aluno
   não precisa passar o mouse pela conversa para achar a última. Durante o
   streaming a marca sai — a resposta ainda está mudando. */
export function clearLatestAnswer(){
 for(const marked of document.querySelectorAll('#messages .message[data-latest-answer]'))marked.removeAttribute('data-latest-answer');
}
export function markLatestAnswer(){
 const box=$('#messages');if(!box)return;
 const answers=[...box.querySelectorAll('.message:not(.user)')].filter(el=>el.querySelector('.msg-review'));
 clearLatestAnswer();
 const last=answers.at(-1);
 last?.setAttribute('data-latest-answer','');
 /* #164: o refazer acompanha a última resposta, não o marcador de salvar (que
    some durante o streaming para o ícone não parecer disponível). */
 markRetryAnswer(last);
}

export {message,updateMessage};
