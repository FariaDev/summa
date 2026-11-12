// node tests/xournal-plugin-ui.mjs — plugin MesaPagina instalado pela Mesa (#133),
// medido na janela. Sobe a Mesa com HOME apontando para o runtime temporário do
// teste (o helpers.mjs já faz isso em deskEnv), abre o Sobre e clica em
// "Instalar plugin da página" na linha do Xournal++: o estado vira "instalado"
// e os arquivos ficam em .config/xournalpp/plugins/MesaPagina do temporário —
// NUNCA na ~/.config/xournalpp real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
 freezeMotion,resizeWindow
} from './helpers.mjs';
import {nextFrames} from './waits.mjs';

const pluginDir=runtime=>path.join(runtime,'.config','xournalpp','plugins','MesaPagina');

await withArtifacts('xournal-plugin',async ctx=>{
 const runtime=ctx.runtime=newRuntime('xournal-plugin-ui');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 assert.equal(fs.existsSync(pluginDir(runtime)),false,'antes: nada instalado no temporário');
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(ctx.app,page,1440,900,{content:true});
 await statusOnline(page);
 await freezeMotion(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});

 await page.locator('#settings-menu .nav-trigger').click();
 await page.locator('#about').click();
 await page.waitForSelector('#about-dialog[open]');
 await page.waitForSelector('.component-plugin-install',{timeout:15000});
 assert.equal(await page.locator('.component-plugin-state').textContent(),'não instalado');
 assert.equal(await page.locator('.component-plugin-install').textContent(),'Instalar plugin da página');

 await page.locator('.component-plugin-install').click();
 await page.waitForFunction(()=>document.querySelector('.component-plugin-state')?.textContent==='instalado',undefined,{timeout:15000});
 await nextFrames(page,2);

 const dir=pluginDir(runtime);
 const files=fs.readdirSync(dir).sort();
  assert.deepEqual(files,['.mesa-instalado.json','README.md','converter.lua','main.lua','mesa-runtime.json','plugin.ini','ponte.lua','tamanho.lua']);
 assert.match(fs.readFileSync(path.join(dir,'plugin.ini'),'utf8'),/^enabled=true$/m,'a cópia nasce ligada');
 const repoIni=fs.readFileSync(path.resolve(import.meta.dirname,'..','src','xournal-plugins','MesaPagina','plugin.ini'),'utf8');
 assert.match(repoIni,/^enabled=false$/m,'o repo segue desligado');
 assert.deepEqual(errors,[],'sem erro de página');
  console.log('xournal-plugin-ui: PASS — estado "não instalado", clique instala, estado "instalado" e 7 arquivos no temporário.');
});
