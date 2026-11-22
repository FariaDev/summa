import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {tempDir} from './temp-dir.mjs';
import {enText} from './pt-text.mjs';
import {makeSignedRelease} from './fake-update-release.mjs';
import {exitedInstaller} from './fake-installer-process.mjs';
import {fakeDmgDownload,fakeDmgProcess,fakeDmgCommands,fakeDmgHost} from './fake-macos-dmg-update.mjs';
const require=createRequire(import.meta.url);
const update=require('../macos-dmg-update.cjs');
const {applyMacosDmg,reopenArgs}=require('../macos-dmg-worker.cjs');
const signature=require('../updater-signature.cjs');
const updater=require('../updater.cjs');
const DMG=Buffer.from('imagem da Summa autenticada');
const tmp=()=>tempDir('summa-dmg-update-');

function download(release,{bytes=DMG,fail=false,status=200}={}){
 const dir=path.join(tmp(),'download'),server=fakeDmgDownload(bytes,{fail,status});
 return {dir,server,run:update.prepareDmgUpdate({version:release.version,publicKey:release.publicKey,dir,fetchBuffer:release.fetchBuffer,fetchInstaller:server.fetchInstaller})};
}

test('DMG autenticado vem da Release e só recebe nome final depois da conferência',async()=>{
 const release=makeSignedRelease({version:'1.4.1',dmg:DMG}),item=download(release);
 const {file}=await item.run;
 assert.equal(path.basename(file),'Summa-1.4.1.dmg');
 assert.deepEqual(fs.readFileSync(file),DMG);
 assert.deepEqual(fs.readdirSync(item.dir),['Summa-1.4.1.dmg']);
 assert.deepEqual(item.server.calls,['https://github.com/FariaDev/summa/releases/download/v1.4.1/Summa-1.4.1.dmg']);
});

test('adulteração, tamanho excessivo, vazio e rede limpam os arquivos',async()=>{
 const release=makeSignedRelease({version:'1.4.1',dmg:DMG});
 const altered=Buffer.from(DMG);altered[0]^=1;
 for(const options of [{bytes:altered},{bytes:Buffer.concat([DMG,DMG])},{bytes:Buffer.alloc(0)},{fail:true},{status:503}]){
  const item=download(release,options);
  await assert.rejects(item.run,error=>enText(error.message).startsWith('Could not download and verify the DMG for v1.4.1 ('));
  assert.equal(fs.existsSync(item.dir),false);
 }
});

test('assinatura ou declaração inválida recusa antes do download',async()=>{
 const bad=makeSignedRelease({version:'1.4.1',dmg:DMG,signingKey:makeSignedRelease().privateKey});
 const missing=makeSignedRelease({version:'1.4.1'});
 const tooLarge=makeSignedRelease({version:'1.4.1',manifest:{...missing.manifest,dmgSha256:'a'.repeat(64),dmgBytes:signature.INSTALLER_MAX_BYTES+1}});
 for(const release of [bad,missing,tooLarge]){
  const item=download(release);
  await assert.rejects(item.run);
  assert.deepEqual(item.server.calls,[]);
  assert.equal(fs.existsSync(item.dir),false);
 }
 for(const [field,message] of [
  [{dmgBytes:1},'dmgSha256 inválido: recebido undefined; esperado SHA-256 (64 caracteres hexadecimais)'],
  [{dmgSha256:'a'.repeat(64)},'dmgBytes inválido: recebido undefined; esperado inteiro positivo seguro'],
  [{dmgBytes:-1,dmgSha256:'bad'},'dmgSha256 inválido: recebido "bad"; esperado SHA-256 (64 caracteres hexadecimais)'],
  [{dmgBytes:-1,dmgSha256:'a'.repeat(64)},'dmgBytes inválido: recebido -1; esperado inteiro positivo seguro'],
  [{dmgBytes:0,dmgSha256:'a'.repeat(64)},'dmgBytes inválido: recebido 0; esperado inteiro positivo seguro'],
  [{dmgBytes:1,dmgSha256:''},'dmgSha256 inválido: recebido ""; esperado SHA-256 (64 caracteres hexadecimais)'],
 ]){
  assert.throws(()=>signature.parseManifest(Buffer.from(JSON.stringify({...missing.manifest,...field}))),{message:`Manifesto de atualização inválido (${message}) — atualização recusada.`});
 }
 assert.doesNotThrow(()=>signature.parseManifest(missing.manifestBytes),'manifestos antigos continuam válidos');
});

