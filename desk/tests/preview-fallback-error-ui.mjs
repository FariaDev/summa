/* H4, lado ruim: a prévia não pode ser publicada (o quadro tem erro de
   console, que a publicação recusa). Mesmo assim o aluno não fica sem nada:
   um aviso visível diz que o tutor preparou a atividade e não a publicou.
   Roda da pasta desk: `node --test tests/preview-fallback-error-ui.mjs`. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchDesk,withArtifacts,enterFree} from './helpers.mjs';
import {tempDir} from './temp-dir.mjs';

const PREVIEW={
 title:'Atividade com erro',
 objective:'Prévia que a publicação recusa',
 alternativeMarkdown:'Prévia com erro de console de propósito.',
 html:'<p id="m">quebrada</p>',
 css:'',
 js:'mesa.ready();console.error("erro de propósito na prévia");',
 kind:'atividade',
};

await withArtifacts('preview-fallback-error-ui',async ctx=>{
 ctx.runtime=tempDir('mesa-preview-fallback-error');
 fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{
  FAKE_OPENCODE_MCP_CALLS:JSON.stringify([{name:'previsualizar_atividade',id:'call_prev_erro_1',input:PREVIEW}]),
  FAKE_OPENCODE_MCP_AFTER:'Pronto, a atividade está publicada.',
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
 await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('a atividade está publicada'),undefined,{timeout:60000});
 const note=page.locator('.activity-slot .activity-note').filter({hasText:/não foi publicada|not published|wasn't published/i});
 await note.waitFor({timeout:30000});
 assert.equal(await page.locator('.activity-slot[data-activity-call^="previa:"]').count(),0,'quadro quebrado não é publicado');
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok preview-fallback-error-ui');
