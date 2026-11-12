// node tests/capture-ciclo2-chat-solto.mjs — CICLO 2 DE UI/UX, parte "Chat
// solto" (#157): janela própria em 380×800 e 420×1000, faixa "Chat em outra
// janela", soltar/trazer de volta, "sempre por cima" (desligado por padrão e
// ligado) e o chat preso na Mesa com resposta, cartões, envio incerto e janela
// pequena. Saída padrão em docs/design-loop/rodada-2/antes/chat-solto/, aceita
// `--out <dir>` ou `CICLO2_OUT`; a pasta é limpa de PNG/JSON antes da rodada.
// Cada PNG leva um JSON de medidas ao lado (contraste, fonte, alvos, foco,
// rótulos). Dados sintéticos e `fake-opencode`: nenhum material de curso.
// Fora do `npm run ui`: bloco que falha registra e o resto segue.
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts} from './helpers.mjs';
import {pollUntil} from './waits.mjs';
import {captureOutDir,cleanOutDir,createSnap,fitWindow,bootCourse,openSidechat,sendSidechat,waitAssistant,waitCard,detachSidechat,attachSidechat,applyTheme,deskFlags,focusNow} from './capture-ciclo2-chat-solto-kit.mjs';
import {runEstadoBlocks} from './capture-ciclo2-chat-solto-estados.mjs';

const ONLY=new Set((process.env.CICLO2_ONLY||'').split(',').filter(Boolean));
const OUT=captureOutDir();
/* Rodada completa limpa a pasta; `CICLO2_ONLY=bloco` preserva o que já existe. */
const REMOVED=ONLY.size?0:cleanOutDir(OUT);
const failures=[];
const PT={light:'claro',dark:'escuro'};
const snap=createSnap(OUT);
const QUIZ_PT=JSON.stringify({name:'quiz',input:{question:'Quanto é 2+2?',options:[{label:'3'},{label:'4'}],correctAnswer:'4'}});
const QUIZ_EN=JSON.stringify({name:'quiz',input:{question:'How much is 2+2?',options:[{label:'3'},{label:'4'}],correctAnswer:'4'}});
const REPLY_PT='A ideia central é dividir numerador e denominador por x antes de substituir.';
const REPLY_EN='Start by dividing numerator and denominator by x before substituting.';
const slugify=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,42);

const block=async(tag,run)=>{
 if(ONLY.size&&!ONLY.has(tag))return;
 try{await withArtifacts(tag,run);console.log('ok',tag);}
 catch(error){
  const line=String(error?.message||error).split('\n')[0];
  failures.push(`${tag}: ${line}`);
  console.log('FALHOU',tag,line);
  if(process.env.CICLO2_DEBUG)console.log(String(error?.stack||'').split('\n').slice(0,6).join('\n'));
 }
};

/* ---------- conferências de estado (DOM) antes de cada captura ---------- */

