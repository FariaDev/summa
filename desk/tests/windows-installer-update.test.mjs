import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {makeSignedRelease} from './fake-update-release.mjs';
import {fakeIpcMain,fakeShell} from './fake-electron-shell.mjs';
import {tempDir} from './temp-dir.mjs';

/* #119: no Windows instalado, a atualização é o instalador conferido pelo
   manifesto assinado. Nenhum teste toca a rede nem abre um `.exe` de verdade. */
const require=createRequire(import.meta.url);
const installerUpdate=require('../windows-installer-update.cjs');
const signature=require('../updater-signature.cjs');
const updater=require('../updater.cjs');
const {registerUpdateHost}=require('../update-host.cjs');

const LOCAL='C:\\Users\\ana\\AppData\\Local';
const INSTALLED=`${LOCAL}\\Programs\\Summa\\resources\\app`;
const INSTALLER=Buffer.from('instalador assinado da Summa');
const tmp=()=>tempDir('summa-installer-update-');
const serveInstaller=bytes=>async()=>new Response(bytes);

function prepare(release,{download=INSTALLER,dir=path.join(tmp(),'update-installer')}={}){
 return {dir,run:installerUpdate.prepareInstallerUpdate({version:release.version,publicKey:release.publicKey,dir,fetchBuffer:release.fetchBuffer,fetchInstaller:serveInstaller(download)})};
}

test('#119: só a pasta instalada do Windows usa o instalador',()=>{
 const env={LOCALAPPDATA:LOCAL};
 assert.equal(installerUpdate.isWindowsInstalledApp({platform:'win32',deskDir:INSTALLED,env}),true);
 assert.equal(installerUpdate.isWindowsInstalledApp({platform:'win32',deskDir:INSTALLED.toUpperCase(),env}),true,'o Windows não diferencia maiúsculas');
 assert.equal(installerUpdate.isWindowsInstalledApp({platform:'win32',deskDir:'C:\\src\\summa\\desk',env}),false,'rodar do código segue no updater antigo');
 assert.equal(installerUpdate.isWindowsInstalledApp({platform:'darwin',deskDir:INSTALLED,env}),false);
 assert.equal(installerUpdate.isWindowsInstalledApp({platform:'win32',deskDir:INSTALLED,env:{}}),false);
});

test('#119: o instalador que confere com o manifesto fica pronto para abrir',async()=>{
 const release=makeSignedRelease({version:'1.4.1',installer:INSTALLER});
 const {dir,run}=prepare(release);
 const {file}=await run;
 assert.equal(path.basename(file),'Summa-Setup-1.4.1.exe');
 assert.deepEqual(fs.readFileSync(file),INSTALLER);
 assert.deepEqual(fs.readdirSync(dir),['Summa-Setup-1.4.1.exe'],'nada de .part para trás');
});

test('#119: instalador adulterado é recusado e apagado antes de abrir',async()=>{
 const release=makeSignedRelease({version:'1.4.1',installer:INSTALLER});
 const sameSize=Buffer.from(INSTALLER);sameSize[0]^=1;
 const tampered=prepare(release,{download:sameSize});
 await assert.rejects(tampered.run,/SHA-256 do instalador não confere/);
 assert.equal(fs.existsSync(tampered.dir),false);
 const longer=prepare(release,{download:Buffer.concat([INSTALLER,Buffer.from('a mais')])});
 await assert.rejects(longer.run,/manifesto assinado declara/);
 assert.equal(fs.existsSync(longer.dir),false);
});

test('#119: assinatura inválida recusa antes de baixar o instalador',async()=>{
 const release=makeSignedRelease({version:'1.4.1',installer:INSTALLER,signingKey:makeSignedRelease().privateKey});
 let downloads=0;
 await assert.rejects(installerUpdate.prepareInstallerUpdate({version:'1.4.1',publicKey:release.publicKey,dir:path.join(tmp(),'x'),fetchBuffer:release.fetchBuffer,fetchInstaller:async()=>{downloads++;return new Response(INSTALLER);}}));
 assert.equal(downloads,0);
});

