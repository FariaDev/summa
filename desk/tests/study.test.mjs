import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnFakeXournalpp} from './fake-xournalpp-spawn.mjs';
const {authorizeRestoredStudy}=createRequire(import.meta.url)('../study.cjs');

test('a persisted Xournal file is reauthorized when its session is restored',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'desk-study-'));
 try{
  const xopp=path.join(dir,'tentativa.xopp');fs.writeFileSync(xopp,'test');
  const allowed=new Set();const restored=authorizeRestoredStudy({title:'Lista 2 · 7b',xopp},allowed);
  assert.equal(restored.xopp,xopp);assert.equal(allowed.has(xopp),true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('restoration rejects missing files and non-Xournal extensions',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'desk-study-invalid-'));
 try{
  const pdf=path.join(dir,'tentativa.pdf');fs.writeFileSync(pdf,'test');
  for(const xopp of [pdf,path.join(dir,'missing.xopp')]){
   const allowed=new Set();const restored=authorizeRestoredStudy({xopp},allowed);
   assert.equal(restored.xopp,'');assert.equal(allowed.size,0);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('restauração atrás de symlink guarda o canônico e o ler_caderno lê',async ()=>{
 const {gzipSync}=await import('node:zlib');
 const {readNotebookPage}=await import('../src/extensions/mesa-mcp/notebook-tool.mjs');
 const {fileURLToPath}=await import('node:url');
 const FAKE=path.join(path.dirname(fileURLToPath(import.meta.url)),'fake-xournalpp.mjs');
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'desk-study-sym-'));
 try{
  const xml=`<?xml version="1.0" standalone="no"?>\n<xournal version="4">\n<page width="595.00" height="842.00">\n<background type="solid" color="#ffffffff" style="plain"/>\n<layer>\n<text fn="" size="12" color="#000000" font="Sans" x="100.00" y="100.00">Página</text>\n</layer>\n</page>\n</xournal>\n`;
  const real=path.join(base,'real','aula.xopp');
  fs.mkdirSync(path.dirname(real));fs.writeFileSync(real,gzipSync(xml));
  const link=path.join(base,'cofre','aula.xopp');
  fs.mkdirSync(path.dirname(link));fs.symlinkSync(real,link);
  const allowed=new Set();const restored=authorizeRestoredStudy({xopp:link},allowed);
  assert.equal(restored.xopp,link);
  assert.equal(allowed.has(fs.realpathSync.native(real)),true,'o canônico entra na lista');
  const ok=await readNotebookPage({caminho:link,pagina:1},{allowedXopp:[...allowed],xournalPath:FAKE,spawnProcess:spawnFakeXournalpp});
  assert.equal(ok.page,1);assert.equal(ok.total,1);
 }finally{fs.rmSync(base,{recursive:true,force:true});}
});
