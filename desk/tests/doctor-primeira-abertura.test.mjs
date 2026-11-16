/* #89: logo depois do `npm run setup`, sem config e sem matéria, o doctor
   acusava vault, TUTOR.md, LEARNER.md e matérias como ✗ — mas elas só existem
   depois da primeira abertura do app. Antes dela são pendentes (`…`) e não
   contam como falha; depois dela, faltando qualquer uma, continuam ✗. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {doctorChecks,doctorText,doctorExitCode} from '../doctor-checks.mjs';

const FIRST_RUN_NAMES=['Vault / pasta de dados','Política TUTOR.md','Política LEARNER.md','Matérias configuradas'];
const PENDING_DETAIL='abra o app e crie a matéria';

/* Um data dir temporário por teste: o config.json e o runtime ficam nele. */
function scenario(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-doctor-89-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const runtime=path.join(root,'runtime');
 fs.mkdirSync(runtime,{recursive:true});
 const env={...process.env,LEARNING_DESK_RUNTIME:runtime,LEARNING_VAULT:''};
 const firstRunRows=config=>{
  fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify(config));
  return doctorChecks({env,home:root}).rows.filter(row=>FIRST_RUN_NAMES.includes(row.name));
 };
 return {root,firstRunRows};
}

test('antes da primeira abertura as quatro linhas ficam pendentes e não falham (#89)',(t)=>{
 const {firstRunRows}=scenario(t);
 const rows=firstRunRows({vaultPath:''});
 assert.deepEqual(rows.map(row=>[row.ok,row.pending]),FIRST_RUN_NAMES.map(()=>[false,true]),'as quatro linhas são pendentes');
 assert.deepEqual(rows.map(row=>row.detail),FIRST_RUN_NAMES.map(()=>PENDING_DETAIL),'o texto manda abrir o app e criar a matéria');
 assert.equal(doctorText(rows),[
  `… Vault / pasta de dados: ${PENDING_DETAIL}`,
  `… Política TUTOR.md: ${PENDING_DETAIL}`,
  `… Política LEARNER.md: ${PENDING_DETAIL}`,
  `… Matérias configuradas: ${PENDING_DETAIL}`,
 ].join('\n')+'\n\nSetup learning pronto.','pendente não entra na conta nem no resumo');
 assert.equal(doctorExitCode(rows),0,'pendente não faz o doctor sair com 1');
});

test('depois da primeira abertura, zero matérias continua ✗ e sai com 1 (#89)',(t)=>{
 const {root,firstRunRows}=scenario(t);
 const vault=path.join(root,'vault');
 fs.mkdirSync(vault);
 for(const name of ['TUTOR.md','LEARNER.md'])fs.writeFileSync(path.join(vault,name),'');
 const rows=firstRunRows({vaultPath:vault});
 const materias=rows.find(row=>row.name==='Matérias configuradas');
 assert.deepEqual([materias.ok,materias.pending],[false,undefined],'matéria faltando não é pendente');
 assert.equal(materias.detail,'0 encontrada(s)','o detalhe continua o de antes');
 assert.equal(rows.filter(row=>!row.ok&&!row.pending).length,1,'só a matéria falta');
 assert.match(doctorText(rows),/✗ Matérias configuradas: 0 encontrada\(s\)/);
 assert.match(doctorText(rows),/1 verificação\(ões\) precisa\(m\) de atenção\./);
 assert.equal(doctorExitCode(rows),1,'falha de verdade faz o doctor sair com 1');
});

test('depois da primeira abertura, vault inexistente e políticas ausentes continuam ✗ (#89)',(t)=>{
 const {root,firstRunRows}=scenario(t);
 const vault=path.join(root,'sumiu');
 const rows=firstRunRows({vaultPath:vault});
 assert.deepEqual(rows.map(row=>[row.ok,!!row.pending]),FIRST_RUN_NAMES.map(()=>[false,false]),'nenhuma das quatro vira pendente');
 assert.equal(rows[0].detail,vault,'o vault configurado ausente mostra o caminho, como antes');
 assert.match(doctorText(rows),/✗ Política TUTOR\.md: .*TUTOR\.md/);
 assert.equal(doctorExitCode(rows),1);
});

test('com matéria já criada, vault vazio deixa de ser pendente (#89)',(t)=>{
 const {root,firstRunRows}=scenario(t);
 const course=path.join(root,'materia');
 fs.mkdirSync(course);
 const rows=firstRunRows({vaultPath:'',courses:[{id:'materia',name:'Matéria',path:course}]});
 const vault=rows.find(row=>row.name==='Vault / pasta de dados');
 assert.deepEqual([vault.ok,vault.pending],[false,undefined],'matéria criada vence o estado de primeira abertura');
 assert.equal(vault.detail,'não configurado');
 assert.equal(rows.find(row=>row.name==='Matérias configuradas').ok,true);
 assert.equal(doctorExitCode(rows),1,'vault ausente depois da abertura é falha');
});
