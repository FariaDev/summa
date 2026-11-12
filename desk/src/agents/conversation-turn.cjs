'use strict';

/* Estado do turno em voo (#119): a fase da entrega, o portão de retomada e a
   última pergunta do motor mudam várias vezes num turno. Em vez de reescrever
   o descritor inteiro (~90 ms com 5.000 mensagens) a cada mudança, vão para um
   arquivo pequeno ao lado; a gravação completa do fim do turno leva tudo para o
   descritor e apaga o arquivo. Fica fora de `conversations.cjs` para aquele
   arquivo continuar abaixo do teto de 500 linhas. */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {invalidValue} = require('../error-detail.mjs');
const {isPlainObject} = require('../../plain-object.cjs');
const {validateNativeTurns, patchNativeTurns} = require('./native-turns.cjs');
const history = require('./history.cjs');

const PATCH_ERROR_CODE = 'CLAUDE_DESCRIPTOR_PATCH';
const DELIVERY_STATUSES = Object.freeze(['transmitting', 'accepted', 'settled', 'uncertain', 'refused']);
const MAX_DELIVERY_ID = 200;
/* O sufixo não termina em `.json` para não ser lido como descritor pela busca,
   pelo pacote nem pelo backup — que filtram esse nome. */
const TURN_METADATA_SUFFIX = '.turn';
/* A fala aceita também mora aqui até a gravação completa (#119), então o teto
   sobe dos 32 KiB antigos: cabe a maior fala que `messages` aceita (texto de
   até MAX_TEXT_CHARS, mesmo em UTF-8/vírgulas escapadas). Imagem em base64
   pode chegar a ~8 MiB (teto de envio) e fica só enquanto o conjunto couber;
   acima disso o `fitPendingMessages` a descarta antes da pergunta, como o teto
   de `messages` já faz. */
const MAX_TURN_METADATA_BYTES = 3 * 1024 * 1024;

const boundedString = (value, max) => typeof value === 'string' && value.length <= max;

function patchError(message) {
  const error = new Error(message);
  error.code = PATCH_ERROR_CODE;
  return error;
}

/**
 * Fase da entrega no contrato do descritor.
 * @param {unknown} delivery
 * @returns {boolean}
 * @example validateDelivery({id: 'd1', status: 'accepted'}) // true
 */
function validateDelivery(delivery) {
  return isPlainObject(delivery)
    && boundedString(delivery.id, MAX_DELIVERY_ID)
    && delivery.id.length > 0
    && DELIVERY_STATUSES.includes(delivery.status);
}

/**
 * Publica um JSON por tmp + rename; em falha o arquivo anterior fica intacto.
 * @param {string} file @param {unknown} value
 * @returns {void}
 * @example writeJsonAtomic('/runtime/conversations/claude-x.json', descriptor);
 */
function writeJsonAtomic(file, value) {
  const payload = JSON.stringify(value);
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(tmp, payload);
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    try {
      fs.unlinkSync(tmp);
    } catch {}
    throw error;
  }
}

function turnMetadataPath(file) {
  return `${file}${TURN_METADATA_SUFFIX}`;
}

function readTurnMetadata(file) {
  let stat;
  try {
    stat = fs.statSync(turnMetadataPath(file));
  } catch {
    return null;
  }
  if (!stat.isFile() || stat.size > MAX_TURN_METADATA_BYTES) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(turnMetadataPath(file), 'utf8'));
    return isPlainObject(raw) ? raw : null;
  } catch {
    return null;
  }
}

/* Só os campos do contrato do turno; um arquivo adulterado não vira descritor.
   `pendingMessages` fica de fora de propósito (#119): a leitura comum não junta
   a fala ainda não gravada; só a recuperação a leva para o descritor. */
