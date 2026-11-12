// @ts-check
/* Cache em memória do render do histórico (#120): `historyTurns` e o HTML já
   sanitizado de cada mensagem, para reabrir a mesma conversa sem refazer
   Markdown/KaTeX. A chave cobre mensagens, imagens, idioma e pipeline; o cache
   de HTML só recebe a saída final do `markup` e recusa marca executável. LRU
   com teto de entradas e bytes aproximados. Sem lei Bend (ADR 0003): a regra é
   de identidade de cache/sanitização, provada por testes JS. */

import {currentLanguage} from './ui-text.mjs';

const VERSION = 1;
/* 5.000 mensagens rendem ~3.700 bolhas e ~22 MB de HTML (medido); 12.000
   entradas e 48 MiB aproximados (2 bytes por unidade UTF-16) cobrem a conversa
   inteira. Os turnos de 5.000 rendem ~3,4 MB; quatro entradas bastam. */
export const HTML_CACHE_MAX_ENTRIES = 12000;
export const HTML_CACHE_MAX_BYTES = 48 * 1024 * 1024;
export const TURNS_CACHE_MAX_ENTRIES = 4;
export const TURNS_CACHE_MAX_BYTES = 48 * 1024 * 1024;
const DEFAULT_PIPELINE = 'history-render-cache-1';

/** @typedef {{maxEntries: number, maxBytes: number}} CacheLimits */
/** @typedef {{hits: number, misses: number, sets: number, evictions: number, rejected: number, entries: number, bytes: number}} CacheStats */
/** @typedef {{value: any, size: number}} CacheEntry */

/**
 * Hash de 64 bits aproximados (dois FNV-1a) para a chave do cache; o tamanho
 * do texto entra junto para afastar colisão.
 * @param {unknown} value
 * @returns {string}
 * @example hash64('abc') // '1b2c3d41e2f3a4b5'
 */
