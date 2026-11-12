// @ts-check
'use strict';

/* Host dos cartões do tutor na conversa principal (#92/#139): IPC da janela e
   roteamento do evento `desk-card`. O serviço por conversa mora em
   `card-session.cjs`; o chat lateral usa o mesmo serviço com o id do
   descritor. */

const {createCardSession} = require('./card-session.cjs');
const {message} = require('./src/i18n.mjs');

/**
 * Cria o host dos cartões da conversa ativa.
 * @param {{ipcMain: import('./types/host-deps').IpcMain, runtime: string,
 *   live: import('./main.cjs').DeskLive,
 *   emit: (payload: object) => void,
 *   sendText: (text: string, target?: string) => Promise<object>,
 *   writeNote?: (note: {titulo: string, conteudo: string}) => object,
 *   noteTurns?: ReturnType<typeof import('./src/study-data/note-turn-cap.cjs').createNoteTurnCap>,
 *   scope?: () => {courseId: string, conversation: string, freeSessionId: string},
 *   freeId?: string,
 *   appendLog?: import('./types/host-deps').AppendLog}} options
 * @returns {{show: (scope: {conversationId: string}, raw: {kind?: unknown, args?: unknown}) => object,
 *   suggestNote: (scope: {conversationId: string}, raw: {titulo?: unknown, conteudo?: unknown}) => object,
 *   suggestNoteFromGrant: (granted: {courseId?: unknown, session?: unknown, freeSessionId?: unknown}, raw: object) => object,
 *   list: (session?: string) => object[], sendText: (text: string, target?: string) => Promise<object>,
 *   conclude: (id: string) => Promise<object>}}
 * @example const cardHost = createCardHost({ipcMain, runtime, live, emit, sendText, writeNote});
 */
function createCardHost({ipcMain, runtime, live, emit, sendText, writeNote = null, noteTurns, scope = null, freeId = '', appendLog = () => {}}) {
  /* O main passa o MESMO `noteTurns` do `studyServices`: `newStudentTurn` abre
     o turno para a sugestão, e o clique "Guardar" (que também passa por aqui)
     não mexe na conta. */
  const cards = createCardSession({runtime, conversation: () => String(live.session || ''), sendText, writeNote, noteTurns, emit, appendLog});

  function show(scope, raw) {
    return cards.show(raw, String(scope?.conversationId || ''));
  }

  function suggestNote(scope, raw) {
    return cards.suggestNote(raw, String(scope?.conversationId || ''));
  }

  /* A ponte de material do OpenCode chega com o escopo capturado no grant
     (#139): a sugestão só nasce na conversa/matéria atuais. */
  function suggestNoteFromGrant(granted, raw) {
    const current = typeof scope === 'function' ? scope() : null;
    const grantedFree = granted?.courseId === freeId ? String(granted.freeSessionId || '') : '';
    const currentFree = current?.courseId === freeId ? String(current.freeSessionId || '') : '';
    if (!current || granted?.courseId !== current.courseId || granted?.session !== current.conversation || grantedFree !== currentFree) {
      throw Error(message('err.note.sessionChanged'));
    }
    return suggestNote({conversationId: current.conversation}, raw);
  }

  ipcMain.handle('card-list', () => cards.list());
  ipcMain.handle('card-draft', (_event, payload) => cards.draft(payload));
  ipcMain.handle('card-answer', (_event, payload) => cards.answer(payload));
  ipcMain.handle('card-dismiss', (_event, payload) => cards.dismiss(payload));
  ipcMain.handle('card-conclude', (_event, payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('cartão inválido; esperado object {id}');
    return cards.conclude(String(payload.id || ''));
  });
  /* O clique "Guardar" da nota (#139): o renderer manda só o id; o main lê o
     texto da sugestão guardada e grava pelo funil de `Notas/` (que valida de
     novo caminho e conteúdo). */
  ipcMain.handle('note-card-save', (_event, payload) => cards.saveNote(payload));

  return {show, suggestNote, suggestNoteFromGrant, list: (session) => cards.list(session), sendText, conclude: (id) => cards.conclude(id)};
}

module.exports = {createCardHost};
