// node tests/notebooks-plugin-estados-ui.mjs — estados do plugin MesaPagina no
// Sobre (rodada 2 do ciclo de design, N4/N5/N6/N11/N12): `different` vira
// "Atualizar plugin" e mostra a versão da pasta; `modified`, `foreign` e
// `symlink` pintam a recusa e não habilitam uma instalação fadada; `installed`
// mantém "Reinicie o Xournal++" na linha; o erro inline dispensa o toast e a
// ação duplicada da linha. IPC falso (components/install), como no
// notebooks-plugin-ui; nada é escrito na ~/.config real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
  freezeMotion,resizeWindow
} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const MODIFIED='A pasta MesaPagina foi modificada — não vou sobrescrevê-la.';
const NEXT={
  modified:'Renomeie ou remova a pasta MesaPagina e reabra o Sobre.',
  foreign:'Mova a pasta MesaPagina para outro lugar e reabra o Sobre.',
  symlink:'Troque o link por uma pasta comum e reabra o Sobre.',
};

const line=page=>page.evaluate(()=>{
  const box=document.querySelector('.component-plugin');
  const button=box?.querySelector('.component-plugin-install');
  const state=box?.querySelector('.component-plugin-state');
  const next=box?.querySelector('.component-plugin-next');
  const version=box?.querySelector('.component-plugin-version');
  const restart=box?.querySelector('.component-plugin-restart');
  const error=box?.querySelector('.component-run');
  return {
    state:state?.textContent?.trim()||'',
    stateId:state?.id||'',
    next:next?.hidden?'':(next?.textContent?.trim()||''),
    button:button?.textContent?.trim()||'',
    buttonHidden:button?.hidden??null,
    buttonRects:button?button.getClientRects().length:0,
    disabled:button?.disabled??null,
    ariaDisabled:button?.getAttribute('aria-disabled')||'',
    describedBy:button?.getAttribute('aria-describedby')||'',
    version:version?.textContent?.trim()||'',
    restart:restart?.textContent?.trim()||'',
    dot:box?.querySelector('.component-dot')?.getAttribute('data-state')||'',
    error:error?error.textContent?.replace(/\s+/g,' ').trim():'',
    errorId:error?.id||'',
    retry:error?.querySelector('.component-plugin-retry')?.textContent?.trim()||'',
  };
});

const toastAndDialog=page=>page.evaluate(()=>{
  const items=[...document.querySelectorAll('#toast .toast-item')].filter(el=>!el.classList.contains('out'));
  const last=items.at(-1);
  const dialog=document.querySelector('#about-dialog')?.getBoundingClientRect();
  const toast=last?.getBoundingClientRect();
  return {
    visible:items.length>0,
    text:last?.textContent?.trim()||'',
    overlap:!!dialog&&!!toast&&!(toast.right<=dialog.left||toast.left>=dialog.right||toast.bottom<=dialog.top||toast.top>=dialog.bottom),
  };
});

