// @ts-check
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function run(cmd,args){
 const {ELECTRON_RUN_AS_NODE:_node,...env}=process.env;
 return execFileSync(cmd,args,{timeout:10*60*1000,stdio:'pipe',env});
}
function pidAlive(pid){try{process.kill(pid,0);return true;}catch{return false;}}
function detachVolume(execute,mount){
 try{
  try{execute('/usr/bin/hdiutil',['detach',mount]);}
  catch{execute('/usr/bin/hdiutil',['detach','-force',mount]);}
 }finally{try{fs.rmdirSync(mount);}catch{}}
}

/** Overrides de ensaio continuam valendo ao reabrir. @param {string} app @param {NodeJS.ProcessEnv} [env] @returns {string[]} @example reopenArgs(app,{LEARNING_DESK_RUNTIME:'/runtime'}) */
function reopenArgs(app,env=process.env){
 const args=[];
 for(const key of ['LEARNING_DESK_RUNTIME','LEARNING_VAULT','LEARNING_DESK_LOCALE'])if(env[key])args.push('--env',`${key}=${env[key]}`);
 return [...args,app];
}

/**
 * Pré-extrai a imagem, espera o app sair e troca as pastas atomicamente.
 * @param {{file:string,app:string,dir:string,pid:number,version:string,lockFile?:string}} input
 * @param {{run?:Function,pidAlive?:Function,sleep?:Function,waitMs?:number}} [deps]
 * @returns {Promise<void>}
 * @example await applyMacosDmg({file,app,dir,pid,version})
 */
async function applyMacosDmg(input,deps={}){
 const {file,app,dir,pid,version,lockFile=''}=input;
 const execute=deps.run||run,alive=deps.pidAlive||pidAlive,pause=deps.sleep||sleep;
 const swap=path.join(app,'Contents','MacOS','summa-swap');
 let mount='',stage='',ready=false;
 const cancelled=()=>fs.existsSync(path.join(dir,'cancel'));
 try{
  fs.accessSync(swap,fs.constants.X_OK);
  // Uma montagem órfã não deve impedir a limpeza da pasta de download.
  mount=fs.mkdtempSync(path.join(os.tmpdir(),'summa-dmg-volume-'));
  execute('/usr/bin/hdiutil',['attach','-nobrowse','-readonly','-mountpoint',mount,file]);
  const source=path.join(mount,'Summa.app');
  if(!fs.lstatSync(source).isDirectory())throw Error('DMG sem Summa.app');
  // A troca exige o mesmo volume. Um processo morto não reserva o caminho do próximo.
  stage=fs.mkdtempSync(path.join(path.dirname(app),'.'+path.basename(app)+'.update-'));
  const next=path.join(stage,'Summa.app');
  fs.mkdirSync(next);
  execute('/usr/bin/ditto',[source,next]);
  detachVolume(execute,mount);mount='';
  execute('/usr/bin/xattr',['-dr','com.apple.quarantine',next]);
  execute('/usr/bin/codesign',['--verify','--deep',next]);
  const payload=path.join(next,'Contents','Resources','app');
  const marker=JSON.parse(fs.readFileSync(path.join(payload,'release-install.json'),'utf8'));
  const pkg=JSON.parse(fs.readFileSync(path.join(payload,'package.json'),'utf8'));
  if(marker.kind!=='macos-dmg'||marker.version!==version||pkg.version!==version)throw Error(`versão do app no DMG difere da release assinada: recebido kind=${JSON.stringify(marker.kind)}, marker.version=${JSON.stringify(marker.version)}, package.version=${JSON.stringify(pkg.version)}; esperado kind="macos-dmg", marker.version=${JSON.stringify(version)}, package.version=${JSON.stringify(version)}`);
  if(cancelled())throw Error('atualização cancelada antes da troca');
  fs.writeFileSync(path.join(dir,'ready'),'ready\n');ready=true;
  const deadline=Date.now()+(deps.waitMs??120000);
  while(alive(pid)){
   if(cancelled()||Date.now()>=deadline)throw Error('Summa não fechou; versão anterior preservada');
   await pause(250);
  }
  if(cancelled())throw Error('atualização cancelada antes da troca');
  execute(swap,[app,next]);
 }catch(error){
  fs.writeFileSync(path.join(dir,'error'),String(error?.message||error));
  throw error;
 }finally{
  if(stage){try{fs.rmSync(stage,{recursive:true,force:true});}catch{}}
  if(mount){try{detachVolume(execute,mount);}catch{}}
  if(lockFile){try{fs.rmSync(lockFile,{force:true});}catch{}}
  if((ready||!alive(pid))&&fs.existsSync(app))execute('/usr/bin/open',reopenArgs(app));
 }
}

if(require.main===module){
 const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 applyMacosDmg(input).catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={applyMacosDmg,reopenArgs};
