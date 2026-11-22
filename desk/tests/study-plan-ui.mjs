import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdfPages,statusOnline,freezeMotion,enterFree,openMore} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

/* Plano de estudo na barra de cima (#110): o botão "Plano" mostra o "agora", a
   lista troca texto no lugar (Enter cria, Backspace em vazio apaga), liga a
   tarefa ao PDF aberto, e as Anotações são texto livre. Tudo volta depois de
   fechar e reabrir o app: o plano é do estado da matéria (desk.json). */

const savedPlan=runtime=>{try{return JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8')).courseStates?.Test?.studyPlan||null;}catch{return null;}};
const triggerText=page=>page.locator('#study-plan-menu .study-plan-trigger').textContent().then(text=>text.replace(/\s+/g,' ').trim());
const taskTexts=page=>page.locator('#study-plan-pop .study-plan-text').evaluateAll(nodes=>nodes.map(node=>node.value));

async function openPlan(page){
 const trigger=page.locator('#study-plan-menu .study-plan-trigger');
 if(!(await page.locator('#study-plan-pop').isVisible()))await trigger.click();
 await page.locator('#study-plan-pop').waitFor({state:'visible'});
}

async function relaunch(ctx,runtime){
 await ctx.app.close();
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 return page;
}

await withArtifacts('plano-estudo',async ctx=>{
 const runtime=ctx.runtime=newRuntime('plano-estudo'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Lista.pdf'),tinyPdfPages(3,'Lista de derivadas'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 let page=await ctx.app.firstWindow();
 let errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);

 /* ---------- 1. o botão aparece na matéria, sem tarefa ---------- */
 assert.equal(await page.locator('#study-plan-menu').isVisible(),true,'o Plano aparece na barra de cima, numa matéria');
 assert.equal(await triggerText(page),'Plano','sem tarefa, o botão só diz Plano');
 assert.equal(await page.locator('#study-plan-menu .study-plan-trigger .study-plan-icon svg').count(),1,'o gatilho mostra o ícone do Plano');

 /* ---------- 2. criar tarefas: botão, Enter e Backspace em vazio ---------- */
 await openPlan(page);
 await page.locator('#study-plan-pop [data-action="add"]').click();
 await page.locator('#study-plan-pop .study-plan-text').nth(0).fill('Q1 derivadas');
 await page.locator('#study-plan-pop .study-plan-text').nth(0).dispatchEvent('keydown',{key:'Enter',isComposing:true});
 assert.equal(await page.locator('#study-plan-pop .study-plan-text').count(),1,'Enter durante composição não cria tarefa');
 await page.locator('#study-plan-pop .study-plan-text').nth(0).press('Enter');
 await page.waitForFunction(()=>document.activeElement?.classList.contains('study-plan-text')&&document.querySelectorAll('.study-plan-text').length===2,undefined,{timeout:5000});
 await page.keyboard.type('Q2 limites');
 await page.locator('#study-plan-pop .study-plan-text').nth(1).press('Enter');
 await page.waitForFunction(()=>document.querySelectorAll('.study-plan-text').length===3,undefined,{timeout:5000});
 await page.locator('#study-plan-pop .study-plan-text').nth(2).dispatchEvent('keydown',{key:'Backspace',isComposing:true});
 assert.equal(await page.locator('#study-plan-pop .study-plan-text').count(),3,'Backspace durante composição não remove tarefa vazia');
 await page.locator('#study-plan-pop .study-plan-text').nth(2).dispatchEvent('keydown',{key:'Escape',isComposing:true});
 assert.equal(await page.locator('#study-plan-pop').isVisible(),true,'Escape durante composição não fecha o Plano');
 await page.keyboard.press('Backspace');
 await page.waitForFunction(()=>document.querySelectorAll('.study-plan-text').length===2,undefined,{timeout:5000});
 assert.deepEqual(await taskTexts(page),['Q1 derivadas','Q2 limites'],'Enter criou a segunda; o Backspace em vazio tirou a terceira');
 assert.equal(await page.evaluate(()=>document.activeElement?.value),'Q2 limites','o foco volta para a tarefa anterior ao apagar');
 assert.equal(await page.locator('#study-plan-pop .study-plan-text').first().evaluate(field=>field.tagName),'TEXTAREA','o texto da tarefa é editado numa área de texto');
 const shortText=page.locator('#study-plan-pop .study-plan-text').nth(1);
 const shortHeight=await shortText.evaluate(field=>field.getBoundingClientRect().height);
 await shortText.fill('Q2 limites '.repeat(18).trim());
 const longHeight=await shortText.evaluate(field=>field.getBoundingClientRect().height);
 assert.ok(longHeight>shortHeight,'uma tarefa longa cresce para mostrar o texto quebrado');
 await shortText.fill('Q2 limites');
 const textWidths=await page.locator('#study-plan-pop .study-plan-text').first().evaluate(field=>({field:field.getBoundingClientRect().width,main:field.closest('.study-plan-main')?.getBoundingClientRect().width||0}));
 assert.ok(textWidths.field>=textWidths.main*.9,'o campo de texto ocupa quase toda a largura da tarefa');
 const multiline=page.locator('#study-plan-pop .study-plan-text').first();
 await multiline.fill('Q1\nQ2');
 assert.equal(await multiline.inputValue(),'Q1 Q2','a quebra de linha colada volta ao formato armazenado');
 await multiline.fill('Q1 derivadas');

 /* ---------- 3. ligar ao PDF aberto e abrir ---------- */
 const firstRow=page.locator('#study-plan-pop .study-plan-row').nth(0);
 await firstRow.locator('[data-action="link"]').click();
 await page.waitForFunction(()=>/Lista\.pdf · p\. 1/.test(document.querySelector('#study-plan-pop .study-plan-row')?.textContent||''),undefined,{timeout:5000});
 assert.equal(await firstRow.locator('[data-action="open"]').count(),1,'tarefa com PDF mostra abrir');
 assert.equal(await firstRow.locator('.study-plan-ref').evaluate(reference=>reference.tagName==='BUTTON'&&reference.dataset.action==='open'),true,'o nome do PDF é um botão de abrir');
 assert.equal(await page.locator('#study-plan-pop .study-plan-row').nth(1).locator('[data-action="open"]').count(),0,'tarefa sem PDF não mostra abrir');

 /* desligar do PDF tira o PDF e a página; a tarefa volta a oferecer ligar. Ligar de novo deixa a 1ª como estava. */
 await firstRow.locator('[data-action="unlink"]').click();
 await page.waitForFunction(()=>!/Lista\.pdf/.test(document.querySelector('#study-plan-pop .study-plan-row')?.textContent||''),undefined,{timeout:5000});
 assert.equal(await firstRow.locator('[data-action="open"]').count(),0,'desligada, a tarefa não mostra abrir');
 assert.equal(await firstRow.locator('[data-action="unlink"]').count(),0,'desligada, não sobra desligar');
 assert.equal(await firstRow.locator('[data-action="link"]').textContent(),'ligar ao PDF aberto','desligada, a tarefa volta a oferecer ligar ao PDF aberto');
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.action),'link','o foco vai para ligar, no lugar do botão que sumiu');
 await firstRow.locator('[data-action="link"]').click();
 await page.waitForFunction(()=>/Lista\.pdf · p\. 1/.test(document.querySelector('#study-plan-pop .study-plan-row')?.textContent||''),undefined,{timeout:5000});

 /* ---------- 4. editar no lugar, marcar a primeira e escrever nas Anotações ---------- */
 await page.locator('#study-plan-pop .study-plan-text').nth(0).fill('Q1 derivadas (regra da cadeia)');
 assert.equal(await page.locator('label[for="study-plan-notes"]').count(),1,'Anotações tem rótulo ligado ao campo');
 assert.equal(await page.locator('#study-plan-notes').evaluate(field=>field.tagName),'TEXTAREA','Anotações é uma área de texto');
 await firstRow.locator('input[type="checkbox"]').check();
 await page.waitForFunction(()=>/agora: Q2 limites/.test(document.querySelector('#study-plan-menu .study-plan-trigger')?.textContent||''),undefined,{timeout:5000});
 assert.equal(await triggerText(page),'Plano · agora: Q2 limites','marcar a primeira faz o botão mostrar a segunda');
 await page.locator('#study-plan-notes').fill('Prova sexta. Regra da cadeia.');
 await pollUntil(()=>savedPlan(runtime),plan=>plan&&plan.notes==='Prova sexta. Regra da cadeia.'&&plan.tasks[0]?.done===true&&plan.tasks[0]?.pdf.endsWith('Lista.pdf')&&plan.tasks[0]?.text==='Q1 derivadas (regra da cadeia)',{timeout:8000,interval:100,what:'o plano gravado no desk.json'});

 /* ---------- 5. fechar e reabrir: tudo volta ---------- */
 page=await relaunch(ctx,runtime);
 errors=[];page.on('pageerror',error=>errors.push(error.message));
 await pollUntil(()=>triggerText(page),text=>text==='Plano · agora: Q2 limites',{timeout:15000,interval:150,what:'o botão com o agora depois de reabrir'});
 await openPlan(page);
 assert.deepEqual(await taskTexts(page),['Q1 derivadas (regra da cadeia)','Q2 limites'],'os textos voltaram');
 assert.equal(await page.locator('#study-plan-pop .study-plan-row').nth(0).locator('input[type="checkbox"]').isChecked(),true,'a marca voltou');
 assert.match(await page.locator('#study-plan-pop .study-plan-row').nth(0).textContent()||'',/Lista\.pdf · p\. 1/,'o PDF ligado voltou');
 assert.equal(await page.locator('#study-plan-notes').inputValue(),'Prova sexta. Regra da cadeia.','as Anotações voltaram');
 assert.equal(await page.locator('#study-plan-pop .study-plan-count').textContent(),'1 de 2','a contagem reflete a marca');

 /* ---------- 6. abrir restaura o leitor, volta à página e fecha a lista ---------- */
 await page.keyboard.press('Escape');
 const reader=page.locator('.pdf-panel').first();
 const pageNumber=reader.locator('.page-number');
 await reader.locator('.pager').click();
 await pageNumber.fill('3');
 await pageNumber.press('Enter');
 await pollUntil(()=>pageNumber.inputValue(),value=>value==='3',{timeout:5000,what:'o leitor na página 3'});
 await (await openMore(reader)).locator('.collapse').click();
 const restore=reader.locator('.pdf-restore');
 await restore.waitFor({state:'visible'});
 await openPlan(page);
 await page.locator('#study-plan-pop .study-plan-row').nth(0).locator('.study-plan-ref').click();
 await page.locator('#study-plan-pop').waitFor({state:'hidden'});
 await pollUntil(()=>restore.isVisible(),visible=>!visible,{timeout:5000,what:'o leitor restaurado pelo link no Plano'});
 await pollUntil(()=>pageNumber.inputValue(),value=>value==='1',{timeout:5000,what:'o leitor na página ligada à tarefa'});
 await reader.locator('.pdf-page[data-page="1"] canvas').waitFor({state:'visible'});

 /* ---------- 7. no Livre o Plano some; de volta na matéria, reaparece ---------- */
 /* Na janela estreita (Windows) a barra compacta esconde a aba; o clique vai pelo DOM (#110). */
 await page.evaluate(()=>document.querySelector('#course-tabs button[data-id="mesa-free"]').click());
 await enterFree(page);
 assert.equal(await page.locator('#study-plan-menu').isHidden(),true,'o Plano não aparece no Livre');
 /* A volta também vai pelo DOM (barra compacta), depois de a aba destravar: no Livre o tutor ainda aquece e trava a troca. */
 await page.waitForFunction(()=>!document.querySelector('#course-tabs button[data-id="Test"]')?.disabled,undefined,{timeout:30000});
 await page.evaluate(()=>document.querySelector('#course-tabs button[data-id="Test"]').click());
 await page.waitForFunction(()=>document.querySelector('#study-plan-menu') && !document.querySelector('#study-plan-menu').hidden,undefined,{timeout:15000});
 assert.equal(await triggerText(page),'Plano · agora: Q2 limites','a matéria volta com o seu plano');

 assert.deepEqual(errors,[],'nenhum erro de página');
});
