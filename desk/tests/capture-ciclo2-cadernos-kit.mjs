// Kit das capturas do ciclo 2, parte "Cadernos" (#133, #135, #158): janela,
// temas, medições de DOM e dados sintéticos. O molde é o da auditoria de UI/UX
// (capture-auditoria-ui-kit.mjs); nada aqui abre material de curso real — os
// `.xopp` são XML gzip sintético e o Xournal++ é o `fake-xournalpp.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {DESK,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,tinyPdf} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const argOut=(()=>{const at=process.argv.indexOf('--out');return at>=0?process.argv[at+1]||'':'';})();
/** Pasta de saída; `--out <dir>` vence `CICLO2_OUT`. O padrão é a rodada 2
 *  ("antes" dos consertos da rodada 1), que é a base da nota da rodada 2. */
export const OUT=path.resolve(argOut||process.env.CICLO2_OUT||path.join(DESK,'..','docs','design-loop','rodada-2','antes','cadernos'));
fs.mkdirSync(OUT,{recursive:true});
export const SIZES=[[1440,900],[900,650]];
export const THEMES=['light','dark'];
export const FAKE_XOURNALPP=path.join(DESK,'tests','fake-xournalpp.mjs');

/** XML de um `.xopp` sintético, com texto por página (o formato que o índice
 *  da busca e o `ler_caderno` leem). @param {string[][]} pages @returns {string} */
export function xoppXml(pages){
 const body=pages.map((texts)=>{
  const boxes=texts.map((text,index)=>`<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="${100+index*40}.00">${text}</text>`).join('\n');
  return `<page width="589.00" height="845.00">\n<background type="solid" color="#ffffffff" style="lined"/>\n<layer>\n${boxes}\n</layer>\n</page>`;
 }).join('\n');
 return `<?xml version="1.0" standalone="no"?>\n<xournal version="4">\n${body}\n</xournal>\n`;
}
/** Escreve um `.xopp` gzip sintético. @param {string} file @param {string[][]} pages */
export function writeXopp(file,pages){fs.writeFileSync(file,zlib.gzipSync(xoppXml(pages),'utf8'));}

/** Matéria com dois cadernos (um em subpasta) e uma segunda matéria: a lista
 *  agrupada da #133. Devolve os caminhos para as checagens. @param {string} tag */
export function seedLibrary(tag,{withContent=false,xournalPath=''}={}){
 const runtime=newRuntime(tag);
 const calc=seedCourse(runtime,'calc'),fis=seedCourse(runtime,'fis');
 const pdf=path.join(calc,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
 const sub=path.join(calc,'sub');fs.mkdirSync(sub,{recursive:true});
 const nova=path.join(sub,'aula-nova.xopp'),antiga=path.join(calc,'aula-antiga.xopp'),ondas=path.join(fis,'ondas.xopp');
 const pages=withContent?[['Equação do primeiro grau'],['Continuidade']]:[['Caderno de teste']];
 for(const file of [nova,antiga,ondas])writeXopp(file,pages);
 const now=new Date(),old=new Date(now.getTime()-2*86400000),older=new Date(now.getTime()-5*86400000);
 fs.utimesSync(nova,now,now);fs.utimesSync(antiga,old,old);fs.utimesSync(ondas,older,older);
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:calc},{id:'fis',name:'Física',path:fis}],...(xournalPath?{xournalPath}:{})});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 return {runtime,calc,fis,pdf,nova,antiga,ondas};
}

/** Boot da Mesa já no tamanho grande, online e sem animação. @param {string} runtime @param {object} [options] */
export async function boot(runtime,options={}){
 const app=await launchDesk({runtime,...options});
 const page=await app.firstWindow();
 await resizeWindow(app,page,1440,900);
 await statusOnline(page,{timeout:60000}).catch(()=>{});
 await freezeMotion(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 return {app,page};
}

/** Fecha o popover de cadernos, se estiver aberto. @param {import('@playwright/test').Page} page */
export async function closeNotebooks(page){
 if(await page.evaluate(()=>document.querySelector('#notebooks-pop')?.hidden!==false))return;
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.querySelector('#notebooks-pop')?.hidden===true,undefined,{timeout:5000});
}

/** Abre o popover Cadernos pelo caminho real (Mais opções → Contexto). Fecha
 *  antes para cada captura começar do mesmo estado. @param {import('@playwright/test').Page} page */
