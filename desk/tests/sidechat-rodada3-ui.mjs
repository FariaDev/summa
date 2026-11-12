/* Chat lateral / chat solto (#157), rodada 3 de UI/UX: cada achado vira
   medida no Electron real, nos dois temas quando a cor importa.
   - 1: o foco da faixa "Chat em outra janela" pinta 2px por dentro do alvo
     (o anel global caía atrás dos vizinhos posicionados);
   - 2: o círculo de escolha do quiz em repouso chega a ≥3:1 nos dois temas;
   - 3: a legenda "Só aqui" só some abaixo de ~200px; em 380, 420 e
     900×650 a prioridade é o rótulo do "Atualizar contexto";
   - 4: o campo do chat preso mede as mesmas 3 linhas da janela solta;
   - 5: as ações de mensagem ficam numa linha (≤28px) em 900×650, com o
     rótulo curto "Levar à sessão" / "To main session";
   - 6: a falha do motor veste a voz "Aviso" e "Tentar de novo" devolve a
     última pergunta ao campo, com o Enviar ligado e sem reenviar sozinho;
   - 7: o vazio serve às duas formas ("Pergunte sem mexer…").
   Dados sintéticos e `fake-opencode`; nada de material de curso. */
import assert from 'node:assert/strict';
import {withArtifacts,setTheme} from './helpers.mjs';
import {bootCourse,openSidechat,sendSidechat,waitAssistant,waitCard,detachSidechat,fitWindow} from './capture-ciclo2-chat-solto-kit.mjs';
import {layoutStable,nextFrames} from './waits.mjs';
import {decodePng,pixelAt} from './png-pixels.mjs';

const ONLY=new Set((process.env.R3_ONLY||'').split(',').filter(Boolean));
const block=async(tag,run)=>{if(ONLY.size&&!ONLY.has(tag))return;await withArtifacts(tag,run);};

