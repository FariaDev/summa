import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {INTEGRAL_VARIANTS, integralSvg} from '../scripts/integral-art.mjs';

/* #189: com o app aberto, a integral segue o tema e o acento; o pacote fica no
   dark-graphite. O app, a janela e o disco são falsos com nome; o último teste
   olha os arquivos gerados de verdade em assets/. */
const require=createRequire(import.meta.url);
const {appIconPaths,createAppIcon,iconVariant}=require('../app-icon-host.cjs');
const DESK=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ASSETS='/mesa/assets';
const asset=(...parts)=>path.join(ASSETS,...parts);
const bundle={dock:asset('mesa-1024.png'),window:asset('mesa.ico')};

const EMPTY_DOCK_ICON={empty:true};
function fakeDisk(files){return (file)=>files.includes(file);}
function fakeElectronApp(){const calls=[];return {calls,app:{dock:{setIcon:(file)=>calls.push(file)}}};}
function fakeEmptyIcon(){return EMPTY_DOCK_ICON;}
function fakeWindow(){const calls=[];return {calls,setIcon:(file)=>calls.push(file),isDestroyed:()=>false};}

test('as quatro combinações de tema e tinta', () => {
  const cases=[
    ['light','graphite','light-graphite'],
    ['dark','graphite','dark-graphite'],
    ['light','violet','light-violet'],
    ['dark','violet','dark-violet'],
  ];
  for (const [theme,accent,id] of cases) {
    assert.deepEqual(appIconPaths(ASSETS,{theme,accent},{exists:()=>true}),{
      dock:asset('app-icon',`integral-${id}-dock.png`),
      window:asset('app-icon',`integral-${id}-256.png`),
    });
  }
});

test('acento desconhecido cai na tinta grafite', () => {
  for (const accent of ['blue','green','orange','pink','graphite','teal','../violet']) {
    assert.equal(iconVariant('dark',accent,()=>false),'dark-graphite');
  }
});

test('tema do sistema segue o tema do sistema', () => {
  assert.equal(iconVariant('auto','violet',()=>true),'dark-violet');
  assert.equal(iconVariant('auto','violet',()=>false),'light-violet');
  assert.equal(iconVariant('system','graphite',()=>true),'dark-graphite');
});

test('arquivo ausente cai no ícone do pacote', () => {
  const light=fakeDisk([asset('app-icon','integral-light-graphite-dock.png'),asset('app-icon','integral-light-graphite-256.png')]);
  assert.deepEqual(appIconPaths(ASSETS,{theme:'light',accent:'graphite'},{exists:light}),{
    dock:asset('app-icon','integral-light-graphite-dock.png'),
    window:asset('app-icon','integral-light-graphite-256.png'),
  });
  assert.deepEqual(appIconPaths(ASSETS,{theme:'dark',accent:'violet'},{exists:light}),bundle);
});

test('no macOS o Dock troca de ícone quando o tema ou o acento muda', () => {
  const {app,calls}=fakeElectronApp();
  const icon=createAppIcon({app,platform:'darwin',assetsDir:ASSETS,exists:()=>true,emptyIcon:fakeEmptyIcon});
  icon.apply(null,'graphite','light');
  icon.apply(null,'graphite','light');
  icon.apply(null,'violet','light');
  icon.apply(null,'graphite','dark');
  assert.deepEqual(calls,[
    asset('app-icon','integral-light-graphite-dock.png'),
    asset('app-icon','integral-light-violet-dock.png'),
    EMPTY_DOCK_ICON,
  ]);
});

test('#3: no macOS a variante do pacote não chama setIcon, e voltar a ela restaura o pacote', () => {
  const {app,calls}=fakeElectronApp();
  const icon=createAppIcon({app,platform:'darwin',assetsDir:ASSETS,exists:()=>true,emptyIcon:fakeEmptyIcon});
  icon.apply(null,'graphite','dark');
  assert.deepEqual(calls,[],'a variante do pacote fica com o ícone do bundle');
  icon.apply(null,'violet','dark');
  icon.apply(null,'graphite','dark');
  icon.apply(null,'graphite','dark');
  assert.deepEqual(calls,[
    asset('app-icon','integral-dark-violet-dock.png'),
    EMPTY_DOCK_ICON,
  ]);
});

test('no modo de teste o Dock escondido não é tocado', () => {
  const {app,calls}=fakeElectronApp();
  createAppIcon({app,platform:'darwin',assetsDir:ASSETS,dockEnabled:false,exists:()=>true}).apply(null,'graphite','dark');
  assert.deepEqual(calls,[]);
});

test('no Windows a janela recebe o PNG de 256 da combinação', () => {
  const win=fakeWindow();
  createAppIcon({app:{},platform:'win32',assetsDir:ASSETS,exists:()=>true}).apply(win,'violet','dark');
  assert.deepEqual(win.calls,[asset('app-icon','integral-dark-violet-256.png')]);
});

test('no Windows, chamar antes da janela existir não conta como aplicado', () => {
  const icon=createAppIcon({app:{},platform:'win32',assetsDir:ASSETS,exists:()=>true});
  icon.apply(null,'graphite','light');
  const win=fakeWindow();icon.apply(win,'graphite','light');
  assert.deepEqual(win.calls,[asset('app-icon','integral-light-graphite-256.png')]);
});

test('o SVG usa o path literal, a grade do macOS e o traço só até 32 px', () => {
  const big=integralSvg('dark-graphite',1024);
  assert.match(big,/viewBox="0 0 1024 1024"/);
  assert.match(big,/viewBox="155 150 940 940"/);
  assert.match(big,/fill="#161616"/);
  assert.match(big,/fill="#ffffff"/);
  assert.doesNotMatch(big,/stroke-width/);
  const tiny=integralSvg('light-violet',32);
  assert.match(tiny,/stroke="#8044ca"/);
  assert.match(tiny,/stroke-width="48"/);
  assert.match(tiny,/stroke-linejoin="round"/);
  assert.throws(()=>integralSvg('sepia',16),/Variante do ícone desconhecida: "sepia"/);
});

test('as quatro variantes têm Dock e os PNGs de 256 a 16 gerados', () => {
  assert.deepEqual(Object.keys(INTEGRAL_VARIANTS),['light-graphite','dark-graphite','light-violet','dark-violet']);
  for (const id of Object.keys(INTEGRAL_VARIANTS)) {
    for (const suffix of ['-dock.png','-256.png','-128.png','-64.png','-32.png','-16.png']) {
      const file=path.join(DESK,'assets','app-icon',`integral-${id}${suffix}`);
      assert.ok(fs.existsSync(file),`falta ${path.basename(file)}`);
    }
  }
  for (const file of ['mesa-1024.png','mesa.icns','mesa.ico']) assert.ok(fs.existsSync(path.join(DESK,'assets',file)),`falta ${file}`);
});
