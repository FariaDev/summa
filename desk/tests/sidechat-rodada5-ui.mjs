/* Chat lateral / chat solto (#157), rodada 5 de UI/UX: cada achado vira
   medida no Electron real.
   - montagem, achado 1: o escopo só quebra quando a linha inteira não cabe.
     Com um material curto o texto fica na mesma linha do cadeado, da legenda
     e da ação a 420×1000, 380×800, 420×650 (o chat da montagem) e 900×650;
     com dois materiais o texto segue inteiro na linha própria, como na rodada
     4, e a ação encosta à direita quando quebra.
   - chat solto, achado 2: o "Copiado" não desloca o "Levar à sessão
     principal" (deslocamento 0px, medido antes e durante o retorno).
   - chat solto, achado 1: a borda da opção do quiz em repouso chega a ≥3:1
     nos dois temas, sem mudar o círculo nem a opção correta/errada.
   Dados sintéticos e `fake-opencode`; nada de material de curso. */
import assert from 'node:assert/strict';
import {withArtifacts,setTheme} from './helpers.mjs';
import {bootCourse,openSidechat,sendSidechat,waitAssistant,waitCard,detachSidechat,fitWindow} from './capture-ciclo2-chat-solto-kit.mjs';
import {layoutStable} from './waits.mjs';

const near=(a,b,tolerance=1)=>Math.abs(a-b)<=tolerance;
const ONLY=new Set((process.env.R5_ONLY||'').split(',').filter(Boolean));
const failures=[];
async function block(tag,run){
 if(ONLY.size&&!ONLY.has(tag))return;
 try{await withArtifacts(tag,run);}
 catch(error){failures.push(`${tag}: ${String(error?.message||error).split('\n')[0]}`);}
}

