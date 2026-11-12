// @ts-check
'use strict';

const crypto = require('node:crypto');
const {invalidRequest} = require('./src/error-detail.mjs');

/* Mídia do histórico sob demanda (#121): o payload de abertura leva um marcador
   por imagem e por saída longa de ferramenta, e o renderer pede os bytes quando
   a mensagem chega perto da vista. O descritor em disco não muda: a resolução
   sai do registro em memória desta conversa, nunca de um caminho mandado pelo
   renderer. Exportação e uso offline continuam lendo a fonte completa. */

const CHANNEL = 'history-media-read';
const MARKER_PREFIX = 'mesa-history-media:';
const MARKER_ID = /^hm-[0-9a-f]{32}$/;
const IMAGE = 'image';
const TOOL_OUTPUT = 'tool-output';
/* Saída menor que isto continua no payload: o resumo já é a saída inteira. */
const MIN_TOOL_OUTPUT_BYTES = 16 * 1024;
const TOOL_OUTPUT_PREVIEW_CHARS = 1200;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/* Texto do descritor é limitado a 400.000 caracteres; UTF-8 pode render até 4×. */
const MAX_TOOL_OUTPUT_BYTES = 4 * 400000;
/* O maior data URL de imagem já comportado pelo descritor (8 MiB crus) mais a
   folga do prefixo. Acima disso a resposta é recusada antes de atravessar o IPC. */
const MAX_RESPONSE_CHARS = 12 * 1024 * 1024;
const MAX_ENTRIES = 20000;
const MAX_TOTAL_BYTES = 128 * 1024 * 1024;
const DEFAULT_KEEP_IMAGES = 6;
const IMAGE_DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i;

/** @typedef {{id: string, kind: 'image'|'tool-output', mime: string, bytes: number, width?: number, height?: number, dataUrl?: string, text?: string, session: string}} HistoryMediaEntry */
/** @typedef {{id: string, kind: 'image'|'tool-output', mime: string, bytes: number, width?: number, height?: number}} HistoryMediaMarker */

/**
 * Id opaco e estável da mídia: o mesmo conteúdo na mesma conversa devolve o
 * mesmo id entre aberturas; outra conversa nunca coincide.
 * @param {string} session
 * @param {string} kind
 * @param {string} content
 * @returns {string}
 * @example mediaId('/rt/conversations/claude-a.json', 'image', '...') // 'hm-1a2b...'
 */
function mediaId(session, kind, content) {
  return `hm-${crypto.createHash('sha256').update(`${session}\0${kind}\0`).update(content).digest('hex').slice(0, 32)}`;
}

/**
 * URL-marcador que o renderer reconhece e troca por um espaço reservado.
 * Ela entra na chave do cache de HTML (#120), então é determinística.
 * @param {HistoryMediaMarker} marker
 * @returns {string}
 * @example markerUrl({id: 'hm-…', kind: 'image', mime: 'image/png', bytes: 10})
 */
function markerUrl(marker) {
  const params = new URLSearchParams({b: String(marker.bytes), m: marker.mime});
  if (marker.width > 0) params.set('w', String(marker.width));
  if (marker.height > 0) params.set('h', String(marker.height));
  return `${MARKER_PREFIX}${marker.id}?${params}`;
}

