import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {stageWindowsRelease,makensisArgs,stageSizeKb} from '../scripts/build-windows-installer.mjs';
import {createRequire} from 'node:module';
import {tempDir} from './temp-dir.mjs';

/* #119: o que entra no `.exe` e o contrato do script NSIS. A prova de instalar de
   verdade roda no workflow Instalador do Windows. */
const require=createRequire(import.meta.url);
const {seedRuntimePath,hasSourceTree,legacyCloneRuntime}=require('../config.cjs');
const DESK=path.resolve(import.meta.dirname,'..');
const NSI=fs.readFileSync(path.join(DESK,'scripts','summa.nsi'),'utf8');

function fakeElectronDist(){
 const dist=tempDir('summa-electron-dist-');
 fs.mkdirSync(path.join(dist,'resources'));
 fs.writeFileSync(path.join(dist,'electron.exe'),'exe');
 fs.writeFileSync(path.join(dist,'resources','default_app.asar'),'app genérico');
 return dist;
}

test('#119: o pacote leva Electron e payload, sem clone e sem o app genérico',()=>{
 const stage=tempDir('summa-stage-');
 const {payload}=stageWindowsRelease({desk:DESK,electronDist:fakeElectronDist(),stage,version:'9.9.9'});
 assert.equal(payload,path.join(stage,'resources','app'));
 assert.equal(fs.existsSync(path.join(stage,'electron.exe')),true);
 assert.equal(fs.existsSync(path.join(stage,'resources','default_app.asar')),false);
 assert.equal(fs.existsSync(path.join(payload,'install-source.json')),false,'sem origem o app não procura um clone');
 for(const file of ['main.cjs','renderer-entry.cjs','update-signing-key.pub','windows-installer-update.cjs','assets/mesa.ico','node_modules/marked/package.json'])assert.equal(fs.existsSync(path.join(payload,file)),true,file);
 const {rendererEntry}=require(path.join(payload,'renderer-entry.cjs'));
 assert.deepEqual(rendererEntry({env:{},deskDir:payload}),{kind:'file',file:path.join(payload,'index.html')});
 assert.equal(JSON.parse(fs.readFileSync(path.join(payload,'.update-manifest.json'),'utf8')).version,'9.9.9');
});

test('#119: o makensis recebe versão, pasta, saída e ícone, e aviso vira erro',()=>{
 const args=makensisArgs({desk:'/d',stage:'/s',outFile:'/o/Summa-Setup-1.4.0.exe',version:'1.4.0',installedKb:2048,commit:'a'.repeat(40)});
 assert.ok(args.includes('-WX'));
 for(const value of ['-DVERSION=1.4.0','-DCOMMIT='+ 'a'.repeat(40),'-DSTAGE_DIR=/s','-DOUT_FILE=/o/Summa-Setup-1.4.0.exe','-DINSTALLED_KB=2048'])assert.ok(args.includes(value),value);
 assert.equal(args.at(-1),path.join('/d','scripts','summa.nsi'));
});

test('#119: o build recusa commit ausente ou fora do formato git',()=>{
 for(const commit of [undefined,'','abc','a'.repeat(39),'g'.repeat(40)]){
  assert.throws(()=>makensisArgs({desk:'/d',stage:'/s',outFile:'/o',version:'1.4.0',installedKb:1,commit}),/recebido.*esperado SHA-1 git/);
 }
});

test('#119: o instalador fica por usuário e fora dos dados do aluno',()=>{
 assert.match(NSI,/RequestExecutionLevel user/);
 assert.match(NSI,/InstallDir "\$LOCALAPPDATA\\Programs\\Summa"/);
 assert.doesNotMatch(NSI,/HKLM|\$PROGRAMFILES/);
 assert.doesNotMatch(NSI.replace(/^;.*$/gm,''),/\$APPDATA|Mesa de Estudos/,'o script não toca a pasta de dados');
});

test('#119: a troca de pastas preserva a versão anterior quando falha',()=>{
 const swap=NSI.slice(NSI.indexOf('Function SwapInstall'),NSI.indexOf('Function RegisterInstall'));
 assert.ok(swap.indexOf('Call MoveCurrentAside')<swap.indexOf('Rename "$INSTDIR.new" "$INSTDIR"'));
 assert.match(swap,/Rename "\$INSTDIR\.old" "\$INSTDIR"\s+Call FailInstall/);
 const section=NSI.slice(NSI.indexOf('Section "Summa"'),NSI.indexOf('Section "Uninstall"'));
 assert.ok(section.indexOf('Call SwapInstall')<section.indexOf('RMDir /r "$INSTDIR.old"'),'a versão antiga só sai depois da troca');
});

test('#119: a Summa só recebe o aviso depois de a versão nova estar extraída e conferida',()=>{
 const section=NSI.slice(NSI.indexOf('Section "Summa"'),NSI.indexOf('Section "Uninstall"'));
 assert.ok(section.indexOf('File /r')<section.indexOf('Call SignalReady'));
 assert.ok(section.indexOf('resources\\app\\package.json')<section.indexOf('Call SignalReady'));
 assert.ok(section.indexOf('Call SignalReady')<section.indexOf('Call SwapInstall'));
});

test('#119: o tamanho instalado vem do build e soma as subpastas',()=>{
 const stage=tempDir('summa-stage-size-');
 fs.mkdirSync(path.join(stage,'resources','app'),{recursive:true});
 fs.writeFileSync(path.join(stage,'electron.exe'),Buffer.alloc(1024));
 fs.writeFileSync(path.join(stage,'resources','app','main.cjs'),Buffer.alloc(1025));
 assert.equal(stageSizeKb(stage),3);
 assert.doesNotMatch(NSI,/\$\{GetSize\}/,'somar os arquivos na instalação deixa a Summa fechada por minutos');
});

