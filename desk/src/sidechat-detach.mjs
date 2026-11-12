/* Chat lateral solto numa janela filha (#157, fatias 1 e 2): `window.open`
   (`about:blank`, nome fixo) cria a filha e o nó do chat lateral que já existe
   muda de documento para dentro dela — mesmo estado, mesma conexão, mesmo
   rascunho; nada de segunda instância do módulo. Fechar a filha devolve o nó
   ao lugar original, com conversa, rascunho e rolagem intactos. A fatia 2
   lembra solto/posição no desk.json (o main é quem posiciona e persiste). */

import {rebindSidechatDocument,sidechatElement} from './sidechat-loader.mjs';
import {icon} from '../icons.mjs';
import {t,LANGUAGE_EVENT} from './ui-text.mjs';

/** Nome fixo da janela do chat lateral (o mesmo que o guarda do main libera).
 * @type {string}
 * @example SIDCHAT_WINDOW_NAME */
export const SIDCHAT_WINDOW_NAME='mesa-sidechat';

let detachedWin=null,homeParent=null,chromeObserver=null,headObserver=null,painting=false;
let alwaysOnTop=false,detachedPref=false;

function notifyDetached(){try{window.dispatchEvent(new Event('desk-sidechat-detached'));}catch{}}

/** Guarda o que o desk.json mandou na abertura (#157, fatia 2): se o chat
 * estava solto e o "sempre por cima". O lugar/tamanho é o main que resolve.
 * @param {{detached?: boolean, alwaysOnTop?: boolean}} [next] preferências do estado
 * @returns {void}
 * @example setDetachedWindowState({detached: true, alwaysOnTop: false}) */
export function setDetachedWindowState(next={}){
 alwaysOnTop=next.alwaysOnTop===true;
 detachedPref=next.detached===true;
 paintDetachButton();
}

/** Reabre solto ao abrir a Mesa (#157, decisão 2): sem preferencia ou já solto, nulo.
 * @returns {Window | null} a janela filha, ou nulo
 * @example reopenDetachedSidechat() */
export function reopenDetachedSidechat(){
 if(!detachedPref||isDetachedSidechat())return null;
 return detachSidechat();
}

/** Diz se o chat lateral está solto em janela própria.
 * @returns {boolean}
 * @example isDetachedSidechat() */
export function isDetachedSidechat(){return !!(detachedWin&&!detachedWin.closed);}

/** Pinta "Soltar/Trazer de volta" e "Sempre por cima" no Mais opções do chat
 * (#157): ícone do conjunto do menu ao lado do texto (como "Ver o contexto
 * copiado"); o por cima só aparece solto, desligado por padrão, com o estado
 * no `aria-checked`/`data-state` dos vizinhos `menuitemcheckbox`.
 * @returns {HTMLElement | null} o botão Soltar/Trazer, ou nulo sem chat montado
 * @example paintDetachButton() */
export function paintDetachButton(){
 const root=sidechatElement();if(!root)return null;
 const pop=root.querySelector('#sidechat-more-pop');if(!pop)return null;
 const doc=root.ownerDocument||document;
 let button=pop.querySelector('#sidechat-detach');
 if(!button){
  button=doc.createElement('button');
  button.type='button';button.id='sidechat-detach';button.setAttribute('role','menuitem');
  button.innerHTML=`${icon('external')} <span></span>`;
  pop.appendChild(button);
  button.addEventListener('click',()=>{
   pop.hidden=true;
   root.querySelector('#sidechat-more')?.setAttribute('aria-expanded','false');
   if(isDetachedSidechat())attachSidechat();else detachSidechat();
  });
 }
 /* O ícone acompanha a ação: soltar sai da caixa (`external`), trazer de
    volta retorna (`undo`) — antes a seta de saída ficava no item ao voltar
    (achado 10). */
 const detached=isDetachedSidechat();
 const iconName=detached?'undo':'external';
 if(button.dataset.icon!==iconName){
  button.dataset.icon=iconName;
  button.innerHTML=`${icon(iconName)} <span></span>`;
 }
 const label=t(detached?'sidechat.attach':'sidechat.detach');
 const slot=button.querySelector('span');
 if(slot&&slot.textContent!==label)slot.textContent=label;
 let top=pop.querySelector('#sidechat-always-on-top');
 if(!top){
  top=doc.createElement('button');
  top.type='button';top.id='sidechat-always-on-top';top.dataset.icon='pin';top.setAttribute('role','menuitemcheckbox');
  top.innerHTML=`${icon('pin')} <span></span>`;
  pop.appendChild(top);
  top.addEventListener('click',async()=>{
   const next=!alwaysOnTop;
   alwaysOnTop=next;
   paintDetachButton();
   try{await window.desk.sidechatAlwaysOnTop?.(next);}catch{alwaysOnTop=!next;paintDetachButton();}
  });
 }
 const topLabel=t('sidechat.alwaysOnTop');
 const topSlot=top.querySelector('span');
 if(topSlot&&topSlot.textContent!==topLabel)topSlot.textContent=topLabel;
 top.hidden=!detached;
 top.setAttribute('aria-checked',String(alwaysOnTop));
 top.dataset.state=t(alwaysOnTop?'sidechat.alwaysOnTop.on':'sidechat.alwaysOnTop.off');
 /* Sinal discreto no cabeçalho da filha (achado 15): fora do menu, o estado
    ligado aparece no selo do alfinete, com nome acessível. */
 const pin=root.querySelector('#sidechat-pin');
 if(pin){
  if(!pin.querySelector('.icon'))pin.innerHTML=icon('pin');
  pin.hidden=!(detached&&alwaysOnTop);
  const pinLabel=t('sidechat.alwaysOnTopIndicator');
  if(pin.getAttribute('aria-label')!==pinLabel)pin.setAttribute('aria-label',pinLabel);
  if(pin.title!==pinLabel)pin.title=pinLabel;
 }
 return button;
}
window.addEventListener(LANGUAGE_EVENT,()=>paintDetachButton());

