/* Nota sugerida pelo tutor (#139): a ferramenta NÃO grava; o cartão nasce
   pendente e só o clique "Guardar" chega ao funil de `Notas/` (que revalida
   caminho e conteúdo). Descartar não grava, o estado sobrevive no disco e a
   mesma sugestão nunca grava duas vezes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {ptMatches} from './pt-text.mjs';
import {createNoteTool} from '../src/agents/note-tool.cjs';
import {noteTool} from '../src/extensions/mesa-mcp/tools.mjs';
import {noteText} from '../src/extensions/mesa-notes/guide.mjs';

const require = createRequire(import.meta.url);
const {createCardSession} = require('../card-session.cjs');
const cardStore = require('../card-store.cjs');
const {createStudyServices} = require('../src/study-data/services.cjs');

const newRuntime = () => mkdtempSync(join(tmpdir(), 'mesa-note-suggestion-'));
const noteStatus = (cards, id) => cards.find((card) => card.id === id)?.status;

/* Matéria real com o funil de gravação do main (o mesmo dos dois motores). */
function studyStack() {
  const runtime = newRuntime();
  const course = join(runtime, 'curso');
  mkdirSync(course, {recursive: true});
  writeFileSync(join(course, 'Aula.pdf'), '%PDF-1.4 sintético\n');
  const state = {conversation: '/runtime/opencode-sessao.json'};
  const services = createStudyServices({
    runtime: () => runtime,
    courses: () => [{id: 'curso', name: 'Curso', path: course}],
    scope: () => ({courseId: 'curso', conversation: state.conversation, freeSessionId: ''}),
    allowed: () => new Set(),
    persist() {},
  });
  const cards = createCardSession({
    runtime,
    conversation: () => state.conversation,
    sendText: async () => ({sent: true}),
    writeNote: (payload) => services.noteSave(null, payload),
  });
  return {
    runtime, course, state, services, cards,
    notes: () => (existsSync(join(course, 'Notas')) ? require('node:fs').readdirSync(join(course, 'Notas')) : []),
    list: () => cardStore.listCards(runtime, state.conversation),
    done: () => rmSync(runtime, {recursive: true, force: true}),
  };
}

test('a sugestão não cria arquivo; Guardar cria; Descartar não cria', async () => {
  const stack = studyStack();
  try {
    const pending = stack.cards.suggestNote({titulo: 'Derivadas', conteudo: '# primeira'});
    assert.equal(pending.suggested, true);
    assert.equal(pending.title, 'Derivadas');
    assert.deepEqual(stack.notes(), [], 'sugerir não toca em Notas/');
    assert.equal(noteStatus(stack.list(), pending.id), 'pending');

    const saved = await stack.cards.saveNote({id: pending.id});
    assert.equal(saved.status, 'saved');
    assert.equal(saved.saved.rel, 'Notas/Derivadas.md');
    assert.equal(readFileSync(join(stack.course, 'Notas', 'Derivadas.md'), 'utf8'), '# primeira');
    assert.equal(noteStatus(stack.list(), pending.id), 'saved', 'o estado guardado sobrevive no disco');

    const discarded = stack.cards.suggestNote({titulo: 'Limites', conteudo: '# outra'});
    const dismissed = stack.cards.dismiss({id: discarded.id});
    assert.equal(dismissed.status, 'dismissed');
    assert.deepEqual(stack.notes(), ['Derivadas.md'], 'descartar não cria arquivo');
    assert.equal(noteStatus(stack.list(), discarded.id), 'dismissed');
  } finally {
    stack.done();
  }
});

test('a mesma sugestão não grava duas vezes (clique repetido volta como está)', async () => {
  const stack = studyStack();
  try {
    const card = stack.cards.suggestNote({titulo: 'Única', conteudo: '# uma'});
    await stack.cards.saveNote({id: card.id});
    const again = await stack.cards.saveNote({id: card.id});
    assert.equal(again.status, 'saved');
    assert.deepEqual(stack.notes(), ['Única.md']);
  } finally {
    stack.done();
  }
});

