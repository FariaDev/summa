import test from 'node:test';
import assert from 'node:assert/strict';
import {launchDesk,newRuntime} from './helpers.mjs';

test('Markdown assets distinguish literal filesystem names from file URL suffixes',async()=>{
 const app=await launchDesk({runtime:newRuntime('markdown-assets')});
 try{
  const page=await app.firstWindow();
  await page.waitForLoadState('load');
  const result=await page.evaluate(async()=>{
   const {assetLocalPath,markup}=await import('./src/markdown.mjs');
   const paths=['/learning/Aula #3.png','/learning/100%25.png','file:///learning/Aula%20%233.png?download=1#preview'];
   return {
    paths:paths.map(assetLocalPath),
    figures:paths.map(source=>markup(`![figure](<${source}>)`).includes('data-asset=')),
    rejected:['',null,'https://example.com/image.png','/learning/file.txt','/learning/line\nbreak.png'].map(assetLocalPath)
   };
  });
  assert.deepEqual(result.paths,['/learning/Aula #3.png','/learning/100%25.png','file:///learning/Aula%20%233.png?download=1#preview']);
  assert.deepEqual(result.figures,[true,true,true]);
  assert.deepEqual(result.rejected,['','','','','']);
 }finally{await app.close();}
});
