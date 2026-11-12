/* #113: o PNG marcado do `ler_pdf` também é do aluno. O teste alimenta a
   sequência do OpenCode pelo leitor real, passa pelo serviço nativo (o ponto
   comum dos dois motores) e compara o turno vivo com o histórico reaberto. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeAgentAdapter} from './fake-agent-adapter.mjs';
import {fakeIpcMain} from './fake-electron-shell.mjs';
import {historyTurns} from '../src/worklog.mjs';
import {markedImageMessage, markedImagesOf, markOf, markSource} from '../src/marked-pages.mjs';

const require = createRequire(import.meta.url);
const {NativeService} = require('../src/agents/service.cjs');
const {OpenCodeAdapter} = require('../src/agents/opencode-adapter.cjs');
const {OpenCodeEventReader} = require('../src/agents/opencode-events.cjs');
const {ClaudeAdapter} = require('../src/agents/claude-adapter.cjs');
const {exportConversationMarkdown, normalizeClaudeMessages} = require('../src/agents/history.cjs');
const {normalizeHistory} = require('../src/agents/opencode-history.cjs');
const conversations = require('../src/agents/conversations.cjs');
const {registerChatExportHost} = require('../chat-export-host.cjs');

const SESSION = 'ses_113';
const PDF = '/c/Aula.pdf';
const MARKS = [{forma: 'destaque', x: 0.1, y: 0.1, largura: 0.4, altura: 0.2}];
const IMAGE = {type: 'image', data: 'QUJD', mimeType: 'image/png'};

function readerTurn({marcas = MARKS} = {}) {
  const events = [];
  const reader = new OpenCodeEventReader({sessionId: SESSION, now: () => 1_000, emit: (type, payload) => events.push({type, payload})});
  const input = {caminho: PDF, pagina: 2, ...(marcas ? {marcas} : {})};
  reader.handle('session.step.started', {sessionID: SESSION, assistantMessageID: 'msg_a'});
  reader.handle('session.text.delta', {sessionID: SESSION, assistantMessageID: 'msg_a', delta: 'Vou apontar.'});
  reader.handle('session.tool.input.started', {sessionID: SESSION, assistantMessageID: 'msg_a', id: 'call_1', name: 'mesa_ler_pdf'});
  reader.handle('session.tool.called', {sessionID: SESSION, assistantMessageID: 'msg_a', id: 'call_1', input});
  reader.handle('session.tool.success', {sessionID: SESSION, assistantMessageID: 'msg_a', id: 'call_1', content: [{type: 'text', text: '--- p. 2 ---'}, IMAGE]});
  reader.handle('session.step.ended', {sessionID: SESSION, assistantMessageID: 'msg_a'});
  reader.handle('session.step.started', {sessionID: SESSION, assistantMessageID: 'msg_b'});
  reader.handle('session.text.delta', {sessionID: SESSION, assistantMessageID: 'msg_b', delta: 'Está aqui.'});
  reader.handle('session.text.ended', {sessionID: SESSION, assistantMessageID: 'msg_b', text: 'Está aqui.'});
  reader.handle('session.step.ended', {sessionID: SESSION, assistantMessageID: 'msg_b'});
  reader.handle('session.execution.succeeded', {sessionID: SESSION});
  return events;
}

function serviceTurn({marcas = MARKS} = {}) {
  const adapter = fakeAgentAdapter();
  const saved = [];
  const service = new NativeService({adapter, engine: 'opencode', onMessages: (messages) => saved.push(messages)});
  const live = [];
  service.on('event', (event) => live.push(event));
  const toolEnd = readerTurn({marcas}).find((event) => event.type === 'tool_end').payload;
  adapter.emit('event', {type: 'turn_start'});
  adapter.emit('event', {type: 'message_end', message: {role: 'assistant', uuid: 'msg_a', content: [{type: 'text', text: 'Vou apontar.'}, {type: 'toolCall', id: 'call_1', name: 'mesa_ler_pdf', arguments: toolEnd.args}]}});
  adapter.emit('event', {type: 'tool_end', ...toolEnd});
  adapter.emit('event', {type: 'message_end', message: {role: 'assistant', uuid: 'msg_b', content: [{type: 'text', text: 'Está aqui.'}]}});
  adapter.emit('event', {type: 'turn_end'});
  return {adapter, service, saved, live};
}

test('#113: o leitor do OpenCode leva a imagem e os argumentos no tool_end', () => {
  const end = readerTurn().find((event) => event.type === 'tool_end').payload;
  assert.deepEqual(end.images, [{data: 'QUJD', mimeType: 'image/png'}]);
  assert.deepEqual(end.args.marcas, MARKS);
  assert.equal(end.args.pagina, 2);
});

test('#113: o adaptador do Claude também leva a imagem e os argumentos no tool_end', () => {
  const adapter = new ClaudeAdapter({conversationId: 'conv', cwd: '/tmp', sdkLoader: async () => ({})});
  const events = [];
  adapter.on('event', (event) => events.push(event));
  adapter._toolNames.set('t1', 'mcp__mesa__ler_pdf');
  adapter._toolInputs.set('t1', {caminho: PDF, pagina: 2, marcas: MARKS});
  adapter._handleUser({message: {role: 'user', content: [{type: 'tool_result', tool_use_id: 't1', content: [{type: 'text', text: 'ok'}, {type: 'image', source: {type: 'base64', media_type: 'image/png', data: 'QUJD'}}]}]}});
  const end = events.find((event) => event.type === 'tool_end');
  assert.deepEqual(end.images, [{data: 'QUJD', mimeType: 'image/png'}]);
  assert.deepEqual(end.args.marcas, MARKS);
});

test('#113: ler_pdf com marcas vira imagem visível do turno, viva e no histórico', () => {
  const {service, saved, live} = serviceTurn();
  const end = live.find((event) => event.type === 'tool_execution_end');
  assert.ok(end.images.length, 'o evento vivo leva a imagem ao renderer');
  assert.deepEqual(end.images[0], {data: 'QUJD', mimeType: 'image/png', page: 2, file: 'Aula.pdf', source: 'mesa-pdf-mark:2:Aula.pdf'});

  const marked = service.messages.find((message) => message.role === 'assistant' && message.content.some((part) => part.type === 'image'));
  assert.ok(marked, 'o descritor recebeu a mensagem da página marcada');
  assert.deepEqual(marked.content[0], {type: 'image', data: 'QUJD', mimeType: 'image/png', source: markSource(2, PDF, 'call_1')});
  assert.equal(marked.toolCallId, 'call_1', 'a mensagem marcada guarda a chamada que gerou a imagem');
  assert.ok(service.messages.indexOf(marked) > service.messages.findIndex((message) => message.content.some((part) => part.type === 'toolCall' && part.id === 'call_1')), 'a imagem entra depois da chamada');
  assert.ok(saved.at(-1).some((message) => message.content.some((part) => part.type === 'image')), 'a gravação do serviço levou a imagem');

  const turn = historyTurns(saved.at(-1)).at(-1);
  const visual = turn.parts.find((part) => part.type === 'text' && part.images.length);
  assert.ok(visual, 'o histórico reabre com a imagem no turno');
  assert.deepEqual(visual.images, ['data:image/png;base64,QUJD']);
  assert.deepEqual(visual.imageSources, [markSource(2, PDF, 'call_1')]);
  assert.deepEqual(turn.assistantImages, ['data:image/png;base64,QUJD']);
});

test('#113: sem marcas nada muda — a imagem continua só para o tutor', () => {
  const {service, saved, live} = serviceTurn({marcas: null});
  assert.equal(live.find((event) => event.type === 'tool_execution_end').images, undefined, 'o renderer não recebe imagem');
  assert.equal(service.messages.some((message) => message.content.some((part) => part.type === 'image')), false, 'o descritor não ganha mensagem visual');
  assert.equal(historyTurns(saved.at(-1)).at(-1).assistantImages.length, 0, 'o histórico fica como antes');
});

test('#113: duas páginas na mesma chamada mantêm a ordem do turno', () => {
  const adapter = fakeAgentAdapter();
  const service = new NativeService({adapter, engine: 'opencode'});
  const args = { caminho: PDF, marcas: MARKS };
  adapter.emit('event', { type: 'turn_start' });
  adapter.emit('event', { type: 'tool_end', id: 'call_1', name: 'mesa_ler_pdf', result: 'ok', args: { ...args, pagina: 2 }, images: [IMAGE] });
  adapter.emit('event', { type: 'tool_end', id: 'call_2', name: 'mesa_ler_pdf', result: 'ok', args: { ...args, pagina: 3 }, images: [IMAGE] });
  adapter.emit('event', { type: 'message_end', message: { role: 'assistant', uuid: 'msg_a', content: [
    { type: 'toolCall', id: 'call_1', name: 'mesa_ler_pdf', arguments: { ...args, pagina: 2 } },
    { type: 'toolCall', id: 'call_2', name: 'mesa_ler_pdf', arguments: { ...args, pagina: 3 } },
  ] } });
  const marked = service.messages.filter((message) => message.content.some((part) => part.type === 'image'));
  assert.deepEqual(marked.map((message) => message.content[0].source), [markSource(2, PDF, 'call_1'), markSource(3, PDF, 'call_2')]);
});

test('#113: reabrir mantém a página marcada quando o histórico do servidor não a tem', async () => {
  const {service} = serviceTurn();
  const native = [{id: 'm1', type: 'assistant', content: [{type: 'text', text: 'Vou apontar.'}]}, {id: 'm2', type: 'assistant', content: [{type: 'text', text: 'Está aqui.'}]}];
  const adapter = new OpenCodeAdapter({sessionId: SESSION, acquire: async () => ({}), directory: '/w'});
  adapter.connect = async () => {};
  adapter.client = {request: async () => ({ok: true, payload: {data: native}})};
  adapter.cacheHistory(service.messages);
  const history = await adapter.history();
  const marked = history.filter((message) => message.role === 'assistant' && message.content.some((part) => part.type === 'image'));
  assert.equal(marked.length, 1, 'o merge com o descritor preserva a imagem sem duplicar as falas');
  assert.equal(history.filter((message) => message.content.some((part) => part.type === 'text' && part.text === 'Está aqui.')).length, 1);
});

function historyAdapter(prior, nativeRows) {
  const adapter = new OpenCodeAdapter({sessionId: SESSION, acquire: async () => ({}), directory: '/w'});
  adapter.connect = async () => {};
  adapter.client = {request: async () => ({ok: true, payload: {data: nativeRows}})};
  adapter.cacheHistory(prior);
  return adapter;
}

const markedOf = (history) => history.filter((message) => message.role === 'assistant' && message.content.some((part) => part.type === 'image' && markOf(part.source)));

test('#113: sem marca no descritor, reabrir devolve exatamente o histórico do servidor', async () => {
  const nativeRows = [
    {id: 'msg_u', type: 'user', text: 'Explique a página.'},
    {id: 'msg_a', type: 'assistant', parts: [{type: 'reasoning', text: 'penso'}, {type: 'text', text: 'Pronto.'}]},
  ];
  /* Formas diferentes do servidor: prompt do tutor marcado, ids locais,
     pensamento, toolCall/resultado e imagem comum do aluno. Sem marca, nada
     disso pode voltar — o servidor é a base. */
  const prior = [
    {role: 'user', content: [{type: 'text', text: '[[mesa-tutor-prompt]]\nVocê é o tutor da Summa: …\n[[/mesa-tutor-prompt]]\n\nExplique a página.'}], uuid: 'local-u'},
    {role: 'assistant', content: [{type: 'thinking', thinking: 'outro'}, {type: 'toolCall', id: 'call_local', name: 'mesa_ler_pdf', arguments: {caminho: PDF}}], uuid: 'local-a'},
    {role: 'toolResult', toolCallId: 'call_local', content: [{type: 'text', text: '--- p. 2 ---'}]},
    {role: 'user', content: [{type: 'image', data: 'QUJD', mimeType: 'image/png'}], uuid: 'local-img'},
    {role: 'assistant', content: [{type: 'text', text: 'Pronto.'}], uuid: 'local-b'},
  ];
  const history = await historyAdapter(prior, nativeRows).history();
  assert.deepEqual(history, normalizeHistory(nativeRows), 'sem marca, o descritor inteiro fica de fora');
});

