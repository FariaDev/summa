import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeInstalledApp,fakeAppSpawn} from './fake-installed-app.mjs';
const require=createRequire(import.meta.url);
const redirect=require('../installed-app-redirect.cjs');

/* #196: a cópia de código que a troca substituiu abre o app instalado; nenhuma outra. */
function run(fixture,{platform='linux',env={},testMode=false,spawn=fakeAppSpawn(),deskDir=fixture.deskDir}={}){
 const opened=redirect.redirectToInstalledApp({runtime:fixture.runtime,deskDir,testMode,log:fixture.log,platform,env,spawnFn:spawn.spawnFn});
 return {opened,calls:spawn.calls};
}

test('cópia substituída abre o AppImage solto, sem modo Node, deixa uma linha no log',()=>{
 const fixture=fakeInstalledApp();
 const {opened,calls}=run(fixture,{env:{ELECTRON_RUN_AS_NODE:'1',LEARNING_DESK_RUNTIME:fixture.runtime}});
 assert.equal(opened,true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].command,fixture.appPath);assert.deepEqual(calls[0].args,[]);
 assert.equal(calls[0].options.detached,true);assert.equal(calls[0].unref,true);
 assert.equal(calls[0].options.env.ELECTRON_RUN_AS_NODE,undefined);
 assert.equal(calls[0].options.env.LEARNING_DESK_RUNTIME,fixture.runtime);
 assert.equal(fixture.lines.length,1);assert.match(fixture.lines[0],/appimage v1\.4\.0/);
});

test('macOS abre o .app com open, levando o runtime de ambiente',()=>{
 const fixture=fakeInstalledApp({target:'dmg'});
 const {opened,calls}=run(fixture,{platform:'darwin',env:{LEARNING_DESK_RUNTIME:fixture.runtime}});
 assert.equal(opened,true);
 assert.equal(calls[0].command,'open');
 assert.deepEqual(calls[0].args,['--env',`LEARNING_DESK_RUNTIME=${fixture.runtime}`,fixture.appPath]);
});

test('Windows abre o electron.exe instalado',()=>{
 const fixture=fakeInstalledApp({target:'exe'});
 const {opened,calls}=run(fixture,{platform:'win32',env:{LOCALAPPDATA:path.join(fixture.root,'Local')}});
 assert.equal(opened,true);assert.equal(calls[0].command,fixture.appPath);
});

test('a mesma origem por link simbólico redireciona; o bundle ligado ao clone também',()=>{
 const fixture=fakeInstalledApp();
 const link=path.join(fixture.root,'link');fs.symlinkSync(fixture.source,link);
 assert.equal(run(fixture,{deskDir:path.join(link,'desk')}).opened,true);
 const bundle=path.join(fixture.root,'Summa.app','Contents','Resources','app');
 fs.mkdirSync(bundle,{recursive:true});
 fs.writeFileSync(path.join(bundle,'install-source.json'),JSON.stringify({path:fixture.source}));
 assert.equal(run(fixture,{deskDir:bundle}).opened,true);
});

test('outro checkout que divide o runtime abre normal',()=>{
 const fixture=fakeInstalledApp();
 const other=path.join(fixture.root,'other','desk');fs.mkdirSync(other,{recursive:true});
 const {opened,calls}=run(fixture,{deskDir:other});
 assert.equal(opened,false);assert.deepEqual(calls,[]);assert.deepEqual(fixture.lines,[]);
});

test('app instalado que sumiu, registro ausente ou estragado: abre normal',()=>{
 const gone=fakeInstalledApp();fs.rmSync(gone.appPath);
 assert.equal(run(gone).opened,false);
 assert.equal(run(fakeInstalledApp({record:false})).opened,false);
 const broken=fakeInstalledApp();
 fs.writeFileSync(redirect.installedAppFile(broken.runtime),JSON.stringify({from:'relative',target:'appimage',path:broken.appPath}));
 assert.equal(run(broken).opened,false);
});

test('o próprio app instalado nunca redireciona',()=>{
 const dmg=fakeInstalledApp({target:'dmg'});
 fs.writeFileSync(path.join(dmg.deskDir,'release-install.json'),'{"kind":"macos-dmg"}');
 assert.equal(run(dmg,{platform:'darwin'}).opened,false);
 const appImage=fakeInstalledApp();
 assert.equal(run(appImage,{env:{APPIMAGE:appImage.appPath,APPDIR:appImage.source}}).opened,false);
});

test('SUMMA_NO_REDIRECT=1 e os testes sem opt-in abrem normal',()=>{
 const fixture=fakeInstalledApp();
 assert.equal(run(fixture,{env:{SUMMA_NO_REDIRECT:'1'}}).opened,false);
 assert.equal(run(fixture,{testMode:true}).opened,false);
 assert.equal(run(fixture,{testMode:true,env:{SUMMA_REDIRECT_IN_TEST:'1'}}).opened,true);
 assert.equal(run(fixture,{testMode:true,env:{SUMMA_REDIRECT_IN_TEST:'1',SUMMA_NO_REDIRECT:'1'}}).opened,false);
});

test('app instalado que não abre: a cópia abre normal e o log diz por quê',()=>{
 const fixture=fakeInstalledApp();
 assert.equal(run(fixture,{spawn:fakeAppSpawn({fail:true})}).opened,false);
 assert.match(fixture.lines[0],/não abriu.*fake spawn failed/);
});

test('aviso do atalho antigo: uma vez, só no app instalado',()=>{
 const fixture=fakeInstalledApp({target:'dmg'});
 assert.equal(redirect.takeSwitchNote({runtime:fixture.runtime,deskDir:fixture.deskDir,platform:'darwin',env:{}}),false,'cópia de código não avisa');
 fs.writeFileSync(path.join(fixture.deskDir,'release-install.json'),'{"kind":"macos-dmg"}');
 const take=()=>redirect.takeSwitchNote({runtime:fixture.runtime,deskDir:fixture.deskDir,platform:'darwin',env:{}});
 assert.equal(take(),true);assert.equal(take(),false);
 assert.equal(redirect.readInstalledApp(fixture.runtime).noticed,true);
});

test('caminho do app nativo de cada formato',()=>{
 const where=target=>redirect.installedAppPath({target,home:'/home/ana',applications:'/Applications',env:{LOCALAPPDATA:'C:\\Users\\ana\\AppData\\Local'}});
 /* Separador do sistema que roda o teste: no Windows, path.join devolve `\`. */
 assert.equal(where('dmg'),path.join('/Applications','Summa.app'));
 assert.equal(where('appimage'),path.join('/home/ana','Applications','Summa-x86_64.AppImage'));
 assert.equal(where('exe'),'C:\\Users\\ana\\AppData\\Local\\Programs\\Summa\\electron.exe');
 assert.equal(redirect.installedAppPath({target:'exe',home:'',applications:'',env:{}}),'');
});

/* #196: depois da troca, o `npm start` no clone abria o app instalado no lugar do código. */
test('npm start no clone roda o código; o atalho da mesma cópia desvia',()=>{
 const fixture=fakeInstalledApp();
 assert.equal(run(fixture,{env:{npm_lifecycle_event:'start'}}).opened,false);
 assert.equal(run(fixture,{env:{}}).opened,true);
});
