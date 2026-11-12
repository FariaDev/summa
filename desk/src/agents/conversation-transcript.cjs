// @ts-check
'use strict';

/* Transcrição de conversa que o tutor lê (#140): UMA fonte para o prompt
   (`tutor-engine-host.cjs`) e para a prévia de importação de pacote. A prévia
   precisa mostrar o mesmo texto que entra no prompt, e esse texto vem de fora
   (pacote de outra pessoa): o renderer só pode pintá-lo com `textContent`. */

const history = require('./history.cjs');

const MAX_IMPORTED_TRANSCRIPT = 50000;
const TRANSCRIPT_PREVIEW_CHARS = 280;

/** Texto visível de uma mensagem já normalizada. @param {{content?: unknown}} [message] */
function textOf(message) {
  if (!Array.isArray(message?.content)) return '';
  return message.content
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
}

/** Falas `user:`/`assistant:` na ordem, descartando ferramenta e raciocínio. @param {unknown[]} messages */
function transcriptLines(messages = []) {
  const lines = [];
  for (const message of history.normalizeClaudeMessages(messages)) {
    if (message.role !== 'user' && message.role !== 'assistant') continue;
    lines.push(`${message.role}: ${textOf(message)}`);
  }
  return lines;
}

/**
 * O texto que entra no prompt: as falas juntas, cortadas pelo fim no teto de
 * `importedTranscript`. @param {unknown[]} messages
 * @returns {string}
 * @example importedTranscriptFromMessages([{role:'user',content:'oi'}]) // 'user: oi'
 */
function importedTranscriptFromMessages(messages = []) {
  return transcriptLines(messages).join('\n\n').slice(-MAX_IMPORTED_TRANSCRIPT);
}

/**
 * Resumo da transcrição para a prévia: contagens do texto inteiro e o começo
 * do texto que o tutor lê (com marca de corte quando o teto entra).
 * @param {unknown[]} messages
 * @returns {{messages: number, characters: number, preview: string, text: string, truncated: boolean}}
 * @example transcriptSummary([{role:'user',content:'oi'}]).messages // 1
 */
function transcriptSummary(messages = []) {
  const lines = transcriptLines(messages);
  const full = lines.join('\n\n');
  const text = full.slice(-MAX_IMPORTED_TRANSCRIPT);
  return {messages: lines.length, characters: full.length, preview: text.slice(0, TRANSCRIPT_PREVIEW_CHARS), text, truncated: full.length > text.length};
}

/**
 * Resumo de um descritor de conversa: usa o `importedTranscript` quando ele já
 * existe (é ele que o prompt recebe) e, sem ele, monta das mensagens.
 * @param {{messages?: unknown[], importedTranscript?: unknown}} [record]
 * @returns {{messages: number, characters: number, preview: string, text: string, truncated: boolean}}
 * @example transcriptFromRecord({messages:[{role:'user',content:'oi'}]}).preview // 'user: oi'
 */
function transcriptFromRecord(record = {}) {
  const messages = Array.isArray(record.messages) ? record.messages : [];
  if (typeof record.importedTranscript === 'string' && record.importedTranscript) {
    const text = record.importedTranscript.slice(-MAX_IMPORTED_TRANSCRIPT);
    return {
      messages: transcriptLines(messages).length,
      characters: record.importedTranscript.length,
      preview: text.slice(0, TRANSCRIPT_PREVIEW_CHARS),
      text,
      truncated: record.importedTranscript.length > text.length,
    };
  }
  return transcriptSummary(messages);
}

module.exports = {MAX_IMPORTED_TRANSCRIPT, TRANSCRIPT_PREVIEW_CHARS, importedTranscriptFromMessages, transcriptSummary, transcriptFromRecord};