test('#119: a Summa reabre logo depois da troca, sem esperar apagar a versão antiga',()=>{
 const section=NSI.slice(NSI.indexOf('Section "Summa"'),NSI.indexOf('Section "Uninstall"'));
 assert.ok(section.indexOf('Call SwapInstall')<section.indexOf('Call ReopenAfterUpdate'));
 assert.ok(section.indexOf('Call ReopenAfterUpdate')<section.indexOf('RMDir /r "$INSTDIR.old"'));
});

test('#119: o desinstalador confere a pasta e recusa com a Summa aberta',()=>{
 const uninstall=NSI.slice(NSI.indexOf('Section "Uninstall"'));
 assert.ok(uninstall.indexOf('!= "$LOCALAPPDATA\\Programs\\Summa"')<uninstall.indexOf('RMDir /r'));
 assert.ok(uninstall.indexOf('Call un.MoveCurrentAside')<uninstall.indexOf('RMDir /r "$INSTDIR.removing"'));
});

test('the uninstaller shares the bounded Retry/Cancel rename loop',()=>{
 const uninstall=NSI.slice(NSI.indexOf('Section "Uninstall"'));
 assert.match(uninstall,/Call un.MoveCurrentAside/);
 assert.match(NSI,/!insertmacro MoveCurrentAside "un\." "removing" "un\.FailUninstall"/);
 const retry=NSI.slice(NSI.indexOf('!macro MoveCurrentAside'),NSI.indexOf('!macroend',NSI.indexOf('!macro MoveCurrentAside')));
 assert.match(retry,/Rename "\$INSTDIR" "\$INSTDIR\.\$\{suffix\}"/);
 assert.match(retry,/\$R0 < \$R1[\s\S]*Sleep 500[\s\S]*Goto retry/);
 assert.match(retry,/\$\{IfNot\} \$\{Silent\}[\s\S]*MB_RETRYCANCEL\|MB_ICONEXCLAMATION[\s\S]*IDCANCEL giveUp\s+StrCpy \$R0 0\s+Goto retry/);
 assert.match(retry,/giveUp:\s+Call \$\{failure\}/);
 assert.match(NSI,/Function un.FailUninstall\s+SetErrorLevel 2\s+Quit\s+FunctionEnd/);
});

test('#119: a troca interativa pergunta logo e reserva a espera longa ao silêncio ou atualização',()=>{
 const move=NSI.slice(NSI.indexOf('!macro MoveCurrentAside'),NSI.indexOf('!macroend',NSI.indexOf('!macro MoveCurrentAside')));
 assert.match(NSI,/!define INTERACTIVE_SWAP_ATTEMPTS 7/);
 assert.match(NSI,/!define SWAP_ATTEMPTS 240/);
 assert.match(move,/StrCpy \$R1 \$\{INTERACTIVE_SWAP_ATTEMPTS\}\s+\$\{If\} \$\{Silent\}\s+\$\{OrIf\} \$IsUpdate == "1"\s+StrCpy \$R1 \$\{SWAP_ATTEMPTS\}\s+\$\{EndIf\}\s+retry:/);
 assert.match(move,/\$\{If\} \$R0 < \$R1\s+Sleep 500\s+Goto retry/);
 assert.match(move,/MessageBox MB_RETRYCANCEL\|MB_ICONEXCLAMATION "\$\(AppOpen\)" IDCANCEL giveUp\s+StrCpy \$R0 0\s+Goto retry/);
});

function installedPayload(){
 const payload=path.join(tempDir('summa-installed-'),'Summa','resources','app');
 fs.mkdirSync(payload,{recursive:true});
 return payload;
}

test('#119: o app instalado nunca guarda o runtime dentro da própria pasta',()=>{
 const payload=installedPayload();
 assert.equal(hasSourceTree(payload),false);
 assert.equal(seedRuntimePath(payload),'','vazio leva o runtime para a pasta de dados do usuário');
});

test('#119: rodar do código mantém o runtime no clone',()=>{
 assert.equal(hasSourceTree(DESK),true);
 assert.equal(seedRuntimePath(DESK),path.join(path.resolve(DESK,'..'),'desk','.runtime'));
});

test('#119: quem veio do clone continua vendo as sessões que ficaram lá',()=>{
 const clone=tempDir('summa-old-clone-');
 const runtime=path.join(clone,'desk','.runtime');
 fs.mkdirSync(runtime,{recursive:true});
 const payload=installedPayload();
 fs.writeFileSync(path.join(payload,'previous-install-source.json'),JSON.stringify({path:clone,remote:''}));
 assert.equal(legacyCloneRuntime(payload),runtime);
 assert.equal(seedRuntimePath(payload),runtime);
 fs.rmSync(runtime,{recursive:true});
 assert.equal(seedRuntimePath(payload),'','clone apagado não vira caminho quebrado');
});

test('#119: o instalador leva a origem do clone para a versão nova',()=>{
 const section=NSI.slice(NSI.indexOf('Section "Summa"'),NSI.indexOf('Section "Uninstall"'));
 assert.ok(section.indexOf('Call KeepCloneOrigin')<section.indexOf('Call SwapInstall'),'a origem é copiada antes de a pasta antiga sair');
 assert.match(NSI,/install-source\.json" "\$INSTDIR\.new\\resources\\app\\previous-install-source\.json"/);
});
