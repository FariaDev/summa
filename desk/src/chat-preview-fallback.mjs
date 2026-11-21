// @ts-check
/* H4: o tutor pré-visualiza a atividade e termina a resposta sem
   publicar — às vezes dizendo que publicou. A prévia não é exibida ao aluno,
   então no fim do turno normal a última prévia vira quadro na conversa. Se a
   publicação falhar (por exemplo, o console da prévia tem erro e o host
   recusa), fica um aviso visível no lugar: o aluno nunca termina sem nada.

   O host resolve o rascunho e publica com um id sintético `previa:prv-…`; o
   slot nasce no ponto da chamada da prévia (#61), não no fim de `#messages`. */

import {ensureActivitySlot} from './chat-turn.mjs';
import {ensureActivityHost} from './activity-loader.mjs';
import {previewIdOfText} from './timeline.mjs';
import {S} from './state.mjs';
import {t} from './ui-text.mjs';

/** Texto do resultado de uma ferramenta (string ou `{content}` do Claude/OpenCode).
 * @param {unknown} result
 * @returns {string}
 * @example resultText({content: [{type: 'text', text: 'ok'}]}) // 'ok'
 */
export function resultText(result) {
  if (typeof result === 'string') return result;
  const content = result && typeof result === 'object' ? /** @type {Record<string, any>} */ (result).content : '';
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
  return previewIdOfText(resultText(result));
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
 * O `anchor` é o segmento da chamada `previsualizar_atividade`: o quadro entra
 * ali, não no fim de `#messages` (#61).
 * @param {{previaId: string, conversationId?: string|null, anchor?: Element|null}} preview
 * @param {{desk?: Record<string, any>, messages?: Element|null, session?: () => string|null}} [deps]
 * @returns {Promise<Record<string, any>|null>} a atividade publicada, ou null
 * @example await showUnpublishedPreview({previaId: 'prv-0123456789ab', conversationId: 'conv', anchor: article})
 */
export async function showUnpublishedPreview({previaId, conversationId = null, anchor = null} = /** @type {any} */ ({}), {desk = window.desk, messages = null, session = () => S.currentSession} = /** @type {any} */ ({})) {
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
  const slot = ensureActivitySlot(`previa:${previaId}`, {status: 'pending', anchor});
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
