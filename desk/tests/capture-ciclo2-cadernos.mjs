// node tests/capture-ciclo2-cadernos.mjs — CICLO 2 de UI/UX, parte
// "Cadernos": biblioteca .xopp e plugin MesaPagina (#133), o `ler_caderno` no
// diário do chat (#135) e a busca + leitura da tinta (#158). Fora do
// `npm run ui`: bloco que falha registra e o resto segue. Saída padrão em
// docs/design-loop/rodada-2/antes/cadernos/; `--out <dir>` ou CICLO2_OUT
// repete noutra rodada. Claro/escuro × 1440×900 e 900×650, mais inglês a
// 1440×900 (o teclado e o hover também nos dois temas e tamanhos). Dados
// sintéticos (`seedLibrary`) e fake do OpenCode; NENHUM material de curso
// real. Antes de cada foto, `check` confere o estado no DOM.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {seedNativeSession,writeDeskJson,resizeWindow,setTheme,sendEnabled} from './helpers.mjs';
import {
 OUT,FAKE_XOURNALPP,seedLibrary,boot,openNotebooks,closeNotebooks,
 inkPanel,capture,series,focusByTab,assertFocusRing,focusKeyboard,
 keyboardShots,holdNotebookSearch,releaseNotebookSearch,
} from './capture-ciclo2-cadernos-kit.mjs';
import {runPluginBlocks} from './capture-ciclo2-cadernos-plugin.mjs';

const failures=[];
const ONLY=new Set((process.env.CICLO2_ONLY||'').split(',').filter(Boolean));
const block=async(tag,run)=>{
 if(ONLY.size&&!ONLY.has(tag))return;
 try{await run();console.log('ok',tag);}
 catch(error){
  const line=String(error?.message||error).split('\n')[0];
  failures.push(`${tag}: ${line}`);
  console.log('FALHOU',tag,line);
  if(process.env.CICLO2_DEBUG)console.log(String(error?.stack||'').split('\n').slice(0,6).join('\n'));
 }
};
const expect=(condition,message)=>{if(!condition)throw Error(message);};
const langOf=page=>page.evaluate(()=>document.documentElement.lang||'pt-BR');

/* ---------- 1. #133: biblioteca de cadernos ---------- */
await block('biblioteca',async()=>{
 const {runtime}=seedLibrary('ciclo2-biblioteca');
 const {app,page}=await boot(runtime);
 try{
  const listState=async()=>{
   const seen=await page.evaluate(()=>({
    hidden:document.querySelector('#notebooks-pop')?.hidden!==false,
    groups:[...document.querySelectorAll('.notebooks-group')].map(el=>el.textContent.trim()),
    rows:[...document.querySelectorAll('.notebooks-row .notebooks-title')].map(el=>el.textContent.trim()),
   }));
   expect(!seen.hidden,'o popover Cadernos está fechado');
   expect(seen.groups.length===2,`esperava 2 grupos de matéria; vi ${JSON.stringify(seen.groups)}`);
   expect(seen.rows.length===3,`esperava 3 cadernos; vi ${JSON.stringify(seen.rows)}`);
   expect(seen.rows[0]==='aula-nova.xopp',`o mais recente da matéria atual vem primeiro; vi ${seen.rows[0]}`);
  };
  await series(page,app,{base:'biblioteca-lista',region:'#notebooks-pop',prepare:()=>openNotebooks(page),check:listState});

  /* Percurso de teclado nos dois temas e nos dois tamanhos. */
  const routeBusca=async()=>{
   await openNotebooks(page);
   await page.waitForFunction(()=>document.activeElement?.id==='notebooks-search',undefined,{timeout:5000});
  };
  await keyboardShots(page,app,{base:'teclado-cadernos-busca',region:'#notebooks-pop',prepare:routeBusca});
  const routeLinha=async()=>{
   await routeBusca();
   await focusByTab(page,'#notebooks-search','.notebooks-row');
   await assertFocusRing(page,'primeira linha de caderno');
  };
  await keyboardShots(page,app,{base:'teclado-cadernos-linha',region:'#notebooks-pop',prepare:routeLinha});
  /* Até o item Cadernos pelo teclado: Mais opções → ↓ até Cadernos. */
  const routeBotao=async()=>{
   await closeNotebooks(page);
   await page.locator('#chat-more').focus();
   await page.keyboard.press('ArrowDown');
   await page.waitForFunction(()=>document.querySelector('#chat-more-pop')?.hidden===false,undefined,{timeout:5000});
   for(let step=0;step<12;step+=1){
    if(await page.evaluate(()=>document.activeElement?.id==='more-notebooks'))break;
    await page.keyboard.press('ArrowDown');
   }
   expect(await page.evaluate(()=>document.activeElement?.id)==='more-notebooks','a seta não chegou ao item Cadernos');
   await assertFocusRing(page,'botão Cadernos');
  };
  await keyboardShots(page,app,{base:'teclado-cadernos-botao',region:'#chat-more-pop',prepare:routeBotao});
  const routeFechar=async()=>{
   await routeBusca();
   await page.keyboard.press('Shift+Tab');
   expect(await page.evaluate(()=>document.activeElement?.id)==='notebooks-close','Shift+Tab do campo não chegou ao fechar do popover');
   await assertFocusRing(page,'fechar do popover Cadernos');
  };
  await keyboardShots(page,app,{base:'teclado-cadernos-fechar',region:'#notebooks-pop',prepare:routeFechar});

  /* Lista vazia: matéria sem nenhum `.xopp`. */
  await app.evaluate(({ipcMain})=>{
   ipcMain.removeHandler('notebooks-list');
   ipcMain.handle('notebooks-list',async()=>({notebooks:[]}));
  });
  const emptyState=async()=>{
   const text=await page.evaluate(()=>document.querySelector('.notebooks-empty')?.textContent?.trim()||'');
   expect(text.length>0,'a lista vazia não mostra o texto de vazio');
   expect(await page.locator('.notebooks-row').count()===0,'a lista vazia ainda tem linhas');
  };
  await series(page,app,{base:'biblioteca-vazia',region:'#notebooks-pop',prepare:()=>openNotebooks(page),check:emptyState});
 } finally {await app.close();}
});

