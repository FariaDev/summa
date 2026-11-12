import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,tinyPdfPages,statusOnline,freezeMotion,resizeWindow,screenshotDirectory} from './helpers.mjs';
import {layoutStable,nextFrames} from './waits.mjs';

/* Chat lateral na tela inteira (#193): com o lateral aberto, `body.chat-full`
   ganha um painel fixo de 17.5rem na borda direita — o MESMO `#sidechat`, com o
   mesmo estado, as mesmas sessões e o mesmo DOM. A coluna de leitura da #192
   continua centrada no espaço que sobra à esquerda do painel e a rolagem de
   `#messages` termina encostada nele. O `#sidechat-toggle` abre e fecha o painel
   nos dois modos; sair da tela inteira devolve o lateral aberto à área de apoio;
   em 900px, sem espaço para coluna + painel, o painel cobre a coluna sem
   espremê-la. */

const WIDE=[1440,900];
const NARROW=[900,650];
const SHOT_DIR=screenshotDirectory('lateral-tela-inteira');

async function openDesk(ctx){
 const runtime=ctx.runtime=newRuntime('lateral-full'),course=seedCourse(runtime,'Test');
 fs.writeFileSync(path.join(course,'Limites.pdf'),tinyPdfPages(3,'pagina'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Test',name:'Cálculo I',path:course}],desk:{panels:[{label:'Lista',prefer:['Limites']}],pinnedExtensions:false}});
 ctx.app=await launchDesk({runtime});
 const page=await ctx.app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:25000});
 await resizeWindow(ctx.app,page,...WIDE);
 await freezeMotion(page);
 await layoutStable(page,'#chat');
 await page.evaluate(()=>{
  const fixture=document.createElement('article');
  fixture.className='message assistant';fixture.id='panel-lane';
  fixture.innerHTML='<div class="body"><p>Linha de leitura com o painel lateral.</p></div>';
  document.querySelector('#messages').append(fixture);
 });
 return {page,errors};
}

async function openSidechat(page){
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>{
  const el=document.querySelector('#sidechat');
  if(!el||el.hidden||el.getBoundingClientRect().width<=0)return false;
  const prompt=document.querySelector('#sidechat-prompt');
  return !!prompt&&!prompt.disabled&&!document.querySelector('#sidechat-messages .sidechat-msg.system');
 },undefined,{timeout:20000});
}

async function waitFull(page,value){
 await page.waitForFunction(want=>document.body.classList.contains('chat-full')===want,value,{timeout:5000});
 await layoutStable(page,'#chat');
 await nextFrames(page,2);
}

const metrics=page=>page.evaluate(()=>{
 const box=selector=>document.querySelector(selector).getBoundingClientRect().toJSON();
 const panel=document.querySelector('#sidechat');
 const message=document.querySelector('#panel-lane')?.getBoundingClientRect();
 return {
  full:document.body.classList.contains('chat-full'),
  panelClass:document.body.classList.contains('sidechat-panel'),
  docked:document.body.classList.contains('sidechat-docked'),
  innerWidth,
  innerHeight,
  panel:{left:box('#sidechat').left,right:box('#sidechat').right,top:box('#sidechat').top,bottom:box('#sidechat').bottom,width:box('#sidechat').width},
  panelHidden:panel.hidden,
  panelParent:panel.parentElement?.id||panel.parentElement?.tagName||'',
  sameNode:window.__sidechat===panel,
  chat:box('#chat'),
  messages:box('#messages'),
  calculator:box('#calculator'),
  message:message?{left:message.left,right:message.right,width:message.width}:null,
  reading:Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reading-column')),
  pressed:document.querySelector('#sidechat-toggle').getAttribute('aria-pressed'),
  supportChat:document.querySelector('#support-body').classList.contains('chat')
 };
});

async function shot(page,name){
 await page.mouse.move(2,2);
 await page.screenshot({path:path.join(SHOT_DIR,name)});
}

