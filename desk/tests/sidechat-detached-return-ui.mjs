import assert from 'node:assert/strict';
import {withArtifacts} from './helpers.mjs';
import {bootCourse,openSidechat,detachSidechat} from './capture-ciclo2-chat-solto-kit.mjs';
import {pollUntil} from './waits.mjs';

/* Chat solto igual ao preso (sem anel só da filha), com um botão a mais
   "Trazer de volta à Mesa" ao lado do ×, e a faixa "Chat em outra janela" que
   traz o chat de volta ao clique. Electron real, dados sintéticos. */

const deskHasChat=page=>page.evaluate(()=>{const el=document.querySelector('#sidechat');return !!el&&!el.hidden&&el.getBoundingClientRect().width>0;});
const waitBackOnDesk=page=>page.waitForFunction(()=>{const el=document.querySelector('#sidechat');return !!el&&!el.hidden&&el.getBoundingClientRect().width>0;},undefined,{timeout:15000});
const otherWindows=(app,page)=>app.windows().filter(w=>w!==page&&!w.isClosed());

await withArtifacts('lateral-solto-volta',async ctx=>{
 const {runtime,app,page}=await bootCourse('sidechat-detached-return');
 ctx.runtime=runtime;ctx.app=app;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openSidechat(page);

 /* Preso: o botão existe no cabeçalho, mas escondido. */
 assert.equal(await page.locator('#sidechat-return').count(),1,'o botão existe no cabeçalho preso');
 assert.equal(await page.locator('#sidechat-return').isHidden(),true,'o botão não aparece na Mesa');

 /* Solto: botão visível ao lado do ×, com ícone, dica e nome acessível. */
 let child=await detachSidechat(page,app);
 const back=child.locator('#sidechat-return');
 assert.equal(await back.isVisible(),true,'o botão aparece na janela solta');
 const facts=await child.evaluate(()=>{
  const btn=document.querySelector('#sidechat-return'),close=document.querySelector('#sidechat-close');
  const actions=[...document.querySelectorAll('.sidechat-head-actions>button')].map(b=>b.id);
  return {title:btn.title,aria:btn.getAttribute('aria-label'),svg:btn.querySelectorAll('svg.icon').length,cls:btn.className,
   next:btn.nextElementSibling?.id,actions,sameBox:btn.getBoundingClientRect().height===close.getBoundingClientRect().height};
 });
 assert.equal(facts.title,'Trazer de volta à Mesa','dica do botão');
 assert.equal(facts.aria,'Trazer de volta à Mesa','nome acessível do botão');
 assert.equal(facts.svg,1,'o botão tem o ícone');
 assert.equal(facts.cls,'icon-btn','mesmo estilo de botão de ícone do cabeçalho');
 assert.equal(facts.next,'sidechat-close','o botão fica ao lado do ×');
 assert.deepEqual(facts.actions,['sidechat-new','sidechat-more','sidechat-return','sidechat-close'],'cabeçalho igual ao preso, com um botão a mais');
 assert.equal(facts.sameBox,true,'mesma altura do ×');
 await child.locator('#sidechat-more').click();
 assert.match((await child.locator('#sidechat-detach').textContent())||'',/Trazer de volta/,'o ⋯ → Trazer de volta continua lá');
 await child.keyboard.press('Escape');

 /* O botão devolve o chat à Mesa e a filha fecha; o botão some de novo. */
 await child.locator('#sidechat-prompt').fill('rascunho que volta');
 await back.click();
 await waitBackOnDesk(page);
 await pollUntil(()=>otherWindows(app,page).length,n=>n===0,{timeout:10000,interval:100,what:'a filha fechar ao trazer de volta'});
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'rascunho que volta','rascunho intacto na volta');
 assert.equal(await page.locator('#sidechat-return').isHidden(),true,'o botão some na Mesa');
 assert.equal(await page.locator('#support-restore').isHidden(),true,'a faixa some com o chat de volta');

 /* A faixa traz de volta (antes só focava a filha) e a dica diz isso. */
 await detachSidechat(page,app);
 assert.equal(await page.locator('#support-restore').isVisible(),true,'faixa visível com o chat solto');
 const strip=await page.locator('#support-restore').evaluate(el=>({title:el.title,aria:el.getAttribute('aria-label'),label:el.querySelector('.pdf-restore-label').textContent}));
 assert.equal(strip.label,'Chat em outra janela');
 assert.equal(strip.title,'Trazer o chat de volta à Mesa','a dica da faixa diz que traz de volta');
 assert.match(strip.aria,/Chat em outra janela.*Trazer o chat de volta à Mesa/,'nome acessível da faixa inclui a ação');
 await page.locator('#support-restore').click();
 await waitBackOnDesk(page);
 await pollUntil(()=>otherWindows(app,page).length,n=>n===0,{timeout:10000,interval:100,what:'a filha fechar ao clicar na faixa'});
 assert.equal(await deskHasChat(page),true,'o chat voltou para a coluna');
 assert.equal(await page.locator('#support-restore').isHidden(),true,'faixa escondida após voltar');

 /* O × na janela solta continua fechando o chat (como no preso). */
 child=await detachSidechat(page,app);
 await child.locator('#sidechat-close').click();
 await pollUntil(()=>otherWindows(app,page).length,n=>n===0,{timeout:10000,interval:100,what:'a filha fechar com o ×'});
 await page.waitForFunction(()=>document.querySelector('#sidechat')?.hidden===true,undefined,{timeout:10000});
 assert.equal(await deskHasChat(page),false,'o × fecha o chat em vez de trazer de volta');

 /* Fechar a janela pelo sistema continua devolvendo o chat. */
 await openSidechat(page);
 child=await detachSidechat(page,app);
 await child.close();
 await waitBackOnDesk(page);
 assert.equal(await deskHasChat(page),true,'fechar a janela devolve o chat à Mesa');

 /* Sem anel só da filha: o campo solto não desenha outline; o foco pinta a
    linha de cima do compositor, como na Mesa. */
 const ringOf=win=>win.evaluate(()=>{
  const prompt=document.querySelector('#sidechat-prompt'),composer=document.querySelector('#sidechat-composer');
  const probe=document.createElement('i');probe.style.color='var(--ring)';document.body.append(probe);
  const ring=getComputedStyle(probe).color;probe.remove();
  const style=getComputedStyle(prompt);
  return {focused:document.activeElement===prompt,outlineStyle:style.outlineStyle,outlineWidth:Number.parseFloat(style.outlineWidth)||0,top:getComputedStyle(composer).borderTopColor,ring};
 });
 await page.locator('#sidechat-prompt').focus();
 const docked=await ringOf(page);
 assert.equal(docked.focused,true);
 assert.equal(docked.top,docked.ring,'preso: o foco pinta a linha de cima do compositor');
 child=await detachSidechat(page,app);
 await child.locator('#sidechat-prompt').focus();
 const floating=await ringOf(child);
 assert.equal(floating.focused,true,'o campo está em foco na janela solta');
 assert.ok(floating.outlineStyle==='none'||floating.outlineWidth===0,`sem anel de 2px na janela solta (outline ${floating.outlineStyle} ${floating.outlineWidth}px)`);
 assert.equal(floating.outlineStyle,docked.outlineStyle,'mesmo outline do preso');
 assert.equal(floating.top,floating.ring,'solto: o foco continua visível na linha de cima do compositor');

 assert.deepEqual(errors,[]);
 console.log('PASS: chat solto igual ao preso, botão e faixa trazem de volta');
});
