/* Rascunho do chat lateral (#43 fase 2: saiu de sidechat.mjs para caber no
   teto). O estado e o bridge continuam no sidechat; entram por parâmetro, com
   o campo de texto e o repaint do Enviar lidos na hora (só existem depois do
   mount). */

const DRAFT_KEY='mesa.sidechat.draft';
/* Metadados do espelho local (mesmo escopo da chave antiga): `rev`/`dirty`/`id`.
   O TEXTO continua na chave `mesa.sidechat.draft.<matéria>.<sessão>` como
   string simples (leitura por versões anteriores/testes); a chave nova só
   marca se aquele texto é mais novo que o host e ainda não foi confirmado. */
const DRAFT_META_KEY='mesa.sidechat.draftmeta';
const DRAFT_SAVE_MS=400;

/**
 * Cria o espelho local do rascunho, o save debounced no host e a restauração
 * na abertura do chat lateral.
 * @param {{state:{id:string,draft:string,scope:{courseId:string,session:string}|null},api:()=>any,available:()=>boolean,scopeOf:()=>{courseId:string,session:string},promptEl:()=>HTMLTextAreaElement|null,paintSend:()=>void}} deps
 * @returns {{onDraftInput:()=>void,saveDraftNow:()=>void,clearLocalDraft:(scope?:{courseId:string,session:string})=>void,restoreDraft:(payloadDraft:unknown,useLocal?:boolean)=>void,mirrorDraft:(text:unknown,options?:{dirty?:boolean,id?:string,scope?:{courseId:string,session:string}|null})=>object}}
 * @example const drafts=createSidechatDraft({state,api:()=>window.desk,available:()=>true,scopeOf,promptEl:()=>el,paintSend(){}});
 */
export function createSidechatDraft({state,api,available,scopeOf,promptEl,paintSend}){
 let draftTimer=0;
 /* Os saves são serializados: o save do clique (''/B) não pode ultrapassar o
    save do debounce seguinte e ressuscitar A numa reabertura. */
 let saveChain=Promise.resolve();
 function draftKey(scope=state.scope||scopeOf()){
  const course=String(scope?.courseId||''),session=String(scope?.session||'');
  return `${DRAFT_KEY}.${encodeURIComponent(course)}.${encodeURIComponent(session)}`;
 }
 function draftMetaKey(scope=state.scope||scopeOf()){
  const course=String(scope?.courseId||''),session=String(scope?.session||'');
  return `${DRAFT_META_KEY}.${encodeURIComponent(course)}.${encodeURIComponent(session)}`;
 }
 function readLocalDraft(scope){
  try{return localStorage.getItem(draftKey(scope));}catch{return null;}
 }
 function readDraftMeta(scope){
  try{
   const raw=localStorage.getItem(draftMetaKey(scope));
   if(!raw)return null;
   const meta=JSON.parse(raw);
   return meta&&typeof meta==='object'?meta:null;
  }catch{return null;}
 }
 function writeDraftMeta(scope,meta){try{localStorage.setItem(draftMetaKey(scope),JSON.stringify(meta));}catch{}}
 /* Registro local do escopo: texto (chave antiga, string) + metadados. Sem
    metadados é espelho LEGADO (gravado por versão anterior): só vale se o host
    não tiver rascunho, como antes. O `rev` é local e monotônico. */
 function draftRecord(scope){
  const text=readLocalDraft(scope),meta=readDraftMeta(scope);
  if(text===null&&!meta)return null;
  return {text:text===null?'':String(text),meta};
 }
 let draftRev=0;
 function mirrorDraft(text,{dirty=true,id=state.id,scope=null}={}){
  const target=scope||state.scope||scopeOf();
  const value=String(text??'');
  try{localStorage.setItem(draftKey(target),value);}catch{}
  const meta={rev:++draftRev,dirty:!!dirty,id:String(id||'')};
  writeDraftMeta(target,meta);
  return meta;
 }
 function clearLocalDraft(scope){
  try{localStorage.removeItem(draftKey(scope));}catch{}
  try{localStorage.removeItem(draftMetaKey(scope));}catch{}
 }
 function onDraftInput(){
  state.draft=promptEl()?.value||'';
  paintSend();
  mirrorDraft(state.draft,{scope:state.scope});
  clearTimeout(draftTimer);
  draftTimer=setTimeout(saveDraftNow,DRAFT_SAVE_MS);
 }
 /* Confirma o save SÓ quando ele ainda corresponde ao registro local (valor,
    revisão e id): o ACK de um save antigo não pode limpar o `dirty` de um input
    novo. Um erro mantém o `dirty` (o texto só existe localmente; a restauração
    reagenda o save). */
 function ackDraftSave({id,draft,scope,rev}){
  const record=draftRecord(scope);
  if(!record?.meta?.dirty)return;
  if(rev!==null&&rev!==undefined&&Number(record.meta.rev)!==Number(rev))return;
  if(String(record.text)!==String(draft))return;
  if(record.meta.id&&id&&String(record.meta.id)!==String(id))return;
  writeDraftMeta(scope,{...record.meta,dirty:false,id:String(id||record.meta.id||'')});
 }
 function saveDraftNow(){
  clearTimeout(draftTimer);draftTimer=0;
  if(!state.id||!available())return;
  const id=state.id,draft=state.draft,scope=state.scope||scopeOf();
  const record=draftRecord(scope);
  const rev=record?.meta&&Number.isFinite(Number(record.meta.rev))?Number(record.meta.rev):null;
  const save=()=>{
   let pending;
   try{pending=api()?.sidechatSave?.({id,draft});}catch{return;}
   if(pending?.then)return pending.then(()=>ackDraftSave({id,draft,scope,rev}),()=>{});
   ackDraftSave({id,draft,scope,rev});
  };
  saveChain=saveChain.then(save,save);
 }
 /* O host é a fonte quando o espelho está limpo (ou ausente). Um espelho DIRTY
    (gravado a cada tecla, ainda não confirmado) é mais novo que o payload do
    host — vale mesmo VAZIO (campo limpo de propósito) — até o ACK do save
    correspondente; a restauração reagenda esse save se o reload cortou o
    debounce. `useLocal:false` (fresh) começa VAZIO mesmo com espelho antigo do
    mesmo escopo (chat novo não ressuscita o anterior). */
 function restoreDraft(payloadDraft,useLocal=true){
  const payloadText=String(payloadDraft??'');
  const record=useLocal?draftRecord(state.scope):null;
  const localText=record?record.text:'';
  const dirty=record?.meta?.dirty===true;
  const sameId=!record?.meta||!record.meta.id||!state.id||String(record.meta.id)===String(state.id);
  const legacy=!!record&&!record.meta&&localText!=='';
  const preferLocal=(dirty&&sameId)||(legacy&&!payloadText);
  state.draft=preferLocal?localText:payloadText;
  const field=promptEl();
  if(field)field.value=state.draft;
  if(!preferLocal)return;
  if(localText!==payloadText){
   mirrorDraft(localText,{dirty:true,id:state.id,scope:state.scope});
   saveDraftNow();
  }else if(dirty&&sameId){
   /* O save já chegou ao host antes do reload; só falta marcar o espelho. */
   writeDraftMeta(state.scope,{...record.meta,dirty:false,id:String(state.id||record.meta.id||'')});
  }
 }
 return {onDraftInput,saveDraftNow,clearLocalDraft,restoreDraft,mirrorDraft};
}
