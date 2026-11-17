// @ts-check
import {notebookCardOf, notebookSendFacts} from './ambitus-page.mjs';
import {notebookCardNode} from './notebook-card.mjs';

/* Cartões de caderno na bandeja do tutor principal: a página que o Ambitus
   manda, com ou sem o modo mini (`ambitus-page.mjs`).
   O desenho vem de `notebook-card.mjs`, o mesmo do chat lateral. O caminho do
   arquivo fica ESCONDIDO no cartão e segue ao motor no envio (`notebooks` do
   `pi-prompt`, `tutor-prompt-host.cjs`), nunca ao texto que a pessoa vê.

   A bandeja persiste por conversa no `traySave` (como as imagens): o
   `chat-attachments.mjs` manda `tutorNotebooksForSave()` e restaura com
   `restoreTutorNotebooks()` no boot/troca. A miniatura guardada é reduzida a
   240 px de largura para o estado salvo não inchar. Quem desenha na bandeja é
   o `chat-attachments.mjs`, que chama `appendTutorNotebookCards` ao
   redesenhar; aqui mora o estado e o nó do cartão. */

const MAX_NOTEBOOKS = 4;
const THUMB_MAX_WIDTH = 240;
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

/** @typedef {{caminho: string, pagina: number, nome: string, thumb: string, savedThumb?: string, full?: boolean, recorte?: {x: number, y: number, largura: number, altura: number}}} TrayNotebook */

/**
 * O estado puro da bandeja de cadernos (sem DOM): a mesma página não repete,
 * passou do teto sai o mais antigo, e a miniatura pode chegar antes do cartão.
 * `persisted` é o que vai ao disco (com a miniatura reduzida, se houver); o
 * `recorte` do cartão, quando é um trecho, vai junto nos dois.
 * @returns {{add: (raw: unknown) => boolean, setThumb: (raw: unknown) => boolean, setSavedThumb: (raw: unknown) => boolean,
 *   restore: (raw: unknown) => void, remove: (item: TrayNotebook) => void, list: () => TrayNotebook[],
 *   snapshot: () => Array<{caminho: string, pagina: number, nome: string, recorte?: object}>,
 *   persisted: () => Array<{caminho: string, pagina: number, nome: string, recorte?: object, thumb: string}>,
 *   release: (sent: unknown) => void, clear: () => void}}
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
      const earlyThumb = early.get(keyOf(card)) || '';
      const cached = old?.thumb || earlyThumb;
      items = items.filter((item) => item !== old);
      items.push({...card, thumb: cached, savedThumb: old?.savedThumb || '', full: old?.full === true || !!earlyThumb});
      items = items.slice(-MAX_NOTEBOOKS);
      return true;
    },
    setThumb(raw) {
      const {caminho, pagina, thumb} = /** @type {{caminho?: unknown, pagina?: unknown, thumb?: unknown}} */ (raw || {});
      if (typeof thumb !== 'string' || !PNG_DATA_URL.test(thumb)) return false;
      const card = items.find((item) => item.caminho === caminho && item.pagina === pagina);
      if (card) { card.thumb = thumb; card.full = true; card.savedThumb = ''; return true; }
      if (typeof caminho === 'string' && typeof pagina === 'number') {
        early.set(keyOf({caminho, pagina}), thumb);
        if (early.size > MAX_NOTEBOOKS) early.delete(/** @type {string} */ (early.keys().next().value));
      }
      return false;
    },
    setSavedThumb(raw) {
      const {caminho, pagina, thumb} = /** @type {{caminho?: unknown, pagina?: unknown, thumb?: unknown}} */ (raw || {});
      if (typeof thumb !== 'string' || !PNG_DATA_URL.test(thumb)) return false;
      const card = items.find((item) => item.caminho === caminho && item.pagina === pagina);
      if (!card) return false;
      card.savedThumb = thumb;
      return true;
    },
    restore(raw) {
      items = [];
      for (const entry of Array.isArray(raw) ? raw : []) {
        const item = /** @type {{thumb?: unknown}} */ (entry);
        const card = notebookCardOf(item);
        if (!card || items.some((other) => keyOf(other) === keyOf(card))) continue;
        const thumb = typeof item?.thumb === 'string' && PNG_DATA_URL.test(item.thumb) ? item.thumb : '';
        items.push({...card, thumb, savedThumb: thumb, full: false});
      }
      items = items.slice(-MAX_NOTEBOOKS);
    },
    remove(item) { items = items.filter((other) => other !== item); },
    list: () => items,
    snapshot: () => items.map(notebookSendFacts),
    persisted: () => items.map((item) => ({...notebookSendFacts(item), thumb: item.savedThumb || item.thumb || ''})),
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
/** @type {() => void} */
let persist = () => {};

/** O `chat-attachments.mjs` diz como redesenhar a bandeja quando um cartão entra ou sai. @param {() => void} fn @returns {void} @example onTutorNotebooksChange(renderAttachments) */
export function onTutorNotebooksChange(fn) { repaint = fn; }

/** O `chat-attachments.mjs` diz como gravar a bandeja por conversa (o mesmo `traySave` das imagens). @param {() => void} fn @returns {void} @example onTutorNotebooksPersist(persistTray) */
export function onTutorNotebooksPersist(fn) { persist = fn; }

