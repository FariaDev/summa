/* O seletor de material (#74), a parte pura: raiz da pasta da matéria no topo,
   um grupo por subpasta em ordem natural (pt-BR, numérica), busca pelo nome do
   arquivo mostrando o grupo de cada achado e o estado aberto/fechado por pasta.
   Inclui a pasta relativa que o host entrega (`pdfFolderOf`). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {
  materialRows, normalizeMaterialFolders, normalizeFolder, folderOpen,
  matchesMaterialQuery, materialActive, FOLDER_LIMIT,
} from '../src/material-picker.mjs';

const require = createRequire(import.meta.url);
const {pdfFolderOf, withPdfFolders, courseLibrary} = require('../courses.cjs');

const entry = (name, folder = '') => ({
  name,
  path: `/cursos/Calc/${folder ? `${folder}/` : ''}${name}`,
  folder,
});
const labels = (rows) => rows.filter((row) => row.kind === 'group').map((row) => row.label);
const files = (rows) => rows.filter((row) => row.kind === 'file').map((row) => row.entry.name);

const library = [
  entry('Apostila 10.pdf'),
  entry('Cap 10 - Integrais.pdf', 'Cap 10 - Integrais'),
  entry('Apostila 2.pdf'),
  entry('Aula 10.pdf', 'Cap 3 - Derivadas'),
  entry('Aula 2.pdf', 'Cap 3 - Derivadas'),
  entry('Lista 10.pdf', 'Listas/2024'),
  entry('Lista 2.pdf', 'Listas/2024'),
  entry('Lista 1.pdf', 'Listas'),
];

test('raiz no topo e um grupo por subpasta, em ordem natural de nome', () => {
  const rows = materialRows(library);
  assert.deepEqual(rows.slice(0, 2).map((row) => row.kind === 'file' && row.entry.name), ['Apostila 2.pdf', 'Apostila 10.pdf'], 'os PDFs da raiz vêm primeiro, sem grupo, na ordem numérica');
  assert.deepEqual(labels(rows), ['Cap 3 - Derivadas', 'Cap 10 - Integrais', 'Listas', 'Listas/2024'], 'um grupo por pasta, com o caminho relativo no título; Cap 3 antes de Cap 10');
  const cap3 = rows.find((row) => row.kind === 'group' && row.folder === 'Cap 3 - Derivadas');
  assert.deepEqual({open: cap3.open, count: cap3.count}, {open: true, count: 2}, 'o grupo abre por padrão e conta os arquivos');
  assert.deepEqual(files(rows), ['Apostila 2.pdf', 'Apostila 10.pdf', 'Aula 2.pdf', 'Aula 10.pdf', 'Cap 10 - Integrais.pdf', 'Lista 1.pdf', 'Lista 2.pdf', 'Lista 10.pdf'], 'dentro do grupo também vale a ordem natural');
});

test('matéria sem subpastas: a lista é a de hoje, sem grupo', () => {
  const flat = [entry('Apostila 10.pdf'), entry('Apostila 2.pdf'), entry('Lista.pdf')];
  const rows = materialRows(flat);
  assert.deepEqual(labels(rows), []);
  assert.deepEqual(files(rows), ['Apostila 2.pdf', 'Apostila 10.pdf', 'Lista.pdf']);
});

test('busca: filtra pelo nome do arquivo, sem caixa nem acento, e mostra o grupo de cada achado', () => {
  const rows = materialRows(library, {folders: {'Listas/2024': false}, query: 'LISTA'});
  assert.deepEqual(labels(rows), ['Listas', 'Listas/2024'], 'o grupo sem achado some e os achados ficam com o grupo');
  assert.deepEqual(files(rows), ['Lista 1.pdf', 'Lista 2.pdf', 'Lista 10.pdf']);
  assert.ok(rows.filter((row) => row.kind === 'group').every((row) => row.open), 'com busca ativa os grupos aparecem abertos mesmo fechados no estado');
  assert.deepEqual(files(materialRows(library, {query: 'aula'})), ['Aula 2.pdf', 'Aula 10.pdf'], 'a busca acha sem caixa');
  assert.equal(matchesMaterialQuery('Ética.pdf', 'etica'), true, 'sem acento também');
  assert.deepEqual(labels(materialRows(library, {query: 'cap 3'})), [], 'a busca é pelo NOME do arquivo, não pelo título do grupo');
  assert.ok(matchesMaterialQuery('Aula 3 — Derivadas.pdf', 'derivadas'));
  assert.equal(matchesMaterialQuery('Aula 3.pdf', ''), true, 'busca vazia mostra tudo');
});

test('busca vazia respeita o estado fechado e o grupo fechado não mostra os arquivos', () => {
  const rows = materialRows(library, {folders: {'Cap 3 - Derivadas': false}});
  const cap3 = rows.find((row) => row.kind === 'group' && row.folder === 'Cap 3 - Derivadas');
  assert.equal(cap3.open, false);
  assert.equal(files(rows).includes('Aula 2.pdf'), false, 'grupo fechado esconde os arquivos');
  assert.deepEqual(labels(rows), ['Cap 3 - Derivadas', 'Cap 10 - Integrais', 'Listas', 'Listas/2024'], 'os outros grupos continuam');
});

test('estado aberto/fechado: aberto por padrão, só booleano por pasta entra', () => {
  assert.equal(folderOpen({}, 'Listas'), true);
  assert.equal(folderOpen({'Listas': false}, 'Listas'), false);
  assert.equal(folderOpen({'Listas': true}, 'Listas'), true);
  assert.deepEqual(normalizeMaterialFolders({'Listas': false, 'Cap 3': true, '': true, 'X': 'não'}), {'Listas': false, 'Cap 3': true});
  assert.deepEqual(normalizeMaterialFolders(JSON.parse('{"__proto__": true, "Listas": false}')), {'Listas': false}, '__proto__ do arquivo não vira pasta nem mexe no protótipo');
  assert.deepEqual(normalizeMaterialFolders(null), {});
  assert.deepEqual(normalizeMaterialFolders([]), {});
  const many = Object.fromEntries(Array.from({length: FOLDER_LIMIT + 10}, (_, n) => [`Pasta ${n}`, false]));
  assert.equal(Object.keys(normalizeMaterialFolders(many)).length, FOLDER_LIMIT, 'o teto só defende contra arquivo editado à mão');
  assert.equal(normalizeFolder('\\Listas\\2024\\'), 'Listas/2024', 'a barra do Windows vira a mesma do título');
  assert.equal(normalizeFolder('../fuga'), 'fuga', 'segmento de subida não entra no título');
});

test('materialActive: o material em uso quando está à vista; senão a primeira linha', () => {
  const rows = materialRows(library, {folders: {'Cap 3 - Derivadas': false}});
  assert.equal(materialActive(rows, entry('Apostila 10.pdf').path), 1, 'acha o PDF da raiz');
  assert.equal(materialActive(rows, entry('Aula 2.pdf', 'Cap 3 - Derivadas').path), 0, 'PDF de grupo fechado não está à vista: cai na primeira linha');
  assert.equal(materialActive([], '/nada.pdf'), -1);
});

/* ---- a pasta relativa que o host entrega ao seletor ---- */