test('conferência do DMG informa tamanhos e hashes recebidos e esperados',()=>{
 const declared={dmgBytes:4,dmgSha256:'a'.repeat(64)};
 assert.doesNotThrow(()=>signature.assertDmgMatches({bytes:4,sha256:declared.dmgSha256},declared));
 for(const bytes of [0,3,5])assert.throws(()=>signature.assertDmgMatches({bytes,sha256:declared.dmgSha256},declared),{message:`O DMG tem ${bytes} bytes e o manifesto assinado declara 4 — atualização recusada.`});
 const sha256='b'.repeat(64);
 assert.throws(()=>signature.assertDmgMatches({bytes:4,sha256},declared),{message:`O SHA-256 do DMG não confere com o manifesto assinado: recebido ${sha256}; esperado ${declared.dmgSha256} — atualização recusada.`});
});

test('helper usa o Electron instalado em modo Node; erro de spawn não é sucesso',async()=>{
 assert.deepEqual(reopenArgs('/a/Summa.app',{LEARNING_DESK_RUNTIME:'/runtime',LEARNING_VAULT:'/vault',ELECTRON_RUN_AS_NODE:'1'}),['--env','LEARNING_DESK_RUNTIME=/runtime','--env','LEARNING_VAULT=/vault','/a/Summa.app']);
 const dir=tmp(),fake=fakeDmgProcess();
 await update.launchDmgUpdate({file:'/x.dmg',app:'/a/Summa.app',dir,version:'1.4.1',lockFile:'/lock',executable:'/a/Summa.app/Contents/MacOS/Electron',env:{PATH:'/usr/bin'},spawnFn:fake.spawn});
 assert.equal(fake.calls[0].file,'/a/Summa.app/Contents/MacOS/Electron');
 assert.equal(fake.calls[0].options.env.ELECTRON_RUN_AS_NODE,'1');
 assert.equal(fake.calls[0].options.detached,true);
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'input.json'),'utf8')).pid,process.pid);
 assert.ok(fs.existsSync(path.join(dir,'macos-dmg-worker.cjs')));
 const load=spawnSync(process.execPath,['-e',`require(${JSON.stringify(path.join(dir,'macos-dmg-worker.cjs'))})`],{encoding:'utf8'});
 assert.equal(load.status,0,`a cópia do helper carrega sozinha: ${load.stderr}`);
 await assert.rejects(update.launchDmgUpdate({file:'/x',app:'/a',dir,version:'1.4.1',lockFile:'',spawnFn:fakeDmgProcess({error:true}).spawn}),/EACCES/);
});

test('readiness aguarda extração; saída antecipada ou timeout cancela sem quit',async()=>{
 const dir=tmp(),fake=fakeDmgProcess();
 fs.writeFileSync(path.join(dir,'ready'),'ready');
 await update.waitForDmgReady({child:fake.child,dir,timeoutMs:1});
 fs.rmSync(path.join(dir,'ready'));
 await assert.rejects(update.waitForDmgReady({child:exitedInstaller(2),dir,timeoutMs:1}));
 assert.ok(fs.existsSync(path.join(dir,'cancel')));
 await assert.rejects(update.waitForDmgReady({child:fake.child,dir,timeoutMs:1}),/não ficou pronto/);
 fs.writeFileSync(path.join(dir,'error'),'falha na cópia');
 await assert.rejects(update.waitForDmgReady({child:exitedInstaller(2),dir}),/falha na cópia/);
});

function installation(){
 const base=tmp(),app=path.join(base,'Summa.app'),dir=path.join(base,'update');
 fs.mkdirSync(app);fs.mkdirSync(dir);
 fs.mkdirSync(path.join(app,'Contents/MacOS'),{recursive:true});
 fs.writeFileSync(path.join(app,'Contents/MacOS/summa-swap'),'',{mode:0o755});
 fs.writeFileSync(path.join(app,'old'),'versão antiga');
 return {app,dir,file:path.join(dir,'Summa-1.4.1.dmg'),pid:123,version:'1.4.1'};
}

