import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,seedNativeSession,tinyPdf,statusOnline,resizeWindow,fakeEngineLauncher} from './helpers.mjs';

/* Clipe e bandeja de anexos do chat lateral (Electron real, fake-opencode e
   fake-xournalpp, dados sintéticos). Cobre: o clipe do lateral com o mesmo
   desenho do clipe do compositor; o menu (Imagem, Conferir); a página que o
   Ambitus manda pela ponte vai SEMPRE à bandeja do tutor, com ou sem o chat
   lateral aberto (o lateral não ganha o cartão e o foco vai ao campo do tutor);
   e o código do lateral que continua existindo, alimentado direto pelo
   `sidechat-loader` em vez da ponte: o cartão como imagem de verdade (54×54,
   etiqueta "pág. N", × e dica com o caderno) com o campo vazio e em foco; o
   caminho do arquivo não aparece na tela, mas chega ao motor no envio junto do
   PNG da página como imagem; a bolha mostra a página e não o chip. */

const here=path.dirname(fileURLToPath(import.meta.url));
const FAKE_XOURNALPP=path.join(here,'fake-xournalpp.mjs');
/* No Windows o app não executa um `.mjs`: o mesmo `.cmd` que roda os motores
   falsos (`node fake-xournalpp.mjs %*`) faz o papel do xournalpp.exe. */
const XOURNALPP_BIN=fakeEngineLauncher(FAKE_XOURNALPP);
/* PNG de 1×1: o menor anexo de imagem válido. */
const PNG_1X1=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
const XML=`<?xml version="1.0" standalone="no"?><xournal version="4"><page width="589" height="845"><background type="solid" color="#ffffffff" style="lined"/><layer><text fn="" size="12" color="#0013ff" font="Sans" x="100" y="100">Primeira</text></layer></page><page width="589" height="845"><background type="solid" color="#ffffffff" style="lined"/><layer><text fn="" size="12" color="#0013ff" font="Sans" x="100" y="100">Segunda</text></layer></page></xournal>`;

async function sendPageByBridge(runtime,body){
 const file=JSON.parse(fs.readFileSync(path.join(runtime,'ambitus-bridge.json'),'utf8'));
 const response=await fetch(`http://127.0.0.1:${file.port}/mandar-pagina`,{method:'POST',headers:{'content-type':'application/json','x-summa-token':file.token},body:JSON.stringify(body)});
 return {status:response.status,json:await response.json()};
}

