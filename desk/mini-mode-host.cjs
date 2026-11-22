// @ts-check
'use strict';

const sanitize=require('./desk-state-sanitize.cjs');
const {titleBarVisible}=require('./lib.cjs');
const {rescueBounds}=require('./window-display-host.cjs');

/* Modo mini (passo 9, protótipo r7): a MESMA janela principal encolhe para só o
   chat do tutor, no canto de baixo à direita da área de trabalho da tela onde
   ela está, sempre por cima. Este host cuida do que é da janela — tamanho,
   lugar, "sempre por cima", tamanho mínimo e a barra de menu —, guarda a
   posição e o tamanho do mini para a próxima vez e devolve a janela ao estado
   de antes (bounds, maximizada, tela cheia, por cima) ao sair. O que é de
   interface (esconder o cabeçalho da Mesa, o cabeçalho mini) mora em
   `src/mini-mode.mjs`.

   O desk.json guarda dois campos novos, só de interface: `miniBounds` e
   `miniAlwaysOnTop` (ligado por padrão). O modo em si NÃO é persistido: fechar
   a janela no mini volta à Mesa antes, para o Summa abrir normal. Enquanto o
   mini está ligado, `windowBounds()` devolve os limites da janela NORMAL, que é
   o que o `persist()` do main grava em `bounds` (sem isso o mini viraria o
   tamanho da Mesa na próxima abertura). */

/** Tamanho do mini e folga até a borda da área de trabalho. */
const MINI_SIZE={width:360,height:480};
const MINI_MARGIN=16;
/** Mínimo do mini enquanto ligado (a Mesa tem 900×650; o mini precisa de bem menos). */
const MINI_MIN={width:300,height:360};
const SETTLE_MS=1500;

/** @typedef {{x: number, y: number, width: number, height: number}} Bounds */

/** Limites válidos (números finitos, tamanho positivo) ou `undefined`: a mesma sanitização do desk.json. @type {(value: unknown) => Bounds | undefined} */
const asBounds=/** @type {any} */ (sanitize.asBounds);

/** @param {Bounds} a @param {Bounds} b @returns {number} área da interseção, 0 quando não se tocam */
function overlapArea(a,b){
 const width=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
 const height=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
 return width>0&&height>0?width*height:0;
}

/**
 * A área de trabalho da tela onde a janela está: a de maior interseção com os
 * limites dela; sem interseção (janela fora de toda tela), a da primária.
 * @param {Array<{workArea?: Bounds}>} displays telas do Electron (ou fake)
 * @param {Bounds | null | undefined} bounds limites da janela
 * @param {{workArea?: Bounds} | null} [primary] tela primária
 * @returns {Bounds | null}
 * @example pickWorkArea([{workArea: {x: 0, y: 0, width: 1920, height: 1040}}], {x: 100, y: 100, width: 900, height: 650}) // {x: 0, y: 0, width: 1920, height: 1040}
 */
function pickWorkArea(displays,bounds,primary){
 let best=null,bestArea=0;
 if(bounds)for(const display of displays||[]){
  const area=display?.workArea?overlapArea(bounds,display.workArea):0;
  if(area>bestArea){best=display.workArea;bestArea=area;}
 }
 return best||primary?.workArea||(displays||[]).find(display=>display?.workArea)?.workArea||null;
}

/**
 * O canto de baixo à direita da área de trabalho, com folga. Área menor que o
 * mini encolhe o mini até ela, sem folga.
 * @param {Bounds} workArea
 * @param {{width: number, height: number}} [size]
 * @param {number} [margin]
 * @returns {Bounds}
 * @example cornerBounds({x: 0, y: 0, width: 1920, height: 1040}) // {x: 1544, y: 544, width: 360, height: 480}
 */
function cornerBounds(workArea,size=MINI_SIZE,margin=MINI_MARGIN){
 const width=Math.min(size.width,workArea.width),height=Math.min(size.height,workArea.height);
 const gapX=workArea.width>=width+2*margin?margin:0,gapY=workArea.height>=height+2*margin?margin:0;
 return {x:Math.round(workArea.x+workArea.width-width-gapX),y:Math.round(workArea.y+workArea.height-height-gapY),width:Math.round(width),height:Math.round(height)};
}

/**
 * Limita limites salvos à área: tamanho entre o mínimo do mini e a área, e a
 * janela inteira dentro dela (o mini é pequeno, então nada fica fora de vista).
 * @param {Bounds} bounds
 * @param {Bounds} workArea
 * @returns {Bounds}
 * @example constrainMiniBounds({x: 5000, y: 5000, width: 360, height: 480}, {x: 0, y: 0, width: 1920, height: 1040}) // {x: 1560, y: 560, width: 360, height: 480}
 */
