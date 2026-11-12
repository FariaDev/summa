/* Visão do diário de trabalho do turno. A árvore vem do núcleo
   `core/worklogview.bend`; este arquivo só traduz o log em fatos, aplica no
   DOM (`view-host.mjs`), injeta os SVG e guarda o fold / o relógio.

   Fronteira (medida com `git show 33cf612:desk/src/worklog-view.mjs` × atual):
   o construtor imperativo antigo (article/head/rows passo a passo) não existe
   mais — virou a árvore do núcleo. O que fica no host é: a âncora estável do
   aplicador (o `article.work` do próprio núcleo, atualizado por `patchTree`
   desde a #70 para não piscar a cada token), o relógio de 1 s, o fold
   (`openIds`/`touched`), `atBottom`/`followBottom`, os fatos de `worklog.mjs`
   e os SVG de `icons.mjs` injetados por `innerHTML` em `fillIcons`. */
import {icon} from '../icons.mjs';
import {applyChatScroll,distanceFromEnd} from './state.mjs';
import {build,patchTree,preserveFocus} from './view-host.mjs';
import core from './generated/worklogview.core.js';
import {t} from './ui-text.mjs';
import {STEP,formatDuration,headLine,isPdfRead,liveLabel as liveLabelBase,runningStep,stepDetail,stepDuration,stepLabel as stepLabelBase,stepPreview,toolTarget} from './worklog.mjs';
import {shouldStartOpen} from './worklog-head.mjs';
import {VIEW_KIND_CORE,VIEW_STATUS_CORE} from './worklog-tags.mjs';
import {thinkingMarkMarkup} from './thinking-mark.mjs';

const STEP_ICON={
 [STEP.THINKING]:'sparkles',[STEP.SEARCH]:'search',[STEP.MATERIAL]:'book',[STEP.REFERENCE]:'book',
 [STEP.FETCH]:'globe',[STEP.TOOL]:'wrench',[STEP.ERROR]:'alert',
};

/* N14 (#135): a leitura de caderno/PDF usa o livro (como MATERIAL/REFERENCE);
   as outras ferramentas seguem com a chave. */
const READ_TOOLS=new Set(['ler_caderno','ler_pdf']);

function stepIcon(step){
 if(READ_TOOLS.has(toolId(step?.toolName)))return 'book';
 return STEP_ICON[step?.kind]||'';
}

/* Construtores do `worklog.bend` como a view os vê (ver `worklog-tags.mjs`). */
const KIND_CORE=VIEW_KIND_CORE;
const STATUS_CORE=VIEW_STATUS_CORE;

function domainOf(url){
 try{return new URL(String(url||'')).hostname.replace(/^www\./,'');}catch{return '';}
}

function listOf(items){
 let out={$:'Nil'};
 for(let i=items.length-1;i>=0;i--)out={$:'Con',head:items[i],tail:out};
 return out;
}

function stepLinks(step){
 const links=[...(step.results||[])];
 if(step.kind===STEP.FETCH&&!links.length&&step.url)links.push({title:step.pageTitle||step.url,url:step.url});
 return links.map(item=>{
  const url=String(item.url||'');
  return {$:'LinkRow',title:String(item.title||item.url||''),url:url||'#',domain:url?domainOf(url):''};
 });
}

/* Rótulos do diário (#135). O catálogo de idioma é a fonte única dos nomes de
   exibição das ferramentas da Mesa; o id técnico (`mesa_ler_caderno`) fica só
   no bloco técnico do passo (F8/F10/F11). */
function toolId(name){
 const raw=String(name||'').trim();
 const match=/^mcp__mesa__(.+)$/.exec(raw)||/^mesa_(.+)$/.exec(raw);
 return match?match[1]:raw;
}

function toolDisplayName(name){
 const id=toolId(name);
 if(!id)return '';
 const key=`work.tool.${id}`;
 const label=t(key);
 return label===key?'':label;
}

function toolFile(step){
 const raw=String(step?.args?.caminho??'');
 const cut=Math.max(raw.lastIndexOf('/'),raw.lastIndexOf('\\'));
 return cut>=0?raw.slice(cut+1):raw;
}