test('pdfFolderOf: subpasta relativa à raiz varrida; raiz e Materiais da Mesa ficam sem grupo', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-material-folder-'));
  try {
    const course = path.join(root, 'Courses', 'Calc');
    const sources = path.join(course, 'Sources');
    const external = path.join(root, 'pdfs');
    const write = (file) => {
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.writeFileSync(file, '%PDF-1.4\nteste');
    };
    write(path.join(sources, 'Apostila.pdf'));
    const cap3 = path.join(sources, 'Cap 3 - Derivadas', 'Aula 2.pdf');
    write(cap3);
    const nested = path.join(sources, 'Listas', '2024', 'Lista 10.pdf');
    write(nested);
    const generated = path.join(course, 'Materiais da Mesa', 'Resumo.pdf');
    write(generated);
    const outside = path.join(external, 'Extras', 'Extra.pdf');
    write(outside);
    fs.writeFileSync(path.join(course, '_state.md'), `---\nsource_roots:\n  - ${external}\n---\n`);

    assert.equal(pdfFolderOf(course, path.join(sources, 'Apostila.pdf')), '', 'PDF na raiz da pasta varrida não tem grupo');
    assert.equal(pdfFolderOf(course, cap3), 'Cap 3 - Derivadas');
    assert.equal(pdfFolderOf(course, nested), 'Listas/2024', 'pasta aninhada leva o caminho relativo inteiro');
    assert.equal(pdfFolderOf(course, generated), '', 'material gerado pela Mesa fica na raiz, não vira capítulo');
    assert.equal(pdfFolderOf(course, outside), 'Extras', 'cada source_root tem a própria raiz');
    assert.equal(pdfFolderOf(course, path.join(root, 'fora.pdf')), '', 'arquivo fora das raízes não inventa grupo');

    const entries = withPdfFolders(course, courseLibrary(course));
    assert.deepEqual(entries.map((item) => [item.name, item.folder]), [
      ['Apostila.pdf', ''],
      ['Aula 2.pdf', 'Cap 3 - Derivadas'],
      ['Extra.pdf', 'Extras'],
      ['Lista 10.pdf', 'Listas/2024'],
      ['Resumo.pdf', ''],
    ], 'a biblioteca real da matéria chega ao seletor com a pasta de cada PDF');
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});
