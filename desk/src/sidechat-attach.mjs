// @ts-check
import {S,toast,conferirAppName,conferirHintText,labelBtn} from './state.mjs';
import {t,text as uiText,applyStaticText,LANGUAGE_EVENT} from './ui-text.mjs';
import {icon} from '../icons.mjs';
import attachview from './generated/attachview.core.js';
import conferirCore from './generated/conferir.core.js';
import {renderChildren} from './view-host.mjs';
import {bendList,openImageDialog} from './chat-assets.mjs';
import {imageFacts} from './attach-image-facts.mjs';
import {h} from './sidechat-message-view.mjs';
import {notebookCardOf} from './ambitus-page.mjs';

/* Clipe e bandeja de anexos do chat lateral: o MESMO desenho do compositor do
   tutor (`.attach-pop`, `#attachments`, `.attachment`, o × e a leitura da
   imagem de `chat-attachments.mjs`), com estado próprio. A bandeja leva
   imagens e cartões de caderno (a página que o Ambitus manda): o cartão mostra
   a miniatura, o nome e "pág. N" e carrega o caminho do arquivo ESCONDIDO,
   para o tutor reler o caderno com o `ler_caderno`; o caminho vai ao motor no
   envio (`sidechat-host.cjs`), nunca ao texto que a pessoa vê.
   O módulo roda na janela principal mesmo com o chat solto: o DOM muda de
   documento, então tudo aqui acha o documento pelo nó (`ownerDocument`). */

const MAX_NOTEBOOKS = 4;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

/**
 * Os nós da bandeja e do clipe, sem ligar nada: o chat lateral os põe na caixa
 * de mensagem (a bandeja acima do campo, o clipe na fileira de ações, o menu e
 * o seletor de arquivo na coluna do compositor).
 * @returns {{tray: HTMLElement, clip: HTMLElement, pop: HTMLElement, input: HTMLInputElement, check: HTMLButtonElement, file: HTMLElement}}
 * @example const parts = sidechatAttachParts(); parts.clip.id // 'sidechat-attach'
 */
