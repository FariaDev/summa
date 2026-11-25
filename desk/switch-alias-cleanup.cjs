// @ts-check
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {isMacosRelease,resolveFinderAlias}=require('./macos-release.cjs');
const {installedAppFile,readInstalledApp}=require('./installed-app-redirect.cjs');

/* #196: o `npm run install-app` deixa um alias em ~/Applications apontando para o
   Summa.app da cópia de código. Depois da troca para o DMG, o Launchpad e o
   Spotlight mostravam dois "Summa". O app do DMG apaga esse alias uma vez, só
   quando ele aponta para a cópia que a troca substituiu; o atalho do Dock fica e
   continua trazendo para cá pelo desvio. */

const ALIAS_NAMES=['Summa.app','Mesa de Estudos.app'];

/** @param {string} file @returns {string} */
function realOrEmpty(file){
 try{return fs.realpathSync(file);}catch{return '';}
}

/**
 * Para onde aponta o atalho; vazio se é um bundle de verdade ou não resolve.
 * @param {string} alias @param {(alias:string)=>string} resolveAlias @returns {string}
 */
function aliasTarget(alias,resolveAlias){
 /* Erro de leitura conta como "não resolve": a partida não pode cair por um atalho. */
 let stat;
 try{stat=fs.lstatSync(alias,{throwIfNoEntry:false});}catch{return '';}
 if(!stat||stat.isDirectory())return '';
 return realOrEmpty(stat.isSymbolicLink()?alias:resolveAlias(alias));
}

/** @param {string} runtime @param {import('./installed-app-redirect.cjs').InstalledAppRecord} record */
function markAliasChecked(runtime,record){
 try{fs.writeFileSync(installedAppFile(runtime),JSON.stringify({...record,aliasChecked:true},null,2)+'\n');}
 catch{/* sem gravar, a próxima abertura confere de novo; nada se perde */}
}

/**
 * No app do DMG, apaga uma vez os aliases de ~/Applications que apontam para a
 * cópia de código que a troca substituiu. Nunca apaga bundle real nem alias de
 * outra pasta.
 * @param {{runtime:string,deskDir:string,log:(line:string)=>void,platform?:string,home?:string,resolveAlias?:(alias:string)=>string}} input
 * @returns {string[]} os aliases apagados
 * @example removeReplacedAlias({runtime,deskDir:__dirname,log}) // ['/Users/ana/Applications/Summa.app']
 */
function removeReplacedAlias({runtime,deskDir,log,platform=process.platform,home=os.homedir(),resolveAlias=resolveFinderAlias}){
 if(!isMacosRelease({deskDir,platform}))return [];
 const record=readInstalledApp(runtime);
 if(!record||record.target!=='dmg'||record.aliasChecked)return [];
 const replaced=new Set(ALIAS_NAMES.map(name=>realOrEmpty(path.join(record.from,name))).filter(Boolean));
 const removed=[];
 for(const name of ALIAS_NAMES){
  const alias=path.join(home,'Applications',name);
  if(!replaced.has(aliasTarget(alias,resolveAlias)))continue;
  try{fs.rmSync(alias,{force:true});removed.push(alias);}
  catch(error){log(`alias antigo ${name} ficou: ${error?.message||error}`);}
 }
 if(removed.length)log(`alias antigo apagado depois da troca para o DMG: ${removed.map(file=>path.basename(file)).join(', ')}`);
 markAliasChecked(runtime,record);
 return removed;
}

module.exports={removeReplacedAlias};
