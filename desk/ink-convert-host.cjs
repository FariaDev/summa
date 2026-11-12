// @ts-check
'use strict';

/* Ponte local que converte tinta em texto (#159): o plugin do Xournal++
   manda um SVG pequeno dos traços selecionados (`curl` no 127.0.0.1) e
   recebe o texto transcrito, com a tinta lida pelo modelo de visão DO
   ALUNO pela mesma chamada avulsa da busca (#158: `readInk`, sessão sempre
   apagada, nunca logada nem salva).

   A ponte é um HTTP em 127.0.0.1 com porta efêmera; porta e token (32
   bytes, comparação em tempo constante) ficam em `runtime/ink-convert-bridge.json`
   com modo 0600 — o mesmo desenho do `ggb-bridge.json` (`geogebra-host.cjs`).
   O arquivo leva também o PID da Mesa: na partida, um arquivo cujo processo
   já morreu é apagado, mas o de outra Mesa viva fica (#212).
   Desligada por padrão: só sobe se `inkReading` (estado de interface,
   `desk.json`) for `true`; sem a opção, nenhum arquivo e nenhuma porta.

   Ligação: `notebook-ink-wiring.cjs` (o main só troca uma linha, pelo teto
   de 800) monta `{runtime, deskState, readText, renderSvg, pickModel}` e
   passa `app` ao host de cadernos. `registerNotebooksHost` guarda o host da
   ponte e devolve `{close, stopInkConvert, startInkConvert}`; o
   `before-quit` fecha a porta e apaga o arquivo de ponte ao sair. */

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const {captureWithRetry} = require('./figure-preview.cjs');
const {createLifecycleQueue, removeOwnedBridge, removeOrphanBridge, closeServer} = require('./ink-bridge-lifecycle.cjs');
const {BODY_CAP, checkInkSvg} = require('./ink-convert-svg.cjs');

const BRIDGE_NAME = 'ink-convert-bridge.json';
/* Menor que o `--max-time 20` do curl do plugin (#159): o host desiste antes
   do Xournal++ para o "tente de novo" não receber `busy` por causa da
   conversão anterior ainda em voo. */
