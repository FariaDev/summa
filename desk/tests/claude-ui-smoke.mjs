/* Smoke de UI da Mesa + Claude (experimental), sobre o host/IPC congelado.
 *
 * Roda com o harness do ui-smoke (Electron + Playwright) e SEMPRE com runtime,
 * matéria e SDK artificiais: a fixture `tests/fixtures/claude-sdk-fake.mjs` é
 * injetada por `LEARNING_DESK_CLAUDE_SDK_FACTORY` (só o host em DESK_TEST=1
 * importa). A conversa de linha de base é do OpenCode com o `fake-opencode.mjs`,
 * e o log de subida do fake prova "nenhum processo OpenCode nasce numa conversa
 * Claude".
 *
 *   node tests/claude-ui-smoke.mjs
 *
 * Cobre: "Sessão nova com Claude Code" (menu `#new-session`) cria sessão Claude (descriptor JSON),
 * texto e imagem sem bolha duplicada (stream/replay/final), OpenCode intocado,
 * permissões (permitir/negar/cancelar com fila de diálogos e fila de mensagens
 * esperando o turno/permissão), cancelamento e incerteza sem auto-retry,
 * reabertura com fila recuperada, exportação pelo histórico NATIVO paginado
 * (marcador que só existe no store do SDK), cache visível offline/sem binário
 * (sem fallback para o OpenCode) e a conversa OpenCode preservada no rollback.
 *
 * Depende do contrato do host: `new-session {engine}`, metadata
 * engine/agentLabel/capabilities, eventos `agent_settled` com
 * cancelled/isError/uncertain, `agent_request_cancelled {id}`,
 * `extension_ui_request {permission:true}` e descritor com `nativeSessionId`.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,launchDesk,newRuntime,seedCourse,seedPlot,writeDeskJson,writeConfigJson,toastWait,sendEnabled,statusOnline,pickModel,DESK,tutorMore,newSession,openSessionById,currentSession,currentEngine,sessionRows,pageWindow} from './helpers.mjs';

const FIXTURE=path.join(DESK,'tests','fixtures','claude-sdk-fake.mjs');
const conversations=createRequire(import.meta.url)('../src/agents/conversations.cjs');
const CONVERSATIONS='conversations';
const FIXTURE_TEXT='Resposta de teste do Claude (fixture)';

function trapScript(sentinel,real){
 return `#!/bin/sh\necho "$$ $@" >> "${sentinel}"\n`+(real?`exec "${real}" "$@"\n`:'exit 1\n');
}
function writeTrap(file,body){
 fs.writeFileSync(file,body);
 fs.chmodSync(file,0o755);
 return file;
}
const sentinelLines=file=>{
 try{return fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean);}
 catch{return [];}
};
const claudeEntries=file=>{
 try{return fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}
 catch{return [];}
};
const traceEntries=file=>{
 try{return fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}
 catch{return [];}
};
function claudeDescriptorFiles(runtime){
 const dir=path.join(runtime,CONVERSATIONS);
 try{return fs.readdirSync(dir).filter(name=>/^claude-.*\.json$/.test(name));}
 catch{return [];}
}

await withArtifacts('claude-ui',async ctx=>{
 const runtime=ctx.runtime=newRuntime('claude-ui');
 const course=seedCourse(runtime,'Calc');
 const plot=seedPlot(runtime,'Calc');
 const opencodeSentinel=path.join(runtime,'opencode-starts.log');
 const claudeSentinel=path.join(runtime,'claude-starts.log');
 /* Cada subida do `serve` falso grava `{start:true,…}`; o log é o sentinela de
    "nenhum processo OpenCode nasceu" durante os turnos Claude. */
 const opencodeStarts=()=>sentinelLines(opencodeSentinel).filter(line=>{
  try{return JSON.parse(line).start===true;}catch{return false;}
 });
 const claudeLog=path.join(runtime,'claude-prompts.log');
 const claudeTrace=path.join(runtime,'claude-trace.log');
 const store=path.join(runtime,'claude-store');
 const claudeTrap=writeTrap(path.join(runtime,'claude-trap.sh'),trapScript(claudeSentinel,''));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calc',name:'Cálculo I',path:course}],claudePath:claudeTrap});
 /* A conversa de linha de base é do OpenCode; o descritor no desk.json fixa o
    motor mesmo com os dois motores visíveis no teste. */
 const baselineSession=conversations.createClaudeConversation({runtime,courseId:'Calc',engine:'opencode'});
 writeDeskJson(runtime,{courseId:'Calc',session:baselineSession,courseStates:{Calc:{session:baselineSession,sessions:[{path:baselineSession}]}}});
 const baseEnv={
  FAKE_OPENCODE_LOG:opencodeSentinel,
  LEARNING_DESK_CLAUDE:claudeTrap,
  LEARNING_DESK_CLAUDE_SDK_FACTORY:FIXTURE,
  FAKE_CLAUDE_LOG:claudeLog,
  FAKE_CLAUDE_STORE:store,
  FAKE_CLAUDE_TRACE:claudeTrace,
 };
 const launch=(extra={})=>launchDesk({runtime,env:{...baseEnv,...extra}});
 /* A janela da Mesa é a primeira página do app; a prévia escondida pode vir antes em getAllWindows(). */
 const emit=async(app,data)=>(await pageWindow(app,await app.firstWindow())).evaluate((win,payload)=>win.webContents.send('pi-event',payload),data);
 const watch=page=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))console.log('CONSOLE',m.text());});return errors;};
 const logHas=(file,text)=>claudeEntries(file).some(entry=>String(entry.text||'').includes(text));
 const waitForLog=async(file,text,{timeout=30000}={})=>{
  const start=Date.now();
  for(;;){
   if(logHas(file,text))return true;
   if(Date.now()-start>timeout)throw Error(`log não recebeu o prompt: ${text}`);
   await new Promise(resolve=>setTimeout(resolve,150));
  }
 };
 const assistantOccurrences=(page,text)=>page.locator('#messages .message.assistant .body').evaluateAll((els,needle)=>els.reduce((count,el)=>count+el.textContent.split(needle).length-1,0),text);
 const waitBody=text=>page.waitForFunction(t=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes(t)),text,{timeout:30000});

 /* ---------- 1. OpenCode é a linha de base (o fake grava cada subida) ---------- */
 let app=ctx.app=await launch();
 let page=await app.firstWindow();
 let errors=watch(page);
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 await statusOnline(page);
 assert.equal(await currentEngine(page),'opencode','a sessão de linha de base é do OpenCode (o título da sessão carrega o motor)');
 assert.ok(opencodeStarts().length>=1,'o serve falso subiu para a conversa de linha de base');
 await page.locator('#prompt').fill('explique o teorema de Pitágoras');
 await page.locator('#send').click();
 await page.waitForSelector('#messages .message.assistant .katex',{timeout:30000});
 await sendEnabled(page,{timeout:30000});
 await page.locator('#new-session').click({button:'right'});
 assert.deepEqual((await page.locator('#new-session-pop button[role="menuitem"]').allTextContents()).map(text=>text.trim()),['OpenCode (atual)','Claude (experimental)'],'menu com o motor atual e o Claude (experimental)');
 await page.keyboard.press('Escape');
 await page.locator('#new-session-pop').waitFor({state:'hidden'});
 const openCodeSession=await currentSession(page);
 assert.match(openCodeSession,/[/\\]conversations[/\\]opencode-[\w-]+\.json$/,'a conversa OpenCode usa o descritor JSON como chave');
 /* O descritor guarda o histórico em cache: espera a resposta entrar antes de
    seguir, para o rollback conferir a conversa antiga. */
 await page.waitForFunction(()=>document.querySelector('#messages .message.assistant .katex'),undefined,{timeout:30000});
 for(let tries=0;tries<100;tries++){
  const record=JSON.parse(fs.readFileSync(openCodeSession,'utf8'));
  if((record.messages||[]).some(message=>String(message.role)==='assistant'))break;
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 const openCodeRecord=JSON.parse(fs.readFileSync(openCodeSession,'utf8'));
 assert.ok(openCodeRecord.messages.some(message=>String(message.role)==='assistant'),'o descritor OpenCode guardou a resposta artificial');
 /* Daqui em diante, qualquer processo OpenCode novo aparece no sentinela. */
 fs.writeFileSync(opencodeSentinel,'');

 /* ---------- 2. o item do menu escolhe o motor da sessão NOVA ---------- */
 await page.locator('#new-session').click({button:'right'});
 assert.equal(await currentEngine(page),'opencode','abrir o menu não muda o motor da sessão atual');
 await page.locator('#new-session-claude').click();
 await page.waitForFunction(()=>document.querySelector('#session-title')?.dataset.engine==='claude',undefined,{timeout:30000});
 await statusOnline(page,{timeout:60000});
 const claudeSession=await currentSession(page);
 assert.match(claudeSession,/[/\\]conversations[/\\]claude-[\w-]+\.json$/,'a conversa Claude usa o descriptor JSON como chave');
 const claudeRow=(await sessionRows(page)).find(row=>row.id===claudeSession);
 assert.ok(claudeRow,'a sessão Claude aparece na lista da matéria');
 assert.match(claudeRow.meta,/Claude/i,'a lista indica o motor da sessão');
 await page.keyboard.press('Escape');
 const descriptors=claudeDescriptorFiles(runtime);
 assert.equal(descriptors.length,1,'o descriptor JSON real nasceu em runtime/conversations');
 const descriptor=JSON.parse(fs.readFileSync(path.join(runtime,CONVERSATIONS,descriptors[0]),'utf8'));
 assert.match(descriptor.nativeSessionId,/^[0-9a-f-]{36}$/i,'o descriptor guarda o ID nativo explícito para o export');
 /* Modelo vem do catálogo nativo artificial; esforço exige escolha explícita. */
 assert.equal(await page.locator('#model-field').evaluate(el=>el.hidden),false,'modelo aparece com catálogo nativo');
 await pickModel(page,'anthropic','claude-fake');
 await page.waitForFunction(()=>document.querySelector('#effort-strip')?.getAttribute('aria-disabled')==='false');
 assert.equal(await page.locator('#effort-field').evaluate(el=>el.hidden),false,'esforço aparece com metadado do modelo');
 assert.equal(await page.locator('#auto-compact').isHidden(),true,'compactação automática escondida');
 assert.equal(await page.locator('#ctx-meter').isHidden(),true,'medidor de contexto escondido sem contextUsage');
 assert.equal(await page.locator('#composer-hint').count(),0,'a dica de atalhos saiu da tela principal');
 assert.equal(await page.locator('#send').isVisible(),true,'ocioso, o Enviar é a ação da caixa');
 assert.equal(opencodeStarts().length,0,'a conversa Claude não iniciou nenhum processo OpenCode');

 /* ---------- 3. texto + imagem chegam ao transporte Claude (sem bolha duplicada) ---------- */
 await page.locator('#prompt').fill('olá Claude, tudo bem?');
 await page.locator('#send').click();
 await waitBody(FIXTURE_TEXT);
 await sendEnabled(page,{timeout:30000});
 assert.equal(await page.locator('#messages .message.user').count(),1,'um turno = uma bolha de usuário (o replay não duplica)');
 assert.equal(await page.locator('#messages .message.assistant').count(),1,'um turno = uma bolha de assistente (stream + final no mesmo nó)');
 assert.equal(await assistantOccurrences(page,FIXTURE_TEXT),1,'o texto final não repete dentro da bolha');
 await page.setInputFiles('#attach-input',plot);
 await page.waitForSelector('#attachments .attachment img',{timeout:15000});
 await page.locator('#prompt').fill('segue a imagem [claude:image]');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelector('#attachments').hidden,undefined,{timeout:15000});
 await waitBody('1 bloco(s) de imagem');
 await sendEnabled(page,{timeout:30000});
 assert.equal(await page.locator('#messages .message.user').count(),2,'a mensagem com imagem não duplica a bolha do usuário');
 assert.equal(await page.locator('#messages .message.assistant').count(),2,'a resposta com imagem não duplica a bolha do assistente');
 assert.match(await page.locator('#messages .message.assistant .body').nth(1).textContent(),/Recebi 1 bloco\(s\) de imagem/,'a resposta conta a imagem que chegou');
 const logged=claudeEntries(claudeLog);
 const firstTurn=logged.find(entry=>String(entry.text||'').includes('olá Claude'));
 assert.ok(firstTurn,'o primeiro prompt chegou ao transporte Claude');
 assert.equal(firstTurn.images,0,'texto puro, sem imagem');
 assert.equal(firstTurn.marker,'text','roteiro padrão do primeiro prompt');
 const imageEntry=logged.find(entry=>String(entry.text||'').includes('segue a imagem'));
 assert.ok(imageEntry,'o prompt com imagem chegou ao transporte Claude');
 assert.equal(imageEntry.images,1,'a imagem foi encaminhada ao SDK (1 bloco)');
 const beforeFragments=await page.locator('#messages .message.assistant').count();
 await page.locator('#prompt').fill('fragmentos [claude:multi]');
 await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelector('#messages .message.assistant:last-child .body')?.textContent.includes('fragmentos [claude:multi]'),undefined,{timeout:30000});
 await sendEnabled(page,{timeout:30000});
 assert.equal(await page.locator('#messages .message.assistant').count(),beforeFragments+1,'fragmented deltas and final produce one assistant bubble');
 assert.equal((await page.locator('#messages .message.assistant .body').last().textContent()).split(FIXTURE_TEXT).length-1,1,'fragmented text is not duplicated at completion');
 assert.equal(imageEntry.marker,'image','o marcador escolheu o roteiro de imagem');
 assert.equal(opencodeStarts().length,0,'imagem em conversa Claude não acorda o OpenCode');

 /* ---------- 4. leitura sem diálogo; permissões e cancelamento usam o diálogo ---------- */
 /* 4a. Read nativo é negado na hora: o tutor não tem ferramenta de arquivo (#91). */
 await page.locator('#prompt').fill('[claude:permission-allow]');
 await page.locator('#send').click();
 await waitBody('negada');
 assert.equal(await page.locator('#pi-dialog[open]').count(),0,'leitura nativa negada não abre diálogo');
 await sendEnabled(page,{timeout:30000});
 /* 4b. Read fora da política é negado na hora, também sem diálogo. */
 await page.locator('#prompt').fill('[claude:permission-deny]');
 await page.locator('#send').click();
 await waitBody('negada');
 assert.equal(await page.locator('#pi-dialog[open]').count(),0,'leitura recusada não abre diálogo');
 await sendEnabled(page,{timeout:30000});
 /* 4c. cancelamento vindo do host (`agent_request_cancelled`): o diálogo vencido
    não recebe resposta e o próximo da fila abre no lugar. */
 const sessionNow=await currentSession(page);
 await emit(app,{type:'extension_ui_request',id:'ui-perm-a',method:'confirm',title:'Permissão de teste A',message:'A?',permission:true,conversationId:sessionNow});
 await page.waitForFunction(()=>document.querySelector('#pi-dialog[open]'),undefined,{timeout:10000});
 assert.equal(await page.locator('#pi-dialog').getAttribute('data-permission'),'true','permissão injetada marca o diálogo');
 await emit(app,{type:'extension_ui_request',id:'ui-perm-b',method:'confirm',title:'Permissão de teste B',message:'B?',permission:true,conversationId:sessionNow});
 await emit(app,{type:'agent_request_cancelled',id:'ui-perm-a',conversationId:sessionNow});
 await page.waitForFunction(()=>document.querySelector('#pi-dialog[open]')?.querySelector('#dialog-title')?.textContent==='Permissão de teste B',undefined,{timeout:10000});
 await emit(app,{type:'agent_request_cancelled',id:'ui-perm-b',conversationId:sessionNow});
 await page.waitForFunction(()=>!document.querySelector('#pi-dialog[open]'),undefined,{timeout:10000});
 /* A fila continua viva: um pedido novo depois dos cancelamentos ainda abre. */
 await emit(app,{type:'extension_ui_request',id:'ui-perm-c',method:'confirm',title:'Permissão de teste C',message:'C?',permission:true,conversationId:sessionNow});
 await page.waitForFunction(()=>document.querySelector('#pi-dialog[open]')?.querySelector('#dialog-title')?.textContent==='Permissão de teste C',undefined,{timeout:10000});
 await emit(app,{type:'agent_request_cancelled',id:'ui-perm-c',conversationId:sessionNow});
 await page.waitForFunction(()=>!document.querySelector('#pi-dialog[open]'),undefined,{timeout:10000});
 /* evento de outra conversa é ignorado por identidade */
 await emit(app,{type:'extension_ui_request',id:'ui-perm-x',method:'confirm',title:'Outra conversa',message:'x',permission:true,conversationId:path.join(runtime,'conversations','claude-outra.json')});
 await page.waitForTimeout(400);
 assert.equal(await page.locator('#pi-dialog[open]').count(),0,'evento explícito de outra conversa não abre diálogo');
 assert.equal(opencodeStarts().length,0,'permissões não iniciam processo OpenCode');

 /* ---------- 5. fila: erro do SDK, cancelamento e incerteza ---------- */
 // Exercise an actual SDK error/result, beyond the uncertain IPC fixture.
 await page.evaluate(()=>{
  const prompt=document.querySelector('#prompt');
  prompt.value='[claude:error]';prompt.dispatchEvent(new Event('input'));
  document.querySelector('#send').click();
  prompt.value='fila após erro SDK';prompt.dispatchEvent(new Event('input'));
  prompt.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 });
 await waitBody('Falha simulada da fixture.');
 await page.waitForFunction(()=>document.querySelector('#stop').hidden&&document.querySelector('.queue-send-now'),undefined,{timeout:30000});
 await page.waitForTimeout(1600);
 assert.equal(await page.locator('.queue-item').count(),1,'SDK error holds the queue');
 assert.equal(logHas(claudeLog,'fila após erro SDK'),false,'desk_error and failed agent_settled cannot advance the queue');
 assert.equal(await page.locator('.queue-clear').isVisible(),false,'com uma mensagem só, Limpar não aparece');
 await page.locator('.queue-item .queue-remove').click();
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===0,undefined,{timeout:15000});
 /* 5b. aceite NÃO libera a fila com o turno aberto; cancelar a segura. */
 await page.locator('#prompt').fill('[claude:stall]');
 await page.locator('#send').click();
 await page.waitForFunction(()=>!document.querySelector('#stop').hidden,undefined,{timeout:30000});
 assert.equal(await page.locator('#stop').isVisible(),true,'ocupado, o Parar toma o lugar do Enviar');
 await page.locator('#prompt').fill('fila no cancelamento');
 await page.locator('#prompt').press('Enter');
 await page.waitForSelector('.queue-item',{timeout:15000});
 await waitForLog(claudeLog,'[claude:stall]');
 await page.waitForTimeout(700);
 assert.equal(await page.locator('.queue-item').count(),1,'o aceite não libera a fila com o turno aberto');
 assert.equal(logHas(claudeLog,'fila no cancelamento'),false,'entrega aceita e turno aberto não bastam para enviar o próximo item');
 await page.locator('#stop').click();
 await toastWait(page,'a fila ficou segurada',{timeout:15000});
 await page.waitForFunction(()=>document.querySelector('#stop').hidden&&document.querySelector('.queue-send-now'),undefined,{timeout:30000});
 assert.equal(await page.locator('.queue-item').count(),1,'cancelamento segura a fila (sem auto-envio)');
 /* 5c. "Enviar agora" tenta UMA vez; envio incerto não repete sozinho. */
 await app.evaluate(({ipcMain})=>{
  globalThis.__promptCalls=0;
  ipcMain.removeHandler('pi-prompt');
  ipcMain.handle('pi-prompt',async()=>{globalThis.__promptCalls++;return {sent:false,retryable:false,error:'entrega incerta (teste)'};});
 });
 await page.locator('.queue-send-now').click();
 await toastWait(page,'não foi confirmado',{timeout:20000});
 await page.waitForTimeout(2200);
 assert.equal(await app.evaluate(()=>globalThis.__promptCalls),1,'o envio incerto não é repetido automaticamente');
 assert.equal(await page.locator('.queue-item').count(),1,'a fila guarda o item incerto para conferência');
 assert.match(await page.locator('.queue-item span').first().textContent(),/fila no cancelamento/,'o item incerto continua visível na fila');
 assert.equal(opencodeStarts().length,0,'incerteza em conversa Claude não inicia processo OpenCode');
 /* #45: o Sobre lê a versão do Claude Code com `claude --version` (só isso); login, auth e inferência seguem proibidos. */
 assert.equal(sentinelLines(claudeSentinel).filter(line=>!/\s--version$/.test(line)).length,0,'o SDK fake não executa o binário do Claude (nem login nem inferência; só `--version`)');

 /* ---------- 6. reabrir com fila recuperada e exportar pelo NATIVO ---------- */
 await app.close();
 fs.writeFileSync(opencodeSentinel,'');
 app=ctx.app=await launch();
 page=await app.firstWindow();
 errors=errors.concat(watch(page));
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#session-title')?.dataset.engine==='claude',undefined,{timeout:30000});
 await statusOnline(page,{timeout:60000});
 assert.equal(await currentSession(page),claudeSession,'a conversa Claude volta a ser a ativa');
 assert.equal(opencodeStarts().length,0,'a reabertura da conversa Claude não inicia processo OpenCode');
 await waitBody(FIXTURE_TEXT);
 assert.equal(await page.locator('.queue-item').count(),1,'a fila guardada é recuperada no boot');
 assert.equal(await page.locator('.queue-send-now').count(),1,'a fila recuperada nasce segurada (Enviar agora)');
 /* Marcador que SÓ existe no store nativo: se o export caísse no cache do
    descritor (ou paginasse errado até o teto), ele não apareceria. */
 const nativeSessionId=descriptor.nativeSessionId;
 const sentinel=`NATIVO-${Date.now()}`;
 const storeFile=path.join(store,`session-${nativeSessionId}.json`);
 const stored=JSON.parse(fs.readFileSync(storeFile,'utf8'));
 stored.messages.push({type:'user',uuid:crypto.randomUUID(),session_id:nativeSessionId,message:{role:'user',content:[{type:'text',text:sentinel}]}});
 fs.writeFileSync(storeFile,JSON.stringify(stored));
 const traceBefore=traceEntries(claudeTrace).length;
 await tutorMore(page,'#export-chat').click();
 await toastWait(page,'exportada',{timeout:30000});
 const exportDir=path.join(runtime,'Summa');
 const exported=fs.readdirSync(exportDir).filter(name=>name.endsWith('.md')).sort();
 assert.ok(exported.length>=1,'a exportação gerou Markdown');
 const markdown=fs.readFileSync(path.join(exportDir,exported.at(-1)),'utf8');
 assert.match(markdown,/## Claude\n/,'a exportação da conversa Claude usa o título exato do contrato (`## Claude`)');
 assert.doesNotMatch(markdown,/## Pi\b/,'a exportação não rotula a conversa Claude como Pi');
 assert.ok(markdown.includes(sentinel),'a exportação leu o histórico nativo (marcador que só existe no store do SDK)');
 assert.ok(markdown.includes('olá Claude'),'o texto da conversa está no export');
 assert.ok(markdown.includes('[imagem anexada]'),'a imagem anexada entra no export');
 const exportCalls=traceEntries(claudeTrace).slice(traceBefore).filter(entry=>entry.event==='history');
 assert.ok(exportCalls.length>=2,`o export paginou o histórico nativo (${exportCalls.length} leituras)`);
 assert.ok(exportCalls.some(call=>call.limit===200),'a leitura nativa pagina de 200 em 200');
 assert.ok(exportCalls.some(call=>Number(call.offset)>0),'a paginação nativa avançou além da primeira página');
 /* Conversa nova não leva a fila da conversa antiga; o item fica guardado no
    arquivo da conversa Claude e volta segurado quando ela reabre. */
 await newSession(page);
 await page.waitForFunction(old=>document.querySelector('#session-title')?.dataset.engine==='claude'&&document.querySelector('#session-title').dataset.session!==old,claudeSession,{timeout:60000});
 await statusOnline(page,{timeout:60000});
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===0,undefined,{timeout:15000});
 assert.equal(await page.locator('.queue-item').count(),0,'a fila da conversa Claude não vaza para a conversa nova');
 await openSessionById(page,claudeSession);
 await page.waitForFunction(()=>document.querySelector('#session-title')?.dataset.engine==='claude',undefined,{timeout:60000});
 await statusOnline(page,{timeout:60000});
 assert.equal(await page.locator('.queue-item').count(),1,'o item continua guardado na conversa Claude');
 assert.equal(await page.locator('.queue-send-now').count(),1,'segurado, pronto para "Enviar agora"');
 await waitBody(FIXTURE_TEXT);
 /* A fila recuperada drena num turno confiável de verdade. */
 await page.locator('.queue-send-now').click();
 await page.waitForFunction(()=>document.querySelectorAll('.queue-item').length===0,undefined,{timeout:30000});
 await waitForLog(claudeLog,'fila no cancelamento');
 await sendEnabled(page,{timeout:30000});

 /* ---------- 7. offline/sem login: cache visível, sem fallback para o OpenCode ---------- */
 await app.close();
 fs.writeFileSync(opencodeSentinel,'');
 app=ctx.app=await launch({LEARNING_DESK_CLAUDE_SDK_FACTORY:''});
 page=await app.firstWindow();
 errors=errors.concat(watch(page));
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 await waitBody(FIXTURE_TEXT);
 /* O binário de teste não diz a versão: fora da faixa por ilegível (#51), a
    coluna diz o que fazer e oferece Atualizar Claude Code. */
 await page.waitForFunction(()=>document.querySelector('#tutor-state[data-state="error"]')?.textContent.includes('não deu para ler a versão'),undefined,{timeout:30000});
 assert.equal(await page.locator('#tutor-state #state-claude-update').count(),1,'o conserto está na coluna');
 assert.doesNotMatch(await page.locator('#tutor-state').textContent(),/pareamento|ClaudeAdapterError/,'sem o vocabulário da ponte (#51)');
 assert.doesNotMatch(await page.locator('#toast').textContent(),/não deu para ler a versão/,'o motivo da conexão mora na coluna, sem aviso duplicado (#23)');
 assert.equal(await currentEngine(page),'claude','offline, o motor da sessão segue sendo o Claude Code (nunca cai para o OpenCode)');
 assert.equal(await page.locator('#status-dot.online').count(),0,'sem versão/login a conversa não fica online');
 assert.ok(sentinelLines(claudeSentinel).length>=1,'a falha é do binário configurado (probe da CLI), não do OpenCode');
 assert.equal(opencodeStarts().length,0,'a falha do Claude não inicia nenhum processo OpenCode');
 assert.ok((await page.locator('#messages .message.assistant').count())>=1,'o cache nativo continua visível offline/sem login');

 /* ---------- 8. sem binário detectado: não tenta conectar (e o OpenCode segue vivo) ---------- */
 await app.close();
 const fakeHome=path.join(runtime,'casa-falsa');
 fs.mkdirSync(fakeHome,{recursive:true});
 fs.writeFileSync(claudeSentinel,'');
 fs.writeFileSync(opencodeSentinel,'');
 /* A casa vazia é a do teste: sem o Claude de guarda do electron-env (#51). */
 app=ctx.app=await launch({LEARNING_DESK_CLAUDE_SDK_FACTORY:'',LEARNING_DESK_CLAUDE:path.join(runtime,'claude-inexistente'),HOME:fakeHome,LEARNING_DESK_CLAUDE_HOME:''});
 page=await app.firstWindow();
 errors=errors.concat(watch(page));
 await page.waitForSelector('.pdf-panel',{timeout:30000});
 await waitBody(FIXTURE_TEXT);
 await page.waitForTimeout(1500);
 const bootToast=await page.locator('#toast').textContent();
 assert.doesNotMatch(bootToast,/Claude/,'sem binário detectado, o boot não tenta conectar (nem toasta)');
 assert.equal(await currentEngine(page),'claude','o motor da sessão segue sendo o Claude Code mesmo sem tentar conectar');
 assert.equal(await page.locator('#status-dot.online').count(),0,'a conversa Claude fica offline sem binário');
 assert.equal(sentinelLines(claudeSentinel).length,0,'sem binário detectado, a CLI nem é executada');
 assert.equal(opencodeStarts().length,0,'sem binário do Claude o OpenCode continua intocado (sem fallback)');
 /* Rollback: a conversa OpenCode de antes continua na lista e reabre com o histórico. */
 const sessionRowsNow=await sessionRows(page);
 const openCodeRow=sessionRowsNow.find(row=>row.id===openCodeSession);
 assert.ok(openCodeRow,'a conversa OpenCode original continua na lista depois dos experimentos Claude');
 assert.match(sessionRowsNow.find(row=>row.id===claudeSession)?.meta||'',/Claude/i,'a conversa Claude também continua listada');
 fs.writeFileSync(opencodeSentinel,'');
 await openSessionById(page,openCodeRow.id);
 await page.waitForFunction(()=>document.querySelector('#session-title')?.dataset.engine==='opencode',undefined,{timeout:60000});
 await statusOnline(page,{timeout:60000});
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.user .body')].some(el=>el.textContent.includes('Pitágoras')),undefined,{timeout:30000});
 assert.equal(await currentEngine(page),'opencode','com a sessão OpenCode ativa, o título volta ao motor OpenCode');
 assert.ok((await page.locator('#messages .message.assistant .katex').count())>=1,'a resposta antiga do OpenCode continua no histórico');
 assert.ok(JSON.stringify(JSON.parse(fs.readFileSync(openCodeSession,'utf8')).messages).includes('Pitágoras'),'o histórico da conversa OpenCode continua no descritor');
 assert.ok(opencodeStarts().length>=1,'a conversa OpenCode continua funcional (serve novo subiu)');

 assert.deepEqual(errors,[],`erros de página: ${JSON.stringify(errors)}`);
 console.log('CLAUDE UI PASSED: descriptor JSON e zero processo OpenCode; texto/imagem sem bolha duplicada; permissões negar/cancelar (com a fila esperando permissão e turno); cancelamento/incerteza sem auto-retry; reabertura com fila recuperada; export pelo histórico nativo paginado; cache visível offline/sem binário sem fallback para o OpenCode; conversa OpenCode preservada.');
});
