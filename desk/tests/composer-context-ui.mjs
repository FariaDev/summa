// node tests/composer-context-ui.mjs — o painel Contexto encaixado (r2), na
// janela. A linha do cabeçalho mostra o primeiro PDF e "+N"; o painel, aberto
// pela linha ou por Mais opções → Contexto, traz o que vai com a mensagem, a
// questão ativa, o rascunho .xopp e o uso do contexto. Cobre um PDF, vários e
// nenhum, o acompanhamento da página, referências desligadas, o caminho de
// teclado, o medidor e o tamanho no 900×650. Sem Pi e sem modelo real: o motor
// é o `fake-opencode.mjs`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,tinyPdf,tinyPdfPages,
 freezeMotion,resizeWindow,reviewShot,screenshotDirectory,insideHidden
} from './helpers.mjs';
import {nextFrames} from './waits.mjs';

const FAKE_OPENCODE=path.resolve(import.meta.dirname,'fake-opencode.mjs');
const out=screenshotDirectory('composer-context');
const rect=(page,selector)=>page.evaluate(sel=>{const r=document.querySelector(sel)?.getBoundingClientRect();return r&&{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};},selector);
const inside=(box,outer,note)=>assert.ok(box&&box.left>=outer.left-0.5&&box.top>=outer.top-0.5&&box.right<=outer.right+0.5&&box.bottom<=outer.bottom+0.5,`${note}: ${JSON.stringify(box)} dentro de ${JSON.stringify(outer)}`);
const summaryText=page=>page.locator('#context-summary').textContent();

async function openContext(page){
 const dock=page.locator('#context-dock');
 if(await insideHidden(dock)){
  const more=page.locator('#chat-more-pop');
  if(await insideHidden(more))await page.locator('#chat-more').click();
  await more.waitFor({state:'visible'});
  await page.locator('#more-context').click();
 }
 await dock.waitFor({state:'visible'});
 return dock;
}

