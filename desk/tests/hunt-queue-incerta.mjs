/* Caça #36: fechar a Mesa NO MEIO do turno do tutor (sem Parar), reabrir e
   tentar mandar a fila recuperada. O host marca a conversa como entrega incerta
   e recusa o envio — a mensagem em voo pode ter chegado e não é reenviada. O
   que este hunt prova é que a fila não fica com um "Enviar agora" que promete
   o que o host vai recusar: a ação fica à vista, desligada, com o motivo e a
   saída (Limpar). A fila recuperada de uma entrega terminal (o bloco 7 do
   `hunt-queue`) continua com o "Enviar agora" ligado.
   Rodar: `node tests/hunt-queue-incerta.mjs`. */
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {withArtifacts,launchDesk,newRuntime,seedCourse,seedNativeSession,writeDeskJson,writeConfigJson,toastWait,sendEnabled,statusOnline,saveArtifacts} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const EVIDENCE=process.env.EVIDENCE==='1';
const log=(...a)=>console.log(...a);
function watch(page){
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 return errors;
}

await withArtifacts('hunt-queue-incerta',async ctx=>{
 const runtime=ctx.runtime=newRuntime('hunt-queue-incerta');
 const course=seedCourse(runtime,'Calc');
 const logFile=path.join(runtime,'queue.log');
 const current=seedNativeSession(runtime,[{role:'user',content:[{type:'text',text:'corrente'}],timestamp:1700000002000}],{courseId:'Calc'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{session:current,courseId:'Calc',courseStates:{Calc:{session:current,sessions:[]}}});
 /* O turno fica em voo até o app fechar: é o fechamento no meio que deixa a
    entrega recuperável como incerta. */
 const env={FAKE_OPENCODE_QUEUE_LOG:logFile,FAKE_OPENCODE_QUEUE_HOLD_MS:'60000',FAKE_OPENCODE_REFUSAL_LOG:path.join(runtime,'refusal.log'),FAKE_OPENCODE_LOG:path.join(runtime,'fake.log')};
 let app=ctx.app=await launchDesk({runtime,env});
 let page=await app.firstWindow();
 const errors=watch(page);
 await statusOnline(page);
 await sendEnabled(page);
 const entries=()=>{
  try{return fs.readFileSync(logFile,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}
  catch{return [];}
 };
 const firstLines=()=>entries().map(entry=>String(entry.message||'').split('\n')[0]);
 const queueTexts=()=>page.evaluate(()=>[...document.querySelectorAll('.queue-item span')].map(span=>span.textContent));

 /* ---------- 1. turno em voo com dois itens na fila ---------- */
 await page.locator('#prompt').fill('base');
 await page.locator('#prompt').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('#stop').hidden,undefined,{timeout:15000});
 for(const text of ['um','dois']){
  await page.locator('#prompt').fill(text);
  await page.locator('#prompt').press('Enter');
 }
 await pollUntil(queueTexts,texts=>texts.join('|')==='um|dois',{timeout:10000,what:'a fila com os dois itens'});
 /* A base chegou ao motor: a entrega já foi escrita e o fechamento é no meio. */
 await pollUntil(firstLines,lines=>lines.includes('base'),{timeout:20000,what:'a base chegar ao OpenCode'});
 const before=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'))[current];
 assert.deepEqual(before.items.map(item=>item.text),['um','dois'],'a fila foi para o disco antes de fechar');

 /* ---------- 2. fecha SEM Parar e reabre: a conversa volta incerta ---------- */
 await app.close();
 app=ctx.app=await launchDesk({runtime,env});
 page=await app.firstWindow();
 errors.push(...watch(page));
 await toastWait(page,'mensagens pendentes foram recuperadas');
 await statusOnline(page);
 await page.waitForFunction(()=>document.querySelector('#stop').hidden,undefined,{timeout:30000});
 const reopened=await page.evaluate(async()=>{
  const state=await import('./src/state.mjs');
  return {uncertain:!!state.S.uncertain,busy:!!state.S.busy};
 });
 log('[incerta] estado:',JSON.stringify(reopened));
 assert.deepEqual(reopened,{uncertain:true,busy:false},'fechar no meio reabre a conversa como entrega incerta');

 /* ---------- 3. a fila recuperada não promete o envio que o host recusa ---------- */
 await page.waitForSelector('.queue-send-now',{timeout:10000});
 const strip=await page.evaluate(()=>{
  const sendNow=document.querySelector('.queue-send-now');
  return {
   label:document.querySelector('.queue-label')?.textContent,
   rows:[...document.querySelectorAll('.queue-item span')].map(span=>span.textContent),
   sendNow:!!sendNow&&!sendNow.hidden,
   disabled:sendNow?.disabled===true,
   title:sendNow?.title||'',
  };
 });
 log('[incerta] faixa:',JSON.stringify(strip));
 assert.equal(strip.label,'Recuperadas · 2','a faixa diz que a fila veio do disco');
 assert.deepEqual(strip.rows,['um','dois'],'os itens voltam na ordem, com o texto');
 assert.equal(strip.sendNow,true,'a ação continua à vista, com o motivo');
 assert.equal(strip.disabled,true,'a conversa incerta desliga o "Enviar agora"');
 assert.match(strip.title,/incerta/i,'a dica diz que a entrega está incerta');
 assert.match(strip.title,/Limpar/,'a dica aponta a saída que existe');

 /* Nem um clique forçado no botão desligado manda a fila: nada é reenviado. */
 await page.evaluate(()=>document.querySelector('.queue-send-now')?.click());
 await page.waitForTimeout(1600);// espera fixa: "nada acontece em 1,6 s" — incerto não reenvia sozinho
 assert.deepEqual(firstLines(),['base'],'a fila recuperada não é reenviada nem por clique');
 const kept=JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'))[current];
 assert.deepEqual(kept.items.map(item=>item.text),['um','dois'],'os itens continuam guardados no disco');

 /* ---------- 4. Limpar é a saída visível, e descarta sem enviar ---------- */
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('.queue-clear').click();
 await toastWait(page,'Fila limpa.');
 await page.waitForFunction(()=>!document.querySelector('.queue-strip'),undefined,{timeout:10000});
 assert.deepEqual(firstLines(),['base'],'o que foi limpo não chegou ao motor');

 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
 if(EVIDENCE)await saveArtifacts(ctx);
 log('HUNT queue-incerta PASSED');
});
