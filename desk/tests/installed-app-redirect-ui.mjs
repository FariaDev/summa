/* #196: a cópia de código que a troca substituiu sai antes de abrir janela e
   abre o app instalado; com `SUMMA_NO_REDIRECT=1`, abre normal. O "app
   instalado" é um script que deixa um marcador, então o teste é só Linux/macOS
   (no macOS o `open` abriria o script no Terminal). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {DESK,newRuntime,deskEnv,launchDesk,withArtifacts} from './helpers.mjs';
import {pollUntil} from './waits.mjs';
const require=createRequire(import.meta.url);
const {recordInstalledApp}=require('../installed-app-redirect.cjs');

if(process.platform!=='linux'){console.log('installed-app-redirect-ui: SKIP — o app instalado falso é um script sh aberto direto');process.exit(0);}

/** Registro da troca apontando para um script que só grava o marcador. */
function seedSwitch(runtime){
 const marker=path.join(runtime,'installed-opened');
 const appPath=path.join(runtime,'Summa-x86_64.AppImage');
 fs.writeFileSync(appPath,`#!/bin/sh\necho opened > ${JSON.stringify(marker)}\n`,{mode:0o755});
 recordInstalledApp({runtime,deskDir:DESK,target:'appimage',appPath,version:'1.4.0'});
 return marker;
}

{
 const runtime=newRuntime('installed-app-redirect');
 const marker=seedSwitch(runtime);
 const child=spawn(require('electron'),['--disable-gpu',path.join(DESK,'main.cjs')],{cwd:DESK,env:deskEnv(runtime,{SUMMA_REDIRECT_IN_TEST:'1'}),stdio:'ignore'});
 const exited=once(child,'exit');
 const timer=setTimeout(()=>child.kill('SIGKILL'),30000);
 const [code]=await exited;
 clearTimeout(timer);
 assert.equal(code,0,'a cópia substituída sai sozinha, sem janela');
 await pollUntil(()=>fs.existsSync(marker),Boolean,{what:'o app instalado aberto'});
 assert.match(fs.readFileSync(path.join(runtime,'desk.log'),'utf8'),/cópia substituída pelo app instalado/);
 assert.equal(fs.existsSync(path.join(runtime,'desk.json')),false,'nada da janela chegou a rodar');
 fs.rmSync(runtime,{recursive:true,force:true});
}

await withArtifacts('installed-app-redirect',async ctx=>{
 const runtime=ctx.runtime=newRuntime('installed-app-redirect-off');
 const marker=seedSwitch(runtime);
 ctx.app=await launchDesk({runtime,env:{SUMMA_REDIRECT_IN_TEST:'1',SUMMA_NO_REDIRECT:'1'}});
 const page=await ctx.app.firstWindow();
 await page.waitForSelector('#settings-menu .nav-trigger');
 assert.equal(fs.existsSync(marker),false,'SUMMA_NO_REDIRECT abre esta cópia');
});
console.log('installed-app-redirect-ui: PASS — cópia substituída abre o app instalado e sai sem janela; SUMMA_NO_REDIRECT abre normal');
