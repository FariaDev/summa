// @ts-check
'use strict';

/* MCP `mesa` do `opencode serve` (#57): o registro é da pasta, não da sessão,
   e o handshake pode terminar depois do PUT. Aqui ficam o registro, a espera
   pelo `connected` e o desfecho no log (#55); o adaptador decide o que o tutor
   recebe quando as ferramentas não entram. */

const {stringStatus} = require('./opencode-delivery.cjs');

const MCP_TIMEOUT_MS = 10000;
const MCP_POLL_MS = 100;

/**
 * @typedef {(method: string, route: string, options?: {body?: unknown, query?: Record<string, string>}) => Promise<{ok: boolean, status: number, payload?: unknown}>} McpRequest
 * @typedef {{connected: boolean, status?: string, reason?: string}} McpOutcome
 */

/**
 * Status do MCP `mesa` na pasta da conversa; vazio quando a consulta falha.
 * @param {McpRequest} request
 * @param {() => Record<string, string>} location
 * @returns {Promise<string>}
 * @example await mesaMcpStatus(request, () => ({'location[directory]': '/r/conv-1'})) // 'connected'
 */
async function mesaMcpStatus(request, location) {
  return request('GET', '/api/mcp', {query: location()})
    .then((reply) => {
      const payload = /** @type {{data?: unknown}} */ (reply?.payload);
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const mesa = items.find((item) => String(item?.name || '') === 'mesa');
      return typeof mesa?.status === 'string' ? mesa.status : stringStatus(mesa?.status);
    })
    .catch(() => '');
}

/**
 * Espera o MCP `mesa` chegar a `connected`/`ready`; `failed`/`error` e o prazo
 * devolvem o motivo. O prazo é injetável (#55): o teste não espera os 10 s.
 * @param {{request: McpRequest, location: () => Record<string, string>, timeoutMs?: number, pollMs?: number}} options
 * @returns {Promise<McpOutcome>}
 * @example await waitMesaMcp({request, location, timeoutMs: 40}) // {connected: false, status: 'timeout', reason: 'timeout'}
 */
async function waitMesaMcp({request, location, timeoutMs, pollMs}) {
  const timeout = Number(timeoutMs);
  const deadline = Date.now() + (Number.isFinite(timeout) && timeout > 0 ? timeout : MCP_TIMEOUT_MS);
  const poll = Number(pollMs);
  const delay = Number.isFinite(poll) && poll > 0 ? poll : MCP_POLL_MS;
  while (Date.now() < deadline) {
    const status = await mesaMcpStatus(request, location);
    if (status === 'connected' || status === 'ready') {
      /* O status conecta antes de o catálogo de ferramentas da sessão aparecer
         no primeiro prompt; um quadro de folga fecha essa janela. */
      await new Promise((resolve) => setTimeout(resolve, 250));
      return {connected: true};
    }
    if (status === 'failed' || status === 'error') return {connected: false, status, reason: `status ${status}`};
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return {connected: false, status: 'timeout', reason: 'timeout'};
}

/**
 * Registra o MCP `mesa` na pasta da conversa e espera o handshake. O resultado
 * vai ao `log` sem caminho nem segredo; falhar aqui não derruba o estudo.
 * @param {{request: McpRequest, location: () => Record<string, string>, config: Record<string, unknown>,
 *   log: (line: string) => void, timeoutMs?: number, pollMs?: number}} options
 * @returns {Promise<McpOutcome>}
 * @example const outcome = await registerMesaMcp({request, location, config, log: console.log});
 */
async function registerMesaMcp({request, location, config, log, timeoutMs, pollMs}) {
  const started = Date.now();
  const response = await request('PUT', '/api/experimental/mcp/mesa', {body: {config}, query: location()})
    .catch(() => ({ok: false, status: 0}));
  const outcome = response.ok
    ? await waitMesaMcp({request, location, timeoutMs, pollMs})
    : {connected: false, status: response.status ? String(response.status) : 'sem resposta', reason: response.status ? `HTTP ${response.status}` : 'sem resposta do servidor'};
  const elapsed = Date.now() - started;
  log(outcome.connected ? `MCP mesa conectado em ${elapsed} ms` : `MCP mesa não conectou em ${elapsed} ms: ${outcome.reason}`);
  return outcome;
}

module.exports = {MCP_TIMEOUT_MS, registerMesaMcp, waitMesaMcp};
