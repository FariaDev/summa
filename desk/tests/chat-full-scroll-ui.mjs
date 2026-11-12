import assert from 'node:assert/strict';
import {withArtifacts} from './helpers.mjs';
import {layoutStable,nextFrames,pollUntil} from './waits.mjs';
import {openLazyDesk} from './chat-history-lazy-seed.mjs';

/* Rolagem da tela inteira (#192): o scroller `#messages` ocupa a janela toda e
   a barra de rolagem fica na borda direita; as faixas de conteúdo (bolhas,
   avisos, cabeçalho, composer e calculadora) seguem na coluna de leitura.
   O modo lado a lado não muda nem um pixel, e a roda sobre a margem vazia
   rola a conversa. A conversa longa vem da semente da #118. */

const metrics=page=>page.evaluate(()=>{
 const box=selector=>document.querySelector(selector).getBoundingClientRect();
 const visible=element=>{
  const style=getComputedStyle(element);
  return style.display!=='none'&&style.visibility!=='hidden'&&element.getBoundingClientRect().width>0;
 };
 const column=Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reading-column'));
 const space=Number.parseFloat(getComputedStyle(document.body).getPropertyValue('--space-5'));
 const message=[...document.querySelectorAll('#messages > .message')].at(-1)?.getBoundingClientRect()||null;
 const bar=document.querySelector('#calc-bar');
 const composer=box('#composer-box');
 return {
  full:document.body.classList.contains('chat-full'),
  innerWidth,
  column,
  space,
  chat:box('#chat').toJSON(),
  messages:box('#messages').toJSON(),
  message:message?{left:message.left,right:message.right,width:message.width}:null,
  composerLeft:composer.left,
  calcContentLeft:bar.getBoundingClientRect().left+Number.parseFloat(getComputedStyle(bar).paddingLeft),
  calcWidth:box('#calculator').width,
  bands:[...document.querySelectorAll('#chat > *')].filter(element=>element.id!=='messages'&&visible(element)).map(element=>({id:element.id||element.className,width:element.getBoundingClientRect().width})),
  children:[...document.querySelectorAll('#messages > *')].filter(visible).map(element=>({cls:String(element.className),width:element.getBoundingClientRect().width})),
  scrollTop:document.querySelector('#messages').scrollTop,
  scrollHeight:document.querySelector('#messages').scrollHeight,
  clientHeight:document.querySelector('#messages').clientHeight
 };
});

const chatWidth=page=>page.evaluate(()=>Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chat')));

async function waitFull(page,value){
 await page.waitForFunction(want=>document.body.classList.contains('chat-full')===want,value,{timeout:5000});
 await layoutStable(page,'#messages');
 await nextFrames(page,2);
}

await withArtifacts('chat-full-scroll',async ctx=>{
 const {runtime,app,page,errors}=await openLazyDesk(30,{tag:'192'});
 ctx.runtime=runtime;ctx.app=app;

 /* Lado a lado: a coluna do tutor na largura de sempre e o scroller dentro dela. */
 const base=await metrics(page);
 assert.equal(base.full,false,'a Mesa abre com o chat ao lado');
 assert.ok(Math.abs(base.chat.width-await chatWidth(page))<=1,`a coluna do tutor segue em --chat (${base.chat.width})`);
 assert.ok(Math.abs(base.messages.width-base.chat.width)<=1,`o scroller segue na coluna do tutor (${base.messages.width} de ${base.chat.width})`);
 assert.ok(base.messages.width<base.innerWidth-300,'fora da tela inteira o scroller fica só na coluna do tutor');

 /* Tela inteira: o scroller vai até a borda da janela e o texto fica na coluna. */
 await page.locator('#chat-full').click();
 await waitFull(page,true);
 const full=await metrics(page);
 assert.ok(Math.abs(full.messages.right-full.innerWidth)<=2,`o scroller encosta na borda da janela (${full.messages.right} de ${full.innerWidth})`);
 assert.ok(Math.abs(full.messages.width-full.innerWidth)<=2,`o scroller ocupa a janela toda (${full.messages.width})`);
 assert.ok(full.message,`a conversa tem bolhas para medir (${full.children.length} filhos)`);
 assert.ok(full.message.width<=full.column+1,`a bolha respeita a coluna de leitura (${full.message.width} de ${full.column})`);
 assert.ok(Math.abs(full.message.left-(full.innerWidth-full.message.right))<=2,`a bolha segue centrada (${full.message.left} à esquerda, ${full.innerWidth-full.message.right} à direita)`);
 assert.ok(Math.abs(full.composerLeft-full.message.left)<=2,`o composer alinha com a coluna (${full.composerLeft} de ${full.message.left})`);
 assert.ok(Math.abs(full.calcContentLeft-full.message.left)<=2,`a calculadora alinha com a coluna (${full.calcContentLeft} de ${full.message.left})`);
 const laneWidth=full.column+2*full.space;
 for(const band of full.bands)assert.ok(band.width<=laneWidth+1,`a faixa ${band.id} não estica na janela (${band.width} de ${laneWidth})`);
 for(const child of full.children)assert.ok(child.width<=full.column+1,`o conteúdo ${child.cls} não estica na janela (${child.width} de ${full.column})`);
 assert.ok(full.scrollHeight>full.clientHeight,'a conversa longa rola dentro do scroller');

 /* Roda sobre a margem vazia (fora da coluna de texto): rola a conversa. */
 const start=await page.evaluate(()=>document.querySelector('#messages').scrollTop);
 assert.ok(start>0,'a conversa longa abre no fim do scroller');
 const area=await page.evaluate(()=>document.querySelector('#messages').getBoundingClientRect().toJSON());
 await page.mouse.move(Math.round(area.left+40),Math.round(area.top+area.height/2));
 await page.mouse.wheel(0,-320);
 await pollUntil(()=>page.evaluate(()=>document.querySelector('#messages').scrollTop),top=>top<start-1,{what:'a roda sobre a margem rolar #messages'});

 /* De volta ao lado a lado: mesmos retângulos de antes, sem sobra do modo. */
 await page.locator('#chat-full').click();
 await waitFull(page,false);
 const back=await metrics(page);
 assert.equal(back.full,false);
 assert.ok(Math.abs(back.chat.width-base.chat.width)<=1,`a coluna volta igual (${back.chat.width} de ${base.chat.width})`);
 assert.ok(Math.abs(back.messages.width-base.messages.width)<=1,`o scroller volta igual (${back.messages.width} de ${base.messages.width})`);
 assert.ok(Math.abs(back.messages.right-base.messages.right)<=1,`o scroller volta na mesma borda (${back.messages.right} de ${base.messages.right})`);

 assert.deepEqual(errors,[]);
 console.log(`PASS chat-full-scroll-ui — scroller na janela (${Math.round(full.messages.width)}px), bolhas na coluna (${Math.round(full.message.width)}px), composer e calculadora alinhados; roda rola a margem; lado a lado igual (${Math.round(base.chat.width)}px)`);
});
