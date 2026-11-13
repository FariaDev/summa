/* Janela do chat lateral solto (#157, fatias 1 e 2): a única liberação de
   `window.open` da Mesa. Só `about:blank` com o nome fixo do chat abre — com
   opções seguras e tamanho inicial estreito, bem menor que os 900×650 da
   Mesa. A filha fica trancada: sem navegação e sem abrir outra janela. Na
   fatia 2 ela lembra posição/tamanho e "sempre por cima" no desk.json. */
const SIDECHAT_WINDOW_NAME='mesa-sidechat';
const {backgroundColorForTheme,themeForBackgroundColor}=require('./window-background.cjs');
const {asBounds}=require('./desk-state-sanitize.cjs');

/** Tema atual pelo fundo da principal (o caminho da principal: ela define o
 * fundo a partir do tema salvo). Cai no claro sem fundo conhecido.
 * @param {{getBackgroundColor?: () => string}} win janela principal
 * @param {string | (( ) => string) | {getTheme?: () => string, theme?: string, currentTheme?: string} | undefined} [getTheme] tema explícito ou leitor de tema
 * @returns {string} `dark` ou `light`
 * @example resolveSidechatTheme(win) // 'light'
 */
function resolveSidechatTheme(win,getTheme){
 if(typeof getTheme==='function')return getTheme();
 if(typeof getTheme==='string')return getTheme;
 if(getTheme&&typeof getTheme==='object'){
  if(typeof getTheme.getTheme==='function')return getTheme.getTheme();
  if(typeof getTheme.theme==='string')return getTheme.theme;
  if(typeof getTheme.currentTheme==='string')return getTheme.currentTheme;
 }
 try{
  const bg=typeof win?.getBackgroundColor==='function'?win.getBackgroundColor():null;
  if(bg)return themeForBackgroundColor(bg);
 }catch{}
 return 'light';
}

/* Encostada na borda direita da área útil (`screen.getDisplayMatching` da
   #157): largura 400 e altura toda, para não abrir por cima do Xournal++. */
function dockRight(workArea){
 const wide=workArea.width||400;
 const width=Math.min(400,wide);
 return {x:workArea.x+wide-width,y:workArea.y,width,height:workArea.height||800};
}

function clampNumber(value,min,max){
 return Math.max(min,Math.min(max,value));
}

function overlapAreaOf(bounds,area){
 const x=Math.max(bounds.x,area.x);
 const y=Math.max(bounds.y,area.y);
 const right=Math.min(bounds.x+bounds.width,area.x+area.width);
 const bottom=Math.min(bounds.y+bounds.height,area.y+area.height);
 return Math.max(0,right-x)*Math.max(0,bottom-y);
}

/* Limita o tamanho a [240, área útil] e desloca para manter a barra de título
 * (topo, ao menos 120 px de largura) dentro da área útil: a esquerda pode
 * sair pela esquerda desde que 120 px sigam visíveis, e o topo segue dentro. */
function constrainSidechatBounds(bounds,workArea){
 const minWidth=Math.min(240,workArea.width);
 const minHeight=Math.min(240,workArea.height);
 const width=clampNumber(bounds.width,minWidth,workArea.width);
 const height=clampNumber(bounds.height,minHeight,workArea.height);
 const visibleWidth=Math.min(120,workArea.width,width);
 const x=clampNumber(bounds.x,workArea.x-width+visibleWidth,workArea.x+workArea.width-visibleWidth);
 const y=clampNumber(bounds.y,workArea.y,workArea.y+workArea.height-1);
 return {x,y,width,height};
}

/* A filha salva continua utilizável se o topo está dentro da área útil e ao
   menos 120 px da barra de título aparecem — a mesma folga que o
   `constrainSidechatBounds` garante ao abrir. */
function sidechatTitleVisible(bounds,workArea){
 const visibleWidth=Math.min(120,workArea.width,bounds.width);
 const horizontal=Math.min(bounds.x+bounds.width,workArea.x+workArea.width)-Math.max(bounds.x,workArea.x);
 return bounds.y>=workArea.y&&bounds.y<workArea.y+workArea.height&&horizontal>=visibleWidth;
}