test('copia, desmonta e confere com app aberto, troca só após PID sair e reabre',async()=>{
 const input=installation(),fake=fakeDmgCommands(input);
 await applyMacosDmg(input,fake);
 assert.equal(fake.observedReady,true);
 assert.ok(fs.existsSync(path.join(input.app,'Contents/Resources/app/package.json')));
 assert.equal(fs.existsSync(input.app+'.old'),false);
 assert.deepEqual(fs.readdirSync(path.dirname(input.app)).sort(),['Summa.app','update']);
 const swap=fake.calls.filter(([cmd])=>path.basename(cmd)==='summa-swap');
 assert.equal(swap.length,1);
 assert.equal(swap[0][1],input.app);
 assert.equal(path.dirname(path.dirname(swap[0][2])),path.dirname(input.app));
 assert.ok(fake.calls.some(call=>call[0]==='/usr/bin/xattr'&&call.includes('com.apple.quarantine')));
 assert.ok(fake.calls.some(call=>call.includes('-readonly')&&call.includes('-nobrowse')));
 const attach=fake.calls.find(call=>call[1]==='attach');
 const detach=fake.calls.find(call=>call[1]==='detach');
 assert.equal(detach[2],attach[attach.indexOf('-mountpoint')+1]);
 assert.notEqual(path.dirname(detach[2]),input.dir);
 assert.equal(fs.existsSync(detach[2]),false);
 assert.ok(fake.calls.indexOf(detach)<fake.calls.indexOf(swap[0]));
 assert.deepEqual(fake.calls.at(-1),['/usr/bin/open',input.app]);
});

test('falhas de montagem/cópia/assinatura/troca, app preso e cancelamento preservam o antigo',async()=>{
 for(const options of [{fail:'hdiutil'},{fail:'ditto'},{fail:'codesign'},{fail:'swap'},{fail:'pid'},{cancel:true},{version:'9.9.9'}]){
  const input=installation(),fake=fakeDmgCommands({...input,...options});
  await assert.rejects(applyMacosDmg(input,fake));
  assert.equal(fs.readFileSync(path.join(input.app,'old'),'utf8'),'versão antiga');
  assert.deepEqual(fs.readdirSync(path.dirname(input.app)).sort(),['Summa.app','update']);
  assert.ok(fs.existsSync(path.join(input.dir,'error')));
  if(options.fail==='swap')assert.deepEqual(fake.calls.at(-1),['/usr/bin/open',input.app]);
 }
});

test('recusas do helper chegam ao Sobre em inglês, sem texto fixo em português',async()=>{
 for(const [options,english] of [
  [{cancel:true},'The update was canceled before the swap. The previous version is still in place.'],
  [{fail:'pid'},'Summa did not close. The previous version is still in place.'],
 ]){
  const input=installation();
  await assert.rejects(applyMacosDmg(input,fakeDmgCommands({...input,...options})),error=>enText(error.message)===english);
  assert.equal(enText(fs.readFileSync(path.join(input.dir,'error'),'utf8')),english);
  const dir=tmp();
  fs.writeFileSync(path.join(dir,'error'),fs.readFileSync(path.join(input.dir,'error'),'utf8'));
  await assert.rejects(update.waitForDmgReady({child:exitedInstaller(1),dir}),error=>enText(error.message)===english);
 }
});

test('identidade do app no DMG informa kind e versões recebidos e esperados',async()=>{
 for(const fields of [{markerKind:'source'},{markerVersion:'9.9.9'},{packageVersion:'9.9.9'},{markerVersion:''},{packageVersion:''}]){
  const input=installation(),received={markerKind:'macos-dmg',markerVersion:input.version,packageVersion:input.version,...fields};
  const english=`The app in the DMG does not match the signed release: received kind=${JSON.stringify(received.markerKind)}, marker.version=${JSON.stringify(received.markerVersion)}, package.version=${JSON.stringify(received.packageVersion)}; expected kind="macos-dmg", marker.version="1.4.1", package.version="1.4.1" — update refused.`;
  await assert.rejects(applyMacosDmg(input,fakeDmgCommands({...input,...fields})),error=>enText(error.message)===english);
  assert.equal(enText(fs.readFileSync(path.join(input.dir,'error'),'utf8')),english);
  assert.equal(fs.existsSync(path.join(input.dir,'ready')),false);
  assert.equal(fs.readFileSync(path.join(input.app,'old'),'utf8'),'versão antiga');
 }
});

