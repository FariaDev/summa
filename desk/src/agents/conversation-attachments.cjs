// @ts-check
'use strict';

/* Anexos da conversa fora do descritor (#4): cada imagem em base64 vira um
   arquivo endereçado por conteúdo em
   `runtime/conversations/attachments/<claude|opencode>-<uuid>/<sha256>.<ext>`.
   A mensagem guarda só `{type:'image', attachment, mimeType, source?, bytes}`;
   o descritor encolhe e deixa de ser reescrito com os bytes em cada turno.

   O descritor antigo com `data` inline continua abrindo: a próxima gravação
   externaliza as imagens (`externalizeMessages`) e o consumidor que precisa do
   conteúdo resolve de volta (`resolveMessages`). Arquivo ausente vira um
   marcador de texto, nunca derruba a abertura. A pasta é da conversa: apagar
   uma conversa remove só a pasta dela (`removeConversation`), e a mesma imagem
   no mesmo descritor grava um arquivo só (hash do conteúdo).

   A regra que custaria ao aluno ("nenhuma imagem some na migração") fica em
   JS com teste de regressão (ADR 0003): o invariante é do I/O — hash, arquivo
   atômico e leitura de volta — e um núcleo Bend só modelaria uma igualdade
   abstrata que repetiria o código, sem enxergar os bytes em disco. */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {invalidValue} = require('../error-detail.mjs');
const {TURN_METADATA_SUFFIX} = require('./conversation-turn.cjs');
const {boundMessages} = require('./conversation-bounds.cjs');
const history = require('./history.cjs');

const ATTACHMENTS_DIR = 'attachments';
const MISSING_IMAGE_TEXT = '[imagem indisponível]';
const DESCRIPTOR_NAME_RE = /^(?:claude|opencode)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/;
/** @typedef {{type?: string, data?: string, attachment?: string, mimeType?: string, source?: string, bytes?: number}} ContentPart */
/** @typedef {{role?: string, content?: ContentPart[]}} ChatMessage */

const EXTENSION_BY_MIME = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
});

/**
 * Id da conversa no nome do descritor (`claude-<uuid>`/`opencode-<uuid>`).
 * Recusa qualquer outro nome antes de virar caminho; nada de `..` ou separador.
 * @param {unknown} descriptor caminho do descritor
 * @returns {string}
 * @example conversationIdOf('/rt/conversations/claude-9f4c….json') // 'claude-9f4c…'
 */
function conversationIdOf(descriptor) {
  const name = typeof descriptor === 'string' ? path.basename(descriptor) : '';
  if (!DESCRIPTOR_NAME_RE.test(name)) {
    throw Error(invalidValue('id da conversa', name, '"claude-<uuid>.json" ou "opencode-<uuid>.json"'));
  }
  return name.slice(0, -'.json'.length);
}

/** @param {unknown} runtime */
function conversationsRoot(runtime) {
  if (typeof runtime !== 'string' || !runtime) throw Error(invalidValue('runtime', runtime, 'string(1..)'));
  return path.resolve(runtime, 'conversations');
}

/**
 * Pasta de anexos da conversa, dentro de `runtime/conversations/attachments`.
 * @param {string} runtime pasta do runtime
 * @param {string} descriptor caminho do descritor da conversa
 * @returns {string}
 * @example conversationAttachmentsDir('/rt', '/rt/conversations/claude-9f4c….json')
 */
function conversationAttachmentsDir(runtime, descriptor) {
  const id = conversationIdOf(descriptor);
  const root = path.join(conversationsRoot(runtime), ATTACHMENTS_DIR);
  const dir = path.join(root, id);
  const rel = path.relative(root, dir);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw Error(invalidValue('id da conversa', id, 'nome de descritor sem separador de caminho'));
  }
  return dir;
}

function extensionOf(mimeType) {
  return EXTENSION_BY_MIME[String(mimeType || '').toLowerCase()] || 'bin';
}

/* Nome endereçado por conteúdo: os mesmos bytes no mesmo descritor devolvem o
   mesmo arquivo; outra imagem nunca colide. */
function attachmentNameOf(bytes, mimeType) {
  return `${crypto.createHash('sha256').update(bytes).digest('hex')}.${extensionOf(mimeType)}`;
}

