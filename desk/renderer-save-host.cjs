// @ts-check
'use strict';

/**
 * Espera o renderer confirmar a gravação antes de fechar, com teto para páginas travadas.
 * @param {{win: any, ipcMain: any, quitting: () => boolean, quit: () => void, timeout?: number}} deps
 * @example registerRendererSaveHost({win,ipcMain,quitting:()=>quitting,quit:()=>app.quit()});
 */
function registerRendererSaveHost({win,ipcMain,quitting,quit,timeout=1500}){
 let waiting=false,ready=false,timer;
 const finish=(expired=false)=>{
  if(!waiting)return;
  waiting=false;ready=true;clearTimeout(timer);
  ipcMain.removeListener('renderer-save-flushed',acknowledge);
  if(win.isDestroyed())return;
  if(expired)win.destroy();
  else if(quitting())quit();
  else win.close();
 };
 const acknowledge=event=>{
  if(event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame)finish();
 };
 win.on('close',event=>{
  if(ready)return;
  event.preventDefault();
  if(waiting)return;
  waiting=true;
  ipcMain.on('renderer-save-flushed',acknowledge);
  timer=setTimeout(()=>finish(true),timeout);
  if(win.webContents.isDestroyed()||win.webContents.isCrashed())finish(true);
  else win.webContents.send('renderer-save-flush');
 });
 win.on('closed',()=>{
  clearTimeout(timer);waiting=false;
  ipcMain.removeListener('renderer-save-flushed',acknowledge);
 });
}

module.exports={registerRendererSaveHost};
