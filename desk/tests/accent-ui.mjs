import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {reviewShot,withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdf,statusOnline,screenshotDirectory,setTheme,freezeMotion,resizeWindow} from './helpers.mjs';
import {layoutStable,nextFrames,pollUntil} from './waits.mjs';

/* Cor de acento (ticket #9 da spec de redesenho): mede na janela real, nos dois
   temas e para cada um dos dois acentos, o que o usuário vê — a ação principal,
   o link e o alternador ligado —, que trocar em Configurações vale na hora (sem
   Salvar, e mesmo cancelando), que a escolha volta na abertura seguinte e que
   um link dentro de folha branca segue legível. As imagens claro/escuro em
   1440×900 e 900×650 saem numa pasta `acento-…` de desk/tests/artifacts para
   olho humano; não são asserção. */

const SHOT_DIR=screenshotDirectory('acento');
const SIZES=[[1440,900],[900,650]];
const ACCENTS=['graphite','violet'];
const LABELS={graphite:'Grafite',violet:'Violeta'};
/* Tabela de acento da spec (#4): preenchimento e texto por tema. No claro o
   texto é o próprio preenchimento. */
const FILL={
 light:{graphite:'#303030',violet:'#8044ca'},
 dark:{graphite:'#e6e6e6',violet:'#8957d0'}
};
const TEXT={
 light:FILL.light,
 dark:{graphite:'#e6e6e6',violet:'#b89cea'}
};

const hex=text=>[1,3,5].map(i=>parseInt(text.slice(i,i+2),16));
function rgb(text){
 const m=/^rgba?\(([^)]+)\)$/.exec(String(text).trim());
 assert.ok(m,`cor legível (${text})`);
 return m[1].split(/[,\s/]+/).filter(Boolean).map(Number).slice(0,3);
}
function sameColor(actual,expectedHex,label){
 const got=rgb(actual),want=hex(expectedHex);
 assert.ok(got.every((v,i)=>Math.abs(v-want[i])<=1),`${label}: esperado ${expectedHex}, veio ${actual}`);
}
const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};return .2126*f(r)+.7152*f(g)+.0722*f(b);};
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};

const style=(page,selector,prop)=>page.locator(selector).first().evaluate((el,p)=>getComputedStyle(el)[p],prop);
async function setSize(app,page,[width,height]){
 await resizeWindow(app,page,width,height);
 await layoutStable(page,'main');
}
const shot=(page,name)=>reviewShot(page,SHOT_DIR,name);
const accentOf=page=>page.evaluate(()=>document.documentElement.dataset.accent||'graphite');
async function openAppearance(page){
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await page.locator('#settings-tab-avisos').click();
 await page.locator('#accent-mode').scrollIntoViewIfNeeded();
}
async function pick(page,accent){
 await page.locator(`#accent-mode [data-accent="${accent}"]`).click();
 await page.waitForFunction(a=>(document.documentElement.dataset.accent||'graphite')===a,accent,{timeout:5000});
}
/* Um link no balão do tutor e outro numa folha branca, montados com as classes
   reais: o que se mede é a regra do stylesheet, não um texto de exemplo. */
