// @ts-check
'use strict';

const {cleanStudy}=require('./study.cjs');
const layoutPolicy=require('./layout-presets.cjs');
const {saveState}=require('./state-adapter.cjs');
const {asComposerHeight,sanitizeRotation,sanitizePdfRotations,sanitizeModelRecents,sanitizeModelFavorites,sanitizeModelDefault,savedComposerPins}=require('./desk-state-sanitize.cjs');

/* Estado de interface da Mesa no IPC (#194: o main.cjs estava no teto de 800
   linhas; saiu de lá sem mudar canal nem comportamento). `save-state` grava o
   layout/tema de cada conversa e os presets de layout vivem aqui ao lado: os
   dois são o mesmo assunto (o `desk.json`, fora do `config.json`), e quem vê o
   arquivo continua sendo o `persist()` do main. */

/**
 * Registra os canais do estado de interface sobre o `live` do main. Os PDFs e
 * o `.xopp` só entram no estado se a Mesa já autorizou o caminho.
 * @param {{ipcMain: {handle: Function}, live: import('./main.cjs').DeskLive,
 *   allowed: Set<string>, allowedXopp: Set<string>,
 *   assertNoFreeMutation: () => void, assertNoNav: () => void,
 *   persist: (force?: boolean) => void,
 *   win: () => ({isDestroyed?: () => boolean, setBackgroundColor?: (color: string) => void} | null),
 *   appIcon: () => ({apply: (window: any, accent: string, theme?: string) => void} | null)}} deps
 * @returns {{register: () => void, save: (value: any) => void}}
 * @example createDeskStateHost({ipcMain,live,allowed,allowedXopp,assertNoFreeMutation,assertNoNav,persist,win:()=>win,appIcon:()=>appIcon}).register();
 */
function createDeskStateHost({ipcMain,live,allowed,allowedXopp,assertNoFreeMutation,assertNoNav,persist,win,appIcon}){
 function save(value){
  const pdfs=(value.pdfs||[]).slice(0,2).filter(p=>!p?.path||allowed.has(p.path)).map(p=>({path:p.path,page:p.page,zoom:p.zoom,rotation:sanitizeRotation(p.rotation),scrollX:Number(p.scrollX)||0,scrollY:Number(p.scrollY)||0,invert:!!p.invert,minimized:!!p.minimized}));
  const pdfRotations=sanitizePdfRotations(value.pdfRotations);
  const study=cleanStudy(value.study);
  if(study.xopp&&!allowedXopp.has(study.xopp))study.xopp='';
  /* O adaptador monta os fatos e o núcleo decide (fallbacks por campo
     documentados em state-adapter.cjs). */
  const layout=saveState(live.state,value);
  const theme=layout.theme;
  live.state={...live.state,draft:layout.draft,study,pdfs,pdfRotations,referenceVisible:layout.referenceVisible,chatWidth:layout.chatWidth,calcHeight:layout.calcHeight,pdfSplit:layout.pdfSplit,theme,accent:layout.accent,readingSize:layout.readingSize,readingWidth:layout.readingWidth,codeSize:layout.codeSize,pdfDark:layout.pdfDark,viewLayout:layoutPolicy.normalizeViewLayout(value?.viewLayout)??live.state.viewLayout??null,composerHeight:asComposerHeight(value?.composerHeight)??live.state.composerHeight,modelRecents:value?.modelRecents===undefined?live.state.modelRecents:sanitizeModelRecents(value.modelRecents),modelFavorites:value?.modelFavorites===undefined?live.state.modelFavorites:sanitizeModelFavorites(value.modelFavorites),modelDefault:value?.modelDefault===undefined?live.state.modelDefault:sanitizeModelDefault(value.modelDefault),composerPins:savedComposerPins(live.state.composerPins,value?.composerPins),releaseNotesSeen:typeof value?.releaseNotesSeen==='string'?value.releaseNotesSeen.slice(0,24):live.state.releaseNotesSeen};
  const window=win();
  if(window&&!window.isDestroyed?.())window.setBackgroundColor?.(theme==='dark'?'#191919':'#f7f7f7');
  appIcon()?.apply(window,live.state.accent,live.state.theme);
  persist();
 }
 function register(){
  ipcMain.handle('save-state',(_e,value)=>save(value));
  ipcMain.handle('layout-presets-get',()=>layoutPolicy.read(live.state));
  ipcMain.handle('layout-presets-save',(_e,payload)=>{
   assertNoFreeMutation();assertNoNav();
   const result=layoutPolicy.modify(live.state.layoutPresets,payload);
   if(!result.ok)throw Error(result.error);
   live.state={...live.state,layoutPresets:result.store};persist();return result.store;
  });
 }
 return {register,save};
}

module.exports={createDeskStateHost};
