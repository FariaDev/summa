// @ts-check
/* Casco das Configurações na forma aprovada do Carbon r2 (2026-11-10): a
   busca, as linhas com rótulo à esquerda e controle à direita, os seletores
   com seta e os liga/desliga como interruptores. Sem marca nem frase de
   abertura: texto que não é necessário não entra (AGENTS.md, Interface). O corpo, os ids e o IPC continuam os do `index.html`; este
   módulo só veste o que já existe, uma vez, quando as Configurações abrem. */
import {t} from './ui-text.mjs';
import {icon} from '../icons.mjs';

const doc = () => document;

/* Rótulos que são uma linha inteira (rótulo + controle). Os do editor de
   leitores têm o ritmo próprio (rótulo acima do campo) e ficam de fora. */
const ROW_LABELS = [
  '#settings-sec-mesa > .set-group > label',
  '#settings-sec-avisos > .set-group > label',
  '#settings-sec-avisos > label',
  '#settings-sec-pastas > .set-group > label',
  '#settings-sec-pastas .cfg-free-models > label',
].join(',');

function searchMarkup() {
  const label = t('common.search');
  return `<label class="settings-search field-wrap">
 <span class="settings-search-icon" aria-hidden="true">${icon('search')}</span>
 <input id="settings-search" type="search" placeholder="${label}" aria-label="${label}" data-i18n-attr="placeholder=common.search;aria-label=common.search" autocomplete="off" spellcheck="false">
</label>`;
}

/* A chave de tradução do `title` vira descrição visível; o title some para o
   leitor de tela não ouvir a mesma frase duas vezes. */
function descriptionKey(label) {
  for (const pair of String(label.getAttribute('data-i18n-attr') || '').split(';')) {
    const [attr, key] = pair.split('=').map((part) => part.trim());
    if (attr === 'title' && key) return key;
  }
  return '';
}

function wrapRowText(label) {
  if (label.querySelector(':scope > .set-text')) return null;
  const wrap = doc().createElement('span');
  wrap.className = 'set-text';
  let moved = false;
  for (const node of [...label.childNodes]) {
    const textNode = node.nodeType === Node.TEXT_NODE && node.textContent.trim();
    const plainSpan = node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SPAN'
      && !node.classList.contains('path-row') && !node.classList.contains('set-select');
    if (!textNode && !plainSpan) continue;
    wrap.append(node);
    moved = true;
  }
  if (!moved) return null;
  label.prepend(wrap);
  return wrap;
}

function describeRow(label, wrap) {
  if (!wrap) return;
  const key = descriptionKey(label);
  const raw = label.getAttribute('title') || '';
  label.removeAttribute('title');
  label.removeAttribute('data-i18n-attr');
  const desc = doc().createElement('span');
  desc.className = 'set-desc';
  if (key) {
    desc.dataset.i18n = key;
    desc.textContent = t(key);
  } else {
    desc.textContent = raw;
  }
  if (desc.textContent) wrap.append(desc);
}

/* A nota que descreve o controle (`aria-describedby`) e vinha solta abaixo da
   linha entra na coluna do rótulo, como a descrição do r2. Antes ela caía
   embaixo da linha inteira, fora da grade (revisão do 839f7227). */
function adoptNote(label, wrap) {
  const note = label.nextElementSibling;
  if (!wrap || !note?.matches('p.fine[id]')) return;
  if (!label.querySelector(`[aria-describedby~="${note.id}"]`)) return;
  note.classList.add('set-desc');
  wrap.append(note);
}

function decorateRows() {
  for (const label of doc().querySelectorAll(ROW_LABELS)) {
    label.classList.add('set-row');
    const wrap = wrapRowText(label) || label.querySelector(':scope > .set-text');
    describeRow(label, wrap);
    adoptNote(label, wrap);
  }
  for (const label of doc().querySelectorAll('#notify-mode label')) label.classList.add('set-row');
}

function wrapSelects() {
  for (const select of doc().querySelectorAll('#settings-form select')) {
    if (select.closest('.set-select')) continue;
    const wrap = doc().createElement('span');
    wrap.className = 'set-select';
    select.before(wrap);
    wrap.append(select);
    const mark = doc().createElement('span');
    mark.className = 'set-select-icon';
    mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = icon('chevronDown');
    wrap.append(mark);
  }
}

function markSwitches() {
  for (const input of doc().querySelectorAll('#settings-form input[type="checkbox"]')) {
    input.classList.add('set-switch');
  }
}

function mountEmptyMessage() {
  const body = doc().querySelector('#settings-body');
  if (!body || body.querySelector('#settings-search-empty')) return;
  const empty = doc().createElement('p');
  empty.id = 'settings-search-empty';
  empty.className = 'settings-empty';
  empty.dataset.i18n = 'search.empty';
  empty.textContent = t('search.empty');
  empty.hidden = true;
  body.append(empty);
}

/**
 * Veste as Configurações com a busca e as linhas do protótipo r2.
 * Idempotente: a segunda abertura não duplica nada.
 * @param {Document} [root]
 * @returns {boolean} true quando o casco entrou agora
 * @example mountSettingsChrome()
 */
export function mountSettingsChrome(root = document) {
  const nav = root.querySelector('#settings-dialog .settings-nav');
  const title = nav?.querySelector('#settings-title');
  if (!nav || !title) return false;
  const first = !nav.querySelector('#settings-search');
  if (first) {
    title.insertAdjacentHTML('afterend', searchMarkup());
    mountEmptyMessage();
  }
  decorateRows();
  wrapSelects();
  markSwitches();
  return first;
}
