import test from 'node:test';
import assert from 'node:assert/strict';
import {groupNotebooks} from '../src/notebooks.mjs';
import {formatNotebookItem, notebookWhen, notebookCourseColor, notebookFormatLabel} from '../src/notebooks-format.mjs';
import {formatDate} from '../src/ui-text.mjs';
import {createI18n} from '../src/i18n.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

/* Vista da biblioteca de cadernos (#133, parte da vista): a formatação e o
   agrupamento do módulo `notebooks.mjs` — sem DOM, sem Electron, sem o host.
   A matéria da aba atual abre primeiro; as outras vêm agrupadas abaixo, na
   ordem em que aparecem (o host já manda mais recente primeiro); a lista
   vazia não tem grupo nenhum (a vista mostra o texto de vazio). */

const NOW = new Date(2026, 10, 6, 12, 0, 0).getTime();
const item = (courseId, name, extra = {}) => ({
  courseId,
  name,
  path: `/vault/${courseId}/${name}`,
  folder: '',
  mtimeMs: NOW - 1000,
  ...extra,
});

test('agrupa por matéria com a da aba atual primeiro e as outras em ordem de aparição', () => {
  const groups = groupNotebooks([
    item('fis', 'ondas.xopp', {mtimeMs: NOW - 60_000}),
    item('calc', 'aula-nova.xopp', {mtimeMs: NOW - 1_000}),
    item('fis', 'ondas-antigas.xopp', {mtimeMs: NOW - 120_000}),
    item('calc', 'aula-antiga.xopp', {mtimeMs: NOW - 2_000}),
    item('qui', 'tabela.xopp', {mtimeMs: NOW - 3_000}),
  ], 'calc');
  assert.deepEqual(groups.map((group) => group.courseId), ['calc', 'fis', 'qui']);
  assert.deepEqual(groups[0].items.map((entry) => entry.name), ['aula-nova.xopp', 'aula-antiga.xopp'], 'dentro da matéria vale a ordem do host (mais recente primeiro)');
  assert.deepEqual(groups[1].items.map((entry) => entry.name), ['ondas.xopp', 'ondas-antigas.xopp']);
  assert.deepEqual(groups[2].items.map((entry) => entry.name), ['tabela.xopp']);
});

test('matéria atual sem caderno não ganha grupo e sem matéria atual vale a ordem de aparição', () => {
  const items = [item('fis', 'ondas.xopp'), item('calc', 'aula.xopp')];
  assert.deepEqual(groupNotebooks(items, 'qui').map((group) => group.courseId), ['fis', 'calc']);
  assert.deepEqual(groupNotebooks(items, '').map((group) => group.courseId), ['fis', 'calc']);
});

test('lista vazia não tem grupo nenhum', () => {
  assert.deepEqual(groupNotebooks([], 'calc'), []);
});

test('item inválido (sem nome/caminho/matéria) não vira grupo', () => {
  const groups = groupNotebooks([
    {courseId: 'calc', name: '', path: '', folder: '', mtimeMs: NOW},
    null,
    item('calc', 'aula.xopp'),
  ], 'calc');
  assert.deepEqual(groups.map((group) => group.items.map((entry) => entry.name)), [['aula.xopp']]);
});

test('formata o item: nome, pasta relativa (se houver) e data curta', () => {
  const formatted = formatNotebookItem(item('calc', 'aula-nova.xopp', {folder: 'sub', mtimeMs: NOW - 60_000}), NOW);
  assert.equal(formatted.name, 'aula-nova.xopp');
  assert.equal(formatted.courseId, 'calc');
  assert.equal(formatted.path, '/vault/calc/aula-nova.xopp');
  assert.match(formatted.meta, /^sub · /, `a pasta vem antes da data: ${formatted.meta}`);
  assert.equal(formatNotebookItem(item('calc', 'aula.xopp', {folder: ''}), NOW).meta.includes('·'), false, 'na raiz da matéria a meta é só a data');
  assert.match(formatNotebookItem(item('calc', 'aula.xopp', {mtimeMs: 0}), NOW).meta, /^$/, 'sem mtime a meta fica vazia, nunca "undefined"');
});

