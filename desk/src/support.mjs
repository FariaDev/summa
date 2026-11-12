import {$,S,save,toast,updateContextSummary} from './state.mjs';
import {icon} from '../icons.mjs';
import {t} from './ui-text.mjs';
import {loadSidechat,mountSidechat,setSidechatVisible,sidechatElement} from './sidechat-loader.mjs';
import {isDetachedSidechat,focusDetachedSidechat,attachSidechat,paintDetachButton,setDetachedWindowState,reopenDetachedSidechat} from './sidechat-detach.mjs';

/* ---------------------------------------------------------------------------
   Área de apoio: o segundo leitor (Formulário) e o chat lateral dividem o
   mesmo lugar, à direita do primeiro leitor. Não há barra de abas: o chat abre
   e fecha pelo botão do cabeçalho do tutor e pelo cabeçalho dele próprio
   (`toggleSidechat`); o Formulário volta pelo menu Estudar
   (`toggleReferencePanel`) ou pela faixa `#support-restore`, que ocupa o lugar
   do segundo leitor recolhido.

   - O painel 2 NÃO é recriado: ele é movido uma vez para dentro do
     `#support-slot` (o `loadCourse` recria os painéis a cada matéria) e depois
     só recebe `hidden` — documento, página, zoom e rolagem sobrevivem.
   - O `#reference-toggle` do menu Estudar alterna o painel 2 com o mesmo
     significado de antes (`aria-pressed`).
   - Estado por matéria em `localStorage` (`mesa.support`), isolado do
     `desk.json`; o default do autor (2 leitores = Formulário aberto; 1 leitor =
     apoio recolhido) é preservado.
   --------------------------------------------------------------------------- */

const KEY='mesa.support';
export const supportState={courseId:'',two:false,formLabel:'Formulário',tab:'form',open:true,ready:false,detachedPref:false};
let slot=null,body=null,restore=null,sidechatRequested=false;
/* Onde a área de apoio estava antes de o chat abrir (para fechar devolver). */
let chatBefore=null;

function readStore(){
 try{const raw=JSON.parse(localStorage.getItem(KEY));return raw&&typeof raw==='object'?raw:{};}catch{return {};}
}
function persist(){
 if(!supportState.ready)return;
 try{
  const all=readStore();
  all[supportState.courseId]={tab:supportState.tab,open:supportState.open};
  localStorage.setItem(KEY,JSON.stringify(all));
 }catch{}
}
function defaults(){
 return supportState.two?{tab:'form',open:true}:{tab:'chat',open:false};
}

/* A matéria entra: estado salvo por matéria manda; sem estado salvo vale o
   layout de sempre (2 leitores com o Formulário aberto; 1 leitor recolhido). */
export function beginCourse({courseId,two,formLabel,referenceVisible,sidechatDetached,sidechatAlwaysOnTop}={}){
 supportState.courseId=courseId||'';
 supportState.two=!!two;
 supportState.formLabel=String(formLabel||'Formulário');
 /* Solto ao abrir a Mesa (#157, fatia 2): o desk.json manda; o chat abre e o
    attachPanels solta de novo na posição lembrada, com o por cima lembrado. */
 supportState.detachedPref=sidechatDetached===true;
 setDetachedWindowState({detached:supportState.detachedPref,alwaysOnTop:sidechatAlwaysOnTop===true});
 const saved=readStore()[supportState.courseId]||{};
 const def=defaults();
 let tab=saved.tab==='chat'||saved.tab==='form'?saved.tab:def.tab;
 if(!supportState.two)tab='chat';
 let open=Object.prototype.hasOwnProperty.call(saved,'open')?!!saved.open:def.open;
 if(tab==='form'&&!Object.prototype.hasOwnProperty.call(saved,'open'))open=referenceVisible!==false;
 if(supportState.detachedPref){tab='chat';open=true;}
 supportState.tab=tab;
 supportState.open=open;
 supportState.ready=true;
 apply();
}

/* O `loadCourse` chamou `#pdf-grid.replaceChildren()` e recriou os painéis: o
   slot volta ao fim da grade, o painel 2 entra no corpo e o chat lateral é
   montado uma vez (o mesmo nó sobrevive às trocas). */
