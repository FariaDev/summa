// node tests/offline-state-ui.mjs — sem internet na Mesa (#142), medido na
// janela. O estado vem de `navigator.onLine` mais os eventos `online`/`offline`
// do renderer. Cobre os critérios de aceite:
//   - sem rede, o indicador da caixa de mensagem diz "Sem internet", com região
//     ao vivo educada e sem repetir o anúncio a cada repintura;
//   - o rascunho continua editável e o que é local não é bloqueado;
//   - o Sobre/atualizações diz que está sem internet em vez do erro genérico;
//   - a rede voltando, os dois avisos somem sozinhos (sem clique).
// Grava capturas (offline e de volta) via MESA_REVIEW_SHOTS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
 reviewShot,screenshotDirectory,setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const out=screenshotDirectory('offline-state');
const shot=(page,name)=>reviewShot(page,out,name);

/* `setOffline` do Playwright muda `navigator.onLine` e dispara o evento. Se o
   Electron não propagar a emulação, o mesmo teste força o estado pela porta do
   navegador — o módulo lê exatamente essas duas coisas. */
async function network(app,page,offline){
 await app.context().setOffline(offline).catch(()=>{});
 if(await page.waitForFunction(value=>navigator.onLine===!value,offline,{timeout:1500}).then(()=>true,()=>false))return;
 await page.evaluate(value=>{
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>!value});
  window.dispatchEvent(new Event(value?'offline':'online'));
 },offline);
}
const indicatorText=page=>page.locator('#model-indicator .mi-text').textContent().then(text=>text.replace(/\s+/g,' ').trim());

await withArtifacts('offline-state',async ctx=>{
 const runtime=ctx.runtime=newRuntime('offline-state');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'Limites',xopp:''}}}});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(app,page,1440,900);
 await statusOnline(page);
 await freezeMotion(page);
 await layoutStable(page,'#prompt');
 /* A checagem do Sobre responde "Atualizada" no teste: o que se mede é a troca
    de estado offline × checagem, não a rede do processo principal. */
 await app.evaluate(({ipcMain})=>{
  ipcMain.removeHandler('update-check');
  ipcMain.handle('update-check',async()=>({status:'current',version:'1.2.0',notes:'',url:'',current:'1.2.0',checkedAt:Date.now()}));
 });
 const onlineText=await indicatorText(page);
 assert.notEqual(onlineText,'Sem internet','online, o indicador segue com o modelo e o esforço');
 assert.equal(await page.locator('#model-indicator[data-offline]').count(),0,'online não tem aviso de rede');
 assert.equal((await page.locator('#offline-live').textContent()).trim(),'','a região ao vivo nasce vazia');

 /* ---- sem rede: o indicador diz o estado e o rascunho continua vivo ---- */
 await network(app,page,true);
 await page.waitForSelector('#model-indicator[data-offline]',{timeout:5000});
 await page.waitForFunction(()=>document.querySelector('#model-indicator .mi-text')?.textContent.trim()==='Sem internet',undefined,{timeout:5000});
 assert.equal(await indicatorText(page),'Sem internet','o indicador mostra "Sem internet"');
 assert.match(await page.locator('#model-indicator').getAttribute('aria-label'),/^Sem internet\./,'o nome acessível diz o estado');
 const live=page.locator('#offline-live');
 assert.equal(await live.getAttribute('role'),'status');
 assert.equal(await live.getAttribute('aria-live'),'polite','o anúncio é educado');
 assert.equal((await live.textContent()).trim(),'Sem internet','o leitor de tela recebe o aviso uma vez');
 /* Aviso de exibição: nada bloqueia o campo. */
 const draft='rascunho que continua aqui sem rede';
 await page.locator('#prompt').fill(draft);
 assert.equal(await page.locator('#prompt').isEditable(),true,'o rascunho continua editável');
 assert.equal(await page.locator('#prompt').inputValue(),draft);
 /* Repinturas do indicador (evento de vínculo, troca de idioma) não reanunciam. */
 const announced=await page.evaluate(async()=>{
  const region=document.querySelector('#offline-live');
  let changes=0;
  const observer=new MutationObserver(records=>{changes+=records.length;});
  observer.observe(region,{childList:true,characterData:true,subtree:true});
  // espera fixa: o anúncio, se houver, chega no próximo quadro
  for(let i=0;i<3;i+=1){window.dispatchEvent(new Event('desk-tutor-link'));await new Promise(resolve=>setTimeout(resolve,30));}
  observer.disconnect();
  return changes;
 });
 assert.equal(announced,0,'o aviso não é anunciado em loop');
 await shot(page,'offline-1440x900.png');
 /* Em 900×650 o degrau da fileira não pode esconder a única pista da caixa. */
 await resizeWindow(app,page,900,650);
 await page.waitForFunction(()=>{
  const text=document.querySelector('#model-indicator .mi-text');
  return !!text&&text.getBoundingClientRect().width>0&&text.textContent.trim()==='Sem internet';
 },undefined,{timeout:5000});
 await shot(page,'offline-900x650.png');
 await resizeWindow(app,page,1440,900);
 await layoutStable(page,'#prompt');

 /* ---- Sobre/atualizações: em vez do erro genérico, a falta de rede ---- */
 await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#about').click();
 await page.waitForSelector('#about-dialog[open]');
 await page.waitForFunction(()=>/Sem internet/.test(document.querySelector('#about-update .update-text')?.textContent||''),undefined,{timeout:5000});
 assert.match(await page.locator('#about-update .update-text').textContent(),/Sem internet — não dá para verificar atualizações agora\./,'o Sobre diz que está sem internet');
 await setTheme(page,'light');

 /* ---- a rede volta: os avisos somem sozinhos, com o Sobre aberto ---- */
 await network(app,page,false);
 await page.waitForFunction(()=>!/Sem internet/.test(document.querySelector('#about-update .update-text')?.textContent||'')&&/Atualizada/.test(document.querySelector('#about-update .update-text')?.textContent||''),undefined,{timeout:20000});
 assert.equal(await page.locator('#about-dialog .dialog-close').isVisible(),true);
 await page.locator('#about-dialog .dialog-close').click();
 await page.waitForFunction(()=>!document.querySelector('#about-dialog').open);
 await page.waitForFunction(()=>!document.querySelector('#model-indicator').hasAttribute('data-offline'),undefined,{timeout:5000});
 assert.notEqual(await indicatorText(page),'Sem internet','o indicador volta ao modelo e ao esforço');
 assert.equal((await live.textContent()).trim(),'','o aviso some da região ao vivo');
 assert.equal(await page.locator('#prompt').inputValue(),draft,'o rascunho sobrevive à volta da rede');
 assert.equal(errors.length,0,`sem erros de página: ${errors.join(' | ')}`);
 await layoutStable(page,'#prompt');
 await shot(page,'voltou-1440x900.png');
 console.log('OFFLINE STATE UI PASSED: aviso no indicador e no Sobre, rascunho vivo, some sozinho.');
});
