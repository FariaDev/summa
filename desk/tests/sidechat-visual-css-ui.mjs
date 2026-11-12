import assert from 'node:assert/strict';
import {withArtifacts,setTheme,resizeWindow,workAreaSize} from './helpers.mjs';
import {bootCourse,openSidechat,detachSidechat,applyTheme} from './capture-ciclo2-chat-solto-kit.mjs';
import {pollUntil} from './waits.mjs';

/* Chat solto (#157), achados visuais da rodada 1: os números que a nota mediu
   viram teste. Cada bloco mede no Electron real, nos dois temas:
   - o leitor fixado ocupa o vão quando o slot de apoio recolhe (chat solto);
   - o composer da janela solta fica no campo de 3 linhas, sem a altura do
     tutor nem vazio no topo;
   - as ações de mensagem passam AA (4,5:1) nos dois temas;
   - o foco do campo na janela solta tem anel de --ring com 3:1;
   - as opções do quiz parecem botão (borda, hover, foco);
   - o Enviar desligado é legível (texto ≥ 4,5:1);
   - a bolha do usuário respeita os 85% do tutor.
   O composer principal não muda de altura (medido antes/depois de soltar).
   Dados sintéticos, `fake-opencode`; fora do `npm run ui`? Não: o arquivo casa
   `*-ui.mjs` e roda com `npm run ui -- sidechat`. */

const failures=[];
const failure=(tag,error)=>failures.push(`${tag}: ${String(error?.message||error).split('\n')[0]}`);
async function block(tag,run){
 try{await withArtifacts(tag,run);}catch(error){failure(tag,error);}
}
async function check(tag,run){
 try{await run();}catch(error){failure(tag,error);}
}

/* Contraste WCAG a partir da cor computada, com a opacidade dos ancestrais (a
   mesma conta do JSON das capturas). */