test('resíduos de uma atualização interrompida não bloqueiam a próxima nem são apagados',async()=>{
 const input=installation();
 const residues=[input.app+'.old',input.app+'.new',path.join(path.dirname(input.app),'.Summa.app.update-crash')];
 for(const dir of residues){fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'backup'),'backup');}
 await applyMacosDmg(input,fakeDmgCommands(input));
 assert.ok(fs.existsSync(path.join(input.app,'Contents/Resources/app/package.json')));
 for(const dir of residues)assert.equal(fs.readFileSync(path.join(dir,'backup'),'utf8'),'backup');
});

test('pasta sem escrita recusa antes de preparar',()=>{
 assert.throws(()=>update.assertWritableBundle(path.join(tmp(),'missing','Summa.app')),error=>/^Could not write to the Summa\.app folder \(.+\)\. Move Summa\.app to a folder you can write to/.test(enText(error.message)));
});

function hostFixture({marker=true,fail=''}={}){
 const root=tmp(),deskDir=path.join(root,'Summa.app/Contents/Resources/app'),runtime=path.join(root,'runtime');
 fs.mkdirSync(deskDir,{recursive:true});fs.mkdirSync(runtime);
 fs.writeFileSync(path.join(root,'Summa.app/Contents/Info.plist'),'plist');
 if(marker)fs.writeFileSync(path.join(deskDir,'release-install.json'),JSON.stringify({kind:'macos-dmg'}));
 updater.writeCache(path.join(runtime,'update.json'),{release:{at:Date.now(),version:'1.4.1'}});
 const host=fakeDmgHost({runtime,deskDir,fail});
 host.runtime=runtime;host.deskDir=deskDir;
 return host;
}

test('host despacha pelo marcador, mostra origem normal e só fecha depois de ready',async()=>{
 const host=hostFixture();
 assert.equal(host.ipcMain.invoke('update-origin').kind,'normal');
 assert.deepEqual(await host.ipcMain.invoke('update-apply'),{ok:true,version:'1.4.1'});
 assert.deepEqual(host.calls,['settle','writable','prepare','pending','launch','ready']);
 assert.ok(fs.existsSync(path.join(host.runtime,'update.lock')),'helper herda o lock');
 await new Promise(resolve=>setTimeout(resolve,450));
 assert.equal(host.quits,1);
 updater.releaseLock(path.join(host.runtime,'update.lock'));
});

test('host sem marcador mantém caminho antigo; recusas não fecham nem deixam pedido pendente',async()=>{
 const source=hostFixture({marker:false});
 await assert.rejects(source.ipcMain.invoke('update-apply'),/sourceMissing/);
 assert.deepEqual(source.calls,[]);
 for(const fail of ['writable','prepare','launch','ready']){
  const host=hostFixture({fail});
  await assert.rejects(host.ipcMain.invoke('update-apply'));
  assert.equal(host.quits,0);
  if(fail==='writable')assert.deepEqual(host.calls,['settle','writable']);
  else assert.equal(host.calls.at(-1),'clear');
  if(fail!=='ready')assert.equal(fs.existsSync(path.join(host.runtime,'update.lock')),false);
  updater.releaseLock(path.join(host.runtime,'update.lock'));
 }
});

test('próxima abertura registra aplicada ou recuperada, limpa download e não toca dados',async()=>{
 for(const current of ['1.4.1','1.4.0']){
  const runtime=tmp(),cacheFile=path.join(runtime,'update.json'),dir=path.join(runtime,'update-dmg');
  fs.mkdirSync(dir);fs.writeFileSync(path.join(runtime,'session'),'sessão');
  await update.markInstallerPending({cacheFile,version:'1.4.1',from:'1.4.0'});
  const result=await update.settleInstallerUpdate({cacheFile,current,dir,failureReason:'não instalou'});
  assert.equal(result.status,current==='1.4.1'?'applied':'recovered');
  assert.equal(updater.readCache(cacheFile).installerPending,undefined);
  assert.equal(fs.existsSync(dir),false);
  assert.equal(fs.readFileSync(path.join(runtime,'session'),'utf8'),'sessão');
  assert.equal(await update.settleInstallerUpdate({cacheFile,current,dir,failureReason:'não instalou'}),null);
 }
});
