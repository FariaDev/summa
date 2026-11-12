// node tests/composer-pins-ui.mjs — ações fixas do composer (#99), na janela.
// O clique direito no Anexar (e Shift+F10/tecla Menu) abre a escolha; até duas
// ações saem do menu e ficam na fileira; a terceira é recusada com aviso curto;
// a escolha sobrevive ao reload pelo estado de interface (desk.json).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,captureFixtureEnv,toastWait,resizeWindow
} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const shots='/tmp/mesa-99-amostras';
fs.mkdirSync(shots,{recursive:true});

const pinIds=page=>page.evaluate(()=>[...document.querySelectorAll('#attach-pin-pop [data-pin-action]')].map(el=>({id:el.dataset.pinAction,checked:el.getAttribute('aria-checked')})));
const rowIds=page=>page.evaluate(()=>[...document.querySelectorAll('#composer-box .composer-actions [data-pinned="true"]')].map(el=>el.id));
const menuIds=page=>page.evaluate(()=>[...document.querySelectorAll('#attach-pop button[role="menuitem"]')].filter(el=>!el.hidden).map(el=>el.id));

await withArtifacts('composer-pins',async ctx=>{
 const runtime=ctx.runtime=newRuntime('composer-pins');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[],study:{title:'',xopp:''}}}});
 ctx.app=await launchDesk({runtime,env:captureFixtureEnv(runtime)});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(ctx.app,page,1440,900,{content:true});
 await page.waitForSelector('#attach');

 /* ---------- 1. o padrão continua como hoje: tudo no menu do clipe ---------- */
 assert.deepEqual(await rowIds(page),[],'nenhuma ação fixa no composer');
 assert.deepEqual(await menuIds(page),['attach-file','phone-photo','check'],'as três ações ficam no menu Anexar');

 /* ---------- 2. clique direito abre a escolha de fixar ---------- */
 await page.locator('#attach').click({button:'right'});
 await page.waitForSelector('#attach-pin-pop:not([hidden])');
 assert.equal(await page.locator('#attach').getAttribute('aria-expanded'),'true','o Anexar diz que o menu está aberto');
 assert.deepEqual(await pinIds(page),[
  {id:'attach-file',checked:'false'},{id:'phone-photo',checked:'false'},{id:'check',checked:'false'}
 ],'a escolha lista as três ações, nenhuma fixa');
 await page.screenshot({path:path.join(shots,'escolha-fixar.png')});

 /* ---------- 3. fixa duas ações; a terceira é recusada com aviso ---------- */
 await page.locator('#pin-check').click();
 await page.waitForFunction(()=>document.querySelector('#check')?.closest('.composer-actions'));
 assert.deepEqual(await rowIds(page),['check'],'o Conferir fixado vai para a fileira');
 assert.deepEqual(await menuIds(page),['attach-file','phone-photo'],'ele sai do menu do clipe');
 assert.equal(await page.locator('#pin-check').getAttribute('aria-checked'),'true');

 await page.locator('#pin-attach-file').click();
 await page.waitForFunction(()=>document.querySelectorAll('#composer-box .composer-actions [data-pinned="true"]').length===2);
 assert.deepEqual(await rowIds(page),['attach-file','check'],'dois fixos na fileira, na ordem canônica');
 assert.deepEqual(await menuIds(page),['phone-photo'],'só a Foto do celular fica no menu');
 await page.screenshot({path:path.join(shots,'dois-fixos-na-fileira.png')});

 await page.locator('#pin-phone-photo').click();
 await toastWait(page,'No máximo 2 ações fixas');
 assert.equal(await page.locator('#pin-phone-photo').getAttribute('aria-checked'),'false','o terceiro não fica fixo');
 assert.deepEqual(await rowIds(page),['attach-file','check'],'a recusa não muda a fileira');
 assert.deepEqual(await menuIds(page),['phone-photo'],'nem o menu');
 await resizeWindow(ctx.app,page,900,650,{content:true});
 assert.ok(await page.evaluate(()=>{const row=document.querySelector('#composer-box .composer-actions');return row.scrollWidth<=row.clientWidth+1;}),'os dois fixos cabem na fileira em coluna estreita');
 await resizeWindow(ctx.app,page,1440,900,{content:true});

 /* ---------- 4. a preferência é estado de interface e sobrevive ao reload ---------- */
 const deskFile=path.join(runtime,'desk.json');
 const saved=await pollUntil(()=>{
  try{return JSON.parse(fs.readFileSync(deskFile,'utf8')).composerPins;}catch{return null;}
 },pins=>Array.isArray(pins)&&pins.join(',')==='check,attach-file',{what:'os fixos chegarem ao desk.json'});
 assert.deepEqual(saved,['check','attach-file'],'a ordem escolhida é a gravada');

 await page.reload({waitUntil:'load'});
 await page.waitForSelector('#composer-box');
 await page.waitForFunction(()=>document.querySelectorAll('#composer-box .composer-actions [data-pinned="true"]').length===2);
 assert.deepEqual(await rowIds(page),['attach-file','check'],'o reload devolve os dois fixos');
 assert.deepEqual(await menuIds(page),['phone-photo'],'e mantém o resto no menu');

 /* ---------- 5. teclado: Shift+F10 e a tecla Menu abrem; Esc fecha e volta o foco ---------- */
 await page.locator('#attach').focus();
 await page.keyboard.press('Shift+F10');
 await page.waitForSelector('#attach-pin-pop:not([hidden])');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.querySelector('#attach-pin-pop').hidden===true);
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'attach','o foco volta ao Anexar');
 await page.keyboard.press('ContextMenu');
 await page.waitForSelector('#attach-pin-pop:not([hidden])');

 /* ---------- 6. desafixar devolve ao menu e o estado persiste ---------- */
 await page.locator('#pin-check').click();
 await page.waitForFunction(()=>document.querySelector('#check')?.closest('#attach-pop'));
 assert.deepEqual(await rowIds(page),['attach-file'],'desafixado, o Conferir sai da fileira');
 assert.deepEqual(await menuIds(page),['phone-photo','check'],'e volta ao menu na ordem canônica');
 await page.locator('#pin-attach-file').click();
 await page.waitForFunction(()=>document.querySelectorAll('#composer-box .composer-actions [data-pinned="true"]').length===0);
 assert.deepEqual(await rowIds(page),[],'sem fixos');
 assert.deepEqual(await menuIds(page),['attach-file','phone-photo','check'],'o menu volta inteiro e na ordem');
 await page.locator('#pin-attach-file').click();
 await page.waitForFunction(()=>document.querySelectorAll('#composer-box .composer-actions [data-pinned="true"]').length===1);
 await page.locator('#pin-attach-file').click();
 await page.waitForFunction(()=>document.querySelectorAll('#composer-box .composer-actions [data-pinned="true"]').length===0);
 await pollUntil(()=>{
  try{return JSON.parse(fs.readFileSync(deskFile,'utf8')).composerPins;}catch{return null;}
 },pins=>Array.isArray(pins)&&pins.length===0,{what:'a remoção dos fixos chegar ao desk.json'});
 /* ---------- 7. ação desligada não ocupa vaga; fixada, continua desafixável ---------- */
 await page.keyboard.press('Escape');
 await page.evaluate(()=>{document.querySelector('#phone-photo').hidden=true;});
 await page.locator('#attach').click({button:'right'});
 await page.waitForSelector('#attach-pin-pop:not([hidden])');
 assert.equal(await page.locator('#pin-phone-photo').isHidden(),true,'a Foto do celular desligada sai da escolha de fixos');
 await page.keyboard.press('Escape');
 await page.evaluate(()=>{document.querySelector('#phone-photo').hidden=false;});
 await page.locator('#attach').click({button:'right'});
 await page.locator('#pin-phone-photo').click();
 await page.keyboard.press('Escape');
 await page.evaluate(()=>{document.querySelector('#phone-photo').hidden=true;});
 await page.locator('#attach').click({button:'right'});
 await page.waitForSelector('#attach-pin-pop:not([hidden])');
 assert.equal(await page.locator('#pin-phone-photo').isVisible(),true,'fixada antes de desligar, ainda dá para desafixar');
 assert.deepEqual(errors,[],'sem erro de página');
 console.log('composer-pins-ui: PASS — clique direito e teclado abrem a escolha; até dois fixos na fileira; terceiro recusado com aviso; escolha e remoção sobrevivem ao reload pelo desk.json.');
});
