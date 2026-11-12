/* Metadados do turno (#119): a fase da entrega, o portão de retomada e a
   última pergunta do motor mudam várias vezes por turno e moram num arquivo
   pequeno ao lado do descritor; a gravação completa do fim do turno leva tudo
   para o descritor e apaga o arquivo. O teste fixa as duas metades: a leitura
   mesclada durante o turno e a reabertura depois de queda continuando incerta.
   Sem Electron, sem motor e sem rede: só fs temporário. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const conversations = require('../src/agents/conversations.cjs');
const {MAX_TURN_METADATA_BYTES} = require('../src/agents/conversation-turn.cjs');

function createDescriptor(runtime) {
  return conversations.createClaudeConversation({runtime, courseId: 'calculo-1'});
}

function sidecarOf(file) {
  return `${file}${conversations.TURN_METADATA_SUFFIX}`;
}

const stored = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

test('metadado do turno fica fora do descritor e a leitura mescla para quem pergunta (#119)', () => {
  const runtime = tempDir('mesa-turn-meta-read');
  const file = createDescriptor(runtime);
  const before = fs.readFileSync(file, 'utf8');

  conversations.writeTurnMetadata(file, {delivery: {id: 'envio-1', status: 'accepted'}, nativeEstablished: true});
  conversations.writeTurnMetadata(file, {nativeTurns: [{user: 'u1', messageId: 'msg_1'}]});

  assert.equal(fs.readFileSync(file, 'utf8'), before, 'o descritor não é reescrito durante o turno');
  assert.ok(fs.existsSync(sidecarOf(file)), 'o turno tem o arquivo pequeno ao lado');
  assert.match(path.basename(sidecarOf(file)), /\.json\.turn$/, 'o nome não termina em .json: busca/pacote/backup não o leem como descritor');
  const record = conversations.readClaudeConversation(file, {runtime});
  assert.deepEqual(record.delivery, {id: 'envio-1', status: 'accepted'});
  assert.equal(record.nativeEstablished, true);
  assert.deepEqual(record.nativeTurns, [{user: 'u1', messageId: 'msg_1'}]);
  assert.equal(conversations.conversationMetadata(file, {runtime}).nativeEstablished, true);
});

test('a gravação completa leva o turno para o descritor e apaga o arquivo pequeno (#119)', () => {
  const runtime = tempDir('mesa-turn-meta-fold');
  const file = createDescriptor(runtime);
  conversations.writeTurnMetadata(file, {
    delivery: {id: 'envio-1', status: 'settled'},
    nativeEstablished: true,
    nativeTurns: [{user: 'u1', messageId: 'msg_1'}],
  });

  const messages = [{role: 'user', content: [{type: 'text', text: 'primeira fala'}]}];
  const updated = conversations.updateClaudeConversation(file, {messages, preview: 'primeira fala'}, {runtime});

  assert.equal(fs.existsSync(sidecarOf(file)), false, 'o arquivo pequeno cumpriu o papel');
  const raw = stored(file);
  assert.deepEqual(raw.delivery, {id: 'envio-1', status: 'settled'});
  assert.equal(raw.nativeEstablished, true);
  assert.deepEqual(raw.nativeTurns, [{user: 'u1', messageId: 'msg_1'}]);
  assert.deepEqual(raw.messages, messages);
  assert.deepEqual(updated.messages, messages);
  assert.equal(conversations.readClaudeConversation(file, {runtime}).delivery.status, 'settled', 'sem o arquivo pequeno, o descritor sozinho continua completo');
});

test('reabrir com entrega em voo no arquivo do turno vira incerta e preserva o resto (#119)', () => {
  const runtime = tempDir('mesa-turn-meta-recover');
  const file = createDescriptor(runtime);
  conversations.writeTurnMetadata(file, {
    delivery: {id: 'envio-1', status: 'accepted'},
    nativeEstablished: true,
    nativeTurns: [{user: 'u1', messageId: 'msg_1'}],
  });

  const recovered = conversations.recoverClaudeConversation(file, {runtime});
  assert.deepEqual(recovered.delivery, {id: 'envio-1', status: 'uncertain'});
  assert.equal(recovered.nativeEstablished, true);
  assert.deepEqual(recovered.nativeTurns, [{user: 'u1', messageId: 'msg_1'}]);
  assert.equal(fs.existsSync(sidecarOf(file)), false);
  const raw = stored(file);
  assert.deepEqual(raw.delivery, {id: 'envio-1', status: 'uncertain'}, 'a incerteza ficou no descritor');
  assert.equal(raw.nativeEstablished, true);
  assert.deepEqual(raw.nativeTurns, [{user: 'u1', messageId: 'msg_1'}]);

  const before = fs.readFileSync(file, 'utf8');
  conversations.recoverClaudeConversation(file, {runtime});
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'a segunda abertura não reescreve');
});

test('arquivo do turno com estado terminal também entra no descritor na abertura (#119)', () => {
  const runtime = tempDir('mesa-turn-meta-settled');
  const file = createDescriptor(runtime);
  conversations.writeTurnMetadata(file, {delivery: {id: 'envio-2', status: 'settled'}});

  const recovered = conversations.recoverClaudeConversation(file, {runtime});
  assert.deepEqual(recovered.delivery, {id: 'envio-2', status: 'settled'});
  assert.equal(fs.existsSync(sidecarOf(file)), false);
  assert.deepEqual(stored(file).delivery, {id: 'envio-2', status: 'settled'});
});

test('a fala aceita fica no arquivo pequeno e só a reabertura a leva ao descritor (#119)', () => {
  const runtime = tempDir('mesa-turn-meta-pending');
  const file = createDescriptor(runtime);
  const fala = {role: 'user', content: [{type: 'text', text: 'pergunta'}]};
  conversations.writeTurnMetadata(file, {delivery: {id: 'envio-3', status: 'accepted'}, pendingMessages: [fala]});

  const common = conversations.readClaudeConversation(file, {runtime});
  assert.equal(common.messages, undefined, 'a leitura comum não junta pendingMessages; só a recuperação');
  assert.deepEqual(stored(sidecarOf(file)).pendingMessages, [fala], 'a fala está no arquivo pequeno');

  const recovered = conversations.recoverClaudeConversation(file, {runtime});
  assert.deepEqual(recovered.messages, [fala]);
  assert.deepEqual(recovered.delivery, {id: 'envio-3', status: 'uncertain'});
  assert.equal(fs.existsSync(sidecarOf(file)), false, 'o arquivo pequeno cumpriu o papel');

  /* O descritor já tem a fala e o arquivo pequeno ficou (queda entre o
     rename e o unlink): reabrir de novo não pode duplicar. */
  conversations.writeTurnMetadata(file, {pendingMessages: [fala]});
  assert.deepEqual(conversations.recoverClaudeConversation(file, {runtime}).messages, [fala]);
});