function notebookText(step,key){
 const file=toolFile(step);
 const page=Number(step?.args?.pagina);
 if(!file||!Number.isInteger(page)||page<1)return '';
 return t(key,{file,page});
}

function liveLabel(step){
 if(toolId(step?.toolName)==='ler_caderno'){
  const notebook=notebookText(step,'work.live.notebookTarget');
  if(notebook)return notebook;
 }
 const display=toolDisplayName(step?.toolName);
 if(display)return t('work.live.toolDisplay',{tool:display});
 return liveLabelBase(step);
}

/* A cabeça do turno vivo resume sem o alvo do passo, para as duas linhas não
   repetirem a mesma frase (#135 F25). */
function liveHead(step){
 if(!step)return '';
 if(step.kind===STEP.SEARCH)return t('work.live.searchNoQuery');
 if(step.kind===STEP.MATERIAL)return t('work.live.materialNoQuery');
 if(step.kind===STEP.REFERENCE)return t('work.live.referenceNoQuery');
 if(step.kind===STEP.TOOL){
  if(toolId(step.toolName)==='ler_caderno')return t('work.live.notebookHead');
  const display=toolDisplayName(step.toolName);
  if(display)return t('work.live.toolDisplay',{tool:display});
 }
 return liveLabelBase(step);
}

function stepLabel(step){
 if(toolId(step?.toolName)==='ler_caderno'){
  const notebook=notebookText(step,'work.step.notebook');
  if(notebook)return notebook;
 }
 const display=toolDisplayName(step?.toolName);
 if(display)return t('work.step.toolDisplay',{tool:display});
 return stepLabelBase(step);
}

/* Nome acessível do passo: o rótulo curto, sem o JSON/caminho do detalhe
   (#135 F11). */
function stepAriaLabel(step){
 return step?.status==='running'?liveLabel(step):stepLabel(step);
}

/* Texto humano do detalhe; o JSON dos argumentos fica em `stepTech` e a visão
   o pinta em monoespaçada (F8). */
function stepText(step){
 if(step?.kind!==STEP.TOOL)return stepDetail(step);
 if(step.error)return String(step.error||'').trim();
 if(toolId(step.toolName)==='ler_caderno')return notebookText(step,'work.step.notebook')||stepDetail(step);
 return stepDetail(step);
}

/* N9 (#135): quando o corpo é igual ao rótulo, o detalhe mostra só o bloco
   técnico — repetir a mesma frase no toggle e no corpo não informa nada. */
function stepBody(step){
 const text=stepText(step);
 if(!text)return '';
 const label=step?.status==='running'?liveLabel(step):stepLabel(step);
 return text===label?'':text;
}

function stepTech(step){
 if(step?.kind!==STEP.TOOL)return '';
 const args=step.args||{};
 if(!Object.keys(args).length)return '';
 return t('work.step.input',{args:JSON.stringify(args).slice(0,600)});
}

/* F12 (#135): a cabeça vira falha quando a ferramenta era a única do turno e
   falhou; erro avulso é interrupção, não ferramenta. */
function failedHeadStep(log){
 if(String(log?.reason||''))return null;
 const tools=(log?.steps||[]).filter(step=>step&&step.kind!==STEP.THINKING&&step.kind!==STEP.ERROR);
 if(!tools.length||tools.some(step=>step.status==='done'))return null;
 return tools.find(step=>step.status==='error')||null;
}

function headLineFor(log){
 const failed=failedHeadStep(log);
 if(failed)return t(toolId(failed.toolName)==='ler_caderno'?'work.head.failedNotebook':'work.head.failed');
 return headLine(log);
}
/* Linha de leitura de PDF (etapa 4): nome técnico, alvo e duração numa linha.
   Pensamento, busca, página e erro continuam com a apresentação e os rótulos
   de sempre — a peça aprovada é a leitura. */
function isToolRow(step){
 return !!step&&step.kind!==STEP.THINKING&&step.kind!==STEP.ERROR&&isPdfRead(step);
}