/** Posição/tamanho da janela solta (#157, fatia 2): salva limitada se sobrepõe
 * alguma tela (monitor com mais sobreposição, mesma lógica `overlaps` da Mesa);
 * fora de monitor volta à principal, e a primeira vez encosta à direita da tela onde está a Mesa.
 * @param {{getAllDisplays?: () => Array<{workArea?: {x: number, y: number, width: number, height: number}}>, getPrimaryDisplay?: () => {workArea?: {x: number, y: number, width: number, height: number}}, getDisplayMatching?: (bounds: {x: number, y: number, width: number, height: number}) => {workArea?: {x: number, y: number, width: number, height: number}}}} [screenLike] telas (o `screen` do Electron, ou fake no teste)
 * @param {{x: number, y: number, width: number, height: number}} [mainBounds] limites da Mesa (a tela dela decide a primeira vez)
 * @param {{x: number, y: number, width: number, height: number} | null} [savedBounds] limites salvos no desk.json (já sanados)
 * @returns {{x: number, y: number, width: number, height: number} | {width: number, height: number}}
 * @example resolveSidechatPlacement(screen, {x: 0, y: 0, width: 900, height: 650}) // encostada à direita
 */
function resolveSidechatPlacement(screenLike,mainBounds,savedBounds){
 const clean=asBounds(savedBounds);
 let displays=[],primary=null,matched=null;
 try{displays=typeof screenLike?.getAllDisplays==='function'?screenLike.getAllDisplays()||[]:[];}catch{}
 try{primary=typeof screenLike?.getPrimaryDisplay==='function'?screenLike.getPrimaryDisplay():null;}catch{}
 if(clean){
  let best=null,bestArea=0;
  for(const d of displays){
   if(!d?.workArea)continue;
   const area=overlapAreaOf(clean,d.workArea);
   if(area>bestArea){bestArea=area;best=d;}
  }
  if(best&&bestArea>0)return constrainSidechatBounds(clean,best.workArea);
  if(primary?.workArea)return dockRight(primary.workArea);
  const first=displays.find(d=>d?.workArea);
  if(first)return dockRight(first.workArea);
  return {width:400,height:800};
 }
 try{matched=typeof screenLike?.getDisplayMatching==='function'&&mainBounds?screenLike.getDisplayMatching(mainBounds):null;}catch{}
 const target=matched||primary||displays.find(d=>d?.workArea);
 if(target?.workArea)return dockRight(target.workArea);
 return {width:400,height:800};
}

/** Opções da janela filha do chat lateral.
 * @param {string} [theme] `dark`, `light` ou `auto` (resto cai no claro)
 * @param {{x?: number, y?: number, width?: number, height?: number, alwaysOnTop?: boolean}} [placement] posição/tamanho resolvidos e o por cima (fatias 1 e 2)
 * @returns {{width: number, height: number, minWidth: number, minHeight: number, backgroundColor: string, autoHideMenuBar: boolean, webPreferences: {sandbox: boolean, contextIsolation: boolean, nodeIntegration: boolean}, x?: number, y?: number, alwaysOnTop?: boolean}}
 * @example sidechatChildWindowOptions('dark') // backgroundColor '#191919'
 */
function sidechatChildWindowOptions(theme,placement){
 /* A filha nasce sem a barra de menu do Electron (Mesa Editar Estudar ...):
    `autoHideMenuBar` mantém o menu/aplicação e os aceleradores vivos, só não
    pinta a barra (Ctrl+C/V/Z seguem no campo de texto). */
 const options={
  width:400,height:800,minWidth:240,minHeight:240,
  backgroundColor:backgroundColorForTheme(theme),autoHideMenuBar:true,
  webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false},
 };
 if(placement&&typeof placement==='object'){
  if(Number.isFinite(placement.width)&&placement.width>0)options.width=placement.width;
  if(Number.isFinite(placement.height)&&placement.height>0)options.height=placement.height;
  if(Number.isFinite(placement.x)&&Number.isFinite(placement.y)){options.x=placement.x;options.y=placement.y;}
  options.alwaysOnTop=placement.alwaysOnTop===true;
 }
 return options;
}

