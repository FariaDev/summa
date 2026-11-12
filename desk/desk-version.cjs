'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFile,execFileSync}=require('node:child_process');
const {promisify}=require('node:util');

const execFileAsync=promisify(execFile);

/* Rótulo de versão do Sobre: versão do app (ou do package.json) e, num clone,
   o `git describe`. Calculado uma vez. Saiu do main.cjs na #43 fase 2.
   O `prime` faz a mesma conta sem `execFileSync`: o `init` do renderer espera
   essa promessa e o processo principal não fica parado no git (#desempenho). */

/**
 * @param {{app:{getVersion:()=>string}, deskDir:string}} options app do Electron e pasta desk/
 * @returns {{label:()=>string, prime:()=>Promise<string>}} rótulo memorizado, como "0.5.0 ca681f7-dirty"
 * @example const {label,prime}=createDeskVersionLabel({app,deskDir}); await prime(); label();
 */
function createDeskVersionLabel({app,deskDir}){
 let deskVersionMemo=null,priming=null;
 function baseVersion(){
  let version='';
  try{version=app.getVersion()||'';}catch{/* sem versão do app: cai no package.json */}
  if(!version){try{version=require('./package.json').version||'';}catch{/* sem versão: o rótulo fica vazio */}}
  return version;
 }
 function repoHasGit(version){try{return !!version&&fs.existsSync(path.join(deskDir,'..','.git'));}catch{return false;}}
 function label(){
  if(deskVersionMemo!=null)return deskVersionMemo;
  const version=baseVersion();
  let suffix='';
  try{
   if(repoHasGit(version))suffix=execFileSync('git',['describe','--always','--dirty'],{cwd:path.join(deskDir,'..'),timeout:5000}).toString().trim();
  }catch{/* sem git ou timeout: o rótulo fica sem sufixo */}
  deskVersionMemo=suffix?`${version} ${suffix}`:version;
  return deskVersionMemo;
 }
 function prime(){
  if(deskVersionMemo!=null)return Promise.resolve(deskVersionMemo);
  if(priming)return priming;
  const version=baseVersion();
  priming=Promise.resolve()
   .then(async()=>{
    let suffix='';
    try{
     if(repoHasGit(version))suffix=String((await execFileAsync('git',['describe','--always','--dirty'],{cwd:path.join(deskDir,'..'),timeout:5000})).stdout||'').trim();
    }catch{/* sem git ou timeout: o rótulo fica sem sufixo */}
    /* O `label` síncrono pode ter vencido a corrida: o primeiro resultado vale. */
    if(deskVersionMemo==null)deskVersionMemo=suffix?`${version} ${suffix}`:version;
    return deskVersionMemo;
   })
   .finally(()=>{priming=null;});
  return priming;
 }
 return {label,prime};
}

/**
 * A versão que decide a janela de novidades. Em teste, só a da chave
 * `LEARNING_DESK_RELEASE_VERSION`: sem ela, os testes de janela não dependem do
 * número do `package.json` nem ganham um modal a cada release.
 * @param {string} label rótulo do Sobre
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 * @example releaseNotesVersion('1.1.0 ca681f7-dirty', {}) // '1.1.0'
 */
function releaseNotesVersion(label,env=process.env){
 if(env.DESK_TEST==='1')return String(env.LEARNING_DESK_RELEASE_VERSION||'');
 return String(label||'').split(' ')[0];
}

module.exports={createDeskVersionLabel,releaseNotesVersion};