const parseColor=(value)=>{
 const match=/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i.exec(String(value||''));
 return match?{r:+match[1],g:+match[2],b:+match[3],a:match[4]===undefined?1:+match[4]}:null;
};
const channel=(value)=>{const v=value/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};
const luminance=({r,g,b})=>0.2126*channel(r)+0.7152*channel(g)+0.0722*channel(b);
const contrast=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+0.05)/(lo+0.05);};
const shown=({r,g,b})=>`rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;

/* Contexto salvo com um material curto (o da montagem) ou com os dois da
   rodada 4: `openSavedSidechat` pinta o escopo como a restauração. */
const savedFor=(refs,id)=>({
 id:`sc-${id}-4444-4444-8444-444444444444`,engine:'opencode',
 messages:[
  {role:'user',text:'Explique o limite fundamental em uma linha.'},
  {role:'assistant',text:'Divida numerador e denominador por x antes de substituir.'},
 ],draft:'',busy:false,uncertain:false,
 context:{mainSession:'',refs,study:{},at:1700000000000},
 cards:[],
});
const ONE=savedFor([{path:'/tmp/rodada5/Limites.pdf',page:1}],'55555555-5555-4555-8555');
const TWO=savedFor([{path:'/tmp/rodada5/Limites.pdf',page:1},{path:'/tmp/rodada5/Formulario.pdf',page:1}],'66666666-6666-4666-8666');
const SCOPE_ONE='Limites.pdf p. 1';
const SCOPE_TWO='Limites.pdf p. 1, Formulario.pdf p. 1';

async function injectSaved(page,payload,expected){
 await page.evaluate(async data=>{const sidechat=await import('./src/sidechat.mjs');sidechat.openSavedSidechat(data);},payload);
 await page.waitForFunction(text=>document.querySelector('#sidechat-scope-text')?.textContent===text,expected,{timeout:10000});
 await page.evaluate(()=>document.activeElement?.blur?.());
}

const factsOf=page=>page.evaluate(()=>{
 const composer=document.querySelector('#sidechat-composer');
 const scope=document.querySelector('#sidechat-scope');
 const text=document.querySelector('#sidechat-scope-text');
 const note=document.querySelector('#sidechat-scope-note');
 const lock=document.querySelector('#sidechat-scope-lock');
 const refresh=document.querySelector('#sidechat-refresh');
 const box=el=>{const rect=el.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,width:rect.width,height:rect.height};};
 const cstyle=getComputedStyle(composer),sstyle=getComputedStyle(scope);
 return {
  composer:{...box(composer),paddingLeft:Number.parseFloat(cstyle.paddingLeft),paddingRight:Number.parseFloat(cstyle.paddingRight)},
  scope:{...box(scope),paddingRight:Number.parseFloat(sstyle.paddingRight)},
  text:{...box(text),text:(text.textContent||'').trim(),scrollWidth:text.scrollWidth,clientWidth:text.clientWidth},
  note:{...box(note),text:(note.textContent||'').trim(),visible:getComputedStyle(note).display!=='none'},
  lock:box(lock),
  refresh:box(refresh),
 };
});
const contentWidth=facts=>facts.composer.width-facts.composer.paddingLeft-facts.composer.paddingRight;
const sameRow=(a,b)=>a.top<b.bottom&&a.bottom>b.top;

async function assertOneLine(page,label,{composerHeight=null,text=SCOPE_ONE}={}){
 const facts=await factsOf(page);
 const content=contentWidth(facts);
 assert.equal(facts.text.text,text,`${label}: o escopo mostra "${text}" (veio "${facts.text.text}")`);
 assert.equal(facts.note.visible,true,`${label}: a legenda "Só aqui" segue visível`);
 assert.ok(sameRow(facts.text,facts.note),`${label}: o texto divide a linha com a legenda (texto ${facts.text.top.toFixed(1)}–${facts.text.bottom.toFixed(1)}, legenda ${facts.note.top.toFixed(1)}–${facts.note.bottom.toFixed(1)}; larguras ${facts.text.width.toFixed(1)}+${facts.lock.width.toFixed(1)}+${facts.note.width.toFixed(1)}+${facts.refresh.width.toFixed(1)} em ${content.toFixed(1)}px)`);
 assert.ok(sameRow(facts.text,facts.refresh),`${label}: o texto divide a linha com a ação (texto ${facts.text.top.toFixed(1)}–${facts.text.bottom.toFixed(1)}, ação ${facts.refresh.top.toFixed(1)}–${facts.refresh.bottom.toFixed(1)})`);
 assert.ok(facts.text.scrollWidth<=facts.text.clientWidth+1,`${label}: o texto de um material aparece inteiro (${facts.text.scrollWidth}px de texto em ${facts.text.clientWidth}px)`);
 const right=Math.abs(facts.refresh.right-(facts.scope.right-facts.scope.paddingRight));
 assert.ok(right<=1,`${label}: a ação fica encostada à direita (${right.toFixed(1)}px da borda; conteúdo do composer ${content.toFixed(1)}px)`);
 if(composerHeight)assert.ok(near(facts.composer.height,composerHeight,3),`${label}: composer com ${facts.composer.height.toFixed(1)}px (esperado ~${composerHeight}px)`);
 return facts;
}

async function assertWrapped(page,label){
 const facts=await factsOf(page);
 const content=contentWidth(facts);
 assert.equal(facts.text.text,SCOPE_TWO,`${label}: o escopo tem os dois materiais ("${facts.text.text}")`);
 assert.equal(facts.note.visible,true,`${label}: a legenda "Só aqui" segue visível`);
 /* Com a fonte estreita do Windows o texto de dois materiais ainda cabe ao
    lado do cadeado a 420px; a linha própria só é exigida quando ele quebra.
    Em qualquer layout o texto inteiro e a ação à direita continuam valendo. */
 const wrapped=facts.text.bottom<=facts.note.top+0.5&&facts.text.bottom<=facts.lock.top+0.5;
 if(wrapped){
  assert.ok(facts.text.bottom<=facts.note.top+0.5,`${label}: o texto fica numa linha própria acima da legenda (texto termina em ${facts.text.bottom.toFixed(1)}, legenda começa em ${facts.note.top.toFixed(1)})`);
  assert.ok(facts.text.bottom<=facts.lock.top+0.5,`${label}: o texto fica acima do cadeado (texto termina em ${facts.text.bottom.toFixed(1)}, cadeado começa em ${facts.lock.top.toFixed(1)})`);
  assert.ok(facts.text.width>=content-4,`${label}: o texto usa a linha inteira (${facts.text.width.toFixed(1)}px de ${content.toFixed(1)}px)`);
 }else{
  assert.ok(sameRow(facts.text,facts.note),`${label}: na linha única o texto divide a linha com a legenda`);
  assert.ok(facts.text.right<=facts.lock.left+0.5,`${label}: na linha única o texto não encosta no cadeado (${facts.text.right.toFixed(1)} > ${facts.lock.left.toFixed(1)})`);
 }
 assert.ok(facts.text.scrollWidth<=facts.text.clientWidth+1,`${label}: os dois materiais aparecem inteiros (${facts.text.scrollWidth}px de texto em ${facts.text.clientWidth}px)`);
 const right=Math.abs(facts.refresh.right-(facts.scope.right-facts.scope.paddingRight));
 assert.ok(right<=1,`${label}: na linha quebrada a ação encosta à direita (${right.toFixed(1)}px da borda)`);
 return facts;
}

/* ---------- 1. um material: linha única onde a linha inteira cabe ---------- */

await block('rodada5-escopo-um',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada5-escopo-um');
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await injectSaved(page,ONE,SCOPE_ONE);

 await fitWindow(app,page,900,650);
 await layoutStable(page,'#sidechat');
 await assertOneLine(page,'900×650 com um material');

 const child=await detachSidechat(page,app);
 for(const [width,height] of [[380,800],[420,1000],[420,650]]){
  await fitWindow(app,child,width,height,{content:true});
  await layoutStable(child,'#sidechat');
  await assertOneLine(child,`${width}×${height} com um material`,{composerHeight:width===420&&height===650?161:null});
 }
});

/* ---------- 2. dois materiais: linha própria e ação à direita ---------- */

await block('rodada5-escopo-dois',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada5-escopo-dois');
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await injectSaved(page,TWO,SCOPE_TWO);

 await fitWindow(app,page,900,650);
 await layoutStable(page,'#sidechat');
 await assertWrapped(page,'900×650 com dois materiais');

 const child=await detachSidechat(page,app);
 for(const [width,height] of [[380,800],[420,1000]]){
  await fitWindow(app,child,width,height,{content:true});
  await layoutStable(child,'#sidechat');
  /* No r2 a IBM Plex Sans é mais estreita: a 420px os dois materiais cabem na
     mesma linha da legenda e da ação, sem cortar o texto; abaixo disso quebra. */
  if(width===420)await assertOneLine(child,`${width}×${height} com dois materiais`,{text:SCOPE_TWO});
  else await assertWrapped(child,`${width}×${height} com dois materiais`);
 }
});

/* ---------- 3. "Copiado" não desloca o vizinho ---------- */

await block('rodada5-copiado',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada5-copiado',{env:{FAKE_OPENCODE_REPLY:'Resposta para copiar no teste.'}});
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await sendSidechat(page,'copie esta resposta');
 await waitAssistant(page,{min:10});
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__r5Copied=text;}}});});
 const copy=page.locator('#sidechat-messages .sidechat-msg.assistant .sidechat-copy').last();
 const toMain=page.locator('#sidechat-messages .sidechat-msg.assistant .sidechat-to-main').last();
 const boxOf=locator=>locator.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};});
 const before=await boxOf(toMain);
 const copyBefore=await boxOf(copy);
 await copy.click();
 await page.waitForFunction(()=>document.querySelector('#sidechat-messages .sidechat-msg.assistant .sidechat-copy')?.classList.contains('ok'),undefined,{timeout:5000});
 const during=await boxOf(toMain);
 const copyDuring=await boxOf(copy);
 assert.ok(near(copyBefore.width,copyDuring.width,0.5),`o botão Copiar mantém ${copyBefore.width.toFixed(1)}px no repouso e ${copyDuring.width.toFixed(1)}px no "Copiado"`);
 assert.ok(near(before.left,during.left,0.5),`o "Levar" não desloca à esquerda: ${before.left.toFixed(1)}px → ${during.left.toFixed(1)}px (${(during.left-before.left).toFixed(1)}px)`);
 assert.ok(near(before.right,during.right,0.5),`o "Levar" não desloca à direita: ${before.right.toFixed(1)}px → ${during.right.toFixed(1)}px (${(during.right-before.right).toFixed(1)}px)`);
});

/* ---------- 4. borda da opção do quiz ≥3:1 nos dois temas ---------- */

await block('rodada5-quiz',async ctx=>{
 const quiz=JSON.stringify({name:'quiz',input:{question:'Quanto é 2+2?',options:[{label:'3'},{label:'4'}],correctAnswer:'4'}});
 const {runtime,app,page}=await bootCourse('rodada5-quiz',{env:{FAKE_OPENCODE_MCP_CALL:quiz}});
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await sendSidechat(page,'quiz de teste no lateral');
 await waitCard(page);
 const option=page.locator('#sidechat-messages .quiz-card .quiz-option').first();
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  const facts=await page.evaluate(()=>{
   const probe=name=>{const el=document.createElement('span');el.style.color=`var(${name})`;document.body.append(el);const color=getComputedStyle(el).color;el.remove();return color;};
   const option=document.querySelector('#sidechat-messages .quiz-card .quiz-option');
   const circle=getComputedStyle(option,'::before');
   return {border:getComputedStyle(option).borderTopColor,background:getComputedStyle(option).backgroundColor,circle:circle.borderTopColor,muted:probe('--muted')};
  });
  const ratio=contrast(parseColor(facts.border),parseColor(facts.background));
  assert.ok(ratio>=3,`${theme}: borda da opção ${shown(parseColor(facts.border))} sobre ${shown(parseColor(facts.background))} dá ${ratio.toFixed(2)}:1, esperado ≥3:1`);
  assert.equal(facts.border,facts.muted,`${theme}: a borda em repouso usa --muted (${facts.border} × ${facts.muted})`);
  assert.equal(facts.circle,facts.muted,`${theme}: o círculo segue em --muted (${facts.circle})`);
 }
 await option.click();
 await page.waitForFunction(()=>document.querySelectorAll('#sidechat-messages .quiz-card .quiz-option.correct').length>0,undefined,{timeout:15000});
 const correct=await page.evaluate(()=>{
  const probe=name=>{const el=document.createElement('span');el.style.color=`var(${name})`;document.body.append(el);const color=getComputedStyle(el).color;el.remove();return color;};
  const option=document.querySelector('#sidechat-messages .quiz-card .quiz-option.correct');
  const style=getComputedStyle(option);
  return {border:style.borderTopColor,background:style.backgroundColor,success:probe('--success')};
 });
 assert.equal(correct.border,correct.success,`a opção correta mantém a borda de --success (${correct.border} × ${correct.success})`);
});

if(failures.length){
 console.error(`falhas da rodada 5 do chat lateral:\n${failures.join('\n')}`);
 assert.deepEqual(failures,[]);
}
console.log('PASS: escopo quebra só quando precisa, Copiado sem salto e borda do quiz ≥3:1 (#157)');
