// Etapa 4 do chat do tutor: linha de metadados da resposta, leituras
// recolhíveis com linha por ferramenta e contexto legível no cabeçalho.
// Roda com fixtures sintéticos (sem material de curso real).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,seedNativeSession,writeConfigJson,writeDeskJson,launchDesk,statusOnline,resizeWindow,setTheme,freezeMotion,reviewShot,screenshotDirectory,tinyPdfPages} from './helpers.mjs';
import {layoutStable} from './waits.mjs';

const OUT=screenshotDirectory('chat-etapa4');
const UGLY_PREVIEW='teste [Desk context] - references open on the desk - course: Cálculo I';

const measure=page=>page.evaluate(()=>{
 const probe=document.createElement('span');
 probe.style.cssText='position:absolute;visibility:hidden';
 document.body.append(probe);
 const colorOf=token=>{probe.style.color=token;return getComputedStyle(probe).color;};
 const palette={muted:colorOf('var(--muted)'),faint:colorOf('var(--faint)'),success:colorOf('var(--success-text)'),border:colorOf('var(--border)')};
 probe.remove();
 const work=document.querySelector('article.work');
 const row=document.querySelector('.work-step[data-row=tool]');
 const style=el=>el?getComputedStyle(el):null;
 const time=document.querySelector('#messages .message:not(.user) .message-time');
 const times=[...document.querySelectorAll('#messages .message:not(.user) .message-time')];
 const lastTime=times.at(-1);
 const context=document.querySelector('#context-summary');
 const contextLine=document.querySelector('#context-line');
 return {
  palette,
  title:document.querySelector('#session-title .session-title-text')?.textContent.trim()||'',
  context:{text:context?.textContent.trim()||'',hidden:contextLine?.hidden,color:style(context)?.color,size:style(context)?.fontSize},
  work:work?{
   expanded:work.dataset.expanded,
   title:work.querySelector('.work-title')?.textContent.trim()||'',
   background:style(work).backgroundColor,
   radius:style(work).borderRadius,
   borderTop:[style(work).borderTopWidth,style(work).borderTopColor],
   borderBottom:[style(work).borderBottomWidth,style(work).borderBottomColor],
  }:null,
  row:row?{
   label:row.querySelector('.step-label')?.textContent.trim()||'',
   target:row.querySelector('.step-preview')?.textContent.trim()||'',
   duration:row.querySelector('.step-duration')?.textContent.trim()||'',
   labelFamily:style(row.querySelector('.step-label'))?.fontFamily||'',
   targetColor:style(row.querySelector('.step-preview'))?.color||'',
   targetFamily:style(row.querySelector('.step-preview'))?.fontFamily||'',
   iconColor:style(row.querySelector('.step-icon'))?.color||'',
   icon:row.querySelector('.step-icon svg')?.outerHTML||'',
  }:null,
  time:time?{text:time.textContent.trim(),title:time.getAttribute('title'),size:style(time).fontSize,family:style(time).fontFamily,color:style(time).color,copy:!!document.querySelector('#messages .message:not(.user) .msg-copy'),
   actionsText:time.parentElement.textContent.trim(),
   timeLeft:time.getBoundingClientRect().left-time.parentElement.getBoundingClientRect().left,
   lastButtonGap:(()=>{const box=time.parentElement.getBoundingClientRect();const last=[...time.parentElement.querySelectorAll('button')].pop();return last?Math.round(box.right-last.getBoundingClientRect().right):-1;})()}:null,
  lastTime:lastTime?{text:lastTime.textContent.trim(),title:lastTime.getAttribute('title'),size:style(lastTime).fontSize,family:style(lastTime).fontFamily,color:style(lastTime).color}:null,
 };
});

