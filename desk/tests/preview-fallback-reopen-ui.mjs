/* #62: a prévia sem erro publica na própria chamada (`previa:prv-…`), então
   o quadro nasce antes da fala seguinte. Ao reabrir, o histórico marca o ponto
   da chamada e o slot recuperado volta ali, uma vez só — não no fim do turno.
   Roda da pasta desk: `node --test tests/preview-fallback-reopen-ui.mjs`. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchDesk,withArtifacts,enterFree} from './helpers.mjs';
import {tempDir} from './temp-dir.mjs';

const PREVIEW={
 title:'Reta secante (prévia que reabre)',
 objective:'Prever o sinal da inclinação',
 alternativeMarkdown:'Atividade preparada na prévia: escolha o sinal de m.',
 html:'<p id="m">m = 0,31</p>',
 css:'',
 js:'mesa.ready();',
 kind:'atividade',
};

await withArtifacts('preview-fallback-reopen-ui',async ctx=>{
 ctx.runtime=tempDir('mesa-preview-fallback-reopen');
 fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{
  FAKE_OPENCODE_MCP_CALLS:JSON.stringify([{name:'previsualizar_atividade',id:'call_prev_1',input:PREVIEW}]),
  FAKE_OPENCODE_MCP_AFTER:'Pronto, a atividade foi publicada.',
 }});
 const page=await ctx.app.firstWindow(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});
 await page.locator('#prompt').fill('Crie uma atividade.');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('a atividade foi publicada'),undefined,{timeout:60000});
 const slot=page.locator('.activity-slot[data-activity-call^="previa:"]');
 await slot.locator('.activity-card[data-state="ready"]').waitFor({timeout:30000});
 assert.equal(await slot.count(),1,'a prévia publicada no fim do turno tem um quadro só');

 /* Um turno depois do quadro: a posição recuperada tem de ser a do turno em
    que ele nasceu, não o fim da conversa. */
 await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});
 await page.locator('#prompt').fill('Obrigado.');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('Resposta do OpenCode falso'),undefined,{timeout:60000});

 /* Reabrir como o aluno: o renderer recarrega, reconecta e remonta o histórico
    com o resultado da prévia, que marca o ponto da chamada (#62). */
 await page.reload();
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('a atividade foi publicada'),undefined,{timeout:60000});
 const reopened=page.locator('.activity-slot[data-activity-call^="previa:"]');
 await reopened.locator('[data-act="open"]').waitFor({timeout:30000});
 assert.equal(await reopened.count(),1,'ao reabrir, o quadro do store volta uma vez só');
 /* Histórico monta a casca parada, como qualquer quadro antigo; abrir monta. */
 await reopened.locator('[data-act="open"]').click();
 await reopened.locator('.activity-card[data-state="ready"]').waitFor({timeout:30000});
 const item=(await page.evaluate(()=>window.desk.activityList())).items.find(entry=>String(entry.toolCallId).startsWith('previa:'));
 assert.ok(item,'o quadro publicado continua no store da conversa');
 assert.equal(item.title,PREVIEW.title,'o quadro que volta é a prévia publicada');
 const order=await page.evaluate(()=>{
  const board=document.querySelector('.activity-slot[data-activity-call^="previa:"]');
  const speech=[...document.querySelectorAll('#messages .message.assistant')].find(node=>node.textContent.includes('a atividade foi publicada'));
  const nextUser=[...document.querySelectorAll('#messages .message.user')].at(-1);
  const follows=(left,right)=>!!left&&!!right&&(left.compareDocumentPosition(right)&Node.DOCUMENT_POSITION_FOLLOWING)!==0;
  return {call:follows(board,speech),turn:follows(board,nextUser)};
 });
 assert.deepEqual(order,{call:true,turn:true},'o quadro fica no ponto da chamada, antes da fala seguinte e antes do turno seguinte');
 const frame=page.frames().find(candidate=>candidate.url().startsWith('mesa-activity://act-'));
 assert.ok(frame,'o quadro recuperado monta o artefato');
 await frame.waitForSelector('#m',{timeout:15000});
 assert.match(await frame.locator('#m').textContent(),/m = 0,31/,'o aluno vê o conteúdo que o tutor preparou');
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok preview-fallback-reopen-ui');
