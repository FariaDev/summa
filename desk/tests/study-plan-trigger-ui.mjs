// node tests/study-plan-trigger-ui.mjs — o gatilho do Plano na barra de cima
// tem o mesmo tamanho de texto, altura e ícone das abas Caderno e GeoGebra ao
// lado (antes herdava os 12px e a pílula de 28px dos menus da direita).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,tinyPdf,reviewShot,screenshotDirectory} from './helpers.mjs';

const out=screenshotDirectory('study-plan-trigger');
await withArtifacts('study-plan-trigger',async ctx=>{
 const runtime=ctx.runtime=newRuntime('studyplantrigger');
 const course=seedCourse(runtime,'calc');
 fs.writeFileSync(path.join(course,'Apostila.pdf'),tinyPdf('Apostila'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc'});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 const measure=()=>page.evaluate(()=>{
  const box=el=>{const style=getComputedStyle(el);const icon=el.querySelector('svg');return {font:style.fontSize,height:Math.round(el.getBoundingClientRect().height),icon:icon?Math.round(icon.getBoundingClientRect().width):0};};
  const ggb=[...document.querySelectorAll('#course-tabs button')].find(button=>button.querySelector('svg'));
  return {ggb:box(ggb),plan:box(document.querySelector('#study-plan-menu .study-plan-trigger'))};
 });
 const {ggb,plan}=await measure();
 await reviewShot(page.locator('header'),out,'header.png');
 assert.deepEqual(plan,ggb,'Plano matches the GeoGebra tab next to it');
});
console.log('study-plan-trigger-ui: PASS — Plano com texto, altura e ícone iguais aos da aba GeoGebra');
