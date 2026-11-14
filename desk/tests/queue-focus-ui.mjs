/* O × de cada item e o "Limpar" mantêm o foco quando a faixa re-renderiza
   (ticket #49). O `desk-busy` (turno começando/terminando) chama
   `renderQueue()`, que troca a faixa inteira; o foco só volta pelo `data-key`
   (`preserveFocus`). A fila é recuperada do disco para o teste não depender do
   fim de um turno do fake.
   Roda: node tests/queue-focus-ui.mjs (ou `npm run -s ui -- queue-focus`). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,seedNativeSession,writeConfigJson,writeDeskJson,launchDesk,statusOnline} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

await withArtifacts('queue-focus',async ctx=>{
 const runtime=ctx.runtime=newRuntime('queue-focus');
 const course=seedCourse(runtime,'Calc');
 const current=seedNativeSession(runtime,[{role:'user',content:[{type:'text',text:'corrente'}],timestamp:1700000002000}],{courseId:'Calc'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{session:current,courseId:'Calc'});
 fs.writeFileSync(path.join(runtime,'pending.json'),JSON.stringify({
  [current]:{items:[{id:'fila-1',text:'primeira'},{id:'fila-2',text:'segunda'}],held:true},
 }));
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===2,undefined,{timeout:30000});

 const focusState=()=>page.evaluate(()=>{
  const active=document.activeElement,item=active?.closest?.('.queue-item');
  return {
   className:typeof active?.className==='string'?active.className:'',
   item:item?.dataset.id||'',
   text:item?.querySelector('span')?.textContent||'',
   body:active===document.body,
  };
 });
 const rerender=()=>page.evaluate(()=>window.dispatchEvent(new CustomEvent('desk-busy',{detail:{busy:true}})));
 const isClass=name=>state=>state.className.split(/\s+/).includes(name);

 /* ---- o × da segunda linha: o foco volta para o × do MESMO item ---- */
 await page.locator('.queue-item .queue-remove').nth(1).focus();
 await rerender();
 const remove=await pollUntil(focusState,state=>isClass('queue-remove')(state)&&state.item==='fila-2',{
  timeout:5000,interval:50,what:'o foco no × da segunda linha depois do desk-busy',
 });
 assert.equal(remove.text,'segunda','o foco volta ao × do mesmo item, não ao de outra linha');
 assert.equal(remove.body,false,'o foco não cai no body');

 /* ---- o "Limpar" do cabeçalho: a chave é estável entre renders ---- */
 await page.locator('.queue-clear').focus();
 await rerender();
 const clear=await pollUntil(focusState,isClass('queue-clear'),{
  timeout:5000,interval:50,what:'o foco no Limpar depois do desk-busy',
 });
 assert.equal(clear.body,false,'o foco não cai no body');
 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
 console.log('QUEUE FOCUS UI PASSED: × e Limpar mantêm o foco no re-render da faixa.');
});
