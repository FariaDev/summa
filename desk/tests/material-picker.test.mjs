/* O seletor de material (#74), a parte pura: raiz da pasta da matéria no topo,
   cada subpasta como nó dentro da pasta mãe, em ordem natural (pt-BR,
   numérica), busca pelo nome do arquivo mostrando o caminho de cada achado e o
   estado aberto/fechado por pasta. Inclui a pasta relativa que o host entrega
   (`pdfFolderOf`). */
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

test('raiz no topo e cada subpasta aninhada na pasta mãe, em ordem natural de nome', () => {
  const rows = materialRows(library);
  assert.deepEqual(rows.slice(0, 2).map((row) => row.kind === 'file' && row.entry.name), ['Apostila 2.pdf', 'Apostila 10.pdf'], 'os PDFs da raiz vêm primeiro, sem grupo, na ordem numérica');
  assert.deepEqual(rows.filter((row) => row.kind === 'group').map((row) => [row.label, row.folder, row.depth]), [
    ['Cap 3 - Derivadas', 'Cap 3 - Derivadas', 0],
    ['Cap 10 - Integrais', 'Cap 10 - Integrais', 0],
    ['Listas', 'Listas', 0],
    ['2024', 'Listas/2024', 1],
  ], 'o título é o último pedaço do caminho, Cap 3 antes de Cap 10, e 2024 dentro de Listas');
  const cap3 = rows.find((row) => row.kind === 'group' && row.folder === 'Cap 3 - Derivadas');
  assert.deepEqual({open: cap3.open, count: cap3.count}, {open: true, count: 2}, 'o grupo abre por padrão e conta os arquivos');
  assert.deepEqual(files(rows), ['Apostila 2.pdf', 'Apostila 10.pdf', 'Aula 2.pdf', 'Aula 10.pdf', 'Cap 10 - Integrais.pdf', 'Lista 2.pdf', 'Lista 10.pdf', 'Lista 1.pdf'], 'subpastas antes dos arquivos da pasta e ordem natural dentro de cada uma');
});

test('árvore: o nó da subpasta vem depois do nó da pasta mãe e o arquivo recua um nível', () => {
  const rows = materialRows(library);
  const listas = rows.findIndex((row) => row.kind === 'group' && row.folder === 'Listas');
  const year = rows.findIndex((row) => row.kind === 'group' && row.folder === 'Listas/2024');
  assert.ok(listas >= 0 && year > listas, '2024 vem depois de Listas, dentro dele');
  const lista1 = rows.find((row) => row.kind === 'file' && row.entry.name === 'Lista 1.pdf');
  const lista2 = rows.find((row) => row.kind === 'file' && row.entry.name === 'Lista 2.pdf');
  assert.deepEqual([lista1.depth, lista2.depth], [1, 2], 'o arquivo da pasta recua um nível e o da subpasta, dois');
});

test('pasta intermediária sem arquivo próprio aparece como nó, com a contagem dos descendentes', () => {
  const rows = materialRows([
    entry('Aula.pdf', 'Semestre 1/Cap 3'),
    entry('Lista.pdf', 'Semestre 1/Cap 3'),
    entry('Extra.pdf', 'Semestre 1/Cap 10'),
  ]);
  assert.deepEqual(rows.filter((row) => row.kind === 'group').map((row) => [row.label, row.folder, row.depth, row.count]), [
    ['Semestre 1', 'Semestre 1', 0, 3],
    ['Cap 3', 'Semestre 1/Cap 3', 1, 2],
    ['Cap 10', 'Semestre 1/Cap 10', 1, 1],
  ], 'Semestre 1 nasce só pelos descendentes e soma os arquivos de todas as subpastas');
});

test('ordem dentro da pasta: subpastas antes dos arquivos, em ordem natural (Cap 3 antes de Cap 10)', () => {
  const rows = materialRows([
    entry('Arquivo.pdf', 'Pasta'),
    entry('Cap 10.pdf', 'Pasta/Cap 10'),
    entry('Cap 3.pdf', 'Pasta/Cap 3'),
  ]);
  assert.deepEqual(rows.filter((row) => row.kind === 'group').map((row) => row.label), ['Pasta', 'Cap 3', 'Cap 10'], 'subpastas em ordem natural');
  assert.deepEqual(rows.filter((row) => row.kind === 'file').map((row) => [row.entry.name, row.depth]), [
    ['Cap 3.pdf', 2],
    ['Cap 10.pdf', 2],
    ['Arquivo.pdf', 1],
  ], 'as subpastas vêm antes do arquivo da pasta, e o arquivo da pasta fica um nível acima');
});

