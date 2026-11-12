/* Chat lateral / chat solto (#157), rodada 4 de UI/UX: o texto do escopo ganha
   linha própria em coluna estreita.
   - 3 da nota do chat solto e 1 da nota da montagem: com dois materiais o
     escopo cortava em 140,5 px (420), 100,5 px (380) e 84,2 px (900×650).
     Abaixo de ~480 px do composer o texto ocupa a linha inteira, acima da
     legenda e das ações; a 1440×900 a linha única fica.
   - O campo segue fixo em 3 linhas (86 px), o Enviar no pé, o cadeado ≥24×24
     com nome acessível e o title do escopo guarda o texto completo.
   Dados sintéticos: dois PDFs no curso e o contexto salvo com os dois
   materiais; nada de material de curso. */
import assert from 'node:assert/strict';
import {withArtifacts} from './helpers.mjs';
import {bootCourse,openSidechat,detachSidechat,fitWindow} from './capture-ciclo2-chat-solto-kit.mjs';
import {layoutStable} from './waits.mjs';

const near=(a,b,tolerance=1)=>Math.abs(a-b)<=tolerance;
const sameRow=(a,b)=>a.top<b.bottom&&a.bottom>b.top;

/* Contexto salvo com os dois materiais da fixture (Limites e Formulario): o
   caso do achado. `openSavedSidechat` pinta o escopo como a restauração. */
const SAVED={id:'sc-44444444-4444-4444-8444-444444444444',engine:'opencode',
 messages:[
  {role:'user',text:'Explique o limite fundamental em uma linha.'},
  {role:'assistant',text:'Divida numerador e denominador por x antes de substituir.'},
 ],draft:'',busy:false,uncertain:false,
 context:{mainSession:'',refs:[{path:'/tmp/rodada4/Limites.pdf',page:1},{path:'/tmp/rodada4/Formulario.pdf',page:1}],study:{},at:1700000000000},
 cards:[]};
const SCOPE='Limites.pdf p. 1, Formulario.pdf p. 1';

async function injectSaved(page,target){
 await page.evaluate(async payload=>{const sidechat=await import('./src/sidechat.mjs');sidechat.openSavedSidechat(payload);},SAVED);
 await target.waitForFunction(expected=>document.querySelector('#sidechat-scope-text')?.textContent===expected,SCOPE,{timeout:10000});
 await target.evaluate(()=>document.activeElement?.blur?.());
}

const factsOf=page=>page.evaluate(()=>{
 const composer=document.querySelector('#sidechat-composer');
 const scope=document.querySelector('#sidechat-scope');
 const text=document.querySelector('#sidechat-scope-text');
 const note=document.querySelector('#sidechat-scope-note');
 const lock=document.querySelector('#sidechat-scope-lock');
 const refresh=document.querySelector('#sidechat-refresh');
 const prompt=document.querySelector('#sidechat-prompt');
 const send=document.querySelector('#sidechat-send');
 const box=el=>{const rect=el.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,width:rect.width,height:rect.height};};
 const cstyle=getComputedStyle(composer),pstyle=getComputedStyle(prompt);
 return {
  composer:{...box(composer),paddingLeft:Number.parseFloat(cstyle.paddingLeft),paddingRight:Number.parseFloat(cstyle.paddingRight),paddingBottom:Number.parseFloat(cstyle.paddingBottom)},
  scope:box(scope),
  text:{...box(text),text:(text.textContent||'').trim(),title:text.title,scrollWidth:text.scrollWidth,clientWidth:text.clientWidth},
  note:{...box(note),text:(note.textContent||'').trim(),visible:getComputedStyle(note).display!=='none'},
  lock:{...box(lock),label:lock.getAttribute('aria-label')||'',title:lock.title},
  refresh:{...box(refresh),label:refresh.getAttribute('aria-label')||'',title:refresh.title,spanVisible:getComputedStyle(refresh.querySelector('span')).display!=='none'},
  field:{...box(prompt),lineHeight:Number.parseFloat(pstyle.lineHeight),paddingTop:Number.parseFloat(pstyle.paddingTop),paddingBottom:Number.parseFloat(pstyle.paddingBottom)},
  send:box(send),
 };
});

const contentWidth=facts=>facts.composer.width-facts.composer.paddingLeft-facts.composer.paddingRight;

