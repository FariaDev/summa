import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,tinyPdf,statusOnline,freezeMotion} from './helpers.mjs';

await withArtifacts('plano-leitor',async ctx=>{
 const runtime=ctx.runtime=newRuntime('plano-leitor'),course=seedCourse(runtime,'Test');
 const lista=path.join(course,'Lista.pdf'),teoria=path.join(course,'Teoria.pdf');
 for(const file of [lista,teoria])fs.writeFileSync(file,tinyPdf([path.basename(file)],4));
 const studyPlan={tasks:[
  {id:'one',text:'Revisar derivadas',done:false,pdf:lista,page:1},
  {id:'two',text:'Resolver exercicios',done:false,pdf:'',page:0},
 ],notes:'Preservar notas'};
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk:{pinnedExtensions:false}});
 writeDeskJson(runtime,{courseId:'Test',studyPlan,courseStates:{Test:{studyPlan}}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 const trigger=page.locator('#study-plan-menu .study-plan-trigger');
 const pop=page.locator('#study-plan-pop');
 const first=pop.locator('.study-plan-row').nth(0),second=pop.locator('.study-plan-row').nth(1);

 await page.locator('.pdf-select').first().selectOption(teoria);
 await trigger.click();
 await pop.waitFor({state:'visible'});
 assert.equal(await pop.locator('[data-action="link"]').count(),2,'abrir o Plano depois de trocar o PDF atualiza ligar e trocar, sem editar o plano');
 assert.equal(await first.locator('[data-action="link"]').textContent(),'trocar pelo PDF aberto');
 assert.equal(await second.locator('[data-action="link"]').textContent(),'ligar ao PDF aberto');
 await first.locator('[data-action="link"]').click();
 assert.match(await first.locator('.study-plan-ref').textContent(),/Teoria\.pdf/,'trocar usa o PDF atual, não o antigo');
 await second.locator('[data-action="link"]').click();
 assert.match(await second.locator('.study-plan-ref').textContent(),/Teoria\.pdf/,'ligar usa o PDF atual');

 await trigger.click();
 await page.locator('.pdf-select').first().selectOption(lista);
 await trigger.focus();
 await trigger.press('ArrowDown');
 await pop.waitFor({state:'visible'});
 await first.locator('[data-action="link"]').click();
 assert.match(await first.locator('.study-plan-ref').textContent(),/Lista\.pdf/,'reabrir pelo teclado também atualiza o PDF');
 assert.deepEqual(await pop.locator('.study-plan-text').evaluateAll(fields=>fields.map(field=>field.value)),studyPlan.tasks.map(task=>task.text));
 assert.equal(await page.locator('#study-plan-notes').inputValue(),studyPlan.notes);
 console.log('PASS: study-plan reader actions refresh on mouse and keyboard opening');
});
