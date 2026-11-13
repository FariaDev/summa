/* #190: o nome antigo do bundle. Quem atualiza da versão publicada roda o
   updater antigo, que reabre `Mesa de Estudos.app`; o install-app troca esse
   caminho por um link para o Summa.app, e o Summa já aberto apaga o link.
   Falha ao remover é só log: nunca impede abrir. */
const path=require('node:path');

const LEGACY_BUNDLE_NAME='Mesa de Estudos.app';

/**
 * #23/#27: reconhece o `.app` pelo `Contents/Info.plist` acima do app, não por
 * `app.isPackaged` — o install-app mantém o executável `Electron`, e aí o
 * Electron reporta `isPackaged=false` mesmo com o bundle montado.
 * @param {{existsSync: Function}} fs
 * @param {string} bundle raiz do `.app` (ex.: `/Applications/Summa.app`)
 * @returns {boolean}
 * @example isAppBundle(fs,'/Applications/Summa.app') // true
 */
function isAppBundle(fs,bundle){
 return fs.existsSync(path.join(bundle,'Contents','Info.plist'));
}

/** @param {string} bundle @returns {string} */
function legacyBundlePath(bundle){
 return path.join(path.dirname(bundle),LEGACY_BUNDLE_NAME);
}

/** @param {{lstatSync: Function}} fs @param {string} file @returns {'symlink'|'other'|''} */
function entryKind(fs,file){
 try{return fs.lstatSync(file).isSymbolicLink()?'symlink':'other';}catch{return '';}
}

/** @param {{realpathSync: Function}} fs @param {string} a @param {string} b @returns {boolean} */
function sameRealPath(fs,a,b){
 try{return fs.realpathSync(a)===fs.realpathSync(b);}catch{return false;}
}

/**
 * Instalador: depois de instalar o Summa.app, deixa `Mesa de Estudos.app` como
 * link para ele — o updater antigo continua reabrindo o caminho antigo, que
 * agora abre o app novo. Sem bundle antigo, nada é criado.
 * @param {{fs: {lstatSync: Function, realpathSync: Function, rmSync: Function, symlinkSync: Function}, app: string, legacyApp: string}} deps
 * @returns {{linked: boolean, already?: boolean, error?: string}}
 * @example ensureLegacyBundleLink({fs,app:'/x/Summa.app',legacyApp:'/x/Mesa de Estudos.app'})
 */
function ensureLegacyBundleLink({fs,app,legacyApp}){
 if(legacyApp===app||!entryKind(fs,legacyApp))return {linked:false};
 try{
  if(entryKind(fs,legacyApp)==='symlink'&&sameRealPath(fs,legacyApp,app))return {linked:false,already:true};
  fs.rmSync(legacyApp,{recursive:true,force:true});
  fs.symlinkSync(app,legacyApp);
  return {linked:true};
 }catch(error){
  return {linked:false,error:error.message};
 }
}

/**
 * Ao abrir: remove `Mesa de Estudos.app` ao lado do bundle se for o link do
 * instalador ou um bundle antigo — nunca o próprio bundle em execução. Só
 * macOS e bundle reconhecido pelo Info.plist (#27); falha vai para o log e não
 * impede abrir.
 * @param {{fs: {existsSync: Function, lstatSync: Function, realpathSync: Function, rmSync: Function}, bundle: string, platform: string, log?: (area: string, line: string) => void}} deps
 * @returns {{removed: boolean, error?: string}}
 * @example removeLegacyBundle({fs,bundle:'/Applications/Summa.app',platform:process.platform,log:appendLog})
 */
function removeLegacyBundle({fs,bundle,platform,log=()=>{}}){
 if(platform!=='darwin'||!isAppBundle(fs,bundle))return {removed:false};
 const legacy=legacyBundlePath(bundle);
 const kind=entryKind(fs,legacy);
 if(!kind)return {removed:false};
 const same=sameRealPath(fs,legacy,bundle);
 if(kind==='other'&&same)return {removed:false};
 if(kind==='symlink'&&!same)return {removed:false};
 try{
  fs.rmSync(legacy,{recursive:true,force:true});
  return {removed:true};
 }catch(error){
  log('legacy-bundle',`bundle antigo ${legacy} não removido: ${error.message}`);
  return {removed:false,error:error.message};
 }
}

module.exports={LEGACY_BUNDLE_NAME,isAppBundle,ensureLegacyBundleLink,removeLegacyBundle};