/* ---------- 2. #133: plugin MesaPagina (blocos no módulo próprio) ---------- */
await runPluginBlocks(block);

/* ---------- 3. #135: `ler_caderno` no diário do chat ---------- */
const workState=async(page,{status,label})=>{
 const seen=await page.evaluate(required=>{
  const work=[...document.querySelectorAll('article.work')].at(-1);
  if(!work)return {work:false};
  const step=work.querySelector(`.work-step[data-status="${required}"]`);
  const toggle=step?.querySelector('.step-toggle');
  return {
   work:true,live:work.dataset.live||'',expanded:work.dataset.expanded||'',
   steps:work.querySelectorAll('.work-step').length,
   label:step?.querySelector('.step-label')?.textContent?.trim()||'',
   detailOpen:toggle?.getAttribute('aria-expanded')||'',
  };
 },status);
 expect(seen.work,'o diário de trabalho não está na conversa');
 expect(seen.steps>0,'o diário está sem passos');
 expect(seen.label.length>0,`o passo ${status} está sem rótulo`);
 if(label)expect(seen.label.includes(label),`o rótulo do passo não cita ${label} (vi "${seen.label}")`);
 return seen;
};
const ensureWork=async(page,{detail=false}={})=>{
 const work=page.locator('article.work').last();
 await work.waitFor({timeout:15000});
 if((await work.getAttribute('data-expanded'))!=='true')await work.locator('.work-head').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('article.work')].at(-1)?.dataset.expanded==='true',undefined,{timeout:5000});
 if(detail){
  const toggle=work.locator('.work-step[data-kind="tool"] .step-toggle');
  if((await toggle.getAttribute('aria-expanded'))!=='true')await toggle.click();
  await page.waitForFunction(()=>[...document.querySelectorAll('article.work')].at(-1)?.querySelector('.work-step[data-kind="tool"] .step-toggle')?.getAttribute('aria-expanded')==='true',undefined,{timeout:5000});
 }
};
/* O rótulo do diário é pintado na hora do patch: depois de trocar o idioma, um
   recolher+abrir força o paint com o texto novo. */
const repaintWork=async(page)=>{
 const head=page.locator('article.work .work-head').last();
 await head.click();await page.waitForTimeout(120);// espera fixa: o patch do diário pinta no quadro seguinte
 await head.click();await page.waitForTimeout(120);// espera fixa: idem para o rótulo no idioma atual
 await ensureWork(page);
};

