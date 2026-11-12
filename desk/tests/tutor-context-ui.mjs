// node tests/tutor-context-ui.mjs — o painel Contexto sobrevive a um render
// tardio dos menus (fatos do motor na conexão). Antes da correção (#composer-context
// intermitente), o `desk-engine-facts` reconstruía a sanfona com `hidden` e
// a fechava na cara da pessoa. No r2 o painel é encaixado no fluxo: os fatos do
// motor não podem fechá-lo nem perder o foco. Sem Pi e sem modelo real:
// `fake-opencode.mjs`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,tinyPdf,tinyPdfPages,
 freezeMotion,resizeWindow
} from './helpers.mjs';

const FAKE_OPENCODE=path.resolve(import.meta.dirname,'fake-opencode.mjs');

await withArtifacts('tutor-context',async ctx=>{
 const runtime=ctx.runtime=newRuntime('tutor-context');
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
 await freezeMotion(page);

 /* A linha do cabeçalho abre o painel; dois PDFs viram o primeiro + "+1". */
 const lineText=(await page.locator('#context-summary').textContent()).trim();
 assert.match(lineText,/Limites\.pdf, p\.\s?1 \+1/,'a linha mostra o primeiro PDF e "+1"');
 await page.locator('#context-line').click();
 await page.waitForSelector('#context-dock:not([hidden])');
 assert.equal(await page.locator('#context-dock #study-context').isVisible(),true,'a edição está à vista');

 /* "Vai com a mensagem": cada linha tem o ícone de 16px à esquerda — arquivo
    para o PDF, imagem para a captura —, decorativo e no tom --muted. */
 const goes=await page.evaluate(()=>[...document.querySelectorAll('#context-dock-items .ctx-row')].map(row=>{
  const svg=row.querySelector('svg');
  const box=svg?.getBoundingClientRect();
  return {name:row.querySelector('.ctx-name')?.textContent.trim()||'',svg:!!svg,width:box?.width||0,height:box?.height||0,hidden:svg?.getAttribute('aria-hidden'),shapes:svg?[...svg.querySelectorAll('path,rect')].map(el=>el.tagName):[]};
 }));
 assert.ok(goes.length>=2,`o painel lista o PDF e a captura (${goes.length})`);
 for(const row of goes){
  assert.equal(row.svg,true,`a linha "${row.name}" tem ícone`);
  assert.equal(row.width,16,`o ícone de "${row.name}" tem 16px (${row.width})`);
  assert.equal(row.height,16,`o ícone de "${row.name}" tem 16px de altura (${row.height})`);
  assert.equal(row.hidden,'true',`o ícone de "${row.name}" é decorativo`);
 }
 assert.deepEqual(goes.map(row=>row.shapes.includes('rect')),[false,true],'arquivo no PDF e imagem na captura');

 /* Fatos do motor chegam tarde (conexão): os menus são re-renderizados e o
    painel aberto tem de continuar aberto, com o campo no lugar. */
 await page.evaluate(()=>window.dispatchEvent(new Event('desk-engine-facts')));
 assert.equal(await page.evaluate(()=>document.querySelector('#context-dock').hidden),false,'o painel continua aberto após os fatos do motor');
 assert.equal(await page.locator('#context-dock #study-context').isVisible(),true,'a edição continua à vista após os fatos do motor');
 assert.equal(await page.locator('#context-line').getAttribute('aria-expanded'),'true','a linha acompanha o painel');

 /* E fecha como sempre: Esc fecha o painel e devolve o foco à linha. */
 await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>document.querySelector('#context-dock').hidden),true,'Esc fecha o painel');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'context-line','Esc devolve o foco a quem abriu');
 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok tutor-context-ui');
