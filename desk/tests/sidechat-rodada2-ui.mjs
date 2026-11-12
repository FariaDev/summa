/* Chat lateral (#157), rodada 2 de UI/UX: cada achado vira medida no Electron
   real, nos dois temas quando a cor importa.
   - 1: a falha do motor vira UMA notícia por turno, com marca de erro, papel
     acessível e sem "Levar à sessão principal"; a fala do usuário fica;
   - 2: a opção do quiz tem marca de escolha (círculo 14–16px) que acende no
     hover/foco, alvo ≥24px e foco visível;
   - 3: o escopo fica numa linha com reticências na coluna estreita, sem órfão;
   - 4: em inglês a linha de ações do quiz cabe em ≤40px e "Not sure" não quebra;
   - 6: o cartão ao vivo mostra os três pontos e `aria-busy` antes do texto;
   - 7: o alfinete é ícone simples, sem chip, e não some no cabeçalho <300px;
   - 8: "Copiar" confirma no próprio botão (ícone de check + rótulo) e volta.
   Dados sintéticos e `fake-opencode`; nada de material de curso. */
import assert from 'node:assert/strict';
import {withArtifacts} from './helpers.mjs';
import {bootCourse,openSidechat,sendSidechat,waitAssistant,waitCard,detachSidechat,fitWindow} from './capture-ciclo2-chat-solto-kit.mjs';
import {pollUntil} from './waits.mjs';

const EN_QUIZ=JSON.stringify({name:'quiz',input:{question:'How much is 2+2?',options:[{label:'3'},{label:'4'}],correctAnswer:'4'}});
const ONLY=new Set((process.env.R2_ONLY||'').split(',').filter(Boolean));
const block=async(tag,run)=>{if(ONLY.size&&!ONLY.has(tag))return;await withArtifacts(tag,run);};

/* ---------- 1. UMA notícia de erro por turno ---------- */

await block('lateral-rodada2-erro',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada2-erro',{env:{FAKE_OPENCODE_FAIL:'network'}});
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await sendSidechat(page,'provoca a falha do motor');
 await page.waitForFunction(()=>{
  const text=document.querySelector('#sidechat-messages')?.textContent||'';
  return /Erro do chat lateral|Side chat error|fetch failed/i.test(text)&&document.querySelector('#sidechat-stop')?.hidden!==false;
 },undefined,{timeout:30000});
 /* O `finishTurn` chega junto do `message_end`; a espera curta prova que a
    segunda notícia não nasce depois. */
 // espera fixa: 400 ms é o prazo em que uma segunda notícia nasceria; a asserção é de ausência
 await page.waitForTimeout(400);
 const facts=await page.evaluate(()=>{
  const probe=document.createElement('span');
  probe.style.color='var(--danger-text)';
  document.body.append(probe);
  const danger=getComputedStyle(probe).color;
  probe.remove();
  const messages=[...document.querySelectorAll('#sidechat-messages .sidechat-msg')];
  const failures=messages.filter(el=>/Erro do chat lateral|A resposta do chat lateral falhou|Side chat error|Side chat response failed/i.test(el.textContent||'')).length;
  const error=messages.find(el=>el.classList.contains('sidechat-error'));
  const body=error?.querySelector('.sidechat-body');
  return {
   failures,
   errors:document.querySelectorAll('#sidechat-messages .sidechat-error').length,
   user:messages.filter(el=>el.classList.contains('user')).map(el=>(el.textContent||'').trim()),
   role:error?.getAttribute('role')||'',
   color:body?getComputedStyle(body).color:'',
   danger,
   icon:error?error.querySelectorAll('.icon').length:0,
   toMain:error?error.querySelectorAll('.sidechat-to-main').length:0,
   allToMain:document.querySelectorAll('#sidechat-messages .sidechat-to-main').length,
  };
 });
 assert.equal(facts.failures,1,`notícias de falha no turno: ${facts.failures} (esperado 1)`);
 assert.equal(facts.errors,1,`cartões com marca de erro: ${facts.errors} (esperado 1)`);
 assert.ok(facts.user.some(text=>text.includes('provoca a falha')),`a fala do usuário fica na conversa (viu: ${JSON.stringify(facts.user)})`);
 assert.equal(facts.role,'alert',`papel acessível do erro: "${facts.role}" (esperado "alert")`);
 assert.equal(facts.color,facts.danger,`cor do erro ${facts.color}; esperado --danger-text ${facts.danger}`);
 assert.ok(facts.icon>=1,`o erro tem ícone de alerta (ícones: ${facts.icon})`);
 assert.equal(facts.toMain,0,'o aviso de erro não oferece "Levar à sessão principal"');
 assert.equal(facts.allToMain,0,'nenhum "Levar à sessão principal" numa falha');
});