const parseColor=(value)=>{
 const match=/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i.exec(String(value||''));
 return match?{r:+match[1],g:+match[2],b:+match[3],a:match[4]===undefined?1:+match[4]}:null;
};
const channel=(value)=>{const v=value/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};
const luminance=({r,g,b})=>0.2126*channel(r)+0.7152*channel(g)+0.0722*channel(b);
const contrast=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+0.05)/(lo+0.05);};
const shown=({r,g,b})=>`rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
const near=(a,b,tolerance=1)=>Math.abs(a-b)<=tolerance;

async function setLanguage(page,language){
 await page.evaluate(async value=>{const text=await import('./src/ui-text.mjs');text.setUiLanguage(value);},language);
 await nextFrames(page,2);
}

/* ---------- 1. foco da faixa "Chat em outra janela" ---------- */

await block('rodada3-faixa',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada3-faixa');
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await detachSidechat(page,app);
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await page.evaluate(()=>document.activeElement?.blur?.());
  await page.locator('#support-restore').focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const facts=await page.evaluate(()=>{
   const el=document.querySelector('#support-restore');
   const style=getComputedStyle(el),box=el.getBoundingClientRect();
   return {
    id:document.activeElement?.id||'',focusVisible:el.matches(':focus-visible'),
    outlineStyle:style.outlineStyle,outlineWidth:Number.parseFloat(style.outlineWidth)||0,
    outlineOffset:Number.parseFloat(style.outlineOffset),outlineColor:style.outlineColor,
    box:{x:box.x,y:box.y,width:box.width,height:box.height},
   };
  });
  assert.equal(facts.id,'support-restore',`${theme}: o foco chega à faixa (foi para "${facts.id}")`);
  assert.equal(facts.focusVisible,true,`${theme}: a faixa recebe :focus-visible`);
  assert.equal(facts.outlineStyle,'solid',`${theme}: a faixa tem anel de foco (${facts.outlineStyle})`);
  assert.ok(facts.outlineWidth>=2,`${theme}: anel de ${facts.outlineWidth}px; esperado ≥2px`);
  assert.ok(facts.outlineOffset<=-2,`${theme}: o anel é desenhado por dentro (outline-offset ${facts.outlineOffset}px)`);
  const clip={x:Math.max(0,Math.floor(facts.box.x)),y:Math.max(0,Math.floor(facts.box.y)),width:Math.max(1,Math.round(facts.box.width)),height:Math.max(1,Math.round(facts.box.height))};
  const png=decodePng((await page.screenshot({clip})).toString('base64'));
  const ring=parseColor(facts.outlineColor);
  assert.ok(ring,`${theme}: cor do anel legível (${facts.outlineColor})`);
  const distance=(pixel)=>Math.max(Math.abs(pixel.r-ring.r),Math.abs(pixel.g-ring.g),Math.abs(pixel.b-ring.b));
  const scale=png.width/clip.width;
  let count=0,left=0,right=0,minX=Infinity,maxX=-Infinity;
  for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){
   if(distance(pixelAt(png,x,y))>40)continue;
   const cssX=x/scale;
   count++;
   minX=Math.min(minX,cssX);
   maxX=Math.max(maxX,cssX);
   if(cssX<=3)left++;
   if(cssX>=clip.width-3)right++;
  }
  assert.ok(count>=clip.height,`${theme}: o anel aparece na captura (${count} px de anel; esperado ≥ ${clip.height})`);
  assert.ok(left>0&&right>0,`${theme}: o anel pinta dos dois lados por dentro (esquerda ${left}px, direita ${right}px)`);
  assert.ok(minX>=0&&maxX<=clip.width-0.5,`${theme}: nenhum pixel do anel escapa do alvo (${minX.toFixed(1)}…${maxX.toFixed(1)} de ${clip.width}px)`);
 }
});

/* ---------- 2. círculo de escolha do quiz em repouso ---------- */

const QUIZ=JSON.stringify({name:'quiz',input:{question:'Quanto é 2+2?',options:[{label:'3'},{label:'4'}],correctAnswer:'4'}});

await block('rodada3-quiz',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada3-quiz',{env:{FAKE_OPENCODE_MCP_CALL:QUIZ}});
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await sendSidechat(page,'quiz no lateral');
 await waitCard(page);
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  const facts=await page.evaluate(()=>{
   const option=document.querySelector('#sidechat-messages .quiz-card .quiz-option');
   const before=getComputedStyle(option,'::before');
   return {border:before.borderTopColor,background:getComputedStyle(option).backgroundColor,width:Number.parseFloat(before.width)||0,height:Number.parseFloat(before.height)||0};
  });
  const ratio=contrast(parseColor(facts.border),parseColor(facts.background));
  assert.ok(facts.width>=14,`${theme}: círculo de ${facts.width}px (esperado ≥14px)`);
  assert.ok(ratio>=3,`${theme}: círculo ${shown(parseColor(facts.border))} sobre ${shown(parseColor(facts.background))} dá ${ratio.toFixed(2)}:1, esperado ≥3:1`);
 }
});

/* ---------- 3, 4 e 7. escopo, composer de 3 linhas e vazio ---------- */

async function emptyText(page){
 return page.evaluate(()=>{
  const el=document.querySelector('#sidechat-messages .sidechat-empty');
  return el?{visible:getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().width>0,text:(el.textContent||'').trim()}:null;
 });
}
async function scopeAndPrompt(page){
 return page.evaluate(()=>{
  const note=document.querySelector('#sidechat-scope-note');
  const span=document.querySelector('#sidechat-refresh span');
  const prompt=document.querySelector('#sidechat-prompt');
  const style=getComputedStyle(prompt);
  const noteBox=note?.getBoundingClientRect(),spanBox=span?.getBoundingClientRect(),box=prompt.getBoundingClientRect();
  return {
   noteVisible:!!note&&getComputedStyle(note).display!=='none'&&noteBox.width>0&&noteBox.height>0,
   noteText:(note?.textContent||'').trim(),
   refreshSpanVisible:!!span&&getComputedStyle(span).display!=='none'&&spanBox.width>0&&spanBox.height>0,
   refreshText:(span?.textContent||'').trim(),
   fieldHeight:box.height,lineHeight:Number.parseFloat(style.lineHeight),
   paddingTop:Number.parseFloat(style.paddingTop),paddingBottom:Number.parseFloat(style.paddingBottom),
  };
 });
}

await block('rodada3-escopo-composer',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada3-escopo-composer');
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 const emptyPt=await emptyText(page);
 assert.ok(emptyPt?.visible,'o vazio fica visível na janela do chat');
 assert.equal(emptyPt.text,'Pergunte sem mexer na sessão principal.','o vazio em pt-BR é neutro para as duas formas');
 await setLanguage(page,'en');
 const emptyEn=await emptyText(page);
 assert.ok(emptyEn?.visible,'o vazio fica visível em inglês');
 assert.equal(emptyEn.text,'Ask without touching the main session.','o vazio em inglês é neutro para as duas formas');
 await setLanguage(page,'pt-BR');

 await sendSidechat(page,'pergunta no lateral');
 await waitAssistant(page);
 await fitWindow(app,page,900,650);
 await layoutStable(page,'#sidechat');
 const docked=await scopeAndPrompt(page);
 assert.equal(docked.noteVisible,true,`900×650: a legenda "Só aqui" fica visível (veio "${docked.noteText}")`);
 assert.equal(docked.refreshSpanVisible,false,'900×650: o "Atualizar contexto" vira ícone antes de a legenda sumir');
 const expected=docked.lineHeight*3+docked.paddingTop+docked.paddingBottom;
 assert.ok(near(docked.fieldHeight,expected,1),`900×650: campo preso com ${docked.fieldHeight.toFixed(1)}px; 3 linhas de ${docked.lineHeight}px + respiro = ${expected.toFixed(1)}px`);

 const child=await detachSidechat(page,app);
 for(const [width,height] of [[380,800],[420,1000]]){
  const size=await fitWindow(app,child,width,height);
  await layoutStable(child,'#sidechat');
  const facts=await scopeAndPrompt(child);
  assert.equal(facts.noteVisible,true,`${width}×${height}: a legenda "Só aqui" fica visível (veio "${facts.noteText}")`);
  assert.equal(facts.refreshSpanVisible,true,`${width}×${height}: o "Atualizar contexto" mantém o rótulo (veio "${facts.refreshText}")`);
  assert.ok(near(facts.fieldHeight,docked.fieldHeight,1),`${width}×${height}: campo solto com ${facts.fieldHeight.toFixed(1)}px × ${docked.fieldHeight.toFixed(1)}px do preso (esperado ±1px)`);
  assert.ok(near(facts.fieldHeight,expected,1),`${width}×${height}: campo solto com ${facts.fieldHeight.toFixed(1)}px; 3 linhas + respiro = ${expected.toFixed(1)}px`);
  assert.ok(Math.abs(size.actual.innerWidth-width)<=2,`${width}×${height}: a janela mede ${size.actual.innerWidth}px de largura`);
 }
});

/* ---------- 5. ações de mensagem em 900×650, pt e en ---------- */

const actionFacts=(page)=>page.evaluate(()=>{
 const row=document.querySelector('#sidechat-messages .sidechat-msg.assistant .sidechat-msg-actions');
 const buttons=[...row.querySelectorAll('button')];
 const toMain=row.querySelector('.sidechat-to-main');
 const span=(selector)=>toMain?.querySelector(selector);
 return {
  rowHeight:row.getBoundingClientRect().height,
  buttons:buttons.map(button=>({
   text:(button.innerText||'').trim(),height:button.getBoundingClientRect().height,
   whiteSpace:getComputedStyle(button).whiteSpace,
  })),
  full:{display:span('.label-full')?getComputedStyle(span('.label-full')).display:'',text:(span('.label-full')?.textContent||'').trim()},
  after:toMain?getComputedStyle(toMain,'::after').content:'',
  title:toMain?.getAttribute('title')||'',
  name:toMain?.getAttribute('aria-label')||'',
 };
});

 await block('rodada3-acoes',async ctx=>{
 /* O cartão do quiz deixa a conversa mais alta que a coluna em 900×650: a
    barra de rolagem tira ~15px da largura e é aí que as ações quebravam. */
 const {runtime,app,page}=await bootCourse('rodada3-acoes',{env:{FAKE_OPENCODE_MCP_CALL:QUIZ,FAKE_OPENCODE_REPLY:'A ideia central é dividir numerador e denominador por x antes de substituir.'}});
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await sendSidechat(page,'quiz de teste no lateral');
 await waitCard(page);
 await waitAssistant(page);

 await fitWindow(app,page,1280,768);
 await layoutStable(page,'#sidechat');
 const wide=await actionFacts(page);
 assert.notEqual(wide.full.display,'none',`1280: o rótulo completo fica visível (${wide.full.display})`);
 assert.equal(wide.after,'none',`1280: o rótulo curto fica fora da vista (${wide.after})`);
 assert.ok(wide.buttons.some(button=>button.text==='Levar à sessão principal'),`1280: rótulo completo na ação (tem: ${wide.buttons.map(button=>button.text).join(' | ')})`);

 await fitWindow(app,page,900,650);
 await layoutStable(page,'#sidechat');
 const pt=await actionFacts(page);
 assert.ok(pt.rowHeight<=28,`900×650 pt: linha de ações com ${pt.rowHeight.toFixed(1)}px; esperado ≤28px`);
 for(const button of pt.buttons){
  assert.ok(button.height<=28,`900×650 pt: botão "${button.text}" com ${button.height.toFixed(1)}px; esperado ≤28px`);
  assert.equal(button.whiteSpace,'nowrap',`900×650 pt: botão "${button.text}" não quebra em duas linhas`);
 }
 assert.equal(pt.full.display,'none','900×650 pt: o rótulo completo sai da vista');
 assert.ok(pt.after.includes('Levar à sessão'),`900×650 pt: o rótulo curto entra (veio ${pt.after})`);
 assert.equal(pt.title,'Insere esta resposta no rascunho da sessão principal, sem enviar','900×650 pt: o title guarda a dica completa');
 assert.equal(pt.name,'Levar à sessão principal','900×650 pt: o nome acessível segue completo');

 await setLanguage(page,'en');
 const en=await actionFacts(page);
 assert.ok(en.rowHeight<=28,`900×650 en: linha de ações com ${en.rowHeight.toFixed(1)}px; esperado ≤28px`);
 for(const button of en.buttons)assert.ok(button.height<=28,`900×650 en: botão "${button.text}" com ${button.height.toFixed(1)}px; esperado ≤28px`);
 assert.ok(en.after.includes('To main session'),`900×650 en: rótulo curto na ação (veio ${en.after})`);
});

/* ---------- 6. voz de aviso e "Tentar de novo" no erro ---------- */

await block('rodada3-erro',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada3-erro',{env:{FAKE_OPENCODE_FAIL:'network'}});
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 const question='provoca a falha do motor';
 await sendSidechat(page,question);
 await page.waitForFunction(()=>{
  const text=document.querySelector('#sidechat-messages')?.textContent||'';
  return /Erro do chat lateral|Side chat error|fetch failed/i.test(text)&&document.querySelector('#sidechat-stop')?.hidden!==false;
 },undefined,{timeout:30000});
 const before=await page.evaluate(()=>{
  const error=document.querySelector('#sidechat-messages .sidechat-error');
  return {
   voice:(error?.querySelector('.sidechat-role')?.textContent||'').trim(),
   retry:(error?.querySelector('.sidechat-retry')?.textContent||'').trim(),
   copyLabel:error?.querySelector('.sidechat-copy')?.getAttribute('aria-label')||'',
   users:document.querySelectorAll('#sidechat-messages .sidechat-msg.user').length,
   errors:document.querySelectorAll('#sidechat-messages .sidechat-error').length,
   prompt:document.querySelector('#sidechat-prompt')?.value||'',
   sendDisabled:!!document.querySelector('#sidechat-send')?.disabled,
  };
 });
 assert.equal(before.voice,'Aviso',`a falha veste a voz de aviso do sistema (veio "${before.voice}")`);
 assert.equal(before.retry,'Tentar de novo',`a falha oferece "Tentar de novo" (veio "${before.retry}")`);
 assert.equal(before.copyLabel,'Copiar aviso',`o Copiar da falha é nomeado como aviso (veio "${before.copyLabel}")`);
 assert.equal(before.prompt,'','o campo nasce vazio depois da falha');
 assert.equal(before.sendDisabled,true,'com o campo vazio o Enviar segue desligado');

 await page.locator('#sidechat-messages .sidechat-error .sidechat-retry').click();
 const after=await page.evaluate(()=>({
  prompt:document.querySelector('#sidechat-prompt')?.value||'',
  sendDisabled:!!document.querySelector('#sidechat-send')?.disabled,
  active:document.activeElement?.id||'',
  users:document.querySelectorAll('#sidechat-messages .sidechat-msg.user').length,
  errors:document.querySelectorAll('#sidechat-messages .sidechat-error').length,
  busy:document.querySelector('#sidechat-stop')?.hidden===false,
 }));
 assert.equal(after.prompt,question,`"Tentar de novo" devolve a última pergunta ao campo (veio "${after.prompt}")`);
 assert.equal(after.sendDisabled,false,'com o texto de volta o Enviar liga');
 assert.equal(after.active,'sidechat-prompt',`"Tentar de novo" foca o campo (foco em "${after.active}")`);
 assert.equal(after.users,before.users,'"Tentar de novo" não reenvia sozinho (nenhuma bolha nova)');
 assert.equal(after.errors,before.errors,'"Tentar de novo" não dispara outro turno (nenhuma falha nova)');
 assert.equal(after.busy,false,'"Tentar de novo" deixa o Enviar no controle da pessoa');
});

console.log('PASS: foco da faixa, quiz legível, escopo, composer de 3 linhas, ações, aviso com retry e vazio (#157)');