test('pergunta grande demais perde a imagem antes do texto (#119)', () => {
  const runtime = tempDir('mesa-turn-meta-size');
  const file = createDescriptor(runtime);
  const image = 'A'.repeat(MAX_TURN_METADATA_BYTES);
  const fala = {role: 'user', content: [{type: 'text', text: 'pergunta com anexo'}, {type: 'image', data: image, mimeType: 'image/png'}]};

  conversations.writeTurnMetadata(file, {pendingMessages: [fala]});
  assert.deepEqual(stored(sidecarOf(file)).pendingMessages, [{role: 'user', content: [{type: 'text', text: 'pergunta com anexo'}]}],
    'a imagem sai antes da pergunta, como no teto de `messages`');
  assert.ok(fs.statSync(sidecarOf(file)).size <= MAX_TURN_METADATA_BYTES, 'o arquivo respeita o próprio teto');

  const small = {role: 'user', content: [{type: 'text', text: 'veja'}, {type: 'image', data: 'AAAA', mimeType: 'image/png'}]};
  conversations.writeTurnMetadata(file, {pendingMessages: [small]});
  assert.deepEqual(stored(sidecarOf(file)).pendingMessages, [small], 'a imagem pequena cabe no arquivo');
});

test('arquivo do turno inválido é ignorado e não contamina a leitura (#119)', () => {
  const runtime = tempDir('mesa-turn-meta-invalid');
  const file = createDescriptor(runtime);

  fs.writeFileSync(sidecarOf(file), '{"delivery":');
  let record = conversations.readClaudeConversation(file, {runtime});
  assert.equal(record.delivery, undefined);
  assert.equal(record.nativeEstablished, false);

  fs.writeFileSync(sidecarOf(file), JSON.stringify({delivery: {id: '', status: 'queued'}, nativeEstablished: 'sim', nativeTurns: 'x', pendingMessages: 'x'}));
  record = conversations.readClaudeConversation(file, {runtime});
  assert.equal(record.delivery, undefined);
  assert.equal(record.nativeEstablished, false);
  assert.equal(record.nativeTurns, undefined);
  assert.equal(record.messages, undefined, 'pendingMessages inválido não vira fala na leitura comum');

  fs.writeFileSync(sidecarOf(file), JSON.stringify({delivery: {id: 'envio-1', status: 'accepted'}, pad: 'x'.repeat(MAX_TURN_METADATA_BYTES)}));
  assert.equal(conversations.readClaudeConversation(file, {runtime}).delivery, undefined, 'arquivo acima do teto é ignorado');
});

test('writeTurnMetadata recusa campos fora do contrato sem tocar no arquivo (#119)', () => {
  const runtime = tempDir('mesa-turn-meta-refuse');
  const file = createDescriptor(runtime);
  assert.throws(() => conversations.writeTurnMetadata(file, {delivery: {id: '', status: 'accepted'}}), /delivery/);
  assert.throws(() => conversations.writeTurnMetadata(file, {nativeEstablished: 'sim'}), /nativeEstablished/);
  assert.throws(() => conversations.writeTurnMetadata(file, {nativeTurns: [{user: 1, messageId: 'msg_1'}]}), /nativeTurns/);
  assert.equal(fs.existsSync(sidecarOf(file)), false, 'nada inválido chegou ao disco');
});
