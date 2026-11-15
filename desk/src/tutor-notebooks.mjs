// @ts-check
import {notebookCardOf} from './ambitus-page.mjs';
import {t} from './ui-text.mjs';
import {icon} from '../icons.mjs';

/* Cartões de caderno na bandeja do tutor principal: a página que o Ambitus
   manda quando o modo mini está ligado (`ambitus-page.mjs` decide o destino).
   O desenho é o do chat lateral (`.attachment .notebook-card`, composer.css):
   miniatura da página (ou o ícone do caderno), nome e "pág. N". O caminho do
   arquivo fica ESCONDIDO no cartão e segue ao motor no envio (`notebooks` do
   `pi-prompt`, `tutor-prompt-host.cjs`), nunca ao texto que a pessoa vê.

   Estado só desta execução: não vai ao `traySave` (a bandeja guardada por
   conversa é de imagens e PDFs) e some ao trocar de conversa. Quem desenha na
   bandeja é o `chat-attachments.mjs`, que chama `appendTutorNotebookCards` ao
   redesenhar; aqui mora o estado e o nó do cartão. */

const MAX_NOTEBOOKS = 4;
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

/** @typedef {{caminho: string, pagina: number, nome: string, thumb: string}} TrayNotebook */

/**
 * O estado puro da bandeja de cadernos (sem DOM): a mesma página não repete,
 * passou do teto sai o mais antigo, e a miniatura pode chegar antes do cartão.
 * @returns {{add: (raw: unknown) => boolean, setThumb: (raw: unknown) => boolean, remove: (item: TrayNotebook) => void, list: () => TrayNotebook[],
 *   snapshot: () => Array<{caminho: string, pagina: number, nome: string}>, release: (sent: unknown) => void, clear: () => void}}
 * @example const tray = createNotebookTray(); tray.add({caminho: '/c/a.xopp', pagina: 2, nome: 'a'}); tray.snapshot() // [{caminho: '/c/a.xopp', pagina: 2, nome: 'a'}]
 */
export function createNotebookTray() {
  /** @type {TrayNotebook[]} */
  let items = [];
  /** @type {Map<string, string>} */
  const early = new Map();
  const keyOf = (/** @type {{caminho: unknown, pagina: unknown}} */ item) => `${item.caminho}#${item.pagina}`;
  return {
    add(raw) {
      const card = notebookCardOf(raw);
      if (!card) return false;
      const old = items.find((item) => keyOf(item) === keyOf(card));
      items = items.filter((item) => item !== old);
      items.push({...card, thumb: old?.thumb || early.get(keyOf(card)) || ''});
      items = items.slice(-MAX_NOTEBOOKS);
      return true;
    },
    setThumb(raw) {
      const {caminho, pagina, thumb} = /** @type {{caminho?: unknown, pagina?: unknown, thumb?: unknown}} */ (raw || {});
      if (typeof thumb !== 'string' || !PNG_DATA_URL.test(thumb)) return false;
      const card = items.find((item) => item.caminho === caminho && item.pagina === pagina);
      if (card) { card.thumb = thumb; return true; }
      if (typeof caminho === 'string' && typeof pagina === 'number') {
        early.set(keyOf({caminho, pagina}), thumb);
        if (early.size > MAX_NOTEBOOKS) early.delete(/** @type {string} */ (early.keys().next().value));
      }
      return false;
    },
    remove(item) { items = items.filter((other) => other !== item); },
    list: () => items,
    snapshot: () => items.map(({caminho, pagina, nome}) => ({caminho, pagina, nome})),
    /* Tira da bandeja o que o envio levou; o que chegou durante o envio fica. */
    release(sent) {
      const gone = new Set((Array.isArray(sent) ? sent : []).map((item) => keyOf(item || {})));
      items = items.filter((item) => !gone.has(keyOf(item)));
    },
    clear() { items = []; },
  };
}

const tray = createNotebookTray();
/** @type {() => void} */
let repaint = () => {};

/** O `chat-attachments.mjs` diz como redesenhar a bandeja quando um cartão entra ou sai. @param {() => void} fn @returns {void} @example onTutorNotebooksChange(renderAttachments) */
export function onTutorNotebooksChange(fn) { repaint = fn; }

