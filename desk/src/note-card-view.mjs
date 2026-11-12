/* Nota sugerida pelo tutor na conversa (#139). O texto vem do modelo e NÃO é
   confiável: título e conteúdo entram por `textContent`, nunca por HTML. O
   cartão só mostra botões enquanto a sugestão está pendente; "Guardar" chama o
   IPC do main (que revalida o caminho e o conteúdo) e "Descartar" encerra a
   sugestão sem gravar nada. */

import {t} from './ui-text.mjs';

const node = (tag, className = '', text = '') => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
};

const statusOf = (card) => (typeof card?.status === 'string' ? card.status : 'pending');

function button(label, className, action, {disabled = false, key = ''} = {}) {
  const element = node('button', className, label);
  element.type = 'button';
  element.disabled = disabled;
  if (key) element.dataset.cardKey = key;
  element.addEventListener('click', action);
  return element;
}

/**
 * Cria o cartão de uma nota sugerida.
 * @param {object} card cartão público (`kind: 'note'`)
 * @param {{noteSave?: Function, dismiss?: Function}} api
 * @returns {HTMLElement}
 * @example const el = noteCardElement(card, {noteSave: (id) => window.desk.noteCardSave({id})});
 */
export function noteCardElement(card, api) {
  const article = node('article', 'message assistant quiz note');
  article.dataset.role = 'assistant';
  article.dataset.tool = card.id;
  article.setAttribute('aria-label', t('note.aria'));
  const box = node('div', 'quiz-card note-card');
  article.append(box);
  const state = {card, busy: false, error: typeof card.saveError === 'string' ? card.saveError : ''};

  function apply(next) {
    if (!next || typeof next !== 'object') return;
    state.card = next;
    state.error = typeof next.saveError === 'string' ? next.saveError : '';
    paint();
  }

  async function run(action) {
    if (state.busy) return;
    state.busy = true;
    state.error = '';
    paint();
    try {
      apply(await action());
    } catch (error) {
      state.error = String(error?.message || error);
    } finally {
      state.busy = false;
      paint();
    }
  }

  function actions() {
    const row = node('div', 'quiz-actions note-actions');
    if (state.busy) {
      row.append(node('span', 'quiz-pending', t('note.saving')));
      return row;
    }
    row.append(button(t('note.save'), 'quiz-conclude note-save primary', () => run(() => api.noteSave(state.card.id)), {key: 'save'}));
    row.append(button(t('note.dismiss'), 'quiz-skip note-dismiss', () => run(() => api.dismiss(state.card.id)), {key: 'dismiss'}));
    return row;
  }

  function paint() {
    const active = document.activeElement?.dataset?.cardKey || '';
    const parts = [node('div', 'note-heading', t('note.heading'))];
    parts.push(node('h3', 'note-title', String(state.card.title || '')));
    /* Conteúdo não confiável: `textContent` é o caminho, mesmo com Markdown. */
    parts.push(node('pre', 'note-content', String(state.card.content || '')));
    const status = statusOf(state.card);
    if (status === 'saved') {
      parts.push(node('p', 'quiz-sent note-status', t('note.saved', {rel: state.card.saved?.rel || 'Notas/'})));
    } else if (status === 'dismissed') {
      parts.push(node('p', 'quiz-dismissed note-status', t('note.dismissed')));
    } else {
      parts.push(actions());
    }
    if (state.error) parts.push(node('p', 'quiz-error note-error', state.error));
    box.replaceChildren(...parts);
    if (active) {
      const next = box.querySelector('[data-card-key="' + CSS.escape(active) + '"]');
      if (next && typeof next.focus === 'function') next.focus();
    }
  }

  article._update = apply;
  article._card = () => state.card;
  paint();
  return article;
}
