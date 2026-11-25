import test from 'node:test';
import assert from 'node:assert/strict';
import {fakeInstallerSwitchHost} from './fake-installer-switch-host.mjs';

for(const mode of ['zip','git','bundle']){
 test(`IPC ${mode}: oferece e encaminha os caminhos atuais`,async()=>{
  const {ipcMain,calls,input}=fakeInstallerSwitchHost({mode});
  assert.equal(await ipcMain.invoke('update-switch-target'),'appimage');
  await ipcMain.invoke('update-switch');
  assert.equal(calls.length,1);assert.equal(calls[0].runtime,input.runtime);assert.equal(calls[0].configFile,input.configFile);
 });
}
for(const [mode,platform,arch] of [['legacy','linux','x64'],['unavailable','linux','x64'],['exe','win32','x64'],['dmg','darwin','arm64'],['appimage','linux','x64'],['zip','linux','arm64']]){
 test(`IPC recusa ${mode}/${platform}/${arch}`,async()=>{
  const {ipcMain,calls}=fakeInstallerSwitchHost({mode,platform,arch});
  assert.equal(await ipcMain.invoke('update-switch-target'),null);
  await assert.rejects(ipcMain.invoke('update-switch'),/switchUnavailable/);assert.deepEqual(calls,[]);
 });
}
test('TEST_MODE nunca instala mesmo quando a plataforma permite oferecer',async()=>{
 const {ipcMain,calls}=fakeInstallerSwitchHost({testMode:true});
 assert.equal(await ipcMain.invoke('update-switch-target'),'appimage');
 await assert.rejects(ipcMain.invoke('update-switch'),/testMode/);assert.deepEqual(calls,[]);
});
/* #196: o app instalado avisa do atalho antigo uma vez; o Sobre relê o resultado
   na mesma abertura sem perder o aviso, e a abertura seguinte não repete. */
test('update-result leva o aviso da troca só na primeira abertura do app instalado',async()=>{
 const fs=await import('node:fs');
 const {recordInstalledApp}=await import('../installed-app-redirect.cjs');
 const first=fakeInstallerSwitchHost({mode:'appimage'});
 recordInstalledApp({runtime:first.input.runtime,deskDir:first.input.deskDir,target:'appimage',appPath:'/apps/Summa.AppImage',version:'1.4.0'});
 assert.equal((await first.ipcMain.invoke('update-result'))?.switchNote,true);
 assert.equal((await first.ipcMain.invoke('update-result'))?.switchNote,true);
 const file=`${first.input.runtime}/installed-app.json`;
 assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).noticed,true);
 const source=fakeInstallerSwitchHost({mode:'zip'});
 recordInstalledApp({runtime:source.input.runtime,deskDir:source.input.deskDir,target:'appimage',appPath:'/apps/Summa.AppImage',version:'1.4.0'});
 assert.equal(await source.ipcMain.invoke('update-result'),null,'a cópia de código não avisa');
});
