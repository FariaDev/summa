// node tests/mini-mode-ui.mjs — o modo mini do tutor (passo 9, protótipo r7), na janela (Electron real).
// Cobre: o botão do cabeçalho, o ⋯ e a paleta; a MESMA janela encolhe para 360×480 no canto da tela,
// por cima, sem o cabeçalho da Mesa; o alfinete alterna e guarda a escolha; "Voltar à Mesa" restaura
// tamanho, lugar e estado (inclusive a tela inteira que já estava ligada); Ctrl+Shift+M alterna; o
// lugar do mini fica guardado; a página do Ambitus vira cartão de caderno na bandeja do tutor
// (caminho escondido) sempre, com ou sem o mini; fechar no mini grava a janela normal e o Summa abre normal.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {gzipSync} from 'node:zlib';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson,seedNativeSession,tinyPdf,statusOnline,resizeWindow,pageWindow,freezeMotion,PLOT_PNG} from './helpers.mjs';
import {closeApp} from './proc-tree.mjs';
import {pollUntil} from './waits.mjs';

const XML=`<?xml version="1.0" standalone="no"?><xournal version="4"><page width="589" height="845"><background type="solid" color="#ffffffff" style="lined"/><layer><text fn="" size="12" color="#0013ff" font="Sans" x="100" y="100">Primeira</text></layer></page></xournal>`;
const MINI={width:360,height:480};
const MARGIN=16;
const SHOT=process.env.MINI_MODE_SHOT||'';

/** Os limites da janela da página, lidos do main. */
const boundsOf=win=>win.evaluate(bw=>bw.getBounds());
const deskJson=runtime=>{try{return JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));}catch{return {};}};
const sameBounds=(a,b)=>!!a&&!!b&&a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height;

