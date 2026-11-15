/* #62 no caminho Claude: a prévia sem erro publica na chamada; a revisão pelo
   activityId troca o MESMO quadro no lugar. O quadro reabre pelo resultado
   nativo da sessão (o fake sintético não guarda tool_result); a recuperação
   por resultado está no teste de `history-activity-slots` e o reabrir real no
   teste OpenCode. SDK oficial em memória, transporte MCP real da Mesa e
   provider sintético: nada de inferência.
   Roda da pasta desk: `node --test tests/mesa-claude-preview-ui.mjs`. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,seedCourse,writeDeskJson,writeConfigJson,launchDesk,statusOnline,DESK} from './helpers.mjs';
const conversations=createRequire(import.meta.url)('../src/agents/conversations.cjs');

const FIXTURE=path.join(DESK,'tests/fixtures/claude-sdk-activity-fake.mjs');

async function boot(ctx,tag,flow){
 const runtime=ctx.runtime=fs.mkdtempSync(path.join(os.tmpdir(),`mesa-claude-preview-${tag}-`));
 const folder=seedCourse(runtime,'Synthetic');
 const file=conversations.createClaudeConversation({runtime,courseId:'Synthetic'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Synthetic',name:'Física sintética',path:folder}]});
 writeDeskJson(runtime,{courseId:'Synthetic',session:file,courseStates:{Synthetic:{session:file,sessions:[{path:file}]}}});
 const previewOut=path.join(runtime,'claude-preview.json'),revisionOut=path.join(runtime,'claude-revision.json');
 ctx.app=await launchDesk({runtime,opencode:false,env:{
  LEARNING_DESK_CLAUDE_SDK_FACTORY:FIXTURE,
  FAKE_CLAUDE_PREVIEW_FLOW:flow,
  FAKE_CLAUDE_PREVIEW_OUT:previewOut,
  ...(flow==='revision'?{FAKE_CLAUDE_REVISION_OUT:revisionOut}:{}),
 }});
 const page=await ctx.app.firstWindow(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page,{timeout:30000});
 await page.locator('#prompt').fill('Mostre uma prévia.');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('Depois da prévia Claude.'),undefined,{timeout:60000});
 return {page,errors,previewOut,revisionOut};
}

const order=page=>page.evaluate(()=>{
 const nodes=[...document.querySelector('#messages').children];
 const textAt=needle=>nodes.findIndex(el=>!el.classList.contains('activity-slot')&&el.textContent.includes(needle));
 return {textA:textAt('Antes da prévia Claude.'),board:nodes.findIndex(el=>el.classList.contains('activity-slot')&&String(el.dataset.activityCall||'').startsWith('previa:')),textB:textAt('Depois da prévia Claude.')};
});

const frameText=async(page,version='1')=>{
 for(const frame of page.frames().filter(candidate=>candidate.url().startsWith('mesa-activity://')&&candidate.url().includes(`--v${version}/`))){
  try{return await frame.locator('#s').textContent();}catch{/* frame trocado: tenta outro */}
 }
 return null;
};

await withArtifacts('mesa-claude-preview-clean',async ctx=>{
 const {page,errors,previewOut}=await boot(ctx,'clean','clean');
 const slot=page.locator('.activity-slot[data-activity-call^="previa:"]');
 await slot.locator('.activity-card[data-state="ready"]').waitFor({timeout:15000});
 assert.equal(await slot.count(),1,'a prévia limpa virou um quadro só, sem criar_atividade');
 assert.equal(await page.locator('.activity-slot[data-activity-call="toolu_activity_local"]').count(),0,'a prévia não abre slot de publicação');
 const items=(await page.evaluate(()=>window.desk.activityList())).items;
 assert.equal(items.length,1);
 assert.match(items[0].toolCallId,/^previa:prv-/);
 assert.equal(items[0].version,1);
 const blocks=await order(page);
 assert.ok(blocks.textA>=0&&blocks.board>=0&&blocks.textB>=0,`a fala envolve o quadro (${JSON.stringify(blocks)})`);
 assert.ok(blocks.textA<blocks.board&&blocks.board<blocks.textB,`o quadro nasce no ponto da chamada (${JSON.stringify(blocks)})`);
 const preview=JSON.parse(fs.readFileSync(previewOut,'utf8'));
 assert.match(preview.content[1].text,/Quadro publicado: act-[a-z0-9-]+ v1/);
 assert.match(preview.content[1].text,/o aluno JÁ o vê na conversa, no ponto desta chamada/);
 assert.equal(await frameText(page),'prévia limpa Claude');
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok mesa-claude-preview-ui (clean)');

await withArtifacts('mesa-claude-preview-revision',async ctx=>{
 const {page,errors,previewOut,revisionOut}=await boot(ctx,'revision','revision');
 const slot=page.locator('.activity-slot[data-activity-call^="previa:"]');
 await slot.locator('.activity-card[data-state="ready"]').waitFor({timeout:15000});
 await page.waitForFunction(()=>document.querySelector('.activity-slot[data-activity-call^="previa:"]')?.dataset.activityVersion==='2',undefined,{timeout:30000});
 assert.equal(await slot.count(),1,'a revisão troca o MESMO quadro, sem segundo slot');
 assert.equal(await page.locator('.activity-slot[data-activity-call="toolu_activity_local"]').count(),0,'a chamada de revisão não abre slot próprio');
 const items=(await page.evaluate(()=>window.desk.activityList())).items;
 assert.equal(items.length,2,'a versão anterior fica no store');
 assert.equal(items[0].id,items[1].id,'as duas versões são o mesmo quadro');
 assert.equal(Math.max(...items.map(item=>item.version)),2);
 const preview=JSON.parse(fs.readFileSync(previewOut,'utf8'));
 assert.match(preview.content[1].text,/Quadro publicado: act-[a-z0-9-]+ v1/);
 const revision=JSON.parse(fs.readFileSync(revisionOut,'utf8'));
 assert.match(revision.content[0].text,/revisada na conversa \(act-[a-z0-9-]+ v2\)/);
 assert.match(revision.content[0].text,/MESMO quadro, trocado no lugar/);
 assert.equal(await frameText(page,'2'),'corrigido Claude');
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok mesa-claude-preview-ui (revision)');

await withArtifacts('mesa-claude-preview-error',async ctx=>{
 const {page,errors}=await boot(ctx,'error','error');
 const slot=page.locator('.activity-slot[data-activity-call^="previa:"]');
 await page.locator('.activity-note').filter({hasText:/não foi publicada|not published/i}).waitFor({timeout:30000});
 assert.equal(await slot.count(),0,'a prévia com erro não aparece para o aluno');
 assert.equal((await page.evaluate(()=>window.desk.activityList())).items.length,0,'e não publica no store');
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok mesa-claude-preview-ui (error)');
