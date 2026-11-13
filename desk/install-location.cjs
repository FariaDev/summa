/* Raiz e reabertura do app instalado (#181). O payload do `.app` mora em
   `Contents/Resources/app`; o da instalação por usuário do Windows, em
   `resources\app`. A profundidade muda, e o updater precisa do caminho certo
   para reabrir a Mesa depois de aplicar (e para achar o Info.plist no macOS). */
const path=require('node:path');

/**
 * Raiz do app instalado a partir do payload (`app.getAppPath()`).
 * macOS: `Summa.app`; Windows: a pasta em `%LOCALAPPDATA%\Programs`.
 * @param {string} deskDir pasta do payload (onde ficam `main.cjs` e `package.json`)
 * @param {string} [platform]
 * @returns {string}
 * @example appRootFromDesk('C:\\Users\\ana\\AppData\\Local\\Programs\\Summa\\resources\\app','win32')
 * // 'C:\\Users\\ana\\AppData\\Local\\Programs\\Summa'
 */
function appRootFromDesk(deskDir,platform=process.platform){
 /* O caminho segue a plataforma injetada, não a do host: `path.resolve` do
    POSIX trata `C:\...` como nome relativo, e o do Windows trata `/Applications`
    como relativo ao disco (CI do Windows rodando o caso do macOS). */
 const paths=platform==='win32'?path.win32:path.posix;
 return platform==='win32'?paths.resolve(deskDir,'..','..'):paths.resolve(deskDir,'..','..','..');
}

/**
 * Comando que reabre a Mesa depois do update. Em bundle: `open` no macOS,
 * `electron.exe` da instalação no Windows. Fora de bundle (código/clone), é o
 * `npm start` de sempre.
 * @param {{mode: string, deskDir: string, platform?: string}} input
 * @returns {{cmd: string, args: string[], cwd: string, shell?: boolean}}
 * @example reopenInstalled({mode:'bundle',deskDir:'C:\\...\\Summa\\resources\\app',platform:'win32'})
 * // {cmd:'C:\\...\\Summa\\electron.exe',args:[],cwd:'C:\\...\\Summa'}
 */
function reopenInstalled({mode,deskDir,platform=process.platform}){
 if(mode!=='bundle')return {cmd:'npm',args:['start'],cwd:deskDir,shell:platform==='win32'};
 const root=appRootFromDesk(deskDir,platform);
 if(platform==='win32')return {cmd:path.win32.join(root,'electron.exe'),args:[],cwd:root};
 return {cmd:'open',args:[root]};
}

module.exports={appRootFromDesk,reopenInstalled};
