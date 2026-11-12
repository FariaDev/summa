import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline,freezeMotion,setTheme} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

/* Chat lateral solto em janela própria (#157, fatia 1): o mesmo nó muda de
   documento — conversa, rascunho e rolagem vivos, uma instância só — e fechar
   a filha devolve tudo à Mesa. Repete soltar/fechar 3×. */

async function openSidechat(page){
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>{
  const el=document.querySelector('#sidechat');
  const prompt=document.querySelector('#sidechat-prompt');
  return !!el&&!el.hidden&&!!prompt&&!prompt.disabled&&!document.querySelector('#sidechat-messages .sidechat-msg.system');
 },undefined,{timeout:20000});
}
function sidechatFacts(page){
 return page.evaluate(()=>{
  const nodes=document.querySelectorAll('#sidechat');
  const prompt=document.querySelector('#sidechat-prompt');
  const messages=document.querySelector('#sidechat-messages');
  return {
   count:nodes.length,
   promptCount:document.querySelectorAll('#sidechat-prompt').length,
   draft:prompt?prompt.value:'',
   text:messages?messages.textContent:'',
   htmlTheme:document.documentElement.dataset.theme||'auto',
   htmlAccent:document.documentElement.dataset.accent||'blue',
   hasSidechat:!!nodes[0],
   sidechatVisible:nodes[0]?nodes[0].getBoundingClientRect().width>0&&!nodes[0].hidden:false,
  };
 });
}

