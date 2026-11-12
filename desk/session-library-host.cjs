// @ts-check
'use strict';

const fs=require('node:fs');
const chatLibrary=require('./src/study-data/chat-library.cjs');
const chatState=require('./src/study-data/chat-state.cjs');
const {authorizeRestoredStudy}=require('./study.cjs');
const {message}=require('./src/i18n.mjs');
const {invalidRequest}=require('./src/error-detail.mjs');

/* Biblioteca de conversas e troca de sessão (#194: o main.cjs estava no teto
   de 800 linhas; saiu de lá sem mudar canal nem comportamento). O host lista
   só o que o main já autoriza (`courseSessions`, `courseStates` e o Livre),
   abre uma conversa da matéria, retoma uma conversa Livre (ou leva à matéria
   de destino quando ela foi promovida) e cria a sessão nova com a passagem
   opcional. A lista é SÓ leitura, sem iniciar agente nem escrever nada. */

/**
 * Cria o host da biblioteca de conversas e da navegação entre sessões sobre o
 * estado vivo do main. Devolve o registro dos canais e as duas funções que o
 * `study-host` reusa (lista autorizada e abertura dentro da navegação).
 * @param {{ipcMain: {handle: Function}, live: import('./main.cjs').DeskLive,
 *   runtime: string, FREE_ID: string, courseStates: Record<string, any>,
 *   courseSessions: () => Array<{path: string}>,
 *   freeSessionList: import('./types/main-hosts').FreeSessionHost['freeSessionList'],
 *   freeRecordForToken: import('./types/main-hosts').FreeSessionHost['freeRecordForToken'],
 *   isPromotedRecord: import('./types/main-hosts').FreeSessionHost['isPromotedRecord'],
 *   ensureFreeNativePath: import('./types/main-hosts').FreeSessionHost['ensureFreeNativePath'],
 *   hydrateFreeRecord: import('./types/main-hosts').FreeSessionHost['hydrateFreeRecord'],
 *   createFreeSession: import('./types/main-hosts').FreeSessionHost['createFreeSession'],
 *   sessionInfo: import('./types/main-hosts').TutorEngineHost['sessionInfo'],
 *   previewFile: import('./types/main-hosts').TutorEngineHost['previewFile'],
 *   visibleEngines: () => string[], defaultEngine: () => string,
 *   newSessionPath: import('./types/main-hosts').TutorEngineHost['newSessionPath'],
 *   sessionHandoff: {carryFor: (from: unknown, target: unknown, mode?: unknown) => object},
 *   withHostNav: (fn: () => Promise<any>) => Promise<any>,
 *   assertIdle: (reason: string) => Promise<void>,
 *   persist: (force?: boolean) => void, stopBridge: () => void,
 *   applyCourse: (id: string) => void, initialData: () => any,
 *   rememberSession: () => void, allowedXopp: Set<string>,
 *   t: (key: string, args?: Record<string, string | number>) => string}} deps
 * @returns {{register: () => void, libraryAuthorizedChats: () => Array<Record<string, any>>, openSessionWithinNav: (file: string) => Promise<any>}}
 * @example const sessionLibrary=createSessionLibraryHost({ipcMain,live,runtime,...});
 */
