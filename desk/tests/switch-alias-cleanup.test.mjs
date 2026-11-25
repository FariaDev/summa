import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeDmgAfterSwitch,fakeFinderAlias,fakeInstalledApp} from './fake-installed-app.mjs';
const require=createRequire(import.meta.url);
const {removeReplacedAlias}=require('../switch-alias-cleanup.cjs');
const {readInstalledApp}=require('../installed-app-redirect.cjs');

/* #196: depois da troca para o DMG, o Launchpad mostrava dois "Summa": o app novo e
   o alias de ~/Applications que o install-app deixou apontando para a cópia de código. */
const cleanup=(fixture,extra={})=>removeReplacedAlias({runtime:fixture.runtime,deskDir:fixture.payload,log:fixture.log,platform:'darwin',home:fixture.home,...extra});

test('alias (symlink) para a cópia substituída sai uma vez e o registro lembra',()=>{
 const fixture=fakeDmgAfterSwitch();
 const alias=path.join(fixture.userApps,'Summa.app');
 fs.symlinkSync(fixture.sourceBundle,alias);
 assert.deepEqual(cleanup(fixture),[alias]);
 assert.equal(fs.lstatSync(alias,{throwIfNoEntry:false}),undefined);
 assert.equal(fs.existsSync(fixture.sourceBundle),true,'o bundle da cópia de código fica: o Dock ainda aponta para ele');
 assert.equal(readInstalledApp(fixture.runtime).aliasChecked,true);
 fs.symlinkSync(fixture.sourceBundle,alias);
 assert.deepEqual(cleanup(fixture),[],'só na primeira abertura');
});

test('alias do Finder (arquivo) resolvido pelo Finder sai; o antigo Mesa de Estudos também',()=>{
 const fixture=fakeDmgAfterSwitch();
 const alias=path.join(fixture.userApps,'Summa.app'),legacy=path.join(fixture.userApps,'Mesa de Estudos.app');
 fs.writeFileSync(alias,'alis');
 fs.writeFileSync(legacy,'alis');
 const finder=fakeFinderAlias({[alias]:fixture.sourceBundle+'/',[legacy]:fixture.sourceBundle});
 assert.deepEqual(cleanup(fixture,{resolveAlias:finder.resolveAlias}),[alias,legacy]);
 assert.match(fixture.lines.join('\n'),/alias antigo apagado/);
});

test('alias de outra pasta, bundle real e alias que não resolve ficam',()=>{
 const fixture=fakeDmgAfterSwitch();
 const other=path.join(fixture.root,'outro-clone','Summa.app');
 fs.mkdirSync(other,{recursive:true});
 fs.symlinkSync(other,path.join(fixture.userApps,'Summa.app'));
 fs.mkdirSync(path.join(fixture.userApps,'Mesa de Estudos.app','Contents'),{recursive:true});
 assert.deepEqual(cleanup(fixture),[]);
 assert.equal(fs.existsSync(path.join(fixture.userApps,'Summa.app')),true);
 assert.equal(fs.existsSync(path.join(fixture.userApps,'Mesa de Estudos.app','Contents')),true);
 const unresolved=fakeDmgAfterSwitch();
 fs.writeFileSync(path.join(unresolved.userApps,'Summa.app'),'alis');
 assert.deepEqual(cleanup(unresolved,{resolveAlias:fakeFinderAlias().resolveAlias}),[]);
 assert.equal(fs.existsSync(path.join(unresolved.userApps,'Summa.app')),true);
});

test('fora do app do DMG, sem registro ou com troca para outro formato, nada muda',()=>{
 const fixture=fakeDmgAfterSwitch();
 const alias=path.join(fixture.userApps,'Summa.app');
 fs.symlinkSync(fixture.sourceBundle,alias);
 assert.deepEqual(cleanup(fixture,{platform:'linux'}),[]);
 assert.deepEqual(cleanup(fixture,{deskDir:fixture.deskDir}),[],'a cópia de código não apaga o próprio atalho');
 fs.rmSync(path.join(fixture.runtime,'installed-app.json'));
 assert.deepEqual(cleanup(fixture),[]);
 const appimage=fakeInstalledApp({target:'appimage'});
 assert.deepEqual(removeReplacedAlias({runtime:appimage.runtime,deskDir:fixture.payload,log:()=>{},platform:'darwin',home:fixture.home}),[]);
 assert.equal(fs.lstatSync(alias).isSymbolicLink(),true);
});
