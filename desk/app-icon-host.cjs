// @ts-check
/* Ícone do app com a Mesa aberta (#61, #189). O Dock do macOS e a janela/barra
   de tarefas do Windows mostram a integral a pincel na combinação de tema e
   acento; o ícone do pacote (Finder, Launchpad, Iniciar, instalador) é o
   dark-graphite fixo e não muda. As PNGs saem de scripts/integral-icons.cjs.
   Arquivo ausente cai no ícone do pacote.
   #3: o macOS só tinge o ícone do pacote; no modo tingido ou transparente do
   sistema (AppleIconAppearanceTheme começando com Tinted ou Clear) o Dock fica
   sem setIcon qualquer que seja o tema ou o acento, e uma NativeImage vazia
   devolve o pacote ao voltar. */
const fs=require('node:fs');
const path=require('node:path');

const PACKAGE_VARIANT='dark-graphite';
const PACKAGE_APPLIED='package';

/** Evita decodificar o PNG do pacote em tamanho cheio ao criar a janela no Linux.
 * @param {string} assetsDir pasta assets/ do app
 * @param {NodeJS.Platform} platform plataforma do Electron
 * @param {(file: string) => boolean} [exists] presença da variante pequena
 * @returns {string} caminho do ícone inicial da janela
 * @example startupWindowIcon('/mesa/assets','win32') // '/mesa/assets/mesa.ico' */
function startupWindowIcon(assetsDir,platform,exists=fs.existsSync){
  if(platform==='win32')return path.join(assetsDir,'mesa.ico');
  if(platform==='linux'){
    const compact=path.join(assetsDir,'app-icon',`integral-${PACKAGE_VARIANT}-256.png`);
    if(exists(compact))return compact;
  }
  return path.join(assetsDir,'mesa-1024.png');
}

/** NativeImage vazia que restaura o ícone do pacote no Dock (#3).
 * O Electron entrega a imagem vazia ao AppKit como nil, e o bundle volta a
 * valer (ui/gfx/image/image.h#AsNSImage, "nil if this image is empty").
 * @returns {import('electron').NativeImage}
 * @example app.dock.setIcon(emptyDockIcon()) */
function emptyDockIcon(){return require('electron').nativeImage.createEmpty();}

/** Tema de ícones do macOS, em que o sistema manda no ícone do pacote (#3).
 * O default fala com o Electron só no darwin e devolve '' quando a leitura
 * falha ou o valor não existe.
 * @returns {string} 'TintedLight', 'ClearDark', 'Regular' ou ''
 * @example systemIconTheme() // 'TintedLight' */
function systemIconTheme(){
  if(process.platform!=='darwin')return '';
  try{return require('electron').systemPreferences.getUserDefault('AppleIconAppearanceTheme','string')||'';}
  catch{return '';}
}

/** O sistema pede o ícone do pacote no modo tingido ou transparente (#3).
 * @param {() => string} iconTheme tema de ícones do sistema
 * @returns {boolean}
 * @example tintedIconMode(()=>'ClearDark') // true */
function tintedIconMode(iconTheme){
  const mode=String(iconTheme()??'');
  return mode.startsWith('Tinted')||mode.startsWith('Clear');
}

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
 * @param {{app: {dock?: {setIcon: (icon: import('electron').NativeImage | string) => void}}, platform: string, assetsDir: string, dockEnabled?: boolean, exists?: (file: string) => boolean, systemDark?: () => boolean, emptyIcon?: () => import('electron').NativeImage, iconTheme?: () => string}} deps
 * `dockEnabled` é falso no modo de teste, em que o Dock fica escondido.
 * `systemDark` responde pelo tema do sistema quando o tema é 'auto'.
 * `emptyIcon` devolve a NativeImage vazia que restaura o ícone do pacote (#3).
 * `iconTheme` diz o tema de ícones do macOS (#3): no modo tingido ou
 * transparente ('Tinted*' ou 'Clear*') o Dock fica com o ícone do pacote.
 * @returns {{apply: (win: {setIcon?: (file: string) => void, isDestroyed?: () => boolean} | null, accent: string, theme: string) => void}}
 * @example const appIcon=createAppIcon({app,platform:process.platform,assetsDir,iconTheme:systemIconTheme}); appIcon.apply(win,state.accent,state.theme) */
function createAppIcon({app,platform,assetsDir,dockEnabled=true,exists,systemDark,emptyIcon=emptyDockIcon,iconTheme=systemIconTheme}){
  let applied='';
  return {
    apply(win,accent,theme){
      /* #3: o macOS tinge só o ícone do pacote. No modo tingido ou transparente
         o Dock fica com o pacote qualquer que seja o tema ou o acento; na
         variante do pacote, idem; vindo de outra variante, a imagem vazia o
         restaura. */
      if(platform==='darwin'&&(tintedIconMode(iconTheme)||iconVariant(theme,accent,systemDark)===PACKAGE_VARIANT)){
        if(!dockEnabled||applied===PACKAGE_APPLIED)return;
        if(applied)app.dock?.setIcon(emptyIcon());
        applied=PACKAGE_APPLIED;return;
      }
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

module.exports={appIconPaths,createAppIcon,iconVariant,startupWindowIcon,systemIconTheme};