export function attachPanels(panels,divider){
 const grid=$('#pdf-grid');
 if(!grid)return;
 ensureSlot(grid);
 const panel1=Array.isArray(panels)?panels[1]:null;
 if(panel1&&body)body.append(panel1.el);
 void divider;
 grid.append(slot);
 if(sidechatElement()&&!isDetachedSidechat()&&!document.body.classList.contains('sidechat-panel')&&sidechatElement().parentElement!==body)body.append(sidechatElement());
 apply();
 if(supportState.detachedPref)reopenDetachedSidechat();
}

function ensureSlot(grid){
 if(slot&&slot.isConnected)return;
 slot=document.createElement('div');
 slot.id='support-slot';
 slot.hidden=true;
 body=document.createElement('div');
 body.id='support-body';
 restore=document.createElement('button');
 restore.type='button';
 restore.id='support-restore';
 restore.hidden=true;
 restore.innerHTML=`<span class="pdf-restore-icon">${icon('chevronLeft')}</span><span class="pdf-restore-label"></span>`;
 restore.addEventListener('click',()=>{if(isDetachedSidechat()){focusDetachedSidechat();return;}selectTab('form');});
 slot.append(restore,body);
 grid.append(slot);
 if(sidechatElement()&&!isDetachedSidechat()&&!document.body.classList.contains('sidechat-panel'))body.append(sidechatElement());
}

/* Painel 2 escondido sem perder rolagem: desconecta o ResizeObserver antes de
   esconder (um observer vendo largura 0 sobrescreveria a posição) e no retorno
   re-observa e re-renderiza — o `render()` do próprio painel repõe
   `scrollX/scrollY` salvos. */
function setPanelVisible(panel,visible){
 if(!panel?.el)return;
 if(visible===!panel.el.hidden)return;
 if(!visible){
  if(panel.rememberScroll)panel.rememberScroll();
  panel._supportScroll={x:panel.scrollX||0,y:panel.scrollY||0};
  try{panel.resize?.disconnect();}catch{}
  panel.el.hidden=true;
  return;
 }
 const saved=panel._supportScroll||{x:panel.scrollX||0,y:panel.scrollY||0};
 panel.el.hidden=false;
 panel.scrollX=saved.x;panel.scrollY=saved.y;
 const restore=()=>{
  if(panel.el.hidden)return;
  panel.scrollX=saved.x;panel.scrollY=saved.y;
  const box=panel.q?.('.pdf-viewport');
  if(box){box.scrollLeft=saved.x;box.scrollTop=saved.y;}
 };
 try{panel.resize?.observe?.(panel.q('.pdf-viewport'));}catch{}
 requestAnimationFrame(restore);
 /* O ResizeObserver do painel mede a saída de `display:none` (0) e pode
    sobrescrever a posição depois; o render repõe, mas re-aplicamos a posição
    salva por alguns instantes até o layout estabilizar. */
 setTimeout(restore,250);
 setTimeout(()=>{restore();panel.updateCurrentPage?.();},700);
 if(panel.doc&&panel.render)panel.render();
 else restore();
}

/* Com dois leitores e a área recolhida, o slot vira uma faixa estreita com o
   rótulo na vertical (a mesma forma do leitor recolhido); um clique reabre o
   Formulário. Com um leitor só não há o que reabrir. */
function paintRestore(collapsed){
 if(!restore)return;
 const detached=isDetachedSidechat();
 restore.hidden=!(collapsed||detached);
 if(detached){
  const strip=t('sidechat.detachedStrip');
  restore.title=strip;
  restore.setAttribute('aria-label',strip);
  const text=restore.querySelector('.pdf-restore-label');
  if(text&&text.textContent!==strip)text.textContent=strip;
  return;
 }
 const label=supportState.formLabel;
 restore.title=t('palette.refToggle.show',{name:label});
 restore.setAttribute('aria-label',t('palette.refToggle.show',{name:label}));
 const text=restore.querySelector('.pdf-restore-label');
 if(text&&text.textContent!==label)text.textContent=label;
}

