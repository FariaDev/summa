// node tests/composer-height-ui.mjs — altura do campo do tutor (r2), na janela.
// O texto começa no alto, o padrão é três linhas, e o fio de cima do composer
// arrasta a altura entre duas linhas e metade da coluna. Setas andam uma linha,
// duplo clique volta ao padrão e a altura escolhida sobrevive ao reload pelo
// mesmo `layoutSnapshot`/`save-state` dos tamanhos de painel. Capturas nos dois
// temas em /tmp/claude-1000/r2-cadernos-composer-2/.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,tinyPdf,
  setTheme,freezeMotion,resizeWindow
} from './helpers.mjs';
import {layoutStable,nextFrames,pollUntil} from './waits.mjs';

const shots='/tmp/claude-1000/r2-cadernos-composer-2';
fs.mkdirSync(shots,{recursive:true});
const columnShot=async(page,file)=>{const box=await page.locator('#chat').boundingBox();await page.screenshot({path:file,clip:box});};

const fieldFacts=page=>page.evaluate(()=>{
  const field=document.querySelector('#prompt');
  const style=getComputedStyle(field),box=field.getBoundingClientRect();
  const chat=document.querySelector('#chat'),composer=document.querySelector('#composer');
  const attach=document.querySelector('#composer-box .composer-actions #attach');
  return {
    height:box.height,lineHeight:Number.parseFloat(style.lineHeight),
    paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,
    fieldTop:box.top,composerTop:composer.getBoundingClientRect().top,
    actionsTop:attach?attach.getBoundingClientRect().top:null,
    columnHeight:chat.clientHeight,
    textAlign:style.textAlign,
  };
});