function turnMetadataPatch(file) {
  const raw = readTurnMetadata(file);
  if (!raw) return null;
  const patch = {};
  if (validateDelivery(raw.delivery)) patch.delivery = {id: raw.delivery.id, status: raw.delivery.status};
  if (typeof raw.nativeEstablished === 'boolean') patch.nativeEstablished = raw.nativeEstablished;
  if (validateNativeTurns(raw.nativeTurns)) patch.nativeTurns = raw.nativeTurns.map((turn) => ({user: turn.user, messageId: turn.messageId}));
  return Object.keys(patch).length ? patch : null;
}

function turnMetadataExists(file) {
  return readTurnMetadata(file) !== null;
}

function clearTurnMetadata(file) {
  try {
    fs.unlinkSync(turnMetadataPath(file));
  } catch {}
}

/* A fala aceita entra no formato do descritor: os mesmos tetos de texto/imagem
   de `history` e sem o `uuid` de entrega, que `messages` não guarda. */
function pendingMessages(value) {
  return history.normalizeClaudeMessages(value).filter((message) => message.role === 'user');
}

function withoutImages(message) {
  if (!Array.isArray(message.content) || !message.content.some((part) => part?.type === 'image')) return message;
  return {...message, content: message.content.filter((part) => part?.type !== 'image')};
}

function metadataBytes(value) {
  return Buffer.byteLength(JSON.stringify(value) ?? 'null', 'utf8');
}

/* Se o arquivo pequeno passar do teto, perde a imagem antes da pergunta (a
   mesma ordem do teto de `messages`) e, no limite, guarda só as falas mais
   novas: uma fala normalizada sempre cabe sozinha. */
function fitPendingMessages(next) {
  if (!Array.isArray(next.pendingMessages) || !next.pendingMessages.length) {
    delete next.pendingMessages;
    return next;
  }
  if (metadataBytes(next) <= MAX_TURN_METADATA_BYTES) return next;
  let list = next.pendingMessages.map(withoutImages);
  while (list.length > 1 && metadataBytes({...next, pendingMessages: list}) > MAX_TURN_METADATA_BYTES) list = list.slice(1);
  if (metadataBytes({...next, pendingMessages: list}) > MAX_TURN_METADATA_BYTES) list = [];
  if (list.length) next.pendingMessages = list;
  else delete next.pendingMessages;
  return next;
}

/**
 * Grava só o metadado que muda durante um turno (#119), no arquivo pequeno ao
 * lado do descritor. A escrita é síncrona e atômica como a do descritor, mas
 * não relê nem reescreve `messages`. `pendingMessages` guarda as falas aceitas
 * desde a última gravação completa para uma queda no meio do turno não
 * perder a pergunta.
 * @param {string} file caminho do descritor
 * @param {{delivery?: {id: string, status: string}|null, nativeEstablished?: boolean, nativeTurns?: Array<{user: string, messageId: string}>|null, pendingMessages?: Array<{role: string, content: object[]}>|null}} patch
 * @returns {{delivery?: {id: string, status: string}, nativeEstablished?: boolean, nativeTurns?: Array<{user: string, messageId: string}>, pendingMessages?: Array<{role: string, content: object[]}>}|null}
 * @example writeTurnMetadata(file, {delivery: {id: 'd1', status: 'accepted'}, nativeEstablished: true});
 */
