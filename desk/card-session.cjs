// @ts-check
'use strict';

/* Uma conversa de cartões do tutor (#92/#139): a ferramenta registra, o aluno
   responde no cartão e o "Concluir" manda o resultado numa mensagem nova, uma
   vez só. A nota sugerida segue o mesmo caminho, mas o clique em "Guardar" é
   o único que grava em `Notas/`. O mesmo serviço atende a conversa principal
   (sessão viva) e cada chat lateral (id do descritor); quem muda é o caminho
   de envio (e o lateral não recebe a ferramenta de nota). */

const {normalizeAsk, normalizeQuiz} = require('./src/cards/input.mjs');
const cardStore = require('./card-store.cjs');
const {noteRequestProblem} = require('./tutor-materials.cjs');
const {MAX_NOTES_PER_TURN, createNoteTurnCap, turnCapError} = require('./src/study-data/note-turn-cap.cjs');
const {invalidValue} = require('./src/error-detail.mjs');
const {isPlainObject} = require('./plain-object.cjs');
const {message} = require('./src/i18n.mjs');

/**
 * Cria o serviço de cartões de UMA conversa.
 * @param {{runtime: string, conversation: () => string, sendText: (text: string, target?: string) => Promise<object>,
 *   writeNote?: (note: {titulo: string, conteudo: string}) => object,
 *   noteTurns?: ReturnType<typeof createNoteTurnCap>,
 *   emit?: (payload: object) => void, appendLog?: (area: string, line: string) => void}} options
 * @returns {{show: (raw: object, target?: string) => {id: string, card: object},
 *   suggestNote: (raw: object, target?: string) => {suggested: boolean, id: string, title: string, card: object},
 *   list: (target?: string) => object[], answer: (payload: object) => object,
 *   draft: (payload: object) => object, dismiss: (payload: object) => object,
 *   saveNote: (payload: object) => Promise<object>, conclude: (id: string) => Promise<object>}}
 * @example const cards = createCardSession({runtime, conversation: () => session, sendText, writeNote});
 */
