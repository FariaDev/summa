// @ts-check
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

function readJson(file){
 try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}
}

/**
 * Reconhece a release em qualquer pasta, inclusive no volume montado.
 * @param {{deskDir?:string, platform?:string}} [input]
 * @returns {boolean}
 * @example isMacosRelease({deskDir:'/Applications/Summa.app/Contents/Resources/app'})
 */
function isMacosRelease({deskDir=__dirname,platform=process.platform}={}){
 return platform==='darwin'&&readJson(path.join(deskDir,'release-install.json'))?.kind==='macos-dmg';
}

function resolveFinderAlias(alias){
 try{
  return execFileSync('osascript',['-e',`tell application "Finder" to get POSIX path of (original item of alias file (POSIX file ${JSON.stringify(alias)}) as alias)`],{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','ignore']}).trim();
 }catch{return '';}
}

/**
 * Conserva a origem antiga nos dados do usuário, sem alterar o bundle assinado.
 * @param {{configDir:string, deskDir?:string, home?:string, resolveAlias?:(alias:string)=>string}} input
 * @returns {string} runtime do clone existente, ou vazio para usar userData/runtime
 * @example previousMacosRuntime({configDir:'/Users/ana/Library/Application Support/Mesa de Estudos'})
 */
function previousMacosRuntime({configDir,deskDir=__dirname,home=os.homedir(),resolveAlias=resolveFinderAlias}){
 const stored=path.join(configDir,'previous-install-source.json');
 const sources=[readJson(stored),readJson(path.join(deskDir,'previous-install-source.json'))];
 for(const name of ['Summa.app','Mesa de Estudos.app']){
  const alias=path.join(home,'Applications',name);
  if(!fs.existsSync(alias))continue;
  let app;
  try{app=fs.realpathSync(alias);}catch{continue;}
  if(!fs.existsSync(path.join(app,'Contents')))app=resolveAlias(alias);
  if(app)sources.push(readJson(path.join(app,'Contents','Resources','app','install-source.json')));
 }
 for(const source of sources){
  if(typeof source?.path!=='string'||!path.isAbsolute(source.path))continue;
  const runtime=path.join(source.path,'desk','.runtime');
  if(!fs.statSync(runtime,{throwIfNoEntry:false})?.isDirectory())continue;
  fs.mkdirSync(configDir,{recursive:true});
  fs.writeFileSync(stored,JSON.stringify(source,null,2)+'\n');
  return runtime;
 }
 return '';
}

module.exports={isMacosRelease,previousMacosRuntime};