function constrainMiniBounds(bounds,workArea){
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const width=clamp(bounds.width,Math.min(MINI_MIN.width,workArea.width),workArea.width);
 const height=clamp(bounds.height,Math.min(MINI_MIN.height,workArea.height),workArea.height);
 return {x:Math.round(clamp(bounds.x,workArea.x,workArea.x+workArea.width-width)),y:Math.round(clamp(bounds.y,workArea.y,workArea.y+workArea.height-height)),width:Math.round(width),height:Math.round(height)};
}

/**
 * Onde o mini nasce: os limites salvos da última vez, se ainda tocam alguma
 * tela (limitados a ela); senão o canto da tela onde a Mesa está.
 * @param {{displays?: Array<{workArea?: Bounds}>, primary?: {workArea?: Bounds} | null, mainBounds?: Bounds | null, saved?: unknown}} input
 * @returns {Bounds | {width: number, height: number}} sem nenhuma tela conhecida, só o tamanho
 * @example resolveMiniBounds({displays, primary, mainBounds: {x: 100, y: 100, width: 900, height: 650}, saved: null}) // o canto da tela da Mesa
 */
function resolveMiniBounds({displays=[],primary=null,mainBounds=null,saved=null}){
 const clean=asBounds(saved);
 if(clean){
  const area=pickWorkArea(displays,clean,null);
  if(area&&displays.some(display=>display?.workArea&&overlapArea(clean,display.workArea)>0))return constrainMiniBounds(clean,area);
 }
 const area=pickWorkArea(displays,mainBounds,primary);
 return area?cornerBounds(area):{...MINI_SIZE};
}

/** @param {unknown} payload @returns {{on?: boolean, alwaysOnTop?: boolean}} */
function parseRequest(payload){
 const fail=()=>Error(`Modo mini inválido: esperado {on?: boolean, alwaysOnTop?: boolean}, recebido ${String(JSON.stringify(payload)).slice(0,80)}`);
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw fail();
 const {on,alwaysOnTop}=/** @type {{on?: unknown, alwaysOnTop?: unknown}} */ (payload);
 if((on!==undefined&&typeof on!=='boolean')||(alwaysOnTop!==undefined&&typeof alwaysOnTop!=='boolean'))throw fail();
 return /** @type {{on?: boolean, alwaysOnTop?: boolean}} */ ({...(on===undefined?{}:{on}),...(alwaysOnTop===undefined?{}:{alwaysOnTop})});
}

/**
 * Liga o modo mini à janela principal: o canal `mini-mode` (`{on?, alwaysOnTop?}`
 * → `{on, alwaysOnTop}`), o fechar-volta-à-Mesa e o resgate quando a tela some.
 * Tudo entra por parâmetro, então o teste dirige uma janela e uma tela falsas.
 * @param {{win: any, screen?: any, ipcMain?: {handle: (channel: string, fn: (event: any, payload: unknown) => unknown) => void},
 *   trusted?: (event: any) => boolean, loadState?: () => {miniBounds?: unknown, miniAlwaysOnTop?: unknown},
 *   saveState?: (patch: object) => void, log?: (line: string) => void, debounceMs?: number, settleMs?: number}} host
 * @returns {{enter: () => Promise<{on: boolean, alwaysOnTop: boolean}>, leave: () => {on: boolean, alwaysOnTop: boolean}, isOn: () => boolean, windowBounds: () => Bounds | null}}
 * @example const mini = registerMiniModeHost({win, screen, ipcMain, trusted, loadState, saveState}); await mini.enter();
 */
