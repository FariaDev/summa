import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {makeSignedRelease} from './fake-update-release.mjs';
import {fakeAppImageDownload,fakeAppImageProcess,fakeAppImageHost} from './fake-appimage.mjs';
import {fakeIpcMain,fakeShell} from './fake-electron-shell.mjs';
import {tempDir} from './temp-dir.mjs';

const require=createRequire(import.meta.url);
const image=require('../linux-appimage-update.cjs');
const pending=require('../windows-installer-update.cjs');
const updater=require('../updater.cjs');
const {registerUpdateHost}=require('../update-host.cjs');
const {ensureLinuxDesktopEntry}=require('../linux-desktop.cjs');
const {seedRuntimePath}=require('../config.cjs');
const env={APPIMAGE:'/apps/Summa.AppImage',APPDIR:'/tmp/mount'};
const deskDir='/tmp/mount/resources/app';
const bytes=Buffer.from('AppImage assinado');

test('AppImage que sai antes de pronto rejeita e restaura bytes originais sem fechar a Mesa',async()=>{
 const dir=tempDir('summa-rollback-'),runtime=tempDir('summa-rollback-runtime-');
 const appImage=path.join(dir,'Summa.AppImage'),file=path.join(dir,'.new.part');
 fs.writeFileSync(appImage,'original');fs.writeFileSync(file,'nova quebrada');
 const fake=fakeAppImageHost(image),ipcMain=fakeIpcMain();
 const process=fakeAppImageProcess({exitImmediately:true});
 fake.appImageUpdate={...image,prepareAppImageUpdate:async()=>({file}),
  relaunchAppImage:opts=>image.relaunchAppImage({...opts,spawnFn:process.spawnFn})};
 updater.writeCache(path.join(runtime,'update.json'),{release:{at:Date.now(),version:'1.3.4'}});
 registerUpdateHost({...fake,ipcMain,shell:fakeShell(),runtime,deskDir,logFile:path.join(runtime,'desk.log'),testMode:false,platform:'linux',env:{...env,APPIMAGE:appImage}});
 await assert.rejects(ipcMain.invoke('update-apply'),/appImageStart/);
 assert.equal(fs.readFileSync(appImage,'utf8'),'original');
 assert.equal(fake.calls.includes('lock'),true);
 assert.equal(fake.calls.includes('quit'),false);
 assert.equal(updater.readCache(path.join(runtime,'update.json')).installerPending,undefined);
 assert.equal(fs.existsSync(path.join(runtime,'update.lock')),false);
});

test('detecção exige Linux, arquivo absoluto e payload dentro da montagem',()=>{
 assert.equal(image.isLinuxAppImage({platform:'linux',env,deskDir}),true);
 for(const facts of [{platform:'win32',env,deskDir},{platform:'linux',env:{},deskDir},{platform:'linux',env,deskDir:'/tmp/mount-other/app'},{platform:'linux',env,deskDir:'/src/desk'}])assert.equal(image.isLinuxAppImage(facts),false);
 assert.equal(seedRuntimePath(deskDir),'','runtime usa a pasta de dados, não a montagem');
});

test('download conferido ganha modo executável e troca mantém nome do atalho',async()=>{
 const dir=tempDir('summa-image-'),release=makeSignedRelease({appImage:bytes});
 const {file}=await image.prepareAppImageUpdate({version:release.version,publicKey:release.publicKey,dir,fetchBuffer:release.fetchBuffer,fetchAppImage:fakeAppImageDownload(bytes)});
 if(process.platform!=='win32')assert.equal(fs.statSync(file).mode&0o777,0o755);
 const appImage=path.join(dir,'Summa.AppImage');
 fs.writeFileSync(appImage,'antiga');
 image.swapAppImage({file,appImage});
 assert.deepEqual(fs.readFileSync(appImage),bytes);
 assert.deepEqual(fs.readdirSync(dir),['Summa.AppImage']);
});

