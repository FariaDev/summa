/* `ler_caderno` no OpenCode pela ponte (#135): a ferramenta existe sempre que
   há concessão da ponte de atividades (nunca viaja lista no ambiente) e a
   lista é viva no processo principal — caderno aberto depois do connect é
   lido, caminho fora da lista é recusado e chamada sem o token é recusada
   como na rota `/pdf-page`. O .xopp é gerado aqui (gzip de XML mínimo); as
   chamadas ao binário vão para o `fake-xournalpp.mjs`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {readNotebookPage} from '../src/extensions/mesa-mcp/notebook-tool.mjs';
import {mesaTools} from '../src/extensions/mesa-mcp/tools.mjs';
import {spawnFakeXournalpp} from './fake-xournalpp-spawn.mjs';
import {authorizedXopp} from './xopp-authorized.mjs';

const require = createRequire(import.meta.url);
const {createActivityBridge} = require('../activity-bridge.cjs');

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fake-xournalpp.mjs');

function xmlDuasPaginas() {
  return `<?xml version="1.0" standalone="no"?>
<xournal version="4">
<page width="589.00" height="845.00">
<background type="solid" color="#ffffffff" style="lined"/>
<layer>
<text fn="" size="12" color="#0013ff" font="Sans" x="100.00" y="100.00">Primeira página</text>
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

function bridgeWithLiveList(liveList) {
  return createActivityBridge({
    publish: async () => { throw Error('não publica'); },
    notebookPage: (raw) => readNotebookPage({caminho: raw?.caminho, pagina: raw?.pagina}, {allowedXopp: liveList, xournalPath: FAKE, spawnProcess: spawnFakeXournalpp}),
  });
}

test('ler_caderno aparece no OpenCode só pela concessão da ponte, sem lista no ambiente', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bridge-'));
  const bridge = bridgeWithLiveList(authorizedXopp());
  await bridge.start();
  try {
    const grant = bridge.grant({conversationId: 'opencode-notebook', generation: 1}, {engine: 'opencode'});
    const env = {LEARNING_DESK_ACTIVITY_BRIDGE: JSON.stringify(grant)};
    assert.ok(!mesaTools({}).some((tool) => tool.name === 'ler_caderno'), 'sem concessão, a ferramenta não existe');
    const names = mesaTools(env).map((tool) => tool.name);
    assert.ok(names.includes('ler_caderno'));
    assert.ok(names.indexOf('ler_caderno') > names.indexOf('calcular'));
    const side = mesaTools({...env, LEARNING_DESK_PDF_ONLY: '1'}).map((tool) => tool.name);
    assert.ok(side.includes('ler_caderno'));
  } finally {
    await bridge.close();
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('sessão conectada com lista vazia lê o caderno aberto depois do connect, pela ponte', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bridge-'));
  const file = writeXopp(dir, xmlDuasPaginas());
  const liveList = new Set();
  const bridge = bridgeWithLiveList(liveList);
  await bridge.start();
  try {
    const grant = bridge.grant({conversationId: 'opencode-notebook-viva', generation: 1}, {engine: 'opencode'});
    const tool = mesaTools({LEARNING_DESK_ACTIVITY_BRIDGE: JSON.stringify(grant)}).find((entry) => entry.name === 'ler_caderno');
    assert.ok(tool, 'a ferramenta já existe com a lista vazia no connect');
    const empty = await tool.call({caminho: file, pagina: 2});
    assert.equal(empty.isError, true);
    assert.match(empty.content[0].text, /fora da lista conhecida/);
    /* O aluno abre o primeiro caderno depois que a sessão do tutor começou. */
    for (const entry of authorizedXopp(file)) liveList.add(entry);
    const ok = await tool.call({caminho: file, pagina: 2});
    assert.equal(ok.isError, undefined);
    const image = ok.content.find((entry) => entry.type === 'image');
    const text = ok.content.find((entry) => entry.type === 'text');
    assert.ok(image, 'a página vem com o PNG');
    assert.equal(image.mimeType, 'image/png');
    assert.deepEqual([...Buffer.from(image.data, 'base64').subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    assert.match(text.text, /Segunda página/);
    assert.doesNotMatch(text.text, /Primeira página/);
    assert.match(text.text, /página 2 de 2/);
  } finally {
    await bridge.close();
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('caderno fora da lista é recusado pela ponte sem chamar o fake', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bridge-'));
  const known = writeXopp(dir, xmlDuasPaginas());
  const outside = writeXopp(dir, xmlDuasPaginas(), 'fora.xopp');
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bridge-log-'));
  const logFile = path.join(logDir, 'fake.log');
  const saved = process.env.FAKE_XOURNALPP_LOG;
  process.env.FAKE_XOURNALPP_LOG = logFile;
  const bridge = bridgeWithLiveList(authorizedXopp(known));
  await bridge.start();
  try {
    const grant = bridge.grant({conversationId: 'opencode-notebook-fora', generation: 1}, {engine: 'opencode'});
    const tool = mesaTools({LEARNING_DESK_ACTIVITY_BRIDGE: JSON.stringify(grant)}).find((entry) => entry.name === 'ler_caderno');
    assert.ok(tool);
    const refused = await tool.call({caminho: outside, pagina: 1});
    assert.equal(refused.isError, true);
    assert.match(refused.content[0].text, /fora da lista conhecida/);
    const calls = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean) : [];
    assert.deepEqual(calls, [], 'o binário não é chamado');
  } finally {
    if (saved === undefined) delete process.env.FAKE_XOURNALPP_LOG;
    else process.env.FAKE_XOURNALPP_LOG = saved;
    await bridge.close();
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(logDir, {recursive: true, force: true});
  }
});

test('chamada sem a autorização da ponte é recusada como em /pdf-page', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-notebook-bridge-'));
  const file = writeXopp(dir, xmlDuasPaginas());
  const bridge = bridgeWithLiveList(authorizedXopp(file));
  await bridge.start();
  try {
    const grant = bridge.grant({conversationId: 'opencode-notebook-token', generation: 1}, {engine: 'opencode'});
    const tool = mesaTools({LEARNING_DESK_ACTIVITY_BRIDGE: JSON.stringify(grant)}).find((entry) => entry.name === 'ler_caderno');
    assert.ok(tool);
    const {notebookBridgeTool} = await import('../src/extensions/mesa-mcp/notebook-tool.mjs');
    const wrongToken = await notebookBridgeTool({grant: {...grant, token: 'outro'}}).call({caminho: file, pagina: 1});
    assert.equal(wrongToken.isError, true, 'sem o token da conversa, nada é lido');
    assert.match(wrongToken.content[0].text, /HTTP 403/);
  } finally {
    await bridge.close();
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
