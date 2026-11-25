// node tests/title-bar-ui.mjs — barra de título própria no Windows e no Linux (Electron real).
// Cobre: a faixa das abas arrasta a janela e os botões dela não; o espaço dos
// botões do sistema fica reservado; o tema escuro pinta os botões da janela com
// a cor da faixa; o ≡ e o Alt sozinho abrem o menu da aplicação embaixo do ≡. No macOS nada muda.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,tinyPdf,statusOnline,pageWindow,freezeMotion,reviewShot,screenshotDirectory} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const out=screenshotDirectory('title-bar');

await withArtifacts('title-bar',async ctx=>{
 const runtime=ctx.runtime=newRuntime('title-bar'),course=seedCourse(runtime,'calc');
 fs.writeFileSync(path.join(course,'Apostila.pdf'),tinyPdf('Apostila'));
 writeConfigJson(runtime,{vaultPath:runtime,runtimePath:runtime,language:{ui:'pt-BR',tutor:'pt-BR'},courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',theme:'light'});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await freezeMotion(page);
 const win=await pageWindow(ctx.app,page);

 if(process.platform==='darwin'){
  assert.equal(await page.evaluate(()=>document.body.classList.contains('custom-titlebar')),false,'macOS fica com a barra do sistema');
  assert.equal(await page.locator('#app-menu-button').isVisible(),false);
  return;
 }

 /* O main registra o que pinta nos botões da janela e o popup do menu. */
 await win.evaluate(bw=>{
  const paint=bw.setTitleBarOverlay.bind(bw);
  globalThis.__titleBar={overlays:[],popups:[]};
  bw.setTitleBarOverlay=options=>{globalThis.__titleBar.overlays.push(options);paint(options);};
 });
 await ctx.app.evaluate(({Menu})=>{
  Menu.getApplicationMenu().popup=options=>globalThis.__titleBar.popups.push({x:options.x,y:options.y});
 });
 const recorded=()=>ctx.app.evaluate(()=>globalThis.__titleBar);

 assert.equal(await page.evaluate(()=>document.body.classList.contains('custom-titlebar')),true,'Windows e Linux usam a barra própria');
 const regions=await page.evaluate(()=>{
  const region=el=>getComputedStyle(el).getPropertyValue('-webkit-app-region').trim()||getComputedStyle(el).webkitAppRegion;
  return {header:region(document.querySelector('body>header')),tab:region(document.querySelector('#course-tabs button[role=tab]')),menu:region(document.querySelector('#app-menu-button'))};
 });
 assert.deepEqual(regions,{header:'drag',tab:'no-drag',menu:'no-drag'},'a faixa arrasta, o que é clicável não');
 const reserve=await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--titlebar-reserve')));
 assert.ok(reserve>0,`os botões do sistema têm espaço reservado (recebido ${reserve})`);
 assert.equal(await page.locator('#app-menu-button').getAttribute('aria-label'),'Menu da Summa');
 assert.equal(await win.evaluate(bw=>bw.isMenuBarVisible()),false,'sem a faixa do menu');
 await reviewShot(page,out,'light.png');

 await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
 const dark=await pollUntil(recorded,state=>state.overlays.length>0,{timeout:5000,interval:100,what:'os botões da janela pegarem a cor do tema escuro'});
 const headerColor=await page.evaluate(()=>getComputedStyle(document.querySelector('body>header')).backgroundColor);
 const last=dark.overlays.at(-1);
 assert.match(last.color,/^#[0-9a-f]{6}$/);
 assert.equal(`rgb(${[1,3,5].map(i=>parseInt(last.color.slice(i,i+2),16)).join(', ')})`,headerColor,'a cor dos botões é a da faixa');
 assert.equal(last.height,await page.evaluate(()=>document.querySelector('body>header').clientHeight));

 const button=await page.locator('#app-menu-button').boundingBox();
 await page.locator('#app-menu-button').click();
 const opened=await pollUntil(recorded,state=>state.popups.length>0,{timeout:5000,interval:100,what:'o ≡ abrir o menu'});
 assert.deepEqual(opened.popups[0],{x:Math.round(button.x),y:Math.round(button.y+button.height)},'o menu abre embaixo do ≡');

 /* Alt sozinho abre o mesmo menu: sem a moldura do sistema não há barra de menu
    para o Alt mostrar (visto na VM Windows 11, teste da 1.4.1). */
 await page.locator('#course-tabs button[role=tab]').first().focus();
 await page.keyboard.press('Alt');
 const byAlt=await pollUntil(recorded,state=>state.popups.length>1,{timeout:5000,interval:100,what:'o Alt sozinho abrir o menu'});
 assert.deepEqual(byAlt.popups[1],opened.popups[0],'o Alt abre o menu embaixo do ≡');
 assert.equal(await win.evaluate(bw=>bw.isMenuBarVisible()),false,'o Alt não traz de volta a faixa do menu');
 /* Sem espera fixa: um Alt sozinho depois do atalho serve de marco, e o pedido
    do atalho, se houvesse, chegaria antes dele. */
 await page.keyboard.down('Alt');await page.keyboard.press('Shift');await page.keyboard.up('Alt');
 await page.keyboard.press('Alt');
 const afterCombo=await pollUntil(recorded,state=>state.popups.length>2,{timeout:5000,interval:100,what:'o Alt de marco abrir o menu'});
 assert.equal(afterCombo.popups.length,3,'Alt usado num atalho não abre o menu');
 assert.deepEqual(errors,[]);
});
console.log('title-bar-ui: PASS — faixa que arrasta, espaço dos botões, cor do tema, o ≡ e o Alt com o menu');
