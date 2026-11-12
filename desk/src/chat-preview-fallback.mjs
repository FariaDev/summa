/* H4: o tutor pré-visualiza a atividade e termina a resposta sem
   publicar — às vezes dizendo que publicou. A prévia não é exibida ao aluno,
   então no fim do turno normal a última prévia vira quadro na conversa. Se a
   publicação falhar (por exemplo, o console da prévia tem erro e o host
   recusa), fica um aviso visível no lugar: o aluno nunca termina sem nada.

   O host resolve o rascunho e publica com um id sintético `previa:prv-…`; o
   slot nasce no fim de `#messages`, porque a prévia não tem passo de
   publicação no diário. */

import {ensureActivitySlot} from './chat-turn.mjs';
import {ensureActivityHost} from './activity-loader.mjs';
import {S} from './state.mjs';
import {t} from './ui-text.mjs';

const PREVIEW_ID = /previaId\s+"(prv-[a-z0-9]{8,24})"/;

/** Texto do resultado de uma ferramenta (string ou `{content}` do Claude/OpenCode).
 * @param {unknown} result
 * @returns {string}
 * @example resultText({content: [{type: 'text', text: 'ok'}]}) // 'ok'
 */
export function resultText(result) {
  if (typeof result === 'string') return result;
  const content = result && typeof result === 'object' ? result.content : '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => (part && typeof part.text === 'string' ? part.text : '')).join('\n');
  return '';
}

/** O `previaId` que o resultado da prévia devolveu, ou ''.
 * @param {unknown} result
 * @returns {string}
 * @example previewIdOf({content: [{type: 'text', text: 'chame com previaId "prv-0123456789ab"'}]}) // 'prv-0123456789ab'
 */
export function previewIdOf(result) {
  const match = PREVIEW_ID.exec(resultText(result));
  return match ? match[1] : '';
}

function visibleNote(messages) {
  const slot = document.createElement('div');
  slot.className = 'activity-slot';
  const note = document.createElement('div');
  note.className = 'activity-note';
  note.setAttribute('role', 'note');
  note.textContent = t('activity.error.previewNotPublished');
  slot.append(note);
  (messages || document.querySelector('#messages'))?.append(slot);
}

/**
 * Publica o rascunho da última prévia no fim do turno; falha vira aviso.
 * @param {{previaId: string, conversationId?: string|null}} preview
 * @param {{desk?: object, messages?: Element|null, session?: () => string|null}} [deps]
 * @returns {Promise<object|null>} a atividade publicada, ou null
 * @example await showUnpublishedPreview({previaId: 'prv-0123456789ab', conversationId: 'conv'})
 */
export async function showUnpublishedPreview({previaId, conversationId = null} = {}, {desk = window.desk, messages = null, session = () => S.currentSession} = {}) {
  if (!previaId) return null;
  const stillHere = () => !conversationId || session() === conversationId;
  /* O host precisa estar ligado antes da publicação: o evento chega antes do
     retorno do IPC, e sem slot (nem ouvinte) ele não teria onde hidratar. */
  try { await ensureActivityHost(); } catch { /* sem host: o aviso abaixo cobre */ }
  if (!stillHere()) return null;
  let scope = null;
  try { scope = typeof desk.activityScope === 'function' ? await desk.activityScope() : null; } catch { /* sem escopo: o aviso abaixo cobre */ }
  if (!stillHere()) return null;
  /* A conversa do escopo tem de ser a do turno: publicar a prévia na conversa
     aberta depois seria entregar o quadro à pessoa errada. */
  if (!scope || typeof scope.scopeRef !== 'string' || !scope.scopeRef || (conversationId && scope.conversationId !== conversationId)) {
    visibleNote(messages);
    return null;
  }
  const slot = ensureActivitySlot(`previa:${previaId}`, {status: 'pending'});
  try {
    const activity = await desk.activityPublishPreview({scopeRef: scope.scopeRef, previaId});
    if (!stillHere()) {
      if (slot?.isConnected) slot.remove();
      return null;
    }
    ensureActivitySlot(`previa:${previaId}`, {status: 'done', artifactId: activity?.id ?? null, version: activity?.version ?? null});
    return activity;
  } catch {
    if (slot?.isConnected) slot.remove();
    if (stillHere()) visibleNote(messages);
    return null;
  }
}
