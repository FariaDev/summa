/* Chat lateral (#157), conserto da rodada 2 de UI/UX: cada achado vira medida
   no Electron real.
   - 1: a linha de escopo mostra a legenda curta junto do cadeado ("Só neste
     chat"); abaixo de 300px do composer o "Atualizar contexto" vira ícone
     antes de a legenda sumir, e só abaixo de 200px a legenda some (o nome
     acessível do cadeado fica);
   - 2: com o rascunho vazio (ou só espaços) o Enviar fica desligado com o
     estilo de desligado da casa; digitar religa;
   - 3: o "Copiar" confirma no próprio botão e não abre o toast global.
   Dados sintéticos e `fake-opencode`; nada de material de curso. */
import assert from 'node:assert/strict';
import {withArtifacts} from './helpers.mjs';
import {bootCourse,openSidechat,sendSidechat,waitAssistant,detachSidechat,fitWindow} from './capture-ciclo2-chat-solto-kit.mjs';

const ONLY=new Set((process.env.R2B_ONLY||'').split(',').filter(Boolean));
const block=async(tag,run)=>{if(ONLY.size&&!ONLY.has(tag))return;await withArtifacts(tag,run);};

/* ---------- 1. legenda visível do escopo ---------- */

await block('lateral-rodada2b-escopo',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada2b-escopo');
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 const wide=await page.evaluate(()=>{
  const scope=document.querySelector('#sidechat-scope');
  const note=document.querySelector('#sidechat-scope-note');
  const lock=document.querySelector('#sidechat-scope-lock');
  const box=scope.getBoundingClientRect(),noteBox=note?.getBoundingClientRect(),lockBox=lock.getBoundingClientRect();
  return {
   composerWidth:document.querySelector('#sidechat-composer').getBoundingClientRect().width,
   text:(note?.textContent||'').trim(),
   noteVisible:!!note&&getComputedStyle(note).display!=='none'&&noteBox.width>0&&noteBox.height>0,
   inside:!!noteBox&&noteBox.left>=box.left-0.5&&noteBox.right<=box.right+0.5,
   sameRow:!!noteBox&&noteBox.top<lockBox.bottom&&noteBox.bottom>lockBox.top,
   lockVisible:lockBox.width>0&&lockBox.height>0,
   lockLabel:lock.getAttribute('aria-label')||'',
   lockTitle:lock.getAttribute('title')||'',
  };
 });
 assert.ok(wide.composerWidth>300,`a Mesa abre o composer com ${wide.composerWidth.toFixed(1)}px (esperado >300px)`);
 assert.equal(wide.text,'Só aqui',`a legenda do escopo em pt-BR (veio "${wide.text}")`);
 assert.equal(wide.noteVisible,true,'a legenda do escopo fica visível quando cabe');
 assert.equal(wide.inside,true,'a legenda fica dentro da linha de escopo');
 assert.equal(wide.sameRow,true,'a legenda fica na mesma linha do cadeado');
 assert.equal(wide.lockVisible,true,'o cadeado segue visível');
 assert.equal(wide.lockLabel,'Fora da sessão principal',`o nome acessível do cadeado (veio "${wide.lockLabel}")`);
 assert.equal(wide.lockTitle,'Fora da sessão principal',`o title do cadeado (veio "${wide.lockTitle}")`);

 const child=await detachSidechat(page,app);
 await fitWindow(app,child,280,800);
 const narrow=await child.evaluate(()=>{
  const note=document.querySelector('#sidechat-scope-note');
  const span=document.querySelector('#sidechat-refresh span');
  const lock=document.querySelector('#sidechat-scope-lock');
  const lockBox=lock.getBoundingClientRect();
  return {
   composerWidth:document.querySelector('#sidechat-composer').getBoundingClientRect().width,
   noteDisplay:note?getComputedStyle(note).display:'',
   refreshSpanDisplay:span?getComputedStyle(span).display:'',
   lockVisible:lockBox.width>0&&lockBox.height>0,
   lockLabel:lock.getAttribute('aria-label')||'',
  };
 });
 assert.ok(narrow.composerWidth<300,`o composer estreito tem ${narrow.composerWidth.toFixed(1)}px (esperado <300px)`);
 assert.notEqual(narrow.noteDisplay,'none','entre 200 e 300px a legenda segue visível');
 assert.equal(narrow.refreshSpanDisplay,'none','abaixo de 300px o "Atualizar contexto" vira ícone antes de a legenda sumir');
 assert.equal(narrow.lockVisible,true,'o cadeado continua visível na janela estreita');
 assert.equal(narrow.lockLabel,'Fora da sessão principal','o nome acessível do cadeado fica na janela estreita');

 /* A janela filha do host tem mínimo de 240px; a coluna de 180px simula uma
    largura menor para exercitar o corte da legenda abaixo de 200px. */
 const tight=await child.evaluate(()=>{
  const composer=document.querySelector('#sidechat-composer');
  composer.style.width='180px';
  const note=document.querySelector('#sidechat-scope-note');
  const lock=document.querySelector('#sidechat-scope-lock');
  const lockBox=lock.getBoundingClientRect();
  const facts={
   composerWidth:composer.getBoundingClientRect().width,
   noteDisplay:note?getComputedStyle(note).display:'',
   lockVisible:lockBox.width>0&&lockBox.height>0,
   lockLabel:lock.getAttribute('aria-label')||'',
  };
  composer.style.removeProperty('width');
  return facts;
 });
 assert.ok(tight.composerWidth<200,`o composer mínimo tem ${tight.composerWidth.toFixed(1)}px (esperado <200px)`);
 assert.equal(tight.noteDisplay,'none','abaixo de 200px a legenda some');
 assert.equal(tight.lockVisible,true,'o cadeado continua visível no limite mínimo');
 assert.equal(tight.lockLabel,'Fora da sessão principal','o nome acessível do cadeado fica no limite mínimo');
});

