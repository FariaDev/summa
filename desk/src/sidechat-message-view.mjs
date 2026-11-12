import {toast} from './state.mjs';
import {icon} from '../icons.mjs';
import {copiedMark,flashMark} from './icon-motion.mjs';
import {insertMainDraft} from './chat.mjs';
import {markup,decorateCode,hydrateMathIn} from './markdown.mjs';
import {build,renderChildren} from './view-host.mjs';
import talkCore from './generated/talkview.core.js';
import {t as uiT,text as uiText} from './ui-text.mjs';
import {message as uiMessage} from './i18n.mjs';

/* Cartões de mensagem do chat lateral (#43 fase 2: saíram de sidechat.mjs).
   Sem estado: o rótulo do motor entra por parâmetro; o DOM usa o mesmo
   renderer de Markdown+LaTeX do chat principal. */

/**
 * Cria um elemento com atributos e filhos; `class` e `text` são atalhos.
 * @param {string} tag
 * @param {Record<string, unknown>} [attrs]
 * @param {...(Node|string|null|Array<Node|string|null>)} kids
 * @returns {HTMLElement}
 * @example h('p',{class:'fine',text:'oi'})
 */
export function h(tag,attrs={},...kids){
 const node=document.createElement(tag);
 for(const [key,value] of Object.entries(attrs)){
  if(value==null)continue;
  if(key==='class')node.className=String(value);
  else if(key==='text')node.textContent=String(value);
  else node.setAttribute(key,String(value));
 }
 for(const kid of kids.flat())if(kid!=null)node.append(kid);
 return node;
}

/* Nome do cartão e do "Copiar" com o falante (achados 7 e 12): o leitor de
   tela recebe "Você"/"OpenCode" como nome do grupo e o Copiar não repete o
   mesmo nome nos dois cartões. O id do rótulo é único por cartão montado. */
let messageCardSeq=0;
function copyNameFor(role){
 return uiT(role==='user'?'sidechat.copyUser':role==='system'?'sidechat.copyNotice':'sidechat.copyAnswer');
}

/**
 * Cartão de uma mensagem do lateral, com copiar e (resposta do tutor) levar à sessão principal.
 * @param {{role:string,text?:string}} message
 * @param {string} engineLabel rótulo do motor para a resposta do tutor
 * @returns {HTMLElement}
 * @example sidechatMessageCard({role:'assistant',text:'oi'},'Tutor')
 */
export function sidechatMessageCard(message,engineLabel){
 const failed=message.error===true;
 const voiceId=`sidechat-msg-voice-${++messageCardSeq}`;
 /* Falha do motor (rodada 3, achado 6): a notícia é aviso do sistema, não
    resposta do motor; o Copiar acompanha ("Copiar aviso"). */
 const voiceText=failed||message.role==='system'?uiT('sidechat.role.system'):message.role==='user'?uiT('sidechat.role.you'):engineLabel;
 const voice=h('div',{class:'role sidechat-role',id:voiceId,text:voiceText});
 const card=h('article',{class:`sidechat-msg message ${message.role}${failed?' sidechat-error':''}`,role:failed?'alert':'group','aria-labelledby':voiceId},voice);
 const body=h('div',{class:'body sidechat-body'});
 paintSidechatBody(body,uiText(String(message.text??'')),false);
 if(failed){
  const mark=h('span',{class:'sidechat-error-icon','aria-hidden':'true'});
  mark.innerHTML=icon('alert');
  card.append(h('div',{class:'sidechat-error-row'},mark,body));
 }else card.append(body);
 card._text=String(message.text||'');
 const actions=h('div',{class:'sidechat-msg-actions'});
 /* "Tentar de novo" devolve a última pergunta ao campo e foca (sidechat.mjs),
    sem reenviar sozinho; o Copiar fica como ação secundária. */
 if(failed)actions.append(h('button',{type:'button',class:'sidechat-retry',text:uiT('sidechat.retry')}));
 const copy=h('button',{type:'button',class:'sidechat-copy','aria-label':copyNameFor(failed?'system':message.role)});
 copy.innerHTML=icon('copy');
 /* O rótulo de sucesso reserva a largura em repouso (chat solto, rodada 5,
    achado 2): o "Copiado" nasce no mesmo botão e o vizinho não anda. */
 const copyLabel=h('span',{class:'sidechat-copy-label','data-copied':uiT('sidechat.copiedShort')});
 copyLabel.append(h('span',{text:uiT('sidechat.copy')}));
 copy.append(copyLabel);
 actions.append(copy);
 if(!failed&&message.role==='assistant'&&String(message.text||'').trim()){
  /* O rótulo curto entra por `::after` com o `data-short` (CSS), para o texto
     do botão seguir completo no DOM e no nome acessível (rodada 3, achado 5). */
  const toMain=h('button',{type:'button',class:'sidechat-to-main',title:uiT('sidechat.toMainTitle'),'aria-label':uiT('sidechat.toMain'),'data-short':uiT('sidechat.toMainShort')});
  toMain.append(h('span',{class:'label-full',text:uiT('sidechat.toMain')}));
  actions.append(toMain);
 }
 card.append(actions);
 return card;
}
export function paintSidechatBody(body,text,live){
 if(!body)return;
 body.innerHTML=markup(String(text||''));
 decorateCode(body);
 /* Mensagem montada antes do import do KaTeX chega: hidrata no subtree (#desempenho). */
 hydrateMathIn(body);
 if(!live)hydrateSidechatAssets(body);
}
/* Figuras geradas (mesmo caminho do chat principal): `readImage` → `assetKids`
   do núcleo; sem a imagem, o fallback de texto do núcleo. */
export function hydrateSidechatAssets(node){
 for(const figure of node.querySelectorAll('figure.asset[data-asset]')){
  const source=figure.dataset.asset||'',caption=figure.dataset.caption||'';
  if(!source)continue;
  window.desk.readImage(source).then(hit=>{
   if(!figure.isConnected)return;
   if(!hit){figure.replaceWith(build(talkCore.assetFallback(source)));return;}
   renderChildren(figure,talkCore.assetKids({$:'AssetRow',src:hit.dataUrl,path:source,alt:caption||hit.name||uiT('dialogs.image.generated'),caption:caption||hit.name||''}));
  }).catch(()=>{if(figure.isConnected)figure.replaceWith(build(talkCore.assetFallback(source)));});
 }
}
export function copySidechatMessage(button){
 const card=button.closest('.sidechat-msg');
 const text=card?._text||card?.querySelector('.sidechat-body')?.innerText||'';
 if(!text)return;
 navigator.clipboard.writeText(text).then(()=>{
  /* Retorno no próprio botão (achado 8): o "Copiado" nasce sob o cursor, não
     num toast longe. O rótulo acessível acompanha e volta junto da marca. */
  const label=uiT('sidechat.copiedShort');
  if(button._copyLabel===undefined)button._copyLabel=button.getAttribute('aria-label')||'';
  clearTimeout(button._copyLabelTimer);
  button.setAttribute('aria-label',label);
  flashMark(button,copiedMark(),label,{ms:1500});
  button._copyLabelTimer=setTimeout(()=>{
   button.setAttribute('aria-label',button._copyLabel);
   button._copyLabel=undefined;
  },1500);
 }).catch(error=>toast(error.message));
}
export function sendSidechatMessageToMain(button){
 const card=button.closest('.sidechat-msg');
 const text=card?._text||'';
 if(!String(text).trim())return;
 if(insertMainDraft(text))toast(uiMessage('sidechat.toMainDone'));
}
