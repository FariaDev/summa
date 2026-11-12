/* H4: o tutor pré-visualiza a atividade e termina a resposta sem publicar
   (às vezes dizendo que publicou). O aluno não pode ficar sem nada: no fim do
   turno normal, a última prévia vira quadro na conversa.
   Reproduz o caso real medido no Mac: só `mesa_previsualizar_atividade`.
   Roda da pasta desk: `node --test tests/preview-fallback-ui.mjs`. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchDesk,withArtifacts,enterFree} from './helpers.mjs';
import {tempDir} from './temp-dir.mjs';

const PREVIEW={
 title:'Reta secante (prévia)',
 objective:'Prever o sinal da inclinação',
 alternativeMarkdown:'Atividade preparada na prévia: escolha o sinal de m.',
 html:'<p id="m">m = 0,31</p>',
 css:'',
 js:'mesa.ready();',
 kind:'atividade',
};

await withArtifacts('preview-fallback-ui',async ctx=>{
 ctx.runtime=tempDir('mesa-preview-fallback');
 fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{
  FAKE_OPENCODE_MCP_CALLS:JSON.stringify([{name:'previsualizar_atividade',id:'call_prev_1',input:PREVIEW}]),
  FAKE_OPENCODE_MCP_AFTER:'Pronto, a atividade foi publicada.',
 }});
 const page=await ctx.app.firstWindow(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 const send=async text=>{
  await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:30000});
  await page.locator('#prompt').fill(text);
  await page.locator('#send').click();
 };
 await send('Crie uma atividade.');
 await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('a atividade foi publicada'),undefined,{timeout:60000});
 assert.match(await page.locator('#messages').textContent(),/Prévia da atividade/,'a prévia rodou antes da publicação de fim de turno');
 const slot=page.locator('.activity-slot[data-activity-call^="previa:"]');
 await slot.locator('.activity-card[data-state="ready"]').waitFor({timeout:30000});
 const item=(await page.evaluate(()=>window.desk.activityList())).items.find(entry=>String(entry.toolCallId).startsWith('previa:'));
 assert.ok(item,'a prévia não publicada virou atividade no fim do turno');
 assert.equal(item.title,PREVIEW.title,'a atividade publicada é a prévia que o tutor montou');
 const frame=page.frames().find(candidate=>candidate.url().startsWith('mesa-activity://act-'));
 assert.ok(frame,'o quadro da prévia montou o artefato');
 await frame.waitForSelector('#m',{timeout:15000});
 assert.match(await frame.locator('#m').textContent(),/m = 0,31/,'o aluno vê o conteúdo que o tutor preparou');
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok preview-fallback-ui');