/**
 * Monta o chat lateral quando o import chega: no `body` ATUAL (o `attachPanels`
 * troca o corpo a cada matéria) e só se a área de apoio ainda está no modo
 * chat (#desempenho). O import lento é injetado para o teste.
 * @param {{load: () => Promise<unknown>, mount: (container: HTMLElement) => unknown,
 *   body: () => HTMLElement|null, isChatOpen: () => boolean}} deps
 * @returns {Promise<boolean>} true quando montou
 * @example await mountSidechatWhenLoaded({load: loadSidechat, mount: mountSidechat, body: () => body, isChatOpen: sidechatOpen});
 */
export async function mountSidechatWhenLoaded({load, mount, body, isChatOpen}){
 await load();
 const container = body();
 if(!container || !isChatOpen()) return false;
 await mount(container);
 return true;
}

/* O chat lateral entra no primeiro uso (#desempenho): até lá o `#sidechat` não
   existe. A aba Chat pede a carga; quando o import chega, o nó é montado no
   corpo da matéria que está na tela e o `apply` de novo mostra o painel. */
function syncSidechat(show){
 if(!show){setSidechatVisible(false);return;}
 if(sidechatElement()){setSidechatVisible(true);return;}
 if(!body||sidechatRequested)return;
 sidechatRequested=true;
 mountSidechatWhenLoaded({load:loadSidechat,mount:mountSidechat,body:()=>body,isChatOpen:sidechatOpen})
  .then(()=>{sidechatRequested=false;apply();if(supportState.detachedPref)reopenDetachedSidechat();})
  .catch(error=>{sidechatRequested=false;toast(error?.message||String(error));});
}

/* O chat lateral na tela inteira (#193) é o MESMO nó, não um segundo chat: com
   o modo ligado e o lateral aberto, ele vira um painel fixo de 17.5rem na borda
   direita (a forma mora em `readers.css`, junto das regras da #192) e o corpo
   ganha `sidechat-panel`. `sidechat-docked` diz que a janela comporta coluna +
   painel: a coluna do tutor termina onde o painel começa. Sem espaço, o painel
   cobre a coluna em vez de espremê-la. Ao sair do modo, o nó volta ao corpo da
   área de apoio com o estado, as sessões e o DOM intactos. */
function placeFullSidechat(showChat){
 if(!supportState.ready)return;
 const panel=document.body.classList.contains('chat-full')&&showChat&&!isDetachedSidechat();
 document.body.classList.toggle('sidechat-panel',panel);
 if(!panel){
  document.body.classList.remove('sidechat-docked');
  const el=sidechatElement();
  if(el&&!isDetachedSidechat()&&body&&el.parentElement!==body)body.append(el);
  return;
 }
 const el=sidechatElement();
 if(!el)return;
 if(el.parentElement!==document.body)document.body.append(el);
 fitFullSidechat(el);
}

/* A decisão de encaixe usa a coluna da #192 (texto + recuo dos dois lados) e a
   calha da barra de rolagem; a largura vem do próprio painel, para não repetir
   o 17.5rem do CSS. */
function fitFullSidechat(el=sidechatElement()){
 if(!el||!document.body.classList.contains('sidechat-panel'))return;
 const root=getComputedStyle(document.documentElement);
 const reading=Number.parseFloat(root.getPropertyValue('--reading-column'))||0;
 const pad=Number.parseFloat(getComputedStyle(document.body).getPropertyValue('--space-5'))||0;
 const messages=$('#messages');
 const scrollbar=messages?Math.max(0,messages.getBoundingClientRect().width-messages.clientWidth):0;
 const room=window.innerWidth-el.getBoundingClientRect().width;
 document.body.classList.toggle('sidechat-docked',room>=reading+2*pad+scrollbar);
}

