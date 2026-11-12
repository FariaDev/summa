/* Miolo do `#review-dialog` (caderno de revisão). Saiu do `dialogs.mjs` na
   #desempenho: só o caderno o usa e o `review.core.js` (85 KiB) deixou de
   entrar na partida junto com os diálogos do boot. */
import reviewCore from './generated/review.core.js';
import {dialogsHandlers} from './dialogs.mjs';
import {renderChildren} from './view-host.mjs';

/**
 * Repõe a referência fixa e os três campos do `#review-form`, com as ações do
 * molde do núcleo (`core/review.bend`).
 * @param {string} [question] questão já preenchida
 * @param {string} [attempt] tentativa do aluno
 * @param {string} [difficulty] dificuldade apontada
 * @param {string} [hint] linha da referência (documento + página)
 * @returns {void}
 * @example renderReview('Limites', 'dividi por x²', 'fatoração', 'Referência: Limites, p. 3')
 */
export function renderReview(question = '', attempt = '', difficulty = '', hint = '') {
  const form = document.querySelector('#review-form');
  if (!form) return;
  renderChildren(
    form,
    reviewCore.reviewDialogChildren(String(question), String(attempt), String(difficulty), String(hint)),
    dialogsHandlers
  );
}