await withArtifacts('tutor-chat-etapa4',async ctx=>{
 const runtime=ctx.runtime=newRuntime('etapa4');
 const course=seedCourse(runtime,'calc');
 const apostila=path.join(course,'apostila.pdf');
 const formulario=path.join(course,'formulario.pdf');
 fs.writeFileSync(apostila,tinyPdfPages(58,'Frações parciais'));
 fs.writeFileSync(formulario,tinyPdfPages(58,'Formulário de integrais'));
 const now=Date.now()-60_000;
 const session=seedNativeSession(runtime,[
  {role:'user',content:[{type:'text',text:'Por que o caso 3 usa Ax + B no numerador?'}],timestamp:now},
  {role:'assistant',content:[
   {type:'text',text:'Vou conferir a apostila e o formulário.'},
   {type:'toolCall',id:'read-1',name:'mesa_ler_pdf',arguments:{caminho:apostila,pagina:58}},
  ],timestamp:now+1_000,model:'opencode/deepseek-v4.1-flash-free'},
  {role:'toolResult',toolCallId:'read-1',toolName:'mesa_ler_pdf',isError:false,timestamp:now+2_200,content:[{type:'text',text:'Texto da página 58.'}],details:{}},
  {role:'assistant',content:[{type:'toolCall',id:'read-2',name:'mesa_ler_pdf',arguments:{caminho:formulario,pagina:1}}],timestamp:now+3_000},
  {role:'toolResult',toolCallId:'read-2',toolName:'mesa_ler_pdf',isError:false,timestamp:now+3_900,content:[{type:'text',text:'Texto da página 1.'}],details:{}},
  {role:'assistant',content:[{type:'text',text:'Porque o denominador é um quadrático irredutível. O resto da divisão por um divisor de grau 2 tem grau 1, então o numerador é **Bx + C**.'}],timestamp:now+5_000},
 ],{courseId:'calc',started:now,preview:UGLY_PREVIEW});
 writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'calc',name:'Cálculo I',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',session,courseStates:{calc:{
  session,
  sessions:[{path:session,started:now,preview:UGLY_PREVIEW}],
  pdfs:[{path:apostila,page:58},{path:formulario,page:58}],
  study:{title:'',xopp:''},
 }}});
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page,{timeout:60000});
 await resizeWindow(app,page,1440,900);
 await freezeMotion(page);
 await page.waitForSelector('article.work');
 await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');S.panels[0].goto(58);});
 await page.waitForFunction(()=>document.querySelector('#context-summary')?.textContent.includes('p. 58'));
 await layoutStable(page,'article.work');

 /* ---------- 1. cabeçalho: título sem marcador interno + contexto legível ---------- */
 const head=await measure(page);
 assert.equal(head.title,'teste','o título mostra a fala, não o bloco `[Desk context]`');
 assert.doesNotMatch(head.title,/Desk context|references open/,'nenhum marcador interno no título');
 assert.equal(head.context.hidden,false,'a segunda linha do cabeçalho aparece com os fatos');
 assert.equal(head.context.text,'apostila.pdf, p. 58 +1','o primeiro PDF e "+1"; matéria e contagem de referências saíram (r2)');
 assert.equal(head.context.size,'12px','o contexto usa --fs-sm (r1)');
 assert.equal(head.context.color,head.palette.muted,'o contexto usa --muted (texto 2 do r1)');
 await reviewShot(page,OUT,'depois-light-fechado.png');

 /* ---------- 2. leituras: fechado por padrão, linha por ferramenta aberta ---------- */
 assert.equal(head.work.expanded,'false','depois da resposta o registro começa recolhido');
 assert.match(head.work.title,/2 leituras/,'o cabeçalho conta as leituras de PDF');
 assert.equal(head.work.background,'rgba(0, 0, 0, 0)','o bloco não é cartão (sem fundo)');
 assert.equal(head.work.radius,'0px','o bloco não é cartão (sem raio)');
 assert.deepEqual(head.work.borderTop,['1px',head.palette.border],'fio de 1px em cima');
 assert.deepEqual(head.work.borderBottom,['1px',head.palette.border],'fio de 1px embaixo');

 await page.locator('article.work .work-head').click();
 await page.waitForFunction(()=>document.querySelector('article.work')?.dataset.expanded==='true');
 await layoutStable(page,'article.work');
 const open=await measure(page);
 assert.ok(open.row,'aberto, cada leitura é uma linha');
 assert.equal(open.row.label,'Ler o PDF','o nome da ferramenta vem do catálogo, sem prefixo do MCP');
 assert.match(open.row.labelFamily,/monospace/,'nome da ferramenta em --font-mono');
 assert.equal(open.row.target,'apostila.pdf · p. 58','alvo arquivo · página');
 assert.equal(open.row.targetColor,open.palette.muted,'alvo em --muted');
 assert.match(open.row.targetFamily,/monospace/,'alvo em --font-mono como o protótipo');
 assert.equal(open.row.duration,'1s','duração à direita quando o app tem o dado');
 assert.equal(open.row.iconColor,open.palette.success,'✓ na cor de sucesso');
 assert.match(open.row.icon,/M4 19\.5v-15/,'a leitura usa o livro do Lucide (#135 N14)');
 await reviewShot(page,OUT,'depois-light-aberto.png');

 /* ---------- 3. linha de metadados da resposta ---------- */
 assert.ok(open.time,'a resposta terminada tem a linha de metadados');
 assert.match(open.time.text,/^\d{2}:\d{2} · deepseek-v4\.1-flash-free$/,'a hora e o modelo que veio na mensagem aparecem');
 assert.equal(open.time.title,'opencode/deepseek-v4.1-flash-free','o title guarda provedor/modelo completo');
 assert.equal(open.time.size,'11px','a linha usa --fs-xs');
 assert.match(open.time.family,/monospace/,'a linha usa --font-mono');
 assert.equal(open.time.color,open.palette.muted,'a linha usa --muted');
 assert.equal(open.time.copy,true,'copiar continua na mesma linha, com a mesma ação');
 /* Regressão: o "·" entre a hora e as ações ficava pendurado diante do vão de
    copiar/citar escondidos. A hora vai à esquerda e as ações à direita. */
 assert.equal(open.time.actionsText,open.time.text,'a linha de metadados não tem "·" solto antes dos botões');
 assert.ok(open.time.timeLeft<=1,`a hora encosta à esquerda (recebido ${open.time.timeLeft}px)`);
 assert.equal(open.time.lastButtonGap,0,'as ações encostam à direita, como antes da etapa 4');
 assert.ok(open.lastTime,'a última resposta também tem a linha de metadados');
 assert.match(open.lastTime.text,/^\d{2}:\d{2}$/,'sem modelo na mensagem, a linha mostra só a hora');
 assert.equal(open.lastTime.title,null,'sem modelo não há title inventado');
 assert.equal(open.lastTime.size,open.time.size,'as duas linhas usam o mesmo tamanho');
 assert.equal(open.lastTime.color,open.time.color,'as duas linhas usam --muted');
 /* Regressão (r1 na tela principal): a margem do <p> somava 12px dentro do
    balão do aluno; o balão abraça o texto com 10px em cima e embaixo. */
 const bubble=await page.evaluate(()=>{
  const body=document.querySelector('#messages .message.user .body');
  const box=body.getBoundingClientRect(),first=body.firstElementChild.getBoundingClientRect(),last=body.lastElementChild.getBoundingClientRect();
  return {top:Math.round(first.top-box.top),bottom:Math.round(box.bottom-last.bottom)};
 });
 assert.deepEqual(bubble,{top:10,bottom:10},'o balão do aluno tem 10px de respiro, sem a margem do parágrafo');

 /* ---------- 4. tema escuro (capturas) ---------- */
 await setTheme(page,'dark');
 await layoutStable(page,'article.work');
 await reviewShot(page,OUT,'depois-dark-aberto.png');
 await page.locator('article.work .work-head').click();
 await page.waitForFunction(()=>document.querySelector('article.work')?.dataset.expanded==='false');
 await layoutStable(page,'article.work');
 await reviewShot(page,OUT,'depois-dark-fechado.png');

 assert.deepEqual(errors,[],'sem erro de página');
 console.log('ok tutor-chat-etapa4-ui');
});