await withArtifacts('lateral-solto',async ctx=>{
 const runtime=ctx.runtime=newRuntime('lateral-solto'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf(['Lista 2 - Limites','5. lim x->2 (x^2 - 4)/(x - 2)','6. lim x->0 sen(3x)/x'],4));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 await openSidechat(page);

 /* Conversa real antes de soltar: a resposta do motor fica registrada. */
 await page.locator('#sidechat-prompt').fill('teorema do chat lateral');
 await page.locator('#sidechat-prompt').press('Enter');
 await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-msg.assistant .sidechat-body')].some(el=>el.textContent.includes('Pitágoras')),undefined,{timeout:30000});
 const before=await sidechatFacts(page);
 assert.equal(before.count,1,'uma instância do chat lateral antes de soltar');
 assert.equal(before.promptCount,1,'um campo de mensagem antes');

 /* Soltar: abre a filha e move o nó — mesma conversa, mesma instância. */
 const childPromise=ctx.app.waitForEvent('window',{timeout:10000});
 await page.locator('#sidechat-more').click();
 await page.locator('#sidechat-detach').click();
 const child=await childPromise;
 await child.waitForSelector('#sidechat',{timeout:10000});
 await child.locator('#sidechat').waitFor({state:'visible'});
 const inChild=await sidechatFacts(child);
 assert.equal(inChild.count,1,'uma instância dentro da filha');
 assert.equal(inChild.promptCount,1,'um campo só, na filha');
 assert.ok(inChild.text.includes('Pitágoras'),'a conversa foi junto para a filha');
 const inMain=await sidechatFacts(page);
 assert.equal(inMain.count,0,'a coluna sumiu da Mesa enquanto solto');

 /* A faixa e o botão do tutor focam a filha, sem abrir outra. */
 assert.equal(await page.locator('#support-restore').isVisible(),true,'faixa "Chat em outra janela" aparece');
 assert.match((await page.locator('#support-restore .pdf-restore-label').textContent())||'',/Chat em outra janela/);
 await page.locator('#sidechat-toggle').click();
 await page.waitForTimeout(300);// espera fixa: o botão do tutor não pode abrir segunda janela — prova de ausência em 300 ms
 assert.equal(ctx.app.windows().filter(p=>p!==page).length,1,'o botão do tutor não abre segunda janela');
 await page.locator('#support-restore').click();
 await page.waitForTimeout(300);// espera fixa: a faixa "Chat em outra janela" não pode abrir segunda janela — prova de ausência em 300 ms
 assert.equal(ctx.app.windows().filter(p=>p!==page).length,1,'a faixa não abre segunda janela');

 /* Na filha: tema e acento acompanham a Mesa ao vivo, e o menu obedece ao documento novo. */
 await child.locator('#sidechat-more').click();
 assert.equal(await child.locator('#sidechat-detach').isVisible(),true,'Mais opções abre na filha');
 await child.keyboard.press('Escape');
 assert.equal(await child.locator('#sidechat-more-pop').isHidden(),true,'Esc fecha o menu na filha');
 const bgLight=await child.locator('#sidechat').evaluate(el=>getComputedStyle(el).backgroundColor);
 await setTheme(page,'dark');
 await pollUntil(()=>child.evaluate(()=>document.documentElement.dataset.theme||'auto'),v=>v==='dark',{timeout:10000,interval:100,what:'o tema escuro chegar à filha'});
 const themed=await sidechatFacts(child);
 assert.equal(themed.htmlTheme,'dark','o tema escuro entra na filha ao vivo');
 const bgDark=await child.locator('#sidechat').evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.notEqual(bgDark,bgLight,'o fundo acompanha o tema na filha');
 await setTheme(page,'light');
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.applyAccent('violet');});
 await pollUntil(()=>child.evaluate(()=>document.documentElement.dataset.accent||'blue'),v=>v==='violet',{timeout:10000,interval:100,what:'o acento violeta chegar à filha'});
 assert.equal((await sidechatFacts(child)).htmlAccent,'violet','o acento entra na filha ao vivo');
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.applyAccent('blue');});

 /* Leitura (#106): data-reading-* aparece na filha e acompanha ao vivo. */
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');const pref=await import('./src/display-preferences.mjs');pref.applyDisplayState(state.S,{readingSize:'larger',readingWidth:'wide'});});
 await pollUntil(()=>child.evaluate(()=>({readingSize:document.documentElement.dataset.readingSize||'normal',readingWidth:document.documentElement.dataset.readingWidth||'normal'})),f=>f.readingSize==='larger'&&f.readingWidth==='wide',{timeout:10000,interval:100,what:'a leitura maior/larga chegar à filha'});
 let readingFacts=await child.evaluate(()=>({readingSize:document.documentElement.dataset.readingSize||'normal',readingWidth:document.documentElement.dataset.readingWidth||'normal'}));
 assert.deepEqual(readingFacts,{readingSize:'larger',readingWidth:'wide'},'leitura aparece na filha');
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');const pref=await import('./src/display-preferences.mjs');pref.applyDisplayState(state.S,{readingSize:'small',readingWidth:'narrow'});});
 await pollUntil(()=>child.evaluate(()=>({readingSize:document.documentElement.dataset.readingSize||'normal',readingWidth:document.documentElement.dataset.readingWidth||'normal'})),f=>f.readingSize==='small'&&f.readingWidth==='narrow',{timeout:10000,interval:100,what:'a leitura pequena/estreita chegar à filha'});
 readingFacts=await child.evaluate(()=>({readingSize:document.documentElement.dataset.readingSize||'normal',readingWidth:document.documentElement.dataset.readingWidth||'normal'}));
 assert.deepEqual(readingFacts,{readingSize:'small',readingWidth:'narrow'},'leitura acompanha ao vivo na filha');
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');const pref=await import('./src/display-preferences.mjs');pref.applyDisplayState(state.S,{readingSize:'normal',readingWidth:'normal'});});
 await pollUntil(()=>child.evaluate(()=>({readingSize:document.documentElement.dataset.readingSize||'normal',readingWidth:document.documentElement.dataset.readingWidth||'normal'})),f=>f.readingSize==='normal'&&f.readingWidth==='normal',{timeout:10000,interval:100,what:'a leitura normal voltar à filha'});

 /* Rascunho escrito na filha sobrevive ao fechar (repetir 3×). */
 for(let round=1;round<=3;round++){
  const cur=ctx.app.windows().find(p=>p!==page);
  assert.ok(cur,`há filha na volta ${round}`);
  const draft=`rascunho solto ${round}`;
  await cur.locator('#sidechat-prompt').fill(draft);
  const draftBeforeClose=await sidechatFacts(cur);
  assert.equal(draftBeforeClose.draft,draft);
  await cur.close();
  await page.waitForFunction(()=>{const el=document.querySelector('#sidechat');return !!el&&!el.hidden&&el.getBoundingClientRect().width>0;},undefined,{timeout:10000});
  const back=await sidechatFacts(page);
  assert.equal(back.count,1,`volta uma instância só (volta ${round})`);
  assert.equal(back.promptCount,1,`um campo só de volta (volta ${round})`);
  assert.ok(back.text.includes('Pitágoras'),`conversa intacta de volta (${round})`);
  assert.equal(back.draft,draft,`rascunho intacto de volta (${round})`);
  if(round<3){
   const opened=ctx.app.waitForEvent('window',{timeout:10000});
   await page.locator('#sidechat-more').click();
   await page.locator('#sidechat-detach').click();
   const next=await opened;
   await next.waitForSelector('#sidechat',{timeout:10000});
   await next.locator('#sidechat').waitFor({state:'visible'});
  }
 }

 /* Trazer de volta pelo menu: o item vira "Trazer de volta" e devolve o nó. */
 const reopened=ctx.app.waitForEvent('window',{timeout:10000});
 await page.locator('#sidechat-more').click();
 await page.locator('#sidechat-detach').click();
 await reopened;
 const lastChild=ctx.app.windows().find(p=>p!==page);
 assert.ok(lastChild,'há filha para trazer de volta');
 await lastChild.locator('#sidechat-more').click();
 assert.match((await lastChild.locator('#sidechat-detach').textContent())||'',/Trazer de volta/);
 await lastChild.locator('#sidechat-detach').click();
 await page.waitForFunction(()=>{const el=document.querySelector('#sidechat');return !!el&&!el.hidden&&el.getBoundingClientRect().width>0;},undefined,{timeout:10000});
 const again=await sidechatFacts(page);
 assert.equal(again.count,1,'uma instância após trazer de volta');
 assert.equal(again.promptCount,1,'um campo só após trazer de volta');
 assert.ok(again.text.includes('Pitágoras'));
 const focusedId=await page.evaluate(()=>document.activeElement?.id||'');
 assert.equal(focusedId,'sidechat-prompt','trazer de volta devolve o foco ao campo');

 /* Recarga com chat solto não deixa filha órfã: fecha a velha e a Mesa
    reabre solta (fatia 2, solto lembrado) numa filha nova só. */
 {
  const opened=ctx.app.waitForEvent('window',{timeout:10000});
  await page.locator('#sidechat-more').click();
  await page.locator('#sidechat-detach').click();
  await opened;
  const cur=ctx.app.windows().find(p=>p!==page);
  assert.ok(cur,'há filha para recarga');
  const bw=await ctx.app.browserWindow(page);
  await bw.evaluate(bw=>bw.webContents.reload());
  await pollUntil(()=>cur.isClosed(),v=>v===true,{timeout:10000,interval:100,what:'a filha velha fechar depois da recarga'});
  await pollUntil(()=>ctx.app.windows().filter(p=>p!==page&&!p.isClosed()).length,n=>n===1,{timeout:10000,interval:100,what:'a recarga reabrir solta numa filha nova só'});
  const curAfter=ctx.app.windows().find(p=>p!==page&&!p.isClosed());
  assert.ok(curAfter,'recarga reabre solta numa filha nova, sem órfã dupla');
  await curAfter.waitForSelector('#sidechat',{timeout:10000});
  assert.equal(ctx.app.windows().filter(p=>p!==page).length,1,'uma filha só após recarga');
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: chat lateral solto em janela própria');
});
