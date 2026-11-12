/* #113 na janela: o `ler_pdf` com marcas devolve a página marcada NO CHAT do
   aluno, e ela continua lá ao reabrir a conversa. O OpenCode é o fake, mas o
   MCP, a ponte, o render do PDF e o descritor são reais; o PDF é sintético. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launchDesk,withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,statusOnline,tinyPdfPages} from './helpers.mjs';
import {decodePng,pixelAtFraction} from './png-pixels.mjs';

const shotPath=process.env.MESA_113_SHOT||'';
const MARKS=[{forma:'destaque',x:0.1,y:0.1,largura:0.4,altura:0.2}];

async function waitImage(page){
 const image=page.locator('#messages .message:not(.user) .body img.shot').last();
 await image.waitFor({state:'visible',timeout:60000});
 await image.evaluate(img=>img.complete&&img.naturalWidth>0?null:new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;}));
 return image;
}

await withArtifacts('tutor-pdf-mark-ui',async ctx=>{
 const runtime=ctx.runtime=newRuntime('tutor-pdf-mark');
 const course=seedCourse(runtime,'calc');
 const pdf=path.join(course,'Aula.pdf');
 fs.writeFileSync(pdf,tinyPdfPages(2));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
 const call={name:'ler_pdf',input:{caminho:pdf,pagina:1,marcas:MARKS}};
 ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_MCP_CALL:JSON.stringify(call)}});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await page.evaluate(async()=>{const {S,connect}=await import('./src/state.mjs');window.__mesaState=S;if(!S.connected)await connect();});
 await page.waitForFunction(()=>window.__mesaState.connected&&!window.__mesaState.busy);
 await page.locator('#prompt').fill('Aponte o trecho importante da página 1.');
 await page.locator('#send').click();

 const image=await waitImage(page);
 assert.match(await image.getAttribute('alt'),/Página 1 de Aula\.pdf com marcas do tutor/,'o alt diz a página e o PDF');
 const src=await image.getAttribute('src');
 assert.match(src,/^data:image\/png;base64,/,'o src é gerado pela Mesa, nunca HTML do modelo');
 const png=decodePng(src.slice(src.indexOf(',')+1));
 const pixel=pixelAtFraction(png,0.3,0.2);
 assert.ok(pixel.r>230&&pixel.g>140&&pixel.g<195&&pixel.b>190,`a marca do tutor está na imagem: ${JSON.stringify(pixel)}`);
 assert.ok(await page.locator('#messages .message:not(.user) .body img.shot').count()>=1,'a imagem está no balão do tutor, não só no detalhe da ferramenta');
 if(shotPath){fs.mkdirSync(path.dirname(shotPath),{recursive:true});await page.screenshot({path:shotPath});}

 /* Reabrir a conversa: o descritor é a fonte do histórico e a imagem precisa
    continuar no mesmo turno. */
 await page.reload();
 await statusOnline(page);
 await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');window.__mesaState=S;});
 await page.waitForFunction(()=>window.__mesaState.connected&&!window.__mesaState.busy,undefined,{timeout:60000});
 const reopened=await waitImage(page);
 assert.match(await reopened.getAttribute('alt'),/Página 1 de Aula\.pdf com marcas do tutor/,'o alt sobrevive ao reabrir');
 assert.match(await reopened.getAttribute('src'),/^data:image\/png;base64,/,'a imagem sobrevive ao reabrir');
 assert.deepEqual(errors,[]);
});
console.log('tutor-pdf-mark-ui: PASS — ler_pdf com marcas mostra a página no chat e ela continua depois de reabrir.');
