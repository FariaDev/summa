import {contentParts} from '../text.mjs';
import {$,S,toast,toastFailure,conferirAppName,activity,activityLive,applyChatScroll,revealInChat,connectionState,distanceFromEnd,messageScroller,refs,save,layoutSnapshot,setBusy,refreshMeter,connect,cancelConnect,supportsCapability,syncChatScrollMode,paintComposerSend} from './state.mjs';
import tutorStateCore from './generated/tutorstate.core.js';
import {t as uiT,text as uiText,tutorText} from './ui-text.mjs';
import {message as uiMessage} from './i18n.mjs';
import conferirCore from './generated/conferir.core.js';
import {captureFileName} from './capture-name.mjs';
import {playShutter} from './icon-motion.mjs';
import {beginCaptureLock,captureLockValid,endCaptureLock} from './capture-lock.mjs';
import {createWorkLogView} from './worklog-view.mjs';
import {installAssetListeners} from './chat-assets.mjs';
import {addAttachments,clearAttachments,installAttachmentListeners} from './chat-attachments.mjs';
import {mentionIds,clearMentions} from './mentions.mjs';
import {installQuoteListeners} from './chat-quote.mjs';
import {showDialog,cancelDialogRequest,installDialogListeners} from './chat-dialogs.mjs';
import {createCardBoard} from './chat-cards.mjs';
import {revealMessageBubble} from './reveal-message.mjs';
import {cardToolKind} from './cards/toolnames.mjs';
import {claudeActivityNotice,claudeLimitNotice,deskErrorIsFatal} from './claude-questions.mjs';
import * as worklog from './worklog.mjs';
import * as timeline from './timeline.mjs';
import {markup,markupInline} from './markdown.mjs';
import {activityDetailsOf,activitySlotElement,appendAssistantDelta,assistantAnchorAfter,closeSegment,declareTool,ensureActivitySlot,ensureAssistantId,nextAssistantId,openSegment,openTurnLog,paintLive,paintMarkedPageImages,rememberToolAnchors,renderSegment,renderTurn,resetAssistantBlock,resetAssistantBuffers,scheduleTurn,settleAssistantBlock,settleTurn,staleEvent,toolResultFor} from './chat-turn.mjs';
import {activitySlots,assistantAnchors,resetRetiredLedgers,turnState} from './chat-turn-state.mjs';
import {applyActivityNotice,applyLimitNotice,clearNotices} from './chat-notices.mjs';
import {clearLatestAnswer,markLatestAnswer,message,setMessageModel,setMessageTime,updateMessage} from './chat-message-view.mjs';
import {freeLimitKey,freeLimitMessageKey,showFreeLimitNote} from './free-limit-notice.mjs';
import {previewIdOf,showUnpublishedPreview} from './chat-preview-fallback.mjs';
/* O renderer Markdown+LaTeX vive em `markdown.mjs` (compartilhado com o chat
   lateral); o realce de código e o pipeline do antigo `chat.mjs` são os mesmos.
   `markup` é reexportado pela compatibilidade dos imports antigos. */
export {markup,markupInline};
/* Os importadores antigos (main, pdf, queue, state, ggb, testes) seguem pelo chat. */
export {MAX_ATTACH,MAX_ATTACH_BYTES,persistTray,addAttachments,resetAttachments,restoreAttachments} from './chat-attachments.mjs';
export {hideQuoteButton,insertMainDraft} from './chat-quote.mjs';
import {createShownHistory} from './history-shown.mjs';
import {cachedHistoryTurns} from './history-render-cache.mjs';
import {beginLazyHistory,finishLazyHistory} from './history-format-lazy.mjs';
import {recoverActivitySlots} from './history-activity-slots.mjs';
import {openChatSearch,closeChatSearch,setChatSearchSource,addChatSearchEntry} from './chat-search-view.mjs';
export {openChatSearch,closeChatSearch};

/* Identidade do histórico que está no DOM (#115). Quem a calcula é o main (o
   mesmo hash nos dois payloads); aqui só guardamos a última montagem para o
   connect não remontar o mesmo conteúdo que o cache do descritor já pintou. */
const shownHistory=createShownHistory(()=>$('#messages'));
export function historyIdentityShown(){return shownHistory.current();}
/* Cartões `quiz`/`perguntar` (#92): o host registra e emite; o cartão é da
   conversa, não do turno. "Concluir" arma o turno normal — o resultado chega
   pelo mesmo caminho de uma resposta do tutor e a fila/follow-up é a do motor. */
const cardBoard=createCardBoard({
 messages:()=>$('#messages'),
 api:{
  answer:(id,answer)=>window.desk.cardAnswer({id,answer}),
  draft:(id,draft)=>window.desk.cardDraft({id,draft}),
  dismiss:id=>window.desk.cardDismiss({id}),
  conclude:id=>window.desk.cardConclude({id}),
  /* Nota sugerida (#139): só este clique grava em Notas/; o main revalida. */
  noteSave:id=>window.desk.noteCardSave({id}),
 },
 onSending(){turnState.promptArmed=true;setBusy(true);activity(uiMessage('tutor.thinking'));},
 onSettled(_card,streaming){turnState.promptArmed=false;setBusy(streaming);if(!streaming)activity('');},
 onFailed(_card,error){turnState.promptArmed=false;setBusy(false);activity('');toast(error||uiMessage('quiz.sendFailed'));},
});
/* #143: o índice da busca global vai na bolha montada; sem ele o resultado
   abria no fim da conversa. */
function tagMessageIndex(el,index){
 if(el&&Number.isInteger(index)&&index>=0)el.setAttribute('data-message-index',String(index));
 return el;
}
/* Geração da montagem do histórico: a recuperação dos slots do store (H4) é
   assíncrona e não pode inserir num DOM que outra abertura já substituiu. */