/** Quantos cartões de caderno estão na bandeja. @returns {number} @example tutorNotebookCount() // 0 */
export function tutorNotebookCount() { return tray.list().length; }

/** O que o envio leva: caminho, página e nome (a miniatura não vai). @returns {Array<{caminho: string, pagina: number, nome: string}>} @example tutorNotebooksSnapshot() // [{caminho: '/c/a.xopp', pagina: 2, nome: 'a'}] */
export function tutorNotebooksSnapshot() { return tray.snapshot(); }

/** Tira da bandeja o que o envio levou. @param {unknown} sent os cartões enviados @returns {void} @example releaseTutorNotebooks([{caminho: '/c/a.xopp', pagina: 2}]) */
export function releaseTutorNotebooks(sent) {
  if (!Array.isArray(sent) || !sent.length) return;
  tray.release(sent);
  repaint();
}

/** Esvazia a bandeja de cadernos (troca de conversa). @returns {void} @example clearTutorNotebooks() */
export function clearTutorNotebooks() {
  if (!tray.list().length) return;
  tray.clear();
  repaint();
}

/**
 * A página que o Ambitus mandou entra na bandeja do tutor, com o foco no campo.
 * @param {unknown} raw `{caminho, pagina, nome}`
 * @returns {boolean} false quando o pedido não é uma página
 * @example attachTutorNotebook({caminho: '/c/a.xopp', pagina: 2, nome: 'a'}) // true
 */
export function attachTutorNotebook(raw) {
  if (!tray.add(raw)) return false;
  repaint();
  /** @type {HTMLElement|null} */ (document.querySelector('#prompt'))?.focus();
  return true;
}

/** A miniatura chegou depois do cartão (a leitura do caderno demora). @param {unknown} raw `{caminho, pagina, thumb}` @returns {boolean} @example setTutorNotebookThumb({caminho: '/c/a.xopp', pagina: 2, thumb: 'data:image/png;base64,iVBOR'}) */
export function setTutorNotebookThumb(raw) {
  if (!tray.setThumb(raw)) return false;
  repaint();
  return true;
}

/** @param {TrayNotebook} item @returns {HTMLElement} o cartão `.attachment` do caderno, com o × */
function cardNode(item) {
  const page = t('sidechat.tray.page', {page: item.pagina});
  const thumb = document.createElement(item.thumb ? 'img' : 'span');
  thumb.className = 'notebook-thumb';
  if (item.thumb) { thumb.setAttribute('src', item.thumb); thumb.setAttribute('alt', ''); }
  else { thumb.setAttribute('aria-hidden', 'true'); thumb.innerHTML = icon('book'); }
  const name = document.createElement('span');
  name.className = 'notebook-name';
  name.textContent = item.nome;
  const where = document.createElement('span');
  where.className = 'notebook-page';
  where.textContent = page;
  const text = document.createElement('span');
  text.className = 'notebook-text';
  text.append(name, where);
  const file = document.createElement('div');
  file.className = 'file notebook-card';
  file.title = `${item.nome} · ${page}`;
  file.append(thumb, text);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'attachment-remove';
  remove.setAttribute('aria-label', t('attach.remove', {name: item.nome}));
  remove.textContent = '×';
  remove.addEventListener('click', () => {
    tray.remove(item);
    repaint();
    /** @type {HTMLElement|null} */ (document.querySelector('#prompt'))?.focus();
  });
  const card = document.createElement('div');
  card.className = 'attachment';
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', `${item.nome}, ${page}`);
  card.dataset.key = `notebook-${item.caminho}#${item.pagina}`;
  card.append(file, remove);
  return card;
}

/**
 * Põe os cartões de caderno no fim da bandeja de anexos (o `chat-attachments.mjs`
 * a redesenha por inteiro a cada mudança, então isto roda depois).
 * @param {HTMLElement} box a bandeja `#attachments`
 * @returns {void}
 * @example appendTutorNotebookCards(document.querySelector('#attachments'))
 */
export function appendTutorNotebookCards(box) {
  box.append(...tray.list().map(cardNode));
}
