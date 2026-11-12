// node tests/notebooks-ink-ui.mjs — interruptor da leitura da tinta no painel
// de cadernos (#158, #159): desligado por padrão, ligado mostra o contador e o
// estado; sem modelo pago com visão fica desabilitado com a frase do texto
// digitado. O IPC é falso (status/set), como nos outros testes de janela.
// Medido nos dois temas, em 1440×900 e 900×650; capturas em /tmp.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  withArtifacts, newRuntime, seedCourse, writeConfigJson, writeDeskJson, launchDesk, statusOnline, tinyPdf,
  setTheme, freezeMotion, resizeWindow
} from './helpers.mjs';
import {layoutStable, pollUntil} from './waits.mjs';

const resize=async(ctx,page,width,height)=>{
  await resizeWindow(ctx.app,page,width,height,{content:true});
  await layoutStable(page,'main');
};

/* Matéria com um `.xopp` de mentira: a lista não lê conteúdo, e nada de
   material de curso entra na captura. */
function seed(tag){
  const runtime=newRuntime(tag);
  const calc=seedCourse(runtime,'calc');
  const pdf=path.join(calc,'Lista.pdf');fs.writeFileSync(pdf,tinyPdf('Lista de exercícios'));
  const aula=path.join(calc,'aula-teste.xopp');fs.writeFileSync(aula,'caderno de teste');
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:calc}]});
  writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
  return {runtime,aula};
}

const openPopover=async page=>{
  if(await page.evaluate(()=>document.querySelector('#chat-more-pop')?.hidden!==false))await page.locator('#chat-more').click();
  await page.locator('#more-notebooks').click();
  await page.locator('#notebooks-pop').waitFor({state:'visible',timeout:5000});
  await page.locator('#notebooks-ink-switch').waitFor({timeout:10000});
};
const closePopover=async page=>{
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('#notebooks-pop')?.hidden===true,undefined,{timeout:5000});
};
const setUiLanguageInPage=(page,language)=>page.evaluate(async next=>{
  const {setUiLanguage}=await import('./src/ui-text.mjs');
  setUiLanguage(next);
},language);
const readPanel=page=>page.evaluate(()=>{
  const button=document.querySelector('#notebooks-ink-switch');
  const desc=document.getElementById(button?.getAttribute('aria-describedby')||'');
  const count=document.querySelector('.notebooks-ink-count');
  const state=document.querySelector('.notebooks-ink-state');
  return {
    role:button?.getAttribute('role')||null,
    checked:button?.getAttribute('aria-checked')||null,
    disabled:button?.disabled??null,
    describedBy:button?.getAttribute('aria-describedby')||'',
    label:button?.getAttribute('aria-label')||'',
    description:desc?.textContent||'',
    count:count?.hidden?'':(count?.textContent||''),
    state:state?.hidden?'':(state?.textContent||''),
    error:document.querySelector('.notebooks-ink-error')?.hidden===false?(document.querySelector('.notebooks-ink-error-text')?.textContent?.trim()||''):'',
    retry:!!document.querySelector('.notebooks-ink-retry'),
    readRetry:(()=>{
      const el=document.querySelector('.notebooks-ink-read-retry');
      return el&&!el.hidden&&el.getClientRects().length>0?el.textContent.trim():'';
    })(),
  };
});

