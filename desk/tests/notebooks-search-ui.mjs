// node tests/notebooks-search-ui.mjs — busca no texto digitado dos cadernos
// (#158, passo 1, grátis): o campo de busca no popover de cadernos devolve
// caderno, página e trecho dos `.xopp` da biblioteca (sem diferenciar caixa e
// acento) e o clique abre o caderno pela ação de abrir já existente.
// Medido na janela real, nos dois temas, em 1440×900 e 900×650. Capturas
// para olho humano em tests/artifacts/busca-cadernos (fora do git).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
  screenshotDirectory,setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {layoutStable,pollUntil} from './waits.mjs';

const out=screenshotDirectory('busca-cadernos');
const resize=async(ctx,page,width,height)=>{
  await resizeWindow(ctx.app,page,width,height,{content:true});
  await layoutStable(page,'main');
};

/* Contraste AA (revisão #158): a cor computada do <mark> ganha o fundo
   semitransparente composto sobre o popover elevado; o placeholder vai
   sobre o fundo do campo. */
function parseColor(value){
  const match=String(value).match(/rgba?\(([^)]+)\)/);
  if(!match)return {rgb:[0,0,0],alpha:1};
  const parts=match[1].replace(/\//g,' ').split(/[,\s]+/).filter(Boolean).map(Number);
  return {rgb:parts.slice(0,3),alpha:parts.length>3?parts[3]:1};
}
function compositeOver(top,under){
  return top.rgb.map((channel,i)=>Math.round(channel*top.alpha+under.rgb[i]*(1-top.alpha)));
}
function luminance(rgb){
  const [r,g,b]=rgb.map(channel=>{const v=channel/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;});
  return 0.2126*r+0.7152*g+0.0722*b;
}
function contrastRatio(a,b){
  const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (hi+0.05)/(lo+0.05);
}

function xmlPaginas(pages) {
  const body = pages.map((texts) => {
    const boxes = texts.map((text, index) => `<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="${100 + index * 40}.00">${text}</text>`).join('\n');
    return `<page width="589.00" height="845.00">\n<background type="solid" color="#ffffffff" style="lined"/>\n<layer>\n${boxes}\n</layer>\n</page>`;
  }).join('\n');
  return `<?xml version="1.0" standalone="no"?>\n<xournal version="4">\n${body}\n</xournal>\n`;
}

/* Matéria com dois `.xopp` reais (gzip de XML): o índice lê o conteúdo, então
   o nome sozinho não basta — a busca tem que achar o texto digitado. */