await withArtifacts('composer-height',async ctx=>{
  const runtime=ctx.runtime=newRuntime('composer-height');
  const course=seedCourse(runtime,'calc');
  const pdf=path.join(course,'Limites.pdf');fs.writeFileSync(pdf,tinyPdf('Limites e derivadas'));
  writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
  writeDeskJson(runtime,{courseId:'calc',courseStates:{calc:{pdfs:[{path:pdf,page:1}],study:{title:'',xopp:''}}}});
  ctx.app=await launchDesk({runtime});
  const page=await ctx.app.firstWindow();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await resizeWindow(ctx.app,page,1440,900,{content:true});
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('#prompt');
  const grip=page.locator('#composer-grip');
  await grip.waitFor({state:'visible',timeout:5000});
  await layoutStable(page,'main');

  /* ---------- padrão: três linhas, texto no alto e o fio acessível ---------- */
  const start=await fieldFacts(page);
  assert.equal(start.paddingTop,'0px','o texto começa no alto do campo, sem respiro no topo');
  assert.equal(start.paddingBottom,'0px','o campo não centraliza o texto no pé');
  assert.ok(Math.abs(start.height-start.lineHeight*3)<=1,`o padrão é três linhas (${start.height}px para linha de ${start.lineHeight}px)`);
  /* O fim da 3ª linha é o pé do campo (padding 0); a fileira de botões começa
     8px abaixo, o respiro do r2. A asserção mede o topo do primeiro botão. */
  const thirdLineBottom=start.fieldTop+start.lineHeight*3;
  assert.ok(Math.abs(start.actionsTop-thirdLineBottom-8)<=2,`o vão do fim da 3ª linha ao topo dos botões é 8±2px (${(start.actionsTop-thirdLineBottom).toFixed(1)}px)`);
  const gripFacts=await page.evaluate(()=>{
    const grip=document.querySelector('#composer-grip'),style=getComputedStyle(grip);
    const after=getComputedStyle(grip,'::after');
    return {
      role:grip.getAttribute('role'),orientation:grip.getAttribute('aria-orientation'),
      label:grip.getAttribute('aria-label'),tabindex:grip.getAttribute('tabindex'),
      cursor:style.cursor,width:after.width,height:after.height,opacity:after.opacity,
    };
  });
  assert.deepEqual({role:gripFacts.role,orientation:gripFacts.orientation,tabindex:gripFacts.tabindex},
    {role:'separator',orientation:'horizontal',tabindex:'0'},'o fio é um separador horizontal focável');
  assert.equal(gripFacts.label,'Altura da caixa de mensagem','o separador tem o nome acessível em pt-BR');
  assert.equal(gripFacts.cursor,'row-resize','o cursor do fio é row-resize');
  assert.deepEqual([gripFacts.width,gripFacts.height],['32px','2px'],'o traço mede 32×2');
  assert.equal(gripFacts.opacity,'0','o traço fica escondido em repouso');
  await grip.focus();
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#composer-grip'),'::after').opacity),'1','o traço aparece no foco');

  await setTheme(page,'light');
  await page.evaluate(()=>document.activeElement?.blur());
  await columnShot(page,path.join(shots,'composer-padrao-light.png'));

  /* ---------- arrastar: teto de meia coluna e piso de duas linhas ---------- */
  const drag=async deltaY=>{
    const box=await grip.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2+deltaY,{steps:6});
    await page.mouse.up();
    await nextFrames(page);
  };
  await drag(-1000);
  const tall=await fieldFacts(page);
  assert.ok(tall.height<=tall.columnHeight/2+1,`arrastar para cima para em meia coluna (${tall.height}px de ${tall.columnHeight}px)`);
  assert.ok(tall.height>tall.lineHeight*3,`arrastar para cima cresce o campo (${tall.height}px)`);
  await grip.focus();
  await nextFrames(page);
  await columnShot(page,path.join(shots,'composer-esticado-light.png'));
  await setTheme(page,'dark');
  await grip.focus();
  await nextFrames(page);
  await columnShot(page,path.join(shots,'composer-esticado-dark.png'));
  await drag(1000);
  const short=await fieldFacts(page);
  assert.ok(Math.abs(short.height-short.lineHeight*2)<=1,`arrastar para baixo para em duas linhas (${short.height}px para linha de ${short.lineHeight}px)`);
  await grip.dblclick();
  await nextFrames(page);
  const reset=await fieldFacts(page);
  assert.ok(Math.abs(reset.height-reset.lineHeight*3)<=1,`duplo clique volta ao padrão de três linhas (${reset.height}px)`);
  await page.evaluate(()=>document.activeElement?.blur());
  await columnShot(page,path.join(shots,'composer-padrao-dark.png'));

  /* ---------- setas: uma linha por tecla, sem passar dos limites ---------- */
  await setTheme(page,'light');
  await grip.focus();
  const beforeArrows=await fieldFacts(page);
  await page.keyboard.press('ArrowUp');
  await nextFrames(page);
  assert.ok(Math.abs((await fieldFacts(page)).height-(beforeArrows.height+beforeArrows.lineHeight))<=1,'↑ sobe uma linha');
  await page.keyboard.press('ArrowDown');
  await nextFrames(page);
  assert.ok(Math.abs((await fieldFacts(page)).height-beforeArrows.height)<=1,'↓ desce uma linha');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await nextFrames(page);
  const bottom=await fieldFacts(page);
  assert.ok(Math.abs(bottom.height-bottom.lineHeight*2)<=1,`↓ para no piso de duas linhas (${bottom.height}px)`);

  /* ---------- altura lembrada no mesmo estado de interface dos painéis ---------- */
  await drag(-48);
  const chosen=await fieldFacts(page);
  const deskFile=path.join(runtime,'desk.json');
  await pollUntil(()=>{
    try{return JSON.parse(fs.readFileSync(deskFile,'utf8')).composerHeight;}catch{return null;}
  },value=>Number.isFinite(Number(value))&&Math.abs(Number(value)-chosen.height)<=1,{what:'a altura chegar ao desk.json'});
  await page.evaluate(async()=>{const {setUiLanguage}=await import('./src/ui-text.mjs');await setUiLanguage('en');});
  assert.equal(await grip.getAttribute('aria-label'),'Message box height','o nome do separador acompanha o idioma');
  await page.reload({waitUntil:'load'});
  await page.waitForSelector('#prompt');
  await page.waitForFunction(height=>Math.abs(document.querySelector('#prompt').getBoundingClientRect().height-height)<=1,chosen.height,{timeout:10000});
  const reloaded=await fieldFacts(page);
  assert.ok(Math.abs(reloaded.height-chosen.height)<=1,`a altura sobrevive ao reload (${reloaded.height}px × ${chosen.height}px)`);
  await page.evaluate(async()=>{const {setUiLanguage}=await import('./src/ui-text.mjs');await setUiLanguage('pt-BR');});
  await grip.dblclick();
  await nextFrames(page);
  assert.ok(Math.abs((await fieldFacts(page)).height-reloaded.lineHeight*3)<=1,'depois do reload o duplo clique volta ao padrão');

  assert.deepEqual(errors,[],'nenhum erro de página');
  console.log('composer-height-ui: PASS — três linhas no padrão, texto no alto, fio de 32×2, arrasto com piso/teto, setas de uma linha, duplo clique volta e a altura sobrevive ao reload.');
});
