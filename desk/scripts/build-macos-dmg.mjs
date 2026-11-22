// @ts-check
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import runtimeBundle from '../bundle-runtime.cjs';
import bundleElectron from '../bundle-electron.cjs';
import {ensureElectronBinary} from './electron-binary.mjs';
import {ensureVisualHelper} from './visual-helper.mjs';

const DESK=path.resolve(import.meta.dirname,'..');

/**
 * Monta o app independente, sem procedência do computador que gerou a release.
 * @param {{desk:string, electronApp:string, stage:string, version:string, root?:string}} input
 * @returns {{app:string, payload:string}}
 * @example stageMacosRelease({desk,electronApp,stage,version:'1.4.0'})
 */
export function stageMacosRelease({desk,electronApp,stage,version,root=path.dirname(desk)}){
 const app=path.join(stage,'Summa.app');
 bundleElectron.ensureBundleExists({source:electronApp,app});
 const {dest:payload,managed}=runtimeBundle.installBundle({desk,root,app,version,recordSource:false});
 const executables=path.join(app,'Contents','MacOS');
 fs.mkdirSync(executables,{recursive:true});
 execFileSync('xcrun',['clang','-mmacosx-version-min=11.0',path.join(import.meta.dirname,'macos-swap.c'),'-o',path.join(executables,'summa-swap')]);
 for(const name of ['install-source.json','previous-install-source.json'])fs.rmSync(path.join(payload,name),{force:true});
 fs.rmSync(path.join(app,'Contents','Resources','default_app.asar'),{force:true});
 fs.writeFileSync(path.join(payload,'release-install.json'),JSON.stringify({kind:'macos-dmg',version})+'\n');
 runtimeBundle.writeManifest(payload,[...managed,'release-install.json'],version);
 fs.symlinkSync('/Applications',path.join(stage,'Applications'));
 return {app,payload};
}

/**
 * Argumentos da imagem comprimida para distribuir no macOS.
 * @param {{stage:string, outFile:string}} input
 * @returns {string[]}
 * @example dmgArgs({stage:'/stage',outFile:'/out/Summa-1.4.0.dmg'})
 */
export function dmgArgs({stage,outFile}){
 return ['create','-volname','Summa','-srcfolder',stage,'-format','UDZO','-ov',outFile];
}

async function main(args){
 if(process.platform!=='darwin')throw Error(`plataforma recebida ${process.platform}; esperado darwin`);
 const at=args.indexOf('--out');
 if(at>=0&&(!args[at+1]||args[at+1].startsWith('--')))throw Error('--out recebido sem pasta; esperado --out <pasta>');
 const outDir=path.resolve(at>=0?args[at+1]:path.join(DESK,'..','release-installer'));
 const version=JSON.parse(fs.readFileSync(path.join(DESK,'package.json'),'utf8')).version;
 ensureElectronBinary({electronDir:path.join(DESK,'node_modules','electron')});
 if(ensureVisualHelper({root:path.dirname(DESK)})==='failed')throw Error('helper do Conferir ausente; esperado compilador Swift disponível');
 const stage=fs.mkdtempSync(path.join(os.tmpdir(),'summa-dmg-'));
 const outFile=path.join(outDir,`Summa-${version}.dmg`);
 try{
  const {app}=stageMacosRelease({desk:DESK,electronApp:path.join(DESK,'node_modules','electron','dist','Electron.app'),stage,version});
  execFileSync('codesign',['--force','--deep','-s','-',app],{stdio:'inherit'});
  fs.mkdirSync(outDir,{recursive:true});
  execFileSync('hdiutil',dmgArgs({stage,outFile}),{stdio:'inherit'});
 }finally{fs.rmSync(stage,{recursive:true,force:true});}
 console.log(`instalador: ${outFile} (${fs.statSync(outFile).size} bytes)`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main(process.argv.slice(2)).catch(error=>{console.error(`build-macos-dmg: ${error.message}`);process.exitCode=1;});
}
