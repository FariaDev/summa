import assert from 'node:assert/strict';
import {launchDesk,newRuntime,writeConfigJson,enterFree,freeMenuClick,resizeWindow} from './helpers.mjs';

const runtime=newRuntime('free-ime');
writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[]});
const app=await launchDesk({runtime,env:{LEARNING_DESK_LOCALE:'en',LEARNING_VAULT:runtime}});
const failures=[];
function check(value,message){
 console.log(`${value?'PASS':'FAIL'}: ${message}`);
 if(!value)failures.push(message);
}
try{
 const page=await app.firstWindow();
 await resizeWindow(app,page,1440,900);
 await enterFree(page);
 await app.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});
 await page.waitForFunction(()=>!document.querySelector('#free-title').disabled);
 for(const selector of ['#free-title','#free-promote-name']){
  if(selector==='#free-promote-name')await freeMenuClick(page,'#free-promote');
  const prevented=await page.locator(selector).evaluate(input=>{
   input.value='IME title';
   const event=new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true});
   input.dispatchEvent(event);
   return event.defaultPrevented;
  });
  check(!prevented,`${selector}: composing Enter is not consumed`);
  if(selector==='#free-promote-name'){
   if(prevented)await page.waitForFunction(()=>document.querySelector('#free-promote-error').textContent.length>0);
   await page.locator('#free-promote-dialog').evaluate(dialog=>dialog.close());
  }
  await page.waitForFunction(()=>!document.querySelector('#free-title').disabled);
 }
 await freeMenuClick(page,'#free-generate-pdf');
 await page.locator('#free-pdf-content').fill('# IME regression\n\nSynthetic material only.');
 await page.locator('#free-pdf-title').fill('');
 await page.locator('#free-pdf-title').focus();
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#free-pdf-dialog')).opacity==='1');
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.imeSetComposition',{text:'Composed title',selectionStart:14,selectionEnd:14});
 await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await page.waitForFunction(()=>!document.querySelector('#free-pdf-save').disabled,undefined,{timeout:60000});
 const open=await page.locator('#free-pdf-dialog').evaluate(dialog=>dialog.open);
 const materials=await page.evaluate(async()=>(await import('./src/state.mjs')).S.workspace.materials);
 check(open,'Build a PDF remains open after real IME Enter');
 check(materials.length===0,'IME Enter does not create a PDF');
 if(open){
  check(await page.locator('#free-pdf-title').inputValue()==='Composed title','composition text is preserved');
  await cdp.send('Input.insertText',{text:'Composed title'});
 }
 if(process.env.IME_SHOT)await page.screenshot({path:process.env.IME_SHOT});
 console.log(`RESULT: dialog ${open?'open':'closed'}; PDFs created: ${materials.length}; runtime: ${runtime}`);
 if(open){
  await page.locator('#free-pdf-title').press('Enter');
  await page.waitForFunction(()=>!document.querySelector('#free-pdf-dialog').open,undefined,{timeout:60000});
  check(true,'ordinary Enter still saves and closes the PDF dialog');
 }
 assert.deepEqual(failures,[]);
}finally{
 await app.close();
}
