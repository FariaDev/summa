// Fixtures do recorte Xournal++ (#159, #133): caderno sintético, Xournal++ com
// HOME/XDG temporários e a ponte falsa de conversão. Ficam fora do script
// principal para ele seguir abaixo de 500 linhas; nada aqui toca no
// ~/.config/xournalpp real nem em material de curso.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {gzipSync} from 'node:zlib';
import {DESK} from './helpers.mjs';
import {windowsOfPid,geometry} from './capture-ciclo2-xournal-kit.mjs';

const require=createRequire(import.meta.url);
const {createInkConvertHost}=require('../ink-convert-host.cjs');
export const PLUGIN=path.join(DESK,'src','xournal-plugins','MesaPagina');
export const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));

/** @param {()=>any} check @param {{timeout?:number,interval?:number,what?:string}} [options] */
export async function waitFor(check,{timeout=15000,interval=150,what='estado'}={}){
 const end=Date.now()+timeout;
 for(;;){
  const value=await check();
  if(value)return value;
  if(Date.now()>end)throw Error(`tempo esgotado esperando ${what}`);
  await sleep(interval);
 }
}

export function xournalBinary(){
 const candidates=[process.env.XOURNALPP_BIN,path.join(os.homedir(),'.local','bin','xournalpp'),'xournalpp'].filter(Boolean);
 for(const candidate of candidates){
  try{
   if(candidate.includes('/')&&fs.accessSync(candidate,fs.constants.X_OK)===undefined)return candidate;
   if(!candidate.includes('/'))return candidate;
  }catch{ /* tenta o próximo */ }
 }
 throw Error('xournalpp não encontrado (use XOURNALPP_BIN)');
}

const STROKE='<stroke tool="pen" color="#000000ff" width="2.0" capStyle="round">100.0 200.0 180.0 260.0 260.0 180.0</stroke>';
const TEXTS='<text font="Sans" size="14" x="100" y="320" color="#000000ff">Texto sintético da página</text>\n'
 +'<text font="Sans" size="12" x="100" y="360" color="#000000ff">Segunda linha</text>';

function page(w,h,body){
 return `<page width="${w}" height="${h}">\n<background type="solid" color="#ffffffff" style="plain"/>\n<layer>\n${body}\n</layer>\n</page>\n`;
}

/** Caderno de 9 páginas; a última é 300×300 para o crescimento aparecer. */
export function syntheticXopp(){
 const pages=[
  page(595.275591,841.889764,`${STROKE}\n${TEXTS}`),
  page(595.275591,841.889764,STROKE),
  page(595.275591,841.889764,STROKE),
  page(595.275591,841.889764,STROKE),
  page(595.275591,841.889764,STROKE),
  page(595.275591,841.889764,STROKE),
  page(595.275591,841.889764,TEXTS),
  page(595.275591,841.889764,STROKE),
  page(300,300,'<stroke tool="pen" color="#000000ff" width="2.0" capStyle="round">40.0 60.0 90.0 120.0 140.0 60.0</stroke>\n'
   +'<text font="Sans" size="12" x="40" y="180" color="#000000ff">Página pequena</text>'),
 ];
 const xml=`<?xml version="1.0" standalone="no"?>\n<xournal creator="Xournal++ 1.3.8" fileversion="4">\n<title>Caderno sintético do ciclo 2</title>\n${pages.join('')}</xournal>\n`;
 return gzipSync(Buffer.from(xml,'utf8'));
}

/** Copia o plugin para o XDG temporário, habilita e grava o runtime. */
export function install(base){
 const configRoot=path.join(base,'config');
 const config=path.join(configRoot,'xournalpp');
 const runtime=path.join(base,'runtime');
 const home=path.join(base,'home');
 for(const dir of [home,path.join(base,'cache'),path.join(base,'data'),runtime,path.join(config,'plugins')])fs.mkdirSync(dir,{recursive:true});
 const pluginDir=path.join(config,'plugins','MesaPagina');
 fs.cpSync(PLUGIN,pluginDir,{recursive:true});
 const ini=path.join(pluginDir,'plugin.ini');
 fs.writeFileSync(ini,fs.readFileSync(ini,'utf8').replace(/^enabled=false$/m,'enabled=true'));
 fs.writeFileSync(path.join(pluginDir,'mesa-runtime.json'),JSON.stringify({runtime}));
 const xopp=path.join(base,'caderno-sintetico.xopp');
 fs.writeFileSync(xopp,syntheticXopp());
 return {configRoot,config,runtime,home,xopp,pluginDir};
}

/** Sobe o Xournal++ e espera a janela, o plugin e o tamanho 800×650. */
export async function launchXournal(base,paths,{display}){
 const bin=xournalBinary();
 const logFile=path.join(base,'xournal.log');
 const log=fs.openSync(logFile,'w');
 const child=spawn(bin,['--disable-audio',paths.xopp],{
  stdio:['ignore',log,log],
  env:{
   ...process.env,DISPLAY:display,
   HOME:paths.home,
   XDG_CONFIG_HOME:paths.configRoot,
   XDG_CACHE_HOME:path.join(base,'cache'),
   XDG_DATA_HOME:path.join(base,'data'),
   LEARNING_DESK_RUNTIME:paths.runtime,
  },
 });
 fs.closeSync(log);
 const pid=child.pid;
 try{
  const main=await waitFor(()=>windowsOfPid(pid).find((win)=>win.classe.includes('xournalpp')),{timeout:30000,what:'janela do Xournal++'});
  await waitFor(()=>fs.readFileSync(logFile,'utf8').includes('Plugin "MesaPagina" UI initialized'),{timeout:15000,what:'plugin MesaPagina'});
  await waitFor(()=>{const geo=geometry(main.id);return geo.w===800&&geo.h===650;},{timeout:10000,what:'tamanho inicial 800x650'});
  await sleep(2500);
  return {child,pid,mainId:main.id,logFile};
 }catch(error){
  killXournal(child);
  throw error;
 }
}

export function killXournal(child){
 if(!child||!child.pid)return;
 try{process.kill(child.pid,'SIGTERM');}catch{ /* já saiu */ }
 const end=Date.now()+2000;
 while(Date.now()<end){
  try{process.kill(child.pid,0);}catch{return;}
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);
 }
 try{process.kill(child.pid,'SIGKILL');}catch{ /* já saiu */ }
}

/** Ponte falsa de conversão (nenhum modelo/chave real). */
export function bridgeHost(runtime,overrides={}){
 return createInkConvertHost({
  runtime,
  deskState:()=>({inkReading:true}),
  pickModel:()=>({model:'fake/vision',effort:null,reason:null}),
  renderSvg:async()=>Buffer.from('png-falso').toString('base64'),
  readText:async()=>({text:'texto convertido sintético',reason:null}),
  log:()=>{},
  ...overrides,
 });
}

export function writeBridge(runtime,port,token='ciclo2-token-0123456789'){
 fs.writeFileSync(path.join(runtime,'ink-convert-bridge.json'),JSON.stringify({port,token}),{mode:0o600});
}

export async function closedPort(){
 const server=http.createServer();
 await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 await new Promise((resolve)=>server.close(resolve));
 return port;
}

export async function withStub(runtime,body,fn){
 const server=http.createServer((req,res)=>{
  req.resume();
  req.on('end',()=>{
   res.writeHead(200,{'content-type':'application/json; charset=utf-8'});
   res.end(body);
  });
 });
 await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
 writeBridge(runtime,server.address().port);
 try{return await fn();}finally{await new Promise((resolve)=>server.close(resolve));}
}