test('#119: release sem instalador assinado é recusada com a versão no motivo',async()=>{
 const release=makeSignedRelease({version:'1.4.1'});
 await assert.rejects(prepare(release).run,/v1\.4\.1 não publicou um instalador assinado/);
});

test('#119: falha de rede vira recusa com o motivo e não deixa arquivo',async()=>{
 const release=makeSignedRelease({version:'1.4.1',installer:INSTALLER});
 const dir=path.join(tmp(),'update-installer');
 await assert.rejects(installerUpdate.prepareInstallerUpdate({version:'1.4.1',publicKey:release.publicKey,dir,fetchBuffer:release.fetchBuffer,fetchInstaller:async()=>new Response('',{status:503})}),/installerDownload.*1\.4\.1.*HTTP 503/);
 assert.equal(fs.existsSync(dir),false);
});

test('#119: manifesto com só um campo do instalador é inválido; sem os dois segue válido',()=>{
 const base={version:'1.4.1',commit:'a'.repeat(40),zipSha256:'b'.repeat(64),zipBytes:10};
 const parse=fields=>signature.parseManifest(Buffer.from(JSON.stringify({...base,...fields})));
 assert.equal(Object.hasOwn(parse({}),'exeBytes'),false);
 assert.equal(parse({exeSha256:'C'.repeat(64),exeBytes:5}).exeSha256,'c'.repeat(64));
 assert.throws(()=>parse({exeBytes:5}),/exeSha256/);
 assert.throws(()=>parse({exeSha256:'c'.repeat(64)}),/exeBytes/);
 assert.throws(()=>signature.assertInstallerDeclared({version:'1.4.1',exeSha256:'c'.repeat(64),exeBytes:signature.INSTALLER_MAX_BYTES+1}),/acima do teto/);
});

test('#119: o instalador abre em silêncio, separado e sem herdar o modo Node',async()=>{
 const calls=[];
 const child=new EventEmitter();child.unref=()=>calls.push('unref');
 const opened=installerUpdate.launchInstaller({file:'C:\\d\\Summa-Setup-1.4.1.exe',env:{PATH:'x',ELECTRON_RUN_AS_NODE:'1'},spawnFn:(file,args,options)=>{calls.push({file,args,options});queueMicrotask(()=>child.emit('spawn'));return child;}});
 await opened;
 assert.deepEqual(calls[0].args,['/S','/UPDATE']);
 assert.equal(calls[0].options.detached,true);
 assert.deepEqual(calls[0].options.env,{PATH:'x'});
 assert.equal(calls[1],'unref');
});

test('#119: aviso de uma tentativa anterior não fecha a Summa antes da hora',async()=>{
 const readyFile=path.join(tmp(),'Summa.ready');
 fs.writeFileSync(readyFile,'');
 const child=new EventEmitter();child.unref=()=>{};
 await installerUpdate.launchInstaller({file:'x.exe',readyFile,env:{},spawnFn:()=>{queueMicrotask(()=>child.emit('spawn'));return child;}});
 assert.equal(fs.existsSync(readyFile),false);
});

test('#119: a Summa só fecha quando a versão nova está pronta',async()=>{
 const readyFile=path.join(tmp(),'Summa.ready');
 const child=new EventEmitter();child.exitCode=null;
 let done=false;
 const waiting=installerUpdate.waitForInstallerReady({child,readyFile,pollMs:5}).then(()=>{done=true;});
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(done,false);
 fs.writeFileSync(readyFile,'');
 await waiting;
 assert.equal(child.listenerCount('exit'),0);
});

test('#119: instalador que sai antes de ficar pronto mantém a Summa aberta',async()=>{
 const child=new EventEmitter();child.exitCode=null;
 const waiting=installerUpdate.waitForInstallerReady({child,readyFile:path.join(tmp(),'Summa.ready'),pollMs:5});
 child.emit('exit',2);
 await assert.rejects(waiting,/saiu com o código 2/);
});

