'use strict';

const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');

/* #6: `npm ci` apaga e recria o `node_modules`. No Windows, um processo do
   Electron ainda vivo (MCP da Mesa via ELECTRON_RUN_AS_NODE, servidor do chat
   lateral, filho do app) trava `node_modules\electron\dist\electron.exe` e o
   ci morre com EPERM/EBUSY — o rollback reabre a versão antiga e o clique em
   "Atualizar" parece voltar para a mesma versão. Antes do ci, esperamos com
   prazo esses processos soltarem o `dist`; se o ci ainda falhar com trava de
   arquivo, repetimos com espera crescente. Nada é morto por nome: o processo
   que segurava vai para o log com pid e caminho. Só Windows muda; fora dele a
   espera não chama PowerShell e o ci continua sem nova tentativa.
   O worker copia este arquivo junto (`WORKER_FILES` do updater-worker.cjs). */

const LOCK_CODES=['EPERM','EBUSY','ENOTEMPTY'];
const ELECTRON_WAIT_TIMEOUT_MS=30000;
const ELECTRON_WAIT_POLL_MS=500;
const NPM_CI_RETRY_DELAYS_MS=[2000,5000,10000];
const execFileAsync=promisify(execFile);

/** @param {number} ms @returns {Promise<void>} */
function defaultSleep(ms){
 return new Promise(resolve=>setTimeout(resolve,ms));
}

/**
 * Pasta cujo executável do Electron trava o `node_modules` que o `npm ci` apaga.
 * @param {string} deskDir pasta em que o `npm ci` roda
 * @param {NodeJS.Platform} [platform] dono do caminho (o teste roda no Linux e
 *   injeta `win32`; o separador tem de ser o do Windows)
 * @returns {string}
 * @example electronDistDir('C:\\Summa\\desk','win32') // 'C:\\Summa\\desk\\node_modules\\electron\\dist'
 */
function electronDistDir(deskDir,platform=process.platform){
 const join=platform==='win32'?path.win32.join:path.join;
 return join(deskDir,'node_modules','electron','dist');
}

/**
 * Processos (pid + executável) a partir do JSON do PowerShell; vazio quando
 * não há nenhum. `ConvertTo-Json` devolve objeto quando só um processo casa.
 * @param {string} stdout
 * @returns {{pid:number,exe:string}[]}
 * @example parseElectronProcessList('[{"ProcessId":42,"ExecutablePath":"C:\\\\x\\\\electron.exe"}]')
 */
function parseElectronProcessList(stdout){
 const text=String(stdout||'').trim();
 if(!text)return [];
 let parsed;
 try{parsed=JSON.parse(text);}catch{return [];}
 const items=Array.isArray(parsed)?parsed:[parsed];
 return items
  .map(item=>({pid:Number(item&&item.ProcessId),exe:String(item&&item.ExecutablePath||'')}))
  .filter(item=>Number.isInteger(item.pid)&&item.pid>0&&item.exe);
}

