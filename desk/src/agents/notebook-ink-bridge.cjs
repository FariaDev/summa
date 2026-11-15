// @ts-check
'use strict';

/* Ponte de tinta do caderno (#158): a chamada avulsa que lê o texto
   manuscrito de uma página com o modelo de visão DO USUÁRIO, escondida do
   tutor. Mesmo desenho do rascunho de revisão (#93/#58): um adaptador
   TEMPORÁRIO atrás de um `NativeService`, uma consulta só, sessão descartável
   (`deleteSessionOnStop` no OpenCode, `persistSession:false` no Claude), sem
   MCP e sem ferramenta nativa. O texto lido volta para o chamador — nunca é
   logado nem escrito em descritor de conversa. */

const crypto = require('node:crypto');
const {message, parseMessage} = require('../i18n.mjs');
const {OpenCodeAdapter} = require('./opencode-adapter.cjs');
const {ClaudeAdapter} = require('./claude-adapter.cjs');
const {NativeService} = require('./service.cjs');

/** @typedef {{text: string|null, reason: 'quota'|null}} InkReadResult */

/* A instrução fixa da leitura, no idioma do aluno como o resto do que o tutor
   recebe (#41): é dado para o modelo, nunca ferramenta. */
const INK_PROMPTS = {
  'pt-BR': 'Transcreva só o texto manuscrito da imagem, sem comentar; fórmulas em LaTeX entre $; se não houver texto, responda vazio.',
  en: 'Transcribe only the handwritten text in the image, with no commentary; formulas in LaTeX between $; if there is no text, answer empty.',
};

/** @param {'pt-BR'|'en'} [language] @returns {string} @example inkPrompt('en') // 'Transcribe only the handwritten text…' */
const inkPrompt = (language = 'pt-BR') => INK_PROMPTS[language] || INK_PROMPTS['pt-BR'];

/* Quota do grátis: o erro marcado pelo `providerFailureMessage`
   (`opencode-events.cjs`) chega como `desk_error` com a chave no texto.
   No Claude, o `rate_limit` do assistente sai com código próprio. */
const QUOTA_KEYS = new Set(['opencode.event.freeTier', 'opencode.event.freeLimit']);
function isQuotaError(event) {
  if (!event || typeof event !== 'object') return false;
  if (event.code === 'CLAUDE_RATE_LIMITED') return true;
  return QUOTA_KEYS.has(parseMessage(typeof event.message === 'string' ? event.message : '')?.key ?? '');
}

/** @param {unknown} png base64 do PNG ou `{data, mimeType}` @returns {{type: 'image', mimeType: string, data: string}} */
function asInkImage(png) {
  const record = /** @type {{data?: unknown, mimeType?: unknown}} */ (typeof png === 'string' ? {data: png} : (png && typeof png === 'object' ? png : {}));
  const mimeType = typeof record.mimeType === 'string' && record.mimeType ? record.mimeType : 'image/png';
  const data = typeof record.data === 'string' ? record.data : '';
  if (mimeType !== 'image/png' || !data) {
    throw Error(`png inválido: recebido ${JSON.stringify(String(record.mimeType ?? png ?? '')).slice(0, 80)}; esperado base64 de PNG não vazio`);
  }
  return {type: 'image', mimeType, data};
}

/**
 * Lê o texto manuscrito de uma página do caderno numa chamada avulsa. Sucesso
 * é `{text, reason: null}`; o grátis estourado/recusado é
 * `{text: null, reason: 'quota'}`. A ponte é parada no fim em todos os
 * desfechos (a sessão temporária some).
 * @param {{bridge: InstanceType<typeof NativeService>, png: unknown, language?: 'pt-BR'|'en', signal?: AbortSignal|null, timeoutMs?: number}} args
 * @returns {Promise<InkReadResult>}
 * @example await readInk({bridge, png: base64Png, language: 'pt-BR'}) // {text: '∫ x dx = …', reason: null}
 */
