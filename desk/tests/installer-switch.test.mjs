import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeInstallerSwitch,fakeSwitchReleaseWithoutAssets} from './fake-installer-switch.mjs';
import {exitedInstaller} from './fake-installer-process.mjs';
const require=createRequire(import.meta.url);
const {switchTarget,keepStudyPaths,switchToInstaller}=require('../installer-switch.cjs');
const updater=require('../updater.cjs');
const windows=require('../windows-installer-update.cjs');

test('formatos publicados: Windows/Linux x64 e DMG somente arm64',()=>{
 for(const [platform,arch,target] of [['win32','x64','exe'],['linux','x64','appimage'],['darwin','arm64','dmg'],['darwin','x64',null],['win32','arm64',null],['linux','arm64',null],['freebsd','x64',null]]){
  assert.equal(switchTarget({platform,arch}),target);
 }
});

test('config nunca escrita: salva runtime efetivo e vault',()=>{
 const {input}=fakeInstallerSwitch();
 keepStudyPaths({...input,config:{...input.config,runtimePath:''}});
 const saved=JSON.parse(fs.readFileSync(input.configFile,'utf8'));
 assert.equal(saved.runtimePath,input.runtime);assert.equal(saved.vaultPath,input.config.vaultPath);
 const before=fs.readFileSync(input.configFile,'utf8');
 keepStudyPaths(input);
 assert.equal(fs.readFileSync(input.configFile,'utf8'),before);
});

test('preserva extras sem persistir o runtime temporário do processo',()=>{
 const {input}=fakeInstallerSwitch();
 fs.mkdirSync(path.dirname(input.configFile));
 fs.writeFileSync(input.configFile,JSON.stringify({extra:'keep',runtimePath:'/saved',vaultPath:'/old'}));
 keepStudyPaths({...input,env:{LEARNING_DESK_RUNTIME:input.runtime}});
 const saved=JSON.parse(fs.readFileSync(input.configFile,'utf8'));
 assert.equal(saved.extra,'keep');assert.equal(saved.runtimePath,'/saved');assert.equal(saved.vaultPath,input.config.vaultPath);
 fs.rmSync(input.configFile);
 keepStudyPaths({...input,env:{LEARNING_DESK_RUNTIME:input.runtime}});
 assert.equal(JSON.parse(fs.readFileSync(input.configFile,'utf8')).runtimePath,'');
});

for(const target of ['exe','dmg','appimage']){
 test(`${target}: sucesso abre o nativo com os mesmos caminhos e sai`,async()=>{
  const {input,calls}=fakeInstallerSwitch();
  const sentinel=path.join(input.runtime,'session');fs.writeFileSync(sentinel,'study');
  const result=await switchToInstaller({...input,target});
  assert.deepEqual(result,{ok:true,version:'1.4.0'});
  assert.equal(calls.at(-1),'quit');assert.ok(calls.includes('release'));assert.ok(!calls.includes('retake'));
  assert.equal(fs.readFileSync(sentinel,'utf8'),'study');
  assert.equal(fs.existsSync(path.join(input.runtime,'update.lock')),false);
  if(target==='appimage')assert.equal(fs.readFileSync(path.join(input.home,'Applications','Summa-x86_64.AppImage'),'utf8'),'authenticated');
  if(target==='dmg'){assert.ok(calls.indexOf('detach')<calls.indexOf('open'));assert.equal(fs.readFileSync(path.join(input.applications,'Summa.app','payload'),'utf8'),'app');}
 });
 const failures=target==='dmg'?['prepare','attach','ditto','detach','open']:target==='exe'?['prepare','launch','ready']:['prepare','launch'];
 for(const fail of failures){
  test(`${target}: falha ${fail} mantém zip aberto e recupera locks`,async()=>{
   const {input,calls}=fakeInstallerSwitch({fail});
   await assert.rejects(switchToInstaller({...input,target}),/switchFailed/);
   assert.ok(!calls.includes('quit'));
   assert.equal(calls.includes('release'),calls.includes('retake'));
   assert.equal(fs.existsSync(path.join(input.runtime,'update.lock')),false);
   assert.equal(updater.readCache(path.join(input.runtime,'update.json')).installerPending,undefined);
   if(fail==='prepare')assert.equal(fs.existsSync(input.configFile),false,'asset ausente não muda a config');
   assert.equal(fs.existsSync(path.join(input.applications,'Summa.app')),false);
   assert.equal(fs.existsSync(path.join(input.home,'Applications','Summa-x86_64.AppImage')),false);
  });
 }
}

