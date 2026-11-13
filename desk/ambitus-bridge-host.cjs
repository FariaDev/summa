// @ts-check
'use strict';

/* Ponte local com o Ambitus, o Xournal++ modificado (docs/cadernos-para-o-xournal.md).
   O Ambitus renderiza a página e manda o PNG; a Summa lê a tinta com o modelo
   de visão DA PESSOA (`readInk`, #158: sessão descartável, sem ferramenta,
   nunca logada nem salva) e devolve o texto. É a ponte da conversão do plugin
   MesaPagina (#159) sem o SVG: o Ambitus já desenha a página, então nenhuma
   janela escondida renderiza nada aqui, e nenhum código do Xournal++ entra.

   HTTP em 127.0.0.1 com porta efêmera; porta e token (32 bytes, comparação em
   tempo constante) ficam em `runtime/ambitus-bridge.json` com modo 0600, como
   o `ggb-bridge.json`. A ponte fica no ar enquanto a Summa está aberta; a
   leitura em si só acontece com a opção `inkReading` ligada (desligada por
   padrão): sem ela, a resposta é `{reason: 'disabled'}` e nenhuma imagem sai
   da máquina. Assim o Ambitus sabe dizer "ligue na Summa" em vez de "a Summa
   está fechada". */

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const {createLifecycleQueue, removeOwnedBridge, removeOrphanBridge, closeServer} = require('./ink-bridge-lifecycle.cjs');

const BRIDGE_NAME = 'ambitus-bridge.json';
/* Uma página do Ambitus sai em ~1600 px de largura; 8 MB cobre página com
   imagem de fundo com folga, e o que passa disso não é uma página. */
const PNG_CAP = 8 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/* A leitura de uma página pelo modelo leva de 5 a 40 s; o Ambitus lê em
   segundo plano e espera mais que isto. */
const REQUEST_TIMEOUT_MS = 90000;
const BRIDGE_VERSION = 1;

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

/**
 * Confere que os bytes são um PNG (assinatura de 8 bytes), sem decodificar.
 * @param {Buffer} bytes corpo do pedido
 * @returns {boolean}
 * @example isPng(Buffer.from('89504e470d0a1a0a00', 'hex')) // true
 */
function isPng(bytes) {
  return bytes.length > PNG_MAGIC.length && bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC);
}

/** Grava o arquivo de ponte com 0600 garantido mesmo com prévio 0644: temp `wx`+0600 e `rename` atômico.
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
function bridgeReply(res, code, payload) {
  res.on('error', () => {});
  const body = JSON.stringify(payload);
  /* Com o tamanho, a resposta não vai em chunked: o cliente do Ambitus lê até o fim e pronto. */
  res.writeHead(code, {'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body)});
  res.end(body);
}

/* Escoa o corpo recusado até o fim: fechar no meio do envio vira erro no
   cliente antes de ele ler o 413. Quem passa de 2× o teto é cortado. */
function drainBody(req) {
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > 2 * PNG_CAP) req.destroy();
  });
  req.on('error', () => {});
  req.resume();
}

