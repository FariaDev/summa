// node tests/notebooks-search-rodada4-ui.mjs — consertos dos achados 1 e 2 da
// rodada 4 de UI/UX (#158): durante "Buscando…" as linhas antigas continuam
// legíveis (≥4,5:1 no texto, claro e escuro) e inertes (sem clique nem foco),
// com `aria-busy="true"` na lista; e o "×" nativo do `input[type=search]` dá
// lugar a um botão de limpar próprio, ≥24×24, com rótulo acessível, na rota de
// Tab logo depois do campo, visível só com texto. Medido na janela real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
  screenshotDirectory,setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const out=screenshotDirectory('busca-cadernos-rodada4');
const resize=async(ctx,page,width,height)=>{
  await resizeWindow(ctx.app,page,width,height,{content:true});
};

function seed(tag){
  const runtime=newRuntime(tag);
  const calc=seedCourse(runtime,'calc');
  const pdf=path.join(calc,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
  const aula=path.join(calc,'aula.xopp');fs.writeFileSync(aula,'caderno de teste');
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:calc}]});
  writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
  return {runtime,aula};
}

const openPopover=async page=>{
  if(await page.evaluate(()=>document.querySelector('#chat-more-pop')?.hidden!==false))await page.locator('#chat-more').click();
  await page.locator('#more-notebooks').click();
  await page.locator('#notebooks-pop').waitFor({state:'visible',timeout:5000});
  await page.locator('.notebooks-row').first().waitFor({timeout:10000});
};
const closePopover=async page=>{
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('#notebooks-pop')?.hidden===true,undefined,{timeout:5000});
};

/* Contraste efetivo: multiplica a opacidade do texto e dos ancestrais até o
   popover; a cor do texto é composta sobre o fundo opaco do popover. Assim a
   regra antiga (`opacity:.5` na lista) reprova mesmo com `color` intacta. */
const measureSearching=page=>page.evaluate(()=>{
  const parse=value=>{
    const match=String(value).match(/rgba?\(([^)]+)\)/);
    if(!match)return {rgb:[0,0,0],alpha:1};
    const parts=match[1].replace(/\//g,' ').split(/[,\s]+/).filter(Boolean).map(Number);
    return {rgb:parts.slice(0,3),alpha:parts.length>3?parts[3]:1};
  };
  const luminance=rgb=>{
    const [r,g,b]=rgb.map(channel=>{const v=channel/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;});
    return 0.2126*r+0.7152*g+0.0722*b;
  };
  const contrastRatio=(a,b)=>{
    const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);
    return (hi+0.05)/(lo+0.05);
  };
  const list=document.querySelector('#notebooks-list');
  const pop=document.querySelector('#notebooks-pop');
  const row=document.querySelector('.notebooks-row');
  const title=row?.querySelector('.notebooks-title');
  const meta=row?.querySelector('.notebooks-meta');
  const alphaOf=element=>{
    let alpha=1;
    for(let node=element;node;node=node.parentElement){
      alpha*=Number(getComputedStyle(node).opacity)||1;
      if(node===pop)break;
    }
    return alpha;
  };
  const bg=parse(getComputedStyle(pop).backgroundColor);
  const effective=color=>color.rgb.map((channel,index)=>Math.round(channel*alphaOf(color.element)+bg.rgb[index]*(1-alphaOf(color.element))));
  const ratio=element=>contrastRatio(effective({rgb:parse(getComputedStyle(element).color).rgb,element}),bg.rgb);
  return {
    busy:list?.getAttribute('aria-busy')??null,
    inert:!!list?.inert,
    listOpacity:list?getComputedStyle(list).opacity:null,
    titleRatio:title?ratio(title):null,
    metaRatio:meta?ratio(meta):null,
  };
});

