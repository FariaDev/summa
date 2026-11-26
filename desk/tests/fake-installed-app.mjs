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

/** App do DMG que herdou o runtime do clone pela 1.4.1, sem registro da troca (#196). */
export function fakeDmgFromEarlierSwitch(){
 const fixture=fakeInstalledApp({target:'dmg',record:false});
 const bundle=path.join(fixture.root,'Applications','Release.app');
 const payload=path.join(bundle,'Contents','Resources','app');
 fs.mkdirSync(payload,{recursive:true});
 fs.writeFileSync(path.join(payload,'release-install.json'),JSON.stringify({kind:'macos-dmg'}));
 const configDir=path.join(fixture.root,'config');
 fs.mkdirSync(configDir,{recursive:true});
 fs.writeFileSync(path.join(configDir,'previous-install-source.json'),JSON.stringify({path:fixture.source}));
 return {...fixture,bundle,payload,configDir};
}

/** App do DMG com `runtimePath` próprio e o alias de ~/Applications no Summa.app do clone (#196). */
export function fakeDmgWithSourceAlias({symlink=true}={}){
 const fixture=fakeDmgFromEarlierSwitch();
 fs.rmSync(path.join(fixture.configDir,'previous-install-source.json'));
 const runtime=path.join(fixture.root,'learning-canvas','desk','.runtime');
 fs.mkdirSync(runtime,{recursive:true});
 const sourceBundle=path.join(fixture.source,'Summa.app');
 const sourcePayload=path.join(sourceBundle,'Contents','Resources','app');
 fs.mkdirSync(sourcePayload,{recursive:true});
 fs.writeFileSync(path.join(sourcePayload,'install-source.json'),JSON.stringify({path:fixture.source}));
 const home=path.join(fixture.root,'home'),alias=path.join(home,'Applications','Summa.app');
 fs.mkdirSync(path.dirname(alias),{recursive:true});
 if(symlink)fs.symlinkSync(sourceBundle,alias);
 else fs.writeFileSync(alias,'finder alias');
 return {...fixture,runtime,home,alias,sourceBundle,sourcePayload};
}