/* ---------- 2 e 4. opção do quiz com marca de escolha + inglês curto ---------- */

await block('lateral-rodada2-quiz',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada2-quiz',{env:{LEARNING_DESK_LOCALE:'en-US',FAKE_OPENCODE_MCP_CALL:EN_QUIZ}});
 ctx.runtime=runtime;ctx.app=app;
 await page.waitForFunction(()=>document.documentElement.lang==='en',undefined,{timeout:15000});
 await openSidechat(page);
 await page.locator('#sidechat-prompt').fill('quiz in English');
 await page.locator('#sidechat-prompt').press('Enter');
 await waitCard(page);
 await fitWindow(app,page,900,650);
 const option=page.locator('#sidechat-messages .quiz-card .quiz-option').first();

 const actions=await page.evaluate(()=>{
  const row=document.querySelector('#sidechat-messages .quiz-card .quiz-actions');
  const buttons=[...row.querySelectorAll('button')];
  return {height:row.getBoundingClientRect().height,
   buttons:buttons.map(el=>({text:(el.textContent||'').trim(),height:el.getBoundingClientRect().height,whiteSpace:getComputedStyle(el).whiteSpace}))};
 });
 assert.ok(actions.height<=40,`linha de ações em inglês com ${actions.height.toFixed(1)}px; esperado ≤40px`);
 for(const button of actions.buttons){
  assert.ok(button.height<=40,`botão "${button.text}" com ${button.height.toFixed(1)}px; esperado ≤40px`);
  assert.equal(button.whiteSpace,'nowrap',`botão "${button.text}" não quebra em duas linhas`);
 }
 assert.ok(actions.buttons.some(button=>button.text==='Not sure'),`rótulo curto em inglês (tem: ${actions.buttons.map(button=>button.text).join(' | ')})`);

 const mark=await option.evaluate(el=>{
  const probe=document.createElement('span');
  probe.style.border='1px solid var(--muted)';
  document.body.append(probe);
  const muted=getComputedStyle(probe).borderTopColor;
  probe.remove();
  const before=getComputedStyle(el,'::before');
  const box=el.getBoundingClientRect();
  const radius=Number.parseFloat(before.borderTopLeftRadius)||0;
  return {
   content:before.content,width:Number.parseFloat(before.width)||0,height:Number.parseFloat(before.height)||0,
   border:before.borderTopStyle,borderWidth:Number.parseFloat(before.borderTopWidth)||0,borderColor:before.borderTopColor,
   radius,muted,display:getComputedStyle(el).display,target:{width:box.width,height:box.height},
  };
 });
 assert.notEqual(mark.content,'none','a opção tem marca de escolha (::before)');
 assert.equal(mark.display,'flex','a opção alinha a marca e o texto em linha');
 assert.ok(mark.width>=14&&mark.width<=16,`marca de escolha com ${mark.width}px; esperado 14–16px`);
 assert.ok(mark.height>=14&&mark.height<=16,`marca de escolha com ${mark.height}px; esperado 14–16px`);
 assert.equal(mark.border,'solid',`a marca tem contorno (${mark.border})`);
 assert.ok(mark.borderWidth>=1,`contorno da marca com ${mark.borderWidth}px`);
 assert.equal(mark.borderColor,mark.muted,`a marca em repouso usa --muted (${mark.borderColor} × ${mark.muted})`);
 assert.ok(mark.radius>=mark.width/2-1,`a marca é um círculo (raio ${mark.radius}px para ${mark.width}px)`);
 assert.ok(mark.target.width>=24&&mark.target.height>=24,`alvo da opção ${mark.target.width.toFixed(1)}×${mark.target.height.toFixed(1)}; esperado ≥24×24`);

 await option.hover();
 const hover=await pollUntil(()=>option.evaluate(el=>{
  const mark=getComputedStyle(el,'::before');
  return {border:mark.borderTopColor,shadow:mark.boxShadow};
 }),value=>value.border!==mark.borderColor,{what:'o hover acender a marca de escolha'});
 assert.notEqual(hover.border,mark.borderColor,`o hover acende a marca (${mark.borderColor} → ${hover.border})`);

 await page.keyboard.press('Tab');
 await option.evaluate(el=>el.focus());
 const focus=await option.evaluate(el=>{
  const style=getComputedStyle(el),mark=getComputedStyle(el,'::before');
  return {visible:el.matches(':focus-visible'),outline:style.outlineStyle,width:Number.parseFloat(style.outlineWidth)||0,border:mark.borderTopColor,shadow:mark.boxShadow};
 });
 assert.equal(focus.visible,true,'a opção recebe :focus-visible');
 assert.notEqual(focus.outline,'none',`outline da opção: ${focus.outline}`);
 assert.ok(focus.width>=2,`anel de foco com ${focus.width}px; esperado ≥2px`);
 assert.ok(focus.border!==mark.borderColor||focus.shadow!==hover.shadow,`o foco também acende a marca (${mark.borderColor} → ${focus.border})`);

});

