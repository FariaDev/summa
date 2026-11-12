// @ts-check
'use strict';

const fs=require('node:fs');
const path=require('node:path');

/* Contrato do tutor (#180): o TUTOR.md/LEARNER.md que orienta a conversa. A
   escolha é uma só — pasta da matéria, vault e templates da Mesa, nessa ordem —
   e o prompt do tutor e o painel Contexto leem daqui, para a tela nunca dizer
   uma coisa e o modelo receber outra. Arquivo acima de 64 KiB não entra. */

/** @typedef {'course'|'vault'|'default'} ContractOrigin */
/** @typedef {{name: string, origin: ContractOrigin, text: string}} TutorContractFile */

const CONTRACT_FILES=Object.freeze(['TUTOR.md','LEARNER.md']);
const MAX_CONTRACT_BYTES=65536;

/**
 * Resolve os contratos que orientam o tutor na matéria ativa.
 * Na aba Livre não há contrato. Para cada arquivo, vale o primeiro que existe
 * entre a pasta da matéria, o vault e os templates da Mesa; o que passar de
 * `MAX_CONTRACT_BYTES` é pulado (sem cair para o próximo candidato).
 * @param {{courseId?: string, course?: string, vaultPath?: string, deskDir?: string, freeId?: string}} facts
 * @returns {TutorContractFile[]} um item por arquivo usado, sem caminho absoluto
 * @example resolveTutorContract({courseId: 'calc', course: '/cursos/calc', vaultPath: '/vault', deskDir: '/desk', freeId: 'mesa-free'})
 */
function resolveTutorContract({courseId='',course='',vaultPath='',deskDir='',freeId=''}={}){
 if(freeId&&courseId===freeId)return [];
 /** @type {TutorContractFile[]} */
 const files=[];
 for(const name of CONTRACT_FILES){
  /** @type {Array<{origin: ContractOrigin, file: string}>} */
  const candidates=[];
  if(course)candidates.push({origin:'course',file:path.join(course,name)});
  if(vaultPath)candidates.push({origin:'vault',file:path.join(vaultPath,name)});
  if(deskDir)candidates.push({origin:'default',file:path.join(deskDir,'templates',name)});
  const selected=candidates.find(candidate=>fs.existsSync(candidate.file));
  if(!selected)continue;
  const stats=fs.statSync(selected.file);
  if(!stats.isFile()||stats.size>MAX_CONTRACT_BYTES)continue;
  files.push({name,origin:selected.origin,text:fs.readFileSync(selected.file,'utf8')});
 }
 return files;
}

module.exports={MAX_CONTRACT_BYTES,resolveTutorContract};
