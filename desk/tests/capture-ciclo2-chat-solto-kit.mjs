// node tests/capture-ciclo2-chat-solto-kit.mjs — utilidades das capturas do
// ciclo 2 de UI/UX, parte "Chat solto" (#157): janela própria, faixa "Chat em
// outra janela" e o chat preso na Mesa. Cada PNG sai com um JSON de medidas ao
// lado (cor de texto, fundo efetivo e contraste WCAG; fonte/peso/line-height;
// alvos clicáveis; foco com outline/box-shadow; rótulos acessíveis). Dados
// sintéticos e `fake-opencode`, nunca material de curso. Fora do `npm run ui`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {newRuntime,seedCourse,writeConfigJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,tinyPdf} from './helpers.mjs';
import {layoutStable,nextFrames,pollUntil} from './waits.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT=path.resolve(HERE,'..','..');

/** Pasta das capturas: `--out <dir>`, `CICLO2_OUT` ou o destino versionado.
 * @param {string[]} [argv] @param {NodeJS.ProcessEnv} [env]
 * @returns {string} caminho absoluto criado
 * @example captureOutDir(); // <repo>/docs/design-loop/rodada-2/antes/chat-solto */
export function captureOutDir(argv=process.argv.slice(2),env=process.env){
 const flag=argv.indexOf('--out');
 const raw=flag>=0?argv[flag+1]:env.CICLO2_OUT;
 const dir=raw?path.resolve(raw):path.join(REPO_ROOT,'docs','design-loop','rodada-2','antes','chat-solto');
 fs.mkdirSync(dir,{recursive:true});
 return dir;
}

/** Limpa PNG/JSON da rodada anterior para a pasta refletir só esta execução.
 * @param {string} dir @returns {number} arquivos removidos */
export function cleanOutDir(dir){
 let removed=0;
 for(const name of fs.readdirSync(dir)){
  if(/\.(png|json)$/i.test(name)){fs.rmSync(path.join(dir,name),{force:true});removed++;}
 }
 return removed;
}

/** Redimensiona como os testes de janela, mas registra o tamanho REAL obtido
 * quando o Electron/X11 recusa o pedido (a tela é 1366×768). */
export async function fitWindow(app,page,width,height){
 let error='';
 try{await resizeWindow(app,page,width,height);}
 catch(failure){error=String(failure?.message||failure).split('\n')[0];}
 const actual=await page.evaluate(()=>({innerWidth,innerHeight,outerWidth,outerHeight,screenWidth:screen.width,screenHeight:screen.height,devicePixelRatio}));
 await layoutStable(page,'body',{timeout:8000}).catch(()=>{});
 return {requested:{width,height},actual,fallback:!!error,error};
}

/** Matéria sintética com dois leitores (limites e formulário) e o fake do motor. */
export async function bootCourse(tag,{two=true,env={}}={}){
 const runtime=newRuntime(tag);
 const course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf(['Lista 2 - Limites','5. lim x->2 (x^2 - 4)/(x - 2)','6. lim x->0 sen(3x)/x'],4));
 if(two)fs.writeFileSync(path.join(course,'Formulario.pdf'),tinyPdf(['Formulario','lim sen x / x = 1'],2));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk:{pinnedExtensions:false}});
 const app=await launchDesk({runtime,env});
 const page=await app.firstWindow();
 const size=await fitWindow(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 return {runtime,course,app,page,size};
}

/** Abre o chat lateral e espera o campo aceitar envio (sem aviso de sistema). */
export async function openSidechat(page){
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>{
  const el=document.querySelector('#sidechat');
  const prompt=document.querySelector('#sidechat-prompt');
  return !!el&&!el.hidden&&el.getBoundingClientRect().width>0&&!!prompt&&!prompt.disabled&&!document.querySelector('#sidechat-messages .sidechat-msg.system');
 },undefined,{timeout:20000});
 await layoutStable(page,'#sidechat',{timeout:10000}).catch(()=>{});
}

/** Envia pelo campo do lateral, como a pessoa (Enter). */
export async function sendSidechat(page,text){
 await page.locator('#sidechat-prompt').fill(text);
 await page.locator('#sidechat-prompt').press('Enter');
}

