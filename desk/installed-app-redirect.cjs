// @ts-check
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {installRoot}=require('./config.cjs');
const {isMacosRelease}=require('./macos-release.cjs');
const {isWindowsInstalledApp}=require('./windows-installer-update.cjs');
const {isLinuxAppImage}=require('./linux-appimage-update.cjs');
const {reopenArgs}=require('./macos-dmg-worker.cjs');

/* Depois de "Instalar a versão para …" (#196), a cópia de código continuava
   abrindo como um segundo app com os mesmos dados: o atalho antigo do Dock
   abria o clone, e não o DMG. O registro no runtime compartilhado diz qual
   cópia foi substituída e por qual app; só essa cópia passa a abrir o app
   instalado no lugar dela. */

/** @typedef {{from:string,target:'dmg'|'exe'|'appimage',path:string,version:string,at:number,noticed?:boolean,aliasChecked?:boolean}} InstalledAppRecord */

const TARGETS=new Set(['dmg','exe','appimage']);

/** @param {string} runtime @returns {string} */
function installedAppFile(runtime){
 return path.join(runtime,'installed-app.json');
}

/**
 * Onde a troca deixou o app nativo, no mesmo lugar que `installer-switch.cjs` usa.
 * @param {{target:string,home:string,applications:string,env:NodeJS.ProcessEnv}} input
 * @returns {string} caminho do app, do `.exe` ou do AppImage; vazio se não há como saber
 * @example installedAppPath({target:'dmg',home:'/Users/ana',applications:'/Applications',env:{}}) // '/Applications/Summa.app'
 */
function installedAppPath({target,home,applications,env}){
 if(target==='dmg')return path.join(applications,'Summa.app');
 if(target==='appimage')return path.join(home,'Applications','Summa-x86_64.AppImage');
 /* O Setup instala em `$LOCALAPPDATA\Programs\Summa` (`scripts/summa.nsi`, APP_EXE). */
 if(target==='exe'&&env.LOCALAPPDATA)return path.win32.join(env.LOCALAPPDATA,'Programs','Summa','electron.exe');
 return '';
}

/**
 * Grava qual cópia a troca substituiu. Chamado só depois de o app nativo abrir.
 * @param {{runtime:string,deskDir:string,target:'dmg'|'exe'|'appimage',appPath:string,version:string,now?:number}} input
 * @returns {boolean} se o registro foi gravado
 * @example recordInstalledApp({runtime,deskDir,target:'dmg',appPath:'/Applications/Summa.app',version:'1.4.0'})
 */
function recordInstalledApp({runtime,deskDir,target,appPath,version,now=Date.now()}){
 if(!appPath)return false;
 /** @type {InstalledAppRecord} */
 const record={from:installRoot(deskDir),target,path:appPath,version,at:now,noticed:false};
 fs.writeFileSync(installedAppFile(runtime),JSON.stringify(record,null,2)+'\n');
 return true;
}

/**
 * Lê o registro; formato estranho conta como ausente (a cópia abre normal).
 * @param {string} runtime
 * @returns {InstalledAppRecord|null}
 * @example readInstalledApp('/home/ana/summa/desk/.runtime')?.target // 'appimage'
 */
function readInstalledApp(runtime){
 let record;
 try{record=JSON.parse(fs.readFileSync(installedAppFile(runtime),'utf8'));}catch{return null;}
 if(!record||typeof record.from!=='string'||typeof record.path!=='string'||!TARGETS.has(record.target))return null;
 if(!path.isAbsolute(record.from)||!(path.isAbsolute(record.path)||path.win32.isAbsolute(record.path)))return null;
 return record;
}

/**
 * Esta cópia é um app de release (DMG, Setup, AppImage)? Mesma classificação do
 * `update-host.cjs` (`usesSystemNode`).
 * @param {{deskDir:string,platform:string,env:NodeJS.ProcessEnv}} input
 * @returns {boolean}
 * @example isReleaseInstall({deskDir:'/Applications/Summa.app/Contents/Resources/app',platform:'darwin',env:{}})
 */
function isReleaseInstall({deskDir,platform,env}){
 return isMacosRelease({deskDir,platform})||isWindowsInstalledApp({platform,deskDir,env})||isLinuxAppImage({platform,deskDir,env});
}

/** @param {string} a @param {string} b @param {string} platform @returns {boolean} */
function samePlace(a,b,platform){
 let left,right;
 try{left=fs.realpathSync(a);right=fs.realpathSync(b);}catch{return false;}
 return platform==='win32'?left.toLowerCase()===right.toLowerCase():left===right;
}

