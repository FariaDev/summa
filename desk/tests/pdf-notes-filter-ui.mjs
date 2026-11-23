/* Filtro das Notas do material: uma nota recém-salva em outra página não some
   atrás do filtro, e um filtro cuja página ficou sem notas deixa de esconder o
   resto da lista (handoff da 1.4.0, seção 6). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,seedNativeSession,tinyPdfPages,writeConfigJson,writeDeskJson,launchDesk,freezeMotion,reviewShot,screenshotDirectory} from './helpers.mjs';

const require=createRequire(import.meta.url);
const out=screenshotDirectory('pdf-notes-filter');

await withArtifacts('pdf-notes-filter',async ctx=>{
 const runtime=ctx.runtime=newRuntime('pdf-notes-filter');
 const course=seedCourse(runtime,'synthetic');
 const pdf=path.join(course,'Alpha.pdf');
 fs.writeFileSync(pdf,tinyPdfPages(3,'Alpha'));
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,language:{ui:'en',tutor:'en'},courses:[{id:'synthetic',name:'Synthetic course',path:course}]});
 const session=seedNativeSession(runtime,[],{courseId:'synthetic'});
 writeDeskJson(runtime,{releaseNotesSeen:require('../package.json').version,courseId:'synthetic',session,courseStates:{synthetic:{session,pdfs:[{path:pdf,page:1}]}}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 await page.waitForSelector('.pdf-page[data-rendered] canvas');
 await freezeMotion(page);
 const gotIt=page.getByRole('button',{name:'Got it',exact:true});
 if(await gotIt.isVisible())await gotIt.click();
 await page.locator('#study-menu .nav-trigger').click();
 await page.locator('#study-menu #study-notes-open').click();
 await page.waitForFunction(()=>document.querySelector('#study-notes-dialog')?.open);
 const cards=()=>page.locator('.study-note-card').allTextContents();
 const addNote=async(text,at)=>{
  await page.locator('#study-note-page').fill(String(at));
  await page.locator('#study-note-note').fill(text);
  await page.locator('#study-note-save').click();
  await page.waitForFunction(note=>!document.querySelector('#study-note-note').value&&window.desk.studyNotesRead({}).then(result=>result.items.some(item=>item.note===note)),text);
 };
 await addNote('Note on page one.',1);
 await addNote('Note on page two.',2);
 await page.locator('#study-notes-page-filter').selectOption('1');
 assert.deepEqual((await cards()).map(card=>card.includes('page one')),[true]);

 await addNote('New note on page three.',3);
 const afterAdd=await cards();
 await reviewShot(page,out,'after-add.png');
 assert.ok(afterAdd.some(card=>card.includes('New note on page three.')),`the note just saved must be listed: ${JSON.stringify(afterAdd)}`);
 assert.equal(await page.locator('#study-notes-page-filter').inputValue(),'');

 await page.locator('#study-notes-page-filter').selectOption('3');
 await page.evaluate(()=>{window.confirm=()=>true;});
 await page.locator('.study-note-card',{hasText:'New note on page three.'}).locator('.study-note-remove').click();
 await page.waitForFunction(()=>window.desk.studyNotesRead({}).then(result=>result.items.length===2));
 await page.waitForFunction(()=>document.querySelectorAll('.study-note-card').length===2);
 await reviewShot(page,out,'after-remove.png');
 assert.equal(await page.locator('#study-notes-page-filter').inputValue(),'');
});
console.log('pdf-notes-filter-ui: PASS — a nota salva aparece mesmo com filtro de outra página, e filtro de página sem notas volta a Todas');
