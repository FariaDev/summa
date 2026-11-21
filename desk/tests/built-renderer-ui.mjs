/* Build do electron-vite (#43 fase 2): `npm run build` grava o renderer em
   `out/renderer/` e o main só o carrega quando o electron-vite abriu o app
   (`npm run preview`, NODE_ENV_ELECTRON_VITE=production). Aqui o teste faz o
   build, abre a Mesa desse jeito e confere que a página é a do build, que a
   Mesa monta e que nenhum recurso falta (folha, worker, fonte). */
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DESK,newRuntime,launchDesk,withArtifacts} from './helpers.mjs';

const cli=path.join(DESK,'node_modules','electron-vite','bin','electron-vite.js');
const build=spawnSync(process.execPath,[cli,'build'],{cwd:DESK,encoding:'utf8'});
assert.equal(build.status,0,`electron-vite build falhou:\n${build.stdout}\n${build.stderr}`);

await withArtifacts('built-renderer',async(ctx)=>{
 ctx.runtime=newRuntime('built-renderer');
 const missing=[];
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{NODE_ENV_ELECTRON_VITE:'production'}});
 const page=await ctx.app.firstWindow();
 page.on('console',msg=>{if(msg.type()==='error')missing.push(msg.text());});
 page.on('requestfailed',req=>missing.push(`${req.url()} ${req.failure()?.errorText||''}`));
 await page.waitForSelector('#messages',{state:'attached',timeout:30000});
 await page.waitForLoadState('load');
 const url=page.url();
 assert.ok(url.replace(/\\/g,'/').endsWith('/out/renderer/index.html'),`a Mesa abriu ${url}, não o build`);
 const look=await page.evaluate(()=>({
  scripts:[...document.querySelectorAll('script[type="module"]')].map(s=>s.getAttribute('src')),
  materials:[...document.querySelectorAll('link[data-material-model]')].filter(l=>l.sheet).length,
  katex:[...document.styleSheets].some(s=>{try{return [...s.cssRules].some(r=>String(r.cssText).includes('.katex'));}catch{return false;}}),
 }));
 assert.ok(look.scripts.every(src=>/assets\/index-[\w-]+\.js$/.test(src||'')),`entrada do build esperada, veio ${look.scripts.join(', ')}`);
 assert.equal(look.materials,6,'as folhas de modelo de material ficam ligadas por caminho (vite-ignore) e carregam do build');
 assert.ok(look.katex,'o CSS do KaTeX entra no bundle');
 await page.waitForTimeout(1500);// espera fixa: "nada falta em 1,5 s" — worker e folhas tardias têm tempo de pedir o recurso
 assert.deepEqual(missing.filter(line=>/ERR_FILE_NOT_FOUND|Failed to load|net::/.test(line)),[],'recurso faltando no build');
 console.log('BUILD PASSED: a Mesa abre do out/renderer com entrada única, folhas de material e KaTeX, sem recurso faltando.');
});
