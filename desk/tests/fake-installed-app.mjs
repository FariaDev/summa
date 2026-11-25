import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tempDir} from './temp-dir.mjs';
const require=createRequire(import.meta.url);
const {recordInstalledApp}=require('../installed-app-redirect.cjs');

/** Spawn que só anota o pedido: nenhum app abre durante o teste (#196). */
export function fakeAppSpawn({fail=false}={}){
 const calls=[];
 function spawnFn(command,args,options){
  if(fail)throw Error('fake spawn failed');
  calls.push({command,args,options});
  return {on(){return this;},unref(){calls.at(-1).unref=true;}};
 }
 return {calls,spawnFn};
}

/** Clone de origem, runtime compartilhado e app instalado no disco (#196). */
export function fakeInstalledApp({target='appimage',record=true}={}){
 const root=tempDir('summa-redirect-');
 const source=path.join(root,'source'),deskDir=path.join(source,'desk'),runtime=path.join(deskDir,'.runtime');
 fs.mkdirSync(runtime,{recursive:true});
 fs.writeFileSync(path.join(deskDir,'package.json'),'{}');
 const appPath=path.join(root,'Applications',target==='dmg'?'Summa.app':'Summa-x86_64.AppImage');
 fs.mkdirSync(path.dirname(appPath),{recursive:true});
 fs.writeFileSync(appPath,'installed');
 if(record)recordInstalledApp({runtime,deskDir,target,appPath,version:'1.4.0',now:1});
 const lines=[];
 return {root,source,deskDir,runtime,appPath,lines,log:line=>lines.push(line)};
}

/** Finder falso: resolve o alias pelo mapa, sem `osascript` (#196). */
export function fakeFinderAlias(targets={}){
 const asked=[];
 return {asked,resolveAlias(alias){asked.push(alias);return targets[alias]||'';}};
}

/** App do DMG depois da troca: runtime da cópia de código, payload da release e ~/Applications (#196). */
export function fakeDmgAfterSwitch(){
 const fixture=fakeInstalledApp({target:'dmg'});
 const payload=path.join(fixture.root,'Applications','Summa.app.payload');
 fs.mkdirSync(payload,{recursive:true});
 fs.writeFileSync(path.join(payload,'release-install.json'),JSON.stringify({kind:'macos-dmg'}));
 const home=path.join(fixture.root,'home'),userApps=path.join(home,'Applications');
 fs.mkdirSync(userApps,{recursive:true});
 const sourceBundle=path.join(fixture.source,'Summa.app');
 fs.mkdirSync(path.join(sourceBundle,'Contents'),{recursive:true});
 return {...fixture,payload,home,userApps,sourceBundle};
}
