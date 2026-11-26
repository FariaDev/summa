import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeDmgFromEarlierSwitch,fakeDmgWithSourceAlias,fakeFinderAlias,fakeAppSpawn} from './fake-installed-app.mjs';
const require=createRequire(import.meta.url);
const {adoptEarlierMacosSwitch}=require('../macos-switch-backfill.cjs');
const {removeReplacedAlias}=require('../switch-alias-cleanup.cjs');
const redirect=require('../installed-app-redirect.cjs');

/* #196: a troca feita pela 1.4.1 não gravava installed-app.json; o atalho antigo
   seguia abrindo a cópia de código mesmo depois de ela receber a 1.4.2. */
const adopt=(fixture,extra={})=>adoptEarlierMacosSwitch({runtime:fixture.runtime,deskDir:fixture.payload,configDir:fixture.configDir,version:'1.4.2',platform:'darwin',now:5,home:fixture.home||path.join(fixture.root,'home'),resolveAlias:()=>'',...extra});

test('o app do DMG grava o registro da troca antiga e a cópia de código passa a desviar',()=>{
 const fixture=fakeDmgFromEarlierSwitch();
 assert.equal(adopt(fixture),true);
 const record=redirect.readInstalledApp(fixture.runtime);
 assert.deepEqual({from:record.from,target:record.target,path:record.path,version:record.version,noticed:record.noticed},
  {from:fixture.source,target:'dmg',path:fixture.bundle,version:'1.4.2',noticed:false});
 const spawn=fakeAppSpawn();
 assert.equal(redirect.redirectToInstalledApp({runtime:fixture.runtime,deskDir:fixture.deskDir,testMode:false,log:fixture.log,platform:'darwin',env:{},spawnFn:spawn.spawnFn}),true);
 assert.equal(spawn.calls[0].args.at(-1),fixture.bundle);
 assert.equal(adopt(fixture,{now:9}),false,'registro existente não é regravado');
 assert.equal(redirect.readInstalledApp(fixture.runtime).at,5);
});

test('sem procedência, com runtime de outra pasta, fora do DMG ou fora do macOS, nada é gravado',()=>{
 const none=fakeDmgFromEarlierSwitch();
 fs.rmSync(path.join(none.configDir,'previous-install-source.json'));
 const other=fakeDmgFromEarlierSwitch();
 const ownRuntime=path.join(other.root,'own-runtime');
 fs.mkdirSync(ownRuntime);
 const notRelease=fakeDmgFromEarlierSwitch();
 const linux=fakeDmgFromEarlierSwitch();
 assert.equal(adopt(none),false);
 assert.equal(adopt(other,{runtime:ownRuntime}),false);
 assert.equal(adopt(notRelease,{deskDir:notRelease.deskDir}),false);
 assert.equal(adopt(linux,{platform:'linux'}),false);
 for(const fixture of [none,notRelease,linux])assert.equal(redirect.readInstalledApp(fixture.runtime),null);
 assert.equal(redirect.readInstalledApp(ownRuntime),null);
});

/* Repro do Mac do autor: `runtimePath` aponta para outra pasta, não há
   previous-install-source.json e o alias de ~/Applications abre o clone. */
test('com runtime próprio, a cópia substituída sai do alias de ~/Applications e o alias some',()=>{
 const fixture=fakeDmgWithSourceAlias();
 assert.equal(adopt(fixture),true);
 const record=redirect.readInstalledApp(fixture.runtime);
 assert.deepEqual({from:record.from,path:record.path},{from:fixture.source,path:fixture.bundle});
 const removed=removeReplacedAlias({runtime:fixture.runtime,deskDir:fixture.payload,log:fixture.log,platform:'darwin',home:fixture.home,resolveAlias:()=>''});
 assert.deepEqual(removed,[fixture.alias]);
 assert.equal(fs.existsSync(fixture.sourceBundle),true,'o bundle do clone fica');
});

test('alias do Finder também identifica a cópia substituída',()=>{
 const fixture=fakeDmgWithSourceAlias({symlink:false});
 const finder=fakeFinderAlias({[fixture.alias]:fixture.sourceBundle});
 assert.equal(adopt(fixture,{resolveAlias:finder.resolveAlias}),true);
 assert.equal(redirect.readInstalledApp(fixture.runtime).from,fixture.source);
});

test('alias para app de release ou com procedência de outra pasta não grava registro',()=>{
 const release=fakeDmgWithSourceAlias();
 fs.writeFileSync(path.join(release.sourcePayload,'release-install.json'),JSON.stringify({kind:'macos-dmg'}));
 const elsewhere=fakeDmgWithSourceAlias();
 fs.writeFileSync(path.join(elsewhere.sourcePayload,'install-source.json'),JSON.stringify({path:path.join(elsewhere.root,'outro')}));
 for(const fixture of [release,elsewhere]){
  assert.equal(adopt(fixture),false);
  assert.equal(redirect.readInstalledApp(fixture.runtime),null);
 }
});
