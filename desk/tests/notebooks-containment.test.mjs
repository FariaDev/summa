/* Contenção da busca e do vigia da tinta (#158/F4): a lista confere o
   canônico, mas a busca e o vigia leem o `item.path` guardado. Se alguém
   troca o caderno por um symlink para fora da matéria depois da listagem,
   a leitura tem de refazer `realpath` + contenção e pular. Fakes com nome:
   leitor/exportador de `fake-ink.mjs`; fs/stat reais numa pasta temporária. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import {createFakeInkExporter, createFakeInkReader} from './fake-ink.mjs';

const require = createRequire(import.meta.url);
const {registerNotebooksHost} = require('../notebooks-host.cjs');

const VISION_CATALOG = [
  {provider: 'xai', id: 'grok-vision', name: 'Grok Visão', variants: [], input: ['text', 'image'], cost: {input: 1, output: 2}, contextWindow: 200000},
];

function xmlComTexto(texto) {
  return `<?xml version="1.0"?><xournal version="4"><page width="589" height="845"><layer><text fn="" size="12" color="#000000" font="Sans" x="100" y="100">${texto}</text></layer></page></xournal>`;
}

function xmlComTinta() {
  return '<?xml version="1.0"?><xournal version="4"><page width="589" height="845"><layer><stroke tool="pen" color="#000000" size="1.5"><point x="1" y="1"/></stroke><text fn="" size="12" color="#000000" font="Sans" x="100" y="100">SEGREDO fora da materia</text></layer></page></xournal>';
}

test('F4: busca e vigia re-resolvem o caminho e pulam symlink trocado para fora da matéria', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-caderno-contido-'));
  const course = path.join(base, 'Curso');
  fs.mkdirSync(course, {recursive: true});
  const inside = path.join(course, 'aula.xopp');
  const outside = path.join(base, 'fora-da-materia.xopp');
  fs.writeFileSync(inside, zlib.gzipSync(xmlComTexto('conteudo interno da aula')));
  fs.writeFileSync(outside, zlib.gzipSync(xmlComTinta()));
  try {
    const reader = createFakeInkReader({text: 'tinta de fora'});
    const exporter = createFakeInkExporter();
    const handlers = new Map();
    const ipcMain = {handle: (channel, fn) => handlers.set(channel, fn), removeHandler: (channel) => handlers.delete(channel)};
    const notebooks = registerNotebooksHost({
      ipcMain,
      courses: () => [{id: 'calc', name: 'Cálculo', path: course}],
      allowedXopp: new Set(),
      config: () => ({}),
      shell: {openPath: async () => ''},
      platform: 'linux',
      inkEnabled: () => true,
      selection: () => ({model: 'xai/grok-vision', effort: null}),
      catalog: () => VISION_CATALOG,
      createBridge: () => ({}),
      readInkImpl: reader.readInk,
      exportInkPng: exporter.exportInkPng,
    });
    try {
      const listed = await handlers.get('notebooks-list')({});
      assert.equal(listed.notebooks.length, 1, 'a lista inicial traz o caderno de dentro');
      assert.equal((await handlers.get('notebooks-search')({}, 'interno')).length, 1, 'a busca acha o conteúdo interno');

      fs.rmSync(inside);
      fs.symlinkSync(outside, inside);

      assert.deepEqual(await handlers.get('notebooks-search')({}, 'SEGREDO'), [], 'a busca pula o caminho que escapou da matéria');
      assert.equal(reader.calls.length, 0, 'o vigia não lê a tinta de fora');
      await notebooks.pollOnce();
      await notebooks.whenIdle();
      await notebooks.pollOnce();
      await notebooks.whenIdle();
      assert.equal(reader.calls.length, 0, 'nenhuma chamada ao modelo pelo symlink trocado');
      assert.equal(exporter.calls.length, 0, 'nenhum PNG exportado do arquivo de fora');
    } finally {
      notebooks.stop();
    }
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});
