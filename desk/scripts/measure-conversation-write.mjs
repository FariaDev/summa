#!/usr/bin/env node
/**
 * Mede quanto a gravação da conversa ainda bloqueia o processo principal por
 * turno depois da #119, que passou a gravar o descritor uma vez por turno. A
 * #4 propõe mover essa gravação para `worker_threads`; estes números sintéticos
 * decidem se o risco de ordem/concorrência compensa.
 *
 * O caminho medido é o real, sem reimplementar nada:
 * - `+1 mensagem`: `nativePersistence.onMessages` → `updateClaudeConversation`,
 *   a reescrita completa que o serviço dispara no `turn_end`
 *   (`src/agents/service.cjs:108,228-232`; `native-persistence.cjs:50-52`).
 * - `turno completo`: as mesmas gravações que um turno curto faz hoje —
 *   `appendPendingMessage` no aceite (`conversation-turn.cjs:196-207`), a fase
 *   da entrega e o id do turno no arquivo pequeno (`native-persistence.cjs:47-49,64-72`)
 *   e a reescrita completa no fim (`onMessages`). A soma é o bloqueio síncrono
 *   que o main sente no turno.
 *
 * Conversas sintéticas no schema do descritor (`conversations.cjs`), 4 mensagens
 * por turno, com matemática, imagem base64 de 24 KiB a cada 25 e `toolResult`
 * de ~18 KiB a cada 50, como no Apêndice A de `docs/design/threads-longas.md`.
 * Nada de sessão real, `desk/.runtime` ou dado do usuário: o descritor é criado
 * num diretório temporário debaixo de `desk/` (ext4, não tmpfs) e apagado.
 *
 *   node scripts/measure-conversation-write.mjs
 *
 * Mediana e máximo de 7 execuções após 1 aquecimento, para N = 100, 1.000 e
 * 5.000. O teto de `conversation-bounds.cjs` pode cortar a entrada; a coluna
 * "gravadas" mostra quantas mensagens sobraram no descritor.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';

const desk = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(desk, 'package.json'));
const conversations = require('./src/agents/conversations.cjs');
const {nativePersistence, previewOf} = require('./src/agents/native-persistence.cjs');
const {appendPendingMessage} = require('./src/agents/conversation-turn.cjs');

const SIZES = [100, 1000, 5000];
const RUNS = 7;
const WARMUP = 1;
/* Imagem pequena sintética: só entra no descritor como base64, como no app. */
const IMAGE_DATA = Buffer.alloc(24 * 1024, 7).toString('base64');

function textMessage(role, text, timestamp) {
  return {role, content: [{type: 'text', text}], timestamp};
}

/* Um turno realista da Mesa: pergunta, resposta com código/fórmula, resultado
   de ferramenta e fechamento. A cada 25 turnos a pergunta leva uma imagem. */
function turnMessages(turn) {
  const question = [{type: 'text', text: `Pergunta ${turn}: como resolvo a questão ${turn}?\n\nConsidere $f(x)=x^${(turn % 9) + 1}+${turn}$ e explique o passo a passo.`}];
  if (turn % 25 === 0) question.push({type: 'image', data: IMAGE_DATA, mimeType: 'image/png', source: `captura-${turn}.png`});
  const answer = `## Resposta ${turn}\n\nComece pela definição. A derivada de $f(x)=x^${(turn % 9) + 1}+${turn}$ é $f'(x)=${(turn % 9) + 1}x^${turn % 9}$.\n\n\`\`\`js\nfunction passo${turn}(x) {\n  return x * ${turn} + Math.pow(x, ${(turn % 5) + 1});\n}\n\`\`\`\n\n- passo 1: escreva a expressão\n- passo 2: confira o sinal\n- passo 3: substitua os limites\n\nO resultado aproximado é ${(turn * 1.2345).toFixed(4)}.`;
  const result = turn % 50 === 0
    ? `linha de resultado com número e texto; `.repeat(520)
    : `ok ${turn}`;
  return [
    {role: 'user', content: question, timestamp: 1700000000000 + turn * 4000},
    textMessage('assistant', answer, 1700000000000 + turn * 4000 + 1000),
    {role: 'toolResult', content: [{type: 'text', text: result}], toolCallId: `call-${turn}`, timestamp: 1700000000000 + turn * 4000 + 2000},
    textMessage('assistant', `Fechando a resposta ${turn}: o sinal fica positivo e a integral vale $\\frac{1}{${(turn % 20) + 2}}$. Se precisar, refaça a conta com $x=${(turn % 9) + 1}$.`, 1700000000000 + turn * 4000 + 3000),
  ];
}

/**
 * Conversa sintética no formato do descritor (4 mensagens por turno).
 * @param {number} count quantas mensagens gerar
 * @returns {object[]} ex.: `syntheticMessages(5000)`
 * @example const messages = syntheticMessages(5000);
 */
export function syntheticMessages(count) {
  const list = [];
  for (let turn = 1; list.length < count; turn += 1) {
    for (const message of turnMessages(turn)) {
      if (list.length < count) list.push(message);
    }
  }
  return list;
}

