import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {
  PLAN_LIMITS,
  addTask,
  currentTaskId,
  editTask,
  emptyStudyPlan,
  linkTask,
  loadStudyPlan,
  moveTask,
  removeEmptyTask,
  removeTaskAt,
  sanitizeStudyPlan,
  setNotes,
  setStudyPlan,
  setTaskDone,
  studyPlanSnapshot,
  unlinkTask,
} from '../src/study/study-plan.mjs';

/* Plano de estudo da matéria (#110): as regras do módulo de estado. Cada
   operação devolve um plano novo; nenhuma muda o plano que recebeu. */
const require = createRequire(import.meta.url);
const {sanitizeCourseState} = require('../desk-state-sanitize.cjs');

/** Plano com tarefas nesta ordem; `done` marca as que já foram feitas. @param {string[]} ids @param {string[]} [done] */
function planOf(ids, done = []) {
  return {
    tasks: ids.map((id) => ({id, text: `texto ${id}`, done: done.includes(id), pdf: '', page: 0})),
    notes: '',
  };
}

test('o agora é a primeira tarefa não marcada, na ordem da lista', () => {
  assert.equal(currentTaskId(emptyStudyPlan()), '');
  assert.equal(currentTaskId(planOf(['a', 'b', 'c'])), 'a');
  assert.equal(currentTaskId(planOf(['a', 'b', 'c'], ['a'])), 'b');
  assert.equal(currentTaskId(planOf(['a', 'b'], ['a', 'b'])), '', 'tudo marcado: sem agora');
});

test('marcar a tarefa do agora passa o agora para a próxima', () => {
  const plan = planOf(['a', 'b', 'c']);
  const next = setTaskDone(plan, 'a', true);
  assert.equal(currentTaskId(next), 'b');
  assert.equal(next.tasks[0].done, true);
  assert.equal(currentTaskId(setTaskDone(next, 'a', false)), 'a', 'desmarcar devolve o agora');
});

test('marcar uma tarefa que não é a do agora não muda o agora', () => {
  const next = setTaskDone(planOf(['a', 'b', 'c']), 'c', true);
  assert.equal(currentTaskId(next), 'a');
});

test('Enter cria a tarefa logo depois da atual; sem afterId vai para o fim', () => {
  const plan = planOf(['a', 'c']);
  assert.deepEqual(addTask(plan, {afterId: 'a', id: 'b'}).tasks.map((t) => t.id), ['a', 'b', 'c']);
  assert.deepEqual(addTask(plan, {id: 'd'}).tasks.map((t) => t.id), ['a', 'c', 'd']);
  assert.deepEqual(addTask(plan, {afterId: 'nao-existe', id: 'e'}).tasks.map((t) => t.id), ['a', 'c', 'e'], 'id desconhecido cai no fim');
});

test('tarefa nova nasce vazia, sem marca e sem PDF', () => {
  const task = addTask(emptyStudyPlan(), {id: 'x'}).tasks[0];
  assert.deepEqual(task, {id: 'x', text: '', done: false, pdf: '', page: 0});
});

test('tarefa nova sem id recebe um id gerado, e dois seguidos não colidem', () => {
  const once = addTask(emptyStudyPlan());
  const twice = addTask(once);
  assert.ok(once.tasks[0].id.length > 0);
  assert.notEqual(twice.tasks[0].id, twice.tasks[1].id);
});

test('o plano para de criar tarefas no teto', () => {
  const full = planOf(Array.from({length: PLAN_LIMITS.tasks}, (_, i) => `t${i}`));
  assert.equal(addTask(full, {id: 'extra'}), full);
});

test('editar o texto troca só essa tarefa, e o texto cabe no teto', () => {
  const next = editTask(planOf(['a', 'b']), 'b', 'Q4 velocidade zero');
  assert.equal(next.tasks[1].text, 'Q4 velocidade zero');
  assert.equal(next.tasks[0].text, 'texto a');
  assert.equal(editTask(planOf(['a']), 'a', 'x'.repeat(PLAN_LIMITS.text + 50)).tasks[0].text.length, PLAN_LIMITS.text);
  assert.equal(editTask(planOf(['a']), 'nao-existe', 'y').tasks[0].text, 'texto a', 'id desconhecido não muda nada');
});

test('editar texto substitui quebras de linha por espaços', () => {
  const plan = planOf(['a']);
  assert.equal(editTask(plan, 'a', 'Q1\nQ2').tasks[0].text, 'Q1 Q2');
});

