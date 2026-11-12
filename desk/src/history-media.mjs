// @ts-check
/* Mídia do histórico sob demanda (#121): a bolha nasce com o espaço reservado e
   os bytes vêm por IPC quando ela chega perto da vista. O marcador é o que o
   main mandou no payload; nada aqui conhece caminho nem lê arquivo.

   Este módulo entra por `import()` no `history-format-lazy.mjs` (#121: o payload
   de partida está no teto). Quem cria o espaço reservado é o
   `chat-message-view.mjs`, que já pinta toda bolha; aqui ficam o observador, o
   pedido, a pintura e a falha visível com "tentar de novo". Trocar de conversa
   cancela o lote: resposta atrasada não pinta na conversa nova. */
import {wrapCopy} from './chat-assets.mjs';
import {t} from './ui-text.mjs';

export const HISTORY_MEDIA_PREFIX = 'mesa-history-media:';
export const HISTORY_MEDIA_MARGIN = '1200px 0px';
const MARKER_ID = /^hm-[0-9a-f]{32}$/;
const MAX_RESPONSE_CHARS = 12 * 1024 * 1024;

/**
 * Lê o id de um marcador (`hm-<32 hex>`), ou null.
 * @param {unknown} value
 * @returns {string|null}
 * @example historyMediaId('hm-0123456789abcdef0123456789abcdef') // 'hm-0123…'
 */
export function historyMediaId(value) {
  return typeof value === 'string' && MARKER_ID.test(value) ? value : null;
}

/**
 * Extrai id e metadados de uma URL-marcador. A URL entra na chave do cache de
 * HTML (#120), então o id precisa ser estável e legível aqui.
 * @param {unknown} value
 * @returns {{id: string, bytes: number, mime: string, width: number, height: number}|null}
 * @example historyMediaMarker('mesa-history-media:hm-…?b=12&m=image/png')
 */
export function historyMediaMarker(value) {
  if (typeof value !== 'string' || !value.startsWith(HISTORY_MEDIA_PREFIX)) return null;
  const rest = value.slice(HISTORY_MEDIA_PREFIX.length);
  const at = rest.indexOf('?');
  const id = historyMediaId(at < 0 ? rest : rest.slice(0, at));
  if (!id) return null;
  const params = new URLSearchParams(at < 0 ? '' : rest.slice(at + 1));
  return {
    id,
    bytes: Number(params.get('b')) || 0,
    mime: params.get('m') || 'image/png',
    width: Number(params.get('w')) || 0,
    height: Number(params.get('h')) || 0,
  };
}

function placeholderElement(marker, alt, createElement, translate) {
  const holder = createElement('span');
  holder.className = 'history-media';
  if (holder.dataset) {
    holder.dataset.historyMediaId = marker.id;
    holder.dataset.historyMediaKind = 'image';
    holder.dataset.historyMediaState = 'pending';
  }
  holder.setAttribute('role', 'img');
  holder.setAttribute('aria-label', alt || translate('talk.imageSent'));
  if (marker.width > 0 && marker.height > 0) {
    if (holder.style) {
      holder.style.aspectRatio = `${marker.width} / ${marker.height}`;
      holder.style.width = `min(100%, ${Math.min(marker.width, 640)}px)`;
    }
  } else if (holder.style) {
    holder.style.minHeight = '120px';
  }
  const note = createElement('span');
  note.className = 'history-media-note';
  note.textContent = translate('history.media.loading');
  holder.append(note);
  return holder;
}

/* A URL-marcador nasce no `img.shot` do núcleo; aqui ela vira o espaço
   reservado (a CSS esconde o `img` marcado até esta troca). O `wrapCopy` da
   bolha já envolveu o `img` no `.img-wrap` do overlay; trocar só o `img`
   deixava esse wrapper (e o botão "Copiar") órfão em volta do espaço (#95),
   então o espaço ocupa o lugar do wrapper inteiro. */
function replaceRawImages(scope, createElement, translate) {
  for (const img of scope.querySelectorAll('img.shot')) {
    const marker = historyMediaMarker(img.getAttribute('src'));
    if (!marker) continue;
    const target = img.closest?.('.img-wrap') || img;
    target.replaceWith(placeholderElement(marker, img.getAttribute('alt'), createElement, translate));
  }
}

function responseError(hit) {
  if (!hit || typeof hit !== 'object') return Error('resposta de mídia inválida: esperado objeto');
  if (hit.kind === 'image') {
    if (typeof hit.dataUrl !== 'string' || !hit.dataUrl.startsWith('data:image/')) return Error('imagem sem data URL');
    if (hit.dataUrl.length > MAX_RESPONSE_CHARS) return Error(`imagem acima de ${MAX_RESPONSE_CHARS} caracteres`);
    return null;
  }
  if (hit.kind === 'tool-output') {
    if (typeof hit.text !== 'string') return Error('saída sem texto');
    if (hit.text.length > MAX_RESPONSE_CHARS) return Error(`saída acima de ${MAX_RESPONSE_CHARS} caracteres`);
    return null;
  }
  return Error(`tipo de mídia desconhecido: ${String(hit.kind)}`);
}

