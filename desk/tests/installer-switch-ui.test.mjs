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