/** Lê o corpo até o teto; acima dele responde 413 e rejeita. @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res @returns {Promise<Buffer>} */
function readPngBody(req, res) {
  const declared = Number(req.headers['content-length']) || 0;
  if (declared > PNG_CAP) {
    bridgeReply(res, 413, {reason: 'too-large'});
    drainBody(req);
    return Promise.reject(Error('corpo grande'));
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    let overflow = false;
    /** @type {Buffer[]} */
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size <= PNG_CAP) { chunks.push(chunk); return; }
      if (!overflow) {
        overflow = true;
        bridgeReply(res, 413, {reason: 'too-large'});
        reject(Error('corpo grande'));
      }
      if (size > 2 * PNG_CAP) req.destroy();
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Host e token conferidos: só 127.0.0.1/localhost na porta da ponte (DNS rebinding) e o token do arquivo. @param {import('node:http').IncomingMessage} req @param {{token: string, port: number}} identity @returns {boolean} */
function authorized(req, identity) {
  const hostHeader = typeof req.headers.host === 'string' ? req.headers.host : '';
  if (hostHeader !== `127.0.0.1:${identity.port}` && hostHeader !== `localhost:${identity.port}`) return false;
  const given = Buffer.from(typeof req.headers['x-summa-token'] === 'string' ? req.headers['x-summa-token'] : '');
  const expected = Buffer.from(identity.token);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/**
 * A ponte local com o Ambitus. `runtime` é a pasta de `ambitus-bridge.json`;
 * `deskState` lê o estado de interface (a opção `inkReading`); `readText` é a
 * leitura da #158 já ligada ao motor (`{text, reason}`; o fake tem nome nos
 * testes); `pickModel` (fail-closed) é o `selectInkModel` avaliado: sem
 * modelo pago com visão, a resposta é o motivo e nada é lido. O log recebe só
 * a rota, o desfecho e o tempo: nunca imagem, texto lido, modelo nem token.
 * Rota: `POST /ler-tinta`, corpo `image/png`, cabeçalho `x-summa-token`;
 * resposta `{text}` ou `{reason: 'disabled'|'no-model'|'no-vision'|'free'|'quota'|'busy'|'timeout'}`.
 * @param {{runtime: string, deskState?: () => unknown,
 *   readText: (png: string, options: {signal: AbortSignal, selection: {model: string, effort: string|null}}) => Promise<{text: string|null, reason: string|null}>,
 *   pickModel: (() => {model: string|null, effort?: string|null, reason: string|null})|null,
 *   requestTimeoutMs?: number, now?: () => number, log?: (line: string) => void}} deps
 * @returns {{bridgeFile: string, start: () => Promise<{port: number, token: string}>, close: () => Promise<void>}}
 * @example const ambitus = createAmbitusBridgeHost({runtime, deskState: () => state, readText, pickModel}); await ambitus.start();
 */
function createAmbitusBridgeHost({runtime, deskState = () => ({}), readText, pickModel = null, requestTimeoutMs = REQUEST_TIMEOUT_MS, now = Date.now, log = () => {}}) {
  const bridgeFile = path.join(runtime, BRIDGE_NAME);
  /** @type {import('node:http').Server|null} */
  let server = null;
  let token = '';
  let port = 0;
  let busy = false;
  const timeoutMs = Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0 ? requestTimeoutMs : REQUEST_TIMEOUT_MS;

  /** O modelo conferido agora, ou o motivo de não ler. @returns {{selection: {model: string, effort: string|null}|null, reason: string|null}} */
  function pickReader() {
    if (!inkReadingEnabled(deskState())) return {selection: null, reason: 'disabled'};
    if (typeof pickModel !== 'function') return {selection: null, reason: 'no-model'};
    const picked = pickModel();
    if (!picked || !picked.model) return {selection: null, reason: (picked && picked.reason) || 'no-model'};
    /* M3 da #158: o modelo conferido é o que segue para a leitura; a seleção
       viva pode mudar no meio e não pode virar um modelo grátis. */
    return {selection: {model: picked.model, effort: typeof picked.effort === 'string' ? picked.effort : null}, reason: null};
  }

  /** Lê uma página, uma de cada vez, com teto e cancelamento quando o Ambitus desiste. @param {Buffer} png @param {AbortController} controller @returns {Promise<{text?: string, reason?: string}>} */
  async function readPage(png, controller) {
    const {selection, reason} = pickReader();
    if (!selection) return {reason: reason || 'no-model'};
    if (busy) return {reason: 'busy'};
    busy = true;
    const signal = controller.signal;
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let timer;
    /** @type {(() => void) | null} */
    let onAbort = null;
    const abortPromise = new Promise((resolve) => {
      if (signal.aborted) { resolve({reason: 'timeout'}); return; }
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
        const result = await readText(png.toString('base64'), {signal, selection});
        if (result && result.reason) return {reason: result.reason};
        return {text: result ? String(result.text ?? '') : ''};
      })();
      work.catch(() => { /* o teto já respondeu; o erro tardio não vira unhandled */ });
      return /** @type {{text?: string, reason?: string}} */ (await Promise.race([work, timeoutPromise, abortPromise]));
    } finally {
      clearTimeout(timer);
      if (onAbort) signal.removeEventListener('abort', onAbort);
      busy = false;
    }
  }

  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res @param {{token: string, port: number}} identity */
  async function handle(req, res, identity) {
    try {
      if (!authorized(req, identity)) {
        log('ambitus: recusado (Host ou token)');
        bridgeReply(res, 403, {reason: 'forbidden'});
        return;
      }
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      if (req.method !== 'POST' || pathname !== '/ler-tinta') {
        bridgeReply(res, 404, {error: 'Rota desconhecida.'});
        return;
      }
      if (!/^image\/png(;|$)/.test(String(req.headers['content-type'] || ''))) {
        bridgeReply(res, 400, {reason: 'bad-request'});
        return;
      }
      const png = await readPngBody(req, res);
      if (!isPng(png)) {
        bridgeReply(res, 400, {reason: 'bad-request'});
        return;
      }
      const controller = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) try { controller.abort(); } catch { /* já encerrou */ }
      });
      const start = now();
      const result = await readPage(png, controller);
      log(`ambitus: ler-tinta ${result.reason || 'pronto'} em ${Math.max(0, now() - start)} ms`);
      bridgeReply(res, 200, result);
    } catch {
      log('ambitus: falha na leitura');
      if (!res.headersSent) bridgeReply(res, 500, {error: 'A leitura falhou.'});
    }
  }

  /* start/close serializados (B4 da #159): o close antigo espera a leitura em
     voo e o start novo só começa depois. */
  const lifecycle = createLifecycleQueue();

  async function startOnce() {
    if (server) return {port, token};
    /* Órfão de uma Summa que caiu some na partida; o de outra viva fica (#212). */
    removeOrphanBridge(bridgeFile);
    const myToken = crypto.randomBytes(32).toString('base64url');
    token = myToken;
    let myPort = 0;
    /* Identidade por servidor (#182): o close zera os globais antes de drenar. */
    const current = http.createServer((req, res) => { void handle(req, res, {token: myToken, port: myPort}); });
    server = current;
    current.on('error', () => {
      if (server === current) { server = null; port = 0; }
      removeOwnedBridge(bridgeFile, myToken, myPort);
    });
    await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
      current.once('error', reject);
      current.listen(0, '127.0.0.1', () => {
        current.off('error', reject);
        myPort = /** @type {{port: number}} */ (current.address()).port;
        port = myPort;
        try {
          fs.mkdirSync(runtime, {recursive: true, mode: 0o700});
          writeBridgeAtomic(bridgeFile, JSON.stringify({version: BRIDGE_VERSION, port, token, pid: process.pid}));
          log(`ambitus: ponte no ar na porta ${port}`);
        } catch {
          log('ambitus: ponte no ar sem arquivo de descoberta');
        }
        resolve();
      });
    }));
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

module.exports = {BRIDGE_NAME, BRIDGE_VERSION, PNG_CAP, REQUEST_TIMEOUT_MS, createAmbitusBridgeHost, inkReadingEnabled, isPng};