async function fixtures(page){
 /* As Estatísticas montam o diálogo (e o stylesheet das barras) na 1ª abertura:
    abre pela busca de comandos, como o usuário, e fecha. */
 await page.keyboard.press('ControlOrMeta+k');
 const input=page.locator('#command-palette .palette-input');
 await input.waitFor({timeout:5000});
 await input.fill('Estatísticas');
 await page.waitForFunction(()=>[...document.querySelectorAll('#command-palette .palette-item .label')].some(el=>el.textContent.includes('Estatísticas')));
 await nextFrames(page);
 await page.keyboard.press('Enter');
 await page.waitForSelector('.study-stats-dialog[open]',{timeout:5000});
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('.study-stats-dialog')?.open,undefined,{timeout:5000});
 await page.evaluate(()=>{
  const tutor=document.createElement('div');
  tutor.className='message assistant';tutor.id='accent-fixture-tutor';
  tutor.innerHTML='<div class="body"><a href="#" id="accent-fixture-link">trecho do material</a></div>';
  document.querySelector('#sidebar').append(tutor);
  const sheet=document.createElement('div');
  sheet.className='pdf-page';sheet.id='accent-fixture-sheet';
  sheet.style.cssText='position:fixed;left:0;top:0;width:200px;height:60px;z-index:-1;pointer-events:none';
  sheet.innerHTML='<div class="pdf-doc"><a href="#" id="accent-fixture-paper-link">link na folha</a></div>';
  document.body.append(sheet);
  /* Sobras do acento (#23): as quatro peças reais, com as classes do
     stylesheet — aviso de atualização, dica de soltar PDF, barra das
     Estatísticas e tecla pressionada do editor de atalhos. */
  const notice=document.querySelector('#update-notice');
  notice.hidden=false;notice.textContent='Atualização disponível';
  const hint=document.createElement('div');
  hint.className='pdf-drop-hint';hint.id='accent-fixture-drop';hint.textContent='Solte para abrir';
  hint.style.cssText='visibility:hidden';
  document.querySelector('.pdf-panel').append(hint);
  const bar=document.createElement('div');
  bar.className='study-stats-bar';bar.id='accent-fixture-bar';
  bar.style.cssText='position:fixed;left:0;top:0;width:8px;height:8px;z-index:-1;pointer-events:none';
  /* A regra da barra vive em `.study-stats-col .study-stats-bar` (tela nova). */
  const col=document.createElement('div');
  col.className='study-stats-col';
  col.append(bar);
  document.body.append(col);
  const keys=document.createElement('div');
  keys.id='keys-dialog';
  keys.innerHTML='<button class="keys-rec" id="accent-fixture-key" aria-pressed="true">Gravando…</button>';
  keys.style.cssText='display:none';
  document.body.append(keys);
 });
}
async function readRuntimeAccent(runtime){
 const file=path.join(runtime,'desk.json');
 const readAccent=()=>{try{return JSON.parse(fs.readFileSync(file,'utf8')).accent||null;}catch{return null;}};
 return pollUntil(readAccent,accent=>!!accent,{timeout:3000,interval:100,what:'o acento em desk.json',onTimeout:'return'});
}
await withArtifacts('cor-de-acento',async ctx=>{
 const runtime=ctx.runtime=newRuntime('cor-de-acento'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdf('Exercise',6));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Teste',path:course}],desk:{pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 let page=await ctx.app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await freezeMotion(page);
 await fixtures(page);

 /* Quem nunca escolheu vê grafite. */
 await setTheme(page,'light');
 assert.equal(await accentOf(page),'graphite','padrão: grafite');

 await openAppearance(page);
 const options=await page.locator('#accent-mode [data-accent]').evaluateAll(list=>list.map(el=>el.dataset.accent));
 assert.deepEqual(options,ACCENTS,'duas opções, grafite primeiro');
 assert.equal(await page.locator('#accent-mode [data-accent="graphite"]').getAttribute('aria-checked'),'true','grafite marcado de início');
 for(const accent of ACCENTS)assert.equal((await page.locator(`#accent-mode [data-accent="${accent}"]`).innerText()).trim(),LABELS[accent],`rótulo de ${accent}`);
 /* r2 (2026-11-11): dois círculos de 24px com o nome embaixo em 12px, sem a
    caixa com borda em volta da opção. */
 const sizes=await page.evaluate(()=>{
  const options=[...document.querySelectorAll('#accent-mode .accent-option')];
  const option=options[0],dot=option.querySelector('.accent-dot'),name=option.querySelector('span:last-child');
  const box=dot.getBoundingClientRect(),nameBox=name.getBoundingClientRect();
  const style=getComputedStyle(dot),optionStyle=getComputedStyle(option);
  return {count:options.length,width:box.width,height:box.height,radius:style.borderRadius,
   labelSize:getComputedStyle(name).fontSize,dotBottom:box.bottom,nameTop:nameBox.top,
   border:optionStyle.borderTopWidth,background:optionStyle.backgroundColor};
 });
 assert.equal(sizes.count,2,'dois círculos de acento');
 assert.deepEqual([Math.round(sizes.width),Math.round(sizes.height)],[24,24],`círculo de 24×24 (${sizes.width}×${sizes.height})`);
 assert.equal(sizes.radius,'50%','o círculo usa --r-round');
 assert.equal(sizes.labelSize,'12px','o nome embaixo usa 12px');
 assert.ok(sizes.dotBottom<=sizes.nameTop+0.5,`o nome fica embaixo do círculo (${sizes.dotBottom} ≤ ${sizes.nameTop})`);
 assert.equal(sizes.border,'0px','a opção não tem caixa com borda');
 assert.equal(sizes.background,'rgba(0, 0, 0, 0)','a opção não tem fundo de caixa');

 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  for(const accent of ACCENTS){
   const label=`${theme} ${accent}`;
   await pick(page,accent);
   assert.equal(await page.locator(`#accent-mode [data-accent="${accent}"]`).getAttribute('aria-checked'),'true',`${label}: opção marcada`);
   assert.equal(await page.locator('#accent-mode [aria-checked="true"]').count(),1,`${label}: uma opção só marcada`);
   /* O escolhido ganha o anel de 2px no acento, afastado 2px do círculo. */
   const ring=await page.locator(`#accent-mode [data-accent="${accent}"] .accent-dot`).evaluate(el=>{
    const style=getComputedStyle(el);
    return {width:style.outlineWidth,offset:style.outlineOffset,color:style.outlineColor,style:style.outlineStyle};
   });
   assert.equal(ring.width,'2px',`${label}: anel de 2px`);
   assert.equal(ring.offset,'2px',`${label}: anel afastado 2px`);
   assert.equal(ring.style,'solid',`${label}: anel sólido`);
   sameColor(ring.color,FILL[theme][accent],`${label}: anel no acento`);
   /* O realce da busca deriva do acento: o texto --fg precisa continuar AA
      sobre ele nos dois acentos e nos dois temas (r2, 2026-11-11). */
   const hit=await page.evaluate(()=>{
    const probe=document.createElement('i');probe.style.cssText='position:fixed;background:var(--highlight);color:var(--fg)';
    document.body.append(probe);
    const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;
    const ctx=canvas.getContext('2d');
    const resolve=value=>{ctx.fillStyle=value;ctx.fillRect(0,0,1,1);const [r,g,b]=ctx.getImageData(0,0,1,1).data;return `rgb(${r}, ${g}, ${b})`;};
    const bg=resolve(getComputedStyle(probe).backgroundColor),fg=resolve(getComputedStyle(probe).color);
    probe.remove();
    return {bg,fg};
   });
   assert.ok(contrast(rgb(hit.fg),rgb(hit.bg))>=4.5,`${label}: texto sobre --highlight legível (${contrast(rgb(hit.fg),rgb(hit.bg)).toFixed(2)}:1)`);

   /* Ação principal: o botão Salvar do diálogo. */
   sameColor(await style(page,'#settings-save','backgroundColor'),FILL[theme][accent],`${label}: preenchimento da ação principal`);
   const onPrimary=rgb(await style(page,'#settings-save','color')),fill=rgb(await style(page,'#settings-save','backgroundColor'));
   assert.ok(contrast(onPrimary,fill)>=4.5,`${label}: texto da ação principal legível (${contrast(onPrimary,fill).toFixed(2)})`);
   if(theme==='dark'&&accent==='graphite'){
    assert.ok(lum(onPrimary)<lum(fill),`${label}: grafite no escuro usa texto escuro sobre preenchimento claro`);
    assert.ok(lum(fill)>.7,`${label}: preenchimento claro`);
   }

   /* Link no balão do tutor: tom de texto do tema, legível sobre a coluna. */
   sameColor(await style(page,'#accent-fixture-link','color'),TEXT[theme][accent],`${label}: link`);
   const column=rgb(await style(page,'#sidebar','backgroundColor'));
   assert.ok(contrast(rgb(await style(page,'#accent-fixture-link','color')),column)>=4.5,`${label}: link legível na coluna do tutor`);

   /* Alternador ligado: Referências incluídas. */
   assert.equal(await page.locator('#include-refs').getAttribute('aria-pressed'),'true');
   sameColor(await style(page,'#include-refs','color'),TEXT[theme][accent],`${label}: alternador ligado`);

   /* Sobras do acento: seguem a cor escolhida. Linhas e barras leem sobre a
      superfície com o tom de texto do acento; a tecla pressionada é preenchimento. */
   const surface=rgb(await style(page,'#settings-dialog','backgroundColor'));
   const lines=[['#update-notice','borderTopColor','borda do aviso de atualização'],
    ['#accent-fixture-drop','borderTopColor','dica de soltar PDF no leitor'],
    ['#accent-fixture-bar','backgroundColor','barra das Estatísticas']];
   for(const [selector,prop,what] of lines){
    const value=await style(page,selector,prop);
    /* A sobreposição do arraste segue o tema desde a #100: texto e borda no
       --accent-text, fundo opaco de --surface com um toque do acento. O
       contraste real sobre esse fundo é medido em reader-empty-ui.mjs. */
    sameColor(value,TEXT[theme][accent],`${label}: ${what}`);
    assert.ok(contrast(rgb(value),surface)>=3,`${label}: ${what} legível sobre a superfície (${contrast(rgb(value),surface).toFixed(2)})`);
   }
   sameColor(await style(page,'#accent-fixture-key','backgroundColor'),FILL[theme][accent],`${label}: tecla pressionada no editor de atalhos`);
   {
    const key=rgb(await style(page,'#accent-fixture-key','color')),keyBg=rgb(await style(page,'#accent-fixture-key','backgroundColor'));
    assert.ok(contrast(key,keyBg)>=4.5,`${label}: texto da tecla pressionada legível`);
   }

   /* Folha branca: o link continua legível com qualquer acento, nos dois temas. */
   const paper=rgb(await style(page,'#accent-fixture-sheet','backgroundColor'));
   assert.deepEqual(paper,[255,255,255],`${label}: folha branca`);
   const paperLink=rgb(await style(page,'#accent-fixture-paper-link','color'));
   assert.ok(contrast(paperLink,paper)>=4.5,`${label}: link na folha branca legível (${contrast(paperLink,paper).toFixed(2)})`);
   /* O tom é o do acento no claro, mesmo com a interface no escuro: a folha
      não muda de papel. (Sem isso o teste passaria com o azul do navegador.) */
   sameColor(await style(page,'#accent-fixture-paper-link','color'),FILL.light[accent],`${label}: link na folha usa o tom do acento legível sobre branco`);
  }
 }

 /* #101: as escolhas de mascote e ícone saíram; a marca segue só o acento. */
 await setTheme(page,'light');
 await pick(page,'graphite');
 assert.equal(await page.locator('#mascot-mode').count(),0,'sem seletor de mascote');
 assert.equal(await page.locator('#app-icon-mode').count(),0,'sem seletor de ícone');
 for(const accent of ACCENTS){
  await pick(page,accent);
  const tint=accent==='violet'?'violet':'graphite';
  assert.equal(await page.locator('.brand-icon').first().getAttribute('src'),`assets/app-icon/integral-light-${tint}-128.png`,`a marca segue ${accent}`);
 }
 /* #189: a marca também troca quando o tema muda, sem passar pelo acento. */
 await pick(page,'violet');
 await setTheme(page,'dark');
 assert.equal(await page.locator('.brand-icon').first().getAttribute('src'),'assets/app-icon/integral-dark-violet-128.png','a marca segue o tema escuro');
 await setTheme(page,'light');
 const saved=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
 assert.equal('mascot' in saved,false,'o desk.json não grava mais mascote');
 assert.equal('appIcon' in saved,false,'nem ícone');
 await pick(page,'graphite');

 /* Vale na hora: sem Salvar, e continua valendo ao cancelar. */
 await pick(page,'graphite');
 const before=await style(page,'#settings-save','backgroundColor');
 await pick(page,'violet');
 assert.notEqual(await style(page,'#settings-save','backgroundColor'),before,'a ação principal muda sem esperar o Salvar');
 await page.locator('#settings-dialog button[value="cancel"]').last().click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 assert.equal(await accentOf(page),'violet','cancelar não desfaz o acento');
 assert.equal(await readRuntimeAccent(runtime),'violet','o acento foi gravado como estado de interface');
 const config=JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8'));
 assert.equal('accent' in config,false,'o acento não vira campo do config.json');
 assert.equal('accent' in (config.desk||{}),false,'nem do bloco desk');

 /* Capturas: Aparência aberta, claro e escuro, nos dois tamanhos, com os dois
    acentos. */
 const shots=[['light','graphite'],['light','violet'],['dark','graphite'],['dark','violet']];
 for(const [theme,accent] of shots){
  await setTheme(page,theme);
  for(const size of SIZES){
   await setSize(ctx.app,page,size);
   await openAppearance(page);
   await pick(page,accent);
   await page.mouse.move(2,2);
   await shot(page,`${theme}-${accent}-${size.join('x')}-configuracoes.png`);
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
   await shot(page,`${theme}-${accent}-${size.join('x')}-mesa.png`);
  }
 }
 await setSize(ctx.app,page,[1440,900]);

 /* Abertura seguinte: a escolha volta. */
 await setTheme(page,'light');
 await openAppearance(page);
 await pick(page,'violet');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 assert.equal(await readRuntimeAccent(runtime),'violet');
 await ctx.app.close();
 ctx.app=await launchDesk({runtime});
 page=await ctx.app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 assert.equal(await accentOf(page),'violet','a escolha persiste entre aberturas');
 await openAppearance(page);
 assert.equal(await page.locator('#accent-mode [data-accent="violet"]').getAttribute('aria-checked'),'true','a opção salva volta marcada');
 assert.equal(await page.locator('.brand-icon').first().getAttribute('src'),'assets/app-icon/integral-light-violet-128.png','a marca persistida segue o acento');
 await page.keyboard.press('Escape');

 assert.deepEqual(errors,[]);
 console.log('PASS: cor de acento — duas opções, nos dois temas, na hora e persistente');
});

console.log('Screenshots:',SHOT_DIR);