export function waitAssistant(page,{min=20}={}){
 return page.waitForFunction(limit=>[...document.querySelectorAll('#sidechat-messages .sidechat-msg.assistant .sidechat-body')].some(el=>(el.textContent||'').trim().length>limit),min,{timeout:40000});
}
export function waitCard(page){
 return page.waitForSelector('#sidechat-messages .quiz-card .quiz-option',{timeout:40000});
}

/** Solta o chat na janela filha (Playwright enxerga a filha em `app.windows()`). */
export async function detachSidechat(page,app){
 const opened=app.waitForEvent('window',{timeout:15000});
 await page.locator('#sidechat-more').click();
 await page.locator('#sidechat-detach').click();
 const child=await opened;
 await child.waitForSelector('#sidechat',{timeout:15000});
 await child.locator('#sidechat').waitFor({state:'visible'});
 await freezeMotion(child);
 return child;
}

/** Traz de volta pelo menu da própria filha e espera o nó na Mesa. */
export async function attachSidechat(child,page){
 const closed=new Promise(done=>child.once('close',done));
 await child.locator('#sidechat-more').click();
 await child.locator('#sidechat-detach').click();
 await closed.catch(()=>{});
 await page.waitForFunction(()=>{
  const el=document.querySelector('#sidechat');
  return !!el&&!el.hidden&&el.getBoundingClientRect().width>0;
 },undefined,{timeout:15000});
}

/** Tema na Mesa e, quando há filha, o mesmo tema lá dentro. */
export async function applyTheme(page,child,theme){
 await setTheme(page,theme);
 await pollUntil(()=>page.evaluate(()=>document.documentElement.dataset.theme||'auto'),value=>value===theme,{timeout:10000,interval:100,what:`o tema ${theme} na Mesa`});
 if(child){
  await pollUntil(()=>child.evaluate(()=>document.documentElement.dataset.theme||'auto'),value=>value===theme,{timeout:10000,interval:100,what:`o tema ${theme} na janela solta`});
  await nextFrames(child);
 }
 await nextFrames(page);
}

/** Relê o desk.json do runtime (flags de solto/por cima/posição). */
export function deskFlags(runtime){
 try{const state=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
  return {sidechatDetached:state.sidechatDetached,sidechatAlwaysOnTop:state.sidechatAlwaysOnTop,sidechatBounds:state.sidechatBounds};
 }catch{return {};}
}

