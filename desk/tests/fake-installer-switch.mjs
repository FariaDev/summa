import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tempDir} from './temp-dir.mjs';
import {exitedInstaller} from './fake-installer-process.mjs';
import {makeSignedRelease} from './fake-update-release.mjs';
const require=createRequire(import.meta.url);
const windows=require('../windows-installer-update.cjs');
const linux=require('../linux-appimage-update.cjs');
const macos=require('../macos-dmg-update.cjs');

/** App, downloads autenticados e comandos nativos sem processos externos. */
export function fakeInstallerSwitch({fail='',installed='1.4.0'}={}){
 const root=tempDir('summa-switch-'),runtime=path.join(root,'source','desk','.runtime');
 const deskDir=path.dirname(runtime),home=path.join(root,'home'),applications=path.join(root,'Applications');
 fs.mkdirSync(runtime,{recursive:true});fs.mkdirSync(home);fs.mkdirSync(applications);
 const configFile=path.join(root,'data','config.json');
 const calls=[];
 const step=name=>{calls.push(name);if(name===fail)throw Error(`fake ${name}`);};
 const config={vaultPath:path.join(root,'vault'),runtimePath:runtime,courses:[]};
 const app={quit(){step('quit');},releaseSingleInstanceLock(){step('release');},requestSingleInstanceLock(){step('retake');return true;}};
 async function prepare({version,dir}){
  step('prepare');
  calls.push(`version:${version}`);
  fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'verified-download');fs.writeFileSync(file,'authenticated');
  return {file};
 }
 const windowsUpdate={prepareInstallerUpdate:prepare,
  async markInstallerPending(input){step('pending');return windows.markInstallerPending(input);},
  clearInstallerPending:windows.clearInstallerPending,
  installerReadyFile:()=>path.join(root,'ready'),
  async launchInstaller(){step('launch');assertPathsSaved();return exitedInstaller(0);},
  async waitForInstallerReady(){step('ready');},
 };
 function assertPathsSaved(){
  const saved=JSON.parse(fs.readFileSync(configFile,'utf8'));
  if(saved.runtimePath!==runtime||saved.vaultPath!==config.vaultPath)throw Error('paths not saved before launch');
 }
 const linuxUpdate={prepareAppImageUpdate:prepare,async relaunchAppImage(){step('launch');assertPathsSaved();}};
 const macosUpdate={prepareDmgUpdate:prepare};
 async function run(command,args){
  step(command==='hdiutil'?args[0]:command);
  if(command==='open')assertPathsSaved();
  if(command==='ditto')fs.writeFileSync(path.join(args[1],'payload'),'app');
 }
 return {root,calls,input:{installed,runtime,deskDir,configFile,config,app,env:{},home,applications,windowsUpdate,linuxUpdate,macosUpdate,run}};
}

/** IPC do botão: confirmação e erro sem fechar a janela (#187). */
export function fakeInstallerSwitchUi({target='appimage',confirm=true,fail=false}={}){
 const calls=[];
 return {calls,confirm(){calls.push('confirm');return confirm;},desk:{
  async updateSwitchTarget(){return target;},
  async updateSwitch(){calls.push('switch');if(fail)throw Error('fake switch failed');return {ok:true,version:'1.4.0'};},
 }};
}

/** Manifesto válido, mas sem assets nativos, como uma release antiga (#187). */
export function fakeSwitchReleaseWithoutAssets(input){
 const release=makeSignedRelease({version:input.installed});
 fs.writeFileSync(path.join(input.deskDir,'update-signing-key.pub'),release.publicKey);
 return {
  windowsUpdate:{...input.windowsUpdate,prepareInstallerUpdate:args=>windows.prepareInstallerUpdate({...args,fetchBuffer:release.fetchBuffer})},
  linuxUpdate:{...input.linuxUpdate,prepareAppImageUpdate:args=>linux.prepareAppImageUpdate({...args,fetchBuffer:release.fetchBuffer})},
  macosUpdate:{...input.macosUpdate,prepareDmgUpdate:args=>macos.prepareDmgUpdate({...args,fetchBuffer:release.fetchBuffer})},
 };
}

/** IPC de janela: nunca baixa nem abre instaladores durante o teste (#187). */
export function installFakeSwitchIpc({ipcMain},{target,fail=false}){
 let calls=0;
 for(const channel of ['update-switch-target','update-switch','test-switch-count'])ipcMain.removeHandler(channel);
 ipcMain.handle('update-switch-target',()=>target);
 ipcMain.handle('update-switch',()=>{calls++;if(fail)throw Error('fake switch failed');return {ok:true,version:'1.4.0'};});
 ipcMain.handle('test-switch-count',()=>calls);
}

/** Confirmação observável sem abrir diálogo nativo no teste de janela (#187). */
export function installFakeSwitchConfirm(answer){
 window.confirm=text=>{document.body.dataset.switchConfirm=text;return answer;};
}