let historySlotsGeneration=0;
export function showHistory(messages,cards=[],identity=null){
 const historyId=typeof identity==='string'&&identity?identity:null;
 if(historyId&&historyId===shownHistory.current()&&((Array.isArray(messages)&&messages.length)||(Array.isArray(cards)&&cards.length)))return;
 const slotsGeneration=++historySlotsGeneration;
 const sessionAtRender=S.currentSession;
 clearNotices();
 if(turnState.turnLog)settleTurn({reason:'switched'});
 turnState.turnClosed=true;turnState.turnRunId=null;turnState.promptArmed=false;
 /* O histórico foi remontado: o ledger local do turno anterior não vale mais
    para o escopo novo (uma identidade nativa pode reaparecer legitimamente). */
 resetRetiredLedgers();
 resetAssistantBuffers();
 activitySlots.clear();
 turnState.turnActivityCalls=new Set();
 /* O corte das imagens roda no compute do cache (#120): a entrada guardada já
    sai cortada e uma reabertura não muta o resultado cacheado. */
 const turns=cachedHistoryTurns(messages||[],historyId,msgs=>trimHistoryImages(worklog.historyTurns(msgs)));
 /* "Estava no fim?" é medido uma vez, antes do lote; o histórico inteiro monta
    num DocumentFragment e entra no DOM de uma vez. O padrão antigo (medir/rolar
    por mensagem) forçava um layout síncrono por mensagem: com um token sem
    espaço a quebra de linha patológica do Blink (~850 ms por layout) multiplicava
    pelas 102 mensagens e congelava o renderer por minutos. O modo de rolagem
    (classe `chat-scroll`) é acertado ANTES da medida para o `atBottom()` olhar o
    scroller de verdade já no primeiro render. */
  syncChatScrollMode();
  const distance=distanceFromEnd();
  /* Lote preguiçoso (#118): em conversa longa as bolhas nascem em casca. */
  beginLazyHistory(Array.isArray(messages)?messages.length:0,messageScroller);
  $('#messages').replaceChildren();
 const frag=document.createDocumentFragment();
 const historySlots=[];
 /* Começo e último nó de cada turno: a recuperação do store (H4) usa os dois
    para pôr o quadro depois da fala do turno em que ele nasceu. */
 const turnRanges=[];
 cardBoard.reset();
 /* Fonte da busca (#122): o texto dos turnos, não o DOM já formatado. */
 const searchEntries=[];
 const sortedCards=[...cards].filter(card=>card&&typeof card.id==='string'&&Number.isFinite(Number(card.createdAt))).sort((a,b)=>Number(a.createdAt)-Number(b.createdAt));
 let nextCard=0;
 const flushCards=(limit=Infinity)=>{
  while(nextCard<sortedCards.length&&Number(sortedCards[nextCard].createdAt)<=limit)frag.append(cardBoard.make(sortedCards[nextCard++]));
 };
 turnState.historyStick=distance<=80;
 try{
  for(const turn of turns){
   flushCards(turn.userTime||turn.startedAt||turn.time||0);
   if(turn.userText||turn.userImages.length||turn.userPdfs?.length)searchEntries.push({text:turn.userText,el:tagMessageIndex(message('user',turn.userText,turn.userImages,frag,turn.userPdfs||[]),turn.userIndex)});
   /* E3: o diário reconstruído começa aberto quando traz motivo e o turno
      não tem resposta. O histórico de hoje não carrega motivo (`reason`
      vazio mantém o recolhido de sempre); a resposta do turno decide. */
   const turnAnswer=String(turn.text||'').trim()!=='';
   const turnReason=turn.reason||'';
   const parts=Array.isArray(turn.parts)?turn.parts:null;
   if(parts&&parts.length){
    for(const part of parts){
     if(part.type==='work'){
      if(!part.steps?.length)continue;
      const view=createWorkLogView();
      frag.append(view.el);
      view.render({steps:part.steps,startedAt:part.startedAt,endedAt:part.endedAt,reason:turnReason,text:''},{live:false,hasAnswer:turnAnswer});
     }else if(part.type==='artifact'){
      const id=String(part.toolCallId||'');
      if(!id)continue;
      /* O slot nasce no PONTO da ferramenta, antes da próxima fala, e o
         renderer de atividades o hidrata depois — `data-activity-call` é a
         identidade estável (o store casa por esse id). */
      const step=(turn.steps||[]).find(item=>String(item.id||'')===id);
      const status=step?.status==='done'?'done':step?.status==='error'?'error':'stopped';
      const el=activitySlotElement(id,status);
      historySlots.push({toolCallId:id,element:el});
      frag.append(el);
     }else if(part.type==='text'){
      searchEntries.push({text:part.text,el:tagMessageIndex(message('assistant',part.text,part.images||[],frag,[],part.imageSources||[],part.time,part.model||'',part.modelName||''),part.messageIndex)});
     }
    }
   }else{
    if(turn.steps.length){
     const view=createWorkLogView();
     frag.append(view.el);
     view.render({steps:turn.steps,startedAt:turn.startedAt,endedAt:turn.endedAt,reason:turnReason,text:turn.text},{live:false,hasAnswer:turnAnswer});
    }
    if(turn.text)searchEntries.push({text:turn.text,el:tagMessageIndex(message('assistant',turn.text,[],frag,[],[],turn.time||turn.endedAt,turn.model||'',turn.modelName||''),turn.messageIndex)});
   }
   turnRanges.push({start:Number(turn.userTime||turn.startedAt||turn.time)||0,tail:frag.lastElementChild});
  }
 }finally{turnState.historyStick=null;}
  flushCards();
  $('#messages').append(frag);
  /* A cauda pinta na hora (é o fim, o que abre primeiro); o lote rearma para a
     cauda não medir/rolar bolha a bolha, como no laço de antes. */
  turnState.historyStick=distance<=80;
  try{finishLazyHistory($('#messages'));}finally{turnState.historyStick=null;}
  markLatestAnswer();
 applyChatScroll('history',null,distance);
 for(const slot of historySlots){
  activitySlots.set(slot.toolCallId,slot.element);
  window.dispatchEvent(new CustomEvent('desk-activity-slot',{detail:slot}));
 }
 /* Depois da carga, o renderer de atividades hidrata os slots pendentes sem
    disparar nada no modelo. */
 window.dispatchEvent(new CustomEvent('desk-history-rendered',{detail:{slots:historySlots.map(slot=>slot.toolCallId)}}));
 /* H4: o quadro publicado a partir da prévia (ou pelo fallback do OpenCode)
    não tem passo de ferramenta no transcript; o store tem o item e o
    histórico precisa do slot para hidratar. A lista chega depois da montagem,
    então a geração guarda contra uma abertura nova no meio. */
 void recoverActivitySlots({
  root:$('#messages'),
  ranges:turnRanges,
  list:()=>typeof window.desk?.activityList==='function'?window.desk.activityList():null,
  isCurrent:()=>slotsGeneration===historySlotsGeneration&&S.currentSession===sessionAtRender,
  conversationId:sessionAtRender||'',
  dispatch:detail=>window.dispatchEvent(new CustomEvent('desk-activity-slot',{detail})),
 });
 shownHistory.mark(historyId);
 setChatSearchSource(searchEntries);
}
/**
 * Espera a montagem do histórico e a rolagem do `showHistory` assentarem
 * antes de revelar um resultado de outra conversa (#143).
 * @returns {Promise<void>} ex.: await afterHistoryLayout()
 */
