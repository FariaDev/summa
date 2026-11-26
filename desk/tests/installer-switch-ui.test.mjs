import test from 'node:test';
import assert from 'node:assert/strict';
import {installDom} from './dom-shim.mjs';
import {fakeInstallerSwitchUi} from './fake-installer-switch.mjs';
installDom();
document.querySelector('#about-installer-switch').replaceChildren=function(...children){this.children=children;};
const {refreshInstallerSwitch}=await import('../src/installer-switch.mjs');

test('Sobre oferece somente formatos reconhecidos pelo host',async()=>{
 const row=document.querySelector('#about-installer-switch');
 for(const target of ['exe','dmg','appimage',null,'unknown']){
  const fake=fakeInstallerSwitchUi({target});Object.assign(window.desk,fake.desk);
  await refreshInstallerSwitch();
  assert.equal(row.hidden,!['exe','dmg','appimage'].includes(target));
  if(!row.hidden)assert.ok(row.children[0].textContent.length>0);
 }
});

test('cancelar não inicia; confirmar chama uma vez e reabilita após falhar',async()=>{
 for(const confirm of [false,true]){
  const fake=fakeInstallerSwitchUi({confirm,fail:true});Object.assign(window.desk,fake.desk);window.confirm=fake.confirm;
  await refreshInstallerSwitch();
  const button=document.querySelector('#about-installer-switch').children[0];
  button.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(fake.calls,confirm?['confirm','switch']:['confirm']);
  assert.equal(button.disabled,false);
 }
});

/* #196: o aviso do atalho antigo sai pelo toast só quando o host o entrega. */
test('aviso da troca aparece só com switchNote',async()=>{
 const box=document.querySelector('#toast');
 for(const [result,shown] of [[{status:'applied',switchNote:true},true],[{status:'applied'},false],[null,false]]){
  box.replaceChildren();
  window.desk.updateResult=async()=>result;
  const {showSwitchNote}=await import('../src/installer-switch.mjs');
  await showSwitchNote();
  const text=(box.children||[]).map(item=>(item.children||[]).map(node=>node.textContent||'').join(' ')).join(' ');
  assert.equal(/atalho antigo/.test(text),shown);
 }
});

/* Na primeira abertura o aviso cobria o botão principal do setup: espera a próxima abertura sem gastar o aviso. */
test('na primeira abertura o aviso da troca espera e nem pergunta ao host',async()=>{
 const box=document.querySelector('#toast');
 box.replaceChildren();
 let asked=0;
 window.desk.updateResult=async()=>{asked++;return {switchNote:true};};
 const {showSwitchNote}=await import('../src/installer-switch.mjs');
 await showSwitchNote({firstRun:true});
 assert.equal(asked,0,'o host não gasta o aviso');
 assert.equal((box.children||[]).length,0);
 await showSwitchNote({firstRun:false});
 assert.equal(asked,1);
});
