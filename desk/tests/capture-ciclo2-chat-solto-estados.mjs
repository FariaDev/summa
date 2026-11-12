// Blocos de Estados da janela solta do chat lateral (#157), parte "Chat solto"
// do ciclo 2: vazio, respondendo (o fake segura o turno) e erro do motor. O
// módulo existe para o script principal ficar abaixo de 500 linhas; os dados
// são sintéticos e o motor é o `fake-opencode`.
import {
 bootCourse,openSidechat,sendSidechat,detachSidechat,applyTheme,fitWindow,createSnap,captureOutDir,
} from './capture-ciclo2-chat-solto-kit.mjs';

const OUT=captureOutDir();
const snap=createSnap(OUT);
const PT={light:'claro',dark:'escuro'};
const REPLY_PT='A ideia central é dividir numerador e denominador por x antes de substituir.';
const winFacts=page=>page.evaluate(()=>({innerWidth,innerHeight,outerWidth,outerHeight}));

/** Roda os blocos de vazio/carregando/erro no script principal.
 * @param {(tag:string,run:()=>Promise<void>)=>Promise<void>} block */
export async function runEstadoBlocks(block){
 await block('vazio',async ctx=>{
  const {runtime,app,page}=await bootCourse('ciclo2-vazio');
  ctx.runtime=runtime;ctx.app=app;
  await openSidechat(page);
  const child=await detachSidechat(page,app);
  await fitWindow(app,child,380,800);
  const emptyState=async()=>{
   const facts=await child.evaluate(()=>({
    empty:(document.querySelector('#sidechat-messages .sidechat-empty')?.textContent||'').trim(),
    messages:document.querySelectorAll('#sidechat-messages .sidechat-msg').length,
    cards:document.querySelectorAll('#sidechat-messages .quiz-card').length,
    warn:!!document.querySelector('#sidechat-messages .sidechat-warn'),
   }));
   if(!facts.empty)throw Error('o chat vazio não mostra a mensagem de vazio');
   if(facts.messages||facts.cards)throw Error(`o chat vazio já tem conteúdo (${facts.messages} mensagens, ${facts.cards} cartões)`);
   if(facts.warn)throw Error('o chat vazio não devia ter aviso de incerto');
   return facts;
  };
  for(const theme of ['light','dark']){
   await applyTheme(page,child,theme);
   await snap(child,`solto-vazio-${PT[theme]}-380x800`,{scope:'#sidechat',expect:emptyState,
    extra:{theme,locale:'pt-BR',state:'janela-solta-vazia',window:await winFacts(child)}});
  }
 });

 await block('carregando',async ctx=>{
  const {runtime,app,page}=await bootCourse('ciclo2-carregando',{env:{FAKE_OPENCODE_QUEUE_HOLD_MS:'60000',FAKE_OPENCODE_REPLY:REPLY_PT}});
  ctx.runtime=runtime;ctx.app=app;
  await openSidechat(page);
  const child=await detachSidechat(page,app);
  await fitWindow(app,child,380,800);
  await sendSidechat(child,'segure a resposta do tutor');
  await child.waitForFunction(()=>{
   const stop=document.querySelector('#sidechat-stop');
   const activity=(document.querySelector('#sidechat-activity')?.textContent||'').trim();
   return !!stop&&!stop.hidden&&activity.length>0;
  },undefined,{timeout:20000});
  const busyState=async()=>{
   const facts=await child.evaluate(()=>({
    stop:!document.querySelector('#sidechat-stop')?.hidden,
    sendDisabled:!!document.querySelector('#sidechat-send')?.disabled,
    activity:(document.querySelector('#sidechat-activity')?.textContent||'').trim(),
   }));
   if(!facts.stop)throw Error('o botão Parar não está visível durante a resposta');
   if(!facts.sendDisabled)throw Error('o Enviar devia estar desligado durante a resposta');
   if(!/respondendo|answering/i.test(facts.activity))throw Error(`a linha de atividade não diz que está respondendo ("${facts.activity}")`);
   return facts;
  };
  for(const theme of ['light','dark']){
   await applyTheme(page,child,theme);
   await snap(child,`solto-carregando-${PT[theme]}-380x800`,{scope:'#sidechat',expect:busyState,
    extra:{theme,locale:'pt-BR',state:'janela-solta-respondendo',window:await winFacts(child)}});
  }
 });

 await block('erro',async ctx=>{
  const {runtime,app,page}=await bootCourse('ciclo2-erro',{env:{FAKE_OPENCODE_FAIL:'network',FAKE_OPENCODE_REPLY:REPLY_PT}});
  ctx.runtime=runtime;ctx.app=app;
  await openSidechat(page);
  const child=await detachSidechat(page,app);
  await fitWindow(app,child,380,800);
  await sendSidechat(child,'provoca a falha do motor');
  await child.waitForFunction(()=>{
   const text=document.querySelector('#sidechat-messages')?.textContent||'';
   return /Erro do chat lateral|Side chat error|fetch failed/i.test(text)&&document.querySelector('#sidechat-stop')?.hidden!==false;
  },undefined,{timeout:30000});
  const errorState=async()=>{
   const facts=await child.evaluate(()=>({
    text:(document.querySelector('#sidechat-messages')?.textContent||'').replace(/\s+/g,' ').trim(),
    stop:!document.querySelector('#sidechat-stop')?.hidden,
    /* campo vazio desliga o Enviar (dd57e5fa); com texto ele volta a aceitar */ sendDisabled:(()=>{const box=document.querySelector('#sidechat-prompt'),send=document.querySelector('#sidechat-send');if(!box||!send)return true;const prev=box.value;box.value='x';box.dispatchEvent(new Event('input',{bubbles:true}));const off=send.disabled;box.value=prev;box.dispatchEvent(new Event('input',{bubbles:true}));return off;})(),
   }));
   if(!/Erro do chat lateral/i.test(facts.text))throw Error(`o erro do motor não aparece na lista ("${facts.text.slice(0,120)}")`);
   if(facts.stop)throw Error('o Parar devia sumir depois da falha');
   if(facts.sendDisabled)throw Error('o Enviar devia voltar a funcionar depois da falha');
   return facts;
  };
  for(const theme of ['light','dark']){
   await applyTheme(page,child,theme);
   await snap(child,`solto-erro-${PT[theme]}-380x800`,{scope:'#sidechat',expect:errorState,
    extra:{theme,locale:'pt-BR',state:'janela-solta-erro-do-motor',window:await winFacts(child)}});
  }
 });
}
