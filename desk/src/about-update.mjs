import {$,S,toast} from './state.mjs';
import {openGuide} from './guide-loader.mjs';
import {message as uiMessage} from './i18n.mjs';
import {t,formatDate} from './ui-text.mjs';
import {renderAboutLead,renderAboutOrigin,renderAboutUpdate,renderComponentChecking,renderHelpVersion,setXournalPluginUi} from './dialogs.mjs';
import {noticesOpened,showRows,askUpdate} from './tool-notices.mjs';
import {isOffline,onOfflineChange} from './offline-state.mjs';

/* Guia, Sobre e aviso de atualização: estado da verificação, componentes,
   abrir o Sobre e o selo do cabeçalho.
   Saiu do main.mjs na #43 fase 2; quem liga os eventos continua lá. */

async function openHelp(section=''){
 if($('#help-dialog').open)return;
 renderHelpVersion(S.deskVersion);
 try{await openGuide(typeof section==='string'?section:'');}
 catch(error){toast(error?.message||String(error));}
 const dialog=$('#help-dialog');
 if(dialog&&!dialog.open)dialog.showModal();
}
/* "Como funciona" (#90): link curto que abre a seção certa do guia. */
document.addEventListener('click',event=>{
 const link=event.target?.closest?.('[data-open-guide]');
 if(!link)return;
 event.preventDefault();
 openHelp(String(link.dataset.openGuide||''));
});
/* Sobre: a linha de atualização e o painel "Componentes" são do núcleo
   (`core/dialogsview.bend`); aqui só se liga o updater (IPC do main) e os
   cliques (verificar / Release notes / Atualizar e reiniciar). Node e
   Xournal++ são checados só sob demanda (Verificar agora); a checagem
   automática 1×/dia cobre a Mesa e mantém o aviso no cabeçalho. */
/* A frase "Conferido hoje às 9:40." / "ontem" / "em 12/10" da última checagem,
   já como mensagem (o núcleo a entrega como veio). Sem hora, "" (o núcleo cai
   na versão). A hora segue o idioma da interface. */
function checkedLabel(at){
 const time=Number(at);
 if(!time)return '';
 const when=new Date(time),now=new Date();
 const day=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
 const clock=formatDate(when,{hour:'numeric',minute:'2-digit'});
 const diff=Math.round((day(now)-day(when))/86400000);
 if(diff===0)return uiMessage('update.checked.today',{time:clock});
 if(diff===1)return uiMessage('update.checked.yesterday',{time:clock});
 return uiMessage('update.checked.date',{date:formatDate(when,{day:'2-digit',month:'2-digit'}),time:clock});
}
function updateStateOf(result){
 syncUpdateNotice(result);
 if(result?.status==='update'){offlinePainted=false;return {$:'UpdateReady',version:String(result.version||''),notes:String(result.notes||'').replace(/\s+/g,' ').trim().slice(0,400),url:String(result.url||'')};}
 /* #21: instalação do repositório antigo não recebe as tags do Summa — o
    Sobre manda reinstalar no lugar do botão que recusaria. */
 if(result?.status==='legacy-origin'){offlinePainted=false;return {$:'UpdateLegacyOrigin'};}
 if(result?.status==='current'){offlinePainted=false;return {$:'UpdateNone',current:String(result.current||''),checked:checkedLabel(result.checkedAt)};}
 if(result?.status==='error'){offlinePainted=isOffline();return offlinePainted?{$:'UpdateOffline'}:{$:'UpdateFailed'};}
 /* #109: origem que não recebe atualização não pode dizer "Atualizada". */
 if(result?.status==='unverifiable'){offlinePainted=false;return {$:'UpdateUnverifiable'};}
 offlinePainted=false;
 return {$:'UpdateIdle'};
}
/* #142: sem rede, a linha do Sobre diz o que aconteceu em vez do erro genérico
   da checagem; o aviso volta sozinho para a checagem quando a rede volta. */
let offlinePainted=false;
function paintOfflineUpdate(){
 offlinePainted=true;
 renderAboutUpdate({$:'UpdateOffline'},aboutHandlers);
}
onOfflineChange(offline=>{
 if(!$('#about-dialog')?.open)return;
 if(offline){paintOfflineUpdate();return;}
 if(offlinePainted){offlinePainted=false;refreshMesaUpdate(false);}
});
/* C1: o resultado REAL da última atualização (gravado pelo worker no
   update.json) vira estado do núcleo — é o que o Sobre mostra na reabertura. */
function resultStateOf(result){
 if(!result)return {$:'UpdateIdle'};
 if(result.status==='applied')return {$:'UpdateDone',version:String(result.version||'')};
 /* #160: clone sujo recusado antes de qualquer troca — o Sobre diz que nada
    foi atualizado, com a contagem de arquivos, no lugar de "voltou". */
 if(result.status==='refused'&&result.reason==='dirty-clone')return {$:'UpdateDirtyClone',files:String(result.files||'')};
 if(result.status==='recovered')return {$:'UpdateRecovered',version:String(result.version||''),reason:String(result.reason||'')};
 if(result.status==='incomplete')return {$:'UpdateIncomplete',version:String(result.version||''),reason:String(result.reason||'')};
 return {$:'UpdateIdle'};
}
/* #109: a origem é lida do mesmo host do updater. Falha do IPC mantém o Sobre
   de hoje (linha escondida), nunca inventa uma origem indisponível. */