test('download substitui parcial antigo ou symlink sem alterar seu destino',async()=>{
 const release=makeSignedRelease({appImage:bytes});
 for(const symlink of [false,true]){
  const dir=tempDir('summa-stale-'),file=path.join(dir,`.Summa-${release.version}-x86_64.AppImage.part`),target=path.join(dir,'preservado');
  fs.writeFileSync(target,'antiga');
  if(symlink)fs.symlinkSync(target,file);
  else fs.writeFileSync(file,'download interrompido');
  const prepared=await image.prepareAppImageUpdate({version:release.version,publicKey:release.publicKey,dir,fetchBuffer:release.fetchBuffer,fetchAppImage:fakeAppImageDownload(bytes)});
  assert.equal(prepared.file,file);
  assert.deepEqual(fs.readFileSync(file),bytes);
  assert.equal(fs.lstatSync(file).isSymbolicLink(),false);
  assert.equal(fs.readFileSync(target,'utf8'),'antiga');
 }
});

test('hash, tamanho, HTTP e corpo vazio recusados não alteram a antiga nem deixam .part',async()=>{
 const release=makeSignedRelease({appImage:bytes});
 for(const [download,status] of [[Buffer.alloc(bytes.length),200],[Buffer.concat([bytes,bytes]),200],[Buffer.alloc(0),200],[bytes,503]]){
  const dir=tempDir('summa-image-error-');
  fs.writeFileSync(path.join(dir,'Summa.AppImage'),'antiga');
  await assert.rejects(image.prepareAppImageUpdate({version:release.version,publicKey:release.publicKey,dir,fetchBuffer:release.fetchBuffer,fetchAppImage:fakeAppImageDownload(download,status)}));
  assert.deepEqual(fs.readdirSync(dir),['Summa.AppImage']);
  assert.equal(fs.readFileSync(path.join(dir,'Summa.AppImage'),'utf8'),'antiga');
 }
});

test('preparação limpa parciais de outras versões e preserva nomes não exatos',async()=>{
 const dir=tempDir('summa-stale-versions-'),release=makeSignedRelease({appImage:bytes});
 const preserved=['Summa.AppImage','Summa-1.3.3-x86_64.AppImage','.Summa-notes.txt','.Other-1.4.1-x86_64.AppImage.part','Summa-1.4.1-x86_64.AppImage.part','.Summa-1.4.1-x86_64.AppImage.part.bak','.Summa-1.4.1-arm64.AppImage.part','.Summa-1.4-x86_64.AppImage.part','.Summa-1.4.1-beta-x86_64.AppImage.part'];
 for(const name of preserved)fs.writeFileSync(path.join(dir,name),'preservado');
 for(const version of ['0.0.1','12.34.56'])fs.writeFileSync(path.join(dir,`.Summa-${version}-x86_64.AppImage.part`),'interrompido');
 const {file}=await image.prepareAppImageUpdate({version:release.version,publicKey:release.publicKey,dir,fetchBuffer:release.fetchBuffer,fetchAppImage:fakeAppImageDownload(bytes)});
 assert.deepEqual(fs.readdirSync(dir).sort(),[...preserved,path.basename(file)].sort());
 for(const name of preserved)assert.equal(fs.readFileSync(path.join(dir,name),'utf8'),'preservado');
});

test('abertura AppImage limpa parcial só com lock, sem pedido pendente; outras instalações preservam',()=>{
 for(const [platform,hasLock] of [['linux',true],['linux',false],['darwin',true]]){
  const dir=tempDir('summa-startup-partial-'),runtime=tempDir('summa-startup-runtime-'),stale=path.join(dir,'.Summa-1.4.1-x86_64.AppImage.part');
  const preserved=['Summa.AppImage','.Summa-notes.txt','.Other.AppImage.part'];
  fs.writeFileSync(stale,'interrompido');
  for(const name of preserved)fs.writeFileSync(path.join(dir,name),'preservado');
  const fake=fakeAppImageHost(image,{hasLock});
  registerUpdateHost({...fake,appImageUpdate:image,ipcMain:fakeIpcMain(),shell:fakeShell(),runtime,deskDir,logFile:path.join(runtime,'desk.log'),testMode:false,platform,env:{...env,APPIMAGE:path.join(dir,'Summa.AppImage')}});
  assert.equal(fs.existsSync(stale),platform!=='linux'||!hasLock);
  for(const name of preserved)assert.equal(fs.readFileSync(path.join(dir,name),'utf8'),'preservado');
 }
});

