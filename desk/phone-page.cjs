// @ts-check
'use strict';

/* A página que o celular abre pelo QR code (#36). Uma página só, montada na
   memória a cada pedido: nada vem do disco a cada envio. Os textos são do
   catálogo (`phone.page.*`) no idioma da Mesa; a página não carrega nada de
   fora (a Content-Security-Policy do host só deixa o script com o nonce desta
   resposta, o envio para a própria origem e as fontes embutidas em `data:`).

   "Tirar foto" usa `capture="environment"`: abre a câmera e, no iPhone, o
   escaneamento de documento, sem HTTPS. Cada foto vai num pedido próprio para
   `<caminho>/photo`, uma de cada vez, e a página confirma "Enviado para a Summa".
   A fila (prazo por envio, uma tentativa a mais, `wake` quando a página volta
   da suspensão) mora em `phone-upload.cjs` e entra aqui pelo `toString()`.

   Identidade nova (mock P1 em `docs/design/marca/celular.html`): a integral a
   pincel e "Summa" em STIX no topo, sem sobretítulo, IBM Plex Sans no texto e
   os mesmos três estados em `main[data-state]`: start (o convite), sending (a
   barra e as enviadas) e offline (sem conexão, com "Tentar de novo"). O layout
   mora em `src/phone-page.css`; a marca não é o trio. */

const fs = require('node:fs');
const path = require('node:path');
const {createPhotoUploader, UPLOAD_LIMITS} = require('./phone-upload.cjs');

/* A fila vai inteira para o `<script>`: `toString()` da função, sem módulo (ver `phone-upload.cjs`). */
const UPLOADER = createPhotoUploader.toString();

/* A integral do mock aprovado, copiada de `#i-integral` (sem `style` inline: a CSP recusaria). */
const INTEGRAL_PATH = 'M 800.500 166.419 C 799.950 166.646, 795.232 168.019, 790.016 169.470 C 744.006 182.270, 703.646 214.434, 675.789 260.500 C 658.982 288.293, 644.491 321.376, 635.433 352.636 C 629.407 373.430, 625.123 389.837, 624.502 394.500 C 622.644 408.446, 620.640 417.915, 618.439 423.145 C 617.097 426.332, 615.993 430.866, 615.984 433.220 C 615.976 435.574, 615.065 441.775, 613.961 447 C 612.857 452.225, 610.610 464.375, 608.968 474 C 607.326 483.625, 605.086 495.527, 603.991 500.449 C 602.896 505.371, 601.995 511.446, 601.988 513.949 C 601.982 516.452, 601.090 522.100, 600.006 526.500 C 598.201 533.826, 596.857 542.368, 592.372 575 C 591.503 581.325, 590.160 589.055, 589.388 592.177 C 588.615 595.300, 587.744 600.475, 587.453 603.677 C 586.597 613.084, 584.963 625.685, 583.001 638 C 581.993 644.325, 580.419 657.375, 579.503 667 C 578.586 676.625, 577.263 687.512, 576.561 691.192 C 575.859 694.873, 575.199 701.418, 575.095 705.736 C 574.991 710.054, 574.719 715.367, 574.490 717.543 C 574.262 719.719, 573.407 727.800, 572.592 735.500 C 571.776 743.200, 570.605 757.150, 569.991 766.500 C 569.376 775.850, 568.203 788.216, 567.384 793.980 C 565.715 805.734, 562.929 833.352, 562.491 842.500 C 560.072 892.946, 536.484 966.120, 510.962 1002.344 C 500.851 1016.695, 485.487 1031.601, 473.973 1038.229 C 451.408 1051.220, 420.902 1049.709, 407.010 1034.912 C 397.581 1024.869, 396.778 1014.630, 404.025 996.880 C 411.081 979.602, 411.240 979.012, 410.705 972.130 C 410.086 964.144, 408.620 962.118, 398.156 954.778 C 385.715 946.051, 378.291 944.612, 362 947.772 C 353.362 949.447, 345.156 956.040, 337.398 967.538 C 329.878 978.683, 330.006 1004.267, 337.658 1019.754 C 351.301 1047.365, 377.906 1069.204, 405.254 1075.239 C 418.021 1078.056, 442.837 1078.201, 458 1075.546 C 508.291 1066.740, 554.660 1028.375, 596.444 961 C 599.684 955.775, 603.123 950.600, 604.085 949.500 C 606.378 946.880, 632.311 894.796, 634.429 888.558 C 635.788 884.554, 642.575 868.145, 646.034 860.500 C 647.252 857.807, 655.859 831.673, 661.020 815 C 663.318 807.575, 666.091 799.025, 667.182 796 C 668.855 791.361, 674.078 770.044, 679.554 745.500 C 680.291 742.200, 681.840 736.575, 682.998 733 C 684.155 729.425, 686.624 715.873, 688.484 702.884 C 690.344 689.896, 692.557 676.846, 693.401 673.884 C 694.246 670.923, 694.903 666.700, 694.863 664.500 C 694.762 659.057, 696.731 642.046, 698.451 633.500 C 699.226 629.650, 700.389 620.200, 701.036 612.500 C 702.258 597.945, 702.695 593.479, 705.342 568.500 C 707.366 549.392, 708.668 532.012, 710.495 499.691 C 711.298 485.497, 712.194 473.495, 712.487 473.021 C 712.780 472.547, 713.231 461.210, 713.490 447.829 C 714.967 371.274, 721.307 306.129, 729.882 279.392 C 748.666 220.824, 788.369 186.454, 826.781 195.511 C 847.859 200.480, 854.550 213.255, 849.129 238.177 C 844.843 257.882, 851.100 269.391, 870.102 276.754 C 879.686 280.467, 881.917 280.630, 892.127 278.363 C 913.624 273.589, 922.505 258.896, 917.509 236.371 C 914.826 224.275, 910.637 217.096, 896.404 200.207 C 884.567 186.162, 862.147 173.635, 840.500 168.972 C 832.265 167.198, 803.119 165.338, 800.500 166.419';

