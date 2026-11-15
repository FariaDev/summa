// @ts-check
'use strict';

/* Pedido da página atual ao Ambitus (Conferir pela ponte). O Ambitus não tem
   servidor, então ele segura um long-poll (`GET /pedido-pagina`) e a Summa o
   responde quando a pessoa aperta Conferir: `{pedido}`. O Ambitus renderiza a
   página aberta e manda `POST /pagina-atual` com o mesmo `pedido`. Aqui vive
   só a coordenação (sem HTTP, sem Electron): quem está pendurado, quais
   pedidos esperam resposta e quando "conectado" vale. As rotas ficam em
   `ambitus-bridge-host.cjs`.

   - Só UM long-poll vale por vez: o novo substitui o anterior (o antigo recebe
     409 `replaced`; o Ambitus recua em silêncio).
   - Sem nada para pedir, o long-poll termina em 204 após `holdMs` e o Ambitus
     refaz. Entre dois pedidos há uma folga (`graceMs`) em que ainda se conta
     como conectado, para o clique não cair no vão.
   - Um pedido entregue espera `answerMs` pela resposta; depois disso o id
     deixa de valer (`/pagina-atual` com ele é recusado). */

const crypto = require('node:crypto');

const HOLD_MS = 25000;
const ANSWER_MS = 5000;
const GRACE_MS = 3000;
/* Quanto um pedido espera o Ambitus reconectar no vão entre dois long-polls. */
const WAIT_POLL_MS = 2000;

/**
 * @typedef {{send: (code: number, payload?: object) => void, onClose: (fn: () => void) => void}} PollHandle
 * @typedef {{ok: true, answer: object}|{ok: false, reason: 'not-connected'|'timeout'|'invalid'|'closed'}} PageOutcome
 */

/**
 * O corretor dos pedidos de página ao Ambitus.
 * @param {{holdMs?: number, answerMs?: number, graceMs?: number, waitPollMs?: number,
 *   newId?: () => string, onLinkChange?: (connected: boolean) => void}} [options]
 * @returns {{poll: (handle: PollHandle) => void, request: () => Promise<PageOutcome>,
 *   has: (id: string) => boolean, answer: (id: string, payload: object) => boolean,
 *   fail: (id: string) => boolean, connected: () => boolean, close: () => void, open: () => void}}
 * @example const broker = createPageBroker({onLinkChange}); broker.poll(handle); const outcome = await broker.request();
 */
function createPageBroker({holdMs = HOLD_MS, answerMs = ANSWER_MS, graceMs = GRACE_MS, waitPollMs = WAIT_POLL_MS, newId = () => crypto.randomBytes(12).toString('hex'), onLinkChange = () => {}} = {}) {
  /** @type {{handle: PollHandle, timer: ReturnType<typeof setTimeout>}|null} */
  let current = null;
  /** O fim do último long-poll; 0 quando o Ambitus sumiu de vez (socket fechado). */
  let lastEnd = 0;
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let graceTimer;
  let linked = false;
  let closed = false;
  /** @type {Map<string, {resolve: (outcome: PageOutcome) => void, timer: ReturnType<typeof setTimeout>}>} */
  const outstanding = new Map();
  /** @type {Array<{resolve: (outcome: PageOutcome) => void, timer: ReturnType<typeof setTimeout>}>} */
  const wanted = [];

  const isConnected = () => !closed && (current !== null || (lastEnd > 0 && Date.now() - lastEnd < graceMs));

  function refreshLink() {
    const now = isConnected();
    if (now === linked) return;
    linked = now;
    try { onLinkChange(now); } catch { /* o aviso à janela não derruba a ponte */ }
  }

  function armGrace() {
    clearTimeout(graceTimer);
    graceTimer = setTimeout(refreshLink, graceMs + 20);
    graceTimer.unref?.();
  }

  /** @param {number} code @param {object} [payload] */
  function endPoll(code, payload) {
    if (!current) return;
    const ended = current;
    current = null;
    clearTimeout(ended.timer);
    lastEnd = Date.now();
    try { ended.handle.send(code, payload); } catch { /* o Ambitus já saiu */ }
    armGrace();
    refreshLink();
  }

  /** @param {{resolve: (outcome: PageOutcome) => void}} entry */
  function deliver(entry) {
    const id = newId();
    const timer = setTimeout(() => {
      outstanding.delete(id);
      entry.resolve({ok: false, reason: 'timeout'});
    }, answerMs);
    timer.unref?.();
    outstanding.set(id, {resolve: entry.resolve, timer});
    endPoll(200, {pedido: id});
  }

  /** Um long-poll novo do Ambitus. @param {PollHandle} handle */
  function poll(handle) {
    if (closed) { handle.send(503, {reason: 'closed'}); return; }
    if (current) endPoll(409, {reason: 'replaced'});
    const timer = setTimeout(() => endPoll(204), holdMs);
    timer.unref?.();
    const mine = {handle, timer};
    current = mine;
    handle.onClose(() => {
      if (current !== mine) return;
      current = null;
      clearTimeout(timer);
      lastEnd = 0;
      refreshLink();
    });
    const next = wanted.shift();
    if (next) {
      clearTimeout(next.timer);
      deliver(next);
      return;
    }
    refreshLink();
  }

  /** Pede a página atual; resolve com a resposta do Ambitus ou o motivo de não ter vindo. @returns {Promise<PageOutcome>} */
  function request() {
    return new Promise((resolve) => {
      if (!isConnected()) { resolve({ok: false, reason: 'not-connected'}); return; }
      if (current) { deliver({resolve}); return; }
      const entry = {resolve, timer: setTimeout(() => {
        const at = wanted.indexOf(entry);
        if (at >= 0) wanted.splice(at, 1);
        resolve({ok: false, reason: 'not-connected'});
      }, waitPollMs)};
      entry.timer.unref?.();
      wanted.push(entry);
    });
  }

  /** Se o id é de um pedido que ainda espera resposta. @param {string} id */
  const has = (id) => outstanding.has(id);

  /** Entrega a resposta ao pedido; false se o id é desconhecido ou expirou. @param {string} id @param {object} payload */
  function answer(id, payload) {
    const entry = outstanding.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    outstanding.delete(id);
    entry.resolve({ok: true, answer: payload});
    return true;
  }

  /** Encerra o pedido sem resposta útil (corpo inválido): o Conferir falha na hora em vez de esperar o teto. @param {string} id */
  function fail(id) {
    const entry = outstanding.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    outstanding.delete(id);
    entry.resolve({ok: false, reason: 'invalid'});
    return true;
  }

  function close() {
    if (closed) return;
    endPoll(204);
    closed = true;
    clearTimeout(graceTimer);
    for (const [id, entry] of outstanding) { clearTimeout(entry.timer); entry.resolve({ok: false, reason: 'closed'}); outstanding.delete(id); }
    for (const entry of wanted.splice(0)) { clearTimeout(entry.timer); entry.resolve({ok: false, reason: 'closed'}); }
    refreshLink();
  }

  /** A ponte subiu de novo depois de um close (start/close da ponte são reentrantes). */
  function open() { closed = false; }

  return {poll, request, has, answer, fail, connected: isConnected, close, open};
}

module.exports = {ANSWER_MS, GRACE_MS, HOLD_MS, createPageBroker};