function seed(tag){
  const runtime=newRuntime(tag);
  const calc=seedCourse(runtime,'calc');
  const pdf=path.join(calc,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
  const aula=path.join(calc,'aula.xopp'),revisao=path.join(calc,'revisao.xopp');
  fs.writeFileSync(aula,zlib.gzipSync(xmlPaginas([['Equação do primeiro grau'],['Continuidade']]),'utf8'));
  fs.writeFileSync(revisao,zlib.gzipSync(xmlPaginas([['x^2 + y^2'],['treino']]),'utf8'));
  const now=new Date();
  fs.utimesSync(aula,now,now);fs.utimesSync(revisao,now,now);
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

await withArtifacts('notebooks-search',async ctx=>{
  const {runtime,aula}=ctx.seed=seed('notebooks-search');
  ctx.runtime=runtime;
  ctx.app=await launchDesk({runtime});
  const page=await ctx.app.firstWindow();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await resize(ctx,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas',{timeout:30000});

  /* O abrir do Xournal++ é falso no IPC (o mesmo molde do notebooks-ui); a
     busca roda de verdade no main, sobre os `.xopp` do runtime. */
  await ctx.app.evaluate(({ipcMain})=>{
    globalThis.__opened=[];
    ipcMain.removeHandler('notebooks-open');
    ipcMain.handle('notebooks-open',async(_event,payload)=>{globalThis.__opened.push(payload);return {ok:true,path:payload.path};});
  });

  for(const [width,height] of [[1440,900],[900,650]]){
    await resize(ctx,page,width,height);
    for(const theme of ['light','dark']){
      await setTheme(page,theme);
      const tag=`${theme} ${width}x${height}`;
      await openPopover(page);
      const field=page.locator('#notebooks-search');
      await field.waitFor({state:'visible',timeout:5000});
      assert.ok(await field.isVisible(),`${tag}: o campo de busca aparece no popover`);
      await field.fill('EQUACAO');
      await page.locator('.notebooks-row').first().waitFor({timeout:10000});
      await page.locator('.notebooks-search-row').first().waitFor({timeout:10000});
      const rows=await page.locator('.notebooks-search-row').allTextContents();
      assert.equal(rows.length,1,`${tag}: "EQUACAO" acha uma página só (${JSON.stringify(rows)})`);
      assert.match(rows[0],/aula\.xopp/,`${tag}: o resultado mostra o caderno (${rows[0]})`);
      assert.match(rows[0],/página 1/,`${tag}: o resultado mostra a página (${rows[0]})`);
      assert.match(rows[0],/Equação do primeiro grau/,`${tag}: o resultado mostra o trecho (${rows[0]})`);
      assert.doesNotMatch(rows[0],/revisao\.xopp/,`${tag}: o outro caderno não aparece`);
      const order=await page.evaluate(()=>{
        const top=selector=>document.querySelector(selector)?.getBoundingClientRect().top??null;
        const hit=document.querySelector('.notebooks-search-row');
        return {
          searchTop:top('#notebooks-search'),
          statusTop:top('.notebooks-search-status'),
          hitTop:top('.notebooks-search-row'),
          inkTop:top('.notebooks-ink'),
          titleSize:hit?getComputedStyle(hit.querySelector('.notebooks-title')).fontSize:null,
          excerptSize:hit?getComputedStyle(hit.querySelector('.notebooks-excerpt')).fontSize:null,
          hitLabel:hit?.getAttribute('aria-label')??null,
        };
      });
      assert.ok(order.searchTop<order.hitTop&&order.hitTop<order.inkTop,`${tag}: com resultados a ordem é busca → resultado → tinta (${JSON.stringify(order)})`);
      assert.equal(order.titleSize,'14px',`${tag}: o título do resultado usa 14px (cadernos.html)`);
      assert.equal(order.excerptSize,'14px',`${tag}: o trecho do resultado usa 14px (cadernos.html)`);
      assert.match(order.hitLabel||'',/^aula\.xopp, Cálculo I, página 1$/,`${tag}: o nome acessível do resultado separa caderno, matéria e página (F20): ${JSON.stringify(order.hitLabel)}`);
      const described=await page.evaluate(()=>{
        const row=document.querySelector('.notebooks-search-row');
        const id=row?.getAttribute('aria-describedby')||'';
        const target=id?document.getElementById(id):null;
        return {id,text:target?.textContent||''};
      });
      assert.ok(described.id,`${tag}: o resultado aponta a descrição do trecho em aria-describedby (N3)`);
      assert.equal(described.text,'Equação do primeiro grau',`${tag}: a descrição acessível do resultado é o trecho que casou (N3): ${JSON.stringify(described.text)}`);
      const box=await page.locator('#notebooks-pop').boundingBox();
      assert.ok(box&&box.width>0&&box.height>0&&box.x+box.width<=width+0.5&&box.y+box.height<=height+0.5,`${tag}: popover dentro da janela (${JSON.stringify(box)})`);
      const contrast=await page.evaluate(()=>{
        const mark=document.querySelector('.notebooks-excerpt mark');
        const input=document.querySelector('#notebooks-search');
        const pop=document.querySelector('#notebooks-pop');
        const probe=document.createElement('i');probe.style.cssText='position:fixed;background:var(--highlight)';document.body.append(probe);
        const highlight=getComputedStyle(probe).backgroundColor;probe.remove();
        /* O realce é color-mix em oklch: o Chromium serializa a cor fora de
           rgb(), então o teste resolve pelo canvas antes de medir. */
        const resolve=value=>{
          if(!value)return null;
          const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;
          const ctx=canvas.getContext('2d');ctx.fillStyle=value;ctx.fillRect(0,0,1,1);
          const [r,g,b,a]=ctx.getImageData(0,0,1,1).data;
          return `rgba(${r}, ${g}, ${b}, ${a/255})`;
        };
        return {
          markColor:resolve(mark?getComputedStyle(mark).color:null),
          markBg:resolve(mark?getComputedStyle(mark).backgroundColor:null),
          popBg:resolve(pop?getComputedStyle(pop).backgroundColor:null),
          phColor:resolve(input?getComputedStyle(input,'::placeholder').color:null),
          inputBg:resolve(input?getComputedStyle(input).backgroundColor:null),
          fieldBorder:input?getComputedStyle(input).borderTopWidth:null,
          highlight:resolve(highlight),
          findMarkSoft:getComputedStyle(document.documentElement).getPropertyValue('--find-mark-soft').trim(),
        };
      });
      assert.equal(contrast.fieldBorder,'0px',`${tag}: a busca é um campo sem borda (cadernos.html)`);
      assert.equal(await page.locator('#notebooks-search').evaluate(el=>el.getBoundingClientRect().height),40,`${tag}: a busca tem 40px de altura (r2)`);
      assert.equal(await page.locator('#notebooks-search').evaluate(el=>getComputedStyle(el).fontSize),'14px',`${tag}: a busca usa 14px (r2)`);
      assert.equal(await page.locator('.notebooks-search-field .guide-search-icon svg').count(),1,`${tag}: a busca tem a lupa (r2)`);
      assert.notEqual(contrast.inputBg,'rgba(0, 0, 0, 0)',`${tag}: a busca é um campo preenchido (${contrast.inputBg})`);
      assert.equal(contrast.markBg,contrast.highlight,`${tag}: o realce da busca vem de --highlight (${contrast.markBg})`);
      assert.equal(contrast.findMarkSoft,'',`${tag}: --find-mark-soft saiu do app`);
      assert.ok(contrast.markColor&&contrast.markBg&&contrast.popBg,`${tag}: há <mark> para medir o contraste`);
      const markEffective=compositeOver(parseColor(contrast.markBg),parseColor(contrast.popBg));
      const markRatio=contrastRatio(parseColor(contrast.markColor).rgb,markEffective);
      assert.ok(markRatio>=4.5,`${tag}: o <mark> passa de 4,5:1 (medido ${markRatio.toFixed(2)}:1)`);
      assert.ok(contrast.phColor&&contrast.inputBg,`${tag}: há placeholder para medir o contraste`);
      const phRatio=contrastRatio(parseColor(contrast.phColor).rgb,parseColor(contrast.inputBg).rgb);
      assert.ok(phRatio>=4.5,`${tag}: o placeholder passa de 4,5:1 (medido ${phRatio.toFixed(2)}:1)`);
      await page.screenshot({path:path.join(out,`busca-cadernos-${theme}-${width}.png`)});
      await page.locator('.notebooks-search-row').first().hover();
      const hover=await page.evaluate(()=>{
        const row=document.querySelector('.notebooks-search-row');
        const meta=row?.querySelector('.notebooks-meta');
        const pop=document.querySelector('#notebooks-pop');
        return {
          metaColor:meta?getComputedStyle(meta).color:null,
          rowBg:row?getComputedStyle(row).backgroundColor:null,
          popBg:pop?getComputedStyle(pop).backgroundColor:null,
        };
      });
      assert.ok(hover.metaColor&&hover.rowBg&&hover.popBg,`${tag}: há meta e fundo para medir o contraste no hover (N8)`);
      const hoverBg=compositeOver(parseColor(hover.rowBg),parseColor(hover.popBg));
      const hoverRatio=contrastRatio(parseColor(hover.metaColor).rgb,hoverBg);
      assert.ok(hoverRatio>=4.5,`${tag}: a meta do resultado passa de 4,5:1 no hover (medido ${hoverRatio.toFixed(2)}:1, N8)`);
      await page.mouse.move(0,0);
      await closePopover(page);
    }
  }

  /* O clique no resultado abre o caderno pela ação de abrir existente. */
  await openPopover(page);
  assert.equal(await page.locator('#notebooks-search').getAttribute('placeholder'),'Buscar nos cadernos','placeholder curto do r2 (M4)');
  await page.locator('#notebooks-search').fill('continuidade');
  await page.locator('.notebooks-search-row').first().waitFor({timeout:10000});
  await page.locator('.notebooks-search-row').first().click();
  await page.waitForFunction(()=>globalThis.__opened?.length===1,undefined,{timeout:5000}).catch(async()=>{});
  const opened=await ctx.app.evaluate(()=>globalThis.__opened);
  assert.deepEqual(opened,[{courseId:'calc',path:aula,page:2}],'o clique no resultado abre o caderno na página do trecho (F7)');
  await page.waitForFunction(()=>document.querySelector('#notebooks-pop')?.hidden===true,undefined,{timeout:5000});

  /* Busca sem resultado mostra o texto de vazio; limpar volta à lista. */
  await openPopover(page);
  await page.locator('#notebooks-search').fill('zzz sem match');
  await page.locator('.notebooks-search-empty').waitFor({timeout:10000});
  const emptyText=await page.locator('.notebooks-search-empty').textContent();
  assert.equal(emptyText,'Nenhum resultado. Tente outro termo.','a busca sem resultado tem uma mensagem só, completa (F6)');
  assert.equal(await page.locator('.notebooks-search-empty').count(),1,'há uma única mensagem de vazio (F6)');
  const emptyStatus=await page.locator('#notebooks-pop [role="status"]').textContent();
  assert.equal(emptyStatus,emptyText,'o status acessível é a mesma mensagem de vazio, sem texto duplicado (F6)');
  assert.equal(await page.evaluate(()=>document.querySelectorAll('#notebooks-list .notebooks-search-empty').length),0,'a mensagem de vazio não mora dentro da lista (F6)');
  await page.locator('#notebooks-search').fill('');
  await page.locator('.notebooks-row').first().waitFor({timeout:10000});
  await closePopover(page);

  /* Comportamento da busca com IPC falso (o índice real já foi verificado
     acima e nos testes .test.mjs): o list conta as chamadas e a search tem
     atraso controlado por consulta — lenta 700ms, espera 500ms, resto 80ms. */
  await ctx.app.evaluate(({ipcMain})=>{
    globalThis.__listCalls=0;
    globalThis.__searchCalls=[];
    ipcMain.removeHandler('notebooks-list');
    ipcMain.handle('notebooks-list',async()=>{
      globalThis.__listCalls+=1;
      return {notebooks:[
        {courseId:'calc',name:'aula.xopp',path:'fake/aula.xopp',folder:'',mtimeMs:1},
        {courseId:'calc',name:'revisao.xopp',path:'fake/revisao.xopp',folder:'',mtimeMs:2},
      ]};
    });
    ipcMain.removeHandler('notebooks-search');
    ipcMain.handle('notebooks-search',async(_event,query)=>{
      globalThis.__searchCalls.push(query);
      const wait=query==='lenta'?700:query==='espera'?500:80;
      await new Promise(done=>setTimeout(done,wait)); /* espera fixa: o IPC falso simula busca lenta e rápida */
      if(query==='lenta')return [{caminho:'fake/aula.xopp',nomeExibido:'aula.xopp',materia:'Cálculo I',pagina:1,trecho:'trecho lento alvo'}];
      if(query==='rapida')return [{caminho:'fake/revisao.xopp',nomeExibido:'revisao.xopp',materia:'Cálculo I',pagina:2,trecho:'trecho rapido alvo'}];
      if(query==='espera')return [
        {caminho:'fake/aula.xopp',nomeExibido:'aula.xopp',materia:'Cálculo I',pagina:1,trecho:'espera um alvo'},
        {caminho:'fake/revisao.xopp',nomeExibido:'revisao.xopp',materia:'Cálculo I',pagina:2,trecho:'espera dois alvo'},
      ];
      if(query==='alvo')return [{caminho:'fake/aula.xopp',nomeExibido:'aula.xopp',materia:'Cálculo I',pagina:1,trecho:'<img src=x onerror=alert(1)> alvo aqui'}];
      return [];
    });
  });
  const searchCalls=()=>ctx.app.evaluate(()=>globalThis.__searchCalls.length);
  const listCalls=()=>ctx.app.evaluate(()=>globalThis.__listCalls);

  /* Ao abrir, o foco vai para o campo de busca; a busca reutiliza o mapa já
     carregado (um list só) e anuncia "Buscando…"/"N resultados" no status. */
  await openPopover(page);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'notebooks-search','ao abrir, o foco vai para #notebooks-search');
  assert.equal(await listCalls(),1,'abrir a lista chama o list uma vez só');
  await layoutStable(page,'#notebooks-pop');
  const popHeightBefore=(await page.locator('#notebooks-pop').boundingBox())?.height;
  assert.ok(popHeightBefore&&popHeightBefore>0,'altura do popover antes da busca');
  await page.locator('#notebooks-search').fill('espera');
  await pollUntil(searchCalls,total=>total>=1,{what:'a busca "espera" chegar ao IPC'});
  const during=await page.evaluate(()=>({
    height:document.querySelector('#notebooks-pop')?.getBoundingClientRect().height||0,
    rows:document.querySelectorAll('.notebooks-row, .notebooks-search-row').length,
  }));
  assert.ok(during.height>=popHeightBefore-4,`"Buscando…" não encolhe o popover: antes ${Math.round(popHeightBefore)}px, durante ${Math.round(during.height)}px`);
  assert.ok(during.rows>0,`"Buscando…" mantém as linhas anteriores (vi ${during.rows})`);
  assert.equal(await page.locator('#notebooks-pop [role="status"]').textContent(),'Buscando…','enquanto espera, um elemento role=status anuncia "Buscando…"');
  const spinner=await page.evaluate(()=>{
    const dots=document.querySelector('.notebooks-search-status .ts-dots');
    return {present:!!dots,count:dots?dots.children.length:0,hidden:dots?.getAttribute('aria-hidden')||''};
  });
  assert.equal(spinner.present,true,'"Buscando…" mostra o indicador de 3 pontos da instalação do plugin (N10)');
  assert.equal(spinner.count,3,'o indicador de "Buscando…" tem 3 pontos (N10)');
  assert.equal(spinner.hidden,'true','o indicador de "Buscando…" fica fora do texto lido (aria-hidden, N10)');
  await page.locator('.notebooks-search-row').first().waitFor({timeout:10000});
  assert.equal(await page.locator('#notebooks-pop [role="status"]').textContent(),'2 resultados','o status conta os resultados quando a busca termina');
  const countStatus=await page.locator('#notebooks-pop [role="status"]').evaluate(el=>{
    const box=el.getBoundingClientRect();
    return {srOnly:el.classList.contains('sr-only'),width:box.width,height:box.height};
  });
  assert.equal(countStatus.srOnly,true,'a contagem "N resultados" fica só para leitor de tela (classe sr-only)');
  assert.ok(countStatus.width<=2&&countStatus.height<=2,`a contagem some da tela (${countStatus.width}×${countStatus.height})`);
  assert.equal(await listCalls(),1,'a busca não chama o list de novo para o mapa das matérias');

  /* Com prefers-reduced-motion os pontos do "Buscando…" não animam (N10). */
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{
    for(const style of document.querySelectorAll('style')){
      if(style.textContent.includes('caret-color:transparent'))style.remove();
    }
  });
  await page.locator('#notebooks-search').fill('lenta');
  await page.waitForSelector('.notebooks-search-status .ts-dots',{timeout:10000});
  const reduced=await page.evaluate(()=>{
    const dot=document.querySelector('.notebooks-search-status .ts-dots span');
    return dot?getComputedStyle(dot).animationName:null;
  });
  assert.equal(reduced,'none','com prefers-reduced-motion os pontos de "Buscando…" não animam (N10)');
  await page.locator('.notebooks-search-row').first().waitFor({timeout:10000});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});

  /* Sem resultado, o status diz que não achou nada. */
  await page.locator('#notebooks-search').fill('vazia');
  await page.locator('.notebooks-search-empty').waitFor({timeout:10000});
  assert.match(await page.locator('#notebooks-pop [role="status"]').textContent(),/Nenhum/,'sem resultado, o status avisa "Nenhum…"');
  assert.equal(await listCalls(),1,'a busca vazia também não relista');

  /* Corrida: a busca lenta chega depois e não pode pintar por cima da rápida. */
  const beforeRace=await searchCalls();
  await page.locator('#notebooks-search').fill('lenta');
  await pollUntil(searchCalls,total=>total>beforeRace,{what:'a busca lenta chegar ao IPC'});
  await page.locator('#notebooks-search').fill('rapida');
  await page.locator('.notebooks-search-row').first().waitFor({timeout:10000});
  await new Promise(done=>setTimeout(done,1200)); /* espera fixa: prova que a resposta lenta, que chega depois, não pinta a lista */
  const raced=await page.locator('.notebooks-search-row').allTextContents();
  assert.equal(raced.length,1,`a lista final mostra só o resultado da segunda busca (${JSON.stringify(raced)})`);
  assert.match(raced[0],/trecho rapido alvo/,'o resultado final é o da busca rápida');
  assert.doesNotMatch(raced[0],/trecho lento/,'o resultado da busca lenta não pinta por cima');
  assert.equal(await page.locator('#notebooks-pop [role="status"]').textContent(),'1 resultado','o status conta só a busca que venceu a corrida');

  /* Fechar durante o debounce (150ms) não dispara a busca: o Escape vai
     síncrono pelo evaluate para não depender da latência do press. */
  const beforeClose=await searchCalls();
  await page.locator('#notebooks-search').fill('fechar');
  await page.evaluate(()=>{document.querySelector('#notebooks-pop')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));});
  await page.waitForFunction(()=>document.querySelector('#notebooks-pop')?.hidden===true,undefined,{timeout:5000});
  await new Promise(done=>setTimeout(done,600)); /* espera fixa: prova que o debounce não dispara a busca depois de fechar */
  assert.equal(await searchCalls(),beforeClose,'fechar durante o debounce não dispara a busca');

  /* Fechar enquanto a busca espera: a resposta tardia não pinta. */
  await openPopover(page);
  const beforeFlight=await searchCalls();
  await page.locator('#notebooks-search').fill('lenta');
  await pollUntil(searchCalls,total=>total>beforeFlight,{what:'a busca lenta chegar ao IPC'});
  await closePopover(page);
  await new Promise(done=>setTimeout(done,1200)); /* espera fixa: prova que a resposta em voo não reabre nem pinta nada */
  const staleText=await page.evaluate(()=>document.querySelector('#notebooks-pop')?.textContent||'');
  assert.doesNotMatch(staleText,/trecho lento/,'fechar enquanto a busca espera impede a resposta tardia de pintar');
  assert.equal(await page.evaluate(()=>document.querySelector('#notebooks-pop')?.hidden),true,'a resposta tardia não reabre o popover');

  /* Destaque: o termo vai num <mark> por createElement/textContent; o trecho
     com HTML aparece como texto literal, sem criar o elemento. */
  await openPopover(page);
  await page.locator('#notebooks-search').fill('alvo');
  await page.locator('.notebooks-search-row').first().waitFor({timeout:10000});
  const highlight=await page.evaluate(()=>{
    const row=document.querySelector('.notebooks-search-row');
    const excerpt=row?.querySelector('.notebooks-excerpt');
    return {mark:excerpt?.querySelector('mark')?.textContent||null,img:excerpt?.querySelector('img')?1:0,text:excerpt?.textContent||''};
  });
  assert.equal(highlight.mark,'alvo','o termo buscado aparece num <mark>');
  assert.equal(highlight.img,0,'o trecho com <img> não cria elemento de imagem');
  assert.match(highlight.text,/<img src=x onerror=alert\(1\)>/,'o trecho com HTML aparece como texto literal');
  await closePopover(page);
  assert.deepEqual(errors,[],'nenhum erro de página');
});

console.log('notebooks-search-ui: PASS — busca sem diferenciar caixa/acento nos dois temas, 1440×900 e 900×650; clique abre via openNotebook (fake); comportamento com IPC falso (foco, mapa sem relistar, "Buscando…" em role=status, corrida lenta×rápida, fechar no debounce/em voo, mark sem virar HTML).');