/* Grava atômico (tmp + rename) e só quando o arquivo ainda não existe. */
function writeAttachment(dir, name, bytes) {
  const target = path.join(dir, name);
  if (fs.existsSync(target)) return target;
  fs.mkdirSync(dir, {recursive: true});
  const tmp = path.join(dir, `.${name}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  fs.writeFileSync(tmp, bytes);
  try {
    fs.renameSync(tmp, target);
  } catch (error) {
    try {
      fs.unlinkSync(tmp);
    } catch {}
    throw error;
  }
  return target;
}

function externalizedPart(part, dir) {
  const bytes = Buffer.from(part.data, 'base64');
  if (!bytes.length) return part;
  const mimeType = typeof part.mimeType === 'string' && part.mimeType ? part.mimeType : 'image/png';
  const attachment = attachmentNameOf(bytes, mimeType);
  writeAttachment(dir, attachment, bytes);
  /** @type {ContentPart} */
  const next = {type: 'image', attachment, mimeType};
  if (typeof part.source === 'string' && part.source) next.source = part.source;
  next.bytes = bytes.length;
  return next;
}

/**
 * Forma válida de uma parte de imagem no descritor (#4): inline antiga ou
 * referência ao anexo com bytes. Fica aqui para `conversations.cjs` continuar
 * abaixo do teto de 500 linhas.
 * @param {ContentPart} part
 * @returns {boolean}
 * @example validImagePart({type:'image', attachment: sha + '.png', mimeType:'image/png', bytes: 10}) // true
 */
function validImagePart(part) {
  if (part.attachment !== undefined) {
    if (typeof part.attachment !== 'string' || !history.ATTACHMENT_NAME_RE.test(part.attachment)) return false;
    if (part.data !== undefined) return false;
    if (!Number.isInteger(part.bytes) || part.bytes <= 0 || part.bytes > history.MAX_IMAGE_BYTES) return false;
  } else if (typeof part.data !== 'string' || !part.data || part.data.length > history.MAX_IMAGE_DATA_CHARS) return false;
  if (typeof part.mimeType !== 'string' || part.mimeType.length > 100) return false;
  if (part.source !== undefined && (typeof part.source !== 'string' || part.source.length > history.MAX_SOURCE_CHARS)) return false;
  return true;
}

/**
 * Troca cada `data` base64 por um arquivo de anexo. Devolve a MESMA lista
 * quando não há imagem inline (barato no caminho quente) e uma cópia nova
 * quando migra; a entrada não é alterada. Idempotente para quem já tem
 * `attachment`.
 * @param {ChatMessage[]} messages mensagens normalizadas de `history.cjs`
 * @param {{runtime: string, descriptor: string}} options
 * @returns {ChatMessage[]}
 * @example externalizeMessages([{role:'user', content:[{type:'image', data, mimeType:'image/png'}]}], {runtime, descriptor})
 */
function externalizeMessages(messages, {runtime, descriptor} = /** @type {any} */ ({})) {
  if (!Array.isArray(messages)) return messages;
  let dir = null;
  let changed = false;
  const out = messages.map((message) => {
    if (!message || typeof message !== 'object' || !Array.isArray(message.content)) return message;
    let contentChanged = false;
    const content = message.content.map((part) => {
      if (!part || typeof part !== 'object' || part.type !== 'image') return part;
      if (typeof part.data !== 'string' || !part.data) return part;
      dir = dir || conversationAttachmentsDir(runtime, descriptor);
      const next = externalizedPart(part, dir);
      if (next !== part) contentChanged = true;
      return next;
    });
    if (!contentChanged) return message;
    changed = true;
    return {...message, content};
  });
  return changed ? out : messages;
}

/**
 * Forma que o descritor grava: externaliza e aplica o teto de `messages`. O
 * teto depois da migração não perde imagem por causa do tamanho do base64.
 * @param {ChatMessage[]} messages
 * @param {{runtime: string, descriptor: string}} options
 * @returns {ChatMessage[]}
 * @example storeMessages(messages, {runtime, descriptor})
 */
function storeMessages(messages, options) {
  return boundMessages(externalizeMessages(messages, options));
}

/* Bytes do anexo; null cobre nome inválido, arquivo ausente e leitura falha,
   para o chamador virar marcador em vez de derrubar a abertura. */
function attachmentBytes(part, {runtime, descriptor}) {
  if (typeof part?.attachment !== 'string' || !history.ATTACHMENT_NAME_RE.test(part.attachment)) return null;
  try {
    const dir = conversationAttachmentsDir(runtime, descriptor);
    const file = path.join(dir, part.attachment);
    if (path.dirname(file) !== dir) return null;
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

function resolvedImagePart(part, bytes) {
  /** @type {ContentPart} */
  const next = {
    type: 'image',
    data: bytes.toString('base64'),
    mimeType: typeof part.mimeType === 'string' && part.mimeType ? part.mimeType : 'image/png',
  };
  if (typeof part.source === 'string' && part.source) next.source = part.source;
  return next;
}

/**
 * Resolve as imagens de uma lista para o consumidor que precisa do conteúdo
 * (tela, exportação, motor). Anexo ausente vira `{type:'text'}` com
 * "[imagem indisponível]"; o resto da mensagem fica intacto.
 * @param {ChatMessage[]} messages mensagens do descritor (inline, anexo ou mistas)
 * @param {{runtime: string, descriptor: string}} options
 * @returns {ChatMessage[]}
 * @example resolveMessages(record.messages, {runtime, descriptor})
 */
function resolveMessages(messages, options) {
  if (!Array.isArray(messages)) return messages;
  let changed = false;
  const out = messages.map((message) => {
    if (!message || typeof message !== 'object' || !Array.isArray(message.content)) return message;
    let contentChanged = false;
    const content = message.content.map((part) => {
      if (!part || typeof part !== 'object' || part.type !== 'image') return part;
      if (typeof part.data === 'string' && part.data) return part;
      if (typeof part.attachment !== 'string' || !part.attachment) return part;
      const bytes = attachmentBytes(part, options);
      contentChanged = true;
      return bytes ? resolvedImagePart(part, bytes) : {type: 'text', text: MISSING_IMAGE_TEXT};
    });
    if (!contentChanged) return message;
    changed = true;
    return {...message, content};
  });
  return changed ? out : messages;
}

/**
 * Só as partes de imagem resolvidas (para reenviar ao motor). Anexo ausente é
 * omitido: o texto do envio continua, sem mandar referência de arquivo.
 * @param {ContentPart[]} parts partes de conteúdo
 * @param {{runtime: string, descriptor: string}} options
 * @returns {ContentPart[]}
 * @example resolveImageParts(userMessage.content, {runtime, descriptor})
 */
function resolveImageParts(parts, options) {
  const out = [];
  for (const part of Array.isArray(parts) ? parts : []) {
    if (!part || part.type !== 'image') continue;
    if (typeof part.data === 'string' && part.data) {
      out.push(part);
      continue;
    }
    const bytes = attachmentBytes(part, options);
    if (bytes) out.push(resolvedImagePart(part, bytes));
  }
  return out;
}

/**
 * Apaga o descritor, o arquivo pequeno do turno e a pasta de anexos DAQUELA
 * conversa. Nunca toca em outra conversa nem em caminho fora do runtime.
 * @param {string} descriptor caminho do descritor
 * @param {{runtime: string}} options
 * @returns {{descriptor: boolean, attachments: boolean}}
 * @example removeConversation('/rt/conversations/claude-9f4c….json', {runtime: '/rt'})
 */
function removeConversation(descriptor, {runtime} = /** @type {any} */ ({})) {
  const target = path.resolve(String(descriptor || ''));
  const root = conversationsRoot(runtime);
  if (!target.startsWith(root + path.sep)) {
    throw Error(invalidValue('descritor da conversa', path.basename(target), 'caminho dentro de runtime/conversations'));
  }
  const dir = conversationAttachmentsDir(runtime, target);
  let attachments = false;
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, {recursive: true, force: true});
    attachments = true;
  }
  let removed = false;
  for (const file of [target, `${target}${TURN_METADATA_SUFFIX}`]) {
    try {
      fs.unlinkSync(file);
      if (file === target) removed = true;
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error;
    }
  }
  return {descriptor: removed, attachments};
}

module.exports = {
  ATTACHMENTS_DIR,
  MISSING_IMAGE_TEXT,
  conversationIdOf,
  conversationAttachmentsDir,
  validImagePart,
  storeMessages,
  externalizeMessages,
  resolveMessages,
  resolveImageParts,
  removeConversation,
};