test('limpeza tolera pasta ausente e entrada não removível, sem seguir symlink',()=>{
 const dir=tempDir('summa-sweep-errors-'),target=path.join(dir,'preservado'),blocked=path.join(dir,'.Summa-1.2.3-x86_64.AppImage.part');
 fs.writeFileSync(target,'preservado');
 fs.mkdirSync(blocked);
 fs.symlinkSync(target,path.join(dir,'.Summa-1.2.4-x86_64.AppImage.part'));
 assert.doesNotThrow(()=>image.cleanupAppImagePartials(path.join(dir,'ausente')));
 assert.doesNotThrow(()=>image.cleanupAppImagePartials(dir));
 assert.equal(fs.readFileSync(target,'utf8'),'preservado');
 assert.deepEqual(fs.readdirSync(dir).sort(),[path.basename(blocked),'preservado'].sort());
});

test('pasta não gravável tem erro próprio e swap recusado apaga parcial',async()=>{
 const release=makeSignedRelease({appImage:bytes});
 await assert.rejects(image.prepareAppImageUpdate({version:release.version,publicKey:release.publicKey,dir:'/proc',fetchBuffer:release.fetchBuffer,fetchAppImage:fakeAppImageDownload(bytes)}),/appImageNotWritable/);
 const dir=tempDir('summa-swap-'),file=path.join(dir,'.new.part'),appImage=path.join(dir,'pasta');
 fs.writeFileSync(file,bytes);fs.mkdirSync(appImage);
 assert.throws(()=>image.swapAppImage({file,appImage}),/appImageNotWritable/);
 assert.equal(fs.existsSync(file),false);
 assert.ok(fs.statSync(appImage).isDirectory());
});

test('reabertura remove variáveis da montagem antiga e propaga erro de spawn',async()=>{
 const fake=fakeAppImageProcess();
 await image.relaunchAppImage({appImage:env.APPIMAGE,env:{...env,ARGV0:'old',APPIMAGE_SILENT_INSTALL:'1',OWD:'/tmp',ELECTRON_RUN_AS_NODE:'1',LD_LIBRARY_PATH:'/old',HOME:'/home/test'},spawnFn:fake.spawnFn});
 assert.deepEqual(fake.calls[0].options.env,{HOME:'/home/test'});
 assert.equal(fake.calls[0].options.detached,true);
 assert.equal(fake.calls[1],'unref');
 await assert.rejects(image.relaunchAppImage({appImage:env.APPIMAGE,spawnFn:fakeAppImageProcess({error:'EACCES'}).spawnFn}),/EACCES/);
});

test('settle aplicado ou recuperado preserva estudos e não apaga pasta da instalação',async()=>{
 for(const current of ['1.3.4','1.3.3']){
  const dir=tempDir('summa-settle-'),cacheFile=path.join(dir,'update.json');
  fs.writeFileSync(path.join(dir,'estudo.json'),'preservado');
  await pending.markInstallerPending({cacheFile,version:'1.3.4',from:'1.3.3'});
  const result=await pending.settleInstallerUpdate({cacheFile,current,mode:'appimage',failureReason:'não iniciou'});
  assert.equal(result.status,current==='1.3.4'?'applied':'recovered');
  assert.equal(result.mode,'appimage');
  assert.equal(updater.readCache(cacheFile).lastResult.mode,'appimage');
  assert.equal(fs.readFileSync(path.join(dir,'estudo.json'),'utf8'),'preservado');
  assert.equal(await pending.settleInstallerUpdate({cacheFile,current,failureReason:''}),null);
 }
});

