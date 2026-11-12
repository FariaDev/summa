/* Teto de SUGESTÕES de `salvar_nota` por turno do aluno (auditoria de
   segurança): 3 sugestões por conversa e turno passam; a quarta é recusada
   antes de criar cartão. O clique "Guardar" do aluno NÃO passa por teto: ele
   grava qualquer sugestão pendente, de qualquer turno. Os dois motores chegam
   ao mesmo teto — Claude direto (`cardHost.suggestNote`) e ponte do OpenCode
   (`suggestNoteFromGrant`) —, e o host avisa o turno novo a cada mensagem
   aceita do aluno (`studyServices.newStudentTurn`). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {enText, ptMatches, ptText} from './pt-text.mjs';

const require = createRequire(import.meta.url);
const {createStudyServices} = require('../src/study-data/services.cjs');
const {createNoteTurnCap} = require('../src/study-data/note-turn-cap.cjs');
const {createCardHost} = require('../card-host.cjs');

const newRuntime = () => mkdtempSync(join(tmpdir(), 'mesa-note-turn-'));
const SESSION_A = '/principal/a.jsonl';
const SESSION_B = '/principal/b.jsonl';

/* Matéria real com o host do main: os dois caminhos de sugestão, o clique
   Guardar por IPC e o turno do aluno, todos sobre o MESMO teto (como no app). */
function studyStack() {
  const runtime = newRuntime();
  const course = join(runtime, 'curso');
  mkdirSync(course, {recursive: true});
  /* Um PDF autorizado qualquer, para a matéria existir na lista. */
  writeFileSync(join(course, 'Aula.pdf'), '%PDF-1.4 sintético\n');
  const state = {conversation: SESSION_A};
  const noteTurns = createNoteTurnCap();
  const services = createStudyServices({
    runtime: () => runtime,
    courses: () => [{id: 'curso', name: 'Curso', path: course}],
    scope: () => ({courseId: 'curso', conversation: state.conversation, freeSessionId: ''}),
    allowed: () => new Set(),
    persist() {},
    noteTurns,
  });
  const handlers = new Map();
  const host = createCardHost({
    ipcMain: {handle: (channel, handler) => handlers.set(channel, handler)},
    runtime,
    live: {get session() { return state.conversation; }},
    emit() {},
    sendText: async () => ({sent: true}),
    writeNote: (payload) => services.noteSave(null, payload),
    scope: () => ({courseId: 'curso', conversation: state.conversation, freeSessionId: ''}),
    freeId: 'mesa-free',
    noteTurns,
  });
  const suggestClaude = (n) => host.suggestNote(
    {conversationId: state.conversation},
    {titulo: `Claude ${n}`, conteudo: `# direto ${n}`},
  );
  const suggestOpenCode = (n) => host.suggestNoteFromGrant(
    {courseId: 'curso', session: state.conversation, freeSessionId: ''},
    {titulo: `OpenCode ${n}`, conteudo: `# ponte ${n}`},
  );
  const save = (id) => handlers.get('note-card-save')({}, {id});
  const notes = () => (existsSync(join(course, 'Notas')) ? readdirSync(join(course, 'Notas')) : []);
  return {
    runtime, course, state, services, host, suggestClaude, suggestOpenCode, save, notes,
    list: () => host.list(),
    switchTo: (conversation) => { state.conversation = conversation; },
    done: () => rmSync(runtime, {recursive: true, force: true}),
  };
}

test('Claude direto: 4 sugestões no mesmo turno viram 3 cartões; a 4ª recusa', () => {
  const stack = studyStack();
  try {
    for (let n = 1; n <= 3; n += 1) stack.suggestClaude(n);
    assert.equal(stack.list().length, 3, 'as 3 sugestões viram cartões');
    assert.throws(() => stack.suggestClaude(4), ptMatches(/Limite de 3 notas por turno/));
    assert.equal(stack.list().length, 3, 'a recusada não cria cartão');
    assert.deepEqual(stack.notes(), [], 'sugerir não grava em Notas/');
  } finally {
    stack.done();
  }
});

test('ponte do OpenCode: 4 sugestões no mesmo turno viram 3 cartões; a 4ª recusa', () => {
  const stack = studyStack();
  try {
    for (let n = 1; n <= 3; n += 1) stack.suggestOpenCode(n);
    assert.equal(stack.list().length, 3, 'as 3 sugestões viram cartões');
    assert.throws(() => stack.suggestOpenCode(4), ptMatches(/Limite de 3 notas por turno/));
    assert.equal(stack.list().length, 3, 'a recusada não cria cartão');
    assert.deepEqual(stack.notes(), [], 'sugerir não grava em Notas/');
  } finally {
    stack.done();
  }
});