test('Backspace em tarefa vazia remove e devolve o foco para a anterior', () => {
  const plan = editTask(planOf(['a', 'b', 'c']), 'b', '');
  const result = removeEmptyTask(plan, 'b');
  assert.equal(result.removed, true);
  assert.deepEqual(result.plan.tasks.map((t) => t.id), ['a', 'c']);
  assert.equal(result.focusId, 'a');
});

test('Backspace em tarefa só de espaços conta como vazia', () => {
  const plan = editTask(planOf(['a', 'b']), 'b', '   ');
  assert.equal(removeEmptyTask(plan, 'b').removed, true);
});

test('Backspace com texto não remove a tarefa', () => {
  const plan = planOf(['a', 'b']);
  const result = removeEmptyTask(plan, 'b');
  assert.equal(result.removed, false);
  assert.equal(result.plan, plan);
  assert.equal(result.focusId, 'b');
});

test('apagar a primeira tarefa leva o foco para a seguinte, e apagar a última deixa sem foco', () => {
  const first = removeEmptyTask(editTask(planOf(['a', 'b']), 'a', ''), 'a');
  assert.equal(first.focusId, 'b');
  const last = removeTaskAt(planOf(['a']), 'a');
  assert.deepEqual(last.plan.tasks, []);
  assert.equal(last.focusId, '');
});

test('reordenar troca a tarefa com a vizinha e para nas pontas', () => {
  const plan = planOf(['a', 'b', 'c']);
  assert.deepEqual(moveTask(plan, 'c', -1).tasks.map((t) => t.id), ['a', 'c', 'b']);
  assert.deepEqual(moveTask(plan, 'a', 1).tasks.map((t) => t.id), ['b', 'a', 'c']);
  assert.equal(moveTask(plan, 'a', -1), plan, 'a primeira não sobe');
  assert.equal(moveTask(plan, 'c', 1), plan, 'a última não desce');
});

test('reordenar não muda quem é o agora fora da ordem nova', () => {
  const plan = planOf(['a', 'b', 'c'], ['a']);
  assert.equal(currentTaskId(moveTask(plan, 'c', -1)), 'c', 'o agora é a primeira não marcada da lista nova');
});

test('ligar ao PDF guarda caminho e página; sem PDF desliga', () => {
  const linked = linkTask(planOf(['a']), 'a', {pdf: '/m/Lista.pdf', page: 4});
  assert.deepEqual(linked.tasks[0], {id: 'a', text: 'texto a', done: false, pdf: '/m/Lista.pdf', page: 4});
  const unlinked = linkTask(linked, 'a', {});
  assert.equal(unlinked.tasks[0].pdf, '');
  assert.equal(unlinked.tasks[0].page, 0);
});

test('desligar do PDF tira caminho e página e não mexe nas outras tarefas', () => {
  const linked = linkTask(planOf(['a', 'b']), 'a', {pdf: '/m/Lista.pdf', page: 4});
  const unlinked = unlinkTask(linked, 'a');
  assert.deepEqual(unlinked.tasks[0], {id: 'a', text: 'texto a', done: false, pdf: '', page: 0});
  assert.deepEqual(unlinked.tasks[1], linked.tasks[1], 'a tarefa vizinha fica como estava');
  assert.equal(linked.tasks[0].pdf, '/m/Lista.pdf', 'o plano de antes não muda');
  assert.equal(unlinkTask(linked, 'zz'), linked, 'id desconhecido devolve o mesmo plano');
});

test('a página ligada é inteira e cabe entre 1 e o teto', () => {
  assert.equal(linkTask(planOf(['a']), 'a', {pdf: '/x.pdf', page: 0}).tasks[0].page, 1);
  assert.equal(linkTask(planOf(['a']), 'a', {pdf: '/x.pdf', page: 2.7}).tasks[0].page, 2);
  assert.equal(linkTask(planOf(['a']), 'a', {pdf: '/x.pdf', page: 1e9}).tasks[0].page, PLAN_LIMITS.page);
});

test('as Anotações são texto livre e cabem no teto', () => {
  assert.equal(setNotes(emptyStudyPlan(), 'Prova sexta.\nRegra da cadeia.').notes, 'Prova sexta.\nRegra da cadeia.');
  assert.equal(setNotes(emptyStudyPlan(), 'n'.repeat(PLAN_LIMITS.notes + 1)).notes.length, PLAN_LIMITS.notes);
});

