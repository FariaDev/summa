import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {formatForPage, readPageFormat, createPageFormatCache} = require('../notebook-page-format.cjs');

/* Formato da página do `.xopp` na lista de cadernos (#166): o gzip guarda um
   XML com `<page width height>` em pontos. O leitor para na primeira página e
   o cache é por caminho+mtime; os fixtures são gzip de verdade, gerados no
   próprio teste, como o Xournal++ grava. */

function xoppBytes(pages) {
  const body = pages.map(([width, height]) => `<page width="${width}" height="${height}"><layer/></page>`).join('');
  return zlib.gzipSync(Buffer.from(`<?xml version="1.0"?><xournal version="1.2">${body}</xournal>`));
}

function withFixture(bytes, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-xopp-formato-'));
  const file = path.join(dir, 'aula.xopp');
  fs.writeFileSync(file, bytes);
  try {
    return run(file);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

test('tamanho em pontos vira o rótulo que a lista mostra, inclusive em paisagem', () => {
  assert.equal(formatForPage(595.275591, 841.889764), 'A4');
  assert.equal(formatForPage(841.889764, 595.275591), 'A4', 'paisagem tem o mesmo rótulo');
  assert.equal(formatForPage(419.527559, 595.275591), 'A5');
  assert.equal(formatForPage(841.889764, 1190.551181), 'A3');
  assert.equal(formatForPage(297.637795, 419.527559), 'A6');
  assert.equal(formatForPage(612, 792), 'Carta');
  assert.equal(formatForPage(612, 1008), 'Ofício', 'Legal do Xournal++ vira Ofício (#184)');
  assert.equal(formatForPage(1008, 612), 'Ofício', 'paisagem tem o mesmo rótulo');
  assert.equal(formatForPage(792, 1224), 'Tabloide');
  assert.equal(formatForPage(595.5, 841.5), 'A4', 'os decimais do Xournal++ cabem na tolerância');
  assert.equal(formatForPage(500, 700), '', 'tamanho fora da tabela fica sem etiqueta');
  assert.equal(formatForPage(0, 841.889764), '');
  assert.equal(formatForPage('x', 841.889764), '');
  assert.equal(formatForPage(undefined, undefined), '');
});

test('lê só a primeira página do gzip e ignora as seguintes', () => {
  withFixture(xoppBytes([[595.275591, 841.889764], [612, 792]]), (file) => {
    assert.equal(readPageFormat(file), 'A4');
  });
});

test('arquivo que não é gzip, XML sem page ou tamanho desconhecido não vira etiqueta', () => {
  withFixture(Buffer.from('caderno de teste'), (file) => {
    assert.equal(readPageFormat(file), '');
  });
  withFixture(zlib.gzipSync(Buffer.from('<?xml version="1.0"?><xournal/>')), (file) => {
    assert.equal(readPageFormat(file), '');
  });
  withFixture(xoppBytes([[500, 700]]), (file) => {
    assert.equal(readPageFormat(file), '', 'página de tamanho fora da tabela fica sem etiqueta');
  });
  assert.equal(readPageFormat('/caminho/que/nao/existe.xopp'), '');
});

test('gzip de alta razão sem page não trava a leitura (#211)', () => {
  const zeros = Buffer.alloc(100 * 1024 * 1024);
  withFixture(zlib.gzipSync(zeros), (file) => {
    const started = process.hrtime.bigint();
    assert.equal(readPageFormat(file), '');
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    assert.ok(elapsedMs < 300, `leitura de gzip-bomba levou ${elapsedMs.toFixed(0)} ms; o teto devia cortar bem antes de 300 ms`);
  });
});

test('o cache é por caminho+mtime: mesmo caminho com mtime novo é relido', () => {
  withFixture(xoppBytes([[595.275591, 841.889764]]), (file) => {
    const cache = createPageFormatCache();
    assert.equal(cache.formatOf(file, 1000), 'A4');
    fs.writeFileSync(file, xoppBytes([[612, 792]]));
    assert.equal(cache.formatOf(file, 1000), 'A4', 'mtime igual usa o valor guardado');
    assert.equal(cache.formatOf(file, 2000), 'Carta', 'mtime novo relê o caderno');
  });
});

test('cache desligado (limit 0) relê a cada chamada', () => {
  withFixture(xoppBytes([[595.275591, 841.889764]]), (file) => {
    const cache = createPageFormatCache({limit: 0});
    assert.equal(cache.formatOf(file, 1000), 'A4');
    fs.writeFileSync(file, xoppBytes([[612, 792]]));
    assert.equal(cache.formatOf(file, 1000), 'Carta', 'sem cache o mtime não segura o valor antigo');
  });
});