export function afterHistoryLayout(){
 return new Promise(resolve=>{
  if(typeof requestAnimationFrame!=='function'){resolve();return;}
  requestAnimationFrame(()=>requestAnimationFrame(resolve));
 });
}
/**
 * Rola o histórico até a mensagem que a busca de estudos encontrou (#143).
 * O índice é o mesmo do índice da busca; a casca é formatada antes de rolar
 * para a conversa longa cair no lugar certo (#118). Uma mensagem pode virar
 * mais de uma bolha (fala antes/depois de ferramenta compartilham o índice):
 * o trecho do resultado desempata qual delas contém o achado. Sem bolha exata
 * — índice de fala que o histórico não desenhou — cai na bolha anterior mais
 * próxima em vez de deixar o aluno no fim.
 * @param {unknown} index índice da mensagem de fala (0 é a primeira)
 * @param {unknown} [snippet] trecho do resultado, com `…` nas pontas
 * @returns {boolean} ex.: revealHistoryMessage(239) // true quando a bolha existe
 */
export function revealHistoryMessage(index,snippet){
 return revealMessageBubble($('#messages'),index,snippet,revealInChat);
}
/* As últimas 6 imagens ficam; as mais antigas saem (mesma regra de antes),
   agora também nas imagens de fala do assistente guardadas em `parts`. Roda
   dentro do compute do cache (#120), uma vez por conteúdo. */
function trimHistoryImages(turns){
 let keepUser=6,keepAssistant=6;
 for(let i=turns.length-1;i>=0;i--){
  const images=turns[i].userImages||[];
  if(images.length){
   const kept=[];
   for(let j=images.length-1;j>=0;j--){
    if(keepUser>0){keepUser--;kept.unshift(images[j]);}
   }
   turns[i].userImages=kept;
  }
  const parts=Array.isArray(turns[i].parts)?turns[i].parts:[];
  let assistantImages=[];
  for(let p=parts.length-1;p>=0;p--){
   const part=parts[p];
   if(part.type!=='text'||!Array.isArray(part.images)||!part.images.length)continue;
   const kept=[],keptSources=[];
   for(let j=part.images.length-1;j>=0;j--){
    if(keepAssistant>0){
     keepAssistant--;kept.unshift(part.images[j]);
     if(Array.isArray(part.imageSources))keptSources.unshift(part.imageSources[j]||'');
    }
   }
   part.images=kept;
   if(Array.isArray(part.imageSources))part.imageSources=keptSources;
   assistantImages=kept.concat(assistantImages);
  }
  if(parts.length)turns[i].assistantImages=assistantImages;
 }
 return turns;
}
export async function doCompact(text){
 if(!supportsCapability('compact')){toast(uiMessage('compact.notAvailable'));return;}
 if(S.busy){toast(uiMessage('compact.stopFirst'));return;}
 const instructions=text.replace(/^\/compact\b/i,'').trim();
 /* Tutor desligado: chama pelo mesmo caminho do envio, para a coluna escrever
    o estado — o `/compact` não repete a falha num aviso (#27). */
 if(!S.connected){try{await connect();}catch(e){toastFailure(e);return;}}
 try{activity(uiMessage('compact.working'));const result=await window.desk.compact(instructions);
  const before=Number(result?.tokensBefore)||0;
  toast(before?uiMessage('compact.doneTokens',{tokens:before}):uiMessage('compact.done'));
  activity('');refreshMeter();
 }catch(e){activity('');toast(e.message);}
}
/* Comandos digitados no composer: não são mensagem — o envio os trata à parte
   (e a fila de "tutor desligado" nunca os guarda como fala). */
const COMPACT_CMD=/^\/compact\b/i,CONFERIR_CMD=/^\/conferir\b/i;
export function isComposerCommand(text){const t=String(text??'').trim();return COMPACT_CMD.test(t)||CONFERIR_CMD.test(t);}
/* `steer` envia com o Pi ocupado (o main manda `streamingBehavior:'steer'`: o Pi
   interrompe o turno e trata a mensagem agora) — só o #prompt (⌘/Ctrl+Enter) e a
   própria fila usam isso; sem steer, ocupado é recusado e quem enfileira é o
   `queue.mjs`. Devolve true quando a bolha saiu — a fila usa isso para decidir se
   o item foi embora. `refs` (fila): manda as referências do snapshot do enqueue
   em vez das páginas abertas agora. `images` explícito pula os atalhos de texto
   (`/compact`, `/conferir`) e não mexe na bandeja. */
/* Envio em preparação (entre o Enviar e o prompt sair): o Parar marca ESTE
   envio e o `send` desiste depois do connect, em vez de deixar o `pi-abort`
   chegar ao serviço sem envio (`_sending===false`) e o prompt sair mesmo
   assim. O id do envio vai no prompt: se o Parar chegar ao serviço antes dele,
   o serviço cancela exatamente esse envio, não o próximo. */