test('#113: reabrir reinsere a página marcada uma vez, logo depois da chamada certa', async () => {
  const nativeRows = [
    {id: 'msg_u', type: 'user', text: 'Aponte a página 2.'},
    {id: 'msg_a', type: 'assistant', parts: [
      {type: 'text', text: 'Vou apontar.'},
      {type: 'tool', id: 'call_1', name: 'mesa_ler_pdf', state: {status: 'completed', input: {caminho: PDF, pagina: 2, marcas: MARKS}, content: [{type: 'text', text: '--- p. 2 ---'}]}},
    ]},
    {id: 'msg_b', type: 'assistant', parts: [{type: 'text', text: 'Está aqui.'}]},
  ];
  const marked = markedImageMessage([{data: 'QUJD', mimeType: 'image/png', source: markSource(2, PDF)}], 2_000, 'call_1');
  const prior = [
    {role: 'user', content: [{type: 'text', text: 'Aponte a página 2.'}], uuid: 'local-u'},
    {role: 'assistant', content: [{type: 'text', text: 'Vou apontar.'}, {type: 'toolCall', id: 'call_1', name: 'mesa_ler_pdf', arguments: {caminho: PDF, pagina: 2, marcas: MARKS}}], uuid: 'local-a'},
    marked,
    {role: 'assistant', content: [{type: 'text', text: 'Está aqui.'}], uuid: 'local-b'},
  ];
  const history = await historyAdapter(prior, nativeRows).history();
  const callAt = history.findIndex((message) => message.content.some((part) => part.type === 'toolCall' && part.id === 'call_1'));
  const markedAt = history.findIndex((message) => message.content.some((part) => part.type === 'image' && markOf(part.source)));
  assert.equal(markedAt, callAt + 1, 'a imagem entra logo depois da chamada do mesmo id');
  assert.equal(markedOf(history).length, 1, 'a página marcada entra uma vez');
  assert.equal(history.filter((message) => message.content.some((part) => part.type === 'text' && part.text === 'Está aqui.')).length, 1);
  assert.equal(history.filter((message) => message.content.some((part) => part.type === 'text' && part.text === 'Vou apontar.')).length, 1);
});

