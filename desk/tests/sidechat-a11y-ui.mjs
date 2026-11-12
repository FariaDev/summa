import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline,freezeMotion,resizeWindow,toastWait} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

/* Acessibilidade e feedback do chat lateral/solto (achados 1, 7, 8, 9, 10, 11,
   12, 14 e 15 da rodada 1 do ciclo 2, #157): menu Mais opções com caminho de
   teclado, nome acessível das ações e dos cartões, ícones certos, escopo
   truncado com title, um aviso só no incerto, Enter com retorno e o sinal de
   "sempre por cima" no cabeçalho. A barra de menu da filha também é medida;
   Ctrl+C/V continuam valendo no campo de texto dela. */

async function openSidechat(page){
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>{
  const el=document.querySelector('#sidechat');
  const prompt=document.querySelector('#sidechat-prompt');
  return !!el&&!el.hidden&&!!prompt&&!prompt.disabled&&!document.querySelector('#sidechat-messages .sidechat-msg.system');
 },undefined,{timeout:20000});
}

const activeId=page=>page.evaluate(()=>document.activeElement?.id||'');

await withArtifacts('lateral-acessibilidade',async ctx=>{
 const runtime=ctx.runtime=newRuntime('lateral-acessibilidade'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf(['Lista 2 - Limites','5. lim x->2 (x^2 - 4)/(x - 2)'],4));
 fs.writeFileSync(path.join(course,'Formulario.pdf'),tinyPdf(['Formulario','lim sen x / x = 1'],2));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 await openSidechat(page);
 await page.locator('#sidechat-prompt').fill('teorema do chat lateral');
 await page.locator('#sidechat-prompt').press('Enter');
 await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-msg.assistant .sidechat-body')].some(el=>el.textContent.includes('Pitágoras')),undefined,{timeout:30000});

 /* ---- 7 e 12: nome acessível das ações e dos cartões ---- */
 const copies=await page.evaluate(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-copy')].map(button=>({
  label:(button.getAttribute('aria-label')||'').trim(),
  text:(button.textContent||'').trim(),
 })));
 assert.equal(copies.length,2,`esperava um Copiar por mensagem, achei ${copies.length}`);
 assert.equal(copies[0].text,'Copiar','o rótulo visível continua curto');
 assert.notEqual(copies[0].label,copies[1].label,`os dois Copiar precisam de nomes diferentes (${copies.map(item=>item.label).join(' | ')})`);
 assert.match(copies[0].label,/sua pergunta/i,`Copiar da fala do aluno com contexto (veio "${copies[0].label}")`);
 assert.match(copies[1].label,/resposta/i,`Copiar da resposta com contexto (veio "${copies[1].label}")`);

 const cardNames=await page.evaluate(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-msg')].map(card=>{
  const id=card.getAttribute('aria-labelledby')||'';
  return {role:card.getAttribute('role')||'',name:id?(card.ownerDocument.getElementById(id)?.textContent||'').trim():''};
 }));
 assert.ok(cardNames.length>=2,'há cartões de mensagem para medir');
 for(const card of cardNames)assert.equal(card.role,'group','cada cartão é um grupo nomeado');
 assert.ok(cardNames.some(card=>/^você$/i.test(card.name)),`o grupo da fala do aluno recebe o falante (${JSON.stringify(cardNames)})`);
 assert.ok(cardNames.some(card=>card.name&&!/^você$/i.test(card.name)),`o grupo da resposta recebe o falante (${JSON.stringify(cardNames)})`);

 /* ---- 11: escopo truncado ainda tem o texto completo no title ---- */
 /* Rodada 4: a 900×650 o escopo ganha a linha inteira e deixa de truncar; a
    coluna de 180px força o corte para conferir o title sob truncamento. */
 await resizeWindow(ctx.app,page,900,650);
 const scope=await page.evaluate(()=>{
  const composer=document.querySelector('#sidechat-composer');
  composer.style.width='180px';
  const el=document.querySelector('#sidechat-scope-text');
  const fact={title:el.title||'',text:(el.textContent||'').trim(),scroll:el.scrollWidth,client:el.clientWidth};
  composer.style.removeProperty('width');
  return fact;
 });
 assert.ok(scope.scroll>scope.client,`o escopo truncado em 180px mantém o texto no title (${scope.scroll}px de texto em ${scope.client}px)`);
 assert.match(scope.title,/Limites\.pdf/,'o title guarda o primeiro material');
 assert.match(scope.title,/Formulario\.pdf/,'o title guarda o segundo material');
 assert.equal(scope.title,scope.text,'o title é o texto completo da linha de escopo');
 await resizeWindow(ctx.app,page,1440,900);

 /* ---- 1, 9, 10 e 15: menu por teclado, ícones e sinal do por cima na filha ---- */
 const iconSvgs=await page.evaluate(async()=>{const {icon}=await import('./icons.mjs');return {pin:icon('pin'),undo:icon('undo'),external:icon('external')};});
 assert.ok(iconSvgs.pin&&iconSvgs.undo,'os ícones novos existem no conjunto da Mesa');
 const opened=ctx.app.waitForEvent('window',{timeout:10000});
 await page.locator('#sidechat-more').click();
 await page.locator('#sidechat-detach').click();
 const child=await opened;
 await child.waitForSelector('#sidechat',{timeout:10000});
 await child.locator('#sidechat').waitFor({state:'visible'});
 const childWin=await ctx.app.browserWindow(child);

 if(process.platform==='darwin'){
  /* No macOS a barra de menu é global do app (não pertence à janela filha):
     `isMenuBarVisible`/`autoHideMenuBar` dela não dizem nada. O equivalente é
     o menu do app continuar existindo — a filha não perde a barra, ela mora
     no topo da tela. */
  const appMenu=await ctx.app.evaluate(({Menu})=>Menu.getApplicationMenu()!==null);
  assert.equal(appMenu,true,'no macOS o menu global do app existe');
 }else{
  const menuBar=await childWin.evaluate(bw=>({visible:bw.isMenuBarVisible(),autoHide:typeof bw.isMenuBarAutoHide==='function'?bw.isMenuBarAutoHide():null}));
  assert.equal(menuBar.visible,false,'a barra de menu do Electron não aparece na janela filha');
  assert.equal(menuBar.autoHide,true,'a filha nasce com a barra em autoHide');
 }

 assert.equal(await child.locator('#sidechat-more-pop').getAttribute('role'),'menu','o pop é role=menu');
 await child.locator('#sidechat-more').focus();
 await child.keyboard.press('ArrowDown');
 assert.equal(await activeId(child),'sidechat-context','ArrowDown no gatilho abre e foca o primeiro item');
 assert.equal(await child.locator('#sidechat-more').getAttribute('aria-expanded'),'true','o gatilho anuncia o menu aberto');
 assert.equal(await activeId(child),'sidechat-context','o primeiro item é o contexto');
 await child.keyboard.press('ArrowDown');
 assert.equal(await activeId(child),'sidechat-detach','ArrowDown desce para Soltar/Trazer');
 await child.keyboard.press('ArrowDown');
 assert.equal(await activeId(child),'sidechat-always-on-top','ArrowDown desce para Sempre por cima');
 await child.keyboard.press('ArrowDown');
 assert.equal(await activeId(child),'sidechat-context','ArrowDown dá a volta no fim');
 await child.keyboard.press('ArrowUp');
 assert.equal(await activeId(child),'sidechat-always-on-top','ArrowUp dá a volta no começo');
 await child.keyboard.press('Home');
 assert.equal(await activeId(child),'sidechat-context','Home vai ao primeiro item');
 await child.keyboard.press('End');
 assert.equal(await activeId(child),'sidechat-always-on-top','End vai ao último item');

 const topIcon=await child.locator('#sidechat-always-on-top').evaluate(el=>({name:el.dataset.icon||'',svg:!!el.querySelector('svg')}));
 assert.equal(topIcon.name,'pin','Sempre por cima usa o ícone de alfinete, não o de maximizar');
 assert.ok(topIcon.svg,'o item Sempre por cima tem o ícone desenhado');

 await child.keyboard.press('Enter');
 await pollUntil(()=>child.evaluate(()=>document.querySelector('#sidechat-always-on-top')?.getAttribute('aria-checked')),value=>value==='true',{timeout:10000,interval:100,what:'Enter ligar o Sempre por cima'});
 const pinOn=await child.evaluate(()=>{const el=document.querySelector('#sidechat-pin');const box=el?.getBoundingClientRect();return {hidden:el?.hidden,width:box?.width||0,label:(el?.getAttribute('aria-label')||'').trim(),icon:!!el?.querySelector('svg')};});
 assert.equal(pinOn.hidden,false,'o cabeçalho da filha mostra o sinal de Sempre por cima');
 assert.ok(pinOn.width>0,'o sinal do por cima aparece de verdade');
 assert.ok(pinOn.icon,'o sinal usa o ícone de alfinete');
 assert.match(pinOn.label,/sempre por cima/i,`o sinal tem rótulo acessível (veio "${pinOn.label}")`);

 await child.keyboard.press('Space');
 await pollUntil(()=>child.evaluate(()=>document.querySelector('#sidechat-always-on-top')?.getAttribute('aria-checked')),value=>value==='false',{timeout:10000,interval:100,what:'Space desligar o Sempre por cima'});
 assert.equal(await child.evaluate(()=>document.querySelector('#sidechat-pin')?.hidden),true,'desligar esconde o sinal do cabeçalho');

 await child.keyboard.press('Escape');
 await child.locator('#sidechat-more-pop').waitFor({state:'hidden'});
 assert.equal(await activeId(child),'sidechat-more','Esc fecha o menu e devolve o foco ao gatilho');

 await child.keyboard.press('ArrowDown');
 assert.equal(await activeId(child),'sidechat-context','o menu reabre pelo teclado');
 await child.keyboard.press('Tab');
 await child.locator('#sidechat-more-pop').waitFor({state:'hidden'});
 assert.equal(await activeId(child),'sidechat-close','Tab fecha o menu e segue para o próximo controle');

 const detachIcon=await child.locator('#sidechat-detach').evaluate(el=>({name:el.dataset.icon||'',svg:!!el.querySelector('svg')}));
 assert.equal(detachIcon.name,'undo','Trazer de volta usa o ícone de retorno, não o de soltar');
 assert.ok(detachIcon.svg,'o item Trazer de volta tem o ícone desenhado');

 /* Ctrl+C/V continuam funcionando no campo da filha (sem depender da barra). */
 const prompt=child.locator('#sidechat-prompt');
 await prompt.fill('atalhos de teclado');
 await prompt.press('ControlOrMeta+a');
 await child.keyboard.press('ControlOrMeta+c');
 await prompt.fill('');
 await prompt.press('ControlOrMeta+v');
 await pollUntil(()=>prompt.inputValue(),value=>value==='atalhos de teclado',{timeout:5000,interval:50,what:'o Ctrl+V colar no campo da filha'});
 assert.equal(await prompt.inputValue(),'atalhos de teclado','copiar e colar seguem funcionando na filha');

 await child.locator('#sidechat-more').click();
 await child.locator('#sidechat-detach').click();
 await page.waitForFunction(()=>{const el=document.querySelector('#sidechat');return !!el&&!el.hidden&&el.getBoundingClientRect().width>0;},undefined,{timeout:10000});
 const detachBack=await page.locator('#sidechat-detach').evaluate(el=>({name:el.dataset.icon||'',svg:!!el.querySelector('svg')}));
 assert.equal(detachBack.name,'external','na Mesa o item volta ao ícone de soltar');
 assert.ok(detachBack.svg,'o item Soltar tem o ícone desenhado');
 assert.equal(await page.evaluate(()=>document.querySelector('#sidechat-pin')?.hidden),true,'o sinal do por cima só existe na janela solta');

 /* ---- 8 e 14: um aviso só no incerto e Enter com retorno ---- */
 await page.evaluate(async payload=>{const sidechat=await import('./src/sidechat.mjs');sidechat.openSavedSidechat(payload);},{
  id:'sc-11111111-1111-4111-8111-111111111111',engine:'opencode',
  messages:[
   {role:'user',text:'Explique o limite fundamental em uma linha.'},
   {role:'assistant',text:'Divida numerador e denominador por x antes de substituir.'},
  ],draft:'',busy:false,uncertain:true,
  context:{mainSession:'',refs:[{path:'/tmp/ciclo2/Limites.pdf',page:1},{path:'/tmp/ciclo2/Formulario.pdf',page:1}],study:{},at:1700000000000},
  cards:[],
 });
 await page.waitForSelector('#sidechat-messages .sidechat-warn',{timeout:10000});
 const uncertain=await page.evaluate(()=>{
  const root=document.querySelector('#sidechat');
  const visible=(el)=>{if(!el)return false;const box=el.getBoundingClientRect();return box.width>0&&box.height>0;};
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const hits=[];
  for(let node=walker.nextNode();node;node=walker.nextNode()){
   const text=String(node.nodeValue||'').trim();
   if(!/incerta/i.test(text)||!visible(node.parentElement))continue;
   hits.push(text);
  }
  return {
   warn:(document.querySelector('#sidechat-messages .sidechat-warn')?.textContent||'').trim(),
   activity:(document.querySelector('#sidechat-activity')?.textContent||'').trim(),
   sendDisabled:!!document.querySelector('#sidechat-send')?.disabled,
   hits,
  };
 });
 assert.ok(uncertain.warn,'o aviso do incerto fica na lista');
 assert.ok(uncertain.sendDisabled,'o Enviar desliga no incerto');
 assert.equal(uncertain.activity,'','a linha de atividade não repete o aviso');
 assert.equal(uncertain.hits.length,1,`um aviso só na tela (achei ${JSON.stringify(uncertain.hits)})`);

 await page.locator('#sidechat-prompt').fill('tentativa no incerto');
 await page.locator('#sidechat-prompt').press('Enter');
 await toastWait(page,'incerta',{timeout:5000});
 assert.equal(await page.evaluate(()=>document.querySelectorAll('#sidechat-messages .sidechat-msg.user').length),1,'o Enter no incerto não cria bolha nova');
 assert.equal(await page.locator('#sidechat-messages .sidechat-msg.user').filter({hasText:'tentativa no incerto'}).count(),0,'o texto do Enter bloqueado não virou bolha');

 assert.deepEqual(errors,[]);
 console.log('PASS: menu por teclado, rótulos, ícones, escopo, aviso único e barra da filha');
});