await block('ler-caderno-andamento-ok',async()=>{
 fs.chmodSync(FAKE_XOURNALPP,0o755);
 const lib=seedLibrary('ciclo2-ler',{withContent:true,xournalPath:FAKE_XOURNALPP});
 const session=seedNativeSession(lib.runtime,[],{courseId:'calc'});
 writeDeskJson(lib.runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:Date.now()}],pdfs:[{path:lib.pdf,page:1}],study:{title:'',xopp:lib.nova}}}});
 /* Alias em /tmp: o argumento da ferramenta aparece no detalhe do diário, e o
    caminho do runtime do teste não é caminho pessoal na captura. */
 const aliasDir=fs.mkdtempSync(path.join(os.tmpdir(),'ciclo2-caderno-'));
 const alias=path.join(aliasDir,'aula-nova.xopp');
 fs.symlinkSync(lib.nova,alias);
 const {app,page}=await boot(lib.runtime,{env:{
  FAKE_OPENCODE_MCP_CALL:JSON.stringify({name:'ler_caderno',input:{caminho:alias,pagina:1}}),
  FAKE_XOURNALPP_MODE:'sleep',FAKE_XOURNALPP_SLEEP_MS:'13000',
 }});
 try{
  /* Autoriza o caderno pelo mesmo caminho da pessoa (abrir pela biblioteca);
     o Xournal++ falso só registra a chamada. */
  await page.evaluate(async caminho=>window.desk.openNotebook({courseId:'calc',path:caminho}),alias);
  await page.locator('#prompt').fill('Leia a página 1 do meu caderno.');
  await page.locator('#send').click();
  await page.waitForFunction(()=>{
   const work=[...document.querySelectorAll('article.work')].at(-1);
   return work?.dataset.live==='true'&&!!work.querySelector('.work-step[data-status="running"]');
  },undefined,{timeout:30000});
  const running=async()=>{
   const seen=await workState(page,{status:'running',label:'.xopp'});
   expect(seen.live==='true',`o diário não está ao vivo (data-live="${seen.live}")`);
  };
  await series(page,app,{base:'ler-caderno-andamento',region:'article.work',prepare:async()=>{await repaintWork(page);},check:running});

  await page.waitForFunction(()=>[...document.querySelectorAll('article.work')].at(-1)?.dataset.live==='false',undefined,{timeout:30000});
  await sendEnabled(page,{timeout:30000});
  await ensureWork(page,{detail:true});
  const done=async()=>{await workState(page,{status:'done',label:'.xopp'});};
  await series(page,app,{base:'ler-caderno-ok',region:'article.work',prepare:async()=>{await repaintWork(page);await ensureWork(page,{detail:true});},check:done});

  const routePasso=async()=>{
   await ensureWork(page,{detail:true});
   await focusByTab(page,'article.work .work-head','article.work .work-step[data-kind="tool"] .step-toggle');
   await assertFocusRing(page,'passo da ferramenta no diário');
  };
  await keyboardShots(page,app,{base:'teclado-ler-caderno-passo',region:'article.work',prepare:routePasso});
  const routeCabeca=async()=>{
   await ensureWork(page,{detail:true});
   await focusKeyboard(page,'article.work .work-head','cabeça do diário');
  };
  await keyboardShots(page,app,{base:'teclado-ler-caderno-cabeca',region:'article.work',prepare:routeCabeca});
 } finally {await app.close();fs.rmSync(aliasDir,{recursive:true,force:true});}
});

await block('ler-caderno-erro',async()=>{
 const lib=seedLibrary('ciclo2-ler-erro',{withContent:true});
 const now=Date.now();
 const messages=[
  {role:'user',content:[{type:'text',text:'Leia a página 2 do caderno.'}],timestamp:now-30000},
  {role:'assistant',content:[
   {type:'toolCall',id:'caderno-erro-1',name:'mesa_ler_caderno',arguments:{caminho:'aula-nova.xopp',pagina:2}},
   {type:'text',text:'Não consegui ler a página 2: o caderno de teste tem só uma página.'},
  ],timestamp:now-20000},
  {role:'toolResult',toolCallId:'caderno-erro-1',content:[{type:'text',text:'Página 2 não existe (o caderno tem 1).'}],isError:true,timestamp:now-10000},
 ];
 const session=seedNativeSession(lib.runtime,messages,{courseId:'calc',started:now-60000});
 writeDeskJson(lib.runtime,{courseId:'calc',session,courseStates:{calc:{session,sessions:[{path:session,started:now-60000}],pdfs:[{path:lib.pdf,page:1}],study:{title:'',xopp:''}}}});
 const {app,page}=await boot(lib.runtime);
 try{
  await page.waitForSelector('article.work',{timeout:30000});
  await ensureWork(page,{detail:true});
  const failed=async()=>{await workState(page,{status:'error'});};
  await series(page,app,{base:'ler-caderno-erro',region:'article.work',prepare:async()=>{await repaintWork(page);await ensureWork(page,{detail:true});},check:failed});
 } finally {await app.close();}
});