test('#113: reabrir duas vezes não duplica a página marcada nem as falas', async () => {
  const nativeRows = [
    {id: 'msg_u', type: 'user', text: 'Aponte a página 2.'},
    {id: 'msg_a', type: 'assistant', parts: [
      {type: 'text', text: 'Vou apontar.'},
      {type: 'tool', id: 'call_1', name: 'mesa_ler_pdf', state: {status: 'completed', input: {caminho: PDF, pagina: 2, marcas: MARKS}, content: []}},
    ]},
    {id: 'msg_b', type: 'assistant', parts: [{type: 'text', text: 'Está aqui.'}]},
  ];
  /* O que o descritor tem depois da gravação: a normalização do
     `updateClaudeConversation` descarta o campo `toolCallId`, e a chamada
     sobrevive no `source` da imagem. */
  const stored = normalizeClaudeMessages([markedImageMessage([{data: 'QUJD', mimeType: 'image/png', source: markSource(2, PDF)}], 2_000, 'call_1')])[0];
  const adapter = historyAdapter([stored], nativeRows);
  const first = await adapter.history();
  adapter.cacheHistory(first);
  const second = await adapter.history();
  assert.deepEqual(second, first, 'a segunda abertura devolve o mesmo histórico');
  assert.equal(markedOf(second).length, 1, 'a imagem continua uma só');
  assert.equal(second.filter((message) => message.content.some((part) => part.type === 'text' && part.text === 'Está aqui.')).length, 1);
});

