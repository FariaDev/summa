// Área da página do PDF no leitor: a página continua ocupando a largura do
// painel como antes do Carbon r1 (que trouxe cartão e margem só no protótipo).
// Mede na janela real, com dois leitores, a razão largura da página renderizada
// / largura do painel e trava o número medido antes do redesenho (2026-11-10):
// 0,9819 em 1440×900 e 0,9625 em 900×650. A página pode crescer; encolher não.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,resizeWindow,freezeMotion,tinyPdfPages} from './helpers.mjs';
import {settle} from './layout-measure.mjs';
import {pdfRenderIdle} from './waits.mjs';

const MIN_RATIO={wide:0.981,narrow:0.962};
const SIZES=[[1440,900,'wide'],[900,650,'narrow']];
const ratios=page=>page.evaluate(()=>[...document.querySelectorAll('#pdf-grid .pdf-panel')].map(panel=>{
 const panelWidth=panel.getBoundingClientRect().width;
 const pageWidth=panel.querySelector('.pdf-page')?.getBoundingClientRect().width||0;
 return {label:panel.getAttribute('aria-label')||'',panelWidth,pageWidth,ratio:pageWidth/panelWidth};
}));

await withArtifacts('pdf-page-area',async ctx=>{
 const runtime=ctx.runtime=newRuntime('pdf-page-area');
 const course=seedCourse(runtime,'Test');
 const apostila=path.join(course,'Limites.pdf');
 const formulario=path.join(course,'Formulario.pdf');
 fs.writeFileSync(apostila,tinyPdfPages(6,'Limites'));
 fs.writeFileSync(formulario,tinyPdfPages(3,'Formulario'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk:{pinnedExtensions:false}});
 writeDeskJson(runtime,{courseId:'Test',courseStates:{Test:{pdfs:[{path:apostila,page:1},{path:formulario,page:1}],study:{title:'',xopp:''}}}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('.pdf-page canvas',{timeout:25000});
 for(const [width,height,key] of SIZES){
  await resizeWindow(ctx.app,page,width,height);
  await settle(page);
  await pdfRenderIdle(page);
  const list=await ratios(page);
  assert.equal(list.length,2,`${width}×${height}: dois leitores à vista`);
  for(const item of list){
   assert.ok(item.pageWidth>0,`${width}×${height} ${item.label}: a página foi medida`);
   assert.ok(item.ratio>=MIN_RATIO[key],`${width}×${height} ${item.label}: a página ocupa a largura do painel (${item.ratio.toFixed(4)} de ${MIN_RATIO[key]} mínimo; página ${item.pageWidth}px, painel ${item.panelWidth}px)`);
  }
 }
 assert.deepEqual(errors,[],'sem erro de página');
 console.log(`PDF PAGE AREA UI PASSED: página na largura do painel (≥${MIN_RATIO.wide} em 1440×900, ≥${MIN_RATIO.narrow} em 900×650).`);
});