/* ---------- 3. escopo numa linha, sem órfão ---------- */

await block('lateral-rodada2-escopo',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada2-escopo',{env:{LEARNING_DESK_LOCALE:'en-US'}});
 ctx.runtime=runtime;ctx.app=app;
 await page.waitForFunction(()=>document.documentElement.lang==='en',undefined,{timeout:15000});
 await openSidechat(page);
 const child=await detachSidechat(page,app);
 await fitWindow(app,child,380,800);
 const facts=await child.evaluate(()=>{
  const el=document.querySelector('#sidechat-scope-text');
  const style=getComputedStyle(el);
  const range=document.createRange();
  range.selectNodeContents(el);
  const rects=[...range.getClientRects()].filter(rect=>rect.width>0);
  const lines=new Set(rects.map(rect=>rect.y.toFixed(1)));
  return {
   text:(el.textContent||'').trim(),title:el.title,
   whiteSpace:style.whiteSpace,textOverflow:style.textOverflow,
   height:el.getBoundingClientRect().height,lineHeight:Number.parseFloat(style.lineHeight)||0,
   lines:lines.size,lineWidths:[...lines].map(y=>+rects.find(rect=>rect.y.toFixed(1)===y).width.toFixed(1)),
  };
 });
 assert.ok(facts.text.length>0,'o escopo tem texto');
 assert.equal(facts.whiteSpace,'nowrap',`o escopo fica numa linha (white-space: ${facts.whiteSpace})`);
 assert.equal(facts.textOverflow,'ellipsis',`o escopo corta com reticências (text-overflow: ${facts.textOverflow})`);
 assert.equal(facts.lines,1,`linhas do escopo em 380px: ${facts.lines} (larguras ${facts.lineWidths.join(', ')})`);
 assert.ok(facts.height<=facts.lineHeight*1.5,`altura do escopo ${facts.height.toFixed(1)}px para linha de ${facts.lineHeight}px`);
 assert.ok(facts.title.includes(facts.text),`o title guarda o texto inteiro ("${facts.title}")`);
});

/* ---------- 6. carregando: pontos sob o papel OpenCode ---------- */