function createSessionLibraryHost({ipcMain,live,runtime,FREE_ID,courseStates,courseSessions,freeSessionList,freeRecordForToken,isPromotedRecord,ensureFreeNativePath,hydrateFreeRecord,createFreeSession,sessionInfo,previewFile,visibleEngines,defaultEngine,newSessionPath,sessionHandoff,withHostNav,assertIdle,persist,stopBridge,applyCourse,initialData,rememberSession,allowedXopp,t}){
 function libraryAuthorizedChats(){
  const rows=[],seen=new Set();
  const add=(item,id,name)=>{
   const file=item.path||item.session;if(!file)return;
   const key=JSON.stringify([id,file]);if(seen.has(key))return;seen.add(key);
   const info=sessionInfo(file);
   rows.push({...item,session:file,courseId:id,courseName:name,engine:info.engine||item.engine,
    preview:info.preview||item.preview||previewFile(file),title:item.title||'',current:id===live.courseId&&file===live.session});
  };
  for(const c of live.courses){
   const items=c.id===live.courseId?courseSessions():(courseStates[c.id]?.sessions||[]);
   for(const item of items)if(item.path&&(fs.existsSync(item.path)||(c.id===live.courseId&&item.path===live.session)))add(item,c.id,c.name);
  }
  for(const item of freeSessionList())if(!item.promoted)add({...item,title:item.label},FREE_ID,t('free.tab'));
  return rows;
 }
 async function openSessionWithinNav(file){
  if(typeof file!=='string'||!file)throw Error(invalidRequest('open-session','file',file,'string(1..)'));
  if(live.courseId===FREE_ID){
   const record=freeRecordForToken(file);
   if(!record)throw Error(message('err.session.notFound'));
   /* Conversa promovida não pode continuar em dois escopos: a lista do Livre
      continua mostrando o título, mas abrir leva para a matéria de destino. */
   if(isPromotedRecord(record)){
    const promoted=live.courses.find(c=>c.id===record.promotion.courseId);
    if(!promoted)throw Error(message('err.session.promotedMissing'));
    await assertIdle(message('err.idle.switchSession'));
    persist();stopBridge();applyCourse(promoted.id);persist();
    return initialData();
   }
   if(record.nativePath&&record.nativePath===live.session)return initialData();
   await assertIdle(message('err.idle.switchSession'));
   const target=record.nativePath?record:ensureFreeNativePath(record);
   persist();stopBridge();hydrateFreeRecord(target);live.lastContextKey='';allowedXopp.clear();persist();
   return initialData();
  }
  if(file===live.session)return initialData();
  const allowedSessions=courseSessions();
  if(!allowedSessions.some(s=>s.path===file))throw Error(message('err.session.notFound'));
  if(!fs.existsSync(file))throw Error(message('err.session.fileGone'));
  await assertIdle(message('err.idle.switchSession'));
  persist();rememberSession();stopBridge();live.session=file;live.lastContextKey='';allowedXopp.clear();
  live.state=chatState.restore(live.state,courseStates[live.courseId],file);
  live.state.study=authorizeRestoredStudy(live.state.study,allowedXopp);persist();
  return initialData();
 }
 function register(){
  ipcMain.handle('library-chats',()=>chatLibrary.list(runtime,libraryAuthorizedChats()));
  ipcMain.handle('library-chat-update',(_e,payload)=>chatLibrary.update(runtime,payload?.id,payload?.patch,libraryAuthorizedChats()));
  ipcMain.handle('library-chat-open',async(_e,id)=>withHostNav(async()=>{
   const target=chatLibrary.resolve(runtime,id,libraryAuthorizedChats());
   await assertIdle(message('err.idle.switchSession'));
   if(target.courseId!==live.courseId){persist();stopBridge();applyCourse(target.courseId);}
   return openSessionWithinNav(target.session);
  }));
  ipcMain.handle('new-session',async(_e,options={})=>withHostNav(async()=>{
   if(options.engine!=null&&!['claude','opencode'].includes(options.engine))throw Error(invalidRequest('new-session','engine',options.engine,'"claude"|"opencode"|null'));
   if(options.carryFrom!=null&&(typeof options.carryFrom!=='string'||!options.carryFrom))throw Error(invalidRequest('new-session','carryFrom',options.carryFrom,'string(1..)'));
   await assertIdle(message('err.idle.newSession'));
   /* Motor fora da vista cai no padrão (OpenCode); com passagem o motor é explícito. */
   const requested=options.engine||null, chosen=requested&&visibleEngines().includes(requested)?requested:defaultEngine();
   const carry=sessionHandoff.carryFor(options.carryFrom,requested,options.mode||'digest');
   if(live.courseId===FREE_ID){
    /* Conversa Livre nova: workspace/vazio próprio, caminho nativo único e caminho pelo seletor. */
    persist();stopBridge();createFreeSession(chosen,carry);
    live.lastContextKey='';allowedXopp.clear();live.state={...live.state,draft:'',study:{title:'',xopp:''}};persist();
    return initialData();
   }
   persist();rememberSession();stopBridge();
   live.session=newSessionPath(live.courseId,chosen,carry);live.lastContextKey='';live.state={...live.state,draft:'',study:{title:'',xopp:''}};persist();return initialData();
  }));
  ipcMain.handle('open-session',async(_e,file)=>withHostNav(()=>openSessionWithinNav(file)));
 }
 return {register,libraryAuthorizedChats,openSessionWithinNav};
}

module.exports={createSessionLibraryHost};
