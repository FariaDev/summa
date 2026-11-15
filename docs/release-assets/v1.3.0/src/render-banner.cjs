/* Banner do README da 1.3.0 (#21), na arte aprovada da marca
   (`docs/design/marca/divulgacao.html`, prancheta D: marca + lema + app). As
   duas versões em português são as PNGs aprovadas em `marca/png/readme-*.png`
   e só são copiadas; as em inglês trocam o lema pela frase aprovada em inglês
   do mesmo HTML e são rasterizadas no Chromium do Electron, como a
   `v1.0.0/src/render.cjs` fazia. Rode a partir de `desk/`:
     node_modules/.bin/electron ../docs/release-assets/v1.3.0/src/render-banner.cjs
   Os arquivos ficam em `docs/release-assets/v1.3.0/`. */
const {app, BrowserWindow} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

const SRC = __dirname;
const ROOT = path.resolve(SRC, '..', '..', '..', '..');
const BRAND = path.join(ROOT, 'docs', 'design', 'marca');
const HTML = path.join(BRAND, 'divulgacao.html');
const PNG = path.join(BRAND, 'png');
const OUT = path.resolve(SRC, '..');
const WIDTH = 1280;
const HEIGHT = 640;

const source = fs.readFileSync(HTML, 'utf8');
const lineEn = /const LINE_EN='([^']*)';/.exec(source)?.[1];
if (!lineEn) throw new Error(`sem LINE_EN em ${HTML}; esperado const LINE_EN='...'`);

/* A prancheta D é a do topo do README (DECISOES.md, 2026-11-11). O lema é
   latino e vale nas duas línguas; no inglês entra a frase aprovada do mesmo
   arquivo, no lugar do lema. */
function englishScript() {
  return `(()=>{
   const motto=document.querySelector('.motto');
   if(!motto)throw new Error('prancheta D sem .motto; esperado ?board=D-claro ou D-escuro');
   motto.className='line';
   motto.textContent=${JSON.stringify(lineEn)};
  })()`;
}

async function settle(win) {
  const ok = await win.webContents.executeJavaScript(`(async()=>{
   await document.fonts.ready;
   await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));
   await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
   return document.fonts.check('500 20px "STIX Two Text"');
  })()`);
  if (!ok) throw new Error('STIX Two Text não carregou; confira docs/design/carbon-r2/fonts');
}

async function capture(win, file, scale) {
  const dbg = win.webContents.debugger;
  if (!dbg.isAttached()) dbg.attach('1.3');
  await dbg.sendCommand('Emulation.setDeviceMetricsOverride', {width: WIDTH, height: HEIGHT, deviceScaleFactor: scale, mobile: false});
  const shot = await dbg.sendCommand('Page.captureScreenshot', {format: 'png', clip: {x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1}});
  dbg.detach();
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log(JSON.stringify({file: path.basename(file), width: WIDTH * scale, height: HEIGHT * scale}));
}

async function renderEnglish(win, theme, scale) {
  await win.loadURL(`${pathToFileURL(HTML).href}?board=D-${theme}`);
  await win.webContents.executeJavaScript(englishScript());
  await settle(win);
  await capture(win, path.join(OUT, `banner-readme-en-${theme}.png`), scale);
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  for (const theme of ['claro', 'escuro']) {
    const approved = path.join(PNG, `readme-${theme}.png`);
    const target = path.join(OUT, `banner-readme-${theme}.png`);
    fs.copyFileSync(approved, target);
    console.log(JSON.stringify({file: path.basename(target), width: 2560, height: 1280, copied: path.relative(ROOT, approved)}));
  }
  const win = new BrowserWindow({show: false, width: WIDTH, height: HEIGHT, webPreferences: {sandbox: true, contextIsolation: true}});
  try {
    for (const theme of ['claro', 'escuro']) await renderEnglish(win, theme, 2);
  } finally {
    win.destroy();
  }
  app.exit(0);
}).catch((error) => { console.error(error); app.exit(1); });