export function workRowFrom(log,{live=false,expanded=true,note='',now=Date.now(),openIds=new Set()}={}){
 const current=live?runningStep(log):null;
 const title=live?(current?liveHead(current):(note||t('work.live.idle'))):headLineFor(log);
 const meta=live?formatDuration(now-(log.startedAt||now)):'';
 const steps=(log.steps||[]).map(step=>{
  const running=step.status==='running';
  const links=stepLinks(step);
  const label=running?liveLabel(step):stepLabel(step);
  const text=stepBody(step);
  const tech=stepTech(step);
  const row=isToolRow(step);
  const preview=row?toolTarget(step):(running?stepPreview(step):'');
  const hasDetail=!!(links.length||text||tech);
  const open=hasDetail&&openIds.has(step.id);
  return {
   $:'StepRow',id:String(step.id||''),
   kind:KIND_CORE[step.kind]||KIND_CORE.tool,
   status:STATUS_CORE[step.status]||STATUS_CORE.running,
   open,hasDetail,label:row?toolDisplayName(step.toolName):label,
   preview,text,links:listOf(links),
  };
 });
 return {$:'WorkRow',live:!!live,expanded:!!expanded,title,meta,steps:listOf(steps)};
}

/* Cada slot de ícone guarda o nome do que mostra (`data-slot-icon`): no patch,
   slot com o mesmo nome fica como está, e a ∫ do "pensando" não recomeça a
   animação a cada token (#70). */
function fillSlot(slot,name,markup){
 slot.dataset.slotIcon=name;
 slot.innerHTML=markup;
}
const sameIconSlot=(live,fresh)=>!!fresh.dataset.slotIcon&&live.dataset.slotIcon===fresh.dataset.slotIcon;

/* O alvo da linha de ferramenta não é o "preview" do pensamento: fica à vista
   também com o passo aberto, e a duração vai à direita. Tudo no DOM recém-
   montado, antes do patch — o núcleo continua dono da forma. */
function decorateToolRow(node,step){
 node.dataset.row='tool';
 const line=node.querySelector('.step-line');
 const preview=node.querySelector('.step-preview');
 if(preview){
  preview.hidden=false;
  if(line&&preview.parentElement!==line)line.append(preview);
 }
 const duration=stepDuration(step);
 let stamp=line?.querySelector('.step-duration');
 if(duration){
  if(!stamp&&line){stamp=document.createElement('span');stamp.className='step-duration';line.append(stamp);}
  if(stamp)stamp.textContent=duration;
 }else stamp?.remove();
 const status=node.querySelector('.step-status');
 if(step.status!=='running'&&status)status.hidden=true;
}

function attrOf(node,name){
 for(let cur=node?.attrs;cur&&cur.$==='Con';cur=cur.tail){
  if(cur.head?.name===name)return String(cur.head.value??'');
 }
 return '';
}
function withAttr(node,name,value){
 node.attrs={$:'Con',head:{$:'ViewAttr',name,value:String(value)},tail:node.attrs||{$:'Nil'}};
}
function kidsOf(node){
 const out=[];
 for(let cur=node?.kids;cur&&cur.$==='Con';cur=cur.tail)out.push(cur.head);
 return out;
}
function withClass(tag,className,text){
 return {$:'ViewEl',tag,attrs:listOf([{$:'ViewAttr',name:'class',value:className}]),kids:listOf([{$:'ViewText',text:String(text)}])};
}
function hasClass(node,name){
 return attrOf(node,'class').split(/\s+/).includes(name);
}
function findClass(node,name){
 if(!node||node.$!=='ViewEl')return null;
 if(hasClass(node,name))return node;
 for(const kid of kidsOf(node)){
  const found=findClass(kid,name);
  if(found)return found;
 }
 return null;
}
function appendKid(node,kid){
 const cell={$:'Con',head:kid,tail:{$:'Nil'}};
 if(!node.kids||node.kids.$==='Nil'){node.kids=cell;return;}
 let cur=node.kids;
 while(cur.tail&&cur.tail.$==='Con')cur=cur.tail;
 cur.tail=cell;
}

