// @ts-check
import {$,toast} from './state.mjs';
import {t,LANGUAGE_EVENT} from './ui-text.mjs';

let busy=false;

/**
 * Oferece a troca só quando o host reconhece um formato nativo compatível (#187).
 * @returns {Promise<void>}
 * @example await refreshInstallerSwitch();
 */
export async function refreshInstallerSwitch(){
 const row=$('#about-installer-switch');
 if(!row||busy)return;
 row.hidden=true;
 try{
  const target=await window.desk.updateSwitchTarget();
  if(!['exe','dmg','appimage'].includes(target||''))return;
  const button=document.createElement('button');
  button.type='button';
  button.id='installer-switch';
  button.textContent=t(`update.switch.${target}`);
  button.addEventListener('click',async()=>{
   if(busy||!window.confirm(t('update.switch.confirm')))return;
   busy=true;
   button.disabled=true;
   button.textContent=t('update.switch.busy');
   try{await window.desk.updateSwitch();}
   catch(error){toast(error.message);}
   finally{busy=false;button.disabled=false;button.textContent=t(`update.switch.${target}`);}
  });
  row.replaceChildren(button);
  row.hidden=false;
 }catch{/* Sem IPC disponível não se oferece uma instalação que não pode começar. */}
}
window.addEventListener(LANGUAGE_EVENT,()=>{if($('#about-dialog')?.open)refreshInstallerSwitch();});