const parseColor=(value)=>{
 const match=/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i.exec(String(value||''));
 if(!match)return null;
 return {r:+match[1],g:+match[2],b:+match[3],a:match[4]===undefined?1:+match[4]};
};
const luminance=({r,g,b})=>{
 const channel=(value)=>{const v=value/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};
 return 0.2126*channel(r)+0.7152*channel(g)+0.0722*channel(b);
};
const contrast=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+0.05)/(lo+0.05);};
const shown=({r,g,b})=>`rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;

/** Cor efetiva do texto (com a opacidade dos ancestrais) e o fundo efetivo. */
function contrastFacts(page,selector){
 return page.evaluate((sel)=>{
  const parse=(value)=>{
   const match=/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i.exec(String(value||''));
   if(!match)return null;
   return {r:+match[1],g:+match[2],b:+match[3],a:match[4]===undefined?1:+match[4]};
  };
  const over=(top,bottom)=>({r:top.r*top.a+bottom.r*(1-top.a),g:top.g*top.a+bottom.g*(1-top.a),b:top.b*top.a+bottom.b*(1-top.a),a:1});
  const el=document.querySelector(sel);
  if(!el)throw Error(`elemento ausente: ${sel}`);
  let opacity=1,node=el;
  while(node&&node.nodeType===1){opacity*=Number(getComputedStyle(node).opacity)||1;node=node.parentElement;}
  const layers=[];node=el;
  while(node&&node.nodeType===1){
   const color=parse(getComputedStyle(node).backgroundColor);
   if(color&&color.a>0.001){layers.push(color);if(color.a>=0.999)break;}
   node=node.parentElement;
  }
  let background={r:255,g:255,b:255,a:1};
  for(let index=layers.length-1;index>=0;index--)background=over(layers[index],background);
  const base=parse(getComputedStyle(el).color);
  const foreground={...base,a:base.a*opacity};
  return {foreground:foreground.a<0.999?over(foreground,background):foreground,background,opacity};
 },selector);
}
async function assertContrast(page,selector,floor,label){
 const facts=await contrastFacts(page,selector);
 const ratio=contrast(facts.foreground,facts.background);
 assert.ok(ratio>=floor,`${label}: ${shown(facts.foreground)} sobre ${shown(facts.background)} (opacidade ${facts.opacity.toFixed(2)}) dá ${ratio.toFixed(2)}:1, esperado ≥ ${floor}:1`);
 return ratio;
}

const near=(a,b,tolerance=1)=>Math.abs(a-b)<=tolerance;

/* Campo de 3 linhas: altura = 3 × line-height + o respiro vertical, e o
   composer inteiro = as partes, sem sobra. */
async function composerFacts(page){
 return page.evaluate(()=>{
  const el=document.querySelector('#sidechat-prompt');
  const composer=document.querySelector('#sidechat-composer');
  const scope=document.querySelector('#sidechat-scope');
  const actions=document.querySelector('#sidechat-composer .composer-actions');
  const style=getComputedStyle(el),cstyle=getComputedStyle(composer);
  const rectOf=(node)=>{const box=node.getBoundingClientRect();return {top:box.top,bottom:box.bottom,height:box.height};};
  return {
   lineHeight:Number.parseFloat(style.lineHeight),
   paddingTop:Number.parseFloat(style.paddingTop),
   paddingBottom:Number.parseFloat(style.paddingBottom),
   field:rectOf(el),scope:rectOf(scope),actions:rectOf(actions),
   composer:{...rectOf(composer),minHeight:cstyle.minHeight,paddingTop:Number.parseFloat(cstyle.paddingTop),paddingBottom:Number.parseFloat(cstyle.paddingBottom),borderTop:Number.parseFloat(cstyle.borderTopWidth)},
  };
 });
}

async function assertComposerThreeLines(page,label){
 const facts=await composerFacts(page);
 const lines=3*facts.lineHeight;
 const expectedField=lines+facts.paddingTop+facts.paddingBottom;
 assert.ok(near(facts.field.height,expectedField,1.5),`${label}: campo com ${facts.field.height.toFixed(1)}px; 3 linhas de ${facts.lineHeight}px + ${facts.paddingTop + facts.paddingBottom}px de respiro = ${expectedField.toFixed(1)}px`);
 const expectedComposer=facts.composer.borderTop+facts.composer.paddingTop+facts.scope.height+facts.field.height+facts.actions.height+facts.composer.paddingBottom;
 assert.ok(near(facts.composer.height,expectedComposer,1.5),`${label}: composer com ${facts.composer.height.toFixed(1)}px; as partes somam ${expectedComposer.toFixed(1)}px (sem sobra)`);
 assert.ok(facts.composer.height<185,`${label}: composer com ${facts.composer.height.toFixed(1)}px; esperado menos de 185px (o vão vazio saiu)`);
 assert.ok(facts.field.top-facts.scope.bottom<=1,`${label}: campo ${ (facts.field.top-facts.scope.bottom).toFixed(1)}px abaixo do escopo (sem vazio no topo da caixa)`);
 return facts;
}

const savedUncertain={
 id:'sc-11111111-1111-4111-8111-111111111111',engine:'opencode',
 messages:[
  {role:'user',text:'Explique o limite fundamental em uma linha.'},
  {role:'assistant',text:'Divida numerador e denominador por x antes de substituir.'},
 ],draft:'',busy:false,uncertain:true,
 context:{mainSession:'',refs:[{path:'/tmp/sidechat-visual/Limites.pdf',page:1},{path:'/tmp/sidechat-visual/Formulario.pdf',page:1}],study:{},at:1700000000000},
 cards:[],
};
async function injectUncertain(page,target){
 await page.evaluate(async payload=>{const sidechat=await import('./src/sidechat.mjs');sidechat.openSavedSidechat(payload);},savedUncertain);
 await target.waitForSelector('#sidechat-messages .sidechat-warn',{timeout:10000});
 await target.evaluate(()=>document.activeElement?.blur?.());
}

/* ---------- 1. leitor fixado ocupa o vão quando o chat está solto ---------- */

await block('chat-solto-visual-vao',async ctx=>{
 const {runtime,app,page}=await bootCourse('sidechat-visual-vao');
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await page.locator('#sidechat-prompt').fill('teorema do chat lateral');
 await page.locator('#sidechat-prompt').press('Enter');
 await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-msg.assistant .sidechat-body')].some(el=>el.textContent.includes('Pitágoras')),undefined,{timeout:40000});
 const tutorBefore=await page.evaluate(()=>({composer:document.querySelector('#composer').getBoundingClientRect().height,prompt:document.querySelector('#prompt').getBoundingClientRect().height}));
 await detachSidechat(page,app);
 await check('composer principal estável',async()=>{
  const tutorAfter=await page.evaluate(()=>({composer:document.querySelector('#composer').getBoundingClientRect().height,prompt:document.querySelector('#prompt').getBoundingClientRect().height}));
  assert.ok(near(tutorAfter.composer,tutorBefore.composer,0.5),`composer do tutor mudou de ${tutorBefore.composer}px para ${tutorAfter.composer}px ao soltar o chat`);
  assert.ok(near(tutorAfter.prompt,tutorBefore.prompt,0.5),`campo do tutor mudou de ${tutorBefore.prompt}px para ${tutorAfter.prompt}px ao soltar o chat`);
 });
 const gapFacts=()=>page.evaluate(()=>{
  const reader=document.querySelector('#pdf-grid .pdf-panel.pinned');
  const slot=document.querySelector('#support-slot');
  const references=document.querySelector('#references');
  if(!reader||!slot)return null;
  const r=reader.getBoundingClientRect(),s=slot.getBoundingClientRect();
  return {gap:s.left-r.right,reader:{left:r.left,right:r.right,width:r.width},slot:{left:s.left,right:s.right,width:s.width},references:references.getBoundingClientRect().width,innerWidth};
 });
 for(const [width,height] of [[1440,900],[900,650]]){
  await resizeWindow(app,page,width,height);
  await check(`vão ${width}x${height}`,async()=>{
   const facts=await gapFacts();
   assert.ok(facts,`leitor fixado e slot presentes`);
   assert.ok(facts.gap<=1.5,`leitor fixado termina em ${facts.reader.right.toFixed(1)} e o slot começa em ${facts.slot.left.toFixed(1)}: vão de ${facts.gap.toFixed(1)}px (esperado ≤ 1,5px)`);
   assert.ok(facts.reader.width>=facts.references-facts.slot.width-2,`leitor com ${facts.reader.width.toFixed(1)}px; a coluna de referências tem ${facts.references.toFixed(1)}px e o slot ${facts.slot.width.toFixed(1)}px`);
  });
 }
});

/* ---------- 2. composer, ações, foco, bolha e Enviar desligado ---------- */

await block('chat-solto-visual-composer',async ctx=>{
 const {runtime,app,page}=await bootCourse('sidechat-visual-composer');
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await page.locator('#sidechat-prompt').fill('teorema do chat lateral');
 await page.locator('#sidechat-prompt').press('Enter');
 await page.waitForFunction(()=>[...document.querySelectorAll('#sidechat-messages .sidechat-msg.assistant .sidechat-body')].some(el=>el.textContent.includes('Pitágoras')),undefined,{timeout:40000});

 await check('ações no claro (Mesa)',()=>assertContrast(page,'.sidechat-msg-actions button',4.5,'ações de mensagem no claro'));
 /* r2 (2026-11-11): o cabeçalho segue o cadernos.html — título de 14px e o
    motor num selo mono sobre a camada; as ações na fonte da interface. */
 await check('cabeçalho e ações do r2',async()=>{
  const facts=await page.evaluate(()=>{
   const button=document.querySelector('.sidechat-msg-actions button');
   const title=document.querySelector('#sidechat-title');
   const engine=document.querySelector('#sidechat-engine');
   const probe=document.createElement('i');probe.style.cssText='position:fixed;font-family:var(--font-sans)';document.body.append(probe);
   const ui=getComputedStyle(probe).fontFamily;probe.remove();
   const label=document.createElement('i');label.style.cssText='position:fixed;background:var(--stage)';document.body.append(label);
   const code=getComputedStyle(label).backgroundColor;label.remove();
   return {actionFamily:getComputedStyle(button).fontFamily,ui,
    titleSize:getComputedStyle(title).fontSize,titleWeight:getComputedStyle(title).fontWeight,
    engineSize:getComputedStyle(engine).fontSize,engineFamily:getComputedStyle(engine).fontFamily,
    engineBg:getComputedStyle(engine).backgroundColor,code};
  });
  assert.equal(facts.actionFamily,facts.ui,'Copiar e Levar à sessão principal usam a fonte da interface');
  assert.doesNotMatch(facts.actionFamily,/mono/i,'as ações não usam mono');
  assert.equal(facts.titleSize,'14px','o título do cabeçalho usa 14px (cadernos.html)');
  assert.equal(facts.titleWeight,'600','o título do cabeçalho é semibold');
  assert.equal(facts.engineSize,'12px','o selo do motor usa 12px');
  assert.match(facts.engineFamily,/Plex Mono|mono/i,'o selo do motor continua em mono');
  assert.equal(facts.engineBg,facts.code,'o selo do motor fica na camada');
 });
 await setTheme(page,'dark');
 await check('ações no escuro (Mesa)',()=>assertContrast(page,'.sidechat-msg-actions button',4.5,'ações de mensagem no escuro'));
 await setTheme(page,'light');

 const child=await detachSidechat(page,app);
 const narrowHeight=Math.min(1000,(await workAreaSize(app)).height);
 const narrowLabel=`420x${narrowHeight}`;
 await resizeWindow(app,child,420,narrowHeight);
 await check(`composer ${narrowLabel}`,()=>assertComposerThreeLines(child,`janela solta ${narrowLabel}`));
 await check('campo não cresce',async()=>{
  const height=()=>child.locator('#sidechat-prompt').evaluate(el=>el.getBoundingClientRect().height);
  const before=await height();
  await child.locator('#sidechat-prompt').fill('linha um\nlinha dois\nlinha três\nlinha quatro\ncinco\nseis');
  const after=await height();
  const overflow=await child.locator('#sidechat-prompt').evaluate(el=>el.scrollHeight>el.clientHeight);
  await child.locator('#sidechat-prompt').fill('');
  assert.ok(near(after,before,0.5),`campo passou de ${before}px para ${after}px ao digitar 6 linhas; o campo é fixo`);
  assert.equal(overflow,true,'o texto que não cabe rola dentro do campo');
 });
 await check(`foco no campo ${narrowLabel}`,async()=>{
  await child.locator('#sidechat-prompt').focus();
  const focus=await child.evaluate(()=>{
   const el=document.querySelector('#sidechat-prompt');
   const style=getComputedStyle(el);
   return {focusVisible:el.matches(':focus-visible'),style:style.outlineStyle,width:Number.parseFloat(style.outlineWidth)||0,color:style.outlineColor,background:getComputedStyle(document.querySelector('#sidechat-composer')).backgroundColor};
  });
  assert.equal(focus.focusVisible,true,'o campo está com foco visível');
  assert.notEqual(focus.style,'none',`outline do campo: ${focus.style}`);
  assert.ok(focus.width>=2,`anel de foco com ${focus.width}px; esperado ≥ 2px`);
  const [fg,bg]=[parseColor(focus.color),parseColor(focus.background)];
  const ratio=contrast(fg,bg);
  assert.ok(ratio>=3,`anel ${focus.color} sobre ${focus.background} dá ${ratio.toFixed(2)}:1, esperado ≥ 3:1`);
 });
 await check(`bolha do usuário ${narrowLabel}`,async()=>{
  const facts=await child.evaluate(()=>{
   const body=document.querySelector('#sidechat-messages .sidechat-msg.user .body');
   const card=body.closest('.sidechat-msg');
   const messages=document.querySelector('#sidechat-messages');
   const style=getComputedStyle(messages);
   const content=messages.clientWidth-Number.parseFloat(style.paddingLeft)-Number.parseFloat(style.paddingRight);
   const b=body.getBoundingClientRect(),c=card.getBoundingClientRect();
   return {body:b.width,card:c.width,content,bodyRight:b.right,cardRight:c.right,radius:getComputedStyle(body).borderTopLeftRadius};
  });
  assert.equal(facts.radius,'4px','o balão do aluno usa --r-sm (4px)');
  assert.ok(facts.body<=facts.content*0.85+1,`bolha do usuário com ${facts.body.toFixed(1)}px de ${facts.content.toFixed(1)}px (${(facts.body/facts.content*100).toFixed(1)}%); teto de 85% = ${(facts.content*0.85).toFixed(1)}px`);
  assert.ok(facts.bodyRight<=facts.cardRight+0.5,`bolha alinhada à direita (${facts.bodyRight.toFixed(1)} > ${facts.cardRight.toFixed(1)})`);
 });
 await check('ações no claro (janela solta)',()=>assertContrast(child,'.sidechat-msg-actions button',4.5,'ações de mensagem na janela solta, claro'));

 await applyTheme(page,child,'dark');
 await check(`composer ${narrowLabel} escuro`,()=>assertComposerThreeLines(child,`janela solta ${narrowLabel} escuro`));
 await check('foco no campo escuro',async()=>{
  await child.locator('#sidechat-prompt').focus();
  const focus=await child.evaluate(()=>{
   const el=document.querySelector('#sidechat-prompt');
   const style=getComputedStyle(el);
   return {style:style.outlineStyle,width:Number.parseFloat(style.outlineWidth)||0,color:style.outlineColor,background:getComputedStyle(document.querySelector('#sidechat-composer')).backgroundColor};
  });
  assert.notEqual(focus.style,'none',`outline do campo: ${focus.style}`);
  const ratio=contrast(parseColor(focus.color),parseColor(focus.background));
  assert.ok(ratio>=3,`anel ${focus.color} sobre ${focus.background} dá ${ratio.toFixed(2)}:1, esperado ≥ 3:1`);
 });
 await check('ações no escuro (janela solta)',()=>assertContrast(child,'.sidechat-msg-actions button',4.5,'ações de mensagem na janela solta, escuro'));

 await applyTheme(page,child,'light');
 for(const [width,height] of [[380,800],[420,650]]){
  await resizeWindow(app,child,width,height);
  await check(`composer ${width}x${height}`,()=>assertComposerThreeLines(child,`janela solta ${width}x${height}`));
 }

 await injectUncertain(page,child);
 for(const theme of ['light','dark']){
  await applyTheme(page,child,theme);
  await check(`Enviar desligado ${theme}`,async()=>{
   const facts=await child.evaluate(()=>{
    const button=document.querySelector('#sidechat-send');
    const span=button.querySelector('span')||button;
    return {disabled:button.disabled,label:(span.textContent||'').trim()};
   });
   assert.equal(facts.disabled,true,'o Enviar está desligado no estado incerto');
   assert.ok(facts.label.length>0,`o Enviar desligado mantém o rótulo ("${facts.label}")`);
   await assertContrast(child,'#sidechat-send span',4.5,`Enviar desligado no ${theme}`);
  });
 }
});

/* ---------- 3. opções do quiz com cara de botão ---------- */

await block('chat-solto-visual-quiz',async ctx=>{
 const quiz=JSON.stringify({name:'quiz',input:{question:'Quanto é 2+2?',options:[{label:'3'},{label:'4'}],correctAnswer:'4'}});
 const {runtime,app,page}=await bootCourse('sidechat-visual-quiz',{env:{FAKE_OPENCODE_MCP_CALL:quiz}});
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await page.locator('#sidechat-prompt').fill('quiz de teste no lateral');
 await page.locator('#sidechat-prompt').press('Enter');
 await page.waitForSelector('#sidechat-messages .quiz-card .quiz-option',{timeout:40000});
 const option=page.locator('#sidechat-messages .quiz-card .quiz-option').first();

 await check('borda de botão',async()=>{
  const facts=await page.evaluate(()=>{
   const probe=document.createElement('div');
   probe.style.border='1px solid var(--muted)';
   document.body.append(probe);
   const muted=getComputedStyle(probe).borderTopColor;
   probe.remove();
   const options=[...document.querySelectorAll('#sidechat-messages .quiz-card .quiz-option')];
   const card=document.querySelector('#sidechat-messages .quiz-card');
   return {muted,card:getComputedStyle(card).borderTopColor,options:options.map(el=>({border:getComputedStyle(el).borderTopColor,width:getComputedStyle(el).borderTopWidth,tag:el.tagName,disabled:el.disabled}))};
  });
  assert.ok(facts.options.length>=2,`opções no cartão (${facts.options.length})`);
  for(const item of facts.options){
   assert.equal(item.tag,'BUTTON','a opção é um botão');
   assert.equal(item.disabled,false,'a opção aceita clique antes da resposta');
   assert.equal(item.width,'1px','borda de 1px');
   assert.notEqual(item.border,facts.card,`a borda da opção (${item.border}) não é a do cartão (${facts.card})`);
   assert.equal(item.border,facts.muted,`a borda da opção é --muted (${item.border} × ${facts.muted})`);
  }
 });

 await check('hover de botão',async()=>{
  const before=await option.evaluate(el=>({background:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderTopColor}));
  await option.hover();
  const after=await pollUntil(()=>option.evaluate(el=>({background:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderTopColor})),
   value=>value.background!==before.background,{what:'o hover mudar o fundo da opção'});
  assert.notEqual(after.background,before.background,`o hover muda o fundo (${before.background} → ${after.background})`);
  assert.equal(after.border,before.border,`o hover mantém a borda de repouso já legível (${before.border} → ${after.border})`);
 });

 await check('foco visível no cartão',async()=>{
  await page.keyboard.press('Tab');
  await option.evaluate(el=>el.focus());
  const facts=await option.evaluate(el=>{
   const style=getComputedStyle(el);
   return {visible:el.matches(':focus-visible'),style:style.outlineStyle,width:Number.parseFloat(style.outlineWidth)||0,color:style.outlineColor,background:getComputedStyle(el).backgroundColor};
  });
  assert.equal(facts.visible,true,'a opção recebe :focus-visible');
  assert.notEqual(facts.style,'none',`outline da opção: ${facts.style}`);
  assert.ok(facts.width>=2,`anel de foco com ${facts.width}px; esperado ≥ 2px`);
  const ratio=contrast(parseColor(facts.color),parseColor(facts.background));
  assert.ok(ratio>=3,`anel ${facts.color} sobre ${facts.background} dá ${ratio.toFixed(2)}:1, esperado ≥ 3:1`);
 });
});

if(failures.length){
 console.error(`falhas visuais do chat solto:\n${failures.join('\n')}`);
 assert.deepEqual(failures,[]);
}
console.log('PASS: achados visuais do chat solto (vão, composer, contraste, foco, bolha, quiz, Enviar)');