/* ---------- 4. #158: busca no texto dos cadernos ---------- */
await block('busca',async()=>{
 const {runtime}=seedLibrary('ciclo2-busca',{withContent:true});
 const {app,page}=await boot(runtime);
 try{
  const queryState=(query,mode)=>async()=>{
   const seen=await page.evaluate(()=>({
    value:document.querySelector('#notebooks-search')?.value??null,
    rows:document.querySelectorAll('.notebooks-row').length,
    hits:document.querySelectorAll('.notebooks-search-row').length,
    marks:document.querySelectorAll('.notebooks-search-row mark').length,
    empty:document.querySelector('.notebooks-search-empty')?.textContent?.trim()||'',
    status:document.querySelector('#notebooks-pop [role="status"]')?.textContent?.trim()||'',
   }));
   expect(seen.value===query,`campo de busca: esperava "${query}", vi "${seen.value}"`);
   if(mode==='vazia'){
    expect(seen.rows>=2,`a lista não voltou com a busca vazia (${seen.rows} linhas)`);
    expect(seen.hits===0,'a busca vazia ainda mostra resultados');
   }else if(mode==='sem-resultado'){
    expect(seen.empty.length>0,'a busca sem resultado não mostra o texto de vazio');
    expect(seen.hits===0,'a busca sem resultado ainda tem linhas');
    expect(seen.status.length>0,'a busca sem resultado não anuncia o status');
   }else{
    expect(seen.hits>0,`a busca com resultado não achou nada ("${query}")`);
    expect(seen.marks>0,'o resultado não destaca o termo num <mark>');
    expect(seen.status.length>0,'a busca com resultado não anuncia a contagem');
   }
  };
  const prepare=(query)=>async()=>{
   await openNotebooks(page);
   if(!query)return;
   await page.locator('#notebooks-search').fill(query);
   if(query==='zzz sem match')await page.locator('.notebooks-search-empty').waitFor({timeout:10000});
   else await page.locator('.notebooks-search-row').first().waitFor({timeout:10000});
  };
  await series(page,app,{base:'busca-vazia',region:'#notebooks-pop',prepare:prepare(''),check:queryState('','vazia')});
  await series(page,app,{base:'busca-sem-resultado',region:'#notebooks-pop',prepare:prepare('zzz sem match'),check:queryState('zzz sem match','sem-resultado')});
  await series(page,app,{base:'busca-com-resultados',region:'#notebooks-pop',prepare:prepare('EQUACAO'),check:queryState('EQUACAO','com-resultados')});

  /* "Buscando…": o fake segura o IPC da busca até a foto (o estado real dura
     150 ms depois do debounce). A lista anterior fica com opacity .5 e o
     `role=status` anuncia o texto. */
  await holdNotebookSearch(app);
  const searchingState=async()=>{
   const lang=await langOf(page);
   const expected=lang==='en'?'Searching…':'Buscando…';
   const seen=await page.evaluate(()=>({
    value:document.querySelector('#notebooks-search')?.value??null,
    searching:document.querySelector('#notebooks-list')?.classList.contains('notebooks-searching')??false,
    rows:document.querySelectorAll('.notebooks-row').length,
    status:document.querySelector('#notebooks-pop [role="status"]')?.textContent?.trim()||'',
   }));
   expect(seen.value==='EQUACAO',`campo de busca: esperava "EQUACAO", vi "${seen.value}"`);
   expect(seen.searching,'a lista não está no estado "Buscando…"');
   expect(seen.status===expected,`status da busca: esperava "${expected}", vi "${seen.status}"`);
   expect(seen.rows>0,'a busca em voo devia manter as linhas anteriores');
  };
  const prepareSearching=async()=>{
   await openNotebooks(page);
   await page.locator('#notebooks-search').fill('EQUACAO');
   await page.waitForFunction(()=>document.querySelector('#notebooks-list')?.classList.contains('notebooks-searching'),undefined,{timeout:10000});
  };
  await series(page,app,{base:'busca-buscando',region:'#notebooks-pop',prepare:prepareSearching,check:searchingState});
  await releaseNotebookSearch(app);
 } finally {await app.close();}
});

