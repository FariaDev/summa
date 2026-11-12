// @ts-check
'use strict';

/* O que os motores nativos (Claude e OpenCode; #57) gravam no descritor: a
   fase da entrega, as mensagens com a prévia e a escolha de modelo/esforço.
   Uma fonte só para os dois `connect` do `tutor-bridge-host.cjs`. */

const conversations = require('./conversations.cjs');
const {MAX_NATIVE_TURNS} = require('./native-turns.cjs');

/**
 * @typedef {import('../../types/agent').AgentMessage} AgentMessage
 */

/**
 * A primeira fala do aluno, cortada para a lista de sessões.
 * @param {AgentMessage[]} messages @param {string} fallback
 * @returns {string}
 * @example previewOf([{role: 'user', content: [{type: 'text', text: 'oi'}]}], '') // 'oi'
 */
function previewOf(messages, fallback) {
  const first = messages.find((item) => item.role === 'user');
  const text = first?.content?.find((part) => part.type === 'text');
  return (text && 'text' in text ? String(text.text).slice(0, 160) : '') || fallback;
}

/**
 * Os retornos de gravação de uma conversa nativa.
 * @param {{descriptor: string, runtime: string, preview?: string}} options
 * @returns {{persistDelivery: (delivery: {id: string, status: string}) => void,
 *   onMessages: (messages: AgentMessage[], meta: {importedPrefixLength: number}) => void,
 *   onSelection: (patch: object) => void,
 *   lastTurn: () => {user: string, messageId: string}|null,
 *   onTurn: (turn: {user: string, messageId: string, retry?: boolean}) => void}}
 * @example const persistence = nativePersistence({descriptor: live.session, runtime, preview: record.preview});
 */
function nativePersistence({descriptor, runtime, preview = ''}) {
  /** @returns {Array<{user: string, messageId: string}>} */
  function turns() {
    const record = conversations.readClaudeConversation(descriptor, {runtime});
    return Array.isArray(record?.nativeTurns) ? record.nativeTurns : [];
  }
  return {
    /* A fase muda várias vezes no turno; grava só o arquivo pequeno ao lado do
       descritor e deixa `messages` para a gravação única do fim do turno
       (#119). `accepted` liga o portão de retomada junto (#57). */
    persistDelivery(delivery) {
      conversations.writeTurnMetadata(descriptor, {delivery, ...(delivery.status === 'accepted' ? {nativeEstablished: true} : {})});
    },
    onMessages(messages, meta) {
      conversations.updateClaudeConversation(descriptor, {messages, importedPrefixLength: meta.importedPrefixLength, preview: previewOf(messages, preview)}, {runtime});
    },
    onSelection(patch) {
      conversations.updateClaudeConversation(descriptor, patch, {runtime});
    },
    /* O id do motor da última pergunta (#164). Descritor antigo não tem a
       lista: devolve null e o serviço recusa o refazer sem apagar nada. */
    lastTurn() {
      const list = turns();
      return list.length ? list[list.length - 1] : null;
    },
    /* `retry` troca a última entrada: o refazer remove a pergunta antiga do
       descritor junto com o revert do motor, então não fica um id órfão. */
    onTurn(turn) {
      if (!turn || typeof turn.user !== 'string' || typeof turn.messageId !== 'string') return;
      const list = turns();
      if (turn.retry === true) list.pop();
      list.push({user: turn.user, messageId: turn.messageId});
      /* Também no arquivo pequeno (#119): o `turn_end` leva junto para o
         descritor; uma queda no meio do turno o mantém recuperável. */
      conversations.writeTurnMetadata(descriptor, {nativeTurns: list.slice(-MAX_NATIVE_TURNS)});
    },
  };
}

module.exports = {nativePersistence, previewOf};
