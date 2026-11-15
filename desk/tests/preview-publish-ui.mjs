/* #62: a prévia sem erro publica o quadro na hora, no ponto da chamada; a
   revisão (activityId + conteúdo corrigido) troca o MESMO quadro no lugar; a
   prévia com erro não aparece e o H4 do fim do turno mostra o aviso. Ao
   reabrir, o quadro publicado volta no mesmo ponto, na versão nova.
   Roda da pasta desk: `node --test tests/preview-publish-ui.mjs`. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchDesk,withArtifacts,enterFree} from './helpers.mjs';
import {tempDir} from './temp-dir.mjs';
import {pollUntil} from './waits.mjs';

const BEFORE='Antes da prévia.';
const AFTER='Depois da prévia.';
const CLEAN={
 title:'Reta secante (prévia limpa)',
 objective:'Prever o sinal da inclinação',
 alternativeMarkdown:'Atividade preparada na prévia: escolha o sinal de m.',
 html:'<p id="m">m = 0,31</p>',
 css:'',
 js:'mesa.ready();',
 kind:'atividade',
};
const FIXED={...CLEAN,html:'<p id="m">corrigido</p>'};
const BROKEN={
 title:'Atividade com erro',
 objective:'Prévia que não publica',
 alternativeMarkdown:'Prévia com erro de console de propósito.',
 html:'<p id="m">quebrada</p>',
 css:'',
 js:'mesa.ready();console.error("erro de propósito na prévia");',
 kind:'atividade',
};

const childrenOrder=page=>page.evaluate(({before,after})=>{
 const nodes=[...document.querySelector('#messages').children];
 const users=nodes.map((el,index)=>el.classList.contains('message')&&el.classList.contains('user')?index:-1).filter(index=>index>=0);
 const range=nodes.slice(users[0]??0,users[1]??nodes.length);
 const textA=range.findIndex(el=>!el.classList.contains('activity-slot')&&el.textContent.includes(before));
 const board=range.findIndex(el=>el.classList.contains('activity-slot')&&String(el.dataset.activityCall||'').startsWith('previa:'));
 const textB=range.findIndex(el=>!el.classList.contains('activity-slot')&&el.textContent.includes(after));
 return {textA,board,textB};
},{before:BEFORE,after:AFTER});

const frameText=async(page,version='2')=>{
 for(const frame of page.frames().filter(candidate=>candidate.url().startsWith(`mesa-activity://`)&&candidate.url().includes(`--v${version}/`))){
  try{return await frame.locator('#m').textContent();}catch{/* frame trocado no meio: tenta o próximo */}
 }
 return null;
};

