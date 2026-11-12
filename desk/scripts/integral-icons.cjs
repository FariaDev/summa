/* Gera os ícones da integral a pincel (#189).
   Rode com o Electron do projeto:
     node_modules/.bin/electron scripts/integral-icons.cjs
   Cada tamanho é rasterizado do SVG de scripts/integral-art.mjs; em 16 e 32 px
   o traço ganha corpo. Saídas:
     assets/app-icon/integral-<variante>-dock.png     Dock do macOS
     assets/app-icon/integral-<variante>-{256,128,64,32,16}.png
     assets/mesa-1024.png, mesa.icns, mesa.ico        pacote (dark-graphite) */
const {app,BrowserWindow,nativeImage}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {legacyIconChunks}=require('./icns-legacy.cjs');

const ASSETS=path.join(__dirname,'..','assets');
const ICO_SIZES=[16,24,32,48,64,128,256];
const ICNS=[['icp6',64],['ic07',128],['ic08',256],['ic09',512],['ic10',1024],['ic11',32],['ic12',64],['ic13',256],['ic14',512]];
const PACKAGE_VARIANT='dark-graphite';

/** Rasteriza um SVG em PNG de `size` px pelo canvas do Chromium. */
async function rasterize(win,svg,size){
  const url='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
  const dataUrl=await win.webContents.executeJavaScript(`new Promise((ok,fail)=>{const img=new Image();
    img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=${size};const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,0,0,${size},${size});ok(c.toDataURL('image/png'));};
    img.onerror=()=>fail(new Error('SVG não abriu'));img.src=${JSON.stringify(url)};})`);
  return Buffer.from(dataUrl.split(',')[1],'base64');
}

function icoFrom(pngs){
  const header=Buffer.alloc(6);header.writeUInt16LE(1,2);header.writeUInt16LE(pngs.length,4);
  let offset=6+16*pngs.length;
  const entries=pngs.map(({size,png})=>{
    const entry=Buffer.alloc(16);
    entry.writeUInt8(size>=256?0:size,0);entry.writeUInt8(size>=256?0:size,1);
    entry.writeUInt16LE(1,4);entry.writeUInt16LE(32,6);
    entry.writeUInt32LE(png.length,8);entry.writeUInt32LE(offset,12);
    offset+=png.length;return entry;
  });
  return Buffer.concat([header,...entries,...pngs.map(({png})=>png)]);
}

function icnsFrom(pngs){
  const header=Buffer.alloc(8);header.write('icns',0,'ascii');
  const chunks=pngs.map(({type,png})=>{
    const chunk=Buffer.alloc(8);chunk.write(type,0,'ascii');chunk.writeUInt32BE(png.length+8,4);
    return Buffer.concat([chunk,png]);
  });
  const body=Buffer.concat(chunks);header.writeUInt32BE(8+body.length,4);
  return Buffer.concat([header,body]);
}

async function writeVariantIcons(win,art,id){
  const dir=path.join(ASSETS,'app-icon');
  fs.writeFileSync(path.join(dir,`integral-${id}-dock.png`),await rasterize(win,art.integralSvg(id,512),512));
  for(const size of [256,128,64,32,16])fs.writeFileSync(path.join(dir,`integral-${id}-${size}.png`),await rasterize(win,art.integralSvg(id,size),size));
}

async function writeBundleIcons(win,art){
  const svg=size=>art.integralSvg(PACKAGE_VARIANT,size);
  fs.writeFileSync(path.join(ASSETS,'mesa-1024.png'),await rasterize(win,svg(1024),1024));
  const ico=[];
  for(const size of ICO_SIZES)ico.push({size,png:await rasterize(win,svg(size),size)});
  fs.writeFileSync(path.join(ASSETS,'mesa.ico'),icoFrom(ico));
  const icns=[
    ...legacyIconChunks(nativeImage.createFromBuffer(await rasterize(win,svg(16),16)).toBitmap(),16),
    ...legacyIconChunks(nativeImage.createFromBuffer(await rasterize(win,svg(32),32)).toBitmap(),32),
  ];
  for(const [type,size] of ICNS)icns.push({type,png:await rasterize(win,svg(size),size)});
  fs.writeFileSync(path.join(ASSETS,'mesa.icns'),icnsFrom(icns));
}

app.whenReady().then(async()=>{
  const art=await import(pathToFileURL(path.join(__dirname,'integral-art.mjs')).href);
  fs.mkdirSync(path.join(ASSETS,'app-icon'),{recursive:true});
  const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true}});
  await win.loadURL('about:blank');
  for(const id of Object.keys(art.INTEGRAL_VARIANTS))await writeVariantIcons(win,art,id);
  await writeBundleIcons(win,art);
  console.log('ícones da integral gerados em assets/');
  app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
