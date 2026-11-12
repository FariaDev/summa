// @ts-check
const fs=require('node:fs');
const path=require('node:path');
const childProcess=require('node:child_process');
const {message}=require('./src/i18n.mjs');
const {registerNotebookSearchHost}=require('./notebooks-search-host.cjs');
const {createInkConvertHost}=require('./ink-convert-host.cjs');
const {registerNotebookInkHost}=require('./notebook-ink-watch.cjs');
const {xournalTarget}=require('./components.cjs');
const {scanFiles}=require('./file-scan.cjs');
const {isPathUnderRoot}=require('./file-guard.cjs');
const {authorizeXopp}=require('./xopp-authorization.cjs');
const {createPageFormatCache}=require('./notebook-page-format.cjs');

/* ---------- biblioteca de cadernos .xopp (#133): só vista ----------
   Lista recursiva atrás de `.xopp` na pasta de cada matéria e abertura no
   Xournal++. Nunca move, renomeia, cria ou apaga arquivo: a lista lê
   `readdir`/`stat`/`realpath` e, desde a #166, só o começo do gzip para a
   etiqueta de formato; a abertura só entrega o caminho ao programa de
   escrita. Sem lei Bend (ADR 0003: listar/abrir não esconde resposta nem
   alimenta o tutor).
   Ponte da tinta (#159): o retorno deste registro guarda o host da ponte;
   o main tem de chamar `stopInkConvert()` no `before-quit` para fechar a
   porta e apagar `ink-convert-bridge.json` ao sair. */

/**
 * Liga a biblioteca de cadernos `.xopp` ao IPC: `notebooks-list` lista, só à
 * vista, os cadernos de cada matéria e `notebooks-open` valida o caminho e
 * lança o programa de escrita. Lista e abertura leem só metadados e nunca
 * movem, renomear, criam ou apagam arquivo.
 * @param {{ipcMain: {handle: (channel: string, fn: Function) => void}, courses: () => Array<{id: string, name: string, path: string}>, allowedXopp: Set<string>, config: () => object, shell: {openPath: (target: string) => Promise<string>}, runtime?: string, allowSender?: (event: Electron.IpcMainInvokeEvent) => boolean, fs?: any, spawn?: Function, platform?: string, app?: {on: (event: string, fn: Function) => void}, inkConvert?: {runtime?: unknown}|null, inkEnabled?: () => boolean, selection?: () => {model: string|null, effort: string|null}|null, catalog?: () => import('./src/agents/opencode-catalog.cjs').CatalogModel[], createBridge?: (selection: {model: string|null, effort: string|null}|null) => object, readInkImpl?: typeof import('./src/agents/notebook-ink-bridge.cjs').readInk, exportInkPng?: (args: {file: string, page: number, xml: string, signal?: AbortSignal}) => Promise<unknown>, pdfAuthorize?: (file: string) => string, pageFormat?: {formatOf: (file: string, mtimeMs: number) => string}}} deps as dependências injetadas; o `fs` entra por parâmetro para os testes usarem a árvore falsa e o `runtime` é o resolvido pelo main (#158/F2); o `pageFormat` é o leitor com cache por caminho+mtime (#166)
 * @returns {ReturnType<typeof registerNotebookInkHost> & {close: () => Promise<void>, stopInkConvert: () => Promise<void>, startInkConvert: () => Promise<unknown>}} o vigia da tinta (#158) e o abre/fecha da ponte (#159)
 * @example const notebooks = registerNotebooksHost({ipcMain, courses: () => live.courses, allowedXopp, config: () => live.config, shell}); app.on('before-quit', () => { notebooks.stop(); notebooks.stopInkConvert().catch(() => {}); });
 */
