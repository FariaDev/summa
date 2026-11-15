/* #62: a prévia SEM erro no console publica o quadro na hora, no ponto da
   chamada `previsualizar_atividade`. O host grava a atividade com o id
   sintético `previa:prv-…` e emite `published`; aqui o renderer lê a marca
   `Quadro publicado: act-… v…` do resultado e cria/atualiza o slot.

   - prévia publicada: slot `previa:<id>` no segmento da chamada, já hidratado
     pelo evento que chegou durante a chamada; H4 não entra.
   - prévia com erro (ou falha de publicação): nada aparece; o chamador guarda
     o rascunho para o H4 do fim do turno, como antes.
   - `criar_atividade` de revisão: o resultado traz o `previaId`; o slot da
     chamada de criação sai e o slot da prévia recebe o id/versão novos — um
     quadro só, trocado no lugar.

   Módulo separado para o `chat.mjs` não crescer (teto do `file-size.test`). */

import {ensureActivitySlot, removeActivitySlot} from './chat-turn.mjs';
import {publishedActivityOfText, previewIdOfText} from './timeline.mjs';
import {resultText} from './chat-preview-fallback.mjs';
import {turnState} from './chat-turn-state.mjs';

/**
 * Fim da chamada da prévia: publica o slot quando o resultado diz que o quadro
 * já está visível; senão, deixa o rascunho para o H4.
 * @param {{result: unknown, anchor?: Element|null}} facts
 * @returns {{previaId: string, published: boolean}|null}
 * @example recordPreviewEnd({result: {content: [{type: 'text', text: 'Quadro publicado: act-1 v1'}]}})
 */
export function recordPreviewEnd({result, anchor = null} = {}) {
  const text = resultText(result);
  const previaId = previewIdOfText(text);
  if (!previaId) return null;
  const published = publishedActivityOfText(text);
  if (!published) {
    turnState.turnPreview = {previaId, anchor};
    return {previaId, published: false};
  }
  ensureActivitySlot(`previa:${previaId}`, {status: 'done', anchor, artifactId: published.id, version: published.version});
  turnState.turnPreview = null;
  return {previaId, published: true};
}

/**
 * Fim de `criar_atividade`: quando a publicação foi a revisão de uma prévia,
 * remove o slot da chamada de criação e atualiza o slot da prévia (mesmo
 * quadro, versão nova).
 * @param {{toolCallId: string, result: unknown, anchor?: Element|null}} facts
 * @returns {{previaId: string, published: {id: string, version: number}}|null}
 * @example recordActivityEnd({toolCallId: 'call-2', result: {content: [{type: 'text', text: 'previaId "prv-1" … Quadro publicado: act-1 v2'}]}})
 */
export function recordActivityEnd({toolCallId, result, anchor = null} = {}) {
  const text = resultText(result);
  const previaId = previewIdOfText(text);
  if (!previaId) return null;
  const published = publishedActivityOfText(text);
  if (!published) return null;
  removeActivitySlot(toolCallId);
  ensureActivitySlot(`previa:${previaId}`, {status: 'done', anchor, artifactId: published.id, version: published.version});
  turnState.turnPreview = null;
  turnState.turnPublished = true;
  return {previaId, published};
}