export function sidechatAttachParts() {
  const clip = h('button', {type: 'button', id: 'sidechat-attach', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': 'sidechat-attach-pop', 'data-i18n-attr': 'aria-label=composer.attachAria;title=composer.attachTitle'});
  const file = h('button', {type: 'button', id: 'sidechat-attach-file', role: 'menuitem'});
  const check = /** @type {HTMLButtonElement} */ (h('button', {type: 'button', id: 'sidechat-check', role: 'menuitem'}));
  const pop = h('div', {id: 'sidechat-attach-pop', class: 'attach-pop', role: 'menu', hidden: '', 'data-i18n-attr': 'aria-label=composer.attachMenu'}, file, check);
  const input = /** @type {HTMLInputElement} */ (h('input', {type: 'file', id: 'sidechat-attach-input', accept: [...IMAGE_TYPES].join(','), multiple: '', hidden: ''}));
  const tray = h('div', {id: 'sidechat-attachments', hidden: ''});
  return {tray, clip, pop, input, check, file};
}

/**
 * Liga o clipe, o menu e a bandeja. Devolve a API que o chat lateral usa:
 * `snapshot` (o que vai no envio), `release` (tira o que foi enviado),
 * `clear`, `addNotebook` e `setThumb` (a miniatura chega depois do cartão).
 * @param {ReturnType<typeof sidechatAttachParts>} parts
 * @param {{prompt: HTMLTextAreaElement, root: HTMLElement}} deps `prompt`: o campo, que ganha o foco e recebe o colar de imagem; `root`: o chat lateral, onde o atalho do Conferir vale
 * @returns {{snapshot: () => {images?: Array<{dataUrl: string}>, notebooks?: Array<{caminho: string, pagina: number, nome: string}>},
 *   release: (sent: {images?: Array<{dataUrl: string}>, notebooks?: Array<{caminho: string, pagina: number}>}) => void,
 *   clear: () => void, addNotebook: (raw: unknown) => boolean, setThumb: (raw: unknown) => boolean, addImages: (items: Array<{dataUrl: string, mimeType?: string, name?: string}>) => number,
 *   labels: () => void}}
 * @example const attach = bindSidechatAttach(sidechatAttachParts(), {prompt, root}); attach.addNotebook({caminho: '/c/a.xopp', pagina: 1});
 */
export function bindSidechatAttach(parts, {prompt, root}) {
  const {tray, clip, pop, input, check, file} = parts;
  /** @type {Array<{dataUrl: string, mimeType?: string, name?: string}>} */
  let images = [];
  /** @type {Array<{caminho: string, pagina: number, nome: string, thumb: string}>} */
  let notebooks = [];
  let generation = 0;
  /* A miniatura pode chegar antes do cartão (o chat lateral ainda monta): fica guardada até ele entrar. */
  const early = new Map();
  let maxImages = 4;

  const doc = () => /** @type {Document} */ (clip.ownerDocument || document);

  /* ---------- bandeja ---------- */

  const handlers = {
    RemoveAttachment(/** @type {Event} */ event) {
      const key = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (event.currentTarget)?.closest?.('.attachment'))?.dataset?.key || '';
      if (!key.startsWith('img-')) return;
      images = images.filter((_item, at) => at !== Number(key.slice(4)));
      render();
    },
  };

  function notebookCard(/** @type {(typeof notebooks)[number]} */ item) {
    const name = item.nome;
    const thumb = item.thumb
      ? h('img', {class: 'notebook-thumb', src: item.thumb, alt: ''})
      : h('span', {class: 'notebook-thumb', 'aria-hidden': 'true'});
    if (!item.thumb) thumb.innerHTML = icon('book');
    const remove = h('button', {type: 'button', class: 'attachment-remove', 'aria-label': t('attach.remove', {name}), text: '×'});
    remove.addEventListener('click', () => { notebooks = notebooks.filter((other) => other !== item); render(); prompt.focus(); });
    const page = t('sidechat.tray.page', {page: item.pagina});
    return h('div', {class: 'attachment', role: 'group', 'aria-label': `${name}, ${page}`},
      h('div', {class: 'file notebook-card', title: `${name} · ${page}`}, thumb,
        h('span', {class: 'notebook-text'}, h('span', {class: 'notebook-name', text: name}), h('span', {class: 'notebook-page', text: page}))),
      remove);
  }

  function render() {
    const views = images.length ? attachview.attachmentViews(imageFacts(images), bendList([])) : [];
    renderChildren(tray, views, handlers);
    tray.append(...notebooks.map(notebookCard));
    tray.hidden = !images.length && !notebooks.length;
  }

  /** Imagens já lidas entram na bandeja (o teto é o mesmo do tutor); devolve quantas entraram. */
  function addImages(items) {
    let added = 0;
    for (const item of items) {
      if (images.length >= maxImages) { toast(t('pdf.attach.max', {max: maxImages})); break; }
      images.push(item);
      added++;
    }
    if (added) render();
    return added;
  }

  /** Lê arquivos de imagem pela mesma leitura da bandeja do tutor (reduz, confere o teto de bytes). */
  async function addFiles(/** @type {Iterable<File>} */ list) {
    const files = [...list || []].filter((item) => item && IMAGE_TYPES.has(item.type));
    if (!files.length) return 0;
    const {loadImageAttachment, MAX_ATTACH} = await import('./chat-attachments.mjs');
    maxImages = MAX_ATTACH;
    const gen = generation;
    let added = 0;
    for (const item of files) {
      const loaded = await loadImageAttachment(item, () => gen !== generation);
      if (loaded === undefined) return added;
      if (loaded) added += addImages([loaded]);
    }
    return added;
  }

  /** Um cartão de caderno entra na bandeja (a mesma página não repete; passou do teto, sai o mais antigo). */
  function addNotebook(raw) {
    const card = notebookCardOf(raw);
    if (!card) return false;
    const old = notebooks.find((item) => item.caminho === card.caminho && item.pagina === card.pagina);
    notebooks = notebooks.filter((item) => item !== old);
    notebooks.push({...card, thumb: old?.thumb || early.get(`${card.caminho}#${card.pagina}`) || ''});
    notebooks = notebooks.slice(-MAX_NOTEBOOKS);
    render();
    prompt.focus();
    return true;
  }

  /** A miniatura chegou depois do cartão: só um PNG em data URL, só para um cartão que ainda está lá. */
  function setThumb(raw) {
    const {caminho, pagina, thumb} = /** @type {{caminho?: unknown, pagina?: unknown, thumb?: unknown}} */ (raw || {});
    if (typeof thumb !== 'string' || !PNG_DATA_URL.test(thumb)) return false;
    const card = notebooks.find((item) => item.caminho === caminho && item.pagina === pagina);
    if (!card) {
      if (typeof caminho === 'string' && typeof pagina === 'number') { early.set(`${caminho}#${pagina}`, thumb); if (early.size > MAX_NOTEBOOKS) early.delete(early.keys().next().value); }
      return false;
    }
    card.thumb = thumb;
    render();
    return true;
  }

  function snapshot() {
    return {
      ...(images.length ? {images: images.map((item) => ({dataUrl: item.dataUrl}))} : {}),
      ...(notebooks.length ? {notebooks: notebooks.map(({caminho, pagina, nome}) => ({caminho, pagina, nome}))} : {}),
    };
  }

  /** Tira da bandeja o que o envio levou; o que chegou durante o envio fica. */
  function release(sent) {
    const sentImages = new Set((sent?.images || []).map((item) => item.dataUrl));
    const sentBooks = new Set((sent?.notebooks || []).map((item) => `${item.caminho}#${item.pagina}`));
    images = images.filter((item) => !sentImages.has(item.dataUrl));
    notebooks = notebooks.filter((item) => !sentBooks.has(`${item.caminho}#${item.pagina}`));
    render();
  }

  function clear() {
    generation++;
    images = [];
    notebooks = [];
    render();
  }

  /* ---------- menu ---------- */

  const menuOpen = () => !pop.hidden;
  const items = () => /** @type {HTMLButtonElement[]} */ ([...pop.querySelectorAll('button[role="menuitem"]')]).filter((el) => !el.hidden && !el.disabled);
  const focusItem = (/** @type {number} */ at) => /** @type {HTMLElement|undefined} */ (items()[at])?.focus();
  /** @type {Document|null} */
  let outsideDoc = null;
  const outside = (/** @type {Event} */ event) => {
    const target = /** @type {HTMLElement|null} */ (event.target);
    if (target?.closest?.('#sidechat-attach-pop, #sidechat-attach')) return;
    closeMenu();
  };

  function place() {
    const host = /** @type {HTMLElement|null} */ (pop.offsetParent || pop.parentElement);
    if (!host) return;
    const box = host.getBoundingClientRect(), at = clip.getBoundingClientRect();
    pop.style.bottom = `${Math.round(box.bottom - at.top + 4)}px`;
    pop.style.left = `${Math.max(8, Math.round(at.left - box.left))}px`;
  }

  function closeMenu({restoreFocus = false} = {}) {
    if (!menuOpen()) return;
    const hadFocus = pop.contains(doc().activeElement);
    pop.hidden = true;
    clip.setAttribute('aria-expanded', 'false');
    outsideDoc?.removeEventListener('click', outside);
    outsideDoc = null;
    if (restoreFocus && hadFocus) clip.focus();
  }

  function openMenu() {
    paintCheck();
    pop.hidden = false;
    clip.setAttribute('aria-expanded', 'true');
    place();
    outsideDoc = doc();
    outsideDoc.addEventListener('click', outside);
    focusItem(0);
  }

  /* ---------- Conferir ---------- */

  const conferirOff = () => S.appConfig?.desk?.conferir === false;

  /** A captura entra na bandeja do lateral: as mesmas travas e o mesmo aviso do Conferir do tutor. */
  async function runConferir() {
    closeMenu();
    if (conferirOff()) return;
    const {conferir} = await import('./chat.mjs');
    await conferir({
      attach: (shot) => addFiles([shot]),
      /* Página do Ambitus de caderno salvo: cartão com a imagem de miniatura; o caminho segue escondido para o tutor. */
      notebook: (card, thumb) => {
        if (!addNotebook(card)) return false;
        setThumb({caminho: card.caminho, pagina: card.pagina, thumb});
        return true;
      },
      shutter: clip,
      focus: () => prompt.focus(),
    });
  }

  function paintCheck() {
    const app = conferirAppName();
    const label = uiText(conferirCore.buttonLabel(app));
    check.hidden = conferirOff();
    check.disabled = !S.captureOk;
    check.setAttribute('aria-label', label);
    check.title = S.captureOk ? conferirHintText(false, app) : t('check.unavailable', {label});
    check.innerHTML = `${icon('scan')} `;
    check.append(h('span', {class: 'label-full', text: label}));
  }

  function labels() {
    labelBtn(clip, 'paperclip', t('composer.attach'));
    /* Nome e título pelo mesmo caminho do clipe do tutor, que também troca ⌘ por Ctrl fora do Mac. */
    if (pop.parentElement) applyStaticText(pop.parentElement);
    file.innerHTML = `${icon('paperclip')} `;
    file.append(h('span', {text: t('sidechat.tray.image')}));
    file.setAttribute('aria-label', t('sidechat.tray.image'));
    paintCheck();
    render();
  }

  /* ---------- ligações ---------- */

  clip.addEventListener('click', () => { if (menuOpen()) closeMenu({restoreFocus: true}); else openMenu(); });
  clip.addEventListener('keydown', (/** @type {KeyboardEvent} */ event) => { if (event.key === 'ArrowDown') { event.preventDefault(); openMenu(); } });
  file.addEventListener('click', () => { closeMenu(); input.click(); });
  check.addEventListener('click', () => { void runConferir(); });
  input.addEventListener('change', () => { void addFiles(input.files || []); input.value = ''; });
  pop.addEventListener('keydown', (/** @type {KeyboardEvent} */ event) => {
    const list = items();
    if (!list.length) return;
    if (event.key === 'Escape') { event.preventDefault(); closeMenu({restoreFocus: true}); return; }
    if (event.key === 'Tab') { closeMenu(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const at = list.indexOf(/** @type {HTMLButtonElement} */ (doc().activeElement));
    focusItem(event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : (at + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length);
  });
  /* Clique na miniatura abre a prévia; o × é dono do remover (como na bandeja do tutor). */
  tray.addEventListener('click', (/** @type {Event} */ event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target.closest?.('.attachment-remove')) return;
    const img = /** @type {HTMLImageElement|null} */ (target.closest?.('.attachment > img'));
    if (img) openImageDialog('', img.src, img.alt || t('attach.altImage'));
  });
  /* Colar uma imagem no campo entra na bandeja do lateral, não na do tutor. */
  prompt.addEventListener('paste', (/** @type {ClipboardEvent} */ event) => {
    const shots = [...event.clipboardData?.items || []].filter((item) => item.kind === 'file' && item.type.startsWith('image/')).map((item) => item.getAsFile()).filter(Boolean);
    if (!shots.length) return;
    event.preventDefault();
    event.stopPropagation();
    void addFiles(/** @type {File[]} */ (shots));
  });
  /* Ctrl/⌘+Shift+C com o foco no lateral confere para a bandeja dele. */
  root.addEventListener('keydown', (/** @type {Event} */ raw) => {
    const event = /** @type {KeyboardEvent} */ (raw);
    if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || String(event.key).toLowerCase() !== 'c') return;
    event.preventDefault();
    event.stopPropagation();
    void runConferir();
  });
  window.addEventListener(LANGUAGE_EVENT, labels);
  labels();

  return {snapshot, release, clear, addNotebook, setThumb, addImages, labels};
}