await withArtifacts('composer-context',async ctx=>{
 const runtime=ctx.runtime=newRuntime('composer-context');
 const course=seedCourse(runtime,'calc');
 const one=path.join(course,'Limites.pdf');
 const two=path.join(course,'Formulario.pdf');
 fs.writeFileSync(one,tinyPdfPages(5,'Limites'));
 fs.writeFileSync(two,tinyPdf('Formulas'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:one,page:3},{path:two,page:1}],study:{title:'',xopp:''}}}});
 fs.chmodSync(FAKE_OPENCODE,0o755);
 const app=ctx.app=await launchDesk({runtime,pi:false,env:{LEARNING_DESK_OPENCODE:FAKE_OPENCODE}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('#composer');
 await page.waitForFunction(()=>document.querySelector('#context-summary')?.textContent.includes('Limites.pdf'));
 await resizeWindow(app,page,1440,900);
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels[0].page=3;state.updateContextSummary();});
 await freezeMotion(page);

 /* 1. Vários PDFs: o primeiro e "+1" na linha; matéria e contagem saem. */
 assert.match(await summaryText(page),/Limites\.pdf, p\. 3 \+1/,'o primeiro PDF e "+1"');
 assert.doesNotMatch(await summaryText(page),/Cálculo I|referência/,'a matéria e a contagem de referências saíram da linha');

 /* 2. A linha acompanha a página do leitor. */
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels[0].page=5;state.updateContextSummary();});
 assert.match(await summaryText(page),/Limites\.pdf, p\. 5 \+1/,'a linha acompanha a página do PDF');

 /* 3. Referências desligadas: nenhum PDF vai, e a linha não lista material. */
 await page.locator('#include-refs').click();
 assert.equal(await page.locator('#include-refs').getAttribute('aria-pressed'),'false');
 assert.doesNotMatch(await summaryText(page),/\.pdf/,'desligado, nenhum material vai junto');
 await openContext(page);
 assert.doesNotMatch(await page.locator('#context-dock-items').textContent(),/Limites\.pdf/,'desligado, o painel não lista PDF nenhum');
 assert.match(await page.locator('#context-dock-items').textContent(),/Captura do Xournal\+\+/,'a captura do Conferir segue como item próprio');
 await page.keyboard.press('Escape');
 await page.locator('#include-refs').click();
 assert.match(await summaryText(page),/Limites\.pdf, p\. 5 \+1/,'ligado de novo, o material volta');

 /* 4. Um PDF e nenhum: a linha não inventa material. */
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels[1].path='';state.updateContextSummary();});
 assert.match(await summaryText(page),/Limites\.pdf, p\. 5/,'um PDF só lista o que está aberto');
 assert.doesNotMatch(await summaryText(page),/\+1/,'sem o segundo PDF, o "+1" sai');
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels[0].path='';state.updateContextSummary();});
 assert.equal(await page.locator('#context-line').isHidden(),true,'sem material, a linha some (não inventa texto)');
 await page.evaluate(async({one,two})=>{const state=await import('./src/state.mjs');state.S.panels[0].path=one;state.S.panels[0].page=3;state.S.panels[1].path=two;state.S.panels[1].page=1;state.updateContextSummary();},{one,two});
 assert.match(await summaryText(page),/Limites\.pdf, p\. 3 \+1/,'com os dois PDFs, tudo volta');

 /* 5. O painel encaixado: título, grupo, itens com nota, campos e pé. */
 await openContext(page);
 assert.equal(await page.locator('#context-dock .dock-head strong').textContent(),'Contexto','o painel tem o título Contexto');
 assert.equal(await page.locator('#context-goes').textContent(),'Vai com a mensagem','o grupo nomeia o que vai junto');
 const pdfRow=page.locator('#context-dock-items .ctx-row').first();
 assert.match(await pdfRow.textContent(),/Limites\.pdf, p\. 3 \+1/,'a linha do PDF mostra o primeiro e "+1"');
 assert.match(await pdfRow.textContent(),/caminho e página; o PDF não vai/,'a nota do PDF explica que o arquivo não vai');
 assert.equal(await page.locator('#context-dock-items .ctx-row').count(),2,'PDF e captura do Conferir, os dois itens que existem');
 assert.match(await page.locator('#context-dock-items .ctx-row').nth(1).textContent(),/Captura do Xournal\+\+.*imagem, ao usar Conferir/,'a captura vira item com a nota de imagem');
 assert.equal(await page.locator('#context-dock #study-context').isVisible(),true,'a edição do contexto está à vista');
 assert.equal(await page.locator('#context-dock #exercise-title').isVisible(),true,'a questão ativa está no painel');
 assert.equal(await page.locator('#context-dock #pick-xopp').isVisible(),true,'o rascunho .xopp está no painel');
 assert.equal(await page.locator('#context-dock #ctx-meter').count(),1,'o medidor vivo mora no pé do painel');
 assert.equal(await page.locator('#context-dock #context-summarize').isVisible(),true,'o Resumir agora está no pé');
 assert.equal(await page.locator('#context-summarize').evaluate(el=>el.classList.contains('btn-layer')),true,'Resumir agora é botão de camada');
 inside(await rect(page,'#context-dock'),{left:0,top:0,right:1440,bottom:900},'1440×900 painel');
 await reviewShot(page,out,'contexto-varios-claro-1440.png');
 await page.keyboard.press('Escape');

 /* 6. Campo da questão e seletor do rascunho: 40px e a largura do painel. */
 await openContext(page);
 const field=await rect(page,'#exercise-title'),pick=await rect(page,'#pick-xopp'),study=await rect(page,'#study-context'),body=await page.locator('#context-dock .dock-body').evaluate(el=>{const cs=getComputedStyle(el);return {clientWidth:el.clientWidth,padLeft:parseFloat(cs.paddingLeft),padRight:parseFloat(cs.paddingRight)};});
 assert.equal(field.height,40,'o campo da questão ativa tem 40px');
 assert.equal(pick.height,40,'o seletor do rascunho tem 40px');
 assert.ok(Math.abs(field.width-study.width)<=0.5,`o campo ocupa a largura do painel (${field.width} × ${study.width})`);
 assert.ok(Math.abs(pick.width-study.width)<=0.5,`o seletor ocupa a largura do painel (${pick.width} × ${study.width})`);
 /* O corpo rola desde que o contrato do tutor entrou no painel (#180): a
    largura útil é a do cliente, sem a barra de rolagem. */
 assert.ok(Math.abs(study.width-(body.clientWidth-body.padLeft-body.padRight))<=1,'a largura é a útil do painel, descontado o recuo');
 assert.equal(await page.locator('#pick-xopp').evaluate(el=>getComputedStyle(el).backgroundColor),await page.locator('#exercise-title').evaluate(el=>getComputedStyle(el).backgroundColor),'campo e seletor usam a mesma camada');

 /* 7. Teclado: ↓ abre o Mais opções, Enter abre o Contexto e Tab chega ao campo. */
 await page.keyboard.press('Escape');
 await page.locator('#chat-more').focus();
 await page.keyboard.press('ArrowDown');
 await page.waitForFunction(()=>!document.querySelector('#chat-more-pop').hidden);
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'more-context','a seta para baixo entra no Mais opções, no Contexto');
 await page.keyboard.press('Enter');
 await page.waitForSelector('#context-dock:not([hidden])');
 assert.equal(await page.locator('#context-line').getAttribute('aria-expanded'),'true','o painel aberto pelo teclado marca a linha');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'context-dock-close','o foco entra no × do painel');
 /* O contrato do tutor (#180) pôs linhas focáveis antes do campo: o Tab entra
    nelas e só depois chega à questão. */
 const contractRows=await page.locator('#context-contract-items .contract-row').count();
 if(contractRows){
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('contract-row')),true,'o Tab entra na lista do contrato antes do campo');
  for(let i=1;i<contractRows;i++)await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
 }else{
  await page.keyboard.press('Tab');
 }
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'exercise-title','o Tab chega ao campo da questão');
 assert.equal(await page.locator('#exercise-title').getAttribute('aria-label'),'Lista ou questão ativa','o campo tem nome acessível');
 await page.keyboard.type('Lista 4 · q.9');
 await page.waitForFunction(()=>document.querySelector('#context-summary').textContent.includes('Lista 4 · q.9'));
 assert.match(await summaryText(page),/Limites\.pdf, p\. 3 \+1 · Lista 4 · q\.9/,'digitar no campo atualiza a linha na hora');
 await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>document.querySelector('#context-dock').hidden),true,'Esc fecha o painel');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'chat-more','o foco volta a quem abriu (o Mais opções)');
 const saved=await page.evaluate(async()=>{const state=await import('./src/state.mjs');return state.studySnapshot();});
 assert.equal(saved.title,'Lista 4 · q.9','a edição é a questão ativa da sessão');

 /* 8. Janela pequena: o painel cabe e continua editável. */
 await resizeWindow(app,page,900,650);
 await nextFrames(page,2);
 await openContext(page);
 inside(await rect(page,'#context-dock'),{left:0,top:0,right:900,bottom:650},'900×650 painel');
 assert.equal(await page.locator('#study-context').isVisible(),true,'na janela pequena a edição continua à vista');
 assert.equal(await page.locator('#pick-xopp').evaluate(el=>Math.round(el.getBoundingClientRect().height)),40,'na janela pequena o seletor mantém 40px');
 await reviewShot(page,out,'contexto-varios-claro-900.png');
 await page.keyboard.press('Escape');

 /* 9. Sem nada para ir junto, o grupo some; os campos continuam. */
 await page.evaluate(async()=>{const state=await import('./src/state.mjs');state.S.panels.forEach(panel=>{panel.path='';});state.S.appConfig.desk={...(state.S.appConfig.desk||{}),conferir:false};state.updateContextSummary();});
 await openContext(page);
 assert.equal(await page.locator('#context-goes').isHidden(),true,'sem PDF, o grupo "Vai com a mensagem" some');
 assert.equal(await page.locator('#context-dock #exercise-title').isVisible(),true,'a questão ativa continua editável');
 await reviewShot(page,out,'contexto-vazio-claro-900.png');

 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok composer-context-ui');
