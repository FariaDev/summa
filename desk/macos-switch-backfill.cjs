// @ts-check
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {isMacosRelease,resolveFinderAlias}=require('./macos-release.cjs');
const {readInstalledApp,recordInstalledApp}=require('./installed-app-redirect.cjs');
const {aliasTarget,ALIAS_NAMES}=require('./switch-alias-cleanup.cjs');

/* #196: quem trocou para o DMG pela 1.4.1 ficou sem `installed-app.json`, que
   só nasce a partir da 1.4.2. Sem ele, o atalho antigo continua abrindo a cópia
   de código e o alias de ~/Applications não sai. O app do DMG já sabe de qual
   cópia veio: `previous-install-source.json`, gravado quando ele herdou o runtime
   do clone. Com isso, ele mesmo grava o registro que a troca não gravou.
   Quem aponta `runtimePath` para outra pasta não tem esse arquivo (o runtime não
   veio do clone); aí a cópia substituída sai do alias de ~/Applications, que o
   `npm run install-app` deixou apontando para o Summa.app dela. */

/** @param {string} file @returns {string} */
function realOrEmpty(file){
 try{return fs.realpathSync(file);}catch{return '';}
}

/** @param {string} file @returns {any} */
function readJson(file){
 try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}
}

/**
 * A cópia de código para onde o alias de ~/Applications aponta, se o alvo é o
 * Summa.app de um clone (não outro app de release).
 * @param {{home:string,resolveAlias:(alias:string)=>string}} input @returns {string}
 */
function aliasSourcePath({home,resolveAlias}){
 for(const name of ALIAS_NAMES){
  const bundle=aliasTarget(path.join(home,'Applications',name),resolveAlias);
  if(!bundle)continue;
  const payload=path.join(bundle,'Contents','Resources','app');
  if(fs.existsSync(path.join(payload,'release-install.json')))continue;
  const source=readJson(path.join(payload,'install-source.json'))?.path;
  if(typeof source==='string'&&path.isAbsolute(source)&&realOrEmpty(path.join(source,name))===bundle)return source;
 }
 return '';
}

/** @param {string} runtime @param {string} configDir @returns {string} */
function inheritedSourcePath(runtime,configDir){
 const source=readJson(path.join(configDir,'previous-install-source.json'));
 if(typeof source?.path!=='string'||!path.isAbsolute(source.path))return '';
 const shared=realOrEmpty(runtime);
 return shared&&shared===realOrEmpty(path.join(source.path,'desk','.runtime'))?source.path:'';
}

/**
 * No app do DMG que herdou o runtime de uma cópia de código, grava o registro
 * da troca se ele falta. A cópia vem de `previous-install-source.json` quando o
 * runtime é o dela, ou do alias de ~/Applications.
 * @param {{runtime:string,deskDir:string,configDir:string,version:string,platform?:string,now?:number,home?:string,resolveAlias?:(alias:string)=>string}} input
 * @returns {boolean} se o registro foi gravado agora
 * @example adoptEarlierMacosSwitch({runtime,deskDir:__dirname,configDir,version:'1.4.2'})
 */
function adoptEarlierMacosSwitch({runtime,deskDir,configDir,version,platform=process.platform,now=Date.now(),home=os.homedir(),resolveAlias=resolveFinderAlias}){
 if(!isMacosRelease({deskDir,platform})||readInstalledApp(runtime))return false;
 const source=inheritedSourcePath(runtime,configDir)||aliasSourcePath({home,resolveAlias});
 if(!source)return false;
 /* deskDir = <Summa.app>/Contents/Resources/app */
 const bundle=path.resolve(deskDir,'..','..','..');
 if(path.extname(bundle)!=='.app')return false;
 try{return recordInstalledApp({runtime,deskDir:path.join(source,'desk'),target:'dmg',appPath:bundle,version,now});}
 catch{return false;/* sem registro, a cópia antiga só continua abrindo como antes */}
}

module.exports={adoptEarlierMacosSwitch};