test('as operações não mudam o plano que receberam', () => {
  const plan = planOf(['a', 'b']);
  const before = JSON.stringify(plan);
  setTaskDone(plan, 'a', true);
  addTask(plan, {id: 'c'});
  editTask(plan, 'a', 'mudou');
  moveTask(plan, 'b', -1);
  removeTaskAt(plan, 'a');
  linkTask(plan, 'a', {pdf: '/x.pdf'});
  setNotes(plan, 'nota');
  assert.equal(JSON.stringify(plan), before);
});

test('sanitizeStudyPlan: forma inválida vira plano vazio', () => {
  assert.deepEqual(sanitizeStudyPlan(undefined), emptyStudyPlan());
  assert.deepEqual(sanitizeStudyPlan('lixo'), emptyStudyPlan());
  assert.deepEqual(sanitizeStudyPlan({tasks: 'nao é lista', notes: 7}), {tasks: [], notes: ''});
});

test('sanitizeStudyPlan: tarefa sem id some e id repetido fica só o primeiro', () => {
  const plan = sanitizeStudyPlan({tasks: [{text: 'sem id'}, {id: 'a', text: 'um'}, {id: 'a', text: 'dois'}, null]});
  assert.deepEqual(plan.tasks.map((t) => [t.id, t.text]), [['a', 'um']]);
});

test('sanitizeStudyPlan: marca só conta como feita quando é true, página inválida cai em 1', () => {
  const plan = sanitizeStudyPlan({tasks: [{id: 'a', done: 'sim', page: 'x', pdf: ''}, {id: 'b', done: true, page: 3}]});
  assert.equal(plan.tasks[0].done, false);
  assert.equal(plan.tasks[1].done, true);
});

test('sanitizeStudyPlan: PDF só sobrevive se a Mesa o autorizou', () => {
  const value = {tasks: [{id: 'a', pdf: '/curso/Lista.pdf', page: 3}, {id: 'b', pdf: '/fora/Outro.pdf', page: 9}]};
  const plan = sanitizeStudyPlan(value, {allowed: new Set(['/curso/Lista.pdf'])});
  assert.deepEqual(plan.tasks[0], {id: 'a', text: '', done: false, pdf: '/curso/Lista.pdf', page: 3});
  assert.deepEqual(plan.tasks[1], {id: 'b', text: '', done: false, pdf: '', page: 0});
});

test('sanitizeStudyPlan: sem lista de autorizados (leitura do disco) o PDF fica', () => {
  const plan = sanitizeStudyPlan({tasks: [{id: 'a', pdf: '/curso/Lista.pdf', page: 3}]});
  assert.equal(plan.tasks[0].pdf, '/curso/Lista.pdf');
});

test('sanitizeStudyPlan: textos e lista respeitam os tetos', () => {
  const many = Array.from({length: PLAN_LIMITS.tasks + 5}, (_, i) => ({id: `t${i}`, text: 'x'.repeat(PLAN_LIMITS.text + 9)}));
  const plan = sanitizeStudyPlan({tasks: many, notes: 'n'.repeat(PLAN_LIMITS.notes + 3)});
  assert.equal(plan.tasks.length, PLAN_LIMITS.tasks);
  assert.equal(plan.tasks[0].text.length, PLAN_LIMITS.text);
  assert.equal(plan.notes.length, PLAN_LIMITS.notes);
});

test('o saneador da matéria (desk.json) guarda o plano e aceita matéria sem plano', () => {
  const saved = sanitizeCourseState({studyPlan: {tasks: [{id: 'a', text: 'Q1', done: true}], notes: 'oi'}});
  assert.deepEqual(saved.studyPlan, {tasks: [{id: 'a', text: 'Q1', done: true, pdf: '', page: 0}], notes: 'oi'});
  assert.deepEqual(sanitizeCourseState({}).studyPlan, emptyStudyPlan());
});

test('a loja guarda o plano da matéria aberta; forma inválida carregada vira vazio', () => {
  loadStudyPlan({tasks: [{id: 'a', text: 'Q1'}], notes: ''});
  assert.equal(studyPlanSnapshot().tasks[0].text, 'Q1');
  setStudyPlan(setNotes(studyPlanSnapshot(), 'depois'));
  assert.equal(studyPlanSnapshot().notes, 'depois');
  loadStudyPlan(undefined);
  assert.deepEqual(studyPlanSnapshot(), emptyStudyPlan(), 'matéria sem plano abre vazia');
});