const chatFacts=page=>page.evaluate(()=>{
 const el=document.querySelector('#sidechat');
 const box=el?.getBoundingClientRect();
 const answers=[...document.querySelectorAll('#sidechat-messages .sidechat-msg.assistant .sidechat-body')]
  .map(node=>(node.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean);
 return {visible:!!el&&!el.hidden&&!!box&&box.width>0,width:box?.width||0,
  title:(document.querySelector('#sidechat-title')?.textContent||'').trim(),
  answers,cardOptions:document.querySelectorAll('#sidechat-messages .quiz-card .quiz-option').length};
});
async function expectDock(page,{answers=false,card=false,title=''}={}){
 const facts=await chatFacts(page);
 if(!facts.visible)throw Error(`o chat preso não está visível na Mesa (largura ${facts.width})`);
 if(title&&facts.title!==title)throw Error(`título do chat "${facts.title}", esperado "${title}"`);
 if(answers&&!facts.answers.some(text=>text.length>15))throw Error('sem resposta do tutor no chat preso');
 if(card&&facts.cardOptions<2)throw Error(`cartão sem opções no chat preso (${facts.cardOptions})`);
 return facts;
}
async function expectChildAnswer(child,{card=false,title=''}={}){
 const facts=await chatFacts(child);
 if(!facts.visible)throw Error(`o chat não está visível na janela solta (largura ${facts.width})`);
 if(title&&facts.title!==title)throw Error(`título da janela solta "${facts.title}", esperado "${title}"`);
 if(!facts.answers.some(text=>text.length>15))throw Error('sem resposta do tutor na janela solta');
 if(card&&facts.cardOptions<2)throw Error(`cartão sem opções na janela solta (${facts.cardOptions})`);
 return facts;
}
const menuFacts=page=>page.evaluate(()=>{
 const pop=document.querySelector('#sidechat-more-pop');
 const items=[...(pop?.querySelectorAll('[role="menuitem"],[role="menuitemcheckbox"]')||[])]
  .filter(el=>!el.hidden&&el.getBoundingClientRect().width>0)
  .map(el=>({id:el.id,text:(el.textContent||'').replace(/\s+/g,' ').trim(),checked:el.getAttribute('aria-checked'),state:el.dataset.state||''}));
 return {open:!!pop&&!pop.hidden,items};
});
async function expectMenu(page,{items=[],absent=[],checked=null,state=''}){
 const facts=await menuFacts(page);
 if(!facts.open)throw Error('o menu Mais opções não está aberto');
 const texts=facts.items.map(item=>item.text);
 for(const wanted of items)if(!texts.some(text=>text.includes(wanted)))throw Error(`menu sem "${wanted}" (tem: ${texts.join(' | ')})`);
 for(const hidden of absent)if(texts.some(text=>text.includes(hidden)))throw Error(`menu com "${hidden}" que devia estar oculto`);
 if(checked!==null){
  const top=facts.items.find(item=>item.id==='sidechat-always-on-top');
  if(!top)throw Error('menu sem o item Sempre por cima');
  if(top.checked!==String(checked))throw Error(`Sempre por cima com aria-checked=${top.checked}, esperado ${checked}`);
  if(state&&top.state!==state)throw Error(`Sempre por cima com estado "${top.state}", esperado "${state}"`);
 }
 return facts;
}
const pinFacts=page=>page.evaluate(()=>{
 const pin=document.querySelector('#sidechat-pin');
 const box=pin?.getBoundingClientRect();
 return {hidden:pin?.hidden??true,width:box?.width||0,height:box?.height||0,
  label:pin?.getAttribute('aria-label')||'',title:pin?.title||'',icon:!!pin?.querySelector('svg')};
});
async function expectPin(page){
 const facts=await pinFacts(page);
 if(facts.hidden||facts.width<=0)throw Error(`o sinal de Sempre por cima não está visível (${JSON.stringify(facts)})`);
 if(!facts.icon)throw Error('o sinal de Sempre por cima está sem o ícone de alfinete');
 if(!/sempre por cima|always on top/i.test(facts.label))throw Error(`sinal do por cima sem nome acessível (veio "${facts.label}")`);
 return facts;
}
async function expectMenuFocus(page,id){
 const active=await page.evaluate(()=>document.activeElement?.id||'');
 if(active!==id)throw Error(`o foco do menu está em "${active}", esperado "${id}"`);
 return focusNow(page);
}
const stripFacts=page=>page.evaluate(()=>{
 const el=document.querySelector('#support-restore');
 if(!el)return {missing:true};
 const box=el.getBoundingClientRect();
 return {missing:false,hidden:el.hidden,width:+box.width.toFixed(1),height:+box.height.toFixed(1),
  label:el.getAttribute('aria-label')||'',text:(el.querySelector('.pdf-restore-label')?.textContent||'').trim()};
});
async function expectStrip(page,{label='Chat em outra janela'}={}){
 const facts=await stripFacts(page);
 if(facts.missing||facts.hidden||facts.width<=0)throw Error(`a faixa não está visível (${JSON.stringify(facts)})`);
 if(!facts.label.includes(label))throw Error(`faixa com rótulo acessível "${facts.label}", esperado "${label}"`);
 return facts;
}
const uncertainFacts=page=>page.evaluate(()=>({
 warn:(document.querySelector('#sidechat-messages .sidechat-warn')?.textContent||'').trim(),
 activity:(document.querySelector('#sidechat-activity')?.textContent||'').trim(),
 sendDisabled:!!document.querySelector('#sidechat-send')?.disabled,
}));
/* Achado 8 (#157): um aviso só, o `.sidechat-warn`; a linha de atividade fica
   vazia no incerto, sem repetir a mesma frase. */
async function expectUncertain(page,{warn='Entrega incerta'}={}){
 const facts=await uncertainFacts(page);
 const has=(text,wanted)=>text.toLowerCase().includes(String(wanted).toLowerCase());
 if(!has(facts.warn,warn))throw Error(`aviso de envio incerto ausente ("${facts.warn}")`);
 if(facts.activity)throw Error(`a linha de atividade repete o incerto ("${facts.activity}")`);
 if(!facts.sendDisabled)throw Error('o Enviar devia estar desligado no estado incerto');
 return facts;
}
const winFacts=page=>page.evaluate(()=>({innerWidth,innerHeight,outerWidth,outerHeight}));
const savedPayload=(locale='pt-BR',{uncertain=true}={})=>{
 const en=locale==='en';
 return {id:`sc-${en?'22222222-2222-4222-8222-222222222222':'11111111-1111-4111-8111-111111111111'}`,engine:'opencode',
  messages:[
   {role:'user',text:en?'Explain the fundamental limit in one line.':'Explique o limite fundamental em uma linha.'},
   {role:'assistant',text:en?'Divide numerator and denominator by x before substituting.':'Divida numerador e denominador por x antes de substituir.'},
  ],draft:'',busy:false,uncertain,
  context:{mainSession:'',refs:[{path:'/tmp/ciclo2/Limites.pdf',page:1},{path:'/tmp/ciclo2/Formulario.pdf',page:1}],study:{},at:1700000000000},
  cards:[]};
};
const injectSaved=async(page,locale,target=page,{uncertain=true}={})=>{
 await page.evaluate(async payload=>{const sidechat=await import('./src/sidechat.mjs');sidechat.openSavedSidechat(payload);},savedPayload(locale,{uncertain}));
 if(uncertain)await target.waitForSelector('#sidechat-messages .sidechat-warn',{timeout:10000});
 else await target.waitForFunction(()=>!document.querySelector('#sidechat-messages .sidechat-warn'),undefined,{timeout:10000});
 await target.evaluate(()=>document.activeElement?.blur?.());
};

/* ---------- 1. janela solta, faixa, soltar/trazer e sempre por cima ---------- */

await block('solto',async ctx=>{
 const {runtime,app,page}=await bootCourse('ciclo2-solto');
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await sendSidechat(page,'teorema do chat lateral');
 await waitAssistant(page);

 await fitWindow(app,page,1440,900);
 for(const theme of ['light','dark']){
  await applyTheme(page,null,theme);
  await page.locator('#sidechat-more').click();
  await page.locator('#sidechat-detach').waitFor({state:'visible'});
  await snap(page,`mesa-menu-soltar-${PT[theme]}-1440x900`,{scope:'#sidechat-more-pop',
   expect:()=>expectMenu(page,{items:['Soltar em outra janela'],absent:['Sempre por cima']}),
   extra:{theme,locale:'pt-BR',state:'menu-soltar',window:await winFacts(page)}});
  await page.keyboard.press('Escape');
  await page.locator('#sidechat-more-pop').waitFor({state:'hidden'});
 }

 const child=await detachSidechat(page,app);
 const childWin=await app.browserWindow(child);
 const defaultAlwaysOnTop=await childWin.evaluate(bw=>bw.isAlwaysOnTop());

 for(const [width,height] of [[380,800],[420,1000]]){
  const size=await fitWindow(app,child,width,height);
  for(const theme of ['light','dark']){
   await applyTheme(page,child,theme);
   await snap(child,`solto-resposta-${PT[theme]}-${width}x${height}`,{scope:'#sidechat',
    expect:()=>expectChildAnswer(child,{title:'Chat lateral'}),
    extra:{theme,locale:'pt-BR',state:'janela-solta-resposta-do-tutor',window:size}});
  }
 }

 for(const [width,height] of [[1440,900],[900,650]]){
  const size=await fitWindow(app,page,width,height);
  for(const theme of ['light','dark']){
   await applyTheme(page,child,theme);
   await snap(page,`mesa-faixa-${PT[theme]}-${width}x${height}`,{scope:'#support-slot',
    expect:()=>expectStrip(page),
    extra:{theme,locale:'pt-BR',state:'faixa-chat-em-outra-janela',window:size}});
  }
 }

 await fitWindow(app,child,380,800);
 for(const theme of ['light','dark']){
  await applyTheme(page,child,theme);
  await child.locator('#sidechat-more').click();
  await child.locator('#sidechat-detach').waitFor({state:'visible'});
  if(await child.locator('#sidechat-always-on-top').getAttribute('aria-checked')==='true'){
   await child.locator('#sidechat-always-on-top').click();
   await pollUntil(()=>childWin.evaluate(bw=>bw.isAlwaysOnTop()),value=>value===false,{timeout:10000,interval:100,what:'o Sempre por cima desligar'});
  }
  await snap(child,`solto-menu-trazer-${PT[theme]}-380x800`,{scope:'#sidechat-more-pop',
   expect:()=>expectMenu(child,{items:['Trazer de volta','Sempre por cima'],checked:false,state:'Desligada'}),
   extra:{theme,locale:'pt-BR',state:'menu-trazer-de-volta-e-por-cima-desligado',defaultAlwaysOnTop,alwaysOnTop:await childWin.evaluate(bw=>bw.isAlwaysOnTop()),desk:deskFlags(runtime)}});
  await child.locator('#sidechat-always-on-top').click();
  await pollUntil(()=>childWin.evaluate(bw=>bw.isAlwaysOnTop()),value=>value===true,{timeout:10000,interval:100,what:'o Sempre por cima ligar na janela'});
  await pollUntil(()=>deskFlags(runtime).sidechatAlwaysOnTop,value=>value===true,{timeout:10000,interval:100,what:'o Sempre por cima gravar no desk.json'});
  await snap(child,`solto-menu-por-cima-${PT[theme]}-380x800`,{scope:'#sidechat-more-pop',
   expect:()=>expectMenu(child,{items:['Sempre por cima'],checked:true,state:'Ligada'}),
   extra:{theme,locale:'pt-BR',state:'menu-sempre-por-cima-ligado',alwaysOnTop:await childWin.evaluate(bw=>bw.isAlwaysOnTop()),desk:deskFlags(runtime)}});
  /* Achado 15: com o menu fechado, o cabeçalho da filha mostra o alfinete. */
  await child.keyboard.press('Escape');
  await child.locator('#sidechat-more-pop').waitFor({state:'hidden'});
  await snap(child,`solto-por-cima-sinal-${PT[theme]}-380x800`,{scope:'#sidechat',
   expect:()=>expectPin(child),
   extra:{theme,locale:'pt-BR',state:'sempre-por-cima-sinal-no-cabecalho',alwaysOnTop:await childWin.evaluate(bw=>bw.isAlwaysOnTop()),desk:deskFlags(runtime)}});
  await child.locator('#sidechat-more').click();
  await child.locator('#sidechat-always-on-top').click();
  await pollUntil(()=>childWin.evaluate(bw=>bw.isAlwaysOnTop()),value=>value===false,{timeout:10000,interval:100,what:'o Sempre por cima voltar a desligar'});
  await child.keyboard.press('Escape');
  await child.locator('#sidechat-more-pop').waitFor({state:'hidden'});
 }

 /* Menu "Mais opções" pelo teclado (#157, achado 1): setas, Home/End e Esc. */
 for(const theme of ['light','dark']){
  await applyTheme(page,child,theme);
  await child.locator('#sidechat-more').focus();
  await child.keyboard.press('ArrowDown');
  await child.waitForFunction(()=>document.querySelector('#sidechat-more-pop')?.hidden===false,undefined,{timeout:5000});
  await child.keyboard.press('Home');
  await expectMenuFocus(child,'sidechat-context');
  await child.keyboard.press('End');
  const focus=await expectMenuFocus(child,'sidechat-always-on-top');
  await snap(child,`teclado-solto-menu-item-${PT[theme]}-380x800`,{scope:'#sidechat-more-pop',
   expect:()=>expectMenuFocus(child,'sidechat-always-on-top'),
   extra:{theme,locale:'pt-BR',state:'teclado-menu-mais-opcoes',control:'sidechat-always-on-top',focus}});
  await child.keyboard.press('Escape');
  await child.locator('#sidechat-more-pop').waitFor({state:'hidden'});
  if((await focusNow(child))?.id!=='sidechat-more')throw Error(`Esc não devolveu o foco ao Mais opções (${theme})`);
 }

 /* Percurso só pelo teclado na janela solta: Tab por cada controle, com o
    anel de foco na captura; o resumo guarda a rota completa. */
 await fitWindow(app,child,380,800);
 await applyTheme(page,child,'light');
 await child.evaluate(()=>document.activeElement?.blur?.());
 const childRoute=[];const childSeen=new Set();
 for(let step=1;step<=24&&childSeen.size<12;step++){
  await child.keyboard.press('Tab');
  const focus=await focusNow(child);
  if(!focus)continue;
  childRoute.push({step,...focus});
  if(childSeen.has(focus.key))continue;
  childSeen.add(focus.key);
  const slug=slugify(focus.id||focus.label)||`controle-${childSeen.size}`;
  await snap(child,`teclado-solto-${String(childSeen.size).padStart(2,'0')}-${slug}-claro-380x800`,{scope:'#sidechat',
   expect:async()=>{const now=await focusNow(child);if(!now||now.key!==focus.key)throw Error(`o foco saiu de "${focus.id||focus.label}" (agora "${now?.id||now?.label||'nada'}")`);},
   extra:{theme:'light',locale:'pt-BR',state:'teclado-foco',step,control:focus.id||focus.label,focusRoute:childRoute.map(item=>item.id||item.label)}});
 }
 fs.writeFileSync(path.join(OUT,'teclado-solto-resumo.json'),JSON.stringify({theme:'light',size:{width:380,height:800},
  controls:[...childSeen].map(key=>{const item=childRoute.find(entry=>entry.key===key)||{};return {key,id:item.id||'',label:item.label||''};}),route:childRoute},null,2));

 /* Percurso só pelo teclado até a faixa da Mesa, nos dois temas. */
 for(const theme of ['light','dark']){
  await fitWindow(app,page,1440,900);
  await applyTheme(page,child,theme);
  await page.locator('#sidechat-toggle').focus();
  const route=[];let found=false;
  for(let step=1;step<=300&&!found;step++){
   await page.keyboard.press('Tab');
   const focus=await focusNow(page);
   if(!focus)continue;
   route.push({step,...focus});
   if(focus.id!=='support-restore')continue;
   await snap(page,`teclado-faixa-${PT[theme]}-1440x900`,{scope:'#support-slot',
    expect:()=>expectStrip(page),
    extra:{theme,locale:'pt-BR',state:'teclado-faixa',focusRoute:route.map(item=>item.id||item.key)}});
   found=true;
  }
  if(!found){
   await page.locator('#support-restore').focus();
   await page.keyboard.press('Shift+Tab');
   await page.keyboard.press('Tab');
   const focus=await focusNow(page);
   if(focus?.id!=='support-restore')throw Error(`o Tab não chegou à faixa "Chat em outra janela" (${theme}); rota: ${route.map(item=>item.id||item.key).join(' → ')}`);
   await snap(page,`teclado-faixa-${PT[theme]}-1440x900`,{scope:'#support-slot',
    expect:()=>expectStrip(page),
    extra:{theme,locale:'pt-BR',state:'teclado-faixa',fallback:true,focusRoute:route.map(item=>item.id||item.key)}});
  }
  fs.writeFileSync(path.join(OUT,`teclado-faixa-resumo-${PT[theme]}.json`),JSON.stringify({theme,route:route.map(item=>({step:item.step,id:item.id,key:item.key,focusVisible:item.focusVisible,outline:item.outline,boxShadow:item.boxShadow}))},null,2));
 }

 /* Trazer de volta: a filha fecha, o nó volta para a Mesa e o foco cai no campo. */
 await applyTheme(page,child,'light');
 await attachSidechat(child,page);
 const backFocus=await focusNow(page);
 if(backFocus?.id!=='sidechat-prompt')throw Error(`trazer de volta não devolveu o foco ao campo (foi para "${backFocus?.id||backFocus?.key||'nada'}")`);
 for(const shot of [{width:1440,height:900,theme:'light'},{width:1440,height:900,theme:'dark'},{width:900,height:650,theme:'light'}]){
  const size=await fitWindow(app,page,shot.width,shot.height);
  await applyTheme(page,null,shot.theme);
  await snap(page,`mesa-trazido-de-volta-${PT[shot.theme]}-${shot.width}x${shot.height}`,{scope:'#sidechat',
   expect:()=>expectDock(page,{answers:true,title:'Chat lateral'}),
   extra:{theme:shot.theme,locale:'pt-BR',state:'trazido-de-volta',focus:'sidechat-prompt',window:size}});
 }
});

/* ---------- 1b. janela solta: vazio, carregando e erro (módulo próprio) ---------- */
await runEstadoBlocks(block);

/* ---------- 2. chat preso na Mesa: resposta, cartões e envio incerto ---------- */

await block('preso',async ctx=>{
 const {runtime,app,page}=await bootCourse('ciclo2-preso',{env:{FAKE_OPENCODE_REPLY:REPLY_PT,FAKE_OPENCODE_MCP_CALL:QUIZ_PT}});
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await sendSidechat(page,'quiz de teste no lateral');
 await waitCard(page);
 await waitAssistant(page);
 for(const [width,height] of [[1440,900],[900,650]]){
  const size=await fitWindow(app,page,width,height);
  for(const theme of ['light','dark']){
   await applyTheme(page,null,theme);
   await snap(page,`preso-cartao-${PT[theme]}-${width}x${height}`,{scope:'#sidechat',
    expect:()=>expectDock(page,{answers:true,card:true,title:'Chat lateral'}),
    extra:{theme,locale:'pt-BR',state:'preso-resposta-e-cartao',window:size}});
  }
 }

 /* Cartão respondido: a opção certa fica verde, a ação vira "Concluir". */
 await page.locator('#sidechat-messages .quiz-card .quiz-option').filter({hasText:'4'}).click();
 await page.waitForFunction(()=>document.querySelectorAll('#sidechat-messages .quiz-card .quiz-option.correct').length>0,undefined,{timeout:15000});
 const answered=async()=>{
  const facts=await page.evaluate(()=>({
   correct:document.querySelectorAll('#sidechat-messages .quiz-card .quiz-option.correct').length,
   checked:[...document.querySelectorAll('#sidechat-messages .quiz-card .quiz-option')].filter(el=>el.getAttribute('aria-checked')==='true').length,
   conclude:!!document.querySelector('#sidechat-messages .quiz-card .quiz-conclude'),
  }));
  if(facts.correct<1)throw Error('o cartão respondido não marca a opção certa');
  if(facts.checked<1)throw Error('o cartão respondido não mantém a escolha');
  if(!facts.conclude)throw Error('o cartão respondido não oferece "Concluir"');
  return facts;
 };
 for(const [width,height] of [[1440,900],[900,650]]){
  const size=await fitWindow(app,page,width,height);
  for(const theme of ['light','dark']){
   await applyTheme(page,null,theme);
   await snap(page,`preso-cartao-respondido-${PT[theme]}-${width}x${height}`,{scope:'#sidechat',
    expect:answered,
    extra:{theme,locale:'pt-BR',state:'preso-cartao-respondido',window:size}});
  }
 }

 /* Toast de "copiado": o clipboard vira um gravador nomeado; o toast nasce do
    caminho real do botão Copiar da resposta. */
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__c2Copied=text;}}});});
 for(const theme of ['light','dark']){
  const size=await fitWindow(app,page,1440,900);
  await applyTheme(page,null,theme);
  await page.locator('#sidechat-messages .sidechat-msg.assistant .sidechat-copy').last().click();
  /* Retorno local do Copiar desde dd57e5fa: "Copiado" no botão, sem toast. */
  await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-copy')].some(el=>/^(Copiado|Copied)$/.test(el.getAttribute('aria-label')||'')),undefined,{timeout:8000});
  if(await page.evaluate(()=>[...document.querySelectorAll('#toast .toast-item')].some(el=>!el.classList.contains('out')&&/copiada|copied/i.test(el.textContent||''))))throw Error('o Copiar do lateral não devia abrir toast');
  await snap(page,`preso-copiado-${PT[theme]}-1440x900`,{scope:'#sidechat',
   expect:async()=>{if(!(await page.evaluate(()=>String(window.__c2Copied||'').length>0)))throw Error('o Copiar não escreveu no clipboard');},
   extra:{theme,locale:'pt-BR',state:'copiado-local',window:size}});
  await page.waitForFunction(()=>![...document.querySelectorAll('#toast .toast-item')].some(el=>!el.classList.contains('out')),undefined,{timeout:12000});
 }
 await injectSaved(page,'pt-BR');
 for(const [width,height] of [[1440,900],[900,650]]){
  const size=await fitWindow(app,page,width,height);
  for(const theme of ['light','dark']){
   await applyTheme(page,null,theme);
   await snap(page,`preso-incerto-${PT[theme]}-${width}x${height}`,{scope:'#sidechat',
    expect:()=>expectUncertain(page),
    extra:{theme,locale:'pt-BR',state:'preso-envio-incerto',window:size}});
  }
 }
});

