/* Motivo legível da falha do MCP `mesa` (#55), sem Electron nem servidor.
   O `opencode.mcp.failed` mostrava "(HTTP timeout)"/"(HTTP status failed)";
   agora HTTP só com código, timeout e recusa viram frase nos dois idiomas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createI18n, parseMessage} from '../src/i18n.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

const require = createRequire(import.meta.url);
const {mcpFailureMessage} = require('../src/agents/opencode-mcp.cjs');
const catalogs = {'pt-BR': ptBR, en};
const pt = createI18n({catalogs, language: 'pt-BR'});
const english = createI18n({catalogs, language: 'en'});

test('HTTP só com código: o status numérico vira "HTTP 500" nos dois idiomas', () => {
  assert.deepEqual(parseMessage(mcpFailureMessage('500')), {key: 'opencode.mcp.failed.http', args: {status: '500'}});
  assert.equal(pt.text(mcpFailureMessage('500')), pt.t('opencode.mcp.failed.http', {status: '500'}));
  assert.match(pt.text(mcpFailureMessage('500')), /HTTP 500/);
  assert.match(english.text(mcpFailureMessage('500')), /HTTP 500/);
});

test('timeout vira "não respondeu a tempo", não "HTTP timeout"', () => {
  assert.deepEqual(parseMessage(mcpFailureMessage('timeout')), {key: 'opencode.mcp.failed', args: {reason: 'opencode.mcp.reason.timeout'}});
  const text = pt.text(mcpFailureMessage('timeout'));
  assert.match(text, /não respondeu a tempo/);
  assert.match(english.text(mcpFailureMessage('timeout')), /did not answer in time/);
  assert.doesNotMatch(text, /HTTP/);
});

test('failed e error viram "o servidor recusou", não "HTTP status failed"', () => {
  for (const status of ['failed', 'error']) {
    assert.deepEqual(parseMessage(mcpFailureMessage(status)), {key: 'opencode.mcp.failed', args: {reason: 'opencode.mcp.reason.refused'}});
    const text = pt.text(mcpFailureMessage(status));
    assert.match(text, /o servidor recusou/);
    assert.match(english.text(mcpFailureMessage(status)), /the server refused/);
    assert.doesNotMatch(text, /HTTP|status failed/);
  }
});

test('sem resposta do servidor também sai legível, e o aviso diz como tentar de novo', () => {
  assert.deepEqual(parseMessage(mcpFailureMessage('sem resposta')), {key: 'opencode.mcp.failed', args: {reason: 'opencode.mcp.reason.noAnswer'}});
  const text = pt.text(mcpFailureMessage('sem resposta'));
  assert.match(text, /não respondeu/);
  assert.match(text, /Abra a conversa de novo para tentar/);
  assert.match(english.text(mcpFailureMessage('sem resposta')), /Open the conversation again to retry/);
});
