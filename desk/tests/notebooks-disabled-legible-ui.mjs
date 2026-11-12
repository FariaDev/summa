// node tests/notebooks-disabled-legible-ui.mjs — consertos dos achados 1 e 2 da
// rodada 5 de UI/UX (cadernos, #133/#158): o "Instalando…" do plugin e o rótulo
// do interruptor "Buscar também na escrita à mão" continuam legíveis (≥4,5:1 no claro e no
// escuro) mesmo desabilitados. O contraste medido é o efetivo: a cor do texto é
// composta com a opacidade do próprio elemento e dos ancestrais — a mesma conta
// do JSON das capturas. Medido na janela real; IPC falso, nada toca o HOME.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
  setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

function seed(tag){
  const runtime=newRuntime(tag);
  const calc=seedCourse(runtime,'calc');
  const pdf=path.join(calc,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:calc}]});
  writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
  return {runtime};
}

/* Cor efetiva do texto (opacidade do próprio elemento × ancestrais) sobre o
   fundo efetivo — a mesma conta do JSON das capturas. Devolve também a
   opacidade composta, para a regressão apontar a causa. */
function contrastFacts(page,selector){
  return page.evaluate(sel=>{
    const parse=(value)=>{
      const match=/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i.exec(String(value||''));
      if(!match)return null;
      return {r:+match[1],g:+match[2],b:+match[3],a:match[4]===undefined?1:+match[4]};
    };
    const over=(top,bottom)=>({r:top.r*top.a+bottom.r*(1-top.a),g:top.g*top.a+bottom.g*(1-top.a),b:top.b*top.a+bottom.b*(1-top.a),a:1});
    const channel=(value)=>{const v=value/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};
    const luminance=({r,g,b})=>0.2126*channel(r)+0.7152*channel(g)+0.0722*channel(b);
    const ratio=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+0.05)/(lo+0.05);};
    const el=document.querySelector(sel);
    if(!el)throw Error(`elemento ausente: ${sel}`);
    let opacity=1,node=el;
    while(node&&node.nodeType===1){opacity*=Number(getComputedStyle(node).opacity)||1;node=node.parentElement;}
    const layers=[];node=el;
    while(node&&node.nodeType===1){
      const color=parse(getComputedStyle(node).backgroundColor);
      if(color&&color.a>0.001){layers.push(color);if(color.a>=0.999)break;}
      node=node.parentElement;
    }
    let background={r:255,g:255,b:255,a:1};
    for(let index=layers.length-1;index>=0;index--)background=over(layers[index],background);
    const base=parse(getComputedStyle(el).color);
    const foreground={...base,a:base.a*opacity};
    const text=foreground.a<0.999?over(foreground,background):foreground;
    const css=color=>`rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
    return {opacity,color:css(base),background:css(background),foreground:css(text),ratio:ratio(text,background)};
  },selector);
}

async function assertLegible(page,selector,label,theme,floor=4.5){
  const facts=await contrastFacts(page,selector);
  assert.equal(facts.opacity,1,`${theme}: ${label} mantém opacidade cheia (medido ${facts.opacity.toFixed(2)}; o texto renderiza ${facts.foreground} sobre ${facts.background} = ${facts.ratio.toFixed(2)}:1)`);
  assert.ok(facts.ratio>=floor,`${theme}: ${label} passa de ${floor}:1 no contraste efetivo (medido ${facts.ratio.toFixed(2)}:1 com opacidade ${facts.opacity.toFixed(2)}: ${facts.foreground} sobre ${facts.background})`);
  return facts;
}

/* O teste junta as falhas dos dois achados: no código antigo uma rodada mostra
   as duas reprovações, não só a primeira. */
const failures=[];
async function check(tag,run){
  try{await run();}
  catch(error){failures.push(`${tag}: ${String(error?.message||error).split('\n')[0]}`);}
}

const openAbout=async page=>{
  await page.locator('#settings-menu .nav-trigger').click();
  await page.locator('#about').click();
  await page.waitForSelector('#about-dialog[open]',{timeout:10000});
  await page.locator('.component-plugin-install').waitFor({timeout:15000});
  await page.waitForFunction(()=>document.querySelector('.component-plugin-state')?.textContent==='não instalado',undefined,{timeout:15000});
};

const openPopover=async page=>{
  if(await page.evaluate(()=>document.querySelector('#chat-more-pop')?.hidden!==false))await page.locator('#chat-more').click();
  await page.locator('#more-notebooks').click();
  await page.waitForFunction(()=>document.querySelector('#notebooks-pop')?.hidden===false,undefined,{timeout:5000});
  await page.locator('#notebooks-ink-switch').waitFor({timeout:10000});
};

await withArtifacts('notebooks-disabled-legible',async ctx=>{
  const {runtime}=ctx.seed=seed('notebooks-disabled-legible');
  ctx.runtime=runtime;
  ctx.app=await launchDesk({runtime});
  const page=await ctx.app.firstWindow();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await resizeWindow(ctx.app,page,1440,900,{content:true});
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas',{timeout:30000});

  /* O painel e a instalação do plugin são falsos: o estado é "não instalado" e
     o pedido fica em voo até o teste soltar. O interruptor da tinta recebe
     "sem modelo com visão", que é o estado desabilitado dos achados. */
  await ctx.app.evaluate(({ipcMain})=>{
    globalThis.__dlPluginRelease=null;
    ipcMain.removeHandler('components');
    ipcMain.handle('components',async()=>({rows:[
      {id:'xournal',label:'Xournal++',version:'1.3.8',state:'ok',plugin:{status:'missing'}},
    ]}));
    ipcMain.removeHandler('xournal-plugin-install');
    ipcMain.handle('xournal-plugin-install',()=>new Promise(resolve=>{globalThis.__dlPluginRelease=()=>resolve({ok:true});}));
    ipcMain.removeHandler('notebooks-list');
    ipcMain.handle('notebooks-list',async()=>({notebooks:[
      {courseId:'calc',name:'aula.xopp',path:'fake/aula.xopp',folder:'',mtimeMs:1},
    ]}));
    ipcMain.removeHandler('notebooks-ink-status');
    ipcMain.handle('notebooks-ink-status',async()=>({status:'no-model',pagesRead:0,enabled:false}));
  });

  /* ---------- achado 1: "Instalando…" do plugin (claro e escuro) ---------- */
  await setTheme(page,'light');
  await openAbout(page);
  await page.locator('.component-plugin-install').click();
  await pollUntil(()=>page.evaluate(()=>{
    const button=document.querySelector('.component-plugin-install');
    return {
      busy:button?.getAttribute('aria-busy')||'',
      disabled:button?.disabled??null,
      label:button?.textContent?.trim()||'',
    };
  }),value=>value.busy==='true',{what:'o "Instalando…" entrar em voo (aria-busy="true")'});
  for(const theme of ['light','dark']){
    await setTheme(page,theme);
    await check('plugin',async()=>{
      const busy=await page.evaluate(()=>{
        const button=document.querySelector('.component-plugin-install');
        return {busy:button?.getAttribute('aria-busy')||'',disabled:button?.disabled??null,label:button?.textContent?.trim()||''};
      });
      assert.equal(busy.disabled,true,`${theme}: o "Instalando…" continua desabilitado durante o pedido`);
      assert.equal(busy.busy,'true',`${theme}: o "Instalando…" continua com aria-busy="true"`);
      assert.equal(busy.label,'Instalando…',`${theme}: o rótulo de progresso continua "Instalando…" (veio ${JSON.stringify(busy.label)})`);
      await assertLegible(page,'.component-plugin-install','o "Instalando…" do plugin',theme);
    });
  }
  await ctx.app.evaluate(()=>globalThis.__dlPluginRelease?.());
  await pollUntil(()=>page.evaluate(()=>document.querySelector('.component-plugin-install')?.getAttribute('aria-busy')),value=>value==='false',{what:'a instalação falsa terminar'});

  /* ---------- achado 1 da rodada 6: "Instalar plugin" desabilitado no erro ---------- */
  await ctx.app.evaluate(({ipcMain})=>{
    ipcMain.removeHandler('xournal-plugin-install');
    ipcMain.handle('xournal-plugin-install',async()=>{throw new Error('falha falsa de instalação');});
  });
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('desk-xournal-plugin-install')));
  await pollUntil(()=>page.evaluate(()=>!!document.querySelector('.component-plugin-error')&&document.querySelector('.component-plugin-install')?.disabled===true),Boolean,{what:'o erro inline com o "Instalar plugin" desabilitado'});
  for(const theme of ['light','dark']){
    await setTheme(page,theme);
    await check('plugin-erro',async()=>{
      const state=await page.evaluate(()=>{const button=document.querySelector('.component-plugin-install');return {disabled:button?.disabled??null,aria:button?.getAttribute('aria-disabled')};});
      assert.deepEqual(state,{disabled:true,aria:'true'},`${theme}: no erro o "Instalar plugin" segue desabilitado`);
      await assertLegible(page,'.component-plugin-install','o "Instalar plugin" desabilitado no erro',theme);
    });
  }
  await page.evaluate(()=>document.querySelector('#about-dialog')?.close());

  /* ---------- achado 2: rótulo do interruptor da tinta (claro e escuro) ---------- */
  await openPopover(page);
  const switchFacts=await pollUntil(()=>page.evaluate(()=>{
    const button=document.querySelector('#notebooks-ink-switch');
    return {
      disabled:button?.disabled??null,
      checked:button?.getAttribute('aria-checked')??null,
      label:button?.closest('.notebooks-ink-row')?.querySelector('.notebooks-ink-switch-text')?.textContent?.trim()||'',
      aria:button?.getAttribute('aria-label')||'',
    };
  }),value=>value.disabled===true,{what:'o interruptor da tinta desabilitado sem modelo'});
  assert.equal(switchFacts.checked,'false','sem modelo, o interruptor segue desligado (aria-checked="false")');
  assert.match(switchFacts.label,/Buscar também na escrita à mão/,'o interruptor mantém o nome do controle');
  assert.equal(switchFacts.aria,'Buscar também na escrita à mão','o nome acessível do interruptor acompanha o rótulo visível');
  for(const theme of ['light','dark']){
    await setTheme(page,theme);
    await check('tinta',()=>assertLegible(page,'.notebooks-ink-switch-text','o rótulo do interruptor da tinta',theme));
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('#notebooks-pop')?.hidden===true,undefined,{timeout:5000});

  assert.deepEqual(failures,[],`as telas desabilitadas ficam legíveis (≥4,5:1) no claro e no escuro:\n${failures.join('\n')}`);
  assert.deepEqual(errors,[],'nenhum erro de página');
  console.log('notebooks-disabled-legible-ui: PASS — "Instalando…", "Instalar plugin" desabilitado no erro e o rótulo do interruptor da tinta ficam com opacidade cheia e ≥4,5:1 no claro e no escuro, sem perder disabled/aria-busy/aria-checked.');
});