/* ---------- 2. Enviar desligado com o rascunho vazio ---------- */

await block('lateral-rodada2b-enviar',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada2b-enviar');
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 const facts=()=>page.evaluate(()=>{
  const button=document.querySelector('#sidechat-send');
  const probe=(name)=>{const el=document.createElement('span');el.style.color=`var(${name})`;document.body.append(el);const color=getComputedStyle(el).color;el.remove();return color;};
  const style=getComputedStyle(button);
  return {disabled:button.disabled,classes:button.className,opacity:style.opacity,background:style.backgroundColor,color:style.color,
   selected:probe('--selected'),muted:probe('--muted'),primary:probe('--primary')};
 });
 let now=await facts();
 assert.equal(now.disabled,true,'com o rascunho vazio o Enviar fica desligado');
 assert.equal(now.opacity,'1',`o Enviar desligado mantém opacidade cheia (${now.opacity})`);
 assert.equal(now.background,now.selected,`o Enviar desligado usa --selected (${now.background} × ${now.selected})`);
 assert.equal(now.color,now.muted,`o Enviar desligado usa --muted (${now.color} × ${now.muted})`);

 await page.locator('#sidechat-prompt').fill('   ');
 now=await facts();
 assert.equal(now.disabled,true,'só espaços conta como rascunho vazio');
 assert.equal(now.classes,'','só espaços não acende a seta');

 await page.locator('#sidechat-prompt').fill('pergunta no lateral');
 now=await facts();
 assert.equal(now.disabled,false,'com texto o Enviar liga');
 assert.ok(now.classes.includes('primary'),'com texto a seta acende');
 assert.equal(now.background,now.primary,`o Enviar ligado usa --primary (${now.background} × ${now.primary})`);

 await page.locator('#sidechat-prompt').fill('');
 now=await facts();
 assert.equal(now.disabled,true,'limpar o campo volta a desligar o Enviar');
});

/* ---------- 3. Copiar confirma no botão, sem toast global ---------- */

await block('lateral-rodada2b-copiar',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada2b-copiar',{env:{FAKE_OPENCODE_REPLY:'Resposta para copiar no teste.'}});
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await sendSidechat(page,'copie esta resposta');
 await waitAssistant(page,{min:10});
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__r2bCopied=text;}}});});
 const copy=page.locator('#sidechat-messages .sidechat-msg.assistant .sidechat-copy').last();
 const before=await copy.evaluate(el=>({label:el.getAttribute('aria-label')||''}));
 await copy.click();
 await page.waitForFunction(()=>document.querySelector('#sidechat-messages .sidechat-msg.assistant .sidechat-copy')?.classList.contains('ok'),undefined,{timeout:5000});
 // espera fixa: 200 ms é o prazo para um toast global indevido aparecer; a asserção é de ausência
 await page.waitForTimeout(200);
 const during=await page.evaluate(()=>{
  const button=document.querySelector('#sidechat-messages .sidechat-msg.assistant .sidechat-copy');
  const toast=document.querySelector('#toast');
  return {
   label:button?.getAttribute('aria-label')||'',
   text:(button?.textContent||'').trim(),
   check:button?.querySelectorAll('svg.motion-copied').length||0,
   copied:String(window.__r2bCopied||''),
   toastText:(toast?.textContent||'').replace(/\s+/g,' ').trim(),
   toastVisible:[...document.querySelectorAll('#toast .toast-item')].some(el=>!el.classList.contains('out')),
  };
 });
 assert.ok(during.copied.length>0,'o Copiar escreveu no clipboard');
 assert.equal(during.check,1,'a confirmação troca o ícone pelo check');
 assert.match(during.label,/copiado/i,`o aria-label confirma a cópia (veio "${during.label}")`);
 assert.match(during.text,/copiado/i,`o rótulo visível confirma a cópia (veio "${during.text}")`);
 assert.equal(/copiad/i.test(during.toastText),false,`o chat lateral não abre o toast de cópia (texto: "${during.toastText}")`);
 assert.equal(during.toastVisible,false,'nenhum toast global fica visível ao copiar');
 await page.waitForFunction(()=>!document.querySelector('#sidechat-messages .sidechat-msg.assistant .sidechat-copy')?.classList.contains('ok'),undefined,{timeout:5000});
 const after=await copy.evaluate(el=>({label:el.getAttribute('aria-label')||'',icon:el.querySelectorAll('svg.icon').length}));
 assert.equal(after.label,before.label,`o aria-label volta ao original (${before.label} × ${after.label})`);
 assert.ok(after.icon>=1,'o ícone de copiar volta');
});

console.log('PASS: legenda do escopo, Enviar desligado com o campo vazio e cópia sem toast (#157)');
