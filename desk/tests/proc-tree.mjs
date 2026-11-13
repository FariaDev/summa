/* Árvore de processos de um teste, para ninguém sobrar vivo.

   O Playwright sobe o Electron em grupo de processo próprio (`detached`) e só o
   mata no `exit` do Node. Se o teste morre por sinal (SIGKILL do corredor) o
   Electron fica órfão; se recebe SIGTERM, o Playwright tenta fechar o app com
   educação e espera para sempre quando o app não responde. Aqui a limpeza é
   por SIGKILL, na árvore inteira, lida do `ps` antes de qualquer morte (depois,
   os órfãos já foram adotados pelo launchd e somem da árvore).

   Cada processo é identificado por pid + hora de início, para um pid reciclado
   nunca levar o SIGKILL de outro.

   O `opencode serve` é `detached`, fora do grupo do Electron: `closeApp` lê o
   ledger do runtime e mata o pid registrado com a mesma prova do produto
   (pid + hora de início + argumentos do serve da Mesa) (#105). */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {readEntry,readProcessInfo,isAnnotatedServe,killGroup}=require('../src/agents/opencode-orphans.cjs');

const WIN=process.platform==='win32';

/* Todos os processos: pid, pai, grupo e início. Sem `ps` (Windows), vazio. */
export function processTable(){
 if(WIN)return [];
 let out;
 try{out=execFileSync('ps',['-A','-o','pid=,ppid=,pgid=,lstart='],{encoding:'utf8',maxBuffer:16*1024*1024});}catch{return [];}
 const rows=[];
 for(const line of out.split('\n')){
  const m=line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s*$/);
  if(m)rows.push({pid:+m[1],ppid:+m[2],pgid:+m[3],start:m[4]});
 }
 return rows;
}

/* Descendentes de `root` (sem ele), mais os membros dos grupos que algum
   descendente lidera — o Electron do Playwright é líder do próprio grupo. */
export function descendants(root,table=processTable()){
 const children=new Map();
 for(const row of table){
  if(!children.has(row.ppid))children.set(row.ppid,[]);
  children.get(row.ppid).push(row);
 }
 const found=new Map(),queue=[root];
 while(queue.length){
  for(const row of children.get(queue.shift())||[]){
   if(found.has(row.pid))continue;
   found.set(row.pid,row);queue.push(row.pid);
  }
 }
 const leaders=new Set([...found.values()].filter(row=>row.pid===row.pgid).map(row=>row.pid));
 for(const row of table)if(leaders.has(row.pgid)&&row.pid!==root&&!found.has(row.pid))found.set(row.pid,row);
 return [...found.values()];
}

/* SIGKILL em quem ainda é o mesmo processo (pid + início). Devolve os mortos. */
export function killRows(rows){
 if(!rows.length)return [];
 const alive=new Map(processTable().map(row=>[row.pid,row]));
 const killed=[];
 for(const row of rows){
  const now=alive.get(row.pid);
  if(!now||now.start!==row.start)continue;
  try{process.kill(row.pid,'SIGKILL');killed.push(row.pid);}catch{/* já morreu */}
 }
 return killed;
}

/* Mata a árvore inteira abaixo de `root` (no Windows, `taskkill /T`). */
export function killTree(root){
 if(WIN){
  /* `/T /F` pode pendurar num filho de console preso; o killGroup do produto
     já usa prazo, e o fechamento do teste não pode ficar 600 s nele (#165). */
  try{execFileSync('taskkill',['/PID',String(root),'/T','/F'],{stdio:'ignore',timeout:2000,killSignal:'SIGKILL'});}catch{/* sem filhos ou já saiu */}
  return [];
 }
 return killRows(descendants(root));
}

/* Guarda do processo de teste: na saída (normal ou por SIGTERM/SIGINT/SIGHUP)
   mata com SIGKILL tudo o que o teste subiu. Os sinais não esperam o
   fechamento educado do Playwright, que trava quando o app não responde. */
let guarded=false;
export function guardChildren(){
 if(guarded||WIN)return;
 guarded=true;
 process.on('exit',()=>{killTree(process.pid);});
 for(const [signal,code] of [['SIGTERM',143],['SIGINT',130],['SIGHUP',129]]){
  process.on(signal,()=>{killTree(process.pid);process.exit(code);});
 }
}

/* Fecha o serve registrado no ledger do runtime, com a identidade do produto:
   pid + hora de início + argumentos. Devolve os pids mortos; espera a árvore
   sumir (o runtime só pode ser apagado depois disso).

   Assume um runtime EXCLUSIVO deste teste: `helpers.mjs` cria um por teste,
   então o ledger só pode ser do app que o teste subiu, e o dono não é
   consultado antes do SIGKILL. Um teste que um dia compartilhe runtime com o
   app instalado precisa checar `ownerStillRuns` antes de matar. */
