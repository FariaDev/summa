'use strict';

/* Transcrição de uma conversa DENTRO do pacote (#140): o JSONL do Pi e os
   descritores Claude/OpenCode são lidos só para a prévia — o mesmo texto que
   o import grava como transcrição e o tutor passa a ler. Nada aqui escreve. */

const {isPlainObject} = require('../../plain-object.cjs');
const {transcriptSummary, transcriptFromRecord} = require('../agents/conversation-transcript.cjs');

/** `content` do Pi é texto ou uma lista de partes; só as partes `text` contam. */
function piMessageText(content) {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

/* Mensagens de texto de uma sessão JSONL do Pi, na ordem em que aconteceram.
   Aceita a linha `{type:'message', message:{role, content}}` e a forma curta
   `{message:{role, content}}`. Chamada de ferramenta, raciocínio e linha que
   não é mensagem ficam de fora.
   @example piSessionMessages('{"type":"message","message":{"role":"user","content":"oi"}}') // [{role: 'user', content: 'oi'}] */
function piSessionMessages(text) {
  const messages = [];
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const message = isPlainObject(entry?.message) ? entry.message : entry;
    if (message?.role !== 'user' && message?.role !== 'assistant') continue;
    const content = piMessageText(message.content);
    if (content) messages.push({role: message.role, content});
  }
  return messages;
}

/**
 * Resumo da transcrição de uma conversa do pacote (zero escrita).
 * @param {{engine?: string, data?: Buffer|string}} entry
 * @returns {{messages: number, characters: number, preview: string, text: string, truncated: boolean}}
 * @example transcriptOfPackageConversation({engine: 'pi', data: '{"message":{"role":"user","content":"oi"}}'}).messages // 1
 */
function transcriptOfPackageConversation({engine, data} = {}) {
  const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data ?? '');
  if (engine === 'pi') return transcriptSummary(piSessionMessages(text));
  let record;
  try {
    record = JSON.parse(text);
  } catch {
    return transcriptSummary([]);
  }
  return isPlainObject(record) ? transcriptFromRecord(record) : transcriptSummary([]);
}

module.exports = {piSessionMessages, transcriptOfPackageConversation};
