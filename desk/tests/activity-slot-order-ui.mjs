/* #61: o quadro de atividade nasce no ponto em que o tutor chamou a
   ferramenta — texto antes, quadro, texto depois —, ao vivo e depois de
   reabrir a conversa. A prévia sem erro (#62) publica na chamada e o quadro recuperado
   também volta no ponto de `previsualizar_atividade`, não no fim de `#messages`.
   Roda da pasta desk: `node --test tests/activity-slot-order-ui.mjs`. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchDesk,withArtifacts,enterFree} from './helpers.mjs';
import {tempDir} from './temp-dir.mjs';
import {pollUntil} from './waits.mjs';
import {specFor} from './fixtures/activity-specs.mjs';

const BEFORE='Antes da atividade.';
const AFTER='Depois da atividade.';
const CALL='call_order_61';
const PREVIEW={...specFor('grafico'),title:'Posição no MRUV (prévia)'};

await withArtifacts('activity-slot-order',async ctx=>{
 ctx.runtime=tempDir('mesa-activity-slot-order');
 fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{
  FAKE_OPENCODE_MCP_CALLS:JSON.stringify([
   {name:'criar_atividade',id:CALL,input:specFor('movimento')},
   {name:'previsualizar_atividade',id:'call_prev_61',input:PREVIEW},
  ]),
  FAKE_OPENCODE_MCP_BEFORE:BEFORE,
  FAKE_OPENCODE_MCP_AFTER:AFTER,
 }});
 const page=await ctx.app.firstWindow(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 const sendEnabled=()=>page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:60000});
 const send=async text=>{await page.locator('#prompt').fill(text);await page.locator('#send').click();};
 /* Ordem DENTRO do turno: a fala antes, o slot daquele turno, a fala depois.
    O turno é o trecho entre duas mensagens do aluno, para os dois turnos com o
    mesmo texto A/B não se confundirem. */
 const turnOrder=({turn,preview})=>page.evaluate(({turn,before,after,preview,call})=>{
  const nodes=[...document.querySelector('#messages').children];
  const users=nodes.map((el,index)=>el.classList.contains('message')&&el.classList.contains('user')?index:-1).filter(index=>index>=0);
  const from=users[turn]??0;
  const range=nodes.slice(from,users[turn+1]??nodes.length);
  const textAt=needle=>range.findIndex(el=>!el.classList.contains('activity-slot')&&el.textContent.includes(needle));
  const slotAt=range.findIndex(el=>el.classList.contains('activity-slot')&&(preview?String(el.dataset.activityCall||'').startsWith('previa:'):el.dataset.activityCall===call));
  return {textA:textAt(before),slot:slotAt,textB:textAt(after)};
 },{turn,before:BEFORE,after:AFTER,preview,call:CALL});
 const assertOrder=async({turn,preview,when})=>{
  const order=await turnOrder({turn,preview});
  assert.ok(order.textA>=0,`${when}: a fala antes da chamada aparece`);
  assert.ok(order.slot>=0,`${when}: o quadro do turno aparece`);
  assert.ok(order.textB>=0,`${when}: a fala depois da chamada aparece`);
  assert.ok(order.textA<order.slot,`${when}: o quadro fica depois do texto A (${JSON.stringify(order)})`);
  assert.ok(order.slot<order.textB,`${when}: o quadro fica antes do texto B (${JSON.stringify(order)})`);
 };

 /* ---- ao vivo: atividade publicada no meio da fala ---- */
 await sendEnabled();
 await send('Crie uma atividade.');
 await page.locator(`.activity-slot[data-activity-call="${CALL}"] .activity-card[data-state="ready"]`).waitFor({timeout:60000});
 await page.waitForFunction(text=>document.querySelector('#messages').textContent.includes(text),AFTER,{timeout:60000});
 await assertOrder({turn:0,preview:false,when:'ao vivo'});

 /* ---- ao vivo: prévia sem erro (#62), quadro no ponto da prévia ---- */
 await sendEnabled();
 await send('Faça uma prévia.');
 await page.locator('.activity-slot[data-activity-call^="previa:"] .activity-card[data-state="ready"]').waitFor({timeout:60000});
 await pollUntil(()=>page.locator('.activity-slot[data-activity-call^="previa:"]').count(),count=>count===1,{timeout:30000,interval:200,what:'a prévia do turno virar um quadro só'});
 await assertOrder({turn:1,preview:true,when:'ao vivo (#62)'});

 /* ---- reabrir: o histórico recupera a mesma ordem ---- */
 await sendEnabled();
 await send('Obrigado.');
 await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('Resposta do OpenCode falso'),undefined,{timeout:60000});
 await page.reload();
 await enterFree(page);
 /* O histórico do descritor abre na hora; o connect é a mesma porta que o
    boot usa para reaplicar o histórico do motor (com as ferramentas). */
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 await page.waitForFunction(text=>document.querySelector('#messages').textContent.includes(text),AFTER,{timeout:60000});
 await page.locator(`.activity-slot[data-activity-call="${CALL}"]`).waitFor({timeout:30000});
 await page.locator('.activity-slot[data-activity-call^="previa:"]').waitFor({timeout:30000});
 await assertOrder({turn:0,preview:false,when:'reaberto'});
 await assertOrder({turn:1,preview:true,when:'reaberto (#62)'});
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok activity-slot-order-ui');
