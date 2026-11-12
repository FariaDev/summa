// Mídia do histórico sob demanda (#121): o payload de abertura leva marcador
// (id opaco, tipo, bytes, mime) em vez de base64/texto longo; o handler resolve
// só a conversa aberta, recusa id de outra e valida o tamanho da resposta.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeIpcMain} from './fake-electron-shell.mjs';
import {fakeTutorBridge} from './fake-tutor-bridge.mjs';

const require = createRequire(import.meta.url);
const {createHistoryMediaHost, registerHistoryMediaIpc, MIN_TOOL_OUTPUT_BYTES} = require('../history-media-host.cjs');
const {registerTutorSessionIpc} = require('../tutor-session-ipc.cjs');
const {createPromptImages} = require('../prompt-images.cjs');
const {historyTurns} = await import('../src/worklog.mjs');
const {searchEntries} = await import('../src/chat-search.mjs');

const dirs = [];
after(() => { for (const dir of dirs) fs.rmSync(dir, {recursive: true, force: true}); });

const imageData = (label) => Buffer.from(label).toString('base64');
const imagePart = (label) => ({type: 'image', data: imageData(label), mimeType: 'image/png', source: `captura-${label}.png`});
const longText = (size = MIN_TOOL_OUTPUT_BYTES + 500) => 'linha de resultado; '.repeat(Math.ceil(size / 18));
const liveFor = (session) => ({session, win: {isDestroyed: () => false, webContents: {}}});

function mediaHost({session = '/rt/conversations/claude-a.json', trimMessageImages, ...options} = {}) {
  const live = liveFor(session);
  return {live, media: createHistoryMediaHost({live, trimMessageImages, ...options})};
}

test('markerize troca imagem e saída longa por marcador sem tocar na fonte', () => {
  const {media} = mediaHost();
  const messages = [
    {role: 'user', content: [{type: 'text', text: 'Pergunta'}, imagePart('um')]},
    {role: 'assistant', content: [{type: 'text', text: 'Resposta'}]},
    {role: 'toolResult', content: [{type: 'text', text: longText()}], toolCallId: 't1'},
  ];
  const before = JSON.stringify(messages);
  const marked = media.markerize(messages);
  assert.equal(JSON.stringify(messages), before, 'a fonte do serviço/descritor não é mutada');

  const image = marked[0].content[1];
  assert.equal(image.data, undefined, 'o base64 não atravessa o IPC');
  assert.match(image.url, /^mesa-history-media:hm-[0-9a-f]{32}\?/);
  assert.equal(image.historyMedia.kind, 'image');
  assert.equal(image.historyMedia.mime, 'image/png');
  assert.equal(image.historyMedia.bytes, Buffer.from('um').length);
  assert.equal(image.source, 'captura-um.png', 'o rótulo acessível sobrevive');

  const tool = marked[2].content[0];
  assert.ok(tool.text.length < longText().length, 'a saída longa vira resumo');
  assert.match(tool.text, /linha de resultado/);
  assert.equal(tool.historyMedia.kind, 'tool-output');
  assert.equal(tool.historyMedia.mime, 'text/plain');
  assert.equal(tool.historyMedia.bytes, Buffer.byteLength(longText(), 'utf8'));

  const payload = JSON.stringify(marked);
  assert.ok(!payload.includes(imageData('um')), 'nenhum base64 no payload');
  assert.ok(!payload.includes(longText()), 'nenhuma saída inteira no payload');
  assert.ok(payload.length * 4 < before.length, `payload cai (${payload.length} < ${before.length})`);

  const again = media.markerize(messages);
  assert.deepEqual(again, marked, 'o id é estável entre aberturas da mesma conversa');
  assert.equal(media.read(image.historyMedia.id).dataUrl, `data:image/png;base64,${imageData('um')}`);
  assert.equal(media.read(tool.historyMedia.id).text, longText());
});

test('saída no limite de caracteres com multibyte ainda é legível', () => {
  const {media} = mediaHost();
  const text = 'ç'.repeat(300_000);
  assert.equal(text.length, 300_000);
  const marked = media.markerize([{role: 'toolResult', content: [{type: 'text', text}], toolCallId: 't1'}]);
  const info = marked[0].content[0].historyMedia;
  assert.equal(info.kind, 'tool-output');
  assert.equal(info.bytes, Buffer.byteLength(text, 'utf8'));
  assert.equal(media.read(info.id).text, text, 'validação usa caracteres do descritor, não bytes UTF-8');
});

test('saída curta continua inteira; só a longa ganha marcador', () => {
  const {media} = mediaHost();
  const short = 'ok';
  const marked = media.markerize([{role: 'toolResult', content: [{type: 'text', text: short}], toolCallId: 't1'}]);
  assert.equal(marked[0].content[0].text, short);
  assert.equal(marked[0].content[0].historyMedia, undefined);
});

test('trimMessageImages continua valendo: só as 6 últimas imagens entram no payload', () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-history-media-'));
  dirs.push(runtime);
  const trimMessageImages = createPromptImages({runtime, deskDir: path.resolve(import.meta.dirname, '..'),
    learningRoot: path.join(runtime, 'learning'), nativeImage: {createFromBuffer: () => ({isEmpty: () => true})}}).trimMessageImages;
  const {media} = mediaHost({trimMessageImages});
  const messages = Array.from({length: 8}, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    content: [{type: 'text', text: `mensagem ${index}`}, imagePart(`imagem-${index}`)],
  }));
  const marked = media.markerize(messages);
  assert.equal(marked.filter(message => message.content.some(part => part.type === 'image')).length, 6,
    'a tela recebe no máximo 6 mensagens com imagem');
  assert.equal(messages.filter(message => message.content.some(part => part.type === 'image')).length, 8,
    'a fonte continua com as 8');
});