export function hash64(value) {
  const text = String(value ?? '');
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(36).padStart(7, '0')}${(second >>> 0).toString(36).padStart(7, '0')}`;
}

/**
 * JSON estável: chaves em outra ordem produzem a mesma string (descritor e
 * histórico nativo podem ordenar diferente).
 * @param {unknown} value
 * @returns {string}
 * @example stableJson({b: 1, a: 2}) // '{"a":2,"b":1}'
 */
export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = /** @type {Record<string, unknown>} */ (value);
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
  }
  const json = JSON.stringify(value);
  return json === undefined ? 'null' : json;
}

/**
 * Chave de `historyTurns`: a identidade do histórico (#115) já cobre a tela e
 * evita re-serializar 3 MB; sem ela, cai no JSON estável das mensagens.
 * Idioma e pipeline entram porque `displayUserText`/figuras mudam com eles.
 * @param {{messages?: any[], identity?: string|null, language?: string, pipeline?: string}} input
 * @returns {string}
 * @example historyTurnsKey({messages, identity: 'Q2...', language: 'pt-BR'})
 */
export function historyTurnsKey(input) {
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const identity = typeof input.identity === 'string' ? input.identity : '';
  const base = identity ? `id:${identity}` : `msgs:${hash64(stableJson(messages))}`;
  return `${VERSION}|turns|${base}|lang:${input.language ?? ''}|pipe:${input.pipeline ?? ''}`;
}

/**
 * Chave do HTML sanitizado: texto, imagens, `allowAssets`, idioma e pipeline.
 * @param {{text?: string, allowAssets?: boolean, images?: any[], language?: string, pipeline?: string}} input
 * @returns {string}
 * @example markupKey({text: '**oi**', allowAssets: true, images: [], language: 'pt-BR'})
 */
export function markupKey(input) {
  const text = String(input.text ?? '');
  const images = Array.isArray(input.images) ? input.images : [];
  const imageKey = images.map((image) => {
    const value = typeof image === 'string' ? image : String(image?.dataUrl ?? image ?? '');
    return `${value.length}:${hash64(value)}`;
  }).join(',');
  return `${VERSION}|html|${hash64(text)}|len:${text.length}|assets:${input.allowAssets === false ? 0 : 1}|lang:${input.language ?? ''}|pipe:${input.pipeline ?? ''}|img:${imageKey}`;
}

/* Última guarda: o `markup` já passou pelo DOMPurify; se outro caminho entregar
   algo executável, não guardamos. Falso positivo só perde o cache. */
const UNSAFE_TAG = /<\s*(?:script|iframe|object|embed|style|form|input|button)\b/i;
const UNSAFE_ATTR = /\son[a-z]+\s*=|\bjavascript\s*:|\bsrcdoc\s*=/i;

/**
 * Diz se o HTML tem marca executável que a sanitização recusaria.
 * @param {string} html
 * @returns {boolean}
 * @example unsafeHtml('<img src=x onerror=alert(1)>') // true
 */
export function unsafeHtml(html) {
  return UNSAFE_TAG.test(html) || UNSAFE_ATTR.test(html);
}

/** LRU com teto de entradas e bytes aproximados. @param {number} maxEntries @param {number} maxBytes @param {(value: any) => number} sizeOf */
function createLruCache(maxEntries, maxBytes, sizeOf) {
  /** @type {Map<string, CacheEntry>} */
  const entries = new Map();
  let bytes = 0;
  const counters = {hits: 0, misses: 0, sets: 0, evictions: 0, rejected: 0};
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) { counters.misses += 1; return undefined; }
      entries.delete(key);
      entries.set(key, entry);
      counters.hits += 1;
      return entry;
    },
    set(key, value) {
      const size = Number(sizeOf(value));
      if (!Number.isFinite(size) || size < 0 || size > maxBytes) { counters.rejected += 1; return false; }
      const previous = entries.get(key);
      if (previous) { bytes -= previous.size; entries.delete(key); }
      entries.set(key, {value, size});
      bytes += size;
      while (entries.size > maxEntries || bytes > maxBytes) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        const entry = entries.get(oldest);
        if (entry) bytes -= entry.size;
        entries.delete(oldest);
        counters.evictions += 1;
      }
      counters.sets += 1;
      return true;
    },
    reject() { counters.rejected += 1; },
    clear() { entries.clear(); bytes = 0; },
    stats() { return {...counters, entries: entries.size, bytes}; },
  };
}

/** @typedef {{language?: () => string, pipeline?: string, enabled?: boolean, html?: Partial<CacheLimits>, turns?: Partial<CacheLimits>}} HistoryRenderCacheOptions */

/**
 * Cria uma instância (o app usa a singleton; os testes, instâncias pequenas
 * com idioma e pipeline controlados).
 * @param {HistoryRenderCacheOptions} [options]
 * @returns {{
 *   historyTurns: (messages: any[], identity: string|null|undefined, compute: (messages: any[]) => any) => any,
 *   sanitizedHtml: (text: unknown, allowAssets: boolean, images: any[], compute: () => string) => string,
 *   setMarkupPipeline: (pipeline: string) => void,
 *   setEnabled: (enabled: boolean) => void,
 *   isEnabled: () => boolean,
 *   stats: () => {enabled: boolean, pipeline: string, html: CacheStats, turns: CacheStats},
 *   clear: () => void
 * }}
 * @example const cache = createHistoryRenderCache({html: {maxEntries: 2}})
 */
export function createHistoryRenderCache(options = {}) {
  const language = typeof options.language === 'function' ? options.language : currentLanguage;
  let pipeline = typeof options.pipeline === 'string' && options.pipeline ? options.pipeline : DEFAULT_PIPELINE;
  let enabled = options.enabled !== false;
  const htmlLimits = {
    maxEntries: Number(options.html?.maxEntries) || HTML_CACHE_MAX_ENTRIES,
    maxBytes: Number(options.html?.maxBytes) || HTML_CACHE_MAX_BYTES,
  };
  const turnsLimits = {
    maxEntries: Number(options.turns?.maxEntries) || TURNS_CACHE_MAX_ENTRIES,
    maxBytes: Number(options.turns?.maxBytes) || TURNS_CACHE_MAX_BYTES,
  };
  const html = createLruCache(htmlLimits.maxEntries, htmlLimits.maxBytes, (value) => (typeof value === 'string' ? value.length * 2 : Number.POSITIVE_INFINITY));
  const turns = createLruCache(turnsLimits.maxEntries, turnsLimits.maxBytes, (value) => {
    try { return JSON.stringify(value).length * 2; } catch { return Number.POSITIVE_INFINITY; }
  });
  return {
    historyTurns(messages, identity, compute) {
      if (typeof compute !== 'function') throw new TypeError('historyTurns: compute precisa ser função');
      const list = Array.isArray(messages) ? messages : [];
      if (!enabled) return compute(list);
      const key = historyTurnsKey({messages: list, identity, language: language(), pipeline});
      const hit = turns.get(key);
      if (hit !== undefined) return hit.value;
      const value = compute(list);
      turns.set(key, value);
      return value;
    },
    sanitizedHtml(text, allowAssets, images, compute) {
      if (typeof compute !== 'function') throw new TypeError('sanitizedHtml: compute precisa ser função');
      if (!enabled) return compute();
      const key = markupKey({text: String(text ?? ''), allowAssets, images, language: language(), pipeline});
      const hit = html.get(key);
      if (hit !== undefined) return hit.value;
      const value = compute();
      if (typeof value !== 'string' || unsafeHtml(value)) { html.reject(); return value; }
      html.set(key, value);
      return value;
    },
    setMarkupPipeline(next) { if (typeof next === 'string' && next) pipeline = next; },
    setEnabled(next) { enabled = next !== false; },
    isEnabled() { return enabled; },
    stats() { return {enabled, pipeline, html: html.stats(), turns: turns.stats()}; },
    clear() { html.clear(); turns.clear(); },
  };
}

export const historyRenderCache = createHistoryRenderCache();

/**
 * Registra a versão do pipeline de Markdown/sanitização (o `markdown.mjs`
 * chama na carga).
 * @param {string} pipeline
 * @returns {void}
 * @example setMarkupPipeline('marked=18;katex=0.19;sanitize=1')
 */
export function setMarkupPipeline(pipeline) { historyRenderCache.setMarkupPipeline(pipeline); }

/**
 * Liga/desliga o cache (a sonda mede o antes/depois na mesma janela).
 * @param {boolean} enabled
 * @returns {void}
 * @example setHistoryRenderCacheEnabled(false)
 */
export function setHistoryRenderCacheEnabled(enabled) { historyRenderCache.setEnabled(enabled); }

/**
 * `historyTurns` com cache; `compute` roda só no miss.
 * @param {any[]} messages
 * @param {string|null|undefined} identity
 * @param {(messages: any[]) => any} compute
 * @returns {any}
 * @example cachedHistoryTurns(messages, identity, historyTurns)
 */
export function cachedHistoryTurns(messages, identity, compute) { return historyRenderCache.historyTurns(messages, identity, compute); }

/**
 * HTML sanitizado com cache; `compute` precisa ser o mesmo `markup` do DOM.
 * @param {unknown} text
 * @param {boolean} allowAssets
 * @param {any[]} images
 * @param {() => string} compute
 * @returns {string}
 * @example cachedMarkup(text, true, images, () => markup(text, true))
 */
export function cachedMarkup(text, allowAssets, images, compute) { return historyRenderCache.sanitizedHtml(text, allowAssets, images, compute); }

/**
 * Contadores para teste e sonda.
 * @returns {{enabled: boolean, pipeline: string, html: CacheStats, turns: CacheStats}}
 * @example historyRenderCacheStats().html.hits
 */
export function historyRenderCacheStats() { return historyRenderCache.stats(); }

/**
 * Esvazia o cache (teste e sonda; a chave certa dispensa limpar ao trocar de curso).
 * @returns {void}
 * @example resetHistoryRenderCache()
 */
export function resetHistoryRenderCache() { historyRenderCache.clear(); }
