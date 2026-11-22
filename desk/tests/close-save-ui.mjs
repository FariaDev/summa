import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,launchDesk,statusOnline} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

for(const mode of ['close','quit'])await withArtifacts(`close-save-${mode}`,async ctx=>{
 const runtime=ctx.runtime=newRuntime(`close-save-${mode}`),course=seedCourse(runtime,'Test');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Test',path:course}]});
 const saved=()=>JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
 ctx.app=await launchDesk({runtime});
 let page=await ctx.app.firstWindow();
 await statusOnline(page);
 await page.locator('#study-plan-menu .study-plan-trigger').click();
 await page.locator('#study-plan-pop [data-action="add"]').click();
 await page.locator('.study-plan-text').first().fill('Saved baseline');
 await pollUntil(saved,v=>v.courseStates?.Test?.studyPlan?.tasks?.[0]?.text==='Saved baseline',{what:'baseline saved'});
 await page.evaluate(()=>{
  const task=document.querySelector('.study-plan-text');
  task.value='Pending title';task.dispatchEvent(new Event('input',{bubbles:true}));
  const prompt=document.querySelector('#prompt');
  prompt.value='Pending draft';prompt.dispatchEvent(new Event('input',{bubbles:true}));
 });
 const closed=ctx.app.waitForEvent('close',{timeout:10000});
 if(mode==='quit')await ctx.app.evaluate(({app})=>app.quit());
 else await (await ctx.app.browserWindow(page)).evaluate(win=>win.close());
 await closed;ctx.app=null;
 assert.equal(saved().courseStates.Test.studyPlan.tasks[0].text,'Pending title',`${mode}: pending plan reaches disk`);
 assert.equal(saved().draft,'Pending draft',`${mode}: pending draft reaches disk`);
 ctx.app=await launchDesk({runtime});page=await ctx.app.firstWindow();
 await statusOnline(page);
 await page.locator('#study-plan-menu .study-plan-trigger').click();
 assert.equal(await page.locator('.study-plan-text').first().inputValue(),'Pending title');
 assert.equal(await page.locator('#prompt').inputValue(),'Pending draft');
});
for(const mode of ['idle','error','unresponsive','crashed'])await withArtifacts(`close-save-${mode}`,async ctx=>{
 const runtime=ctx.runtime=newRuntime(`close-save-${mode}`),course=seedCourse(runtime,'Test');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Test',path:course}]});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 await statusOnline(page);
 await page.waitForFunction(async()=>!(await import('./src/state.mjs')).S.saveTimer);
 const marker=path.join(runtime,'unexpected-save');
 await ctx.app.evaluate(({ipcMain},{marker})=>{
  const files=process.getBuiltinModule('fs');
  ipcMain.removeHandler('save-state');
  ipcMain.handle('save-state',()=>{files.writeFileSync(marker,'save');throw Error('Save rejected for regression test');});
 },{marker});
 if(mode==='error')await page.locator('#prompt').fill('Pending failed save');
 if(mode==='unresponsive')await page.evaluate(()=>setTimeout(()=>{while(true){ /* renderer travado */ }},0));
 const window=await ctx.app.browserWindow(page);
 if(mode==='crashed')await window.evaluate(win=>win.webContents.forcefullyCrashRenderer());
 const closed=ctx.app.waitForEvent('close',{timeout:10000});
 await window.evaluate(win=>win.close());
 await closed;ctx.app=null;
 assert.equal(fs.existsSync(marker),mode==='error',`${mode}: only pending saves invoke save-state`);
});
console.log('close-save-ui: ok (close, quit, idle, rejected save, unresponsive and crashed renderer)');