export async function openNotebooks(page){
 await closeNotebooks(page);
 if(await page.evaluate(()=>document.querySelector('#chat-more-pop')?.hidden!==false))await page.locator('#chat-more').click();
 await page.locator('#more-notebooks').click();
 await page.waitForFunction(()=>document.querySelector('#notebooks-pop')?.hidden===false,undefined,{timeout:5000});
 await page.waitForFunction(()=>!!document.querySelector('#notebooks-list')?.childElementCount,undefined,{timeout:10000});
 await page.waitForSelector('#notebooks-ink-switch',{timeout:10000});
 return page;
}

/** Troca o idioma pela porta do app e espera o `<html lang>`. @param {import('@playwright/test').Page} page @param {'pt-BR'|'en'} lang */
export async function setUiLang(page,lang){
 const value=lang==='en'?'en':'pt-BR';
 await page.evaluate(async next=>{const {setUiLanguage}=await import('./src/ui-text.mjs');setUiLanguage(next);},value);
 await page.waitForFunction(want=>document.documentElement.lang===want,value,{timeout:10000});
}

/** Abre o Sobre (painel de Componentes) do zero, para os textos serem
 *  repintados no idioma atual. @param {import('@playwright/test').Page} page */
export async function openAbout(page){
 if(await page.evaluate(()=>!!document.querySelector('#about-dialog')?.open))await page.evaluate(()=>document.querySelector('#about-dialog').close());
 if(await page.evaluate(()=>!document.querySelector('#settings-menu')?.classList.contains('open')))await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#about').click();
 await page.waitForSelector('#about-dialog[open]',{timeout:10000});
 await page.locator('.component-plugin-state').waitFor({timeout:20000});
}

/** Lê o estado do painel da tinta. @param {import('@playwright/test').Page} page */
export const inkPanel=page=>page.evaluate(()=>{
 const button=document.querySelector('#notebooks-ink-switch');
 const desc=document.getElementById(button?.getAttribute('aria-describedby')||'');
 const count=document.querySelector('.notebooks-ink-count');
 const state=document.querySelector('.notebooks-ink-state');
 const error=document.querySelector('.notebooks-ink-error');
 return {
  role:button?.getAttribute('role')||'',checked:button?.getAttribute('aria-checked')||'',disabled:button?.disabled??null,
  busy:button?.getAttribute('aria-busy')||'',label:button?.textContent?.trim()||'',
  description:desc?.textContent||'',count:count?.hidden?'':(count?.textContent||''),state:state?.hidden?'':(state?.textContent||''),
  error:error&&!error.hidden?(error.querySelector('.notebooks-ink-error-text')?.textContent?.trim()||''):'',
  retry:!!document.querySelector('.notebooks-ink-retry'),
 };
});

/* Medição no DOM da região: textos visíveis com cor/fundo efetivo e contraste
   WCAG, fonte, alvos clicáveis, foco e rótulos acessíveis. Roda na página. */
