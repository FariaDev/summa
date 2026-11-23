// @ts-check
'use strict';
/* Barra de título da janela principal no Windows e no Linux: a moldura do
   sistema some e os botões de minimizar, maximizar e fechar ficam sobre a faixa
   das abas (`titleBarOverlay`). Antes eram quatro faixas no topo (título, menu,
   abas, leitor) contra duas no macOS; a #202 escondeu o menu e esta tira o
   título. O menu inteiro abre pelo botão ≡ da própria faixa. `SUMMA_SYSTEM_TITLEBAR=1`
   volta à moldura do sistema, para gerenciador de janelas que desenha a sua. */

/** Altura da faixa de abas (`--header` em style.css) e cor do tema claro, até o renderer mandar a do tema em uso. */
const TITLE_BAR_DEFAULTS=Object.freeze({height:44,color:'#f7f7f7',symbolColor:'#1f1f1f'});
const HEX_COLOR=/^#[0-9a-f]{6}$/i;

/**
 * Diz se a janela principal usa a barra de título própria.
 * @param {string} platform `process.platform`
 * @param {Record<string, string|undefined>} env `process.env`
 * @returns {boolean}
 * @example usesOverlayTitleBar('win32', {}); // true
 */
function usesOverlayTitleBar(platform,env){
 if(platform==='darwin')return false;
 return env.SUMMA_SYSTEM_TITLEBAR!=='1';
}

/**
 * Opções de `BrowserWindow` para a barra de título da janela principal.
 * @param {string} platform `process.platform`
 * @param {Record<string, string|undefined>} env `process.env`
 * @returns {{titleBarStyle?: 'hidden', titleBarOverlay?: {height: number, color: string, symbolColor: string}}}
 * @example titleBarOptions('linux', {}); // {titleBarStyle:'hidden', titleBarOverlay:{height:44, ...}}
 */
function titleBarOptions(platform,env){
 if(!usesOverlayTitleBar(platform,env))return {};
 return {titleBarStyle:'hidden',titleBarOverlay:{...TITLE_BAR_DEFAULTS}};
}

/**
 * Confere as cores e a altura que o renderer manda para os botões da janela.
 * @param {unknown} raw `{color, symbolColor, height}`
 * @returns {{color: string, symbolColor: string, height: number}}
 * @example titleBarOverlayFrom({color:'#191919', symbolColor:'#eeeeee', height:44});
 */
function titleBarOverlayFrom(raw){
 const value=/** @type {{color?: unknown, symbolColor?: unknown, height?: unknown}} */ (raw&&typeof raw==='object'?raw:{});
 const {color,symbolColor,height}=value;
 if(typeof color!=='string'||!HEX_COLOR.test(color))throw Error(`Barra de título: cor inválida (recebido ${JSON.stringify(color)}; esperado #rrggbb)`);
 if(typeof symbolColor!=='string'||!HEX_COLOR.test(symbolColor))throw Error(`Barra de título: cor dos botões inválida (recebido ${JSON.stringify(symbolColor)}; esperado #rrggbb)`);
 if(!Number.isInteger(height)||Number(height)<24||Number(height)>80)throw Error(`Barra de título: altura inválida (recebido ${JSON.stringify(height)}; esperado inteiro de 24 a 80)`);
 return {color,symbolColor,height:Number(height)};
}

/**
 * Liga o IPC da barra de título: cores e altura dos botões da janela e o menu do ≡.
 * @param {{ipcMain: {handle: Function}, getWin: () => any, Menu: {getApplicationMenu: () => any}, enabled: boolean}} deps
 * @returns {void}
 * @example registerTitleBar({ipcMain, getWin:()=>win, Menu, enabled:true});
 */
function registerTitleBar({ipcMain,getWin,Menu,enabled}){
 ipcMain.handle('title-bar-overlay',(_e,raw)=>{
  const win=getWin();
  if(!enabled||!win||win.isDestroyed())return {ok:false};
  win.setTitleBarOverlay(titleBarOverlayFrom(raw));
  return {ok:true};
 });
 ipcMain.handle('title-bar-menu',(_e,raw)=>{
  const win=getWin();
  const menu=Menu.getApplicationMenu();
  if(!win||win.isDestroyed()||!menu)return {ok:false};
  const at=/** @type {{x?: unknown, y?: unknown}} */ (raw&&typeof raw==='object'?raw:{});
  menu.popup({window:win,x:Math.max(0,Math.round(Number(at.x)||0)),y:Math.max(0,Math.round(Number(at.y)||0))});
  return {ok:true};
 });
}

module.exports={TITLE_BAR_DEFAULTS,usesOverlayTitleBar,titleBarOptions,titleBarOverlayFrom,registerTitleBar};