/* As três fontes do mock, subconjunto latino/português (caracteres dos dois
   catálogos + dígitos): `pyftsubset <fonte> --flavor=woff2 --text-file=<texto>`
   para a IBM Plex e `--text='Summa'` para a STIX, gravadas em
   `src/fonts/phone/`. A página é inline com CSP: sem esses arquivos locais, o
   celular pediria a fonte à rede, que o `default-src 'none'` recusa. */
const PHONE_FONTS = [
  {family: 'IBM Plex Sans', weight: 400, file: 'IBMPlexSans-Regular.woff2'},
  {family: 'IBM Plex Sans', weight: 600, file: 'IBMPlexSans-SemiBold.woff2'},
  {family: 'STIX Two Text', weight: 400, file: 'STIXTwoText.woff2'},
];
const PHONE_FONT_DIR = path.join(__dirname, 'src', 'fonts', 'phone');

/** Uma face `@font-face` com os bytes em base64 (lidos uma vez, no require). */
function fontFace({family, weight, file}) {
  const bytes = fs.readFileSync(path.join(PHONE_FONT_DIR, file));
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${bytes.toString('base64')}) format("woff2");font-display:swap}`;
}

const FONT_CSS = PHONE_FONTS.map(fontFace).join('');

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

/* Plural escolhido no celular, pela contagem da hora: vão as duas formas. */
const READY_KEY = 'phone.page.ready';

/* Frases que o script troca na hora: os nomes entre chaves ficam literais. */
function pageTexts(t, maxMb) {
  return {
    sending: t('phone.page.sending', {n: '{n}', total: '{total}'}),
    sent: t('phone.page.sent', {n: '{n}', total: '{total}'}),
    readyOne: t(`${READY_KEY}.one`, {count: '{count}'}),
    readyOther: t(`${READY_KEY}.other`, {count: '{count}'}),
    camera: t('phone.page.camera'),
    gallery: t('phone.page.gallery'),
    more: t('phone.page.more'),
    moreGallery: t('phone.page.moreGallery'),
    gone: t('phone.page.gone'),
    tooBig: t('phone.page.tooBig', {mb: maxMb}),
    wrongType: t('phone.page.wrongType'),
    full: t('phone.page.full'),
    network: t('phone.page.network'),
    sentAlt: t('phone.page.sentAlt', {n: '{n}'}),
  };
}

/* Ícones de traço (câmera, galeria, cadeado, ✓), sem estilo inline por causa da CSP. */
const ICON = {
  camera: '<svg class="icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  gallery: '<svg class="icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>',
  lock: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  done: '<svg class="icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
};

/* Script da página: põe as fotos na tela e liga os eventos. A fila (prazo,
   tentativa a mais, `busy` e o que falta para o "Tentar de novo") é
   `UPLOADER`, serializada aqui, e não guarda nada de DOM. */
const SCRIPT = `
const texts=JSON.parse(document.getElementById('texts').textContent);
const $=id=>document.getElementById(id);
const main=document.querySelector('main'),status=$('status'),ready=$('ready'),progress=$('progress'),fillBar=$('bar-fill'),log=$('log'),sent=$('sent'),doneMark=$('done-mark').content;
for(const el of document.querySelectorAll('[data-style]'))for(const rule of el.dataset.style.split(';')){const at=rule.indexOf(':');if(at>0)el.style.setProperty(rule.slice(0,at).trim(),rule.slice(at+1).trim());}
let sentCount=0;
const thumbs=new Map();
const fill=(s,v)=>s.replace(/\\{(\\w+)\\}/g,(m,k)=>k in v?v[k]:m);
const failure={404:texts.gone,413:texts.tooBig,415:texts.wrongType};
function setState(state){
 main.dataset.state=state;
 const more=state!=='start';
 $('camera-text').textContent=more?texts.more:texts.camera;
 $('gallery-text').textContent=more?texts.moreGallery:texts.gallery;
}
function showProgress(text,done,total,{bad=false,busy=false}={}){
 status.textContent=text;status.classList.toggle('bad',bad);progress.classList.toggle('busy',busy);
 ready.textContent=busy&&done?fill(done===1?texts.readyOne:texts.readyOther,{count:done}):'';
 fillBar.style.setProperty('--done',String(total?done/total:0));
}
function verdictText(verdict){return verdict.reason==='full'?texts.full:(failure[verdict.status]||texts.network);}
function addThumb(item){
 const thumb=document.createElement('figure');thumb.className='thumb pending';
 const img=document.createElement('img');img.alt='';img.src=URL.createObjectURL(item.file);
 const mark=document.createElement('span');mark.className='done';mark.append(doneMark.cloneNode(true));
 thumb.append(img,mark);sent.append(thumb);document.querySelector('.sent-title').hidden=false;
 thumbs.set(item,thumb);
}
function dropThumb(item){
 const thumb=thumbs.get(item);thumbs.delete(item);
 URL.revokeObjectURL(thumb.querySelector('img').src);thumb.remove();
 if(!sent.children.length)document.querySelector('.sent-title').hidden=true;
}
function markSent(item,done,total){
 const thumb=thumbs.get(item);thumb.classList.remove('pending');thumb.querySelector('img').alt=fill(texts.sentAlt,{n:sentCount+=1});
 const entry=document.createElement('li');entry.textContent=fill(texts.sent,{n:done,total});log.prepend(entry);
}
function showPhase(name,{done,total,verdict}){
 if(name==='offline'){progress.classList.remove('busy');setState('offline');return;}
 if(name==='refused'){showProgress(verdictText(verdict),done,total,{bad:true});return;}
 if(name==='sending'){setState('sending');showProgress(fill(texts.sending,{n:done+1,total}),done,total,{busy:true});return;}
 showProgress(fill(texts.sent,{n:done,total}),done,total);
}
const uploader=(${UPLOADER})({
 post:(file,signal,id)=>fetch(location.pathname.replace(/\\/$/,'')+'/photo',{method:'POST',body:file,headers:{'Content-Type':file.type||'application/octet-stream','X-Mesa-Photo-Id':id},signal}).then(async(reply)=>({ok:reply.ok,status:reply.status,reason:reply.ok?'':(await reply.json().catch(()=>({}))).reason})),
 newController:()=>new AbortController(),
 setTimer:(run,ms)=>setTimeout(run,ms),
 clearTimer:(id)=>clearTimeout(id),
 limits:${JSON.stringify(UPLOAD_LIMITS)},
 on:{added:addThumb,sent:markSent,dropped:dropThumb,phase:showPhase},
});
for(const input of document.querySelectorAll('input[type=file]'))input.addEventListener('change',()=>{const files=[...input.files];input.value='';uploader.enqueue(files);});
$('retry').addEventListener('click',()=>uploader.resume());
/* Voltar à página (desbloqueou, ou o navegador restaurou a aba): o envio que ficou no ar aborta e refaz; a fila parada retoma. */
document.addEventListener('visibilitychange',()=>{if(!document.hidden)uploader.wake();});
addEventListener('pageshow',()=>uploader.wake());
`;

/** O topo do P1: a integral a pincel e o nome em STIX, iguais nos três estados. */
function brandHtml() {
  return `<div class="brand"><svg class="mark" viewBox="320 150 610 940" aria-hidden="true"><path fill="currentColor" d="${INTEGRAL_PATH}"/></svg><span class="wordmark">Summa</span></div>`;
}

/** O cartão de "Sem conexão", com "Tentar de novo". */
function offlineHtml(t) {
  return `<section class="offline" role="alert">