async function readInk({bridge, png, language = 'pt-BR', signal = null, timeoutMs = 60000}) {
  let image;
  try {
    image = asInkImage(png);
  } catch (error) {
    /* PNG inválido também para a ponte: ela já nasceu e nada pode ficar aberto. */
    try { await bridge.stop(); } catch { /* o erro do PNG é o que conta */ }
    throw error;
  }
  return new Promise((resolve, reject) => {
    let text = '', done = false;
    const finish = (error, value) => {
      if (done) return; done = true;
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      bridge.removeListener('event', event);
      /* Parar também apaga a sessão temporária do OpenCode (#93) e fecha a
         consulta do Claude: a ponte é do host, a sessão é descartável. */
      Promise.resolve(bridge.stop()).then(() => { error ? reject(error) : resolve(value); }, () => { error ? reject(error) : resolve(value); });
    };
    const abort = () => finish(Error(message('notebook.ink.error.cancelled')));
    const event = (e) => {
      if (e.type === 'message_start' && e.message?.role === 'assistant') text = '';
      if (e.type === 'message_update' && e.assistantMessageEvent?.type === 'text_delta') text += e.assistantMessageEvent.delta || '';
      if (e.type === 'message_end' && e.message?.role === 'assistant') {
        if (e.message.errorMessage) {
          if (isQuotaError({code: e.code ?? e.message.code, message: e.message.errorMessage})) return finish(null, {text: null, reason: 'quota'});
          return finish(Error(message('notebook.ink.error.failed')));
        }
        text = (e.message.content || []).filter((part) => part?.type === 'text').map((part) => part.text || '').join('\n');
      }
      if (e.type === 'desk_error') {
        if (isQuotaError(e)) return finish(null, {text: null, reason: 'quota'});
        return finish(Error(e.message || message('notebook.ink.error.failed')));
      }
      /* Leitura avulsa nunca repete em segundo plano nem roda extensão. */
      if (e.type === 'auto_retry_start' || e.type === 'extension_ui_request') return finish(Error(message('notebook.ink.error.failed')));
      if (e.type === 'agent_settled') finish(null, {text, reason: null});
    };
    const timer = setTimeout(() => finish(Error(message('notebook.ink.error.timeout'))), timeoutMs);
    bridge.on('event', event); signal?.addEventListener('abort', abort, {once: true});
    if (signal?.aborted) { abort(); return; }
    try {
      (/** @type {{request: Function}} */ (bridge)).request('prompt', {message: inkPrompt(language), images: [image]}, Math.min(timeoutMs, 10000))
        .then((result) => { if (result?.disposition === 'handled') finish(Error(message('notebook.ink.error.failed'))); })
        .catch((error) => finish(error));
    } catch (error) { finish(error); }
  });
}

/**
 * Ponte descartável da tinta no OpenCode: adaptador temporário no servidor da
 * Mesa, sessão própria que o `stop()` apaga, sem MCP e sem ferramenta nativa.
 * @param {{cwd: string, acquire: () => Promise<import('./opencode-serve-owner.cjs').ServeLease>,
 *   selection?: {model: string|null, effort: string|null}|null,
 *   readVersion?: (binary: string) => Promise<string>, log?: (area: string, line: string) => void}} options
 * @returns {InstanceType<typeof NativeService>}
 * @example const bridge = createOpenCodeInkBridge({cwd: folder, acquire});
 */
function createOpenCodeInkBridge({cwd, acquire, selection = null, readVersion, log = () => {}}) {
  const adapter = new OpenCodeAdapter({
    conversationId: `notebook-ink:${crypto.randomUUID()}`,
    sessionId: '',
    resume: false,
    directory: cwd,
    systemPrompt: '',
    selection: selection || {model: null, effort: null},
    acquire,
    readVersion,
    log,
    /* A sessão da tinta é descartável: o `stop()` a apaga no servidor. */
    deleteSessionOnStop: true,
    /* Sem MCP da Mesa e sem ferramenta nativa: a tinta é só texto. */
    mcpConfig: () => null,
  });
  const service = new NativeService({adapter, engine: 'opencode'});
  /* Parar o readInk e o host que repete no `finally`: uma vez só, para o
     DELETE da sessão não sair duas vezes. */
  const stop = service.stop.bind(service);
  let stopping = null;
  service.stop = () => (stopping ??= Promise.allSettled([adapter.cancel(), stop()]));
  return service;
}

/**
 * Ponte descartável da tinta no Claude Code: `ClaudeAdapter` temporário, sem
 * ferramenta nenhuma e sem sessão salva.
 * @param {{cwd: string, claudePath?: string|null, detectClaude?: Function|null,
 *   sdkLoader?: Function|null, selection?: {model: string|null, effort: string|null}}} options
 * @returns {InstanceType<typeof NativeService>}
 * @example const bridge = createClaudeInkBridge({cwd: folder, selection: {model: null, effort: null}});
 */
function createClaudeInkBridge({cwd, claudePath = null, detectClaude = null, sdkLoader = null, selection = null}) {
  const adapter = new ClaudeAdapter({
    conversationId: `notebook-ink:${crypto.randomUUID()}`,
    cwd,
    systemPrompt: '',
    claudePath,
    detectClaude,
    sdkLoader,
    selection,
    noTools: true,
    persistSession: false,
  });
  return new NativeService({adapter, engine: 'claude'});
}

module.exports = {INK_PROMPTS, inkPrompt, readInk, createOpenCodeInkBridge, createClaudeInkBridge};
