// node tests/tutor-contract-ui.mjs — o contrato do tutor no painel Contexto
// (#180, opção A do mock `docs/design/carbon-r2/contrato.html`): a linha do
// arquivo com a origem, a leitura no mesmo painel e "Sem contrato" na Livre.
// Configuração e pastas temporárias; nunca a mesa de quem testa.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,
 freezeMotion,resizeWindow,setTheme,reviewShot,screenshotDirectory,openStudyContext
} from './helpers.mjs';

const out=screenshotDirectory('tutor-contract');
const COURSE_TEXT='Você é o tutor desta matéria.\n\nO arquivo traz <b>marcação</b> que não vira negrito.';
const VAULT_TEXT='O contrato do vault vale nesta matéria.';

const contractRows=page=>page.evaluate(()=>[...document.querySelectorAll('#context-contract-items .contract-row')].map(row=>({
 name:row.querySelector('.ctx-name')?.textContent?.trim()||'',
 meta:row.querySelector('.ctx-meta')?.textContent?.trim()||'',
 icon:row.querySelector('.ctx-icon svg')?.getBoundingClientRect().width||0,
 caret:!!row.querySelector('.contract-open svg')
})));

async function openPanel(page){
 await openStudyContext(page);
 await page.waitForSelector('#context-dock:not([hidden])');
}

async function waitContractRow(page,name,meta){
 await page.waitForFunction(([wantedName,wantedMeta])=>[...document.querySelectorAll('#context-contract-items .contract-row')].some(row=>
  row.querySelector('.ctx-name')?.textContent?.trim()===wantedName&&row.querySelector('.ctx-meta')?.textContent?.trim()===wantedMeta
 ),[name,meta],{timeout:15000}).catch(async error=>{
  console.log('DIAG contrato',JSON.stringify(await contractRows(page)));
  throw Error(`${name} · ${meta}: ${error.message}`);
 });
}