test('o main recusa de novo título que sai de Notas/ e não grava fora da matéria', async () => {
  const stack = studyStack();
  try {
    /* Um arquivo de cartão editado à mão (o renderer nunca manda título): o
       clique ainda passa pela validação do funil de gravação no main. */
    const file = cardStore.fileOf(stack.runtime, stack.state.conversation);
    mkdirSync(join(stack.runtime, 'cards'), {recursive: true});
    const id = 'card-11111111-1111-4111-8111-111111111111';
    writeFileSync(file, JSON.stringify({
      schemaVersion: 1,
      session: stack.state.conversation,
      cards: [{
        schemaVersion: 1, id, kind: 'note', session: stack.state.conversation, createdAt: Date.now(),
        state: {$: 'NoteStatus.Pending'}, title: '../../fora', content: '# escapa',
      }],
    }));
    await assert.rejects(stack.cards.saveNote({id}), ptMatches(/Título de nota inválido/));
    assert.equal(existsSync(join(stack.course, 'fora.md')), false);
    assert.deepEqual(stack.notes(), []);
  } finally {
    stack.done();
  }
});

test('nota que não sobrescreve: nome tomado recebe -2 e o original fica intacto', async () => {
  const stack = studyStack();
  try {
    const first = stack.cards.suggestNote({titulo: 'Derivadas', conteudo: '# primeira'});
    await stack.cards.saveNote({id: first.id});
    const second = stack.cards.suggestNote({titulo: 'Derivadas', conteudo: '# segunda'});
    const saved = await stack.cards.saveNote({id: second.id});
    assert.equal(saved.saved.rel, 'Notas/Derivadas-2.md');
    assert.equal(readFileSync(join(stack.course, 'Notas', 'Derivadas.md'), 'utf8'), '# primeira');
    assert.equal(readFileSync(join(stack.course, 'Notas', 'Derivadas-2.md'), 'utf8'), '# segunda');
  } finally {
    stack.done();
  }
});

test('Notas/ que virou link é recusada no clique, sem escrever fora da raiz', async () => {
  const stack = studyStack();
  const outside = newRuntime();
  try {
    symlinkSync(outside, join(stack.course, 'Notas'));
    const card = stack.cards.suggestNote({titulo: 'Limites', conteudo: '# a'});
    await assert.rejects(stack.cards.saveNote({id: card.id}), ptMatches(/pasta da matéria não está disponível/));
    assert.equal(existsSync(join(outside, 'Limites.md')), false);
    assert.equal(noteStatus(stack.list(), card.id), 'pending', 'a falha não confirma a gravação');
  } finally {
    rmSync(outside, {recursive: true, force: true});
    stack.done();
  }
});

test('a nota descartada não pode ser guardada depois', async () => {
  const stack = studyStack();
  try {
    const card = stack.cards.suggestNote({titulo: 'Descartada', conteudo: '# x'});
    stack.cards.dismiss({id: card.id});
    await assert.rejects(stack.cards.saveNote({id: card.id}), ptMatches(/descartada/));
    assert.deepEqual(stack.notes(), []);
  } finally {
    stack.done();
  }
});

test('a ferramenta do Claude devolve "sugerida", não "salva"', async () => {
  const calls = [];
  const tool = await createNoteTool(async (args) => {
    calls.push(args);
    return {suggested: true, id: 'card-22222222-2222-4222-8222-222222222222', title: 'Limites'};
  });
  const result = await tool.handler({titulo: 'Limites', conteudo: '# a'}, {});
  assert.deepEqual(calls, [{titulo: 'Limites', conteudo: '# a'}]);
  const shown = result.content[0].text;
  assert.match(shown, /sugerida ao aluno/);
  assert.match(shown, /clicar em Guardar/);
  assert.doesNotMatch(shown, /salva em Notas\//);
});

test('a ferramenta do OpenCode (MCP) também só sugere', async () => {
  const grant = {url: 'http://127.0.0.1:9/pdf', token: 'm'};
  const seen = [];
  const tool = noteTool({grant, suggest: async (bridge, args) => {
    seen.push({bridge, args});
    return {suggested: true, id: 'card-33333333-3333-4333-8333-333333333333', title: 'Limites'};
  }});
  const result = await tool.call({titulo: 'Limites', conteudo: '# a'});
  assert.deepEqual(seen, [{bridge: grant, args: {titulo: 'Limites', conteudo: '# a'}}]);
  assert.match(result.content[0].text, /sugerida ao aluno/);
  assert.equal(result.isError, undefined);
});

test('noteText não afirma que a nota foi salva', () => {
  const text = noteText({suggested: true, title: 'Limites'});
  assert.match(text, /sugerida ao aluno/);
  assert.match(text, /não diga que foi salva/);
});
