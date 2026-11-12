// @ts-check
/* Mede o payload de abertura do Apêndice A (#121): 5.000 mensagens com imagem
   a cada 25 turnos e saída longa a cada 50, com e sem os marcadores de mídia.
   Rode em desk/: `node tests/history-media-payload.mjs`. Não é teste do portão;
   o número que importa é a queda do `v8`/JSON entre a fonte e o payload. */
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import v8 from 'node:v8';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createHistoryMediaHost} = require('../history-media-host.cjs');
const {createPromptImages} = require('../prompt-images.cjs');

const TURNS = 1250;
const IMAGE = Buffer.alloc(24 * 1024, 7).toString('base64');
const IMAGE_MIME = 'image/png';

function messagesOf(turns) {
  const out = [];
  for (let index = 0; index < turns * 4; index++) {
    const kind = index % 4;
    const turn = Math.floor(index / 4) + 1;
    if (kind === 0) {
      const content = [{type: 'text', text: `Pergunta ${turn}: como resolvo a questão ${turn}?\n\nConsidere $f(x)=x^${(turn % 9) + 1}+${turn}$ e explique o passo a passo.`}];
      if (turn % 25 === 0) content.push({type: 'image', data: IMAGE, mimeType: IMAGE_MIME, source: `captura-${turn}.png`});
      out.push({role: 'user', content});
    } else if (kind === 1) {
      const content = [{type: 'text', text: `## Resposta ${turn}\n\nComece pela definição. A derivada de $f(x)=x^${(turn % 9) + 1}+${turn}$ é $f'(x)=${(turn % 9) + 1}x^${turn % 9}$.\n\nO resultado aproximado é ${(turn * 1.2345).toFixed(4)}.`}];
      if (turn % 7 === 0) content.push({type: 'toolCall', id: `t${turn}`, name: 'ler_pdf', arguments: {path: `material-${turn}.pdf`, page: (turn % 300) + 1}});
      out.push({role: 'assistant', content});
    } else if (kind === 2) {
      const long = turn % 50 === 0;
      out.push({role: 'toolResult', content: [{type: 'text', text: long ? 'linha de resultado com número e texto; '.repeat(520) : `ok ${turn}`}], toolCallId: `t${Math.max(1, turn - 1)}`});
    } else {
      out.push({role: 'assistant', content: [{type: 'text', text: `Fechando a resposta ${turn}: o sinal fica positivo e a integral vale $\\frac{1}{${(turn % 20) + 2}}$. Se precisar, refaça a conta com $x=${(turn % 9) + 1}$.`}]});
    }
  }
  return out;
}

const runtime = os.tmpdir();
const deskDir = path.resolve(import.meta.dirname, '..');
const trimMessageImages = createPromptImages({runtime, deskDir, learningRoot: path.join(runtime, 'learning'),
  nativeImage: {createFromBuffer: () => ({isEmpty: () => true})}}).trimMessageImages;
const session = `/tmp/medir-threads/dados/conversations/claude-${crypto.randomUUID()}.json`;
const live = {session};
const media = createHistoryMediaHost({live, trimMessageImages});
const messages = messagesOf(TURNS);
const marked = media.markerize(messages);
const bytes = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');
const v8Bytes = (value) => v8.serialize(value).byteLength;
const markerCount = (list) => list.reduce((sum, message) => sum + (message.content || []).filter((part) => part?.historyMedia).length, 0);
const report = {
  at: new Date().toISOString(),
  uptimeSeconds: Math.round(os.uptime()),
  loadAverage: os.loadavg().map((value) => Number(value.toFixed(2))),
  messages: messages.length,
  imagesInSource: messages.flatMap((message) => message.content || []).filter((part) => part?.type === 'image').length,
  longOutputsInSource: messages.flatMap((message) => message.content || []).filter((part) => part?.type === 'text' && part.text.length > 16000).length,
  markers: markerCount(marked),
  jsonBeforeMB: Number((bytes(messages) / 1048576).toFixed(2)),
  jsonAfterMB: Number((bytes(marked) / 1048576).toFixed(2)),
  v8BeforeMB: Number((v8Bytes(messages) / 1048576).toFixed(2)),
  v8AfterMB: Number((v8Bytes(marked) / 1048576).toFixed(2)),
  registry: media.stats(),
};
console.log(JSON.stringify(report, null, 2));