await withArtifacts('notebooks-plugin-estados',async ctx=>{
  const runtime=ctx.runtime=newRuntime('notebooks-plugin-estados-ui');
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

  await ctx.app.evaluate(({ipcMain})=>{
    globalThis.__pluginStatus='missing';
    globalThis.__pluginVersion='';
    globalThis.__pluginMode='ok';
    globalThis.__pluginCalls=0;
    ipcMain.removeHandler('components');
    ipcMain.handle('components',async()=>({rows:[
      {id:'xournal',label:'Xournal++',version:'1.3.8',state:'ok',
       plugin:{status:globalThis.__pluginStatus,version:globalThis.__pluginVersion}},
    ]}));
    ipcMain.removeHandler('update-check');
    ipcMain.handle('update-check',async()=>({status:'current',version:'0.0.0',notes:'',url:'',current:'0.0.0',checkedAt:Date.now()}));
    ipcMain.removeHandler('xournal-plugin-install');
    ipcMain.handle('xournal-plugin-install',async()=>{
      globalThis.__pluginCalls+=1;
      if(globalThis.__pluginMode==='fail')throw Error('Falha simulada ao instalar o plugin.');
      globalThis.__pluginStatus='installed';
      globalThis.__pluginVersion='1.3';
      return {ok:true};
    });
  });

  const setStatus=async(status,version='')=>{
    await ctx.app.evaluate((_electron,{status,version})=>{
      globalThis.__pluginStatus=status;
      globalThis.__pluginVersion=version;
    },{status,version});
    await page.locator('#components-refresh').click();
  };
  const waitState=async(texts)=>{
    await page.waitForFunction((list)=>list.includes(document.querySelector('.component-plugin-state')?.textContent?.trim()),texts,{timeout:15000});
  };

  await page.locator('#settings-menu .nav-trigger').click();
  await page.locator('#about').click();
  await page.waitForSelector('#about-dialog[open]');
  await page.locator('.component-plugin-install').waitFor({timeout:15000});
  await waitState(['não instalado']);

  /* O teste junta as falhas para que uma rodada no código antigo mostre todos
     os consertos que faltam, não só o primeiro. */
  const failures=[];
  const check=(ticket,label,ok,detail)=>{if(!ok)failures.push(`${ticket} ${label}: ${detail}`);};

  /* N4: `different` atualiza e diz a versão que já está na pasta. */
  await setStatus('different','1.2');
  await waitState(['instalado, versão diferente']);
  const different=await line(page);
  check('N4','different. ação',different.button==='Atualizar plugin',`a ação devia ser "Atualizar plugin", vi "${different.button}"`);
  check('N4','different. disabled',different.disabled===false,`a atualização devia estar disponível, vi disabled=${different.disabled}`);
  check('N4','different. version',different.version==='versão 1.2 na pasta',`a linha devia dizer "versão 1.2 na pasta", vi "${different.version}"`);
  check('A3','different. sem próximo passo',different.next==='',`só as recusas explicam o próximo passo, vi "${different.next}"`);

  /* Sem versão no estado do host, só o rótulo — sem linha vazia. */
  await setStatus('different','');
  const noVersion=await pollUntil(()=>line(page),row=>row.version==='',{what:'a versão da pasta sumir da linha do plugin'});
  check('N4','different sem versão',noVersion.version==='',`sem versão a linha devia sumir, vi "${noVersion.version}"`);

  /* N5: `modified` pinta a frase do catálogo e não deixa instalar por cima. */
  await setStatus('modified','1.2');
  await waitState([MODIFIED,'modificado']);
  const modified=await line(page);
  check('N5','modified. frase',modified.state===MODIFIED,`a linha devia dizer a recusa, vi "${modified.state}"`);
  check('N5','modified. disabled',modified.disabled===true,`o botão devia estar desabilitado, vi disabled=${modified.disabled}`);
  check('N5','modified. aria-disabled',modified.ariaDisabled==='true',`o botão devia ter aria-disabled=true, vi "${modified.ariaDisabled}"`);
  check('A3','modified. próximo passo',modified.next===NEXT.modified,`a linha devia dizer o próximo passo, vi "${modified.next}"`);
  check('A3','modified. botão escondido',modified.buttonHidden===true&&modified.buttonRects===0,`a ação devia sumir, vi hidden=${modified.buttonHidden} linhas=${modified.buttonRects}`);
  check('A3','modified. aria-describedby',modified.describedBy==='',`sem botão à vista, o aria-describedby devia sumir, vi "${modified.describedBy}"`);
  const callsBefore=await ctx.app.evaluate(()=>globalThis.__pluginCalls);
  await page.locator('.component-plugin-install').evaluate(el=>el.click());
  // espera fixa: o clique bloqueado não tem evento positivo; 250 ms é o prazo para um IPC indevido chegar
  await page.waitForTimeout(250);
  const callsAfter=await ctx.app.evaluate(()=>globalThis.__pluginCalls);
  check('N5','modified. clique',callsAfter===callsBefore,`um clique no botão bloqueado chegou ao IPC (${callsBefore} → ${callsAfter})`);

  /* N6: `foreign` e `symlink` seguem a mesma regra. */
  for(const status of ['foreign','symlink']){
    await setStatus(status,'');
    await page.waitForFunction(()=>{
      const text=document.querySelector('.component-plugin-state')?.textContent?.trim()||'';
      return text.startsWith('Já existe')||text.startsWith('O alvo é');
    },undefined,{timeout:15000});
    const refusal=await line(page);
    check('N6',`${status}. disabled`,refusal.disabled===true,`o botão devia estar desabilitado, vi disabled=${refusal.disabled}`);
    check('N6',`${status}. aria-disabled`,refusal.ariaDisabled==='true',`o botão devia ter aria-disabled=true, vi "${refusal.ariaDisabled}"`);
    check('A3',`${status}. próximo passo`,refusal.next===NEXT[status],`a linha devia dizer o próximo passo, vi "${refusal.next}"`);
    check('A3',`${status}. botão escondido`,refusal.buttonHidden===true&&refusal.buttonRects===0,`a ação devia sumir, vi hidden=${refusal.buttonHidden} linhas=${refusal.buttonRects}`);
    check('A3',`${status}. aria-describedby`,refusal.describedBy==='',`sem botão à vista, o aria-describedby devia sumir, vi "${refusal.describedBy}"`);
  }

  /* N11: `installed` mantém a instrução de reiniciar na própria linha. */
  await setStatus('installed','1.3');
  await waitState(['instalado']);
  const installed=await line(page);
  check('N11','installed. reinício',installed.restart==='Reinicie o Xournal++ para carregar o plugin.',`a linha devia manter o aviso de reiniciar, vi "${installed.restart}"`);
  check('N11','installed. ação',installed.button==='Reinstalar plugin'&&installed.disabled===false,`a ação devia continuar "Reinstalar plugin" habilitada, vi "${installed.button}" disabled=${installed.disabled}`);
  check('A3','installed. sem próximo passo',installed.next==='',`só as recusas explicam o próximo passo, vi "${installed.next}"`);

  /* N12: o erro inline é a ação única e persistente; sem toast redundante. */
  await setStatus('missing','');
  await waitState(['não instalado']);
  await ctx.app.evaluate(()=>{globalThis.__pluginMode='fail';});
  await page.locator('.component-plugin-install').click();
  const failed=await page.waitForFunction(()=>!!document.querySelector('.component-plugin-error'),undefined,{timeout:8000}).then(()=>line(page));
  check('N12','erro. ação da linha',failed.disabled===true,`com o erro inline visível a ação da linha devia estar desabilitada, vi disabled=${failed.disabled}`);
  check('N12','erro. explicação',!!failed.errorId&&failed.describedBy===failed.errorId,`o botão devia apontar para o erro (aria-describedby="${failed.describedBy}", id="${failed.errorId}")`);
  check('N12','erro. retry',failed.retry==='Tentar de novo',`o erro inline devia oferecer "Tentar de novo", vi "${failed.retry}"`);
  check('A3','erro. sem próximo passo',failed.next==='',`só as recusas explicam o próximo passo, vi "${failed.next}"`);
  check('A3','erro. botão à vista',failed.buttonHidden===false,`o botão só some nas três recusas, vi hidden=${failed.buttonHidden}`);
  const errorToast=await toastAndDialog(page);
  check('N12','erro. toast',!errorToast.visible,`o erro inline não devia repetir toast, vi "${errorToast.text}"`);

  /* N11 (toast): o retry instala; em 900×650 o aviso curto não cobre o Sobre. */
  await resizeWindow(ctx.app,page,900,650,{content:true});
  await ctx.app.evaluate(()=>{globalThis.__pluginMode='ok';});
  await page.locator('.component-plugin-retry').click();
  await waitState(['instalado']);
  const recovered=await line(page);
  check('N11','retry. reinício',recovered.restart==='Reinicie o Xournal++ para carregar o plugin.',`depois do retry a linha devia manter o aviso de reiniciar, vi "${recovered.restart}"`);
  await page.waitForFunction(()=>[...document.querySelectorAll('#toast .toast-item')].some(el=>!el.classList.contains('out')),undefined,{timeout:8000});
  const successToast=await toastAndDialog(page);
  check('N11','toast. sobreposição',!successToast.overlap,`o aviso "${successToast.text}" cobriu o diálogo do Sobre em 900×650`);

  assert.deepEqual(errors,[],'nenhum erro de página');
  assert.deepEqual(failures,[],`consertos das rodadas 2 e 3 ainda falham:\n${failures.join('\n')}`);
  console.log('notebooks-plugin-estados-ui: PASS — different atualiza e mostra a versão; modified/foreign/symlink recusam com o próximo passo e sem ação fadada; instalado mantém o reinício; erro sem toast nem ação duplicada; toast curto não cobre o Sobre.');
});