/** Fato do foco atual na página, no mesmo formato do JSON das capturas. */
export function focusNow(page){
 return page.evaluate(()=>{
  const el=document.activeElement;
  if(!el||el===document.body||el===document.documentElement)return null;
  const style=getComputedStyle(el);
  const box=el.getBoundingClientRect();
  const label=el.getAttribute('aria-label')||(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,80)||el.getAttribute('title')||'';
  if(!el.dataset.ciclo2Tab)el.dataset.ciclo2Tab=`tab-${window.__ciclo2TabSeq=(window.__ciclo2TabSeq||0)+1}`;
  let focusVisible=false;
  try{focusVisible=el.matches(':focus-visible');}catch{}
  return {tag:el.tagName.toLowerCase(),id:el.id||'',key:el.dataset.ciclo2Tab,label,focusVisible,
   outline:`${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,outlineWidth:style.outlineWidth,outlineStyle:style.outlineStyle,outlineColor:style.outlineColor,
   boxShadow:style.boxShadow,rect:{x:+box.x.toFixed(1),y:+box.y.toFixed(1),width:+box.width.toFixed(1),height:+box.height.toFixed(1)}};
 });
}

/* ---------- medida do DOM de uma captura ---------- */

const MEASURE=(scope)=>{
 const parseColor=(value)=>{
  const text=String(value||'').trim();
  if(text==='transparent')return {r:0,g:0,b:0,a:0};
  const match=/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i.exec(text);
  if(!match)return null;
  return {r:+match[1],g:+match[2],b:+match[3],a:match[4]===undefined?1:+match[4]};
 };
 const css=color=>`rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
 const over=(top,bottom)=>({r:top.r*top.a+bottom.r*(1-top.a),g:top.g*top.a+bottom.g*(1-top.a),b:top.b*top.a+bottom.b*(1-top.a),a:1});
 const channel=value=>{const v=value/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};
 const luminance=color=>0.2126*channel(color.r)+0.7152*channel(color.g)+0.0722*channel(color.b);
 const contrast=(a,b)=>{const [high,low]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (high+0.05)/(low+0.05);};
 const describe=el=>`${el.tagName.toLowerCase()}${el.id?`#${el.id}`:''}${el.classList?.length?`.${[...el.classList].slice(0,2).join('.')}`:''}`;
 const visible=el=>{
  if(!el||el.nodeType!==1)return false;
  const style=getComputedStyle(el);
  if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return false;
  const box=el.getBoundingClientRect();
  return box.width>0&&box.height>0;
 };
 const opacityOf=el=>{
  let value=1,node=el;
  while(node&&node.nodeType===1){
   const opacity=Number(getComputedStyle(node).opacity);
   if(Number.isFinite(opacity))value*=opacity;
   node=node.parentElement;
  }
  return value;
 };
 const backgroundOf=el=>{
  const layers=[];
  let node=el;
  while(node&&node.nodeType===1){
   const style=getComputedStyle(node);
   const color=parseColor(style.backgroundColor);
   if(color&&color.a>0.001){
    layers.push({color,source:describe(node)});
    if(color.a>=0.999)break;
   }
   node=node.parentElement;
  }
  let base={r:255,g:255,b:255,a:1};
  for(let index=layers.length-1;index>=0;index--)base=over(layers[index].color,base);
  return {color:base,css:css(base),sources:layers.map(layer=>layer.source),layers:layers.length};
 };
 const nameOf=el=>{
  const aria=el.getAttribute&&el.getAttribute('aria-label');
  if(aria&&aria.trim())return aria.trim();
  const labelled=el.getAttribute&&el.getAttribute('aria-labelledby');
  if(labelled){
   const text=labelled.split(/\s+/).map(id=>el.ownerDocument.getElementById(id)?.textContent||'').join(' ').replace(/\s+/g,' ').trim();
   if(text)return text;
  }
  const text=(el.textContent||'').replace(/\s+/g,' ').trim();
  if(text)return text.slice(0,120);
  const title=el.getAttribute&&el.getAttribute('title');
  if(title&&title.trim())return title.trim();
  return '';
 };
 const rectOf=el=>{const box=el.getBoundingClientRect();return {x:+box.x.toFixed(1),y:+box.y.toFixed(1),width:+box.width.toFixed(1),height:+box.height.toFixed(1)};};

 const root=document.querySelector(scope);
 if(!root)return {error:`escopo ausente na página: ${scope}`};

 const texts=[],seen=new Set();
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  const value=String(node.nodeValue||'').replace(/\s+/g,' ').trim();
  if(!value)continue;
  const el=node.parentElement;
  if(!el||seen.has(el)||['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(el.tagName))continue;
  if(!visible(el))continue;
  seen.add(el);
  const style=getComputedStyle(el);
  const foreground=parseColor(style.color);
  if(!foreground)continue;
  const background=backgroundOf(el);
  const opacity=opacityOf(el);
  const foregroundWithOpacity={...foreground,a:foreground.a*opacity};
  const textColor=foregroundWithOpacity.a<0.999?over(foregroundWithOpacity,background.color):foreground;
  texts.push({
   tag:el.tagName.toLowerCase(),id:el.id||'',class:[...el.classList].slice(0,3).join(' '),text:value.slice(0,180),
   color:css(textColor),background:background.css,backgroundSources:background.sources,opacity:+opacity.toFixed(2),
   contrast:+contrast(textColor,background.color).toFixed(2),
   fontSize:style.fontSize,fontWeight:style.fontWeight,lineHeight:style.lineHeight,
   fontFamily:style.fontFamily.split(',')[0].replace(/["']/g,'').trim(),letterSpacing:style.letterSpacing,
   rect:rectOf(el),
  });
 }

 const placeholders=[...root.querySelectorAll('input[placeholder],textarea[placeholder]')].filter(visible).map(el=>{
  const style=getComputedStyle(el,'::placeholder');
  const foreground=parseColor(style.color);
  const background=backgroundOf(el);
  const opacity=opacityOf(el);
  const withOpacity=foreground?{...foreground,a:foreground.a*opacity}:null;
  const textColor=withOpacity&&withOpacity.a<0.999?over(withOpacity,background.color):foreground;
  return {tag:el.tagName.toLowerCase(),id:el.id||'',placeholder:el.getAttribute('placeholder')||'',
   color:textColor?css(textColor):'',background:background.css,opacity:+opacity.toFixed(2),
   contrast:textColor?+contrast(textColor,background.color).toFixed(2):0,
   fontSize:style.fontSize,fontWeight:style.fontWeight,lineHeight:style.lineHeight};
 });

 const targets=[...root.querySelectorAll('button,a[href],input,textarea,select,[role="menuitem"],[role="menuitemcheckbox"],[role="button"],[tabindex]')]
  .filter(visible).map(el=>{
   const box=el.getBoundingClientRect();
   return {tag:el.tagName.toLowerCase(),id:el.id||'',role:el.getAttribute('role')||'',name:nameOf(el),
    disabled:!!el.disabled||el.getAttribute('aria-disabled')==='true',checked:el.getAttribute('aria-checked'),pressed:el.getAttribute('aria-pressed'),dataState:el.dataset.state||'',
    width:+box.width.toFixed(1),height:+box.height.toFixed(1),meets24:Math.min(box.width,box.height)>=24,rect:rectOf(el)};
  });

 const labels=[...root.querySelectorAll('[aria-label],[role],button,a,input,textarea,select,[tabindex]')]
  .filter(visible).map(el=>({tag:el.tagName.toLowerCase(),id:el.id||'',role:el.getAttribute('role')||'',ariaLabel:el.getAttribute('aria-label')||'',
   ariaChecked:el.getAttribute('aria-checked'),ariaExpanded:el.getAttribute('aria-expanded'),ariaPressed:el.getAttribute('aria-pressed'),dataState:el.dataset.state||'',
   title:el.getAttribute('title')||'',name:nameOf(el)}));

 const chainOf=el=>{
  const chain=[];
  let node=el;
  for(let depth=0;node&&node.nodeType===1&&depth<4;depth++,node=node.parentElement){
   const style=getComputedStyle(node);
   const after=getComputedStyle(node,'::after');
   chain.push({tag:node.tagName.toLowerCase(),id:node.id||'',outline:`${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
    boxShadow:style.boxShadow,borderTopColor:style.borderTopColor,borderColor:style.borderColor,
    after:{content:after.content,display:after.display,borderTopWidth:after.borderTopWidth,borderTopColor:after.borderTopColor}});
  }
  return chain;
 };
 const active=document.activeElement;
 let focus=null;
 if(active&&active!==document.body&&active!==document.documentElement&&visible(active)){
  const style=getComputedStyle(active);
  let focusVisible=false;
  try{focusVisible=active.matches(':focus-visible');}catch{}
  focus={tag:active.tagName.toLowerCase(),id:active.id||'',role:active.getAttribute('role')||'',name:nameOf(active),focusVisible,
   outline:`${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,outlineWidth:style.outlineWidth,outlineStyle:style.outlineStyle,outlineColor:style.outlineColor,
   boxShadow:style.boxShadow,rect:rectOf(active),chain:chainOf(active)};
 }

 const rootBox=rectOf(root);
 return {
  window:{innerWidth,innerHeight,outerWidth,outerHeight,screenWidth:screen.width,screenHeight:screen.height,devicePixelRatio},
  document:{title:document.title,lang:document.documentElement.lang||'',theme:document.documentElement.dataset.theme||'auto',
   scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},
  scope:{selector:scope,rect:rootBox},
  textCount:texts.length,textsTruncated:texts.length>250,texts:texts.slice(0,250),
  placeholders,
  targetCount:targets.length,targetsTruncated:targets.length>120,targets:targets.slice(0,120),
  labelCount:labels.length,labelsTruncated:labels.length>120,labels:labels.slice(0,120),
  focus,
 };
};

/** Mede a página (função exposta para depuração e para o `snap`). */
export function measurePage(page,scope='body'){
 return page.evaluate(MEASURE,scope);
}

/** Cria o `snap`: confere o estado por DOM (o `expect` lança), mede e grava
 * PNG + JSON com o mesmo nome. */
export function createSnap(out){
 return async function snap(page,base,{scope='body',expect=null,extra={}}={}){
  await layoutStable(page,scope==='body'?'body':scope,{timeout:8000}).catch(()=>{});
  await nextFrames(page);
  if(typeof expect==='function')await expect();
  await page.mouse.move(1,1);
  await nextFrames(page);
  const facts=await measurePage(page,scope);
  await page.screenshot({path:path.join(out,`${base}.png`)});
  const record={file:`${base}.png`,capturedAt:new Date().toISOString(),scope,...facts,extra};
  fs.writeFileSync(path.join(out,`${base}.json`),JSON.stringify(record,null,2));
  return record;
 };
}
