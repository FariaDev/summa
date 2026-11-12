import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,artifactDir,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline,freezeMotion,setTheme,resizeWindow,workAreaSize} from './helpers.mjs';
import {layoutStable,pollUntil} from './waits.mjs';

/* Chat lateral solto em janela estreita (#157, Etapa 1): a janela solta com
   360–420px de largura e altura toda cabe sem rolagem horizontal — Enviar e o
   indicador de modelo inteiros, escopo numa linha com reticências (o `title`
   guarda o texto inteiro), menus e cartões dentro da janela, nos dois temas,
   em 380×800 e 420×1000; numa tela baixa (MacBook Air 1280×832) a altura
   maior é a área útil, porque o sistema não aceita janela além dela. As
   capturas saem em `desk/tests/artifacts/lateral-solto-estreito/` (fixtures
   sintéticos, sem material de curso). */
const THEMES=[['light','claro'],['dark','escuro']];

async function openSidechat(page){
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>{
  const el=document.querySelector('#sidechat');
  const prompt=document.querySelector('#sidechat-prompt');
  return !!el&&!el.hidden&&!!prompt&&!prompt.disabled&&!document.querySelector('#sidechat-messages .sidechat-msg.system');
 },undefined,{timeout:20000});
}

function inside(box,inner,tol=0.5){
 if(!box||box.width<=0||box.height<=0)return false;
 return box.left>=-tol&&box.top>=-tol&&box.right<=inner.width+tol&&box.bottom<=inner.height+tol;
}

async function detachChild(page,app){
 const opened=app.waitForEvent('window',{timeout:10000});
 await page.locator('#sidechat-more').click();
 await page.locator('#sidechat-detach').click();
 const child=await opened;
 await child.waitForSelector('#sidechat',{timeout:10000});
 await child.locator('#sidechat').waitFor({state:'visible'});
 await freezeMotion(child);
 return child;
}

async function childFacts(child){
 return child.evaluate(()=>{
  const rect=el=>{if(!el||el.hidden||getComputedStyle(el).display==='none')return null;const b=el.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};
  const scope=document.querySelector('#sidechat-scope');
  const scopeText=document.querySelector('#sidechat-scope-text');
  const style=getComputedStyle(scopeText||document.body);
  const line=Number.parseFloat(style.lineHeight)||Number.parseFloat(style.fontSize)*1.4;
  const scopeStyle=getComputedStyle(scope);
  const scopeHeight=rect(scope)?.height||0;
  const scopePad=(Number.parseFloat(scopeStyle.paddingTop)||0)+(Number.parseFloat(scopeStyle.paddingBottom)||0);
  const messages=document.querySelector('#sidechat-messages');
  const cards=[...document.querySelectorAll('#sidechat-messages .sidechat-msg,#sidechat-messages .quiz-card,#sidechat-messages .codeblock')].map(rect).filter(Boolean);
  const prompt=rect(document.querySelector('#sidechat-prompt'));
  const send=rect(document.querySelector('#sidechat-send'));
  const composer=rect(document.querySelector('#sidechat-composer'));
  const composerStyle=getComputedStyle(document.querySelector('#sidechat-composer'));
  return {
   inner:{width:innerWidth,height:innerHeight},
   docScrollWidth:document.documentElement.scrollWidth,docClientWidth:document.documentElement.clientWidth,
   bodyScrollWidth:document.body?document.body.scrollWidth:0,bodyClientWidth:document.body?document.body.clientWidth:0,
   send,engine:rect(document.querySelector('#sidechat-engine')),
   engineHidden:!!document.querySelector('#sidechat-engine')?.hidden,
   engineText:document.querySelector('#sidechat-engine')?.textContent||'',
   scope:rect(scope),
   scopeLines:Math.max(1,Math.round((scopeHeight-scopePad)/line)),
   scopeText:rect(scopeText),
   scopeTextLineHeight:line,scopeTextWhiteSpace:style.whiteSpace,scopeTextOverflow:style.textOverflow,
   scopeTextScrollWidth:scopeText?.scrollWidth||0,scopeTextClientWidth:scopeText?.clientWidth||0,
   scopeTextContent:scopeText?.textContent||'',scopeTextTitle:scopeText?.title||'',
   refresh:rect(document.querySelector('#sidechat-refresh')),
   lock:rect(document.querySelector('#sidechat-scope-lock')),
   sidechat:rect(document.querySelector('#sidechat')),
   messages:{scrollWidth:messages?.scrollWidth||0,clientWidth:messages?.clientWidth||0},
   cards,
   prompt,composer,
   composerMinHeight:composerStyle.minHeight,
   composerHeight:composer?.height||0,
   gapPromptSend:prompt&&send?send.top-prompt.bottom:0,
  };
 });
}

