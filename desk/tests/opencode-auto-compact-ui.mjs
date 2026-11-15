/* Aviso da compactação automática do OpenCode (#77) na janela real, contra o
   `fake-opencode.mjs` no lugar do `opencode serve` (LEARNING_DESK_OPENCODE):
   nenhum modelo é chamado.

   Prova, de ponta a ponta: depois do turno em que o fake compacta sozinho
   (`FAKE_OPENCODE_AUTO_COMPACT`), o aviso pt-BR aparece UMA vez na conversa e
   o medidor se atualiza como na compactação manual; "Resumir agora" não
   duplica o aviso da automática. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,sendEnabled,statusOnline,openTutorMore,fakeEngineLauncher} from './helpers.mjs';
import {pollUntil} from './waits.mjs';
import {trackTempDir} from './temp-dir.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};

const require=createRequire(import.meta.url);
const conversations=require('../src/agents/conversations.cjs');
const FAKE_OPENCODE_BIN=fakeEngineLauncher(path.resolve(import.meta.dirname,'fake-opencode.mjs'));
const NOTICE=ptBR['opencode.compacted'];
const readLog=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];

await withArtifacts('opencode-auto-compact',async ctx=>{
 const runtime=ctx.runtime=newRuntime('opencode-auto-compact'),folder=seedCourse(runtime,'Calculo');
 const serveLog=path.join(trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-oc-auto-'))),'serve.jsonl');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculo',name:'Cálculo',path:folder}]});
 const first=conversations.createClaudeConversation({runtime,courseId:'Calculo',engine:'opencode'});
 writeDeskJson(runtime,{courseId:'Calculo',session:first,courseStates:{Calculo:{session:first,sessions:[{path:first}]}}});
 fs.chmodSync(FAKE_OPENCODE_BIN,0o755);
 /* O fake compacta sozinho depois do SEGUNDO turno: o primeiro deixa o medidor
    com número, e o segundo prova que a compactação o apaga. */
 const app=ctx.app=await launchDesk({runtime,opencode:false,env:{LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,FAKE_OPENCODE_LOG:serveLog,FAKE_OPENCODE_AUTO_COMPACT:'ended',FAKE_OPENCODE_AUTO_COMPACT_AFTER:'2'}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page,{timeout:60000});
 /* Observa o #toast: cada item novo conta, mesmo que o aviso saia da tela. */
 await page.evaluate(()=>{
  window.__toastItems=[];
  new MutationObserver(records=>{
   for(const record of records)for(const node of record.addedNodes){
    if(node.nodeType===1&&node.classList?.contains('toast-item'))window.__toastItems.push(node.textContent||'');
   }
  }).observe(document.querySelector('#toast'),{childList:true});
 });
 const turn=async text=>{
  const before=await page.locator('.message.assistant').count();
  await page.locator('#prompt').fill(text);
  await page.locator('#send').click();
  await page.waitForFunction(n=>document.querySelectorAll('.message.assistant').length>n,before,{timeout:30000});
  await sendEnabled(page,{timeout:30000});
 };
 const countNotice=()=>page.evaluate(text=>window.__toastItems.filter(item=>item.includes(text)).length,NOTICE);

 /* 1. Primeiro turno: o medidor tem número. */
 await turn('primeira pergunta');
 await pollUntil(()=>page.locator('#ctx-meter').evaluate(el=>!el.hidden&&/\d/.test(el.textContent+el.title)),ok=>ok,{what:'o medidor com número',timeout:15000});

 /* 2. Segundo turno: o servidor compacta sozinho e o aviso aparece em pt-BR. */
 await turn('segunda pergunta');
 await pollUntil(()=>page.evaluate(text=>window.__toastItems.some(item=>item.includes(text)),NOTICE),ok=>ok,{what:'o aviso da compactação automática',timeout:15000});
 assert.equal(await countNotice(),1,'o aviso da compactação automática aparece uma vez');

 /* 3. O medidor se atualiza como na manual: a amostra pós-compactação some. */
 await pollUntil(()=>page.locator('#ctx-meter').evaluate(el=>el.hidden),ok=>ok,{what:'o medidor apagado depois da compactação automática',timeout:15000});

 /* 4. "Resumir agora" não duplica o aviso da automática. */
 await openTutorMore(page);
 await page.locator('#more-context').click();
 await page.locator('#context-summarize').evaluate(el=>el.scrollIntoView({block:'center'}));
 await page.locator('#context-summarize').click();
 await pollUntil(()=>readLog(serveLog).some(entry=>entry.method==='POST'&&/\/compact$/.test(String(entry.url))),ok=>ok,{what:'o pedido de compactação manual',timeout:15000});
 await sendEnabled(page,{timeout:30000});
 assert.equal(await countNotice(),1,'a compactação manual não repete o aviso da automática');
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok opencode-auto-compact-ui');
