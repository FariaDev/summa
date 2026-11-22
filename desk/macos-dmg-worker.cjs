// @ts-check
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function run(cmd,args){
 const {ELECTRON_RUN_AS_NODE:_node,...env}=process.env;
 return execFileSync(cmd,args,{timeout:10*60*1000,stdio:'pipe',env});
}
function pidAlive(pid){try{process.kill(pid,0);return true;}catch{return false;}}

/** Overrides de ensaio continuam valendo ao reabrir. @param {string} app @param {NodeJS.ProcessEnv} [env] @returns {string[]} @example reopenArgs(app,{LEARNING_DESK_RUNTIME:'/runtime'}) */
function reopenArgs(app,env=process.env){
 const args=[];
 for(const key of ['LEARNING_DESK_RUNTIME','LEARNING_VAULT','LEARNING_DESK_LOCALE'])if(env[key])args.push('--env',`${key}=${env[key]}`);
 return [...args,app];
}

/**
 * Pré-extrai a imagem, espera o app sair e troca as pastas com recuperação.
 * @param {{file:string,app:string,dir:string,pid:number,version:string,lockFile?:string}} input
 * @param {{run?:Function,pidAlive?:Function,sleep?:Function,rename?:typeof fs.renameSync,waitMs?:number}} [deps]
 * @returns {Promise<void>}
 * @example await applyMacosDmg({file,app,dir,pid,version})
 */
async function applyMacosDmg(input,deps={}){
 const {file,app,dir,pid,version,lockFile=''}=input;
 const execute=deps.run||run,alive=deps.pidAlive||pidAlive,pause=deps.sleep||sleep,rename=deps.rename||fs.renameSync;
 const next=app+'.new',old=app+'.old',mount=path.join(dir,'volume');
 let mounted=false,staged=false,moved=false,committed=false,ready=false;
 const cancelled=()=>fs.existsSync(path.join(dir,'cancel'));
 try{
  if(fs.existsSync(next)||fs.existsSync(old))throw Error('Summa.app.new ou Summa.app.old já existe; preserve a cópia antes de tentar novamente');
  fs.mkdirSync(mount);
  mounted=true;
  execute('/usr/bin/hdiutil',['attach','-nobrowse','-readonly','-mountpoint',mount,file]);
  const source=path.join(mount,'Summa.app');
  if(!fs.lstatSync(source).isDirectory())throw Error('DMG sem Summa.app');
  fs.mkdirSync(next);staged=true;
  execute('/usr/bin/ditto',[source,next]);
  execute('/usr/bin/xattr',['-dr','com.apple.quarantine',next]);
  execute('/usr/bin/codesign',['--verify','--deep',next]);
  const payload=path.join(next,'Contents','Resources','app');
  const marker=JSON.parse(fs.readFileSync(path.join(payload,'release-install.json'),'utf8'));
  const pkg=JSON.parse(fs.readFileSync(path.join(payload,'package.json'),'utf8'));
  if(marker.kind!=='macos-dmg'||marker.version!==version||pkg.version!==version)throw Error('versão do app no DMG difere da release assinada');
  if(cancelled())throw Error('atualização cancelada antes da troca');
  fs.writeFileSync(path.join(dir,'ready'),'ready\n');ready=true;
  const deadline=Date.now()+(deps.waitMs??120000);
  while(alive(pid)){
   if(cancelled()||Date.now()>=deadline)throw Error('Summa não fechou; versão anterior preservada');
   await pause(250);
  }
  if(cancelled())throw Error('atualização cancelada antes da troca');
  rename(app,old);moved=true;
  rename(next,app);committed=true;
 }catch(error){
  if(moved&&!committed){
   try{rename(old,app);}
   catch{fs.writeFileSync(path.join(dir,'error'),'Recuperação incompleta: a versão anterior está em Summa.app.old');throw error;}
  }
  fs.writeFileSync(path.join(dir,'error'),String(error?.message||error));
  throw error;
 }finally{
  if(staged&&!committed){try{fs.rmSync(next,{recursive:true,force:true});}catch{}}
  if(committed){try{fs.rmSync(old,{recursive:true,force:true});}catch{}}
  if(mounted){try{execute('/usr/bin/hdiutil',['detach',mount]);}catch{try{execute('/usr/bin/hdiutil',['detach','-force',mount]);}catch{}}}
  if(lockFile){try{fs.rmSync(lockFile,{force:true});}catch{}}
  if((ready||!alive(pid))&&fs.existsSync(app))execute('/usr/bin/open',reopenArgs(app));
 }
}

if(require.main===module){
 const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 applyMacosDmg(input).catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={applyMacosDmg,reopenArgs};