await withArtifacts('lateral-tela-inteira',async ctx=>{
 const {page,errors}=await openDesk(ctx);

 /* Abre o lateral ao lado e guarda o nó: o painel da tela inteira tem de ser
    ESTE nó, com as mesmas mensagens, não um segundo chat. */
 await openSidechat(page);
 await page.evaluate(()=>{
  window.__sidechat=document.querySelector('#sidechat');
  window.__sidechatMessages=document.querySelector('#sidechat-messages');
 });
 const beside=await metrics(page);
 assert.equal(beside.panelClass,false,'ao lado ainda não há painel');
 assert.equal(beside.panelParent,'support-body','ao lado o lateral mora na área de apoio');

 /* Tela inteira com o lateral aberto: painel fixo de 17.5rem na borda direita. */
 await page.locator('#chat-full').click();
 await waitFull(page,true);
 const full=await metrics(page);
 assert.equal(full.panelClass,true,'a tela inteira põe o lateral no painel');
 assert.equal(full.panelHidden,false,'o painel aparece');
 assert.equal(full.panelParent,'BODY','o mesmo nó é reposicionado para o corpo da janela');
 assert.equal(full.sameNode,true,'é o mesmo #sidechat, não um segundo chat');
 assert.equal(await page.evaluate(()=>window.__sidechatMessages===document.querySelector('#sidechat-messages')),true,'as mensagens são o mesmo DOM');
 assert.equal(full.pressed,'true','o toggle mostra o painel aberto');
 const panelWidth=17.5*await page.evaluate(()=>Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
 assert.ok(Math.abs(full.panel.width-panelWidth)<=2,`o painel tem 17.5rem (${full.panel.width} de ${panelWidth})`);
 assert.ok(Math.abs(full.panel.right-full.innerWidth)<=1,`o painel encosta na borda direita (${full.panel.right} de ${full.innerWidth})`);
 assert.ok(Math.abs(full.panel.left-(full.innerWidth-panelWidth))<=2,`o painel começa onde a coluna termina (${full.panel.left})`);
 assert.ok(Math.abs(full.panel.bottom-full.innerHeight)<=1,'o painel vai até o pé da janela');

 /* A coluna fica centrada no espaço restante e a rolagem termina no painel. */
 assert.equal(full.docked,true,'em 1440px o painel encaixa na coluna');
 assert.ok(Math.abs(full.chat.width-(full.innerWidth-panelWidth))<=2,`a coluna do tutor termina no painel (${full.chat.width})`);
 assert.ok(Math.abs(full.messages.right-full.panel.left)<=2,`a rolagem termina na borda do painel (${full.messages.right} de ${full.panel.left})`);
 assert.ok(full.message,'a conversa tem a linha de leitura para medir');
 assert.ok(Math.abs(full.message.width-full.reading)<=1,`o texto mantém a coluna (${full.message.width} de ${full.reading})`);
 assert.ok(Math.abs((full.message.left+full.message.right)/2-full.chat.width/2)<=2,`a coluna fica centrada no espaço restante (${full.message.left}..${full.message.right} de ${full.chat.width})`);
 /* A calculadora é irmã do `#chat`: centra na mesma coluna, não na janela. */
 assert.ok(Math.abs((full.calculator.left+full.calculator.right)/2-(full.message.left+full.message.right)/2)<=2,`a calculadora centra com a coluna (${full.calculator.left}..${full.calculator.right})`);
 await shot(page,'tela-inteira-painel-encaixado.png');

 /* O toggle fecha e abre o painel nos dois modos. */
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>document.querySelector('#sidechat')?.hidden);
 await nextFrames(page,2);
 const closed=await metrics(page);
 assert.equal(closed.panelClass,false,'fechar tira o painel');
 assert.equal(closed.pressed,'false','o toggle mostra o painel fechado');
 assert.ok(Math.abs(closed.chat.width-closed.innerWidth)<=2,`sem o painel a coluna ocupa a janela (${closed.chat.width} de ${closed.innerWidth})`);
 await shot(page,'tela-inteira-painel-fechado.png');
 await page.locator('#sidechat-toggle').click();
 await page.waitForFunction(()=>{const el=document.querySelector('#sidechat');return el&&!el.hidden&&el.getBoundingClientRect().width>0;},undefined,{timeout:10000});
 await waitFull(page,true);
 const reopened=await metrics(page);
 assert.equal(reopened.panelClass,true,'o toggle abre o painel de novo');
 assert.equal(reopened.sameNode,true,'abrir de novo reusa o mesmo nó');
 assert.ok(Math.abs(reopened.panel.width-panelWidth)<=2,'a largura do painel volta igual');

 /* Sair da tela inteira: o lateral continua aberto na área de apoio. */
 await page.locator('#chat-full').click();
 await waitFull(page,false);
 await page.waitForFunction(()=>{const el=document.querySelector('#sidechat');return el&&!el.hidden&&el.getBoundingClientRect().width>0;},undefined,{timeout:10000});
 const back=await metrics(page);
 assert.equal(back.panelClass,false,'a área de apoio volta a ser o lugar do lateral');
 assert.equal(back.panelParent,'support-body','o nó volta ao corpo da área de apoio');
 assert.equal(back.supportChat,true,'a área de apoio está na aba do chat lateral');
 assert.equal(back.pressed,'true','o lateral continua aberto');
 assert.equal(back.sameNode,true,'a conversa é a mesma');
 await shot(page,'lado-a-lado-lateral-aberto.png');

 /* Janela estreita: o painel cobre a coluna, sem espremê-la. */
 await resizeWindow(ctx.app,page,...NARROW);
 await layoutStable(page,'#chat');
 await page.locator('#chat-full').click();
 await waitFull(page,true);
 const narrow=await metrics(page);
 assert.equal(narrow.panelClass,true,'na janela estreita o painel continua');
 assert.equal(narrow.docked,false,'coluna + painel não cabem em 900px: o painel cobre');
 assert.ok(Math.abs(narrow.panel.width-panelWidth)<=2,'a largura do painel não muda');
 assert.ok(Math.abs(narrow.chat.width-narrow.innerWidth)<=2,`a coluna não é espremida (${narrow.chat.width} de ${narrow.innerWidth})`);
 assert.ok(Math.abs(narrow.messages.right-narrow.innerWidth)<=2,'o scroller segue na janela');
 assert.ok(narrow.message,'a linha de leitura continua medível');
 assert.ok(Math.abs(narrow.message.width-narrow.reading)<=1,`a largura da coluna não muda (${narrow.message.width} de ${narrow.reading})`);
 assert.ok(narrow.panel.left<narrow.message.right,`o painel cobre a coluna (painel em ${narrow.panel.left}, texto até ${narrow.message.right})`);
 await shot(page,'estreita-painel-cobre.png');

 assert.deepEqual(errors,[]);
 console.log(`PASS: chat lateral na tela inteira — painel de ${Math.round(full.panel.width)}px encaixado, scroller no painel, coluna centrada; toggle fecha e abre; saída devolve ao apoio; 900px cobre a coluna sem espremer`);
});