export function apply(){
 if(!supportState.ready)return;
 const grid=$('#pdf-grid');
 if(!grid)return;
 const showForm=supportState.two&&supportState.open&&supportState.tab==='form';
 const showChat=supportState.open&&supportState.tab==='chat';
 const collapsed=supportState.two&&!supportState.open;
 paintRestore(collapsed);
 $('#references')?.classList.toggle('support-chat',showChat);
 /* O painel 2 é escondido/mostrado ANTES da classe `chat` entrar no corpo: o
    `display:none` do CSS zeraria a leitura da rolagem no momento de salvar. */
 const panel1=S.panels?.[1];
 if(panel1)setPanelVisible(panel1,showForm);
 if(slot){
  const detached=isDetachedSidechat();
  slot.hidden=!(showForm||showChat||collapsed||detached);
  slot.classList.toggle('collapsed',collapsed||detached);
 }
 if(body)body.classList.toggle('chat',showChat);
 if(S.pdfDivider)S.pdfDivider.hidden=!(supportState.two&&supportState.open);
 grid.classList.toggle('single',!supportState.two||!supportState.open);
 /* A semântica antiga do `referenceVisible` continua: painel 2 do PDF visível.
    O `#reference-toggle` do menu e o contexto enviado seguem esse fato. */
 S.refVisible=showForm;
 const toggle=$('#reference-toggle');
 if(toggle)toggle.setAttribute('aria-pressed',String(showForm));
 syncSidechat(showChat);
 placeFullSidechat(showChat);
 paintDetachButton();
 updateContextSummary();
 /* O botão do chat lateral do cabeçalho do tutor reflete o mesmo estado. */
 window.dispatchEvent(new Event('desk-support-changed'));
}

export function selectTab(tab){
 if(tab!=='form'&&tab!=='chat')return;
 if(tab==='form'&&!supportState.two)return;
 if(tab==='form'&&isDetachedSidechat())attachSidechat();
 const changed=supportState.tab!==tab||!supportState.open;
 supportState.tab=tab;
 supportState.open=true;
 apply();
 if(changed){persist();save();}
}

export function setOpen(open){
 const next=!!open;
 if(next===supportState.open)return;
 supportState.open=next;
 apply();
 persist();save();
}

/* Menu Estudar → Formulário: alterna o painel 2 (comportamento de sempre); se o
   chat lateral está à frente, o clique traz o Formulário e o abre. */
export function toggleReferencePanel(){
 if(supportState.tab!=='form'&&isDetachedSidechat())attachSidechat();
 if(supportState.tab!=='form'){supportState.tab='form';supportState.open=true;}
 else supportState.open=!supportState.open;
 apply();
 persist();save();
}

export function sidechatOpen(){return !!supportState.open&&supportState.tab==='chat';}

/* Abre e fecha o chat lateral (botão do cabeçalho do tutor e botão Fechar do
   cabeçalho dele): sem estado próprio além de lembrar o que estava antes.
   Fechar devolve a área ao que estava antes de abrir (o Formulário, aberto ou
   recolhido); sem esse registro, com dois leitores volta ao Formulário e com
   um recolhe a área. */
export function toggleSidechat(){
 if(!supportState.ready)return;
 if(isDetachedSidechat()){focusDetachedSidechat();return;}
 if(!sidechatOpen()){
  chatBefore={tab:supportState.tab,open:supportState.open};
  selectTab('chat');
  return;
 }
 const before=chatBefore;chatBefore=null;
 if(supportState.two){
  selectTab('form');
  if(before&&before.tab==='form'&&before.open===false)setOpen(false);
  return;
 }
 setOpen(false);
}

/* O botão Fechar do cabeçalho do chat lateral avisa por evento (o módulo do
   chat não importa este). Só fecha se ele estiver aberto. */
window.addEventListener('desk-sidechat-close',()=>{
 if(isDetachedSidechat()){attachSidechat();if(sidechatOpen())toggleSidechat();return;}
 if(sidechatOpen())toggleSidechat();
});
window.addEventListener('desk-sidechat-detached',()=>{if(supportState.ready)apply();});
/* Entrar ou sair da tela inteira reposiciona o mesmo lateral (#193). */
window.addEventListener('desk-chat-full-changed',()=>{if(supportState.ready)apply();});
/* Redimensionar decide entre painel encaixado e painel por cima. */
window.addEventListener('resize',()=>fitFullSidechat());

export function supportTab(){return supportState.tab;}
export function supportOpen(){return supportState.open;}
