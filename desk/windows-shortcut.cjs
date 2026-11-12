/* Atalho no menu Iniciar do Windows (#178). Sem instalador a Mesa roda pelo
   electron.exe, e o Windows mostra o ícone embutido dele no Iniciar e nas
   notificações. O atalho com o AppUserModelId da Mesa resolve os dois. É criado
   na abertura e reescrito só quando algum campo muda (p. ex. a pasta do app
   depois de atualizar); erro vira uma linha de log e não derruba a abertura. */
const path=require('node:path');

const WINDOWS_APP_ID='br.com.fariadev.mesa-de-estudos';
const SHORTCUT_FILE='Summa.lnk';
const LEGACY_SHORTCUT_FILE='Mesa de Estudos.lnk';
const SHORTCUT_KEYS=['target','args','cwd','icon','iconIndex','appUserModelId','description'];

/**
 * Campos do atalho que abrem esta Mesa. Em `npm start` o app é a pasta passada
 * ao electron.exe; num executável empacotado não há argumentos.
 * @param {{execPath: string, appPath: string, assetsDir: string, defaultApp: boolean}} app
 * @returns {{target: string, args: string, cwd: string, icon: string, iconIndex: number, appUserModelId: string, description: string}}
 * @example shortcutDetails({execPath:'C:\\app\\electron.exe',appPath:'C:\\mesa\\desk',assetsDir:'C:\\mesa\\desk\\assets',defaultApp:true});
 */
function shortcutDetails({execPath,appPath,assetsDir,defaultApp}){
 return {
  target:execPath,
  args:defaultApp?`"${appPath}"`:'',
  cwd:appPath,
  icon:path.join(assetsDir,'mesa.ico'),
  iconIndex:0,
  appUserModelId:WINDOWS_APP_ID,
  description:'Summa',
 };
}

/** @param {Record<string,string|undefined>} env @returns {string} */
function shortcutFile(env){
 if(!env.APPDATA)throw Error(`APPDATA ausente; esperado o caminho de %APPDATA% para o atalho ${SHORTCUT_FILE}`);
 return path.join(env.APPDATA,'Microsoft','Windows','Start Menu','Programs',SHORTCUT_FILE);
}

/** @param {Record<string,unknown>} current @param {Record<string,unknown>} details */
function sameShortcut(current,details){
 return SHORTCUT_KEYS.every(key=>current[key]===details[key]);
}

/** O Electron lança quando o .lnk ainda não existe. */
function readShortcut(shell,file){
 try{return shell.readShortcutLink(file);}catch{return null;}
}

/** #190: o atalho do nome antigo, na mesma pasta, some quando o novo é criado. */
function removeLegacyShortcut(fs,file,log){
 const legacy=path.join(path.dirname(file),LEGACY_SHORTCUT_FILE);
 try{if(fs.existsSync(legacy))fs.rmSync(legacy,{force:true});}
 catch(error){log('windows-shortcut',`menu Iniciar: atalho antigo ${legacy} não removido: ${error.message}`);}
}

/**
 * Cria ou atualiza o atalho da Mesa no menu Iniciar do Windows. Fora do Windows
 * não faz nada. Falha de leitura/gravação é logada e devolvida, sem lançar.
 * @param {{shell: {readShortcutLink: (file: string) => object, writeShortcutLink: (file: string, operation: string, details: object) => boolean}, platform: string, env: Record<string,string|undefined>, execPath: string, appPath: string, assetsDir: string, defaultApp: boolean, fs: {mkdirSync: (dir: string, options: {recursive: boolean}) => unknown, existsSync: (file: string) => boolean, rmSync: (file: string, options: {force: boolean}) => unknown}, log?: (area: string, line: string) => void}} deps
 * @returns {{changed: boolean, file?: string, error?: string}}
 * @example ensureStartMenuShortcut({shell,platform:process.platform,env:process.env,execPath:process.execPath,appPath:app.getAppPath(),assetsDir:path.join(__dirname,'assets'),defaultApp:!!process.defaultApp,fs,log:appendLog});
 */
function ensureStartMenuShortcut({shell,platform,env,execPath,appPath,assetsDir,defaultApp,fs,log=()=>{}}){
 if(platform!=='win32')return {changed:false};
 let file;
 try{
  file=shortcutFile(env);
  const details=shortcutDetails({execPath,appPath,assetsDir,defaultApp});
  if(sameShortcut(readShortcut(shell,file)||{},details)){
   removeLegacyShortcut(fs,file,log);
   return {changed:false,file};
  }
  fs.mkdirSync(path.dirname(file),{recursive:true});
  if(!shell.writeShortcutLink(file,'create',details))throw Error(`writeShortcutLink devolveu false para ${file}`);
  removeLegacyShortcut(fs,file,log);
  return {changed:true,file};
 }catch(error){
  log('windows-shortcut',`menu Iniciar: atalho ${file||SHORTCUT_FILE} não atualizado: ${error.message}`);
  return {changed:false,file,error:error.message};
 }
}

module.exports={WINDOWS_APP_ID,SHORTCUT_FILE,LEGACY_SHORTCUT_FILE,shortcutDetails,ensureStartMenuShortcut};
