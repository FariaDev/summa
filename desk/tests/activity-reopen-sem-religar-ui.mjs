/* #66: o descritor local guarda a chamada da atividade já no turno; reabrir a
   conversa sem religar o tutor mantém o quadro entre o texto A e o texto B.
   Roda da pasta desk: `node --test tests/activity-reopen-sem-religar-ui.mjs`. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchDesk,withArtifacts,enterFree} from './helpers.mjs';
import {tempDir} from './temp-dir.mjs';
import {specFor} from './fixtures/activity-specs.mjs';

const BEFORE='Antes da atividade.';
const AFTER='Depois da atividade.';
const CALL='call_sem_religar_66';
const PREVIEW={...specFor('grafico'),title:'Posição no MRUV (prévia sem religar)'};

function descriptorMessages(runtime){
 const state=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
 assert.ok(state.session,`sessão OpenCode gravada em ${path.join(runtime,'desk.json')}`);
 return JSON.parse(fs.readFileSync(state.session,'utf8')).messages||[];
}

function toolCalls(messages){
 return messages.flatMap(message=>Array.isArray(message.content)?message.content:[]).filter(part=>part.type==='toolCall').map(part=>({id:part.id,name:part.name,result:String(part.result??'')}));
}

await withArtifacts('activity-reopen-sem-religar',async ctx=>{
 ctx.runtime=tempDir('mesa-activity-reopen-sem-religar');
 const hold=path.join(ctx.runtime,'history.hold');
 fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{
  FAKE_OPENCODE_MCP_CALLS:JSON.stringify([
   {name:'criar_atividade',id:CALL,input:specFor('movimento')},
   {name:'previsualizar_atividade',id:'call_prev_66',input:PREVIEW},
  ]),
  FAKE_OPENCODE_MCP_BEFORE:BEFORE,
  FAKE_OPENCODE_MCP_AFTER:AFTER,
  FAKE_OPENCODE_HISTORY_HOLD_FILE:hold,
 }});
 const page=await ctx.app.firstWindow(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 const sendEnabled=()=>page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:60000});
 const send=async text=>{await page.locator('#prompt').fill(text);await page.locator('#send').click();};

 await sendEnabled();
 await send('Crie uma atividade.');
 await page.locator(`.activity-slot[data-activity-call="${CALL}"] .activity-card[data-state="ready"]`).waitFor({timeout:60000});
 await page.waitForFunction(text=>document.querySelector('#messages').textContent.includes(text),AFTER,{timeout:60000});
 await sendEnabled();
 const callsAfterActivity=toolCalls(descriptorMessages(ctx.runtime));
 console.log('descritor depois de criar_atividade:',JSON.stringify(callsAfterActivity));

 await sendEnabled();
 await send('Faça uma prévia.');
 await page.locator('.activity-slot[data-activity-call^="previa:"] .activity-card[data-state="ready"]').waitFor({timeout:60000});
 await page.waitForFunction(text=>document.querySelector('#messages').textContent.includes(text),AFTER,{timeout:60000});
 await sendEnabled();
 const callsAfterPreview=toolCalls(descriptorMessages(ctx.runtime));
 console.log('descritor depois da prévia:',JSON.stringify(callsAfterPreview));

 /* O histórico do servidor fica segurado: reabrir mostra só o descritor local,
    como quando a pessoa abre a conversa antes de o tutor religar. */
 fs.writeFileSync(hold,'');
 await page.reload();
 await enterFree(page);
 await page.waitForFunction(text=>document.querySelector('#messages').textContent.includes(text),AFTER,{timeout:60000});
 const turns=await page.evaluate(({before,after})=>{
  const nodes=[...document.querySelector('#messages').children];
  const users=nodes.map((el,index)=>el.classList.contains('message')&&el.classList.contains('user')?index:-1).filter(index=>index>=0);
  return users.map((from,index)=>{
   const range=nodes.slice(from,users[index+1]??nodes.length);
   const textAt=needle=>range.findIndex(el=>!el.classList.contains('activity-slot')&&el.textContent.includes(needle));
   const slots=range.map((el,at)=>el.classList.contains('activity-slot')?{call:String(el.dataset.activityCall||''),at}:null).filter(Boolean);
   return {textA:textAt(before),textB:textAt(after),slots};
  });
 },{before:BEFORE,after:AFTER});
 console.log('ordem reaberta sem religar:',JSON.stringify(turns));

 const activityCall=callsAfterActivity.find(part=>part.id===CALL);
 assert.ok(activityCall,'descritor guarda o toolCall de criar_atividade antes de religar');
 assert.ok(activityCall.result.length>0,'descritor guarda o resultado inline de criar_atividade antes de religar');
 const previewCall=callsAfterPreview.find(part=>/previsualizar_atividade$/.test(part.name));
 assert.ok(previewCall,'descritor guarda o toolCall da prévia antes de religar');
 assert.match(previewCall.result,/previaId\s+"prv-[a-z0-9]+"/,'descritor guarda o resultado da prévia (o `previaId` da âncora) antes de religar');
 for(const [turn,call] of [[0,CALL],[1,'previa:']]){
  const order=turns[turn]||{};
  const slot=(order.slots||[]).find(entry=>call==='previa:'?entry.call.startsWith('previa:'):entry.call===call);
  assert.ok(slot,`o quadro ${call} volta ao reabrir sem religar`);
  assert.ok(order.textA<slot.at,`${call}: o quadro fica depois do texto A (${JSON.stringify(order)})`);
  assert.ok(slot.at<order.textB,`${call}: o quadro fica antes do texto B (${JSON.stringify(order)})`);
 }
 fs.rmSync(hold,{force:true});
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok activity-reopen-sem-religar-ui');