await withArtifacts('sidechat-anexos',async ctx=>{
 const runtime=ctx.runtime=newRuntime('sidechat-anexos'),course=seedCourse(runtime,'Test');
 const pdf=path.join(course,'Limites.pdf');
 fs.writeFileSync(pdf,tinyPdf('Exercise',2));
 const notebook=path.join(course,'Limites — aula 3.xopp');
 fs.writeFileSync(notebook,gzipSync(XML));
 fs.chmodSync(FAKE_XOURNALPP,0o755);
 const current=seedNativeSession(runtime,[{role:'user',content:[{type:'text',text:'conversa atual'}]}],{courseId:'Test',preview:'conversa atual'});
 writeDeskJson(runtime,{session:current,courseId:'Test',courseStates:{Test:{session:current,pdfs:[{path:pdf,page:1,zoom:1,scrollX:0,scrollY:0}],sessions:[{path:current,started:Date.now(),preview:'conversa atual'}]}}});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],xournalPath:XOURNALPP_BIN,desk:{pinnedExtensions:false}});
 const serveLog=path.join(runtime,'serve.log');
 ctx.app=await launchDesk({runtime,env:{FAKE_OPENCODE_LOG:serveLog}});
 const shots='/tmp/claude-1000/pagina-imagem';
 const page=await ctx.app.firstWindow();
 await resizeWindow(ctx.app,page,1440,900);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});

 /* ---- 1. O clipe do lateral é o clipe do compositor ---- */
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>{const prompt=document.querySelector('#sidechat-prompt');return prompt&&!prompt.disabled&&!document.querySelector('#sidechat').hidden;},undefined,{timeout:30000});
 const look=selector=>page.locator(selector).evaluate(el=>{const css=getComputedStyle(el);return {width:css.width,height:css.height,color:css.color,radius:css.borderRadius,font:css.fontSize,icon:el.innerHTML.includes('<svg'),aria:el.getAttribute('aria-label'),title:el.title,popup:el.getAttribute('aria-haspopup')};});
 assert.deepEqual(await look('#sidechat-attach'),await look('#attach'),'o clipe do lateral tem o mesmo tamanho, cor, ícone, nome e título do clipe do tutor');
 assert.equal(await page.locator('#sidechat-attachments').isHidden(),true,'bandeja vazia fica escondida');

 /* ---- 2. O menu: mesmo popover, mesmos gestos ---- */
 await page.locator('#sidechat-attach').click();
 assert.equal(await page.locator('#sidechat-attach-pop').isVisible(),true,'o clique no clipe abre o menu');
 assert.equal(await page.locator('#sidechat-attach').getAttribute('aria-expanded'),'true');
 const itemNames=await page.locator('#sidechat-attach-pop button[role="menuitem"]').allInnerTexts();
 assert.equal(itemNames.length,2,'o lateral oferece Imagem e Conferir');
 assert.match(itemNames[0],/Imagem/);
 assert.match(itemNames[1],/Conferir/);
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'sidechat-attach-file','o foco vai ao primeiro item');
 const popLook=selector=>page.locator(selector).evaluate(el=>{const css=getComputedStyle(el);return {bg:css.backgroundColor,border:css.borderTopColor,radius:css.borderRadius,shadow:css.boxShadow,min:css.minWidth};});
 await page.locator('#attach').click();
 assert.deepEqual(await popLook('#sidechat-attach-pop'),await popLook('#attach-pop'),'o menu do lateral tem o visual do menu do tutor');
 await page.keyboard.press('Escape');
 /* Sem captura possível (este ambiente) o Conferir fica desligado nos dois menus, com a mesma frase. */
 await page.locator('#attach').click();
 const mainCheck=await page.locator('#check').evaluate(el=>({disabled:el.disabled,text:el.innerText.trim().replace(/\s+/g,' ')}));
 await page.keyboard.press('Escape');
 await page.locator('#sidechat-attach').click();
 const sideCheck=await page.locator('#sidechat-check').evaluate(el=>({disabled:el.disabled,text:el.innerText.trim().replace(/\s+/g,' ')}));
 assert.deepEqual(sideCheck,mainCheck,'o Conferir do lateral tem o rótulo e o estado do Conferir do tutor');
 await page.keyboard.press('ArrowDown');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),mainCheck.disabled?'sidechat-attach-file':'sidechat-check','a seta percorre só o que está ligado, como no menu do tutor');
 await page.keyboard.press('Escape');
 await page.locator('#sidechat-attach-pop').waitFor({state:'hidden',timeout:5000});
 assert.equal(await page.locator('#sidechat-attach-pop').getAttribute('hidden'),'','Esc fecha o menu');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'sidechat-attach','e devolve o foco ao clipe');

 /* ---- 3. Uma imagem anexada fica na bandeja, igual à do tutor ---- */
 await page.setInputFiles('#sidechat-attach-input',{name:'pagina.png',mimeType:'image/png',buffer:PNG_1X1});
 await page.waitForSelector('#sidechat-attachments .attachment img',{timeout:10000});
 assert.equal(await page.locator('#sidechat-attachments .attachment').count(),1);
 assert.equal(await page.locator('#attachments .attachment').count(),0,'a bandeja do tutor não recebeu nada');
 const imageBox=await page.locator('#sidechat-attachments .attachment img').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,remove:!!el.parentElement.querySelector('.attachment-remove')}));
 assert.deepEqual(imageBox,{width:54,height:54,remove:true},'miniatura de 54px e ×, como no tutor');

 /* ---- 4. A página do Ambitus vai ao TUTOR, mesmo com o lateral aberto ---- */
 assert.equal(await page.locator('#sidechat').isVisible(),true,'o chat lateral está aberto');
 await page.locator('#sidechat-prompt').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'sidechat-prompt','o foco começa no campo do lateral');
 const sent=await sendPageByBridge(runtime,{caminho:notebook,pagina:2,nome:''});
 assert.deepEqual(sent,{status:200,json:{ok:true}},'a ponte responde sem esperar a miniatura');
 await page.waitForSelector('#attachments .attachment.notebook-card',{timeout:15000});
 const tutorCard=page.locator('#attachments .attachment.notebook-card');
 assert.equal(await tutorCard.getAttribute('aria-label'),'Limites — aula 3 — pág. 2','o cartão do tutor diz o caderno e a página');
 assert.match(await tutorCard.locator('.notebook-page').innerText(),/^pág\. 2$/,'a etiqueta fica sobre a miniatura do tutor');
 assert.equal(await page.locator('#sidechat-attachments .notebook-card').count(),0,'o chat lateral aberto não recebe o cartão');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'prompt','o foco vai ao campo do tutor');
 assert.equal(await page.locator('#prompt').inputValue(),'','o campo do tutor fica vazio, pronto para a pergunta');
 fs.mkdirSync(shots,{recursive:true});
 await page.screenshot({path:path.join(shots,'bandeja-tutor-com-lateral.png')});
 /* O cartão do tutor sai pelo × para não atrapalhar o resto do teste. */
 await tutorCard.locator('.attachment-remove').click();
 await page.waitForFunction(()=>!document.querySelector('#attachments .notebook-card'),undefined,{timeout:5000});

 /* ---- 5. O lateral que continua existindo, alimentado direto pelo loader ---- */
 assert.equal(await page.locator('#attachments .attachment.notebook-card').count(),0,'o tutor não recebe o que entra no lateral');
 const thumb=`data:image/png;base64,${PNG_1X1.toString('base64')}`;
 const direct=await page.evaluate(async({caminho,pagina,nome,thumb})=>{
  const loader=await import('./src/sidechat-loader.mjs');
  return {added:await loader.attachSidechatNotebook({caminho,pagina,nome}),thumb:loader.setSidechatNotebookThumb({caminho,pagina,thumb})};
 },{caminho:notebook,pagina:2,nome:'',thumb});
 assert.deepEqual(direct,{added:true,thumb:true},'o loader põe o cartão e a miniatura no lateral');
 await page.waitForSelector('#sidechat-attachments .notebook-card',{timeout:10000});
 const card=page.locator('#sidechat-attachments .attachment.notebook-card');
 assert.equal(await card.getAttribute('aria-label'),'Limites — aula 3 — pág. 2','o nome acessível diz o caderno e a página');
 assert.equal(await card.getAttribute('title'),'Limites — aula 3 — pág. 2','a dica diz o mesmo');
 assert.match(await card.locator('.notebook-page').innerText(),/^pág\. 2$/,'a etiqueta fica sobre a miniatura');
 assert.equal(await page.locator('#sidechat-prompt').inputValue(),'','o campo de texto fica vazio');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'sidechat-prompt','e com foco, pronto para a pergunta');
 await page.waitForSelector('#sidechat-attachments .notebook-card img.notebook-thumb',{timeout:10000});
 assert.equal(await card.locator('img.notebook-thumb').getAttribute('src'),thumb,'a miniatura é o PNG que veio do lado do main');
 const cardBox=await card.locator('img.notebook-thumb').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,remove:!!el.parentElement.querySelector('.attachment-remove')}));
 assert.deepEqual(cardBox,{width:54,height:54,remove:true},'a página ocupa o mesmo quadrado das outras imagens, com o mesmo ×');
 fs.mkdirSync(shots,{recursive:true});
 await page.screenshot({path:path.join(shots,'bandeja-lateral.png')});
 const visible=await page.locator('#sidechat').innerText();
 assert.doesNotMatch(visible,/aula 3\.xopp/,'o caminho do arquivo não aparece na tela');
 assert.equal(await page.locator('#sidechat-attachments .notebook-card').evaluate(el=>el.closest('.attachment').innerHTML.includes(el.ownerDocument.defaultView.location.href)),false);
 assert.equal(await page.locator('#sidechat-attachments [data-key*="xopp"], #sidechat-attachments [title*="xopp"]').count(),0,'nem escondido em atributo visível a quem passa o mouse');
 /* O mesmo cartão de novo não duplica. */
 const again=await page.evaluate(async({caminho,pagina,nome})=>(await import('./src/sidechat-loader.mjs')).attachSidechatNotebook({caminho,pagina,nome}),{caminho:notebook,pagina:2,nome:''});
 assert.equal(again,true,'o loader aceita de novo a mesma página');
 assert.equal(await page.locator('#sidechat-attachments .notebook-card').count(),1,'o mesmo cartão não duplica');
 await page.screenshot({path:'/tmp/claude-1000/summa-8a.png'});

 /* ---- 6. O × tira o cartão; a pergunta vai com o caminho escondido e a imagem ---- */
 assert.equal(await page.evaluate(async({caminho,pagina,nome})=>(await import('./src/sidechat-loader.mjs')).attachSidechatNotebook({caminho,pagina,nome}),{caminho:notebook,pagina:1,nome:'Aula 3'}),true,'o loader põe o segundo cartão');
 await page.waitForFunction(()=>document.querySelectorAll('#sidechat-attachments .notebook-card').length===2,undefined,{timeout:10000});
 await page.locator('#sidechat-attachments .attachment-remove[aria-label="Remover Aula 3"]').click();
 assert.equal(await page.locator('#sidechat-attachments .notebook-card').count(),1,'o × tira só o cartão clicado');
 await page.locator('#sidechat-prompt').fill('o que acontece na página dois?');
 await page.locator('#sidechat-prompt').press('Enter');
 await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-msg.assistant .sidechat-body')].length>=1,undefined,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#sidechat-attachments').hidden,undefined,{timeout:10000});
 const bubble=page.locator('#sidechat-messages .sidechat-msg.user').last();
 assert.match(await bubble.innerText(),/o que acontece na página dois\?/);
 assert.doesNotMatch(await bubble.innerText(),/aula 3\.xopp/,'a bolha não mostra o caminho');
 const shot=bubble.locator('.sidechat-body img.shot');
 await shot.waitFor({timeout:10000});
 assert.match(await shot.getAttribute('src'),/^data:image\/png;base64,/,'a página aparece na bolha como as outras imagens enviadas');
 assert.equal(await shot.getAttribute('title'),'Limites — aula 3 — pág. 2','a imagem leva o nome do caderno e a página');
 assert.equal(await bubble.locator('.message-file.notebook-chip').count(),0,'o chip de texto sai da bolha quando a imagem está lá');
 const engineSaw=fs.readFileSync(serveLog,'utf8');
 assert.match(engineSaw,/aula 3\.xopp/,'o motor recebeu o caminho do caderno');
 assert.match(engineSaw,/pág\. 2/,'e a página');
 assert.match(engineSaw,/"files":\[\{[^\]]*\.png/,'e a imagem anexada, como arquivo do pedido');
 const sentToEngine=engineSaw.trim().split('\n').map(line=>JSON.parse(line)).filter(entry=>String(entry?.body?.text||'').includes('o que acontece na página dois?')).at(-1);
 assert.equal(sentToEngine.body.files.length,2,'o PNG da página vai em images junto da imagem que já estava na bandeja');

 /* ---- 7. A mensagem antiga (só com o bloco, sem imagem) continua abrindo: chip de reserva ---- */
 await page.reload();
 await statusOnline(page,{timeout:30000});
 await page.waitForFunction(()=>{const panel=document.querySelector('#sidechat');return panel&&!panel.hidden&&!document.querySelector('#sidechat-prompt').disabled;},undefined,{timeout:30000});
 const restored=page.locator('#sidechat-messages .sidechat-msg.user').last();
 await restored.locator('.message-file.notebook-chip').waitFor({timeout:15000});
 assert.equal(await restored.locator('.notebook-chip .notebook-name').innerText(),'Limites — aula 3','o chip volta do histórico');
 assert.match(await restored.locator('.notebook-chip .notebook-page').innerText(),/^pág\. 2$/);
 assert.doesNotMatch(await restored.innerText(),/aula 3\.xopp/,'o caminho continua fora da bolha depois do reload');
 assert.equal(await page.locator('#sidechat-messages .sidechat-msg.user .notebook-chip').count(),1,'só a mensagem com caderno ganha chip');
 assert.deepEqual(errors,[]);
});
