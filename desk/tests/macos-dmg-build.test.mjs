import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {stageMacosRelease,dmgArgs} from '../scripts/build-macos-dmg.mjs';
import {tempDir} from './temp-dir.mjs';

const require=createRequire(import.meta.url);
const {isMacosRelease,previousMacosRuntime}=require('../macos-release.cjs');
const {seedRuntimePath}=require('../config.cjs');
const {userDataDirectory}=require('../user-data.cjs');
const DESK=path.resolve(import.meta.dirname,'..');

function fakeElectronApp(){
 const app=path.join(tempDir('summa-electron-app-'),'Electron.app');
 const contents=path.join(app,'Contents');
 fs.mkdirSync(path.join(contents,'Resources'),{recursive:true});
 fs.writeFileSync(path.join(contents,'Info.plist'),'<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleName</key><string>Electron</string></dict></plist>');
 fs.writeFileSync(path.join(contents,'Resources/default_app.asar'),'generic app');
 return app;
}

test('DMG leva app independente, identidade, auxiliares e manifesto', {skip:process.platform!=='darwin'},()=>{
 const stage=tempDir('summa-macos-stage-');
 const root=tempDir('summa-native-helper-');
 fs.mkdirSync(path.join(root,'visual-check'));
 fs.writeFileSync(path.join(root,'visual-check/windows'),'native helper');
 const {app,payload}=stageMacosRelease({desk:DESK,electronApp:fakeElectronApp(),stage,version:'9.9.9',root});
 for(const file of ['main.cjs','macos-release.cjs','node_modules/marked/package.json','update-signing-key.pub'])assert.ok(fs.existsSync(path.join(payload,file)),file);
 for(const file of ['install-source.json','previous-install-source.json'])assert.equal(fs.existsSync(path.join(payload,file)),false);
 const plist=path.join(app,'Contents/Info.plist');
 for(const [key,value] of Object.entries({CFBundleIdentifier:'local.learningcanvas.mesa',CFBundleName:'Summa',CFBundleDisplayName:'Summa',CFBundleShortVersionString:'9.9.9',CFBundleIconFile:'mesa.icns'})){
  assert.equal(execFileSync('plutil',['-extract',key,'raw',plist],{encoding:'utf8'}).trim(),value);
 }
 for(const file of ['mesa.icns','visual-check/windows'])assert.ok(fs.existsSync(path.join(app,'Contents/Resources',file)),file);
 assert.equal(fs.readFileSync(path.join(app,'Contents/Resources/visual-check/windows'),'utf8'),'native helper');
 assert.equal(fs.existsSync(path.join(app,'Contents/Resources/default_app.asar')),false);
 assert.equal(fs.readlinkSync(path.join(stage,'Applications')),'/Applications');
 assert.equal(isMacosRelease({deskDir:payload,platform:'darwin'}),true);
 assert.equal(seedRuntimePath(payload),'');
 const manifest=JSON.parse(fs.readFileSync(path.join(payload,'.update-manifest.json'),'utf8'));
 assert.equal(manifest.version,'9.9.9');
 assert.ok(manifest.files.includes('release-install.json'));
 const {loadBootConfig}=require(path.join(payload,'desk-boot-config.cjs'));
 const configDir=tempDir('summa-dmg-config-'),clone=tempDir('summa-dmg-clone-');
 const runtime=path.join(clone,'desk/.runtime');
 fs.mkdirSync(runtime,{recursive:true});
 fs.writeFileSync(path.join(configDir,'previous-install-source.json'),JSON.stringify({path:clone}));
 const configFile=path.join(configDir,'config.json');
 const config=loadBootConfig({configFile,env:{LEARNING_VAULT:clone},persist:true});
 assert.equal(config.runtimePath,runtime);
 assert.equal(JSON.parse(fs.readFileSync(configFile,'utf8')).runtimePath,runtime);
 const isolated=tempDir('summa-dmg-isolated-');
 const override=loadBootConfig({configFile:path.join(isolated,'config.json'),env:{LEARNING_VAULT:isolated,LEARNING_DESK_RUNTIME:isolated},persist:false});
 assert.equal(override.runtimePath,isolated);
 assert.equal(fs.existsSync(path.join(isolated,'config.json')),false);
});

test('DMG comprimido e erro de Electron ausente',()=>{
 assert.deepEqual(dmgArgs({stage:'/stage',outFile:'/out/Summa-1.4.0.dmg'}),['create','-volname','Summa','-srcfolder','/stage','-format','UDZO','-ov','/out/Summa-1.4.0.dmg']);
 assert.throws(()=>stageMacosRelease({desk:DESK,electronApp:'/missing/Electron.app',stage:tempDir('summa-missing-'),version:'1.4.0'}),/Electron ausente/);
});

test('marcador independe do destino e recusa ausente, inválido ou outra plataforma',()=>{
 const deskDir=tempDir('summa-release-marker-');
 assert.equal(isMacosRelease({deskDir,platform:'darwin'}),false);
 fs.writeFileSync(path.join(deskDir,'release-install.json'),'invalid');
 assert.equal(isMacosRelease({deskDir,platform:'darwin'}),false);
 fs.writeFileSync(path.join(deskDir,'release-install.json'),JSON.stringify({kind:'macos-dmg'}));
 assert.equal(isMacosRelease({deskDir,platform:'darwin'}),true);
 assert.equal(isMacosRelease({deskDir,platform:'win32'}),false);
 assert.equal(seedRuntimePath(DESK),path.join(DESK,'.runtime'));
 assert.equal(userDataDirectory({platform:'darwin',home:'/Users/ana',env:{}}),'/Users/ana/Library/Application Support/Mesa de Estudos');
});

test('migração conserva runtime e procedência do clone pelo atalho antigo',()=>{
 const home=tempDir('summa-migration-'),configDir=path.join(home,'data'),deskDir=path.join(home,'payload');
 const clone=path.join(home,'clone'),runtime=path.join(clone,'desk/.runtime');
 const oldApp=path.join(clone,'Summa.app'),payload=path.join(oldApp,'Contents/Resources/app');
 fs.mkdirSync(runtime,{recursive:true});
 fs.mkdirSync(payload,{recursive:true});
 fs.writeFileSync(path.join(payload,'install-source.json'),JSON.stringify({path:clone,remote:'https://github.com/FariaDev/summa.git'}));
 fs.mkdirSync(path.join(home,'Applications'));
 fs.symlinkSync(oldApp,path.join(home,'Applications/Summa.app'));
 assert.equal(previousMacosRuntime({configDir,deskDir,home}),runtime);
 fs.unlinkSync(path.join(home,'Applications/Summa.app'));
 assert.equal(previousMacosRuntime({configDir,deskDir,home}),runtime,'procedência persiste fora do app');
 assert.equal(JSON.parse(fs.readFileSync(path.join(configDir,'previous-install-source.json'),'utf8')).path,clone);
 fs.rmSync(runtime,{recursive:true});
 assert.equal(previousMacosRuntime({configDir,deskDir,home}),'');
});

test('sem clone ou procedência corrompida usa runtime dos dados do usuário',()=>{
 const home=tempDir('summa-no-clone-'),configDir=path.join(home,'data');
 fs.mkdirSync(configDir);
 fs.writeFileSync(path.join(configDir,'previous-install-source.json'),'invalid');
 assert.equal(previousMacosRuntime({configDir,deskDir:home,home}),'');
});