function registerMiniModeHost({win,screen,ipcMain,trusted=()=>true,loadState=()=>({}),saveState=()=>{},log=()=>{},debounceMs=350,settleMs=SETTLE_MS}){
 let on=false,entering=null,closingBounds=null,saveTimer=null;
 /** @type {{bounds: Bounds, maximized: boolean, fullScreen: boolean, onTop: boolean, min: number[], menuBar: boolean} | null} */
 let before=null;
 const stored=()=>{try{return loadState()||{};}catch{return {};}};
 const pinned=()=>stored().miniAlwaysOnTop!==false;
 const state=()=>({on,alwaysOnTop:pinned()});
 const displays=()=>{try{return screen?.getAllDisplays?.()||[];}catch{return [];}};
 const primary=()=>{try{return screen?.getPrimaryDisplay?.()||null;}catch{return null;}};
 const alive=()=>!win.isDestroyed?.();
 const remember=()=>{
  const bounds=alive()?asBounds(win.getBounds()):undefined;
  if(bounds)saveState({miniBounds:bounds});
 };
 const scheduleSave=()=>{
  if(!on)return;
  if(saveTimer)clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{saveTimer=null;if(on)remember();},debounceMs);
  if(typeof saveTimer?.unref==='function')saveTimer.unref();
 };
 /** Espera o evento da janela (sair da tela cheia/maximizada), com prazo: nem toda plataforma o emite. */
 const settle=event=>new Promise(resolve=>{
  const done=()=>{clearTimeout(timer);win.removeListener(event,done);resolve(undefined);};
  const timer=setTimeout(done,settleMs);
  win.once(event,done);
 });

 async function runEnter(){
  const maximized=win.isMaximized(),fullScreen=win.isFullScreen();
  const normal=(maximized||fullScreen)&&typeof win.getNormalBounds==='function'?win.getNormalBounds():win.getBounds();
  const bounds=asBounds(normal);
  if(!bounds)throw Error(`Modo mini: a janela não tem limites válidos (recebido ${String(JSON.stringify(normal)).slice(0,80)})`);
  before={bounds,maximized,fullScreen,onTop:win.isAlwaysOnTop(),min:win.getMinimumSize(),menuBar:win.isMenuBarVisible?.()!==false};
  if(fullScreen){win.setFullScreen(false);await settle('leave-full-screen');}
  if(maximized){win.unmaximize();await settle('unmaximize');}
  const target=resolveMiniBounds({displays:displays(),primary:primary(),mainBounds:bounds,saved:stored().miniBounds});
  /* O mínimo cai ANTES do setBounds: com 900×650 de mínimo a janela não encolhia. */
  win.setMinimumSize(MINI_MIN.width,MINI_MIN.height);
  win.setMenuBarVisibility?.(false);
  win.setBounds(target);
  win.setAlwaysOnTop(pinned());
  on=true;
  log(`modo mini ligado (${target.width}×${target.height})`);
 }

 /** Liga o modo; chamadas repetidas esperam a primeira. */
 async function enter(){
  if(on)return state();
  if(!entering)entering=runEnter().finally(()=>{entering=null;});
  await entering;
  return state();
 }

 /** Desliga o modo e devolve a janela ao estado de antes; guarda o lugar do mini. */
 function leave({closing=false}={}){
  if(!on||!before)return state();
  const snapshot=before;
  const bounds=rescueBounds({bounds:snapshot.bounds,displays:displays(),primary:primary()})??snapshot.bounds;
  if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}
  remember();
  on=false;
  before=null;
  if(closing)closingBounds=bounds;
  if(alive()){
   win.setAlwaysOnTop(snapshot.onTop);
   win.setMenuBarVisibility?.(snapshot.menuBar);
   win.setBounds(bounds);
   win.setMinimumSize(snapshot.min[0],snapshot.min[1]);
   if(snapshot.maximized)win.maximize();
   if(snapshot.fullScreen)win.setFullScreen(true);
  }
  log('modo mini desligado');
  return state();
 }

 /* Monitor desconectado com o mini aberto: o mini que ficou fora de toda tela
    volta ao canto da primária (o resgate da Mesa, 900×650 no mínimo, não vale
    para ele: `window-display-host.cjs` pula a janela enquanto o mini está ligado). */
 function reconcile(){
  if(!on||!alive())return;
  const bounds=asBounds(win.getBounds());
  const area=primary()?.workArea;
  if(!area||(bounds&&displays().some(display=>display?.workArea&&titleBarVisible(bounds,display.workArea))))return;
  win.setBounds(cornerBounds(area));
 }

 if(typeof win.on==='function'){
  win.on('move',scheduleSave);
  win.on('resize',scheduleSave);
  /* Fechar no mini volta à Mesa antes (registrado antes do `persist()` do main). */
  win.on('close',()=>{leave({closing:true});});
 }
 /* Recarregar a página perde o estado do renderer: sem sair daqui a janela ficaria pequena com a Mesa inteira dentro. */
 win.webContents?.on?.('did-start-navigation',(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame)leave();});
 if(typeof screen?.on==='function'){
  screen.on('display-removed',reconcile);
  screen.on('display-metrics-changed',reconcile);
 }
 ipcMain?.handle('mini-mode',async(event,payload)=>{
  if(!trusted(event))throw Error('Modo mini: remetente não confiável.');
  const request=parseRequest(payload);
  if(typeof request.alwaysOnTop==='boolean'){
   saveState({miniAlwaysOnTop:request.alwaysOnTop});
   if(on&&alive())win.setAlwaysOnTop(request.alwaysOnTop);
  }
  if(request.on===true)return enter();
  if(request.on===false)return leave();
  return state();
 });

 return {enter,leave:()=>leave(),isOn:()=>on,windowBounds:()=>before?.bounds||closingBounds};
}

module.exports={MINI_SIZE,MINI_MARGIN,MINI_MIN,overlapArea,pickWorkArea,cornerBounds,constrainMiniBounds,resolveMiniBounds,registerMiniModeHost};