async function measure(page,selector){
 return page.evaluate(sel=>{
  const region=document.querySelector(sel);
  if(!region)throw Error(`a região ${sel} não está no DOM`);
  const parse=value=>{
   const found=String(value||'').match(/rgba?\(([^)]+)\)/);
   if(!found)return {r:0,g:0,b:0,a:0};
   const parts=found[1].replace(/\//g,' ').split(/[,\s]+/).filter(Boolean).map(Number);
   return {r:parts[0]||0,g:parts[1]||0,b:parts[2]||0,a:parts.length>3?Number(parts[3]):1};
  };
  const over=(top,under)=>({r:Math.round(top.r*top.a+under.r*(1-top.a)),g:Math.round(top.g*top.a+under.g*(1-top.a)),b:Math.round(top.b*top.a+under.b*(1-top.a)),a:1});
  const effectiveBg=el=>{
   const chain=[];for(let node=el;node;node=node.parentElement)chain.push(node);
   let bg={r:255,g:255,b:255,a:1};
   for(const node of chain.reverse()){const color=parse(getComputedStyle(node).backgroundColor);if(color.a>0)bg=over(color,bg);}
   return bg;
  };
  /* A opacidade efetiva é a do próprio elemento vezes a dos ancestrais: é o que
     o PNG compõe. Sem ela o contraste do JSON ficava otimista no texto de botão
     desabilitado (rodada 5: 5,79:1 no JSON e 2,81:1 no pixel). */
  const opacityOf=el=>{
   let alpha=1;
   for(let node=el;node;node=node.parentElement){
    const value=Number(getComputedStyle(node).opacity);
    if(Number.isFinite(value))alpha*=value;
   }
   return alpha;
  };
  const luminance=rgb=>{
   const [r,g,b]=[rgb.r,rgb.g,rgb.b].map(channel=>{const value=channel/255;return value<=0.03928?value/12.92:((value+0.055)/1.055)**2.4;});
   return 0.2126*r+0.7152*g+0.0722*b;
  };
  const ratio=(a,b)=>{const [high,low]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return Math.round(((high+0.05)/(low+0.05))*100)/100;};
  const shown=el=>{
   if(!el||el.closest?.('[hidden]'))return false;
   const box=el.getBoundingClientRect();
   if(box.width<=0||box.height<=0)return false;
   const style=getComputedStyle(el);
   return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0;
  };
  const boxOf=el=>{const box=el.getBoundingClientRect();return {x:Math.round(box.x),y:Math.round(box.y),largura:Math.round(box.width),altura:Math.round(box.height)};};
  const labelOf=el=>{
   const aria=el.getAttribute('aria-label');
   if(aria)return aria.trim();
   const by=el.getAttribute('aria-labelledby');
   if(by){const text=by.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim();if(text)return text;}
   return (el.getAttribute('title')||el.getAttribute('placeholder')||el.textContent||'').trim().slice(0,120);
  };
  const texts=[];
  for(const el of region.querySelectorAll('*')){
   if(!shown(el)||['SCRIPT','STYLE','NOSCRIPT'].includes(el.tagName))continue;
   const direct=[...el.childNodes].filter(node=>node.nodeType===3&&node.textContent.trim()).map(node=>node.textContent).join(' ').replace(/\s+/g,' ').trim();
   if(!direct)continue;
   const style=getComputedStyle(el),background=effectiveBg(el),ink=parse(style.color);
   const inkOnBg=over({...ink,a:ink.a*opacityOf(el)},background);
   texts.push({
    texto:direct.slice(0,160),tag:el.tagName.toLowerCase(),classe:typeof el.className==='string'?el.className:'',
    cor:style.color,fundo:`rgb(${background.r}, ${background.g}, ${background.b})`,contraste:ratio(inkOnBg,background),
    fonte:{tamanho:style.fontSize,peso:style.fontWeight,alturaLinha:style.lineHeight,familia:style.fontFamily.split(',')[0]},caixa:boxOf(el),
   });
  }
  const controls=[];
  for(const el of region.querySelectorAll('button,a[href],input,select,textarea,summary,[role="button"],[role="switch"],[role="option"],[tabindex]:not([tabindex="-1"])')){
   if(!shown(el))continue;
   const box=boxOf(el),style=getComputedStyle(el);
   controls.push({
    tag:el.tagName.toLowerCase(),id:el.id||'',classe:typeof el.className==='string'?el.className:'',
    role:el.getAttribute('role')||'',rotulo:labelOf(el),title:el.getAttribute('title')||'',
    desabilitado:el.disabled===true,tabindex:el.tabIndex,
    caixa:box,alvo:{largura:box.largura,altura:box.altura,abaixo24:box.largura<24||box.altura<24,abaixo44:box.largura<44||box.altura<44},
    contorno:style.outline?`${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`:'',
    sombra:style.boxShadow==='none'?'':style.boxShadow.slice(0,120),
    /* O fundo computado prova o hover no JSON (#157/#158: linha e interruptor). */
    fundo:style.backgroundColor,
   });
  }
  const active=document.activeElement;
  const focused=active&&active!==document.body?{
   tag:active.tagName.toLowerCase(),id:active.id||'',classe:typeof active.className==='string'?active.className:'',
   role:active.getAttribute?.('role')||'',rotulo:labelOf(active),dentro:region.contains(active),
   focusVisible:typeof active.matches==='function'?active.matches(':focus-visible'):null,
   caixa:boxOf(active),
   contorno:`${getComputedStyle(active).outlineWidth} ${getComputedStyle(active).outlineStyle} ${getComputedStyle(active).outlineColor}`,
   contornoOffset:getComputedStyle(active).outlineOffset,sombra:getComputedStyle(active).boxShadow==='none'?'':getComputedStyle(active).boxShadow.slice(0,160),
  }:null;
  return {
   janela:{largura:innerWidth,altura:innerHeight},tema:document.documentElement.dataset.theme||'',
   idioma:document.documentElement.lang||'',
   regiao:{seletor:sel,tag:region.tagName.toLowerCase(),id:region.id||'',classe:typeof region.className==='string'?region.className:'',role:region.getAttribute('role')||'',rotulo:region.getAttribute('aria-label')||'',caixa:boxOf(region)},
   foco:focused,textos:texts,alvos:controls,
  };
 },selector);
}