/* Tamanho cru aproximado de um base64, sem decodificar para outro Buffer. */
function rawBytesOfBase64(data) {
  if (typeof data !== 'string' || !data) return 0;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

/* Data URL e bytes de uma parte de imagem; null quando não há byte inline. */
function inlineImageOf(part) {
  if (typeof part?.data === 'string' && part.data) {
    const mime = typeof part.mimeType === 'string' && part.mimeType ? part.mimeType : 'image/png';
    return {mime, dataUrl: `data:${mime};base64,${part.data}`, bytes: rawBytesOfBase64(part.data)};
  }
  const match = typeof part?.url === 'string' ? IMAGE_DATA_URL.exec(part.url) : null;
  if (!match) return null;
  return {mime: part.mimeType || match[1], dataUrl: part.url, bytes: rawBytesOfBase64(match[2])};
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

/* Cópia da parte de imagem com o marcador no lugar dos bytes. */
function markedImagePart(part, marker) {
  const next = {type: 'image', mimeType: marker.mime, url: markerUrl(marker), historyMedia: marker};
  if (typeof part.source === 'string' && part.source) next.source = part.source;
  if (typeof part.url === 'string' && !part.url.startsWith('data:')) next.sourceUrl = part.url;
  return next;
}

/* Cópia da parte de texto longa com resumo + marcador. */
function markedToolPart(part, marker, preview) {
  return {...part, text: preview, historyMedia: marker};
}

/**
 * Cria o registro de mídia da conversa aberta e o marcador de payload.
 * Recebe o `live` do main (sessão aberta) e o corte de imagens do `pi-connect`;
 * devolve `markerize` e `read`.
 * @param {{live: import('./main.cjs').DeskLive, trimMessageImages?: (messages: any[], keep?: number) => any[],
 *   maxImageBytes?: number, maxToolOutputBytes?: number}} options
 * @returns {{markerize: (messages: any[]) => any[], read: (id: unknown) => object, clear: () => void,
 *   setTrimMessageImages: (trim: (messages: any[], keep?: number) => any[]) => void,
 *   stats: () => {session: string, entries: number, bytes: number}}}
 * @example const media = createHistoryMediaHost({live, trimMessageImages})
 */
function createHistoryMediaHost({live, trimMessageImages, maxImageBytes = MAX_IMAGE_BYTES, maxToolOutputBytes = MAX_TOOL_OUTPUT_BYTES}) {
  let trim = typeof trimMessageImages === 'function' ? trimMessageImages : null;
  let registrySession = null;
  /** @type {Map<string, HistoryMediaEntry>} */
  let entries = new Map();
  let totalBytes = 0;

  function currentSession() {
    return typeof live.session === 'string' ? live.session : '';
  }

  function resetIfSessionChanged() {
    const session = currentSession();
    if (session === registrySession) return;
    registrySession = session;
    entries = new Map();
    totalBytes = 0;
  }

  /** @param {HistoryMediaEntry} entry */
  function register(entry) {
    const previous = entries.get(entry.id);
    if (previous) totalBytes -= previous.bytes;
    entries.set(entry.id, entry);
    totalBytes += entry.bytes;
    for (const key of entries.keys()) {
      if (entries.size <= MAX_ENTRIES && totalBytes <= MAX_TOTAL_BYTES) break;
      const oldest = entries.get(key);
      if (!oldest) continue;
      entries.delete(key);
      totalBytes -= oldest.bytes;
    }
  }

  /* @param {any} part @param {string} session */
  function markerizeImage(part, session) {
    const inline = inlineImageOf(part);
    if (!inline || !inline.bytes) return part;
    const id = mediaId(session, IMAGE, inline.dataUrl);
    /** @type {HistoryMediaMarker} */
    const marker = {id, kind: IMAGE, mime: inline.mime, bytes: inline.bytes};
    const width = positiveNumber(part.width || part.naturalWidth);
    const height = positiveNumber(part.height || part.naturalHeight);
    if (width && height) {
      marker.width = width;
      marker.height = height;
    }
    register({...marker, session, dataUrl: inline.dataUrl});
    return markedImagePart(part, marker);
  }

  /* @param {any} part @param {string} session */
  function markerizeToolText(part, session) {
    const text = typeof part?.text === 'string' ? part.text : '';
    if (!text) return part;
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes < MIN_TOOL_OUTPUT_BYTES) return part;
    const id = mediaId(session, TOOL_OUTPUT, text);
    /** @type {HistoryMediaMarker} */
    const marker = {id, kind: TOOL_OUTPUT, mime: 'text/plain', bytes};
    register({...marker, session, text});
    const preview = text.length > TOOL_OUTPUT_PREVIEW_CHARS ? `${text.slice(0, TOOL_OUTPUT_PREVIEW_CHARS)}\n…` : text;
    return markedToolPart(part, marker, preview);
  }

  /* @param {any} message @param {string} session */
  function markerizeMessage(message, session) {
    if (!message || typeof message !== 'object' || !Array.isArray(message.content)) return message;
    let changed = false;
    const content = message.content.map((part) => {
      if (!part || typeof part !== 'object') return part;
      if (message.role === 'toolResult' && part.type === 'text') {
        const next = markerizeToolText(part, session);
        if (next !== part) changed = true;
        return next;
      }
      if ((message.role === 'user' || message.role === 'assistant') && part.type === 'image') {
        const next = markerizeImage(part, session);
        if (next !== part) changed = true;
        return next;
      }
      return part;
    });
    return changed ? {...message, content} : message;
  }

  function markerize(messages) {
    const list = Array.isArray(messages) ? messages : [];
    resetIfSessionChanged();
    const session = currentSession();
    const shown = trim ? trim(list, DEFAULT_KEEP_IMAGES) : list;
    if (!session) return Array.isArray(shown) ? shown : [];
    return (Array.isArray(shown) ? shown : []).map((message) => markerizeMessage(message, session));
  }

  function read(id) {
    if (typeof id !== 'string' || !MARKER_ID.test(id)) {
      throw Error(invalidRequest(CHANNEL, 'id', id, 'string(hm-<32 hex>)'));
    }
    resetIfSessionChanged();
    const session = currentSession();
    const entry = entries.get(id);
    if (!entry || !session || entry.session !== session) {
      throw Error(invalidRequest(CHANNEL, 'id', id, 'id de mídia da conversa aberta'));
    }
    const maxBytes = entry.kind === IMAGE ? maxImageBytes : maxToolOutputBytes;
    if (entry.bytes > maxBytes) {
      throw Error(invalidRequest(CHANNEL, 'bytes', entry.bytes, `number(0..${maxBytes})`));
    }
    const value = entry.kind === IMAGE ? entry.dataUrl : entry.text;
    if (typeof value !== 'string' || !value.length || value.length > MAX_RESPONSE_CHARS) {
      throw Error(invalidRequest(CHANNEL, 'resposta', value?.length ?? value, `string(1..${MAX_RESPONSE_CHARS})`));
    }
    return {
      id: entry.id,
      kind: entry.kind,
      mime: entry.mime,
      bytes: entry.bytes,
      ...(entry.width ? {width: entry.width} : {}),
      ...(entry.height ? {height: entry.height} : {}),
      ...(entry.kind === IMAGE ? {dataUrl: value} : {text: value}),
    };
  }

  return {
    markerize,
    read,
    clear() {
      registrySession = null;
      entries = new Map();
      totalBytes = 0;
    },
    setTrimMessageImages(next) {
      if (typeof next === 'function') trim = next;
    },
    stats() {
      return {session: currentSession(), entries: entries.size, bytes: totalBytes};
    },
  };
}

/** @type {WeakMap<object, ReturnType<typeof createHistoryMediaHost>>} */
const hosts = new WeakMap();

/**
 * Uma instância por `live` do main: `initialData` e `pi-connect` marcam a mesma
 * conversa e o handler lê o mesmo registro.
 * @param {{live: import('./main.cjs').DeskLive, trimMessageImages?: (messages: any[], keep?: number) => any[]}} options
 * @returns {ReturnType<typeof createHistoryMediaHost>}
 * @example const media = historyMediaHostFor({live, trimMessageImages})
 */
function historyMediaHostFor({live, trimMessageImages}) {
  let host = hosts.get(live);
  if (!host) {
    host = createHistoryMediaHost({live, trimMessageImages});
    hosts.set(live, host);
  } else if (typeof trimMessageImages === 'function') {
    host.setTrimMessageImages(trimMessageImages);
  }
  return host;
}

/**
 * Registra o canal `history-media-read` e devolve o registro compartilhado.
 * Só aceita pedido da janela principal e só resolve id da conversa aberta.
 * @param {{ipcMain: import('./types/host-deps').IpcMain, live: import('./main.cjs').DeskLive,
 *   trimMessageImages?: (messages: any[], keep?: number) => any[]}} options
 * @returns {ReturnType<typeof createHistoryMediaHost>}
 * @example const media = registerHistoryMediaIpc({ipcMain, live, trimMessageImages})
 */
function registerHistoryMediaIpc({ipcMain, live, trimMessageImages}) {
  const media = historyMediaHostFor({live, trimMessageImages});
  ipcMain.handle(CHANNEL, (event, raw) => {
    const win = live.win;
    if (!win || win.isDestroyed() || event?.sender !== win.webContents) {
      throw Error(`${CHANNEL}: remetente recusado; esperado a janela principal da Mesa`);
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw Error(invalidRequest(CHANNEL, 'pedido', raw, 'object({id})'));
    }
    return media.read(raw.id);
  });
  return media;
}

module.exports = {CHANNEL, MARKER_PREFIX, MIN_TOOL_OUTPUT_BYTES, createHistoryMediaHost, historyMediaHostFor, registerHistoryMediaIpc};