let currentOrigin={kind:'source'};
async function readOrigin(){
 try{currentOrigin=await window.desk.updateOrigin()||{kind:'source'};}
 catch{currentOrigin={kind:'source'};}
 renderAboutOrigin(currentOrigin);
 return currentOrigin;
}
const aboutHandlers={
 OpenLink:e=>{const url=e.currentTarget?.dataset?.url;if(url)window.desk.openExternal(url).catch(err=>toast(err.message));},
 /* C1: abre o desk.log do runtime (o motivo de um rollback fica lá). */
 OpenLog:async()=>{try{await window.desk.openLog();}catch(err){toast(err.message);}},
 CheckUpdate:async()=>{if(isOffline()){paintOfflineUpdate();return;}renderAboutUpdate({$:'UpdateChecking'},aboutHandlers);try{await readOrigin();renderAboutUpdate(updateStateOf(await window.desk.updateCheck({manual:true})),aboutHandlers);}catch(e){renderAboutUpdate(updateStateOf({status:'error'}),aboutHandlers);if(!isOffline())toast(e.message);}},
 RefreshComponents:()=>refreshAbout(true),
 /* C1: aplicar desliga a ação; na falha o Sobre volta ao resultado real. */
 ApplyUpdate:async()=>{
  renderAboutUpdate({$:'UpdateApplying'},aboutHandlers);
  try{
   const r=await window.desk.updateApply();
   toast(t('update.restarting',{version:r?.version||''}));
  }catch(e){
   toast(e.message);
   try{renderAboutUpdate(resultStateOf(await window.desk.updateResult()),aboutHandlers);}
   catch{renderAboutUpdate({$:'UpdateIdle'},aboutHandlers);}
  }
 },
};
/* B4: os componentes não esperam a checagem da Mesa — versões/estados locais
   primeiro (com a checagem de rede deles, que tem prazo), linha do update
   depois. */
async function refreshComponents(manual){
 try{showRows((await window.desk.components({manual:!!manual}))?.rows||[]);}
 catch(e){if(manual)toast(e.message);}
}
/* Plugin MesaPagina (#133): instala pela ação explícita do botão da linha do
   Xournal++, confirma no toast curto e reconfere o estado; o aviso de reiniciar
   fica na própria linha (N11). A falha só vive no erro inline com "Tentar de
   novo" — o toast repetido saiu (N12). */
window.addEventListener('desk-xournal-plugin-install',async()=>{
 setXournalPluginUi({busy:true,error:''});
 try{
  await window.desk.xournalPluginInstall();
  setXournalPluginUi({busy:false,error:''});
  toast(t('component.plugin.done'));
  await refreshComponents(false);
 }catch(e){
  const message=e?.message?String(e.message):String(e);
  setXournalPluginUi({busy:false,error:message});
  try{await refreshComponents(false);}catch{}
 }
});
async function refreshMesaUpdate(manual){
 if(isOffline()){paintOfflineUpdate();return;}
 try{
  await readOrigin();
  renderAboutUpdate(updateStateOf(await window.desk.updateCheck({manual:!!manual})),aboutHandlers);
 }catch(e){if(manual)toast(e.message);}
}
/* O painel de componentes pinta por conta própria, sem esperar a checagem da
   Mesa; a promessa devolvida é a das linhas (quem precisa delas espera só ela). */
function refreshAbout(manual){
 const rows=refreshComponents(manual);
 refreshMesaUpdate(manual);
 return rows;
}
/* `ask`: a linha cuja confirmação de "Atualizar" já abre (#51: "Atualizar
   Claude Code" na coluna do tutor). Menus e cliques chamam sem opção. */
async function openAbout(options){
 const ask=typeof options?.ask==='string'?options.ask:'';
 if($('#about-dialog').open){if(ask)askUpdate(ask);return;}
 renderAboutLead(S.deskVersion);
 /* C3: as 4 linhas nascem já com "Verificando…" (Mesa com a versão local); a
    checagem chega em seguida sem abrir vão. */
 renderComponentChecking();
 $('#about-dialog').showModal();
 noticesOpened();
 await readOrigin();
 try{renderAboutUpdate(resultStateOf(await window.desk.updateResult()),aboutHandlers);}
 catch{renderAboutUpdate({$:'UpdateIdle'},aboutHandlers);}
 const rows=refreshAbout(false);
 if(!ask)return;
 await rows;
 askUpdate(ask);
}
let updateVersion='';
function syncUpdateNotice(result){
 const button=$('#update-notice');
 if(result?.status==='current'){updateVersion='';button.hidden=true;button.textContent='';return;}
 // Uma falha de rede não apaga uma atualização já confirmada.
 if(result?.status!=='update'||!result.version)return;
 updateVersion=String(result.version);
 paintUpdateNotice();
}
function paintUpdateNotice(){
 const button=$('#update-notice');
 if(!updateVersion)return;
 button.textContent=t('chrome.update.available',{version:updateVersion});
 button.hidden=false;
}

export {openHelp,aboutHandlers,refreshAbout,openAbout,syncUpdateNotice,paintUpdateNotice,resultStateOf,updateStateOf};