test('#119: instalador que não fica pronto no prazo mantém a Summa aberta',async()=>{
 const child=new EventEmitter();child.exitCode=null;
 await assert.rejects(installerUpdate.waitForInstallerReady({child,readyFile:path.join(tmp(),'Summa.ready'),timeoutMs:10,pollMs:2}),/não ficou pronto/);
});

test('#119: erro ao abrir o instalador chega a quem pediu',async()=>{
 const child=new EventEmitter();
 const opened=installerUpdate.launchInstaller({file:'x.exe',env:{},spawnFn:()=>{queueMicrotask(()=>child.emit('error',Error('EACCES')));return child;}});
 await assert.rejects(opened,/EACCES/);
});

test('#119: a abertura seguinte diz se a versão pedida subiu',async()=>{
 const root=tmp(),cacheFile=path.join(root,'update.json'),dir=path.join(root,'update-installer');
 fs.mkdirSync(dir);
 await installerUpdate.markInstallerPending({cacheFile,version:'1.4.1',from:'1.4.0'});
 const applied=await installerUpdate.settleInstallerUpdate({cacheFile,current:'1.4.1',dir,failureReason:'não instalou'});
 assert.equal(applied.status,'applied');
 assert.equal(applied.mode,'installer');
 const cache=updater.readCache(cacheFile);
 assert.equal(cache.lastResult.version,'1.4.1');
 assert.equal(Object.hasOwn(cache,'installerPending'),false);
 assert.equal(fs.existsSync(dir),false,'o instalador baixado sai depois de usado');
 assert.equal(await installerUpdate.settleInstallerUpdate({cacheFile,current:'1.4.1',dir,failureReason:'x'}),null,'o resultado é dado uma vez só');
});

test('#119: versão antiga de pé depois do instalador vira "recuperada" com o motivo',async()=>{
 const root=tmp(),cacheFile=path.join(root,'update.json');
 await installerUpdate.markInstallerPending({cacheFile,version:'1.4.1',from:'1.4.0'});
 await installerUpdate.settleInstallerUpdate({cacheFile,current:'1.4.0',dir:path.join(root,'x'),failureReason:'não instalou'});
 const {lastResult}=updater.readCache(cacheFile);
 assert.equal(lastResult.status,'recovered');
 assert.equal(lastResult.mode,'installer');
 assert.equal(lastResult.reason,'não instalou');
});

test('settle não remove caminhos ausentes, vazios ou relativos',async()=>{
 const root=tmp(),cacheFile=path.join(root,'update.json'),sentinel=path.join(root,'estudo.json');
 fs.writeFileSync(sentinel,'preservado');
 for(const dir of [undefined,'',path.relative(process.cwd(),root)]){
  await installerUpdate.markInstallerPending({cacheFile,version:'1.4.1',from:'1.4.0'});
  await installerUpdate.settleInstallerUpdate({cacheFile,current:'1.4.1',dir,failureReason:'não instalou'});
  assert.equal(fs.readFileSync(sentinel,'utf8'),'preservado');
 }
});

function installerHost({runtime,fake,quit=()=>{},version='1.4.0'}){
 const ipcMain=fakeIpcMain();
 registerUpdateHost({
  ipcMain,shell:fakeShell(),runtime,deskDir:INSTALLED,logFile:path.join(runtime,'desk.log'),testMode:false,
  app:{isPackaged:false,getVersion:()=>version,quit},config:()=>({}),win:()=>null,appendLog:()=>{},
  toolHost:{state:()=>({}),persist:()=>{},isBusy:()=>false,hasBridge:()=>false,relink:()=>{}},
  platform:'win32',env:{LOCALAPPDATA:LOCAL},installerUpdate:fake,
 });
 return ipcMain;
}