/** Decide se um `window.open` é a janela do chat lateral.
 * @param {{url?: string, frameName?: string}} [details] pedido do `window.open`
 * @param {string} [theme] tema atual (`dark`, `light` ou `auto`)
 * @param {{x?: number, y?: number, width?: number, height?: number, alwaysOnTop?: boolean}} [placement] posição/tamanho resolvidos e o por cima (fatia 2)
 * @returns {{action: 'allow', overrideBrowserWindowOptions: ReturnType<typeof sidechatChildWindowOptions>} | {action: 'deny'}}
 * @example decideSidechatWindowOpen({url:'about:blank',frameName:'mesa-sidechat'},'dark') */
function decideSidechatWindowOpen(details={},theme,placement){
 if(!details||details.url!=='about:blank'||details.frameName!==SIDECHAT_WINDOW_NAME)return {action:'deny'};
 return {action:'allow',overrideBrowserWindowOptions:sidechatChildWindowOptions(theme,placement)};
}

/** Tranca a janela filha: sem nova `window.open` e sem mudar de página.
 * @param {{webContents: {setWindowOpenHandler: (fn: () => {action: 'deny'}) => void, on: (event: string, fn: (event: {preventDefault: () => void}) => void) => void}}} child
 * @returns {void}
 * @example guardSidechatChildWindow(child) */
function guardSidechatChildWindow(child){
 child.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 child.webContents.on('will-navigate',event=>event.preventDefault());
 child.webContents.on('will-redirect',event=>event.preventDefault());
}

/** Liga o guarda na janela principal: o handler da Mesa e o trancamento da filha.
 * Fecha as filhas quando a principal recarrega (⌘R/F5), sem órfãs soltas.
 * Desconhecido (sem `getBackgroundColor`) cai no claro. Na fatia 2 ela também
 * resolve a posição (salva ou encostada), lembra mover/redimensionar com
 * debounce e ao fechar, e aplica/persiste o "sempre por cima" no desk.json.
 * @param {{webContents: {setWindowOpenHandler: (fn: (details: {url?: string, frameName?: string}) => object) => void, on: (event: string, fn: (...args: any[]) => void) => void}, on: (event: string, fn: () => void) => void, getBackgroundColor?: () => string, getBounds?: () => {x: number, y: number, width: number, height: number}}} win
 * @param {string | (() => string) | {getTheme?: () => string, theme?: string, currentTheme?: string}} [getTheme] tema atual ou leitor (sem, infere do fundo)
 * @param {{screen?: object, loadState?: () => object, saveState?: (patch: object) => void, ipcMain?: {handle: (channel: string, fn: (event: object, payload: object) => unknown) => void}, debounceMs?: number}} [host] telas e acessores do estado (sem eles, só o guarda da fatia 1)
 * @returns {void}
 * @example registerSidechatWindowGuard(win) */