async function assertFits(child,label){
 const f=await childFacts(child);
 assert.ok(f.docScrollWidth<=f.docClientWidth+1,`${label}: documento sem rolagem horizontal (${f.docScrollWidth} > ${f.docClientWidth})`);
 assert.ok(f.send&&inside(f.send,f.inner),`${label}: Enviar visível e inteiro dentro da janela ${f.inner.width}×${f.inner.height}`);
 assert.equal(f.engineHidden,false,`${label}: indicador de modelo visível ("${f.engineText}")`);
 assert.ok(f.engine&&inside(f.engine,f.inner),`${label}: indicador de modelo dentro da janela`);
 assert.equal(f.scopeTextWhiteSpace,'nowrap',`${label}: o escopo fica numa linha (white-space: ${f.scopeTextWhiteSpace})`);
 assert.equal(f.scopeTextOverflow,'ellipsis',`${label}: o escopo corta com reticências (text-overflow: ${f.scopeTextOverflow})`);
 assert.ok(f.scopeText.height<=f.scopeTextLineHeight*1.5,`${label}: altura do escopo ${f.scopeText.height.toFixed(1)}px para linha de ${f.scopeTextLineHeight}px`);
 assert.equal(f.scopeTextTitle,f.scopeTextContent,`${label}: o title guarda o escopo inteiro ("${f.scopeTextTitle}")`);
 assert.ok(f.scope&&inside(f.scope,f.inner),`${label}: linha de escopo dentro da janela`);
 for(const [name,box] of [['texto',f.scopeText],['cadeado',f.lock],['atualizar',f.refresh]])assert.ok(box&&inside(box,f.inner),`${label}: escopo (${name}) dentro da linha e da janela`);
 for(const [index,card] of f.cards.entries())assert.ok(card.left>=-0.5&&card.right<=f.inner.width+0.5,`${label}: cartão ${index} cabe na largura (${card.left}…${card.right})`);
 assert.ok(f.gapPromptSend<=24,`${label}: composer colado (vão campo→Enviar ${f.gapPromptSend}px)`);
 return f;
}

async function assertMenuFits(child,label,dir){
 await child.locator('#sidechat-more').click();
 await child.locator('#sidechat-detach').waitFor({state:'visible'});
 const box=await child.locator('#sidechat-more-pop').boundingBox();
 const inner=await child.evaluate(()=>({width:innerWidth,height:innerHeight}));
 assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=inner.width+0.5&&box.y+box.height<=inner.height+0.5,`${label}: menu Mais opções dentro da janela ${inner.width}×${inner.height} (${JSON.stringify(box)})`);
 await child.screenshot({path:path.join(dir,`${label}-mais-opcoes.png`)});
 await child.keyboard.press('Escape');
 await child.locator('#sidechat-more-pop').waitFor({state:'hidden'});
}

await withArtifacts('lateral-solto-estreito',async ctx=>{
 const runtime=ctx.runtime=newRuntime('lateral-solto-estreito'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf(['Lista 2 - Limites','5. lim x->2 (x^2 - 4)/(x - 2)','6. lim x->0 sen(3x)/x'],4));
 fs.writeFileSync(path.join(course,'Formulario.pdf'),tinyPdf(['Formulario','lim sen x / x = 1'],2));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const available=await workAreaSize(ctx.app);
 const SIZES=[[380,Math.min(800,available.height)],[420,Math.min(1000,available.height)]];
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 await openSidechat(page);
 await page.locator('#sidechat-prompt').fill('teorema do chat lateral');
 await page.locator('#sidechat-prompt').press('Enter');
 await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-msg.assistant .sidechat-body')].some(el=>el.textContent.includes('Pitágoras')),undefined,{timeout:30000});
 const dir=artifactDir('lateral-solto-estreito');
 const child=await detachChild(page,ctx.app);
 for(const [theme,tag] of THEMES){
  await setTheme(page,theme);
  await pollUntil(()=>child.evaluate(()=>document.documentElement.dataset.theme||'auto'),v=>v===theme,{timeout:10000,interval:100,what:`o tema ${theme} chegar à filha`});
  for(const [width,height] of SIZES){
   const label=`solto-${tag}-${width}x${height}`;
   await resizeWindow(ctx.app,child,width,height);
   await layoutStable(child,'#sidechat',{timeout:10000});
   await assertFits(child,label);
   await child.screenshot({path:path.join(dir,`${label}.png`)});
   await assertMenuFits(child,label,dir);
  }
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: chat solto cabe em janela estreita');
});