function createCardSession({runtime, conversation, sendText, writeNote = null, noteTurns = createNoteTurnCap(), emit = () => {}, appendLog = () => {}}) {
  cardStore.setInvalidLog(appendLog);
  /* Duplo clique ou IPC repetido não grava a mesma sugestão duas vezes. O
     núcleo já barra a segunda gravação DEPOIS de confirmada; este conjunto
     cobre a corrida enquanto a primeira ainda está em voo. */
  const savingNotes = new Set();
  function session() {
    const value = String(conversation() || '');
    if (!value) throw Error('A conversa atual não tem sessão para guardar o cartão.');
    return value;
  }

  function normalized(kind, args) {
    if (kind === 'quiz') return normalizeQuiz(args);
    if (kind === 'ask') return normalizeAsk(args);
    throw Error(invalidValue('kind', kind, 'quiz|ask'));
  }

  function show(raw, target = session()) {
    if (!isPlainObject(raw)) throw Error(invalidValue('cartão', raw, 'object {kind, args}'));
    const owner = String(target || '');
    if (!owner) throw Error(invalidValue('conversationId', target, 'string(1..)'));
    const card = cardStore.createCard(runtime, owner, normalized(raw.kind, raw.args));
    /* A conversa pode ter trocado durante a validação/escrita: o cartão fica
       na conversa dona e a janela não mistura cartões de sessões diferentes. */
    if (owner === session()) emit({type: 'shown', conversationId: owner, card});
    return {id: card.id, card};
  }

  /* A nota do tutor (#139) não grava nada aqui: ela vira um cartão PENDENTE
     que o aluno decide. A validação é a mesma do pedido de nota do MCP. O teto
     de 3 por turno (auditoria de segurança) vale na CRIAÇÃO da sugestão — a
     quarta é recusada antes de virar cartão; o clique "Guardar" não conta. */
  function suggestNote(raw, target = session()) {
    if (!isPlainObject(raw)) throw Error(invalidValue('nota', raw, 'object {titulo, conteudo}'));
    const problem = noteRequestProblem(raw);
    if (problem) throw Error(problem);
    const data = /** @type {{titulo: string, conteudo: string}} */ (raw);
    const owner = String(target || '');
    if (!owner) throw Error(invalidValue('conversationId', target, 'string(1..)'));
    if (!noteTurns.allows(owner)) throw turnCapError(MAX_NOTES_PER_TURN);
    const card = /** @type {{id: string, title: string}} */ (cardStore.createNoteCard(runtime, owner, {title: data.titulo, content: data.conteudo}));
    noteTurns.record(owner);
    if (owner === session()) emit({type: 'shown', conversationId: owner, card});
    return {suggested: true, id: card.id, title: card.title, card};
  }

  function list(target = session()) {
    return cardStore.listCards(runtime, String(target || ''));
  }

  function own(id) {
    if (typeof id !== 'string' || !/^card-[0-9a-f-]{36}$/.test(id)) throw Error(invalidValue('id', id, 'card-<uuid>'));
    const card = cardStore.findCard(runtime, session(), id);
    if (!card) throw Error(`cartão ${id} não existe nesta conversa; esperado um cartão aberto`);
    return card;
  }

  function answer(payload) {
    if (!isPlainObject(payload)) throw Error(invalidValue('resposta', payload, 'object {id, answer}'));
    const data = /** @type {Record<string, any>} */ (payload);
    own(data.id);
    const card = cardStore.answerCard(runtime, session(), data.id, isPlainObject(data.answer) ? data.answer : {});
    if (!card) throw Error(`cartão ${data.id} não existe nesta conversa`);
    emit({type: 'update', conversationId: session(), card});
    return card;
  }

  function draft(payload) {
    if (!isPlainObject(payload)) throw Error(invalidValue('rascunho', payload, 'object {id, draft}'));
    const data = /** @type {Record<string, any>} */ (payload);
    return cardStore.saveDraft(runtime, session(), String(data.id || ''), isPlainObject(data.draft) ? data.draft : {});
  }

  function dismiss(payload) {
    if (!isPlainObject(payload)) throw Error(invalidValue('cartão', payload, 'object {id}'));
    const data = /** @type {Record<string, any>} */ (payload);
    const existing = own(data.id);
    const card = existing.kind === 'note'
      ? cardStore.dismissNoteCard(runtime, session(), data.id)
      : cardStore.dismissCard(runtime, session(), data.id);
    emit({type: 'update', conversationId: session(), card});
    return card;
  }

  /* O clique "Guardar" (#139): o host confere de novo o caminho e o conteúdo
     no funil de `Notas/`; aqui a sugestão vira `Saved` só depois de o arquivo
     existir. Sem teto: o aluno guarda o que foi sugerido, de qualquer turno.
     Nota já guardada volta como está (nunca grava duas vezes). */
  async function saveNote(payload) {
    if (!isPlainObject(payload)) throw Error(invalidValue('nota', payload, 'object {id}'));
    const data = /** @type {Record<string, any>} */ (payload);
    const target = session();
    const existing = own(data.id);
    if (existing.kind !== 'note') throw Error(invalidValue('id', data.id, 'card de nota'));
    const begin = cardStore.beginNoteSave(runtime, target, data.id);
    if (!begin.ok) {
      if (begin.code === 'already') return begin.card;
      throw Error(message(begin.code === 'dismissed' ? 'err.note.dismissed' : 'err.note.missing'));
    }
    if (savingNotes.has(data.id)) throw Error(message('err.note.saving'));
    if (typeof writeNote !== 'function') throw Error(message('err.note.write'));
    savingNotes.add(data.id);
    try {
      if (session() !== target) throw Error(message('err.note.sessionChanged'));
      const saved = await writeNote({titulo: existing.title, conteudo: existing.content});
      if (session() !== target) throw Error(message('err.note.sessionChanged'));
      const card = cardStore.confirmNoteSave(runtime, target, data.id, saved);
      emit({type: 'update', conversationId: target, card, saved: true});
      return card;
    } finally {
      savingNotes.delete(data.id);
    }
  }

  async function conclude(id) {
    const target = session();
    const begin = cardStore.beginSend(runtime, target, id);
    if (!begin.ok) return {ok: false, code: begin.code || 'refused', card: begin.card || null};
    emit({type: 'sending', conversationId: target, card: begin.card});
    let result;
    try {
      result = await sendText(begin.text, target);
    } catch (error) {
      /* `sendText` devolve os desfechos conhecidos; o que escapa dele é falha
         antes da escrita (connect/validação) — pode reenviar. Incerteza só
         vem marcada. */
      const uncertain = error?.uncertain === true;
      result = {sent: false, retryable: !uncertain, uncertain, error: String(error?.message || error)};
    }
    if (result?.sent === true) {
      const card = cardStore.confirmSend(runtime, target, id);
      emit({type: 'update', conversationId: target, card, sent: true, streaming: result.streaming === true});
      return {ok: true, card, streaming: result.streaming === true};
    }
    /* Só a recusa comprovada reabre o envio. Incerteza continua reservada:
       nunca reenvia sozinha (a mesma regra da entrega do tutor). */
    const proven = result?.retryable === true && result?.uncertain !== true;
    const error = result?.error || 'Não foi possível enviar o resultado ao tutor.';
    const card = cardStore.abortSend(runtime, target, id, proven, error);
    try { appendLog('card', `envio do cartão ${id} recusado: ${error}`); } catch {}
    emit({type: 'failed', conversationId: target, card, retryable: proven, error});
    return {ok: false, card, retryable: proven, error};
  }

  return {show, suggestNote, list, answer, draft, dismiss, saveNote, conclude};
}

module.exports = {createCardSession};
