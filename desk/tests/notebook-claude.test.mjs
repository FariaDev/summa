/* Paridade do `ler_caderno` no motor Claude (#135): o mesmo nome, a mesma
   descrição e o mesmo esquema do OpenCode (`tools.mjs`/`notebook-tool.mjs`),
   via o servidor real de estudo (`study-tools.cjs`) e o adaptador Claude.
   A chamada de verdade passa pelo `readNotebookPage` com o fake
   `fake-xournalpp.mjs`; caminho fora da lista é recusado; o chat lateral
   que tem `ler_pdf` também recebe `ler_caderno`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {fakeSdk} from './claude-fixtures.mjs';
import {NOTEBOOK_DESCRIPTION, NOTEBOOK_FIELDS, NOTEBOOK_TOOL_NAME, readNotebookPage} from '../src/extensions/mesa-mcp/notebook-tool.mjs';
import {mesaTools} from '../src/extensions/mesa-mcp/tools.mjs';
import {canonical, canonicalFields} from '../src/extensions/tool-fields.mjs';
import {spawnFakeXournalpp} from './fake-xournalpp-spawn.mjs';
import {authorizedXopp} from './xopp-authorized.mjs';

const require = createRequire(import.meta.url);
const {ClaudeAdapter} = require('../src/agents/claude-adapter.cjs');
const {createStudyToolsServer} = require('../src/agents/study-tools.cjs');
const {createClaudeSideEngine} = require('../sidechat-engine.cjs');
const {ClaudeService} = require('../src/agents/service.cjs');
const conversations = require('../src/agents/conversations.cjs');

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fake-xournalpp.mjs');

function xmlDuasPaginas() {
  return `<?xml version="1.0" standalone="no"?>
<xournal version="4">
<page width="589.00" height="845.00">
<background type="solid" color="#ffffffff" style="lined"/>
<layer>
<text fn="" size="12" color="#0013ff" font="Sans" x="100.00" y="100.00">Primeira página</text>
<teximage text="x^2 + y^2" left="100" top="150" right="220" bottom="180">iVBORw0KG=</teximage>
</layer>
</page>
<page width="589.00" height="845.00">
<background type="solid" color="#ffffffff" style="lined"/>
<layer>
<text fn="" size="12" color="#0013ff" font="Sans" x="100.00" y="100.00">Segunda página</text>
</layer>
</page>
</xournal>
`;
}

function writeXopp(dir, xml, name = 'notas.xopp') {
  const file = path.join(dir, name);
  fs.writeFileSync(file, gzipSync(xml));
  return file;
}

function readNotebookFor(file) {
  const allowedXopp = authorizedXopp(file);
  return (raw) => readNotebookPage({caminho: raw?.caminho, pagina: raw?.pagina}, {allowedXopp, xournalPath: FAKE, spawnProcess: spawnFakeXournalpp});
}

async function claudeListedTools(ciel) {
  const {readNotebook, ...rest} = ciel;
  const server = await createStudyToolsServer({readNotebook: readNotebook ?? (async () => ({})), ...rest});
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({name: 'notebook-claude-parity', version: '1'});
  await server.instance.connect(b);
  await client.connect(a);
  try {
    return await client.listTools();
  } finally {
    await client.close();
    await server.instance.close();
  }
}

test('Claude recebe ler_caderno com mesmo nome/descrição/esquema do OpenCode', async () => {
  const listed = await claudeListedTools({readNotebook: async () => ({})});
  const tool = listed.tools.find((entry) => entry.name === NOTEBOOK_TOOL_NAME);
  assert.ok(tool, `ler_caderno aparece no servidor Claude (veio: ${listed.tools.map((entry) => entry.name).join(', ')})`);
  assert.equal(tool.description, NOTEBOOK_DESCRIPTION);
  const open = mesaTools({LEARNING_DESK_ACTIVITY_BRIDGE: JSON.stringify({url: 'http://127.0.0.1:9/activity', token: 't'})}).find((entry) => entry.name === NOTEBOOK_TOOL_NAME);
  assert.ok(open, 'ler_caderno aparece no OpenCode');
  assert.equal(tool.description, open.description, 'mesma descrição nos dois motores');
  assert.deepEqual(canonical(tool.inputSchema), canonical(open.inputSchema), 'mesmo esquema nos dois motores');
  assert.deepEqual(canonicalFields(NOTEBOOK_FIELDS), canonical(open.inputSchema));
});

test('chamar pelo adaptador Claude devolve imagem + texto da página (fake-xournalpp)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-claude-'));
  const file = writeXopp(dir, xmlDuasPaginas());
  const sdk = fakeSdk();
  const adapter = new ClaudeAdapter({
    conversationId: 'notebook-claude',
    cwd: process.cwd(),
    sdkLoader: async () => sdk,
    timeoutMs: 2000,
    readNotebook: readNotebookFor(file),
  });
  let client;
  try {
    await adapter._ensureQuery();
    const options = sdk.state.queries[0].options;
    assert.equal((await options.canUseTool('mcp__mesa__ler_caderno', {caminho: file, pagina: 2}, {})).behavior, 'allow');
    const [a, b] = InMemoryTransport.createLinkedPair();
    client = new Client({name: 'notebook-claude-call', version: '1'});
    await options.mcpServers.mesa.instance.connect(b);
    await client.connect(a);
    const result = await client.callTool({name: NOTEBOOK_TOOL_NAME, arguments: {caminho: file, pagina: 2}});
    assert.equal(result.isError, undefined, JSON.stringify(result.content));
    const image = result.content.find((entry) => entry.type === 'image');
    const text = result.content.find((entry) => entry.type === 'text');
    assert.ok(image, 'a página vem com o PNG');
    assert.equal(image.mimeType, 'image/png');
    assert.deepEqual([...Buffer.from(image.data, 'base64').subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    assert.match(text.text, /Segunda página/);
    assert.doesNotMatch(text.text, /Primeira página/);
    assert.match(text.text, /página 2 de 2/);
  } finally {
    adapter.close();
    await client?.close();
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('caminho fora da lista é recusado via Claude sem chamar o fake', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-claude-'));
  const known = writeXopp(dir, xmlDuasPaginas());
  const outside = path.join(dir, 'fora.xopp');
  fs.writeFileSync(outside, 'isto não é gzip');
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-claude-log-'));
  const logFile = path.join(logDir, 'fake.log');
  const saved = process.env.FAKE_XOURNALPP_LOG;
  process.env.FAKE_XOURNALPP_LOG = logFile;
  const sdk = fakeSdk();
  const adapter = new ClaudeAdapter({
    conversationId: 'notebook-claude-fora',
    cwd: process.cwd(),
    sdkLoader: async () => sdk,
    timeoutMs: 2000,
    readNotebook: readNotebookFor(known),
  });
  let client;
  try {
    await adapter._ensureQuery();
    const options = sdk.state.queries[0].options;
    const [a, b] = InMemoryTransport.createLinkedPair();
    client = new Client({name: 'notebook-claude-fora', version: '1'});
    await options.mcpServers.mesa.instance.connect(b);
    await client.connect(a);
    const result = await client.callTool({name: NOTEBOOK_TOOL_NAME, arguments: {caminho: outside, pagina: 1}});
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /fora da lista conhecida/);
    assert.doesNotMatch(result.content[0].text, /gzip/, 'a recusa vem antes de abrir o arquivo');
    const calls = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean) : [];
    assert.deepEqual(calls, [], 'o binário não é chamado');
  } finally {
    if (saved === undefined) delete process.env.FAKE_XOURNALPP_LOG;
    else process.env.FAKE_XOURNALPP_LOG = saved;
    adapter.close();
    await client?.close();
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(logDir, {recursive: true, force: true});
  }
});

async function claudeCallNotebook(readNotebook) {
  const server = await createStudyToolsServer({readNotebook});
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({name: 'notebook-claude-fallback', version: '1'});
  await server.instance.connect(b);
  await client.connect(a);
  try {
    return await client.callTool({name: NOTEBOOK_TOOL_NAME, arguments: {caminho: 'notas.xopp', pagina: 1}});
  } finally {
    await client.close();
    await server.instance.close();
  }
}

test('erro sem mensagem usa a reserva err.notebook.readFailed, como o ler_pdf', async () => {
  const result = await claudeCallNotebook(async () => {
    throw Error('');
  });
  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, 'Não foi possível ler o caderno. Confira o caminho e tente de novo.');
});

test('chat lateral com ler_pdf também recebe ler_caderno', async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-sidechat-notebook-'));
  const descriptor = conversations.createClaudeConversation({runtime, courseId: 'Calculo I'});
  const readPdf = async () => ({file: 'A.pdf', total: 1, pages: [{page: 1, text: 'x'}]});
  const readNotebook = async () => ({file: 'notas.xopp', page: 1, total: 1, text: [], latex: [], missingPdf: false, image: ''});
  const instances = [];
  class FakeAdapter extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      instances.push(this);
    }
    async connect() {}
    async initializeControls() { return {}; }
    controlsSnapshot() { return {}; }
    async history() { return []; }
    async send() { return {}; }
    async cancel() { return {}; }
    respond() { return {}; }
    stop() {}
  }
  try {
    const engine = createClaudeSideEngine({
      id: 'sc-lateral',
      descriptor,
      runtime,
      prepare: () => ({cwd: runtime, systemPrompt: 'prompt'}),
      readPdf,
      readNotebook,
      deps: {Adapter: FakeAdapter, Service: ClaudeService},
    });
    assert.equal(instances.at(-1).options.readPdf, readPdf);
    assert.equal(instances.at(-1).options.readNotebook, readNotebook, 'ler_caderno chega ao adaptador do lateral');
    engine.close();
  } finally {
    fs.rmSync(runtime, {recursive: true, force: true});
  }
});