/**
 * Pede um item ao main e valida a forma da resposta.
 * @param {string} id id opaco do marcador
 * @returns {Promise<{kind: string, dataUrl?: string, text?: string, mime?: string, bytes?: number}>}
 * @example const hit = await readHistoryMedia('hm-…')
 */
export async function readHistoryMedia(id) {
  const marker = historyMediaId(id);
  if (!marker) throw Error(`mídia do histórico inválida: recebido ${JSON.stringify(id)}; esperado "hm-<32 hex>"`);
  const hit = await window.desk.historyMediaRead(marker);
  const error = responseError(hit);
  if (error) throw error;
  return hit;
}

/**
 * Cria o carregador com as dependências do app (o teste injeta fakes nomeados).
 * @param {{read?: (id: string) => Promise<any>, wrap?: (img: HTMLImageElement) => Element,
 *   observeClass?: typeof IntersectionObserver, translate?: (key: string) => string,
 *   rootMargin?: string, createElement?: (tag: string) => any}} [options]
 * @returns {{arm: (root: ParentNode|null, token: number) => void, cancel: () => void,
 *   decorate: (root: ParentNode|null) => void, stats: () => {generation: number, watching: number, loaded: number}}}
 * @example const loader = createHistoryMediaLoader({read: fakeRead})
 */
export function createHistoryMediaLoader({read = readHistoryMedia, wrap = wrapCopy, observeClass = globalThis.IntersectionObserver, translate = t, rootMargin = HISTORY_MEDIA_MARGIN, createElement = (tag) => document.createElement(tag)} = {}) {
  let generation = 0;
  let root = null;
  /** @type {IntersectionObserver|null} */
  let observer = null;
  /** @type {Map<Element, string>} */
  const watching = new Map();
  /** @type {Map<string, any>} */
  const loaded = new Map();
  /** @type {Map<string, Promise<any>>} */
  const inFlight = new Map();

  function disconnect() {
    if (observer) observer.disconnect();
    observer = null;
  }

  function ensureObserver() {
    if (observer || typeof observeClass !== 'function') return observer;
    observer = new observeClass((entries) => {
      for (const entry of entries) {
        if (!entry?.isIntersecting) continue;
        const id = watching.get(entry.target);
        if (!id) continue;
        observer?.unobserve(entry.target);
        start(entry.target, id);
      }
    }, {root: null, rootMargin, threshold: 0});
    return observer;
  }

  function setState(el, state) {
    if (el?.dataset) el.dataset.historyMediaState = state;
  }

  function paintImage(el, hit) {
    if (!el?.isConnected) return;
    const img = /** @type {HTMLImageElement} */ (createElement('img'));
    img.className = 'shot';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = hit.dataUrl;
    img.alt = el.getAttribute('aria-label') || translate('talk.imageSent');
    const box = wrap(img) || img;
    el.replaceWith(box);
  }

  function failure(el) {
    if (!el?.isConnected) return;
    watching.delete(el);
    setState(el, 'failed');
    el.classList.add('is-failed');
    el.replaceChildren();
    const note = createElement('span');
    note.className = 'history-media-note';
    note.textContent = translate('history.media.imageFailed');
    const retry = /** @type {HTMLButtonElement} */ (createElement('button'));
    retry.type = 'button';
    retry.className = 'history-media-retry';
    retry.textContent = translate('activity.retry');
    retry.addEventListener('click', () => {
      el.classList.remove('is-failed');
      setState(el, 'pending');
      const loading = createElement('span');
      loading.className = 'history-media-note';
      loading.textContent = translate('history.media.loading');
      el.replaceChildren(loading);
      watching.set(el, el.dataset.historyMediaId || '');
      start(el, el.dataset.historyMediaId || '');
    });
    el.append(note, retry);
  }

  function outputFailure(box, row, id) {
    if (!box?.isConnected) return;
    box.replaceChildren();
    const note = createElement('span');
    note.className = 'step-output-note';
    note.textContent = translate('history.media.outputFailed');
    const retry = createElement('button');
    retry.type = 'button';
    retry.className = 'step-output-retry';
    retry.textContent = translate('activity.retry');
    retry.addEventListener('click', () => loadOutput(row, id, box));
    box.append(note, retry);
  }

  function paintOutput(row, hit) {
    const pre = row.querySelector('.step-detail .step-text');
    if (pre) {
      pre.textContent = hit.text;
      pre.hidden = false;
    }
    if (row.dataset) row.dataset.historyMediaLoaded = '1';
    row.querySelector('.step-output')?.remove();
  }

  function loadOutput(row, id, box) {
    const loading = createElement('span');
    loading.className = 'step-output-note';
    loading.textContent = translate('history.media.loading');
    box.replaceChildren(loading);
    const token = generation;
    let request = inFlight.get(id);
    if (!request) {
      request = Promise.resolve().then(() => read(id));
      inFlight.set(id, request);
      request.finally(() => inFlight.delete(id)).catch(() => {});
    }
    request.then((value) => {
      if (token !== generation || !row.isConnected) return;
      const error = responseError(value);
      if (error || value.kind !== 'tool-output') throw error || Error('saída inválida');
      loaded.set(id, value);
      paintOutput(row, value);
    }).catch(() => {
      if (token !== generation || !row.isConnected) return;
      outputFailure(box, row, id);
    });
  }

  function decorateOutputs(scope) {
    for (const row of scope.querySelectorAll('[data-history-media-output]')) {
      const id = historyMediaId(row.dataset?.historyMediaOutput);
      if (!id) continue;
      const hit = loaded.get(id);
      if (hit?.kind === 'tool-output') {
        paintOutput(row, hit);
        continue;
      }
      if (row.dataset?.historyMediaLoaded === '1' || row.querySelector('.step-output')) continue;
      const detail = row.querySelector('.step-detail');
      if (!detail) continue;
      const box = createElement('div');
      box.className = 'step-output';
      const button = createElement('button');
      button.type = 'button';
      button.className = 'step-output-load';
      button.textContent = translate('history.media.showOutput');
      button.addEventListener('click', () => loadOutput(row, id, box));
      box.append(button);
      detail.append(box);
    }
  }

  function start(el, id) {
    if (!id) return;
    const token = generation;
    const hit = loaded.get(id);
    if (hit) {
      paintImage(el, hit);
      return;
    }
    setState(el, 'loading');
    let request = inFlight.get(id);
    if (!request) {
      request = Promise.resolve().then(() => read(id));
      inFlight.set(id, request);
      request.finally(() => inFlight.delete(id)).catch(() => {});
    }
    request.then((value) => {
      if (token !== generation || !el.isConnected) return;
      const error = responseError(value);
      if (error) throw error;
      loaded.set(id, value);
      watching.delete(el);
      if (value.kind === 'image') paintImage(el, value);
    }).catch(() => {
      if (token !== generation || !el.isConnected) return;
      failure(el);
    });
  }

  function decorate(scope) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return;
    replaceRawImages(scope, createElement, translate);
    decorateOutputs(scope);
    for (const el of scope.querySelectorAll('[data-history-media-id]')) {
      const id = historyMediaId(el.dataset?.historyMediaId);
      if (!id) {
        failure(el);
        continue;
      }
      if (watching.has(el)) continue;
      if (el.dataset?.historyMediaState === 'failed') continue;
      const hit = loaded.get(id);
      if (hit) {
        watching.delete(el);
        paintImage(el, hit);
        continue;
      }
      watching.set(el, id);
      const observerNow = ensureObserver();
      if (observerNow) observerNow.observe(el);
      else start(el, id);
    }
  }

  return {
    arm(nextRoot, token) {
      generation = Number(token) || generation + 1;
      root = nextRoot;
      disconnect();
      watching.clear();
      decorate(root);
    },
    cancel() {
      generation += 1;
      disconnect();
      watching.clear();
      loaded.clear();
      inFlight.clear();
      root = null;
    },
    decorate,
    stats() {
      return {generation, watching: watching.size, loaded: loaded.size};
    },
  };
}