await withArtifacts('preview-publish-ui',async ctx=>{
 ctx.runtime=tempDir('mesa-preview-publish');
 fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
 const log=path.join(ctx.runtime,'mcp.jsonl');
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{
  FAKE_OPENCODE_MCP_CALLS:JSON.stringify([
   {name:'previsualizar_atividade',id:'call_prev_clean',input:CLEAN},
   {name:'criar_atividade',id:'call_revise',input:{title:FIXED.title,objective:FIXED.objective,alternativeMarkdown:FIXED.alternativeMarkdown,activityId:'$last',html:FIXED.html,css:FIXED.css,js:FIXED.js}},
   {name:'previsualizar_atividade',id:'call_prev_error',input:BROKEN},
  ]),
  FAKE_OPENCODE_MCP_BEFORE:BEFORE,
  FAKE_OPENCODE_MCP_AFTER:AFTER,
  FAKE_OPENCODE_MCP_LOG:log,
 }});
 const page=await ctx.app.firstWindow(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 const send=async text=>{
  await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:60000});
  await page.locator('#prompt').fill(text);
  await page.locator('#send').click();
 };
 const afterCount=async()=>page.locator('#messages .message').filter({hasText:AFTER}).count();
 const mcpResults=()=>fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));

 /* ---- 1. prévia limpa publica durante a chamada, sem criar_atividade ---- */
 await send('Crie uma atividade.');
 await page.waitForFunction(text=>document.querySelector('#messages').textContent.includes(text),AFTER,{timeout:60000});
 const slot=page.locator('.activity-slot[data-activity-call^="previa:"]');
 await slot.locator('.activity-card[data-state="ready"]').waitFor({timeout:30000});
 assert.equal(await slot.count(),1,'a prévia limpa virou um quadro só, sem criar_atividade');
 assert.equal(await page.locator('.activity-slot[data-activity-call="call_prev_clean"]').count(),0,'a chamada da prévia não abre slot próprio');
 const first=(await page.evaluate(()=>window.desk.activityList())).items;
 assert.equal(first.length,1);
 assert.match(first[0].toolCallId,/^previa:prv-/);
 assert.equal(first[0].version,1);
 assert.equal(first[0].title,CLEAN.title);
 const order=await childrenOrder(page);
 assert.ok(order.textA>=0&&order.board>=0&&order.textB>=0,`a fala antes e depois envolvem o quadro (${JSON.stringify(order)})`);
 assert.ok(order.textA<order.board&&order.board<order.textB,`o quadro nasce no ponto da chamada (${JSON.stringify(order)})`);
 /* Publicado ANTES do fim da mensagem do tutor: é o H4 que não participou. */
 const messageAt=await page.evaluate(text=>[...document.querySelectorAll('#messages .message.assistant')].filter(el=>el.textContent.includes(text)).at(-1)?._time||0,AFTER);
 assert.ok(first[0].createdAt<=messageAt,`o quadro existe antes do fim da fala (${first[0].createdAt} <= ${messageAt})`);
 const previewText=mcpResults()[0].result;
 assert.match(previewText,/Quadro publicado: act-[a-z0-9-]+ v1/);
 assert.match(previewText,/o aluno JÁ o vê na conversa, no ponto desta chamada/);

 /* ---- 2. correção com activityId revisa o MESMO slot, sem segundo quadro ---- */
 await send('Corrija o quadro, por favor.');
 await pollUntil(afterCount,count=>count>=2,{timeout:60000,interval:250,what:'o segundo turno terminar'});
 await page.waitForFunction(()=>document.querySelector('.activity-slot[data-activity-call^="previa:"]')?.dataset.activityVersion==='2',undefined,{timeout:30000});
 assert.equal(await page.locator('.activity-slot[data-activity-call^="previa:"]').count(),1,'um quadro só depois da revisão');
 assert.equal(await page.locator('.activity-slot[data-activity-call="call_revise"]').count(),0,'a revisão não ganha slot próprio');
 const revised=(await page.evaluate(()=>window.desk.activityList())).items;
 assert.equal(revised.length,2,'a versão anterior fica no store');
 assert.equal(revised[0].id,revised[1].id,'as duas versões são o mesmo quadro');
 assert.equal(Math.max(...revised.map(item=>item.version)),2);
 assert.match(mcpResults()[1].result,/MESMO quadro, trocado no lugar/);
 assert.match(await slot.locator('.activity-alternative').textContent(),/escolha o sinal de m/,'o quadro revisado continua no lugar');
 const liveText=await pollUntil(()=>frameText(page),value=>value!==null,{timeout:30000,interval:100,what:'o iframe da versão nova'});
 assert.equal(liveText,'corrigido','o aluno vê o conteúdo corrigido');

 /* ---- 3. prévia com erro: nada aparece; no fim do turno, o aviso de hoje ---- */
 await send('Faça uma prévia com erro.');
 await pollUntil(afterCount,count=>count>=3,{timeout:60000,interval:250,what:'o turno da prévia com erro terminar'});
 await page.locator('.activity-slot .activity-note').filter({hasText:/não foi publicada|not published/i}).waitFor({timeout:30000});
 assert.equal(await page.locator('.activity-slot[data-activity-call="call_prev_error"]').count(),0,'prévia com erro não abre slot');
 assert.equal((await page.evaluate(()=>window.desk.activityList())).items.length,2,'prévia com erro não publica');
 assert.doesNotMatch(mcpResults()[2].result,/Quadro publicado:/);
 assert.match(mcpResults()[2].result,/Nada apareceu para o aluno/);

 /* ---- 4. reabrir: o quadro volta no ponto da prévia, na versão nova ---- */
 await page.reload();
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 await page.waitForFunction(text=>document.querySelector('#messages').textContent.includes(text),AFTER,{timeout:60000});
 const reopened=page.locator('.activity-slot[data-activity-call^="previa:"]');
 await reopened.waitFor({timeout:30000});
 assert.equal(await reopened.count(),1,'ao reabrir, um quadro só');
 assert.equal(await page.locator('.activity-slot[data-activity-call="call_revise"]').count(),0,'a revisão não deixa slot no histórico');
 assert.equal(await page.locator('.activity-slot[data-activity-call="call_prev_error"]').count(),0,'prévia com erro também não deixa slot');
 const reopenedOrder=await childrenOrder(page);
 assert.ok(reopenedOrder.textA<reopenedOrder.board&&reopenedOrder.board<reopenedOrder.textB,`o quadro reabre no ponto da chamada (${JSON.stringify(reopenedOrder)})`);
 assert.equal(await reopened.getAttribute('data-activity-version'),'2');
 await reopened.locator('[data-act="open"]').click();
 await reopened.locator('.activity-card[data-state="ready"]').waitFor({timeout:30000});
 const reopenedText=await pollUntil(()=>frameText(page),value=>value!==null,{timeout:30000,interval:100,what:'o iframe da versão nova ao reabrir'});
 assert.equal(reopenedText,'corrigido','ao reabrir, o aluno vê a versão corrigida');
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok preview-publish-ui');