function styleClone(source,doc){
 if(source.tagName==='LINK'){
  const link=doc.createElement('link');
  link.rel='stylesheet';link.href=source.href;
  if(source.media)link.media=source.media;
  return link;
 }
 const style=doc.createElement('style');
 style.textContent=source.textContent||'';
 return style;
}

function paintChildDocument(childWin){
 const doc=childWin.document,root=sidechatElement();
 if(!doc)return;
 const meta=doc.createElement('meta');meta.charset='utf-8';doc.head.appendChild(meta);
 const viewport=doc.createElement('meta');viewport.name='viewport';viewport.content='width=device-width,initial-scale=1';doc.head.appendChild(viewport);
 doc.title=(root?.querySelector('#sidechat-title')?.textContent||'').trim()||t('sidechat.toggle.aria');
 const childTheme=document.documentElement.dataset.theme;
 const colorScheme=childTheme==='dark'?'dark':childTheme==='light'?'light':'light dark';
 const scheme=doc.createElement('style');
 scheme.textContent=`:root{color-scheme:${colorScheme}}`;
 doc.head.appendChild(scheme);
 for(const sheet of document.querySelectorAll('link[rel="stylesheet"], style'))doc.head.appendChild(styleClone(sheet,doc));
 const layout=doc.createElement('style');
 /* Na solta, o painel ativo (`#sidechat:focus-within`, readers.css) vira um
    contorno azul em volta da janela inteira; na Mesa ele marca a coluna. Aqui
    só o teclado mostra o anel, pelo `:has(:focus-visible)` do descendente. */
 layout.textContent='html,body{height:100%}body{margin:0;display:flex;flex-direction:column}#sidechat{height:100%;flex:1}#sidechat:focus-within::after{display:none}#sidechat:has(:focus-visible)::after{content:"";position:absolute;inset:0;z-index:7;border:1px solid var(--ring);pointer-events:none}';
 doc.head.appendChild(layout);
 syncChildChrome(childWin);
}

function syncChildChrome(childWin=detachedWin){
 if(!childWin||childWin.closed||!childWin.document)return;
 const src=document.documentElement,dst=childWin.document.documentElement;
 for(const attr of [...src.attributes])dst.setAttribute(attr.name,attr.value);
 for(const attr of [...dst.attributes])if(!src.hasAttribute(attr.name))dst.removeAttribute(attr.name);
 childWin.document.body.className=document.body.className;
 childWin.document.title=(sidechatElement()?.querySelector('#sidechat-title')?.textContent||'').trim()||t('sidechat.toggle.aria');
}

function startChromeSync(childWin){
 stopChromeSync();
 chromeObserver=new MutationObserver(()=>{if(!painting){painting=true;syncChildChrome(childWin);painting=false;}});
 chromeObserver.observe(document.documentElement,{attributes:true});
 chromeObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
 headObserver=new MutationObserver(mutations=>{
  if(!childWin.document)return;
  for(const mutation of mutations)for(const node of mutation.addedNodes)if(node&&['LINK','STYLE'].includes(node.tagName))childWin.document.head.appendChild(styleClone(node,childWin.document));
 });
 headObserver.observe(document.head,{childList:true});
}
function stopChromeSync(){
 chromeObserver?.disconnect();headObserver?.disconnect();chromeObserver=null;headObserver=null;
}

/** Solta o chat lateral numa janela filha própria (o mesmo nó, sem duplicar).
 * @returns {Window | null} a janela filha, ou nulo sem chat visível para soltar
 * @example detachSidechat() */
export function detachSidechat(){
 if(isDetachedSidechat()){focusDetachedSidechat();return detachedWin;}
 const root=sidechatElement();if(!root||!root.isConnected||root.hidden)return null;
 const childWin=window.open('about:blank',SIDCHAT_WINDOW_NAME);
 if(!childWin||childWin.closed)return null;
 detachedWin=childWin;homeParent=root.parentElement;
 const gone=()=>{if(detachedWin===childWin)attachSidechat();};
 childWin.addEventListener('pagehide',gone);
 childWin.addEventListener('unload',gone);
 paintChildDocument(childWin);
 childWin.document.body.appendChild(childWin.document.adoptNode(root));
 rebindSidechatDocument();
 paintDetachButton();
 startChromeSync(childWin);
 notifyDetached();
 childWin.focus();
 childWin.document.querySelector('#sidechat-prompt')?.focus({preventScroll:true});
 return childWin;
}

/** Traz o chat lateral de volta para a Mesa (a filha fecha). Sem solto, nulo.
 * @returns {boolean} verdade se trouxe de volta
 * @example attachSidechat() */
export function attachSidechat(){
 if(!detachedWin)return false;
 const childWin=detachedWin,root=sidechatElement();
 detachedWin=null;
 stopChromeSync();
 if(root&&homeParent)homeParent.appendChild(root);
 rebindSidechatDocument();
 paintDetachButton();
 notifyDetached();
 if(childWin&&!childWin.closed)try{childWin.close();}catch{}
 document.querySelector('#sidechat-prompt')?.focus({preventScroll:true});
 homeParent=null;
 return true;
}

/** Traz a janela solta para a frente (a faixa e o botão do tutor).
 * @returns {boolean} verdade se havia janela para focar
 * @example focusDetachedSidechat() */
export function focusDetachedSidechat(){
 if(!isDetachedSidechat())return false;
 detachedWin.focus();
 return true;
}
