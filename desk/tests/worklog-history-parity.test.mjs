/* Regressão #146: o descritor local do OpenCode perdia as ferramentas. Ao
   reabrir a conversa sem o histórico do servidor, o resumo do diário dizia
   "Pensou" onde o turno vivo dizia "1 busca". O teste alimenta a MESMA
   sequência de eventos do SSE pelos dois caminhos — o diário vivo (worklog,
   como no chat.mjs) e as mensagens gravadas → `historyTurns` — e compara o
   resumo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {
 closeThinking, countsLabel, createLog, finishLog, finishTool, headLine, historyTurns, startTool, thinkingDelta,
} from '../src/worklog.mjs';

const require = createRequire(import.meta.url);
const {OpenCodeEventReader} = require('../src/agents/opencode-events.cjs');

const SESSION = 'ses_146';

/* Sequência do 2.2.4 como o `worklogTurn` do fake: pensamento, ferramenta e
   fala em passos separados, cada um com o seu `assistantMessageID`. */
function turnEvents(name, input) {
 return [
  ['session.step.started', {assistantMessageID: 'msg_a'}],
  ['session.reasoning.delta', {assistantMessageID: 'msg_a', delta: 'Vou conferir.'}],
  ['session.reasoning.ended', {assistantMessageID: 'msg_a', text: 'Vou conferir.'}],
  ['session.tool.input.started', {assistantMessageID: 'msg_a', id: 'call_1', name}],
  ['session.tool.called', {assistantMessageID: 'msg_a', id: 'call_1', input}],
  ['session.tool.success', {assistantMessageID: 'msg_a', id: 'call_1', content: [{type: 'text', text: 'resultado'}]}],
  ['session.step.ended', {assistantMessageID: 'msg_a'}],
  ['session.step.started', {assistantMessageID: 'msg_b'}],
  ['session.text.delta', {assistantMessageID: 'msg_b', delta: 'Pronto.'}],
  ['session.text.ended', {assistantMessageID: 'msg_b', text: 'Pronto.'}],
  ['session.step.ended', {assistantMessageID: 'msg_b'}],
  ['session.execution.succeeded', {}],
 ];
}

/* Roda os quadros pelo leitor real, com relógio explícito. Devolve os eventos
   da Mesa com o instante em que cada um saiu. */
function readTurn(name, input) {
 let clock = 1_000;
 const at = () => clock;
 const events = [];
 const reader = new OpenCodeEventReader({
  sessionId: SESSION,
  now: at,
  emit: (type, payload) => events.push({type, payload, at: at()}),
 });
 for (const [type, data] of turnEvents(name, input)) {
  reader.handle(type, {sessionID: SESSION, ...data});
  clock += 100;
 }
 return {events, end: clock};
}

/* O chat.mjs: pensamento abre a rajada; falar e ferramenta a fecham; o fim do
   turno para os pendentes. */
function liveLog(events, end) {
 const log = createLog(events[0]?.at ?? 1_000);
 for (const event of events) {
  if (event.type === 'message_delta') {
   if (event.payload.kind === 'thinking') thinkingDelta(log, event.payload.delta, event.at);
   else closeThinking(log, event.at);
  } else if (event.type === 'tool_start') {
   closeThinking(log, event.at);
   startTool(log, {id: event.payload.id, name: event.payload.name, args: event.payload.args, now: event.at});
  } else if (event.type === 'tool_end') {
   finishTool(log, {id: event.payload.id, result: event.payload.result, isError: event.payload.isError, now: event.at});
  } else if (event.type === 'message_end') {
   closeThinking(log, event.at);
  }
 }
 finishLog(log, {now: end});
 return log;
}

function historyTurn(events) {
 const messages = events.filter((event) => event.type === 'message_end').map((event) => event.payload.message);
 return historyTurns(messages).at(-1);
}

/* O turno vivo começa no `agent_start` e o reconstruído no primeiro carimbo da
   mensagem: a duração do cabeçalho não é o que a issue compara. A frase
   ("Pensou" × "Trabalhou") e a contagem por tipo precisam bater. */
const summary = (log) => headLine(log).replace(/ por \d+(?:min \d+)?s\b/, '');

for (const [name, input, expected] of [
 ['web_search', {query: 'kojima xbox'}, '1 busca'],
 ['mcp__mesa__buscar_material', {consulta: 'pitágoras'}, '1 busca no material'],
 ['web_fetch', {url: 'https://example.com/aula'}, '1 página'],
]) {
 test(`#146: ${name} no resumo reconstruído igual ao vivo`, () => {
  const {events, end} = readTurn(name, input);
  const live = liveLog(events, end);
  const history = historyTurn(events);
  assert.ok(history, 'o histórico reconstruiu o turno');
  assert.equal(summary(history), summary(live), `vivo: ${headLine(live)} | histórico: ${headLine(history)}`);
  assert.equal(summary(history), `Trabalhou · ${expected}`);
  assert.equal(countsLabel(history.steps), countsLabel(live.steps));
 });
}