test('id inválido, id de outra conversa e tamanho acima do teto são recusados', () => {
  const {live, media} = mediaHost({session: '/rt/conversations/claude-a.json'});
  const marked = media.markerize([{role: 'user', content: [imagePart('a')]}]);
  const id = marked[0].content[0].historyMedia.id;

  assert.throws(() => media.read('hm-xyz'), /received\uE001"hm-xyz"\uE001expected\uE001string\(hm-<32 hex>\)/);
  assert.throws(() => media.read(`hm-${'0'.repeat(32)}`), /id de mídia da conversa aberta/);

  live.session = '/rt/conversations/claude-b.json';
  assert.throws(() => media.read(id), /id de mídia da conversa aberta/, 'id da conversa que saiu não resolve');

  const small = mediaHost({maxImageBytes: 1});
  const markedSmall = small.media.markerize([{role: 'user', content: [imagePart('bb')]}]);
  const smallId = markedSmall[0].content[0].historyMedia.id;
  assert.throws(() => small.media.read(smallId), /field\uE001bytes\uE001received\uE0012\uE001expected\uE001number\(0\.\.1\)/);
});

test('o canal history-media-read só atende a janela principal e só a conversa aberta', async () => {
  const live = liveFor('/rt/conversations/claude-a.json');
  const ipcMain = fakeIpcMain();
  const media = registerHistoryMediaIpc({ipcMain, live, trimMessageImages: (messages) => messages});
  const marked = media.markerize([{role: 'user', content: [imagePart('canal')]}]);
  const id = marked[0].content[0].historyMedia.id;
  const handler = ipcMain.handlers.get('history-media-read');

  assert.throws(() => handler({sender: {}}, {id}), /remetente recusado/);
  assert.throws(() => handler({sender: live.win.webContents}, {id: 3}), /field\uE001id\uE001received\uE0013\uE001/);
  const hit = handler({sender: live.win.webContents}, {id});
  assert.equal(hit.kind, 'image');
  assert.equal(hit.dataUrl, `data:image/png;base64,${imageData('canal')}`);
});

test('pi-connect manda marcadores e o mesmo canal devolve os bytes completos', async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-history-media-ipc-'));
  dirs.push(runtime);
  const messages = [
    {role: 'user', content: [{type: 'text', text: 'Pergunta'}, imagePart('ipc')], timestamp: 1_000},
    {role: 'assistant', content: [{type: 'text', text: 'Resposta'}], timestamp: 2_000},
    {role: 'toolResult', content: [{type: 'text', text: longText()}], toolCallId: 't1', timestamp: 3_000},
  ];
  const bridge = fakeTutorBridge({get_state: {}, get_messages: {messages}, get_available_models: {models: []}});
  const ipcMain = fakeIpcMain();
  const live = {...liveFor('/rt/conversations/claude-a.json'), bridge, levelsMod: {getSupportedThinkingLevels: () => []},
    languageHost: {logText: (text) => text}, opencodeHost: {liveReady: async () => {}, annotate: (models) => models}};
  registerTutorSessionIpc({ipcMain, live, runtime, pendingDialogs: new Set(), appendLog: () => {}, engine: () => 'claude',
    connect: () => bridge, stopBridge: () => {}, assertIdle: async () => {}, persist: () => {}, courseSessions: () => [],
    conversationData: () => ({engine: 'claude', cards: []}), captureAvailable: () => false, historyIdentity: () => 'id-1',
    trimMessageImages: (list) => list, isNative: () => true});
  const out = await ipcMain.invoke('pi-connect');
  const image = out.messages[0].content[1];
  assert.equal(image.data, undefined);
  assert.match(image.url, /^mesa-history-media:/);
  const tool = out.messages[2].content[0];
  assert.ok(tool.text.length < longText().length);
  const handler = ipcMain.handlers.get('history-media-read');
  assert.equal(handler({sender: live.win.webContents}, {id: image.historyMedia.id}).dataUrl,
    `data:image/png;base64,${imageData('ipc')}`);
  assert.equal(handler({sender: live.win.webContents}, {id: tool.historyMedia.id}).text, longText());
  live.session = '/rt/conversations/claude-b.json';
  assert.throws(() => handler({sender: live.win.webContents}, {id: image.historyMedia.id}), /id de mídia da conversa aberta/);
});

test('historyTurns e a busca continuam lendo o texto completo do payload marcado', () => {
  const {media} = mediaHost();
  const messages = [
    {role: 'user', content: [{type: 'text', text: 'Pergunta buscável'}, imagePart('busca')]},
    {role: 'assistant', content: [{type: 'text', text: 'Resposta buscável com detalhe'}, {type: 'toolCall', id: 't1', name: 'ler_pdf', arguments: {}}]},
    {role: 'toolResult', content: [{type: 'text', text: longText()}], toolCallId: 't1'},
    {role: 'assistant', content: [{type: 'text', text: 'Fechamento'}]},
  ];
  const marked = media.markerize(messages);
  const turns = historyTurns(marked);
  assert.equal(turns[0].userText, 'Pergunta buscável');
  assert.equal(turns[0].userImages[0], marked[0].content[1].url, 'a imagem marcada continua no turno');
  assert.equal(turns[0].text, 'Resposta buscável com detalhe\n\nFechamento');
  const hits = searchEntries([{text: turns[0].userText}, {text: turns[0].text}], 'buscavel');
  assert.equal(hits.total, 2, 'a busca acha a pergunta e a resposta marcadas');
  assert.equal(turns[0].steps[0].resultMarker.kind, 'tool-output', 'o passo guarda o marcador para pedir a saída');
  assert.ok(turns[0].steps[0].resultText.length < longText().length, 'o resumo entra no diário');
});
