#!/usr/bin/env node
/* Mede SÓ quanto UMA gravação de turno bloqueia o processo principal (#119).
 *
 * O caminho medido é o real: `nativePersistence.onMessages` →
 * `conversations.updateClaudeConversation`, o mesmo que `NativeService.flush`
 * chama no `turn_end` (`src/agents/service.cjs:109`), e o `persistDelivery`
 * (fase da entrega), que desde a #119 grava só o arquivo pequeno do turno. Nada
 * é reimplementado: o script só monta a conversa sintética e cronometra a
 * chamada síncrona, que é o bloqueio que o main sente.
 *
 *   node scripts/measure-conversation-write.mjs
 *
 * Cada tamanho é gravado uma vez pelo caminho real (semente) e depois medido
 * 20 vezes com uma mensagem nova, restaurando o descritor antes de cada
 * repetição. O descritor fica num diretório temporário no disco do repositório
 * (ext4), não em /tmp, para o custo de I/O não sumir num tmpfs.
 *
 * O teto real de `conversation-bounds.cjs` pode cortar a entrada: a coluna
 * "gravadas" mostra quantas mensagens sobraram no descritor. Em 10.000 o
 * `MAX_MESSAGE_COUNT` de 5.000 já corta antes de gravar. */

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

const SIZES = [500, 2000, 5000, 10000];
const RUNS = 20;
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
    ? `linha de resultado com número e texto; `.repeat(260)
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

/* Percentil por posto (nearest-rank): p95 de 20 amostras é a 19ª. */
function percentile(sorted, fraction) {
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[rank];
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {median: percentile(sorted, 0.5), p95: percentile(sorted, 0.95), max: sorted[sorted.length - 1]};
}

/* Cada repetição parte do mesmo baseline: o custo medido é só o da gravação. */
function collectSamples(file, invoke, baseline) {
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
    const nextMessage = textMessage('assistant', 'Fechando a resposta: confira o sinal antes de entregar.', Date.now());
    const persistence = nativePersistence({descriptor: file, runtime, preview: 'medição'});
    const writeMessages = () => persistence.onMessages([...messages, nextMessage], {importedPrefixLength: 0});
    const writeDelivery = () => persistence.persistDelivery({id: 'medicao', status: 'accepted'});
    measureCall(writeMessages);
    fs.copyFileSync(baseline, file);
    measureCall(writeDelivery);
    const samples = collectSamples(file, writeMessages, baseline);
    const after = storedMessages(file, runtime);
    /* No teto de 5.000 a mensagem nova entra e a mais antiga sai: o total não
       cresce, mas a última gravada tem de ser a do turno medido. */
    const lastText = after[after.length - 1]?.content?.[0]?.text ?? '';
    if (!lastText.includes('Fechando a resposta: confira o sinal')) throw new Error(`gravação não anexou o turno: ${messages.length} → ${after.length}`);
    const delivery = collectSamples(file, writeDelivery, baseline);
    return {input: size, stored: messages.length, bytes: fs.statSync(baseline).size, messages: summarize(samples), delivery: summarize(delivery)};
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
}

function formatMs(value) {
  return value.toFixed(1).replace('.', ',');
}

function printTable(rows) {
  console.log('| mensagens de entrada | gravadas no descritor | arquivo (MB) | mediana (ms) | p95 (ms) | máximo (ms) |');
  console.log('| ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const row of rows) {
    console.log(`| ${row.input} | ${row.stored} | ${(row.bytes / 1048576).toFixed(2).replace('.', ',')} | ${formatMs(row.messages.median)} | ${formatMs(row.messages.p95)} | ${formatMs(row.messages.max)} |`);
  }
}

/* O mesmo caminho de `persistDelivery`, que desde a #119 não relê nem reescreve
   `messages`: a fase da entrega muda no arquivo pequeno ao lado do descritor. */
function printDeliveryTable(rows) {
  console.log('| mensagens de entrada | mediana (ms) | p95 (ms) | máximo (ms) |');
  console.log('| ---: | ---: | ---: | ---: |');
  for (const row of rows) {
    console.log(`| ${row.input} | ${formatMs(row.delivery.median)} | ${formatMs(row.delivery.p95)} | ${formatMs(row.delivery.max)} |`);
  }
}

function main() {
  const load = os.loadavg().map((value) => value.toFixed(2).replace('.', ',')).join(' / ');
  console.log(`# Gravação de um turno da conversa (#119) — ${process.version}, ${os.cpus().length} CPUs`);
  console.log(`# Carga (1/5/15 min) no início: ${load}`);
  console.log(`# ${RUNS} repetições por tamanho; percentil por posto (nearest-rank)`);
  console.log('# Tempo síncrono de nativePersistence → updateClaudeConversation');
  console.log('');
  const rows = SIZES.map(measureSize);
  console.log('## Mensagens do turno (`onMessages`), a reescrita completa');
  printTable(rows);
  console.log('');
  console.log('## Fase da entrega (`persistDelivery`), o arquivo pequeno do turno (#119)');
  printDeliveryTable(rows);
  const endLoad = os.loadavg().map((value) => value.toFixed(2).replace('.', ',')).join(' / ');
  console.log('');
  console.log(`# Carga (1/5/15 min) no fim: ${endLoad}`);
}

/* O teste de janela importa `syntheticMessages`; só executa quando é o script. */
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
