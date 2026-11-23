// node tests/material-picker-tab-ui.mjs — teclado do seletor de material (#74):
// Home/End vão ao primeiro e ao último item, e Tab ou Shift+Tab, que tiram o
// foco da busca, fecham a lista em vez de deixá-la aberta sobre o leitor.
// PDFs gerados no teste, nada de material de curso.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,tinyPdf,reviewShot,screenshotDirectory} from './helpers.mjs';

const writePdf=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,tinyPdf(text));};
const out=screenshotDirectory('material-picker-tab');

await withArtifacts('material-picker-tab',async ctx=>{
 const runtime=ctx.runtime=newRuntime('materialpickertab');
 const course=seedCourse(runtime,'calc');
 writePdf(path.join(course,'Apostila.pdf'),'Apostila');
 writePdf(path.join(course,'Lista.pdf'),'Lista');
 writePdf(path.join(course,'Cap 1','Aula.pdf'),'Aula');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc'});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 const select=page.locator('#pdf-grid .pdf-panel').first().locator('.pdf-select');
 const pop=page.locator('.material-pop:not([hidden])');
 const active=()=>pop.locator('.active').textContent();
 const focusInPop=()=>page.evaluate(()=>!!document.activeElement?.closest('.material-pop'));

 await select.click();
 await pop.waitFor({state:'visible',timeout:5000});
 await page.keyboard.press('End');
 assert.equal(await active(),'Abrir PDF…');
 await page.keyboard.press('Home');
 assert.equal(await active(),'Apostila.pdf');

 await page.keyboard.press('Tab');
 await reviewShot(page,out,'after-tab.png');
 assert.equal(await focusInPop(),false,'Tab leaves the search field');
 await pop.waitFor({state:'hidden',timeout:2000});

 await select.click();
 await pop.waitFor({state:'visible',timeout:5000});
 await page.keyboard.press('Shift+Tab');
 assert.equal(await focusInPop(),false,'Shift+Tab leaves the search field');
 await pop.waitFor({state:'hidden',timeout:2000});
 assert.deepEqual(errors,[]);
});
console.log('material-picker-tab-ui: PASS — Home/End no primeiro e no último item; Tab e Shift+Tab fecham a lista');