await withArtifacts('rodada4-escopo',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada4-escopo');
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await injectSaved(page,page);

 /* 1440×900 no chat preso: a linha única de hoje continua. */
 await fitWindow(app,page,1440,900);
 await layoutStable(page,'#sidechat');
 const wide=await factsOf(page);
 const wideContent=contentWidth(wide);
 assert.ok(wideContent>480,`1440×900: o composer preso tem ${wide.composer.width.toFixed(1)}px de largura (conteúdo ${wideContent.toFixed(1)}px); a linha única vale acima de 480px`);
 assert.ok(wide.text.bottom>wide.note.top&&wide.text.top<wide.note.bottom,`1440×900: o escopo e a legenda seguem na mesma linha (texto ${wide.text.top.toFixed(1)}–${wide.text.bottom.toFixed(1)}, legenda ${wide.note.top.toFixed(1)}–${wide.note.bottom.toFixed(1)})`);
 assert.ok(near(wide.scope.height,24,1),`1440×900: a linha de escopo mede ${wide.scope.height.toFixed(1)}px (esperado 24px)`);
 assert.ok(wide.text.scrollWidth<=wide.text.clientWidth+1,`1440×900: o escopo cabe inteiro (${wide.text.scrollWidth}px de texto em ${wide.text.clientWidth}px)`);
 assert.equal(wide.text.title,SCOPE,`1440×900: o title guarda o texto completo (veio "${wide.text.title}")`);

 /* 900×650 no chat preso: o caso de 84,2 px da nota; o escopo passa a ter a
    linha inteira e a legenda/ícones descem para a segunda linha. */
 await fitWindow(app,page,900,650);
 await layoutStable(page,'#sidechat');
 const docked=await factsOf(page);
 const dockedContent=contentWidth(docked);
 assert.ok(dockedContent<480,`900×650: o composer preso tem ${docked.composer.width.toFixed(1)}px de largura (conteúdo ${dockedContent.toFixed(1)}px); a coluna estreita vale abaixo de 480px`);
 assert.ok(docked.text.width>=dockedContent-4,`900×650: o escopo mede ${docked.text.width.toFixed(1)}px; a linha inteira do composer tem ${dockedContent.toFixed(1)}px (esperado ≥ ${(dockedContent-4).toFixed(1)})`);
 assert.ok(docked.text.bottom<=docked.note.top+0.5,`900×650: o escopo fica acima da legenda (texto termina em ${docked.text.bottom.toFixed(1)}, legenda começa em ${docked.note.top.toFixed(1)})`);
 assert.equal(docked.note.visible,true,`900×650: a legenda "Só aqui" segue visível (veio "${docked.note.text}")`);
 assert.equal(docked.refresh.spanVisible,false,'900×650: o "Atualizar contexto" segue só o ícone');
 assert.ok(near(docked.field.height,86,1),`900×650: campo com ${docked.field.height.toFixed(1)}px (esperado 86px ±1)`);

 /* Janela solta a 380×800 e 420×1000: o texto usa a linha toda, acima da
    legenda; o campo não muda e o Enviar fica no pé. */
 const child=await detachSidechat(page,app);
 for(const [width,height] of [[380,800],[420,1000]]){
  const size=await fitWindow(app,child,width,height,{content:true});
  await layoutStable(child,'#sidechat');
  const facts=await factsOf(child);
  const content=contentWidth(facts);
  const label=`${width}×${height}`;
  assert.ok(content<480,`${label}: o composer solto tem ${facts.composer.width.toFixed(1)}px de largura (conteúdo ${content.toFixed(1)}px); a coluna estreita vale abaixo de 480px`);
  /* A 420px o escopo cabe ao lado do cadeado: no r2 a IBM Plex Sans é mais
     estreita que a fonte do sistema, e no Windows a fonte do sistema também é
     estreita o bastante. Aí a linha única é o certo; o que não pode é cortar
     (`scrollWidth`) nem encostar no cadeado (#165). */
  const wrapped=facts.text.bottom<=facts.note.top+0.5&&facts.text.bottom<=facts.lock.top+0.5;
  if(wrapped){
   assert.ok(facts.text.width>=content-4,`${label}: o escopo mede ${facts.text.width.toFixed(1)}px; a linha inteira do composer tem ${content.toFixed(1)}px (esperado ≥ ${(content-4).toFixed(1)})`);
   assert.ok(facts.text.bottom<=facts.note.top+0.5,`${label}: o escopo fica numa linha acima da legenda (texto termina em ${facts.text.bottom.toFixed(1)}, legenda começa em ${facts.note.top.toFixed(1)})`);
   assert.ok(facts.text.bottom<=facts.lock.top+0.5,`${label}: o escopo fica acima do cadeado (texto termina em ${facts.text.bottom.toFixed(1)}, cadeado começa em ${facts.lock.top.toFixed(1)})`);
  }else{
   assert.ok(sameRow(facts.text,facts.note),`${label}: na linha única o escopo divide a linha com a legenda`);
   assert.ok(facts.text.right<=facts.lock.left+0.5,`${label}: na linha única o escopo não encosta no cadeado (${facts.text.right.toFixed(1)} > ${facts.lock.left.toFixed(1)})`);
  }
  assert.equal(facts.note.visible,true,`${label}: a legenda "Só aqui" segue visível (veio "${facts.note.text}")`);
  assert.ok(near(facts.field.height,86,1),`${label}: campo com ${facts.field.height.toFixed(1)}px (esperado 86px ±1 = 3 linhas de ${facts.field.lineHeight}px + respiro)`);
  assert.ok(near(facts.composer.bottom-facts.composer.paddingBottom,facts.send.bottom,1),`${label}: o Enviar fecha o composer no pé (${facts.send.bottom.toFixed(1)}px; pé em ${(facts.composer.bottom-facts.composer.paddingBottom).toFixed(1)}px)`);
  assert.ok(facts.lock.width>=24&&facts.lock.height>=24,`${label}: o cadeado mede ${facts.lock.width.toFixed(1)}×${facts.lock.height.toFixed(1)}px (esperado ≥24×24)`);
  assert.equal(facts.lock.label,'Fora da sessão principal',`${label}: o nome acessível do cadeado (veio "${facts.lock.label}")`);
  assert.equal(facts.lock.title,'Fora da sessão principal',`${label}: o title do cadeado (veio "${facts.lock.title}")`);
  assert.equal(facts.text.title,SCOPE,`${label}: o title do escopo guarda o texto completo (veio "${facts.text.title}")`);
  assert.ok(facts.text.scrollWidth<=facts.text.clientWidth+1,`${label}: o escopo cabe inteiro (${facts.text.scrollWidth}px de texto em ${facts.text.clientWidth}px)`);
  assert.ok(Math.abs(size.actual.innerWidth-width)<=2,`${label}: a janela mede ${size.actual.innerWidth}px de largura`);
 }
});

console.log('PASS: escopo em linha própria em coluna estreita, linha única a 1440, campo de 3 linhas e cadeado (#157)');
