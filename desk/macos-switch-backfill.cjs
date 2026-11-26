// @ts-check
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {isMacosRelease}=require('./macos-release.cjs');
const {readInstalledApp,recordInstalledApp}=require('./installed-app-redirect.cjs');

/* #196: quem trocou para o DMG pela 1.4.1 ficou sem `installed-app.json`, que
   só nasce a partir da 1.4.2. Sem ele, o atalho antigo continua abrindo a cópia
   de código e o alias de ~/Applications não sai. O app do DMG já sabe de qual
   cópia veio: `previous-install-source.json`, gravado quando ele herdou o runtime
   do clone. Com isso, ele mesmo grava o registro que a troca não gravou. */

/** @param {string} file @returns {string} */
function realOrEmpty(file){
 try{return fs.realpathSync(file);}catch{return '';}
}

/** @param {string} file @returns {any} */
function readJson(file){
 try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}
}

/**
 * No app do DMG que herdou o runtime de uma cópia de código, grava o registro
 * da troca se ele falta. Não faz nada se o runtime não é o dessa cópia.
 * @param {{runtime:string,deskDir:string,configDir:string,version:string,platform?:string,now?:number}} input
 * @returns {boolean} se o registro foi gravado agora
 * @example adoptEarlierMacosSwitch({runtime,deskDir:__dirname,configDir,version:'1.4.2'})
 */
function adoptEarlierMacosSwitch({runtime,deskDir,configDir,version,platform=process.platform,now=Date.now()}){
 if(!isMacosRelease({deskDir,platform})||readInstalledApp(runtime))return false;
 const source=readJson(path.join(configDir,'previous-install-source.json'));
 if(typeof source?.path!=='string'||!path.isAbsolute(source.path))return false;
 const shared=realOrEmpty(runtime);
 if(!shared||shared!==realOrEmpty(path.join(source.path,'desk','.runtime')))return false;
 /* deskDir = <Summa.app>/Contents/Resources/app */
 const bundle=path.resolve(deskDir,'..','..','..');
 if(path.extname(bundle)!=='.app')return false;
 try{return recordInstalledApp({runtime,deskDir:path.join(source.path,'desk'),target:'dmg',appPath:bundle,version,now});}
 catch{return false;/* sem registro, a cópia antiga só continua abrindo como antes */}
}

module.exports={adoptEarlierMacosSwitch};
