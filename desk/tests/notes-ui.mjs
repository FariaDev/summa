/* Nota sugerida na janela (#139): o cartão aparece com Guardar e Descartar,
   o teclado chega aos botões, Guardar grava em `Notas/` e o cartão muda de
   estado; Descartar não cria arquivo e o estado sobrevive ao reload. O texto
   da nota é não confiável e entra como texto, nunca como HTML. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {launchDesk,newRuntime,seedCourse,seedNativeSession,statusOnline,withArtifacts,writeConfigJson,writeDeskJson} from './helpers.mjs';

const require=createRequire(import.meta.url);
const cardStore=require('../card-store.cjs');

await withArtifacts('nota-sugerida',async ctx=>{
 const runtime=ctx.runtime=newRuntime('nota-sugerida');
 seedCourse(runtime,'Calculus I');
 const course=path.join(runtime,'learning','Courses','Calculus I');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculus I',name:'Cálculo I',path:course}]});
 const session=seedNativeSession(runtime,[{role:'assistant',content:[{type:'text',text:'Vamos anotar os limites.'}]}],{courseId:'Calculus I'});
 writeDeskJson(runtime,{session,courseId:'Calculus I'});
 const savedNote=cardStore.createNoteCard(runtime,session,{title:'Derivadas',content:'# Regra\n<b>não é HTML</b> e <img src=x onerror=alert(1)>'});
 const dismissedNote=cardStore.createNoteCard(runtime,session,{title:'Limites',content:'# Outra nota'});
 const pendingNote=cardStore.createNoteCard(runtime,session,{title:'Continuidade',content:'# Ainda pendente'});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 await statusOnline(page);
 await page.waitForFunction(()=>document.querySelectorAll('.note-card').length===3,undefined,{timeout:30000});

 const savedCard=page.locator(`[data-tool="${savedNote.id}"]`);
 const dismissedCard=page.locator(`[data-tool="${dismissedNote.id}"]`);
 const pendingCard=page.locator(`[data-tool="${pendingNote.id}"]`);
 assert.match(await savedCard.locator('.note-title').textContent(),/Derivadas/);
 assert.match(await savedCard.locator('.note-content').textContent(),/não é HTML/);
 assert.equal(await savedCard.locator('.note-content b').count(),0,'o conteúdo é texto, não HTML');
 assert.equal(await savedCard.locator('.note-content img').count(),0,'nem imagem/evento do conteúdo');
 assert.equal(await savedCard.locator('.note-save').count(),1);
 assert.equal(await savedCard.locator('.note-dismiss').count(),1);
 assert.equal(await dismissedCard.locator('.note-save').count(),1);
 assert.equal(await pendingCard.locator('.note-save').count(),1);

 /* Teclado: os dois botões são alcançáveis e o foco aciona o Guardar. */
 const saveButton=savedCard.locator('.note-save');
 assert.ok(await saveButton.evaluate(el=>el.tabIndex>=0),'Guardar entra na ordem do Tab');
 await saveButton.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('note-save')),true);
 await page.keyboard.press('Enter');
 await savedCard.locator('.note-status').waitFor({timeout:10000});
 const savedText=await savedCard.locator('.note-status').textContent();
 assert.match(savedText,/Derivadas\.md/,'o cartão mostra onde guardou');
 const file=path.join(course,'Notas','Derivadas.md');
 assert.equal(fs.readFileSync(file,'utf8'),'# Regra\n<b>não é HTML</b> e <img src=x onerror=alert(1)>');
 assert.equal(await savedCard.locator('.note-save').count(),0,'guardada não oferece Guardar de novo');

 /* Descartar não cria arquivo e o cartão fica no estado descartado. */
 const dismissButton=dismissedCard.locator('.note-dismiss');
 await dismissButton.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('note-dismiss')),true);
 await page.keyboard.press('Enter');
 await dismissedCard.locator('.note-status').waitFor({timeout:10000});
 assert.match(await dismissedCard.locator('.note-status').textContent(),/descartada/i);
 assert.equal(fs.existsSync(path.join(course,'Notas','Limites.md')),false,'descartar não grava');

 /* Reabrir a conversa mostra o estado certo dos três cartões. */
 await page.reload();
 await page.waitForFunction(()=>document.querySelectorAll('.note-card').length===3,undefined,{timeout:30000});
 const savedAfter=page.locator(`[data-tool="${savedNote.id}"]`);
 const dismissedAfter=page.locator(`[data-tool="${dismissedNote.id}"]`);
 const pendingAfter=page.locator(`[data-tool="${pendingNote.id}"]`);
 assert.match(await savedAfter.locator('.note-status').textContent(),/Derivadas\.md/);
 assert.match(await dismissedAfter.locator('.note-status').textContent(),/descartada/i);
 assert.equal(await pendingAfter.locator('.note-save').count(),1,'a pendente continua pendente depois do reload');
 assert.match(await pendingAfter.locator('.note-content').textContent(),/Ainda pendente/);
 assert.equal(await page.locator('.note-save').count(),1);
 assert.equal(await page.locator('.note-dismiss').count(),1);
});
