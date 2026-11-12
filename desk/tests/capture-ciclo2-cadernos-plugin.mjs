// Blocos de captura do plugin MesaPagina (#133), parte "Cadernos" do ciclo 2:
// não instalado, instalando, instalado (+ aviso de reiniciar nos dois temas e
// em 900×650), erro inline e os estados do `pluginStatus` que a rodada 1
// deixou sem captura (`different`, `modified`, `foreign`, `symlink`). O
// "instalado" é uma instalação de verdade no HOME temporário do teste; os
// estados de recusa vêm do IPC `components` falso (o mesmo molde de
// tests/notebooks-plugin-ui.mjs), sem tocar no ~/.config real. Os dois blocos
// de teclado (`teclado-plugin-instalar`/`-fechar`) fecham as 10 bases que o
// inventário lista (N4/N5/N6/N11/N12).
import {resizeWindow,setTheme} from './helpers.mjs';
import {
 capture,series,openAbout,pluginLine,setComponentsPluginStatus,
 keyboardShots,focusKeyboard,
} from './capture-ciclo2-cadernos-kit.mjs';
import {seedLibrary,boot} from './capture-ciclo2-cadernos-kit.mjs';

const PT={missing:'não instalado',installed:'instalado',installing:'Instalando…',reinstall:'Reinstalar plugin',
 different:'instalado, versão diferente',modified:'A pasta MesaPagina foi modificada — não vou sobrescrevê-la.',
 foreign:'Já existe uma pasta MesaPagina de outro autor — não vou tocar nela.',
 symlink:'O alvo é um link simbólico — recuso seguir links.',
 install:'Instalar plugin da página',update:'Atualizar plugin',retry:'Tentar de novo',
 restart:'Reinicie o Xournal++ para carregar o plugin.',version:'versão {version} na pasta'};
const EN={missing:'not installed',installed:'installed',installing:'Installing…',reinstall:'Reinstall plugin',
 different:'installed, different version',modified:'The MesaPagina folder was modified — I won’t overwrite it.',
 foreign:'A MesaPagina folder from another author already exists — I won’t touch it.',
 symlink:'The target is a symbolic link — I refuse to follow links.',
 install:'Install the page plugin',update:'Update plugin',retry:'Try again',
 restart:'Restart Xournal++ to load the plugin.',version:'version {version} in the folder'};
const DOTS={different:'new',modified:'warn',foreign:'warn',symlink:'warn'};

const toastVisible=page=>page.waitForFunction(()=>[...document.querySelectorAll('#toast .toast-item')].some(el=>!el.classList.contains('out')),undefined,{timeout:8000});
const toastGone=page=>page.waitForFunction(()=>![...document.querySelectorAll('#toast .toast-item')].some(el=>!el.classList.contains('out')),undefined,{timeout:12000});
const langOf=page=>page.evaluate(()=>document.documentElement.lang==='en'?'en':'pt');

async function expectLine(page,{state,button,disabled,busy,spinner,dot,error,retry,version,restart}){
 const seen=await pluginLine(page);
 const lang=await langOf(page),labels=lang==='en'?EN:PT;
 if(state&&seen.state!==labels[state])throw Error(`estado do plugin: esperava "${labels[state]}", vi "${seen.state}"`);
 if(button&&seen.button!==labels[button])throw Error(`botão do plugin: esperava "${labels[button]}", vi "${seen.button}"`);
 if(disabled!==undefined&&seen.disabled!==disabled)throw Error(`botão do plugin: esperava disabled=${disabled}, vi ${seen.disabled}`);
 if(disabled!==undefined&&seen.ariaDisabled!==String(disabled))throw Error(`botão do plugin: esperava aria-disabled=${disabled}, vi "${seen.ariaDisabled}"`);
 if(busy!==undefined&&seen.busy!==String(busy))throw Error(`botão do plugin: esperava aria-busy=${busy}, vi "${seen.busy}"`);
 if(spinner!==undefined&&seen.spinner!==spinner)throw Error(`botão do plugin: spinner=${seen.spinner}, esperava ${spinner}`);
 if(dot&&seen.dotState!==dot)throw Error(`ponto do plugin: esperava "${dot}", vi "${seen.dotState}"`);
 if(error&&!seen.error.includes(error))throw Error(`erro inline: esperava "${error}", vi "${seen.error}"`);
 if(retry&&seen.retry!==labels.retry)throw Error(`retry do plugin: esperava "${labels.retry}", vi "${seen.retry}"`);
 if(version&&seen.version!==labels.version.replace('{version}',version))throw Error(`versão na pasta: esperava "${labels.version.replace('{version}',version)}", vi "${seen.version}"`);
 if(restart&&seen.restart!==labels.restart)throw Error(`aviso de reiniciar: esperava "${labels.restart}", vi "${seen.restart}"`);
 return seen;
}