/* A semente usa o caminho real, então os tetos de mensagens/bytes valem aqui. */
function seedConversation(runtime, messages) {
  const file = conversations.createClaudeConversation({runtime, courseId: 'medicao', engine: 'claude'});
  conversations.updateClaudeConversation(file, {messages, preview: previewOf(messages, 'medição')}, {runtime});
  return file;
}

function storedMessages(file, runtime) {
  return conversations.readClaudeConversation(file, {runtime})?.messages ?? [];
}

/* O tempo síncrono da chamada; é ele que trava o main. */
function measureCall(invoke) {
  const started = performance.now();
  invoke();
  return performance.now() - started;
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {median: sorted[Math.floor(sorted.length / 2)], max: sorted[sorted.length - 1]};
}

/* Cada repetição parte do mesmo baseline: o custo medido é só o da gravação. */
function collectSamples(file, invoke, baseline) {
  for (let run = 0; run < WARMUP; run += 1) {
    fs.copyFileSync(baseline, file);
    measureCall(invoke);
  }
  const samples = [];
  for (let run = 0; run < RUNS; run += 1) {
    fs.copyFileSync(baseline, file);
    samples.push(measureCall(invoke));
  }
  return samples;
}

function measureSize(size) {
  const runtime = fs.mkdtempSync(path.join(desk, '.measure-conversation-write-'));
  try {
    const file = seedConversation(runtime, syntheticMessages(size));
    const messages = storedMessages(file, runtime);
    const baseline = path.join(runtime, 'baseline.json');
    fs.copyFileSync(file, baseline);
    const persistence = nativePersistence({descriptor: file, runtime, preview: 'medição'});
    const nextMessage = textMessage('assistant', 'Fechando a resposta: confira o sinal antes de entregar.', Date.now());
    const writeMessages = () => persistence.onMessages([...messages, nextMessage], {importedPrefixLength: 0});
    /* O turno faz as gravações pequenas da entrega e a completa do `turn_end`,
       na ordem real do serviço (#119). */
    const turnUser = {role: 'user', content: [{type: 'text', text: 'Pergunta medida do turno completo.'}], uuid: 'turno-medido'};
    const turnAnswer = textMessage('assistant', 'Resposta medida do turno completo.', Date.now());
    const writeTurn = () => {
      appendPendingMessage(file, turnUser);
      persistence.persistDelivery({id: 'turno-medido', status: 'accepted'});
      persistence.onTurn({user: 'Pergunta medida do turno completo.', messageId: 'msg_turno_medido'});
      persistence.onMessages([...messages, turnUser, turnAnswer], {importedPrefixLength: 0});
    };
    const messagesSamples = collectSamples(file, writeMessages, baseline);
    const after = storedMessages(file, runtime);
    const lastText = after[after.length - 1]?.content?.[0]?.text ?? '';
    if (!lastText.includes('Fechando a resposta: confira o sinal')) throw new Error(`gravação não anexou a mensagem: ${messages.length} → ${after.length}`);
    const turnSamples = collectSamples(file, writeTurn, baseline);
    const afterTurn = storedMessages(file, runtime);
    const lastTurnText = afterTurn[afterTurn.length - 1]?.content?.[0]?.text ?? '';
    if (lastTurnText !== 'Resposta medida do turno completo.') throw new Error(`turno não gravou a resposta: ${messages.length} → ${afterTurn.length}`);
    return {
      input: size,
      stored: messages.length,
      bytes: fs.statSync(baseline).size,
      messages: summarize(messagesSamples),
      turn: summarize(turnSamples),
    };
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
}

function formatMs(value) {
  return value.toFixed(1).replace('.', ',');
}

function printTable(rows) {
  console.log('| N | gravadas no descritor | arquivo (MB) | +1 mensagem mediana (ms) | +1 mensagem máximo (ms) | turno completo mediana (ms) | turno completo máximo (ms) |');
  console.log('| ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const row of rows) {
    console.log(`| ${row.input} | ${row.stored} | ${(row.bytes / 1048576).toFixed(2).replace('.', ',')} | ${formatMs(row.messages.median)} | ${formatMs(row.messages.max)} | ${formatMs(row.turn.median)} | ${formatMs(row.turn.max)} |`);
  }
}

function main() {
  const load = os.loadavg().map((value) => value.toFixed(2).replace('.', ',')).join(' / ');
  const cpu = os.cpus()[0]?.model ?? 'CPU desconhecida';
  console.log(`# Gravação da conversa por turno (#4) — ${process.version}, ${os.cpus().length} CPUs`);
  console.log(`# CPU: ${cpu}`);
  console.log(`# Carga (1/5/15 min) no início: ${load}`);
  console.log(`# ${WARMUP} aquecimento + ${RUNS} execuções por cenário; mediana e máximo`);
  console.log('# Tempo síncrono de nativePersistence → updateClaudeConversation');
  console.log('');
  const rows = SIZES.map(measureSize);
  printTable(rows);
  const endLoad = os.loadavg().map((value) => value.toFixed(2).replace('.', ',')).join(' / ');
  console.log('');
  console.log(`# Carga (1/5/15 min) no fim: ${endLoad}`);
}

/* O teste de janela importa `syntheticMessages`; só executa quando é o script. */
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