<strong>${escapeHtml(t('phone.page.network'))}</strong>
<p>${escapeHtml(t('phone.page.networkHelp'))}</p>
<button id="retry" class="btn primary" type="button">${escapeHtml(t('phone.page.retry'))}</button>
</section>`;
}

/** Os dois botões de foto. */
function actionsHtml(t) {
  return `<div class="actions">
<label class="btn primary">${ICON.camera}<span id="camera-text">${escapeHtml(t('phone.page.camera'))}</span><input id="camera" type="file" accept="image/*" capture="environment"></label>
<label class="btn">${ICON.gallery}<span id="gallery-text">${escapeHtml(t('phone.page.gallery'))}</span><input id="gallery" type="file" accept="image/*" multiple></label>
</div>`;
}

/** A dica do início. */
function tipsHtml(t) {
  return `<section class="tips"><h2>${escapeHtml(t('phone.page.tipsTitle'))}</h2><ol>
<li>${escapeHtml(t('phone.page.tipFrame'))}</li><li>${escapeHtml(t('phone.page.tipLight'))}</li><li>${escapeHtml(t('phone.page.tipPage'))}</li>
</ol></section>`;
}

/**
 * HTML da página do celular.
 *
 * @param {{t: (key: string, args?: Record<string, string|number>) => string, lang: string, nonce: string, maxMb: number, lookCss?: string, castCss?: string}} options
 *   `lookCss` é o `:root` com o tema e o acento da Mesa (`phone-look.cjs`); `castCss` é o trio e o layout (`phoneCastCss`).
 * @returns {string}
 * @example phonePageHtml({t, lang: 'pt-BR', nonce: 'abc', maxMb: 15}).startsWith('<!doctype html>') // true
 */
function phonePageHtml({t, lang, nonce, maxMb, lookCss = '', castCss = ''}) {
  const texts = JSON.stringify(pageTexts(t, maxMb)).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(t('phone.page.title'))}</title>
<style nonce="${nonce}">${FONT_CSS}${lookCss}${castCss}</style>
</head>
<body>
<main class="phone-main" data-state="start">
${brandHtml()}
<h1>${escapeHtml(t('phone.page.title'))}</h1>
${offlineHtml(t)}
<p class="lead">${escapeHtml(t('phone.page.lead'))}</p>
<div id="progress"><div class="progress-line"><strong id="status" role="status" aria-live="polite"></strong><span id="ready"></span></div><div class="bar" aria-hidden="true"><i id="bar-fill"></i></div></div>
${actionsHtml(t)}
${tipsHtml(t)}
<h2 class="sent-title" hidden>${escapeHtml(t('phone.page.sentTitle'))}</h2>
<div id="sent" aria-label="${escapeHtml(t('phone.page.sentTitle'))}"></div>
<ul id="log"></ul>
<p class="privacy">${ICON.lock}<span>${escapeHtml(t('phone.page.privacy'))}</span></p>
</main>
<template id="done-mark">${ICON.done}</template>
<script id="texts" type="application/json">${texts}</script>
<script nonce="${nonce}">${SCRIPT}</script>
</body>
</html>`;
}

module.exports = {phonePageHtml};