/* O núcleo não emite `aria-label` no toggle nem o bloco técnico; o host decora
   a árvore porque o artefato é gerado. O nome acessível é o rótulo curto; o
   JSON cru fica num `.step-tech` monoespaçado, fora do nome (#135 F8/F11). */
function decorateWorkTree(tree,log){
 const labels=new Map(),techs=new Map();
 for(const step of log?.steps||[]){
  const id=String(step?.id??'');
  if(!id)continue;
  labels.set(id,stepAriaLabel(step));
  const tech=stepTech(step);
  if(tech)techs.set(id,tech);
 }
 const visit=node=>{
  if(!node||node.$!=='ViewEl')return;
  if(hasClass(node,'work-step')){
   const id=attrOf(node,'key');
   const toggle=findClass(node,'step-toggle');
   if(toggle&&labels.has(id))withAttr(toggle,'aria-label',labels.get(id));
   const detail=findClass(node,'step-detail');
   if(detail&&techs.has(id)){
    appendKid(detail,withClass('div','step-tech-label',t('work.step.technical')));
    appendKid(detail,withClass('pre','step-tech',techs.get(id)));
   }
  }
  for(const kid of kidsOf(node))visit(kid);
 };
 visit(tree);
 return tree;
}

/* A opção K do "pensando" (docs/design/marca/movimento.html, 2026-11-11): a
   integral e o texto formam uma peça só, para o brilho do CSS atravessar os
   dois. O host agrupa porque a árvore do `core/worklogview.bend` é gerada. */
function groupThinkingMark(mark){
 const title=mark.parentElement?.querySelector(':scope > .work-title');
 if(!title)return;
 const shine=document.createElement('span');
 shine.className='work-shine';
 mark.before(shine);
 shine.append(mark,title);
}

function fillIcons(root,log,live){
 const stepIcons=new Map();
 for(const step of log?.steps||[])stepIcons.set(String(step?.id??''),stepIcon(step));
 const mark=root.querySelector('.work-mark');
 if(mark){
  if(live){
   const current=runningStep(log);
   /* Pensando (ou ainda sem passo): a integral parada ao lado do texto, e o
      brilho do CSS atravessa as duas (opção K, 2026-11-11). Busca, leitura e
      ferramenta seguem com o ícone do passo. */
   const thinking=!current||current.kind===STEP.THINKING;
   mark.dataset.lamp=thinking?'thinking':'';
   const name=thinking?'thinking-integral':stepIcon(current)||'sparkles';
   fillSlot(mark,name,thinking?thinkingMarkMarkup():icon(name));
   if(thinking)groupThinkingMark(mark);
  }else{
   const failed=!!log?.reason||(log?.steps||[]).some(step=>step.status==='error');
   fillSlot(mark,failed?'alert':'check',icon(failed?'alert':'check'));
  }
 }
 const chevron=root.querySelector('.work-chevron');
 if(chevron)fillSlot(chevron,'chevronDown',icon('chevronDown'));
 for(const node of root.querySelectorAll('.work-step')){
  const step=(log?.steps||[]).find(item=>String(item.id||'')===String(node.dataset.key||''));
  const row=isToolRow(step);
  if(row)decorateToolRow(node,step);
  const iconEl=node.querySelector('.step-icon');
  const kindIcon=stepIcons.get(node.dataset.key)||STEP_ICON[node.dataset.kind]||'wrench';
  const statusIcon=node.dataset.status==='error'?'alert':node.dataset.status==='stopped'?'stop':'check';
  /* Na linha de ferramenta o ✓ (ou o alerta) fica à esquerda, como no
     protótipo; correndo, o ícone é o do tipo e o spinner fica à direita. */
  const rowIcon=row&&node.dataset.status==='error'?statusIcon:kindIcon;
  if(iconEl)fillSlot(iconEl,rowIcon,icon(rowIcon));
  if(node.dataset.status==='running')continue;
  if(row)continue;
  const status=node.querySelector('.step-status');
  if(status)fillSlot(status,statusIcon,icon(statusIcon));
 }
 if(!live&&failedHeadStep(log))root.dataset.failed='true';
 else delete root.dataset.failed;
}