export async function killLedgerServer(ledgerDir,{timeout=5000}={}){
 if(!ledgerDir)return [];
 const entry=readEntry(ledgerDir);
 if(!entry)return [];
 const mine=()=>{const info=readProcessInfo(entry.pid);return info&&isAnnotatedServe(entry,info)};
 if(!mine())return [];
 try{killGroup({pid:entry.pid,pgid:entry.pid,signal:'SIGKILL'});}catch{/* já saiu */}
 const end=Date.now()+timeout;
 while(Date.now()<end){
  if(!mine())return [entry.pid];
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 return [];
}

/* `app.close()` do Playwright espera o Electron sair e não tem prazo: preso no
   fechamento, o teste trava com ele. Aqui o fechamento tem prazo; estourou,
   o app morre com SIGKILL (árvore e grupo) e o teste reprova dizendo isso — app
   que não fecha é defeito, não detalhe de teste. Depois, o ledger do runtime
   é conferido: serve vivo ali também morre (#105). */
/* Fases do fechamento no main, para a falha do Windows dizer ONDE parou
   (#165): só "não fechou em 15 s" não separa app preso no `before-quit` de
   app que saiu devagar sob carga. O arquivo mora no runtime do teste (vira
   artefato na falha) e some quando o fechamento termina. */
async function traceQuit(app,file){
 try{
  await app.evaluate(({app,BrowserWindow},file)=>{
   const fs=process.getBuiltinModule('node:fs');
   const mark=line=>{try{fs.appendFileSync(file,`${Date.now()} ${line}\n`);}catch{/* sem arquivo */}};
   mark('close pedido');
   app.on('before-quit',()=>mark('before-quit'));
   app.on('will-quit',()=>mark('will-quit'));
   app.on('quit',()=>mark('quit'));
   app.on('window-all-closed',()=>mark('window-all-closed'));
   for(const win of BrowserWindow.getAllWindows())win.on('closed',()=>mark('janela closed'));
   process.on('exit',code=>mark(`process exit ${code}`));
  },file);
 }catch{/* app já fechando: o trace é opcional */ }
}
function quitTrace(file){
 try{
  const lines=fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-12).join(' | ');
 }catch{return '';}
}
export async function closeApp(app,{timeout=15000,ledgerDir=''}={}){
 if(!app)return;
 const runtime=ledgerDir||app.mesaRuntime||'';
 const trace=runtime?path.join(runtime,'fechamento.log'):'';
 if(trace)await Promise.race([traceQuit(app,trace),new Promise(resolve=>setTimeout(resolve,3000))]);
 /* App que o próprio teste já fechou: o Playwright descartou o objeto e
    `process()` lança. Ainda assim o ledger é limpo. */
 let proc;
 try{proc=app.process();}catch{await killLedgerServer(runtime);return;}
 const pid=proc?.pid;
 /* O `app.close()` do Playwright espera o `BrowserContext.close` responder; no
    Windows os filhos do Chromium herdam o stdio e podem segurar o pipe depois
    do exit do main (rodada 43128169284: as fases mostram `process exit 0` e o
    teste ainda estourava os 15 s). Pede o quit pelo próprio app, que é o
    caminho que o usuário percorre, e mede o `exit` do processo; os pipes do
    Playwright são soltos em seguida para a conexão pendente não segurar o teste. */
 const exited=new Promise(resolve=>{
  if(!proc)return resolve(false);
  if(proc.exitCode!==null||proc.signalCode!==null)return resolve(true);
  proc.once('exit',()=>resolve(true));
 });
 let quitTimer=null;
 const quitSent=Promise.race([
  app.evaluate(({app})=>app.quit()).then(()=>true,()=>true),
  new Promise(resolve=>{quitTimer=setTimeout(()=>resolve(false),2000);}),
 ]);
 await quitSent;
 clearTimeout(quitTimer);
 let timer;
 const late=new Promise(resolve=>{timer=setTimeout(()=>resolve(false),timeout);});
 const ok=await Promise.race([exited,late]);
 clearTimeout(timer);
 /* O Playwright abre cinco pipes (`stdio: 'pipe'`), mas o Electron só usa os
    três primeiros. Os fds 3 e 4 ficam sem leitor e um neto do Chromium que
    sobrevive ao main segura a ponta de escrita: soltar só 0–2 deixava o
    processo de teste vivo para sempre (#165, rodada 43364514387). */
 if(ok)for(const stream of proc?.stdio||[])try{stream?.destroy?.();}catch{/* já fechado */}
 await killLedgerServer(runtime);
 if(ok||!pid){if(trace)try{fs.rmSync(trace,{force:true});}catch{}return;}
 killTree(pid);
 if(!WIN){try{process.kill(-pid,'SIGKILL');}catch{/* grupo já foi */}}
 try{process.kill(pid,'SIGKILL');}catch{/* já foi */}
 const phases=quitTrace(trace);
 throw Error(`o app não fechou em ${Math.round(timeout/1000)} s; morto com SIGKILL${phases?` (fases do main: ${phases})`:''}`);
}