test('versão alvo: anunciada mais recente, senão a instalada',async()=>{
 for(const [announced,expected] of [['1.5.0','1.5.0'],['1.3.3','1.4.0'],['1.4.0','1.4.0'],['invalid','1.4.0']]){
  const {input,calls}=fakeInstallerSwitch();
  updater.writeCache(path.join(input.runtime,'update.json'),{release:{version:announced}});
  await switchToInstaller({...input,target:'exe'});
  assert.ok(calls.includes(`version:${expected}`));
 }
});

test('destino existente: nenhum download nem substituição',async()=>{
 for(const target of ['dmg','appimage']){
  const {input,calls}=fakeInstallerSwitch();
  const destination=target==='dmg'?path.join(input.applications,'Summa.app'):path.join(input.home,'Applications','Summa-x86_64.AppImage');
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,'existing');
  await assert.rejects(switchToInstaller({...input,target}),/switchExists/);
  assert.equal(fs.readFileSync(destination,'utf8'),'existing');assert.deepEqual(calls,[]);
 }
});

test('lock concorrente recusa sem efeito; macOS sem acesso tem erro traduzido',async()=>{
 const {root,input,calls}=fakeInstallerSwitch();
 const lock=updater.acquireLock(input.runtime);
 try{await assert.rejects(switchToInstaller({...input,target:'exe'}),/locked/);assert.deepEqual(calls,[]);}
 finally{updater.releaseLock(lock.file);}
 await assert.rejects(switchToInstaller({...input,target:'dmg',applications:path.join(root,'absent')}),/switchNotWritable/);
});

test('primeiro Setup já terminou: saída 0 aceita sinal fugaz, mas não erros',async()=>{
 const {root}=fakeInstallerSwitch();
 const readyFile=path.join(root,'ready');
 await windows.waitForInstallerReady({child:exitedInstaller(0),readyFile,allowCompleted:true});
 await assert.rejects(windows.waitForInstallerReady({child:exitedInstaller(2),readyFile,allowCompleted:true}),/installerExited/);
 await assert.rejects(windows.waitForInstallerReady({child:exitedInstaller(0),readyFile}),/installerExited/);
});

test('config sem permissão de gravação impede iniciar em qualquer OS',async()=>{
 for(const target of ['exe','dmg','appimage']){
  const {input,calls}=fakeInstallerSwitch();
  fs.writeFileSync(path.dirname(input.configFile),'not a directory');
  await assert.rejects(switchToInstaller({...input,target}),/switchFailed/);
  assert.ok(!calls.includes('launch')&&!calls.includes('open')&&!calls.includes('release')&&!calls.includes('quit'));
 }
});

/* A recusa do download chega traduzida e vai embrulhada em switchFailed; a versão
   pedida no texto prova que o erro é o do asset ausente, e não outro. */
test('release assinada sem asset nativo recusa antes de salvar caminhos ou iniciar',async()=>{
 for(const target of ['exe','dmg','appimage']){
  const {input,calls}=fakeInstallerSwitch();
  await assert.rejects(switchToInstaller({...input,...fakeSwitchReleaseWithoutAssets(input),target}),/switchFailed.*v1\.4\.0/s);
  assert.equal(fs.existsSync(input.configFile),false);assert.deepEqual(calls,[]);
 }
});