let sendAttempt=null;
export async function send(text,images,options={}){
 /* Menções `@` (#53): a fila leva as do momento do enqueue; o composer, as dos chips agora. */
 const mentionList=Array.isArray(options.mentions)?options.mentions:(images===undefined?mentionIds():[]);
 /* Steer só existe onde o motor oferece (capabilities.steer). Sem ele, ocupado
    é recusado: quem enfileira é o `queue.mjs`/o `#prompt` do main — a Mesa
    nunca finge interromper e reenviar. */
 const steer=options.steer===true&&supportsCapability('steer');
 if(options.steer===true&&!steer&&S.busy){toast(uiMessage('send.noSteer'));return false;}
 if(S.busy&&!steer)return false;
 const fromComposer=images===undefined;
 const pending=fromComposer?S.attachments.slice():images;
 const pdfs=Array.isArray(options.pdfs)?options.pdfs:(fromComposer?S.pdfAttachments.slice():[]);
 if(!text.trim()&&!pending.length&&!pdfs.length)return false;
 if(images===undefined&&COMPACT_CMD.test(text.trim())){if(!supportsCapability('compact')){toast(uiMessage('compact.notAvailable'));
   return false;}if(S.busy){toast(uiMessage('compact.stopFirst'));
   return false;}$('#prompt').value='';paintComposerSend();
  await doCompact(text.trim());
  return false;}
 /* `/conferir` digitado na mão não vai mais para o Pi (evita a captura dupla da
    extensão visual): redireciona para o anexo e devolve a observação como rascunho. */
 if(images===undefined&&CONFERIR_CMD.test(text.trim())){const note=text.trim().replace(/^\/conferir\b/i,'').trim();$('#prompt').value='';paintComposerSend();await conferir();if(note){$('#prompt').value=note;paintComposerSend();}return false;}
 let stage='save',userMessage=null,knownNotSent=false;
 const attemptId=globalThis.crypto?.randomUUID?.()||`send-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 const attempt={id:attemptId,stage:'save',cancelled:false,wake:null};
 const cancelled=new Promise(resolve=>{attempt.wake=resolve;});
 sendAttempt=attempt;S.sendAttemptId=attemptId;
 try{
  setBusy(true);
  turnState.promptArmed=true;
  clearTimeout(S.saveTimer);await window.desk.save(layoutSnapshot());
  if(attempt.cancelled){turnState.promptArmed=false;setBusy(false);return false;}
  stage='connect';attempt.stage='connect';
  /* O Parar não espera o connect inteiro (30 s): a corrida devolve o turno à
     interface na hora; a conexão que sobrar termina sozinha. */
  if(await Promise.race([connect().then(()=>true),cancelled.then(()=>false)])===false||attempt.cancelled){turnState.promptArmed=false;setBusy(false);return false;}
  stage='prompt';attempt.stage='prompt';
  /* Armar DEPOIS do connect: com a ponte desligada (`S.connected=false`: queda
     fatal, troca de matéria) o connect recarrega o histórico (`showHistory`) e
     isso desarma o turno; sem rearmar, uma resposta que chega junto do
     `streaming:false` (busy já caído) seria descartada como atraso. */
  turnState.promptArmed=true;
  if(pending.length&&!S.supportsImages){turnState.promptArmed=false;setBusy(false);toast(uiMessage('send.needsImages'));return false;}
  userMessage=message('user',text,pending.map(item=>item.dataUrl),null,pdfs);
  /* A fala do aluno termina aqui: entra na fonte da busca (#122). */
  addChatSearchEntry({text,el:userMessage});
  if(fromComposer&&$('#prompt').value===text)$('#prompt').value='';
  const result=await window.desk.prompt({text,refs:options.refs||refs(),images:pending.map(item=>typeof item==='string'?item:{dataUrl:item.dataUrl,capturedAt:item.capturedAt,exercise:item.exercise,app:item.app}),pdfs:pdfs.map(item=>({name:item.name,path:item.path,pages:item.pages})),steer,mentions:mentionList,attemptId});
  if(result?.sent===false){knownNotSent=result.retryable===true;throw Error(result.error||uiMessage('send.refused'));}
  if(fromComposer){clearAttachments(pending,pdfs);clearMentions(mentionList);}
  /* `streaming` só libera o composer quando o Pi DISSE que não está no turno.
     Estado desconhecido (a leitura falhou depois do aceite) NÃO é envio falho:
     o item sai da fila e o aviso aparece — quem fecha o turno, nesse caso, são
     os eventos do Pi (ou o erro de conexão). */
  if(result?.streaming===false)setBusy(false);
  if(result?.warning)toast(result.warning);
  return true;
 }catch(e){
  const safe=stage==='save'||stage==='connect'||knownNotSent;
  if(safe)turnState.promptArmed=false;
  if(knownNotSent)userMessage?.remove();
  if(fromComposer&&!$('#prompt').value){$('#prompt').value=text;save();}
  options.onFailure?.(safe);
  setBusy(false);
  /* O Parar do usuário já tem a resposta na tela (o turno fecha e, com fila,
     o aviso da faixa); repetir a causa como erro só apaga esse aviso (#1). */
  if(!attempt.stopped)toastFailure(e);
  return false;
 }finally{
  if(sendAttempt===attempt)sendAttempt=null;
  if(S.sendAttemptId===attemptId)S.sendAttemptId='';
 }
}
/* dataURL → File sem `fetch` (o CSP do index.html não deixa `connect-src data:`):
   o base64 é decodificado na mão. */
function dataUrlFile(dataUrl,name){
 if(typeof dataUrl!=='string'||!dataUrl.startsWith('data:image/'))return null;
 const mime=/^data:([^;,]+)/.exec(dataUrl)?.[1]||'image/png';
 try{
  const bin=atob(dataUrl.slice(dataUrl.indexOf(',')+1));
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new File([bytes],name,{type:mime});
 }catch{return null;}
}
/* Conferir virou anexo: captura a janela do Xournal++ (ou do programa escolhido) e entrega a
   imagem na bandeja (`addAttachments` herda re-encode, teto de bytes e o aviso
   de modelo sem visão). Nada vai para o Pi sozinho — o usuário escreve e envia
   junto; uma imagem por captura no JSONL. O requisito de visão é do envio.
   B6: clique duplo engole o segundo clique (uma captura em voo por vez) e a
   matéria/sessão de destino fica FIXADA — se ela mudou durante a captura, a
   imagem é descartada em vez de pousar na conversa de outra matéria. */
export async function conferir(){
 if(S.busy)return;
 if(S.appConfig.desk?.conferir===false)return;
 const appNow=conferirAppName();
 if(!S.captureOk){toast(uiMessage('check.unavailableToast',{label:uiText(conferirCore.buttonLabel(appNow))}));return;}
 const lock=beginCaptureLock(S);
 if(!lock)return;
 /* O exercício anotado é o que estava ativo no momento da captura: se o usuário
    trocar de exercício antes de enviar, o contexto avisa em vez de deixar a
    captura passar por tentativa do exercício de agora. */
 const exerciseAtCapture=S.appConfig.desk?.studyContext===false?'':(layoutSnapshot().study?.title||'');
 try{
  /* Quem decide a janela é o host/núcleo (`core/conferir.bend`): o app salvo ou
     o Xournal++. Escolher outro programa é nas Configurações (#38). */
  const shot=await window.desk.captureReady();
  if(!captureLockValid(S,lock)){toast(uiMessage('capture.courseChanged'));return;}
  /* App ausente: o núcleo nunca captura outra janela no lugar. A lista abre
     com a frase do motivo e a pessoa escolhe de propósito. */
  if(shot?.absent){window.dispatchEvent(new CustomEvent('desk-conferir-absent',{detail:shot}));return;}
  const app=String(shot?.app||'').trim()||conferirCore.defaultApp();
  const file=dataUrlFile(shot?.dataUrl,captureFileName(app));
  if(!file){toast(uiMessage('capture.invalid'));return;}
  const added=await addAttachments([file],{capturedAt:Date.now(),exercise:exerciseAtCapture,app});
  if(!added)return;
  playShutter($('#attach'));
  toast(uiText(conferirCore.attachedText(app)));
  $('#prompt').focus();
 }catch(e){toast(e.message);}
 finally{endCaptureLock(S,lock);}
}
export async function conferirGeogebra(){
 if(S.busy||S.connecting||S.switching)return;
 /* O applet manual continua na aba GeoGebra; o que depende do agente (a
    ferramenta geogebra) só existe onde o motor oferece. */
 if(!supportsCapability('geogebra')){toast(uiMessage('ggb.notAvailable'));return;}
 if(!S.connected){toast(uiMessage('ggb.callTutor'));return;}
 if(!S.supportsImages){toast(uiMessage('ggb.noImages'));return;}
 try{
  setBusy(true);
  const shot=await window.desk.ggbShot();
  const note=$('#prompt').value.trim();
  const title=uiT('menu.checkGeogebra');
  const label=note?`${title}\n${note}`:title;
  const bubble=message('user',label,[shot.dataUrl]);
  addChatSearchEntry({text:label,el:bubble});
  $('#prompt').value='';
  const text=note||await tutorText('ggb.checkPrompt');
  const result=await window.desk.prompt({text,refs:refs()});
  if(result?.streaming===false)setBusy(false);
  if(result?.warning)toast(result.warning);
 }catch(e){setBusy(false);toast(e.message);}
}
installAttachmentListeners();
installQuoteListeners();
/* Fatos que a fila consulta (via `mayAdvanceQueue` em state.mjs): o
   cancelamento é do turno (some no turno novo / no comando do usuário) e a
   incerteza é da conversa (o host a mantém até outra conversa). */
window.addEventListener('desk-stop',()=>{
 turnState.stoppedTurn=true;S.turnCancelled=true;if(turnState.turnLog)settleTurn({reason:'stopped'});
 /* Parar é decisão da pessoa: o envio em voo não vira aviso de erro depois.
    Sem a marca, o catch do `send` mostrava "Chamada ao tutor cancelada" e
    trocava o aviso "a fila ficou segurada" da faixa (#1). */
 if(sendAttempt)sendAttempt.stopped=true;
 /* Envio ainda no connect do renderer: aborta o connect e não deixa o prompt
    sair depois. O serviço recebe o mesmo id e desiste se o prompt já foi. */
 if(sendAttempt&&sendAttempt.stage!=='prompt'){
  sendAttempt.cancelled=true;sendAttempt.wake?.();
  const attempt=sendAttempt;
  setBusy(false);turnState.promptArmed=false;
  if(attempt.stage==='connect')cancelConnect().catch(()=>{});
 }
});
/* Troca REAL de conversa fecha o turno vivo; a adoção do caminho de sessão que
   o host cria no primeiro envio (`S.currentSession` sai de vazio) não pode
   matar o turno em curso. `showHistory` também recolhe antes de recarregar. */
window.addEventListener('desk-conversation-changed',()=>{
 /* O ledger local é do turno/conversa anterior: troca real ou recarga do
    histórico zera o escopo cruzado. A proteção de Parar da MESMA conversa
    segue de pé (nada aqui é limpo por turno novo). */
 resetRetiredLedgers();
 if(!turnState.turnLog)return;
 if(!turnState.turnConversation){turnState.turnConversation=S.currentSession||null;return;}
 if(S.currentSession&&S.currentSession!==turnState.turnConversation)settleTurn({reason:'switched'});
});

window.addEventListener('desk-conversation-changed',clearNotices);

/* Limite do grátis no turno: diário, faixa e aviso com a frase da conta de
   agora, e a saída logo abaixo da faixa. `saved` é o `opencodeStatus().saved`
   (chave do Zen guardada); sem ele, a conta pode não existir e o diálogo de
   login e chave é a saída. A sessão continua usável: nada aqui mexe em busy,
   conexão ou fila — o `agent_settled` (isError) já encerra o turno. */
function freeLimitDiaryStep(reason){
 if(!turnState.turnLog)return null;
 const error=worklog.addError(turnState.turnLog,uiT('tutor.error.diary',{reason:uiText(String(reason))}));
 if(!error)return null;
 const seg=openSegment();
 timeline.addStep(seg,error.id);
 renderSegment(seg,{live:!seg.closed,isFreeLimit:true});
 return {error,seg};
}
export async function paintFreeLimitTurn(reason){
 turnState.turnFreeLimit=true;
 /* O passo de erro entra no diário ANTES da consulta da conta (#145): o
    `agent_settled` do mesmo 429 pode recolher o turno durante o `await`, e o
    segmento ainda vazio era descartado — sobrava só o aviso, sem registro. */
 const diary=freeLimitDiaryStep(reason||uiMessage('opencode.event.freeLimit'));
 /* O `await` abre uma janela: se o aluno trocar de modelo ou um turno novo
    começar nela, o aviso velho aparecia depois do `hide` (#118 item 7). Sem
    segundo aviso — o velho só não volta. */
 const runId=turnState.turnRunId,session=S.currentSession,model=S.choice?.model;
 let saved=false;
 try{saved=!!(await window.desk.opencodeStatus())?.saved;}catch{/* sem conta legível: vale como sem chave */}
 if(S.currentSession!==session||turnState.turnRunId!==runId||S.choice?.model!==model)return;
 const text=uiMessage(freeLimitMessageKey({saved}));
 /* Turno ainda vivo: o detalhe acompanha a variante da conta (entrar × outro
    modelo). Já recolhido, fica a frase do evento, que é a que o 429 trouxe. */
 if(diary&&!diary.seg.closed){
  diary.error.error=uiT('tutor.error.diary',{reason:uiText(String(text))});
  renderSegment(diary.seg,{live:true,isFreeLimit:true});
 }
 /* O aviso fica até o próximo turno e já diz tudo: toast e faixa repetiriam a
    mesma frase, cortada na faixa (rodada 2 da auditoria, D1). */
 showFreeLimitNote({saved});
}
window.desk.onEvent(e=>{
 if(!e||typeof e!=='object')return;
 /* Identidade da conversa: evento explícito de OUTRA conversa (troca de
    matéria/conversa em andamento) é descartado por identidade — nunca pinta
    no DOM da conversa errada. Eventos sem `conversationId` (Pi atual) seguem. */
 if(typeof e.conversationId==='string'&&e.conversationId&&S.currentSession&&e.conversationId!==S.currentSession)return;
 if(['agent_start','message_start','message_update','message_end','tool_execution_start','tool_execution_end'].includes(e.type))S.busyStall=0;
 if(e.type==='agent_start'){
  turnState.stoppedTurn=false;S.turnCancelled=false;
  turnState.turnRunId=e.runId??e.hostRun??null;
  turnState.turnConversation=S.currentSession||null;
  turnState.promptArmed=true;
  resetAssistantBuffers();
  openTurnLog();
  setBusy(true);paintLive();
 }
 if(e.type==='message_start'&&e.message?.role==='assistant'){
  if(staleEvent(e))return;
  /* O mesmo bloco pode chegar em dois message_start (stream + mensagem final):
     o `id` é a identidade — os blocos de fala ficam por (id, contentIndex) e
     um id novo limpa o mapa. Sem id (o Pi REAL não manda `message.id`), a
     identidade nasce da sequência de `message_start`: uma mensagem que ainda
     não terminou conserva a identidade (re-stream não duplica fala) e o
     `message_end` marca o fim para a próxima abrir a identidade seguinte. */
  const id=e.message.id??null;
  if(id!=null){
   if(turnState.assistantId!==id){turnState.assistantBlocks.clear();assistantAnchors.clear();}
   turnState.assistantId=id;
  }else if(turnState.assistantId==null||turnState.messageEnded){
   nextAssistantId();
  }
  turnState.messageEnded=false;
  turnState.assistant=null;turnState.assistantText='';turnState.assistantKey=null;turnState.assistantEnded=false;
  clearLatestAnswer();
 }
 if(e.type==='message_update'&&staleEvent(e))return;
 if(e.type==='message_update'&&e.assistantMessageEvent){
  const ame=e.assistantMessageEvent;
  const blockMessageId=ame.messageId??turnState.assistantId??(ame.contentIndex!=null?ensureAssistantId():null);
  const key=ame.contentIndex!=null?(blockMessageId!=null?`${blockMessageId}#${ame.contentIndex}`:''):'';
  if(ame.type==='thinking_start'){
   if(turnState.turnLog){
    const running=worklog.runningStep(turnState.turnLog);
    if(running?.kind===worklog.STEP.THINKING){
     /* Retry da MESMA rajada reescreve; rajada nova fecha a anterior para não
        fundir dois blocos de pensamento num passo só. */
     if(turnState.thinkingOpenKey!==null&&turnState.thinkingOpenKey===key)worklog.replaceThinking(turnState.turnLog,'',running);
     else worklog.closeThinking(turnState.turnLog);
    }
   }
   turnState.thinkingOpenKey=key;
   openSegment();
   scheduleTurn();
  }else if(ame.type==='thinking_delta'){
   if(turnState.thinkingOpenKey===null)turnState.thinkingOpenKey=key;
   const seg=openSegment();
   const step=worklog.thinkingDelta(turnState.turnLog,ame.delta||'');
   if(step)timeline.addStep(seg,step.id);
   scheduleTurn();
  }else if(ame.type==='thinking_end'){
   if(turnState.turnLog&&typeof ame.content==='string')worklog.replaceThinking(turnState.turnLog,ame.content);
   turnState.thinkingOpenKey=null;
   scheduleTurn();
  }else if(ame.type==='text_start'){
   if(turnState.turnLog)worklog.closeThinking(turnState.turnLog);
   turnState.thinkingOpenKey=null;
   closeSegment();
   resetAssistantBlock(key);
   turnState.assistantEnded=false;
   scheduleTurn();
  }else if(ame.type==='text_delta'){
   if(turnState.turnLog)worklog.closeThinking(turnState.turnLog);
   turnState.thinkingOpenKey=null;
   closeSegment();
   appendAssistantDelta(ame.delta||'',key);
   turnState.assistantEnded=false;
   scheduleTurn();
  }else if(ame.type==='text_end'){
   if(turnState.turnLog)worklog.closeThinking(turnState.turnLog);
   turnState.thinkingOpenKey=null;
   closeSegment();
   if(typeof ame.content==='string'&&ame.content){
    const block=settleAssistantBlock(key,ame.content);
    if(block){
     setMessageTime(block.el,Date.now());
     /* O bloco de fala termina aqui: o texto final entra na busca (#122). */
     addChatSearchEntry({text:ame.content,el:block.el});
    }
   }
   turnState.assistantEnded=true;
   scheduleTurn();
  }else if(ame.type==='toolcall_end'){
   const call=ame.toolCall||{};
   /* O cartão chega pelo `desk-card`; declarar aqui deixaria um passo preso
      (a execução e o fim da ferramenta de cartão também são ignorados) com a
      resposta certa nos argumentos. */
   if(!cardToolKind(call.name)&&call.id!=null&&call.id!=='')declareTool({id:call.id,name:call.name,args:call.arguments,pending:true,contentIndex:ame.contentIndex});
  }
 }
 if(e.type==='message_end'&&e.message?.role==='assistant'){
  if(staleEvent(e))return;
  const {text,images}=contentParts(e.message);
  /* N3: dois `message_end` sem `message_start` não podem reusar a identidade
     já encerrada; id explícito (Claude) continua estável/deduplicado. */
  if(e.message.id==null&&(turnState.assistantId==null||turnState.messageEnded))nextAssistantId();
  const id=e.message.id??turnState.assistantId??nextAssistantId();
  const time=Number(e.message.timestamp)>0?Number(e.message.timestamp):Date.now();
  const model=typeof e.message.model==='string'?e.message.model:'';
  const modelName=typeof e.message.modelName==='string'?e.message.modelName:'';
  const blocks=Array.isArray(e.message.content)?e.message.content:null;
  let painted=false,lastBlock=null;
  if(blocks){
   rememberToolAnchors(blocks,e.message.contentIndexes);
   for(let i=0;i<blocks.length;i++){
    const part=blocks[i];
    if(!part||part.type!=='text')continue;
    const value=part.text;
    if(typeof value!=='string'||!value.trim())continue;
    const contentIndex=e.message.contentIndexes?.[i]??i;
    lastBlock=settleAssistantBlock(id!=null?`${id}#${contentIndex}`:'',value,[],assistantAnchorAfter(contentIndex));
    if(lastBlock){
     setMessageTime(lastBlock.el,time);
     setMessageModel(lastBlock.el,model,modelName);
     addChatSearchEntry({text:value,el:lastBlock.el});
    }
    painted=true;
   }
   if(lastBlock&&images.length)updateMessage(lastBlock.el,lastBlock.text,images);
  }
  if(!painted&&(text||images.length)){
   if(String(text||'').trim())turnState.turnHadAnswer=true;
   if(turnState.assistant&&turnState.assistantKey===null&&turnState.assistant.isConnected&&turnState.assistantEnded){
    const el=turnState.assistant;
    updateMessage(el,text,images);
    setMessageTime(el,time);
    setMessageModel(el,model,modelName);
    addChatSearchEntry({text,el});
   }else{
    const el=message('assistant',text,images,[],[],time,model,modelName);
    addChatSearchEntry({text,el});
   }
  }
  turnState.assistant=null;turnState.assistantText='';turnState.assistantKey=null;turnState.assistantEnded=true;turnState.messageEnded=true;turnState.assistantLoose=[];
  markLatestAnswer();
  if(turnState.turnLog){worklog.closeThinking(turnState.turnLog);turnState.thinkingOpenKey=null;scheduleTurn();}
  if(e.message.errorMessage)toast(e.message.errorMessage);
 }
 if(e.type==='tool_execution_start'){
  if(staleEvent(e))return;
  if(cardToolKind(e.toolName)){
   /* O cartão já chegou pelo `desk-card` (o host registra antes de a ferramenta
      voltar); a chamada não vira passo do diário. */
   return;
  }
  const step=declareTool({id:e.toolCallId,name:e.toolName,args:e.args,pending:e.pending===true});
  if(step)renderTurn();
 }
 if(e.type==='tool_execution_end'){
  if(staleEvent(e))return;
  if(cardToolKind(e.toolName))return;
  if(turnState.turnLog){
   const normalized=toolResultFor(e);
   const step=worklog.finishTool(turnState.turnLog,{id:e.toolCallId,result:normalized,isError:e.isError,now:Date.now()});
   const activity=activityDetailsOf(normalized);
   /* H4: a prévia não publica nada; guarda o último rascunho para o fim do
      turno. Publicação de quadro que deu certo dispensa o resgate. */
   if(timeline.isPreviewTool(e.toolName)&&e.isError!==true){
    const previaId=previewIdOf(normalized);
    if(previaId)turnState.turnPreview={previaId};
   }
   if(step){
    const seg=timeline.segmentOfStep(turnState.turnTrack,step.id);
    if(seg)renderSegment(seg,{live:!seg.closed});
    if(timeline.isActivityTool(step.toolName)){
     if(e.isError!==true)turnState.turnPublished=true;
     ensureActivitySlot(step.id,{status:e.isError?'error':'done',...activity});
    }
   }else if(timeline.isActivityTool(e.toolName)){
    if(e.isError!==true)turnState.turnPublished=true;
    ensureActivitySlot(e.toolCallId,{status:e.isError?'error':'done',...activity});
   }
   renderTurn();
  }
  if(Array.isArray(e.images)&&e.images.length)paintMarkedPageImages(e.images);
 }
 if(e.type==='auto_retry_start'){
  S.busyStall=0;setBusy(true);
  activityLive(uiMessage('turn.retry',{attempt:e.attempt,max:e.maxAttempts,seconds:Math.ceil((e.delayMs||0)/1000)}));
 }
 if(e.type==='auto_retry_end'&&e.success===false){
  turnState.stoppedTurn=true;
  window.dispatchEvent(new Event('desk-failed'));
  toast(uiMessage('turn.retriesEnded'));
 }
 if(e.type==='agent_settled'){
  /* `cancelled`/`isError`/`uncertain` (tradução dos motores novos) NÃO são
     sucesso: sem `desk-idle`, a fila não drena; falha/incerteza também seguram
     a fila e a entrega incerta nunca é repetida sozinha. */
  clearNotices();
  const aborted=turnState.stoppedTurn;turnState.stoppedTurn=false;
  const cancelled=e.cancelled===true||aborted;
  /* Cancelamento não é falha: o `desk-stop` já segurou a fila e avisou; tratar
     `isError` do interrupt como erro geraria um segundo aviso e uma segunda
     guarda. */
  const failed=e.isError===true&&!cancelled;
  const uncertain=e.uncertain===true;
  /* Fatos para a guarda da fila: cancelamento veta o avanço até o turno novo
     (ou o comando explícito do usuário); incerteza veta até outra conversa. */
  if(cancelled)S.turnCancelled=true;
  if(uncertain)S.uncertain=true;
  /* H4: a prévia sem publicação vira quadro só no fim normal do turno;
     Parar/erro limpam o pendente no `settleTurn`. */
  const unpublishedPreview=!turnState.turnPublished?turnState.turnPreview:null;
  const turnConversation=turnState.turnConversation||S.currentSession;
  settleTurn({reason:cancelled?'stopped':(failed||uncertain?'error':'')});
  setBusy(false);refreshMeter();
  if(!cancelled&&!failed&&!uncertain)window.dispatchEvent(new Event('desk-idle'));
  else if(failed||uncertain)window.dispatchEvent(new Event('desk-failed'));
  if(unpublishedPreview&&!cancelled&&!failed&&!uncertain){
   void showUnpublishedPreview({previaId:unpublishedPreview.previaId,conversationId:turnConversation});
  }
  if(cancelled&&!aborted)window.dispatchEvent(new CustomEvent('desk-held',{detail:{message:uiMessage('queue.heldCancelled')}}));
  if(uncertain)toast(uiMessage('turn.uncertain'));
 }
 /* Linha ilegível do Pi (`desk_warn`): a ponte segue viva e o turno também, então
    nada de estado de conexão — o log fica no desk.log (main.cjs) e o console
    guarda o rastro da Conversa (mesmo tratamento de `pi_warning`).
    Aviso NATIVO de limite de uso do Claude (`code`/`rateLimit` no evento) ganha
    também faixa de atividade e toast, por janela/reset. Avisos nativos de
    retry/overload/recusa/fallback (`claudeActivityNotice`) ganham faixa e toast
    concisos, deduplicados por aviso. É só visibilidade — nada aqui mexe em
    busy, conexão, fila nem reenvia; o console genérico (inclusive Pi) continua
    igual para o que não for reconhecido. */
 if(e.type==='desk_warn'){
  console.warn('Tutor:',e.message);
  const limit=claudeLimitNotice(e);
  if(limit)applyLimitNotice(limit,e);
  else{
   const notice=claudeActivityNotice(e);
   if(notice)applyActivityNotice(notice,e);
  }
 }
 /* `fatal:false` nativo = a consulta continua utilizável (retry/result à
    frente): o erro fica visível no diário/faixa/toast, mas conexão, busy e
    fila NÃO mudam e o `desk-failed` não sai — o `agent_settled` (isError) é
    quem encerra o turno e segura a fila. Ausente/true preserva o tratamento
    fatal de sempre (Pi e falha de transporte). */
 if(e.type==='desk_error'){
  clearNotices();
  const fatal=deskErrorIsFatal(e);
  if(fatal)turnState.promptArmed=false;
  /* Limite do grátis (429 FreeUsageLimitError): a frase e a saída dependem de
     ter conta — quem já entrou escolhe outro modelo, em vez de ouvir "entre".
     O resto do caminho não muda: diário, faixa e aviso, sem tocar na conexão. */
  if(!fatal&&freeLimitKey(e.message)){void paintFreeLimitTurn();return;}
  let diaryShows=false;
  if(turnState.turnLog){
   /* O código de saída fica no log da Mesa; o diário conta em português. */
   const said=String(e.message||'').includes('tutor.error.stopped')?tutorStateCore.reasonLine(String(e.message)):e.message;
   const error=worklog.addError(turnState.turnLog,uiT('tutor.error.diary',{reason:uiText(String(said))}));
   if(error){
    /* Só conta se o diário vai abrir sozinho (E3: sem resposta parcial);
       recolhido, o motivo ficaria escondido sem o aviso. */
    diaryShows=!turnState.turnHadAnswer&&!String(turnState.turnLog.text||'').trim();
    const seg=openSegment();
    timeline.addStep(seg,error.id);
    renderSegment(seg,{live:!seg.closed});
   }
  }
  /* Queda de verdade: a coluna do tutor escreve o motivo logo abaixo, com as
     saídas — o aviso só repetiria o texto (#27). Erro que não derruba segue
     como aviso, a não ser que o cartão do diário já o mostre (G7 da
     auditoria de UI: sem conexão saía no cartão e no aviso). */
  if(!fatal&&!diaryShows)toast(e.message);
  if(fatal){
   if(turnState.turnLog)settleTurn({reason:'error'});
   S.connected=false;connectionState('error','',e.message);setBusy(false);$('#auto-compact').hidden=true;
   /* O turno morreu sem `agent_end`: a fila tenta o que sobrou agora. */
   window.dispatchEvent(new Event('desk-failed'));
  }else{
   activity(uiT('tutor.error.diary',{reason:uiText(String(e.message))}));
  }
 }
 if(e.type==='extension_ui_request'){
  if(e.method==='notify'){toast(e.message);if(e.notifyType==='error')setBusy(false);}
  else if(['select','confirm','input','editor'].includes(e.method))showDialog(e);
  else if(e.method==='set_editor_text'&&e.text){$('#prompt').value=e.text;paintComposerSend();}
 }
 /* Pedido interativo vencido: o diálogo daquele id sai SEM resposta. */
 if(e.type==='agent_request_cancelled')cancelDialogRequest(String(e.id||''));
});
installDialogListeners();
installAssetListeners();
/* Um desfecho atrasado da conversa antiga não monta/atualiza cartão na nova. */
window.desk.onCard(payload=>{if(payload?.conversationId&&payload.conversationId!==S.currentSession)return;cardBoard.handle(payload);});