await withArtifacts('notebooks-search-rodada4',async ctx=>{
  const {runtime}=ctx.seed=seed('notebooks-search-rodada4');
  ctx.runtime=runtime;
  ctx.app=await launchDesk({runtime});
  const page=await ctx.app.firstWindow();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await resize(ctx,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas',{timeout:30000});

  /* O IPC falso guarda a busca "segura" até o teste medir o estado em voo;
     o abrir do Xournal++ também é falso, como nos testes irmãos. */
  await ctx.app.evaluate(({ipcMain})=>{
    globalThis.__opened=[];
    globalThis.__searchCalls=[];
    ipcMain.removeHandler('notebooks-open');
    ipcMain.handle('notebooks-open',async(_event,payload)=>{globalThis.__opened.push(payload);return {ok:true,path:payload.path};});
    ipcMain.removeHandler('notebooks-list');
    ipcMain.handle('notebooks-list',async()=>({notebooks:[
      {courseId:'calc',name:'aula.xopp',path:'fake/aula.xopp',folder:'',mtimeMs:1},
      {courseId:'calc',name:'revisao.xopp',path:'fake/revisao.xopp',folder:'',mtimeMs:2},
    ]}));
    ipcMain.removeHandler('notebooks-search');
    ipcMain.handle('notebooks-search',async(_event,query)=>{
      globalThis.__searchCalls.push(query);
      if(query==='segura')await new Promise(resolve=>{globalThis.__releaseSearch=resolve;});
      return [{caminho:'fake/aula.xopp',nomeExibido:'aula.xopp',materia:'Cálculo I',pagina:1,trecho:'Equação segura'}];
    });
  });
  const openedCount=()=>ctx.app.evaluate(()=>globalThis.__opened.length);

  for(const theme of ['light','dark']){
    await setTheme(page,theme);
    const tag=theme;
    await openPopover(page);
    const field=page.locator('#notebooks-search');
    await field.waitFor({state:'visible',timeout:5000});
    await ctx.app.evaluate(()=>{globalThis.__releaseSearch=null;});
    await field.fill('segura');
    await pollUntil(()=>page.evaluate(()=>document.querySelector('#notebooks-list')?.getAttribute('aria-busy')),value=>value==='true',{what:`${tag}: a lista entrar em aria-busy`});
    await pollUntil(()=>ctx.app.evaluate(()=>typeof globalThis.__releaseSearch),value=>value==='function',{what:`${tag}: a busca "segura" chegar ao IPC`});
    const searching=await measureSearching(page);
    assert.equal(searching.busy,'true',`${tag}: a lista anuncia aria-busy="true" enquanto busca (veio ${JSON.stringify(searching.busy)})`);
    assert.equal(searching.inert,true,`${tag}: as linhas antigas ficam inertes enquanto busca`);
    assert.equal(searching.listOpacity,'1',`${tag}: a lista não apaga o texto com opacity (veio ${searching.listOpacity})`);
    assert.ok(searching.titleRatio>=4.5,`${tag}: o título da linha preservada passa de 4,5:1 durante a busca (medido ${searching.titleRatio?.toFixed(2)}:1)`);
    assert.ok(searching.metaRatio>=4.5,`${tag}: a meta da linha preservada passa de 4,5:1 durante a busca (medido ${searching.metaRatio?.toFixed(2)}:1)`);
    const inertFocus=await page.evaluate(()=>{
      const row=document.querySelector('.notebooks-row');
      row?.focus();
      const rect=row?.getBoundingClientRect();
      return {focused:document.activeElement===row,rect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null};
    });
    assert.equal(inertFocus.focused,false,`${tag}: a linha preservada não recebe foco enquanto busca`);
    if(inertFocus.rect){
      await page.mouse.click(inertFocus.rect.x+inertFocus.rect.width/2,inertFocus.rect.y+inertFocus.rect.height/2);
      // espera fixa: o clique inerte não tem evento positivo; 200 ms é o prazo para um open indevido chegar ao IPC
      await page.waitForTimeout(200);
      assert.equal(await openedCount(),0,`${tag}: o clique na linha preservada não abre o caderno enquanto busca`);
    }
    await page.screenshot({path:path.join(out,`buscando-${theme}.png`)});
    await ctx.app.evaluate(()=>globalThis.__releaseSearch?.());
    await page.locator('.notebooks-search-row').first().waitFor({timeout:10000});
    const settled=await page.evaluate(()=>({
      busy:document.querySelector('#notebooks-list')?.getAttribute('aria-busy')??null,
      inert:!!document.querySelector('#notebooks-list')?.inert,
    }));
    assert.equal(settled.busy,null,`${tag}: ao terminar a busca, a lista perde o aria-busy`);
    assert.equal(settled.inert,false,`${tag}: ao terminar a busca, a lista deixa de ser inerte`);

    /* O "×" próprio substitui o nativo: alvo ≥24×24, rótulo acessível, ícone
       do repo, na rota de Tab logo depois do campo. */
    const clearFacts=await page.evaluate(()=>{
      const button=document.querySelector('#notebooks-search-clear');
      const rect=button?.getBoundingClientRect();
      return {
        hidden:button?.hidden??null,
        label:button?.getAttribute('aria-label')??null,
        width:rect?.width??0,
        height:rect?.height??0,
        icon:!!button?.querySelector('svg.icon'),
      };
    });
    assert.equal(clearFacts.hidden,false,`${tag}: com texto no campo, o botão de limpar aparece`);
    assert.ok(clearFacts.width>=24&&clearFacts.height>=24,`${tag}: o alvo do limpar mede ≥24×24 (medido ${clearFacts.width}×${clearFacts.height})`);
    assert.equal(clearFacts.label,'Limpar busca',`${tag}: o botão de limpar tem nome acessível "Limpar busca" (veio ${JSON.stringify(clearFacts.label)})`);
    assert.equal(clearFacts.icon,true,`${tag}: o botão de limpar usa o ícone de fechar do repo`);
    await page.locator('#notebooks-search').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'notebooks-search-clear',`${tag}: o Tab vai do campo direto ao botão de limpar`);
    await page.locator('#notebooks-search-clear').click();
    await page.waitForFunction(()=>document.querySelector('#notebooks-search')?.value==='',undefined,{timeout:5000});
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'notebooks-search',`${tag}: limpar devolve o foco ao campo`);
    assert.equal(await page.evaluate(()=>document.querySelector('#notebooks-search-clear')?.hidden),true,`${tag}: sem texto, o botão de limpar volta a ficar oculto`);
    await page.locator('.notebooks-row').first().waitFor({timeout:10000});
    await closePopover(page);
  }

  /* O cancelar nativo do Chromium fica escondido; o próprio botão é o único ×. */
  const cancelRule=await page.evaluate(()=>{
    const flatten=sheet=>{
      try{return [...sheet.cssRules].flatMap(rule=>rule.styleSheet?flatten(rule.styleSheet):[rule]);}catch{return [];}
    };
    const rules=[...document.styleSheets].flatMap(flatten);
    return rules.some(rule=>String(rule.cssText).includes('::-webkit-search-cancel-button')&&/appearance:\s*none/.test(String(rule.cssText)));
  });
  assert.equal(cancelRule,true,'a folha carregada esconde o ::-webkit-search-cancel-button do campo de busca');

  /* Em inglês o rótulo acompanha o idioma. */
  await openPopover(page);
  await page.locator('#notebooks-search').fill('EQUACAO');
  await page.locator('.notebooks-search-row').first().waitFor({timeout:10000});
  await page.evaluate(async()=>{const {setUiLanguage}=await import('./src/ui-text.mjs');await setUiLanguage('en');});
  assert.equal(await page.locator('#notebooks-search-clear').getAttribute('aria-label'),'Clear search','em inglês, o botão de limpar vira "Clear search"');
  await page.evaluate(async()=>{const {setUiLanguage}=await import('./src/ui-text.mjs');await setUiLanguage('pt-BR');});
  await closePopover(page);
  assert.deepEqual(errors,[],'nenhum erro de página');
});

console.log('notebooks-search-rodada4-ui: PASS — durante "Buscando…" as linhas seguem legíveis (≥4,5:1) e inertes, com aria-busy; o limpar próprio mede ≥24×24, tem rótulo acessível, entra no Tab depois do campo, limpa e devolve o foco.');
