// @ts-check
/* Conferir: captura a janela do programa de escrita (ou a página do Ambitus pela ponte) e
   entrega na bandeja do tutor ou do chat lateral. Saiu do chat.mjs inteiro, sem mudança. */
import {$,S,toast,conferirAppName,layoutSnapshot} from '../state.mjs';
import {text as uiText} from '../ui-text.mjs';
import {message as uiMessage} from '../i18n.mjs';
import conferirCore from '../generated/conferir.core.js';
import {captureFileName} from '../capture-name.mjs';
import {playShutter} from '../icon-motion.mjs';
import {beginCaptureLock,captureLockValid,endCaptureLock} from '../capture-lock.mjs';
import {addAttachments} from './chat-attachments.mjs';
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
/* `sink` (opcional): o chat lateral recebe a captura na bandeja dele, com a mesma captura e as mesmas travas;
   `{attach(file) → Promise<number>, notebook?(card, dataUrl) → boolean, shutter: Element|null, focus()}`. Sem ele vale a bandeja do tutor.
   Com o Ambitus na ponte a página vem renderizada por ele (`shot.ambitus`): no lateral, caderno salvo entra como cartão
   (`notebook`, com a imagem de miniatura); sem caminho, ou no tutor, entra como imagem. */
export async function conferir(sink){
 if(S.busy&&!sink)return;
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
  /* Pela ponte (Ambitus) a imagem é a página renderizada, nomeada "<caderno> — pág. N"; o caminho do caderno só vale se o caderno foi salvo. */
  const page=shot?.ambitus;
  const file=dataUrlFile(shot?.dataUrl,page?uiText(String(shot.title||app)):captureFileName(app));
  if(!file){toast(uiMessage('capture.invalid'));return;}
  const asCard=!!(sink?.notebook&&page?.caminho);
  const added=asCard?(sink.notebook({caminho:page.caminho,pagina:page.pagina,nome:page.nome,...(page.recorte?{recorte:page.recorte}:{})},shot.dataUrl)?1:0)
   :sink?await sink.attach(file):await addAttachments([file],{capturedAt:Date.now(),exercise:exerciseAtCapture,app});
  if(!added)return;
  playShutter(sink?sink.shutter:$('#attach'));
  toast(page?uiMessage('check.attached.ambitus'):uiText(conferirCore.attachedText(app)));
  if(sink)sink.focus();else $('#prompt').focus();
 }catch(e){toast(e.message);}
 finally{endCaptureLock(S,lock);}
}