test('o ícone usa a cor da matéria quando o host manda uma e cai no cinza neutro sem ela', () => {
  /* A Mesa não guarda cor por matéria hoje (o config normaliza a matéria em
     id/nome/pasta): o normal é o vazio, que a vista pinta com --muted. O
     helper só aceita cor válida de CSS — nada de texto do config virando
     estilo quebrado. */
  assert.equal(notebookCourseColor({color: '#c02667'}), '#c02667');
  assert.equal(notebookCourseColor({color: '  #0f7b55  '}), '#0f7b55');
  assert.equal(notebookCourseColor({color: 'var(--accent-text)'}), 'var(--accent-text)');
  assert.equal(notebookCourseColor({color: 'violet'}), 'violet');
  assert.equal(notebookCourseColor({}), '');
  assert.equal(notebookCourseColor({color: '   '}), '');
  assert.equal(notebookCourseColor({color: 42}), '');
  assert.equal(notebookCourseColor({color: '#12<script>'}), '');
  assert.equal(notebookCourseColor(null), '');
});

test('a etiqueta de formato só aparece quando a lista já conhece o formato', () => {
  assert.equal(notebookFormatLabel('A4'), 'A4');
  assert.equal(notebookFormatLabel(' a4 '), 'A4');
  assert.equal(notebookFormatLabel('Carta'), 'Carta', 'Carta fica como está na tabela, sem maiúsculas forçadas (#184)');
  assert.equal(notebookFormatLabel('CARTA'), 'Carta');
  assert.equal(notebookFormatLabel('Ofício'), 'Ofício', 'Ofício tem acento e vira etiqueta (#184)');
  assert.equal(notebookFormatLabel('OFÍCIO'), 'Ofício');
  assert.equal(notebookFormatLabel('Tabloide'), 'Tabloide');
  assert.equal(notebookFormatLabel(''), '');
  assert.equal(notebookFormatLabel(null), '');
  assert.equal(notebookFormatLabel('A4<script>'), '');
  assert.equal(notebookFormatLabel('Ofício!'), '');
  assert.equal(notebookFormatLabel('A'.repeat(9)), '', 'teto de tamanho recusa rótulo comprido');
  assert.equal(formatNotebookItem(item('calc', 'aula.xopp', {format: 'a4'}), NOW).format, 'A4');
  assert.equal(formatNotebookItem(item('calc', 'aula.xopp'), NOW).format, '', 'sem formato conhecido, nada de etiqueta');
});

test('em inglês a etiqueta segue o catálogo: Letter, Legal e Tabloid (#184)', () => {
  const english = createI18n({catalogs: {'pt-BR': ptBR, en}, language: 'en'});
  const translate = (key) => english.t(key);
  assert.equal(notebookFormatLabel('Carta', translate), 'Letter');
  assert.equal(notebookFormatLabel('Ofício', translate), 'Legal');
  assert.equal(notebookFormatLabel('Tabloide', translate), 'Tabloid');
  assert.equal(notebookFormatLabel('A4', translate), 'A4', 'a série A é igual nos dois idiomas');
  assert.equal(formatNotebookItem(item('calc', 'aula.xopp', {format: 'Carta'}), NOW, translate).format, 'Letter');
});

test('a data curta é a da lista de sessões: hoje é hora, outro dia é dia/mês e hora', () => {
  /* Compara com o mesmo formatador da vista (ui-text.formatDate): a forma
     exata ("04/11, 12:00" no pt-BR, com AM/PM no inglês) é do idioma da
     interface, não do teste — o teste prende as opções e o dia, não a
     língua. */
  assert.equal(notebookWhen(NOW - 60_000, NOW), formatDate(new Date(NOW - 60_000), {hour: '2-digit', minute: '2-digit'}));
  assert.equal(notebookWhen(NOW - 2 * 86_400_000, NOW), formatDate(new Date(NOW - 2 * 86_400_000), {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}));
  assert.equal(notebookWhen(0, NOW), '');
});