export function createWorkLogView(){
 /* A âncora (`article.work[data-live][data-expanded]`) é o nó do próprio
    `core/worklogview.bend`: o host não repete a forma (classe/data-*) — só
    troca os filhos a cada render. Os SVG de `icons.mjs` seguem sendo asset do
    host, re-injetados por `fillIcons` (mesma convenção de `pdf.mjs`/`calc.mjs`). */
 const root=build(core.workLog(workRowFrom({steps:[]},{live:true,expanded:true})));

 const openIds=new Set();
 let log=null,live=false,timer=0,touched=false,expanded=true,note='',stepSeeded=false;

 const handlers={
  toggleWork(){
   touched=true;
   expanded=root.dataset.expanded!=='true';
   paint();
  },
  toggleStep(event){
   const row=event.currentTarget.closest('.work-step');
   if(!row||row.dataset.detail!=='true')return;
   const id=row.dataset.key;
   if(!id)return;
   if(openIds.has(id))openIds.delete(id);else openIds.add(id);
   paint();
  },
 };

 function paint(now=Date.now()){
  if(!log)return;
  /* Fora do documento (lote de histórico) a medida forçaria layout à toa. */
  const connected=root.isConnected;
  const distance=connected?distanceFromEnd():0;
  const fresh=build(decorateWorkTree(core.workLog(workRowFrom(log,{live,expanded,note,now,openIds})),log),handlers);
  fillIcons(fresh,log,live);
  preserveFocus(root,()=>patchTree(root,fresh,sameIconSlot));
  for(const s of log?.steps||[])if(s.resultMarker)root.querySelector(`.work-step[data-key="${CSS.escape(s.id)}"]`)?.setAttribute('data-history-media-output',s.resultMarker.id);
  if(connected)applyChatScroll('stream',null,distance);
 }

 function stopTimer(){if(timer){clearInterval(timer);timer=0;}}
 /* O tick de 1s só mexe no relógio da cabeça; um `paint()` inteiro aqui
    trocaria os nós vivos e derrubaria seleção/rolagem do detalhe aberto. O
    passo não tem mais horário próprio (#90). */
 function tick(){
  if(!live||!root.isConnected){stopTimer();return;}
  const distance=distanceFromEnd();
  const now=Date.now();
  const meta=root.querySelector('.work-meta');
  if(meta)meta.textContent=formatDuration(now-(log.startedAt||now));
  applyChatScroll('stream',null,distance);
 }
 function ensureTimer(){
  if(timer||!live)return;
  timer=setInterval(tick,1000);
 }

 function render(nextLog,{live:isLive=false,note:nextNote='',hasAnswer=false,isFreeLimit=false}={}){
  log=nextLog;
  const wasLive=live;
  live=!!isLive;
  note=nextNote;
  if(live){
   if(!wasLive&&!touched)expanded=true;
   ensureTimer();
  }else{
   stopTimer();
   /* E3: interrompido com motivo e sem resposta começa aberto; com resposta
      parcial ou no 429 (aviso próprio) segue recolhido. Só a dobra inicial:
      com `touched` o clique do aluno manda nas repinturas. */
   if(!touched){
    expanded=shouldStartOpen(log,{hasAnswer,isFreeLimit});
    /* O motivo mora no detalhe do passo de erro: sem abrir o passo, abrir o
       diário não mostra nada e o conserto vira um clique a mais. Nasce
       aberto uma vez só por visão (`stepSeeded`); o clique do aluno no
       passo manda daí em diante, sem a repintura desfazer. */
    if(expanded&&!stepSeeded){
     stepSeeded=true;
     for(const step of log?.steps||[])if(step?.status==='error'&&String(step.id||''))openIds.add(String(step.id));
    }
   }
  }
  for(const id of [...openIds]){
   const step=(log.steps||[]).find(item=>item.id===id);
   const links=step?stepLinks(step):[];
   const text=step?stepBody(step):'';
   const tech=step?stepTech(step):'';
   if(!step||!(links.length||text||tech))openIds.delete(id);
  }
  paint();
 }

 function destroy(){
  stopTimer();
  root.remove();
 }

 return {el:root,render,destroy};
}