test('as duas rotas dividem o mesmo teto no turno', () => {
  const stack = studyStack();
  try {
    stack.suggestClaude(1);
    stack.suggestClaude(2);
    stack.suggestOpenCode(3);
    assert.equal(stack.list().length, 3);
    assert.throws(() => stack.suggestOpenCode(4), ptMatches(/Limite de 3 notas por turno/));
    assert.throws(() => stack.suggestClaude(5), ptMatches(/Limite de 3 notas por turno/));
    assert.equal(stack.list().length, 3, 'nenhuma das recusadas cria cartão');
  } finally {
    stack.done();
  }
});

test('turno novo libera mais 3 sugestões', () => {
  const stack = studyStack();
  try {
    for (let n = 1; n <= 3; n += 1) stack.suggestClaude(n);
    assert.throws(() => stack.suggestClaude(4), ptMatches(/Limite de 3 notas por turno/));
    /* Cada mensagem aceita do aluno é um turno; cancelamento não chama. */
    stack.services.newStudentTurn();
    for (let n = 1; n <= 3; n += 1) stack.suggestOpenCode(n);
    assert.equal(stack.list().length, 6, 'o turno novo libera o teto cheio');
    assert.throws(() => stack.suggestOpenCode(4), ptMatches(/Limite de 3 notas por turno/));
  } finally {
    stack.done();
  }
});

test('o clique Guardar não tem teto: as 3 do turno e a 4ª de outro turno são guardadas', async () => {
  const stack = studyStack();
  try {
    const ids = [];
    for (let n = 1; n <= 3; n += 1) ids.push(stack.suggestClaude(n).id);
    stack.services.newStudentTurn();
    ids.push(stack.suggestOpenCode(4).id);
    assert.equal(stack.list().length, 4);
    assert.deepEqual(stack.notes(), [], 'nada foi gravado antes do clique');
    for (const id of ids) assert.equal((await stack.save(id)).status, 'saved');
    assert.deepEqual(stack.notes().sort(), ['Claude 1.md', 'Claude 2.md', 'Claude 3.md', 'OpenCode 4.md']);
  } finally {
    stack.done();
  }
});

test('duas conversas diferentes têm tetos separados no mesmo turno', () => {
  const stack = studyStack();
  try {
    for (let n = 1; n <= 3; n += 1) stack.suggestClaude(n);
    assert.throws(() => stack.suggestClaude(4), ptMatches(/Limite de 3 notas/));
    stack.switchTo(SESSION_B);
    for (let n = 1; n <= 3; n += 1) stack.suggestOpenCode(n);
    assert.equal(stack.list().length, 3, 'a conversa nova tem o teto cheio');
    assert.throws(() => stack.suggestOpenCode(4), ptMatches(/Limite de 3 notas/));
    stack.switchTo(SESSION_A);
    assert.equal(stack.list().length, 3);
    assert.throws(() => stack.suggestClaude(5), ptMatches(/Limite de 3 notas/), 'a conversa antiga continua no teto');
  } finally {
    stack.done();
  }
});

test('sugestão inválida não consome o teto; o Guardar ainda recusa sessão trocada', async () => {
  const stack = studyStack();
  try {
    assert.throws(
      () => stack.host.suggestNote({conversationId: SESSION_A}, {titulo: '', conteudo: '# x'}),
      ptMatches(/Pedido de nota inválido/),
    );
    for (let n = 1; n <= 3; n += 1) stack.suggestClaude(n);
    assert.throws(() => stack.suggestClaude(4), ptMatches(/Limite de 3 notas/));
    assert.throws(
      () => stack.services.noteSave({courseId: 'outra'}, {titulo: 'X', conteudo: '# x'}),
      ptMatches(/sessão mudou/i),
    );
  } finally {
    stack.done();
  }
});

test('a recusa manda o tutor contar ao aluno o que não foi sugerido, em pt-BR e en', () => {
  const stack = studyStack();
  try {
    for (let n = 1; n <= 3; n += 1) stack.suggestClaude(n);
    let raw = '';
    try {
      stack.suggestClaude(4);
    } catch (error) {
      raw = String(error.message);
    }
    assert.match(ptText(raw), /esta nota não foi salva.*Diga ao aluno o que ficou sem salvar/s);
    assert.match(enText(raw), /this note was not saved.*Tell the student what was left unsaved/s);
  } finally {
    stack.done();
  }
});