/** Foto + JSON de medidas da região. `keepPointer` preserva o hover antes da
 *  foto (o padrão afasta o ponteiro para o estado não sair com hover acidental).
 *  @param {import('@playwright/test').Page} page @param {string} base @param {string} region
 *  @param {{keepPointer?: boolean}} [options] */
export async function capture(page,base,region,{keepPointer=false}={}){
 const data=await measure(page,region);
 data.captura=`${base}.png`;
 data.script='desk/tests/capture-ciclo2-cadernos.mjs';
 fs.writeFileSync(path.join(OUT,`${base}.json`),`${JSON.stringify(data,null,2)}\n`);
 if(!keepPointer)await page.mouse.move(1,1);
 await page.screenshot({path:path.join(OUT,`${base}.png`)});
}

/**
 * Série de um estado: claro/escuro × 1440×900 e 900×650, mais uma captura em
 * inglês a 1440×900. `prepare` refaz o estado; `check` reprova o bloco se ele
 * não estiver na tela antes da foto.
 * @param {import('@playwright/test').Page} page @param {any} app
 * @param {{base:string,region:string,prepare?:()=>Promise<void>,check:()=>Promise<void>}} options
 */
export async function series(page,app,{base,region,prepare=async()=>{},check}){
 for(const [width,height] of SIZES){
  await resizeWindow(app,page,width,height);
  for(const theme of THEMES){
   await setTheme(page,theme);
   await prepare();
   await check();
   await layoutStable(page,region).catch(()=>{});
   await capture(page,`${base}-${theme}-${width}x${height}`,region);
  }
 }
 await setUiLang(page,'en');
 await resizeWindow(app,page,1440,900);
 await setTheme(page,'light');
 await prepare();
 await check();
 await layoutStable(page,region).catch(()=>{});
 await capture(page,`${base}-en-1440x900`,region);
 await setUiLang(page,'pt-BR');
 await setTheme(page,'light');
}

/* ---------- teclado: foco de verdade (Tab/Shift+Tab) ---------- */

/** Foca o controle anterior e dá Tab até o alvo; devolve o foco ativo. Reprova
 *  se o Tab não chegar em `selector` em 6 passos.
 *  @param {import('@playwright/test').Page} page @param {string} previous @param {string} selector */
export async function focusByTab(page,previous,selector){
 await page.locator(previous).last().focus();
 let active=null;
 for(let step=0;step<6;step+=1){
  await page.keyboard.press('Tab');
  active=await page.evaluate(()=>{
   const el=document.activeElement;
   return {tag:el?.tagName.toLowerCase()||'',id:el?.id||'',classe:typeof el?.className==='string'?el.className:'',visible:el?.matches?.(':focus-visible')??null};
  });
  const target=await page.locator(selector).first().evaluate(el=>el===document.activeElement);
  if(target)return active;
 }
 throw Error(`Tab de ${previous} não chegou em ${selector} (ativo: ${active?.tag}#${active?.id}.${active?.classe})`);
}

/** Reprova o foco atual sem anel visível (`outline` ou `box-shadow`) ou fora do
 *  `:focus-visible`. @param {import('@playwright/test').Page} page @param {string} tag */
export async function assertFocusRing(page,tag){
 const ring=await page.evaluate(()=>{
  const el=document.activeElement,style=getComputedStyle(el);
  return {outline:parseFloat(style.outlineWidth)||0,shadow:style.boxShadow||'none',visible:el.matches?.(':focus-visible')??false};
 });
 if(ring.outline===0&&ring.shadow==='none')throw Error(`teclado: ${tag} sem anel de foco visível (outline 0, box-shadow none)`);
 if(!ring.visible)throw Error(`teclado: ${tag} não casa :focus-visible`);
}