test('#113: exportar conversa Claude com histórico nativo leva a página marcada uma vez', async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-export-claude-'));
  try {
    const session = conversations.createClaudeConversation({runtime, courseId: 'calc'});
    const marked = markedImageMessage([{data: 'QUJD', mimeType: 'image/png', source: markSource(2, PDF)}], 2_000, 'call_1');
    conversations.updateClaudeConversation(session, {
      nativeEstablished: true,
      messages: [
        {role: 'user', content: [{type: 'text', text: 'Aponte a página 2.'}]},
        {role: 'assistant', content: [{type: 'text', text: 'Vou apontar.'}, {type: 'toolCall', id: 'call_1', name: 'mcp__mesa__ler_pdf', arguments: {}}]},
        marked,
        {role: 'assistant', content: [{type: 'text', text: 'Está aqui.'}]},
      ],
    }, {runtime});
    const nativeRows = [
      {type: 'user', uuid: 'u1', message: {role: 'user', content: [{type: 'text', text: 'Aponte a página 2.'}]}},
      {type: 'assistant', uuid: 'a1', message: {role: 'assistant', content: [{type: 'text', text: 'Vou apontar.'}, {type: 'tool_use', id: 'call_1', name: 'mcp__mesa__ler_pdf', input: {}}]}},
      {type: 'assistant', uuid: 'a2', message: {role: 'assistant', content: [{type: 'text', text: 'Está aqui.'}]}},
    ];
    const labels = {
      'export.you': 'Você',
      'export.imageAttached': '[imagem]',
      'export.exportedOn': 'Exportado em {date}',
      'talk.imageMarkedPageFile': 'Página {page} de {file} com marcas do tutor',
      'talk.imageMarkedPage': 'Página {page} do PDF com marcas do tutor',
    };
    const ipcMain = fakeIpcMain();
    const live = {config: {}, courses: [{id: 'calc', name: 'Cálculo'}], courseId: 'calc', session, bridge: null, win: null,
      languageHost: {t: (key, args = {}) => String(labels[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(args[name] ?? ''))}};
    registerChatExportHost({ipcMain, live, runtime, envRuntime: runtime, dialog: null, shell: null, appendLog: () => {}, engine: () => 'claude',
      testClaudeSdkLoader: () => async () => ({getSessionMessages: async (id, options = {}) => (options.offset ? [] : nativeRows)})});
    const result = await ipcMain.invoke('export-chat');
    assert.equal(result.saved, true);
    const body = fs.readFileSync(result.file, 'utf8');
    assert.equal((body.match(/!\[Página 2 de Aula\.pdf com marcas do tutor\]\(data:image\/png;base64,QUJD\)/g) || []).length, 1, 'a página marcada sai uma vez');
    assert.equal((body.match(/Está aqui\./g) || []).length, 1, 'a resposta final não repete');
    assert.equal((body.match(/Vou apontar\./g) || []).length, 1, 'a fala antes da chamada não repete');
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});

test('#113: a exportação leva a imagem marcada como figura, não como anexo', () => {
  const {saved} = serviceTurn();
  const body = exportConversationMarkdown({courseName: 'Cálculo', engine: 'opencode', messages: saved.at(-1), now: 0});
  assert.match(body, /!\[Página 2 de Aula\.pdf com marcas do tutor\]\(data:image\/png;base64,QUJD\)/);
});

test('exportação: nome do PDF no alt não injeta Markdown/HTML', () => {
  const evil = 'x](https://atacante/img)<img src=x>';
  /* O `source` é dado guardado: o nome chega cru ao `markOf` (o `markSource`
     normal do app só usa o basename, mas a exportação não pode confiar nisso). */
  const messages = [{role: 'assistant', content: [{type: 'image', data: 'QUJD', mimeType: 'image/png', source: `mesa-pdf-mark:1:${evil}`}]}];
  const body = exportConversationMarkdown({courseName: 'X', engine: 'pi', messages, now: 0});
  assert.equal(body.includes(evil), false, 'o nome cru não sobrevive ao alt');
  assert.match(body, /!\[Página 1 de x\\\]\(https:\/\/atacante\/img\)\\<img src=x\\> com marcas do tutor\]\(data:image\/png;base64,QUJD\)/);
  const multiline = exportConversationMarkdown({
    courseName: 'X', engine: 'pi', messages, now: 0,
    labels: {you: 'Você', imageAttached: '[imagem anexada]', imageMarkedPage: () => 'Página 2\n## Falso', exportedOn: (iso) => iso},
  });
  assert.match(multiline, /!\[Página 2 ## Falso\]\(data:image\/png;base64,QUJD\)/, 'quebra de linha vira espaço');
});

test('#113: o marcador da imagem é o mesmo nos dois lados', () => {
  assert.equal(markSource(2, PDF), 'mesa-pdf-mark:2:Aula.pdf');
  assert.deepEqual(markOf('mesa-pdf-mark:2:Aula.pdf'), {page: 2, file: 'Aula.pdf'});
  assert.deepEqual(markOf(markSource(2, PDF, 'call_1')), {page: 2, file: 'Aula.pdf'}, 'a chamada no source não vaza para o rótulo');
  assert.equal(markOf('captura.png'), null);
  assert.equal(markedImagesOf({name: 'mcp__mesa__ler_pdf', args: {marcas: MARKS, pagina: 2, caminho: PDF}, images: [IMAGE]})[0].source, 'mesa-pdf-mark:2:Aula.pdf');
  assert.deepEqual(markedImagesOf({name: 'mcp__mesa__ler_pdf', args: {}, images: [IMAGE]}), []);
});