function changed() {
  repaint();
  persist();
}

/** Quantos cartões de caderno estão na bandeja. @returns {number} @example tutorNotebookCount() // 0 */
export function tutorNotebookCount() { return tray.list().length; }

/**
 * O cartão vivo de uma página (para o envio achar a imagem cheia da bandeja),
 * ou `null` quando a página não está na bandeja.
 * @param {{caminho?: unknown, pagina?: unknown}} raw
 * @returns {TrayNotebook|null}
 * @example tutorNotebookFind({caminho: '/c/a.xopp', pagina: 2})?.thumb
 */
export function tutorNotebookFind(raw) {
  const {caminho, pagina} = raw || {};
  return tray.list().find((item) => item.caminho === caminho && item.pagina === pagina) || null;
}

/** O que o envio leva: caminho, página e nome (a miniatura não vai). @returns {Array<{caminho: string, pagina: number, nome: string}>} @example tutorNotebooksSnapshot() // [{caminho: '/c/a.xopp', pagina: 2, nome: 'a'}] */
export function tutorNotebooksSnapshot() { return tray.snapshot(); }
/** Cartões de um item da fila lido do disco: só os válidos, no máximo quatro. @param {unknown} raw @returns {Array<{caminho: string, pagina: number, nome: string}>} @example queuedNotebooks([{caminho: "/c/a.xopp", pagina: 2, nome: "a"}, null]) // [{caminho: "/c/a.xopp", pagina: 2, nome: "a"}] */
export function queuedNotebooks(raw) { return (Array.isArray(raw) ? raw : []).map(notebookCardOf).filter(Boolean).slice(0, 4); }

/** O que o `traySave` guarda: os fatos do cartão e a miniatura reduzida. @returns {Array<{caminho: string, pagina: number, nome: string, thumb: string}>} @example tutorNotebooksForSave() // [{caminho: '/c/a.xopp', pagina: 2, nome: 'a', thumb: ''}] */
export function tutorNotebooksForSave() { return tray.persisted(); }

/** Tira da bandeja o que o envio levou. @param {unknown} sent os cartões enviados @returns {void} @example releaseTutorNotebooks([{caminho: '/c/a.xopp', pagina: 2}]) */
export function releaseTutorNotebooks(sent) {
  if (!Array.isArray(sent) || !sent.length) return;
  tray.release(sent);
  changed();
}

/** Esvazia a bandeja de cadernos (troca de conversa); sem gravar, quem restaura é o `restoreTutorNotebooks`. @returns {void} @example clearTutorNotebooks() */
export function clearTutorNotebooks() {
  if (!tray.list().length) return;
  tray.clear();
  repaint();
}

/**
 * Põe na bandeja os cartões guardados da conversa (boot e troca). O main já
 * descartou o caderno cujo arquivo sumiu; nada aqui grava de volta.
 * @param {unknown} raw `[{caminho, pagina, nome, thumb}]` do `pending`
 * @returns {void}
 * @example restoreTutorNotebooks([{caminho: '/c/a.xopp', pagina: 2, nome: 'a', thumb: ''}])
 */
export function restoreTutorNotebooks(raw) {
  tray.restore(raw);
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
  changed();
  /** @type {HTMLElement|null} */ (document.querySelector('#prompt'))?.focus();
  return true;
}

/** A miniatura chegou depois do cartão (a leitura do caderno demora). @param {unknown} raw `{caminho, pagina, thumb}` @returns {boolean} @example setTutorNotebookThumb({caminho: '/c/a.xopp', pagina: 2, thumb: 'data:image/png;base64,iVBOR'}) */
export function setTutorNotebookThumb(raw) {
  if (!tray.setThumb(raw)) return false;
  changed();
  const {caminho, pagina, thumb} = /** @type {{caminho?: unknown, pagina?: unknown, thumb?: unknown}} */ (raw || {});
  void shrinkThumb(/** @type {string} */ (thumb)).then((small) => {
    if (!small || !tray.setSavedThumb({caminho, pagina, thumb: small})) return;
    changed();
  }).catch(() => {});
  return true;
}

/** A miniatura guardada: no máximo 240 px de largura, para o `pending.json` não inchar. @param {string} dataUrl @returns {Promise<string>} */
async function shrinkThumb(dataUrl) {
  const image = await new Promise((resolve, reject) => {
    const node = new Image();
    node.onload = () => resolve(node);
    node.onerror = reject;
    node.src = dataUrl;
  });
  if (image.naturalWidth <= THUMB_MAX_WIDTH) return dataUrl;
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_MAX_WIDTH;
  canvas.height = Math.max(1, Math.round(image.naturalHeight * (THUMB_MAX_WIDTH / image.naturalWidth)));
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/** @param {TrayNotebook} item @returns {HTMLElement} o cartão `.attachment` do caderno, com o × */
function cardNode(item) {
  return notebookCardNode(item, {
    key: `notebook-${item.caminho}#${item.pagina}`,
    onRemove: () => {
      tray.remove(item);
      changed();
      /** @type {HTMLElement|null} */ (document.querySelector('#prompt'))?.focus();
    },
  });
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