/** Volta o foco a um controle com modalidade de teclado (Tab e Shift+Tab) e
 *  confere o anel. @param {import('@playwright/test').Page} page @param {string} selector @param {string} tag */
export async function focusKeyboard(page,selector,tag){
 await page.locator(selector).last().focus();
 await page.keyboard.press('Tab');
 await page.keyboard.press('Shift+Tab');
 const at=await page.locator(selector).last().evaluate(el=>el===document.activeElement);
 if(!at)throw Error(`o foco de teclado não voltou para ${selector}`);
 await assertFocusRing(page,tag);
}

/** Repete um estado de teclado nos dois temas e nos dois tamanhos; `prepare`
 *  refaz a rota de foco a cada variante. @param {import('@playwright/test').Page} page
 *  @param {any} app @param {{base:string,region:string,prepare:()=>Promise<void>}} options */
export async function keyboardShots(page,app,{base,region,prepare}){
 for(const [width,height] of SIZES){
  await resizeWindow(app,page,width,height);
  for(const theme of THEMES){
   await setTheme(page,theme);
   await prepare();
   await capture(page,`${base}-${theme}-${width}x${height}`,region);
  }
 }
}

/* ---------- plugin MesaPagina: leitura e estados falsos ---------- */

/** Fatos da linha do plugin no Sobre (mesmo molde de notebooks-plugin-ui). */
export const pluginLine=page=>page.evaluate(()=>{
 const box=document.querySelector('.component-plugin');
 const button=box?.querySelector('.component-plugin-install');
 const version=box?.querySelector('.component-plugin-version');
 const restart=box?.querySelector('.component-plugin-restart');
 const error=box?.querySelector('.component-run');
 return {
  state:box?.querySelector('.component-plugin-state')?.textContent?.trim()||'',
  button:button?.textContent?.trim()||'',disabled:button?.disabled??null,busy:button?.getAttribute('aria-busy')||'',
  ariaDisabled:button?.getAttribute('aria-disabled')||'',
  spinner:!!button?.querySelector('.ts-dots'),dotState:box?.querySelector('.component-dot')?.getAttribute('data-state')||'',
  version:version?.textContent?.trim()||'',versionHidden:version?.hidden??null,
  restart:restart?.textContent?.trim()||'',restartHidden:restart?.hidden??null,
  error:error?error.textContent?.replace(/\s+/g,' ').trim():'',errorRole:error?.getAttribute('role')||'',
  retry:error?.querySelector('.component-plugin-retry')?.textContent?.trim()||'',
 };
});

/** Painel de componentes falso com o status (e a versão) pedidos, sem tocar
 *  no HOME. @param {any} app @param {string} status @param {string} [version] */
export async function setComponentsPluginStatus(app,status,version=''){
 await app.evaluate(({ipcMain},value)=>{
  globalThis.__c2PluginStatus=value.status;
  globalThis.__c2PluginVersion=value.version;
  ipcMain.removeHandler('components');
  ipcMain.handle('components',async()=>({rows:[
   {id:'xournal',label:'Xournal++',version:'1.3.8',state:'ok',plugin:{status:globalThis.__c2PluginStatus,version:globalThis.__c2PluginVersion}},
  ]}));
 },{status,version});
}

/* ---------- busca: fake que segura o IPC até a captura ---------- */

/** Troca o `notebooks-search` por um fake que só resolve quando liberado. */
export async function holdNotebookSearch(app){
 await app.evaluate(({ipcMain})=>{
  globalThis.__c2SearchPending=0;
  globalThis.__c2SearchRelease=[];
  ipcMain.removeHandler('notebooks-search');
  ipcMain.handle('notebooks-search',(_event,query)=>{
   globalThis.__c2SearchPending+=1;
   return new Promise(resolve=>{
    globalThis.__c2SearchRelease.push(()=>resolve([
     {caminho:'fake/aula-nova.xopp',nomeExibido:'aula-nova.xopp',materia:'Cálculo I',pagina:1,trecho:`trecho de ${String(query)}`},
    ]));
   });
  });
 });
}

/** Libera todas as buscas pendentes do fake acima. */
export async function releaseNotebookSearch(app){
 await app.evaluate(()=>{for(const release of globalThis.__c2SearchRelease||[])release();globalThis.__c2SearchRelease=[];});
}
