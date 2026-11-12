// node tests/notebooks-plugin-ui.mjs — linha do plugin MesaPagina no Sobre
// (rodada 1 do ciclo de design, F1/F2/F3/F23): "instalando" com aria-busy,
// botão desabilitado, rótulo e spinner; "instalado" vira "Reinstalar plugin";
// erro inline na própria linha com "Tentar de novo" e sem toast (N12); e o
// ponto de status das outras linhas do painel. IPC falso (components/install),
// como no capture-ciclo2; nada é escrito na ~/.config real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
  freezeMotion,resizeWindow
} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const plugin=page=>page.evaluate(()=>{
  const box=document.querySelector('.component-plugin');
  const button=box?.querySelector('.component-plugin-install');
  const dot=box?.querySelector('.component-dot');
  const error=box?.querySelector('.component-run');
  return {
    state:box?.querySelector('.component-plugin-state')?.textContent?.trim()||'',
    button:button?.textContent?.trim()||'',
    disabled:button?.disabled??null,
    busy:button?.getAttribute('aria-busy')||'',
    spinner:!!button?.querySelector('.ts-dots'),
    dotState:dot?.getAttribute('data-state')||'',
    dotColor:dot?getComputedStyle(dot).backgroundColor:null,
    error:error?error.textContent?.replace(/\s+/g,' ').trim():'',
    errorRole:error?.getAttribute('role')||'',
    retry:error?.querySelector('.component-plugin-retry')?.textContent?.trim()||'',
  };
});

await withArtifacts('notebooks-plugin',async ctx=>{
  const runtime=ctx.runtime=newRuntime('notebooks-plugin-ui');
  const course=seedCourse(runtime,'calc');
  const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
  writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
  ctx.app=await launchDesk({runtime});
  const page=await ctx.app.firstWindow();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await resizeWindow(ctx.app,page,1440,900,{content:true});
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas',{timeout:30000});

  /* O painel e a instalação são falsos: o estado vem de `__pluginStatus` e o
     clique só resolve quando o teste libera. Nenhum arquivo é tocado. */
  await ctx.app.evaluate(({ipcMain})=>{
    globalThis.__pluginStatus='missing';
    globalThis.__pluginMode='hold';
    globalThis.__pluginCalls=0;
    globalThis.__pluginRelease=null;
    ipcMain.removeHandler('components');
    ipcMain.handle('components',async()=>({rows:[
      {id:'xournal',label:'Xournal++',version:'1.3.8',state:'ok',plugin:{status:globalThis.__pluginStatus}},
    ]}));
    ipcMain.removeHandler('xournal-plugin-install');
    ipcMain.handle('xournal-plugin-install',async()=>{
      globalThis.__pluginCalls+=1;
      if(globalThis.__pluginMode==='fail')throw Error('Falha simulada ao instalar o plugin.');
      if(globalThis.__pluginMode==='hold')await new Promise(resolve=>{globalThis.__pluginRelease=resolve;});
      globalThis.__pluginStatus='installed';
      return {ok:true};
    });
  });

  await page.locator('#settings-menu .nav-trigger').click();
  await page.locator('#about').click();
  await page.waitForSelector('#about-dialog[open]');
  await page.locator('.component-plugin-install').waitFor({timeout:15000});
  await page.waitForFunction(()=>document.querySelector('.component-plugin-state')?.textContent==='não instalado',undefined,{timeout:15000});

  /* F23: a linha do plugin usa o mesmo ponto de status das outras linhas. */
  const missing=await plugin(page);
  assert.equal(missing.dotState,'muted','não instalado usa o ponto neutro, como as outras linhas (F23)');
  assert.equal(missing.dotColor,'rgb(111, 111, 111)','o ponto neutro usa --faint no claro (F23)');

  /* F1: durante o pedido em voo, o botão sai do estado clicável e diz o que faz. */
  await page.locator('.component-plugin-install').click();
  const installing=await pollUntil(()=>plugin(page),value=>value.busy==='true',{what:'o aria-busy do "instalando" (F1)'});
  assert.equal(installing.disabled,true,'durante a instalação o botão fica desabilitado (F1)');
  assert.equal(installing.button,'Instalando…','o rótulo vira "Instalando…" (F1)');
  assert.equal(installing.spinner,true,'há um indicador visual de progresso (F1)');
  assert.equal(installing.state,'não instalado','o estado do host segue honesto durante o voo (F1)');
  assert.equal(installing.dotState,'busy','o ponto fica em "ocupado" durante a instalação (F23)');
  await page.locator('.component-plugin-install').click({force:true});
  assert.equal(await ctx.app.evaluate(()=>globalThis.__pluginCalls),1,'clique repetido durante a instalação não chega ao IPC (F1)');
  await ctx.app.evaluate(()=>globalThis.__pluginRelease?.());
  const installed=await pollUntil(()=>plugin(page),value=>value.state==='instalado',{what:'o estado "instalado" depois do pedido (F2)'});

  /* F2: instalado não oferece a mesma ação "Instalar" de novo. */
  assert.equal(installed.button,'Reinstalar plugin','com o plugin instalado a ação vira "Reinstalar plugin" (F2)');
  assert.equal(installed.disabled,false,'"Reinstalar" continua disponível (F2)');
  assert.equal(installed.busy,'false','terminada a instalação, aria-busy volta a false (F1)');
  assert.equal(installed.dotState,'ok','instalado usa o ponto verde das linhas em dia (F23)');
  assert.equal(installed.dotColor,'rgb(36, 161, 72)','o ponto verde é --success no claro (F23)');

  /* F3: o erro do plugin aparece na própria linha, com o motivo e o retry. */
  await ctx.app.evaluate(()=>{globalThis.__pluginMode='fail';});
  await page.locator('.component-plugin-install').click();
  await page.locator('.component-plugin-retry').waitFor({timeout:8000});
  const failed=await pollUntil(()=>plugin(page),value=>value.error.includes('Falha simulada'),{what:'o erro inline da linha do plugin (F3)'});
  assert.equal(failed.errorRole,'alert','o erro inline é anunciado como alerta (F3)');
  assert.equal(failed.retry,'Tentar de novo','o erro inline oferece "Tentar de novo" (F3)');
  assert.match(failed.error,/Falha simulada ao instalar o plugin\./,'o erro inline traz o motivo (F3)');
  await ctx.app.evaluate(()=>{globalThis.__pluginMode='hold';});
  await page.locator('.component-plugin-retry').click();
  const retrying=await pollUntil(()=>plugin(page),value=>value.busy==='true',{what:'o retry repetir a instalação (F3)'});
  assert.equal(retrying.error,'','tentar de novo limpa o erro enquanto o pedido está em voo (F3)');
  await ctx.app.evaluate(()=>{globalThis.__pluginRelease?.();});
  const recovered=await pollUntil(()=>plugin(page),value=>value.state==='instalado'&&value.busy==='false',{what:'o estado instalado depois do retry (F3)'});
  assert.equal(recovered.error,'','o erro inline some quando a instalação dá certo (F3)');
  assert.equal(recovered.button,'Reinstalar plugin','depois do retry a ação volta a "Reinstalar plugin" (F2)');

  assert.deepEqual(errors,[],'nenhum erro de página');
  console.log('notebooks-plugin-ui: PASS — instalando com aria-busy/spinner/disabled, instalado vira "Reinstalar", erro inline com retry e ponto de status coerente.');
});