/* ---------- 3. inglês: um tamanho de cada estado ---------- */

await block('en',async ctx=>{
 const {runtime,app,page}=await bootCourse('ciclo2-en',{env:{LEARNING_DESK_LOCALE:'en-US',FAKE_OPENCODE_REPLY:REPLY_EN,FAKE_OPENCODE_MCP_CALL:QUIZ_EN}});
 ctx.runtime=runtime;ctx.app=app;
 await page.waitForFunction(()=>document.documentElement.lang==='en',undefined,{timeout:15000});
 await openSidechat(page);
 await sendSidechat(page,'side chat quiz in English');
 await waitCard(page);
 await waitAssistant(page);
 let size=await fitWindow(app,page,900,650);
 await applyTheme(page,null,'light');
 await snap(page,'en-preso-cartao-light-900x650',{scope:'#sidechat',
  expect:()=>expectDock(page,{answers:true,card:true,title:'Side chat'}),
  extra:{theme:'light',locale:'en',state:'preso-resposta-e-cartao',window:size}});
 await page.locator('#sidechat-more').click();
 await snap(page,'en-menu-soltar-light-900x650',{scope:'#sidechat-more-pop',
  expect:()=>expectMenu(page,{items:['Detach to another window'],absent:['Always on top']}),
  extra:{theme:'light',locale:'en',state:'menu-soltar',window:await winFacts(page)}});
 await page.keyboard.press('Escape');
 await page.locator('#sidechat-more-pop').waitFor({state:'hidden'});

 const child=await detachSidechat(page,app);
 const childWin=await app.browserWindow(child);
 size=await fitWindow(app,child,380,800);
 await applyTheme(page,child,'light');
 await snap(child,'en-solto-resposta-light-380x800',{scope:'#sidechat',
  expect:()=>expectChildAnswer(child,{card:true,title:'Side chat'}),
  extra:{theme:'light',locale:'en',state:'janela-solta-resposta-do-tutor',window:size}});

 size=await fitWindow(app,page,900,650);
 await snap(page,'en-faixa-light-900x650',{scope:'#support-slot',
  expect:()=>expectStrip(page,{label:'Chat in another window'}),
  extra:{theme:'light',locale:'en',state:'faixa-chat-em-outra-janela',window:size}});

 size=await fitWindow(app,child,380,800);
 await child.locator('#sidechat-more').click();
 await child.locator('#sidechat-detach').waitFor({state:'visible'});
 await snap(child,'en-solto-menu-trazer-light-380x800',{scope:'#sidechat-more-pop',
  expect:()=>expectMenu(child,{items:['Bring back','Always on top'],checked:false,state:'Off'}),
  extra:{theme:'light',locale:'en',state:'menu-trazer-de-volta-e-por-cima-desligado',window:size,alwaysOnTop:await childWin.evaluate(bw=>bw.isAlwaysOnTop())}});
 await child.locator('#sidechat-always-on-top').click();
 await pollUntil(()=>childWin.evaluate(bw=>bw.isAlwaysOnTop()),value=>value===true,{timeout:10000,interval:100,what:'o Always on top ligar'});
 await snap(child,'en-solto-menu-por-cima-light-380x800',{scope:'#sidechat-more-pop',
  expect:()=>expectMenu(child,{items:['Always on top'],checked:true,state:'On'}),
  extra:{theme:'light',locale:'en',state:'menu-sempre-por-cima-ligado',window:size,alwaysOnTop:await childWin.evaluate(bw=>bw.isAlwaysOnTop())}});
 await child.locator('#sidechat-always-on-top').click();
 await pollUntil(()=>childWin.evaluate(bw=>bw.isAlwaysOnTop()),value=>value===false,{timeout:10000,interval:100,what:'o Always on top desligar'});
 await child.keyboard.press('Escape');
 await child.locator('#sidechat-more-pop').waitFor({state:'hidden'});

 await injectSaved(page,'en',child);
 await snap(child,'en-solto-incerto-light-380x800',{scope:'#sidechat',
  expect:()=>expectUncertain(child,{warn:'uncertain delivery'}),
  extra:{theme:'light',locale:'en',state:'envio-incerto',window:await winFacts(child)}});

 /* Estado restaurado limpo: sem o aviso de incerto da etapa anterior, para o
    "trazido de volta" em inglês a 900×650 não herdar o Enviar desligado. */
 await injectSaved(page,'en',child,{uncertain:false});
 await attachSidechat(child,page);
 size=await fitWindow(app,page,900,650);
 await applyTheme(page,null,'light');
 await snap(page,'en-mesa-trazido-de-volta-light-900x650',{scope:'#sidechat',
  expect:async()=>{
   const facts=await expectDock(page,{answers:true,title:'Side chat'});
   const clean=await page.evaluate(()=>({warn:!!document.querySelector('#sidechat-messages .sidechat-warn'),sendDisabled:(()=>{const box=document.querySelector('#sidechat-prompt'),send=document.querySelector('#sidechat-send');if(!box||!send)return true;const prev=box.value;box.value='x';box.dispatchEvent(new Event('input',{bubbles:true}));const off=send.disabled;box.value=prev;box.dispatchEvent(new Event('input',{bubbles:true}));return off;})()}));
   if(clean.warn)throw Error('o trazido de volta em inglês ainda carrega o aviso de incerto');
   if(clean.sendDisabled)throw Error('o trazido de volta em inglês ainda está com o Enviar desligado');
   return facts;
  },
  extra:{theme:'light',locale:'en',state:'trazido-de-volta-limpo',window:size}});
});

fs.writeFileSync(path.join(OUT,'falhas.json'),JSON.stringify({removedBeforeRun:REMOVED,failures},null,2));
console.log('capturas do ciclo 2 (chat solto) em',OUT);
console.log('falhas:',JSON.stringify(failures,null,2));
process.exitCode=failures.length?1:0;