/** @param {string} text @returns {string} literal do PowerShell */
function powerShellLiteral(text){
 return "'"+String(text).replace(/'/g,"''")+"'";
}

/* O curinga é escapado antes de receber `\*`: caminho com `[` ou `_` continua
   literal, e o `\*` cobre qualquer executável DENTRO do dist. Nada de mexer em
   `[Console]::OutputEncoding`: sem console (Electron + windowsHide) o setter
   pode falhar e derrubar a listagem; pid e caminho saem no JSON do mesmo jeito. */
function electronProcessScript(deskDir,platform){
 const root=powerShellLiteral(electronDistDir(deskDir,platform));
 return `$root=${root}; $pattern=[System.Management.Automation.WildcardPattern]::Escape($root)+'\\*'; Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like $pattern } | Select-Object ProcessId,ExecutablePath | ConvertTo-Json -Compress`;
}

/**
 * Processos vivos cujo executável mora dentro do `electron/dist` do app.
 * Só Windows consulta o PowerShell; fora dele responde vazio sem processo.
 * @param {string} deskDir pasta em que o `npm ci` roda
 * @param {{platform?:NodeJS.Platform, execFileFn?:Function}} [options]
 * @returns {Promise<{pid:number,exe:string}[]>}
 * @example await listElectronProcesses('C:\\Summa\\desk') // [{pid: 4321, exe: '…\\electron.exe'}]
 */
async function listElectronProcesses(deskDir,{platform=process.platform,execFileFn=execFileAsync}={}){
 if(platform!=='win32')return [];
 const result=await execFileFn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',electronProcessScript(deskDir,platform)],{timeout:15000,windowsHide:true,maxBuffer:4*1024*1024});
 return parseElectronProcessList(result&&result.stdout);
}

/** @param {{pid:number,exe:string}[]} processes @returns {string} */
function describeElectronProcesses(processes){
 return processes.map(item=>`pid ${item.pid} (${item.exe})`).join(', ');
}

/**
 * #6: no Windows, espera com prazo os processos do Electron soltarem o
 * `node_modules` antes do `npm ci`. Prazo esgotado não aborta o update: devolve
 * quem ainda estava vivo para o log e o ci tenta mesmo assim. Listagem que
 * falha (PowerShell ausente/sem permissão) também segue para o ci — a espera é
 * proteção, não portão.
 * @param {{deskDir:string, platform?:NodeJS.Platform, timeoutMs?:number, pollMs?:number,
 *   list?:typeof listElectronProcesses, sleep?:(ms:number)=>Promise<void>,
 *   now?:()=>number, log?:(line:string)=>void}} options
 * @returns {Promise<{ok:boolean, remaining:{pid:number,exe:string}[], unreadable?:boolean}>}
 * @example await waitForElectronProcesses({deskDir,log:console.log}) // {ok:true,remaining:[]}
 */
async function waitForElectronProcesses({deskDir,platform=process.platform,timeoutMs=ELECTRON_WAIT_TIMEOUT_MS,pollMs=ELECTRON_WAIT_POLL_MS,list=listElectronProcesses,sleep=defaultSleep,now=Date.now,log=()=>{}}={}){
 if(platform!=='win32')return {ok:true,remaining:[]};
 const started=now();
 let announced=false;
 for(;;){
  let remaining;
  try{remaining=await list(deskDir);}
  catch(error){
   log(`update: não deu para listar os processos do Electron (${String(error&&error.message||error)}) — seguindo para npm ci`);
   return {ok:true,remaining:[],unreadable:true};
  }
  if(!remaining.length)return {ok:true,remaining:[]};
  if(!announced){
   announced=true;
   log(`update: processo do Electron ainda segura o node_modules: ${describeElectronProcesses(remaining)} — esperando até ${timeoutMs} ms`);
  }
  if(now()-started>=timeoutMs){
   log(`update: prazo de ${timeoutMs} ms esgotado; ainda vivo(s): ${describeElectronProcesses(remaining)} — tentando npm ci mesmo assim`);
   return {ok:false,remaining};
  }
  await sleep(pollMs);
 }
}

/**
 * Código de trava de arquivo no erro do npm ci (propriedade `code` ou texto de
 * stderr/mensagem, porque o npm sai com código 1 e escreve EPERM no stderr).
 * @param {unknown} error
 * @returns {string} `EPERM`/`EBUSY`/`ENOTEMPTY`, ou '' quando não é trava
 * @example fileLockCode(Object.assign(Error('npm ci'),{stderr:'npm error code EBUSY'})) // 'EBUSY'
 */
function fileLockCode(error){
 const code=String(error&&error.code||'').toUpperCase();
 if(LOCK_CODES.includes(code))return code;
 const text=[error&&error.message,error&&error.stderr,error&&error.stdout]
  .map(value=>String(value||'')).join('\n').toUpperCase();
 return LOCK_CODES.find(candidate=>new RegExp(`\\b${candidate}\\b`).test(text))||'';
}

/**
 * #6: `npm ci` com nova tentativa só no Windows e só em trava de arquivo
 * (EPERM/EBUSY/ENOTEMPTY), com espera crescente antes de cair no rollback.
 * @param {{deskDir:string, run:Function, platform?:NodeJS.Platform,
 *   log?:(line:string)=>void, sleep?:(ms:number)=>Promise<void>,
 *   delays?:number[]}} options
 * @returns {Promise<{attempts:number}>}
 * @example await npmCiWithRetry({deskDir,run,platform:'win32',log}) // {attempts:2}
 */
async function npmCiWithRetry({deskDir,run,platform=process.platform,log=()=>{},sleep=defaultSleep,delays=NPM_CI_RETRY_DELAYS_MS}={}){
 const attempts=delays.length+1;
 for(let attempt=1;;attempt++){
  try{
   await run('npm',['ci'],{cwd:deskDir,timeout:20*60*1000});
   return {attempts:attempt};
  }catch(error){
   const code=platform==='win32'?fileLockCode(error):'';
   if(!code||attempt>=attempts)throw error;
   const delay=delays[attempt-1];
   log(`update: npm ci falhou com trava de arquivo (${code}; tentativa ${attempt}/${attempts}) — tentando de novo em ${delay} ms`);
   await sleep(delay);
  }
 }
}

module.exports={LOCK_CODES,ELECTRON_WAIT_TIMEOUT_MS,ELECTRON_WAIT_POLL_MS,NPM_CI_RETRY_DELAYS_MS,defaultSleep,electronDistDir,parseElectronProcessList,listElectronProcesses,describeElectronProcesses,waitForElectronProcesses,fileLockCode,npmCiWithRetry};
