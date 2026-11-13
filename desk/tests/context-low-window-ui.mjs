// node tests/context-low-window-ui.mjs — o painel Contexto continua utilizável
// em janela baixa (#38). Antes do piso do dock (#39), a conversa longa o
// esmagava até 1px e o "Resumir agora" ficava inalcançável. Aqui a conversa
// longa é real, o dock tem de manter cabeça + uma linha e o corpo rola até o
// botão, que precisa ficar inteiro à vista, clicável e com alvo de 24×24.
// Sem Pi e sem modelo real: o motor é o `fake-opencode.mjs`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,tinyPdf,tinyPdfPages,
 seedNativeSession,statusOnline,freezeMotion,resizeWindow,pageWindow
} from './helpers.mjs';
import {nextFrames} from './waits.mjs';


const longConversation=()=>{
 const messages=[];
 for(let turn=1;turn<=30;turn++){
  messages.push({role:'user',content:[{type:'text',text:`Pergunta ${turn}: como resolvo a questão ${turn} da lista?\n\nMostre o passo a passo e confira o sinal no fim.`}]});
  messages.push({role:'assistant',content:[{type:'text',text:`Resposta ${turn}: comece pela definição e derive termo a termo.\n\nA derivada de $f(x)=x^${turn%9+1}+${turn}$ é $f'(x)=${turn%9+1}x^${turn%9}$ e o sinal fica positivo.\n\n- passo 1: escreva a expressão\n- passo 2: confira o sinal\n- passo 3: volte à questão ${turn}`}]});
 }
 return messages;
};

const dockGeometry=page=>page.evaluate(()=>{
 const dock=document.querySelector('#context-dock');
 const head=dock.querySelector('.dock-head');
 const body=dock.querySelector('.dock-body');
 const root=getComputedStyle(document.documentElement);
 const chat=document.querySelector('#chat');
 return {
  dock:dock.getBoundingClientRect().toJSON(),
  head:head.getBoundingClientRect().toJSON(),
  oneLine:parseFloat(root.getPropertyValue('--space-6'))||16,
  bodyScrollHeight:body.scrollHeight,
  bodyClientHeight:body.clientHeight,
  chatScrollHeight:chat.scrollHeight,
  chatClientHeight:chat.clientHeight,
 };
});

const summarizeAtBottom=page=>page.evaluate(()=>{
 const body=document.querySelector('#context-dock .dock-body');
 body.scrollTop=body.scrollHeight;
 const button=document.querySelector('#context-summarize');
 const box=button.getBoundingClientRect();
 const outer=body.getBoundingClientRect();
 const hit=document.elementFromPoint((box.left+box.right)/2,(box.top+box.bottom)/2);
 return {
  button:box.toJSON(),
  body:outer.toJSON(),
  hit:hit===button||button.contains(hit),
  disabled:button.disabled,
 };
});

await withArtifacts('context-low-window',async ctx=>{
 const runtime=ctx.runtime=newRuntime('context-low-window');
 const course=seedCourse(runtime,'calc');
 const one=path.join(course,'Limites.pdf');
 const two=path.join(course,'Formulario.pdf');
 fs.writeFileSync(one,tinyPdfPages(5,'Limites'));
 fs.writeFileSync(two,tinyPdf('Formulas'));
 const session=seedNativeSession(runtime,longConversation(),{courseId:'calc',started:Date.now()-86400000,preview:'conversa longa'});
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{session,courseId:'calc',courseStates:{calc:{session,sessions:[{path:session,started:Date.now()-86400000}],pdfs:[{path:one,page:3},{path:two,page:1}],study:{title:'Lista 4 · q.9',xopp:''}}}});
 /* O motor é o fake padrão do `launchDesk`, pelo `fakeEngineLauncher`: o
    Windows não executa o `.mjs` cru e o tutor nunca ficava online na CI. */
 const app=ctx.app=await launchDesk({runtime,pi:false});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('#composer');
 await page.waitForFunction(()=>document.querySelectorAll('#messages .message').length>=60,undefined,{timeout:60000});
 await page.waitForFunction(()=>document.querySelector('#context-summary')?.textContent.includes('Limites.pdf'));
 await statusOnline(page,{timeout:60000});
 await freezeMotion(page);

 /* 1024×600 é o tamanho pedido na issue, mas o app tem `minHeight:650`
    (main.cjs): o `resizeWindow` recusa 600. O teste baixa o mínimo só nesta
    janela para medir o layout no tamanho da issue; o 900×650 abaixo é o
    mínimo real do app. */
 const win=await pageWindow(app,page);
 await win.evaluate(bw=>bw.setMinimumSize(1,1));

 for(const [width,height] of [[1024,600],[900,650]]){
  await resizeWindow(app,page,width,height);
  if(await page.evaluate(()=>document.querySelector('#context-dock').hidden))await page.locator('#context-line').click();
  await page.waitForSelector('#context-dock:not([hidden])');
  await page.locator('#context-dock .dock-body').evaluate(el=>{el.scrollTop=0;});
  await nextFrames(page,2);

  const geo=await dockGeometry(page);
  assert.ok(geo.chatScrollHeight>geo.chatClientHeight+100,`${width}×${height}: a conversa longa excede a coluna e aperta o dock (${geo.chatScrollHeight} > ${geo.chatClientHeight})`);
  assert.ok(geo.dock.height>=geo.head.height+geo.oneLine-0.5,`${width}×${height}: o dock mantém cabeça mais uma linha (${geo.dock.height} ≥ ${geo.head.height}+${geo.oneLine})`);
  assert.ok(geo.bodyScrollHeight>geo.bodyClientHeight,`${width}×${height}: o corpo do dock rola (${geo.bodyScrollHeight} > ${geo.bodyClientHeight})`);

  const summarize=await summarizeAtBottom(page);
  await nextFrames(page,2);
  assert.ok(summarize.button.width>=24&&summarize.button.height>=24,`${width}×${height}: o Resumir agora tem alvo de 24×24 (${summarize.button.width}×${summarize.button.height})`);
  assert.ok(summarize.button.top>=summarize.body.top-0.5&&summarize.button.bottom<=summarize.body.bottom+0.5,`${width}×${height}: depois de rolar o dock-body, o Resumir agora fica inteiro à vista (${JSON.stringify({button:summarize.button,body:summarize.body})})`);
  assert.equal(summarize.disabled,false,`${width}×${height}: o Resumir agora está habilitado`);
  assert.equal(summarize.hit,true,`${width}×${height}: o centro do Resumir agora recebe o clique`);
  await page.locator('#context-summarize').click({trial:true});
 }

 assert.deepEqual(errors,[],'sem erro de página');
});
console.log('ok context-low-window-ui');