await withArtifacts('notebooks-ink',async ctx=>{
  const {runtime}=ctx.seed=seed('notebooks-ink');
  ctx.runtime=runtime;
  ctx.app=await launchDesk({runtime});
  const page=await ctx.app.firstWindow();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  /* O teste junta as falhas da rodada 3 para que uma rodada no código antigo
     mostre todos os consertos que faltam, não só o primeiro. */
  const failures=[];
  const check=(ticket,label,ok,detail)=>{if(!ok)failures.push(`${ticket} ${label}: ${detail}`);};
  const toastShown=page=>page.evaluate(()=>[...document.querySelectorAll('#toast .toast-item')].some(el=>!el.classList.contains('out')));
  const checkNoToast=async(page,label)=>{
    // espera fixa: o prazo de 500 ms é o que a asserção testa — um toast indevido não pode aparecer nele
    await page.waitForTimeout(500);
    check('A2',label,!(await toastShown(page)),'o erro inline devia ser a mensagem única, mas o toast apareceu');
  };
  await resize(ctx,page,1440,900);
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas',{timeout:30000});

  /* IPC falso: o main recebe o estado que o teste escreve em `__mesaInkState`, e o set
     só anota o pedido e vira o interruptor. O vigia e a ponte reais não são
     tocados nesta janela. */
  await ctx.app.evaluate(({ipcMain})=>{
    globalThis.__mesaInkState={status:'no-model',pagesRead:0,enabled:false};
    globalThis.__mesaInkSets=[];
    globalThis.__mesaInkSetResult=null;
    ipcMain.removeHandler('notebooks-list');
    ipcMain.handle('notebooks-list',async()=>({notebooks:[
      {courseId:'calc',name:'aula-teste.xopp',path:'fake/aula-teste.xopp',folder:'',mtimeMs:1},
    ]}));
    ipcMain.removeHandler('notebooks-ink-status');
    ipcMain.handle('notebooks-ink-status',async()=>({...globalThis.__mesaInkState}));
    ipcMain.removeHandler('notebooks-ink-set');
    ipcMain.handle('notebooks-ink-set',async(_event,payload)=>{
      globalThis.__mesaInkSets.push(payload);
      if(globalThis.__mesaInkSetResult)return globalThis.__mesaInkSetResult;
      globalThis.__mesaInkState={...globalThis.__mesaInkState,enabled:payload?.on===true};
      return {ok:true};
    });
  });

  /* ---------- sem modelo pago com visão: desabilitado e com a frase ---------- */
  await openPopover(page);
  const noModel=await pollUntil(()=>readPanel(page),panel=>panel.disabled===true,{what:'o interruptor desabilitado sem modelo'});
  assert.equal(noModel.role,'switch','o interruptor é role=switch');
  assert.equal(noModel.checked,'false','sem modelo, aria-checked fica false');
  assert.equal(noModel.disabled,true,'sem modelo pago com visão, o interruptor fica desabilitado');
  assert.match(noModel.label,/Buscar também na escrita à mão/,'o interruptor tem o rótulo "Buscar também na escrita à mão"');
  assert.ok(noModel.describedBy,'o interruptor aponta a descrição em aria-describedby');
  assert.equal(noModel.description,'Sem modelo com visão: a busca usa só o texto digitado.','sem modelo, a descrição diz que a busca usa só o texto digitado');
  assert.equal(noModel.count,'','desligado/sem modelo não mostra contador');
  assert.equal(noModel.state,'','desligado/sem modelo não mostra estado');
  await resize(ctx,page,900,650);
  const narrow=await page.locator('#notebooks-pop').boundingBox();
  assert.ok(narrow&&narrow.width>0&&narrow.y+narrow.height<=650,`900×650: o painel cabe na janela (${JSON.stringify(narrow)})`);
  await closePopover(page);
  await resize(ctx,page,1440,900);

  /* ---------- ligado: contador e estado em cada modo ---------- */
  const setInk=mode=>ctx.app.evaluate((_electron,mode)=>{globalThis.__mesaInkState=mode;},mode);

  /* ---------- desligado e sem bloqueio: interruptor habilitado para ligar (B7) ---------- */
  await setInk({status:'idle',pagesRead:0,enabled:false});
  for(const theme of ['light','dark']){
    await setTheme(page,theme);
    await openPopover(page);
    const offIdle=await pollUntil(()=>readPanel(page),panel=>panel.checked==='false'&&panel.disabled===false,{what:'o interruptor habilitado com a leitura desligada'});
    assert.equal(offIdle.description,'As páginas com tinta vão ao seu modelo para virar texto.','desligado, a descrição é a do envio');
    const target=await page.evaluate(()=>{
      const parse=value=>String(value||'').match(/rgba?\(([^)]+)\)/)?.[1].replace(/\//g,' ').split(/[,\s]+/).filter(Boolean).slice(0,3).map(Number)||[0,0,0];
      const lum=rgb=>{
        const [r,g,b]=rgb.map(channel=>{const v=channel/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;});
        return 0.2126*r+0.7152*g+0.0722*b;
      };
      const ratio=(a,b)=>{const [hi,lo]=[lum(parse(a)),lum(parse(b))].sort((x,y)=>y-x);return (hi+0.05)/(lo+0.05);};
      const button=document.querySelector('#notebooks-ink-switch');
      const track=document.querySelector('.notebooks-ink-track');
      const section=document.querySelector('.notebooks-ink');
      const thumb=document.querySelector('.notebooks-ink-thumb');
      const trackBox=track?.getBoundingClientRect(),thumbBox=thumb?.getBoundingClientRect();
      return {
        height:button?.getBoundingClientRect().height??0,
        trackBg:track?getComputedStyle(track).backgroundColor:null,
        sectionBg:section?getComputedStyle(section).backgroundColor:null,
        trackRatio:track&&section?ratio(getComputedStyle(track).backgroundColor,getComputedStyle(section).backgroundColor):0,
        trackW:trackBox?.width??0,trackH:trackBox?.height??0,thumbW:thumbBox?.width??0,thumbH:thumbBox?.height??0,
        trackRadius:track?getComputedStyle(track).borderRadius:null,
      };
    });
    assert.equal(Math.round(target.height),20,`${theme}: o interruptor tem 20px de altura, como o desenho de 40×20 (medido ${target.height}px, r2)`);
    /* r2 (2026-11-11): o interruptor da tinta é o mesmo das Configurações, 40×20. */
    assert.deepEqual([Math.round(target.trackW),Math.round(target.trackH)],[40,20],`${theme}: trilho do interruptor em 40×20 (medido ${target.trackW}×${target.trackH})`);
    assert.deepEqual([Math.round(target.thumbW),Math.round(target.thumbH)],[14,14],`${theme}: botão do interruptor em 14×14 (medido ${target.thumbW}×${target.thumbH})`);
    assert.equal(target.trackRadius,'50%',`${theme}: trilho em pílula (--r-round)`);
    assert.ok(target.trackRatio>=3,`${theme}: o trilho desligado passa de 3:1 sobre o painel (medido ${target.trackRatio.toFixed(2)}:1, F14)`);
    await page.locator('#notebooks-ink-switch').hover();
    const hoverBg=await page.evaluate(()=>getComputedStyle(document.querySelector('#notebooks-ink-switch')).backgroundColor);
    assert.match(hoverBg,/rgba\(0, 0, 0, 0\)|transparent/,`${theme}: o interruptor não ganha caixa no hover (r2), veio ${hoverBg}`);
    await closePopover(page);
  }

  const expected=[
    [{status:'reading',pagesRead:3,enabled:true},'Lendo as páginas…','3 páginas lidas'],
    [{status:'idle',pagesRead:3,enabled:true},'Em dia','3 páginas lidas'],
    [{status:'quota',pagesRead:5,enabled:true},'Pausado: sem cota','5 páginas lidas'],
    [{status:'error',pagesRead:7,enabled:true},'Erro ao ler a tinta','7 páginas lidas'],
    [{status:'estado-desconhecido',pagesRead:7,enabled:true},'Erro ao ler a tinta','7 páginas lidas'],
  ];
  for(const [mode,state,count] of expected){
    await setInk(mode);
    await openPopover(page);
    const panel=await pollUntil(()=>readPanel(page),value=>value.checked==='true'&&value.state===state,{what:`${mode.status}: o painel no estado esperado`});
    assert.equal(panel.role,'switch','role=switch se mantém');
    assert.equal(panel.checked,'true',`${mode.status}: ligado, aria-checked=true`);
    assert.equal(panel.disabled,false,`${mode.status}: com modelo, o interruptor fica habilitado`);
    assert.equal(panel.description,'As páginas com tinta vão ao seu modelo para virar texto.',`${mode.status}: descrição do envio`);
    assert.equal(panel.count,count,`${mode.status}: contador de páginas`);
    assert.equal(panel.state,state,`${mode.status}: estado da leitura`);
    /* A1: só o estado de erro (e o desconhecido, que pinta o mesmo texto)
       oferece "Tentar ler de novo". */
    const errorish=mode.status==='error'||mode.status==='estado-desconhecido';
    check('A1',`${mode.status}. retry`,panel.readRetry===(errorish?'Tentar ler de novo':''),`esperava ${errorish?'"Tentar ler de novo"':'nenhum botão de leitura'}, vi "${panel.readRetry}"`);
    await closePopover(page);
  }

  /* ---------- painel aberto: o contador atualiza sozinho (B6a) ---------- */
  await setInk({status:'reading',pagesRead:3,enabled:true});
  await openPopover(page);
  await pollUntil(()=>readPanel(page),panel=>panel.count==='3 páginas lidas',{what:'o contador inicial do painel'});
  await setInk({status:'reading',pagesRead:8,enabled:true});
  await pollUntil(()=>readPanel(page),panel=>panel.count==='8 páginas lidas',{what:'o contador atualizar com o painel aberto'});
  await closePopover(page);

  /* ---------- opt-in salvo sem modelo: consegue desligar (B6b) ---------- */
  await setInk({status:'no-model',pagesRead:0,enabled:true});
  await openPopover(page);
  const saved=await pollUntil(()=>readPanel(page),panel=>panel.checked==='true',{what:'o opt-in salvo aparecer ligado'});
  assert.equal(saved.disabled,false,'com o opt-in salvo e sem modelo, o interruptor fica habilitado para desligar');
  assert.equal(saved.description,'Sem modelo com visão: a busca usa só o texto digitado.','o aviso acompanha o opt-in salvo sem modelo');
  assert.equal(saved.count,'0 páginas lidas','o contador continua à vista enquanto ligado');
  check('A1','no-model. retry',saved.readRetry==='','sem modelo, a descrição já explica e não há "Tentar ler de novo"');
  await page.locator('#notebooks-ink-switch').click();
  await pollUntil(()=>ctx.app.evaluate(()=>globalThis.__mesaInkSets.length),total=>total>=1,{what:'o pedido de desligar o opt-in salvo'});
  await pollUntil(()=>readPanel(page),panel=>panel.checked==='false'&&panel.disabled===true,{what:'o interruptor desligado e desabilitado'});
  await ctx.app.evaluate(()=>{globalThis.__mesaInkSets=[];});
  await closePopover(page);

  /* ---------- clique desliga e liga pelo IPC, com o payload certo ---------- */
  await setInk({status:'idle',pagesRead:2,enabled:true});
  await openPopover(page);
  await page.locator('#notebooks-ink-switch').click();
  await pollUntil(()=>ctx.app.evaluate(()=>globalThis.__mesaInkSets.length),total=>total>=1,{what:'o pedido de desligar chegar ao IPC'});
  assert.deepEqual(await ctx.app.evaluate(()=>globalThis.__mesaInkSets[0]),{on:false},'clicar com a leitura ligada manda {on:false}');
  const off=await pollUntil(()=>readPanel(page),panel=>panel.checked==='false',{what:'o interruptor desligado depois do IPC'});
  assert.equal(off.count,'','desligado, o contador some');
  await page.locator('#notebooks-ink-switch').click();
  await pollUntil(()=>ctx.app.evaluate(()=>globalThis.__mesaInkSets.length),total=>total>=2,{what:'o pedido de ligar chegar ao IPC'});
  assert.deepEqual(await ctx.app.evaluate(()=>globalThis.__mesaInkSets[1]),{on:true},'clicar desligado manda {on:true}');
  await pollUntil(()=>readPanel(page),panel=>panel.checked==='true',{what:'o interruptor ligado depois do IPC'});
  await closePopover(page);

  /* ---------- falha real do IPC: a UI mostra o motivo (B6c/B6d) ---------- */
  await setInk({status:'idle',pagesRead:0,enabled:false});
  await ctx.app.evaluate(()=>{globalThis.__mesaInkSets=[];globalThis.__mesaInkSetResult={ok:false,reason:'no-model'};});
  await openPopover(page);
  await page.locator('#notebooks-ink-switch').click();
  await pollUntil(()=>readPanel(page),panel=>panel.checked==='false'&&panel.error.includes('Sem modelo com visão'),{what:'o interruptor continua desligado depois da falha'});
  await checkNoToast(page,'no-model. toast');
  const inline=await pollUntil(()=>readPanel(page),panel=>panel.error.includes('Sem modelo com visão'),{what:'o erro inline sob o interruptor (F19)'});
  assert.equal(inline.error,'Sem modelo com visão: a busca usa só o texto digitado.','o erro fica na própria linha do painel, não só no toast (F19)');
  assert.equal(inline.retry,true,'o erro inline oferece "Tentar de novo" (F19)');
  const inlineBelow=await page.evaluate(()=>{
    const button=document.querySelector('#notebooks-ink-switch');
    const error=document.querySelector('.notebooks-ink-error');
    return !!button&&!!error&&error.hidden===false&&error.getBoundingClientRect().top>=button.getBoundingClientRect().bottom;
  });
  assert.equal(inlineBelow,true,'o erro inline aparece sob o interruptor (F19)');
  /* start falho também chega à pessoa como aviso, não como interruptor ligado. */
  await ctx.app.evaluate(()=>{globalThis.__mesaInkSetResult={ok:false,reason:'start'};});
  await page.locator('#notebooks-ink-switch').click();
  await pollUntil(()=>readPanel(page),panel=>panel.error==='Não foi possível ligar a leitura da tinta.',{what:'o motivo da falha de start no erro inline'});
  await checkNoToast(page,'start. toast');
  /* stop falho mantém o interruptor ligado e avisa o motivo. */
  await setInk({status:'idle',pagesRead:0,enabled:true});
  await pollUntil(()=>readPanel(page),panel=>panel.checked==='true',{what:'o interruptor ligado antes da falha de stop'});
  await ctx.app.evaluate(()=>{globalThis.__mesaInkSetResult={ok:false,reason:'stop'};});
  await page.locator('#notebooks-ink-switch').click();
  await pollUntil(()=>readPanel(page),panel=>panel.error==='Não foi possível desligar a leitura da tinta.',{what:'o motivo da falha de stop no erro inline'});
  await checkNoToast(page,'stop. toast');
  /* "Tentar de novo" repete a ação e limpa o erro quando ela dá certo. */
  await ctx.app.evaluate(()=>{globalThis.__mesaInkSetResult=null;});
  await page.locator('.notebooks-ink-retry').click();
  await pollUntil(()=>readPanel(page),panel=>panel.checked==='false'&&panel.error==='',{what:'o retry desligar a tinta e limpar o erro inline'});
  await closePopover(page);

  /* ---------- N13: status de erro em vermelho e retry com o rótulo da ação ---------- */
  await setInk({status:'error',pagesRead:5,enabled:true});
  await ctx.app.evaluate(()=>{globalThis.__mesaInkSetResult={ok:false,reason:'stop'};});
  await openPopover(page);
  await pollUntil(()=>readPanel(page),panel=>panel.checked==='true',{what:'o estado de erro ligado antes do clique (N13)'});
  await page.locator('#notebooks-ink-switch').click();
  await pollUntil(()=>readPanel(page),panel=>panel.error==='Não foi possível desligar a leitura da tinta.',{what:'o erro inline da falha de desligar (N13)'});
  const danger=await page.evaluate(()=>{
    const state=document.querySelector('.notebooks-ink-state');
    const probe=document.createElement('span');
    probe.style.color='var(--danger-text)';
    document.querySelector('#notebooks-pop').append(probe);
    const expected=getComputedStyle(probe).color;
    probe.remove();
    return {
      state:getComputedStyle(state).color,
      expected,
      stateText:state.textContent.trim(),
      errorText:document.querySelector('.notebooks-ink-error-text')?.textContent?.trim()||'',
      retry:document.querySelector('.notebooks-ink-retry')?.textContent?.trim()||'',
    };
  });
  assert.equal(danger.state,danger.expected,'o status "Erro ao ler a tinta" usa --danger-text (N13)');
  assert.equal(danger.retry,'Tentar desligar de novo','o retry do erro de desligar diz o que vai fazer (N13)');
  assert.notEqual(danger.stateText,danger.errorText,'o status do vigia e o erro inline não repetem a mesma mensagem (N13)');
  await closePopover(page);

  await setInk({status:'idle',pagesRead:0,enabled:false});
  await ctx.app.evaluate(()=>{globalThis.__mesaInkSetResult={ok:false,reason:'start'};});
  await openPopover(page);
  await pollUntil(()=>readPanel(page),panel=>panel.checked==='false'&&panel.disabled===false,{what:'o interruptor habilitado antes do clique (N13)'});
  await page.locator('#notebooks-ink-switch').click();
  await pollUntil(()=>readPanel(page),panel=>panel.error==='Não foi possível ligar a leitura da tinta.',{what:'o erro inline da falha de ligar (N13)'});
  const startRetry=await page.evaluate(()=>document.querySelector('.notebooks-ink-retry')?.textContent?.trim()||'');
  assert.equal(startRetry,'Tentar ligar de novo','o retry do erro de ligar diz o que vai fazer (N13)');
  await ctx.app.evaluate(()=>{globalThis.__mesaInkSetResult=null;});
  await closePopover(page);

  /* ---------- A1: o erro persistente do vigia retenta a leitura ---------- */
  await setInk({status:'error',pagesRead:5,enabled:true});
  await ctx.app.evaluate(()=>{globalThis.__mesaInkSets=[];globalThis.__mesaInkSetResult=null;});
  await openPopover(page);
  const watcherError=await pollUntil(()=>readPanel(page),panel=>panel.state==='Erro ao ler a tinta',{what:'o erro persistente do vigia (A1)'});
  check('A1','erro. rótulo',watcherError.readRetry==='Tentar ler de novo',`o erro do vigia devia oferecer "Tentar ler de novo", vi "${watcherError.readRetry}"`);
  check('A1','erro. sem erro inline',watcherError.error==='','o erro do vigia não devia pintar o erro inline da ação do interruptor');
  if(watcherError.readRetry){
    await page.locator('.notebooks-ink-read-retry').click();
    await pollUntil(()=>ctx.app.evaluate(()=>globalThis.__mesaInkSets.length),total=>total>=1,{what:'o pedido de religar a leitura (A1)'});
    const payload=await ctx.app.evaluate(()=>globalThis.__mesaInkSets[0]);
    check('A1','erro. efeito',payload?.on===true,`"Tentar ler de novo" devia mandar {on:true}, veio ${JSON.stringify(payload)}`);
    const afterRead=await readPanel(page);
    check('A1','erro. uma ação',afterRead.readRetry==='Tentar ler de novo'&&afterRead.error==='','depois de religar, a ação única continua e o inline fica limpo');
  }else{
    check('A1','erro. efeito',false,'sem o botão "Tentar ler de novo" não há como medir o efeito');
  }
  await closePopover(page);

  /* A1: quando a própria retentativa falha, o inline assume a ação — nada de
     dois botões com o mesmo efeito. */
  await setInk({status:'error',pagesRead:5,enabled:true});
  await ctx.app.evaluate(()=>{globalThis.__mesaInkSets=[];globalThis.__mesaInkSetResult={ok:false,reason:'start'};});
  await openPopover(page);
  await pollUntil(()=>readPanel(page),panel=>panel.state==='Erro ao ler a tinta',{what:'o estado de erro antes da retentativa (A1)'});
  const beforeFail=await readPanel(page);
  if(beforeFail.readRetry){
    await page.locator('.notebooks-ink-read-retry').click();
    const readFailed=await pollUntil(()=>readPanel(page),panel=>panel.error==='Não foi possível ligar a leitura da tinta.',{what:'o inline da retentativa que falhou (A1)'});
    check('A1','retentativa. ação única',readFailed.readRetry===''&&readFailed.retry===true,`o inline devia assumir a ação e sumir com a do estado, vi readRetry="${readFailed.readRetry}" retry=${readFailed.retry}`);
    const retryLabel=await page.evaluate(()=>document.querySelector('.notebooks-ink-retry')?.textContent?.trim()||'');
    check('A1','retentativa. rótulo',retryLabel==='Tentar ler de novo',`o retry do inline devia repetir a leitura, vi "${retryLabel}"`);
    await ctx.app.evaluate(()=>{globalThis.__mesaInkSetResult=null;});
    await page.locator('.notebooks-ink-retry').click();
    await pollUntil(()=>ctx.app.evaluate(()=>globalThis.__mesaInkSets.length),total=>total>=2,{what:'o segundo pedido de leitura (A1)'});
    const lastPayload=await ctx.app.evaluate(()=>globalThis.__mesaInkSets.at(-1));
    check('A1','retentativa. efeito',lastPayload?.on===true,`o retry do inline devia mandar {on:true}, veio ${JSON.stringify(lastPayload)}`);
  }else{
    check('A1','retentativa. ação única',false,'sem o botão de leitura não há como medir a falha');
  }
  await ctx.app.evaluate(()=>{globalThis.__mesaInkSetResult=null;});
  await closePopover(page);

  /* ---------- N1: o erro da tinta não vira fantasma ---------- */
  await setInk({status:'idle',pagesRead:0,enabled:true});
  await ctx.app.evaluate(()=>{globalThis.__mesaInkSetResult={ok:false,reason:'stop'};});
  await openPopover(page);
  await pollUntil(()=>readPanel(page),panel=>panel.checked==='true',{what:'o painel ligado antes do clique (N1)'});
  await page.locator('#notebooks-ink-switch').click();
  await pollUntil(()=>readPanel(page),panel=>panel.error==='Não foi possível desligar a leitura da tinta.',{what:'o erro inline antes da troca de idioma (N1)'});
  await setUiLanguageInPage(page,'en');
  const english=await pollUntil(()=>readPanel(page),panel=>panel.error==='Could not turn off handwriting reading.',{what:'o erro inline repintado no idioma novo (N1)'});
  assert.equal(english.error,'Could not turn off handwriting reading.','trocar o idioma repinta o erro inline em inglês (N1)');
  await setUiLanguageInPage(page,'pt-BR');
  await pollUntil(()=>readPanel(page),panel=>panel.error==='Não foi possível desligar a leitura da tinta.',{what:'o erro inline de volta ao português (N1)'});
  await closePopover(page);
  await openPopover(page);
  const reopened=await pollUntil(()=>readPanel(page),panel=>panel.checked==='true',{what:'o painel reaberto (N1)'});
  assert.equal(reopened.error,'','fechar e reabrir sem a falha no estado não mostra o erro de novo (N1)');
  await ctx.app.evaluate(()=>{globalThis.__mesaInkSetResult=null;});
  await closePopover(page);

  /* ---------- motor Claude: estado honesto, sem modelo e captura nos dois temas ---------- */
  await setInk({status:'claude-unavailable',pagesRead:0,enabled:false});
  for(const theme of ['light','dark']){
    await setTheme(page,theme);
    await openPopover(page);
    const claude=await pollUntil(()=>readPanel(page),panel=>panel.disabled===true,{what:`${theme}: Claude desabilitado`});
    assert.equal(claude.checked,'false',`${theme}: Claude desligado`);
    assert.equal(claude.description,'Com o Claude, a leitura da tinta ainda não está disponível.',`${theme}: aviso do Claude`);
    assert.equal(claude.count,'',`${theme}: sem contador com Claude desligado`);
    await layoutStable(page,'#notebooks-pop');
    await page.screenshot({path:path.join('/tmp',`mesa-cadernos-tinta-claude-${theme}.png`)});
    await closePopover(page);
  }

  /* ---------- desligado sem modelo: captura nos dois temas ---------- */
  await setInk({status:'no-model',pagesRead:0,enabled:false});
  for(const theme of ['light','dark']){
    await setTheme(page,theme);
    await openPopover(page);
    const missing=await pollUntil(()=>readPanel(page),panel=>panel.disabled===true,{what:`${theme}: sem modelo desabilitado`});
    assert.equal(missing.description,'Sem modelo com visão: a busca usa só o texto digitado.',`${theme}: aviso sem modelo`);
    await layoutStable(page,'#notebooks-pop');
    await page.screenshot({path:path.join('/tmp',`mesa-cadernos-tinta-off-${theme}.png`)});
    await closePopover(page);
  }

  /* ---------- os dois temas, com o contador à vista e captura para /tmp ---------- */
  await setInk({status:'idle',pagesRead:7,enabled:true});
  for(const theme of ['light','dark']){
    await setTheme(page,theme);
    await openPopover(page);
    const panel=await pollUntil(()=>readPanel(page),value=>value.checked==='true'&&value.count==='7 páginas lidas',{what:`${theme}: o contador no tema`});
    assert.equal(panel.checked,'true',`${theme}: ligado no tema ${theme}`);
    assert.equal(panel.count,'7 páginas lidas',`${theme}: contador no tema ${theme}`);
    assert.equal(panel.state,'Em dia',`${theme}: estado no tema ${theme}`);
    const colors=await page.evaluate(()=>{
      const button=document.querySelector('#notebooks-ink-switch');
      const track=document.querySelector('.notebooks-ink-track');
      return {
        text:getComputedStyle(button).color,
        track:getComputedStyle(track).backgroundColor,
        pop:getComputedStyle(document.querySelector('#notebooks-pop')).backgroundColor,
      };
    });
    assert.ok(colors.text&&colors.track&&colors.pop,`${theme}: a seção usa cores do tema`);
    await layoutStable(page,'#notebooks-pop');
    await page.screenshot({path:path.join('/tmp',`mesa-cadernos-tinta-${theme}.png`)});
    await closePopover(page);
  }

  assert.deepEqual(failures,[],`consertos da rodada 3 ainda falham:\n${failures.join('\n')}`);
  assert.deepEqual(errors,[],'nenhum erro de página');
});

console.log('notebooks-ink-ui: PASS — interruptor desabilitado sem modelo/Claude, habilitado para desligar o opt-in salvo, contador atualiza com o painel aberto, o erro do vigia retenta a leitura e o erro inline é a mensagem única sem toast; capturas em /tmp/mesa-cadernos-tinta-{light,dark}.png, -off-{light,dark}.png e -claude-{light,dark}.png.');
