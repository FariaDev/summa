/* Anexos da conversa em arquivo próprio (#4): o descritor guarda referência
   endereçada por conteúdo, a leitura resolve de volta, a migração do descritor
   antigo não perde imagem e apagar uma conversa não toca na outra. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const conversations = require('../src/agents/conversations.cjs');
const attachments = require('../src/agents/conversation-attachments.cjs');

const IMAGE_A = {type: 'image', data: Buffer.from('imagem A').toString('base64'), mimeType: 'image/png', source: 'captura.png'};
const IMAGE_B = {type: 'image', data: Buffer.from('imagem B').toString('base64'), mimeType: 'image/jpeg'};

function withRuntime(fn) {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-attachments-'));
  try {
    return fn(runtime);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
}

function conversationWith(runtime, messages) {
  const file = conversations.createClaudeConversation({runtime, courseId: 'calc'});
  conversations.updateClaudeConversation(file, {messages}, {runtime});
  return file;
}

function rawDescriptor(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function attachmentFiles(dir) {
  return readdirSync(dir).filter((name) => !name.startsWith('.'));
}

function imagesOf(messages) {
  return messages.flatMap((message) => message.content).filter((part) => part?.type === 'image');
}

test('externaliza por conteúdo, deduplica a mesma imagem e resolve para os mesmos bytes', () => {
  withRuntime((runtime) => {
    const file = conversationWith(runtime, [
      {role: 'user', content: [{type: 'text', text: 'primeira'}, IMAGE_A]},
      {role: 'assistant', content: [IMAGE_A]},
      {role: 'user', content: [IMAGE_B]},
    ]);
    const stored = conversations.readClaudeConversation(file, {runtime}).messages;
    assert.equal(JSON.stringify(stored).includes('"data"'), false, 'o descritor não guarda base64');
    const images = imagesOf(stored);
    assert.equal(images.length, 3, 'toda imagem continua referenciada');
    assert.equal(images[0].attachment, images[1].attachment, 'a mesma imagem usa o mesmo arquivo');
    assert.notEqual(images[0].attachment, images[2].attachment);
    assert.match(images[0].attachment, /^[0-9a-f]{64}\.png$/);
    assert.match(images[2].attachment, /^[0-9a-f]{64}\.jpg$/);
    const dir = attachments.conversationAttachmentsDir(runtime, file);
    assert.deepEqual(attachmentFiles(dir).sort(), [...new Set([images[0].attachment, images[2].attachment])].sort(), 'um arquivo por conteúdo');
    assert.deepEqual(readdirSync(dir).filter((name) => name.includes('.tmp-')), [], 'gravação atômica não deixa temporário');
    const expected = createHash('sha256').update(Buffer.from('imagem A')).digest('hex');
    assert.equal(images[0].attachment, `${expected}.png`, 'o nome vem do hash do conteúdo');
    const resolved = attachments.resolveMessages(stored, {runtime, descriptor: file});
    assert.deepEqual(imagesOf(resolved).map((part) => [part.data, part.mimeType, part.source]),
      [[IMAGE_A.data, 'image/png', 'captura.png'], [IMAGE_A.data, 'image/png', 'captura.png'], [IMAGE_B.data, 'image/jpeg', undefined]]);
  });
});

test('descritor antigo com data inline abre e migra na próxima gravação sem perder imagem', () => {
  withRuntime((runtime) => {
    const file = conversations.createClaudeConversation({runtime, courseId: 'calc'});
    const old = rawDescriptor(file);
    old.preview = 'conversa antiga';
    old.messages = [
      {role: 'user', content: [{type: 'text', text: 'veja'}, IMAGE_A], timestamp: 10},
      {role: 'assistant', content: [{type: 'text', text: 'vi'}, IMAGE_B], timestamp: 20},
    ];
    writeFileSync(file, JSON.stringify(old));
    assert.deepEqual(imagesOf(conversations.readClaudeConversation(file, {runtime}).messages).map((part) => part.data),
      [IMAGE_A.data, IMAGE_B.data], 'o descritor antigo continua abrindo');

    conversations.updateClaudeConversation(file, {preview: 'conversa migrada'}, {runtime});
    const migrated = conversations.readClaudeConversation(file, {runtime});
    assert.equal(JSON.stringify(migrated).includes('"data"'), false, 'a gravação sem messages também migra');
    assert.equal(migrated.preview, 'conversa migrada');
    assert.deepEqual(imagesOf(migrated.messages).map((part) => part.bytes),
      [Buffer.byteLength('imagem A'), Buffer.byteLength('imagem B')], 'os bytes viram metadado');
    const resolved = attachments.resolveMessages(migrated.messages, {runtime, descriptor: file});
    assert.deepEqual(imagesOf(resolved).map((part) => part.data), [IMAGE_A.data, IMAGE_B.data], 'nenhuma imagem some na migração');
  });
});

test('gravação com messages também migra o prefixo antigo e preserva a ordem', () => {
  withRuntime((runtime) => {
    const file = conversations.createClaudeConversation({runtime, courseId: 'calc'});
    const raw = rawDescriptor(file);
    raw.messages = [{role: 'user', content: [{type: 'text', text: 'antiga'}, IMAGE_A]}];
    writeFileSync(file, JSON.stringify(raw));
    conversations.updateClaudeConversation(file, {messages: [
      {role: 'user', content: [{type: 'text', text: 'antiga'}, IMAGE_A]},
      {role: 'assistant', content: [{type: 'text', text: 'nova'}]},
    ]}, {runtime});
    const stored = conversations.readClaudeConversation(file, {runtime}).messages;
    assert.deepEqual(stored.map((message) => message.content[0].text), ['antiga', 'nova']);
    assert.equal(imagesOf(stored)[0].data, undefined);
    assert.equal(imagesOf(stored)[0].bytes, Buffer.byteLength('imagem A'));
  });
});

test('anexo ausente vira marcador visível e não derruba a leitura', () => {
  withRuntime((runtime) => {
    const file = conversationWith(runtime, [
      {role: 'user', content: [{type: 'text', text: 'oi'}, {type: 'image', attachment: `${'0'.repeat(64)}.png`, mimeType: 'image/png', bytes: 4}]},
      {role: 'assistant', content: [{type: 'text', text: 'tudo bem'}]},
    ]);
    const stored = conversations.readClaudeConversation(file, {runtime});
    const resolved = attachments.resolveMessages(stored.messages, {runtime, descriptor: file});
    assert.deepEqual(resolved[0].content[1], {type: 'text', text: attachments.MISSING_IMAGE_TEXT});
    assert.deepEqual(resolved[1].content, [{type: 'text', text: 'tudo bem'}]);
    assert.deepEqual(attachments.resolveImageParts([{type: 'image', attachment: `${'0'.repeat(64)}.png`, mimeType: 'image/png', bytes: 4}], {runtime, descriptor: file}), [], 'reenvio omite anexo perdido');
  });
});

test('id vem do nome do descritor e recusa separador/.. antes de virar caminho', () => {
  withRuntime((runtime) => {
    const dir = join(runtime, 'conversations');
    assert.throws(() => attachments.conversationAttachmentsDir(runtime, join(dir, '..', 'escape.json')),
      /id da conversa inválido: recebido .*esperado .*claude-<uuid>\.json/);
    assert.throws(() => attachments.conversationAttachmentsDir(runtime, join(dir, 'claude-..-..-..-...json')),
      /id da conversa inválido/);
    assert.throws(() => attachments.externalizeMessages([{role: 'user', content: [IMAGE_A]}], {runtime, descriptor: join(dir, 'nota.json')}),
      /id da conversa inválido/);
    const textOnly = [{role: 'user', content: [{type: 'text', text: 'só texto'}]}];
    assert.equal(attachments.externalizeMessages(textOnly, {runtime, descriptor: 'x'}), textOnly, 'sem imagem não valida o id');
  });
});

test('descritor recusa referência de anexo fora do formato, sem data ou bytes', () => {
  withRuntime((runtime) => {
    const file = conversations.createClaudeConversation({runtime, courseId: 'calc'});
    const raw = rawDescriptor(file);
    for (const part of [
      {type: 'image', attachment: '../../escape.png', mimeType: 'image/png', bytes: 4},
      {type: 'image', attachment: `${'a'.repeat(64)}.png`, mimeType: 'image/png'},
      {type: 'image', attachment: `${'a'.repeat(64)}.png`, mimeType: 'image/png', bytes: 0},
      {type: 'image', attachment: `${'a'.repeat(64)}.png`, mimeType: 'image/png', bytes: 4, data: 'AAAA'},
    ]) {
      writeFileSync(file, JSON.stringify({...raw, messages: [{role: 'user', content: [part]}]}));
      assert.equal(conversations.readClaudeConversation(file, {runtime}), null);
    }
  });
});

test('apagar a conversa apaga só a pasta dela; anexo de outra (mesmo sem referência) fica', () => {
  withRuntime((runtime) => {
    const first = conversationWith(runtime, [{role: 'user', content: [IMAGE_A]}]);
    const second = conversationWith(runtime, [{role: 'user', content: [IMAGE_B]}]);
    const firstDir = attachments.conversationAttachmentsDir(runtime, first);
    const secondDir = attachments.conversationAttachmentsDir(runtime, second);
    const orphan = join(secondDir, `${'f'.repeat(64)}.png`);
    writeFileSync(orphan, 'sem referência');
    assert.deepEqual(conversations.removeClaudeConversation(first, {runtime}), {descriptor: true, attachments: true});
    assert.equal(existsSync(first), false);
    assert.equal(existsSync(firstDir), false);
    assert.equal(existsSync(second), true);
    assert.ok(attachmentFiles(secondDir).includes(`${'f'.repeat(64)}.png`), 'outra conversa não é tocada');
    assert.deepEqual(conversations.readClaudeConversation(second, {runtime}).messages.length, 1);
    assert.throws(() => conversations.removeClaudeConversation(join(runtime, 'fora.json'), {runtime}), /descritor da conversa inválido/);
    assert.equal(existsSync(join(runtime, 'fora.json')), false);
  });
});

test('a fala pendente do turno com imagem entra no descritor como anexo na recuperação', () => {
  withRuntime((runtime) => {
    const file = conversations.createClaudeConversation({runtime, courseId: 'calc'});
    conversations.writeTurnMetadata(file, {pendingMessages: [{role: 'user', content: [IMAGE_A]}]});
    const recovered = conversations.recoverClaudeConversation(file, {runtime});
    const image = imagesOf(recovered.messages)[0];
    assert.match(image.attachment, /^[0-9a-f]{64}\.png$/);
    assert.equal(image.data, undefined);
    const resolved = attachments.resolveMessages(recovered.messages, {runtime, descriptor: file});
    assert.equal(imagesOf(resolved)[0].data, IMAGE_A.data);
  });
});

test('openCode usa a mesma pasta por conversa', () => {
  withRuntime((runtime) => {
    const file = conversations.createClaudeConversation({runtime, courseId: 'calc', engine: 'opencode'});
    const id = attachments.conversationIdOf(file);
    assert.match(id, /^opencode-[0-9a-f-]{36}$/);
    assert.equal(attachments.conversationAttachmentsDir(runtime, file), join(runtime, 'conversations', 'attachments', id));
  });
});
