// @ts-check
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {isLinuxAppImage}=require('./linux-appimage-update.cjs');

function desktopExec(file){
 const escaped=file.replace(/%/g,'%%').replace(/[\\"`$]/g,'\\$&');
 return `"${escaped}"`;
}

function writeChanged(file,content){
 if(fs.existsSync(file)&&fs.readFileSync(file).equals(content))return false;
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,content);
 return true;
}

/**
 * Integra o AppImage ao menu por usuário, sem regravar conteúdo idêntico.
 * @param {{deskDir:string,assetsDir:string,platform?:string,env?:NodeJS.ProcessEnv,home?:string}} input
 * @returns {boolean} houve alteração
 * @example ensureLinuxDesktopEntry({deskDir:__dirname,assetsDir:'/app/assets'})
 */
function ensureLinuxDesktopEntry({deskDir,assetsDir,platform=process.platform,env=process.env,home=os.homedir()}){
 if(!isLinuxAppImage({deskDir,platform,env}))return false;
 const image=String(env.APPIMAGE);
 if(/[\r\n]/.test(image))throw Error('Caminho do AppImage inválido; esperado caminho sem quebra de linha');
 const root=env.XDG_DATA_HOME&&path.isAbsolute(env.XDG_DATA_HOME)?env.XDG_DATA_HOME:path.join(home,'.local','share');
 const icon=path.join(root,'icons','hicolor','256x256','apps','summa.png');
 const content=`[Desktop Entry]\nType=Application\nName=Summa\nExec=${desktopExec(image)} %U\nTryExec=${image.replace(/\\/g,'\\\\')}\nStartupWMClass=summa\nIcon=summa\nCategories=Education;\nTerminal=false\n`;
 const iconChanged=writeChanged(icon,fs.readFileSync(path.join(assetsDir,'app-icon','integral-light-graphite-256.png')));
 const entryChanged=writeChanged(path.join(root,'applications','summa.desktop'),Buffer.from(content));
 return iconChanged||entryChanged;
}

module.exports={ensureLinuxDesktopEntry};