const REQUEST_TIMEOUT_MS = 15000;
const LOAD_TIMEOUT_MS = 10000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A opção de leitura da tinta (`inkReading`, estado de interface `desk.json`,
 * fora do `config.json`): desligada por padrão (#158). Só `true` liga.
 * @param {unknown} state estado de interface (`desk.json` saneado)
 * @returns {boolean}
 * @example inkReadingEnabled({inkReading: true}) // true
 * @example inkReadingEnabled({}) // false
 */
function inkReadingEnabled(state) {
  return !!state && typeof state === 'object' && (/** @type {{inkReading?: unknown}} */ (state)).inkReading === true;
}

/** @param {import('electron').Session} session */
function lockInkSession(session) {
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  if (typeof session.setPermissionCheckHandler === 'function') session.setPermissionCheckHandler(() => false);
  if (session.webRequest && typeof session.webRequest.onBeforeRequest === 'function') {
    session.webRequest.onBeforeRequest((details, callback) => {
      try {
        const url = new URL(String(details.url || ''));
        callback({cancel: !(url.protocol === 'data:')});
      } catch { callback({cancel: true}); }
    });
  }
}

/** @param {typeof import('electron')} electron @param {{width: number, height: number}} size */
function createInkWindow(electron, size) {
  const win = new electron.BrowserWindow({
    show: false, width: size.width, height: size.height, useContentSize: true, paintWhenInitiallyHidden: true, skipTaskbar: true, focusable: false,
    webPreferences: {partition: `mesa-ink-${process.pid}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false, disableDialogs: true},
  });
  lockInkSession(win.webContents.session);
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  return win;
}

/**
 * Renderiza o SVG da tinta em PNG (fundo branco, janela escondida, sem
 * dependência nova e sem canvas de tinta na interface — a janela do
 * `figure-preview.cjs`). `createWindow` entra por parâmetro nos testes.
 * @param {{createWindow?: (size: {width: number, height: number}) => import('electron').BrowserWindow}} [options]
 * @returns {(svg: string, options?: {signal?: AbortSignal}) => Promise<string>}
 * @example const render = createInkRenderer(); const png = await render('<svg …>');
 */
function createInkRenderer({createWindow = (size) => createInkWindow(require('electron'), size)} = {}) {
  return async function renderInkSvg(svg, options = {}) {
    const checked = checkInkSvg(svg);
    if (!checked.ok) throw Error(`svg fora do formato restrito: ${checked.reason} (esperado <svg> com <rect>/<path geométricos)`);
    const signal = options && options.signal ? options.signal : null;
    const win = createWindow({width: checked.width, height: checked.height});
    /** @type {(() => void) | null} */
    let onAbort = null;
    const abortPromise = new Promise((_resolve, reject) => {
      if (!signal) return;
      if (signal.aborted) {
        try { if (!win.isDestroyed()) win.destroy(); } catch { /* já fechou */ }
        reject(Error('a renderização da tinta foi cancelada'));
        return;
      }
      onAbort = () => {
        try { if (!win.isDestroyed()) win.destroy(); } catch { /* já fechou */ }
        reject(Error('a renderização da tinta foi cancelada'));
      };
      signal.addEventListener('abort', onAbort, {once: true});
    });
    try {
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}svg{display:block}</style></head><body>${checked.svg}</body></html>`;
      await Promise.race([win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`), abortPromise, sleep(LOAD_TIMEOUT_MS).then(() => { throw Error(`a página da tinta não carregou em ${LOAD_TIMEOUT_MS} ms`); })]);
      if (signal && signal.aborted) throw Error('a renderização da tinta foi cancelada');
      await Promise.race([sleep(120), abortPromise]);
      const image = await Promise.race([captureWithRetry(win.webContents, {x: 0, y: 0, width: checked.width, height: checked.height}), abortPromise]);
      if (signal && signal.aborted) throw Error('a renderização da tinta foi cancelada');
      if (!image || image.isEmpty()) throw Error('a captura da tinta saiu vazia');
      /* O `capturePage` devolve pixels físicos: no Retina (DPR 2) sai o dobro
         do SVG. O modelo recebe o tamanho lógico do SVG, como na prévia da
         figura (#159, rodada macOS). */
      const size = image.getSize();
      const normalized = size.width === checked.width && size.height === checked.height
        ? image
        : image.resize({width: checked.width, height: checked.height, quality: 'best'});
      return normalized.toPNG().toString('base64');
    } finally {
      if (signal && onAbort) try { signal.removeEventListener('abort', onAbort); } catch { /* sem signal */ }
      try { if (!win.isDestroyed()) win.destroy(); } catch { /* já fechou */ }
    }
  };
}

/** Grava o arquivo de ponte com 0600 garantido mesmo com prévio 0644: temp `wx`+0600 e `rename` atômico, sem janela legível.
 * @param {string} file @param {string} bytes @returns {void}
 */
function writeBridgeAtomic(file, bytes) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp-${crypto.randomBytes(6).toString('hex')}`);
  let fd;
  try {
    fd = fs.openSync(tmp, 'wx', 0o600);
    fs.writeSync(fd, bytes);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tmp, file);
    try { fs.chmodSync(file, 0o600); } catch { /* no Windows o modo não vale */ }
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* já fechou */ }
    try { fs.rmSync(tmp, {force: true}); } catch { /* já foi renomeado */ }
  }
}

/** @param {import('node:http').ServerResponse} res @param {number} code @param {object} payload */
function inkReply(res, code, payload) {
  res.on('error', () => {});
  res.writeHead(code, {'content-type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify(payload));
}

/* Escoa o corpo recusado até o fim: fechar no meio do envio vira "fetch
   failed" no cliente antes de ele ler o 413 (Windows e curl do plugin). Quem
   passa de 4× o teto é cortado, como no `phone-host.cjs`. */
function drainInkBody(req) {
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > 4 * BODY_CAP) req.destroy();
  });
  req.on('error', () => {});
  req.resume();
}

/** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
function readInkBody(req, res) {
  const declared = Number(req.headers['content-length']) || 0;
  if (declared > BODY_CAP) {
    inkReply(res, 413, {reason: 'too-large'});
    drainInkBody(req);
    return Promise.reject(Error('corpo grande'));
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    let overflow = false;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_CAP) {
        if (!overflow) {
          overflow = true;
          inkReply(res, 413, {reason: 'too-large'});
          reject(Error('corpo grande'));
        }
        if (size > 4 * BODY_CAP) req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * A ponte local da tinta (#159). `runtime` é a pasta onde mora
 * `ink-convert-bridge.json`; `deskState` lê o estado de interface (a opção
 * `inkReading`); `readText` é a ponte da #158 já adaptada
 * (`{text, reason}` — o fake tem nome nos testes); `renderSvg` rende o SVG
 * em PNG base64; `pickModel` (OBRIGATÓRIO, fail-closed) é o
 * `selectInkModel` da #158 já avaliado — sem ele, `start()` não sobe e toda
 * conversão responde `{reason: 'no-model'}` sem renderizar.
 * `no-vision`/`free`/`no-model` voltam sem renderizar. O log nunca recebe
 * SVG, texto lido nem token. `requestTimeoutMs` (padrão 15 s, abaixo do
 * `--max-time 20` do plugin) é o teto da conversão, injetável nos testes;
 * `now` (padrão `Date.now`) mede a conversão no log, injetável nos testes.
 * @param {{runtime: string, deskState?: () => unknown, readText: (png: string, options: {signal: AbortSignal, selection?: {model: string, effort: string|null}}) => Promise<{text: string|null, reason: string|null}>,
 *   renderSvg: (svg: string, options?: {signal?: AbortSignal}) => Promise<string>,
 *   pickModel: (() => {model: string|null, effort?: string|null, reason: 'no-vision'|'free'|'no-model'|null})|null,
 *   requestTimeoutMs?: number,
 *   now?: () => number,
 *   log?: (line: string) => void}} deps
 * @returns {{bridgeFile: string, start: () => Promise<{port: number, token: string}>, close: () => Promise<void>}}
 * @example const ink = createInkConvertHost({runtime, deskState: () => state, readText, renderSvg, pickModel}); await ink.start();
 */
function createInkConvertHost({runtime, deskState = () => ({}), readText, renderSvg, pickModel = null, requestTimeoutMs = REQUEST_TIMEOUT_MS, now = Date.now, log = () => {}}) {
  const bridgeFile = path.join(runtime, BRIDGE_NAME);
  /** @type {import('node:http').Server} */
  let server = null;
  let token = '';
  let port = 0;
  let busy = false;
  const timeoutMs = Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0 ? requestTimeoutMs : REQUEST_TIMEOUT_MS;

  const enabled = () => inkReadingEnabled(deskState());

  async function convert(svg, controller) {
    if (!enabled()) return {reason: 'disabled'};
    if (typeof pickModel !== 'function') return {reason: 'no-model'};
    const picked = pickModel();
    if (!picked || !picked.model) return {reason: (picked && picked.reason) || 'no-model'};
    /* M3: o modelo conferido no pick é o que segue para a ponte; a seleção viva
       pode mudar durante o render/leitura e não pode virar um modelo grátis. */
    const selection = {model: picked.model, effort: typeof picked.effort === 'string' ? picked.effort : null};
    if (busy) return {reason: 'busy'};
    busy = true;
    const signal = controller.signal;
    /** @type {ReturnType<typeof setTimeout>} */
    let timer;
    /** @type {(() => void) | null} */
    let onAbort = null;
    /* Cliente que some (Xournal++ desistiu no `--max-time`) libera o busy na
       hora, sem esperar o teto: o "tente de novo" seguinte não cai em busy
       (#159, achado 2). */
    const abortPromise = new Promise((resolve) => {
      if (signal.aborted) {
        resolve({reason: 'timeout'});
        return;
      }
      onAbort = () => resolve({reason: 'timeout'});
      signal.addEventListener('abort', onAbort, {once: true});
    });
    const timeoutPromise = new Promise((resolve) => {
      timer = setTimeout(() => {
        try { controller.abort(); } catch { /* já encerrou */ }
        resolve({reason: 'timeout'});
      }, timeoutMs);
    });
    try {
      const work = (async () => {
        const png = await renderSvg(svg, {signal});
        const result = await readText(png, {signal, selection});
        if (result && result.reason) return {reason: result.reason};
        return {text: result ? String(result.text ?? '') : ''};
      })();
      work.catch(() => { /* o timeout já respondeu; o erro tardio não vira unhandled */ });
      return await Promise.race([work, timeoutPromise, abortPromise]);
    } finally {
      clearTimeout(timer);
      if (onAbort) signal.removeEventListener('abort', onAbort);
      busy = false;
    }
  }

  async function handle(req, res, identity) {
    try {
      const hostHeader = typeof req.headers.host === 'string' ? req.headers.host : '';
      if (hostHeader !== `127.0.0.1:${identity.port}` && hostHeader !== `localhost:${identity.port}`) {
        log('converter: recusado (Host inválido)');
        inkReply(res, 403, {reason: 'forbidden'});
        return;
      }
      const given = typeof req.headers['x-mesa-token'] === 'string' ? req.headers['x-mesa-token'] : '';
      const givenBuffer = Buffer.from(given);
      const expected = Buffer.from(identity.token);
      if (givenBuffer.length !== expected.length || !crypto.timingSafeEqual(givenBuffer, expected)) {
        log('converter: recusado (token inválido)');
        inkReply(res, 403, {reason: 'forbidden'});
        return;
      }
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      if (req.method !== 'POST' || pathname !== '/converter') {
        inkReply(res, 404, {error: 'Rota desconhecida.'});
        return;
      }
      const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : '';
      if (!/^application\/json(;|$)/.test(contentType)) {
        inkReply(res, 400, {reason: 'bad-request'});
        return;
      }
      const raw = await readInkBody(req, res);
      let payload;
      try { payload = raw ? JSON.parse(raw) : null; } catch {
        inkReply(res, 400, {reason: 'bad-request'});
        return;
      }
      if (!payload || typeof payload !== 'object' || typeof payload.svg !== 'string') {
        inkReply(res, 400, {reason: 'bad-request'});
        return;
      }
      const checked = checkInkSvg(payload.svg);
      if (!checked.ok) {
        log(`converter: svg recusado (${checked.reason})`);
        inkReply(res, 400, {reason: 'bad-request'});
        return;
      }
      const controller = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) {
          try { controller.abort(); } catch { /* já encerrou */ }
        }
      });
      const comeco = now();
      let resultado;
      try {
        resultado = await convert(checked.svg, controller);
      } catch {
        log(`converter: falha em ${Math.max(0, now() - comeco)} ms`);
        if (!res.headersSent) inkReply(res, 500, {error: 'A conversão falhou.'});
        return;
      }
      /* Só o tempo vai para o log (#159): nunca texto, imagem, modelo nem token. */
      const duracao = Math.max(0, now() - comeco);
      if (resultado.reason === 'timeout') log(`converter: timeout em ${duracao} ms`);
      else if (resultado.reason) log(`converter: falha em ${duracao} ms`);
      else log(`converter: pronto em ${duracao} ms`);
      inkReply(res, 200, resultado);
    } catch {
      log('converter: falha na conversão');
      if (!res.headersSent) inkReply(res, 500, {error: 'A conversão falhou.'});
    }
  }

  /* start/close serializados (B4): o close antigo espera a conversão em voo e
     o start novo só começa depois; sem isso o close apagava o arquivo da ponte
     recém-subida. */
  const lifecycle = createLifecycleQueue();

  /** Sobe a ponte só com a opção ligada e pickModel; falha fechada, nenhum arquivo e nenhuma porta. */
  async function startOnce() {
    if (server) return {port, token};
    /* Órfão de uma Mesa que caiu some já na partida, mesmo com a opção
       desligada (#212); o arquivo de outra instância viva fica. */
    removeOrphanBridge(bridgeFile);
    if (!enabled()) return {port: 0, token: ''};
    if (typeof pickModel !== 'function') {
      log('converter: sem modelo (pickModel ausente)');
      return {port: 0, token: ''};
    }
    const myToken = crypto.randomBytes(32).toString('base64url');
    token = myToken;
    let myPort = 0;
    /* Identidade por servidor: o `close` zera `token`/`port` antes de drenar a
       conexão, e um pedido já aceito (cabeçalhos a caminho) lia os globais e
       caía em 403 — o B4 fechava a ponte no meio da conversão (#182). */
    server = http.createServer((req, res) => { void handle(req, res, {token: myToken, port: myPort}); });
    server.on('error', () => {
      server = null; port = 0;
      removeOwnedBridge(bridgeFile, myToken, myPort);
    });
    await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        myPort = /** @type {{port: number}} */ (server.address()).port;
        port = myPort;
        try {
          fs.mkdirSync(runtime, {recursive: true, mode: 0o700});
          writeBridgeAtomic(bridgeFile, JSON.stringify({port, token, pid: process.pid}));
          log(`converter: ponte no ar na porta ${port}`);
        } catch {
          log('converter: ponte no ar sem arquivo de descoberta');
        }
        resolve();
      });
    }));
    /* A opção pode ter sido desligada enquanto o listen subia (B4). */
    if (!enabled()) {
      const current = server;
      server = null; port = 0; token = '';
      await closeServer(current);
      removeOwnedBridge(bridgeFile, myToken, myPort);
      return {port: 0, token: ''};
    }
    return {port, token};
  }

  async function closeOnce() {
    const closingToken = token;
    const closingPort = port;
    if (server) {
      const current = server;
      server = null; port = 0;
      await closeServer(current);
    }
    removeOwnedBridge(bridgeFile, closingToken, closingPort);
    token = '';
  }

  /** @returns {Promise<{port: number, token: string}>} */
  const start = () => /** @type {Promise<{port: number, token: string}>} */ (lifecycle.run(startOnce));
  /** @returns {Promise<void>} */
  const close = async () => { await lifecycle.run(closeOnce); };

  return {bridgeFile, start, close};
}

module.exports = {BRIDGE_NAME, BODY_CAP, REQUEST_TIMEOUT_MS, createInkConvertHost, createInkRenderer, checkInkSvg, inkReadingEnabled, lockInkSession};