function registerSidechatWindowGuard(win,getTheme,host={}){
 const children=new Set();
 const lastBounds=new Map();
 let saveTimer=null,mainGone=false;
 const debounceMs=Number.isFinite(host.debounceMs)?host.debounceMs:350;
 const shared=()=>{try{return typeof host.loadState==='function'?host.loadState()||{}:{};}catch{return{};}};
 const savePatch=(patch)=>{if(typeof host.saveState==='function')try{host.saveState(patch);}catch{}};
 const scheduleSave=(child)=>{
  try{const clean=asBounds(typeof child.getBounds==='function'?child.getBounds():null);if(clean)lastBounds.set(child,clean);}catch{}
  if(saveTimer)clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{saveTimer=null;const bounds=lastBounds.get(child);savePatch(bounds?{sidechatBounds:{...bounds},sidechatDetached:true}:{sidechatDetached:true});},debounceMs);
  if(saveTimer&&typeof saveTimer.unref==='function')saveTimer.unref();
 };
 const closeChildren=()=>{
  for(const child of [...children])if(!child.isDestroyed?.())child.close?.();
 };
 win.webContents.setWindowOpenHandler(details=>{
  const theme=resolveSidechatTheme(win,getTheme);
  if(!details||details.url!=='about:blank'||details.frameName!==SIDECHAT_WINDOW_NAME)return decideSidechatWindowOpen(details,theme);
  const state=shared();
  let placement=null;
  if(host.screen){
   try{placement=resolveSidechatPlacement(host.screen,typeof win.getBounds==='function'?win.getBounds():null,asBounds(state.sidechatBounds));}catch{}
  }
  return decideSidechatWindowOpen(details,theme,{...(placement||{}),alwaysOnTop:state.sidechatAlwaysOnTop===true});
 });
 win.webContents.on('did-create-window',child=>{
  if(!child||children.has(child))return;
  children.add(child);
  mainGone=false;
  guardSidechatChildWindow(child);
  /* `autoHideMenuBar` já vale na criação; a chamada garante a barra oculta
     mesmo se o tema/plataforma a pintar antes do primeiro quadro. */
  try{if(typeof child.setMenuBarVisibility==='function')child.setMenuBarVisibility(false);}catch{}
  try{if(typeof child.setAlwaysOnTop==='function')child.setAlwaysOnTop(shared().sidechatAlwaysOnTop===true);}catch{}
  savePatch({sidechatDetached:true});
  try{const clean=asBounds(typeof child.getBounds==='function'?child.getBounds():null);if(clean)lastBounds.set(child,clean);}catch{}
  try{child.on('move',()=>scheduleSave(child));child.on('resize',()=>scheduleSave(child));}catch{}
  child.on('closed',()=>{
   const bounds=lastBounds.get(child);
   children.delete(child);
   lastBounds.delete(child);
   if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}
   const detached=children.size>0||mainGone;
   savePatch(bounds?{sidechatDetached:detached,sidechatBounds:{...bounds}}:{sidechatDetached:detached});
  });
 });
 win.webContents.on('did-start-navigation',(_e,_url,_isInPlace,isMainFrame)=>{if(isMainFrame){mainGone=true;closeChildren();}});
 const onGone=()=>{mainGone=true;closeChildren();};
 win.webContents.on('render-process-gone',onGone);
 win.webContents.on('destroyed',onGone);
 win.on('close',()=>{mainGone=true;closeChildren();});
 /* Monitor desconectado (ou área útil encolhida) com o chat solto aberto: a
    filha volta para a primária com a folga do `constrainSidechatBounds`. O
    `setBounds` emite move/resize e o debounce acima grava o lugar novo. */
 const rescueChildren=()=>{
  let displays=[];try{displays=typeof host.screen?.getAllDisplays==='function'?host.screen.getAllDisplays()||[]:[];}catch{}
  let primary=null;try{primary=typeof host.screen?.getPrimaryDisplay==='function'?host.screen.getPrimaryDisplay():null;}catch{}
  if(!primary?.workArea)return;
  for(const child of children){
   if(child.isDestroyed?.())continue;
   let bounds=null;try{bounds=asBounds(typeof child.getBounds==='function'?child.getBounds():null);}catch{}
   if(!bounds||displays.some(display=>display?.workArea&&sidechatTitleVisible(bounds,display.workArea)))continue;
   try{child.setBounds(constrainSidechatBounds(bounds,primary.workArea));}catch{/* a filha pode ter fechado no meio */}
  }
 };
 if(typeof host.screen?.on==='function'){
  host.screen.on('display-removed',rescueChildren);
  host.screen.on('display-metrics-changed',rescueChildren);
 }
 if(host.ipcMain&&typeof host.ipcMain.handle==='function')host.ipcMain.handle('sidechat-always-on-top',(event,payload)=>{
  const sender=event?.sender;
  const fromMain=sender===win.webContents;
  const fromChild=[...children].some(child=>sender===child.webContents);
  if(!fromMain&&!fromChild)return;
  if(typeof payload?.on!=='boolean')throw Error(`Sempre por cima inválido: esperado booleano, recebido ${payload?.on===undefined?'ausente':typeof payload.on}`);
  for(const child of [...children])try{if(typeof child.setAlwaysOnTop==='function')child.setAlwaysOnTop(payload.on);}catch{}
  savePatch({sidechatAlwaysOnTop:payload.on});
  return payload.on;
 });
}

module.exports={SIDECHAT_WINDOW_NAME,sidechatChildWindowOptions,decideSidechatWindowOpen,resolveSidechatPlacement,guardSidechatChildWindow,registerSidechatWindowGuard};
