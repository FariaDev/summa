// @ts-check
import {S,toast} from './state.mjs';
import {createFreeLimitNote} from './free-limit-notice.mjs';
import {groupModels,modelKey} from './model-picker.mjs';
import {t as uiT,text as uiText} from './ui-text.mjs';
import {message as uiMessage} from './i18n.mjs';

/* O aviso do limite do grátis no chat lateral (#144). O aviso é o MESMO
   componente do tutor (`free-limit-notice.mjs`); este módulo só monta o dele
   na área do lateral e dá a saída de quem já tem conta: a lista de modelos do
   catálogo do motor, aplicada SÓ à sessão lateral (`sidechat-set-model`), sem
   tocar no modelo do tutor. O estado e o bridge continuam em `sidechat.mjs` e
   entram por parâmetro, como nos outros módulos do lateral. */

/**
 * Cria o aviso do limite do grátis do chat lateral, com a troca de modelo da
 * própria sessão lateral.
 * @param {{state: {id: string, model: string, engine: string}, api: () => any, root: () => HTMLElement|null}} deps
 * @returns {{hide: () => void, paint: () => Promise<void>, repaint: () => void}}
 * @example const freeLimit = createSidechatFreeLimit({state, api: () => window.desk, root: () => document.querySelector('#sidechat')});
 */
export function createSidechatFreeLimit({state,api,root}){
 let run=0;
 const note=createFreeLimitNote({
  id:'sidechat-free-limit-note',
  doc:()=>root()?.ownerDocument||document,
  mount:el=>{
   const host=root();
   const activity=host?.querySelector('#sidechat-activity');
   if(activity?.parentNode)activity.after(el);
   else host?.querySelector('#sidechat-composer')?.before(el);
   if(!el.parentNode)host?.append(el);
  },
  pickModel:el=>openModelPicker(el),
  hideOnPick:false
 });

 function hide(){
  run++;
  note.hide();
  const select=/** @type {HTMLElement|null} */ (root()?.querySelector('#sidechat-free-limit-note .free-limit-models'));
  if(select)select.hidden=true;
 }

 async function paint(){
  const current=++run;
  const session=state.id;
  let saved=false;
  try{saved=!!(await window.desk.opencodeStatus())?.saved;}catch{/* sem conta legível: vale como sem chave */}
  if(current!==run||state.id!==session)return;
  note.show({saved});
 }

 /* `provider/id` do descritor → a chave `["provider","id"]` do seletor. */
 function chosenModelKey(){
  const model=String(state.model||''),at=model.indexOf('/');
  return at>0?modelKey(model.slice(0,at),model.slice(at+1)):'';
 }

 function modelOptions(doc){
  const catalog=Array.isArray(S.modelCatalog)?S.modelCatalog:[];
  const groups=groupModels(catalog,{engine:state.engine||S.engine,label:uiText});
  const boxes=[];
  for(const group of groups){
   if(group.kind!=='provider'||!group.items.length)continue;
   const box=doc.createElement('optgroup');
   box.label=group.title;
   for(const item of group.items){
    const option=doc.createElement('option');
    option.value=item.key;
    option.textContent=item.name;
    box.append(option);
   }
   boxes.push(box);
  }
  return boxes;
 }

 function openModelPicker(el){
  const doc=el.ownerDocument||document;
  let select=el.querySelector('.free-limit-models');
  if(!select){
   select=doc.createElement('select');
   select.className='free-limit-models';
   select.setAttribute('aria-label',uiT('freeLimit.pickModel'));
   select.addEventListener('change',()=>applyModel(select));
   el.append(select);
  }
  const boxes=modelOptions(doc);
  if(!boxes.length){toast(uiT('sidechat.err.unknown'));return;}
  select.replaceChildren(...boxes);
  select.value=chosenModelKey();
  select.hidden=false;
  select.focus();
 }

 async function applyModel(select){
  if(!state.id||!select.value)return;
  let pick;
  try{pick=JSON.parse(select.value);}catch{return;}
  if(typeof api()?.sidechatSetModel!=='function'){toast(uiMessage('sidechat.err.bridge'));return;}
  const [provider,id]=pick;
  select.disabled=true;
  try{
   const payload=await api().sidechatSetModel({id:state.id,model:{provider,id}});
   state.model=String(payload?.model||`${provider}/${id}`);
   hide();
  }catch(error){
   toast(error.message);
   select.value=chosenModelKey();
  }finally{
   select.disabled=false;
  }
 }

 return {hide,paint,repaint:()=>note.repaint()};
}
