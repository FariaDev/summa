/* Contrato do tutor (#180): a resolução de TUTOR.md/LEARNER.md usada pelo painel
   Contexto e pelo prompt. Pastas temporárias; nada toca a mesa de quem testa. */
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {MAX_CONTRACT_BYTES,resolveTutorContract}=require('../tutor-contract.cjs');
const {createTutorEngineHost}=require('../tutor-engine-host.cjs');

const roots=new Set();
after(()=>{for(const root of roots)fs.rmSync(root,{recursive:true,force:true});});

function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-tutor-contract-'));
 roots.add(root);
 const course=path.join(root,'course');
 const vault=path.join(root,'vault');
 const deskDir=path.join(root,'desk');
 fs.mkdirSync(course,{recursive:true});
 fs.mkdirSync(vault,{recursive:true});
 fs.mkdirSync(path.join(deskDir,'templates'),{recursive:true});
 const write=(dir,name,text)=>fs.writeFileSync(path.join(dir,name),text);
 return {root,course,vault,deskDir,write};
}

test('a pasta da matéria vence o vault e o padrão, arquivo por arquivo',()=>{
 const f=fixture();
 f.write(f.course,'TUTOR.md','curso TUTOR');
 f.write(f.course,'LEARNER.md','curso LEARNER');
 f.write(f.vault,'TUTOR.md','vault TUTOR');
 f.write(f.vault,'LEARNER.md','vault LEARNER');
 f.write(path.join(f.deskDir,'templates'),'TUTOR.md','padrão TUTOR');
 f.write(path.join(f.deskDir,'templates'),'LEARNER.md','padrão LEARNER');
 assert.deepEqual(resolveTutorContract({courseId:'calc',course:f.course,vaultPath:f.vault,deskDir:f.deskDir,freeId:'mesa-free'}),[
  {name:'TUTOR.md',origin:'course',text:'curso TUTOR'},
  {name:'LEARNER.md',origin:'course',text:'curso LEARNER'},
 ]);
});

test('sem arquivo na matéria, vale o vault',()=>{
 const f=fixture();
 f.write(f.vault,'TUTOR.md','vault TUTOR');
 f.write(f.vault,'LEARNER.md','vault LEARNER');
 f.write(path.join(f.deskDir,'templates'),'TUTOR.md','padrão TUTOR');
 f.write(path.join(f.deskDir,'templates'),'LEARNER.md','padrão LEARNER');
 assert.deepEqual(resolveTutorContract({courseId:'calc',course:f.course,vaultPath:f.vault,deskDir:f.deskDir,freeId:'mesa-free'}),[
  {name:'TUTOR.md',origin:'vault',text:'vault TUTOR'},
  {name:'LEARNER.md',origin:'vault',text:'vault LEARNER'},
 ]);
});

test('sem matéria nem vault, vale o padrão da Mesa',()=>{
 const f=fixture();
 f.write(path.join(f.deskDir,'templates'),'TUTOR.md','padrão TUTOR');
 f.write(path.join(f.deskDir,'templates'),'LEARNER.md','padrão LEARNER');
 assert.deepEqual(resolveTutorContract({courseId:'calc',course:f.course,vaultPath:f.vault,deskDir:f.deskDir,freeId:'mesa-free'}),[
  {name:'TUTOR.md',origin:'default',text:'padrão TUTOR'},
  {name:'LEARNER.md',origin:'default',text:'padrão LEARNER'},
 ]);
});

test('a aba Livre não tem contrato',()=>{
 const f=fixture();
 f.write(f.course,'TUTOR.md','curso TUTOR');
 f.write(path.join(f.deskDir,'templates'),'TUTOR.md','padrão TUTOR');
 f.write(path.join(f.deskDir,'templates'),'LEARNER.md','padrão LEARNER');
 assert.deepEqual(resolveTutorContract({courseId:'mesa-free',course:f.course,vaultPath:f.vault,deskDir:f.deskDir,freeId:'mesa-free'}),[]);
});

test('arquivo acima de 64 KiB é pulado, sem cair para o próximo candidato',()=>{
 const f=fixture();
 f.write(f.course,'TUTOR.md','x'.repeat(MAX_CONTRACT_BYTES+1));
 f.write(f.vault,'TUTOR.md','vault TUTOR');
 f.write(path.join(f.deskDir,'templates'),'TUTOR.md','padrão TUTOR');
 f.write(path.join(f.deskDir,'templates'),'LEARNER.md','padrão LEARNER');
 assert.deepEqual(resolveTutorContract({courseId:'calc',course:f.course,vaultPath:f.vault,deskDir:f.deskDir,freeId:'mesa-free'}),[
  {name:'LEARNER.md',origin:'default',text:'padrão LEARNER'},
 ]);
});

test('no limite de 64 KiB o arquivo entra',()=>{
 const f=fixture();
 const text='y'.repeat(MAX_CONTRACT_BYTES);
 f.write(f.course,'TUTOR.md',text);
 assert.deepEqual(resolveTutorContract({courseId:'calc',course:f.course,vaultPath:f.vault,deskDir:f.deskDir,freeId:'mesa-free'}),[
  {name:'TUTOR.md',origin:'course',text},
 ]);
});

test('claudeProfile continua devolvendo o mesmo {name,text}',()=>{
 const f=fixture();
 f.write(f.course,'TUTOR.md','curso TUTOR');
 f.write(f.vault,'LEARNER.md','vault LEARNER');
 f.write(path.join(f.deskDir,'templates'),'TUTOR.md','padrão TUTOR');
 f.write(path.join(f.deskDir,'templates'),'LEARNER.md','padrão LEARNER');
 const runtime=path.join(f.root,'runtime');
 fs.mkdirSync(runtime,{recursive:true});
 const live={config:{vaultPath:f.vault},courseId:'calc',course:f.course,state:{},languageHost:{tutor:()=>'pt-BR'}};
 const host=createTutorEngineHost({live,runtime,deskDir:f.deskDir,TEST_MODE:false,FREE_ID:'mesa-free'});
 const expected=resolveTutorContract({courseId:'calc',course:f.course,vaultPath:f.vault,deskDir:f.deskDir,freeId:'mesa-free'})
  .map(entry=>({name:entry.name,text:entry.text}));
 assert.deepEqual(host.claudeProfile(),expected);
 assert.deepEqual(host.claudeProfile(),[
  {name:'TUTOR.md',text:'curso TUTOR'},
  {name:'LEARNER.md',text:'vault LEARNER'},
 ]);
 live.courseId='mesa-free';
 assert.deepEqual(host.claudeProfile(),[]);
});
