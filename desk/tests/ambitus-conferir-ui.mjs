// node tests/ambitus-conferir-ui.mjs — o Conferir pela ponte do Ambitus, na janela (Electron real,
// "Ambitus falso" que faz o long-poll e responde com um PNG; nenhuma captura de tela).
// Cobre: sem Ambitus o Conferir fica como sempre (sem captura de janela, desligado); com o Ambitus
// pendurado ele liga mesmo no Linux e passa a dizer Ambitus (botão, dica, aviso); no tutor a página
// entra na bandeja como "<caderno> — pág. N"; no chat lateral um caderno salvo vira cartão (miniatura
// = a imagem, caminho escondido) e um sem arquivo vira imagem; sem página aberta o Ambitus diz
// "sem-pagina" e a janela avisa; o Ambitus que some desliga o Conferir de novo.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,seedNativeSession,tinyPdf,statusOnline,resizeWindow,PLOT_PNG} from './helpers.mjs';
import {startFakeAmbitus} from './fake-ambitus.mjs';

const XML=`<?xml version="1.0" standalone="no"?><xournal version="4"><page width="589" height="845"><background type="solid" color="#ffffffff" style="lined"/><layer><text fn="" size="12" color="#0013ff" font="Sans" x="100" y="100">Primeira</text></layer></page></xournal>`;
const NATIVE_CAPTURE=process.platform==='win32'||process.platform==='darwin';

await withArtifacts('ambitus-conferir',async ctx=>{
 const runtime=ctx.runtime=newRuntime('ambitus-conferir'),course=seedCourse(runtime,'Test');
 const pdf=path.join(course,'Limites.pdf');
 fs.writeFileSync(pdf,tinyPdf('Exercise',2));
 const notebook=path.join(course,'Limites — aula 3.xopp');
 fs.writeFileSync(notebook,gzipSync(XML));
 const current=seedNativeSession(runtime,[{role:'user',content:[{type:'text',text:'conversa atual'}]}],{courseId:'Test',preview:'conversa atual'});
 writeDeskJson(runtime,{session:current,courseId:'Test',courseStates:{Test:{session:current,pdfs:[{path:pdf,page:1,zoom:1,scrollX:0,scrollY:0}],sessions:[{path:current,started:Date.now(),preview:'conversa atual'}]}}});
 writeConfigJson(runtime,{vaultPath:runtime,runtimePath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 await resizeWindow(ctx.app,page,1440,900);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);

 /* ---- 1. Sem Ambitus: o Conferir é o de sempre ---- */
 const checkState=()=>page.evaluate(()=>{const el=document.querySelector('#check');return {disabled:el.disabled,label:el.querySelector('.label-full')?.textContent.trim()};});
 const before=await checkState();
 assert.match(before.label,/Xournal\+\+/,'sem Ambitus o botão diz Xournal++');
 if(!NATIVE_CAPTURE)assert.equal(before.disabled,true,'no Linux, sem Ambitus, o Conferir fica indisponível como hoje');

 /* ---- 2. O Ambitus se pendura: liga o Conferir e o nome muda ---- */
 let answer={caminho:notebook,pagina:2,nome:'Limites — aula 3',png:PLOT_PNG};
 const ambitus=startFakeAmbitus({runtime,page:()=>answer});
 await page.waitForFunction(()=>{const el=document.querySelector('#check');return el&&!el.disabled&&/Ambitus/.test(el.textContent);},undefined,{timeout:15000});
 assert.match((await checkState()).label,/^Conferir Ambitus$/);
 assert.match(await page.locator('#check').getAttribute('title'),/página aberta no Ambitus/,'a dica fala da página, não da janela');

 /* ---- 3. Tutor: a página entra na bandeja como "<caderno> — pág. N" ---- */
 await page.locator('#attach').click();
 await page.locator('#check').click();
 await page.waitForSelector('#attachments .attachment img',{timeout:15000});
 const alt=await page.locator('#attachments .attachment img').first().getAttribute('alt');
 assert.match(alt,/Limites — aula 3 — pág\. 2/,'o anexo se chama "<caderno> — pág. N"');
 await page.waitForFunction(()=>/Página do Ambitus anexada/.test(document.body.innerText),undefined,{timeout:5000});
 assert.equal(ambitus.asked.length,1,'um pedido, uma página');
 await page.locator('#attachments .attachment-remove').first().click();

 /* ---- 4. Chat lateral: caderno salvo vira cartão (miniatura = imagem), caminho escondido ---- */
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>{const prompt=document.querySelector('#sidechat-prompt');return prompt&&!prompt.disabled&&!document.querySelector('#sidechat').hidden;},undefined,{timeout:30000});
 await page.locator('#sidechat-attach').click();
 await page.locator('#sidechat-check').click();
 await page.waitForSelector('#sidechat-attachments .notebook-card img.notebook-thumb',{timeout:15000});
 const card=page.locator('#sidechat-attachments .attachment.notebook-card');
 assert.equal(await card.getAttribute('aria-label'),'Limites — aula 3 — pág. 2','o cartão diz o caderno e a página no nome acessível');
 assert.match(await card.locator('.notebook-page').innerText(),/^pág\. 2$/);
 assert.equal(await card.locator('img.notebook-thumb').getAttribute('src'),`data:image/png;base64,${PLOT_PNG}`,'a imagem é a página que o Ambitus mandou');
 assert.doesNotMatch(await page.locator('#sidechat').innerText(),/aula 3\.xopp/,'o caminho não aparece na tela');
 await card.locator('.attachment-remove').click();

 /* ---- 5. Caderno sem arquivo: entra no lateral como imagem ---- */
 answer={caminho:'',pagina:1,nome:'',png:PLOT_PNG};
 await page.locator('#sidechat-attach').click();
 await page.locator('#sidechat-check').click();
 await page.waitForSelector('#sidechat-attachments .attachment img',{timeout:15000});
 assert.equal(await page.locator('#sidechat-attachments .notebook-card').count(),0,'sem caminho não é cartão de caderno');
 await page.locator('#sidechat-attachments .attachment-remove').first().click();

 /* ---- 6. Sem documento aberto no Ambitus: o aviso, nada na bandeja ---- */
 answer={erro:'sem-pagina'};
 await page.locator('#sidechat-attach').click();
 await page.locator('#sidechat-check').click();
 await page.waitForFunction(()=>/não tem uma página aberta/.test(document.body.innerText),undefined,{timeout:15000});
 assert.equal(await page.locator('#sidechat-attachments:not([hidden]) .attachment').count(),0);

 /* ---- 7. O Ambitus some: volta ao de hoje ---- */
 await ambitus.stop();
 await page.waitForFunction(()=>!/Ambitus/.test(document.querySelector('#check').textContent),undefined,{timeout:15000});
 const after=await checkState();
 assert.match(after.label,/Xournal\+\+/);
 if(!NATIVE_CAPTURE)assert.equal(after.disabled,true);
 assert.deepEqual(errors,[]);
});