await block('lateral-rodada2-carregando',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada2-carregando',{env:{FAKE_OPENCODE_QUEUE_HOLD_MS:'60000',FAKE_OPENCODE_REPLY:'resposta segurada'}});
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await sendSidechat(page,'segure a resposta do tutor');
 await page.waitForFunction(()=>document.querySelector('#sidechat-messages .sidechat-msg.live'),undefined,{timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#sidechat-stop')?.hidden===false,undefined,{timeout:20000});
 const facts=await page.evaluate(()=>{
  const live=document.querySelector('#sidechat-messages .sidechat-msg.live');
  const body=live?.querySelector('.sidechat-body');
  return {busy:live?.getAttribute('aria-busy')||'',dots:live?.querySelectorAll('.sidechat-thinking span').length||0,text:(body?.textContent||'').trim()};
 });
 assert.equal(facts.busy,'true',`o cartão ao vivo anuncia aria-busy (veio "${facts.busy}")`);
 assert.equal(facts.dots,3,`pontos de "pensando" sob o papel (${facts.dots}; esperado 3)`);
 assert.equal(facts.text,'','o corpo do cartão ao vivo ainda não tem texto');
});

/* ---------- 7 e 8. alfinete sem chip + confirmação no botão Copiar ---------- */

await block('lateral-rodada2-pin-copia',async ctx=>{
 const {runtime,app,page}=await bootCourse('rodada2-pin-copia',{env:{FAKE_OPENCODE_REPLY:'Resposta para copiar no teste.'}});
 ctx.runtime=runtime;ctx.app=app;
 await openSidechat(page);
 await sendSidechat(page,'copie esta resposta');
 await waitAssistant(page,{min:10});

 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__r2Copied=text;}}});});
 const copy=page.locator('#sidechat-messages .sidechat-msg.assistant .sidechat-copy').last();
 const before=await copy.evaluate(el=>({label:el.getAttribute('aria-label')||'',icons:el.querySelectorAll('svg.icon').length}));
 assert.ok(before.icons>=1,`o Copiar tem ícone antes do clique (${before.icons})`);
 await copy.click();
 await page.waitForFunction(()=>document.querySelector('#sidechat-messages .sidechat-msg.assistant .sidechat-copy')?.classList.contains('ok'),undefined,{timeout:5000});
 const during=await copy.evaluate(el=>({label:el.getAttribute('aria-label')||'',text:(el.textContent||'').trim(),check:el.querySelectorAll('svg.motion-copied').length}));
 assert.equal(during.check,1,'a confirmação troca o ícone pelo check');
 assert.match(during.label,/copiado/i,`o aria-label confirma a cópia (veio "${during.label}")`);
 assert.match(during.text,/copiado/i,`o rótulo visível confirma a cópia (veio "${during.text}")`);
 assert.ok(await page.evaluate(()=>String(window.__r2Copied||'').length>0),'o Copiar escreveu no clipboard');
 await page.waitForFunction(()=>!document.querySelector('#sidechat-messages .sidechat-msg.assistant .sidechat-copy')?.classList.contains('ok'),undefined,{timeout:5000});
 const after=await copy.evaluate(el=>({label:el.getAttribute('aria-label')||'',icon:el.querySelectorAll('svg.icon').length}));
 assert.equal(after.label,before.label,`o aria-label volta ao original (${before.label} × ${after.label})`);
 assert.ok(after.icon>=1,'o ícone de copiar volta');

 const child=await detachSidechat(page,app);
 await fitWindow(app,child,280,800);
 await child.locator('#sidechat-more').click();
 await child.locator('#sidechat-always-on-top').click();
 await child.waitForFunction(()=>document.querySelector('#sidechat-pin')?.hidden===false,undefined,{timeout:10000});
 const pin=await child.evaluate(()=>{
  const el=document.querySelector('#sidechat-pin');
  const style=getComputedStyle(el),box=el.getBoundingClientRect(),head=document.querySelector('#sidechat .sidechat-head');
  return {width:box.width,height:box.height,headWidth:head.getBoundingClientRect().width,
   border:style.borderTopWidth,borderStyle:style.borderTopStyle,background:style.backgroundColor,
   className:el.className,role:el.getAttribute('role')||'',label:el.getAttribute('aria-label')||'',icon:el.querySelectorAll('svg').length};
 });
 assert.ok(pin.headWidth<300,`o cabeçalho estreito tem ${pin.headWidth.toFixed(1)}px (esperado <300px)`);
 assert.ok(pin.width>0&&pin.height>0,`o alfinete continua visível no cabeçalho estreito (${pin.width}×${pin.height})`);
 assert.equal(pin.borderStyle,'none',`o alfinete não tem borda de chip (${pin.borderStyle} ${pin.border})`);
 assert.equal(pin.background,'rgba(0, 0, 0, 0)',`o alfinete não tem fundo de chip (${pin.background})`);
 assert.ok(pin.className.includes('sidechat-pin'),`o alfinete tem classe própria (${pin.className})`);
 assert.ok(!pin.className.includes('sidechat-engine'),`o alfinete não usa a classe do selo do motor (${pin.className})`);
 assert.equal(pin.role,'img','o alfinete segue como role=img');
 assert.match(pin.label,/sempre por cima/i,`o alfinete tem nome acessível (veio "${pin.label}")`);
 assert.equal(pin.icon,1,'o alfinete é um ícone simples');
});

console.log('PASS: achados da rodada 2 do chat lateral (erro único, quiz, escopo, inglês, carregando, alfinete, copiado)');
