// @ts-check

/**
 * Compartilha a gravação pendente entre o debounce e o fechamento da janela.
 * @param {{state: {saveTimer: any}, desk: {save: Function, onSaveFlush: Function}, snapshot: Function, onError: (error: any) => void}} deps
 * @example const layoutSaver=createLayoutSaver({state:S,desk:window.desk,snapshot:layoutSnapshot,onError:console.error}); layoutSaver.save();
 */
export function createLayoutSaver({state,desk,snapshot,onError}){
 let inFlight=Promise.resolve();
 function write(){
  clearTimeout(state.saveTimer);state.saveTimer=0;
  inFlight=desk.save(snapshot());
  return inFlight;
 }
 function save(immediate=false){
  clearTimeout(state.saveTimer);
  if(immediate){write().catch(onError);return;}
  state.saveTimer=setTimeout(()=>write().catch(onError),400);
 }
 desk.onSaveFlush(()=>(state.saveTimer?write():inFlight).catch(onError));
 return {save,write};
}