function fakeInstallerUpdate(overrides={}){
 const calls=[];
 return {calls,fake:{
  isWindowsInstalledApp:installerUpdate.isWindowsInstalledApp,
  prepareInstallerUpdate:async input=>{calls.push(['prepare',input.version]);return {file:'C:\\d\\setup.exe'};},
  markInstallerPending:async input=>{calls.push(['pending',input.version,input.from]);},
  clearInstallerPending:async()=>{calls.push(['clear']);},
  installerReadyFile:installerUpdate.installerReadyFile,
  launchInstaller:async input=>{calls.push(['launch',input.file]);return {};},
  waitForInstallerReady:async()=>{calls.push(['ready']);},
  settleInstallerUpdate:async()=>null,
  ...overrides,
 }};
}

test('#119: o clique no Windows instalado confere, marca, abre o instalador e fecha, sem worker',async t=>{
 const runtime=tmp();
 updater.writeCache(path.join(runtime,'update.json'),{release:{at:Date.now(),version:'1.4.1',notes:'',url:''}});
 t.mock.method(updater,'spawnWorker',()=>{throw Error('o worker com Node não pode abrir');});
 const {calls,fake}=fakeInstallerUpdate();
 let quits=0;
 const ipcMain=installerHost({runtime,fake,quit:()=>{quits++;}});
 assert.deepEqual(await ipcMain.invoke('update-apply'),{ok:true,version:'1.4.1'});
 assert.deepEqual(calls.map(call=>call[0]),['prepare','pending','launch','ready']);
 assert.deepEqual(calls[1],['pending','1.4.1','1.4.0']);
 assert.equal(fs.existsSync(path.join(runtime,'update.lock')),false,'o lock não sobra para a próxima abertura');
 await new Promise(resolve=>setTimeout(resolve,450));
 assert.equal(quits,1);
});

test('#119: instalador recusado deixa o app aberto e libera o lock',async()=>{
 const runtime=tmp();
 updater.writeCache(path.join(runtime,'update.json'),{release:{at:Date.now(),version:'1.4.1',notes:'',url:''}});
 const {fake}=fakeInstallerUpdate({prepareInstallerUpdate:async()=>{throw Error('SHA-256 não confere');}});
 let quits=0;
 const ipcMain=installerHost({runtime,fake,quit:()=>{quits++;}});
 await assert.rejects(ipcMain.invoke('update-apply'),/SHA-256 não confere/);
 assert.equal(fs.existsSync(path.join(runtime,'update.lock')),false);
 await new Promise(resolve=>setTimeout(resolve,450));
 assert.equal(quits,0);
});

test('#119: instalador que falha na extração desfaz a marca e não fecha o app',async()=>{
 const runtime=tmp();
 updater.writeCache(path.join(runtime,'update.json'),{release:{at:Date.now(),version:'1.4.1',notes:'',url:''}});
 const {calls,fake}=fakeInstallerUpdate({waitForInstallerReady:async()=>{throw Error('o instalador saiu com o código 2');}});
 let quits=0;
 const ipcMain=installerHost({runtime,fake,quit:()=>{quits++;}});
 await assert.rejects(ipcMain.invoke('update-apply'),/installerStart/);
 assert.deepEqual(calls.at(-1),['clear']);
 await new Promise(resolve=>setTimeout(resolve,450));
 assert.equal(quits,0);
});

test('#119: instalador que não abre desfaz a marca e mantém o app aberto',async()=>{
 const runtime=tmp();
 updater.writeCache(path.join(runtime,'update.json'),{release:{at:Date.now(),version:'1.4.1',notes:'',url:''}});
 const {calls,fake}=fakeInstallerUpdate({launchInstaller:async()=>{throw Error('EACCES');}});
 let quits=0;
 const ipcMain=installerHost({runtime,fake,quit:()=>{quits++;}});
 await assert.rejects(ipcMain.invoke('update-apply'),/installerStart/);
 assert.deepEqual(calls.at(-1),['clear']);
 await new Promise(resolve=>setTimeout(resolve,450));
 assert.equal(quits,0);
});
