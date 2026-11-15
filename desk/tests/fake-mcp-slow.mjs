#!/usr/bin/env node
/* MCP falso da sonda da #63: uma ferramenta só, que demora, falha ou derruba
   o processo conforme os argumentos. Serve para medir o que o OpenCode 2.2.4
   faz com o estado do MCP depois de uma chamada longa, de um erro da
   ferramenta e da morte do processo filho. */
import fs from 'node:fs';
import {createMcpServer, serveLines} from '../src/extensions/mesa-mcp/protocol.mjs';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (process.env.FAKE_MCP_PID_FILE) fs.writeFileSync(process.env.FAKE_MCP_PID_FILE, String(process.pid));

const lento = {
  name: 'lento',
  description: 'espera ms e responde; mode=error lança; mode=die mata o processo',
  inputSchema: {
    type: 'object',
    properties: {
      ms: {type: 'number'},
      mode: {type: 'string', enum: ['ok', 'error', 'die']},
    },
  },
  call: async (args) => {
    const ms = Number(args.ms) || 0;
    const mode = String(args.mode || 'ok');
    process.stderr.write(`${JSON.stringify({level: 'info', area: 'fake-mcp', msg: 'chamou', pid: process.pid, ms, mode})}\n`);
    if (mode === 'die') {
      /* Morre sem responder, como um MCP filho que cai no meio da chamada. */
      setTimeout(() => process.exit(3), 100);
      await wait(60000);
    }
    if (mode === 'error') throw Error('falha proposital da ferramenta falsa');
    await wait(ms);
    return {content: [{type: 'text', text: `esperou ${ms} ms`}]};
  },
};

const reply = createMcpServer({
  tools: [lento],
  name: 'mesa',
  version: 'sonda-63',
  log: (line) => process.stderr.write(`${line}\n`),
});
serveLines(reply, {input: process.stdin, output: process.stdout});
