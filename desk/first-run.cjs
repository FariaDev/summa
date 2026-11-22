const fs=require('node:fs');const path=require('node:path');
const {message: uiMsg}=require('./src/i18n.mjs');
const {courseLibrary,pdfFolderOf}=require('./courses.cjs');

/* Primeira abertura dentro do app (ticket #21). O que a pessoa soltou no
   quadro da folha "Lista 0 — Montar a mesa" vira UMA pasta de PDFs, a da
   matéria que nasce. Nada é copiado, movido ou alterado: a Mesa só aponta para
   onde os arquivos já estão.

   - uma pasta solta: é a pasta da matéria (a primeira, se vierem várias);
   - PDFs soltos: a pasta onde o primeiro está. PDFs de outras pastas não
     entram (a matéria tem uma pasta só) e são contados em `elsewhere` para a
     Mesa avisar;
   - `pdfNames` traz os primeiros nomes (em ordem) para a tela mostrar;
   - qualquer outra coisa solta (imagem, texto…) é ignorada;
   - sem pasta nem PDF não há o que criar: erro com a frase que o toast mostra. */

const MAX_PATHS=200;
const samePath=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;

/* Os PDFs da pasta, em ordem de nome (a tela da #64 mostra os primeiros). São
   os que a biblioteca da matéria vai listar (`courseLibrary`, com subpastas):
   antes só a raiz contava e uma pasta com tudo em subpastas dava zero (#70).
   #88: dois PDFs de mesmo nome em pastas diferentes saíam iguais no resumo;
   o repetido ganha a subpasta relativa à raiz varrida (`pdfFolderOf`, #74). */
function listPdfs(folder){
 const pdfs=courseLibrary(folder);
 const count=new Map();
 for(const pdf of pdfs)count.set(pdf.name,(count.get(pdf.name)||0)+1);
 return pdfs.map(pdf=>{
  if(count.get(pdf.name)<2)return pdf.name;
  const sub=pdfFolderOf(folder,pdf.path);
  return sub?`${sub}/${pdf.name}`:pdf.name;
 }).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}
const PDF_NAMES=4;

function resolveDrop(paths){
 const list=(Array.isArray(paths)?paths:[]).slice(0,MAX_PATHS)
  .filter(item=>typeof item==='string'&&item&&!item.includes('\0')&&path.isAbsolute(item));
 const folders=[],pdfs=[];
 for(const item of list){
  let info;
  try{info=fs.statSync(item);}catch{continue;}
  if(info.isDirectory())folders.push(path.resolve(item));
  else if(info.isFile()&&/\.pdf$/i.test(item))pdfs.push(path.resolve(item));
 }
 if(folders.length){
  const folder=folders[0];
  const outside=pdfs.filter(file=>!samePath(path.dirname(file),folder)).length;
  const names=listPdfs(folder);
  return {folder,kind:'folder',pdfCount:names.length,pdfNames:names.slice(0,PDF_NAMES),elsewhere:folders.length-1+outside};
 }
 if(pdfs.length){
  const folder=path.dirname(pdfs[0]);
  const inside=pdfs.filter(file=>samePath(path.dirname(file),folder));
  const names=inside.map(file=>path.basename(file)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  return {folder,kind:'pdfs',pdfCount:inside.length,pdfNames:names.slice(0,PDF_NAMES),elsewhere:pdfs.length-inside.length};
 }
 throw Error(uiMsg('err.firstrun.dropPdfs'));
}

/* Documents vem do sistema para respeitar redirecionamento e tradução.
   Dentro do home do Electron, rebase para os.homedir(): o HOME isolado dos
   testes continua valendo como no config.cjs; pastas externas ficam intactas. */
/** Suggest the configured vault or the system Documents folder, respecting HOME overrides.
 * @param {{vaultPath?: string}|null} config
 * @param {string} home Effective home used by the configuration.
 * @param {string} [documents] Electron's Documents directory.
 * @param {string} [electronHome] Electron's home directory.
 * @param {typeof path} [paths] Native path operations (injectable for portable tests).
 * @returns {string} Suggested data directory; no directory is created.
 * @example suggestedDataFolder(null, '/home/ana', '/home/ana/Documentos', '/home/ana')
 */
function suggestedDataFolder(config,home,documents,electronHome,paths=path){
 const current=config&&typeof config.vaultPath==='string'?config.vaultPath.trim():'';
 if(current)return current;
 if(typeof documents!=='string'||!paths.isAbsolute(documents))return paths.join(home,'Documents','Summa');
 if(typeof electronHome==='string'&&paths.isAbsolute(electronHome)){
  const relative=paths.relative(electronHome,documents);
  if(!relative)return paths.join(home,'Documents','Summa');
  if(relative!=='..'&&!relative.startsWith(`..${paths.sep}`)&&!paths.isAbsolute(relative))documents=paths.join(home,relative);
 }
 if(!paths.relative(home,documents))return paths.join(home,'Documents','Summa');
 return paths.join(documents,'Summa');
}

/* Cria a pasta de dados (e só ela) quando a pessoa confirma. */
function prepareDataFolder(folder){
 if(typeof folder!=='string'||!folder.trim()||folder.includes('\0')||!path.isAbsolute(folder))throw Error(uiMsg('err.firstrun.badDataFolder'));
 fs.mkdirSync(folder,{recursive:true});
 if(!fs.statSync(folder).isDirectory())throw Error(uiMsg('err.firstrun.notFolder'));
 return folder;
}

module.exports={resolveDrop,suggestedDataFolder,prepareDataFolder,MAX_PATHS};
