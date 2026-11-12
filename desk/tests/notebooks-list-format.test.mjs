import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {registerNotebooksHost} = require('../notebooks-host.cjs');

/* Lista de cadernos com cor e formato (#166): o host manda a cor da matéria
   vinda do config normalizado e o formato lido do começo do `.xopp`, com
   cache por caminho+mtime. Fixtures reais em pasta temporária. */

function xoppBytes(width, height) {
  return zlib.gzipSync(Buffer.from(`<?xml version="1.0"?><xournal version="1.2"><page width="${width}" height="${height}"><layer/></page></xournal>`));
}

function setup() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-lista-formato-'));
  const course = path.join(base, 'Calculo');
  fs.mkdirSync(course);
  const a4 = path.join(course, 'a4.xopp');
  const carta = path.join(course, 'carta.xopp');
  const oficio = path.join(course, 'oficio.xopp');
  const semFormato = path.join(course, 'sem-formato.xopp');
  fs.writeFileSync(a4, xoppBytes(595.275591, 841.889764));
  fs.writeFileSync(carta, xoppBytes(612, 792));
  fs.writeFileSync(oficio, xoppBytes(612, 1008));
  fs.writeFileSync(semFormato, 'caderno de teste');
  const handlers = new Map();
  const ipcMain = {handle: (channel, fn) => handlers.set(channel, fn), removeHandler: (channel) => handlers.delete(channel)};
  registerNotebooksHost({
    ipcMain,
    courses: () => [{id: 'calc', name: 'Cálculo', path: course}],
    allowedXopp: new Set(),
    config: () => ({courses: [{id: 'calc', name: 'Cálculo', path: course, color: '#c02667'}]}),
    shell: {openPath: async () => ''},
    platform: 'linux',
    inkEnabled: () => false,
  });
  return {base, course, a4, handlers};
}

test('notebooks-list leva a cor da matéria e o formato lido da primeira página', async () => {
  const {base, a4, handlers} = setup();
  try {
    const listed = await handlers.get('notebooks-list')({});
    const byName = Object.fromEntries(listed.notebooks.map((item) => [item.name, item]));
    assert.equal(byName['a4.xopp'].format, 'A4');
    assert.equal(byName['carta.xopp'].format, 'Carta');
    assert.equal(byName['oficio.xopp'].format, 'Ofício', 'o acento chega inteiro do host para a lista (#184)');
    assert.equal('format' in byName['sem-formato.xopp'], false, 'sem formato conhecido o item não ganha etiqueta');
    assert.equal(byName['a4.xopp'].color, '#c02667');
    assert.equal(byName['sem-formato.xopp'].color, '#c02667', 'a cor vale para todos os cadernos da matéria');

    fs.writeFileSync(a4, xoppBytes(612, 792));
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(a4, later, later);
    const relisted = await handlers.get('notebooks-list')({});
    assert.equal(relisted.notebooks.find((item) => item.name === 'a4.xopp').format, 'Carta', 'mtime novo relê o formato');
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});

test('matéria sem color não ganha cor no item (o cinza de hoje)', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-lista-sem-cor-'));
  const course = path.join(base, 'Fisica');
  fs.mkdirSync(course);
  fs.writeFileSync(path.join(course, 'aula.xopp'), xoppBytes(595.275591, 841.889764));
  const handlers = new Map();
  const ipcMain = {handle: (channel, fn) => handlers.set(channel, fn), removeHandler: (channel) => handlers.delete(channel)};
  registerNotebooksHost({
    ipcMain,
    courses: () => [{id: 'fis', name: 'Física', path: course}],
    allowedXopp: new Set(),
    config: () => ({courses: [{id: 'fis', name: 'Física', path: course}]}),
    shell: {openPath: async () => ''},
    platform: 'linux',
    inkEnabled: () => false,
  });
  try {
    const [item] = (await handlers.get('notebooks-list')({})).notebooks;
    assert.equal('color' in item, false);
    assert.equal(item.format, 'A4');
  } finally {
    fs.rmSync(base, {recursive: true, force: true});
  }
});