await withArtifacts('tutor-contract',async ctx=>{
 const runtime=ctx.runtime=newRuntime('tutor-contract');
 const course=seedCourse(runtime,'calc');
 const other=seedCourse(runtime,'fis');
 const vault=path.join(runtime,'vault');
 fs.mkdirSync(vault,{recursive:true});
 fs.writeFileSync(path.join(course,'TUTOR.md'),COURSE_TEXT);
 fs.writeFileSync(path.join(vault,'TUTOR.md'),VAULT_TEXT);
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:vault,courses:[
  {id:'calc',name:'Cálculo',path:course},
  {id:'fis',name:'Física',path:other}
 ]});
 writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{study:{title:'',xopp:''}},fis:{study:{title:'',xopp:''}}}});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await resizeWindow(app,page,1440,900);
 await freezeMotion(page);

 /* ---------- contrato da matéria ---------- */
 await openPanel(page);
 await waitContractRow(page,'TUTOR.md da matéria','pasta da matéria');
 const rows=await contractRows(page);
 const tutorRow=rows.find(row=>row.name==='TUTOR.md da matéria');
 assert.ok(tutorRow,`a linha do TUTOR.md da matéria existe (${JSON.stringify(rows)})`);
 assert.equal(tutorRow.icon,16,'o ícone de arquivo tem 16px');
 assert.equal(tutorRow.caret,true,'a linha tem o › à direita');
 assert.ok(rows.some(row=>row.name==='LEARNER.md'&&row.meta==='padrão da Mesa'),'o LEARNER.md que cai no padrão também aparece, com a própria origem');
 assert.equal(await page.locator('#context-contract-group').textContent(),'Orienta o tutor','o grupo se chama Orienta o tutor');
 assert.equal(await page.locator('#context-contract-group').isVisible(),true,'o grupo fica logo depois de Vai com a mensagem');
 const goesBox=await page.locator('#context-goes').boundingBox();
 const contractBox=await page.locator('#context-contract-group').boundingBox();
 assert.ok(goesBox&&contractBox&&contractBox.y>goesBox.y,'Orienta o tutor vem depois de Vai com a mensagem');
 /* A linha do contrato tem o mesmo ritmo de nome e origem que as de "Vai com a mensagem". */
 const gaps=await page.evaluate(()=>[...document.querySelectorAll('#context-dock .ctx-row')].filter(row=>row.offsetParent).map(row=>{
  const name=row.querySelector('.ctx-name')?.getBoundingClientRect(),meta=row.querySelector('.ctx-meta')?.getBoundingClientRect();
  return name&&meta?Math.round(meta.top-name.bottom):null;
 }).filter(gap=>gap!==null));
 assert.ok(gaps.length>=2&&Math.max(...gaps)-Math.min(...gaps)<=1,`nome e origem com o mesmo respiro em todas as linhas (${gaps})`);
 await reviewShot(page,out,'claro-contexto-materia.png');
 await setTheme(page,'dark');
 await reviewShot(page,out,'escuro-contexto-materia.png');
 await setTheme(page,'light');

 /* ---------- leitura no mesmo painel ---------- */
 await page.locator('#context-contract-items .contract-row').first().click();
 await page.waitForSelector('#context-contract-read:not([hidden])');
 assert.equal(await page.locator('#context-dock-list').isHidden(),true,'a lista dá lugar à leitura');
 assert.equal(await page.locator('#context-dock .dock-head strong').isHidden(),true,'o título Contexto sai na leitura');
 assert.equal(await page.locator('#context-contract-back').isVisible(),true,'o Voltar aparece');
 assert.equal(await page.locator('#context-contract-back').textContent(),'Voltar','o botão diz Voltar');
 const backLook=await page.locator('#context-contract-back').evaluate(el=>{const cs=getComputedStyle(el);return {border:cs.borderTopWidth,background:cs.backgroundColor};});
 assert.equal(backLook.border,'0px','o Voltar é discreto, sem fio');
 assert.equal(backLook.background,'rgba(0, 0, 0, 0)','o Voltar não pinta fundo em repouso');
 assert.equal(await page.locator('#context-contract-origin').textContent(),'TUTOR.md · pasta da matéria','a linha pequena diz o arquivo e a origem');
 const readLook=await page.locator('#context-contract-text').evaluate(el=>{const cs=getComputedStyle(el);return {family:cs.fontFamily,size:cs.fontSize,line:cs.lineHeight};});
 assert.match(readLook.family,/STIX Two Text/,'o texto usa a fonte de leitura (serifa)');
 assert.equal(readLook.size,'15px','o texto usa 15px');
 assert.equal(readLook.line,'26px','o texto usa a altura de linha do mock');
 const readText=await page.locator('#context-contract-text').textContent();
 assert.match(readText,/O arquivo traz <b>marcação<\/b> que não vira negrito\./,'o texto do arquivo aparece literal');
 assert.equal(await page.locator('#context-contract-text b').count(),0,'o <b> do arquivo não vira negrito');
 assert.equal(await page.locator('#context-contract-text p').count(),2,'as quebras de parágrafo viram parágrafos');
 await reviewShot(page,out,'claro-leitura-aberta.png');
 await setTheme(page,'dark');
 await reviewShot(page,out,'escuro-leitura-aberta.png');
 await setTheme(page,'light');
 await page.locator('#context-contract-back').click();
 await page.waitForFunction(()=>document.querySelector('#context-contract-read').hidden);
 assert.equal(await page.locator('#context-dock-list').isVisible(),true,'Voltar retorna à lista');
 assert.equal(await page.evaluate(()=>document.activeElement?.querySelector('.ctx-name')?.textContent),'TUTOR.md da matéria','o foco volta à linha que abriu');

 /* ---------- troca de matéria: o vault assume ---------- */
 await page.locator('#course-tabs button[data-id="fis"]').click();
 await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="fis"]')?.classList.contains('active'));
 await statusOnline(page);
 await openPanel(page);
 await waitContractRow(page,'TUTOR.md','vault');
 const vaultRows=await contractRows(page);
 assert.ok(vaultRows.some(row=>row.name==='TUTOR.md'&&row.meta==='vault'),`a origem vault aparece embaixo (${JSON.stringify(vaultRows)})`);

 /* ---------- sem vault, o padrão da Mesa ---------- */
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.querySelector('#context-dock').hidden);
 fs.rmSync(path.join(vault,'TUTOR.md'));
 await openPanel(page);
 await waitContractRow(page,'TUTOR.md','padrão da Mesa');
 const defaultRows=await contractRows(page);
 assert.ok(defaultRows.some(row=>row.name==='TUTOR.md'&&row.meta==='padrão da Mesa'),`a origem padrão da Mesa aparece embaixo (${JSON.stringify(defaultRows)})`);
 assert.ok(defaultRows.some(row=>row.name==='LEARNER.md'&&row.meta==='padrão da Mesa'),'o LEARNER.md padrão também aparece');
 await reviewShot(page,out,'claro-contexto-padrao.png');
 await setTheme(page,'dark');
 await reviewShot(page,out,'escuro-contexto-padrao.png');
 await setTheme(page,'light');

 /* ---------- aba Livre: sem contrato ---------- */
 await page.locator('#course-tabs button[data-id="mesa-free"]').click();
 await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="mesa-free"]')?.classList.contains('active'),undefined,{timeout:30000});
 await statusOnline(page);
 await openPanel(page);
 await page.waitForFunction(()=>document.querySelector('#context-contract-items .contract-empty')?.textContent==='Sem contrato',undefined,{timeout:15000});
 assert.equal(await page.locator('#context-contract-items .contract-row').count(),0,'a Livre não lista arquivo nenhum');
 assert.equal(await page.locator('#context-contract-group').isVisible(),true,'o grupo continua à vista na Livre');
 await reviewShot(page,out,'claro-contexto-livre.png');
 await setTheme(page,'dark');
 await reviewShot(page,out,'escuro-contexto-livre.png');
 await setTheme(page,'light');

 assert.deepEqual(errors,[],'nenhum erro de página');
 console.log('PASS tutor-contract-ui — capturas em',out);
});