test('integração desktop escapa Exec, respeita XDG e não regrava conteúdo igual',()=>{
 const home=tempDir('summa-desktop-'),xdg=path.join(home,'dados');
 const input={platform:'linux',deskDir,assetsDir:path.resolve(import.meta.dirname,'../assets'),home,env:{...env,APPIMAGE:'/apps/uma pasta/Summa%".AppImage',XDG_DATA_HOME:xdg}};
 assert.equal(ensureLinuxDesktopEntry(input),true);
 const entry=path.join(xdg,'applications/summa.desktop');
 assert.ok(fs.readFileSync(entry,'utf8').includes(String.raw`Exec="/apps/uma pasta/Summa%%\\".AppImage" %U`));
 assert.ok(fs.readFileSync(entry,'utf8').includes('\nTryExec=/apps/uma pasta/Summa%".AppImage\nStartupWMClass=summa\n'));
 const before=fs.statSync(entry).mtimeMs;
 assert.equal(ensureLinuxDesktopEntry(input),false);
 assert.equal(fs.statSync(entry).mtimeMs,before);
 assert.ok(fs.existsSync(path.join(xdg,'icons/hicolor/256x256/apps/summa.png')));
 assert.equal(ensureLinuxDesktopEntry({...input,platform:'darwin'}),false);
});

test('IPC Linux escolhe AppImage, origem oficial e mantém aberto se download falha',async()=>{
 for(const fail of [false,true]){
  const runtime=tempDir('summa-image-host-'),ipcMain=fakeIpcMain(),fake=fakeAppImageHost(image,{fail});
  updater.writeCache(path.join(runtime,'update.json'),{release:{at:Date.now(),version:'1.3.4'}});
  registerUpdateHost({...fake,ipcMain,shell:fakeShell(),runtime,deskDir,logFile:path.join(runtime,'desk.log'),testMode:false,platform:'linux',env});
  assert.equal((await ipcMain.invoke('update-origin')).kind,'normal');
  if(fail)await assert.rejects(ipcMain.invoke('update-apply'),/hash recusado/);
  else assert.deepEqual(await ipcMain.invoke('update-apply'),{ok:true,version:'1.3.4'});
  await new Promise(resolve=>setTimeout(resolve,450));
  assert.equal(fake.calls.includes('quit'),!fail);
  assert.equal(fake.calls.includes('swap'),!fail);
  assert.equal(fs.existsSync(path.join(runtime,'update.lock')),false);
 }
});

test('extração sem FUSE persiste na reabertura e no menu, por ambiente ou argumento',async()=>{
 for(const flags of [{env:{...env,APPIMAGE_EXTRACT_AND_RUN:'1'},argv:[]},{env,argv:['--appimage-extract-and-run']}]){
  const fake=fakeAppImageProcess(),home=tempDir('summa-extract-');
  await image.relaunchAppImage({appImage:env.APPIMAGE,...flags,spawnFn:fake.spawnFn});
  assert.equal(fake.calls[0].options.env.APPIMAGE_EXTRACT_AND_RUN,'1');
  assert.equal(fake.calls[0].options.env.APPDIR,undefined);
  ensureLinuxDesktopEntry({platform:'linux',deskDir,assetsDir:path.resolve(import.meta.dirname,'../assets'),home,...flags});
  assert.match(fs.readFileSync(path.join(home,'.local/share/applications/summa.desktop'),'utf8'),/Exec=env APPIMAGE_EXTRACT_AND_RUN=1 "\/apps\/Summa.AppImage" %U/);
 }
});

test('Exec aplica escaping de argumento e depois de valor desktop',()=>{
 const home=tempDir('summa-desktop-escaping-');
 const appImage='/apps/uma pasta/Summa\\"`$%.AppImage';
 ensureLinuxDesktopEntry({platform:'linux',deskDir,assetsDir:path.resolve(import.meta.dirname,'../assets'),home,env:{...env,APPIMAGE:appImage}});
 const entry=fs.readFileSync(path.join(home,'.local/share/applications/summa.desktop'),'utf8');
 const expected='Exec="/apps/uma pasta/Summa'+'\\'.repeat(6)+'"'+'\\'.repeat(2)+'`'+'\\'.repeat(2)+'$%%.AppImage" %U';
 assert.ok(entry.includes(expected));
 assert.ok(entry.includes('TryExec=/apps/uma pasta/Summa'+'\\'.repeat(2)+'"`$%.AppImage'));
});
