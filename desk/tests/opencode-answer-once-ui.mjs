/* A resposta do tutor aparece UMA vez (#104), na janela real, contra o
   `opencode serve` falso.

   O texto vivo chega com `contentIndex: 0`; desde o #146 o `message_end` leva o
   pensamento antes da fala no `content`, e o renderer derivava o índice do
   array (1). A chave do bloco não casava com a do stream e a mesma fala virava
   um SEGUNDO balão. O roteiro do fake tem o pensamento no MESMO passo do texto,
   como o modelo real entrega a resposta. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,sendEnabled,statusOnline,fakeEngineLauncher} from './helpers.mjs';

const require=createRequire(import.meta.url);
const conversations=require('../src/agents/conversations.cjs');
const FAKE_OPENCODE_BIN=fakeEngineLauncher(path.resolve(import.meta.dirname,'fake-opencode.mjs'));

async function answerOnce(ctx,name,steps,prompt,answer){
 const runtime=ctx.runtime=newRuntime(name),folder=seedCourse(runtime,'Calculo');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculo',name:'Cálculo',path:folder}]});
 const first=conversations.createClaudeConversation({runtime,courseId:'Calculo',engine:'opencode'});
 writeDeskJson(runtime,{courseId:'Calculo',session:first,courseStates:{Calculo:{session:first,sessions:[{path:first}]}}});
 fs.chmodSync(FAKE_OPENCODE_BIN,0o755);
 const app=ctx.app=await launchDesk({runtime,opencode:false,env:{LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,FAKE_OPENCODE_STEPS:JSON.stringify(steps)}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));

 await statusOnline(page,{timeout:60000});
 await page.locator('#prompt').fill(prompt);
 await page.locator('#send').click();
 await page.waitForFunction(text=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes(text)),answer,{timeout:30000});
 await sendEnabled(page,{timeout:30000});

 const bodies=await page.evaluate(()=>[...document.querySelectorAll('.message.assistant .body')].map(el=>el.textContent.trim()));
 const copies=bodies.filter(text=>text.includes(answer)).length;
 assert.equal(copies,1,`${name}: a resposta aparece em ${copies} balões: ${JSON.stringify(bodies)}`);
 assert.deepEqual(errors,[]);
 await app.close();ctx.app=null;
}

/* Resposta simples de texto, sem ferramenta: o pensamento e a fala vêm no
   mesmo passo do modelo, como no turno real que o autor viu duplicar. */
await withArtifacts('opencode-answer-once-simple',ctx=>answerOnce(ctx,'opencode-answer-once-simple',[
 {think:'Pensei na resposta.',text:'Uma resposta simples.'},
],'responda em uma frase','Uma resposta simples.'));

/* O turno do relato (#104): duas ferramentas e o texto final. */
await withArtifacts('opencode-answer-once-tools',ctx=>answerOnce(ctx,'opencode-answer-once-tools',[
 {tool:{name:'mesa_calcular',input:{expressao:'2+2'},output:'4'}},
 {tool:{name:'mesa_calcular',input:{expressao:'3+3'},output:'6'}},
 {think:'Conferi as duas contas.',text:'A resposta final é 4 e 6.'},
],'duas ferramentas e depois o texto','A resposta final é 4 e 6.'));

console.log('ok opencode-answer-once-ui');