await withArtifacts('mini-mode',async ctx=>{
 const runtime=ctx.runtime=newRuntime('mini-mode'),course=seedCourse(runtime,'Test');
 const pdf=path.join(course,'Limites.pdf');
 fs.writeFileSync(pdf,tinyPdf('Exercise',2));
 const notebook=path.join(course,'Limites — aula 3.xopp');
 fs.writeFileSync(notebook,gzipSync(XML));
 const current=seedNativeSession(runtime,[
  {role:'user',content:[{type:'text',text:'por que posso cancelar o x−1 aqui?'}]},
  {role:'assistant',content:[{type:'text',text:'Porque o limite olha para x perto de 1, nunca igual a 1. Para x ≠ 1, (x²−1)/(x−1) e x+1 são a mesma função.'}]},
 ],{courseId:'Test',preview:'Limites — aula 3'});
 writeDeskJson(runtime,{session:current,courseId:'Test',courseStates:{Test:{session:current,pdfs:[{path:pdf,page:1,zoom:1,scrollX:0,scrollY:0}],sessions:[{path:current,started:Date.now(),preview:'Limites — aula 3'}]}}});
 writeConfigJson(runtime,{vaultPath:runtime,runtimePath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 let page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('#messages .message',{timeout:20000});
 await resizeWindow(ctx.app,page,1000,700);
 let win=await pageWindow(ctx.app,page);
 await win.evaluate(bw=>bw.setPosition(20,24));
 await freezeMotion(page);

 /* A área de trabalho da tela onde a janela está: o canto do mini sai dela. */
 const work=await ctx.app.evaluate(({screen},bounds)=>screen.getDisplayMatching(bounds).workArea,await boundsOf(win));
 const corner={x:work.x+work.width-MINI.width-MARGIN,y:work.y+work.height-MINI.height-MARGIN,...MINI};
 const normal=await pollUntil(()=>boundsOf(win),b=>b.width===1000&&b.height===700,{timeout:10000,interval:100,what:'a janela normal assentar em 1000×700'});
 assert.equal(normal.x,20);
 const inMini=()=>page.evaluate(()=>document.body.classList.contains('mini-mode'));
 const waitMini=value=>page.waitForFunction(want=>document.body.classList.contains('mini-mode')===want,value,{timeout:10000});

 /* ---- 1. Onde liga: o botão ao lado de "tela cheia", com a dica; o ⋯; a paleta ---- */
 const button=page.locator('#chat-mini');
 assert.equal(await button.isVisible(),true,'o botão mora no cabeçalho do tutor');
 assert.equal(await button.getAttribute('title'),'Modo mini · sempre por cima');
 assert.equal(await button.locator('svg.icon').count(),1,'ícone do conjunto (Lucide picture-in-picture-2)');
 assert.equal(await page.locator('#chat-full + #chat-mini').count(),1,'ao lado de "tela cheia"');
 assert.equal(await page.locator('#mini-head').isVisible(),false,'o cabeçalho mini não aparece fora do modo');
 await page.locator('#chat-more').click();
 assert.equal(await page.locator('#chat-more-pop #chat-mini-menu').isVisible(),true,'o ⋯ do tutor tem o item');
 assert.match(await page.locator('#chat-mini-menu').innerText(),/Modo mini/);
 await page.keyboard.press('Escape');
 await page.keyboard.press('ControlOrMeta+k');
 const palette=page.locator('#command-palette .palette-input');
 await palette.waitFor({timeout:5000});
 await palette.fill('modo mini');
 const item=page.locator('.palette-item',{hasText:'Modo mini'});
 await item.first().waitFor({timeout:5000});
 assert.equal(await item.count(),1,'a paleta de comandos tem a ação');
 /* A própria paleta liga o modo (é a terceira porta de entrada). */
 await page.waitForTimeout(250);// espera fixa: o filtro da paleta tem debounce
 await page.keyboard.press('Enter');
 await waitMini(true);

 /* ---- 2. Como fica: 360×480 no canto, por cima, sem o cabeçalho da Mesa ---- */
 const entered=await pollUntil(()=>boundsOf(win),b=>b.width===MINI.width&&b.height===MINI.height,{timeout:10000,interval:100,what:'a janela encolher para 360×480'});
 assert.deepEqual(entered,corner,'canto de baixo à direita da área de trabalho da tela da janela');
 assert.equal(await win.evaluate(bw=>bw.isAlwaysOnTop()),true,'sempre por cima, ligado por padrão');
 assert.deepEqual(await win.evaluate(bw=>bw.getMinimumSize()),[300,360],'o mínimo de 900×650 da Mesa cai no mini');
 assert.equal(await page.evaluate(()=>document.body.classList.contains('chat-full')),true,'o mini aproveita a tela inteira do chat');
 const shown=await page.evaluate(()=>{
  const visible=selector=>{const el=document.querySelector(selector);return !!el&&getComputedStyle(el).display!=='none'&&el.getClientRects().length>0;};
  return {header:visible('body>header'),tabs:visible('#course-tabs'),chatTop:visible('#chat .chat-top'),refs:visible('#references'),calc:visible('#calculator'),mini:visible('#mini-head'),messages:visible('#messages'),prompt:visible('#prompt'),send:visible('#send'),attach:visible('#attach'),check:visible('#check')||visible('#attach'),
   title:document.querySelector('#mini-head .mini-title-text').textContent,course:document.querySelector('#mini-head .mini-course').textContent,
   drag:getComputedStyle(document.querySelector('#mini-head')).getPropertyValue('-webkit-app-region'),noDrag:getComputedStyle(document.querySelector('#mini-pin')).getPropertyValue('-webkit-app-region'),
   scrollW:document.documentElement.scrollWidth,innerW:innerWidth,head:document.querySelector('#mini-head').getBoundingClientRect().toJSON(),composer:document.querySelector('#composer').getBoundingClientRect().toJSON(),innerH:innerHeight};
 });
 assert.equal(shown.header,false,'o cabeçalho da Mesa some');
 assert.equal(shown.tabs,false,'as abas da Mesa somem');
 assert.equal(shown.chatTop,false,'o cabeçalho do tutor dá lugar ao mini');
 assert.equal(shown.refs,false,'os leitores somem');
 assert.equal(shown.calc,false,'a calculadora some');
 assert.equal(shown.mini,true,'o cabeçalho mini aparece');
 assert.deepEqual([shown.messages,shown.prompt,shown.send,shown.attach],[true,true,true,true],'conversa e compositor continuam à vista');
 assert.equal(shown.title,'Limites — aula 3','o título é o da conversa');
 assert.equal(shown.course,'Cálculo I','a matéria vem em cinza ao lado');
 assert.equal(shown.drag,'drag','a barra do cabeçalho arrasta a janela');
 assert.equal(shown.noDrag,'no-drag','os botões não arrastam');
 assert.ok(shown.scrollW<=shown.innerW,`nada passa da largura do mini (${shown.scrollW} > ${shown.innerW})`);
 assert.ok(shown.head.top<=1&&shown.composer.bottom<=shown.innerH+1,'cabeçalho no topo e compositor dentro da janela');
 if(process.platform!=='darwin')assert.equal(await win.evaluate(bw=>bw.isMenuBarVisible()),false,'sem a barra de menu no mini');
 assert.equal(await page.locator('#mini-pin').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#mini-pin svg.icon').count(),1);
 assert.equal(await page.locator('#mini-back').getAttribute('title'),'Voltar à Mesa');
 assert.equal(await page.locator('#mini-pin').getAttribute('title'),'Sempre por cima');

 /* ---- 3. O alfinete alterna e guarda a escolha ---- */
 await page.locator('#mini-pin').click();
 await pollUntil(()=>win.evaluate(bw=>bw.isAlwaysOnTop()),v=>v===false,{timeout:10000,interval:100,what:'o alfinete desligar o por cima'});
 assert.equal(await page.locator('#mini-pin').getAttribute('aria-pressed'),'false');
 await pollUntil(()=>deskJson(runtime).miniAlwaysOnTop,v=>v===false,{timeout:10000,interval:100,what:'o desk.json guardar o alfinete desligado'});
 await page.locator('#mini-pin').click();
 await pollUntil(()=>win.evaluate(bw=>bw.isAlwaysOnTop()),v=>v===true,{timeout:10000,interval:100,what:'o alfinete religar o por cima'});
 assert.equal(await page.locator('#mini-pin').getAttribute('aria-pressed'),'true');

 /* ---- 4. Voltar à Mesa: tamanho, lugar e estado de antes; o lugar do mini fica guardado ---- */
 const moved={x:corner.x-120,y:corner.y-90,width:400,height:520};
 await win.evaluate((bw,next)=>bw.setBounds(next),moved);
 await pollUntil(()=>deskJson(runtime).miniBounds,b=>sameBounds(b,moved),{timeout:10000,interval:100,what:'o desk.json guardar o lugar do mini'});
 await page.locator('#mini-back').click();
 await waitMini(false);
 await pollUntil(()=>boundsOf(win),b=>sameBounds(b,normal),{timeout:10000,interval:100,what:'a janela voltar ao tamanho e ao lugar de antes'});
 assert.equal(await win.evaluate(bw=>bw.isAlwaysOnTop()),false,'a Mesa não fica por cima');
 assert.deepEqual(await win.evaluate(bw=>bw.getMinimumSize()),[900,650]);
 assert.equal(await page.evaluate(()=>document.body.classList.contains('chat-full')),false,'a tela inteira que o mini ligou sai com ele');
 assert.equal(await page.locator('#references').isVisible(),true,'os leitores voltam');
 assert.equal(await page.locator('body>header').isVisible(),true,'o cabeçalho da Mesa volta');
 if(process.platform!=='darwin')assert.equal(await win.evaluate(bw=>bw.isMenuBarVisible()),true);

 /* ---- 5. Ctrl+Shift+M alterna; o mini volta ao lugar guardado ---- */
 await page.keyboard.press('Control+Shift+M');
 await waitMini(true);
 await pollUntil(()=>boundsOf(win),b=>sameBounds(b,moved),{timeout:10000,interval:100,what:'o mini voltar ao lugar guardado'});
 await page.keyboard.press('Control+Shift+M');
 await waitMini(false);
 await pollUntil(()=>boundsOf(win),b=>sameBounds(b,normal),{timeout:10000,interval:100,what:'a janela voltar com o atalho'});

 /* ---- 6. A tela inteira que já estava ligada continua ligada na volta ---- */
 await page.keyboard.press('Control+Shift+E');
 await page.waitForFunction(()=>document.body.classList.contains('chat-full'),undefined,{timeout:5000});
 await page.keyboard.press('Control+Shift+M');
 await waitMini(true);
 await page.locator('#mini-back').click();
 await waitMini(false);
 assert.equal(await page.evaluate(()=>document.body.classList.contains('chat-full')),true,'voltou à tela inteira em que estava');
 await page.keyboard.press('Control+Shift+E');
 await page.waitForFunction(()=>!document.body.classList.contains('chat-full'),undefined,{timeout:5000});
 await pollUntil(()=>boundsOf(win),b=>sameBounds(b,normal),{timeout:10000,interval:100,what:'a janela normal depois da tela inteira'});

 /* ---- 7. A página do Ambitus vai sempre à bandeja do tutor, com o campo em foco ---- */
 const bridge=()=>JSON.parse(fs.readFileSync(path.join(runtime,'ambitus-bridge.json'),'utf8'));
 await pollUntil(()=>{try{return bridge().port;}catch{return 0;}},v=>!!v,{timeout:15000,interval:100,what:'a ponte do Ambitus subir'});
 const sendPage=async body=>{
  const file=bridge();
  const response=await fetch(`http://127.0.0.1:${file.port}/mandar-pagina`,{method:'POST',headers:{'content-type':'application/json','x-summa-token':file.token},body:JSON.stringify(body)});
  return response.status;
 };
 const card=page.locator('#attachments .attachment.notebook-card');
 await page.locator('#prompt').evaluate(el=>el.blur());
 assert.equal(await sendPage({caminho:notebook,pagina:2,nome:'Limites — aula 3'}),200);
 await card.waitFor({timeout:10000});
 assert.equal(await card.getAttribute('aria-label'),'Limites — aula 3 — pág. 2','fora do mini o cartão vai à bandeja do tutor');
 assert.match(await card.locator('.notebook-page').innerText(),/^pág\. 2$/);
 assert.equal(await page.locator('#sidechat').isVisible(),false,'o chat lateral não abre');
 assert.equal(await page.locator('#sidechat-toggle').getAttribute('aria-pressed'),'false','nem fica ligado');
 assert.equal(await page.locator('#prompt').evaluate(el=>el===document.activeElement),true,'e o foco vai ao campo, para a pergunta');
 await page.locator('#attachments .attachment-remove').first().click();

 await page.keyboard.press('Control+Shift+M');
 await waitMini(true);
 await pollUntil(()=>boundsOf(win),b=>sameBounds(b,moved),{timeout:10000,interval:100,what:'o mini ligar de novo'});
 assert.equal(await page.locator('#sidechat').isVisible(),false,'o chat lateral preso não aparece no mini');
 assert.equal(await sendPage({caminho:notebook,pagina:2,nome:'Limites — aula 3'}),200);
 await card.waitFor({timeout:10000});
 assert.equal(await card.getAttribute('aria-label'),'Limites — aula 3 — pág. 2','o nome acessível diz o caderno e a página');
 assert.match(await card.locator('.notebook-page').innerText(),/^pág\. 2$/);
 assert.equal(await page.locator('#attachments').isVisible(),true,'a bandeja do tutor aparece');
 assert.equal(await page.locator('#sidechat-attachments .notebook-card').count(),0,'e o chat lateral não recebeu o cartão');
 await win.evaluate((bw,data)=>bw.webContents.send('ambitus-page-thumb',data),{caminho:notebook,pagina:2,thumb:`data:image/png;base64,${PLOT_PNG}`});
 await page.waitForSelector('#attachments .notebook-card img.notebook-thumb',{timeout:5000});
 assert.equal(await card.locator('img.notebook-thumb').getAttribute('src'),`data:image/png;base64,${PLOT_PNG}`,'a miniatura chega depois do cartão');
 assert.doesNotMatch(await page.locator('#chat').innerText(),/aula 3\.xopp/,'o caminho não aparece na tela');
 assert.equal(await page.locator('#prompt').evaluate(el=>el===document.activeElement),true,'o foco vai ao campo, para a pergunta');
 /* Captura do modo mini com uma conversa e o cartão do Ambitus na bandeja (MINI_MODE_SHOT=<arquivo.png>). */
 if(SHOT){fs.mkdirSync(path.dirname(SHOT),{recursive:true});await page.screenshot({path:SHOT});}
 /* O mesmo cartão duas vezes não repete. */
 assert.equal(await sendPage({caminho:notebook,pagina:2,nome:'Limites — aula 3'}),200);
 await page.waitForTimeout(300);// espera fixa: nada deve acontecer
 assert.equal(await card.count(),1);

 /* ---- 8. Enviar: o caminho vai escondido ao motor, a página vira imagem na bolha, a bandeja esvazia ---- */
 const before=await page.locator('#messages .message.user').count();
 await page.locator('#prompt').fill('e se o limite não existir?');
 await page.locator('#send').click();
 await page.waitForFunction(n=>document.querySelectorAll('#messages .message.user').length>n,before,{timeout:20000});
 await page.waitForFunction(()=>!document.querySelector('#attachments .notebook-card'),undefined,{timeout:20000});// o cartão sai da bandeja quando o envio é aceito
 const lastUser=page.locator('#messages .message.user').last();
 const bubble=await lastUser.innerText();
 assert.match(bubble,/e se o limite não existir\?/);
 assert.doesNotMatch(bubble,/Cadernos anexados|\.xopp/,'a bolha não mostra o bloco nem o caminho');
 await lastUser.locator('img.shot').waitFor({timeout:15000});
 assert.equal(await lastUser.locator('img.shot').getAttribute('title'),'Limites — aula 3 — pág. 2','a página aparece na bolha como imagem, com a dica');
 assert.equal(await lastUser.locator('.message-file.notebook-chip').count(),0,'o chip de texto não fica na bolha com a imagem');
 const conversations=createRequire(import.meta.url)('../src/agents/conversations.cjs');
 const texts=()=>{try{return (conversations.readClaudeConversation(current,{runtime})?.messages||[]).filter(m=>m.role==='user').map(m=>(Array.isArray(m.content)?m.content:[]).map(c=>c.text||'').join(' '));}catch{return [];}};
 const sent=await pollUntil(()=>texts().find(text=>/e se o limite não existir\?/.test(text))||'',text=>!!text,{timeout:20000,interval:200,what:'o envio chegar ao registro da conversa'});
 assert.match(sent,/\[Cadernos anexados à mensagem\][\s\S]*Limites — aula 3\.xopp/,'o motor recebeu o caminho do caderno, escondido');

 /* ---- 9. Fechar no mini volta à Mesa antes: o desk.json guarda a janela NORMAL ---- */
 const miniAtClose=await boundsOf(win);
 assert.deepEqual([miniAtClose.width,miniAtClose.height],[moved.width,moved.height]);
 const old=ctx.app;
 await win.evaluate(bw=>bw.close()).catch(()=>{});
 await closeApp(old,{ledgerDir:runtime});
 const saved=deskJson(runtime);
 assert.ok(sameBounds(saved.bounds,normal),`o desk.json guarda os limites normais, não os do mini (${JSON.stringify(saved.bounds)})`);
 assert.ok(sameBounds(saved.miniBounds,miniAtClose),'e o lugar do mini fica guardado');
 assert.equal(saved.miniAlwaysOnTop,true);
 assert.equal('miniMode' in saved,false,'o modo em si não é persistido');

 /* ---- 10. Na próxima abertura o Summa abre normal; o mini volta ao lugar guardado ---- */
 ctx.app=await launchDesk({runtime});
 page=await ctx.app.firstWindow();
 page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 win=await pageWindow(ctx.app,page);
 assert.equal(await inMini(),false,'abre normal');
 assert.equal(await page.locator('#mini-head').isVisible(),false);
 assert.equal(await page.locator('body>header').isVisible(),true);
 await pollUntil(()=>boundsOf(win),b=>b.width===normal.width&&b.height===normal.height,{timeout:10000,interval:100,what:'a Mesa abrir no tamanho de antes do mini'});
 await page.keyboard.press('Control+Shift+M');
 await page.waitForFunction(()=>document.body.classList.contains('mini-mode'),undefined,{timeout:10000});
 await pollUntil(()=>boundsOf(win),b=>sameBounds(b,miniAtClose),{timeout:10000,interval:100,what:'o mini abrir no lugar guardado da sessão anterior'});
 assert.deepEqual(errors,[]);
});