/* ---------- 5. #158/#159: leitura da tinta no painel de cadernos ---------- */
await block('tinta',async()=>{
 const {runtime}=seedLibrary('ciclo2-tinta');
 const {app,page}=await boot(runtime);
 try{
  await app.evaluate(({ipcMain})=>{
   globalThis.__c2Ink={status:'idle',pagesRead:0,enabled:false};
   globalThis.__c2InkResult=null;
   ipcMain.removeHandler('notebooks-list');
   ipcMain.handle('notebooks-list',async()=>({notebooks:[
    {courseId:'calc',name:'aula-teste.xopp',path:'fake/aula-teste.xopp',folder:'',mtimeMs:1},
   ]}));
   ipcMain.removeHandler('notebooks-ink-status');
   ipcMain.handle('notebooks-ink-status',async()=>({...globalThis.__c2Ink}));
   ipcMain.removeHandler('notebooks-ink-set');
   ipcMain.handle('notebooks-ink-set',async(_event,payload)=>{
    if(globalThis.__c2InkResult)return globalThis.__c2InkResult;
    globalThis.__c2Ink={...globalThis.__c2Ink,enabled:payload?.on===true};
    return {ok:true};
   });
  });
  const setInk=(state,result=null)=>app.evaluate((_electron,value)=>{
   globalThis.__c2Ink=value.state;globalThis.__c2InkResult=value.result;
  },{state,result});
  const panelState=(expected)=>async()=>{
   const panel=await inkPanel(page);
   expect(panel.checked===String(expected.checked),`interruptor: esperava aria-checked="${expected.checked}", vi "${panel.checked}"`);
   if(expected.disabled!==undefined)expect(panel.disabled===expected.disabled,`interruptor: esperava disabled=${expected.disabled}, vi ${panel.disabled}`);
   if(expected.count)expect(panel.count.includes(expected.count),`contador: esperava "${expected.count}", vi "${panel.count}"`);
   if(expected.state)expect(panel.state.length>0,`estado da leitura vazio (esperava ${expected.state})`);
   if(expected.stateText)expect(panel.state===expected.stateText,`estado da leitura: esperava "${expected.stateText}", vi "${panel.state}"`);
   if(expected.errorText)expect(panel.error.includes(expected.errorText),`erro inline da tinta: esperava "${expected.errorText}", vi "${panel.error}"`);
   if(expected.retry!==undefined)expect(panel.retry===expected.retry,`botão Tentar de novo: esperava ${expected.retry}, vi ${panel.retry}`);
   if(expected.description)expect(panel.description.length>0,'descrição do interruptor vazia');
  };
  const openInk=(state,result=null)=>async()=>{
   await setInk(state,result);
   await openNotebooks(page);
  };

  await series(page,app,{base:'tinta-desligada-padrao',region:'#notebooks-pop',prepare:openInk({status:'idle',pagesRead:0,enabled:false}),check:panelState({checked:false,disabled:false,description:true})});
  await series(page,app,{base:'tinta-sem-chave',region:'#notebooks-pop',prepare:openInk({status:'no-model',pagesRead:0,enabled:false}),check:panelState({checked:false,disabled:true,description:true})});
  await series(page,app,{base:'tinta-claude',region:'#notebooks-pop',prepare:openInk({status:'claude-unavailable',pagesRead:0,enabled:false}),check:panelState({checked:false,disabled:true,description:true})});
  await series(page,app,{base:'tinta-lendo',region:'#notebooks-pop',prepare:openInk({status:'reading',pagesRead:3,enabled:true}),check:panelState({checked:true,disabled:false,count:'3',state:'reading'})});
  await series(page,app,{base:'tinta-ligada',region:'#notebooks-pop',prepare:openInk({status:'idle',pagesRead:7,enabled:true}),check:panelState({checked:true,disabled:false,count:'7',state:'idle'})});
  await series(page,app,{
   base:'tinta-quota',region:'#notebooks-pop',
   prepare:openInk({status:'quota',pagesRead:4,enabled:true}),
   check:async()=>{
    const lang=await langOf(page);
    await panelState({checked:true,disabled:false,count:'4',stateText:lang==='en'?'Paused: no quota':'Pausado: sem cota'})();
   },
  });
  await series(page,app,{
   base:'tinta-erro',region:'#notebooks-pop',
   prepare:async()=>{
    await setInk({status:'idle',pagesRead:0,enabled:false},{ok:false,reason:'start'});
    await openNotebooks(page);
    await page.locator('#notebooks-ink-switch').click();
    await page.waitForFunction(()=>document.querySelector('.notebooks-ink-error')?.hidden===false,undefined,{timeout:8000});
   },
   check:async()=>{
    const lang=await langOf(page);
    await panelState({checked:false,errorText:lang==='en'?'Could not turn on handwriting reading.':'Não foi possível ligar a leitura da tinta.',retry:true})();
    /* R3 (#158): o erro fica só na linha do painel; toast repetiria o mesmo aviso. */
    expect(!await page.evaluate(()=>[...document.querySelectorAll('#toast .toast-item')].some(el=>!el.classList.contains('out'))),'o erro da tinta abriu um toast além da linha do painel');
   },
  });
  await series(page,app,{
   base:'tinta-status-erro',region:'#notebooks-pop',
   prepare:async()=>{
    await setInk({status:'error',pagesRead:5,enabled:true},{ok:false,reason:'stop'});
    await openNotebooks(page);
    await page.locator('#notebooks-ink-switch').click();
    await page.waitForFunction(()=>document.querySelector('.notebooks-ink-error')?.hidden===false,undefined,{timeout:8000});
   },
   check:async()=>{
    const lang=await langOf(page);
    await panelState({checked:true,disabled:false,count:'5',stateText:lang==='en'?'Handwriting read error':'Erro ao ler a tinta',errorText:lang==='en'?'Could not turn off handwriting reading.':'Não foi possível desligar a leitura da tinta.',retry:true})();
    const readRetry=await page.evaluate(()=>{const el=document.querySelector('#notebooks-ink-read-retry');return el&&!el.hidden?el.textContent.trim():'';});
    expect(readRetry===(lang==='en'?'Try reading again':'Tentar ler de novo'),`botão de reler: recebido "${readRetry}"`);
   },
  });

  /* Teclado na ordem do DOM depois do #158 (N2): campo → linhas → interruptor
     (o painel da tinta vem depois da lista), nos dois temas e tamanhos. */
  await setInk({status:'idle',pagesRead:2,enabled:false});
  const routeLinhaInk=async()=>{
   await openNotebooks(page);
   await page.waitForFunction(()=>document.activeElement?.id==='notebooks-search',undefined,{timeout:5000});
   await focusByTab(page,'#notebooks-search','.notebooks-row');
   await assertFocusRing(page,'primeira linha de caderno pelo teclado');
  };
  await keyboardShots(page,app,{base:'teclado-tinta-linha',region:'#notebooks-pop',prepare:routeLinhaInk});
  const routeSwitch=async()=>{
   await routeLinhaInk();
   await focusByTab(page,'.notebooks-row','#notebooks-ink-switch');
   await assertFocusRing(page,'interruptor Ler a escrita à mão');
  };
  await keyboardShots(page,app,{base:'teclado-tinta-interruptor',region:'#notebooks-pop',prepare:routeSwitch});

  /* Hover medido (F17): o fundo computado da linha e do interruptor muda para
     `--hover`; a foto é tirada com o ponteiro ainda em cima. */
  for(const theme of ['light','dark']){
   await resizeWindow(app,page,1440,900);
   await setTheme(page,theme);
   await setInk({status:'idle',pagesRead:2,enabled:false});
   await openNotebooks(page);
   const row=page.locator('.notebooks-row').first();
   await row.hover();
   const rowBg=await row.evaluate(el=>getComputedStyle(el).backgroundColor);
   expect(rowBg!=='rgba(0, 0, 0, 0)'&&rowBg!=='transparent',`hover da linha (${theme}): fundo "${rowBg}" continua transparente`);
   await capture(page,`hover-linha-caderno-${theme}-1440x900`,'#notebooks-pop',{keepPointer:true});
   const inkSwitch=page.locator('#notebooks-ink-switch');
   await inkSwitch.hover();
   const switchBg=await inkSwitch.evaluate(el=>getComputedStyle(el).backgroundColor);
   expect(switchBg!=='rgba(0, 0, 0, 0)'&&switchBg!=='transparent',`hover do interruptor (${theme}): fundo "${switchBg}" continua transparente`);
   await capture(page,`hover-tinta-interruptor-${theme}-1440x900`,'#notebooks-pop',{keepPointer:true});
  }
 } finally {await app.close();}
});

fs.writeFileSync(`${OUT}/_falhas.json`,`${JSON.stringify({falhas:failures},null,2)}\n`);
console.log('capturas do ciclo 2 (cadernos) em',OUT);
console.log('falhas:',JSON.stringify(failures,null,2));
if(failures.length)process.exitCode=1;
