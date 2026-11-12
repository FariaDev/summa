import {$, S, capabilities, toast, toastFailure } from './state.mjs';
import { t, LANGUAGE_EVENT } from './ui-text.mjs';
import { icon } from '../icons.mjs';
import { UNKNOWN_RETRY_KEY, retryFailureKey } from './retry-text.mjs';

/* "Tentar de novo" na linha de metadados da ÚLTIMA resposta do tutor (#164).
   O botão nasce só no último balão do tutor e se muda para o novo quando a
   resposta seguinte termina; durante o turno fica desabilitado, não some.
   A recusa vem por código do serviço e a frase sai do catálogo de idioma. */

const RETRY_CLASS = 'msg-retry';
let calling = false;

function retryButtons() {
  return [...document.querySelectorAll(`#messages .message-actions .${RETRY_CLASS}`)];
}

function paintRetry(button) {
  button.disabled = calling || !!S.busy;
}

function paintAll() {
  for (const button of retryButtons()) paintRetry(button);
}

function labelRetry(button) {
  const text = t('talk.retry');
  button.setAttribute('aria-label', text);
  button.title = text;
}

function makeRetryButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = RETRY_CLASS;
  button.innerHTML = icon('rotateCcw');
  labelRetry(button);
  button.addEventListener('click', event => {
    event.stopPropagation();
    void retryLastAnswer();
  });
  return button;
}

/** Leva o botão para a última resposta dada (ou o tira quando o motor não refaz).
 * @param {Element|null|undefined} el balão da última resposta
 * @returns {HTMLElement|null} o botão no lugar, quando existe
 * @example markRetryAnswer(document.querySelector('#messages .message:last-child'));
 */
export function markRetryAnswer(el) {
  if (!el) return null;
  if (capabilities().retryLastTurn !== true) {
    clearRetryAnswer();
    return null;
  }
  const actions = el.querySelector?.('.message-actions');
  if (!actions) return null;
  for (const other of retryButtons()) if (other.parentElement !== actions) other.remove();
  let button = actions.querySelector(`.${RETRY_CLASS}`);
  if (!button) {
    button = makeRetryButton();
    actions.append(button);
  }
  paintRetry(button);
  return button;
}

/** Tira o botão do DOM (troca de motor, conversa recarregada ou turno refeito). */
export function clearRetryAnswer() {
  for (const button of retryButtons()) button.remove();
}

/* O que pertence ao último turno: a resposta, o diário de leituras e os quadros
   de atividade que vieram depois do último balão do aluno. Cartões e avisos são
   da conversa, não do turno, e ficam. */
function lastTurnNodes() {
  const box = $('#messages');
  if (!box) return [];
  const lastUser = [...box.querySelectorAll('.message.user')].at(-1);
  const nodes = [];
  for (let node = lastUser?.nextElementSibling; node; node = node.nextElementSibling) {
    if (node.matches?.('.message.assistant, article.work, .activity-slot')) nodes.push(node);
  }
  return nodes;
}

function refusalText(code) {
  const key = retryFailureKey(code);
  return key === UNKNOWN_RETRY_KEY ? t(key, { code: String(code ?? 'unknown') }) : t(key);
}

/**
 * Refaz o último turno pelo motor e tira a resposta antiga do DOM; o stream
 * normal desenha a nova, sem repetir a pergunta.
 * @returns {Promise<void>} ex.: await retryLastAnswer();
 */
export async function retryLastAnswer() {
  if (calling) return;
  calling = true;
  paintAll();
  try {
    const oldTurn = lastTurnNodes();
    const result = await window.desk.retryLastTurn();
    if (result?.refused === true) {
      toast(refusalText(result.code));
      return;
    }
    for (const node of oldTurn) node.remove();
  } catch (error) {
    if (typeof error?.code === 'string' && error.code) toast(refusalText(error.code));
    else toastFailure(error);
  } finally {
    calling = false;
    paintAll();
  }
}

function syncRetry() {
  if (capabilities().retryLastTurn !== true) {
    clearRetryAnswer();
    return;
  }
  const box = $('#messages');
  if (!box) return;
  const answers = [...box.querySelectorAll('.message:not(.user)')].filter(el => el.querySelector('.msg-review'));
  markRetryAnswer(answers.at(-1));
}

if (typeof window !== 'undefined') {
  window.addEventListener('desk-busy', paintAll);
  window.addEventListener('desk-engine-facts', syncRetry);
  window.addEventListener(LANGUAGE_EVENT, () => {
    for (const button of retryButtons()) labelRetry(button);
  });
}
