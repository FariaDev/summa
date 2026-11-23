import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,tinyPdf,writeConfigJson} from './helpers.mjs';

await withArtifacts('pdf-find-clear',async ctx=>{
 const runtime=ctx.runtime=newRuntime('pdf-find-clear');
 const course=seedCourse(runtime,'Calculus');
 fs.writeFileSync(path.join(course,'Exercises.pdf'),tinyPdf('Find the integral.',3));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculus',name:'Calculus',path:course}]});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 const panel=page.locator('.pdf-panel').first();
 const input=panel.locator('.pdf-find input');
 const count=panel.locator('.find-count');
 const highlights=panel.locator('.pdf-hl');
 await panel.locator('.textLayer span').first().waitFor();
 await panel.locator('.find-toggle').click();
 await input.fill('integral');
 await panel.locator('.pdf-find button').click();
 await highlights.first().waitFor();
 assert.equal(await count.textContent(),'1/3');

 await input.fill('');
 assert.equal(await count.textContent(),'','clearing Find removes the result count without submitting');
 assert.equal(await count.isHidden(),true);
 await highlights.first().waitFor({state:'detached'});
 assert.equal(await panel.locator('.pdf-find').isVisible(),true);
});