function registerNotebooksHost({ipcMain,courses,allowedXopp,config,shell,runtime='',allowSender=()=>true,fs:fsImpl=fs,spawn=childProcess.spawn,platform=process.platform,app,inkConvert=null,inkEnabled,selection,catalog,createBridge,readInkImpl,exportInkPng,pdfAuthorize,pageFormat=createPageFormatCache()}){
  const realpath=typeof fsImpl.realpathSync.native==='function'?(value)=>fsImpl.realpathSync.native(value):(value)=>fsImpl.realpathSync(value);
  const caseSensitive=platform!=='win32'&&platform!=='darwin';
  const listTtlMs=30000;
  /** @type {NotebookItem[]|null} */
  let cachedList=null;
  let cachedAt=0;
  /** @typedef {{courseId:string,name:string,path:string,folder:string,mtimeMs:number,color?:string,format?:string}} NotebookItem */
 /* Cor da matéria (#166): o `config.json` já a normaliza em `#rrggbb`; a
    lista leva a cor junto para o ícone, sem a vista depender do config.
    Config que falha não derruba a lista (fica no cinza de hoje). */
 function courseColor(courseId){
  try{
   const list=/** @type {{courses?: Array<{id?: string, color?: string}>}} */ (typeof config==='function'?config():null)?.courses;
   const entry=(Array.isArray(list)?list:[]).find(item=>item&&item.id===courseId);
   return entry&&typeof entry.color==='string'?entry.color:'';
  }catch{return '';}
 }
 /* A lista vem da varredura compartilhada (`file-scan.cjs`), a mesma dos
    PDFs: até 6 níveis, `seen` corta ciclos de symlink. O symlink que escapa
    da matéria não entra na lista (o canônico dele é testado com o
    `isPathUnderRoot` de `file-guard.cjs`): listar um caderno que a abertura
    recusaria seria item morto. Dedupe pelo canônico. */
 function listCourse(course){
  if(!course||typeof course.path!=='string'||!course.path)return [];
  let rootReal;
  try{rootReal=realpath(course.path);}catch{return [];}
  const found=scanFiles({fs:fsImpl,dir:course.path,isMatch:(name,stat)=>stat.isFile()&&/\.xopp$/i.test(name)});
  const canonical=new Set();
  const out=[];
  for(const item of found){
   if(!isPathUnderRoot(item.canonical,rootReal,{caseSensitive}))continue;
   if(canonical.has(item.canonical))continue;
   canonical.add(item.canonical);
   const color=courseColor(course.id);
   const format=pageFormat.formatOf(item.path,item.mtimeMs);
   out.push({courseId:course.id,name:item.name,path:item.path,folder:path.relative(course.path,path.dirname(item.path)),mtimeMs:item.mtimeMs,...(color?{color}:{}),...(format?{format}:{})});
  }
  return out;
 }
  function listAllNotebooksFresh(){
   const all=[];
   for(const course of courses()||[])all.push(...listCourse(course));
   all.sort((a,b)=>b.mtimeMs-a.mtimeMs||a.name.localeCompare(b.name));
   return all;
  }
  function listAllNotebooksCached(){
   const now=Date.now();
   if(cachedList&&now-cachedAt<listTtlMs)return cachedList;
   const fresh=listAllNotebooksFresh();
   cachedList=fresh;cachedAt=now;
   return fresh;
  }
  function assertSender(event,channel){
   if(!allowSender(event))throw Error(message('err.ipc.senderDenied',{channel}));
  }
  ipcMain.handle('notebooks-list',(event)=>{
   assertSender(event,'notebooks-list');
   const fresh=listAllNotebooksFresh();
   cachedList=fresh;cachedAt=Date.now();
   return {notebooks:fresh};
  });
  /* Índice da tinta (#158, passo 2): o vigia observa o mtime na lista em
     cache, sem re-varrer as matérias; a busca lê o texto lido via
     `inkTexts`. O runtime vem do main (a fiação já o resolve); sem ele, cai
     em env/`config.runtimePath` e, por último, na ponte — nunca em índice
     só de memória quando o runtime real existe (#158/F2). Desligado por
     padrão (`inkEnabled()` false): nada lê nem chama modelo. */
  function inkRuntimeOf(){
   const fromBridge=inkConvert&&typeof inkConvert.runtime==='string'?inkConvert.runtime:'';
   const fallback=(typeof runtime==='string'&&runtime)||fromBridge;
   try{
    const cfg=/** @type {{runtimePath?: unknown}} */(typeof config==='function'?config():null);
    const base=process.env.LEARNING_DESK_RUNTIME||(cfg&&typeof cfg.runtimePath==='string'&&cfg.runtimePath)||fallback;
    return base||null;
   }catch{return fallback||null;}
  }
  /* O vigia recebe a lista em cache, o runtime e o caminho do Xournal++ e,
     pela fiação (`notebook-ink-wiring.cjs`), a escolha, o catálogo e a ponte
     reais; sem eles, o vigia para em `no-model` e nada lê de verdade. */
  const inkWatch=registerNotebookInkHost({ipcMain,listNotebooks:listAllNotebooksCached,runtime:inkRuntimeOf(),allowSender,xournalPath:()=>{try{const cfg=/** @type {{xournalPath?: unknown}} */(config()||{});return typeof cfg.xournalPath==='string'?cfg.xournalPath:'';}catch{return '';}},courseRoots:()=>{try{return (courses()||[]).map(item=>item&&item.path).filter(entry=>typeof entry==='string');}catch{return [];}},...(inkEnabled?{inkEnabled}:{}),...(selection?{selection}:{}),...(catalog?{catalog}:{}),...(createBridge?{createBridge}:{}),...(readInkImpl?{readInkImpl}:{}),...(exportInkPng?{exportInkPng}:{}),...(pdfAuthorize?{pdfAuthorize}:{})});
  /* `before-quit` pelo mesmo caminho de ligação (B1): a fiação passa o `app`,
     então o vigia para junto com a janela; o `stop()` também volta exposto. */
  if(app&&typeof app.on==='function')app.on('before-quit',()=>inkWatch.stop());
  /* A busca no texto digitado (#158) mora em arquivo próprio e só indexa o que
     a lista acima já conhece: fora da biblioteca não entra no índice. Ela
     reutiliza a lista em cache (30 s, renovada quando a biblioteca é listada)
     para não re-varrer as matérias a cada busca. */
  registerNotebookSearchHost({ipcMain,courses,listNotebooks:listAllNotebooksCached,inkTexts:inkWatch.inkTextsFor,allowSender});
  /* Ponte da tinta (#159): o plugin do Xournal++ chama por curl e recebe o
     texto; a ponte é criada só se o `main.cjs` entrega as deps (senão, nada
     sobe e nenhum arquivo nasce — o servidor segue desligado por padrão).
     O host fica guardado e volta no retorno para o `before-quit` fechar. */
  let inkHost=null;
  if(inkConvert){
   try{inkHost=createInkConvertHost(/** @type {Parameters<typeof createInkConvertHost>[0]} */ (inkConvert));inkHost.start().catch(()=>{});}catch{inkHost=null;/* ponte recusada: sem arquivo, sem porta */}
  }
  const closeInk=()=>inkHost?inkHost.close().catch(()=>{}):Promise.resolve();
  const startInk=()=>inkHost?inkHost.start().catch(()=>({port:0,token:''})):Promise.resolve({port:0,token:''});
  /* Com `app`, a ponte também fecha no `before-quit`, como o vigia acima; o
     `main` espera o mesmo `stopInkConvert` antes de sair (#212). */
  if(app&&typeof app.on==='function')app.on('before-quit',()=>closeInk());
 /* Lançamento destacado que não derruba o main (#133): o `error` assíncrono
    (ENOENT) e o lançamento síncrono viram recusa sem caminho, em vez de
    exceção não tratada no processo. O listener é anexado antes do `unref()`. */
 function spawnRefusal(target,error){
  const code=error&&error.code?String(error.code):'erro desconhecido';
  const name=path.basename(String(target||''));
  return Error(message('err.notebook.launchFailed',{received:name,cause:code}));
 }
 async function launchOpen(command,args,target){
  let child;
  try{child=spawn(command,args,{detached:true,stdio:'ignore'});}catch(error){throw spawnRefusal(target,error);}
  if(!child||typeof child.on!=='function'){try{child?.unref?.();}catch{}return;}
  await /** @type {Promise<void>} */(new Promise((resolve,reject)=>{
   let settled=false;
   child.on('error',(error)=>{
    if(settled)return;
    settled=true;
    reject(spawnRefusal(target,error));
   });
   child.on('spawn',()=>{
    if(settled)return;
    settled=true;
    resolve();
   });
  }));
  try{child.unref?.();}catch{}
 }
 /* O renderer manda `{courseId, path, page}`: o caminho passa por realpath +
    `.xopp` + existência + contenção na matéria (sem prefixo enganoso) antes
    de ser autorizado e entregue ao programa de escrita. A `page` (1-based,
    do resultado da busca) vira `--page=N` quando há binário do Xournal++;
    sem ele, o shell abre o arquivo e a página fica de fora. A resolução do
    binário é a do `open-xournal` (`main.cjs`) e do `xournalVersion`
    (`components.cjs`): sem `xournalPath`, o `.app` padrão no macOS. */
 ipcMain.handle('notebooks-open',async(event,payload)=>{
   assertSender(event,'notebooks-open');
  const raw=payload&&typeof payload==='object'?payload:{};
  const courseId=typeof raw.courseId==='string'?raw.courseId:'';
  const given=typeof raw.path==='string'?raw.path:'';
  const page=Number.isInteger(raw.page)&&raw.page>0?raw.page:0;
  const base=path.basename(given);
  const course=(courses()||[]).find(item=>item.id===courseId);
  if(!course)throw Error(message('err.notebook.noCourse',{received:courseId||base}));
  let canonical;
  try{canonical=realpath(given);}catch{throw Error(message('err.notebook.missing',{received:base}));}
  if(!/\.xopp$/i.test(canonical))throw Error(message('err.notebook.notXopp',{received:base}));
  let rootReal;
  try{rootReal=realpath(course.path);}catch{throw Error(message('err.notebook.missing',{received:base}));}
  if(!isPathUnderRoot(canonical,rootReal,{caseSensitive}))throw Error(message('err.notebook.outsideCourse',{received:base}));
  const target=xournalTarget(config(),platform);
  const pageArgs=page?['-n',String(page)]:[];
  if(target&&platform==='darwin'&&target.endsWith('.app'))await launchOpen('open',['-a',target,...(page?['--args',...pageArgs]:[]),canonical],target);
  else if(target)await launchOpen(target,[...pageArgs,canonical],target);
  else{
   const error=await shell.openPath(canonical);
   if(error)throw Error(message('err.notebook.openFailed',{received:base}));
  }
  authorizeXopp(allowedXopp,canonical,realpath);
  return {ok:true,path:canonical};
 });
 return {...inkWatch,close:closeInk,stopInkConvert:closeInk,startInkConvert:startInk};
}
module.exports={registerNotebooksHost};