const loader = createHistoryMediaLoader();

/**
 * Arma o lote do `showHistory` na janela (o `chat.mjs` chama depois de montar).
 * @param {ParentNode|null} root
 * @param {number} token
 * @returns {void}
 * @example armHistoryMedia(document.querySelector('#messages'), 2)
 */
export function armHistoryMedia(root, token) {
  loader.arm(root, token);
}

/**
 * Cancela o lote e esquece os bytes da conversa que saiu da tela.
 * @returns {void}
 * @example cancelHistoryMedia()
 */
export function cancelHistoryMedia() {
  loader.cancel();
}

/**
 * Pinta as mídias já armadas dentro de uma bolha reformatada.
 * @param {ParentNode|null} root
 * @returns {void}
 * @example decorateHistoryMedia(body)
 */
export function decorateHistoryMedia(root) {
  loader.decorate(root);
}

let pageToken = 0;
function armFromPage() {
  if (typeof document === 'undefined') return;
  const root = document.querySelector('#messages');
  if (root) armHistoryMedia(root, ++pageToken);
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  armFromPage();
  window.addEventListener('desk-history-rendered', armFromPage);
  /* O `chat-message-view` avisa depois de cada pintura: a casca formatada e a
     bolha repintada ganham o mesmo observador da montagem. */
  window.addEventListener('desk-media-painted', (event) => {
    const body = /** @type {{detail?: {body?: ParentNode}}} */ (event).detail?.body;
    if (body) loader.decorate(body);
  });
  window.addEventListener('desk-conversation-changed', cancelHistoryMedia);
}