test('matéria sem subpastas: a lista é a de hoje, sem grupo', () => {
  const flat = [entry('Apostila 10.pdf'), entry('Apostila 2.pdf'), entry('Lista.pdf')];
  const rows = materialRows(flat);
  assert.deepEqual(labels(rows), []);
  assert.deepEqual(files(rows), ['Apostila 2.pdf', 'Apostila 10.pdf', 'Lista.pdf']);
});

test('busca: filtra pelo nome do arquivo, sem caixa nem acento, e mostra o caminho de cada achado', () => {
  const rows = materialRows(library, {folders: {'Listas/2024': false}, query: 'LISTA'});
  assert.deepEqual(labels(rows), ['Listas', '2024'], 'o grupo sem achado some e os achados ficam com os ancestrais');
  assert.deepEqual(files(rows), ['Lista 2.pdf', 'Lista 10.pdf', 'Lista 1.pdf']);
  assert.ok(rows.filter((row) => row.kind === 'group').every((row) => row.open), 'com busca ativa os grupos aparecem abertos mesmo fechados no estado');
  assert.deepEqual(files(materialRows(library, {query: 'aula'})), ['Aula 2.pdf', 'Aula 10.pdf'], 'a busca acha sem caixa');
  assert.equal(matchesMaterialQuery('Ética.pdf', 'etica'), true, 'sem acento também');
  assert.deepEqual(labels(materialRows(library, {query: 'cap 3'})), [], 'a busca é pelo NOME do arquivo, não pelo título do grupo');
  assert.ok(matchesMaterialQuery('Aula 3 — Derivadas.pdf', 'derivadas'));
  assert.equal(matchesMaterialQuery('Aula 3.pdf', ''), true, 'busca vazia mostra tudo');
});

test('busca: força abertos os ancestrais do achado e esconde pasta sem achado em descendente', () => {
  const rows = materialRows(library, {folders: {'Listas': false, 'Listas/2024': false}, query: 'lista 2'});
  assert.deepEqual(rows.filter((row) => row.kind === 'group').map((row) => [row.folder, row.open, row.depth, row.count]), [
    ['Listas', true, 0, 1],
    ['Listas/2024', true, 1, 1],
  ], 'Listas abre mesmo fechado no estado, e a contagem é a dos achados');
  assert.deepEqual(files(rows), ['Lista 2.pdf']);
  assert.equal(rows.some((row) => row.kind === 'group' && row.folder === 'Cap 3 - Derivadas'), false, 'pasta sem achado em descendente não aparece');
});

test('busca vazia respeita o estado fechado e o grupo fechado não mostra os arquivos', () => {
  const rows = materialRows(library, {folders: {'Cap 3 - Derivadas': false}});
  const cap3 = rows.find((row) => row.kind === 'group' && row.folder === 'Cap 3 - Derivadas');
  assert.equal(cap3.open, false);
  assert.equal(files(rows).includes('Aula 2.pdf'), false, 'grupo fechado esconde os arquivos');
  assert.deepEqual(labels(rows), ['Cap 3 - Derivadas', 'Cap 10 - Integrais', 'Listas', '2024'], 'os outros grupos continuam');
});

test('grupo fechado esconde as subpastas e os arquivos abaixo dele', () => {
  const rows = materialRows(library, {folders: {'Listas': false}});
  assert.deepEqual(labels(rows), ['Cap 3 - Derivadas', 'Cap 10 - Integrais', 'Listas'], 'o nó 2024 some junto com os arquivos');
  assert.equal(files(rows).some((name) => name.startsWith('Lista')), false);
  const listas = rows.find((row) => row.kind === 'group' && row.folder === 'Listas');
  assert.equal(listas.count, 3, 'a contagem continua sendo a da pasta inteira');
  const onlyYearClosed = materialRows(library, {folders: {'Listas/2024': false}});
  assert.deepEqual(files(onlyYearClosed).filter((name) => name.startsWith('Lista')), ['Lista 1.pdf'], 'fechar o filho esconde só o que está dentro dele');
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
