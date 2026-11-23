import assert from 'node:assert/strict';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,freezeMotion,reviewShot,screenshotDirectory,resizeWindow} from './helpers.mjs';
import {installFakeSwitchIpc,installFakeSwitchConfirm} from './fake-installer-switch.mjs';

const out=screenshotDirectory('about-installer-switch');
await withArtifacts('about-installer-switch',async ctx=>{
 const runtime=ctx.runtime=newRuntime('about-installer-switch');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc'});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 await page.waitForSelector('#settings-menu .nav-trigger');
 await freezeMotion(page);
 await resizeWindow(ctx.app,page,900,650,{content:true});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const [target,label] of [['exe','Windows (.exe)'],['dmg','macOS (DMG)'],['appimage','Linux (AppImage)']]){
  await ctx.app.evaluate(installFakeSwitchIpc,{target,fail:true});
  await page.locator('#settings-menu .nav-trigger').click();await page.locator('#about').click();
  const button=page.locator('#installer-switch');
  await button.waitFor();assert.match(await button.textContent(),new RegExp(label.replace(/[().]/g,'\\$&')));
  await page.evaluate(installFakeSwitchConfirm,false);await button.click();
  assert.equal(await ctx.app.evaluate(({ipcMain})=>ipcMain._invokeHandlers.get('test-switch-count')()),0);
  await page.evaluate(installFakeSwitchConfirm,true);await button.click();
  await page.waitForFunction(()=>document.querySelector('#installer-switch')?.disabled===false);
  assert.equal(await ctx.app.evaluate(({ipcMain})=>ipcMain._invokeHandlers.get('test-switch-count')()),1);
  assert.match(await page.locator('body').getAttribute('data-switch-confirm'),/estudos.*pasta antiga.*runtime/s);
  assert.equal(await page.locator('#about-dialog').isVisible(),true);
  const fit=await button.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth);
  assert.equal(fit,true);
  await reviewShot(page,out,`${target}-pt-BR.png`);
  await page.locator('#about-dialog .dialog-close').click();
 }
 await ctx.app.evaluate(installFakeSwitchIpc,{target:'appimage'});
 await page.evaluate(async()=>{const text=await import('./src/ui-text.mjs');await text.setUiLanguage('en');});
 await page.locator('#settings-menu .nav-trigger').click();await page.locator('#about').click();
 await page.waitForFunction(()=>document.querySelector('#installer-switch')?.textContent==='Install the Linux version (AppImage)');
 await page.evaluate(installFakeSwitchConfirm,true);await page.locator('#installer-switch').click();
 assert.match(await page.locator('body').getAttribute('data-switch-confirm'),/studies.*old folder.*runtime/s);
 await reviewShot(page,out,'appimage-en.png');
 await page.locator('#about-dialog .dialog-close').click();
 await ctx.app.evaluate(installFakeSwitchIpc,{target:null});
 await page.locator('#settings-menu .nav-trigger').click();await page.locator('#about').click();
 await page.waitForFunction(()=>document.querySelector('#about-installer-switch')?.hidden);
 assert.deepEqual(errors,[]);
});
console.log(`about-installer-switch-ui: PASS — oferta por OS, confirmação/cancelamento, erro e inglês; capturas em ${out}`);