/** Roda os blocos do plugin no script principal. @param {(tag:string,run:()=>Promise<void>)=>Promise<void>} block */
export async function runPluginBlocks(block){
 await block('plugin-nao-instalado',async()=>{
  const {runtime}=seedLibrary('ciclo2-plugin-off');
  const {app,page}=await boot(runtime);
  try{
   await openAbout(page);
   await series(page,app,{base:'plugin-nao-instalado',region:'.component-plugin',prepare:()=>openAbout(page),check:()=>expectLine(page,{state:'missing',button:'install',disabled:false,dot:'muted'})});
  } finally {await app.close();}
 });

 await block('plugin-instalando',async()=>{
  const {runtime}=seedLibrary('ciclo2-plugin-flight');
  const {app,page}=await boot(runtime);
  try{
   await app.evaluate(({ipcMain})=>{
    globalThis.__c2Pending=false;
    globalThis.__c2Release=null;
    ipcMain.removeHandler('xournal-plugin-install');
    ipcMain.handle('xournal-plugin-install',()=>{
     globalThis.__c2Pending=true;
     return new Promise(resolve=>{globalThis.__c2Release=()=>{globalThis.__c2Pending=false;resolve({ok:true});};});
    });
   });
   const installing=async()=>{
    const pending=await app.evaluate(()=>globalThis.__c2Pending===true);
    if(!pending)throw Error('a instalação simulada não está em voo');
    await expectLine(page,{state:'missing',button:'installing',disabled:true,busy:true,spinner:true,dot:'busy'});
   };
   await series(page,app,{
    base:'plugin-instalando',region:'.component-plugin',
    prepare:async()=>{
     await openAbout(page);
     if(!(await app.evaluate(()=>globalThis.__c2Pending===true)))await page.locator('.component-plugin-install').click();
    },
    check:installing,
   });
   await app.evaluate(()=>globalThis.__c2Release?.());
  } finally {await app.close();}
 });

 await block('plugin-instalado',async()=>{
  const {runtime}=seedLibrary('ciclo2-plugin-on');
  const {app,page}=await boot(runtime);
  try{
   /* Aviso de reiniciar nos dois temas e nos dois tamanhos: cada variante
      reinstala de verdade para o toast nascer de novo. A linha em si (N11)
      mantém "Reinicie o Xournal++ para carregar o plugin." depois do toast. */
   for(const [width,height] of [[1440,900],[900,650]]){
    await resizeWindow(app,page,width,height);
    for(const theme of ['light','dark']){
     await setTheme(page,theme);
     await openAbout(page);
     await page.locator('.component-plugin-install').click();
     await page.waitForFunction(()=>document.querySelector('.component-plugin-state')?.textContent==='instalado',undefined,{timeout:20000});
     await expectLine(page,{state:'installed',button:'reinstall',disabled:false,busy:false,dot:'ok',restart:'restart'});
     await toastVisible(page);
     await capture(page,`plugin-instalado-aviso-${theme}-${width}x${height}`,'.component-plugin');
     await toastGone(page);
    }
   }
   await series(page,app,{base:'plugin-instalado',region:'.component-plugin',prepare:()=>openAbout(page),check:()=>expectLine(page,{state:'installed',button:'reinstall',disabled:false,busy:false,dot:'ok',restart:'restart'})});
  } finally {await app.close();}
 });

 await block('plugin-erro',async()=>{
  const {runtime}=seedLibrary('ciclo2-plugin-error');
  const {app,page}=await boot(runtime);
  try{
   await app.evaluate(({ipcMain})=>{
    globalThis.__c2Error='Falha simulada ao instalar o plugin.';
    ipcMain.removeHandler('xournal-plugin-install');
    ipcMain.handle('xournal-plugin-install',async()=>{throw Error(globalThis.__c2Error);});
   });
   await series(page,app,{
    base:'plugin-erro',region:'.component-plugin',
    prepare:async()=>{
     const error=await page.evaluate(()=>document.documentElement.lang==='en'?'Simulated plugin install failure.':'Falha simulada ao instalar o plugin.');
     await app.evaluate((_electron,message)=>{globalThis.__c2Error=message;},error);
     await openAbout(page);
     /* O erro deixa a ação da linha desligada (N12): a repetição é o próprio
        "Tentar de novo". */
     if(await page.locator('.component-plugin-retry').count())await page.locator('.component-plugin-retry').click();
     else await page.locator('.component-plugin-install').click();
     await page.locator('.component-plugin-retry').waitFor({timeout:8000});
    },
    check:async()=>{
     const lang=await langOf(page);
     const error=lang==='en'?'Simulated plugin install failure.':'Falha simulada ao instalar o plugin.';
     await expectLine(page,{state:'missing',button:'install',disabled:true,busy:false,dot:'muted',error,retry:true});
     const role=await page.locator('.component-plugin-error').getAttribute('role');
     if(role!=='alert')throw Error(`o erro inline devia ser role=alert, vi "${role}"`);
     const toast=await page.evaluate(()=>[...document.querySelectorAll('#toast .toast-item')].some(el=>!el.classList.contains('out')));
     if(toast)throw Error('o toast de erro não devia existir: o erro inline é a única mensagem');
    },
   });
  } finally {await app.close();}
 });

 await block('plugin-estados',async()=>{
  const {runtime}=seedLibrary('ciclo2-plugin-status');
  const {app,page}=await boot(runtime);
  try{
   /* N4: `different` atualiza e diz a versão da pasta; N5/N6: as recusas
      deixam a linha desligada, sem oferecer uma instalação fadada. */
   const expected={
    different:{state:'different',button:'update',disabled:false,dot:DOTS.different,version:'1.0.0'},
    modified:{state:'modified',button:'install',disabled:true,dot:DOTS.modified},
    foreign:{state:'foreign',button:'install',disabled:true,dot:DOTS.foreign},
    symlink:{state:'symlink',button:'install',disabled:true,dot:DOTS.symlink},
   };
   for(const status of ['different','modified','foreign','symlink']){
    await setComponentsPluginStatus(app,status,status==='different'?'1.0.0':'');
    await series(page,app,{
     base:`plugin-${status}`,region:'.component-plugin',
     prepare:async()=>{await setComponentsPluginStatus(app,status,status==='different'?'1.0.0':'');await openAbout(page);},
     check:()=>expectLine(page,expected[status]),
    });
   }
  } finally {await app.close();}
 });

 await block('plugin-teclado',async()=>{
  const {runtime}=seedLibrary('ciclo2-plugin-teclado');
  const {app,page}=await boot(runtime);
  try{
   const routeInstall=async()=>{
    await openAbout(page);
    await focusKeyboard(page,'.component-plugin-install','botão Instalar plugin da página');
   };
   await keyboardShots(page,app,{base:'teclado-plugin-instalar',region:'#about-dialog',prepare:routeInstall});
   const routeClose=async()=>{
    await openAbout(page);
    await focusKeyboard(page,'#about-dialog .dialog-close','fechar do Sobre');
   };
   await keyboardShots(page,app,{base:'teclado-plugin-fechar',region:'#about-dialog',prepare:routeClose});
  } finally {await app.close();}
 });
}