function writeTurnMetadata(file, patch) {
  if (!isPlainObject(patch)) throw patchError(invalidValue('patch do turno', patch, 'object'));
  const next = {...(readTurnMetadata(file) || {})};
  if (Object.hasOwn(patch, 'delivery')) {
    if (patch.delivery === null) delete next.delivery;
    else if (!validateDelivery(patch.delivery)) throw patchError(invalidValue('delivery', patch.delivery, `{id: string(1..${MAX_DELIVERY_ID}), status}|null`));
    else next.delivery = {id: patch.delivery.id, status: patch.delivery.status};
  }
  if (Object.hasOwn(patch, 'nativeEstablished')) {
    if (typeof patch.nativeEstablished !== 'boolean') throw patchError(invalidValue('nativeEstablished', patch.nativeEstablished, 'boolean'));
    next.nativeEstablished = patch.nativeEstablished;
  }
  patchNativeTurns(next, patch, patchError, invalidValue);
  if (Object.hasOwn(patch, 'pendingMessages')) {
    if (patch.pendingMessages === null) delete next.pendingMessages;
    else {
      if (!Array.isArray(patch.pendingMessages)) throw patchError(invalidValue('pendingMessages', patch.pendingMessages, 'array|null'));
      const messages = pendingMessages(patch.pendingMessages);
      if (messages.length) next.pendingMessages = messages;
      else delete next.pendingMessages;
    }
    fitPendingMessages(next);
  }
  writeJsonAtomic(turnMetadataPath(file), next);
  return next;
}

/**
 * Acrescenta a fala aceita ao arquivo pequeno do turno (#119). A gravação
 * completa do `turn_end` leva tudo para o descritor e apaga o arquivo, então
 * ele guarda só o que ainda não está no descritor.
 * @param {string} file caminho do descritor
 * @param {{role: string, content: object[], uuid?: string}} message fala aceita
 * @returns {void}
 * @example appendPendingMessage(file, {role: 'user', content: [{type: 'text', text: 'pergunta'}]});
 */
function appendPendingMessage(file, message) {
  /* Só ao lado de um descritor existente: o rascunho de revisão e o caderno
     usam ids como `review-draft:…`, que não são caminho de arquivo (#119). */
  try {
    if (!fs.statSync(file).isFile()) return;
  } catch {
    return;
  }
  const raw = readTurnMetadata(file);
  const current = Array.isArray(raw?.pendingMessages) ? raw.pendingMessages : [];
  writeTurnMetadata(file, {pendingMessages: [...current, message]});
}

/**
 * Falas aceitas que ainda não estão no descritor (#119), já normalizadas.
 * @param {string} file caminho do descritor
 * @returns {Array<{role: string, content: object[]}>|null}
 * @example const pending = pendingMessagesOf(file); // null sem fala pendente
 */
function pendingMessagesOf(file) {
  const raw = readTurnMetadata(file)?.pendingMessages;
  if (!Array.isArray(raw) || !raw.length) return null;
  const pending = pendingMessages(raw);
  return pending.length ? pending : null;
}

const shown = (message) => JSON.stringify({role: message?.role, content: message?.content});

/**
 * Mensagens que a reabertura precisa acrescentar ao descritor (#119). Devolve
 * `null` quando não há fala pendente ou quando ela já é o fim do descritor
 * (o app morreu depois da gravação completa e antes de apagar o arquivo).
 * @param {string} file caminho do descritor
 * @param {Array<{role: string, content: object[]}>|undefined} messages mensagens já gravadas
 * @returns {Array<{role: string, content: object[]}>|null}
 * @example const messages = pendingMessagesForRecovery(file, record.messages);
 */
function pendingMessagesForRecovery(file, messages) {
  const pending = pendingMessagesOf(file);
  if (!pending) return null;
  const current = Array.isArray(messages) ? messages : [];
  if (pending.length <= current.length) {
    const tail = current.slice(-pending.length).map(shown);
    if (pending.map(shown).every((value, index) => value === tail[index])) return null;
  }
  return [...current, ...pending];
}

module.exports = {
  PATCH_ERROR_CODE,
  DELIVERY_STATUSES,
  MAX_DELIVERY_ID,
  TURN_METADATA_SUFFIX,
  MAX_TURN_METADATA_BYTES,
  validateDelivery,
  writeJsonAtomic,
  writeTurnMetadata,
  readTurnMetadata,
  turnMetadataPatch,
  turnMetadataExists,
  clearTurnMetadata,
  appendPendingMessage,
  pendingMessagesOf,
  pendingMessagesForRecovery,
};