/**
 * O registro que manda esta cópia abrir o app instalado, ou null para abrir normal.
 * Nunca redireciona o próprio app instalado, outro checkout que divide o runtime,
 * os testes (sem `SUMMA_REDIRECT_IN_TEST=1`), o `npm start` nem quem pediu `SUMMA_NO_REDIRECT=1`.
 * @param {{runtime:string,deskDir:string,testMode:boolean,platform?:string,env?:NodeJS.ProcessEnv}} input
 * @returns {InstalledAppRecord|null}
 * @example redirectRecord({runtime,deskDir:__dirname,testMode:false})?.path // '/Applications/Summa.app'
 */
function redirectRecord({runtime,deskDir,testMode,platform=process.platform,env=process.env}){
 if(env.SUMMA_NO_REDIRECT==='1')return null;
 /* Quem digita `npm start` no clone quer rodar o código, não o app instalado (#196).
    Os atalhos (Summa.app, .lnk, .desktop) abrem o Electron direto, sem o npm. */
 if(env.npm_lifecycle_event==='start')return null;
 if(testMode&&env.SUMMA_REDIRECT_IN_TEST!=='1')return null;
 if(isReleaseInstall({deskDir,platform,env}))return null;
 return replacedCopyRecord({runtime,root:installRoot(deskDir),platform});
}

/**
 * O registro da troca, se ela substituiu a cópia em `root` e o app instalado
 * ainda existe. O `npm run install-app` usa para não recriar o alias (#196).
 * @param {{runtime:string,root:string,platform?:string}} input
 * @returns {InstalledAppRecord|null}
 * @example replacedCopyRecord({runtime,root:'/Users/ana/summa'})?.path // '/Applications/Summa.app'
 */
function replacedCopyRecord({runtime,root,platform=process.platform}){
 const record=readInstalledApp(runtime);
 if(!record||!fs.existsSync(record.path))return null;
 return samePlace(record.from,root,platform)?record:null;
}

/**
 * Abre o app instalado solto deste processo, que sai em seguida.
 * @param {{record:InstalledAppRecord,platform?:string,env?:NodeJS.ProcessEnv,spawnFn?:typeof spawn}} input
 * @returns {void}
 * @example launchInstalledApp({record})
 */
function launchInstalledApp({record,platform=process.platform,env=process.env,spawnFn=spawn}){
 /* Mesmo cuidado do switchMacos: o modo Node herdado abriria o app sem janela. */
 const {ELECTRON_RUN_AS_NODE:_ignored,...cleanEnv}=env;
 const [command,args]=platform==='darwin'?['open',reopenArgs(record.path,env)]:[record.path,[]];
 const child=spawnFn(command,args,{detached:true,stdio:'ignore',env:cleanEnv,cwd:path.dirname(record.path)});
 child.on('error',()=>{/* o processo já saiu; o atalho seguinte tenta de novo */});
 child.unref();
}

/**
 * Na partida da cópia substituída: abre o app instalado, deixa uma linha no log e
 * devolve true para o main sair antes do lock de instância e da janela.
 * @param {{runtime:string,deskDir:string,testMode:boolean,log:(line:string)=>void,platform?:string,env?:NodeJS.ProcessEnv,spawnFn?:typeof spawn}} input
 * @returns {boolean} se o app instalado foi aberto no lugar desta cópia
 * @example if(redirectToInstalledApp({runtime,deskDir,testMode,log}))process.exit(0);
 */
function redirectToInstalledApp({runtime,deskDir,testMode,log,platform=process.platform,env=process.env,spawnFn=spawn}){
 const record=redirectRecord({runtime,deskDir,testMode,platform,env});
 if(!record)return false;
 try{launchInstalledApp({record,platform,env,spawnFn});}
 catch(error){log(`app instalado (${record.target}) não abriu; esta cópia abre normal: ${error?.message||error}`);return false;}
 log(`cópia substituída pelo app instalado (${record.target} v${record.version}): abrindo o app instalado`);
 return true;
}

/**
 * No app instalado depois da troca: true uma única vez, para avisar do atalho antigo.
 * @param {{runtime:string,deskDir:string,platform?:string,env?:NodeJS.ProcessEnv}} input
 * @returns {boolean}
 * @example takeSwitchNote({runtime,deskDir}) // true na primeira abertura depois da troca
 */
function takeSwitchNote({runtime,deskDir,platform=process.platform,env=process.env}){
 if(!isReleaseInstall({deskDir,platform,env}))return false;
 const record=readInstalledApp(runtime);
 if(!record||record.noticed)return false;
 try{fs.writeFileSync(installedAppFile(runtime),JSON.stringify({...record,noticed:true},null,2)+'\n');}
 catch{return false;/* sem gravar, o aviso voltaria em toda abertura */}
 return true;
}

module.exports={installedAppFile,installedAppPath,recordInstalledApp,readInstalledApp,isReleaseInstall,redirectRecord,replacedCopyRecord,launchInstalledApp,redirectToInstalledApp,takeSwitchNote};
