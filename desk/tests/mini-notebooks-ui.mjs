// node tests/mini-notebooks-ui.mjs — o cartão de caderno do tutor, na janela.
// Cobre: persistência por conversa (trocar e voltar), o reload do app, a
// miniatura guardada reduzida a 240 px, o chip na bolha enviada (ao vivo e
// depois do reload) e o descarte em silêncio quando o arquivo do caderno some.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {gzipSync} from 'node:zlib';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,seedNativeSession,tinyPdf,statusOnline,resizeWindow,pageWindow,freezeMotion,syntheticFigurePng} from './helpers.mjs';
import {closeApp} from './proc-tree.mjs';
import {pollUntil} from './waits.mjs';

const XML=`<?xml version="1.0" standalone="no"?><xournal version="4"><page width="589" height="845"><background type="solid" color="#ffffffff" style="lined"/><layer><text fn="" size="12" color="#0013ff" font="Sans" x="100" y="100">Primeira</text></layer></page></xournal>`;
const SHOT='/tmp/claude-1000/summa-cartoes.png';

/** Largura do PNG guardado, lida do IHDR (bytes 16–19). */
const pngWidth=dataUrl=>Buffer.from(String(dataUrl).split(',')[1]||'','base64').readUInt32BE(16);

await withArtifacts('mini-notebooks',async ctx=>{
 const runtime=ctx.runtime=newRuntime('mini-notebooks'),course=seedCourse(runtime,'Test');
 const pdf=path.join(course,'Limites.pdf');
 fs.writeFileSync(pdf,tinyPdf('Exercise',2));
 const notebook=path.join(course,'Limites — aula 3.xopp');
 fs.writeFileSync(notebook,gzipSync(XML));
 const current=seedNativeSession(runtime,[
  {role:'user',content:[{type:'text',text:'conversa atual'}]},
  {role:'assistant',content:[{type:'text',text:'seguindo'}]},
 ],{courseId:'Test',preview:'conversa atual'});
 const older=seedNativeSession(runtime,[{role:'user',content:[{type:'text',text:'conversa antiga'}]}],{courseId:'Test',preview:'conversa antiga'});
 const sessions=[{path:current,started:Date.now(),preview:'conversa atual'},{path:older,started:Date.now()-60000,preview:'conversa antiga'}];
 writeDeskJson(runtime,{session:current,courseId:'Test',courseStates:{Test:{session:current,pdfs:[{path:pdf,page:1,zoom:1,scrollX:0,scrollY:0}],sessions}}});
 writeConfigJson(runtime,{vaultPath:runtime,runtimePath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'Vamos ver o limite pela definição.'}});
 let page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('#messages .message',{timeout:20000});
 await resizeWindow(ctx.app,page,1000,700);
 const win=await pageWindow(ctx.app,page);
 await freezeMotion(page);
 const bridge=()=>JSON.parse(fs.readFileSync(path.join(runtime,'ambitus-bridge.json'),'utf8'));
 const pendingStore=()=>{try{return JSON.parse(fs.readFileSync(path.join(runtime,'pending.json'),'utf8'));}catch{return {};}};
 const sendPage=async body=>{
  const file=bridge();
  const response=await fetch(`http://127.0.0.1:${file.port}/mandar-pagina`,{method:'POST',headers:{'content-type':'application/json','x-summa-token':file.token},body:JSON.stringify(body)});
  return response.status;
 };
 const card=()=>page.locator('#attachments .notebook-card');
 const openSessions=async()=>{
  await page.locator('#session-title').click();
  await page.waitForSelector('#conv-list .conv-row',{timeout:10000});
 };
 await pollUntil(()=>{try{return bridge().port;}catch{return 0;}},v=>!!v,{timeout:15000,interval:100,what:'a ponte do Ambitus subir'});

 /* ---- 1. O cartão entra no mini e a miniatura vai reduzida ao disco ---- */
 await page.keyboard.press('Control+Shift+M');
 await page.waitForFunction(()=>document.body.classList.contains('mini-mode'),undefined,{timeout:10000});
 assert.equal(await sendPage({caminho:notebook,pagina:2,nome:'Limites — aula 3'}),200);
 await card().waitFor({timeout:10000});
 assert.equal(await card().locator('.notebook-name').innerText(),'Limites — aula 3');
 assert.match(await card().locator('.notebook-page').innerText(),/^pág\. 2$/);
 await win.evaluate((bw,data)=>bw.webContents.send('ambitus-page-thumb',data),{caminho:notebook,pagina:2,thumb:`data:image/png;base64,${syntheticFigurePng(640,360)}`});
 const stored=await pollUntil(()=>pendingStore()[current]?.notebooks?.[0]?.thumb||'',value=>!!value&&pngWidth(value)<=240,{timeout:15000,interval:100,what:'a miniatura reduzida no pending.json'});
 assert.equal(pngWidth(stored),240,'a miniatura persistida cabe em 240 px de largura');
 assert.deepEqual(pendingStore()[current].notebooks.map(item=>[item.nome,item.pagina]),[['Limites — aula 3',2]]);

 /* ---- 2. Trocar de conversa e voltar: o cartão volta ---- */
 await page.keyboard.press('Control+Shift+M');
 await page.waitForFunction(()=>!document.body.classList.contains('mini-mode'),undefined,{timeout:10000});
 await openSessions();
 await page.locator('#conv-list .conv-row:not(.current)').first().click();
 await page.waitForFunction(id=>document.querySelector('#session-title')?.dataset.session===id,older,{timeout:15000});
 assert.equal(await card().count(),0,'a conversa antiga não herda o cartão');
 await openSessions();
 await page.locator('#conv-list .conv-row:not(.current)').first().click();
 await page.waitForFunction(id=>document.querySelector('#session-title')?.dataset.session===id,current,{timeout:15000});
 await card().waitFor({timeout:10000});
 assert.equal(await card().locator('.notebook-name').innerText(),'Limites — aula 3','voltar traz o cartão da conversa');

 /* ---- 3. Reload do app: o cartão volta do pending.json e segue autorizado ---- */
 let old=ctx.app;
 await closeApp(old,{ledgerDir:runtime});
 ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'Vamos ver o limite pela definição.'}});
 page=await ctx.app.firstWindow();
 page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('#messages .message',{timeout:20000});
 await card().waitFor({timeout:15000});
 assert.equal(await card().locator('.notebook-name').innerText(),'Limites — aula 3','o reload restaura o cartão');

 /* ---- 4. Enviar: o chip na bolha e o caminho escondido ao motor ---- */
 await page.locator('#prompt').fill('e se o limite não existir?');
 await page.locator('#send').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('#messages .message.user')].some(el=>el.innerText.includes('e se o limite não existir?')),undefined,{timeout:20000});
 const bubble=page.locator('#messages .message.user').last();
 const chip=bubble.locator('.message-file.notebook-chip');
 await chip.waitFor({timeout:10000});
 assert.equal(await chip.locator('.notebook-name').innerText(),'Limites — aula 3');
 assert.match(await chip.locator('.notebook-page').innerText(),/^pág\. 2$/);
 assert.doesNotMatch(await bubble.innerText(),/Cadernos anexados|\.xopp/,'a bolha não mostra o bloco nem o caminho');
 await page.waitForFunction(()=>!document.querySelector('#attachments .notebook-card'),undefined,{timeout:20000});
 fs.mkdirSync(path.dirname(SHOT),{recursive:true});
 await page.screenshot({path:SHOT});
 const conversations=createRequire(import.meta.url)('../src/agents/conversations.cjs');
 const sent=await pollUntil(()=>{try{return (conversations.readClaudeConversation(current,{runtime})?.messages||[]).filter(m=>m.role==='user').map(m=>(Array.isArray(m.content)?m.content:[]).map(c=>c.text||'').join(' ')).find(text=>/e se o limite não existir\?/.test(text))||'';}catch{return '';}},text=>!!text,{timeout:20000,interval:200,what:'o envio chegar ao registro da conversa'});
 assert.match(sent,/\[Cadernos anexados à mensagem\][\s\S]*Limites — aula 3\.xopp/,'o motor recebeu o caminho do caderno');

 /* ---- 5. O chip sobrevive ao reload da conversa ---- */
 old=ctx.app;
 await closeApp(old,{ledgerDir:runtime});
 ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'Vamos ver o limite pela definição.'}});
 page=await ctx.app.firstWindow();
 page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('#messages .message.user',{timeout:20000});
 await page.locator('#messages .message.user .message-file.notebook-chip').last().waitFor({timeout:15000});
 assert.equal(await page.locator('#messages .message.user .message-file.notebook-chip').last().locator('.notebook-name').innerText(),'Limites — aula 3','o chip volta do histórico');
 assert.doesNotMatch(await page.locator('#messages .message.user').last().innerText(),/\.xopp/,'e o caminho continua fora da bolha');

 /* ---- 6. Arquivo que sumiu: o cartão é descartado em silêncio ---- */
 await page.keyboard.press('Control+Shift+M');
 await page.waitForFunction(()=>document.body.classList.contains('mini-mode'),undefined,{timeout:10000});
 assert.equal(await sendPage({caminho:notebook,pagina:3,nome:'Limites — aula 3'}),200);
 await card().waitFor({timeout:10000});
 await pollUntil(()=>pendingStore()[current]?.notebooks?.[0]?.pagina||0,value=>value===3,{timeout:15000,interval:100,what:'o cartão da página 3 no pending.json'});
 old=ctx.app;
 await closeApp(old,{ledgerDir:runtime});
 fs.rmSync(notebook,{force:true});
 ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_REPLY:'Vamos ver o limite pela definição.'}});
 page=await ctx.app.firstWindow();
 page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('#messages .message',{timeout:20000});
 await page.waitForTimeout(500);// espera fixa: "nada aparece em 0,5 s" — o caderno ausente não vira cartão nem aviso
 assert.equal(await card().count(),0,'sem o arquivo, o cartão não volta');
 assert.doesNotMatch(await page.locator('#toast').innerText(),/caderno|notebook/i,'e o descarte é silencioso');
 assert.deepEqual(errors,[]);
});
