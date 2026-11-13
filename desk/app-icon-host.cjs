/* Ícone do app com a Mesa aberta (#61, #189). O Dock do macOS e a janela/barra
   de tarefas do Windows mostram a integral a pincel na combinação de tema e
   acento; o ícone do pacote (Finder, Launchpad, Iniciar, instalador) é o
   dark-graphite fixo e não muda. As PNGs saem de scripts/integral-icons.cjs.
   Arquivo ausente cai no ícone do pacote. */
const fs=require('node:fs');
const path=require('node:path');

/** Escolhe a variante pela combinação de tema e acento.
 * O tema 'auto' (o "sistema") segue o tema do sistema; qualquer acento que não
 * seja 'violet' usa a tinta grafite.
 * @param {string} theme 'light' | 'dark' | 'auto'
 * @param {string} accent id do acento ('graphite', 'violet')
 * @param {() => boolean} [systemDark] sistema em tema escuro
 * @returns {'light-graphite'|'dark-graphite'|'light-violet'|'dark-violet'}
 * @example iconVariant('auto','violet',()=>true) // 'dark-violet' */
function iconVariant(theme,accent,systemDark=()=>false){
  const dark=theme==='dark'||((theme==='auto'||theme==='system')&&systemDark());
  return `${dark?'dark':'light'}-${accent==='violet'?'violet':'graphite'}`;
}

/** Caminhos do ícone de um tema e acento; arquivo ausente cai no pacote.
 * @param {string} assetsDir pasta assets/ do app
 * @param {{theme: string, accent: string}} look tema e acento correntes
 * @param {{exists?: (file: string) => boolean, systemDark?: () => boolean}} [io]
 * @returns {{dock: string, window: string}}
 * @example appIconPaths(path.join(__dirname,'assets'),{theme:'dark',accent:'violet'}) */
function appIconPaths(assetsDir,{theme,accent},{exists=fs.existsSync,systemDark=()=>false}={}){
  const id=iconVariant(theme,accent,systemDark);
  const dock=path.join(assetsDir,'app-icon',`integral-${id}-dock.png`);
  const window=path.join(assetsDir,'app-icon',`integral-${id}-256.png`);
  if(exists(dock)&&exists(window))return {dock,window};
  return {dock:path.join(assetsDir,'mesa-1024.png'),window:path.join(assetsDir,'mesa.ico')};
}

/** Aplica a integral no Dock (macOS) ou na janela (Windows), só quando muda.
 * @param {{app: {dock?: {setIcon: (file: string) => void}}, platform: string, assetsDir: string, dockEnabled?: boolean, exists?: (file: string) => boolean, systemDark?: () => boolean}} deps
 * `dockEnabled` é falso no modo de teste, em que o Dock fica escondido.
 * `systemDark` responde pelo tema do sistema quando o tema é 'auto'.
 * @returns {{apply: (win: {setIcon?: (file: string) => void, isDestroyed?: () => boolean} | null, accent: string, theme: string) => void}}
 * @example const appIcon=createAppIcon({app,platform:process.platform,assetsDir}); appIcon.apply(win,state.accent,state.theme) */
function createAppIcon({app,platform,assetsDir,dockEnabled=true,exists,systemDark}){
  let applied='';
  return {
    apply(win,accent,theme){
      const files=appIconPaths(assetsDir,{theme,accent},{exists,systemDark});
      if(files.dock===applied)return;
      if(platform==='darwin'){
        if(!dockEnabled)return;
        app.dock?.setIcon(files.dock);applied=files.dock;return;
      }
      if(platform!=='win32'||!win||win.isDestroyed?.())return;
      win.setIcon?.(files.window);applied=files.dock;
    },
  };
}

module.exports={appIconPaths,createAppIcon,iconVariant};
