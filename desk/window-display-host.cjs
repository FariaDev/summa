/* Relato: com o monitor externo desconectado, a janela principal abria fora da
   tela. No boot quem decide é o `placeWindow`; com o app aberto, quem avisa é o
   `screen` do Electron. Este host liga `display-removed` e
   `display-metrics-changed` e devolve a janela para a primária quando a barra
   de título sumiu de toda área útil. */
const {placeWindow,titleBarVisible}=require('./lib.cjs');

function displaysOf(screenLike){
 try{return typeof screenLike?.getAllDisplays==='function'?screenLike.getAllDisplays()||[]:[];}catch{return [];}
}

function primaryOf(screenLike){
 try{return typeof screenLike?.getPrimaryDisplay==='function'?screenLike.getPrimaryDisplay():null;}catch{return null;}
}

/** Verdade quando a barra de título aparece o bastante em alguma tela.
 * @param {{x: number, y: number, width: number, height: number}} bounds limites da janela
 * @param {Array<{workArea?: {x: number, y: number, width: number, height: number}}>} displays telas do Electron (ou fake)
 * @returns {boolean}
 * @example visibleOnDisplays({x: 0, y: 0, width: 900, height: 650}, [{workArea: {x: 0, y: 0, width: 1920, height: 1080}}]) // true
 */
function visibleOnDisplays(bounds,displays){
 return (displays||[]).some(display=>display?.workArea&&titleBarVisible(bounds,display.workArea));
}

/** Limites de resgate quando a janela perdeu todas as telas; `null` quando ela
 * ainda dá para agarrar. Usa o mesmo fallback do boot: primária, `wa.x+20`/
 * `wa.y+20` e tamanho adaptado.
 * @param {{bounds?: {x: number, y: number, width: number, height: number} | null, displays?: Array<object>, primary?: {id?: number, workArea?: {x: number, y: number, width: number, height: number}} | null}} input janela e telas de agora
 * @returns {{x: number, y: number, width: number, height: number} | null}
 * @example rescueBounds({bounds: {x: 9000, y: 9000, width: 900, height: 650}, displays, primary}) // {x: 20, y: 20, ...}
 */
function rescueBounds({bounds,displays,primary}){
 if(!bounds||!primary?.workArea||visibleOnDisplays(bounds,displays))return null;
 return placeWindow([primary],primary.id,bounds);
}

/** Liga a janela principal aos eventos de tela; devolve o `reconcile` para o
 * teste dirigir uma mudança sem depender do Electron.
 * @param {{screenLike?: object, window?: {isDestroyed?: () => boolean, getBounds?: () => {x: number, y: number, width: number, height: number}, setBounds?: (bounds: {x: number, y: number, width: number, height: number}) => void}, log?: (line: string) => void}} [host] telas, janela e log (todos injetáveis)
 * @returns {{reconcile: () => ({x: number, y: number, width: number, height: number} | null)}} confere a janela agora e a resgata se preciso
 * @example const guard=keepWindowOnDisplays({screenLike: screen, window: win}); guard.reconcile();
 */
function keepWindowOnDisplays({screenLike,window,log}={}){
 const reconcile=()=>{
  try{
   if(!window||window.isDestroyed?.())return null;
   const bounds=window.getBounds?.();
   if(!bounds)return null;
   const placed=rescueBounds({bounds,displays:displaysOf(screenLike),primary:primaryOf(screenLike)});
   if(!placed)return null;
   window.setBounds({x:placed.x,y:placed.y,width:placed.width,height:placed.height});
   if(typeof log==='function')log(`janela fora da tela; voltou para a primária (${placed.width}×${placed.height})`);
   return placed;
  }catch(error){
   if(typeof log==='function')log(`ao conferir a tela da janela: ${error?.message||error}`);
   return null;
  }
 };
 if(typeof screenLike?.on==='function'){
  screenLike.on('display-removed',reconcile);
  screenLike.on('display-metrics-changed',reconcile);
 }
 return {reconcile};
}

module.exports={keepWindowOnDisplays,rescueBounds,visibleOnDisplays};
